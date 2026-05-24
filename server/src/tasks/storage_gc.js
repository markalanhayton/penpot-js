/**
 * @module tasks/storage_gc
 * @description Storage garbage collection tasks — mirrors `app.storage.gc-touched`
 * and `app.storage.gc-deleted` from the Clojure backend.
 *
 * Periodically cleans up storage objects that are:
 * 1. No longer referenced by any database row (touched/orphaned objects)
 * 2. Marked as deleted and past their retention period
 *
 * ### Usage
 *
 * ```js
 * import { registerStorageGcTasks } from './tasks/storage_gc.js';
 * registerStorageGcTasks(scheduler, pool, storage);
 * ```
 */

import { config } from '../config/index.js';

/** @type {number} Days before a deleted object is permanently removed. Default 30. */
const DELETED_RETENTION_DAYS = Number(process.env.PENPOT_STORAGE_GC_DELETED_RETENTION_DAYS || 30);

/** @type {number} Days before an orphaned (untouched) object is removed. Default 15. */
const ORPHAN_RETENTION_DAYS = Number(process.env.PENPOT_STORAGE_GC_ORPHAN_RETENTION_DAYS || 15);

/**
 * Delete storage objects that have been marked as deleted for longer than
 * the retention period.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {object} storage - Storage backend (fs or s3).
 * @returns {Promise<number>} Number of objects deleted.
 */
export async function gcDeletedStorageObjects(pool, storage) {
  const cutoff = new Date(Date.now() - DELETED_RETENTION_DAYS * 24 * 3600 * 1000).toISOString();

  const objects = pool.query(
    `SELECT id, backend FROM storage_object
     WHERE deleted_at IS NOT NULL AND deleted_at < ?
     ORDER BY deleted_at ASC
     LIMIT 1000`,
    [cutoff]
  );

  let deletedCount = 0;

  for (const obj of objects) {
    try {
      await storage.deleteObject(obj.id);
      pool.run(
        `DELETE FROM storage_object WHERE id = ?`,
        [obj.id]
      );
      deletedCount++;
    } catch (err) {
      console.error(`[storage-gc] Error deleting object ${obj.id}:`, err.message);
    }
  }

  if (deletedCount > 0) {
    console.log(`[storage-gc] Deleted ${deletedCount} expired storage objects`);
  }

  return deletedCount;
}

/**
 * Find and remove storage objects that are no longer referenced by any
 * database row (orphaned objects).
 *
 * An object is considered orphaned if:
 * - It exists in the `storage_object` table with no `touched_at` update
 *   within the last `ORPHAN_RETENTION_DAYS` days
 * - It has no foreign key references from `file_media_object`,
 *   `team_font_variant`, or other tables
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {object} storage - Storage backend (fs or s3).
 * @returns {Promise<number>} Number of orphaned objects removed.
 */
export async function gcOrphanedStorageObjects(pool, storage) {
  const cutoff = new Date(Date.now() - ORPHAN_RETENTION_DAYS * 24 * 3600 * 1000).toISOString();

  // Find objects that haven't been touched recently and aren't referenced
  const orphans = pool.query(
    `SELECT so.id
     FROM storage_object so
     LEFT JOIN file_media_object fmo ON fmo.media_id = so.id
     LEFT JOIN file_media_object fmo2 ON fmo2.thumbnail_id = so.id
     LEFT JOIN team_font_variant tfv ON tfv.otf_file_id = so.id
     WHERE so.touched_at < ?
       AND fmo.id IS NULL
       AND fmo2.id IS NULL
       AND tfv.id IS NULL
       AND so.deleted_at IS NULL
     ORDER BY so.touched_at ASC
     LIMIT 500`,
    [cutoff]
  );

  let removedCount = 0;

  for (const obj of orphans) {
    try {
      await storage.deleteObject(obj.id);
      pool.run(
        `DELETE FROM storage_object WHERE id = ?`,
        [obj.id]
      );
      removedCount++;
    } catch (err) {
      console.error(`[storage-gc] Error removing orphan ${obj.id}:`, err.message);
    }
  }

  if (removedCount > 0) {
    console.log(`[storage-gc] Removed ${removedCount} orphaned storage objects`);
  }

  return removedCount;
}

/**
 * Register storage garbage collection tasks with the scheduler.
 *
 * @param {object} scheduler - Task scheduler instance from `tasks/scheduler.js`.
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {object} storage - Storage backend (fs or s3).
 */
export function registerStorageGcTasks(scheduler, pool, storage) {
  // Run deleted object GC every 6 hours
  scheduler.registerTask('storage-gc-deleted', async () => {
    try {
      await gcDeletedStorageObjects(pool, storage);
    } catch (err) {
      console.error('[storage-gc] Deleted object GC failed:', err);
    }
  }, { interval: 6 * 60 * 60 * 1000 });

  // Run orphan GC daily
  scheduler.registerTask('storage-gc-orphan', async () => {
    try {
      await gcOrphanedStorageObjects(pool, storage);
    } catch (err) {
      console.error('[storage-gc] Orphan object GC failed:', err);
    }
  }, { interval: 24 * 60 * 60 * 1000 });
}