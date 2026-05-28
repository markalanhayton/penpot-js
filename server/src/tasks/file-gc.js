'use strict';
/**
 * @module tasks/file-gc
 * @description File garbage collection — mirrors `app.tasks.file-gc` from the Clojure backend.
 *
 * Handles the removal of unused media objects, stale thumbnails, orphaned
 * components, unused data fragments, and shape data cleaning for files
 * that have `has_media_trimmed = false`.
 *
 * ### Pipeline
 *
 * For each file eligible for GC:
 * 1. Validate revision (skip if file changed since scheduled)
 * 2. Clean file data (shape migrations, nil cleanup)
 * 3. Clean deleted components (check local + cross-library usage)
 * 4. Clean unused media objects
 * 5. Clean old file thumbnails
 * 6. Clean unused object thumbnails
 * 7. Clean unused data fragments
 * 8. Mark file as media-trimmed
 */

/**
 * Format an object thumbnail ID from parts.
 * Mirrors `fmt-object-id` from `app.common.thumbnails`.
 *
 * @param {string} fileId
 * @param {string} pageId
 * @param {string} frameId
 * @param {string} tag - Either 'frame' or 'component'
 * @returns {string} Formatted object ID string
 */
function fmtObjectIdParts(fileId, pageId, frameId, tag) {
  return `${fileId}/${pageId}/${frameId}/${tag}`;
}

/**
 * Run file GC on all eligible files.
 *
 * Finds files where `has_media_trimmed = 0` and processes them.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 */
export async function fileGc(pool) {
  const now = new Date().toISOString();
  const CLEAN_DELAY = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const files = pool.query(
    "SELECT id, revn FROM file WHERE has_media_trimmed = '0' AND modified_at < ? AND deleted_at IS NULL LIMIT 10",
    [CLEAN_DELAY]
  );

  for (const file of files) {
    try {
      await fileGcFile(pool, file.id, file.revn || 0, now);
    } catch (err) {
      console.error(`[file-gc] Error processing file ${file.id}:`, err.message);
    }
  }
}

/**
 * Process a single file for GC.
 *
 * Mirrors the upstream `process-file!` pipeline:
 * 1. Validate revision (skip if file changed since scheduled)
 * 2. Clean file data (shape fixes, nil cleanup)
 * 3. Clean deleted components
 * 4. Clean unused media
 * 5. Clean old file thumbnails
 * 6. Clean unused object thumbnails
 * 7. Clean unused data fragments
 * 8. Mark file as media-trimmed
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} fileId
 * @param {number} scheduledRevn
 * @param {string} now
 */
