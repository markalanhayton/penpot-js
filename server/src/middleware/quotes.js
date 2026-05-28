'use strict';
/**
 * @module middleware/quotes
 * @description Resource usage quota/limit checking — mirrors `app.rpc.quotes`
 * from the Clojure backend.
 *
 * Enforces configurable limits on resources per team, project, or profile.
 * Each quota type counts current usage from the database and compares against
 * a configured maximum. If exceeded, an error is raised (hard limit) or a
 * notification is sent (soft limit).
 *
 * ### Environment variables
 *
 * Quotas are configured via `PENPOT_FLAGS` using `enable-quotes` /
 * `disable-quotes` and `enable-soft-quotes` / `disable-soft-quotes`.
 *
 * Individual quota limits come from the `usage_quote` database table,
 * which allows per-profile, per-team, per-project, and per-file overrides.
 *
 * ### Supported quota IDs
 *
 * | ID                              | Scope          | Counted resource            |
 * |---------------------------------|----------------|-----------------------------|
 * | `teams-per-profile`            | profile        | teams the profile belongs to |
 * | `access-tokens-per-profile`    | profile        | active access tokens        |
 * | `projects-per-team`            | profile + team | non-deleted projects        |
 * | `font-variants-per-team`       | profile + team | font variants               |
 * | `invitations-per-team`         | profile + team | team invitations             |
 * | `profiles-per-team`            | profile + team | team members + invitations  |
 * | `files-per-project`            | profile + team + project | non-deleted files |
 * | `members-per-team`             | profile + team | team members                |
 *
 * ### Default limits
 *
 * All defaults can be overridden by rows in the `usage_quote` table.
 * If no row exists, the hard-coded defaults below are used.
 *
 * @example
 * import { checkQuota } from '../middleware/quotes.js';
 * await checkQuota(pool, 'files-per-project', { profileId, teamId, projectId }, 1);
 */

import { flagEnabled } from '../config/index.js';
import { RpcError } from '../rpc/dispatcher.js';

/** Default quota limits when no database override exists. */
const DEFAULT_LIMITS = {
  'teams-per-profile': 5,
  'access-tokens-per-profile': 25,
  'projects-per-team': 50,
  'font-variants-per-team': 100,
  'invitations-per-team': 50,
  'profiles-per-team': 100,
  'files-per-project': 500,
  'members-per-team': 100,
};

/**
 * SQL queries for counting current usage for each quota type.
 * Each query takes the relevant IDs as parameters and returns a single count.
 */
const QUOTA_QUERIES = {
  'teams-per-profile': {
    sql: 'SELECT COUNT(*) AS cnt FROM team_profile_rel WHERE profile_id = ? AND is_member = \'1\'',
    params: (ids) => [ids.profileId],
  },
  'access-tokens-per-profile': {
    sql: 'SELECT COUNT(*) AS cnt FROM access_token WHERE profile_id = ? AND (expires_at IS NULL OR expires_at > ?)',
    params: (ids) => [ids.profileId, new Date().toISOString()],
  },
  'projects-per-team': {
    sql: 'SELECT COUNT(*) AS cnt FROM project WHERE team_id = ? AND deleted_at IS NULL',
    params: (ids) => [ids.teamId],
  },
  'font-variants-per-team': {
    sql: 'SELECT COUNT(*) AS cnt FROM team_font_variant WHERE team_id = ? AND deleted_at IS NULL',
    params: (ids) => [ids.teamId],
  },
  'invitations-per-team': {
    sql: 'SELECT COUNT(*) AS cnt FROM team_invitation WHERE team_id = ?',
    params: (ids) => [ids.teamId],
  },
  'profiles-per-team': {
    sql: `SELECT
      (SELECT COUNT(*) FROM team_profile_rel WHERE team_id = ? AND is_member = '1')
      + (SELECT COUNT(*) FROM team_invitation WHERE team_id = ?) AS cnt`,
    params: (ids) => [ids.teamId, ids.teamId],
  },
  'files-per-project': {
    sql: 'SELECT COUNT(*) AS cnt FROM file WHERE project_id = ? AND deleted_at IS NULL',
    params: (ids) => [ids.projectId],
  },
  'members-per-team': {
    sql: 'SELECT COUNT(*) AS cnt FROM team_profile_rel WHERE team_id = ? AND is_member = \'1\'',
    params: (ids) => [ids.teamId],
  },
};

