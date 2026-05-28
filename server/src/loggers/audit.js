'use strict';
/**
 * @module loggers/audit
 * @description Audit logging — mirrors `app.loggers.audit` from the Clojure backend.
 *
 * Provides structured audit event logging to the database, with optional
 * archival to an external service and garbage collection of archived events.
 *
 * ### Flow
 *
 * 1. RPC handlers call `submit(pool, event)` to record audit events
 * 2. `archiveTask` periodically sends unarchived events to an external URI
 * 3. `gcTask` deletes archived events older than the retention period
 *
 * ### Supported event types
 *
 * | Type           | Description                              |
 * |----------------|------------------------------------------|
 * | login          | User authentication events               |
 * | logout         | Session termination events               |
 * | register       | New account creation                     |
 * | update-profile | Profile changes                          |
 * | create-project | Project creation                         |
 * | delete-project | Project deletion                        |
 * | create-file    | File creation                            |
 * | delete-file    | File deletion                            |
 * | update-file    | File content modifications               |
 * | create-team    | Team creation                            |
 * | update-team    | Team settings changes                    |
 * | delete-team    | Team deletion                            |
 * | invite-member  | Team invitation sent                    |
 * | remove-member  | Team member removed                     |
 * | custom         | Any custom event type                    |
 *
 * ### Usage
 *
 * ```js
 * import { submit } from './loggers/audit.js';
 * await submit(pool, { type: 'login', profileId: 'abc-123', ipAddr: '127.0.0.1' });
 * ```
 */

import crypto from 'node:crypto';
import { config } from '../config/index.js';

/**
 * Submit an audit event to the database.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {{
 *   type: string,
 *   profileId?: string|null,
 *   ipAddr?: string,
 *   userAgent?: string,
 *   [key: string]: *
 * }} event - The audit event data.
 * @returns {Promise<void>}
 */
export async function submit(pool, event) {
  try {
    pool.insert('audit_log', {
      id: crypto.randomUUID(),
      type: event.type || 'custom',
      name: event.name || '',
      profile_id: event.profileId,
      ip_addr: event.ipAddr || null,
      props: pool.jsonWrite(event.data || {}),
      created_at: new Date().toISOString(),
      tracked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[audit] Failed to submit event:', err.message);
  }
}

/**
 * Submit an audit event derived from RPC command parameters.
 *
 * Extracts profile ID, IP address, and user agent from the RPC context
 * and merges them with the event data.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} type - Event type (e.g. 'update-file').
 * @param {object} params - RPC request parameters.
 * @param {object} ctx - RPC context (contains profileId, ipAddr, userAgent).
 * @param {object} [extra={}] - Additional event data.
 * @returns {Promise<void>}
 */
export async function submitFromRpc(pool, type, params, ctx, extra = {}) {
  await submit(pool, {
    type,
    profileId: ctx.profileId || null,
    ipAddr: ctx.ipAddr || null,
    userAgent: ctx.userAgent || null,
    data: {
      ...extra,
    },
  });
}

/**
 * Archive audit events to an external service.
 *
 * Sends batches of unarchived events as Transit+JSON to the configured
 * archive URI (`PENPOT_AUDIT_LOG_ARCHIVE_URI`). Events are marked as
 * archived after successful delivery.
 *
 * This is the handler for the `audit-log-archive` scheduled task.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @returns {Promise<number>} Number of events archived.
 */
export async function archiveTask(pool) {
  const archiveUri = process.env.PENPOT_AUDIT_LOG_ARCHIVE_URI;
  if (!archiveUri) return 0;

  const sharedKey = process.env.PENPOT_AUDIT_LOG_ARCHIVE_SHARED_KEY || '';
  const CHUNK_SIZE = 128;
  let archived = 0;

  while (true) {
    const rows = pool.query(
          `SELECT id, type, profile_id, ip_addr, props, context, created_at
       FROM audit_log
       WHERE archived_at IS NULL
       ORDER BY created_at ASC
       LIMIT ?`,
      [CHUNK_SIZE]
    );

    if (rows.length === 0) break;

    try {
      const response = await fetch(archiveUri, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shared-Key': sharedKey,
        },
        body: JSON.stringify(rows),
      });

      if (response.status === 204 || response.status === 200) {
        const ids = rows.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');
        pool.run(
          `UPDATE audit_log SET archived_at = datetime('now') WHERE id IN (${placeholders})`,
          ids
        );
        archived += rows.length;
      } else {
        console.error(`[audit] Archive failed: HTTP ${response.status}`);
        break;
      }
    } catch (err) {
      console.error('[audit] Archive request failed:', err.message);
      break;
    }

    if (rows.length < CHUNK_SIZE) break;

    // Small delay between chunks to avoid overwhelming
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (archived > 0) {
    console.log(`[audit] Archived ${archived} events`);
  }

  return archived;
}

/**
 * Garbage-collect archived audit events.
 *
 * Deletes all rows from `audit_log` where `archived_at IS NOT NULL`,
 * i.e. events that have already been archived to the external service.
 *
 * This is the handler for the `audit-log-gc` scheduled task.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @returns {Promise<number>} Number of events deleted.
 */
export async function gcTask(pool) {
  const result = pool.run(
    `DELETE FROM audit_log WHERE archived_at IS NOT NULL`
  );
  const deleted = result.changes || 0;
  if (deleted > 0) {
    console.log(`[audit] GC deleted ${deleted} archived events`);
  }
  return deleted;
}