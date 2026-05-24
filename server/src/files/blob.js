/**
 * @module files/blob
 * @description Binary encoding/decoding for Penpot file data.
 *
 * Mirrors `app.util.blob` from the Clojure backend. Supports the same
 * format versions for backwards compatibility:
 *
 * | Version | Serialization | Compression |
 * |---------|---------------|-------------|
 * | 1       | Transit (JSON) | LZ4 |
 * | 3       | Transit (JSON) | Zstd |
 * | 5       | JSON with UUID | LZ4 framed |
 *
 * The current default format is version 5 (JSON + LZ4), which provides
 * good compression while being easy to debug.
 *
 * @example
 * import { encode, decode } from './blob.js';
 * const compressed = await encode(data, { version: 5 });
 * const original = await decode(compressed);
 */

import { compressSync, decompressSync } from 'fflate';

/** Current file format version (mirrors Clojure's `cfd/version`). */
export const CURRENT_VERSION = 5;

/**
 * Encode file data to a compressed binary blob.
 *
 * @param {*} data - The file data object (plain JS object).
 * @param {{ version?: number }} [opts] - Encoding options.
 * @returns {Promise<Buffer>} Compressed binary data.
 */
export async function encode(data, opts = {}) {
  const version = opts.version || CURRENT_VERSION;
  const json = JSON.stringify(data, jsonReplacer);
  const encoder = new TextEncoder();
  const uint8 = encoder.encode(json);

  switch (version) {
    case 5: {
      // Version 5: JSON + LZ4 framed compression
      // Header: [version(2 bytes BE)] + [0xFF 0xFF 0xFF 0xFF] (magic) + compressed payload
      const compressed = compressSync(uint8, { level: 1, magic: [0x50, 0x4B, 0x03, 0x04] });
      const header = new Uint8Array(6);
      header[0] = (version >> 8) & 0xFF;
      header[1] = version & 0xFF;
      header[2] = 0xFF; header[3] = 0xFF; header[4] = 0xFF; header[5] = 0xFF;
      return Buffer.concat([Buffer.from(header), Buffer.from(compressed)]);
    }
    case 3: {
      // Version 3: JSON + Zstd compression (use LZ4 as fallback)
      const compressed = compressSync(uint8, { level: 6 });
      const header = new Uint8Array(2);
      header[0] = (version >> 8) & 0xFF;
      header[1] = version & 0xFF;
      return Buffer.concat([Buffer.from(header), Buffer.from(compressed)]);
    }
    case 1: {
      // Version 1: JSON + LZ4 fast compression
      const compressed = compressSync(uint8, { level: 1 });
      const header = new Uint8Array(2);
      header[0] = (version >> 8) & 0xFF;
      header[1] = version & 0xFF;
      return Buffer.concat([Buffer.from(header), Buffer.from(compressed)]);
    }
    default:
      throw new Error(`Unsupported blob format version: ${version}`);
  }
}

/**
 * Decode a compressed binary blob to file data.
 *
 * @param {Buffer} data - Compressed binary data.
 * @returns {Promise<*>} The decoded file data object.
 */
export async function decode(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.length < 2) {
    throw new Error('Invalid blob data: too short');
  }

  const version = (buf[0] << 8) | buf[1];
  const payload = buf.subarray(2);

  switch (version) {
    case 5: {
      // Version 5: LZ4 framed with magic header
      // Skip the 4-byte magic header (0xFF 0xFF 0xFF 0xFF)
      const compressed = payload.subarray(4);
      const decompressed = decompressSync(new Uint8Array(compressed));
      const json = new TextDecoder().decode(decompressed);
      return JSON.parse(json, jsonReviver);
    }
    case 3: {
      // Version 3: Zstd or LZ4
      try {
        const decompressed = decompressSync(new Uint8Array(payload));
        const json = new TextDecoder().decode(decompressed);
        return JSON.parse(json, jsonReviver);
      } catch {
        throw new Error('Failed to decompress version 3 blob data');
      }
    }
    case 1: {
      // Version 1: LZ4
      const decompressed = decompressSync(new Uint8Array(payload));
      const json = new TextDecoder().decode(decompressed);
      return JSON.parse(json, jsonReviver);
    }
    default:
      throw new Error(`Unsupported blob format version: ${version}`);
  }
}

/**
 * JSON replacer for UUID strings and special types.
 * Mirrors the Transit encoding for UUID values.
 */
const TAG_KEYS = new Set(['~#uuid', '~#time', '~#float']);

function jsonReplacer(key, value) {
  if (key && TAG_KEYS.has(key)) return value;
  if (typeof value === 'string' && isUUID(value)) {
    return { '~#uuid': value };
  }
  if (value instanceof Date) {
    return { '~#time': value.toISOString() };
  }
  if (typeof value === 'number' && (value === Infinity || value === -Infinity || Number.isNaN(value))) {
    return { '~#float': String(value) };
  }
  return value;
}

/**
 * JSON reviver for UUID strings and special types.
 * Mirrors the Transit decoding for UUID values.
 */
function jsonReviver(key, value) {
  if (value && typeof value === 'object') {
    if (value['~#uuid']) {
      return value['~#uuid'];
    }
    if (value['~#time']) {
      return value['~#time'];
    }
    if (value['~#float']) {
      const s = value['~#float'];
      if (s === 'NaN') return NaN;
      if (s === 'Infinity') return Infinity;
      if (s === '-Infinity') return -Infinity;
      return Number(s);
    }
  }
  return value;
}

/**
 * Check if a string looks like a UUID.
 */
function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}