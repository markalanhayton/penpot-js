import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('S3 storage exports (availability check)', async () => {
  const mod = await import('../src/storage/s3.js');

  it('exports isS3Available', () => {
    assert.equal(typeof mod.isS3Available, 'function');
  });

  it('exports all S3 functions', () => {
    assert.equal(typeof mod.putS3Object, 'function');
    assert.equal(typeof mod.getS3ObjectData, 'function');
    assert.equal(typeof mod.deleteS3Object, 'function');
    assert.equal(typeof mod.deleteS3ObjectsInBulk, 'function');
    assert.equal(typeof mod.getS3PresignedUrl, 'function');
    assert.equal(typeof mod.s3ObjectExists, 'function');
  });

  it('exports unified storage dispatchers', () => {
    assert.equal(typeof mod.putStorageObjectAny, 'function');
    assert.equal(typeof mod.getStorageObjectDataAny, 'function');
    assert.equal(typeof mod.getStorageObjectUrlAny, 'function');
  });

  it('isS3Available returns false without AWS SDK configured', async () => {
    const result = await mod.isS3Available();
    assert.equal(result, false);
  });
});