export async function fileGcFile(pool, fileId, scheduledRevn, now) {
  const { decode, encode } = await import('../files/blob.js');

  // Step 0: Fetch file and validate revision (upstream checks revn hasn't changed)
  const fileRow = pool.get(
    "SELECT id, revn FROM file WHERE id = ? AND deleted_at IS NULL",
    [fileId]
  );

  if (!fileRow) {
    console.log(`[file-gc] File ${fileId} not found or deleted, skipping`);
    return;
  }

  // If a scheduled revision was provided, skip if file has been modified since
  if (scheduledRevn && fileRow.revn !== scheduledRevn) {
    console.log(`[file-gc] File ${fileId} revn changed (${scheduledRevn} → ${fileRow.revn}), skipping`);
    return;
  }

  const revn = fileRow.revn || 0;

  // Step 1: Fetch file data
  const fileDataRow = pool.get(
    "SELECT * FROM file_data WHERE file_id = ? AND type = 'main' AND deleted_at IS NULL ORDER BY modified_at DESC LIMIT 1",
    [fileId]
  );

  if (!fileDataRow || !fileDataRow.data) {
    console.log(`[file-gc] No file data for ${fileId}, marking as trimmed`);
    pool.run("UPDATE file SET has_media_trimmed = '1' WHERE id = ?", [fileId]);
    return;
  }

  let data;
  try {
    data = await decode(fileDataRow.data);
  } catch {
    console.error(`[file-gc] Cannot decode file data for ${fileId}, skipping`);
    return;
  }

  if (!data) {
    console.log(`[file-gc] Null file data for ${fileId}, marking as trimmed`);
    pool.run("UPDATE file SET has_media_trimmed = '1' WHERE id = ?", [fileId]);
    return;
  }

  // Step 2: Clean file data (shape migrations, nil key removal)
  data = cleanFile(data);

  // Step 3: Clean deleted components (check local + cross-library usage)
  await cleanDeletedComponents(pool, fileId, data, decode);

  // Step 4: Collect used media IDs from file data + change history
  const usedMediaIds = new Set();
  collectUsedMediaIds(data, usedMediaIds);

  // Also collect from historical snapshots
  const changes = pool.query(
    "SELECT changes FROM file_change WHERE file_id = ? AND changes IS NOT NULL AND deleted_at IS NULL LIMIT 500",
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

  // Step 5: Clean unused media objects
  if (usedMediaIds.size > 0) {
    const placeholders = [...usedMediaIds].map(() => '?').join(',');
    pool.run(
      `UPDATE file_media_object SET deleted_at = ? WHERE file_id = ? AND id NOT IN (${placeholders}) AND deleted_at IS NULL`,
      [now, fileId, ...usedMediaIds]
    );
  } else {
    pool.run(
      "UPDATE file_media_object SET deleted_at = ? WHERE file_id = ? AND deleted_at IS NULL",
      [now, fileId]
    );
  }

  // Step 6: Clean old file thumbnails (revn < current)
  pool.run(
    "UPDATE file_thumbnail SET deleted_at = ? WHERE file_id = ? AND revn < ? AND deleted_at IS NULL",
    [now, fileId, revn]
  );

  // Step 7: Clean unused object thumbnails
  // Compute which object thumbnails are still in use by walking frames and components
  const usedObjectThumbnailIds = computeUsedObjectThumbnailIds(fileId, data);

  // Mark stale thumbnails (revn < current) as deleted first
  pool.run(
    "UPDATE file_tagged_object_thumbnail SET deleted_at = ? WHERE file_id = ? AND revn < ? AND deleted_at IS NULL",
    [now, fileId, revn]
  );

  // Then mark unused thumbnails for current revision as deleted
  if (usedObjectThumbnailIds.size > 0) {
    const thumbPlaceholders = [...usedObjectThumbnailIds].map(() => '?').join(',');
    pool.run(
      `UPDATE file_tagged_object_thumbnail SET deleted_at = ? WHERE file_id = ? AND object_id NOT IN (${thumbPlaceholders}) AND revn >= ? AND deleted_at IS NULL`,
      [now, fileId, ...usedObjectThumbnailIds, revn]
    );
  } else {
    // No object thumbnails referenced — delete all remaining thumbnails for current revision
    pool.run(
      "UPDATE file_tagged_object_thumbnail SET deleted_at = ? WHERE file_id = ? AND revn >= ? AND deleted_at IS NULL",
      [now, fileId, revn]
    );
  }

  // Step 8: Clean unused data fragments (type = 'fragment')
  const usedFragmentIds = collectUsedFragmentIds(data);
  if (usedFragmentIds.size > 0) {
    const fragPlaceholders = [...usedFragmentIds].map(() => '?').join(',');
    pool.run(
      `UPDATE file_data SET deleted_at = ? WHERE file_id = ? AND id NOT IN (${fragPlaceholders}) AND type = 'fragment' AND deleted_at IS NULL`,
      [now, fileId, ...usedFragmentIds]
    );
  } else {
    pool.run(
      "UPDATE file_data SET deleted_at = ? WHERE file_id = ? AND type = 'fragment' AND deleted_at IS NULL",
      [now, fileId]
    );
  }

  // Step 9: Persist cleaned data and mark file as media-trimmed
  try {
    const encoded = await encode(data, { version: 5 });
    pool.run(
      'UPDATE file_data SET data = ?, modified_at = ? WHERE file_id = ? AND id = ?',
      [encoded, new Date().toISOString(), fileId, fileDataRow.id]
    );
  } catch (err) {
    console.error(`[file-gc] Error persisting cleaned data for ${fileId}:`, err.message);
  }

  pool.run("UPDATE file SET has_media_trimmed = '1' WHERE id = ?", [fileId]);
}

// --- Shape Cleaning Pipeline (mirrors binfile/cleaner.clj) ---

/**
 * Clean file data by walking pages, components, and removing nil keys.
 * Mirrors `app.binfile.cleaner/clean-file`.
 *
 * **Note:** This function mutates the input `data` object in place.
 *
 * @mutates data
 * @param {object} data - Decoded file data object.
 * @returns {object} The same `data` object (mutated in place).
 */
export function cleanFile(data) {
  if (!data || typeof data !== 'object') return data;

  // Clean pages
  if (data.pagesIndex && typeof data.pagesIndex === 'object') {
    for (const pageId of Object.keys(data.pagesIndex)) {
      data.pagesIndex[pageId] = fixContainer(data.pagesIndex[pageId]);
    }
  }

  // Clean components
  if (data.components && typeof data.components === 'object') {
    for (const compId of Object.keys(data.components)) {
      data.components[compId] = fixContainer(data.components[compId]);
    }
  }

  // Remove nil keys from top-level data
  removeNilKeys(data);

  return data;
}

/**
 * Fix a container (page or component) by cleaning its shapes and removing nil keys.
 * Mirrors `fix-container` from binfile/cleaner.clj.
 *
 * @param {object} container - A page or component object.
 * @returns {object} Cleaned container.
 */
function fixContainer(container) {
  if (!container || typeof container !== 'object') return container;

  // Remove nil keys from objects map
  if (container.objects && typeof container.objects === 'object') {
    removeNilKey(container.objects);

    // Clean each shape
    for (const shapeId of Object.keys(container.objects)) {
      container.objects[shapeId] = cleanShapePostDecode(container.objects[shapeId]);
    }
  }

  removeNilKeys(container);
  return container;
}

/**
 * Remove a `null` key from an objects map (upstream does `dissoc objects nil`).
 *
 * @param {object} obj
 */
function removeNilKey(obj) {
  if (obj && typeof obj === 'object') {
    delete obj[null];
    delete obj['null'];
    delete obj[''];
  }
}

/**
 * Remove keys with null values from an object.
 *
 * @param {object} obj
 */
function removeNilKeys(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined || obj[key] === null) {
      delete obj[key];
    }
  }
}

