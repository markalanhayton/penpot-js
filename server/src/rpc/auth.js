'use strict';
/**
 * @module rpc/auth
 * @description Authentication RPC commands — mirrors `app.rpc.commands.auth`
 * from the Clojure backend.
 *
 * Handles login, logout, registration, password recovery, and SSO provider lookup.
 * All method names use kebab-case to match their Clojure `::keyword` equivalents.
 *
 * ### Method summary
 *
 * | Method                       | Auth required | Since  |
 * |------------------------------|:-------------:|--------|
 * | `login-with-password`        | No            | 1.15   |
 * | `logout`                     | No*           | 1.0    |
 * | `prepare-register-profile`   | No            | 1.15   |
 * | `register-profile`           | No            | 1.15   |
 * | `request-profile-recovery`   | No            | 1.15   |
 * | `recover-profile`            | No            | 1.15   |
 * | `get-sso-provider`           | No            | 2.12   |
 */

import { v4 as uuidv4 } from 'uuid';
import { derivePassword, verifyPassword, isNoPasswordSet } from '../auth/password.js';
import { createToken, createSessionToken, createRegistrationToken, createPasswordRecoveryToken, createVerifyEmailToken, verifyToken } from '../auth/tokens.js';
import { config, flagEnabled } from '../config/index.js';
import { rowToCamel } from '../db/sqlite.js';
import { RpcError, errors } from '../rpc/dispatcher.js';
import { downloadImage, getImageInfo, sanitizeImage, profileThumbnail, PROFILE_THUMBNAIL_OPTIONS, withTempFiles, validateMediaType } from '../media/index.js';
import { putStorageObject } from '../storage/fs.js';
import { sendPasswordRecovery, sendEmailVerification, isEmailAllowed } from '../email/index.js';

const e = errors;

/**
 * Download a profile picture from a URL and store it as a storage object.
 * Mirrors `app.rpc.commands.auth/import-profile-picture`.
 *
 * @param {string} uri - URL of the profile picture.
 * @returns {Promise<string|null>} Storage object ID of the thumbnail, or null on failure.
 */
async function importProfilePicture(pool, uri) {
  try {
    return await withTempFiles(async () => {
      const input = await downloadImage(uri);

      // Get image info
      const info = await getImageInfo(input);

      // Sanitize downloaded file
      await sanitizeImage(input.path, info.mtype);

      // Generate profile thumbnail
      const thumb = await profileThumbnail({
        input: info,
        format: PROFILE_THUMBNAIL_OPTIONS.format,
        quality: PROFILE_THUMBNAIL_OPTIONS.quality,
        width: PROFILE_THUMBNAIL_OPTIONS.width,
        height: PROFILE_THUMBNAIL_OPTIONS.height,
      });

      // Store thumbnail
      const fs = await import('node:fs/promises');
      const thumbData = await fs.readFile(thumb.path);
      const thumbObj = putStorageObject(pool, thumbData, {
        contentType: thumb.mtype,
        bucket: 'profile',
        size: thumb.size,
        deduplicate: true,
      });

      return thumbObj.id;
    });
  } catch (err) {
    console.warn(`[auth] Unable to import profile picture from ${uri}:`, err.message);
    return null;
  }
}

