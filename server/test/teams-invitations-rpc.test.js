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

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('creates an access request', async () => {
    const result = await handlers['create-team-access-request'](
      { teamId: ids.teamId },
      { profileId: ids.profileId }
    );
    assert.ok(result.id);
    assert.equal(result.teamId, ids.teamId);
  });

  it('rejects duplicate access request', async () => {
    await handlers['create-team-access-request'](
      { teamId: ids.teamId },
      { profileId: ids.profileId }
    );

    await assert.rejects(
      () => handlers['create-team-access-request'](
        { teamId: ids.teamId },
        { profileId: ids.profileId }
      ),
      { type: 'conflict' }
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