import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { storeObject, retrieveObject, deleteObject, objectExists, calculateHash, VALID_BUCKETS } from '../src/storage/fs.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DIR = path.join(os.tmpdir(), 'penpot-test-storage-' + process.pid);

function ensureTestDir() {
  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  return TEST_DIR;
}

describe('storage/fs', () => {
  it('VALID_BUCKETS contains expected entries', () => {
    assert.ok(VALID_BUCKETS.has('file-media-object'));
    assert.ok(VALID_BUCKETS.has('tempfile'));
    assert.ok(VALID_BUCKETS.has('file-data'));
  });

  it('storeObject writes and retrieveObject reads', () => {
    const id = `test-${Date.now()}`;
    const data = Buffer.from('hello storage');
    const filePath = storeObject(id, data);
    assert.ok(fs.existsSync(filePath));

    const retrieved = retrieveObject(id);
    assert.ok(retrieved);
    assert.equal(retrieved.toString(), 'hello storage');

    deleteObject(id);
  });

  it('retrieveObject returns null for missing object', () => {
    const result = retrieveObject('nonexistent-' + Date.now());
    assert.equal(result, null);
  });

  it('deleteObject removes the file', () => {
    const id = `test-del-${Date.now()}`;
    storeObject(id, Buffer.from('bye'));
    assert.ok(objectExists(id));
    const deleted = deleteObject(id);
    assert.equal(deleted, true);
    assert.ok(!objectExists(id));
  });

  it('deleteObject returns false for nonexistent file', () => {
    const deleted = deleteObject('nonexistent-' + Date.now());
    assert.equal(deleted, false);
  });

  it('objectExists returns false for missing objects', () => {
    assert.ok(!objectExists('nonexistent-' + Date.now()));
  });

  it('calculateHash produces consistent results', () => {
    const data = Buffer.from('hash me');
    const hash1 = calculateHash(data);
    const hash2 = calculateHash(data);
    assert.equal(hash1, hash2);
    assert.ok(/^[0-9a-f]{64}$/.test(hash1));
  });

  it('calculateHash different for different data', () => {
    const h1 = calculateHash(Buffer.from('aaa'));
    const h2 = calculateHash(Buffer.from('bbb'));
    assert.notEqual(h1, h2);
  });
});