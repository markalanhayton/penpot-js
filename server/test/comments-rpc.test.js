import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import registerCommentCommands from '../src/rpc/comments.js';

function captureHandlers(pool) {
  const handlers = {};
  const register = (name, def) => { handlers[name] = def.handler; };
  registerCommentCommands(register, pool);
  return handlers;
}

describe('rpc/comments — create-comment-thread', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('creates a thread and returns it', async () => {
    const result = await handlers['create-comment-thread'](
      { fileId: ids.fileId, pageId: 'page-1', content: 'Hello' },
      { profileId: ids.profileId }
    );
    assert.ok(result.id);
    assert.equal(result.ownerId, ids.profileId);

    const rows = pool.query('SELECT * FROM comment_thread WHERE file_id = ?', [ids.fileId]);
    assert.equal(rows.length, 1);
  });

  it('creates initial comment when content provided', async () => {
    await handlers['create-comment-thread'](
      { fileId: ids.fileId, pageId: 'page-1', content: 'First comment' },
      { profileId: ids.profileId }
    );

    const comments = pool.query('SELECT * FROM comment WHERE thread_id IN (SELECT id FROM comment_thread WHERE file_id = ?)', [ids.fileId]);
    assert.equal(comments.length, 1);
    assert.equal(comments[0].content, 'First comment');
  });

  it('creates thread without comment when no content', async () => {
    await handlers['create-comment-thread'](
      { fileId: ids.fileId, pageId: 'page-1' },
      { profileId: ids.profileId }
    );

    const comments = pool.query('SELECT * FROM comment');
    assert.equal(comments.length, 0);
  });
});

describe('rpc/comments — create-comment', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('adds a comment to a thread and increments seqn', async () => {
    const thread = await handlers['create-comment-thread'](
      { fileId: ids.fileId, pageId: 'page-1', content: 'First' },
      { profileId: ids.profileId }
    );

    await handlers['create-comment'](
      { threadId: thread.id, content: 'Second' },
      { profileId: ids.profileId }
    );

    const comments = await handlers['get-comments']({ threadId: thread.id });
    assert.equal(comments.length, 2);

    const threadRow = pool.get('SELECT seqn FROM comment_thread WHERE id = ?', [thread.id]);
    assert.equal(threadRow.seqn, 1);
  });
});

describe('rpc/comments — delete-comment', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('deletes a comment by id', async () => {
    const thread = await handlers['create-comment-thread'](
      { fileId: ids.fileId, pageId: 'page-1', content: 'C1' },
      { profileId: ids.profileId }
    );

    const comments = await handlers['get-comments']({ threadId: thread.id });
    assert.equal(comments.length, 1);

    await handlers['delete-comment']({ id: comments[0].id });

    const remaining = pool.query('SELECT * FROM comment WHERE thread_id = ?', [thread.id]);
    assert.equal(remaining.length, 0);
  });
});

describe('rpc/comments — delete-comment-thread', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('deletes thread and its comments', async () => {
    const thread = await handlers['create-comment-thread'](
      { fileId: ids.fileId, pageId: 'page-1', content: 'C1' },
      { profileId: ids.profileId }
    );

    await handlers['delete-comment-thread']({ id: thread.id });

    const threads = pool.query('SELECT * FROM comment_thread WHERE id = ?', [thread.id]);
    assert.equal(threads.length, 0);
    const comments = pool.query('SELECT * FROM comment WHERE thread_id = ?', [thread.id]);
    assert.equal(comments.length, 0);
  });
});

describe('rpc/comments — update-comment-thread-status', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('resolves a thread', async () => {
    const thread = await handlers['create-comment-thread'](
      { fileId: ids.fileId, pageId: 'page-1' },
      { profileId: ids.profileId }
    );

    const updated = await handlers['update-comment-thread-status'](
      { id: thread.id, isResolved: true },
      { profileId: ids.profileId }
    );
    assert.equal(updated.isResolved, '1');
  });
});

describe('rpc/comments — get-comment-threads', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns threads for a file', async () => {
    await handlers['create-comment-thread'](
      { fileId: ids.fileId, pageId: 'p1' },
      { profileId: ids.profileId }
    );
    await handlers['create-comment-thread'](
      { fileId: ids.fileId, pageId: 'p2' },
      { profileId: ids.profileId }
    );

    const threads = await handlers['get-comment-threads']({ fileId: ids.fileId });
    assert.equal(threads.length, 2);
  });

  it('returns empty array without fileId or teamId', async () => {
    const threads = await handlers['get-comment-threads']({});
    assert.deepEqual(threads, []);
  });
});

describe('rpc/comments — mark-all-threads-as-read', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('inserts comment_thread_status rows', async () => {
    const t1 = await handlers['create-comment-thread'](
      { fileId: ids.fileId, pageId: 'p1' },
      { profileId: ids.profileId }
    );

    const result = await handlers['mark-all-threads-as-read'](
      { threads: [t1.id] },
      { profileId: ids.profileId }
    );
    assert.equal(result.status, 'ok');

    const status = pool.get('SELECT * FROM comment_thread_status WHERE thread_id = ? AND profile_id = ?', [t1.id, ids.profileId]);
    assert.ok(status);
  });

  it('returns ok for empty threads array', async () => {
    const result = await handlers['mark-all-threads-as-read'](
      { threads: [] },
      { profileId: ids.profileId }
    );
    assert.equal(result.status, 'ok');
  });
});