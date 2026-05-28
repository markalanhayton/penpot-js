import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import registerTeamCommands from '../src/rpc/teams.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

describe('Teams RPC — get-teams', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns seeded team for member profile', async () => {
    const handler = dispatcher.methods.get('get-teams').handler;
    const result = await handler({}, { profileId: ids.profileId });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, ids.teamId);
    assert.equal(result[0].name, 'Test Team');
  });

  it('returns empty for non-member profile', async () => {
    const handler = dispatcher.methods.get('get-teams').handler;
    const result = await handler({}, { profileId: uuidv4() });
    assert.equal(result.length, 0);
  });
});

describe('Teams RPC — get-owned-teams', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns only teams where profile is owner', async () => {
    const handler = dispatcher.methods.get('get-owned-teams').handler;
    const result = await handler({}, { profileId: ids.profileId });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, ids.teamId);
    assert.equal(result[0].isOwner, '1');
  });

  it('excludes teams where profile is not owner', async () => {
    const viewerProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: viewerProfileId, fullname: 'Viewer', email: 'viewer@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('get-owned-teams').handler;
    const result = await handler({}, { profileId: viewerProfileId });
    assert.equal(result.length, 0);
  });
});

describe('Teams RPC — get-team', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('looks up team by id', async () => {
    const handler = dispatcher.methods.get('get-team').handler;
    const result = await handler({ id: ids.teamId }, { profileId: ids.profileId });
    assert.equal(result.id, ids.teamId);
    assert.equal(result.name, 'Test Team');
  });

  it('resolves team from fileId via project', async () => {
    const handler = dispatcher.methods.get('get-team').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.id, ids.teamId);
  });

  it('throws for non-existent team id', async () => {
    const handler = dispatcher.methods.get('get-team').handler;
    await assert.rejects(
      () => handler({ id: uuidv4() }, { profileId: ids.profileId }),
      /not-found/
    );
  });

  it('throws for non-existent fileId', async () => {
    const handler = dispatcher.methods.get('get-team').handler;
    await assert.rejects(
      () => handler({ fileId: uuidv4() }, { profileId: ids.profileId }),
      /not-found/
    );
  });
});

describe('Teams RPC — get-team-members', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns member list for team', async () => {
    const handler = dispatcher.methods.get('get-team-members').handler;
    const result = await handler({ teamId: ids.teamId }, { profileId: ids.profileId });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, ids.profileId);
    assert.equal(result[0].fullname, 'Test User');
    assert.equal(result[0].isOwner, '1');
  });

  it('returns empty for team with no members', async () => {
    const emptyTeamId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('team', {
      id: emptyTeamId, name: 'Empty Team', is_default: '0', features: '[]',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('get-team-members').handler;
    const result = await handler({ teamId: emptyTeamId }, { profileId: ids.profileId });
    assert.equal(result.length, 0);
  });
});

describe('Teams RPC — get-team-users', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns users for team by teamId', async () => {
    const handler = dispatcher.methods.get('get-team-users').handler;
    const result = await handler({ teamId: ids.teamId }, { profileId: ids.profileId });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, ids.profileId);
  });

  it('resolves team from fileId and returns users', async () => {
    const handler = dispatcher.methods.get('get-team-users').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, ids.profileId);
  });

  it('throws for invalid fileId with no team', async () => {
    const handler = dispatcher.methods.get('get-team-users').handler;
    await assert.rejects(
      () => handler({ fileId: uuidv4() }, { profileId: ids.profileId }),
      /not-found/
    );
  });
});

describe('Teams RPC — get-team-stats', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns membersCount, projectsCount, filesCount', async () => {
    const handler = dispatcher.methods.get('get-team-stats').handler;
    const result = await handler({ teamId: ids.teamId }, { profileId: ids.profileId });
    assert.equal(result.membersCount, 1);
    assert.equal(result.projectsCount, 1);
    assert.equal(result.filesCount, 1);
  });
});

