'use strict';
/**
 * @module rpc/teams
 * @description Team management RPC commands — mirrors `app.rpc.commands.teams`
 * from the Clojure backend.
 *
 * Handles CRUD for teams, membership, invitations, and role management.
 *
 * ### Method summary
 *
 * | Method                     | Auth required | Since  |
 * |----------------------------|:-------------:|--------|
 * | `get-teams`                | Yes           | 1.17   |
 * | `get-owned-teams`          | Yes           | 2.8    |
 * | `get-team`                 | Yes           | 1.17   |
 * | `get-team-members`         | Yes           | 1.17   |
 * | `get-team-users`           | Yes           | 1.17   |
 * | `get-team-stats`            | Yes           | 1.17   |
 * | `create-team`              | Yes           | 1.17   |
 * | `update-team`              | Yes           | 1.17   |
 * | `leave-team`               | Yes           | 1.17   |
 * | `delete-team`              | Yes           | 1.17   |
 * | `update-team-member-role`  | Yes           | 1.17   |
 * | `delete-team-member`       | Yes           | 1.17   |
 * | `update-team-photo`        | Yes           | 1.17   |
 * | `get-team-invitations`     | Yes           | 1.17   |
 * | `get-team-info`            | No            | 2.2    |
 */

import { v4 as uuidv4 } from 'uuid';
import { rowToCamel, rowsToCamel } from '../db/sqlite.js';
import {
  validateMediaType,
  validateMediaSize,
  getImageInfo,
  profileThumbnail,
  sanitizeImage,
  PROFILE_THUMBNAIL_OPTIONS,
  withTempFiles,
  calculateHash,
} from '../media/index.js';
import { putStorageObject, touchStorageObject, getStorageObjectUrl } from '../storage/fs.js';
import { RpcError } from '../rpc/dispatcher.js';

