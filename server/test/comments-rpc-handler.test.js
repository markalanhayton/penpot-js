import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import registerCommentCommands from '../src/rpc/comments.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

function seedThread(pool, overrides = {}) {
  const now = new Date().toISOString();
  const id = overrides.id || uuidv4();
  const fileId = overrides.fileId;
  const pageId = overrides.pageId || uuidv4();

  pool.insertReturning('comment_thread', {
    id,
    file_id: fileId,
    owner_id: overrides.ownerId,
    page_id: pageId,
    participants: JSON.stringify([overrides.ownerId]),
    seqn: 0,
    is_resolved: '0',
    position: overrides.position ? JSON.stringify(overrides.position) : '{}',
    created_at: now,
    modified_at: now,
  });

  return { threadId: id, pageId };
}

function seedComment(pool, overrides = {}) {
  const now = new Date().toISOString();
  const id = overrides.id || uuidv4();

  pool.insertReturning('comment', {
    id,
    thread_id: overrides.threadId,
    owner_id: overrides.ownerId,
    content: overrides.content || 'Test comment',
    created_at: now,
    modified_at: now,
  });

  return id;
}

describe('Comments RPC — delete-comment', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerCommentCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('deletes a comment by id', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });
    const commentId = seedComment(pool, { threadId, ownerId: ids.profileId });

    const handler = dispatcher.methods.get('delete-comment').handler;
    const result = await handler({ id: commentId }, { profileId: ids.profileId });
    assert.equal(result.id, commentId);

    const comment = pool.get('SELECT * FROM comment WHERE id = ?', [commentId]);
    assert.ok(!comment);
  });

  it('returns id even for non-existent comment', async () => {
    const handler = dispatcher.methods.get('delete-comment').handler;
    const fakeId = uuidv4();
    const result = await handler({ id: fakeId }, { profileId: ids.profileId });
    assert.equal(result.id, fakeId);
  });
});

describe('Comments RPC — delete-comment-thread', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerCommentCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('deletes a thread and its comments', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });
    const c1 = seedComment(pool, { threadId, ownerId: ids.profileId, content: 'C1' });
    const c2 = seedComment(pool, { threadId, ownerId: ids.profileId, content: 'C2' });

    const handler = dispatcher.methods.get('delete-comment-thread').handler;
    const result = await handler({ id: threadId }, { profileId: ids.profileId });
    assert.equal(result.id, threadId);

    const thread = pool.get('SELECT * FROM comment_thread WHERE id = ?', [threadId]);
    assert.ok(!thread);

    const comment1 = pool.get('SELECT * FROM comment WHERE id = ?', [c1]);
    assert.ok(!comment1);
    const comment2 = pool.get('SELECT * FROM comment WHERE id = ?', [c2]);
    assert.ok(!comment2);
  });

  it('returns id even for non-existent thread', async () => {
    const handler = dispatcher.methods.get('delete-comment-thread').handler;
    const fakeId = uuidv4();
    const result = await handler({ id: fakeId }, { profileId: ids.profileId });
    assert.equal(result.id, fakeId);
  });
});

describe('Comments RPC — update-comment-thread-status', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerCommentCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('resolves a thread', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });

    const handler = dispatcher.methods.get('update-comment-thread-status').handler;
    const result = await handler({ id: threadId, isResolved: true }, { profileId: ids.profileId });
    assert.equal(result.isResolved, '1');
  });

  it('reopens a resolved thread', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });
    pool.run("UPDATE comment_thread SET is_resolved = '1' WHERE id = ?", [threadId]);

    const handler = dispatcher.methods.get('update-comment-thread-status').handler;
    const result = await handler({ id: threadId, isResolved: false }, { profileId: ids.profileId });
    assert.equal(result.isResolved, '0');
  });

  it('updates modified_at when resolving', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });
    const before = pool.get('SELECT modified_at FROM comment_thread WHERE id = ?', [threadId]);

    const handler = dispatcher.methods.get('update-comment-thread-status').handler;
    await handler({ id: threadId, isResolved: true }, { profileId: ids.profileId });

    const after = pool.get('SELECT modified_at FROM comment_thread WHERE id = ?', [threadId]);
    assert.ok(after.modified_at >= before.modified_at);
  });
});

