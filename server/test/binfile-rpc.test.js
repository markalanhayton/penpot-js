import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuidv4 } from 'uuid';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { RpcError } from '../src/rpc/dispatcher.js';
import { encode } from '../src/files/blob.js';
import registerBinfileCommands from '../src/rpc/binfile.js';

function captureHandlers(pool) {
  const handlers = {};
  const register = (name, def) => { handlers[name] = def.handler; };
  registerBinfileCommands(register, pool);
  return handlers;
}

describe('rpc/binfile — export-binfile', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('exports a file as a ZIP archive with manifest', async () => {
    const fileData = {
      pages: [{ id: 'p1', name: 'Page 1', objects: {} }],
      pagesIndex: { p1: { id: 'p1', name: 'Page 1', objects: {} } },
      components: {},
      media: {},
      colors: [],
      typographies: [],
    };
    const encoded = await encode(fileData, { version: 5 });
    pool.insertOnConflictDoNothing('file_data', {
      id: uuidv4(),
      file_id: ids.fileId,
      type: 'main',
      data: encoded,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
    });

    const result = await handlers['export-binfile'](
      { fileId: ids.fileId },
      { profileId: ids.profileId }
    );

    assert.ok(result.id);
    assert.ok(result.uri);
    assert.ok(result.name.endsWith('.penpot'));
  });

  it('throws authorization for non-member', async () => {
    const now = new Date().toISOString();
    const outsiderId = 'outsider-export';
    pool.insertReturning('profile', {
      id: outsiderId, fullname: 'Outsider', email: 'outsider-export@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['export-binfile'](
        { fileId: ids.fileId },
        { profileId: outsiderId }
      ),
      { type: 'authorization' }
    );
  });

  it('throws authorization for deleted file (permissions checked first)', async () => {
    pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), ids.fileId]);

    await assert.rejects(
      () => handlers['export-binfile'](
        { fileId: ids.fileId },
        { profileId: ids.profileId }
      ),
      { type: 'authorization' }
    );
  });

  it('throws authorization for nonexistent file (permissions checked first)', async () => {
    await assert.rejects(
      () => handlers['export-binfile'](
        { fileId: uuidv4() },
        { profileId: ids.profileId }
      ),
      { type: 'authorization' }
    );
  });

  it('throws not-found when file has no data', async () => {
    await assert.rejects(
      () => handlers['export-binfile'](
        { fileId: ids.fileId },
        { profileId: ids.profileId }
      ),
      { type: 'not-found' }
    );
  });
});

describe('rpc/binfile — import-binfile', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('throws authorization for non-editor', async () => {
    const now = new Date().toISOString();
    const viewerId = 'viewer-import';
    pool.insertReturning('profile', {
      id: viewerId, fullname: 'Viewer', email: 'viewer-import@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['import-binfile'](
        { projectId: ids.projectId, file: Buffer.from('test') },
        { profileId: viewerId }
      ),
      { type: 'authorization' }
    );
  });

  it('throws not-found for nonexistent project', async () => {
    await assert.rejects(
      () => handlers['import-binfile'](
        { projectId: uuidv4(), file: Buffer.from('test') },
        { profileId: ids.profileId }
      ),
      { type: 'not-found' }
    );
  });

  it('throws validation when no file data provided', async () => {
    await assert.rejects(
      () => handlers['import-binfile'](
        { projectId: ids.projectId },
        { profileId: ids.profileId }
      ),
      { type: 'validation' }
    );
  });

  it('imports a blob-format file', async () => {
    const fileData = {
      pages: [{ id: 'p1', name: 'Page 1', objects: {} }],
      pagesIndex: { p1: { id: 'p1', name: 'Page 1', objects: {} } },
      components: {},
      media: {},
      colors: [],
      typographies: [],
    };
    const encoded = await encode(fileData, { version: 5 });

    const result = await handlers['import-binfile'](
      { projectId: ids.projectId, name: 'Imported File', file: Buffer.from(encoded) },
      { profileId: ids.profileId }
    );

    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);

    const newFile = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', [result[0]]);
    assert.ok(newFile);
    assert.equal(newFile.name, 'Imported File');
    assert.equal(newFile.project_id, ids.projectId);
  });

  it('imports a JSON-format file', async () => {
    const fileData = {
      pages: [{ id: 'p1', name: 'Page 1', objects: {} }],
      pagesIndex: { p1: { id: 'p1', name: 'Page 1', objects: {} } },
      components: {},
      media: {},
      colors: [],
      typographies: [],
    };
    const jsonBuf = Buffer.from(JSON.stringify(fileData));

    const result = await handlers['import-binfile'](
      { projectId: ids.projectId, name: 'JSON Import', file: jsonBuf },
      { profileId: ids.profileId }
    );

    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);

    const newFile = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', [result[0]]);
    assert.ok(newFile);
    assert.equal(newFile.name, 'JSON Import');
  });
});

describe('rpc/binfile — get-export-status', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns completed status for existing storage object', async () => {
    const fileData = {
      pages: [{ id: 'p1', name: 'Page 1', objects: {} }],
      pagesIndex: { p1: { id: 'p1', name: 'Page 1', objects: {} } },
      components: {},
      media: {},
      colors: [],
      typographies: [],
    };
    const encoded = await encode(fileData, { version: 5 });
    pool.insertOnConflictDoNothing('file_data', {
      id: uuidv4(),
      file_id: ids.fileId,
      type: 'main',
      data: encoded,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
    });

    const exportResult = await handlers['export-binfile'](
      { fileId: ids.fileId },
      { profileId: ids.profileId }
    );

    const status = await handlers['get-export-status'](
      { id: exportResult.id },
      { profileId: ids.profileId }
    );

    assert.equal(status.status, 'completed');
    assert.equal(status.id, exportResult.id);
    assert.ok(status.size > 0);
    assert.equal(status.contentType, 'application/zip');
  });

  it('returns not-found for nonexistent export', async () => {
    const result = await handlers['get-export-status'](
      { id: uuidv4() },
      { profileId: ids.profileId }
    );

    assert.equal(result.status, 'not-found');
  });

  it('throws validation when id is missing', async () => {
    await assert.rejects(
      () => handlers['get-export-status']({}, { profileId: ids.profileId }),
      { type: 'validation' }
    );
  });

  it('returns not-found for deleted storage object', async () => {
    const fileData = {
      pages: [{ id: 'p1', name: 'Page 1', objects: {} }],
      pagesIndex: { p1: { id: 'p1', name: 'Page 1', objects: {} } },
      components: {},
      media: {},
      colors: [],
      typographies: [],
    };
    const encoded = await encode(fileData, { version: 5 });
    pool.insertOnConflictDoNothing('file_data', {
      id: uuidv4(),
      file_id: ids.fileId,
      type: 'main',
      data: encoded,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
    });

    const exportResult = await handlers['export-binfile'](
      { fileId: ids.fileId },
      { profileId: ids.profileId }
    );

    pool.run('UPDATE storage_object SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), exportResult.id]);

    const status = await handlers['get-export-status'](
      { id: exportResult.id },
      { profileId: ids.profileId }
    );

    assert.equal(status.status, 'not-found');
  });
});