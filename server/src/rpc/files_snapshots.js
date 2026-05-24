/**
 * @module rpc/files_snapshots
 * @description File snapshot (version history) RPC commands — mirrors
 * `app.rpc.commands.files-snapshot` from the Clojure backend.
 *
 * Snapshots allow users to save named versions of a file for later
 * restoration, similar to git commits but for design files.
 *
 * ### Method summary
 *
 * | Method                     | Auth required | Since |
 * |----------------------------|:-------------:|-------|
 * | `get-file-snapshots`      | Yes           | 1.20  |
 * | `get-file-snapshot`       | Yes           | 2.16  |
 * | `create-file-snapshot`    | Yes           | 1.20  |
 * | `restore-file-snapshot`   | Yes           | 1.20  |
 * | `update-file-snapshot`    | Yes           | 1.20  |
 * | `delete-file-snapshot`    | Yes           | 1.20  |
 * | `lock-file-snapshot`      | Yes           | 1.20  |
 * | `unlock-file-snapshot`    | Yes           | 1.20  |
 */

import { v4 as uuidv4 } from 'uuid';
import { rowToCamel, rowsToCamel } from '../db/sqlite.js';
import { RpcError } from '../rpc/dispatcher.js';

function checkReadPermissions(pool, profileId, fileId) {
  const file = pool.get(
    `SELECT f.id FROM file f
     JOIN project p ON p.id = f.project_id
     JOIN team_profile_rel tpr ON tpr.team_id = p.team_id
     WHERE f.id = ? AND f.deleted_at IS NULL AND tpr.profile_id = ?`,
    { id: fileId, profile_id: profileId }
  );
  if (!file) throw new RpcError('not-found', 'object-not-found', 'File not found or access denied');
  return file;
}

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
  return file;
}

export default function registerFileSnapshotCommands(register, pool) {

  register('get-file-snapshots', {
    auth: true,
    added: '1.20',
    async handler(params, ctx) {
      const { fileId } = params;
      checkReadPermissions(pool, ctx.profileId, fileId);

      const rows = pool.query(
        `SELECT * FROM file_snapshot WHERE file_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
        [fileId]
      );
      return rowsToCamel(rows);
    }
  });

  register('get-file-snapshot', {
    auth: true,
    added: '2.16',
    async handler(params, ctx) {
      const { fileId, snapshotId } = params;
      checkReadPermissions(pool, ctx.profileId, fileId);

      const snapshot = pool.get(
        'SELECT * FROM file_snapshot WHERE id = ? AND file_id = ? AND deleted_at IS NULL',
        { id: snapshotId, file_id: fileId }
      );
      if (!snapshot) throw new RpcError('not-found', 'object-not-found', 'Snapshot not found');
      return rowToCamel(snapshot);
    }
  });

  register('create-file-snapshot', {
    auth: true,
    added: '1.20',
    async handler(params, ctx) {
      const { fileId, label } = params;
      checkEditionPermissions(pool, ctx.profileId, fileId);

      const id = uuidv4();
      const now = new Date().toISOString();
      const file = pool.get('SELECT revn, data FROM file WHERE id = ? AND deleted_at IS NULL', { id: fileId });
      if (!file) throw new RpcError('not-found', 'object-not-found', 'File not found');

      const result = pool.insertOnConflictDoNothing('file_snapshot', {
        id,
        file_id: fileId,
        label: label || `Snapshot at rev ${file.revn || 0}`,
        revn: file.revn || 0,
        is_locked: '0',
        data: file.data || null,
        created_at: now,
        modified_at: now,
      });

      return rowToCamel(pool.get('SELECT * FROM file_snapshot WHERE id = ?', { id }));
    }
  });

  register('restore-file-snapshot', {
    auth: true,
    added: '1.20',
    async handler(params, ctx) {
      const { fileId, snapshotId } = params;
      checkEditionPermissions(pool, ctx.profileId, fileId);

      const snapshot = pool.get(
        'SELECT * FROM file_snapshot WHERE id = ? AND file_id = ? AND deleted_at IS NULL',
        { id: snapshotId, file_id: fileId }
      );
      if (!snapshot) throw new RpcError('not-found', 'object-not-found', 'Snapshot not found');

      const now = new Date().toISOString();
      if (snapshot.data) {
        pool.run('UPDATE file SET data = ?, modified_at = ? WHERE id = ?', [snapshot.data, now, fileId]);
      }

      return rowToCamel(pool.get('SELECT * FROM file WHERE id = ?', { id: fileId }));
    }
  });

  register('update-file-snapshot', {
    auth: true,
    added: '1.20',
    async handler(params, ctx) {
      const { fileId, snapshotId, label } = params;
      checkEditionPermissions(pool, ctx.profileId, fileId);

      const snapshot = pool.get(
        'SELECT * FROM file_snapshot WHERE id = ? AND file_id = ? AND deleted_at IS NULL',
        { id: snapshotId, file_id: fileId }
      );
      if (!snapshot) throw new RpcError('not-found', 'object-not-found', 'Snapshot not found');

      pool.run('UPDATE file_snapshot SET label = ?, modified_at = ? WHERE id = ?',
        [label || snapshot.label, new Date().toISOString(), snapshotId]);
      return rowToCamel(pool.get('SELECT * FROM file_snapshot WHERE id = ?', { id: snapshotId }));
    }
  });

  register('delete-file-snapshot', {
    auth: true,
    added: '1.20',
    async handler(params, ctx) {
      const { fileId, snapshotId } = params;
      checkEditionPermissions(pool, ctx.profileId, fileId);

      const snapshot = pool.get(
        'SELECT * FROM file_snapshot WHERE id = ? AND file_id = ? AND deleted_at IS NULL',
        { id: snapshotId, file_id: fileId }
      );
      if (!snapshot) throw new RpcError('not-found', 'object-not-found', 'Snapshot not found');

      pool.run('UPDATE file_snapshot SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), snapshotId]);
      return null;
    }
  });

  register('lock-file-snapshot', {
    auth: true,
    added: '1.20',
    async handler(params, ctx) {
      const { fileId, snapshotId } = params;
      checkEditionPermissions(pool, ctx.profileId, fileId);

      pool.run('UPDATE file_snapshot SET is_locked = ?, modified_at = ? WHERE id = ? AND file_id = ?',
        ['1', new Date().toISOString(), snapshotId, fileId]);
      return rowToCamel(pool.get('SELECT * FROM file_snapshot WHERE id = ?', { id: snapshotId }));
    }
  });

  register('unlock-file-snapshot', {
    auth: true,
    added: '1.20',
    async handler(params, ctx) {
      const { fileId, snapshotId } = params;
      checkEditionPermissions(pool, ctx.profileId, fileId);

      pool.run('UPDATE file_snapshot SET is_locked = ?, modified_at = ? WHERE id = ? AND file_id = ?',
        ['0', new Date().toISOString(), snapshotId, fileId]);
      return rowToCamel(pool.get('SELECT * FROM file_snapshot WHERE id = ?', { id: snapshotId }));
    }
  });
}