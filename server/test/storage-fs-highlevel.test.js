import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { ensureStorageDir, storeObject, retrieveObject, deleteObject, objectExists,
  calculateHash, VALID_BUCKETS, putStorageObject, touchStorageObject,
  deleteStorageObject, getStorageObject, getStorageObjectData, getStorageObjectUrl, getStorageObjectPath } from '../src/storage/fs.js';

describe('storage/fs high-level operations', () => {
  let pool;

  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('putStorageObject creates DB row and stores file', () => {
    const data = Buffer.from('test-media-content');
    const result = putStorageObject(pool, data, { bucket: 'file-media-object', contentType: 'image/png' });
    assert.ok(result.id);
    assert.equal(result.backend, 'fs');
    assert.equal(result.contentType, 'image/png');
    assert.equal(result.bucket, 'file-media-object');

    const obj = getStorageObject(pool, result.id);
    assert.ok(obj);
    assert.equal(obj.bucket, 'file-media-object');
  });

  it('putStorageObject rejects invalid bucket', () => {
    assert.throws(() => putStorageObject(pool, Buffer.from('x'), { bucket: 'invalid-bucket' }), /Invalid storage bucket/);
  });

  it('touchStorageObject updates touched_at', () => {
    const result = putStorageObject(pool, Buffer.from('touched'), { bucket: 'tempfile' });
    const before = getStorageObject(pool, result.id);
    assert.equal(before.touched_at, null);

    touchStorageObject(pool, result.id, '2025-01-01T00:00:00Z');
    const after = getStorageObject(pool, result.id);
    assert.ok(after.touched_at);
  });

  it('deleteStorageObject soft-deletes row', () => {
    const result = putStorageObject(pool, Buffer.from('deleteme'), { bucket: 'tempfile' });
    deleteStorageObject(pool, result.id);
    const obj = getStorageObject(pool, result.id);
    assert.ok(obj.deleted_at);
  });

  it('getStorageObjectData retrieves file data', () => {
    const content = Buffer.from('readback-test');
    const result = putStorageObject(pool, content, { bucket: 'file-media-object' });
    const data = getStorageObjectData(result.id);
    assert.ok(data);
    assert.equal(data.toString(), 'readback-test');
  });

  it('getStorageObjectUrl returns internal URL path', () => {
    const id = uuidv4();
    const url = getStorageObjectUrl(id);
    assert.ok(url.startsWith('/internal/assets/'));
    assert.ok(url.includes(id.substring(0, 2)));
  });

  it('getStorageObjectPath returns filesystem path', () => {
    const id = uuidv4();
    const p = getStorageObjectPath(id);
    assert.ok(typeof p === 'string');
    assert.ok(p.length > 0);
  });
});

describe('VALID_BUCKETS', () => {
  it('contains all expected bucket names', () => {
    const expected = ['file-media-object', 'team-font-variant', 'file-object-thumbnail',
      'file-thumbnail', 'profile', 'organization', 'tempfile', 'file-data',
      'file-data-fragment', 'file-change'];
    for (const b of expected) {
      assert.ok(VALID_BUCKETS.has(b), `missing bucket: ${b}`);
    }
  });
});