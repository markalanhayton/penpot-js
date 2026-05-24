/**
 * @module transit
 * @description Transit+JSON encoding and decoding — mirrors `app.common.transit`
 * from the Clojure/ClojureScript backend.
 *
 * Implements the Penpot-specific Transit protocol with custom handlers for
 * UUIDs, dates, URIs, keywords, ordered maps/sets, geometry types, and more.
 *
 * ### Protocol overview
 *
 * The Penpot frontend sends ALL RPC requests as `application/transit+json`.
 * The backend must parse this format and respond in the same format (or JSON
 * if the client requests it via `?_fmt=json` or `Accept: application/json`).
 *
 * ### Transit+JSON format
 *
 * Transit uses a compact JSON representation with special prefixes:
 * - `"~:keyword"` — Clojure keyword (e.g., `"~:id"` → `:id`)
 * - `"~uUUID"` — UUID (e.g., `"~u550e8400-e29b-41d4-a716-446655440000"`)
 * - `"~mEPOCHMS"` — Date/time as epoch-millis string (e.g., `"~m1700000000000"`)
 * - `"~#set"` — Set type wrapping
 * - `"~#list"` — List type wrapping
 * - `"~$tag"` — Symbol
 * - `"~?"` — Boolean true (`~?t`) / false (`~?f`) (but JSON booleans also work)
 * - `"~iN"` — Integer (when ambiguous)
 * - Tagged maps: `["^ tag", ...kv-pairs]` for custom types
 *
 * ### Content negotiation
 *
 * | Client sends | Server responds with |
 * |---|---|
 * | `Content-Type: application/transit+json` | `application/transit+json` |
 * | `Accept: application/transit+json` | `application/transit+json` |
 * | `?_fmt=json` or `Accept: application/json` | `application/json` |
 * | Error responses | Always `application/transit+json` (verbose) |
 *
 * @example
 * import { encode, decode } from './transit/index.js';
 *
 * // Decode a request from the frontend
 * const params = decode(requestBody); // Transit string → JS object
 *
 * // Encode a response for the frontend
 * const responseBody = encode(result); // JS object → Transit string
 */

/**
 * Convert a kebab-case string to a Clojure keyword string with `~:` prefix.
 *
 * @param {string} s - A kebab-case string (e.g., `'file-id'`).
 * @returns {string} The Transit-encoded keyword (e.g., `"~:file-id"`).
 */
function keywordToTransit(s) {
  return `~:${s}`;
}

/**
 * Convert a Transit keyword string back to a kebab-case string.
 *
 * @param {string} s - A Transit keyword (e.g., `"~:file-id"`).
 * @returns {string} The kebab-case key (e.g., `"file-id"`).
 */
function transitToKeyword(s) {
  if (s.startsWith('~:')) return s.slice(2);
  if (s.startsWith(':')) return s.slice(1);
  return s;
}

/**
 * Check if a string is a Transit-encoded keyword.
 *
 * @param {string} s
 * @returns {boolean}
 */
function isTransitKeyword(s) {
  return typeof s === 'string' && s.startsWith('~:');
}

/**
 * Parse a UUID string, returning the canonical lowercase form or null.
 *
 * @param {string} s
 * @returns {string|null}
 */
function parseUUID(s) {
  if (!s) return null;
  const match = s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return match ? s.toLowerCase() : null;
}

/**
 * Check if a string looks like a UUID.
 *
 * @param {string} s
 * @returns {boolean}
 */