describe('Comments RPC — update-comment-thread', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerCommentCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('updates isResolved via update-comment-thread', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });

    const handler = dispatcher.methods.get('update-comment-thread').handler;
    const result = await handler({ id: threadId, isResolved: true }, { profileId: ids.profileId });
    assert.equal(result.isResolved, '1');
  });

  it('does not change isResolved when isResolved is undefined', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });

    const handler = dispatcher.methods.get('update-comment-thread').handler;
    const result = await handler({ id: threadId }, { profileId: ids.profileId });
    assert.equal(result.isResolved, '0');
  });
});

describe('Comments RPC — update-comment-thread-position', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerCommentCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('updates thread position', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });
    const newPos = { x: 100, y: 200 };

    const handler = dispatcher.methods.get('update-comment-thread-position').handler;
    const result = await handler({ id: threadId, position: newPos }, { profileId: ids.profileId });
    const parsedPosition = JSON.parse(result.position);
    assert.equal(parsedPosition.x, 100);
    assert.equal(parsedPosition.y, 200);
  });

  it('overwrites previous position', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId, position: { x: 1, y: 2 } });

    const handler = dispatcher.methods.get('update-comment-thread-position').handler;
    const result = await handler({ id: threadId, position: { x: 50 } }, { profileId: ids.profileId });
    const parsedPosition = JSON.parse(result.position);
    assert.equal(parsedPosition.x, 50);
    assert.ok(!parsedPosition.y);
  });
});

describe('Comments RPC — update-comment-thread-frame', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerCommentCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('sets frameId in position JSON', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });
    const frameId = uuidv4();

    const handler = dispatcher.methods.get('update-comment-thread-frame').handler;
    const result = await handler({ id: threadId, frameId }, { profileId: ids.profileId });
    const parsedPosition = JSON.parse(result.position);
    assert.equal(parsedPosition.frameId, frameId);
  });

  it('preserves existing position keys when adding frameId', async () => {
    const { threadId } = seedThread(pool, {
      fileId: ids.fileId,
      ownerId: ids.profileId,
      position: { x: 10, y: 20 },
    });
    const frameId = uuidv4();

    const handler = dispatcher.methods.get('update-comment-thread-frame').handler;
    const result = await handler({ id: threadId, frameId }, { profileId: ids.profileId });
    const parsedPosition = JSON.parse(result.position);
    assert.equal(parsedPosition.frameId, frameId);
    assert.equal(parsedPosition.x, 10);
    assert.equal(parsedPosition.y, 20);
  });

  it('throws not-found for non-existent thread', async () => {
    const handler = dispatcher.methods.get('update-comment-thread-frame').handler;
    await assert.rejects(
      () => handler({ id: uuidv4(), frameId: uuidv4() }, { profileId: ids.profileId }),
      { code: 'object-not-found' }
    );
  });
});

describe('Comments RPC — update-comment', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerCommentCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('updates comment content', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });
    const commentId = seedComment(pool, { threadId, ownerId: ids.profileId, content: 'Original' });

    const handler = dispatcher.methods.get('update-comment').handler;
    const result = await handler({ id: commentId, content: 'Updated content' }, { profileId: ids.profileId });
    assert.equal(result.content, 'Updated content');
  });

  it('updates modified_at', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });
    const commentId = seedComment(pool, { threadId, ownerId: ids.profileId });
    const before = pool.get('SELECT modified_at FROM comment WHERE id = ?', [commentId]);

    const handler = dispatcher.methods.get('update-comment').handler;
    await handler({ id: commentId, content: 'New' }, { profileId: ids.profileId });

    const after = pool.get('SELECT modified_at FROM comment WHERE id = ?', [commentId]);
    assert.ok(after.modified_at >= before.modified_at);
  });
});

