import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { RpcError } from '../src/rpc/dispatcher.js';
import registerTeamInvitationCommands from '../src/rpc/teams_invitations.js';

function captureHandlers(pool) {
  const handlers = {};
  const register = (name, def) => { handlers[name] = def.handler; };
  registerTeamInvitationCommands(register, pool);
  return handlers;
}

describe('rpc/teams-invitations — create-team-invitations', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('creates an invitation for a team', async () => {
    const results = await handlers['create-team-invitations'](
      { teamId: ids.teamId, invitations: [{ email: 'invite@example.com', role: 'viewer' }] },
      { profileId: ids.profileId }
    );
    assert.equal(results.length, 1);
    assert.equal(results[0].emailTo, 'invite@example.com');
    assert.equal(results[0].role, 'viewer');

    const inv = pool.get('SELECT * FROM team_invitation WHERE team_id = ? AND email_to = ?', [ids.teamId, 'invite@example.com']);
    assert.ok(inv);
  });

  it('skips duplicate invitations', async () => {
    await handlers['create-team-invitations'](
      { teamId: ids.teamId, invitations: [{ email: 'dup@example.com', role: 'admin' }] },
      { profileId: ids.profileId }
    );
    const results = await handlers['create-team-invitations'](
      { teamId: ids.teamId, invitations: [{ email: 'dup@example.com', role: 'viewer' }] },
      { profileId: ids.profileId }
    );
    assert.equal(results.length, 1);
    assert.equal(results[0].role, 'admin');
  });

  it('throws authorization for non-editor', async () => {
    const now = new Date().toISOString();
    const viewerId = 'viewer-1';
    pool.insertReturning('profile', {
      id: viewerId, fullname: 'Viewer', email: 'viewer@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['create-team-invitations'](
        { teamId: ids.teamId, invitations: [{ email: 'x@x.com' }] },
        { profileId: viewerId }
      ),
      { type: 'authorization' }
    );
  });
});

describe('rpc/teams-invitations — create-team-with-invitations', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('creates team with owner and invitations', async () => {
    const team = await handlers['create-team-with-invitations'](
      { name: 'InvTeam', invitations: [{ email: 'a@a.com', role: 'editor' }] },
      { profileId: ids.profileId }
    );
    assert.ok(team.id);
    assert.equal(team.name, 'InvTeam');

    const rels = pool.query("SELECT * FROM team_profile_rel WHERE team_id = ? AND is_owner = '1'", [team.id]);
    assert.equal(rels.length, 1);

    const invs = pool.query('SELECT * FROM team_invitation WHERE team_id = ?', [team.id]);
    assert.equal(invs.length, 1);
  });
});

describe('rpc/teams-invitations — update-team-invitation-role', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('updates invitation role', async () => {
    await handlers['create-team-invitations'](
      { teamId: ids.teamId, invitations: [{ email: 'role@x.com', role: 'viewer' }] },
      { profileId: ids.profileId }
    );

    const updated = await handlers['update-team-invitation-role'](
      { teamId: ids.teamId, emailTo: 'role@x.com', role: 'admin' },
      { profileId: ids.profileId }
    );
    assert.equal(updated.role, 'admin');
  });
});

describe('rpc/teams-invitations — delete-team-invitation', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('deletes an invitation', async () => {
    await handlers['create-team-invitations'](
      { teamId: ids.teamId, invitations: [{ email: 'del@x.com', role: 'viewer' }] },
      { profileId: ids.profileId }
    );

    await handlers['delete-team-invitation'](
      { teamId: ids.teamId, emailTo: 'del@x.com' },
      { profileId: ids.profileId }
    );

    const inv = pool.get('SELECT * FROM team_invitation WHERE team_id = ? AND email_to = ?', [ids.teamId, 'del@x.com']);
    assert.equal(inv, undefined);
  });
});