function isUUID(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Decode a Transit+JSON string into a JavaScript object.
 *
 * Handles all Penpot-specific types including keywords (prefixed with `~:`),
 * UUIDs (prefixed with `~u`), dates (prefixed with `~m`), sets, lists,
 * and tagged maps for custom types.
 *
 * @param {string} str - The Transit+JSON encoded string.
 * @returns {*} The decoded JavaScript value.
 */
export function decode(str) {
  if (!str || typeof str !== 'string') return str;
  return decodeValue(JSON.parse(str));
}

/**
 * Encode a JavaScript object into a Transit+JSON string.
 *
 * Produces compact Transit encoding by default. Use `{ verbose: true }`
 * for readable output (used for error responses).
 *
 * @param {*} value - The JavaScript value to encode.
 * @param {{ verbose?: boolean }} [opts] - Encoding options.
 * @returns {string} The Transit+JSON encoded string.
 */
export function encode(value, opts = {}) {
  const encoded = encodeValue(value, opts);
  return JSON.stringify(encoded);
}

/**
 * Recursively decode a Transit value.
 *
 * @param {*} val - A parsed JSON value (possibly containing Transit markers).
 * @returns {*} The decoded JavaScript value.
 */
function decodeValue(val) {
  if (val === null || val === undefined) return val;

  // String handling — check for Transit prefixes
  if (typeof val === 'string') {
    // Keyword: "~:keyword-name"
    if (val.startsWith('~:')) return val.slice(2);

    // UUID: "~uXXXXXXXX-XXXX-..."
    if (val.startsWith('~u')) return val.slice(2);

    // Date/time: "~m1700000000000"
    if (val.startsWith('~m')) {
      const ms = parseInt(val.slice(2), 10);
      return new Date(ms).toISOString();
    }

    // Symbol: "~$symbol-name"
    if (val.startsWith('~$')) return val.slice(2);

    // Escaped tilde: "~~" → "~"
    if (val.startsWith('~~')) return val.slice(1);

    return val;
  }

  // Array handling — could be a tagged map, set, list, or plain array
  if (Array.isArray(val)) {
    if (val.length === 0) return [];

    // Tagged map: ["^ tag", k1, v1, k2, v2, ...]
    if (val[0] && typeof val[0] === 'string' && val[0].startsWith('^')) {
      const tag = val[0].slice(2); // Remove "^ " prefix
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

    // Cognitect transit array-as-map: ["^ ", k1, v1, k2, v2, ...]
    if (val[0] === '^ ') {
      const result = {};
      for (let i = 1; i < val.length; i += 2) {
        const key = typeof val[i] === 'string' && val[i].startsWith('~:')
          ? val[i].slice(2) // keyword key
          : decodeValue(val[i]);
        const value = decodeValue(val[i + 1]);
        result[key] = value;
      }
      return result;
    }

    // Plain array — decode each element
    return val.map(decodeValue);
  }

  // Object handling — decode keys and values
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

/**
 * Handle a Transit tagged map based on its tag.
 *
 * @param {string} tag - The Transit type tag (e.g., `"penpot/pointer"`, `"rect"`, etc.)
 * @param {Array} items - The key-value pairs following the tag.
 * @returns {*} The decoded custom type.
 */
function decodeTaggedMap(tag, items) {
  // Convert items array [k1, v1, k2, v2, ...] to an object
  const obj = {};
  for (let i = 0; i < items.length; i += 2) {
    const key = typeof items[i] === 'string' && items[i].startsWith('~:')
      ? items[i].slice(2)
      : decodeValue(items[i]);
    obj[key] = decodeValue(items[i + 1]);
  }

  switch (tag) {
    // Pointer: [id, metadata]
    case 'penpot/pointer':
      return obj;

    // Geometry types
    case 'rect':
      return { __type: 'rect', ...obj };
    case 'point':
      return { __type: 'point', ...obj };
    case 'matrix':
      return { __type: 'matrix', ...obj };

    // Shape type
    case 'shape':
      return { __type: 'shape', ...obj };

    // Path data
    case 'penpot/path-data':
      // Path data is a byte array / Uint8Array — already decoded from base64
      return { __type: 'path-data', data: obj };

    // Fills
    case 'penpot/fills':
      return { __type: 'fills', items: Array.isArray(obj) ? obj : [obj] };

    // Objects map v2
    case 'penpot/objects-map/v2':
      return { __type: 'objects-map', data: obj };

    // Token types
    case 'penpot/tokens-lib':
      return { __type: 'tokens-lib', ...obj };
    case 'penpot/token-set':
      return { __type: 'token-set', ...obj };
    case 'penpot/token-theme':
      return { __type: 'token-theme', ...obj };
    case 'penpot/token':
      return { __type: 'token', ...obj };

    // URI
    case 'uri':
      return obj.toString ? obj : String(obj);

    // Ordered map
    case 'ordered-map':
      return obj;

    // Ordered set
    case 'ordered-set':
      return new Set(Array.isArray(obj) ? obj : Object.values(obj));

    // Duration
    case 'duration':
      return obj;

    // Date/time (alternate encoding)
    case 'm':
      return typeof obj === 'number' ? new Date(obj).toISOString() : obj;

    default:
      // Unknown tag — return as object with type marker
      return { __type: tag, ...obj };
  }
}

/**
 * Recursively encode a JavaScript value for Transit.
 *
 * @param {*} val - The JavaScript value to encode.
 * @param {{ verbose?: boolean }} [opts] - Encoding options.
 * @param {Set} [seen] - Circular reference detection (internal).
 * @returns {*} The Transit-encoded value (to be JSON.stringify'd).
 */
function encodeValue(val, opts = {}, seen = new Set()) {
  if (val === null || val === undefined) return null;

  // Circular reference protection
  if (typeof val === 'object' && seen.has(val)) return null;
  if (typeof val === 'object') seen.add(val);

  // String — check for special cases
  if (typeof val === 'string') {
    // UUID detection
    if (isUUID(val)) return `~u${val}`;

    // Date/time ISO string → "~mEPOCHMS"
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      const ms = new Date(val).getTime();
      if (!isNaN(ms)) return `~m${ms}`;
    }

    // Keyword strings (kebab-case keys starting with a colon)
    if (val.startsWith(':')) return `~:${val.slice(1)}`;

    // Escape existing tilde prefixes
    if (val.startsWith('~')) return `~${val}`;

    return val;
  }

  // Number — pass through (integers and floats are both numbers in JS)
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return val;
    return val; // Floats encoded as-is
  }

  // Boolean
  if (typeof val === 'boolean') return val;

  // Date object → "~mEPOCHMS"
  if (val instanceof Date) {
    return `~m${val.getTime()}`;
  }

  // Array — check for special types
  if (Array.isArray(val)) {
    return val.map(v => encodeValue(v, opts, seen));
  }

  // Set → ["~#set", [...items]]
  if (val instanceof Set) {
    return ['~#set', [...val].map(v => encodeValue(v, opts, seen))];
  }

  // Map → ["^ ", k1, v1, k2, v2, ...]  (cognitect transit map encoding)
  if (val instanceof Map) {
    const entries = [];
    for (const [key, value] of val) {
      entries.push(encodeKey(key), encodeValue(value, opts, seen));
    }
    return ['^ ', ...entries];
  }

  // Plain object — encode keys as keywords and values recursively
  if (typeof val === 'object') {
    // Check for Penpot custom type markers
    if (val.__type) {
      const type = val.__type;
      const { __type, ...rest } = val;
      const encoded = {};
      for (const [key, value] of Object.entries(rest)) {
        encoded[key] = encodeValue(value, opts, seen);
      }
      return [`^ ${type}`, ...Object.entries(encoded).flat()];
    }

    // Regular object — encode as map with keyword keys
    const entries = [];
    for (const [key, value] of Object.entries(val)) {
      entries.push(encodeKey(key), encodeValue(value, opts, seen));
    }
    return ['^ ', ...entries];
  }

  return val;
}

/**
 * Encode a key for Transit. Keywords are prefixed with `~:`, strings left as-is.
 *
 * @param {*} key - The key to encode.
 * @returns {*} The encoded key.
 */
function encodeKey(key) {
  if (typeof key === 'string') {
    // If the key looks like a keyword (kebab-case with no special chars), encode it
    if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(key) && key.includes('-')) {
      return `~:${key}`;
    }
    return key;
  }
  return encodeValue(key);
}

