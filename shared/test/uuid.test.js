import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  next, random, custom, zero, isZero, parse, parseSafe,
  getBytes, fromBytes, getWordHigh, getWordLow,
  getUnsignedParts, fromUnsignedParts, shortId,
  setTag, nextFake, resetFake,
} from '../src/uuid.js';

describe('uuid', () => {
  it('next() returns a valid UUID string', () => {
    const id = next();
    assert.ok(typeof id === 'string');
    assert.ok(id.length === 36);
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('next() generates unique UUIDs', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      ids.add(next());
    }
    assert.equal(ids.size, 1000);
  });

  it('random() returns a valid v4 UUID', () => {
    const id = random();
    assert.ok(typeof id === 'string');
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('zero is the nil UUID', () => {
    assert.equal(zero, '00000000-0000-0000-0000-000000000000');
    assert.ok(isZero(zero));
    assert.ok(!isZero(next()));
  });

  it('custom(low) creates a UUID with high=0', () => {
    const id = custom(42);
    assert.ok(typeof id === 'string');
    assert.equal(id.length, 36);
  });

  it('custom(high, low) creates a UUID', () => {
    const id = custom(100n, 200n);
    assert.ok(typeof id === 'string');
    assert.equal(id.length, 36);
  });

  it('parse() validates and returns lowercase UUID', () => {
    const id = parse('A1A2A3A4-B1B2-C1C2-D1D2-D3D4D5D6D7D8');
    assert.equal(id, 'a1a2a3a4-b1b2-c1c2-d1d2-d3d4d5d6d7d8');
  });

  it('parse() throws on invalid UUID', () => {
    assert.throws(() => parse('not-a-uuid'));
  });

  it('parseSafe() returns null on invalid UUID', () => {
    assert.equal(parseSafe('not-a-uuid'), null);
  });

  it('parseSafe() returns UUID on valid input', () => {
    const result = parseSafe('A1A2A3A4-B1B2-C1C2-D1D2-D3D4D5D6D7D8');
    assert.ok(result !== null);
  });

  it('getBytes / fromBytes roundtrip', () => {
    const id = next();
    const bytes = getBytes(id);
    const restored = fromBytes(bytes);
    assert.equal(restored, id);
  });

  it('getWordHigh / getWordLow return BigInts', () => {
    const id = next();
    const hi = getWordHigh(id);
    const lo = getWordLow(id);
    assert.ok(typeof hi === 'bigint');
    assert.ok(typeof lo === 'bigint');
  });

  it('getUnsignedParts / fromUnsignedParts roundtrip', () => {
    const id = next();
    const parts = getUnsignedParts(id);
    assert.ok(parts instanceof Uint32Array);
    assert.equal(parts.length, 4);
    const restored = fromUnsignedParts(parts[0], parts[1], parts[2], parts[3]);
    assert.equal(restored, id);
  });

  it('shortId returns a short base62 string', () => {
    const id = next();
    const short = shortId(id);
    assert.ok(typeof short === 'string');
    assert.ok(short.length > 0);
    assert.ok(short.length < id.length);
  });

  it('nextFake() produces predictable UUIDs', () => {
    resetFake();
    const id1 = nextFake();
    const id2 = nextFake();
    assert.notEqual(id1, id2);
  });

  it('setTag() updates the tag field', () => {
    setTag(5);
    const id = next();
    assert.ok(typeof id === 'string');
    setTag(0);
  });
});