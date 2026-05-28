import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { encode } from '../src/files/blob.js';
import registerFileUpdateCommands from '../src/rpc/files_update.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

function makePage(pageId, pageName) {
  return {
    id: pageId,
    name: pageName || 'Page 1',
    objects: {},
  };
}

function makeFileData(pages) {
  const pagesIndex = {};
  const pageIds = [];
  for (const p of pages) {
    pagesIndex[p.id] = p;
    pageIds.push(p.id);
  }
  return {
    pages: pageIds,
    pagesIndex,
    components: {},
    media: {},
    colors: [],
    typographies: {},
  };
}

async function seedFileWithData(pool, fileId, data) {
  const encoded = await encode(data, { version: 5 });
  pool.insertOnConflictDoNothing('file_data', {
    file_id: fileId,
    id: uuidv4(),
    type: 'main',
    backend: 'db',
    metadata: '{}',
    data: encoded,
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
  });
}

describe('Files Update RPC — update-file', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileUpdateCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('rejects non-existent file', async () => {
    const handler = dispatcher.methods.get('update-file').handler;
    const fakeFileId = uuidv4();
    await assert.rejects(
      () => handler(
        { id: fakeFileId, sessionId: uuidv4(), revn: 0, changes: [] },
        { profileId: ids.profileId },
      ),
      { code: 'access-denied' },
    );
  });

  it('rejects when revn is greater than stored revn (conflict)', async () => {
    const handler = dispatcher.methods.get('update-file').handler;
    await assert.rejects(
      () => handler(
        { id: ids.fileId, sessionId: uuidv4(), revn: 99, changes: [{ type: 'mod-page', id: 'x', operations: [] }] },
        { profileId: ids.profileId },
      ),
      { code: 'revn-conflict' },
    );
  });

  it('rejects when vern mismatch', async () => {
    pool.run('UPDATE file SET vern = 5 WHERE id = ?', [ids.fileId]);

    const handler = dispatcher.methods.get('update-file').handler;
    await assert.rejects(
      () => handler(
        { id: ids.fileId, sessionId: uuidv4(), revn: 0, vern: 3, changes: [{ type: 'mod-page', id: 'x' }] },
        { profileId: ids.profileId },
      ),
      { code: 'vern-conflict' },
    );
  });

  it('returns early with no increment when changes array is empty', async () => {
    const handler = dispatcher.methods.get('update-file').handler;
    const result = await handler(
      { id: ids.fileId, sessionId: uuidv4(), revn: 0, changes: [] },
      { profileId: ids.profileId },
    );

    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
    assert.equal(result[0].revn, 0);
    assert.deepEqual(result[0].changes, []);

    const file = pool.get('SELECT revn FROM file WHERE id = ?', [ids.fileId]);
    assert.equal(file.revn, 0);
  });

  it('increments revn on successful update', async () => {
    const pageId = uuidv4();
    const data = makeFileData([makePage(pageId, 'Page 1')]);
    await seedFileWithData(pool, ids.fileId, data);

    const handler = dispatcher.methods.get('update-file').handler;
    const sessionId = uuidv4();
    const result = await handler(
      {
        id: ids.fileId,
        sessionId,
        revn: 0,
        changes: [{ type: 'mod-page', id: pageId, operations: [{ type: 'set', attr: 'name', val: 'Renamed Page' }] }],
      },
      { profileId: ids.profileId },
    );

    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
    assert.equal(result[0].revn, 1);
    assert.equal(result[0].fileId, ids.fileId);

    const file = pool.get('SELECT revn FROM file WHERE id = ?', [ids.fileId]);
    assert.equal(file.revn, 1);
  });

  it('processes mod-obj changes (modify object)', async () => {
    const pageId = uuidv4();
    const shapeId = uuidv4();
    const page = makePage(pageId, 'Page 1');
    page.objects[pageId] = { id: pageId, name: 'Page 1', shapes: [shapeId] };
    page.objects[shapeId] = { id: shapeId, type: 'rect', x: 10, y: 20, parentId: pageId };
    const data = makeFileData([page]);
    await seedFileWithData(pool, ids.fileId, data);

    const handler = dispatcher.methods.get('update-file').handler;
    const result = await handler(
      {
        id: ids.fileId,
        sessionId: uuidv4(),
        revn: 0,
        changes: [{ type: 'mod-obj', id: shapeId, pageId, operations: [{ type: 'set', attr: 'x', val: 100 }] }],
      },
      { profileId: ids.profileId },
    );

    assert.equal(result[0].revn, 1);

    const fileData = pool.get('SELECT data FROM file_data WHERE file_id = ? AND type = ?', [ids.fileId, 'main']);
    assert.ok(fileData);
  });

  it('processes add-obj changes (add object)', async () => {
    const pageId = uuidv4();
    const newShapeId = uuidv4();
    const page = makePage(pageId, 'Page 1');
    page.objects[pageId] = { id: pageId, name: 'Page 1', shapes: [] };
    const data = makeFileData([page]);
    await seedFileWithData(pool, ids.fileId, data);

    const handler = dispatcher.methods.get('update-file').handler;
    const result = await handler(
      {
        id: ids.fileId,
        sessionId: uuidv4(),
        revn: 0,
        changes: [{
          type: 'add-obj',
          pageId,
          parentId: pageId,
          obj: { id: newShapeId, type: 'rect', x: 0, y: 0, parentId: pageId },
        }],
      },
      { profileId: ids.profileId },
    );

    assert.equal(result[0].revn, 1);
  });

  it('processes del-obj changes (delete object)', async () => {
    const pageId = uuidv4();
    const shapeId = uuidv4();
    const page = makePage(pageId, 'Page 1');
    page.objects[pageId] = { id: pageId, name: 'Page 1', shapes: [shapeId] };
    page.objects[shapeId] = { id: shapeId, type: 'rect', parentId: pageId };
    const data = makeFileData([page]);
    await seedFileWithData(pool, ids.fileId, data);

    const handler = dispatcher.methods.get('update-file').handler;
    const result = await handler(
      {
        id: ids.fileId,
        sessionId: uuidv4(),
        revn: 0,
        changes: [{ type: 'del-obj', id: shapeId, pageId }],
      },
      { profileId: ids.profileId },
    );

    assert.equal(result[0].revn, 1);
  });

  it('processes mod-page changes', async () => {
    const pageId = uuidv4();
    const data = makeFileData([makePage(pageId, 'Original')]);
    await seedFileWithData(pool, ids.fileId, data);

    const handler = dispatcher.methods.get('update-file').handler;
    const result = await handler(
      {
        id: ids.fileId,
        sessionId: uuidv4(),
        revn: 0,
        changes: [{ type: 'mod-page', id: pageId, operations: [{ type: 'set', attr: 'name', val: 'Updated Page' }] }],
      },
      { profileId: ids.profileId },
    );

    assert.equal(result[0].revn, 1);
  });

  it('records change in file_change table', async () => {
    const pageId = uuidv4();
    const data = makeFileData([makePage(pageId, 'Page 1')]);
    await seedFileWithData(pool, ids.fileId, data);

    const handler = dispatcher.methods.get('update-file').handler;
    const sessionId = uuidv4();
    await handler(
      {
        id: ids.fileId,
        sessionId,
        revn: 0,
        changes: [{ type: 'mod-page', id: pageId, operations: [{ type: 'set', attr: 'name', val: 'New' }] }],
      },
      { profileId: ids.profileId },
    );

    const changes = pool.query('SELECT * FROM file_change WHERE file_id = ?', [ids.fileId]);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].revn, 1);
    assert.equal(changes[0].session_id, sessionId);
    assert.equal(changes[0].profile_id, ids.profileId);
  });
});

