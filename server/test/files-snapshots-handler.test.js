import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import registerFileSnapshotCommands from '../src/rpc/files_snapshots.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

function seedSnapshot(pool, overrides = {}) {
  const now = new Date().toISOString();
  const id = overrides.id || uuidv4();

  pool.insertOnConflictDoNothing('file_snapshot', {
    id,
    file_id: overrides.fileId,
    label: overrides.label || 'Test Snapshot',
    revn: overrides.revn || 0,
    is_locked: overrides.isLocked || '0',
    data: overrides.data || null,
    created_at: overrides.createdAt || now,
    modified_at: overrides.modifiedAt || now,
    deleted_at: overrides.deletedAt || null,
  });

  return id;
}

describe('Files Snapshots RPC — get-file-snapshots', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileSnapshotCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns empty array when no snapshots exist', async () => {
    const handler = dispatcher.methods.get('get-file-snapshots').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.length, 0);
  });

  it('returns snapshots for a file', async () => {
    seedSnapshot(pool, { fileId: ids.fileId, label: 'Snap 1' });
    seedSnapshot(pool, { fileId: ids.fileId, label: 'Snap 2' });

    const handler = dispatcher.methods.get('get-file-snapshots').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.length, 2);
  });

  it('excludes soft-deleted snapshots', async () => {
    const now = new Date().toISOString();
    seedSnapshot(pool, { fileId: ids.fileId, deletedAt: now });
    seedSnapshot(pool, { fileId: ids.fileId });

    const handler = dispatcher.methods.get('get-file-snapshots').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.length, 1);
  });
});

describe('Files Snapshots RPC — get-file-snapshot', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileSnapshotCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns a single snapshot by id', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId, label: 'My Snapshot' });

    const handler = dispatcher.methods.get('get-file-snapshot').handler;
    const result = await handler(
      { fileId: ids.fileId, snapshotId },
      { profileId: ids.profileId }
    );
    assert.equal(result.id, snapshotId);
    assert.equal(result.label, 'My Snapshot');
  });

  it('throws not-found for non-existent snapshot', async () => {
    const handler = dispatcher.methods.get('get-file-snapshot').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId, snapshotId: uuidv4() }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });

  it('throws not-found for soft-deleted snapshot', async () => {
    const now = new Date().toISOString();
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId, deletedAt: now });

    const handler = dispatcher.methods.get('get-file-snapshot').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId, snapshotId }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });

  it('throws not-found when snapshot belongs to different file', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId });

    const otherFileId = uuidv4();
    const handler = dispatcher.methods.get('get-file-snapshot').handler;
    await assert.rejects(
      () => handler({ fileId: otherFileId, snapshotId }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });
});

describe('Files Snapshots RPC — create-file-snapshot', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileSnapshotCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('creates a snapshot with a custom label', async () => {
    const handler = dispatcher.methods.get('create-file-snapshot').handler;
    const result = await handler(
      { fileId: ids.fileId, label: 'v1 release' },
      { profileId: ids.profileId }
    );
    assert.equal(result.label, 'v1 release');
    assert.equal(result.isLocked, '0');
    assert.ok(result.id);

    const row = pool.get('SELECT * FROM file_snapshot WHERE id = ?', [result.id]);
    assert.ok(row);
    assert.equal(row.label, 'v1 release');
  });

  it('creates a snapshot with default label when label is omitted', async () => {
    pool.run('UPDATE file SET revn = ? WHERE id = ?', [5, ids.fileId]);

    const handler = dispatcher.methods.get('create-file-snapshot').handler;
    const result = await handler(
      { fileId: ids.fileId },
      { profileId: ids.profileId }
    );
    assert.equal(result.label, 'Snapshot at rev 5');
  });

  it('throws access-denied for non-existent file', async () => {
    const handler = dispatcher.methods.get('create-file-snapshot').handler;
    await assert.rejects(
      () => handler({ fileId: uuidv4(), label: 'bad' }, { profileId: ids.profileId }),
      { code: 'access-denied' }
    );
  });

  it('throws authorization error when profile lacks edit access', async () => {
    const viewerProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: viewerProfileId, fullname: 'Viewer', email: 'viewer-snap@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('create-file-snapshot').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId, label: 'nope' }, { profileId: viewerProfileId }),
      { code: 'access-denied' }
    );
  });
});

describe('Files Snapshots RPC — restore-file-snapshot', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileSnapshotCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('restores file data from a snapshot', async () => {
    const snapshotData = JSON.stringify({ pages: [], version: 1 });
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId, data: snapshotData });

    const handler = dispatcher.methods.get('restore-file-snapshot').handler;
    const result = await handler(
      { fileId: ids.fileId, snapshotId },
      { profileId: ids.profileId }
    );
    assert.equal(result.id, ids.fileId);

    const file = pool.get('SELECT data FROM file WHERE id = ?', [ids.fileId]);
    assert.equal(file.data, snapshotData);
  });

  it('throws not-found for non-existent snapshot', async () => {
    const handler = dispatcher.methods.get('restore-file-snapshot').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId, snapshotId: uuidv4() }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });

  it('throws authorization error when profile lacks edit access', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId });

    const viewerProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: viewerProfileId, fullname: 'Viewer', email: 'viewer-snap-restore@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('restore-file-snapshot').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId, snapshotId }, { profileId: viewerProfileId }),
      { code: 'access-denied' }
    );
  });
});