describe('Teams RPC — create-team', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('creates team with owner membership and default project', async () => {
    const handler = dispatcher.methods.get('create-team').handler;
    const result = await handler({ name: 'My New Team' }, { profileId: ids.profileId });
    assert.equal(result.name, 'My New Team');
    assert.equal(result.isDefault, '0');

    const membership = pool.get(
      'SELECT * FROM team_profile_rel WHERE team_id = ? AND is_owner = \'1\'',
      { id: result.id }
    );
    assert.ok(membership);
    assert.equal(membership.profile_id, ids.profileId);

    const project = pool.get(
      'SELECT * FROM project WHERE team_id = ? AND is_default = \'1\'',
      { team_id: result.id }
    );
    assert.ok(project);
    assert.equal(project.name, 'Drafts');
  });

  it('creates team with isDefault true', async () => {
    const handler = dispatcher.methods.get('create-team').handler;
    const result = await handler({ name: 'Default Team', isDefault: true }, { profileId: ids.profileId });
    assert.equal(result.isDefault, '1');
  });
});

describe('Teams RPC — update-team', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('updates team name', async () => {
    const handler = dispatcher.methods.get('update-team').handler;
    const result = await handler({ id: ids.teamId, name: 'Updated Name' }, { profileId: ids.profileId });
    assert.equal(result.name, 'Updated Name');
  });

  it('updates team features', async () => {
    const handler = dispatcher.methods.get('update-team').handler;
    const features = { customFonts: true };
    const result = await handler({ id: ids.teamId, features }, { profileId: ids.profileId });
    assert.deepEqual(JSON.parse(result.features), features);
  });

  it('throws for non-existent team', async () => {
    const handler = dispatcher.methods.get('update-team').handler;
    await assert.rejects(
      () => handler({ id: uuidv4(), name: 'Nope' }, { profileId: ids.profileId }),
      /not-found/
    );
  });
});

describe('Teams RPC — leave-team', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('removes membership when leaving team', async () => {
    const otherProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: otherProfileId, fullname: 'Other', email: 'other@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: otherProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('leave-team').handler;
    const result = await handler({ id: ids.teamId }, { profileId: otherProfileId });
    assert.equal(result.id, ids.teamId);

    const membership = pool.get(
      'SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ?',
      { team_id: ids.teamId, profile_id: otherProfileId }
    );
    assert.ok(!membership);
  });

  it('transfers ownership with reassignTo', async () => {
    const otherProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: otherProfileId, fullname: 'Other', email: 'other2@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: otherProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('leave-team').handler;
    await handler({ id: ids.teamId, reassignTo: otherProfileId }, { profileId: ids.profileId });

    const newOwner = pool.get(
      'SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ?',
      { team_id: ids.teamId, profile_id: otherProfileId }
    );
    assert.equal(newOwner.is_owner, '1');
  });
});

describe('Teams RPC — delete-team', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('soft-deletes team', async () => {
    const handler = dispatcher.methods.get('delete-team').handler;
    const result = await handler({ id: ids.teamId }, { profileId: ids.profileId });
    assert.equal(result.id, ids.teamId);

    const team = pool.get('SELECT * FROM team WHERE id = ?', { id: ids.teamId });
    assert.ok(team.deleted_at);
  });
});

