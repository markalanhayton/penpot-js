/**
 * @module http/assets
 * @description Storage asset serving — mirrors `app.http.assets` from the Clojure backend.
 *
 * Serves storage objects (images, fonts, thumbnails, exports) via HTTP.
 * Uses the X-Accel-Redirect pattern for efficient file serving through nginx
 * when available, or streams files directly otherwise.
 *
 * ### Public buckets (no auth required)
 *
 * - `file-media-object` — Uploaded images and media
 * - `file-object-thumbnail` — File/object thumbnails
 * - `team-font-variant` — Font files
 * - `file-data-fragment` — File data fragments
 * - `tempfile` — Temporary export files (with time-limited access)
 * - `profile` — Profile photos (public for team visibility)
 *
 * ### Authenticated buckets (require session)
 *
 * - All other buckets require a valid session token
 *
 * ### Routes
 *
 * | Route                                          | Purpose                    |
 * |-----------------------------------------------|----------------------------|
 * | `GET /assets/by-id/:id`                       | Serve any storage object by ID |
 * | `GET /assets/by-file-media-id/:id`             | Serve file media object |
 * | `GET /assets/by-file-media-id/:id/thumbnail`  | Serve media thumbnail |
 */

import { config } from '../config/index.js';
import { getStorageObjectUrlAny, getS3PresignedUrl } from '../storage/s3.js';
import { getStorageObjectPath } from '../storage/fs.js';

/** Set of buckets that are publicly accessible without authentication. */
const PUBLIC_BUCKETS = new Set([
  'file-media-object',
  'file-object-thumbnail',
  'team-font-variant',
  'file-data-fragment',
  'tempfile',
  'profile',
]);

/**
 * Register asset serving routes on the Fastify server.
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server.
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 */
export function registerAssetRoutes(fastify, pool) {
  /**
   * Serve a storage object by its ID.
   * Checks authentication for non-public buckets.
   */
  fastify.get('/assets/by-id/:id', async (request, reply) => {
    const { id } = request.params;
    return serveStorageObject(pool, id, request, reply);
  });

  /**
   * Serve a file media object by its ID.
   * These are always publicly accessible (used in rendered designs).
   */
  fastify.get('/assets/by-file-media-id/:id', async (request, reply) => {
    const { id } = request.params;
    const mediaObject = pool.get(
      'SELECT mo.id, mo.media_id, mo.mtype, mo.width, mo.height FROM file_media_object mo WHERE mo.id = ? AND mo.deleted_at IS NULL',
      { id }
    );

    if (!mediaObject) {
      return reply.code(404).send({ type: 'not-found', code: 'object-not-found', hint: 'Media object not found' });
    }

    return serveStorageObject(pool, mediaObject.media_id, request, reply);
  });

  /**
   * Serve a file media object thumbnail.
   * Thumbnails are always publicly accessible.
   */
  fastify.get('/assets/by-file-media-id/:id/thumbnail', async (request, reply) => {
    const { id } = request.params;
    const thumbnail = pool.get(
      'SELECT sot.id, sot.content_type, sot.bucket FROM storage_object sot JOIN file_thumbnail ft ON ft.media_id = sot.id WHERE ft.file_media_object_id = ? AND sot.deleted_at IS NULL ORDER BY ft.revn DESC LIMIT 1',
      { id }
    );

    if (!thumbnail) {
      // Fall back to serving the original media object directly
      const mediaObject = pool.get(
        'SELECT media_id FROM file_media_object WHERE id = ? AND deleted_at IS NULL',
        { id }
      );
      if (mediaObject) {
        return serveStorageObject(pool, mediaObject.media_id, request, reply);
      }
      return reply.code(404).send({ type: 'not-found', code: 'object-not-found', hint: 'Thumbnail not found' });
    }

    return serveStorageObject(pool, thumbnail.id, request, reply);
  });
}

/**
 * Serve a storage object from the database and filesystem.
 *
 * For nginx deployments, returns X-Accel-Redirect headers so nginx can
 * serve the file directly from disk (avoiding streaming through Node.js).
 * For standalone deployments, streams the file directly.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} storageId - The storage object UUID.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
async function serveStorageObject(pool, storageId, request, reply) {
  const obj = pool.get(
    'SELECT id, backend, content_type, bucket, size, touched_at FROM storage_object WHERE id = ? AND deleted_at IS NULL',
    { id: storageId }
  );

  if (!obj) {
    return reply.code(404).send({ type: 'not-found', code: 'object-not-found', hint: 'Storage object not found' });
  }

  // Check authentication for non-public buckets
  if (!PUBLIC_BUCKETS.has(obj.bucket)) {
    const { profileId } = request.auth || {};
    if (!profileId) {
      return reply.code(401).send({ type: 'authentication', code: 'authentication-required', hint: 'Authentication required for this resource' });
    }
  }

  const contentType = obj.content_type || 'application/octet-stream';
  const cacheMaxAge = 24 * 60 * 60; // 24 hours in seconds

  // S3 backend: redirect to presigned URL
  if (obj.backend === 's3' && config.storage.s3?.bucket) {
    const url = await getS3PresignedUrl(storageId, { maxAgeSeconds: cacheMaxAge, contentType });
    if (url) {
      return reply.redirect(307, url);
    }
    // Fall through to FS if S3 URL generation fails
  }

  // If we have an nginx X-Accel-Redirect setup, use it for efficiency
  if (config.storage?.accelRedirect) {
    const accelPath = `${config.storage.accelPrefix || '/internal/assets/'}${storageObjectToRelativePath(obj)}`;
    return reply
      .code(204)
      .header('X-Accel-Redirect', accelPath)
      .header('Content-Type', contentType)
      .header('Cache-Control', `public, max-age=${cacheMaxAge}`)
      .send();
  }

  // Direct file serving — read from filesystem and stream
  const filePath = getStorageObjectPath(storageId);

  try {
    const fs = await import('node:fs/promises');
    const stat = await fs.stat(filePath);

    return reply
      .code(200)
      .header('Content-Type', contentType)
      .header('Content-Length', stat.size)
      .header('Cache-Control', `public, max-age=${cacheMaxAge}`)
      .header('Last-Modified', stat.mtime.toUTCString())
      .send(fs.createReadStream(filePath));
  } catch {
    return reply.code(404).send({ type: 'not-found', code: 'object-not-found', hint: 'File not found' });
  }
}

/**
 * Convert a storage object to a relative filesystem path for X-Accel-Redirect.
 *
 * @param {{ id: string }} obj - Storage object with `id` property.
 * @returns {string} Relative path like `ab/cdef...`
 */
function storageObjectToRelativePath(obj) {
  const id = obj.id;
  return `${id.substring(0, 2)}/${id}`;
}