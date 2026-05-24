import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, CURRENT_VERSION } from '../src/files/blob.js';
import { randomUUID } from 'node:crypto';

describe('blob encode/decode round-trip', () => {
  it('version 5 round-trip with plain object', async () => {
    const data = { pages: [], pagesIndex: {}, options: { componentsV2: true } };
    const encoded = await encode(data, { version: 5 });
    assert.ok(Buffer.isBuffer(encoded));
    assert.ok(encoded.length > 6, 'encoded data should have header + payload');
    const decoded = await decode(encoded);
    assert.deepEqual(decoded, data);
  });

  it('version 5 round-trip with UUID strings', async () => {
    const id = randomUUID();
    const data = { id, name: 'test' };
    const encoded = await encode(data, { version: 5 });
    const decoded = await decode(encoded);
    assert.equal(decoded.id, id);
  });

  it('version 5 round-trip with nested data', async () => {
    const pageId = randomUUID();
    const data = {
      pages: [pageId],
      pagesIndex: {
        [pageId]: { id: pageId, name: 'Page 1', objects: {} },
      },
      options: { componentsV2: true },
    };
    const encoded = await encode(data, { version: 5 });
    const decoded = await decode(encoded);
    assert.deepEqual(decoded, data);
  });

  it('version 3 round-trip', async () => {
    const data = { hello: 'world', num: 42 };
    const encoded = await encode(data, { version: 3 });
    const decoded = await decode(encoded);
    assert.deepEqual(decoded, data);
  });

  it('version 1 round-trip', async () => {
    const data = { simple: true };
    const encoded = await encode(data, { version: 1 });
    const decoded = await decode(encoded);
    assert.deepEqual(decoded, data);
  });

  it('default version is CURRENT_VERSION', async () => {
    const data = { x: 1 };
    const encoded = await encode(data);
    const version = (encoded[0] << 8) | encoded[1];
    assert.equal(version, CURRENT_VERSION);
  });

  it('empty object round-trip', async () => {
    const data = {};
    const encoded = await encode(data, { version: 5 });
    const decoded = await decode(encoded);
    assert.deepEqual(decoded, data);
  });

  it('null values preserved', async () => {
    const data = { a: null, b: 'ok' };
    const encoded = await encode(data, { version: 5 });
    const decoded = await decode(encoded);
    assert.equal(decoded.a, null);
    assert.equal(decoded.b, 'ok');
  });

  it('large data round-trip', async () => {
    const objects = {};
    for (let i = 0; i < 1000; i++) {
      objects[randomUUID()] = { type: 'rect', x: i, y: i * 2 };
    }
    const data = { pages: [randomUUID()], pagesIndex: {}, objects };
    const encoded = await encode(data, { version: 5 });
    const decoded = await decode(encoded);
    assert.equal(Object.keys(decoded.objects).length, 1000);
  });

  it('throws for invalid blob data', async () => {
    await assert.rejects(() => decode(Buffer.alloc(1)), /too short|Invalid/i);
  });

  it('throws for unsupported version', async () => {
    const buf = Buffer.from([0, 99, 0, 0, 0, 0, 0]);
    await assert.rejects(() => decode(buf), /Unsupported/i);
  });
});