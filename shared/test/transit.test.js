import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  encodeStr, decodeStr, isTransit, Pointer, pointer, isPointer, addHandlers,
} from '../src/transit.js';

describe('transit', () => {
  it('encodeStr/decodeStr roundtrip with plain object', () => {
    const obj = { name: 'test', count: 42 };
    const encoded = encodeStr(obj);
    const decoded = decodeStr(encoded);
    assert.equal(decoded.name, 'test');
    assert.equal(decoded.count, 42);
  });

  it('encodes UUID with ~u prefix', () => {
    const obj = { id: 'a1a2a3a4-b1b2-c1c2-d1d2-d3d4d5d6d7d8' };
    const encoded = encodeStr(obj);
    assert.ok(encoded.includes('~u'));
  });

  it('decodes UUID string', () => {
    const json = '{"id":"~ua1a2a3a4-b1b2-c1c2-d1d2-d3d4d5d6d7d8"}';
    const decoded = decodeStr(json);
    assert.equal(decoded.id, 'a1a2a3a4-b1b2-c1c2-d1d2-d3d4d5d6d7d8');
  });

  it('encodes Date with ~m prefix', () => {
    const d = new Date('2024-06-15T12:00:00Z');
    const obj = { created: d };
    const encoded = encodeStr(obj);
    assert.ok(encoded.includes('~m'));
  });

  it('decodes ~m to Date', () => {
    const d = new Date('2024-06-15T12:00:00Z');
    const encoded = encodeStr({ created: d });
    const decoded = decodeStr(encoded);
    assert.ok(decoded.created instanceof Date);
    assert.equal(decoded.created.getTime(), d.getTime());
  });

  it('encodes keyword keys with ~:', () => {
    const obj = { 'my-key': 42 };
    const encoded = encodeStr(obj);
    assert.ok(encoded.includes('~:my-key'));
  });

  it('decodes keyword keys', () => {
    const json = '["^ ","~:my-key",42]';
    const decoded = decodeStr(json);
    assert.equal(decoded['my-key'], 42);
  });

  it('encodes Set as ~#set', () => {
    const obj = { items: new Set([1, 2, 3]) };
    const encoded = encodeStr(obj);
    assert.ok(encoded.includes('~#set'));
  });

  it('decodes ~#set to Set', () => {
    const decoded = decodeStr('["~#set",[1,2,3]]');
    assert.ok(decoded instanceof Set);
    assert.equal(decoded.size, 3);
  });

  it('Pointer class', () => {
    const p = new Pointer('abc123', { x: 1 });
    assert.equal(p.id, 'abc123');
    assert.equal(p.deref(), 'abc123');
    assert.ok(isPointer(p));
    assert.ok(!isPointer({}));
  });

  it('pointer() factory', () => {
    const p1 = pointer('abc');
    assert.ok(isPointer(p1));
    assert.equal(p1.id, 'abc');

    const p2 = pointer(['abc', { x: 1 }]);
    assert.equal(p2.id, 'abc');
  });

  it('encode/decode roundtrip with nested objects', () => {
    const obj = {
      name: 'test',
      items: [1, 2, 3],
      nested: { a: 1 },
    };
    const encoded = encodeStr(obj);
    const decoded = decodeStr(encoded);
    assert.deepEqual(decoded, obj);
  });

  it('isTransit() validates transit strings', () => {
    assert.ok(isTransit(encodeStr({ x: 1 })));
    assert.ok(!isTransit('not transit'));
    assert.ok(!isTransit(42));
  });
});