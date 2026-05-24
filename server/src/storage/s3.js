/**
 * @module storage/s3
 * @description S3-compatible object storage backend — mirrors `app.storage.s3`
 * from the Clojure backend.
 *
 * Provides S3 storage operations using the AWS SDK v3. Supports any
 * S3-compatible service (AWS S3, MinIO, etc.) via the `endpoint` config option.
 *
 * ### Configuration (environment variables)
 *
 * | Variable                               | Default   | Purpose                       |
 * |----------------------------------------|-----------|-------------------------------|
 * | `PENPOT_STORAGE_S3_BUCKET`            | —         | S3 bucket name                |
 * | `PENPOT_STORAGE_S3_REGION`            | eu-central-1 | AWS region                |
 * | `PENPOT_STORAGE_S3_ENDPOINT`          | —         | Custom S3 endpoint (MinIO)    |
 * | `PENPOT_STORAGE_S3_PREFIX`             | —         | Key prefix for all objects    |
 * | `PENPOT_STORAGE_S3_ACCESS_KEY`         | —         | Access key ID                |
 * | `PENPOT_STORAGE_S3_SECRET_KEY`         | —         | Secret access key             |
 * | `PENPOT_STORAGE_S3_PATH_STYLE`        | false     | Use path-style access         |
 *
 * ### Operations
 *
 * All operations mirror the filesystem backend's API (`putStorageObject`,
 * `getStorageObjectData`, etc.) but store data in S3 instead of the local disk.
 *
 * The S3 backend is activated when `PENPOT_STORAGE_BACKEND=s3` is set and all
 * required S3 configuration values are present.
 */

import { config } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';

let s3Client = null;
let presigner = null;
let s3Config = null;
let initialized = false;

/**
 * Initialize the S3 client lazily. Only creates the client if S3 is the
 * configured backend and the required config values are present.
 *
 * @returns {Promise<{ client: S3Client, presigner: S3RequestPresigner, config: object }|null>}
 *   The S3 client, presigner, and config, or null if S3 is not configured.
 */
async function initS3() {
  if (initialized) return s3Client ? { client: s3Client, presigner, config: s3Config } : null;
  initialized = true;

  if (config.storage.backend !== 's3') return null;

  const bucket = config.storage.s3?.bucket;
  if (!bucket) {
    console.warn('[storage/s3] S3 backend selected but no bucket configured. Falling back to filesystem.');
    return null;
  }

  s3Config = {
    bucket: bucket,
    region: config.storage.s3?.region || 'us-east-1',
    endpoint: config.storage.s3?.endpoint || null,
    prefix: config.storage.s3?.prefix || '',
    pathStyle: config.storage.s3?.pathStyle ?? !!config.storage.s3?.endpoint,
    accessKey: config.storage.s3?.accessKey || process.env.AWS_ACCESS_KEY_ID || '',
    secretKey: config.storage.s3?.secretKey || process.env.AWS_SECRET_ACCESS_KEY || '',
  };

  try {
    const { S3Client } = await import('@aws-sdk/client-s3');
    const { S3RequestPresigner } = await import('@aws-sdk/s3-request-presigner');

    const clientOptions = {
      region: s3Config.region,
      credentials: s3Config.accessKey ? {
        accessKeyId: s3Config.accessKey,
        secretAccessKey: s3Config.secretKey,
      } : undefined,
    };

    if (s3Config.endpoint) {
      clientOptions.endpoint = s3Config.endpoint;
      clientOptions.forcePathStyle = s3Config.pathStyle;
    }

    s3Client = new S3Client(clientOptions);
    presigner = new S3RequestPresigner({ client: s3Client });

    console.log(`[storage/s3] Initialized S3 backend (bucket: ${s3Config.bucket}, region: ${s3Config.region}${s3Config.endpoint ? `, endpoint: ${s3Config.endpoint}` : ''})`);
    return { client: s3Client, presigner, config: s3Config };
  } catch (err) {
    console.warn(`[storage/s3] Failed to initialize S3 client: ${err.message}. S3 storage will not be available.`);
    return null;
  }
}

