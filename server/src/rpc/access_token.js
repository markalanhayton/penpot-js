/**
 * @module rpc/access_token
 * @description Access token (personal API token) RPC commands — mirrors
 * `app.rpc.commands.access-token` from the Clojure backend.
 *
 * Access tokens allow long-lived API authentication without session cookies,
 * similar to GitHub personal access tokens. Tokens are prefixed with `ptpat_`.
 *
 * ### Method summary
 *
 * | Method                 | Auth required | Since |
 * |------------------------|:-------------:|-------|
 * | `create-access-token` | Yes           | v1.18 |
 * | `delete-access-token` | Yes           | v1.18 |
 * | `get-access-tokens`   | Yes           | v1.18 |
 * | `get-current-mcp-token` | Yes        | v2.15 |
 * | `get-api-tokens`      | Yes           | v2.16 |
 */

import { v4 as uuidv4 } from 'uuid';
import { rowToCamel, rowsToCamel } from '../db/sqlite.js';

/**
 * Register all access-token-related RPC commands.
 *
 * @param {function(string, import('./dispatcher.js').RpcMethodDefinition): void} register - Method registration callback.
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 */
export default function registerAccessTokenCommands(register, pool) {

  register('create-access-token', {
    auth: true,
    added: '1.18',
    async handler(params, ctx) {
      const id = uuidv4();
      const token = `ptpat_${uuidv4()}_${uuidv4()}`;
      const now = new Date().toISOString();
      const perms = params.perms || ['read'];
      const scopes = params.scopes || [];
      const type = params.type || 'personal';
      const expiresAt = params.expiration || null;

      const row = pool.insertReturning('access_token', {
        id,
        profile_id: ctx.profileId,
        name: params.name,
        token,
        type,
        perms: JSON.stringify(perms),
        scopes: JSON.stringify(scopes),
        created_at: now,
        updated_at: now,
        expires_at: expiresAt,
      });

      const result = rowToCamel(row);
      try { result.perms = JSON.parse(result.perms); } catch { result.perms = []; }
      try { result.scopes = JSON.parse(result.scopes); } catch { result.scopes = []; }
      return result;
    }
  });

  register('delete-access-token', {
    auth: true,
    added: '1.18',
    async handler(params) {
      pool.deleteFrom('access_token', { id: params.id });
      return { id: params.id };
    }
  });

  register('get-access-tokens', {
    auth: true,
    added: '1.18',
    async handler(params, ctx) {
      const rows = pool.query(
        'SELECT id, name, perms, type, scopes, created_at, updated_at, expires_at FROM access_token WHERE profile_id = @profileId ORDER BY expires_at ASC, created_at ASC',
        { profileId: ctx.profileId }
      );
      const result = rowsToCamel(rows);
      for (const row of result) {
        delete row.perms;
        delete row.scopes;
      }
      return result;
    }
  });

  register('get-current-mcp-token', {
    auth: true,
    added: '2.15',
    async handler(params, ctx) {
      // Return a token suitable for MCP server authentication
      const id = uuidv4();
      const token = `ptpat_mcp_${uuidv4()}`;
      const now = new Date().toISOString();

      pool.insertReturning('access_token', {
        id,
        profile_id: ctx.profileId,
        name: 'mcp-token',
        type: 'mcp',
        token,
        perms: JSON.stringify(['read', 'write']),
        scopes: JSON.stringify([]),
        created_at: now,
        updated_at: now,
      });

      return { id, token, name: 'mcp-token', perms: ['read', 'write'] };
    }
  });

  register('get-api-tokens', {
    auth: true,
    added: '2.16',
    async handler(params, ctx) {
      const rows = pool.query(
        'SELECT id, name, type, scopes, created_at, updated_at, expires_at FROM access_token WHERE profile_id = @profileId AND type = @type ORDER BY created_at DESC',
        { profileId: ctx.profileId, type: 'api' }
      );
      const result = rowsToCamel(rows);
      for (const row of result) {
        let parsedScopes = [];
        try {
          parsedScopes = JSON.parse(row.scopes || '[]');
        } catch {
          parsedScopes = [];
        }
        row.scopes = parsedScopes;
      }
      return result;
    }
  });
}