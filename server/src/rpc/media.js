/**
 * @module rpc/media
 * @description Media object upload, clone, chunked upload, and URL download RPC
 * commands — mirrors `app.rpc.commands.media` from the Clojure backend.
 *
 * Fully wired with:
 * - Image validation (MIME type + size)
 * - Image processing via sharp (dimensions + optional thumbnails)
 * - Storage object persistence (fs backend)
 * - File media object creation with media_id and thumbnail_id
 * - Chunked upload assembly
 * - URL-based image download
 *
 * ### Method summary
 *
 * | Method                              | Auth required | Since |
 * |-------------------------------------|:-------------:|-------|
 * | `upload-file-media-object`         | Yes           | v1.17 |
 * | `create-file-media-object-from-url`| Yes           | v1.17 |
 * | `create-upload-session`            | Yes           | v2.17 |
 * | `upload-chunk`                     | Yes           | v2.17 |
 * | `assemble-file-media-object`       | Yes           | v2.17 |
 * | `clone-file-media-object`          | Yes           | v1.17 |
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { rowToCamel } from '../db/sqlite.js';
import {
  validateMediaType,
  validateMediaSize,
  ALL_MEDIA_TYPES,
  getImageInfo,
  genericThumbnail,
  bigEnoughForThumbnail,
  isSvgImage,
  sanitizeImage,
  downloadImage,
  MEDIA_THUMBNAIL_OPTIONS,
  withTempFiles,
} from '../media/index.js';
import {
  putStorageObject,
  touchStorageObject,
  deleteStorageObject,
  getStorageObject,
} from '../storage/fs.js';
import { RpcError } from '../rpc/dispatcher.js';

/**
 * Check edition permissions for a file — verifies the file exists and is not deleted,
 * and the profile has edit access.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - The profile UUID of the user.
 * @param {string} fileId - The file UUID to check.
 * @throws {RpcError} If the file is not found or profile lacks edit access.
 */
function checkEditionPermissions(pool, profileId, fileId) {
  const file = pool.get(
    `SELECT f.id FROM file f
     JOIN project p ON p.id = f.project_id
     JOIN team_profile_rel tpr ON tpr.team_id = p.team_id
     WHERE f.id = ? AND f.deleted_at IS NULL
       AND tpr.profile_id = ? AND tpr.can_edit = '1'`,
    { id: fileId, profile_id: profileId }
  );
  if (!file) {
    throw new RpcError('authorization', 'access-denied', 'You don\'t have edit access to this file');
  }
}

/**
 * Process an uploaded image: get info, optionally generate thumbnail, store both.
 * Mirrors the Clojure `process-image` pipeline.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {{ path: string, mtype: string, size: number }} content - Validated upload info.
 * @returns {Promise<{ image: object, thumb: object|null }>}
 */
async function processImage(pool, content) {
  const info = await getImageInfo({ path: content.path, mtype: content.mtype });

  await sanitizeImage(content.path, info.mtype);

  const fs = await import('node:fs/promises');
  const stat = await fs.stat(content.path);
  info.size = stat.size;

  let thumbObj = null;

  if (!isSvgImage(info.mtype) && bigEnoughForThumbnail(info)) {
    const thumb = await genericThumbnail({
      input: info,
      format: MEDIA_THUMBNAIL_OPTIONS.format,
      quality: MEDIA_THUMBNAIL_OPTIONS.quality,
      width: MEDIA_THUMBNAIL_OPTIONS.width,
      height: MEDIA_THUMBNAIL_OPTIONS.height,
    });

    const thumbData = await fs.readFile(thumb.path);
    thumbObj = putStorageObject(pool, thumbData, {
      contentType: thumb.mtype,
      bucket: 'file-media-object',
      size: thumb.size,
      deduplicate: true,
    });
  }

  return { image: info, thumb: thumbObj };
}

/**
 * Store the main image data as a storage object and create the file_media_object row.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} fileId
 * @param {object} info - Image info from getImageInfo.
 * @param {object|null} thumb - Thumbnail storage object, or null.
 * @param {{ id?: string, name?: string, isLocal?: boolean }} params
 * @returns {Record<string, *>} The created file_media_object row (camelCase).
 */