/**
 * Convert a storage object ID to an S3 key.
 * Uses the same two-level path scheme as the filesystem backend.
 *
 * @param {string} id - Storage object UUID.
 * @returns {string} S3 key (with optional prefix).
 */
function idToKey(id) {
  const prefix = s3Config?.prefix || '';
  const path = `${id.substring(0, 2)}/${id}`;
  return prefix ? `${prefix}/${path}` : path;
}

/**
 * Check whether S3 storage is available and configured.
 *
 * @returns {Promise<boolean>} `true` if S3 backend is initialized.
 */
export async function isS3Available() {
  const ctx = await initS3();
  return ctx !== null;
}

/**
 * Store a binary object in S3 and create a database row.
 * Mirrors `putStorageObject` from the FS backend.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {Buffer} data - Binary content to store.
 * @param {{ id?: string, contentType?: string, bucket?: string, size?: number, deduplicate?: boolean }} opts
 * @returns {{ id: string, size: number, backend: string, contentType: string, bucket: string }}
 */
export async function putS3Object(pool, data, opts = {}) {
  const ctx = await initS3();
  if (!ctx) throw new Error('S3 storage not configured');

  const id = opts.id || uuidv4();
  const now = new Date().toISOString();
  const size = opts.size ?? (Buffer.isBuffer(data) ? data.length : Buffer.from(data).length);
  const contentType = opts.contentType || 'application/octet-stream';
  const bucket = opts.bucket || 'file-media-object';
  const key = idToKey(id);

  // Deduplication via content hash
  if (opts.deduplicate) {
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    const existing = pool.get(
      "SELECT id FROM storage_object WHERE metadata LIKE ? AND deleted_at IS NULL LIMIT 1",
      [`%${hash}%`]
    );
    if (existing) {
      // Touch the existing object
      pool.run('UPDATE storage_object SET touched_at = ? WHERE id = ?', [now, existing.id]);
      return { id: existing.id, size, backend: 's3', contentType, bucket };
    }
  }

  // Upload to S3
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  await s3Client.send(new PutObjectCommand({
    Bucket: ctx.config.bucket,
    Key: key,
    Body: data,
    ContentType: contentType,
  }));

  // Create database row
  const metadata = opts.deduplicate
    ? JSON.stringify({ hash: crypto.createHash('sha256').update(data).digest('hex') })
    : '{}';

  pool.insertOnConflictDoNothing('storage_object', {
    id,
    size,
    backend: 's3',
    content_type: contentType,
    bucket,
    touched_at: now,
    created_at: now,
    metadata,
  });

  return { id, size, backend: 's3', contentType, bucket };
}

/**
 * Retrieve object data from S3.
 * Mirrors `getStorageObjectData` from the FS backend.
 *
 * @param {string} objectId - Storage object UUID.
 * @returns {Promise<Buffer|null>} The object data, or null if not found.
 */
export async function getS3ObjectData(objectId) {
  const ctx = await initS3();
  if (!ctx) return null;

  const key = idToKey(objectId);

  try {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: ctx.config.bucket,
      Key: key,
    }));

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error(`[storage/s3] Error getting object ${objectId}:`, err.message);
    return null;
  }
}

/**
 * Delete an object from S3.
 *
 * @param {string} objectId - Storage object UUID.
 * @returns {Promise<boolean>} `true` if the object was deleted.
 */
