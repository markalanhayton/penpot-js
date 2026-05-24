/**
 * @module middleware/permissions
 * @description Permission checking utilities — mirrors `app.rpc.permissions`
 * from the Clojure backend.
 *
 * Provides helper functions for checking team/file membership roles. Roles map
 * to a set of boolean flags:
 *
 * | Role    | isOwner | isAdmin | canEdit | canRead |
 * |---------|:-------:|:-------:|:-------:|:-------:|
 * | owner   | true    | true    | true    | true    |
 * | admin   | false   | true    | true    | true    |
 * | editor  | false   | false   | true    | true    |
 * | viewer  | false   | false   | false   | true    |
 *
 * Usage from RPC handlers:
 *
 * ```js
 * import { checkReadPermissions, checkEditionPermissions, checkAdminPermissions } from '../middleware/permissions.js';
 *
 * register('my-method', {
 *   auth: true,
 *   async handler(params, ctx) {
 *     checkReadPermissions(pool, ctx.profileId, params.fileId);
 *     // ... proceed with read access
 *   },
 * });
 * ```
 */

import { RpcError } from '../rpc/dispatcher.js';

/**
 * Valid membership roles and their permission flag mappings.
 *
 * @type {Record<string, { isOwner: boolean, isAdmin: boolean, canEdit: boolean, canRead: boolean }>}
 */
export const ROLE_FLAGS = {
  owner:  { isOwner: true,  isAdmin: true,  canEdit: true,  canRead: true  },
  admin:  { isOwner: false, isAdmin: true,  canEdit: true,  canRead: true  },
  editor: { isOwner: false, isAdmin: false, canEdit: true,  canRead: true  },
  viewer: { isOwner: false, isAdmin: false, canEdit: false, canRead: true  },
};

/**
 * Assign role flags to a params object based on a role string.
 *
 * @param {Record<string, *>} params - Params object to merge flags into.
 * @param {string} role - Role name (`'owner'`, `'admin'`, `'editor'`, `'viewer'`).
 * @returns {Record<string, *>} Params with `isOwner`, `isAdmin`, `canEdit`, `canRead` flags.
 */
export function assignRoleFlags(params, role) {
  const flags = ROLE_FLAGS[role] || ROLE_FLAGS.viewer;
  return { ...params, ...flags };
}

/**
 * Build WHERE-clause fragments for permission checks.
 * These use the team_profile_rel table to verify membership.
 */

/**
 * Check that a profile has read access to a file (is a member of the file's team).
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - The profile UUID.
 * @param {string} fileId - The file UUID.
 * @returns {{ type: string, isOwner: boolean, isAdmin: boolean, canEdit: boolean, canRead: boolean }}
 * @throws {RpcError} If the profile has no read access.
 */
export function checkReadPermissions(pool, profileId, fileId) {
  const rel = pool.get(
    `SELECT tpr.is_owner, tpr.is_admin, tpr.can_edit, tpr.is_member
     FROM team_profile_rel tpr
     JOIN project p ON p.team_id = tpr.team_id
     JOIN file f ON f.project_id = p.id
     WHERE f.id = ? AND tpr.profile_id = ? AND f.deleted_at IS NULL`,
    [fileId, profileId]
  );

  if (!rel || rel.is_member !== '1') {
    throw new RpcError('authorization', 'access-denied', 'You do not have read access to this file');
  }

  return {
    type: 'membership',
    isOwner: rel.is_owner === '1',
    isAdmin: rel.is_admin === '1',
    canEdit: rel.can_edit === '1',
    canRead: true,
  };
}

/**
 * Check that a profile has edit access to a file (can_edit or is admin/owner).
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - The profile UUID.
 * @param {string} fileId - The file UUID.
 * @returns {{ type: string, isOwner: boolean, isAdmin: boolean, canEdit: boolean, canRead: boolean }}
 * @throws {RpcError} If the profile has no edit access.
 */
export function checkEditionPermissions(pool, profileId, fileId) {
  const perms = checkReadPermissions(pool, profileId, fileId);
  if (!perms.canEdit && !perms.isOwner && !perms.isAdmin) {
    throw new RpcError('authorization', 'access-denied', 'You do not have edit access to this file');
  }
  return perms;
}

/**
 * Check that a profile has admin access to a file (is_admin or is_owner).
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - The profile UUID.
 * @param {string} fileId - The file UUID.
 * @returns {{ type: string, isOwner: boolean, isAdmin: boolean, canEdit: boolean, canRead: boolean }}
 * @throws {RpcError} If the profile has no admin access.
 */
export function checkAdminPermissions(pool, profileId, fileId) {
  const perms = checkReadPermissions(pool, profileId, fileId);
  if (!perms.isOwner && !perms.isAdmin) {
    throw new RpcError('authorization', 'access-denied', 'Admin access required');
  }
  return perms;
}

/**
 * Check that a profile has read access to a project.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - The profile UUID.
 * @param {string} projectId - The project UUID.
 * @returns {{ type: string, isOwner: boolean, isAdmin: boolean, canEdit: boolean, canRead: boolean }}
 * @throws {RpcError} If the profile has no access.
 */
export function checkProjectReadPermissions(pool, profileId, projectId) {
  const rel = pool.get(
    `SELECT tpr.is_owner, tpr.is_admin, tpr.can_edit, tpr.is_member
     FROM team_profile_rel tpr
     JOIN project p ON p.team_id = tpr.team_id
     WHERE p.id = ? AND tpr.profile_id = ?`,
    [projectId, profileId]
  );

  if (!rel || rel.is_member !== '1') {
    throw new RpcError('authorization', 'access-denied', 'You do not have access to this project');
  }

  return {
    type: 'membership',
    isOwner: rel.is_owner === '1',
    isAdmin: rel.is_admin === '1',
    canEdit: rel.can_edit === '1',
    canRead: true,
  };
}

/**
 * Check that a profile has edit access to a project.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - The profile UUID.
 * @param {string} projectId - The project UUID.
 * @throws {RpcError} If the profile has no edit access.
 */
export function checkProjectEditionPermissions(pool, profileId, projectId) {
  const perms = checkProjectReadPermissions(pool, profileId, projectId);
  if (!perms.canEdit && !perms.isOwner && !perms.isAdmin) {
    throw new RpcError('authorization', 'access-denied', 'You do not have edit access to this project');
  }
  return perms;
}

/**
 * Check that a profile has admin access to a team.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - The profile UUID.
 * @param {string} teamId - The team UUID.
 * @returns {{ isOwner: boolean, isAdmin: boolean }}
 * @throws {RpcError} If the profile has no admin access.
 */
export function checkTeamAdmin(pool, profileId, teamId) {
  const rel = pool.get(
    `SELECT is_owner, is_admin FROM team_profile_rel WHERE team_id = ? AND profile_id = ?`,
    [teamId, profileId]
  );

  if (!rel || (rel.is_owner !== '1' && rel.is_admin !== '1')) {
    throw new RpcError('authorization', 'access-denied', 'Team admin access required');
  }

  return { isOwner: rel.is_owner === '1', isAdmin: rel.is_admin === '1' };
}