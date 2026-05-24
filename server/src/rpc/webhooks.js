/**
 * @module rpc/webhooks
 * @description Webhook RPC commands — mirrors `app.rpc.commands.webhooks` from the Clojure backend.
 *
 * | Method           | Auth | Since |
 * |------------------|:----:|-------|
 * | `create-webhook` | Yes  | 1.17  |
 * | `update-webhook` | Yes  | 1.17  |
 * | `delete-webhook` | Yes  | 1.17  |
 * | `get-webhooks`   | Yes  | 1.17  |
 */

import { v4 as uuidv4 } from 'uuid';
import { RpcError } from './dispatcher.js';
import { flagEnabled } from '../config/index.js';

const MAX_WEBHOOKS_PER_TEAM = 8;
const VALID_MTYPES = ['application/json', 'application/transit+json'];

function checkWebhookEditionPermissions(pool, profileId, teamId) {
  const rel = pool.get(
    `SELECT is_owner, is_admin FROM team_profile_rel WHERE team_id = ? AND profile_id = ?`,
    [teamId, profileId]
  );
  if (!rel || (rel.is_owner !== '1' && rel.is_admin !== '1')) {
    throw new RpcError('authorization', 'access-denied', 'Only team owners or admins can manage webhooks');
  }
}

function checkReadPermissions(pool, profileId, teamId) {
  const rel = pool.get(
    `SELECT profile_id FROM team_profile_rel WHERE team_id = ? AND profile_id = ?`,
    [teamId, profileId]
  );
  if (!rel) {
    throw new RpcError('authorization', 'access-denied', 'Not a team member');
  }
}

export default function registerWebhooksCommands(register, pool) {
  register('create-webhook', {
    auth: true,
    added: '1.17',
    handler: async (params, ctx) => {
      const { teamId, uri, mtype } = params;

      checkWebhookEditionPermissions(pool, ctx.profileId, teamId);

      if (!uri || !VALID_MTYPES.includes(mtype)) {
        throw new RpcError('validation', 'validation-error', 'Invalid URI or media type');
      }

      const countRow = pool.get('SELECT count(*) as total FROM webhook WHERE team_id = ?', [teamId]);
      if (countRow.total >= MAX_WEBHOOKS_PER_TEAM) {
        throw new RpcError('restriction', 'webhooks-quote-reached', 'Maximum number of webhooks reached');
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      pool.insertOnConflictDoNothing('webhook', {
        id,
        team_id: teamId,
        uri,
        mtype: mtype || 'application/json',
        is_active: '1',
        profile_id: ctx.profileId,
        created_at: now,
      });

      return { id, teamId, uri, mtype, isActive: true };
    },
  });

  register('update-webhook', {
    auth: true,
    added: '1.17',
    handler: async (params, ctx) => {
      const { id, uri, mtype, isActive } = params;

      const webhook = pool.get('SELECT * FROM webhook WHERE id = ?', { id });
      if (!webhook) {
        throw new RpcError('not-found', 'object-not-found', 'Webhook not found');
      }

      checkWebhookEditionPermissions(pool, ctx.profileId, webhook.team_id);

      const updates = {};
      if (uri !== undefined) updates.uri = uri;
      if (mtype !== undefined) {
        if (!VALID_MTYPES.includes(mtype)) {
          throw new RpcError('validation', 'validation-error', 'Invalid media type');
        }
        updates.mtype = mtype;
      }
      if (isActive !== undefined) updates.is_active = isActive ? '1' : '0';

      if (Object.keys(updates).length > 0) {
        const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), id];
        pool.run(`UPDATE webhook SET ${setClauses}, error_code = NULL, error_count = 0 WHERE id = ?`, values);
      }

      return { id, teamId: webhook.team_id, uri: updates.uri || webhook.uri, mtype: updates.mtype || webhook.mtype, isActive: updates.is_active !== undefined ? updates.is_active === '1' : Boolean(webhook.is_active === '1') };
    },
  });

  register('delete-webhook', {
    auth: true,
    added: '1.17',
    handler: async (params, ctx) => {
      const { id } = params;

      const webhook = pool.get('SELECT * FROM webhook WHERE id = ?', { id });
      if (!webhook) {
        throw new RpcError('not-found', 'object-not-found', 'Webhook not found');
      }

      checkWebhookEditionPermissions(pool, ctx.profileId, webhook.team_id);

      pool.run('DELETE FROM webhook WHERE id = ?', [id]);
      return null;
    },
  });

  register('get-webhooks', {
    auth: true,
    added: '1.17',
    handler: async (params, ctx) => {
      const { teamId } = params;

      checkReadPermissions(pool, ctx.profileId, teamId);

      const rows = pool.query(
        `SELECT id, uri, mtype, is_active, error_code, error_count, profile_id
         FROM webhook WHERE team_id = ? ORDER BY uri`,
        [teamId]
      );

      return rows.map(row => ({
        id: row.id,
        teamId: row.team_id,
        uri: row.uri,
        mtype: row.mtype,
        isActive: row.is_active === '1',
        errorCode: row.error_code,
        errorCount: row.error_count,
        profileId: row.profile_id,
      }));
    },
  });
}

/**
 * Look up active webhooks for a team and submit delivery tasks.
 *
 * Call this from RPC command handlers that declare webhook events.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {object} event - The webhook event payload (e.g. file creation, team change).
 * @param {string} event.teamId - The team whose webhooks to deliver to.
 * @param {string} event.name - The event name (e.g. 'create-file').
 * @param {string} [event.profileId] - Profile that triggered the event.
 * @param {object} [event.props] - Additional event properties.
 */
export async function triggerWebhooks(pool, event) {
  if (!flagEnabled('webhooks')) return;
  if (!event.teamId) return;

  const { submitTask } = await import('../tasks/worker.js');

  const webhooks = pool.query(
    "SELECT id FROM webhook WHERE team_id = ? AND is_active = '1'",
    [event.teamId]
  );

  for (const webhook of webhooks) {
    submitTask('deliver-webhook', {
      webhookId: webhook.id,
      event: {
        id: crypto.randomUUID(),
        name: event.name,
        profileId: event.profileId || null,
        teamId: event.teamId,
        props: event.props || {},
        createdAt: new Date().toISOString(),
      },
    }, pool, { maxRetries: 3 });
  }
}