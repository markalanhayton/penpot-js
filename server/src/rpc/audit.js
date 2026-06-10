'use strict';
/**
 * @module rpc/audit
 * @description Audit log RPC commands — mirrors `app.rpc.commands.audit` from the Clojure backend.
 *
 * | Method              | Auth | Since | Notes |
 * |---------------------|:----:|-------|-------|
 * | `push-audit-events` | Yes  | 1.17  | Bulk insert audit events |
 * | `get-enabled-flags` | No   | 1.17  | Public feature flag map |
 * | `get-audit-events`  | Yes  | 2.17  | Query archived + unarchived events with filters |
 */

import { v4 as uuidv4 } from 'uuid';
import { flagEnabled, mergedFlags } from '../config/index.js';
import { rowToCamel } from '../db/sqlite.js';

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

const AUDIT_PAGE_DEFAULT = 50;
const AUDIT_PAGE_MAX = 200;

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

  /**
   * Query audit log events with pagination and filters.
   *
   * Filters:
   *   - `profileId`  exact match on profile_id
   *   - `eventType`   exact match on type column
   *   - `eventName`   exact match on name column
   *   - `source`      exact match on source column
   *   - `teamId`      match via team_profile_rel (events from members of the given team)
   *   - `from`        ISO timestamp lower-bound (inclusive) on tracked_at
   *   - `to`          ISO timestamp upper-bound (exclusive) on tracked_at
   *   - `includeArchived`  when true, also returns archived events (default false)
   *   - `limit`       page size (default 50, max 200)
   *   - `offset`      pagination offset (default 0)
   *
   * Returns `{ events: [...], total: <number> }` where `total` is the
   * unfiltered-by-pagination count of rows matching the filters. Each
   * event is camelCased and includes parsed `props`/`context` JSON.
   */
  register('get-audit-events', {
    auth: true,
    added: '2.17',
    handler: async (params, _ctx) => {
      const auditEnabled = flagEnabled('audit-log');
      if (!auditEnabled) {
        return { events: [], total: 0 };
      }

      const {
        profileId,
        eventType,
        eventName,
        source,
        teamId,
        from,
        to,
        includeArchived = false,
        limit: rawLimit = AUDIT_PAGE_DEFAULT,
        offset: rawOffset = 0,
      } = params || {};

      const limit = Math.max(1, Math.min(AUDIT_PAGE_MAX, Number(rawLimit) || AUDIT_PAGE_DEFAULT));
      const offset = Math.max(0, Number(rawOffset) || 0);

      // Build WHERE clause from filters
      const where = [];
      const args = [];

      if (!includeArchived) where.push('archived_at IS NULL');
      if (profileId) { where.push('profile_id = ?'); args.push(profileId); }
      if (eventType) { where.push('type = ?'); args.push(eventType); }
      if (eventName) { where.push('name = ?'); args.push(eventName); }
      if (source) { where.push('source = ?'); args.push(source); }
      if (from) { where.push('tracked_at >= ?'); args.push(from); }
      if (to) { where.push('tracked_at < ?'); args.push(to); }

      // If filtering by teamId, restrict to events emitted by members of that team
      if (teamId) {
        where.push(`profile_id IN (SELECT profile_id FROM team_profile_rel WHERE team_id = ? AND deleted_at IS NULL)`);
        args.push(teamId);
      }

      const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

      const totalRow = pool.get(
        `SELECT COUNT(*) AS n FROM audit_log ${whereSql}`,
        args
      );
      const total = totalRow ? totalRow.n : 0;

      const pageArgs = [...args, limit, offset];
      const rows = pool.query(
        `SELECT * FROM audit_log ${whereSql}
         ORDER BY tracked_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        pageArgs
      );

      const events = (rows || []).map((row) => {
        const event = rowToCamel(row);
        if (event.props) {
          try { event.props = JSON.parse(event.props); } catch { /* keep as string */ }
        }
        if (event.context) {
          try { event.context = JSON.parse(event.context); } catch { /* keep as string */ }
        }
        return event;
      });

      return { events, total };
    },
  });
}