export async function deleteS3Object(objectId) {
  const ctx = await initS3();
  if (!ctx) return false;

  const key = idToKey(objectId);

  try {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await s3Client.send(new DeleteObjectCommand({
      Bucket: ctx.config.bucket,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete multiple objects from S3 in bulk.
 *
 * @param {string[]} ids - Array of storage object UUIDs.
 * @returns {Promise<{ deleted: number, errors: string[] }>}
 */
export async function deleteS3ObjectsInBulk(ids) {
  const ctx = await initS3();
  if (!ctx || ids.length === 0) return { deleted: 0, errors: [] };

  const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
  const keys = ids.map(idToKey);

  try {
    const result = await s3Client.send(new DeleteObjectsCommand({
      Bucket: ctx.config.bucket,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
        Quiet: false,
      },
    }));

    const errors = (result.Errors || []).map(e => `${e.Key}: ${e.Code}`);
    return { deleted: ids.length - errors.length, errors };
  } catch (err) {
    return { deleted: 0, errors: [err.message] };
  }
}

/**
 * Generate a presigned URL for temporary read access to an S3 object.
 * Mirrors `get-object-url` from the Clojure backend.
 *
 * @param {string} objectId - Storage object UUID.
 * @param {{ maxAgeSeconds?: number, contentType?: string }} [opts] - Options.
 * @returns {Promise<string|null>} Presigned URL, or null if S3 is not configured.
 */
export async function getS3PresignedUrl(objectId, opts = {}) {
  const ctx = await initS3();
  if (!ctx) return null;

  const key = idToKey(objectId);
  const maxAge = opts.maxAgeSeconds || 600; // 10 minutes default

  try {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const command = new GetObjectCommand({
      Bucket: ctx.config.bucket,
      Key: key,
      ...(opts.contentType ? { ResponseContentType: opts.contentType } : {}),
    });

    return await getSignedUrl(s3Client, command, { expiresIn: maxAge });
  } catch (err) {
    console.error(`[storage/s3] Error generating presigned URL for ${objectId}:`, err.message);
    return null;
  }
}

/**
 * Check whether an object exists in S3.
 *
 * @param {string} objectId - Storage object UUID.
 * @returns {Promise<boolean>}
 */
export async function s3ObjectExists(objectId) {
  const ctx = await initS3();
  if (!ctx) return false;

  const key = idToKey(objectId);

  try {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    await s3Client.send(new HeadObjectCommand({
      Bucket: ctx.config.bucket,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Store an object using whichever backend is configured (S3 or FS).
 * This is the unified entry point that dispatches to the correct backend.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {Buffer} data - Binary content to store.
 * @param {{ id?: string, contentType?: string, bucket?: string, size?: number, deduplicate?: boolean }} opts
 * @returns {Promise<{ id: string, size: number, backend: string, contentType: string, bucket: string }>}
 */
export async function putStorageObjectAny(pool, data, opts = {}) {
  if (config.storage.backend === 's3' && await isS3Available()) {
    return putS3Object(pool, data, opts);
  }

  // Fall back to FS backend
  const { putStorageObject } = await import('./fs.js');
  return putStorageObject(pool, data, opts);
}

/**
 * Retrieve object data using whichever backend is configured.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} objectId - Storage object UUID.
 * @returns {Promise<Buffer|null>}
 */
export async function getStorageObjectDataAny(pool, objectId) {
  const obj = pool.get('SELECT backend FROM storage_object WHERE id = ? AND deleted_at IS NULL', { id: objectId });

  if (obj?.backend === 's3' && await isS3Available()) {
    return getS3ObjectData(objectId);
  }

  const { getStorageObjectData } = await import('./fs.js');
  return getStorageObjectData(objectId);
}

/**
 * Get a URL for accessing a stored object using whichever backend is configured.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} objectId - Storage object UUID.
 * @param {{ maxAgeSeconds?: number, contentType?: string }} [opts] - Options for S3 presigned URLs.
 * @returns {Promise<string>} URL for accessing the object.
 */
export async function getStorageObjectUrlAny(pool, objectId, opts = {}) {
  const obj = pool.get('SELECT backend FROM storage_object WHERE id = ? AND deleted_at IS NULL', { id: objectId });

  if (obj?.backend === 's3' && await isS3Available()) {
    const url = await getS3PresignedUrl(objectId, opts);
    if (url) return url;
  }

  const { getStorageObjectUrl } = await import('./fs.js');
  return getStorageObjectUrl(objectId);
}