describe('Files Snapshots RPC — update-file-snapshot', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileSnapshotCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('updates snapshot label', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId, label: 'Before' });

    const handler = dispatcher.methods.get('update-file-snapshot').handler;
    const result = await handler(
      { fileId: ids.fileId, snapshotId, label: 'After' },
      { profileId: ids.profileId }
    );
    assert.equal(result.label, 'After');

    const row = pool.get('SELECT label FROM file_snapshot WHERE id = ?', [snapshotId]);
    assert.equal(row.label, 'After');
  });

  it('preserves existing label when new label is not provided', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId, label: 'Keep Me' });

    const handler = dispatcher.methods.get('update-file-snapshot').handler;
    const result = await handler(
      { fileId: ids.fileId, snapshotId },
      { profileId: ids.profileId }
    );
    assert.equal(result.label, 'Keep Me');
  });

  it('throws not-found for non-existent snapshot', async () => {
    const handler = dispatcher.methods.get('update-file-snapshot').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId, snapshotId: uuidv4(), label: 'x' }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });

  it('throws not-found for soft-deleted snapshot', async () => {
    const now = new Date().toISOString();
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId, deletedAt: now });

    const handler = dispatcher.methods.get('update-file-snapshot').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId, snapshotId, label: 'x' }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });

  it('updates modified_at', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId });
    const before = pool.get('SELECT modified_at FROM file_snapshot WHERE id = ?', [snapshotId]);

    const handler = dispatcher.methods.get('update-file-snapshot').handler;
    await handler(
      { fileId: ids.fileId, snapshotId, label: 'Updated' },
      { profileId: ids.profileId }
    );

    const after = pool.get('SELECT modified_at FROM file_snapshot WHERE id = ?', [snapshotId]);
    assert.ok(after.modified_at >= before.modified_at);
  });
});

describe('Files Snapshots RPC — delete-file-snapshot', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileSnapshotCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('soft-deletes a snapshot', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId });

    const handler = dispatcher.methods.get('delete-file-snapshot').handler;
    const result = await handler(
      { fileId: ids.fileId, snapshotId },
      { profileId: ids.profileId }
    );
    assert.equal(result, null);

    const row = pool.get('SELECT deleted_at FROM file_snapshot WHERE id = ?', [snapshotId]);
    assert.ok(row.deleted_at !== null);
  });

  it('throws not-found for non-existent snapshot', async () => {
    const handler = dispatcher.methods.get('delete-file-snapshot').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId, snapshotId: uuidv4() }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });
});

describe('Files Snapshots RPC — lock-file-snapshot', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileSnapshotCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('locks an unlocked snapshot', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId, isLocked: '0' });

    const handler = dispatcher.methods.get('lock-file-snapshot').handler;
    const result = await handler(
      { fileId: ids.fileId, snapshotId },
      { profileId: ids.profileId }
    );
    assert.equal(result.isLocked, '1');
    assert.equal(result.id, snapshotId);
  });

  it('keeps a locked snapshot locked', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId, isLocked: '1' });

    const handler = dispatcher.methods.get('lock-file-snapshot').handler;
    const result = await handler(
      { fileId: ids.fileId, snapshotId },
      { profileId: ids.profileId }
    );
    assert.equal(result.isLocked, '1');
  });

  it('updates modified_at when locking', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId });
    const before = pool.get('SELECT modified_at FROM file_snapshot WHERE id = ?', [snapshotId]);

    const handler = dispatcher.methods.get('lock-file-snapshot').handler;
    await handler({ fileId: ids.fileId, snapshotId }, { profileId: ids.profileId });

    const after = pool.get('SELECT modified_at FROM file_snapshot WHERE id = ?', [snapshotId]);
    assert.ok(after.modified_at >= before.modified_at);
  });

  it('throws authorization error when profile lacks edit access', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId });

    const viewerProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: viewerProfileId, fullname: 'Viewer', email: 'viewer-snap-lock@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('lock-file-snapshot').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId, snapshotId }, { profileId: viewerProfileId }),
      { code: 'access-denied' }
    );
  });
});

describe('Files Snapshots RPC — unlock-file-snapshot', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileSnapshotCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('unlocks a locked snapshot', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId, isLocked: '1' });

    const handler = dispatcher.methods.get('unlock-file-snapshot').handler;
    const result = await handler(
      { fileId: ids.fileId, snapshotId },
      { profileId: ids.profileId }
    );
    assert.equal(result.isLocked, '0');
    assert.equal(result.id, snapshotId);
  });

  it('keeps an unlocked snapshot unlocked', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId, isLocked: '0' });

    const handler = dispatcher.methods.get('unlock-file-snapshot').handler;
    const result = await handler(
      { fileId: ids.fileId, snapshotId },
      { profileId: ids.profileId }
    );
    assert.equal(result.isLocked, '0');
  });

  it('updates modified_at when unlocking', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId, isLocked: '1' });
    const before = pool.get('SELECT modified_at FROM file_snapshot WHERE id = ?', [snapshotId]);

    const handler = dispatcher.methods.get('unlock-file-snapshot').handler;
    await handler({ fileId: ids.fileId, snapshotId }, { profileId: ids.profileId });

    const after = pool.get('SELECT modified_at FROM file_snapshot WHERE id = ?', [snapshotId]);
    assert.ok(after.modified_at >= before.modified_at);
  });

  it('throws authorization error when profile lacks edit access', async () => {
    const snapshotId = seedSnapshot(pool, { fileId: ids.fileId, isLocked: '1' });

    const viewerProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: viewerProfileId, fullname: 'Viewer', email: 'viewer-snap-unlock@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('unlock-file-snapshot').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId, snapshotId }, { profileId: viewerProfileId }),
      { code: 'access-denied' }
    );
  });
});