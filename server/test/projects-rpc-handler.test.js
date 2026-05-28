import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import registerProjectCommands from '../src/rpc/projects.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

describe('Projects RPC — get-projects', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProjectCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns projects for a team', async () => {
    const handler = dispatcher.methods.get('get-projects').handler;
    const result = await handler({ teamId: ids.teamId });
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
    assert.equal(result[0].id, ids.projectId);
    assert.equal(result[0].teamId, ids.teamId);
    assert.equal(result[0].name, 'Test Project');
  });

  it('returns empty array for team with no projects', async () => {
    const emptyTeamId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('team', {
      id: emptyTeamId, name: 'Empty Team', is_default: '0', features: '[]',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('get-projects').handler;
    const result = await handler({ teamId: emptyTeamId });
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });

  it('orders results by project_order then created_at', async () => {
    const now = new Date().toISOString();
    const projA = uuidv4();
    const projB = uuidv4();
    pool.insertReturning('project', {
      id: projA, team_id: ids.teamId, name: 'A Project',
      is_default: '0', project_order: 2, created_at: now, modified_at: now,
    });
    pool.insertReturning('project', {
      id: projB, team_id: ids.teamId, name: 'B Project',
      is_default: '0', project_order: 1, created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('get-projects').handler;
    const result = await handler({ teamId: ids.teamId });
    assert.equal(result.length, 3);
    assert.equal(result[0].id, ids.projectId);
    assert.equal(result[1].id, projB);
    assert.equal(result[2].id, projA);
  });
});

describe('Projects RPC — get-all-projects', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProjectCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns projects across all teams for profile', async () => {
    const now = new Date().toISOString();
    const otherTeamId = uuidv4();
    const otherProjectId = uuidv4();
    pool.insertReturning('team', {
      id: otherTeamId, name: 'Other Team', is_default: '0', features: '[]',
      created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: otherTeamId, profile_id: ids.profileId,
      is_owner: '0', is_admin: '0', can_edit: '1', is_member: '1',
      created_at: now, modified_at: now,
    });
    pool.insertReturning('project', {
      id: otherProjectId, team_id: otherTeamId, name: 'Other Project',
      is_default: '0', created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('get-all-projects').handler;
    const result = await handler({}, { profileId: ids.profileId });
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 2);
    const projectIds = result.map(p => p.id);
    assert.ok(projectIds.includes(ids.projectId));
    assert.ok(projectIds.includes(otherProjectId));
  });

  it('returns empty array for profile with no team memberships', async () => {
    const handler = dispatcher.methods.get('get-all-projects').handler;
    const result = await handler({}, { profileId: uuidv4() });
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });
});

describe('Projects RPC — get-project', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProjectCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns project by id', async () => {
    const handler = dispatcher.methods.get('get-project').handler;
    const result = await handler({ id: ids.projectId });
    assert.equal(result.id, ids.projectId);
    assert.equal(result.teamId, ids.teamId);
    assert.equal(result.name, 'Test Project');
  });

  it('throws for non-existent project', async () => {
    const handler = dispatcher.methods.get('get-project').handler;
    await assert.rejects(
      () => handler({ id: uuidv4() }),
      { message: 'not-found:Project not found' }
    );
  });
});

describe('Projects RPC — create-project', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProjectCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('creates project with given name and teamId', async () => {
    const handler = dispatcher.methods.get('create-project').handler;
    const result = await handler({ teamId: ids.teamId, name: 'New Project' });
    assert.equal(result.name, 'New Project');
    assert.equal(result.teamId, ids.teamId);
    assert.ok(result.id);
    assert.equal(result.isDefault, '0');

    const row = pool.get('SELECT * FROM project WHERE id = ?', { id: result.id });
    assert.ok(row);
    assert.equal(row.name, 'New Project');
  });

  it('auto-generates id when not provided', async () => {
    const handler = dispatcher.methods.get('create-project').handler;
    const result = await handler({ teamId: ids.teamId, name: 'Auto ID' });
    assert.ok(result.id);
    assert.equal(result.id.length, 36);
  });

  it('uses provided id when given', async () => {
    const customId = uuidv4();
    const handler = dispatcher.methods.get('create-project').handler;
    const result = await handler({ id: customId, teamId: ids.teamId, name: 'Custom ID' });
    assert.equal(result.id, customId);
  });
});