describe('Files Update RPC — get-file-changes', () => {
  let pool;
  let dispatcher;
  let id;

  beforeEach(() => {
    pool = createTestPool();
    id = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFileUpdateCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns empty changes for file with no changes', async () => {
    const handler = dispatcher.methods.get('get-file-changes').handler;
    const result = await handler({ id: id.fileId, since: 0 }, { profileId: id.profileId });
    assert.ok(result);
    assert.ok(Array.isArray(result.changes));
    assert.equal(result.changes.length, 0);
  });

  it('returns changes since a given revn', async () => {
    const pageId = uuidv4();
    const data = makeFileData([makePage(pageId, 'Page 1')]);
    await seedFileWithData(pool, id.fileId, data);

    const updateHandler = dispatcher.methods.get('update-file').handler;
    await updateHandler(
      {
        id: id.fileId,
        sessionId: uuidv4(),
        revn: 0,
        changes: [{ type: 'mod-page', id: pageId, operations: [{ type: 'set', attr: 'name', val: 'First' }] }],
      },
      { profileId: id.profileId },
    );

    const handler = dispatcher.methods.get('get-file-changes').handler;
    const result = await handler({ id: id.fileId, since: 0 }, { profileId: id.profileId });
    assert.ok(Array.isArray(result.changes));
    assert.equal(result.changes.length, 1);
    assert.equal(result.changes[0].revn, 1);
  });

  it('excludes changes at or before since revn', async () => {
    const pageId = uuidv4();
    const data = makeFileData([makePage(pageId, 'Page 1')]);
    await seedFileWithData(pool, id.fileId, data);

    const updateHandler = dispatcher.methods.get('update-file').handler;
    await updateHandler(
      {
        id: id.fileId,
        sessionId: uuidv4(),
        revn: 0,
        changes: [{ type: 'mod-page', id: pageId, operations: [{ type: 'set', attr: 'name', val: 'First' }] }],
      },
      { profileId: id.profileId },
    );

    const handler = dispatcher.methods.get('get-file-changes').handler;
    const result = await handler({ id: id.fileId, since: 1 }, { profileId: id.profileId });
    assert.ok(Array.isArray(result.changes));
    assert.equal(result.changes.length, 0);
  });

  it('throws for non-existent file', async () => {
    const handler = dispatcher.methods.get('get-file-changes').handler;
    await assert.rejects(
      () => handler({ id: uuidv4(), since: 0 }, { profileId: id.profileId }),
      { code: 'object-not-found' },
    );
  });
});