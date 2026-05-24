/**
 * @module rpc/verify_token
 * @description Token verification and processing RPC command — mirrors
 * `app.rpc.commands.verify-token` from the Clojure backend.
 *
 * Dispatches token processing based on the `iss` (issuer) claim:
 *
 * | `iss`                | Action                                        |
 * |----------------------|-----------------------------------------------|
 * | `change-email`      | Updates profile email, validates uniqueness   |
 * | `verify-email`      | Activates profile, creates session token       |
 * | `auth`              | Returns profile data attached to claims        |
 * | `team-invitation`   | Accepts team invitation or returns pending state|
 * | `password-recovery` | Not processed here (handled by recover-profile)|
 *
 * ### Method summary
 *
 * | Method           | Auth required | Since |
 * |------------------|:-------------:|-------|
 * | `verify-token`   | No            | 1.15  |
 */

import { verifyToken } from '../auth/tokens.js';
import { createSessionToken } from '../auth/tokens.js';
import { sendEmailVerification } from '../email/index.js';
import { rowToCamel } from '../db/sqlite.js';
import { RpcError } from '../rpc/dispatcher.js';

/**
 * Process a token based on its `iss` (issuer) claim.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {Record<string, *>} params - Request params (must include `token`).
 * @param {import('../rpc/dispatcher.js').RpcContext} ctx - RPC context.
 * @returns {Promise<*>} Result varies by token type.
 */
async function processToken(pool, params, claims) {
  const iss = claims.iss;

  switch (iss) {
    case 'change-email': {
      const { uid: profileId, email } = claims;
      const trimmedEmail = (email || '').trim().toLowerCase();

      const existing = pool.get(
        'SELECT id FROM profile WHERE email = ? AND deleted_at IS NULL AND id != ?',
        [trimmedEmail, profileId]
      );
      if (existing) {
        throw new RpcError('validation', 'email-already-exists', 'A profile with this email already exists');
      }

      pool.run('UPDATE profile SET email = ?, modified_at = ? WHERE id = ?', [trimmedEmail, new Date().toISOString(), profileId]);
      const profile = pool.get('SELECT * FROM profile WHERE id = ?', [profileId]);
      return { ...claims, profile: profile ? rowToCamel(profile) : null };
    }

    case 'verify-email': {
      const { uid: profileId } = claims;
      const profile = pool.get('SELECT * FROM profile WHERE id = ? AND deleted_at IS NULL', [profileId]);
      if (!profile) {
        throw new RpcError('not-found', 'object-not-found', 'Profile not found');
      }

      if (profile.is_active !== '1') {
        pool.run("UPDATE profile SET is_active = '1', modified_at = ? WHERE id = ?", [new Date().toISOString(), profileId]);
      }

      const sessionId = crypto.randomUUID();
      pool.run(
        'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        [sessionId, profileId, '', new Date().toISOString(), new Date().toISOString(), '1']
      );

      const token = await createSessionToken(profileId, sessionId);
      return { ...claims, profile: rowToCamel(profile), token };
    }

    case 'auth': {
      const { uid: profileId } = claims;
      const profile = pool.get('SELECT * FROM profile WHERE id = ? AND deleted_at IS NULL', [profileId]);
      if (!profile) {
        throw new RpcError('not-found', 'object-not-found', 'Profile not found');
      }
      return { ...claims, profile: rowToCamel(profile) };
    }

    case 'team-invitation': {
      const { profileId: loggedInProfileId } = params;
      const { memberId, teamId, organizationId, memberEmail, role } = claims;

      if (!teamId && !organizationId) {
        throw new RpcError('validation', 'invalid-invitation-token', 'Invitation token contains unexpected data');
      }

      const invitation = pool.get(
        'SELECT * FROM team_invitation WHERE email_to = ? AND team_id = ?',
        [memberEmail, teamId]
      );

      if (loggedInProfileId) {
        const profile = pool.get('SELECT * FROM profile WHERE id = ? AND deleted_at IS NULL', [loggedInProfileId]);
        if (!profile) {
          throw new RpcError('not-found', 'object-not-found', 'Profile not found');
        }

        if (memberId && memberId !== loggedInProfileId && memberEmail !== profile.email) {
          throw new RpcError('validation', 'invalid-token', 'Logged-in user does not match the invitation');
        }

        if (profile.is_blocked === '1') {
          throw new RpcError('restriction', 'profile-blocked', 'Blocked users cannot accept invitations');
        }

        if (!invitation) {
          throw new RpcError('validation', 'invalid-token', 'No invitation associated with the token');
        }

        if (teamId) {
          const existing = pool.get(
            'SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ?',
            [teamId, loggedInProfileId]
          );

          if (!existing) {
            const now = new Date().toISOString();
            pool.insertReturning('team_profile_rel', {
              id: uuidv4(),
              team_id: teamId,
              profile_id: loggedInProfileId,
              is_owner: '0',
              is_admin: role === 'admin' ? '1' : '0',
              can_edit: role === 'viewer' ? '0' : '1',
              is_member: '1',
              created_at: now,
              modified_at: now,
            });
          }

          pool.run('DELETE FROM team_invitation WHERE email_to = ? AND team_id = ?', [memberEmail, teamId]);

          const team = pool.get('SELECT * FROM team WHERE id = ? AND deleted_at IS NULL', [teamId]);
          return { ...claims, state: 'created', teamId };
        }

        return { ...claims, state: 'created' };
      }

      return {
        invitationToken: params.token,
        iss: 'team-invitation',
        redirectTo: memberId ? 'auth-login' : 'auth-register',
        state: 'pending',
      };
    }

    default:
      throw new RpcError('validation', 'invalid-token', `Unknown token issuer: ${iss}`);
  }
}

export default function registerVerifyTokenCommands(register, pool) {

  register('verify-token', {
    auth: false,
    added: '1.15',
    async handler(params, ctx) {
      const { token } = params;
      if (!token) {
        throw new RpcError('validation', 'validation-error', 'Token is required');
      }

      const { valid, claims } = await verifyToken(token);
      if (!valid || !claims) {
        throw new RpcError('validation', 'invalid-token', 'Token verification failed');
      }

      const result = await processToken(pool, params, claims);
      return result;
    }
  });
}