describe('rpc/teams-invitations — create-team-access-request', () => {
  let pool;
  let ids;
  let handlers;
  let outsiderId;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
    const now = new Date().toISOString();
    outsiderId = 'outsider-profile';
    pool.insertReturning('profile', {
      id: outsiderId, fullname: 'Out Sider', email: 'outsider@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
  });
  afterEach(() => { destroyTestPool(pool); });

  it('creates an access request', async () => {
    const result = await handlers['create-team-access-request'](
      { teamId: ids.teamId },
      { profileId: outsiderId }
    );
    assert.ok(result.id);
    assert.equal(result.teamId, ids.teamId);
    assert.equal(result.requesterId, outsiderId);
  });

  it('rejects duplicate access request', async () => {
    await handlers['create-team-access-request'](
      { teamId: ids.teamId },
      { profileId: outsiderId }
    );

    await assert.rejects(
      () => handlers['create-team-access-request'](
        { teamId: ids.teamId },
        { profileId: outsiderId }
      ),
      { type: 'conflict' }
    );
  });

  it('rejects access request from existing team member', async () => {
    await assert.rejects(
      () => handlers['create-team-access-request'](
        { teamId: ids.teamId },
        { profileId: ids.profileId }
      ),
      { type: 'conflict' }
    );
  });

  it('rejects access request for nonexistent team', async () => {
    await assert.rejects(
      () => handlers['create-team-access-request'](
        { teamId: 'nonexistent-team' },
        { profileId: outsiderId }
      ),
      { type: 'not-found' }
    );
  });
});

describe('rpc/teams-invitations — get-team-access-requests', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns empty list when no requests exist', async () => {
    const result = await handlers['get-team-access-requests'](
      { teamId: ids.teamId },
      { profileId: ids.profileId }
    );
    assert.equal(result.length, 0);
  });

  it('returns pending access requests with requester details', async () => {
    const now = new Date().toISOString();
    const requesterId = 'requester-1';
    pool.insertReturning('profile', {
      id: requesterId, fullname: 'Requester One', email: 'requester@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_access_request', {
      id: 'req-1', team_id: ids.teamId, requester_id: requesterId,
      valid_until: new Date(Date.now() + 7 * 86400_000).toISOString(),
      auto_join_until: new Date(Date.now() + 7 * 86400_000).toISOString(),
      created_at: now, updated_at: now,
    });

    const result = await handlers['get-team-access-requests'](
      { teamId: ids.teamId },
      { profileId: ids.profileId }
    );
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'req-1');
    assert.equal(result[0].requesterEmail, 'requester@example.com');
    assert.equal(result[0].requesterFullname, 'Requester One');
  });

  it('rejects non-editor access', async () => {
    const now = new Date().toISOString();
    const viewerId = 'viewer-2';
    pool.insertReturning('profile', {
      id: viewerId, fullname: 'Viewer 2', email: 'viewer2@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['get-team-access-requests'](
        { teamId: ids.teamId },
        { profileId: viewerId }
      ),
      { type: 'authorization' }
    );
  });
});