/**
 * Clean a shape after decoding.
 * Mirrors `clean-shape-post-decode` and `clean-shape-pre-decode` from binfile/cleaner.clj.
 *
 * Applies these fixes:
 * - Fix shadow color IDs (remove invalid non-UUID ids)
 * - Fix root shape (ensure well-formed)
 * - Fix legacy flex direction names
 * - Migrate bool-content → content
 *
 * @param {object} shape - A shape object.
 * @returns {object} Cleaned shape.
 */
function cleanShapePostDecode(shape) {
  if (!shape || typeof shape !== 'object') return shape;

  // Pre-decode fix: bool-content → content
  if (shape.boolContent || shape['bool-content']) {
    shape.content = shape.boolContent || shape['bool-content'];
    delete shape.boolContent;
    delete shape['bool-content'];
  }

  // Pre-decode fix: shadow color references
  if (Array.isArray(shape.shadow)) {
    shape.shadow = shape.shadow.map(shadow => {
      if (shadow && shadow.color) {
        shadow.color = fixShadowColor(shadow.color);
      }
      return shadow;
    });
  }

  // Post-decode fixes
  shape = fixShapeShadowColor(shape);
  shape = fixRootShape(shape);
  shape = fixLegacyFlexDir(shape);

  return shape;
}

/**
 * Fix shadow color references in pre-decode phase.
 * Keep `refId` and `refFile` from shadow colors while removing qualified keys.
 *
 * @param {object} color - Shadow color object.
 * @returns {object} Cleaned shadow color.
 */
function fixShadowColor(color) {
  if (!color || typeof color !== 'object') return color;

  const cleaned = {
    opacity: color.opacity ?? 1,
    color: color.color,
  };

  if (color.gradient) cleaned.gradient = color.gradient;
  if (color.image) cleaned.image = color.image;
  if (color.refId || color['ref-id']) cleaned.refId = color.refId || color['ref-id'];
  if (color.refFile || color['ref-file']) cleaned.refFile = color.refFile || color['ref-file'];

  return cleaned;
}

/**
 * Fix shapes with invalid shadow color IDs.
 * Removes `id` properties that are not valid UUIDs.
 *
 * @param {object} shape
 * @returns {object}
 */
function fixShapeShadowColor(shape) {
  if (!Array.isArray(shape.shadow)) return shape;

  shape.shadow = shape.shadow.map(shadow => {
    if (!shadow || !shadow.color) return shadow;

    const color = shadow.color;
    if (color.id !== undefined) {
      // Keep valid UUIDs, remove non-UUID ids
      if (typeof color.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(color.id)) {
        // Valid UUID — keep it
      } else if (typeof color.id !== 'string') {
        // Not a string (could be a number or object) — remove it
        delete color.id;
      } else {
        // Invalid string — check if it's a UUID pattern
        delete color.id;
      }
    }

    return shadow;
  });

  return shape;
}

/**
 * Fix root shape (shape with id = "00000000-0000-0000-0000-000000000000").
 * Ensures root shapes have parentId and frameId pointing to self, and
 * regenerates selrect and points if missing.
 *
 * @param {object} shape
 * @returns {object}
 */
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