describe('Projects RPC — rename-project', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProjectCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('updates project name', async () => {
    const handler = dispatcher.methods.get('rename-project').handler;
    const result = await handler({ id: ids.projectId, name: 'Renamed Project' });
    assert.equal(result.name, 'Renamed Project');
    assert.equal(result.id, ids.projectId);

    const row = pool.get('SELECT * FROM project WHERE id = ?', { id: ids.projectId });
    assert.equal(row.name, 'Renamed Project');
  });

  it('throws for non-existent project', async () => {
    const handler = dispatcher.methods.get('rename-project').handler;
    await assert.rejects(
      () => handler({ id: uuidv4(), name: 'Ghost' }),
      { message: 'not-found:Project not found' }
    );
  });
});

describe('Projects RPC — update-project-pin', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProjectCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('pins a project via team_project_profile_rel', async () => {
    const now = new Date().toISOString();
    pool.insertReturning('team_project_profile_rel', {
      id: uuidv4(),
      team_id: ids.teamId,
      profile_id: ids.profileId,
      project_id: ids.projectId,
      is_pinned: '0',
      is_owner: '0',
      is_admin: '0',
      can_edit: '1',
      created_at: now,
      modified_at: now,
    });

    const handler = dispatcher.methods.get('update-project-pin').handler;
    const result = await handler(
      { id: ids.projectId, teamId: ids.teamId, isPinned: true },
      { profileId: ids.profileId }
    );
    assert.equal(result.id, ids.projectId);
    assert.equal(result.isPinned, true);

    const row = pool.get(
      'SELECT * FROM team_project_profile_rel WHERE team_id = @team_id AND project_id = @project_id AND profile_id = @profile_id',
      { team_id: ids.teamId, project_id: ids.projectId, profile_id: ids.profileId }
    );
    assert.equal(row.is_pinned, '1');
  });

  it('unpins a previously pinned project', async () => {
    const now = new Date().toISOString();
    pool.insertReturning('team_project_profile_rel', {
      id: uuidv4(),
      team_id: ids.teamId,
      profile_id: ids.profileId,
      project_id: ids.projectId,
      is_pinned: '1',
      is_owner: '0',
      is_admin: '0',
      can_edit: '1',
      created_at: now,
      modified_at: now,
    });

    const handler = dispatcher.methods.get('update-project-pin').handler;
    const result = await handler(
      { id: ids.projectId, teamId: ids.teamId, isPinned: false },
      { profileId: ids.profileId }
    );
    assert.equal(result.isPinned, false);

    const row = pool.get(
      'SELECT * FROM team_project_profile_rel WHERE team_id = @team_id AND project_id = @project_id AND profile_id = @profile_id',
      { team_id: ids.teamId, project_id: ids.projectId, profile_id: ids.profileId }
    );
    assert.equal(row.is_pinned, '0');
  });
});

describe('Projects RPC — delete-project', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProjectCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('soft-deletes a project', async () => {
    const handler = dispatcher.methods.get('delete-project').handler;
    const result = await handler({ id: ids.projectId });
    assert.equal(result.id, ids.projectId);

    const row = pool.get('SELECT * FROM project WHERE id = ?', { id: ids.projectId });
    assert.ok(row.deleted_at);
  });

  it('soft-deleted project is excluded from get-project', async () => {
    const handler = dispatcher.methods.get('delete-project').handler;
    await handler({ id: ids.projectId });

    const getHandler = dispatcher.methods.get('get-project').handler;
    await assert.rejects(
      () => getHandler({ id: ids.projectId }),
      { message: 'not-found:Project not found' }
    );
  });

  it('soft-deleted project is excluded from get-projects', async () => {
    const handler = dispatcher.methods.get('delete-project').handler;
    await handler({ id: ids.projectId });

    const listHandler = dispatcher.methods.get('get-projects').handler;
    const result = await listHandler({ teamId: ids.teamId });
    assert.equal(result.length, 0);
  });
});