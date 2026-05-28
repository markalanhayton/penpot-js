'use strict';
/**
 * @module rpc/audit
 * @description Audit log RPC commands — mirrors `app.rpc.commands.audit` from the Clojure backend.
 *
 * | Method              | Auth | Since |
 * |---------------------|:----:|-------|
 * | `push-audit-events` | Yes  | 1.17  |
 * | `get-enabled-flags` | No   | 1.17  |
 */

import { v4 as uuidv4 } from 'uuid';
import { flagEnabled, mergedFlags } from '../config/index.js';

const AUDIT_FLAGS = new Set(['audit-log', 'telemetry']);

const PUBLIC_FLAGS = new Set([
  'registration',
  'login_with_password',
  'login_with_oidc',
  'login_with_google',
  'login_with_github',
  'login_with_gitlab',
  'oidc_registration',
  'onboarding',
  'access_tokens',
  'webhooks',
  'quotes',
  'telemetry',
  'audit-log',
]);

export default function registerAuditCommands(register, pool) {
  register('push-audit-events', {
    auth: true,
    added: '1.17',
    handler: async (params, ctx) => {
      const { events } = params;
      if (!events || !Array.isArray(events)) return null;

      const auditEnabled = flagEnabled('audit-log');
      const telemetryEnabled = flagEnabled('telemetry');
      if (!auditEnabled && !telemetryEnabled) return null;

      const rows = [];
      for (const event of events) {
        if (!event || !event.type || !event.name) continue;

        const row = [
          uuidv4(),
          event.name,
          event.source || 'frontend',
          event.type,
          event.trackedAt || ctx.requestAt.toISOString(),
          ctx.requestAt.toISOString(),
          ctx.profileId,
          ctx.ipAddr || null,
          event.props ? JSON.stringify(event.props) : null,
          event.context ? JSON.stringify(event.context) : null,
        ];
        rows.push(row);
      }

      if (rows.length > 0 && auditEnabled) {
        const stmt = pool.db.prepare(
          `INSERT INTO audit_log (id, name, source, type, tracked_at, created_at, profile_id, ip_addr, props, context)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const insertMany = pool.db.transaction((rows) => {
          for (const row of rows) stmt.run(...row);
        });
        try {
          insertMany(rows);
        } catch (err) {
          console.error('[audit] Error persisting audit events:', err.message);
        }
      }

      if (rows.length > 0 && telemetryEnabled) {
        const telRows = rows.map(([id, name, _source, type, trackedAt, createdAt, profileId, _ip, _props, _context]) => {
          const day = trackedAt.substring(0, 10);
          return [uuidv4(), name, 'telemetry:frontend', type, day, createdAt, profileId, null, null, null];
        });
        const stmt = pool.db.prepare(
          `INSERT INTO audit_log (id, name, source, type, tracked_at, created_at, profile_id, ip_addr, props, context)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const insertMany = pool.db.transaction((rows) => {
          for (const row of rows) stmt.run(...row);
        });
        try {
          insertMany(telRows);
        } catch (err) {
          console.error('[audit] Error persisting telemetry events:', err.message);
        }
      }

      return null;
    },
  });

  register('get-enabled-flags', {
    auth: false,
    added: '1.17',
    handler: async (_params, _ctx) => {
      const result = {};
      for (const [flag, enabled] of Object.entries(mergedFlags)) {
        if (PUBLIC_FLAGS.has(flag)) {
          result[flag] = enabled;
        }
      }
      return result;
    },
  });
}