/**
 * @module rpc/projects
 * @description Project management RPC commands — mirrors `app.rpc.commands.projects`
 * from the Clojure backend.
 *
 * ### Method summary
 *
 * | Method                | Auth required | Since  |
 * |-----------------------|:-------------:|--------|
 * | `get-projects`        | Yes           | v1.18  |
 * | `get-all-projects`    | Yes           | v1.18  |
 * | `get-project`         | Yes           | v1.18  |
 * | `create-project`      | Yes           | v1.18  |
 * | `rename-project`      | Yes           | v1.18  |
 * | `update-project-pin`  | Yes           | v1.18  |
 * | `delete-project`      | Yes           | v1.18  |
 */

import { v4 as uuidv4 } from 'uuid';
import { rowToCamel, rowsToCamel } from '../db/sqlite.js';

/**
 * Register all project-related RPC commands.
 *
 * @param {function(string, import('./dispatcher.js').RpcMethodDefinition): void} register - Method registration callback.
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 */
export default function registerProjectCommands(register, pool) {

  register('get-projects', {
    auth: true,
    added: '1.18',
    async handler(params) {
      const rows = pool.query(
        'SELECT * FROM project WHERE team_id = @teamId AND deleted_at IS NULL ORDER BY project_order, created_at',
        { teamId: params.teamId }
      );
      return rowsToCamel(rows);
    }
  });

  register('get-all-projects', {
    auth: true,
    added: '1.18',
    async handler(params, ctx) {
      const rows = pool.query(
        `SELECT p.* FROM project p
         JOIN team_profile_rel tpr ON tpr.team_id = p.team_id
         WHERE tpr.profile_id = @profileId AND p.deleted_at IS NULL`,
        { profileId: ctx.profileId }
      );
      return rowsToCamel(rows);
    }
  });

  register('get-project', {
    auth: true,
    added: '1.18',
    async handler(params) {
      const project = pool.get('SELECT * FROM project WHERE id = ? AND deleted_at IS NULL', { id: params.id });
      if (!project) throw new Error('not-found:Project not found');
      return rowToCamel(project);
    }
  });

  register('create-project', {
    auth: true,
    added: '1.18',
    async handler(params) {
      const id = params.id || uuidv4();
      const now = new Date().toISOString();
      const result = pool.insertReturning('project', {
        id,
        team_id: params.teamId,
        name: params.name,
        is_default: '0',
        created_at: now,
        modified_at: now,
      });
      return rowToCamel(result);
    }
  });

  register('rename-project', {
    auth: true,
    added: '1.18',
    async handler(params) {
      const result = pool.updateReturning('project', {
        name: params.name,
        modified_at: new Date().toISOString(),
      }, { id: params.id });
      if (!result) throw new Error('not-found:Project not found');
      return rowToCamel(result);
    }
  });

  register('update-project-pin', {
    auth: true,
    added: '1.18',
    async handler(params, ctx) {
      pool.update('team_project_profile_rel', {
        is_pinned: params.isPinned ? '1' : '0',
        modified_at: new Date().toISOString(),
      }, { team_id: params.teamId, project_id: params.id, profile_id: ctx.profileId });
      return { id: params.id, isPinned: params.isPinned };
    }
  });

  register('delete-project', {
    auth: true,
    added: '1.18',
    async handler(params) {
      pool.softDelete('project', { id: params.id });
      return { id: params.id };
    }
  });
}