import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import registerMediaCommands from '../src/rpc/media.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

describe('Media RPC — create-file-media-object-from-url', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerMediaCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('throws validation error when URL is missing', async () => {
    const handler = dispatcher.methods.get('create-file-media-object-from-url').handler;
    await assert.rejects(
      () => handler({ fileId: ids.fileId }, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });

  it('throws validation error when URL is empty string', async () => {
    const handler = dispatcher.methods.get('create-file-media-object-from-url').handler;
    await assert.rejects(
      () => handler({ url: '', fileId: ids.fileId }, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });

  it('throws authorization error when profile lacks edit access', async () => {
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

    const handler = dispatcher.methods.get('create-file-media-object-from-url').handler;
    await assert.rejects(
      () => handler({ url: 'https://example.com/img.png', fileId: ids.fileId }, { profileId: viewerProfileId }),
      { code: 'access-denied' }
    );
  });
});

describe('Media RPC — create-upload-session', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerMediaCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('creates an upload session and returns sessionId', async () => {
    const handler = dispatcher.methods.get('create-upload-session').handler;
    const result = await handler({ totalChunks: 5 }, { profileId: ids.profileId });
    assert.ok(result.sessionId);
    assert.equal(result.sessionId.length, 36);

    const session = pool.get('SELECT * FROM upload_session WHERE id = ?', [result.sessionId]);
    assert.ok(session);
    assert.equal(session.total_chunks, 5);
    assert.equal(session.profile_id, ids.profileId);
  });

  it('defaults totalChunks to 0 when not provided', async () => {
    const handler = dispatcher.methods.get('create-upload-session').handler;
    const result = await handler({}, { profileId: ids.profileId });

    const session = pool.get('SELECT * FROM upload_session WHERE id = ?', [result.sessionId]);
    assert.equal(session.total_chunks, 0);
  });

  it('throws restriction error when totalChunks exceeds max (100)', async () => {
    const handler = dispatcher.methods.get('create-upload-session').handler;
    await assert.rejects(
      () => handler({ totalChunks: 101 }, { profileId: ids.profileId }),
      { code: 'max-quote-reached' }
    );
  });

  it('allows exactly 100 chunks', async () => {
    const handler = dispatcher.methods.get('create-upload-session').handler;
    const result = await handler({ totalChunks: 100 }, { profileId: ids.profileId });
    assert.ok(result.sessionId);

    const session = pool.get('SELECT * FROM upload_session WHERE id = ?', [result.sessionId]);
    assert.equal(session.total_chunks, 100);
  });
});

describe('Media RPC — upload-chunk', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerMediaCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('throws validation error when session does not exist', async () => {
    const handler = dispatcher.methods.get('upload-chunk').handler;
    await assert.rejects(
      () => handler({
        sessionId: uuidv4(),
        index: 0,
        content: { path: '/tmp/fake', mtype: 'image/png', size: 100 },
      }, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });

  it('throws validation error for negative chunk index', async () => {
    const handler = dispatcher.methods.get('create-upload-session').handler;
    const session = await handler({ totalChunks: 3 }, { profileId: ids.profileId });

    const uploadHandler = dispatcher.methods.get('upload-chunk').handler;
    await assert.rejects(
      () => uploadHandler({
        sessionId: session.sessionId,
        index: -1,
        content: { path: '/tmp/fake', mtype: 'image/png', size: 100 },
      }, { profileId: ids.profileId }),
      { code: 'invalid-chunk-index' }
    );
  });

  it('throws validation error for chunk index >= totalChunks', async () => {
    const handler = dispatcher.methods.get('create-upload-session').handler;
    const session = await handler({ totalChunks: 3 }, { profileId: ids.profileId });

    const uploadHandler = dispatcher.methods.get('upload-chunk').handler;
    await assert.rejects(
      () => uploadHandler({
        sessionId: session.sessionId,
        index: 3,
        content: { path: '/tmp/fake', mtype: 'image/png', size: 100 },
      }, { profileId: ids.profileId }),
      { code: 'invalid-chunk-index' }
    );
  });
});

describe('Media RPC — assemble-file-media-object', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerMediaCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('throws validation error when session does not exist', async () => {
    const handler = dispatcher.methods.get('assemble-file-media-object').handler;
    await assert.rejects(
      () => handler({
        sessionId: uuidv4(),
        fileId: ids.fileId,
      }, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });

  it('throws authorization error when profile lacks edit access', async () => {
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

    const handler = dispatcher.methods.get('assemble-file-media-object').handler;
    await assert.rejects(
      () => handler({
        sessionId: uuidv4(),
        fileId: ids.fileId,
      }, { profileId: viewerProfileId }),
      { code: 'access-denied' }
    );
  });
});

describe('Media RPC — clone-file-media-object', () => {
  let pool;
  let dispatcher;
  let ids;
  let mediaId;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerMediaCommands(dispatcher.register, pool);

    const now = new Date().toISOString();
    mediaId = uuidv4();

    pool.insertOnConflictDoNothing('storage_object', {
      id: mediaId, size: 1024, backend: 'fs',
      content_type: 'image/png', bucket: 'file-media-object',
      created_at: now, metadata: '{}',
    });

    pool.insertOnConflictDoNothing('file_media_object', {
      id: uuidv4(),
      file_id: ids.fileId,
      name: 'test-image',
      width: 100,
      height: 100,
      mtype: 'image/png',
      media_id: mediaId,
      thumbnail_id: null,
      created_at: now,
      modified_at: now,
    });
  });

  afterEach(() => { destroyTestPool(pool); });

  it('throws not-found for non-existent media object', async () => {
    const handler = dispatcher.methods.get('clone-file-media-object').handler;
    await assert.rejects(
      () => handler({ id: uuidv4(), fileId: ids.fileId }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });

  it('throws not-found for soft-deleted media object', async () => {
    const deletedMediaId = uuidv4();
    const now = new Date().toISOString();
    pool.insertOnConflictDoNothing('file_media_object', {
      id: deletedMediaId,
      file_id: ids.fileId,
      name: 'deleted-image',
      width: 50,
      height: 50,
      mtype: 'image/jpeg',
      media_id: mediaId,
      created_at: now,
      modified_at: now,
      deleted_at: now,
    });

    const handler = dispatcher.methods.get('clone-file-media-object').handler;
    await assert.rejects(
      () => handler({ id: deletedMediaId, fileId: ids.fileId }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });
});