export default function registerAuthCommands(register, pool) {

  /**
   * Login with email and password.
   * Creates a new HTTP session and returns a session token.
   *
   * @ rpc-method login-with-password auth=false added=1.15
   */
  register('login-with-password', {
    auth: false,
    added: '1.15',
    async handler(params, ctx) {
      if (!flagEnabled('login-with-password')) {
        throw e.authorization('Password login is disabled');
      }

      const { email, password } = params;
      const trimmedEmail = (email || '').trim().toLowerCase();

      const profile = pool.getOne('profile', { email: trimmedEmail });
      if (!profile || profile.deleted_at) {
        throw e.notFound('Profile not found');
      }

      if (profile.is_active !== '1') {
        throw e.authorization('Account is not active');
      }
      if (profile.is_blocked === '1') {
        throw e.authorization('Account is blocked');
      }
      if (isNoPasswordSet(profile.password)) {
        throw e.authorization('This account uses SSO authentication');
      }

      const { valid, update } = await verifyPassword(profile.password, password);
      if (!valid) {
        throw e.authorization('Invalid email or password');
      }

      if (update) {
        const newHash = await derivePassword(password);
        pool.run('UPDATE profile SET password = ? WHERE id = ?', [newHash, profile.id]);
      }

      const now = new Date().toISOString();
      const sessionId = uuidv4();
      pool.run(
        'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        [sessionId, profile.id, ctx.userAgent || '', now, now, '1']
      );

      pool.run('UPDATE profile SET last_activity_at = ? WHERE id = ?', [now, profile.id]);

      const token = await createSessionToken(profile.id, sessionId);
      const refreshed = pool.getOne('profile', { id: profile.id });

      return {
        profile: rowToCamel(refreshed),
        token,
      };
    }
  });

  /**
   * Logout — deactivates the current HTTP session if one exists.
   *
   * @ rpc-method logout auth=false added=1.0
   */
  register('logout', {
    auth: false,
    added: '1.0',
    async handler(params, ctx) {
      if (ctx.sessionId) {
        pool.run("UPDATE http_session SET is_active = '0' WHERE id = ?", [ctx.sessionId]);
      }
      return null;
    }
  });

  /**
   * Prepare a profile registration by validating email uniqueness and
   * creating a JWE registration token for the `register-profile` step.
   *
   * @ rpc-method prepare-register-profile auth=false added=1.15
   */
  register('prepare-register-profile', {
    auth: false,
    added: '1.15',
    async handler(params) {
      if (!flagEnabled('registration')) {
        throw e.authorization('Registration is disabled');
      }

      const { fullname, email, password, invitationToken } = params;
      const trimmedEmail = (email || '').trim().toLowerCase();

      if (!isEmailAllowed(trimmedEmail)) {
        throw e.validation('Email domain is not allowed');
      }

      const existing = pool.get(
        'SELECT id, email, is_active, is_blocked, deleted_at FROM profile WHERE email = ? AND deleted_at IS NULL',
        [trimmedEmail]
      );
      if (existing && existing.is_active === '1') {
        throw e.conflict('Email is already registered');
      }

      const claims = {
        iss: 'prepared-register',
        email: trimmedEmail,
        fullname: fullname || '',
        password,
      };
      if (invitationToken) {
        claims.invitationToken = invitationToken;
      }
      const token = await createToken(claims, '7d');
      return { token };
    }
  });

  /**
   * Complete profile registration by verifying the registration token,
   * creating the profile, default team, and draft project.
   *
   * @ rpc-method register-profile auth=false added=1.15
   */
  register('register-profile', {
    auth: false,
    added: '1.15',
    async handler(params, ctx) {
      if (!flagEnabled('registration')) {
        throw e.authorization('Registration is disabled');
      }

      const { token } = params;
      const { valid, claims } = await verifyToken(token);
      console.log('[auth:register] verifyToken result:', { valid, iss: claims?.iss, tokenPrefix: token?.substring(0, 30) });
      if (!valid || claims?.iss !== 'prepared-register') {
        throw e.validation('Invalid or expired registration token');
      }

      const { email, fullname, password, invitationToken } = claims;
      const trimmedEmail = (email || '').trim().toLowerCase();

      if (!isEmailAllowed(trimmedEmail)) {
        throw e.validation('Email domain is not allowed');
      }

      const existing = pool.get(
        'SELECT id, email, is_active, is_blocked, deleted_at FROM profile WHERE email = ? AND deleted_at IS NULL',
        [trimmedEmail]
      );

      if (existing) {
        if (existing.is_blocked === '1') {
          return { id: existing.id, email: existing.email };
        }

        if (existing.is_active === '1') {
          const sessionId = uuidv4();
          const now = new Date().toISOString();
          pool.run(
            'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            [sessionId, existing.id, ctx.userAgent || '', now, now, '1']
          );
          pool.run('UPDATE profile SET last_activity_at = ? WHERE id = ?', [now, existing.id]);

          const sessionToken = await createSessionToken(existing.id, sessionId);
          const refreshed = pool.getOne('profile', { id: existing.id });
          return { profile: rowToCamel(refreshed), token: sessionToken };
        }

        if (flagEnabled('email-verification')) {
          const vToken = await createVerifyEmailToken(existing.id);
          await sendEmailVerification({ to: existing.email, token: vToken });
          return { id: existing.id, email: existing.email };
        }

        throw e.conflict('Email is already registered');
      }

      const isActive = !flagEnabled('email-verification');
      const profileId = uuidv4();
      const now = new Date().toISOString();
      const hashedPassword = await derivePassword(password);

      let teamId;
      let projectId;

      try {
        pool.transaction(() => {
        pool.insertReturning('profile', {
          id: profileId,
          fullname: fullname || '',
          email: trimmedEmail,
          password: hashedPassword,
          is_active: isActive ? '1' : '0',
          is_demo: '0',
          is_blocked: '0',
          auth_source: 'password',
          created_at: now,
          modified_at: now,
        });

        teamId = uuidv4();
        pool.insertReturning('team', {
          id: teamId,
          name: 'Default',
          is_default: '1',
          created_at: now,
          modified_at: now,
        });

        pool.insertReturning('team_profile_rel', {
          id: uuidv4(),
          team_id: teamId,
          profile_id: profileId,
          is_admin: '1',
          is_owner: '1',
          can_edit: '1',
          is_member: '1',
          created_at: now,
          modified_at: now,
        });

        projectId = uuidv4();
        pool.insertReturning('project', {
          id: projectId,
          team_id: teamId,
          name: 'Drafts',
          is_default: '1',
          created_at: now,
          modified_at: now,
        });

        pool.update('profile',
          { defaultTeamId: teamId, defaultProjectId: projectId },
          { id: profileId }
        );
      });
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
          throw e.conflict('Email is already registered');
        }
        throw err;
      }

      if (!isActive) {
        const vToken = await createVerifyEmailToken(profileId);
        await sendEmailVerification({ to: trimmedEmail, token: vToken });
        return { id: profileId, email: trimmedEmail };
      }

      const sessionId = uuidv4();
      pool.run(
        'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        [sessionId, profileId, ctx.userAgent || '', now, now, '1']
      );

      const sessionToken = await createSessionToken(profileId, sessionId);
      const profile = pool.getOne('profile', { id: profileId });

      return {
        profile: rowToCamel(profile),
        token: sessionToken,
      };
    }
  });

  /**
   * Request a password recovery token for the given email.
   * Always returns `{ status: 'ok' }` even if the email doesn't exist (security).
   *
   * @ rpc-method request-profile-recovery auth=false added=1.15
   */
  register('request-profile-recovery', {
    auth: false,
    added: '1.15',
    async handler(params) {
      const { email } = params;
      const trimmedEmail = (email || '').trim().toLowerCase();

      const profile = pool.get(
        'SELECT id FROM profile WHERE email = ? AND deleted_at IS NULL',
        { email: trimmedEmail }
      );

      // Always return success even if email not found (security)
      if (!profile) return { status: 'ok' };

      const recoveryToken = await createPasswordRecoveryToken(profile.id);

      const profileRow = pool.get('SELECT email FROM profile WHERE id = ?', [profile.id]);
      if (profileRow?.email) {
        await sendPasswordRecovery({ to: profileRow.email, token: recoveryToken, profileId: profile.id });
      }

      return { status: 'ok' };
    }
  });

  /**
   * Reset a profile's password using a valid recovery token.
   * Invalidates all active sessions for the profile after password reset.
   *
   * @ rpc-method recover-profile auth=false added=1.15
   */
  register('recover-profile', {
    auth: false,
    added: '1.15',
    async handler(params) {
      const { token, password } = params;
      const { valid, claims } = await verifyToken(token);
      if (!valid || claims?.iss !== 'password-recovery') {
        throw e.validation('Invalid or expired recovery token');
      }

      const profileId = claims.uid;
      const hashedPassword = await derivePassword(password);
      const now = new Date().toISOString();

      pool.run('UPDATE profile SET password = ?, modified_at = ? WHERE id = ?', [hashedPassword, now, profileId]);

      // Invalidate all sessions for this profile
      pool.run("UPDATE http_session SET is_active = '0' WHERE profile_id = ?", [profileId]);

      return { status: 'ok' };
    }
  });

  register('get-sso-provider', {
    auth: false,
    added: '2.12',
    async handler(params) {
      const { email } = params;
      if (!email) return null;

      const trimmedEmail = (email || '').trim().toLowerCase();
      const domain = trimmedEmail.split('@')[1];

      const provider = pool.get(
        'SELECT * FROM sso_provider WHERE domain = ? AND is_enabled = ?',
        { domain, is_enabled: '1' }
      );

      if (!provider) return null;
      return rowToCamel(provider);
    }
  });
}