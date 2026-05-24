import { hexToBuffer, bufferToHex, bufferToBase62, hexMap } from './encoding.js';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const TIME_REF = 1640995200000; // ms since 2022-01-01T00:00:00

function fillRandom(buf) {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues !== 'undefined') {
    crypto.getRandomValues(buf);
    return buf;
  }
  console.warn('No SRNG available, switching back to Math.random.');
  for (let i = 0, r; i < buf.length; i++) {
    if ((i & 0x03) === 0) {
      r = Math.random() * 0x100000000;
    }
    buf[i] = (r >>> ((i & 0x03) << 3)) & 0xff;
  }
  return buf;
}

function getBigUint64(view, byteOffset, le) {
  const a = view.getUint32(byteOffset, le);
  const b = view.getUint32(byteOffset + 4, le);
  const leMask = Number(!!le);
  const beMask = Number(!le);
  return (BigInt(a * beMask + b * leMask) << 32n) | BigInt(a * leMask + b * beMask);
}

function setBigUint64(view, byteOffset, value, le) {
  const hi = Number(value >> 32n);
  const lo = Number(value & 0xffffffffn);
  if (le) {
    view.setUint32(byteOffset + 4, hi, le);
    view.setUint32(byteOffset, lo, le);
  } else {
    view.setUint32(byteOffset, hi, le);
    view.setUint32(byteOffset + 4, lo, le);
  }
}

function currentTimestamp() {
  return BigInt.asUintN(64, '' + (Date.now() - TIME_REF));
}

const tmpBuff = new ArrayBuffer(8);
const tmpView = new DataView(tmpBuff);
const tmpInt8 = new Uint8Array(tmpBuff);

function nextLong() {
  fillRandom(tmpInt8);
  return getBigUint64(tmpView, 0, false);
}

export function parse(s) {
  if (typeof s === 'string' && UUID_REGEX.test(s)) {
    return s.toLowerCase();
  }
  throw new Error(`invalid string '${s}' for uuid`);
}

export function parseSafe(s) {
  try {
    return parse(s);
  } catch {
    return null;
  }
}

export function uuid(s) {
  return s.toLowerCase();
}

// --- v4 ---

const v4Arr = new Uint8Array(16);

export function random() {
  fillRandom(v4Arr);
  v4Arr[6] = (v4Arr[6] & 0x0f) | 0x40;
  v4Arr[8] = (v4Arr[8] & 0x3f) | 0x80;
  return bufferToHex(v4Arr, true);
}

// --- v8 (Penpot custom, time-ordered) ---

const v8Buff = new ArrayBuffer(16);
const v8Int8 = new Uint8Array(v8Buff);
const v8View = new DataView(v8Buff);

const maxCs = 0x0000_0000_0000_3fffn; // 14 bits space
const baseMsb = 0x0000_0000_0000_8000n;
const baseLsb = 0x8000_0000_0000_0000n;

let countCs = 0n;
let lastRd = nextLong() & 0xffff_ffff_ffff_f0ffn;
let lastCs = nextLong() & maxCs;
let lastTs = 0n;

function v8Create(ts, lastRd, lastCs) {
  const msb = baseMsb | (lastRd & 0xffff_ffff_ffff_0fffn);
  const lsb = baseLsb | ((ts << 14n) & 0x3fff_ffff_ffff_c000n) | lastCs;
  setBigUint64(v8View, 0, msb, false);
  setBigUint64(v8View, 8, lsb, false);
  return bufferToHex(v8Int8, true);
}

function v8Factory() {
  while (true) {
    const ts = currentTimestamp();

    if (ts - lastTs < 0n) {
      lastRd =
        (lastRd & 0x0000_0000_0000_0f00n) |
        (nextLong() & 0xffff_ffff_ffff_f0ffn);
      countCs = 0n;
      continue;
    }

    if (lastTs === ts) {
      if (countCs < maxCs) {
        lastCs = (lastCs + 1n) & maxCs;
        countCs++;
      } else {
        continue;
      }
    } else {
      lastTs = ts;
      lastCs = nextLong() & maxCs;
      countCs = 0n;
    }

    return v8Create(ts, lastRd, lastCs);
  }
}

export function next() {
  return v8Factory();
}

// --- custom ---

export function custom(low, high) {
  if (high === undefined) {
    return v8FromPair(0n, BigInt(low));
  }
  return v8FromPair(BigInt(high), BigInt(low));
}

// --- zero ---

export const zero = '00000000-0000-0000-0000-000000000000';

export function isZero(v) {
  return v === zero;
}

export function isValid(v) {
  return typeof v === 'string' && UUID_REGEX.test(v);
}

// --- bytes ---

export function getBytes(uuidStr) {
  fillBytes(uuidStr);
  return Int8Array.from(v8Int8);
}

export function fromBytes(data) {
  v8Int8.set(data);
  return bufferToHex(v8Int8, true);
}

// --- hi/lo ---

export function getWordHigh(uuidStr) {
  fillBytes(uuidStr);
  return v8View.getBigInt64(0);
}

export function getWordLow(uuidStr) {
  fillBytes(uuidStr);
  return v8View.getBigInt64(8);
}

// --- unsigned parts (for WASM interop) ---

export function getUnsignedParts(uuidStr) {
  fillBytes(uuidStr);
  const result = new Uint32Array(4);
  result[0] = v8View.getUint32(0);
  result[1] = v8View.getUint32(4);
  result[2] = v8View.getUint32(8);
  result[3] = v8View.getUint32(12);
  return result;
}

export function fromUnsignedParts(a, b, c, d) {
  v8View.setUint32(0, a);
  v8View.setUint32(4, b);
  v8View.setUint32(8, c);
  v8View.setUint32(12, d);
  return bufferToHex(v8Int8, true);
}

// --- short id ---

export function shortId(uuidStr) {
  const buff = hexToBuffer(uuidStr);
  const short = new Uint8Array(buff, 4);
  return bufferToBase62(short);
}

// --- set tag ---

export function setTag(tag) {
  tag = BigInt.asUintN(64, '' + tag);
  if (tag > 0x0000_0000_0000_000fn) {
    throw new Error('illegal arguments: tag value should fit in 4bits');
  }

  lastRd =
    (lastRd & 0xffff_ffff_ffff_f0ffn) |
    ((tag << 8n) & 0x0000_0000_0000_0f00n);
}

// --- internal helpers ---

function fillBytes(uuid) {
  let rest;
  v8Int8[0] = (rest = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  v8Int8[1] = (rest >>> 16) & 0xff;
  v8Int8[2] = (rest >>> 8) & 0xff;
  v8Int8[3] = rest & 0xff;

  v8Int8[4] = (rest = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  v8Int8[5] = rest & 0xff;

  v8Int8[6] = (rest = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  v8Int8[7] = rest & 0xff;

  v8Int8[8] = (rest = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  v8Int8[9] = rest & 0xff;

  v8Int8[10] =
    ((rest = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000) & 0xff;
  v8Int8[11] = (rest / 0x100000000) & 0xff;
  v8Int8[12] = (rest >>> 24) & 0xff;
  v8Int8[13] = (rest >>> 16) & 0xff;
  v8Int8[14] = (rest >>> 8) & 0xff;
  v8Int8[15] = rest & 0xff;
}

function v8FromPair(hi, lo) {
  v8View.setBigInt64(0, hi);
  v8View.setBigInt64(8, lo);
  return bufferToHex(v8Int8, true);
}

// --- fake uuids (for reproducible tests) ---

let fakeIds = 0;

export function resetFake() {
  fakeIds = 0;
}

export function nextFake() {
  fakeIds++;
  return custom(fakeIds);
}