import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { encode } from '../src/files/blob.js';
import registerFileCommands from '../src/rpc/files.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

describe('Files RPC — set-file-shared', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('sets is_shared to true', async () => {
    const handler = dispatcher.methods.get('set-file-shared').handler;
    const result = await handler({ id: ids.fileId, isShared: true });
    assert.equal(result.id, ids.fileId);
    assert.equal(result.isShared, true);

    const row = pool.get('SELECT is_shared FROM file WHERE id = ?', [ids.fileId]);
    assert.equal(row.is_shared, '1');
  });

  it('sets is_shared to false', async () => {
    pool.run('UPDATE file SET is_shared = ? WHERE id = ?', ['1', ids.fileId]);

    const handler = dispatcher.methods.get('set-file-shared').handler;
    const result = await handler({ id: ids.fileId, isShared: false });
    assert.equal(result.isShared, false);

    const row = pool.get('SELECT is_shared FROM file WHERE id = ?', [ids.fileId]);
    assert.equal(row.is_shared, '0');
  });

  it('updates modified_at when toggling shared', async () => {
    const before = pool.get('SELECT modified_at FROM file WHERE id = ?', [ids.fileId]);

    const handler = dispatcher.methods.get('set-file-shared').handler;
    await handler({ id: ids.fileId, isShared: true });

    const after = pool.get('SELECT modified_at FROM file WHERE id = ?', [ids.fileId]);
    assert.ok(after.modified_at >= before.modified_at);
  });
});

describe('Files RPC — permanently-delete-team-files', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('soft-deletes files belonging to the team', async () => {
    const handler = dispatcher.methods.get('permanently-delete-team-files').handler;
    const result = await handler(
      { teamId: ids.teamId, ids: [ids.fileId] },
      { profileId: ids.profileId }
    );
    assert.deepEqual(result, [ids.fileId]);

    const row = pool.get('SELECT deleted_at FROM file WHERE id = ?', [ids.fileId]);
    assert.ok(row.deleted_at !== null);
  });

  it('rejects non-admin users', async () => {
    const memberProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: memberProfileId, fullname: 'Member', email: 'member@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: memberProfileId,
      is_owner: '0', is_admin: '0', can_edit: '1', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('permanently-delete-team-files').handler;
    await assert.rejects(
      () => handler({ teamId: ids.teamId, ids: [ids.fileId] }, { profileId: memberProfileId }),
      { code: 'access-denied' }
    );
  });

  it('returns empty array for empty ids', async () => {
    const handler = dispatcher.methods.get('permanently-delete-team-files').handler;
    const result = await handler({ teamId: ids.teamId, ids: [] }, { profileId: ids.profileId });
    assert.deepEqual(result, []);
  });

  it('ignores files not belonging to the team', async () => {
    const otherFileId = uuidv4();
    const otherTeamId = uuidv4();
    const otherProjectId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('team', {
      id: otherTeamId, name: 'Other Team', is_default: '0',
      features: '[]', created_at: now, modified_at: now,
    });
    pool.insertReturning('project', {
      id: otherProjectId, team_id: otherTeamId, name: 'Other Project',
      is_default: '0', created_at: now, modified_at: now,
    });
    pool.insertReturning('file', {
      id: otherFileId, project_id: otherProjectId, name: 'Other File',
      is_shared: '0', revn: 0, features: '[]', fonts: '[]',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('permanently-delete-team-files').handler;
    const result = await handler(
      { teamId: ids.teamId, ids: [otherFileId] },
      { profileId: ids.profileId }
    );
    assert.deepEqual(result, []);

    const row = pool.get('SELECT deleted_at FROM file WHERE id = ?', [otherFileId]);
    assert.equal(row.deleted_at, null);
  });
});

describe('Files RPC — restore-deleted-team-files', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('restores soft-deleted files', async () => {
    const now = new Date().toISOString();
    pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [now, ids.fileId]);

    const handler = dispatcher.methods.get('restore-deleted-team-files').handler;
    const result = await handler(
      { teamId: ids.teamId, ids: [ids.fileId] },
      { profileId: ids.profileId }
    );
    assert.deepEqual(result, [ids.fileId]);

    const row = pool.get('SELECT deleted_at FROM file WHERE id = ?', [ids.fileId]);
    assert.equal(row.deleted_at, null);
  });

  it('rejects non-admin users', async () => {
    const now = new Date().toISOString();
    pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [now, ids.fileId]);

    const memberProfileId = uuidv4();
    pool.insertReturning('profile', {
      id: memberProfileId, fullname: 'Member', email: 'member2@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: memberProfileId,
      is_owner: '0', is_admin: '0', can_edit: '1', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('restore-deleted-team-files').handler;
    await assert.rejects(
      () => handler({ teamId: ids.teamId, ids: [ids.fileId] }, { profileId: memberProfileId }),
      { code: 'access-denied' }
    );
  });

  it('returns empty array for empty ids', async () => {
    const handler = dispatcher.methods.get('restore-deleted-team-files').handler;
    const result = await handler({ teamId: ids.teamId, ids: [] }, { profileId: ids.profileId });
    assert.deepEqual(result, []);
  });

  it('restores related file_data rows alongside the file', async () => {
    const now = new Date().toISOString();
    pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [now, ids.fileId]);
    const fdId = uuidv4();
    pool.insertOnConflictDoNothing('file_data', {
      id: fdId, file_id: ids.fileId, type: 'main', backend: 'db',
      metadata: '{}', data: Buffer.alloc(0),
      created_at: now, modified_at: now, deleted_at: now,
    });

    const handler = dispatcher.methods.get('restore-deleted-team-files').handler;
    await handler({ teamId: ids.teamId, ids: [ids.fileId] }, { profileId: ids.profileId });

    const fd = pool.get('SELECT deleted_at FROM file_data WHERE id = ?', [fdId]);
    assert.equal(fd.deleted_at, null);
  });
});

