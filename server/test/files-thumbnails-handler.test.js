import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import registerFilesThumbnailsCommands from '../src/rpc/files_thumbnails.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

function seedObjectThumbnail(pool, overrides = {}) {
  const now = new Date().toISOString();
  const mediaId = overrides.mediaId || uuidv4();
  const objectId = overrides.objectId || uuidv4();

  pool.insertOnConflictDoNothing('storage_object', {
    id: mediaId, size: 500, backend: 'fs',
    content_type: 'image/png', bucket: 'file-object-thumbnail',
    created_at: now, metadata: '{}',
  });

  pool.insertOnConflictDoNothing('file_tagged_object_thumbnail', {
    file_id: overrides.fileId,
    tag: overrides.tag || 'frame',
    object_id: objectId,
    media_id: mediaId,
    created_at: now,
    updated_at: now,
    deleted_at: overrides.deletedAt || null,
  });

  return { mediaId, objectId };
}

function seedFileThumbnail(pool, overrides = {}) {
  const now = new Date().toISOString();
  const mediaId = overrides.mediaId || uuidv4();

  pool.insertOnConflictDoNothing('storage_object', {
    id: mediaId, size: 800, backend: 'fs',
    content_type: 'image/jpeg', bucket: 'file-thumbnail',
    created_at: now, metadata: '{}',
  });

  pool.insertOnConflictDoNothing('file_thumbnail', {
    file_id: overrides.fileId,
    revn: overrides.revn || 0,
    media_id: mediaId,
    created_at: now,
    updated_at: now,
    deleted_at: overrides.deletedAt || null,
    props: JSON.stringify(overrides.props || {}),
  });

  return { mediaId };
}

describe('Files Thumbnails RPC — get-file-object-thumbnails', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFilesThumbnailsCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns empty object when no thumbnails exist', async () => {
    const handler = dispatcher.methods.get('get-file-object-thumbnails').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.deepEqual(result, {});
  });

  it('returns thumbnails for specific objectIds', async () => {
    const { mediaId: m1, objectId: o1 } = seedObjectThumbnail(pool, { fileId: ids.fileId });
    const { mediaId: m2, objectId: o2 } = seedObjectThumbnail(pool, { fileId: ids.fileId });
    seedObjectThumbnail(pool, { fileId: ids.fileId });

    const handler = dispatcher.methods.get('get-file-object-thumbnails').handler;
    const result = await handler(
      { fileId: ids.fileId, objectIds: [o1, o2] },
      { profileId: ids.profileId }
    );
    assert.equal(Object.keys(result).length, 2);
    assert.equal(result[o1], m1);
    assert.equal(result[o2], m2);
  });

  it('filters by tag', async () => {
    seedObjectThumbnail(pool, { fileId: ids.fileId, tag: 'frame' });
    seedObjectThumbnail(pool, { fileId: ids.fileId, tag: 'component' });

    const handler = dispatcher.methods.get('get-file-object-thumbnails').handler;
    const result = await handler(
      { fileId: ids.fileId, tag: 'component' },
      { profileId: ids.profileId }
    );
    assert.equal(Object.keys(result).length, 1);
  });

  it('returns all thumbnails when no filter provided', async () => {
    seedObjectThumbnail(pool, { fileId: ids.fileId });
    seedObjectThumbnail(pool, { fileId: ids.fileId });
    seedObjectThumbnail(pool, { fileId: ids.fileId });

    const handler = dispatcher.methods.get('get-file-object-thumbnails').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(Object.keys(result).length, 3);
  });

  it('excludes soft-deleted thumbnails', async () => {
    const now = new Date().toISOString();
    seedObjectThumbnail(pool, { fileId: ids.fileId, deletedAt: now });
    seedObjectThumbnail(pool, { fileId: ids.fileId });

    const handler = dispatcher.methods.get('get-file-object-thumbnails').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(Object.keys(result).length, 1);
  });
});

describe('Files Thumbnails RPC — get-file-data-for-thumbnail', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFilesThumbnailsCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns file data with pages', async () => {
    const pageId = uuidv4();
    const now = new Date().toISOString();
    pool.insertOnConflictDoNothing('page', {
      id: pageId, file_id: ids.fileId, name: 'Page 1', ordering: 0,
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('get-file-data-for-thumbnail').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.fileId, ids.fileId);
    assert.equal(result.revn, 0);
    assert.equal(result.pages.length, 1);
    assert.equal(result.pages[0].id, pageId);
  });

  it('returns empty pages array when file has no pages', async () => {
    const handler = dispatcher.methods.get('get-file-data-for-thumbnail').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.fileId, ids.fileId);
    assert.equal(result.pages.length, 0);
  });
});

