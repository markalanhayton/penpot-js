import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { encode } from '../src/files/blob.js';
import registerManagementCommands from '../src/rpc/management.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

describe('Management RPC — get-builtin-templates', () => {
  let pool;
  let dispatcher;

  beforeEach(() => {
    pool = createTestPool();
    dispatcher = createDispatcher();
    registerManagementCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns template list with id, name, icon, and color', async () => {
    const handler = dispatcher.methods.get('get-builtin-templates').handler;
    const result = await handler({}, { profileId: uuidv4() });
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0, 'should have at least one template');
    for (const t of result) {
      assert.ok(t.id, 'each template should have an id');
      assert.ok(t.name, 'each template should have a name');
      assert.ok('icon' in t, 'each template should have an icon field');
      assert.ok('color' in t, 'each template should have a color field');
    }
  });

  it('includes known upstream template ids', async () => {
    const handler = dispatcher.methods.get('get-builtin-templates').handler;
    const result = await handler({}, { profileId: uuidv4() });
    const ids = result.map(t => t.id);
    assert.ok(ids.includes('wireframing-kit'), 'should include wireframing-kit');
    assert.ok(ids.includes('welcome'), 'should include welcome');
  });
});

describe('Management RPC — clone-template', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerManagementCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('rejects invalid project id', async () => {
    const handler = dispatcher.methods.get('clone-template').handler;
    await assert.rejects(
      () => handler({ projectId: uuidv4(), templateId: 'wireframing-kit' }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });

  it('rejects non-existent template', async () => {
    const handler = dispatcher.methods.get('clone-template').handler;
    await assert.rejects(
      () => handler({ projectId: ids.projectId, templateId: 'nonexistent-template' }, { profileId: ids.profileId }),
      { code: 'template-not-found' }
    );
  });

  it('rejects user without edit permissions', async () => {
    const noPermProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: noPermProfileId, fullname: 'NoPerm', email: 'noperm@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: noPermProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('clone-template').handler;
    await assert.rejects(
      () => handler({ projectId: ids.projectId, templateId: 'wireframing-kit' }, { profileId: noPermProfileId }),
      { code: 'access-denied' }
    );
  });
});

describe('Management RPC — duplicate-file', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerManagementCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('duplicates a file within the same project', async () => {
    const fileData = { pages: [{ id: 'p1', name: 'Page 1', objects: {} }], pagesIndex: { p1: { id: 'p1', name: 'Page 1', objects: {} } }, components: {}, media: {}, colors: [], typographies: {} };
    const encoded = await encode(fileData, { version: 5 });
    pool.insertOnConflictDoNothing('file_data', {
      id: uuidv4(),
      file_id: ids.fileId,
      type: 'main',
      data: encoded,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
    });

    const handler = dispatcher.methods.get('duplicate-file').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });

    assert.ok(result.id);
    assert.equal(result.projectId, ids.projectId);
    assert.ok(result.name.includes('(copy)'));

    const newFile = pool.get('SELECT * FROM file WHERE id = ?', [result.id]);
    assert.ok(newFile);
    assert.equal(newFile.project_id, ids.projectId);
  });

  it('rejects non-existent file', async () => {
    const handler = dispatcher.methods.get('duplicate-file').handler;
    await assert.rejects(
      () => handler({ fileId: uuidv4() }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });
});