describe('Files RPC — update-file-pin', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('pins a file', async () => {
    const handler = dispatcher.methods.get('update-file-pin').handler;
    const result = await handler(
      { fileId: ids.fileId, projectId: ids.projectId, isPinned: true },
      { profileId: ids.profileId }
    );
    assert.equal(result.id, ids.fileId);
    assert.equal(result.isPinned, true);

    const row = pool.get(
      'SELECT is_pinned FROM file_project_profile_rel WHERE file_id = ? AND project_id = ? AND profile_id = ?',
      [ids.fileId, ids.projectId, ids.profileId]
    );
    assert.equal(row.is_pinned, '1');
  });

  it('unpins a file', async () => {
    const handler = dispatcher.methods.get('update-file-pin').handler;
    await handler(
      { fileId: ids.fileId, projectId: ids.projectId, isPinned: true },
      { profileId: ids.profileId }
    );
    const result = await handler(
      { fileId: ids.fileId, projectId: ids.projectId, isPinned: false },
      { profileId: ids.profileId }
    );
    assert.equal(result.isPinned, false);

    const row = pool.get(
      'SELECT is_pinned FROM file_project_profile_rel WHERE file_id = ? AND project_id = ? AND profile_id = ?',
      [ids.fileId, ids.projectId, ids.profileId]
    );
    assert.equal(row.is_pinned, '0');
  });

  it('rejects missing fileId', async () => {
    const handler = dispatcher.methods.get('update-file-pin').handler;
    await assert.rejects(
      () => handler({ fileId: null, projectId: ids.projectId, isPinned: true }, { profileId: ids.profileId }),
      { code: 'missing-params' }
    );
  });

  it('rejects missing projectId', async () => {
    const handler = dispatcher.methods.get('update-file-pin').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId, projectId: null, isPinned: true }, { profileId: ids.profileId }),
      { code: 'missing-params' }
    );
  });
});

