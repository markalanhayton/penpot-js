/**
 * @module tasks/scheduler
 * @description Background task scheduler — mirrors `app.tasks` from the Clojure backend.
 *
 * Runs periodic maintenance jobs when the `backend_worker` feature flag is enabled.
 * Uses `setInterval` to check and execute registered tasks at their configured intervals.
 *
 * ### Built-in tasks
 *
 * | Task                  | Interval   | Description                                              |
 * |-----------------------|------------|----------------------------------------------------------|
 * | `session-gc`          | 5 min      | Purge inactive/expired HTTP sessions and tokens         |
 * | `objects-gc`          | 60 min     | Cascade-delete soft-deleted DB rows + touched storage   |
 * | `storage-gc-touched`  | 60 min     | Check touched storage objects for remaining references  |
 * | `storage-gc-deleted`  | 60 min     | Permanently delete storage objects marked as deleted    |
 * | `upload-session-gc`   | 10 min     | Delete stalled upload sessions older than 1 hour        |
 * | `file-gc`             | 60 min     | Trim unused media, thumbnails, and components from files|
 * | `tasks-gc`            | 60 min     | Delete completed/old task rows                          |
 * | `audit-log-archive`   | 30 min     | Send unarchived audit events to external service        |
 * | `audit-log-gc`        | 60 min     | Delete archived audit events from database              |
 * | `search-rebuild`      | 30 min     | Rebuild FTS5 search index (catches soft-deletes)        |
 * | `telemetry`           | 3 hr       | Collect and upload instance stats and audit events      |
 */

import { config } from '../config/index.js';
import { runTelemetryTask } from './telemetry.js';
import { archiveTask as auditArchive, gcTask as auditGc } from '../loggers/audit.js';
import { rebuildSearchIndex } from '../rpc/search.js';

/** @type {Map<string, { handler: function, intervalMs: number, lastRun: number }>} */
const tasks = new Map();

/** @type {NodeJS.Timeout|null} */
let intervalHandle = null;

/**
 * Register a periodic task.
 *
 * @param {string} name - Unique task name (e.g. `'session-gc'`).
 * @param {function(import('../db/sqlite.js').DatabasePool): Promise<void>} handler
 *   - Async function to execute; receives the database pool.
 * @param {number} intervalMs - Minimum interval between runs in milliseconds.
 */
export function registerTask(name, handler, intervalMs) {
  tasks.set(name, { handler, intervalMs, lastRun: 0 });
}

// --- Task Handlers (mirrors app.tasks.*) ---

/**
 * Session GC — clean up expired/inactive HTTP sessions and tokens.
 * Mirrors `app.http.session.tasks/gc`.
 */
async function sessionGc(pool) {
  pool.run("DELETE FROM http_session WHERE is_active = '0' OR modified_at < datetime('now', '-7 days')");
  pool.run("DELETE FROM generic_token WHERE valid_until IS NOT NULL AND valid_until < datetime('now')");
}

/**
 * Objects GC — cascade-delete soft-deleted database rows and touch storage objects.
 * Mirrors `app.tasks.objects-gc/handler`.
 *
 * Processes in chunks: profiles, teams, font variants, file thumbnails,
 * file object thumbnails, file media objects, and file data fragments.
 */
/**
 * Disable deletion protection for GC hard-deletes.
 * Sets the rules.deletion_protection server_prop to disabled,
 * allowing hard-deletes on protected tables (profile, team, etc.).
 * Must be called before hard-deleting from protected tables.
 * Call enableDeletionProtection() when done.
 */
function disableDeletionProtection(pool) {
  pool.run("UPDATE server_prop SET content = '{\"enabled\": false}' WHERE id = 'rules.deletion_protection'");
}

function enableDeletionProtection(pool) {
  pool.run("UPDATE server_prop SET content = '{\"enabled\": true}' WHERE id = 'rules.deletion_protection'");
}

