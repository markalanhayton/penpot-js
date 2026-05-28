'use strict';
/**
 * @module rpc/profile
 * @description Profile management RPC commands — mirrors `app.rpc.commands.profile`
 * from the Clojure backend.
 *
 * ### Method summary
 *
 * | Method                    | Auth required | Since |
 * |---------------------------|:-------------:|-------|
 * | `get-profile`             | No*           | v1.18 |
 * | `update-profile`          | Yes           | v1.0  |
 * | `update-profile-password`  | Yes           | v1.0  |
 * | `update-profile-photo`    | Yes           | v1.1  |
 * | `delete-profile-photo`     | Yes           | v2.17 |
 * | `delete-profile`          | Yes           | v1.0  |
 * | `update-profile-notifications` | Yes      | v2.4  |
 * | `request-email-change`    | Yes           | v1.0  |
 * | `update-profile-props`    | Yes           | v1.0  |
 * | `update-profile-notifications` | Yes      | v2.4  |
 * | `request-email-change`    | Yes           | v1.0  |
 * | `update-profile-props`    | Yes           | v1.0  |
 * | `get-subscription-usage`   | Yes           | v2.9  |
 */

import { v4 as uuidv4 } from 'uuid';
import { derivePassword, verifyPassword } from '../auth/password.js';
import { rowToCamel } from '../db/sqlite.js';
import {
  validateMediaType,
  validateMediaSize,
  getImageInfo,
  profileThumbnail,
  sanitizeImage,
  PROFILE_THUMBNAIL_OPTIONS,
  withTempFiles,
  calculateHash,
  downloadImage,
} from '../media/index.js';
import { putStorageObject, touchStorageObject, getStorageObjectUrl } from '../storage/fs.js';
import { RpcError } from '../rpc/dispatcher.js';

