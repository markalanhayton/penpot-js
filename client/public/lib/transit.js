'use strict';
/**
 * @module transit
 * @description Transit+JSON encoding and decoding for Penpot RPC protocol.
 * Handles keywords, UUIDs, dates, sets, tagged maps, and all Penpot-specific types.
 * Mirrors the backend codec in server/src/transit/index.js.
 */

export const API_BASE = '';
export const API_PATH = '/api/rpc/command/';

export function apiUrl(command) {
  return `${API_BASE}${API_PATH}${command}`;
}

export function isGetCommand(command) {
  return command.startsWith('get-');
}

const TRANSIT_TAG = '^';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

/**
 * Encode a JavaScript value to Transit+JSON string.
 */
export function transitEncode(obj) {
  return JSON.stringify(encodeValue(obj));
}

/**
 * Decode a Transit+JSON string into a JavaScript value.
 */
export function transitDecode(str) {
  if (!str) return str;
  return typeof str === 'string' ? decodeValue(JSON.parse(str)) : decodeValue(str);
}

// --- Encoding ---

function encodeValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val;

  if (typeof val === 'string') {
    if (isUUID(val)) return `~u${val}`;
    return val;
  }

  if (val instanceof Date) {
    return [TRANSIT_TAG, 't', val.toISOString()];
  }

  if (val instanceof Set) {
    return ['~#set', [...val].map(encodeValue)];
  }

  if (Array.isArray(val)) {
    return val.map(encodeValue);
  }

  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[encodeKey(k)] = encodeValue(v);
    }
    return out;
  }

  return val;
}

function encodeKey(key) {
  if (key.startsWith('~')) return key;
  return key;
}

// --- Decoding ---

function decodeValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val;

  if (typeof val === 'string') {
    if (val.startsWith('~:')) return val.slice(2);
    if (val.startsWith('~u')) return val.slice(2);
    if (val.startsWith('~m')) {
      const ms = parseInt(val.slice(2), 10);
      return new Date(ms).toISOString();
    }
    if (val.startsWith('~$')) return val.slice(2);
    if (val.startsWith('~~')) return val.slice(1);
    if (val === '~?t') return true;
    if (val === '~?f') return false;
    return val;
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return [];

    // Tagged map: ["^ tag", k1, v1, k2, v2, ...]
    if (val[0] && typeof val[0] === 'string' && val[0].startsWith('^')) {
      const tag = val[0].slice(2);

      // Timestamp shorthand: ["^", "t", ISO_STRING]
      if (tag === 't' && val.length === 3) {
        return val[2];
      }

      return decodeTaggedMap(tag, val.slice(1));
    }

    // Set: ["~#set", [...items]]
    if (val[0] === '~#set') {
      return new Set(decodeValue(val[1]));
    }

    // List: ["~#list", [...items]]
    if (val[0] === '~#list') {
      return decodeValue(val[1]);
    }

    // Cognitect map encoding: ["^ ", k1, v1, k2, v2, ...]
    if (val[0] === '^ ') {
      const result = {};
      for (let i = 1; i < val.length; i += 2) {
        const key = typeof val[i] === 'string' && val[i].startsWith('~:')
          ? val[i].slice(2)
          : decodeValue(val[i]);
        result[key] = decodeValue(val[i + 1]);
      }
      return result;
    }

    return val.map(decodeValue);
  }

  if (typeof val === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(val)) {
      const decodedKey = key.startsWith('~:') ? key.slice(2) : key;
      result[decodedKey] = decodeValue(value);
    }
    return result;
  }

  return val;
}

function decodeTaggedMap(tag, items) {
  const obj = {};
  for (let i = 0; i < items.length; i += 2) {
    const key = typeof items[i] === 'string' && items[i].startsWith('~:')
      ? items[i].slice(2)
      : decodeValue(items[i]);
    obj[key] = decodeValue(items[i + 1]);
  }

  switch (tag) {
    case 'penpot/pointer':
      return obj;
    case 'rect':
      return { __type: 'rect', ...obj };
    case 'point':
      return { __type: 'point', ...obj };
    case 'matrix':
      return { __type: 'matrix', ...obj };
    case 'shape':
      return { __type: 'shape', ...obj };
    case 'penpot/path-data':
      return { __type: 'path-data', data: obj };
    case 'penpot/fills':
      return { __type: 'fills', items: Array.isArray(obj) ? obj : [obj] };
    case 'penpot/objects-map/v2':
      return { __type: 'objects-map', data: obj };
    case 'penpot/tokens-lib':
      return { __type: 'tokens-lib', ...obj };
    case 'penpot/token-set':
      return { __type: 'token-set', ...obj };
    case 'penpot/token-theme':
      return { __type: 'token-theme', ...obj };
    case 'penpot/token':
      return { __type: 'token', ...obj };
    case 'uri':
      return String(obj);
    case 'ordered-map':
      return obj;
    case 'ordered-set':
      return new Set(Array.isArray(obj) ? obj : Object.values(obj));
    case 'm':
      return typeof obj === 'number' ? new Date(obj).toISOString() : obj;
    default:
      return { __type: tag, ...obj };
  }
}

// --- Request/Response helpers ---

/**
 * Decode an RPC request body based on Content-Type.
 */
export function decodeRequest(body, contentType = '') {
  if (!body) return {};

  if (contentType.includes('transit+json')) {
    try {
      return toKebabCase(transitDecode(body));
    } catch (err) {
      console.error('[transit] Failed to decode Transit request:', err.message);
      return {};
    }
  }

  if (contentType.includes('application/json') || contentType.includes('text/plain') || !contentType) {
    try {
      return toKebabCase(typeof body === 'string' ? JSON.parse(body) : body);
    } catch { /* not Transit or JSON, return empty object */ }
  }

  return {};
}

/**
 * Encode a response for the Penpot frontend.
 */
export function encodeResponse(result, opts = {}) {
  const { accept = '', queryString = '', verbose = false } = opts;

  if (result === null || result === undefined) {
    return { body: '', contentType: 'application/json', status: 204 };
  }

  if (queryString.includes('_fmt=json') || accept.includes('application/json')) {
    return {
      body: JSON.stringify(toCamelCase(result), jsonReplacer),
      contentType: 'application/json',
      status: 200,
    };
  }

  return {
    body: transitEncode(result),
    contentType: 'application/transit+json',
    status: 200,
  };
}

// --- Key casing helpers ---

function camelToKebab(s) {
  if (s.startsWith('~')) return s;
  return s.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function kebabToCamel(s) {
  if (s.startsWith('~')) return s;
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function toKebabCase(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toKebabCase);
  if (obj instanceof Set) return new Set([...obj].map(toKebabCase));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[camelToKebab(k)] = toKebabCase(v);
    }
    return out;
  }
  return obj;
}

function toCamelCase(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj instanceof Set) return new Set([...obj].map(toCamelCase));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[kebabToCamel(k)] = toCamelCase(v);
    }
    return out;
  }
  return obj;
}

function jsonReplacer(key, value) {
  if (value instanceof Set) return [...value];
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  return value;
}