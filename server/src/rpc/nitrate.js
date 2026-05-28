'use strict';
/**
 * @module rpc/nitrate
 * @description Nitrate (enterprise/organization) RPC commands — mirrors `app.rpc.commands.nitrate` from the Clojure backend.
 *
 * | Method                            | Auth | Since |
 * |-----------------------------------|:----:|-------|
 * | `get-nitrate-connectivity`        | Yes  | 2.14  |
 * | `redeem-nitrate-activation-code`   | Yes  | 2.14  |
 * | `leave-org`                        | Yes  | 2.15  |
 * | `remove-team-from-org`             | Yes  | 2.17  |
 * | `add-team-to-organization`         | Yes  | 2.17  |
 *
 * These commands require the Penpot Nitrate (enterprise) service and are stub implementations
 * that return appropriate errors when Nitrate is not configured.
 */

import { RpcError } from './dispatcher.js';

function requireNitrate() {
  const url = process.env.PENPOT_NITRATE_HOST || process.env.PENPOT_NITRATE_URL;
  if (!url) {
    throw new RpcError('restriction', 'nitrate-not-configured', 'Nitrate (enterprise) features are not available');
  }
  return url;
}

export default function registerNitrateCommands(register, pool) {
  register('get-nitrate-connectivity', {
    auth: true,
    added: '2.14',
    handler: async (_params, _ctx) => {
      const url = requireNitrate();

      try {
        const response = await fetch(`${url}/api/health`);
        if (response.ok) {
          return { connected: true, licenses: false };
        }
        return { connected: false, licenses: false };
      } catch {
        return { connected: false, licenses: false };
      }
    },
  });

  register('redeem-nitrate-activation-code', {
    auth: true,
    added: '2.14',
    handler: async (params, ctx) => {
      requireNitrate();
      const { activationCode } = params;

      if (!activationCode) {
        throw new RpcError('validation', 'validation-error', 'Activation code is required');
      }

      const profile = pool.get('SELECT id, email FROM profile WHERE id = ? AND deleted_at IS NULL', { id: ctx.profileId });
      if (!profile) {
        throw new RpcError('not-found', 'object-not-found', 'Profile not found');
      }

      throw new RpcError('validation', 'invalid-activation-code', 'The activation code is invalid, expired or fully redeemed');
    },
  });

  register('leave-org', {
    auth: true,
    added: '2.15',
    handler: async (params, ctx) => {
      requireNitrate();
      const { id, name, defaultTeamId, teamsToDelete, teamsToLeave } = params;

      for (const teamId of teamsToDelete || []) {
        const team = pool.get('SELECT id FROM team WHERE id = ? AND deleted_at IS NULL', { id: teamId });
        if (team) {
          pool.run('UPDATE team SET deleted_at = ?, name = ? || name WHERE id = ?', [new Date().toISOString(), '[left] ', teamId]);
        }
      }

      for (const teamEntry of teamsToLeave || []) {
        pool.run('DELETE FROM team_profile_rel WHERE team_id = ? AND profile_id = ?', [teamEntry.id, ctx.profileId]);
      }

      if (defaultTeamId) {
        const fileCount = pool.get(
          `SELECT count(*) as total FROM file f JOIN project p ON p.id = f.project_id
           WHERE p.team_id = ? AND f.deleted_at IS NULL`,
          { id: defaultTeamId }
        );
        if (!fileCount || fileCount.total === 0) {
          pool.run('UPDATE team SET name = ? || name, is_default = 0 WHERE id = ?', ['[left] ', defaultTeamId]);
        }
      }

      return null;
    },
  });

  register('remove-team-from-org', {
    auth: true,
    added: '2.17',
    handler: async (params, ctx) => {
      requireNitrate();
      const { teamId, organizationId, organizationName } = params;

      const rel = pool.get(
        `SELECT is_owner FROM team_profile_rel WHERE team_id = ? AND profile_id = ?`,
        [teamId, ctx.profileId]
      );
      if (!rel || rel.is_owner !== '1') {
        throw new RpcError('authorization', 'access-denied', 'Only team owners can remove a team from an organization');
      }

      const team = pool.get('SELECT * FROM team WHERE id = ? AND deleted_at IS NULL', { id: teamId });
      if (team && team.is_default === '1') {
        throw new RpcError('validation', 'validation-error', 'Cannot remove the default team from an organization');
      }

      return null;
    },
  });

  register('add-team-to-organization', {
    auth: true,
    added: '2.17',
    handler: async (params, ctx) => {
      requireNitrate();
      const { teamId, organizationId } = params;

      const rel = pool.get(
        `SELECT is_owner FROM team_profile_rel WHERE team_id = ? AND profile_id = ?`,
        [teamId, ctx.profileId]
      );
      if (!rel || rel.is_owner !== '1') {
        throw new RpcError('authorization', 'access-denied', 'Only team owners can add a team to an organization');
      }

      const team = pool.get('SELECT * FROM team WHERE id = ? AND deleted_at IS NULL', { id: teamId });
      if (team && team.is_default === '1') {
        throw new RpcError('validation', 'validation-error', 'Cannot add the default team to an organization');
      }

      return null;
    },
  });
}