describe('Teams RPC — update-team-member-role', () => {
  let pool;
  let dispatcher;
  let ids;
  let otherProfileId;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);

    otherProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: otherProfileId, fullname: 'Member', email: 'member@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: otherProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });
  });

  afterEach(() => { destroyTestPool(pool); });

  it('updates role to admin', async () => {
    const handler = dispatcher.methods.get('update-team-member-role').handler;
    const result = await handler({ teamId: ids.teamId, memberId: otherProfileId, role: 'admin' }, { profileId: ids.profileId });
    assert.equal(result.role, 'admin');

    const rel = pool.get(
      'SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ?',
      { team_id: ids.teamId, profile_id: otherProfileId }
    );
    assert.equal(rel.is_admin, '1');
    assert.equal(rel.is_owner, '0');
    assert.equal(rel.can_edit, '1');
  });

  it('updates role to editor', async () => {
    const handler = dispatcher.methods.get('update-team-member-role').handler;
    await handler({ teamId: ids.teamId, memberId: otherProfileId, role: 'editor' }, { profileId: ids.profileId });

    const rel = pool.get(
      'SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ?',
      { team_id: ids.teamId, profile_id: otherProfileId }
    );
    assert.equal(rel.is_admin, '0');
    assert.equal(rel.can_edit, '1');
    assert.equal(rel.is_owner, '0');
  });

  it('updates role to owner', async () => {
    const handler = dispatcher.methods.get('update-team-member-role').handler;
    await handler({ teamId: ids.teamId, memberId: otherProfileId, role: 'owner' }, { profileId: ids.profileId });

    const rel = pool.get(
      'SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ?',
      { team_id: ids.teamId, profile_id: otherProfileId }
    );
    assert.equal(rel.is_owner, '1');
    assert.equal(rel.is_admin, '1');
    assert.equal(rel.can_edit, '1');
  });

  it('defaults unknown role to viewer', async () => {
    const handler = dispatcher.methods.get('update-team-member-role').handler;
    await handler({ teamId: ids.teamId, memberId: otherProfileId, role: 'viewer' }, { profileId: ids.profileId });

    const rel = pool.get(
      'SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ?',
      { team_id: ids.teamId, profile_id: otherProfileId }
    );
    assert.equal(rel.is_owner, '0');
    assert.equal(rel.is_admin, '0');
    assert.equal(rel.can_edit, '0');
  });
});

describe('Teams RPC — delete-team-member', () => {
  let pool;
  let dispatcher;
  let ids;
  let otherProfileId;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);

    otherProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: otherProfileId, fullname: 'ToRemove', email: 'remove@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: otherProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });
  });

  afterEach(() => { destroyTestPool(pool); });

  it('deletes membership from team', async () => {
    const handler = dispatcher.methods.get('delete-team-member').handler;
    const result = await handler({ teamId: ids.teamId, memberId: otherProfileId }, { profileId: ids.profileId });
    assert.equal(result.teamId, ids.teamId);
    assert.equal(result.memberId, otherProfileId);

    const rel = pool.get(
      'SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ?',
      { team_id: ids.teamId, profile_id: otherProfileId }
    );
    assert.ok(!rel);
  });
});

describe('Teams RPC — get-team-invitations', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns empty when no invitations exist', async () => {
    const handler = dispatcher.methods.get('get-team-invitations').handler;
    const result = await handler({ teamId: ids.teamId }, { profileId: ids.profileId });
    assert.deepEqual(result, []);
  });
});

describe('Teams RPC — get-team-info', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerTeamCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('looks up team by id without auth', async () => {
    const handler = dispatcher.methods.get('get-team-info').handler;
    const result = await handler({ id: ids.teamId });
    assert.equal(result.id, ids.teamId);
    assert.equal(result.name, 'Test Team');
  });

  it('looks up team by fileId', async () => {
    const handler = dispatcher.methods.get('get-team-info').handler;
    const result = await handler({ fileId: ids.fileId });
    assert.equal(result.id, ids.teamId);
  });

  it('throws for non-existent team id', async () => {
    const handler = dispatcher.methods.get('get-team-info').handler;
    await assert.rejects(
      () => handler({ id: uuidv4() }),
      /not-found/
    );
  });

  it('throws for non-existent fileId', async () => {
    const handler = dispatcher.methods.get('get-team-info').handler;
    await assert.rejects(
      () => handler({ fileId: uuidv4() }),
      /not-found/
    );
  });
});