async function createFileMediaObject(pool, fileId, info, thumb, params) {
  const fs = await import('node:fs/promises');
  const mainData = await fs.readFile(info.path);

  const mediaObj = putStorageObject(pool, mainData, {
    contentType: info.mtype,
    bucket: 'file-media-object',
    size: info.size,
    deduplicate: true,
  });

  const id = params.id || uuidv4();
  const now = new Date().toISOString();

  const result = pool.insertOnConflictDoNothing('file_media_object', {
    id,
    file_id: fileId,
    name: params.name || 'image',
    is_local: params.isLocal ? '1' : '0',
    media_id: mediaObj.id,
    thumbnail_id: thumb?.id || null,
    width: info.width || 0,
    height: info.height || 0,
    mtype: info.mtype,
    created_at: now,
  });

  // Mark file as having untrimmed media
  pool.run('UPDATE file SET has_media_trimmed = ?, modified_at = ? WHERE id = ?', ['0', now, fileId]);

  return rowToCamel(pool.get('SELECT * FROM file_media_object WHERE id = ?', { id }));
}

/**
 * Register all media-related RPC commands.
 *
 * @param {function(string, import('./dispatcher.js').RpcMethodDefinition): void} register
 * @param {import('../db/sqlite.js').DatabasePool} pool
 */
