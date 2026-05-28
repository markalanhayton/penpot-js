'use strict';
/**
 * @module rpc/files_share
 * @description Share link RPC commands — mirrors `app.rpc.commands.files-share`
 * from the Clojure backend.
 *
 * ### Method summary
 *
 * | Method                | Auth required | Since |
 * |-----------------------|:-------------:|-------|
 * | `create-share-link`  | Yes           | 1.18  |
 * | `delete-share-link`  | Yes           | 1.18  |
 */

import { v4 as uuidv4 } from 'uuid';
import { rowToCamel } from '../db/sqlite.js';
import { RpcError } from '../rpc/dispatcher.js';

function checkEditionPermissions(pool, profileId, fileId) {
  const file = pool.get(
    `SELECT f.id FROM file f
     JOIN project p ON p.id = f.project_id
     JOIN team_profile_rel tpr ON tpr.team_id = p.team_id
     WHERE f.id = ? AND f.deleted_at IS NULL
       AND tpr.profile_id = ? AND tpr.can_edit = '1'`,
    { id: fileId, profile_id: profileId }
  );
  if (!file) throw new RpcError('authorization', 'access-denied', 'Edit access required');
}

export default function registerFileShareCommands(register, pool) {

  register('create-share-link', {
    auth: true,
    added: '1.18',
    async handler(params, ctx) {
      const { fileId, permissions } = params;
      checkEditionPermissions(pool, ctx.profileId, fileId);

      const id = uuidv4();
      const token = uuidv4().replace(/-/g, '');
      const now = new Date().toISOString();

      const result = pool.insertOnConflictDoNothing('share_link', {
        id,
        file_id: fileId,
        created_at: now,
        modified_at: now,
        token,
        permissions: JSON.stringify(permissions || []),
      });

      const link = pool.get('SELECT * FROM share_link WHERE id = ?', { id });
      return rowToCamel(link);
    }
  });

  register('delete-share-link', {
    auth: true,
    added: '1.18',
    async handler(params, ctx) {
      const { id } = params;

      const link = pool.get('SELECT * FROM share_link WHERE id = ?', { id });
      if (!link) throw new RpcError('not-found', 'object-not-found', 'Share link not found');

      checkEditionPermissions(pool, ctx.profileId, link.file_id);

      pool.run('DELETE FROM share_link WHERE id = ?', [id]);
      return null;
    }
  });
}