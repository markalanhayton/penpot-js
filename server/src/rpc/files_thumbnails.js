'use strict';
/**
 * @module rpc/files_thumbnails
 * @description File and object thumbnail RPC commands — mirrors
 * `app.rpc.commands.files-thumbnails` from the Clojure backend.
 *
 * Handles creation, retrieval, and deletion of file-level and
 * object-level (frame/component) thumbnails stored as storage objects.
 *
 * ### Method summary
 *
 * | Method                             | Auth required | Since |
 * |------------------------------------|:-------------:|-------|
 * | `get-file-object-thumbnails`      | Yes           | v1.17 |
 * | `get-file-data-for-thumbnail`     | Yes           | v1.17 |
 * | `create-file-object-thumbnail`    | Yes           | v1.19 |
 * | `delete-file-object-thumbnail`    | Yes           | v1.19 |
 * | `create-file-thumbnail`           | Yes           | v1.19 |
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { rowToCamel, rowsToCamel } from '../db/sqlite.js';
import {
  validateMediaType,
  validateMediaSize,
  getImageInfo,
  genericThumbnail,
  bigEnoughForThumbnail,
  isSvgImage,
  sanitizeImage,
  calculateHash,
  withTempFiles,
  createTempFile,
  MEDIA_THUMBNAIL_OPTIONS,
} from '../media/index.js';
import {
  putStorageObject,
  touchStorageObject,
  getStorageObject,
  getStorageObjectUrl,
} from '../storage/fs.js';
import { RpcError } from '../rpc/dispatcher.js';

/**
 * Check that the authenticated profile has read access to a file.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - Profile UUID.
 * @param {string} fileId - File UUID.
 * @throws {RpcError} If the file does not exist or is deleted.
 */
function checkReadPermissions(pool, profileId, fileId) {
  const file = pool.get(
    `SELECT f.id, f.is_shared FROM file f
     JOIN project p ON p.id = f.project_id
     JOIN team_profile_rel tpr ON tpr.team_id = p.team_id
     WHERE f.id = ? AND f.deleted_at IS NULL AND tpr.profile_id = ?`,
    { id: fileId, profile_id: profileId }
  );
  if (!file) {
    throw new RpcError('not-found', 'object-not-found', 'File not found or you don\'t have access to it');
  }
  return file;
}

/**
 * Check that the authenticated profile has edit access to a file.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - Profile UUID.
 * @param {string} fileId - File UUID.
 * @throws {RpcError} If the file does not exist or profile lacks edit access.
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
 * Register all file thumbnail RPC commands.
 *
 * @param {function(string, import('./dispatcher.js').RpcMethodDefinition): void} register
 * @param {import('../db/sqlite.js').DatabasePool} pool
 */
export default function registerFilesThumbnailsCommands(register, pool) {

  // --- QUERY: get-file-object-thumbnails ---

  register('get-file-object-thumbnails', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { fileId, tag, objectIds } = params;

      checkReadPermissions(pool, ctx.profileId, fileId);

      if (objectIds && objectIds.length > 0) {
        // Return thumbnails for specific object IDs
        const placeholders = objectIds.map(() => '?').join(',');
        const rows = pool.query(
          `SELECT object_id, media_id, tag
           FROM file_tagged_object_thumbnail
           WHERE file_id = ? AND deleted_at IS NULL
             AND object_id IN (${placeholders})`,
          [fileId, ...objectIds]
        );
        const result = {};
        for (const row of rows) {
          result[row.object_id] = row.media_id;
        }
        return result;
      }

      if (tag) {
        // Return thumbnails filtered by tag
        const rows = pool.query(
          `SELECT object_id, media_id, tag
           FROM file_tagged_object_thumbnail
           WHERE file_id = ? AND tag = ? AND deleted_at IS NULL`,
          [fileId, tag]
        );
        const result = {};
        for (const row of rows) {
          result[row.object_id] = row.media_id;
        }
        return result;
      }

      // Return all thumbnails for the file
      const rows = pool.query(
        `SELECT object_id, media_id, tag
         FROM file_tagged_object_thumbnail
         WHERE file_id = ? AND deleted_at IS NULL`,
        [fileId]
      );
      const result = {};
      for (const row of rows) {
        result[row.object_id] = row.media_id;
      }
      return result;
    }
  });

  // --- QUERY: get-file-data-for-thumbnail ---

  register('get-file-data-for-thumbnail', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { fileId, stripFramesWithThumbnails } = params;

      checkReadPermissions(pool, ctx.profileId, fileId);

      const file = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', { id: fileId });
      if (!file) {
        throw new RpcError('not-found', 'object-not-found', 'File not found');
      }

      // Return minimal file data needed for thumbnail rendering
      const pages = pool.query(
        'SELECT * FROM page WHERE file_id = ? AND deleted_at IS NULL ORDER BY ordering',
        [fileId]
      );

      return {
        fileId: file.id,
        revn: file.revn || 0,
        pages: rowsToCamel(pages),
      };
    }
  });

  /**
 * Resolve a media parameter to a canonical form with `path` and `mtype`.
 *
 * Handles two formats:
 * - Multipart upload: `{ path, mtype, size, filename }`
 * - Transit+JSON base64: `{ content, contentType, width, height }`
 *
 * For base64 payloads, decodes the content to a temp file and returns
 * an object with `path`, `mtype`, and `size` so downstream code can
 * treat both cases uniformly.
 */