export default function registerMediaCommands(register, pool) {

  /**
   * Upload a file media object.
   *
   * Validates MIME type and size, gets image dimensions, optionally generates
   * a thumbnail, stores both as storage objects, and creates a `file_media_object`
   * database row.
   *
   * Mirrors `app.rpc.commands.media/upload-file-media-object`.
   */
  register('upload-file-media-object', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const content = params.content;
      if (!content || !content.path) {
        throw new RpcError('validation', 'validation-error', 'Missing content (file upload)');
      }

      validateMediaType(content);
      validateMediaSize(content);

      checkEditionPermissions(pool, ctx.profileId, params.fileId);

      return await withTempFiles(async () => {
        const { image: info, thumb } = await processImage(pool, content);
        return await createFileMediaObject(pool, params.fileId, info, thumb, {
          id: params.id,
          name: params.name,
          isLocal: params.isLocal,
        });
      });
    }
  });

  /**
   * Download an image from a URL and create a file media object.
   *
   * Downloads the image, validates and sanitizes it, then processes it
   * through the same pipeline as a direct upload.
   *
   * Mirrors `app.rpc.commands.media/create-file-media-object-from-url`.
   */
  register('create-file-media-object-from-url', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { url, fileId, name, isLocal } = params;

      if (!url) {
        throw new RpcError('validation', 'validation-error', 'Missing URL');
      }

      checkEditionPermissions(pool, ctx.profileId, fileId);

      return await withTempFiles(async () => {
        // Download the image from URL
        const downloaded = await downloadImage(url);

        // Validate downloaded content
        validateMediaType({ mtype: downloaded.mtype, size: downloaded.size }, ALL_MEDIA_TYPES);
        validateMediaSize({ mtype: downloaded.mtype, size: downloaded.size });

        // Process through the same pipeline
        const { image: info, thumb } = await processImage(pool, downloaded);

        return await createFileMediaObject(pool, fileId, info, thumb, {
          name: name || 'downloaded-image',
          isLocal: isLocal || false,
        });
      });
    }
  });

  /**
   * Create an upload session for chunked uploads.
   *
   * Mirrors `app.rpc.commands.media/create-upload-session`.
   */
  register('create-upload-session', {
    auth: true,
    added: '2.17',
    async handler(params, ctx) {
      const id = uuidv4();
      const now = new Date().toISOString();

      const maxChunks = 100;
      if (params.totalChunks && params.totalChunks > maxChunks) {
        throw new RpcError('restriction', 'max-quote-reached', `Maximum ${maxChunks} chunks per session`, { target: 'upload-chunks-per-session', quote: maxChunks, count: params.totalChunks });
      }

      pool.insertOnConflictDoNothing('upload_session', {
        id,
        profile_id: ctx.profileId,
        total_chunks: params.totalChunks || 0,
        created_at: now,
      });

      return { sessionId: id };
    }
  });

  /**
   * Upload a single chunk in a chunked upload session.
   *
   * Mirrors `app.rpc.commands.media/upload-chunk`.
   */
  register('upload-chunk', {
    auth: true,
    added: '2.17',
    async handler(params, ctx) {
      const { sessionId, index, content } = params;

      const session = pool.get('SELECT * FROM upload_session WHERE id = ?', { id: sessionId });
      if (!session) {
        throw new RpcError('validation', 'validation-error', 'Upload session not found');
      }

      if (index < 0 || index >= session.total_chunks) {
        throw new RpcError('validation', 'invalid-chunk-index',
          `Chunk index ${index} is out of range for this session`,
          { sessionId, totalChunks: session.total_chunks, index });
      }

      validateMediaType(content);
      validateMediaSize(content);

      await sanitizeImage(content.path, content.mtype);

      const fs = await import('node:fs/promises');
      const chunkData = await fs.readFile(content.path);
      const chunkStorageObj = putStorageObject(pool, chunkData, {
        contentType: content.mtype,
        bucket: 'tempfile',
        size: content.size,
      });

      pool.run(
        "UPDATE storage_object SET metadata = ? WHERE id = ?",
        [JSON.stringify({ chunk_index: index, upload_id: sessionId }), chunkStorageObj.id]
      );

      return { sessionId, index };
    }
  });

  /**
   * Assemble a chunked upload into a final media object.
   *
   * Mirrors `app.rpc.commands.media/assemble-file-media-object`.
   */
  register('assemble-file-media-object', {
    auth: true,
    added: '2.17',
    async handler(params, ctx) {
      const { sessionId, fileId, isLocal, name, mtype, id } = params;

      checkEditionPermissions(pool, ctx.profileId, fileId);

      const session = pool.get('SELECT * FROM upload_session WHERE id = ?', { id: sessionId });
      if (!session) {
        throw new RpcError('validation', 'validation-error', 'Upload session not found');
      }

      const chunks = pool.query(
        "SELECT * FROM storage_object WHERE metadata IS NOT NULL AND deleted_at IS NULL ORDER BY (json_extract(metadata, '$.chunk_index')) ASC",
        {}
      ).filter(row => {
        try {
          const meta = JSON.parse(row.metadata || '{}');
          return meta.upload_id === sessionId;
        } catch { return false; }
      });

      if (chunks.length !== session.total_chunks) {
        throw new RpcError('validation', 'missing-chunks',
          `Expected ${session.total_chunks} chunks, found ${chunks.length}`,
          { sessionId, expected: session.total_chunks, found: chunks.length });
      }

      return await withTempFiles(async () => {
        // Concatenate chunks into a single file
        const { retrieveObject } = await import('../storage/fs.js');
        const totalSize = chunks.reduce((sum, c) => sum + (c.size || 0), 0);
        const tempPath = path.join(os.tmpdir(), `penpot.assembled.${uuidv4()}`);
        const writeStream = fs.createWriteStream(tempPath);
        for (const chunk of chunks) {
          const chunkData = retrieveObject(chunk.id);
          if (chunkData) writeStream.write(chunkData);
        }
        writeStream.end();
        await new Promise(resolve => writeStream.on('finish', resolve));

        const content = {
          path: tempPath,
          mtype: mtype || 'application/octet-stream',
          size: totalSize,
          filename: name || 'upload',
        };

        validateMediaType(content, ALL_MEDIA_TYPES);
        validateMediaSize(content);

        // Delete the upload session
        pool.run('DELETE FROM upload_session WHERE id = ?', [sessionId]);

        // Process as regular upload
        const { image: info, thumb } = await processImage(pool, content);

        // Mark chunk storage objects for deletion
        const now = new Date().toISOString();
        for (const chunk of chunks) {
          pool.run('UPDATE storage_object SET deleted_at = ? WHERE id = ?', [now, chunk.id]);
        }

        return await createFileMediaObject(pool, fileId, info, thumb, { id, name, isLocal });
      });
    }
  });

  /**
   * Clone an existing media object.
   *
   * Copies the media_id and thumbnail_id references to a new row without
   * duplicating the actual storage data (storage deduplication handles this).
   *
   * Mirrors `app.rpc.commands.media/clone-file-media-object`.
   */
  register('clone-file-media-object', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const original = pool.get('SELECT * FROM file_media_object WHERE id = ? AND deleted_at IS NULL', { id: params.id });
      if (!original) {
        throw new RpcError('not-found', 'object-not-found', 'Media object not found');
      }

      const newId = uuidv4();
      const now = new Date().toISOString();
      const result = pool.insertOnConflictDoNothing('file_media_object', {
        id: newId,
        file_id: params.fileId,
        name: original.name,
        is_local: params.isLocal ? '1' : '0',
        media_id: original.media_id,
        thumbnail_id: original.thumbnail_id,
        width: original.width,
        height: original.height,
        mtype: original.mtype,
        created_at: now,
      });

      // Touch the original storage objects to prevent GC from deleting them
      if (original.media_id) {
        touchStorageObject(pool, original.media_id, now);
      }
      if (original.thumbnail_id) {
        touchStorageObject(pool, original.thumbnail_id, now);
      }

      return rowToCamel(pool.get('SELECT * FROM file_media_object WHERE id = ?', { id: newId }));
    }
  });
}