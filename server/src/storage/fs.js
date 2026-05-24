/**
 * @module storage/fs
 * @description Filesystem-based object storage — mirrors `app.storage` (fs backend)
 * from the Clojure backend.
 *
 * Stores and retrieves binary objects on the local filesystem using a two-level
 * directory structure based on the first two characters of the object ID. This
 * prevents any single directory from containing too many files.
 *
 * ### Directory layout
 *
 * ```
 * assets/
 * ├── a0/
 * │   └── a0b3c4d5-e6f7-...
 * ├── b1/
 * │   └── b1c2d3e4-f5a6-...
 * └── ...
 * ```
 *
 * ### Storage objects
 *
 * Each stored object corresponds to a row in the `storage_object` database table
 * with columns: `id`, `size`, `backend`, `content_type`, `bucket`, `touched_at`,
 * `created_at`, `deleted_at`, `metadata`.
 *
 * The Clojure backend also supports S3 storage, but this module only implements
 * the filesystem backend for the Node.js port.
 *
 * For production deployments, configure `PENPOT_STORAGE_BACKEND=s3` to use
 * S3-compatible object storage instead.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config/index.js';

/** @type {string} Root directory for filesystem storage (from `PENPOT_STORAGE_FS_DIRECTORY`). */
const storageDir = config.storage.fsDirectory || 'assets';

/**
 * Ensure the storage root directory exists, creating it recursively if needed.
 * Also returns the resolved absolute path for use by the static file server.
 *
 * @returns {string} The absolute path to the storage root directory.
 */
export function ensureStorageDir() {
  const dir = path.resolve(storageDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Resolve the filesystem path for a given object ID.
 *
 * @param {string} objectId - Unique identifier for the object.
 * @returns {string} Absolute file path where the object is/should be stored.
 */
function resolvePath(objectId) {
  const dir = ensureStorageDir();
  const prefix = objectId.substring(0, 2);
  return path.join(dir, prefix, objectId);
}

/**
 * Store a binary object on the filesystem.
 *
 * The object is written to `<storageDir>/<prefix>/<objectId>` where
 * `<prefix>` is the first two characters of `objectId`. Intermediate
 * directories are created as needed.
 *
 * @param {string} objectId - Unique identifier for the object (typically a UUID).
 * @param {Buffer|string} data - Binary data to store.
 * @returns {string} The absolute file path where the object was written.
 */
export function storeObject(objectId, data) {
  const dir = ensureStorageDir();
  const prefix = objectId.substring(0, 2);
  const subDir = path.join(dir, prefix);

  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir, { recursive: true });
  }

  const filePath = path.join(subDir, objectId);
  fs.writeFileSync(filePath, data);
  return filePath;
}

/**
 * Retrieve a previously stored object from the filesystem.
 *
 * @param {string} objectId - Unique identifier for the object.
 * @returns {Buffer|null} The object data, or `null` if not found.
 */