/**
 * Register all team-related RPC commands.
 *
 * @param {function(string, import('./dispatcher.js').RpcMethodDefinition): void} register - Method registration callback.
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 */
export default function registerTeamCommands(register, pool) {

  register('get-teams', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const rows = pool.query(
        `SELECT t.*, tpr.is_admin, tpr.is_owner, tpr.can_edit, tpr.is_member
         FROM team t
         JOIN team_profile_rel tpr ON tpr.team_id = t.id
         WHERE tpr.profile_id = @profileId AND t.deleted_at IS NULL`,
        { profileId: ctx.profileId }
      );
      return rowsToCamel(rows);
    }
  });

  register('get-owned-teams', {
    auth: true,
    added: '2.8.0',
    async handler(params, ctx) {
      const rows = pool.query(
        `SELECT t.*, tpr.is_admin, tpr.is_owner, tpr.can_edit, tpr.is_member
         FROM team t
         JOIN team_profile_rel tpr ON tpr.team_id = t.id
         WHERE tpr.profile_id = @profileId AND tpr.is_owner = '1' AND t.deleted_at IS NULL`,
        { profileId: ctx.profileId }
      );
      return rowsToCamel(rows);
    }
  });

  register('get-team', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { id, fileId } = params;
      let team;
      if (id) {
        team = pool.get('SELECT * FROM team WHERE id = ? AND deleted_at IS NULL', { id });
      } else if (fileId) {
        team = pool.get(
          `SELECT t.* FROM team t
           JOIN project p ON p.team_id = t.id
           JOIN file f ON f.project_id = p.id
           WHERE f.id = @fileId AND t.deleted_at IS NULL`,
          { fileId }
        );
      }
      if (!team) throw new Error('not-found:Team not found');
      return rowToCamel(team);
    }
  });

  register('get-team-members', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const rows = pool.query(
        `SELECT p.id, p.fullname, p.email, p.photo_id, p.is_active, p.is_demo,
                tpr.is_admin, tpr.is_owner, tpr.can_edit, tpr.is_member
         FROM profile p
         JOIN team_profile_rel tpr ON tpr.profile_id = p.id
         WHERE tpr.team_id = @teamId AND p.deleted_at IS NULL`,
        { teamId: params.teamId }
      );
      return rowsToCamel(rows);
    }
  });

  register('get-team-users', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { teamId, fileId } = params;
      let actualTeamId = teamId;
      if (!actualTeamId && fileId) {
        const file = pool.get('SELECT project_id FROM file WHERE id = ?', { id: fileId });
        if (file) {
          const project = pool.get('SELECT team_id FROM project WHERE id = ?', { id: file.project_id });
          actualTeamId = project?.team_id;
        }
      }
      if (!actualTeamId) throw new Error('not-found:Team not found');

      const rows = pool.query(
        `SELECT p.*, tpr.is_admin, tpr.is_owner, tpr.can_edit, tpr.is_member
         FROM profile p
         JOIN team_profile_rel tpr ON tpr.profile_id = p.id
         WHERE tpr.team_id = @teamId AND p.deleted_at IS NULL`,
        { teamId: actualTeamId }
      );
      return rowsToCamel(rows);
    }
  });

  register('get-team-stats', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { teamId } = params;
      const members = pool.get(
        'SELECT COUNT(*) as count FROM team_profile_rel WHERE team_id = ?',
        { teamId }
      );
      const projects = pool.get(
        'SELECT COUNT(*) as count FROM project WHERE team_id = ? AND deleted_at IS NULL',
        { teamId }
      );
      const files = pool.get(
        `SELECT COUNT(*) as count FROM file f
         JOIN project p ON p.id = f.project_id
         WHERE p.team_id = @teamId AND f.deleted_at IS NULL`,
        { teamId }
      );
      return {
        membersCount: members?.count || 0,
        projectsCount: projects?.count || 0,
        filesCount: files?.count || 0,
      };
    }
  });

  register('create-team', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const id = params.id || uuidv4();
      const now = new Date().toISOString();

      const result = pool.insertReturning('team', {
        id,
        name: params.name || 'New Team',
        is_default: params.isDefault ? '1' : '0',
        features: JSON.stringify(params.features || {}),
        created_at: now,
        modified_at: now,
      });

      pool.insertReturning('team_profile_rel', {
        id: uuidv4(),
        team_id: id,
        profile_id: ctx.profileId,
        is_admin: '1',
        is_owner: '1',
        can_edit: '1',
        is_member: '1',
        created_at: now,
        modified_at: now,
      });

      const projectId = uuidv4();
      pool.insertReturning('project', {
        id: projectId,
        team_id: id,
        name: 'Drafts',
        is_default: '1',
        created_at: now,
        modified_at: now,
      });

      return rowToCamel(result);
    }
  });

  register('update-team', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const updates = { modified_at: new Date().toISOString() };
      if (params.name !== undefined) updates.name = params.name;
      if (params.photo !== undefined) updates.photo_id = params.photo;
      if (params.features !== undefined) updates.features = JSON.stringify(params.features);

      const result = pool.updateReturning('team', updates, { id: params.id });
      if (!result) throw new Error('not-found:Team not found');
      return rowToCamel(result);
    }
  });

  register('leave-team', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { id, reassignTo } = params;

      if (reassignTo) {
        pool.update('team_profile_rel', {
          is_owner: '1',
          modified_at: new Date().toISOString(),
        }, { team_id: id, profile_id: reassignTo });
      }

      pool.deleteFrom('team_profile_rel', { team_id: id, profile_id: ctx.profileId });
      return { id };
    }
  });

  register('delete-team', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      pool.softDelete('team', { id: params.id });
      return { id: params.id };
    }
  });

  register('update-team-member-role', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { teamId, memberId, role } = params;
      const roleMap = { owner: { is_owner: '1', is_admin: '1', can_edit: '1' },
                        admin: { is_owner: '0', is_admin: '1', can_edit: '1' },
                        editor: { is_owner: '0', is_admin: '0', can_edit: '1' },
                        viewer: { is_owner: '0', is_admin: '0', can_edit: '0' } };
      const roleData = roleMap[role] || roleMap.viewer;
      pool.update('team_profile_rel', {
        ...roleData,
        is_member: '1',
        modified_at: new Date().toISOString(),
      }, { team_id: teamId, profile_id: memberId });
      return { teamId, memberId, role };
    }
  });

  register('delete-team-member', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      pool.deleteFrom('team_profile_rel', { team_id: params.teamId, profile_id: params.memberId });
      return { teamId: params.teamId, memberId: params.memberId };
    }
  });

  register('update-team-photo', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { teamId, file } = params;
      if (!file || !file.path) {
        throw new RpcError('validation', 'validation-error', 'No file uploaded');
      }

      // Validate MIME type — only images allowed for team photos
      validateMediaType(file, new Set(['image/jpeg', 'image/png', 'image/webp']));
      validateMediaSize(file);

      // Check edition permissions
      const rel = pool.get(
        `SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ? AND can_edit = '1'`,
        { team_id: teamId, profile_id: ctx.profileId }
      );
      if (!rel) {
        throw new RpcError('authorization', 'access-denied', 'You don\'t have edit access to this team');
      }

      return await withTempFiles(async () => {
        const info = await getImageInfo({ path: file.path, mtype: file.mtype });
        await sanitizeImage(file.path, info.mtype);

        // Store the original image
        const fs = await import('node:fs/promises');
        const originalData = await fs.readFile(info.path);
        const originalObj = putStorageObject(pool, originalData, {
          contentType: info.mtype,
          bucket: 'profile',
          size: info.size,
          deduplicate: true,
        });

        // Generate profile thumbnail (256x256 JPEG)
        const thumb = await profileThumbnail({
          input: info,
          format: PROFILE_THUMBNAIL_OPTIONS.format,
          quality: PROFILE_THUMBNAIL_OPTIONS.quality,
          width: PROFILE_THUMBNAIL_OPTIONS.width,
          height: PROFILE_THUMBNAIL_OPTIONS.height,
        });

        const thumbData = await fs.readFile(thumb.path);
        const thumbObj = putStorageObject(pool, thumbData, {
          contentType: thumb.mtype,
          bucket: 'profile',
          size: thumb.size,
          deduplicate: true,
        });

        // Touch the old photo_id storage object for GC cleanup
        const team = pool.get('SELECT * FROM team WHERE id = ? AND deleted_at IS NULL', { id: teamId });
        if (team && team.photo_id) {
          touchStorageObject(pool, team.photo_id);
        }

        // Update team with new photo_id reference (thumbnail ID)
        const now = new Date().toISOString();
        pool.run('UPDATE team SET photo_id = ?, modified_at = ? WHERE id = ?', [thumbObj.id, now, teamId]);

        const updatedTeam = pool.get('SELECT * FROM team WHERE id = ?', { id: teamId });
        return rowToCamel(updatedTeam);
      });
    }
  });

  register('get-team-invitations', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const rows = pool.query(
        'SELECT * FROM team_invitation WHERE team_id = @teamId',
        { teamId: params.teamId }
      );
      return rowsToCamel(rows);
    }
  });

  register('get-team-info', {
    auth: false,
    added: '2.2.0',
    async handler(params) {
      const { id, fileId } = params;
      let team;
      if (id) {
        team = pool.get('SELECT * FROM team WHERE id = ? AND deleted_at IS NULL', { id });
      } else if (fileId) {
        team = pool.get(
          `SELECT t.* FROM team t
           JOIN project p ON p.team_id = t.id
           JOIN file f ON f.project_id = p.id
           WHERE f.id = @fileId AND t.deleted_at IS NULL`,
          { fileId }
        );
      }
      if (!team) throw new Error('not-found:Team not found');
      return rowToCamel(team);
    }
  });
}