/**
 * Decode a Penpot RPC request body.
 *
 * Handles both Transit+JSON and plain JSON request bodies,
 * automatically detecting the format based on content.
 *
 * @param {string} body - The raw request body string.
 * @param {string} [contentType] - The Content-Type header value.
 * @returns {Record<string, *>} The decoded parameters object with kebab-case keys.
 */
export function decodeRequest(body, contentType = '') {
  if (!body) return {};

  // Transit+JSON
  if (contentType.includes('transit+json')) {
    try {
      const decoded = decode(body);
      return toKebabCase(decoded);
    } catch (err) {
      console.error('[transit] Failed to decode Transit request:', err.message);
      return {};
    }
  }

  // Plain JSON (keys may be camelCase from the frontend)
  if (contentType.includes('application/json') || contentType.includes('text/plain') || !contentType) {
    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;
      return toKebabCase(parsed);
    } catch {
      return {};
    }
  }

  return {};
}

/**
 * Encode a response for the Penpot frontend.
 *
 * Automatically chooses the encoding format based on the client's Accept header
 * and query parameters. Returns `{ body, contentType }`.
 *
 * @param {*} result - The JavaScript value to encode.
 * @param {object} [opts] - Response options.
 * @param {string} [opts.accept] - The Accept header from the request.
 * @param {string} [opts.queryString] - The query string from the request URL.
 * @param {boolean} [opts.verbose] - Force verbose Transit encoding (for errors).
 * @returns {{ body: string, contentType: string }}
 */