export function retrieveObject(objectId) {
  const filePath = resolvePath(objectId);
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

/**
 * Delete an object from the filesystem.
 *
 * @param {string} objectId - Unique identifier for the object.
 * @returns {boolean} `true` if the file was deleted, `false` if it didn't exist.
 */
export function deleteObject(objectId) {
  const filePath = resolvePath(objectId);
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether an object exists on the filesystem.
 *
 * @param {string} objectId - Unique identifier for the object.
 * @returns {boolean} `true` if the object file exists.
 */
export function objectExists(objectId) {
  const filePath = resolvePath(objectId);
  return fs.existsSync(filePath);
}

/**
 * Generate a new random object ID (UUID v4).
 *
 * @returns {string} A new UUID string.
 */
export function generateObjectId() {
  return crypto.randomUUID();
}

/**
 * Calculate a SHA-256 content hash for a file or buffer.
 * Mirrors `app.storage/calculate-hash` which uses blake2b-256.
 *
 * @param {string|Buffer} data - File path or buffer to hash.
 * @returns {string} Hex-encoded hash string.
 */
export function calculateHash(data) {
  if (typeof data === 'string') {
    const buf = fs.readFileSync(data);
    return crypto.createHash('sha256').update(buf).digest('hex');
  }
  return crypto.createHash('sha256').update(data).digest('hex');
}

// --- High-level storage operations (mirrors app.storage) ---

/** @type {Set<string>} Valid bucket names — mirrors `app.storage/valid-buckets`. */
export const VALID_BUCKETS = new Set([
  'file-media-object',
  'team-font-variant',
  'file-object-thumbnail',
  'file-thumbnail',
  'profile',
  'organization',
  'tempfile',
  'file-data',
  'file-data-fragment',
  'file-change',
]);

/**
 * Create a storage object: store binary data on the filesystem and create a
 * database row. Supports optional deduplication via content hash, touch-on-creation,
 * expiration, and content-type tracking.
 *
 * Mirrors `app.storage/put-object!`.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {Buffer} data - Binary content to store.
 * @param {{ id?: string, contentType?: string, bucket?: string, touchedAt?: string, size?: number, deduplicate?: boolean }} opts
 *   - `touchedAt` marks the object as recently referenced (used by GC). Expiration is handled by
 *     the `storage-gc-deleted` and `upload-session-gc` background tasks, not at insert time.
 * @returns {{ id: string, size: number, backend: string, contentType: string, bucket: string }}
 */
export function putStorageObject(pool, data, opts = {}) {
  const id = opts.id || generateObjectId();
  const now = new Date().toISOString();
  const size = opts.size ?? (Buffer.isBuffer(data) ? data.length : Buffer.from(data).length);
  const contentType = opts.contentType || 'application/octet-stream';
  const bucket = opts.bucket || 'file-media-object';

  if (!VALID_BUCKETS.has(bucket)) {
    throw new Error(`Invalid storage bucket: ${bucket}`);
  }

  // Deduplication: if deduplicate is true, check for existing object with same hash
  if (opts.deduplicate) {
    const hash = calculateHash(data);
    const existing = pool.get(
      "SELECT id FROM storage_object WHERE metadata LIKE ? AND deleted_at IS NULL LIMIT 1",
      [`%${hash}%`]
    );
    if (existing) {
      return { id: existing.id, size, backend: 'fs', contentType, bucket };
    }
  }

  // Write the file to the filesystem
  storeObject(id, data);

  // Create database row
  const metadata = {};
  if (opts.deduplicate) {
    metadata.hash = calculateHash(data);
  }

  pool.insertOnConflictDoNothing('storage_object', {
    id,
    size,
    backend: 'fs',
    content_type: contentType,
    bucket,
    touched_at: opts.touchedAt || null,
    created_at: now,
    metadata: JSON.stringify(metadata),
  });

  return { id, size, backend: 'fs', contentType, bucket };
}

/**
 * Mark a storage object as "touched" — eligible for GC reference-checking.
 * Mirrors `app.storage/touch-object!`.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} objectId - The storage object ID to touch.
 * @param {string} [touchedAt] - ISO timestamp for the touch. Defaults to now.
 */
export function touchStorageObject(pool, objectId, touchedAt) {
  const now = touchedAt || new Date().toISOString();
  pool.run(
    'UPDATE storage_object SET touched_at = ? WHERE id = ?',
    [now, objectId]
  );
}

/**
 * Soft-delete a storage object by setting `deleted_at`.
 * Mirrors `app.storage/del-object!`.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} objectId - The storage object ID to delete.
 * @param {string} [deletedAt] - ISO timestamp. Defaults to now.
 */
export function deleteStorageObject(pool, objectId, deletedAt) {
  const now = deletedAt || new Date().toISOString();
  pool.run(
    'UPDATE storage_object SET deleted_at = ? WHERE id = ?',
    [now, objectId]
  );
}

/**
 * Get a storage object's metadata from the database.
 * Mirrors `app.storage/get-object`.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} objectId - The storage object ID.
 * @returns {Record<string, *>|undefined} The storage object row, or undefined.
 */
export function getStorageObject(pool, objectId) {
  return pool.get('SELECT * FROM storage_object WHERE id = @id', { id: objectId });
}

/**
 * Get a storage object's data from the filesystem.
 * Mirrors `app.storage/get-object-data`.
 *
 * @param {string} objectId - The storage object ID.
 * @returns {Buffer|null} The object data, or null if not found.
 */
export function getStorageObjectData(objectId) {
  return retrieveObject(objectId);
}

/**
 * Get a URL for accessing a stored object.
 * Mirrors `app.storage/get-object-url` for the FS backend.
 *
 * @param {string} objectId - The storage object ID.
 * @returns {string} The URL path for the object.
 */
export function getStorageObjectUrl(objectId) {
  const prefix = objectId.substring(0, 2);
  return `/internal/assets/${prefix}/${objectId}`;
}

/**
 * Get the filesystem path for a stored object.
 * Mirrors `app.storage/get-object-path`.
 *
 * @param {string} objectId - The storage object ID.
 * @returns {string} Absolute path on the filesystem.
 */
export function getStorageObjectPath(objectId) {
  return resolvePath(objectId);
}