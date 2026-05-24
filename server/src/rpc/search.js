/**
 * @module rpc/search
 * @description File search RPC command — mirrors `app.rpc.commands.search` from the Clojure backend.
 *
 * Uses FTS5 full-text search for fast file name matching, falling back to
 * LIKE queries if FTS5 is unavailable. The Clojure backend uses PostgreSQL
 * `ILIKE '%term%'`, which is slow at scale. FTS5 supports prefix queries
 * ("design*"), phrase queries, and boolean operators.
 *
 * | Method         | Auth | Since |
 * |----------------|:----:|-------|
 * | `search-files` | Yes  | 1.17  |
 */

import { RpcError } from './dispatcher.js';

function checkReadPermissions(pool, profileId, teamId) {
  const team = pool.get(
    `SELECT id FROM team_profile_rel WHERE team_id = ? AND profile_id = ?`,
    [teamId, profileId]
  );
  if (!team) {
    throw new RpcError('authorization', 'access-denied', 'Not a team member');
  }
}

/**
 * Search files using FTS5 full-text search.
 * Falls back to LIKE if FTS5 table doesn't exist.
 */
export default function registerSearchCommands(register, pool) {
  register('search-files', {
    auth: true,
    added: '1.17',
    handler: async (params, ctx) => {
      const { teamId, searchTerm } = params;

      if (!searchTerm || searchTerm.trim().length === 0) {
        return [];
      }

      checkReadPermissions(pool, ctx.profileId, teamId);

      const trimmed = searchTerm.trim();

      // Try FTS5 search first, fall back to LIKE
      const results = searchWithFTS5(pool, ctx.profileId, teamId, trimmed)
        || searchWithLike(pool, ctx.profileId, teamId, trimmed);

      return results.map(row => ({
        id: row.id,
        revn: row.revn || 0,
        projectId: row.project_id,
        createdAt: row.created_at,
        modifiedAt: row.modified_at,
        name: row.name,
        isShared: row.is_shared === '1',
        thumbnailId: row.media_id || null,
      }));
    },
  });

  /**
   * Rebuild the FTS5 search index from the file table.
   * Called after bulk operations that bypass triggers.
   */
  register('search-rebuild-index', {
    auth: true,
    added: '1.17',
    handler: async (_params, _ctx) => {
      rebuildSearchIndex(pool);
      return { ok: true };
    },
  });
}

/**
 * Search files using FTS5 MATCH.
 * Returns null if FTS5 table doesn't exist (not yet migrated).
 */
function searchWithFTS5(pool, profileId, teamId, searchTerm) {
  try {
    // Build FTS5 query — use prefix matching for partial words
    // e.g. "des" matches "design", "desktop", etc.
    const ftsQuery = `"${searchTerm}" OR ${searchTerm}*`;

    return pool.query(
      `SELECT DISTINCT f.id, f.revn, f.project_id, f.created_at, f.modified_at,
              f.name, f.is_shared, ft.media_id
       FROM file_search AS fs
       INNER JOIN file AS f ON (f.id = fs.file_id)
       LEFT JOIN file_thumbnail AS ft ON (ft.file_id = f.id AND ft.revn = f.revn)
       INNER JOIN (
         SELECT p.id FROM project AS p
           INNER JOIN team_profile_rel AS tpr ON (tpr.team_id = p.team_id)
          WHERE tpr.profile_id = ? AND p.team_id = ?
            AND p.deleted_at IS NULL
            AND (tpr.is_admin = '1' OR tpr.is_owner = '1' OR tpr.can_edit = '1')
         UNION
         SELECT p.id FROM project AS p
           INNER JOIN project_profile_rel AS ppr ON (ppr.project_id = p.id)
          WHERE ppr.profile_id = ? AND p.team_id = ?
            AND p.deleted_at IS NULL
            AND (ppr.is_admin = '1' OR ppr.is_owner = '1' OR ppr.can_edit = '1')
       ) AS pr ON (f.project_id = pr.id)
       WHERE fs.file_search MATCH ?
         AND f.deleted_at IS NULL
       ORDER BY f.created_at ASC`,
      [profileId, teamId, profileId, teamId, ftsQuery]
    );
  } catch (err) {
    // FTS5 table doesn't exist yet — fall back to LIKE
    if (err.message && err.message.includes('no such table')) {
      return null;
    }
    // Other errors (bad FTS syntax, etc.) — fall back to LIKE
    return null;
  }
}

/**
 * Search files using LIKE (fallback / original method).
 * This mirrors the Clojure backend's ILIKE approach.
 */
function searchWithLike(pool, profileId, teamId, searchTerm) {
  const pattern = `%${searchTerm}%`;

  return pool.query(
    `SELECT DISTINCT f.id, f.revn, f.project_id, f.created_at, f.modified_at,
            f.name, f.is_shared, ft.media_id
     FROM file AS f
     LEFT JOIN file_thumbnail AS ft ON (ft.file_id = f.id AND ft.revn = f.revn)
     INNER JOIN (
       SELECT p.id FROM project AS p
         INNER JOIN team_profile_rel AS tpr ON (tpr.team_id = p.team_id)
        WHERE tpr.profile_id = ? AND p.team_id = ?
          AND p.deleted_at IS NULL
          AND (tpr.is_admin = '1' OR tpr.is_owner = '1' OR tpr.can_edit = '1')
       UNION
       SELECT p.id FROM project AS p
         INNER JOIN project_profile_rel AS ppr ON (ppr.project_id = p.id)
        WHERE ppr.profile_id = ? AND p.team_id = ?
          AND p.deleted_at IS NULL
          AND (ppr.is_admin = '1' OR ppr.is_owner = '1' OR ppr.can_edit = '1')
     ) AS pr ON (f.project_id = pr.id)
     WHERE f.name LIKE ? AND f.deleted_at IS NULL
     ORDER BY f.created_at ASC`,
    [profileId, teamId, profileId, teamId, pattern]
  );
}

/**
 * Rebuild the FTS5 search index from scratch.
 * Call this after bulk imports or if the index gets out of sync.
 */
export function rebuildSearchIndex(pool) {
  try {
    pool.db.prepare('DELETE FROM file_search').run();
    pool.db.prepare(
      `INSERT INTO file_search (file_id, name)
       SELECT id, name FROM file WHERE deleted_at IS NULL`
    ).run();
  } catch (err) {
    if (err.message && err.message.includes('no such table')) {
      // FTS5 not yet migrated — skip silently
      return;
    }
    throw err;
  }
}