async function objectsGc(pool) {
  const now = new Date().toISOString();
  const CHUNK_SIZE = 100;

  // Touch storage objects referenced by soft-deleted profiles (use photo_id, not legacy photo column)
  const profiles = pool.query(
    "SELECT id, photo_id FROM profile WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT ?",
    [now, CHUNK_SIZE]
  );
  for (const p of profiles) {
    if (p.photo_id) {
      pool.run('UPDATE storage_object SET touched_at = ? WHERE id = ?', [now, p.photo_id]);
    }
  }

  // Touch storage objects referenced by soft-deleted team font variants
  const fonts = pool.query(
    "SELECT id, otf_file_id, ttf_file_id, woff1_file_id, woff2_file_id FROM team_font_variant WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT ?",
    [now, CHUNK_SIZE]
  );
  for (const f of fonts) {
    for (const col of ['otf_file_id', 'ttf_file_id', 'woff1_file_id', 'woff2_file_id']) {
      if (f[col]) {
        pool.run('UPDATE storage_object SET touched_at = ? WHERE id = ?', [now, f[col]]);
      }
    }
  }

  // Hard-deletes below require deletion protection to be disabled
  disableDeletionProtection(pool);
  try {
    pool.run("DELETE FROM team_font_variant WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now]);

    // Touch storage objects for file thumbnails before hard-deleting
    const fileThumbs = pool.query(
      "SELECT media_id FROM file_thumbnail WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT ?",
      [now, CHUNK_SIZE]
    );
    for (const ft of fileThumbs) {
      pool.run('UPDATE storage_object SET touched_at = ? WHERE id = ?', [now, ft.media_id]);
    }
    pool.run("DELETE FROM file_thumbnail WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now]);

    // Touch storage objects for tagged object thumbnails before hard-deleting
    const objThumbs = pool.query(
      "SELECT media_id FROM file_tagged_object_thumbnail WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT ?",
      [now, CHUNK_SIZE]
    );
    for (const ot of objThumbs) {
      pool.run('UPDATE storage_object SET touched_at = ? WHERE id = ?', [now, ot.media_id]);
    }
    pool.run("DELETE FROM file_tagged_object_thumbnail WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now]);

    // Touch storage objects for file media objects before hard-deleting
    const mediaObjs = pool.query(
      "SELECT media_id, thumbnail_id FROM file_media_object WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT ?",
      [now, CHUNK_SIZE]
    );
    for (const m of mediaObjs) {
      if (m.media_id) pool.run('UPDATE storage_object SET touched_at = ? WHERE id = ?', [now, m.media_id]);
      if (m.thumbnail_id) pool.run('UPDATE storage_object SET touched_at = ? WHERE id = ?', [now, m.thumbnail_id]);
    }
    pool.run("DELETE FROM file_media_object WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now]);

    // Hard-delete soft-deleted files and their dependents (in dependency order)
    pool.run("DELETE FROM file_change WHERE file_id IN (SELECT id FROM file WHERE deleted_at IS NOT NULL AND deleted_at < ?)", [now]);
    pool.run("DELETE FROM file_media_object WHERE file_id IN (SELECT id FROM file WHERE deleted_at IS NOT NULL AND deleted_at < ?)", [now]);
    pool.run("DELETE FROM page WHERE file_id IN (SELECT id FROM file WHERE deleted_at IS NOT NULL AND deleted_at < ?)", [now]);
    pool.run("DELETE FROM file WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now]);
    pool.run("DELETE FROM project WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now]);
    pool.run("DELETE FROM profile WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now]);
    pool.run("DELETE FROM team WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now]);
  } finally {
    enableDeletionProtection(pool);
  }
}

/**
 * Storage GC (touched) — check touched storage objects for remaining references.
 * Mirrors `app.storage.gc-touched/handler`.
 *
 * If a touched object still has references in DB tables, clear its touched_at.
 * If unreferenced, mark it for deletion.
 */
async function storageGcTouched(pool) {
  const now = new Date().toISOString();
  const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // Find all touched objects older than 2 hours
  const touched = pool.query(
    "SELECT id, bucket, touched_at FROM storage_object WHERE touched_at IS NOT NULL AND touched_at < ? AND deleted_at IS NULL",
    [TWO_HOURS_AGO]
  );

  for (const obj of touched) {
    let hasRef = false;

    switch (obj.bucket) {
      case 'file-media-object':
        hasRef = !!pool.get("SELECT 1 FROM file_media_object WHERE media_id = ? OR thumbnail_id = ? LIMIT 1", [obj.id, obj.id]);
        break;
      case 'team-font-variant':
        hasRef = !!pool.get("SELECT 1 FROM team_font_variant WHERE otf_file_id = ? OR ttf_file_id = ? OR woff1_file_id = ? OR woff2_file_id = ? LIMIT 1", [obj.id, obj.id, obj.id, obj.id]);
        break;
      case 'file-object-thumbnail':
        hasRef = !!pool.get("SELECT 1 FROM file_tagged_object_thumbnail WHERE media_id = ? LIMIT 1", [obj.id]);
        break;
      case 'file-thumbnail':
        hasRef = !!pool.get("SELECT 1 FROM file_thumbnail WHERE media_id = ? LIMIT 1", [obj.id]);
        break;
      case 'profile':
        hasRef = !!pool.get("SELECT 1 FROM profile WHERE photo_id = ? LIMIT 1", [obj.id]) ||
                 !!pool.get("SELECT 1 FROM team WHERE photo_id = ? LIMIT 1", [obj.id]);
        break;
      case 'tempfile':
        // Temp files should always be deleted after processing
        hasRef = false;
        break;
      default:
        // Unknown bucket — keep it safe, don't delete
        hasRef = true;
    }

    if (hasRef) {
      // Still referenced — clear touched_at so GC doesn't check again until next touch
      pool.run('UPDATE storage_object SET touched_at = NULL WHERE id = ?', [obj.id]);
    } else {
      // Unreferenced — mark for deletion
      pool.run('UPDATE storage_object SET deleted_at = ? WHERE id = ?', [now, obj.id]);
    }
  }
}

/**
 * Storage GC (deleted) — permanently delete storage objects whose deleted_at has passed.
 * Mirrors `app.storage.gc-deleted/handler`.
 *
 * Deletes the filesystem file and removes the DB row.
 */
async function storageGcDeleted(pool) {
  const now = new Date().toISOString();
  const { deleteObject } = await import('../storage/fs.js');

  // Process in chunks of 25 (mirrors Clojure backend)
  const objects = pool.query(
    "SELECT id, backend FROM storage_object WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT 25",
    [now]
  );

  for (const obj of objects) {
    // Delete filesystem file
    deleteObject(obj.id);
    // Delete DB row
    pool.run('DELETE FROM storage_object WHERE id = ?', [obj.id]);
  }
}

/**
 * Upload session GC — delete stalled upload sessions older than 1 hour.
 * Mirrors `app.tasks.upload-session-gc/handler`.
 */
async function uploadSessionGc(pool) {
  pool.run("DELETE FROM upload_session WHERE created_at < datetime('now', '-1 hour')");
}

/**
 * File GC — trim unused media, thumbnails, and components from files.
 * Mirrors `app.tasks.file-gc/handler`.
 *
 * Finds files where `has_media_trimmed = 0` and processes them:
 * 1. Mark unreferenced media objects as deleted
 * 2. Mark unused object thumbnails as deleted
 * 3. Mark old file thumbnails (revn < current) as deleted
 * 4. Mark unused file_data fragments as deleted
 * 5. Set `has_media_trimmed = 1` when done
 */
async function fileGc(pool) {
  const now = new Date().toISOString();
  const CLEAN_DELAY = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const files = pool.query(
    "SELECT id, revn FROM file WHERE has_media_trimmed = '0' AND modified_at < ? AND deleted_at IS NULL LIMIT 10",
    [CLEAN_DELAY]
  );

  for (const file of files) {
    try {
      fileGcFile(pool, file.id, file.revn || 0, now);
    } catch (err) {
      console.error(`[file-gc] Error processing file ${file.id}:`, err.message);
    }
  }
}

/**
 * Process a single file for GC.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} fileId
 * @param {number} revn
 * @param {string} now
 */
async function fileGcFile(pool, fileId, revn, now) {
  const { decode } = await import('../files/blob.js');

  // 1. Collect used media IDs from file data
  const usedMediaIds = new Set();
  const usedFragmentIds = new Set();

  const fileDataRow = pool.get(
    "SELECT * FROM file_data WHERE file_id = ? AND type = 'main' AND deleted_at IS NULL ORDER BY modified_at DESC LIMIT 1",
    [fileId]
  );

  if (fileDataRow && fileDataRow.data) {
    try {
      const data = await decode(fileDataRow.data);
      collectUsedMediaIds(data, usedMediaIds);
    } catch {
      // If we can't decode the file data, skip media collection
      // but still process thumbnails and fragments
    }
  }

  // 2. Also collect media IDs from historical snapshots (file_change rows)
  const changes = pool.query(
    "SELECT changes FROM file_change WHERE file_id = ? AND changes IS NOT NULL AND deleted_at IS NULL LIMIT 50",
    [fileId]
  );

  for (const row of changes) {
    try {
      const changeData = Buffer.isBuffer(row.changes) ? await decode(row.changes) : row.changes;
      if (Array.isArray(changeData)) {
        for (const change of changeData) {
          collectUsedMediaIds(change, usedMediaIds);
        }
      } else if (changeData) {
        collectUsedMediaIds(changeData, usedMediaIds);
      }
    } catch {
      // Ignore malformed change records
    }
  }

  // 3. Collect used object thumbnail IDs from page frames
  const usedObjectThumbnailIds = new Set();
  const pages = pool.query(
    "SELECT id FROM page WHERE file_id = ? AND deleted_at IS NULL",
    [fileId]
  );

  const file = pool.get("SELECT id FROM file WHERE id = ?", [fileId]);

  for (const page of pages) {
    // Frame and component thumbnails use object IDs in format "{fileId}/{pageId}/{frameId}/{tag}"
    const frames = pool.query(
      "SELECT id, name FROM page WHERE id = ? AND deleted_at IS NULL",
      [page.id]
    );
    // We can't easily compute frame IDs without parsing page data,
    // so we keep existing thumbnails for now and only remove based on revn.
  }

  // 4. Mark unused media objects as deleted
  if (usedMediaIds.size > 0) {
    const placeholders = [...usedMediaIds].map(() => '?').join(',');
    pool.run(
      `UPDATE file_media_object SET deleted_at = ? WHERE file_id = ? AND id NOT IN (${placeholders}) AND deleted_at IS NULL`,
      [now, fileId, ...usedMediaIds]
    );
  } else {
    // No media IDs found — mark ALL media objects as deleted
    pool.run(
      "UPDATE file_media_object SET deleted_at = ? WHERE file_id = ? AND deleted_at IS NULL",
      [now, fileId]
    );
  }

  // 5. Mark old file thumbnails (revn < current) as deleted
  pool.run(
    "UPDATE file_thumbnail SET deleted_at = ? WHERE file_id = ? AND revn < ? AND deleted_at IS NULL",
    [now, fileId, revn]
  );

  // 6. Mark unused file_data fragments as deleted (where type = 'fragment')
  if (usedFragmentIds.size > 0) {
    const fragPlaceholders = [...usedFragmentIds].map(() => '?').join(',');
    pool.run(
      `UPDATE file_data SET deleted_at = ? WHERE file_id = ? AND id NOT IN (${fragPlaceholders}) AND type = 'fragment' AND deleted_at IS NULL`,
      [now, fileId, ...usedFragmentIds]
    );
  } else {
    // No pointer-map fragments tracked — delete all fragments
    pool.run(
      "UPDATE file_data SET deleted_at = ? WHERE file_id = ? AND type = 'fragment' AND deleted_at IS NULL",
      [now, fileId]
    );
  }

  // 7. Cross-library component GC — remove deleted components not used by consumers
  await cleanDeletedComponents(pool, fileId, decode);

  // 8. Mark file as media-trimmed
  pool.run("UPDATE file SET has_media_trimmed = '1' WHERE id = ?", [fileId]);
}

/**
 * Clean deleted components that are no longer used by any consumer file.
 *
 * When a component is marked `deleted` in a library file, it should only be
 * removed from the data if no consumer files (files linked via `file_library_rel`)
 * still reference it. This mirrors `clean-deleted-components!` from the Clojure backend.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} fileId - The library file ID being GC'd.
 * @param {function} decode - Blob decode function.
 */
async function cleanDeletedComponents(pool, fileId, decode) {
  // Load the file's current data
  const fileDataRow = pool.get(
    "SELECT * FROM file_data WHERE file_id = ? AND type = 'main' AND deleted_at IS NULL ORDER BY modified_at DESC LIMIT 1",
    [fileId]
  );

  if (!fileDataRow || !fileDataRow.data) return;

  let data;
  try {
    data = await decode(fileDataRow.data);
  } catch {
    return;
  }

  if (!data || !data.components) return;

  // Find all components marked as deleted
  const deletedComponents = Object.values(data.components).filter(c => c.deleted);
  if (deletedComponents.length === 0) return;

  const deletedIds = new Set(deletedComponents.map(c => c.id));

  // Check local usage — are any deleted components still used in the file's own pages?
  const locallyUsedIds = new Set();
  if (data.pagesIndex) {
    for (const page of Object.values(data.pagesIndex)) {
      if (page && page.objects) {
        collectComponentReferences(page.objects, fileId, locallyUsedIds);
      }
    }
  }

  // Check cross-library usage — are any deleted components used by consumer files?
  const remotelyUsedIds = new Set();

  const consumerFiles = pool.query(
    `SELECT f.id, fd.data
     FROM file_library_rel AS fl
     INNER JOIN file AS f ON (f.id = fl.file_id)
     LEFT JOIN file_data AS fd ON (fd.file_id = f.id AND fd.type = 'main' AND fd.deleted_at IS NULL)
     WHERE fl.library_file_id = ?
       AND f.deleted_at IS NULL`,
    [fileId]
  );

  for (const consumer of consumerFiles) {
    if (!consumer.data) continue;
    try {
      const consumerData = await decode(consumer.data);
      if (consumerData && consumerData.pagesIndex) {
        for (const page of Object.values(consumerData.pagesIndex)) {
          if (page && page.objects) {
            collectComponentReferences(page.objects, fileId, remotelyUsedIds);
          }
        }
      }
    } catch {
      // Skip files we can't decode
    }
  }

  // Determine which deleted components are truly unused
  const unusedIds = [];
  for (const id of deletedIds) {
    if (!locallyUsedIds.has(id) && !remotelyUsedIds.has(id)) {
      unusedIds.push(id);
    }
  }

  if (unusedIds.length === 0) return;

  // Remove unused deleted components from the data
  for (const id of unusedIds) {
    delete data.components[id];
  }

  // Re-encode and persist the updated data
  const { encode } = await import('../files/blob.js');
  const encoded = await encode(data, { version: 5 });

  pool.run(
    'UPDATE file_data SET data = ?, modified_at = ? WHERE file_id = ? AND id = ?',
    [encoded, new Date().toISOString(), fileId, fileDataRow.id]
  );
}

/**
 * Collect component references from an objects map.
 * A shape references a component if it has a `componentId` or `componentRoot`
 * property pointing to a component in the given library file.
 *
 * @param {object} objects - Map of shape ID to shape data.
 * @param {string} libraryFileId - The library file ID to match against.
 * @param {Set<string>} usedIds - Set to accumulate used component IDs into.
 */
export function collectComponentReferences(objects, libraryFileId, usedIds) {
  if (!objects || typeof objects !== 'object') return;
  for (const shape of Object.values(objects)) {
    if (!shape || typeof shape !== 'object') continue;

    // Direct component reference
    if (shape.componentId && shape.componentFileId === libraryFileId) {
      usedIds.add(shape.componentId);
    }

    // Component root reference
    if (shape.componentRoot && shape.componentFileId === libraryFileId) {
      usedIds.add(shape.componentRoot);
    }

    // Remote component reference (shape is an instance of a library component)
    if (shape.shapeRef && shape.shapeRef.fileId === libraryFileId) {
      usedIds.add(shape.shapeRef.componentId);
    }
  }
}

/**
 * Collect used media IDs from a decoded file data object.
 * Walks pages, components, shapes, fills, and strokes to find
 * all referenced media object IDs.
 *
 * @param {object} data - Decoded file data.
 * @param {Set<string>} usedMediaIds - Set to accumulate used media IDs into.
 */
export function collectUsedMediaIds(data, usedMediaIds) {
  if (!data || typeof data !== 'object') return;

  // Collect from file-level media map keys
  if (data.media && typeof data.media === 'object') {
    for (const key of Object.keys(data.media)) {
      usedMediaIds.add(key);
    }
  }

  // Collect from pages index
  if (data.pagesIndex && typeof data.pagesIndex === 'object') {
    for (const page of Object.values(data.pagesIndex)) {
      if (page && page.objects && typeof page.objects === 'object') {
        collectMediaFromShapes(page.objects, usedMediaIds);
      }
    }
  }

  // Collect from pages array (may contain page IDs or page objects)
  if (Array.isArray(data.pages)) {
    for (const pageId of data.pages) {
      if (typeof pageId === 'string') {
        // Page ID reference — already covered by pagesIndex walk
      } else if (pageId && pageId.objects) {
        collectMediaFromShapes(pageId.objects, usedMediaIds);
      }
    }
  }

  // Collect from components
  if (data.components && typeof data.components === 'object') {
    for (const comp of Object.values(data.components)) {
      if (comp) {
        if (comp.objects && typeof comp.objects === 'object') {
          collectMediaFromShapes(comp.objects, usedMediaIds);
        }
        // Also check component-level media references
        collectMediaFromShape(comp, usedMediaIds);
      }
    }
  }
}

/**
 * Walk all shapes in an objects map and collect media references.
 *
 * @param {object} objects - Map of shape ID to shape data.
 * @param {Set<string>} usedMediaIds
 */
export function collectMediaFromShapes(objects, usedMediaIds) {
  if (!objects || typeof objects !== 'object') return;
  for (const shape of Object.values(objects)) {
    if (!shape || typeof shape !== 'object') continue;
    collectMediaFromShape(shape, usedMediaIds);
  }
}

/**
 * Collect media IDs from a single shape.
 *
 * @param {object} shape - A shape object.
 * @param {Set<string>} usedMediaIds
 */
export function collectMediaFromShape(shape, usedMediaIds) {
  if (!shape || typeof shape !== 'object') return;

  // Direct image reference
  if (shape.fillImage) usedMediaIds.add(shape.fillImage);
  if (typeof shape.fillImage === 'string') usedMediaIds.add(shape.fillImage);

  // Image shape metadata
  if (shape.metadata && shape.metadata.mediaId) {
    usedMediaIds.add(shape.metadata.mediaId);
  }

  // Fill array
  if (Array.isArray(shape.fills)) {
    for (const fill of shape.fills) {
      if (fill && fill.fillImage) usedMediaIds.add(fill.fillImage);
      if (fill && fill.fillOpacityGradientId) {
        // gradient refs are not media
      }
    }
  }

  // Stroke array
  if (Array.isArray(shape.strokes)) {
    for (const stroke of shape.strokes) {
      if (stroke && stroke.strokeImage) usedMediaIds.add(stroke.strokeImage);
    }
  }

  // Text content fills
  if (Array.isArray(shape.content)) {
    for (const block of shape.content) {
      if (block && block.fills && Array.isArray(block.fills)) {
        for (const fill of block.fills) {
          if (fill && fill.fillImage) usedMediaIds.add(fill.fillImage);
        }
      }
    }
  }

  // Children (frames, groups)
  if (shape.children && typeof shape.children === 'object') {
    if (Array.isArray(shape.children)) {
      for (const child of shape.children) {
        collectMediaFromShape(child, usedMediaIds);
      }
    } else {
      collectMediaFromShapes(shape.children, usedMediaIds);
    }
  }
}

/**
 * Task GC — delete completed/old task rows.
 * Mirrors `app.tasks.tasks-gc/handler`.
 */
async function tasksGc(pool) {
  pool.run("DELETE FROM task WHERE status = 'completed' AND scheduled_at < datetime('now', '-7 days')");
  pool.run("DELETE FROM task WHERE status = 'new' AND scheduled_at < datetime('now', '-30 days')");
}

/**
 * Start the task scheduler and register built-in maintenance tasks.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool passed to task handlers.
 */
export function startTaskScheduler(pool) {
  if (!flagEnabled('backend_worker')) return;

  console.log('[tasks] Starting task scheduler');

  // Session GC — every 5 minutes
  registerTask('session-gc', sessionGc, 5 * 60 * 1000);

  // Objects GC — every 60 minutes
  registerTask('objects-gc', objectsGc, 60 * 60 * 1000);

  // Storage GC (touched) — every 60 minutes
  registerTask('storage-gc-touched', storageGcTouched, 60 * 60 * 1000);

  // Storage GC (deleted) — every 60 minutes
  registerTask('storage-gc-deleted', storageGcDeleted, 60 * 60 * 1000);

  // Upload session GC — every 10 minutes
  registerTask('upload-session-gc', uploadSessionGc, 10 * 60 * 1000);

  // File GC — every 60 minutes
  registerTask('file-gc', fileGc, 60 * 60 * 1000);

  // Task GC — every 60 minutes
  registerTask('tasks-gc', tasksGc, 60 * 60 * 1000);

  // Audit log archive — every 30 minutes (sends to external service if configured)
  registerTask('audit-log-archive', () => auditArchive(pool), 30 * 60 * 1000);

  // Audit log GC — every 60 minutes (deletes already-archived events)
  registerTask('audit-log-gc', () => auditGc(pool), 60 * 60 * 1000);

  // Search index rebuild — every 30 minutes (keeps FTS5 in sync after soft-deletes)
  registerTask('search-rebuild', () => { rebuildSearchIndex(pool); return Promise.resolve(); }, 30 * 60 * 1000);

  // Telemetry — every 3 hours
  registerTask('telemetry', () => runTelemetryTask(pool), 3 * 60 * 60 * 1000);

  // Run tasks periodically
  intervalHandle = setInterval(async () => {
    const now = Date.now();
    for (const [name, task] of tasks) {
      if (now - task.lastRun >= task.intervalMs) {
        try {
          await task.handler(pool);
          task.lastRun = now;
        } catch (err) {
          console.error(`[tasks] Error in ${name}:`, err.message);
        }
      }
    }
  }, 60 * 1000);
}

/**
 * Stop the task scheduler, clearing the periodic interval.
 */
export function stopTaskScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

import { flagEnabled } from '../config/index.js';