describe('Files RPC — get-file-summary', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns file summary metadata', async () => {
    const handler = dispatcher.methods.get('get-file-summary').handler;
    const result = await handler({ id: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.id, ids.fileId);
    assert.equal(result.name, 'Test File');
    assert.equal(result.projectId, ids.projectId);
    assert.equal(result.isShared, false);
    assert.equal(result.pageCount, 0);
    assert.equal(result.libraryCount, 0);
  });

  it('includes page count', async () => {
    const pageId = uuidv4();
    const now = new Date().toISOString();
    pool.insertOnConflictDoNothing('page', {
      id: pageId, file_id: ids.fileId, name: 'Page 1', ordering: 0,
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('get-file-summary').handler;
    const result = await handler({ id: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.pageCount, 1);
  });

  it('throws not-found for missing file', async () => {
    const handler = dispatcher.methods.get('get-file-summary').handler;
    await assert.rejects(
      () => handler({ id: uuidv4() }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });
});

describe('Files RPC — get-file-libraries', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns libraries linked to a file', async () => {
    const libFileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('file', {
      id: libFileId, project_id: ids.projectId, name: 'Library File',
      is_shared: '1', revn: 0, features: '[]', fonts: '[]',
      created_at: now, modified_at: now,
    });
    pool.run(
      'INSERT INTO file_library_rel (file_id, library_file_id, created_at, synced_at) VALUES (?, ?, ?, ?)',
      [ids.fileId, libFileId, now, now]
    );

    const handler = dispatcher.methods.get('get-file-libraries').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, libFileId);
    assert.equal(result[0].name, 'Library File');
  });

  it('returns empty array when no libraries linked', async () => {
    const handler = dispatcher.methods.get('get-file-libraries').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.length, 0);
  });

  it('excludes deleted libraries', async () => {
    const libFileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('file', {
      id: libFileId, project_id: ids.projectId, name: 'Deleted Library',
      is_shared: '1', revn: 0, features: '[]', fonts: '[]',
      created_at: now, modified_at: now,
    });
    pool.run(
      'INSERT INTO file_library_rel (file_id, library_file_id, created_at, synced_at) VALUES (?, ?, ?, ?)',
      [ids.fileId, libFileId, now, now]
    );
    pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [now, libFileId]);

    const handler = dispatcher.methods.get('get-file-libraries').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.length, 0);
  });
});

describe('Files RPC — get-library-file-references', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns files referencing a library', async () => {
    const libFileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('file', {
      id: libFileId, project_id: ids.projectId, name: 'Library',
      is_shared: '1', revn: 0, features: '[]', fonts: '[]',
      created_at: now, modified_at: now,
    });
    pool.run(
      'INSERT INTO file_library_rel (file_id, library_file_id, created_at, synced_at) VALUES (?, ?, ?, ?)',
      [ids.fileId, libFileId, now, now]
    );

    const handler = dispatcher.methods.get('get-library-file-references').handler;
    const result = await handler({ libraryId: libFileId });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, ids.fileId);
    assert.equal(result[0].name, 'Test File');
  });

  it('throws not-found for missing library', async () => {
    const handler = dispatcher.methods.get('get-library-file-references').handler;
    await assert.rejects(
      () => handler({ libraryId: uuidv4() }),
      { code: 'object-not-found' }
    );
  });

  it('excludes deleted referencing files', async () => {
    const libFileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('file', {
      id: libFileId, project_id: ids.projectId, name: 'Library',
      is_shared: '1', revn: 0, features: '[]', fonts: '[]',
      created_at: now, modified_at: now,
    });
    pool.run(
      'INSERT INTO file_library_rel (file_id, library_file_id, created_at, synced_at) VALUES (?, ?, ?, ?)',
      [ids.fileId, libFileId, now, now]
    );
    pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [now, ids.fileId]);

    const handler = dispatcher.methods.get('get-library-file-references').handler;
    const result = await handler({ libraryId: libFileId });
    assert.equal(result.length, 0);
  });
});

