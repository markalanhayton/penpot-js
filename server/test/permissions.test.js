import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { checkReadPermissions, checkEditionPermissions, checkAdminPermissions, checkProjectEditionPermissions, checkProjectReadPermissions, checkTeamAdmin, ROLE_FLAGS, assignRoleFlags } from '../src/middleware/permissions.js';
import { RpcError } from '../src/rpc/dispatcher.js';

describe('ROLE_FLAGS', () => {
  it('owner has all permissions', () => {
    const flags = ROLE_FLAGS.owner;
    assert.equal(flags.isOwner, true);
    assert.equal(flags.isAdmin, true);
    assert.equal(flags.canEdit, true);
    assert.equal(flags.canRead, true);
  });

  it('viewer has only read', () => {
    const flags = ROLE_FLAGS.viewer;
    assert.equal(flags.isOwner, false);
    assert.equal(flags.isAdmin, false);
    assert.equal(flags.canEdit, false);
    assert.equal(flags.canRead, true);
  });
});

describe('assignRoleFlags', () => {
  it('merges role flags into params', () => {
    const result = assignRoleFlags({ fileId: 'abc' }, 'admin');
    assert.equal(result.fileId, 'abc');
    assert.equal(result.isAdmin, true);
    assert.equal(result.isOwner, false);
  });

  it('defaults to viewer for unknown role', () => {
    const result = assignRoleFlags({}, 'nonexistent');
    assert.equal(result.canRead, true);
    assert.equal(result.canEdit, false);
  });
});

describe('checkReadPermissions', () => {
  let pool;
  let ids;

  beforeEach(() => { pool = createTestPool(); ids = seedFullHierarchy(pool); });
  afterEach(() => { destroyTestPool(pool); });

  it('allows read for team member', () => {
    const perms = checkReadPermissions(pool, ids.profileId, ids.fileId);
    assert.equal(perms.canRead, true);
  });

  it('throws for non-member', () => {
    assert.throws(() => checkReadPermissions(pool, 'nonexistent-profile', ids.fileId), RpcError);
  });
});

describe('checkEditionPermissions', () => {
  let pool;
  let ids;

  beforeEach(() => { pool = createTestPool(); ids = seedFullHierarchy(pool); });
  afterEach(() => { destroyTestPool(pool); });

  it('allows edit for member with can_edit', () => {
    const perms = checkEditionPermissions(pool, ids.profileId, ids.fileId);
    assert.equal(perms.canEdit, true);
  });
});

describe('checkProjectEditionPermissions', () => {
  let pool;
  let ids;

  beforeEach(() => { pool = createTestPool(); ids = seedFullHierarchy(pool); });
  afterEach(() => { destroyTestPool(pool); });

  it('returns team info for project member', () => {
    const perms = checkProjectEditionPermissions(pool, ids.profileId, ids.projectId);
    assert.equal(perms.canEdit, true);
  });

  it('throws for non-member', () => {
    assert.throws(() => checkProjectEditionPermissions(pool, 'nonexistent', ids.projectId), RpcError);
  });
});

describe('checkTeamAdmin', () => {
  let pool;
  let ids;

  beforeEach(() => { pool = createTestPool(); ids = seedFullHierarchy(pool); });
  afterEach(() => { destroyTestPool(pool); });

  it('allows admin for team owner', () => {
    const result = checkTeamAdmin(pool, ids.profileId, ids.teamId);
    assert.equal(result.isOwner, true);
  });

  it('throws for non-admin', () => {
    assert.throws(() => checkTeamAdmin(pool, 'nonexistent', ids.teamId), RpcError);
  });
});