function fixRootShape(shape) {
  if (!shape || shape.id !== ZERO_UUID) return shape;

  shape.parentId = ZERO_UUID;
  shape.frameId = ZERO_UUID;

  // Remove stale selrect/points — these get regenerated by shape setup
  if (shape.selrect && !shape.selrect.x && !shape.selrect.y) {
    delete shape.selrect;
  }
  if (shape.points && Array.isArray(shape.points) && shape.points.length === 0) {
    delete shape.points;
  }

  return shape;
}

/**
 * Fix legacy flex direction names.
 * Maps old Penpot flex direction values to newer names.
 *
 * @param {object} shape
 * @returns {object}
 */
function fixLegacyFlexDir(shape) {
  if (!shape || shape.layoutFlexDir === undefined) return shape;

  switch (shape.layoutFlexDir) {
    case 'reverse-row':
      shape.layoutFlexDir = 'row-reverse';
      break;
    case 'reverse-column':
      shape.layoutFlexDir = 'column-reverse';
      break;
  }

  return shape;
}

// --- Object Thumbnail Reference Tracking ---

/**
 * Compute the set of object thumbnail IDs that are still in use.
 * Walks all frames and components in the file data, generating thumbnail
 * IDs for each frame and component root using the same format as the
 * upstream `thc/fmt-object-id`.
 *
 * @param {string} fileId
 * @param {object} data - Decoded file data.
 * @returns {Set<string>} Set of used object thumbnail IDs.
 */
function computeUsedObjectThumbnailIds(fileId, data) {
  const usedIds = new Set();

  if (!data || typeof data !== 'object') return usedIds;

  // Walk pages and collect frame/component thumbnail IDs
  if (data.pagesIndex && typeof data.pagesIndex === 'object') {
    for (const page of Object.values(data.pagesIndex)) {
      if (!page || !page.objects || typeof page.objects !== 'object') continue;

      const pageId = page.id || page.pageId;
      if (!pageId) continue;

      // Find all frame shapes (type=frame or type=board) in this page
      for (const shape of Object.values(page.objects)) {
        if (!shape || typeof shape !== 'object') continue;

        if (shape.type === 'frame' || shape.type === 'board') {
          usedIds.add(fmtObjectIdParts(fileId, pageId, shape.id, 'frame'));
        }

        // Component roots get a 'component' thumbnail tag
        if (shape.componentRoot || shape.componentFileId) {
          usedIds.add(fmtObjectIdParts(fileId, pageId, shape.id, 'component'));
        }
      }
    }
  }

  // Walk components and collect their thumbnail IDs
  if (data.components && typeof data.components === 'object') {
    for (const comp of Object.values(data.components)) {
      if (!comp || !comp.objects || typeof comp.objects !== 'object') continue;
      if (comp.deleted) continue;

      // The component itself has a thumbnail
      const compId = comp.id || comp.componentId;
      if (compId) {
        // Components are treated as if on their own page
        // The page ID for a component is its file's page
        for (const page of Object.values(data.pagesIndex || {})) {
          if (!page) continue;
          const pageId = page.id || page.pageId;
          if (!pageId) continue;

          // Check if this component's shapes are on this page
          for (const shape of Object.values(page.objects || {})) {
            if (!shape || typeof shape !== 'object') continue;
            if (shape.componentId === compId || shape.componentRoot === compId) {
              usedIds.add(fmtObjectIdParts(fileId, pageId, shape.id, 'component'));
            }
          }
        }
      }
    }
  }

  return usedIds;
}

// --- Fragment Pointer Tracking ---

/**
 * Collect the set of fragment IDs that are still in use by the file data.
 * Only relevant when the `fdata/pointer-map` feature is enabled, which uses
 * fragments to store pages/components as separate blobs.
 *
 * In the JS port, data fragments may not use pointer maps, but we still
 * collect any IDs found in `pagesIndex` entries that reference fragment IDs.
 *
 * @param {object} data - Decoded file data.
 * @returns {Set<string>} Set of used fragment IDs.
 */