async function resolveMedia(media) {
  if (!media) throw new RpcError('validation', 'validation-error', 'Missing media parameter');

  const MAX_MEDIA_SIZE = 10 * 1024 * 1024; // 10 MB

  // Handle multipart file uploads: { path, mtype, size, filename }
  if (media.path && media.mtype) {
    if (media.size && media.size > MAX_MEDIA_SIZE) {
      throw new RpcError('validation', 'validation-error', `Media file too large (${media.size} bytes, max ${MAX_MEDIA_SIZE} bytes)`);
    }
    return { path: media.path, mtype: media.mtype, size: media.size || 0, filename: media.filename };
  }

  // Handle Transit+JSON base64 payloads: { content, contentType, width, height }
  // After toCamelCase, "content-type" becomes "contentType".
  // Also support data URI format: content = "data:image/png;base64,XXXX"
  let mtype = media.mtype || media.contentType || media['content-type'] || media['mime-type'] || media.mimeType;
  let base64;

  if (typeof media.content === 'string' && media.content.startsWith('data:')) {
    const match = media.content.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      base64 = match[2];
      if (!mtype) mtype = match[1];
    }
  }

  if (!base64) {
    base64 = media.content || media.base64;
  }

  if (base64 && mtype) {
    const estimatedSize = Math.ceil(base64.length * 0.75);
    if (estimatedSize > MAX_MEDIA_SIZE) {
      throw new RpcError('validation', 'validation-error', `Media payload too large (${estimatedSize} bytes, max ${MAX_MEDIA_SIZE} bytes)`);
    }
    const buffer = Buffer.from(base64, 'base64');
    const tmpPath = createTempFile({ prefix: 'penpot.thumb.', suffix: '.png' });
    await fs.writeFile(tmpPath, buffer);
    return { path: tmpPath, mtype, size: buffer.length, filename: 'thumbnail.png' };
  }

  throw new RpcError('validation', 'validation-error', 'Media must provide either a file upload (path/mtype) or base64 content (content/contentType)');
}

