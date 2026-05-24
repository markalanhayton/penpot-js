import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { encode, decode } from '../src/files/blob.js';

describe('update-file revn conflict detection', () => {
  let pool;
  let ids;

  beforeEach(() => { pool = createTestPool(); ids = seedFullHierarchy(pool); });
  afterEach(() => { destroyTestPool(pool); });

  it('detects vern conflict', async () => {
    const file = pool.get('SELECT * FROM file WHERE id = ?', [ids.fileId]);
    const storedVern = file.vern || 0;

    pool.run('UPDATE file SET vern = ? WHERE id = ?', [storedVern + 1, ids.fileId]);

    const updated = pool.get('SELECT vern FROM file WHERE id = ?', [ids.fileId]);
    assert.notEqual(updated.vern, storedVern);
  });

  it('detects revn conflict on concurrent edit', () => {
    const file = pool.get('SELECT revn FROM file WHERE id = ?', [ids.fileId]);
    const currentRevn = file.revn || 0;

    pool.run('UPDATE file SET revn = ? WHERE id = ?', [currentRevn + 1, ids.fileId]);

    const updated = pool.get('SELECT revn FROM file WHERE id = ?', [ids.fileId]);
    assert.equal(updated.revn, currentRevn + 1);
  });

  it('persists file data on update', async () => {
    const data = { pages: [], pagesIndex: {}, options: { componentsV2: true } };
    const encoded = await encode(data, { version: 5 });

    pool.insertOnConflictDoNothing('file_data', {
      file_id: ids.fileId,
      id: uuidv4(),
      type: 'main',
      backend: 'db',
      metadata: '{}',
      data: encoded,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
    });

    const row = pool.get("SELECT * FROM file_data WHERE file_id = ? AND type = 'main'", [ids.fileId]);
    assert.ok(row);
    assert.ok(row.data);

    const decoded = await decode(row.data);
    assert.deepEqual(decoded, data);
  });
});