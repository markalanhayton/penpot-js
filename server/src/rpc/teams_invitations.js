'use strict';
/**
 * @module rpc/teams_invitations
 * @description Team invitation RPC commands — mirrors `app.rpc.commands.teams-invitations`
 * from the Clojure backend.
 *
 * ### Method summary
 *
 * | Method                            | Auth required | Since |
 * |-----------------------------------|:-------------:|-------|
 * | `create-team-invitations`        | Yes           | 1.17  |
 * | `create-team-with-invitations`   | Yes           | 1.17  |
 * | `get-team-invitation-token`       | Yes           | 1.17  |
 * | `update-team-invitation-role`    | Yes           | 1.17  |
 * | `delete-team-invitation`         | Yes           | 1.17  |
 * | `create-team-access-request`    | Yes           | 2.2   |
 * | `get-team-access-requests`     | Yes           | 2.2   |
 * | `resolve-team-access-request`  | Yes           | 2.2   |
 * | `delete-team-access-request`   | Yes           | 2.2   |
 */

import { v4 as uuidv4 } from 'uuid';
import { rowToCamel, rowsToCamel } from '../db/sqlite.js';
import { RpcError } from '../rpc/dispatcher.js';

function checkTeamEditionPermissions(pool, profileId, teamId) {
  const rel = pool.get(
    `SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ? AND can_edit = '1'`,
    { team_id: teamId, profile_id: profileId }
  );
  if (!rel) throw new RpcError('authorization', 'access-denied', 'Edit access required');
}