describe('Files RPC — get-file-info', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns public file info by id', async () => {
    const handler = dispatcher.methods.get('get-file-info').handler;
    const result = await handler({ id: ids.fileId });
    assert.equal(result.id, ids.fileId);
    assert.equal(result.name, 'Test File');
    assert.equal(result.projectId, ids.projectId);
  });

  it('throws for non-existent file', async () => {
    const handler = dispatcher.methods.get('get-file-info').handler;
    await assert.rejects(
      () => handler({ id: uuidv4() }),
      /not-found/
    );
  });

  it('returns info even for deleted files', async () => {
    const now = new Date().toISOString();
    pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [now, ids.fileId]);

    const handler = dispatcher.methods.get('get-file-info').handler;
    const result = await handler({ id: ids.fileId });
    assert.equal(result.id, ids.fileId);
  });
});

describe('Files RPC — get-team-shared-files', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns shared files visible to profile', async () => {
    pool.run('UPDATE file SET is_shared = ? WHERE id = ?', ['1', ids.fileId]);

    const handler = dispatcher.methods.get('get-team-shared-files').handler;
    const result = await handler({ teamId: ids.profileId });
    assert.ok(result.length >= 1);
    assert.equal(result[0].id, ids.fileId);
    assert.equal(result[0].isShared, '1');
  });

  it('excludes non-shared files', async () => {
    const handler = dispatcher.methods.get('get-team-shared-files').handler;
    const result = await handler({ teamId: ids.profileId });
    assert.equal(result.length, 0);
  });
});

describe('Files RPC — get-team-deleted-files', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns deleted files for the team', async () => {
    const now = new Date().toISOString();
    pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [now, ids.fileId]);

    const handler = dispatcher.methods.get('get-team-deleted-files').handler;
    const result = await handler({ teamId: ids.teamId });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, ids.fileId);
  });

  it('excludes non-deleted files', async () => {
    const handler = dispatcher.methods.get('get-team-deleted-files').handler;
    const result = await handler({ teamId: ids.teamId });
    assert.equal(result.length, 0);
  });
});

describe('Files RPC — has-file-libraries', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns false when no libraries linked', async () => {
    const handler = dispatcher.methods.get('has-file-libraries').handler;
    const result = await handler({ fileId: ids.fileId });
    assert.equal(result, false);
  });

  it('returns true when libraries are linked', async () => {
    const libFileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('file', {
      id: libFileId, project_id: ids.projectId, name: 'Lib',
      is_shared: '1', revn: 0, features: '[]', fonts: '[]',
      created_at: now, modified_at: now,
    });
    pool.run(
      'INSERT INTO file_library_rel (file_id, library_file_id, created_at, synced_at) VALUES (?, ?, ?, ?)',
      [ids.fileId, libFileId, now, now]
    );

    const handler = dispatcher.methods.get('has-file-libraries').handler;
    const result = await handler({ fileId: ids.fileId });
    assert.equal(result, true);
  });

  it('returns false when all linked libraries are deleted', async () => {
    const libFileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('file', {
      id: libFileId, project_id: ids.projectId, name: 'Lib',
      is_shared: '1', revn: 0, features: '[]', fonts: '[]',
      created_at: now, modified_at: now,
    });
    pool.run(
      'INSERT INTO file_library_rel (file_id, library_file_id, created_at, synced_at) VALUES (?, ?, ?, ?)',
      [ids.fileId, libFileId, now, now]
    );
    pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [now, libFileId]);

    const handler = dispatcher.methods.get('has-file-libraries').handler;
    const result = await handler({ fileId: ids.fileId });
    assert.equal(result, false);
  });
});