describe('Files Thumbnails RPC — create-file-object-thumbnail', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFilesThumbnailsCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('throws validation error when media is missing', async () => {
    const handler = dispatcher.methods.get('create-file-object-thumbnail').handler;
    await assert.rejects(
      () => handler(
        { fileId: ids.fileId, objectId: uuidv4(), media: null },
        { profileId: ids.profileId }
      ),
      { code: 'validation-error' }
    );
  });

  it('throws validation error when media has neither path nor base64', async () => {
    const handler = dispatcher.methods.get('create-file-object-thumbnail').handler;
    await assert.rejects(
      () => handler(
        { fileId: ids.fileId, objectId: uuidv4(), media: {} },
        { profileId: ids.profileId }
      ),
      { code: 'validation-error' }
    );
  });

  it('throws authorization error when profile lacks edit access', async () => {
    const viewerProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: viewerProfileId, fullname: 'Viewer', email: 'viewer-thumb@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('create-file-object-thumbnail').handler;
    await assert.rejects(
      () => handler(
        { fileId: ids.fileId, objectId: uuidv4(), media: { path: '/tmp/fake.png', mtype: 'image/png', size: 100 } },
        { profileId: viewerProfileId }
      ),
      { code: 'access-denied' }
    );
  });
});

describe('Files Thumbnails RPC — delete-file-object-thumbnail', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFilesThumbnailsCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('soft-deletes an existing object thumbnail', async () => {
    const { objectId } = seedObjectThumbnail(pool, { fileId: ids.fileId });

    const handler = dispatcher.methods.get('delete-file-object-thumbnail').handler;
    const result = await handler(
      { fileId: ids.fileId, objectId },
      { profileId: ids.profileId }
    );
    assert.equal(result, null);

    const row = pool.get(
      'SELECT deleted_at FROM file_tagged_object_thumbnail WHERE file_id = ? AND object_id = ?',
      [ids.fileId, objectId]
    );
    assert.ok(row.deleted_at !== null);
  });

  it('returns null when thumbnail does not exist', async () => {
    const handler = dispatcher.methods.get('delete-file-object-thumbnail').handler;
    const result = await handler(
      { fileId: ids.fileId, objectId: uuidv4() },
      { profileId: ids.profileId }
    );
    assert.equal(result, null);
  });

  it('throws authorization error when profile lacks edit access', async () => {
    const { objectId } = seedObjectThumbnail(pool, { fileId: ids.fileId });

    const viewerProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: viewerProfileId, fullname: 'Viewer', email: 'viewer-del-thumb@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('delete-file-object-thumbnail').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId, objectId }, { profileId: viewerProfileId }),
      { code: 'access-denied' }
    );
  });
});

describe('Files Thumbnails RPC — create-file-thumbnail', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFilesThumbnailsCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('throws validation error when media is missing', async () => {
    const handler = dispatcher.methods.get('create-file-thumbnail').handler;
    await assert.rejects(
      () => handler(
        { fileId: ids.fileId, revn: 0, media: null },
        { profileId: ids.profileId }
      ),
      { code: 'validation-error' }
    );
  });

  it('throws validation error when media has neither path nor base64', async () => {
    const handler = dispatcher.methods.get('create-file-thumbnail').handler;
    await assert.rejects(
      () => handler(
        { fileId: ids.fileId, revn: 0, media: {} },
        { profileId: ids.profileId }
      ),
      { code: 'validation-error' }
    );
  });

  it('throws authorization error when profile lacks edit access', async () => {
    const viewerProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: viewerProfileId, fullname: 'Viewer', email: 'viewer-fthumb@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerProfileId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('create-file-thumbnail').handler;
    await assert.rejects(
      () => handler(
        { fileId: ids.fileId, revn: 0, media: { path: '/tmp/fake.png', mtype: 'image/png', size: 100 } },
        { profileId: viewerProfileId }
      ),
      { code: 'access-denied' }
    );
  });
});