function collectUsedFragmentIds(data) {
  const usedIds = new Set();

  if (!data || typeof data !== 'object') return usedIds;

  // Collect from pagesIndex — each page entry may reference a fragment
  if (data.pagesIndex && typeof data.pagesIndex === 'object') {
    for (const page of Object.values(data.pagesIndex)) {
      if (!page) continue;

      // Pointer-map pages store their data as a separate fragment with the page ID as key
      if (page.id && typeof page.id === 'string') {
        usedIds.add(page.id);
      }

      // Check for explicit pointer references
      if (page.data && typeof page.data === 'object' && page.data.id) {
        usedIds.add(page.data.id);
      }
    }
  }

  // Collect from components — component data may be stored as fragments
  if (data.components && typeof data.components === 'object') {
    for (const comp of Object.values(data.components)) {
      if (!comp) continue;

      if (comp.id && typeof comp.id === 'string') {
        usedIds.add(comp.id);
      }

      if (comp.objects && typeof comp.objects === 'object') {
        // Check for pointer-map style references within component objects
        for (const val of Object.values(comp.objects)) {
          if (val && typeof val === 'object' && val.id && typeof val.id === 'string') {
            usedIds.add(val.id);
          }
        }
      }
    }
  }

  return usedIds;
}

// --- Cross-library Component GC ---

/**
 * Clean deleted components that are no longer used by any consumer file.
 *
 * When a component is marked `deleted` in a library file, it should only be
 * removed from the data if no consumer files (files linked via `file_library_rel`)
 * still reference it. This mirrors `clean-deleted-components!` from the Clojure backend.
 *
 * Mutates `data` in place by removing unused deleted components.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} fileId - The library file ID being GC'd.
 * @param {object} data - The decoded file data (mutated in place).
 * @param {function} decode - Blob decode function.
 */
async function cleanDeletedComponents(pool, fileId, data, decode) {
  if (!data || !data.components) return;

  const deletedComponents = Object.values(data.components).filter(c => c && c.deleted);
  if (deletedComponents.length === 0) return;

  const deletedIds = new Set(deletedComponents.map(c => c.id));

  // Check local usage
  const locallyUsedIds = new Set();
  if (data.pagesIndex) {
    for (const page of Object.values(data.pagesIndex)) {
      if (page && page.objects) {
        collectComponentReferences(page.objects, fileId, locallyUsedIds);
      }
    }
  }

  // Check cross-library usage
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

  console.log(`[file-gc] Removed ${unusedIds.length} unused deleted components from file ${fileId}`);
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

    if (shape.componentId && shape.componentFileId === libraryFileId) {
      usedIds.add(shape.componentId);
    }

    if (shape.componentRoot && shape.componentFileId === libraryFileId) {
      usedIds.add(shape.componentRoot);
    }

    if (shape.shapeRef && shape.shapeRef.fileId === libraryFileId) {
      usedIds.add(shape.shapeRef.componentId);
    }
  }
}

// --- Media Collection ---

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

  if (data.media && typeof data.media === 'object') {
    for (const key of Object.keys(data.media)) {
      usedMediaIds.add(key);
    }
  }

  if (data.pagesIndex && typeof data.pagesIndex === 'object') {
    for (const page of Object.values(data.pagesIndex)) {
      if (page && page.objects && typeof page.objects === 'object') {
        collectMediaFromShapes(page.objects, usedMediaIds);
      }
    }
  }

  if (Array.isArray(data.pages)) {
    for (const pageId of data.pages) {
      if (typeof pageId === 'string') {
        // Page ID reference — already covered by pagesIndex walk
      } else if (pageId && pageId.objects) {
        collectMediaFromShapes(pageId.objects, usedMediaIds);
      }
    }
  }

  if (data.components && typeof data.components === 'object') {
    for (const comp of Object.values(data.components)) {
      if (comp) {
        if (comp.objects && typeof comp.objects === 'object') {
          collectMediaFromShapes(comp.objects, usedMediaIds);
        }
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

  if (shape.fillImage) usedMediaIds.add(shape.fillImage);
  if (typeof shape.fillImage === 'string') usedMediaIds.add(shape.fillImage);

  if (shape.metadata && shape.metadata.mediaId) {
    usedMediaIds.add(shape.metadata.mediaId);
  }

  if (Array.isArray(shape.fills)) {
    for (const fill of shape.fills) {
      if (fill && fill.fillImage) usedMediaIds.add(fill.fillImage);
      if (fill && fill.fillOpacityGradientId) {
        // gradient refs are not media
      }
    }
  }

  if (Array.isArray(shape.strokes)) {
    for (const stroke of shape.strokes) {
      if (stroke && stroke.strokeImage) usedMediaIds.add(stroke.strokeImage);
    }
  }

  if (Array.isArray(shape.content)) {
    for (const block of shape.content) {
      if (block && block.fills && Array.isArray(block.fills)) {
        for (const fill of block.fills) {
          if (fill && fill.fillImage) usedMediaIds.add(fill.fillImage);
        }
      }
    }
  }

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