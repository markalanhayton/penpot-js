'use strict';
/**
 * @module rpc/ldap
 * @description LDAP authentication RPC command — mirrors `app.rpc.commands.ldap` from the Clojure backend.
 *
 * | Method            | Auth  | Since |
 * |-------------------|:-----:|-------|
 * | `login-with-ldap` | No    | 1.15  |
 */

import { v4 as uuidv4 } from 'uuid';
import { RpcError } from './dispatcher.js';
import { hashPassword, createSession, stripPrivateAttrs } from '../auth/index.js';

export default function registerLdapCommands(register, pool) {
  register('login-with-ldap', {
    auth: false,
    added: '1.15',
    handler: async (params, ctx) => {
      const ldapUrl = process.env.PENPOT_LDAP_URL;
      if (!ldapUrl) {
        throw new RpcError('restriction', 'ldap-not-initialized', 'LDAP authentication is not configured');
      }

      const { email, password, invitationToken } = params;

      if (!email || !password) {
        throw new RpcError('validation', 'wrong-credentials', 'Email and password are required');
      }

      const cleanEmail = email.trim().toLowerCase();

      let ldapResult = null;
      try {
        ldapResult = await authenticateLdap(ldapUrl, cleanEmail, password);
      } catch (err) {
        throw new RpcError('validation', 'wrong-credentials', 'LDAP authentication failed');
      }

      if (!ldapResult) {
        throw new RpcError('validation', 'wrong-credentials', 'Invalid credentials');
      }

      let profile = pool.get('SELECT * FROM profile WHERE email = ? AND deleted_at IS NULL', [cleanEmail]);

      if (!profile) {
        const now = new Date().toISOString();
        const profileId = uuidv4();
        const defaultTeamId = pool.get('SELECT id FROM team WHERE is_default = ? AND deleted_at IS NULL LIMIT 1', ['1'])?.id
          || '00000000-0000-0000-0000-000000000001';

        pool.insertOnConflictDoNothing('profile', {
          id: profileId,
          email: cleanEmail,
          fullname: ldapResult.displayName || cleanEmail.split('@')[0],
          auth_backend: 'ldap',
          is_active: '1',
          is_demo: '0',
          created_at: now,
          modified_at: now,
          props: '{}',
        });

        pool.insertOnConflictDoNothing('team_profile_rel', {
          id: uuidv4(),
          team_id: defaultTeamId,
          profile_id: profileId,
          is_owner: '0',
          is_admin: '1',
          can_edit: '1',
          created_at: now,
        });

        profile = pool.get('SELECT * FROM profile WHERE id = ?', { id: profileId });
      }

      if (profile.is_blocked === '1') {
        throw new RpcError('restriction', 'profile-blocked', 'Profile is blocked');
      }

      if (invitationToken) {
        return { invitationToken };
      }

      const sessionResult = await createSession(pool, profile.id);
      return {
        ...stripPrivateAttrs(profile),
        authToken: sessionResult.token,
      };
    },
  });
}

async function authenticateLdap(ldapUrl, email, password) {
  const ldapBaseDn = process.env.PENPOT_LDAP_BASE_DN || 'ou=users,dc=example,dc=com';
  const ldapBindDn = process.env.PENPOT_LDAP_BIND_DN || '';
  const ldapBindPassword = process.env.PENPOT_LDAP_BIND_PASSWORD || '';
  const ldapAttrUsername = process.env.PENPOT_LDAP_ATTR_USERNAME || 'uid';
  const ldapAttrDisplayName = process.env.PENPOT_LDAP_ATTR_DISPLAYNAME || 'cn';

  let ldap;
  try {
    ldap = await import('ldapjs');
  } catch {
    throw new Error('ldapjs module not available');
  }

  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: ldapUrl });

    if (ldapBindDn) {
      client.bind(ldapBindDn, ldapBindPassword, (err) => {
        if (err) { client.destroy(); return reject(err); }
        searchAndBind(client, email, password, ldapBaseDn, ldapAttrUsername, ldapAttrDisplayName, resolve, reject);
      });
    } else {
      searchAndBind(client, email, password, ldapBaseDn, ldapAttrUsername, ldapAttrDisplayName, resolve, reject);
    }
  });
}

function searchAndBind(client, email, password, baseDn, attrUsername, attrDisplayName, resolve, reject) {
  const filter = `(|(${attrUsername}=${email})(mail=${email}))`;

  client.search(baseDn, { filter, scope: 'sub' }, (err, res) => {
    if (err) { client.destroy(); return reject(err); }

    const entries = [];
    res.on('searchEntry', (entry) => entries.push(entry.pojo));
    res.on('error', (err) => { client.destroy(); reject(err); });
    res.on('end', () => {
      if (entries.length === 0) { client.destroy(); return resolve(null); }

      const entry = entries[0];
      const dn = entry.dn;
      const displayName = (entry.attributes || []).find(a => a.type === attrDisplayName)?.values?.[0] || email.split('@')[0];

      client.bind(dn, password, (err) => {
        client.destroy();
        if (err) return resolve(null);
        resolve({ dn, displayName, email });
      });
    });
  });
}