export function encodeResponse(result, opts = {}) {
  const { accept = '', queryString = '', verbose = false } = opts;

  // Force JSON format via query parameter
  if (queryString.includes('_fmt=json')) {
    return {
      body: JSON.stringify(toCamelCase(result), jsonReplacer),
      contentType: 'application/json',
    };
  }

  // Check Accept header
  const wantTransit = accept.includes('transit+json') || !accept.includes('application/json');

  if (wantTransit) {
    // Transit+JSON response (default for Penpot frontend)
    return {
      body: encode(result, { verbose: verbose || accept === 'application/transit+json' }),
      contentType: 'application/transit+json',
    };
  }

  // JSON response — camelCase keys for compatibility
  return {
    body: JSON.stringify(toCamelCase(result), jsonReplacer),
    contentType: 'application/json',
  };
}

/**
 * JSON replacer for plain JSON responses.
 * Handles special types that don't have native JSON representations.
 */
function jsonReplacer(key, value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Set) return [...value];
  if (value instanceof Map) return Object.fromEntries(value);
  if (value && value.__type) {
    // Preserve type marker for round-tripping
    return { __type: value.__type, ...value };
  }
  return value;
}

/**
 * Convert an object's keys from camelCase to kebab-case recursively.
 * This matches the Clojure backend's `json/read-kebab-key`.
 *
 * @param {*} obj - The object to convert.
 * @returns {*} The object with kebab-case keys.
 */
export function toKebabCase(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toKebabCase);

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const kebabKey = camelToKebab(key);
    result[kebabKey] = toKebabCase(value);
  }
  return result;
}

/**
 * Convert an object's keys from kebab-case to camelCase recursively.
 * This matches the Clojure backend's `json/write-camel-key`.
 *
 * @param {*} obj - The object to convert.
 * @returns {*} The object with camelCase keys.
 */
export function toCamelCase(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = kebabToCamel(key);
    result[camelKey] = toCamelCase(value);
  }
  return result;
}

/**
 * Convert a camelCase string to kebab-case.
 *
 * @param {string} str - camelCase string (e.g., `'fileId'`).
 * @returns {string} kebab-case string (e.g., `'file-id'`).
 */
export function camelToKebab(str) {
  // Don't convert strings that are already kebab-case or are special
  if (!str || str.startsWith('~')) return str;
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Convert a kebab-case string to camelCase.
 *
 * @param {string} str - kebab-case string (e.g., `'file-id'`).
 * @returns {string} camelCase string (e.g., `'fileId'`).
 */
export function kebabToCamel(str) {
  if (!str) return str;
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}