export default function registerTeamInvitationCommands(register, pool) {

  register('create-team-invitations', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { teamId, invitations } = params;
      checkTeamEditionPermissions(pool, ctx.profileId, teamId);

      const results = [];
      for (const inv of (invitations || [])) {
        const now = new Date().toISOString();
        const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const existing = pool.get(
          'SELECT * FROM team_invitation WHERE team_id = ? AND email_to = ?',
          [teamId, inv.email]
        );

        if (existing) {
          results.push(rowToCamel(existing));
          continue;
        }

        const row = pool.insertOnConflictDoNothing('team_invitation', {
          id: uuidv4(),
          team_id: teamId,
          email_to: inv.email,
          role: inv.role || 'viewer',
          valid_until: validUntil,
          created_at: now,
          updated_at: now,
        });

        results.push(rowToCamel(pool.get(
          'SELECT * FROM team_invitation WHERE team_id = ? AND email_to = ?',
          [teamId, inv.email]
        )));
      }

      return results;
    }
  });

  register('create-team-with-invitations', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { name, invitations } = params;
      const teamId = uuidv4();
      const now = new Date().toISOString();

      pool.insertOnConflictDoNothing('team', {
        id: teamId,
        name: name || 'New Team',
        is_default: '0',
        created_at: now,
        modified_at: now,
      });

      pool.insertOnConflictDoNothing('team_profile_rel', {
        id: uuidv4(),
        team_id: teamId,
        profile_id: ctx.profileId,
        is_admin: '1',
        is_owner: '1',
        can_edit: '1',
        is_member: '1',
        created_at: now,
        modified_at: now,
      });

      for (const inv of (invitations || [])) {
        const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        pool.insertOnConflictDoNothing('team_invitation', {
          id: uuidv4(),
          team_id: teamId,
          email_to: inv.email,
          role: inv.role || 'viewer',
          valid_until: validUntil,
          created_at: now,
          updated_at: now,
        });
      }

      const team = pool.get('SELECT * FROM team WHERE id = ?', { id: teamId });
      return rowToCamel(team);
    }
  });

  register('get-team-invitation-token', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { teamId } = params;
      checkTeamEditionPermissions(pool, ctx.profileId, teamId);
      // Generate a token for the team invitation flow
      const token = uuidv4().replace(/-/g, '');
      return { teamId, token };
    }
  });

  register('update-team-invitation-role', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { teamId, emailTo, role } = params;
      checkTeamEditionPermissions(pool, ctx.profileId, teamId);

      const now = new Date().toISOString();
      pool.run(
        'UPDATE team_invitation SET role = ?, updated_at = ? WHERE team_id = ? AND email_to = ?',
        [role, now, teamId, emailTo]
      );

      const invitation = pool.get(
        'SELECT * FROM team_invitation WHERE team_id = ? AND email_to = ?',
        [teamId, emailTo]
      );
      return rowToCamel(invitation);
    }
  });

  register('delete-team-invitation', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { teamId, emailTo } = params;
      checkTeamEditionPermissions(pool, ctx.profileId, teamId);

      pool.run('DELETE FROM team_invitation WHERE team_id = ? AND email_to = ?', [teamId, emailTo]);
      return null;
    }
  });

  register('create-team-access-request', {
    auth: true,
    added: '2.2',
    async handler(params, ctx) {
      const { teamId } = params;

      const team = pool.get('SELECT id FROM team WHERE id = ? AND deleted_at IS NULL', { id: teamId });
      if (!team) throw new RpcError('not-found', 'object-not-found', 'Team not found');

      const member = pool.get(
        'SELECT 1 FROM team_profile_rel WHERE team_id = ? AND profile_id = ?',
        { team_id: teamId, profile_id: ctx.profileId }
      );
      if (member) throw new RpcError('conflict', 'conflict-error', 'You are already a member of this team');

      const existing = pool.get(
        'SELECT * FROM team_access_request WHERE team_id = ? AND requester_id = ?',
        { team_id: teamId, requester_id: ctx.profileId }
      );
      if (existing) throw new RpcError('conflict', 'conflict-error', 'Access request already exists');

      const id = uuidv4();
      const now = new Date().toISOString();
      const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      pool.insertOnConflictDoNothing('team_access_request', {
        id,
        team_id: teamId,
        requester_id: ctx.profileId,
        valid_until: validUntil,
        auto_join_until: validUntil,
        created_at: now,
        updated_at: now,
      });

      return rowToCamel(pool.get('SELECT * FROM team_access_request WHERE id = ?', { id }));
    }
  });

  register('get-team-access-requests', {
    auth: true,
    added: '2.2',
    async handler(params, ctx) {
      const { teamId } = params;
      checkTeamEditionPermissions(pool, ctx.profileId, teamId);

      const rows = pool.query(
        `SELECT tar.id, tar.team_id, tar.requester_id, tar.valid_until,
                tar.auto_join_until, tar.created_at, tar.updated_at,
                p.email AS requester_email, p.fullname AS requester_fullname, p.photo_id AS requester_photo_id
         FROM team_access_request tar
         JOIN profile p ON p.id = tar.requester_id
         WHERE tar.team_id = @teamId
           AND p.deleted_at IS NULL
         ORDER BY tar.created_at DESC`,
        { teamId }
      );
      return rowsToCamel(rows);
    }
  });

  register('resolve-team-access-request', {
    auth: true,
    added: '2.2',
    async handler(params, ctx) {
      const { id, accept, role } = params;
      if (!id) throw new RpcError('validation', 'validation-error', 'id is required');

      const request = pool.get('SELECT * FROM team_access_request WHERE id = ?', { id });
      if (!request) throw new RpcError('not-found', 'object-not-found', 'Access request not found');

      checkTeamEditionPermissions(pool, ctx.profileId, request.team_id);

      if (accept) {
        const memberRole = role || 'editor';
        const roleMap = { owner: { is_owner: '1', is_admin: '1', can_edit: '1' },
                          admin: { is_owner: '0', is_admin: '1', can_edit: '1' },
                          editor: { is_owner: '0', is_admin: '0', can_edit: '1' },
                          viewer: { is_owner: '0', is_admin: '0', can_edit: '0' } };
        const roleData = roleMap[memberRole] || roleMap.editor;

        const now = new Date().toISOString();
        pool.transaction(() => {
          pool.insertOnConflictDoNothing('team_profile_rel', {
            id: uuidv4(),
            team_id: request.team_id,
            profile_id: request.requester_id,
            is_admin: roleData.is_admin,
            is_owner: roleData.is_owner,
            can_edit: roleData.can_edit,
            is_member: '1',
            created_at: now,
            modified_at: now,
          });
          pool.deleteFrom('team_access_request', { id: request.id });
        });
      } else {
        pool.deleteFrom('team_access_request', { id: request.id });
      }

      return { id: request.id, teamId: request.team_id, accepted: !!accept };
    }
  });

  register('delete-team-access-request', {
    auth: true,
    added: '2.2',
    async handler(params, ctx) {
      const { id } = params;
      if (!id) throw new RpcError('validation', 'validation-error', 'id is required');

      const request = pool.get('SELECT * FROM team_access_request WHERE id = ?', { id });
      if (!request) throw new RpcError('not-found', 'object-not-found', 'Access request not found');

      const isOwner = String(request.requester_id) === String(ctx.profileId);
      if (!isOwner) {
        checkTeamEditionPermissions(pool, ctx.profileId, request.team_id);
      }

      pool.deleteFrom('team_access_request', { id: request.id });
      return { id: request.id };
    }
  });
}