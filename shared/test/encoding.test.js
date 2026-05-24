import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hexToBuffer, bufferToHex, bufferToBase62, base62ToBuffer, hexMap } from '../src/encoding.js';

describe('encoding', () => {
  it('hexMap has 256 entries', () => {
    assert.equal(hexMap.length, 256);
    assert.equal(hexMap[0], '00');
    assert.equal(hexMap[255], 'ff');
  });

  it('bufferToHex() converts 16 bytes to UUID format', () => {
    const bytes = new Uint8Array(16);
    bytes[0] = 0xa1; bytes[1] = 0xa2; bytes[2] = 0xa3; bytes[3] = 0xa4;
    bytes[4] = 0xb1; bytes[5] = 0xb2;
    bytes[6] = 0xc1; bytes[7] = 0xc2;
    bytes[8] = 0xd1; bytes[9] = 0xd2;
    bytes[10] = 0xd3; bytes[11] = 0xd4; bytes[12] = 0xd5;
    bytes[13] = 0xd6; bytes[14] = 0xd7; bytes[15] = 0xd8;

    const hex = bufferToHex(bytes, true);
    assert.equal(hex, 'a1a2a3a4-b1b2-c1c2-d1d2-d3d4d5d6d7d8');
  });

  it('bufferToHex() without UUID format', () => {
    const bytes = new Uint8Array(16);
    bytes[0] = 0xff;
    const hex = bufferToHex(bytes, false);
    assert.ok(!hex.includes('-'));
  });

  it('hexToBuffer() converts UUID string to buffer', () => {
    const uuidStr = 'a1a2a3a4-b1b2-c1c2-d1d2-d3d4d5d6d7d8';
    const buffer = hexToBuffer(uuidStr);
    const view = new Uint8Array(buffer);
    assert.equal(view[0], 0xa1);
    assert.equal(view[1], 0xa2);
    assert.equal(view[15], 0xd8);
  });

  it('hexToBuffer / bufferToHex roundtrip', () => {
    const uuidStr = 'a1a2a3a4-b1b2-c1c2-d1d2-d3d4d5d6d7d8';
    const buffer = hexToBuffer(uuidStr);
    const restored = bufferToHex(new Uint8Array(buffer), true);
    assert.equal(restored, uuidStr);
  });

  it('bufferToBase62() encodes to base62', () => {
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) bytes[i] = i * 16;
    const result = bufferToBase62(bytes);
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
    for (const ch of result) {
      assert.ok(/[A-Za-z0-9]/.test(ch), `unexpected character: ${ch}`);
    }
  });

  it('bufferToBase62 / base62ToBuffer roundtrip', () => {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const encoded = bufferToBase62(bytes);
    const decoded = base62ToBuffer(encoded);
    assert.deepEqual(new Uint8Array(decoded), bytes);
  });
});