/**
 * Register all profile-related RPC commands.
 *
 * @param {function(string, import('./dispatcher.js').RpcMethodDefinition): void} register - Method registration callback.
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 */
export default function registerProfileCommands(register, pool) {

  register('get-profile', {
    auth: false,
    added: '1.18',
    async handler(params, ctx) {
      if (!ctx.profileId) return null;
      const profile = pool.get('SELECT * FROM profile WHERE id = ? AND deleted_at IS NULL', { id: ctx.profileId });
      return profile ? rowToCamel(profile) : null;
    }
  });

  register('update-profile', {
    auth: true,
    added: '1.0',
    async handler(params, ctx) {
      const updates = { modified_at: new Date().toISOString() };
      if (params.fullname !== undefined) updates.fullname = params.fullname;
      if (params.lang !== undefined) updates.lang = params.lang;
      if (params.theme !== undefined) updates.theme = params.theme;

      pool.update('profile', updates, { id: ctx.profileId });
      const profile = pool.get('SELECT * FROM profile WHERE id = ?', { id: ctx.profileId });
      return rowToCamel(profile);
    }
  });

  register('update-profile-password', {
    auth: true,
    added: '1.0',
    async handler(params, ctx) {
      const profile = pool.get('SELECT * FROM profile WHERE id = ?', { id: ctx.profileId });
      if (!profile) throw new Error('not-found:Profile not found');

      if (params.oldPassword) {
        const { valid } = await verifyPassword(profile.password, params.oldPassword);
        if (!valid) throw new Error('validation:Current password is incorrect');
      }

      const hashedPassword = await derivePassword(params.password);
      pool.run('UPDATE profile SET password = ?, modified_at = ? WHERE id = ?', [hashedPassword, new Date().toISOString(), ctx.profileId]);
      return { id: ctx.profileId };
    }
  });

  /**
   * Upload or update the profile photo.
   *
   * Validates the uploaded image (JPEG, PNG, or WebP), processes it through
   * the media pipeline (info extraction + thumbnail generation), stores both the
   * original and thumbnail as storage objects, and updates the profile's
   * `photo_id` reference.
   *
   * Mirrors `app.rpc.commands.profile/update-profile-photo`.
   */
  register('update-profile-photo', {
    auth: true,
    added: '1.1',
    async handler(params, ctx) {
      const { file } = params;
      if (!file || !file.path) {
        throw new RpcError('validation', 'validation-error', 'No file uploaded');
      }

      // Validate MIME type — only images allowed for profile photos
      validateMediaType(file, new Set(['image/jpeg', 'image/png', 'image/webp']));
      validateMediaSize(file);

      return await withTempFiles(async () => {
        // Step 1: Get image info (dimensions, format)
        const info = await getImageInfo({ path: file.path, mtype: file.mtype });

        // Step 2: Sanitize the uploaded file
        await sanitizeImage(file.path, info.mtype);

        // Step 3: Store the original image
        const fs = await import('node:fs/promises');
        const originalData = await fs.readFile(info.path);
        const originalObj = putStorageObject(pool, originalData, {
          contentType: info.mtype,
          bucket: 'profile',
          size: info.size,
          deduplicate: true,
        });

        // Step 4: Generate profile thumbnail (256x256 JPEG)
        const thumb = await profileThumbnail({
          input: info,
          format: PROFILE_THUMBNAIL_OPTIONS.format,
          quality: PROFILE_THUMBNAIL_OPTIONS.quality,
          width: PROFILE_THUMBNAIL_OPTIONS.width,
          height: PROFILE_THUMBNAIL_OPTIONS.height,
        });

        // Step 5: Store the thumbnail
        const thumbData = await fs.readFile(thumb.path);
        const thumbObj = putStorageObject(pool, thumbData, {
          contentType: thumb.mtype,
          bucket: 'profile',
          size: thumb.size,
          deduplicate: true,
        });

        // Step 6: Touch the old photo_id storage object for GC cleanup
        const profile = pool.get('SELECT * FROM profile WHERE id = ? AND deleted_at IS NULL', { id: ctx.profileId });
        if (profile && profile.photo_id) {
          touchStorageObject(pool, profile.photo_id);
        }

        // Step 7: Update profile with new photo_id reference (thumbnail ID)
        const now = new Date().toISOString();
        pool.run('UPDATE profile SET photo_id = ?, modified_at = ? WHERE id = ?', [thumbObj.id, now, ctx.profileId]);

        const updatedProfile = pool.get('SELECT * FROM profile WHERE id = ?', { id: ctx.profileId });
        return updatedProfile ? rowToCamel(updatedProfile) : null;
      });
    }
  });

  register('delete-profile-photo', {
    auth: true,
    added: '2.17',
    async handler(params, ctx) {
      const profile = pool.get('SELECT * FROM profile WHERE id = ? AND deleted_at IS NULL', { id: ctx.profileId });
      if (profile && profile.photo_id) {
        // Touch the old photo_id storage object for GC cleanup
        touchStorageObject(pool, profile.photo_id);
      }

      const now = new Date().toISOString();
      pool.run('UPDATE profile SET photo_id = NULL, modified_at = ? WHERE id = ?', [now, ctx.profileId]);
      return null;
    }
  });

  register('delete-profile', {
    auth: true,
    added: '1.0',
    async handler(params, ctx) {
      const now = new Date().toISOString();
      pool.run("UPDATE profile SET deleted_at = ?, is_active = '0', modified_at = ? WHERE id = ?", [now, now, ctx.profileId]);
      pool.run("UPDATE http_session SET is_active = '0' WHERE profile_id = ?", [ctx.profileId]);
      return { id: ctx.profileId };
    }
  });

  register('get-subscription-usage', {
    auth: true,
    added: '2.9',
    async handler(params, ctx) {
      const rows = pool.query(
        `SELECT DISTINCT p.id, p.fullname AS name, p.email
         FROM team_profile_rel AS tpr1
         JOIN team AS t ON tpr1.team_id = t.id
         JOIN team_profile_rel AS tpr2 ON tpr1.team_id = tpr2.team_id
         JOIN profile AS p ON tpr2.profile_id = p.id
         WHERE tpr1.profile_id = ?
           AND tpr1.is_owner = '1'
           AND tpr2.can_edit = '1'
           AND t.deleted_at IS NULL`,
        [ctx.profileId]
      );
      return { editors: rows.map(r => ({ id: r.id, name: r.name, email: r.email })) };
    }
  });

  register('update-profile-notifications', {
    auth: true,
    added: '2.4',
    async handler(params, ctx) {
      const { dashboardComments, emailComments, emailInvites } = params;
      const profile = pool.get('SELECT * FROM profile WHERE id = ? AND deleted_at IS NULL', { id: ctx.profileId });
      if (!profile) {
        throw new RpcError('not-found', 'object-not-found', 'Profile not found');
      }

      let props = {};
      try { props = typeof profile.props === 'string' ? JSON.parse(profile.props) : (profile.props || {}); } catch { props = {}; }

      props.notifications = {
        dashboardComments: dashboardComments || 'all',
        emailComments: emailComments || 'all',
        emailInvites: emailInvites || 'all',
      };

      pool.run('UPDATE profile SET props = ?, modified_at = ? WHERE id = ?', [JSON.stringify(props), new Date().toISOString(), ctx.profileId]);
      return null;
    },
  });

  register('request-email-change', {
    auth: true,
    added: '1.0',
    async handler(params, ctx) {
      const { email } = params;
      if (!email) {
        throw new RpcError('validation', 'validation-error', 'Email is required');
      }

      const cleanEmail = email.trim().toLowerCase();
      const profile = pool.get('SELECT * FROM profile WHERE id = ? AND deleted_at IS NULL', { id: ctx.profileId });
      if (!profile) {
        throw new RpcError('not-found', 'object-not-found', 'Profile not found');
      }

      const existing = pool.get('SELECT id FROM profile WHERE email = ? AND deleted_at IS NULL', [cleanEmail]);
      if (existing) {
        throw new RpcError('validation', 'email-already-exists', 'A profile with this email already exists');
      }

      const smtpEnabled = process.env.PENPOT_SMTP_ENABLED === 'true' || process.env.PENPOT_SMTP_HOST;

      if (!smtpEnabled) {
        if (cleanEmail !== profile.email) {
          pool.run('UPDATE profile SET email = ?, modified_at = ? WHERE id = ?', [cleanEmail, new Date().toISOString(), ctx.profileId]);
        }
        return { changed: true };
      }

      const { generateToken } = await import('../auth/tokens.js');
      const token = await generateToken({ iss: 'email-change', uid: ctx.profileId, newEmail: cleanEmail }, '15m');
      return { token, email: cleanEmail };
    },
  });

  register('update-profile-props', {
    auth: true,
    added: '1.0',
    async handler(params, ctx) {
      const { props: newProps } = params;
      if (!newProps || typeof newProps !== 'object') {
        throw new RpcError('validation', 'validation-error', 'Props must be an object');
      }

      const profile = pool.get('SELECT * FROM profile WHERE id = ? AND deleted_at IS NULL', { id: ctx.profileId });
      if (!profile) {
        throw new RpcError('not-found', 'object-not-found', 'Profile not found');
      }

      let props = {};
      try { props = typeof profile.props === 'string' ? JSON.parse(profile.props) : (profile.props || {}); } catch { props = {}; }

      const allowedKeys = ['plugins', 'renderer', 'mcp-enabled', 'newsletter-updates', 'newsletter-news',
        'onboarding-team-id', 'onboarding-viewed', 'v2-info-shown', 'welcome-file-id',
        'release-notes-viewed', 'notifications', 'workspace-visited'];

      for (const [key, value] of Object.entries(newProps)) {
        if (allowedKeys.includes(key)) {
          if (value === null || value === undefined) {
            delete props[key];
          } else {
            props[key] = value;
          }
        }
      }

      pool.run('UPDATE profile SET props = ?, modified_at = ? WHERE id = ?', [JSON.stringify(props), new Date().toISOString(), ctx.profileId]);

      const filtered = {};
      for (const key of allowedKeys) {
        if (props[key] !== undefined) filtered[key] = props[key];
      }
      return filtered;
    },
  });
}