// --- MUTATION: create-file-object-thumbnail ---

  register('create-file-object-thumbnail', {
    auth: true,
    added: '1.19',
    async handler(params, ctx) {
      const { fileId, objectId, media, tag } = params;
      const content = await resolveMedia(media);

      checkEditionPermissions(pool, ctx.profileId, fileId);

      // Validate the media
      validateMediaType(content, new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']));
      validateMediaSize(content);

      const file = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', { id: fileId });
      if (!file) {
        throw new RpcError('not-found', 'object-not-found', 'File not found');
      }

      return await withTempFiles(async () => {
        // Get image info
        const info = await getImageInfo({ path: content.path, mtype: content.mtype });
        await sanitizeImage(content.path, info.mtype);

        // Store the thumbnail as a storage object
        const thumbData = await fs.readFile(info.path);
        const thumbObj = putStorageObject(pool, thumbData, {
          contentType: info.mtype,
          bucket: 'file-object-thumbnail',
          size: info.size,
          deduplicate: true,
        });

        // Check for existing thumbnail
        const existing = pool.get(
          `SELECT * FROM file_tagged_object_thumbnail
           WHERE file_id = ? AND object_id = ? AND tag = ?`,
          [fileId, objectId, tag || 'frame']
        );

        if (existing) {
          // Update existing — touch the old media object for GC
          if (existing.media_id && existing.media_id !== thumbObj.id) {
            touchStorageObject(pool, existing.media_id);
          }

          pool.run(
            `UPDATE file_tagged_object_thumbnail
             SET media_id = ?, updated_at = ?, deleted_at = ?
             WHERE file_id = ? AND object_id = ? AND tag = ?`,
            [thumbObj.id, new Date().toISOString(), file.deleted_at || null, fileId, objectId, tag || 'frame']
          );
        } else {
          // Insert new
          pool.insertOnConflictDoNothing('file_tagged_object_thumbnail', {
            file_id: fileId,
            object_id: objectId,
            tag: tag || 'frame',
            media_id: thumbObj.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: file.deleted_at,
          });
        }

        return { id: thumbObj.id, uri: getStorageObjectUrl(thumbObj.id) };
      });
    }
  });

  // --- MUTATION: delete-file-object-thumbnail ---

  register('delete-file-object-thumbnail', {
    auth: true,
    added: '1.19',
    async handler(params, ctx) {
      const { fileId, objectId } = params;

      checkEditionPermissions(pool, ctx.profileId, fileId);

      const existing = pool.get(
        `SELECT media_id, tag FROM file_tagged_object_thumbnail
         WHERE file_id = ? AND object_id = ?`,
        [fileId, objectId]
      );

      if (existing) {
        // Touch the old media object for GC cleanup
        if (existing.media_id) {
          touchStorageObject(pool, existing.media_id);
        }

        pool.run(
          `UPDATE file_tagged_object_thumbnail
           SET deleted_at = ?
           WHERE file_id = ? AND object_id = ? AND tag = ?`,
          [new Date().toISOString(), fileId, objectId, existing.tag]
        );
      }

      return null;
    }
  });

  // --- MUTATION: create-file-thumbnail ---

  register('create-file-thumbnail', {
    auth: true,
    added: '1.19',
    async handler(params, ctx) {
      const { fileId, revn, media, props } = params;
      const content = await resolveMedia(media);

      checkEditionPermissions(pool, ctx.profileId, fileId);

      // Validate the media
      validateMediaType(content, new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']));
      validateMediaSize(content);

      const file = pool.get('SELECT * FROM file WHERE id = ?', { id: fileId });
      if (!file) {
        throw new RpcError('not-found', 'object-not-found', 'File not found');
      }

      return await withTempFiles(async () => {
        // Get image info
        const info = await getImageInfo({ path: content.path, mtype: content.mtype });
        await sanitizeImage(content.path, info.mtype);

        // Store as storage object
        const data = await fs.readFile(info.path);
        const hash = calculateHash(data);
        const mediaObj = putStorageObject(pool, data, {
          contentType: info.mtype,
          bucket: 'file-thumbnail',
          size: info.size,
          deduplicate: true,
        });

        // Check for existing thumbnail with same revn
        const existing = pool.get(
          `SELECT * FROM file_thumbnail WHERE file_id = ? AND revn = ?`,
          [fileId, revn || 0]
        );

        if (existing) {
          // Touch old media if different
          if (existing.media_id && existing.media_id !== mediaObj.id) {
            touchStorageObject(pool, existing.media_id);
          }

          pool.run(
            `UPDATE file_thumbnail
             SET media_id = ?, deleted_at = ?, updated_at = ?, props = ?
             WHERE file_id = ? AND revn = ?`,
            [mediaObj.id, file.deleted_at, new Date().toISOString(), JSON.stringify(props || {}), fileId, revn || 0]
          );
        } else {
          pool.insertOnConflictDoNothing('file_thumbnail', {
            file_id: fileId,
            revn: revn || 0,
            media_id: mediaObj.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: file.deleted_at || null,
            props: JSON.stringify(props || {}),
          });
        }

        return { id: mediaObj.id, uri: getStorageObjectUrl(mediaObj.id) };
      });
    }
  });
}