describe('Comments RPC — get-profiles-for-file-comments', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerCommentCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns distinct profiles who commented on the file', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });
    seedComment(pool, { threadId, ownerId: ids.profileId, content: 'Hello' });

    const handler = dispatcher.methods.get('get-profiles-for-file-comments').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
    assert.equal(result[0].id, ids.profileId);
    assert.equal(result[0].fullname, 'Test User');
  });

  it('returns empty for file with no comments', async () => {
    const handler = dispatcher.methods.get('get-profiles-for-file-comments').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });

  it('returns multiple distinct profiles', async () => {
    const now = new Date().toISOString();
    const otherProfileId = uuidv4();
    pool.insertReturning('profile', {
      id: otherProfileId, fullname: 'Commenter', email: 'commenter@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });

    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });
    seedComment(pool, { threadId, ownerId: ids.profileId, content: 'From owner' });
    seedComment(pool, { threadId, ownerId: otherProfileId, content: 'From other' });

    const handler = dispatcher.methods.get('get-profiles-for-file-comments').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.length, 2);
    const profileIds = result.map(r => r.id);
    assert.ok(profileIds.includes(ids.profileId));
    assert.ok(profileIds.includes(otherProfileId));
  });

  it('excludes deleted profiles', async () => {
    const now = new Date().toISOString();
    const deletedProfileId = uuidv4();
    pool.insertReturning('profile', {
      id: deletedProfileId, fullname: 'Deleted', email: 'deleted-comm@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
      deleted_at: now,
    });

    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });
    seedComment(pool, { threadId, ownerId: ids.profileId, content: 'Active' });
    seedComment(pool, { threadId, ownerId: deletedProfileId, content: 'From deleted' });

    const handler = dispatcher.methods.get('get-profiles-for-file-comments').handler;
    const result = await handler({ fileId: ids.fileId }, { profileId: ids.profileId });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, ids.profileId);
  });
});

describe('Comments RPC — mark-all-threads-as-read', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerCommentCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns ok for empty threads array', async () => {
    const handler = dispatcher.methods.get('mark-all-threads-as-read').handler;
    const result = await handler({ threads: [] }, { profileId: ids.profileId });
    assert.deepEqual(result, { status: 'ok' });
  });

  it('returns ok when threads is not an array', async () => {
    const handler = dispatcher.methods.get('mark-all-threads-as-read').handler;
    const result = await handler({ threads: null }, { profileId: ids.profileId });
    assert.deepEqual(result, { status: 'ok' });
  });

  it('marks multiple threads as read for a profile', async () => {
    const { threadId: t1 } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });
    const { threadId: t2 } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });

    const handler = dispatcher.methods.get('mark-all-threads-as-read').handler;
    const result = await handler({ threads: [t1, t2] }, { profileId: ids.profileId });
    assert.deepEqual(result, { status: 'ok' });

    const s1 = pool.get('SELECT * FROM comment_thread_status WHERE thread_id = ? AND profile_id = ?', [t1, ids.profileId]);
    assert.ok(s1);

    const s2 = pool.get('SELECT * FROM comment_thread_status WHERE thread_id = ? AND profile_id = ?', [t2, ids.profileId]);
    assert.ok(s2);
  });

  it('upserts on conflict (re-marks already-read thread)', async () => {
    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });

    await dispatcher.methods.get('mark-all-threads-as-read').handler(
      { threads: [threadId] }, { profileId: ids.profileId }
    );

    const before = pool.get('SELECT modified_at FROM comment_thread_status WHERE thread_id = ? AND profile_id = ?', [threadId, ids.profileId]);

    const handler = dispatcher.methods.get('mark-all-threads-as-read').handler;
    await handler({ threads: [threadId] }, { profileId: ids.profileId });

    const after = pool.get('SELECT modified_at FROM comment_thread_status WHERE thread_id = ? AND profile_id = ?', [threadId, ids.profileId]);
    assert.ok(after.modified_at >= before.modified_at);
  });

  it('marks threads as read independently per profile', async () => {
    const otherProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: otherProfileId, fullname: 'Other', email: 'other-reader@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });

    const { threadId } = seedThread(pool, { fileId: ids.fileId, ownerId: ids.profileId });

    const handler = dispatcher.methods.get('mark-all-threads-as-read').handler;
    await handler({ threads: [threadId] }, { profileId: ids.profileId });

    const otherStatus = pool.get('SELECT * FROM comment_thread_status WHERE thread_id = ? AND profile_id = ?', [threadId, otherProfileId]);
    assert.ok(!otherStatus);
  });
});