describe('rpc/teams-invitations — resolve-team-access-request', () => {
  let pool;
  let ids;
  let handlers;
  let requesterId;
  let requestId;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
    const now = new Date().toISOString();
    requesterId = 'requester-resolve';
    requestId = 'req-resolve-1';
    pool.insertReturning('profile', {
      id: requesterId, fullname: 'Resolve Me', email: 'resolve@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_access_request', {
      id: requestId, team_id: ids.teamId, requester_id: requesterId,
      valid_until: new Date(Date.now() + 7 * 86400_000).toISOString(),
      auto_join_until: new Date(Date.now() + 7 * 86400_000).toISOString(),
      created_at: now, updated_at: now,
    });
  });
  afterEach(() => { destroyTestPool(pool); });

  it('accept=true creates team_profile_rel and deletes request', async () => {
    const result = await handlers['resolve-team-access-request'](
      { id: requestId, accept: true, role: 'editor' },
      { profileId: ids.profileId }
    );
    assert.equal(result.accepted, true);
    assert.equal(result.id, requestId);

    const member = pool.get(
      'SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ?',
      [ids.teamId, requesterId]
    );
    assert.ok(member, 'team_profile_rel row should be created');
    assert.equal(member.can_edit, '1');

    const req = pool.get('SELECT * FROM team_access_request WHERE id = ?', { id: requestId });
    assert.equal(req, undefined, 'access request should be deleted');
  });

  it('accept=false deletes request without creating membership', async () => {
    const result = await handlers['resolve-team-access-request'](
      { id: requestId, accept: false },
      { profileId: ids.profileId }
    );
    assert.equal(result.accepted, false);

    const member = pool.get(
      'SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ?',
      [ids.teamId, requesterId]
    );
    assert.equal(member, undefined);

    const req = pool.get('SELECT * FROM team_access_request WHERE id = ?', { id: requestId });
    assert.equal(req, undefined);
  });

  it('rejects when request not found', async () => {
    await assert.rejects(
      () => handlers['resolve-team-access-request'](
        { id: 'nonexistent', accept: true },
        { profileId: ids.profileId }
      ),
      { type: 'not-found' }
    );
  });

  it('rejects when id is missing', async () => {
    await assert.rejects(
      () => handlers['resolve-team-access-request'](
        { accept: true },
        { profileId: ids.profileId }
      ),
      { type: 'validation' }
    );
  });

  it('rejects non-editor access', async () => {
    const now = new Date().toISOString();
    const viewerId = 'viewer-resolve';
    pool.insertReturning('profile', {
      id: viewerId, fullname: 'Viewer Resolve', email: 'vr@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['resolve-team-access-request'](
        { id: requestId, accept: true },
        { profileId: viewerId }
      ),
      { type: 'authorization' }
    );
  });
});

describe('rpc/teams-invitations — delete-team-access-request', () => {
  let pool;
  let ids;
  let handlers;
  let requesterId;
  let requestId;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
    const now = new Date().toISOString();
    requesterId = 'requester-delete';
    requestId = 'req-delete-1';
    pool.insertReturning('profile', {
      id: requesterId, fullname: 'Delete Me', email: 'delete@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_access_request', {
      id: requestId, team_id: ids.teamId, requester_id: requesterId,
      valid_until: new Date(Date.now() + 7 * 86400_000).toISOString(),
      auto_join_until: new Date(Date.now() + 7 * 86400_000).toISOString(),
      created_at: now, updated_at: now,
    });
  });
  afterEach(() => { destroyTestPool(pool); });

  it('admin can decline a request', async () => {
    const result = await handlers['delete-team-access-request'](
      { id: requestId },
      { profileId: ids.profileId }
    );
    assert.equal(result.id, requestId);
    const req = pool.get('SELECT * FROM team_access_request WHERE id = ?', { id: requestId });
    assert.equal(req, undefined);
  });

  it('requester can withdraw their own request', async () => {
    const result = await handlers['delete-team-access-request'](
      { id: requestId },
      { profileId: requesterId }
    );
    assert.equal(result.id, requestId);
    const req = pool.get('SELECT * FROM team_access_request WHERE id = ?', { id: requestId });
    assert.equal(req, undefined);
  });

  it('rejects unauthorized profile', async () => {
    const now = new Date().toISOString();
    const otherId = 'other-profile';
    pool.insertReturning('profile', {
      id: otherId, fullname: 'Other', email: 'other@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    await assert.rejects(
      () => handlers['delete-team-access-request'](
        { id: requestId },
        { profileId: otherId }
      ),
      { type: 'authorization' }
    );
  });

  it('rejects when request not found', async () => {
    await assert.rejects(
      () => handlers['delete-team-access-request'](
        { id: 'nonexistent' },
        { profileId: ids.profileId }
      ),
      { type: 'not-found' }
    );
  });
});

describe('rpc/teams-invitations — get-team-invitation-token', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns a token string', async () => {
    const result = await handlers['get-team-invitation-token'](
      { teamId: ids.teamId },
      { profileId: ids.profileId }
    );
    assert.ok(result.token);
    assert.equal(result.teamId, ids.teamId);
    assert.equal(result.token.length, 32);
  });
});