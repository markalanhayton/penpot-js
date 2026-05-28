'use strict';
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
import { fileGc } from './file-gc.js';

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

  // Touch storage objects referenced by soft-deleted team photo
  const teams = pool.query(
    "SELECT id, photo_id FROM team WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT ?",
    [now, CHUNK_SIZE]
  );
  for (const t of teams) {
    if (t.photo_id) {
      pool.run('UPDATE storage_object SET touched_at = ? WHERE id = ?', [now, t.photo_id]);
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

    // Delete soft-deleted file_data rows (RESTRICT FK on file, must be deleted before file)
    pool.run("DELETE FROM file_data WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now]);

    // Delete soft-deleted file_change rows (RESTRICT FK on file, must be deleted before file)
    pool.run("DELETE FROM file_change WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now]);

    // Hard-delete soft-deleted files and their dependents (in dependency order)
    // Tables with RESTRICT FKs to file: file_change, file_data, file_object_thumbnail
    // These must be deleted before their parent file to avoid FK constraint errors
    // Touch media storage objects before deleting file_object_thumbnail rows
    const fotByFile = pool.query(
      "SELECT media_id FROM file_object_thumbnail WHERE file_id IN (SELECT id FROM file WHERE deleted_at IS NOT NULL AND deleted_at < ?) AND media_id IS NOT NULL",
      [now]
    );
    for (const fot of fotByFile) {
      pool.run('UPDATE storage_object SET touched_at = ? WHERE id = ?', [now, fot.media_id]);
    }
    pool.run("DELETE FROM file_object_thumbnail WHERE file_id IN (SELECT id FROM file WHERE deleted_at IS NOT NULL AND deleted_at < ?)", [now]);
    pool.run("DELETE FROM file_change WHERE file_id IN (SELECT id FROM file WHERE deleted_at IS NOT NULL AND deleted_at < ?)", [now]);
    pool.run("DELETE FROM file_data WHERE file_id IN (SELECT id FROM file WHERE deleted_at IS NOT NULL AND deleted_at < ?)", [now]);
    pool.run("DELETE FROM file_media_object WHERE file_id IN (SELECT id FROM file WHERE deleted_at IS NOT NULL AND deleted_at < ?)", [now]);
    pool.run("DELETE FROM page WHERE file_id IN (SELECT id FROM file WHERE deleted_at IS NOT NULL AND deleted_at < ?)", [now]);
    pool.run("DELETE FROM file WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now]);

    // Before hard-deleting projects, clean up RESTRICT-blocked dependents
    // for ALL files under those projects (including non-soft-deleted files,
    // since CASCADE will delete them along with the project)
    // Touch media storage objects before deleting file_object_thumbnail rows
    const fotByProject = pool.query(
      "SELECT fot.media_id FROM file_object_thumbnail fot JOIN file f ON fot.file_id = f.id JOIN project p ON f.project_id = p.id WHERE p.deleted_at IS NOT NULL AND p.deleted_at < ? AND fot.media_id IS NOT NULL LIMIT ?",
      [now, CHUNK_SIZE]
    );
    for (const fot of fotByProject) {
      pool.run('UPDATE storage_object SET touched_at = ? WHERE id = ?', [now, fot.media_id]);
    }
    pool.run("DELETE FROM file_object_thumbnail WHERE file_id IN (SELECT f.id FROM file f JOIN project p ON f.project_id = p.id WHERE p.deleted_at IS NOT NULL AND p.deleted_at < ?)", [now]);
    pool.run("DELETE FROM file_change WHERE file_id IN (SELECT f.id FROM file f JOIN project p ON f.project_id = p.id WHERE p.deleted_at IS NOT NULL AND p.deleted_at < ?)", [now]);
    pool.run("DELETE FROM file_data WHERE file_id IN (SELECT f.id FROM file f JOIN project p ON f.project_id = p.id WHERE p.deleted_at IS NOT NULL AND p.deleted_at < ?)", [now]);
    pool.run("DELETE FROM project WHERE deleted_at IS NOT NULL AND deleted_at < ?", [now]);

    // Before hard-deleting teams, clean up RESTRICT-blocked dependents
    // for ALL files under those teams (cascade will delete projects -> files)
    // Touch media storage objects before deleting file_object_thumbnail rows
    const fotByTeam = pool.query(
      "SELECT fot.media_id FROM file_object_thumbnail fot JOIN file f ON fot.file_id = f.id JOIN project p ON f.project_id = p.id JOIN team t ON p.team_id = t.id WHERE t.deleted_at IS NOT NULL AND t.deleted_at < ? AND fot.media_id IS NOT NULL LIMIT ?",
      [now, CHUNK_SIZE]
    );
    for (const fot of fotByTeam) {
      pool.run('UPDATE storage_object SET touched_at = ? WHERE id = ?', [now, fot.media_id]);
    }
    pool.run("DELETE FROM file_object_thumbnail WHERE file_id IN (SELECT f.id FROM file f JOIN project p ON f.project_id = p.id JOIN team t ON p.team_id = t.id WHERE t.deleted_at IS NOT NULL AND t.deleted_at < ?)", [now]);
    pool.run("DELETE FROM file_change WHERE file_id IN (SELECT f.id FROM file f JOIN project p ON f.project_id = p.id JOIN team t ON p.team_id = t.id WHERE t.deleted_at IS NOT NULL AND t.deleted_at < ?)", [now]);
    pool.run("DELETE FROM file_data WHERE file_id IN (SELECT f.id FROM file f JOIN project p ON f.project_id = p.id JOIN team t ON p.team_id = t.id WHERE t.deleted_at IS NOT NULL AND t.deleted_at < ?)", [now]);

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
        hasRef = !!pool.get("SELECT 1 FROM team_font_variant WHERE otf_file_id = ? OR woff1_file_id = ? OR woff2_file_id = ? OR ttf_file_id = ? LIMIT 1", [obj.id, obj.id, obj.id, obj.id]);
        break;
      case 'file-object-thumbnail':
        hasRef = !!pool.get("SELECT 1 FROM file_tagged_object_thumbnail WHERE media_id = ? LIMIT 1", [obj.id]);
        break;
      case 'file-data':
        // File data stored on storage backend — check if file_data row exists
        hasRef = !!pool.get("SELECT 1 FROM file_data WHERE data IS NULL AND backend = 'storage' AND metadata LIKE ? LIMIT 1", [`%"storage-ref-id":"${obj.id}"%`]);
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
  // 1. Delete expired upload sessions
  pool.run("DELETE FROM upload_session WHERE created_at < datetime('now', '-1 hour')");

  // 2. Clean up orphaned chunk storage objects from abandoned uploads.
  // Chunks store their session ID in the metadata JSON column as upload_id.
  // Find tempfile storage objects older than 1 hour whose upload_id references
  // a deleted (or nonexistent) upload_session, and mark them for deletion.
  const orphanedChunks = pool.query(
      `SELECT so.id FROM storage_object so
      WHERE so.bucket = 'tempfile'
        AND so.touched_at IS NULL
        AND so.created_at < datetime('now', '-1 hour')
        AND so.deleted_at IS NULL
        AND json_extract(so.metadata, '$.upload_id') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM upload_session us WHERE us.id = json_extract(so.metadata, '$.upload_id')
        )
      LIMIT 1000`
  );

  if (orphanedChunks.length > 0) {
    const now = new Date().toISOString();
    const ids = orphanedChunks.map(c => c.id);
    const placeholders = ids.map(() => '?').join(',');
    pool.run(
      `UPDATE storage_object SET deleted_at = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      [now, ...ids]
    );
    console.log(`[upload-session-gc] Marked ${orphanedChunks.length} orphaned chunk objects for deletion`);
  }
}

// fileGc is imported from ./file-gc.js

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