describe('Management RPC — move-files', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerManagementCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('moves files to another project', async () => {
    const newProjectId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('project', {
      id: newProjectId, team_id: ids.teamId, name: 'Target Project',
      is_default: '0', created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('move-files').handler;
    const result = await handler({ ids: [ids.fileId], projectId: newProjectId }, { profileId: ids.profileId });

    assert.deepEqual(result, [ids.fileId]);

    const movedFile = pool.get('SELECT * FROM file WHERE id = ?', [ids.fileId]);
    assert.equal(movedFile.project_id, newProjectId);
  });

  it('rejects empty file ids', async () => {
    const handler = dispatcher.methods.get('move-files').handler;
    await assert.rejects(
      () => handler({ ids: [], projectId: ids.projectId }, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });
});

describe('Management RPC — duplicate-project', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerManagementCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('duplicates a project with its files', async () => {
    const fileData = { pages: [{ id: 'p1', name: 'Page 1', objects: {} }], pagesIndex: { p1: { id: 'p1', name: 'Page 1', objects: {} } }, components: {}, media: {}, colors: [], typographies: {} };
    const encoded = await encode(fileData, { version: 5 });
    pool.insertOnConflictDoNothing('file_data', {
      id: uuidv4(),
      file_id: ids.fileId,
      type: 'main',
      data: encoded,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
    });

    const handler = dispatcher.methods.get('duplicate-project').handler;
    const result = await handler({ projectId: ids.projectId }, { profileId: ids.profileId });

    assert.ok(result.id);
    assert.ok(result.name.includes('(copy)'));
    assert.equal(result.teamId, ids.teamId);
    assert.ok(Array.isArray(result.fileIds));
    assert.equal(result.fileIds.length, 1);

    const newProject = pool.get('SELECT * FROM project WHERE id = ?', [result.id]);
    assert.ok(newProject);
    assert.equal(newProject.team_id, ids.teamId);
  });

  it('uses custom name when provided', async () => {
    const handler = dispatcher.methods.get('duplicate-project').handler;
    const result = await handler({ projectId: ids.projectId, name: 'My Clone' }, { profileId: ids.profileId });

    assert.equal(result.name, 'My Clone');
  });

  it('throws not-found for nonexistent project', async () => {
    const handler = dispatcher.methods.get('duplicate-project').handler;
    await assert.rejects(
      () => handler({ projectId: uuidv4() }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });

  it('throws authorization for non-editor', async () => {
    const now = new Date().toISOString();
    const viewerId = uuidv4();
    pool.insertReturning('profile', {
      id: viewerId, fullname: 'Viewer', email: 'viewer-dup-proj@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('duplicate-project').handler;
    await assert.rejects(
      () => handler({ projectId: ids.projectId }, { profileId: viewerId }),
      { code: 'access-denied' }
    );
  });
});

describe('Management RPC — move-project', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerManagementCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('moves a project to another team', async () => {
    const now = new Date().toISOString();
    const destTeamId = uuidv4();
    pool.insertReturning('team', {
      id: destTeamId, name: 'Dest Team', is_default: '0', features: '[]',
      created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: destTeamId, profile_id: ids.profileId,
      is_owner: '1', is_admin: '1', can_edit: '1', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('move-project').handler;
    const result = await handler({ teamId: destTeamId, projectId: ids.projectId }, { profileId: ids.profileId });

    assert.equal(result.id, ids.projectId);
    assert.equal(result.teamId, destTeamId);

    const project = pool.get('SELECT * FROM project WHERE id = ?', [ids.projectId]);
    assert.equal(project.team_id, destTeamId);
  });

  it('throws validation when moving to same team', async () => {
    const handler = dispatcher.methods.get('move-project').handler;
    await assert.rejects(
      () => handler({ teamId: ids.teamId, projectId: ids.projectId }, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });

  it('throws not-found for nonexistent project', async () => {
    const now = new Date().toISOString();
    const destTeamId = uuidv4();
    pool.insertReturning('team', {
      id: destTeamId, name: 'Dest Team', is_default: '0', features: '[]',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('move-project').handler;
    await assert.rejects(
      () => handler({ teamId: destTeamId, projectId: uuidv4() }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });

  it('throws not-found for nonexistent destination team', async () => {
    const handler = dispatcher.methods.get('move-project').handler;
    await assert.rejects(
      () => handler({ teamId: uuidv4(), projectId: ids.projectId }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });

  it('throws authorization for non-editor on source team', async () => {
    const now = new Date().toISOString();
    const destTeamId = uuidv4();
    pool.insertReturning('team', {
      id: destTeamId, name: 'Dest Team', is_default: '0', features: '[]',
      created_at: now, modified_at: now,
    });

    const viewerId = uuidv4();
    pool.insertReturning('profile', {
      id: viewerId, fullname: 'Viewer', email: 'viewer-move@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: destTeamId, profile_id: viewerId,
      is_owner: '0', is_admin: '1', can_edit: '1', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('move-project').handler;
    await assert.rejects(
      () => handler({ teamId: destTeamId, projectId: ids.projectId }, { profileId: viewerId }),
      { code: 'access-denied' }
    );
  });
});