/**
 * Check a resource quota and raise an error if the limit is exceeded.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} quotaId - Quota type identifier (e.g. 'files-per-project').
 * @param {{ profileId?: string, teamId?: string, projectId?: string, fileId?: string }} ids
 *   - Context IDs needed for the quota check.
 * @param {number} [incr=1] - Number of additional items being added (default 1).
 * @throws {RpcError} If the quota is exceeded (hard limit).
 */
export function checkQuota(pool, quotaId, ids, incr = 1) {
  if (!flagEnabled('quotes')) return;

  const queryDef = QUOTA_QUERIES[quotaId];
  if (!queryDef) {
    throw new RpcError('internal', 'quote-not-defined', `Unknown quota type: ${quotaId}`);
  }

  const currentCount = pool.get(queryDef.sql, queryDef.params(ids));
  const current = currentCount?.cnt || 0;

  const limit = getQuotaLimit(pool, quotaId, ids);
  if (current + incr > limit) {
    throw new RpcError(
      'restriction',
      'max-quote-reached',
      `Quota exceeded: ${quotaId} (${current + incr}/${limit})`,
      { quoteId: quotaId, current, limit, requested: incr }
    );
  }
}

/**
 * Get the effective quota limit for a given quota type and context.
 * Checks database overrides first, then falls back to defaults.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} quotaId - Quota type identifier.
 * @param {{ profileId?: string, teamId?: string, projectId?: string }} ids - Context IDs.
 * @returns {number} The effective limit.
 */
function getQuotaLimit(pool, quotaId, ids) {
  const target = `quotes-${quotaId}`;
  const checks = [
    ids.profileId && { target, profileId: ids.profileId },
    ids.teamId && { target, teamId: ids.teamId },
    ids.projectId && { target, projectId: ids.projectId },
  ].filter(Boolean);

  for (const check of checks) {
    const row = pool.get(
      'SELECT quote FROM usage_quote WHERE target = ? AND ((profile_id = ? AND profile_id IS NOT NULL) OR (team_id = ? AND team_id IS NOT NULL) OR (project_id = ? AND project_id IS NOT NULL)) LIMIT 1',
      [check.target, check.profileId || null, check.teamId || null, check.projectId || null]
    );
    if (row && row.quote !== null && row.quote !== undefined) {
      return Number(row.quote);
    }
  }

  return DEFAULT_LIMITS[quotaId] || Infinity;
}

/**
 * Check that a team has not exceeded its member quota.
 * Convenience wrapper around checkQuota.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - Profile UUID.
 * @param {string} teamId - Team UUID.
 * @throws {RpcError} If the members quota is exceeded.
 */
export function checkMembersQuota(pool, profileId, teamId) {
  checkQuota(pool, 'members-per-team', { profileId, teamId });
}

/**
 * Check that a project has not exceeded its file count quota.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - Profile UUID.
 * @param {string} teamId - Team UUID.
 * @param {string} projectId - Project UUID.
 * @throws {RpcError} If the files quota is exceeded.
 */
export function checkFilesQuota(pool, profileId, teamId, projectId) {
  checkQuota(pool, 'files-per-project', { profileId, teamId, projectId });
}

/**
 * Check that a team has not exceeded its projects quota.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - Profile UUID.
 * @param {string} teamId - Team UUID.
 * @throws {RpcError} If the projects quota is exceeded.
 */
export function checkProjectsQuota(pool, profileId, teamId) {
  checkQuota(pool, 'projects-per-team', { profileId, teamId });
}