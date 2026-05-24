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
}