describe('Files RPC — update-file-library-sync-status', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('creates a new sync record', async () => {
    const libFileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('file', {
      id: libFileId, project_id: ids.projectId, name: 'Lib',
      is_shared: '1', revn: 0, features: '[]', fonts: '[]',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('update-file-library-sync-status').handler;
    const result = await handler({ fileId: ids.fileId, libraryId: libFileId }, { profileId: ids.profileId });

    assert.equal(result.fileId, ids.fileId);
    assert.equal(result.libraryId, libFileId);
    assert.ok(result.syncedAt);

    const row = pool.get('SELECT * FROM file_library_sync WHERE file_id = ? AND library_file_id = ?', [ids.fileId, libFileId]);
    assert.ok(row);
  });

  it('updates an existing sync record', async () => {
    const libFileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('file', {
      id: libFileId, project_id: ids.projectId, name: 'Lib',
      is_shared: '1', revn: 0, features: '[]', fonts: '[]',
      created_at: now, modified_at: now,
    });
    pool.run(
      'INSERT INTO file_library_sync (file_id, library_file_id, synced_at) VALUES (?, ?, ?)',
      [ids.fileId, libFileId, '2025-01-01T00:00:00.000Z']
    );

    const handler = dispatcher.methods.get('update-file-library-sync-status').handler;
    const result = await handler({ fileId: ids.fileId, libraryId: libFileId }, { profileId: ids.profileId });

    assert.ok(result.syncedAt);
    assert.doesNotMatch(result.syncedAt, /^2025-/);

    const row = pool.get('SELECT synced_at FROM file_library_sync WHERE file_id = ? AND library_file_id = ?', [ids.fileId, libFileId]);
    assert.ok(row.synced_at > '2025-01-01T00:00:00.000Z');
  });

  it('rejects if user lacks edit permission on file', async () => {
    const libFileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('file', {
      id: libFileId, project_id: ids.projectId, name: 'Lib',
      is_shared: '1', revn: 0, features: '[]', fonts: '[]',
      created_at: now, modified_at: now,
    });

    const nonMemberId = uuidv4();
    const handler = dispatcher.methods.get('update-file-library-sync-status').handler;

    await assert.rejects(
      () => handler({ fileId: ids.fileId, libraryId: libFileId }, { profileId: nonMemberId }),
      { code: 'access-denied' }
    );
  });
});

describe('Files RPC — ignore-file-library-sync-status', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('sets ignore_sync_until on file', async () => {
    const ignoreDate = '2026-12-31T23:59:59.000Z';

    const handler = dispatcher.methods.get('ignore-file-library-sync-status').handler;
    const result = await handler({ fileId: ids.fileId, date: ignoreDate }, { profileId: ids.profileId });

    assert.equal(result.id, ids.fileId);
    assert.equal(result.ignoreSyncUntil, ignoreDate);

    const row = pool.get('SELECT ignore_sync_until FROM file WHERE id = ?', [ids.fileId]);
    assert.equal(row.ignore_sync_until, ignoreDate);
  });

  it('updates ignore_sync_until when already set', async () => {
    pool.run('UPDATE file SET ignore_sync_until = ? WHERE id = ?', ['2025-06-01T00:00:00.000Z', ids.fileId]);

    const newDate = '2027-01-01T00:00:00.000Z';
    const handler = dispatcher.methods.get('ignore-file-library-sync-status').handler;
    const result = await handler({ fileId: ids.fileId, date: newDate }, { profileId: ids.profileId });

    assert.equal(result.ignoreSyncUntil, newDate);
  });

  it('rejects if user lacks edit permission', async () => {
    const nonMemberId = uuidv4();
    const handler = dispatcher.methods.get('ignore-file-library-sync-status').handler;

    await assert.rejects(
      () => handler({ fileId: ids.fileId, date: '2026-12-31T00:00:00.000Z' }, { profileId: nonMemberId }),
      { code: 'access-denied' }
    );
  });

  it('rejects access to a deleted file', async () => {
    const handler = dispatcher.methods.get('ignore-file-library-sync-status').handler;
    const now = new Date().toISOString();
    pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [now, ids.fileId]);

    await assert.rejects(
      () => handler({ fileId: ids.fileId, date: '2026-12-31T00:00:00.000Z' }, { profileId: ids.profileId }),
      { code: 'access-denied' }
    );
  });
});