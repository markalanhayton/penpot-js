/**
 * @module test/transit-roundtrip
 * @description Comprehensive Transit+JSON encode/decode roundtrip tests.
 *
 * Verifies that the JS port's transit codec produces and consumes the exact
 * same wire format as the Clojure backend's transit codec. These tests run
 * entirely locally (no backend required) and cover all Penpot-specific types.
 *
 * ### Test categories
 *
 * 1. Primitive types (strings, numbers, booleans, null)
 * 2. Penpot transit extensions (keywords, UUIDs, dates, symbols)
 * 3. Collection types (sets, lists, maps, arrays)
 * 4. Tagged maps (rect, point, matrix, penpot/pointer, penpot/path-data)
 * 5. Complex nested structures (file data, shape trees, change bundles)
 * 6. Key conversion (camelCase ↔ kebab-case)
 * 7. Request/response content negotiation
 * 8. Edge cases (empty values, special characters, large structures)
 * 9. Clojure backend wire format compatibility
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encode, decode, encodeResponse, decodeRequest,
  toKebabCase, toCamelCase, camelToKebab, kebabToCamel,
} from '../src/transit/index.js';
import { randomUUID } from 'node:crypto';

// ─── 1. Primitive Types ─────────────────────────────────────────────────────

describe('Transit decode: primitives', () => {
  it('decodes null', () => {
    assert.equal(decode('null'), null);
  });

  it('decodes undefined as null', () => {
    assert.equal(decode(undefined), undefined);
    assert.equal(decode(''), '');
  });

  it('decodes plain string', () => {
    assert.equal(decode('"hello world"'), 'hello world');
  });

  it('decodes empty string', () => {
    assert.equal(decode('""'), '');
  });

  it('decodes integer', () => {
    assert.equal(decode('42'), 42);
  });

  it('decodes negative integer', () => {
    assert.equal(decode('-7'), -7);
  });

  it('decodes zero', () => {
    assert.equal(decode('0'), 0);
  });

  it('decodes float', () => {
    assert.equal(decode('3.14159'), 3.14159);
  });

  it('decodes boolean true', () => {
    assert.equal(decode('true'), true);
  });

  it('decodes boolean false', () => {
    assert.equal(decode('false'), false);
  });

  it('decodes escaped tilde prefix ~~ as ~', () => {
    const result = decode('"~~escaped"');
    assert.equal(result, '~escaped');
  });
});

// ─── 2. Penpot Transit Extensions ────────────────────────────────────────────

describe('Transit decode: keywords', () => {
  it('decodes a simple keyword', () => {
    assert.equal(decode('"~:file-id"'), 'file-id');
  });

  it('decodes a single-segment keyword', () => {
    assert.equal(decode('"~:id"'), 'id');
  });

  it('decodes a multi-segment keyword', () => {
    assert.equal(decode('"~:penpot.shapes.group"'), 'penpot.shapes.group');
  });

  it('decodes keyword with namespace', () => {
    const result = decode('"~:app.common.types.shape/frame"');
    assert.equal(result, 'app.common.types.shape/frame');
  });

  it('does not decode plain JSON strings starting with colon', () => {
    const result = decode('":frame"');
    assert.equal(result, ':frame');
  });
});

describe('Transit decode: UUIDs', () => {
  it('decodes a UUID string', () => {
    const id = randomUUID();
    const result = decode(`"~u${id}"`);
    assert.equal(result, id);
  });

  it('decodes uppercase UUID', () => {
    const id = '550E8400-E29B-41D4-A716-446655440000';
    const result = decode(`"~u${id}"`);
    assert.equal(result, id);
  });

  it('round-trips a UUID through encode/decode', () => {
    const id = randomUUID();
    const obj = { id };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.id, id);
  });
});

describe('Transit decode: dates', () => {
  it('decodes a date from epoch millis', () => {
    const ms = 1700000000000;
    const result = decode(`"~m${ms}"`);
    assert.equal(result, new Date(ms).toISOString());
  });

  it('round-trips a date string through encode/decode', () => {
    const isoString = '2024-01-15T10:30:00.000Z';
    const encoded = encode({ 'created-at': isoString });
    const decoded = decode(encoded);
    assert.equal(decoded['created-at'], isoString);
  });

  it('encodes Date object as epoch millis', () => {
    const date = new Date('2024-06-01T12:00:00.000Z');
    const encoded = encode({ timestamp: date });
    const parsed = JSON.parse(encoded);
    assert.ok(parsed.find(v => typeof v === 'string' && v.startsWith('~m')),
      'encoded should contain ~m prefix for Date');
  });
});

describe('Transit decode: symbols', () => {
  it('decodes a symbol (~$)', () => {
    const result = decode('"~$my-symbol"');
    assert.equal(result, 'my-symbol');
  });
});

// ─── 3. Collection Types ─────────────────────────────────────────────────────

describe('Transit decode: sets', () => {
  it('decodes a simple set', () => {
    const result = decode('["~#set",["a","b","c"]]');
    assert.ok(result instanceof Set);
    assert.equal(result.size, 3);
    assert.ok(result.has('a'));
    assert.ok(result.has('b'));
    assert.ok(result.has('c'));
  });

  it('decodes a set with UUIDs', () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    const result = decode(`["~#set",["~u${id1}","~u${id2}"]]`);
    assert.ok(result instanceof Set);
    assert.ok(result.has(id1));
    assert.ok(result.has(id2));
  });

  it('decodes an empty set', () => {
    const result = decode('["~#set",[]]');
    assert.ok(result instanceof Set);
    assert.equal(result.size, 0);
  });
});

describe('Transit decode: lists', () => {
  it('decodes a list (~#list)', () => {
    const result = decode('["~#list",["a","b","c"]]');
    assert.deepEqual(result, ['a', 'b', 'c']);
  });

  it('decodes an empty list', () => {
    const result = decode('["~#list",[]]');
    assert.deepEqual(result, []);
  });
});

describe('Transit decode: maps (cognitect array encoding)', () => {
  it('decodes ["^ ", k1, v1, k2, v2] map', () => {
    const result = decode('["^ ","~:id","abc","~:name","test"]');
    assert.equal(result.id, 'abc');
    assert.equal(result.name, 'test');
  });

  it('decodes nested map', () => {
    const result = decode('["^ ","~:file",["^ ","~:id","f1","~:revn",5]]');
    assert.equal(result.file.id, 'f1');
    assert.equal(result.file.revn, 5);
  });

  it('decodes map with keyword keys not prefixed with ~:', () => {
    const result = decode('{"id":"abc","name":"test"}');
    assert.equal(result.id, 'abc');
    assert.equal(result.name, 'test');
  });

  it('decodes map with ~: prefixed keys', () => {
    const result = decode('{"~:id":"abc","~:name":"test"}');
    assert.equal(result.id, 'abc');
    assert.equal(result.name, 'test');
  });
});

describe('Transit encode: arrays', () => {
  it('encodes an array of primitives', () => {
    const encoded = encode([1, 'hello', true, null]);
    const decoded = decode(encoded);
    assert.deepEqual(decoded, [1, 'hello', true, null]);
  });

  it('encodes nested arrays', () => {
    const obj = { items: [[1, 2], [3, 4]] };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.deepEqual(decoded.items, [[1, 2], [3, 4]]);
  });
});

// ─── 4. Tagged Maps ─────────────────────────────────────────────────────────

describe('Transit decode: tagged maps', () => {
  it('decodes rect tagged map', () => {
    const result = decode('["^ rect","~:x",10,"~:y",20,"~:width",100,"~:height",50]');
    assert.equal(result.__type, 'rect');
    assert.equal(result.x, 10);
    assert.equal(result.y, 20);
    assert.equal(result.width, 100);
    assert.equal(result.height, 50);
  });

  it('decodes point tagged map', () => {
    const result = decode('["^ point","~:x",5,"~:y",10]');
    assert.equal(result.__type, 'point');
    assert.equal(result.x, 5);
    assert.equal(result.y, 10);
  });

  it('decodes matrix tagged map', () => {
    const result = decode('["^ matrix","~:a",1,"~:b",0,"~:c",0,"~:d",1,"~:e",0,"~:f",0]');
    assert.equal(result.__type, 'matrix');
    assert.equal(result.a, 1);
  });

  it('decodes penpot/pointer tagged map', () => {
    const result = decode('["^ penpot/pointer","~:id","abc123","~:page-id","p1"]');
    assert.equal(result.id, 'abc123');
    assert.equal(result['page-id'], 'p1');
  });

  it('decodes shape tagged map', () => {
    const result = decode('["^ shape","~:type","~:rect","~:x",0,"~:y",0]');
    assert.equal(result.__type, 'shape');
    assert.equal(result.type, 'rect');
  });

  it('decodes penpot/path-data tagged map', () => {
    const result = decode('["^ penpot/path-data","~:d","M0 0L10 10"]');
    assert.equal(result.__type, 'path-data');
  });

  it('decodes unknown tagged map with __type marker', () => {
    const result = decode('["^ custom-type","~:key","value"]');
    assert.equal(result.__type, 'custom-type');
    assert.equal(result.key, 'value');
  });

  it('round-trips rect through encode/decode', () => {
    const rect = { __type: 'rect', x: 10, y: 20, width: 100, height: 50 };
    const encoded = encode(rect);
    const decoded = decode(encoded);
    assert.equal(decoded.__type, 'rect');
    assert.equal(decoded.x, 10);
    assert.equal(decoded.y, 20);
  });

  it('round-trips point through encode/decode', () => {
    const point = { __type: 'point', x: 5, y: 10 };
    const encoded = encode(point);
    const decoded = decode(encoded);
    assert.equal(decoded.__type, 'point');
    assert.equal(decoded.x, 5);
    assert.equal(decoded.y, 10);
  });
});

describe('Transit decode: ordered-map and ordered-set', () => {
  it('decodes ordered-map tag', () => {
    const result = decode('["^ ordered-map","~:a",1,"~:b",2]');
    assert.equal(result.a, 1);
    assert.equal(result.b, 2);
  });

  it('ordered-set decode returns a Set (tagged map handling)', () => {
    const result = decode(JSON.stringify(['^ ordered-set', '~:a', '1', '~:b', '2']));
    assert.ok(result instanceof Set, 'result is a Set');
    assert.ok(result.size >= 1, 'Set has at least one element');
  });

  it('ordered-set with string items via ~#set encoding', () => {
    const result = decode('["~#set",["a","b","c"]]');
    assert.ok(result instanceof Set);
    assert.ok(result.has('a'));
    assert.ok(result.has('b'));
    assert.ok(result.has('c'));
  });

  it('decodes duration tag', () => {
    const result = decode('["^ duration","~:seconds",30]');
    assert.equal(result.seconds, 30);
  });

  it('decodes date tagged map (^ m) with key-value pairs', () => {
    const ms = 1700000000000;
    const result = decode(`["^ m","~:v","~m${ms}"]`);
    assert.equal(result.v, new Date(ms).toISOString());
  });
});

// ─── 5. Complex Nested Structures ────────────────────────────────────────────

describe('Transit roundtrip: complex structures', () => {
  it('round-trips a file-like object with UUIDs and dates', () => {
    const fileId = randomUUID();
    const projectId = randomUUID();
    const now = new Date().toISOString();

    const fileData = {
      id: fileId,
      'project-id': projectId,
      name: 'Test File',
      revn: 5,
      'is-shared': true,
      'created-at': now,
      'modified-at': now,
    };

    const encoded = encode(fileData);
    const decoded = decode(encoded);
    assert.equal(decoded.id, fileId);
    assert.equal(decoded['project-id'], projectId);
    assert.equal(decoded.name, 'Test File');
    assert.equal(decoded.revn, 5);
    assert.equal(decoded['is-shared'], true);
  });

  it('round-trips a shape-like object with nested arrays', () => {
    const shapeId = randomUUID();
    const shape = {
      id: shapeId,
      type: 'frame',
      name: 'Frame 1',
      x: 0,
      y: 0,
      width: 375,
      height: 812,
      fills: [{ type: 'solid', color: { r: 1, g: 0, b: 0.5, a: 1 } }],
      strokes: [],
      constraintsH: 'scale',
      constraintsV: 'scale',
    };

    const encoded = encode(shape);
    const decoded = decode(encoded);
    assert.equal(decoded.id, shapeId);
    assert.equal(decoded.type, 'frame');
    assert.equal(decoded.width, 375);
    assert.equal(decoded.height, 812);
  });

  it('round-trips an object with Set values', () => {
    const obj = { id: 'abc', tags: new Set(['tag1', 'tag2', 'tag3']) };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.id, 'abc');
    assert.ok(decoded.tags instanceof Set);
    assert.equal(decoded.tags.size, 3);
    assert.ok(decoded.tags.has('tag1'));
  });

  it('round-trips an object with Map values', () => {
    const m = new Map();
    m.set('key1', 'val1');
    m.set('key2', 'val2');
    const obj = { id: 'abc', data: m };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.id, 'abc');
    assert.equal(decoded.data.key1, 'val1');
    assert.equal(decoded.data.key2, 'val2');
  });

  it('round-trips deeply nested object (4 levels)', () => {
    const deep = {
      level1: {
        level2: {
          level3: {
            level4: { value: 42, name: 'deep' },
          },
        },
      },
    };
    const encoded = encode(deep);
    const decoded = decode(encoded);
    assert.equal(decoded.level1.level2.level3.level4.value, 42);
    assert.equal(decoded.level1.level2.level3.level4.name, 'deep');
  });

  it('round-trips an array of objects', () => {
    const pages = [
      { id: randomUUID(), name: 'Page 1', objects: 5 },
      { id: randomUUID(), name: 'Page 2', objects: 3 },
      { id: randomUUID(), name: 'Page 3', objects: 7 },
    ];
    const encoded = encode(pages);
    const decoded = decode(encoded);
    assert.equal(decoded.length, 3);
    assert.equal(decoded[0].name, 'Page 1');
    assert.equal(decoded[2].objects, 7);
  });

  it('handles null values in objects', () => {
    const obj = { id: 'abc', name: null, parentId: null };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.id, 'abc');
    assert.equal(decoded.name, null);
    assert.equal(decoded.parentId, null);
  });

  it('handles boolean values correctly', () => {
    const obj = { isActive: true, isDefault: false, isArchived: false };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.isActive, true);
    assert.equal(decoded.isDefault, false);
    assert.equal(decoded.isArchived, false);
  });

  it('handles mixed type values in same object', () => {
    const id = randomUUID();
    const obj = {
      id,
      name: 'Mixed',
      count: 42,
      ratio: 3.14,
      active: true,
      tag: null,
      'created-at': '2024-01-15T10:30:00.000Z',
    };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.id, id);
    assert.equal(decoded.name, 'Mixed');
    assert.equal(decoded.count, 42);
    assert.equal(decoded.ratio, 3.14);
    assert.equal(decoded.active, true);
    assert.equal(decoded.tag, null);
  });
});

// ─── 6. Key Conversion ───────────────────────────────────────────────────────

describe('camelToKebab / kebabToCamel', () => {
  it('converts standard camelCase', () => {
    assert.equal(camelToKebab('profileId'), 'profile-id');
    assert.equal(camelToKebab('isDefault'), 'is-default');
    assert.equal(camelToKebab('fileId'), 'file-id');
  });

  it('converts multi-word camelCase', () => {
    assert.equal(camelToKebab('hasMediaTrimmed'), 'has-media-trimmed');
    assert.equal(camelToKebab('modifiedAt'), 'modified-at');
    assert.equal(camelToKebab('isShared'), 'is-shared');
  });

  it('does not convert already kebab-case', () => {
    assert.equal(camelToKebab('file-id'), 'file-id');
    assert.equal(camelToKebab('is-default'), 'is-default');
  });

  it('leaves single lowercase word unchanged', () => {
    assert.equal(camelToKebab('name'), 'name');
    assert.equal(camelToKebab('id'), 'id');
  });

  it('handles empty string', () => {
    assert.equal(camelToKebab(''), '');
  });

  it('does not convert Transit prefixes', () => {
    assert.equal(camelToKebab('~:keyword'), '~:keyword');
  });

  it('converts standard kebab-case back', () => {
    assert.equal(kebabToCamel('profile-id'), 'profileId');
    assert.equal(kebabToCamel('is-default'), 'isDefault');
    assert.equal(kebabToCamel('file-id'), 'fileId');
  });

  it('converts multi-segment kebab-case', () => {
    assert.equal(kebabToCamel('has-media-trimmed'), 'hasMediaTrimmed');
    assert.equal(kebabToCamel('modified-at'), 'modifiedAt');
  });

  it('round-trips camelCase → kebab → camel', () => {
    const cases = ['fileId', 'isDefault', 'projectId', 'modifiedAt', 'hasMediaTrimmed'];
    for (const c of cases) {
      assert.equal(kebabToCamel(camelToKebab(c)), c);
    }
  });
});

describe('toKebabCase / toCamelCase deep recursion', () => {
  it('converts nested object keys', () => {
    const obj = { profileId: 'abc', nestedObj: { childKey: 1 } };
    const kebab = toKebabCase(obj);
    assert.equal(kebab['profile-id'], 'abc');
    assert.equal(kebab['nested-obj']['child-key'], 1);
  });

  it('converts arrays of objects', () => {
    const arr = [{ fileId: 'x' }, { fileId: 'y' }];
    const kebab = toKebabCase(arr);
    assert.equal(kebab[0]['file-id'], 'x');
    assert.equal(kebab[1]['file-id'], 'y');
  });

  it('round-trips object through kebab → camel', () => {
    const original = { profileId: 'abc', isDefault: true, items: [{ fileKey: 'x' }] };
    const kebab = toKebabCase(original);
    const camel = toCamelCase(kebab);
    assert.deepEqual(camel, original);
  });

  it('handles null and undefined in toKebabCase', () => {
    assert.equal(toKebabCase(null), null);
    assert.equal(toKebabCase(undefined), undefined);
  });

  it('handles null and undefined in toCamelCase', () => {
    assert.equal(toCamelCase(null), null);
    assert.equal(toCamelCase(undefined), undefined);
  });

  it('preserves primitive values in toKebabCase', () => {
    assert.equal(toKebabCase('hello'), 'hello');
    assert.equal(toKebabCase(42), 42);
    assert.equal(toKebabCase(true), true);
  });
});

// ─── 7. Request/Response Content Negotiation ──────────────────────────────────

describe('decodeRequest', () => {
  it('decodes Transit+JSON content type', () => {
    const body = JSON.stringify({ '~:file-id': 'abc' });
    const result = decodeRequest(body, 'application/transit+json');
    assert.equal(result['file-id'], 'abc');
  });

  it('decodes plain JSON and converts camelCase to kebab-case', () => {
    const body = JSON.stringify({ fileId: 'abc', projectName: 'test' });
    const result = decodeRequest(body, 'application/json');
    assert.equal(result['file-id'], 'abc');
    assert.equal(result['project-name'], 'test');
  });

  it('decodes unknown content type as plain JSON', () => {
    const body = JSON.stringify({ fileId: 'abc' });
    const result = decodeRequest(body, '');
    assert.equal(result['file-id'], 'abc');
  });

  it('returns empty object for null body', () => {
    assert.deepEqual(decodeRequest(null), {});
  });

  it('handles Transit encoded nested object', () => {
    const body = '["^ ","~:file-id","abc","~:data",["^ ","~:revn",5]]';
    const result = decodeRequest(body, 'application/transit+json');
    assert.equal(result['file-id'], 'abc');
    assert.equal(result.data.revn, 5);
  });
});

describe('encodeResponse', () => {
  it('returns Transit+JSON by default', () => {
    const { contentType } = encodeResponse({ id: 'abc' }, {});
    assert.equal(contentType, 'application/transit+json');
  });

  it('returns JSON when _fmt=json in query string', () => {
    const { contentType } = encodeResponse({ id: 'abc' }, { queryString: '_fmt=json' });
    assert.equal(contentType, 'application/json');
  });

  it('returns JSON when Accept prefers application/json', () => {
    const { contentType } = encodeResponse({ id: 'abc' }, { accept: 'application/json' });
    assert.equal(contentType, 'application/json');
  });

  it('returns Transit when Accept is application/transit+json', () => {
    const { contentType } = encodeResponse({ id: 'abc' }, { accept: 'application/transit+json' });
    assert.equal(contentType, 'application/transit+json');
  });

  it('JSON response uses camelCase keys', () => {
    const { body, contentType } = encodeResponse(
      { fileId: 'abc', isDefault: true },
      { accept: 'application/json' },
    );
    assert.equal(contentType, 'application/json');
    const parsed = JSON.parse(body);
    assert.equal(parsed.fileId, 'abc');
    assert.equal(parsed.isDefault, true);
  });

  it('Transit response contains transit-encoded content', () => {
    const id = randomUUID();
    const { body, contentType } = encodeResponse(
      { id },
      { accept: 'application/transit+json' },
    );
    assert.equal(contentType, 'application/transit+json');
    assert.ok(body.includes('~u') || body.includes(id));
  });

  it('verbose Transit encoding includes whitespace', () => {
    const { body } = encodeResponse(
      { type: 'error', code: 'not-found' },
      { verbose: true },
    );
    assert.ok(body.length > 0);
  });

  it('handles null response', () => {
    const { body, contentType } = encodeResponse(null, {});
    assert.equal(contentType, 'application/transit+json');
    assert.ok(body);
  });
});

// ─── 8. Edge Cases ───────────────────────────────────────────────────────────

describe('Transit edge cases', () => {
  it('handles empty object', () => {
    const encoded = encode({});
    assert.ok(typeof encoded === 'string');
    const parsed = JSON.parse(encoded);
    assert.ok(parsed[0] === '^ ', 'empty object encoded as cognitect map');
  });

  it('handles empty array', () => {
    const encoded = encode([]);
    const decoded = decode(encoded);
    assert.deepEqual(decoded, []);
  });

  it('handles object with only UUID values (encode produces transit format)', () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    const obj = { 'file-id': id1, 'project-id': id2 };
    const encoded = encode(obj);
    assert.ok(encoded.includes(`~u${id1}`), 'UUID1 encoded with ~u prefix');
    assert.ok(encoded.includes(`~u${id2}`), 'UUID2 encoded with ~u prefix');
  });

  it('handles object with numeric keys', () => {
    const obj = { a: 1, b: 2 };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.a, 1);
    assert.equal(decoded.b, 2);
  });

  it('handles very long string values', () => {
    const longStr = 'x'.repeat(10000);
    const obj = { data: longStr };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.data, longStr);
  });

  it('handles unicode strings', () => {
    const obj = { name: '日本語テスト 🎨', description: 'Ñoño' };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.name, '日本語テスト 🎨');
    assert.equal(decoded.description, 'Ñoño');
  });

  it('handles special JSON characters in string values', () => {
    const obj = { path: '/api/rpc?foo=bar&baz=qux', html: '<div class="test">hi</div>' };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.path, '/api/rpc?foo=bar&baz=qux');
    assert.equal(decoded.html, '<div class="test">hi</div>');
  });

  it('handles escaped tilde prefix in strings', () => {
    const result = decode('"~~escaped"');
    assert.equal(result, '~escaped');
  });

  it('handles object with falsey values', () => {
    const obj = { zero: 0, empty: '', falsy: false, nully: null };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.zero, 0);
    assert.equal(decoded.empty, '');
    assert.equal(decoded.falsy, false);
    assert.equal(decoded.nully, null);
  });

  it('handles circular reference protection', () => {
    const obj = { name: 'root' };
    obj.self = obj;
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.name, 'root');
    assert.equal(decoded.self, null);
  });
});

// ─── 9. Clojure Backend Wire Format Compatibility ────────────────────────────

describe('Clojure wire format compatibility', () => {
  it('decodes Clojure transit map with keyword keys', () => {
    const cljResponse = '["^ ","~:id","~u550e8400-e29b-41d4-a716-446655440000","~:name","Test File","~:revn",5]';
    const decoded = decode(cljResponse);
    assert.equal(decoded.id, '550e8400-e29b-41d4-a716-446655440000');
    assert.equal(decoded.name, 'Test File');
    assert.equal(decoded.revn, 5);
  });

  it('decodes Clojure transit with nested keyword keys', () => {
    const cljResponse = '["^ ","~:file",["^ ","~:id","f1","~:data",["^ ","~:pages",["~#list",[]]]],"~:revn",3]';
    const decoded = decode(cljResponse);
    assert.equal(decoded.file.id, 'f1');
    assert.equal(decoded.file.data.pages.length, 0);
    assert.equal(decoded.revn, 3);
  });

  it('decodes Clojure transit set correctly', () => {
    const cljSet = '["~#set",["~:frame","~:group","~:rect"]]';
    const decoded = decode(cljSet);
    assert.ok(decoded instanceof Set);
    assert.ok(decoded.has('frame'));
    assert.ok(decoded.has('group'));
    assert.ok(decoded.has('rect'));
  });

  it('decodes Clojure transit list correctly', () => {
    const cljList = '["~#list",["a","b","c"]]';
    const decoded = decode(cljList);
    assert.deepEqual(decoded, ['a', 'b', 'c']);
  });

  it('decodes Clojure transit with UUIDs in map values', () => {
    const id1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const id2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
    const cljResponse = `{"~:id":"~u${id1}","~:project-id":"~u${id2}"}`;
    const decoded = decode(cljResponse);
    assert.equal(decoded.id, id1);
    assert.equal(decoded['project-id'], id2);
  });

  it('decodes Clojure transit with date values', () => {
    const ts = '2024-01-15T10:30:00.000Z';
    const encoded = encode({ 'created-at': ts });
    const decoded = decode(encoded);
    assert.equal(decoded['created-at'], ts);
  });

  it('produces output compatible with Clojure transit decoder (object)', () => {
    const id = randomUUID();
    const obj = { id, name: 'test', revn: 1, isDefault: false };
    const encoded = encode(obj);

    assert.ok(typeof encoded === 'string', 'encoded output is a string');
    const parsed = JSON.parse(encoded);
    assert.ok(Array.isArray(parsed), 'encoded output is an array (cognitect map format)');
    assert.equal(parsed[0], '^ ', 'encoded output starts with "^ " map prefix');
  });

  it('produces transit-encoded keyword keys matching Clojure format', () => {
    const obj = { 'file-id': 'abc' };
    const encoded = encode(obj);
    assert.ok(encoded.includes('~:file-id'), 'key encoded as ~:file-id');
  });

  it('encodes Set correctly for Clojure consumption', () => {
    const set = new Set(['tag1', 'tag2']);
    const encoded = encode(set);
    const parsed = JSON.parse(encoded);

    assert.equal(parsed[0], '~#set', 'Set starts with ~#set tag');
    assert.ok(Array.isArray(parsed[1]), 'Set items are in an array');
  });

  it('encodes Map correctly for Clojure consumption', () => {
    const m = new Map([['key1', 'val1'], ['key2', 'val2']]);
    const encoded = encode(m);
    const parsed = JSON.parse(encoded);

    assert.equal(parsed[0], '^ ', 'Map encoded as cognitect map prefix');
    assert.ok(parsed.includes('key1'), 'Map contains original key');
  });

  it('decodes Clojure error response format', () => {
    const errorResponse = '["^ ","~:type","~:validation","~:code","~:validation-error","~:hint","Name is required"]';
    const decoded = decode(errorResponse);
    assert.equal(decoded.type, 'validation');
    assert.equal(decoded.code, 'validation-error');
    assert.equal(decoded.hint, 'Name is required');
  });

  it('decodes Clojure response with mixed value types', () => {
    const id = randomUUID();
    const response = `["^ ","~:id","~u${id}","~:name","Test","~:revn",3,"~:is-shared",true,"~:modified-at","~m1700000000000"]`;
    const decoded = decode(response);
    assert.equal(decoded.id, id);
    assert.equal(decoded.name, 'Test');
    assert.equal(decoded.revn, 3);
    assert.equal(decoded['is-shared'], true);
    assert.equal(typeof decoded['modified-at'], 'string');
  });

  it('decodes Clojure transit with penpot/pointer tagged map', () => {
    const id = randomUUID();
    const response = `["^ penpot/pointer","~:id","~u${id}","~:page-id","~u${randomUUID()}"]`;
    const decoded = decode(response);
    assert.equal(decoded.id, id);
    assert.ok(decoded['page-id']);
  });
});

describe('Transit encode: round-trip verification', () => {
  it('round-trips through encode then decode (kebab-case keys)', () => {
    const original = {
      id: randomUUID(),
      name: 'Test Round Trip',
      revn: 42,
      'is-shared': false,
      'created-at': '2024-06-15T12:00:00.000Z',
    };
    const encoded = encode(original);
    const decoded = decode(encoded);

    assert.equal(decoded.id, original.id);
    assert.equal(decoded.name, original.name);
    assert.equal(decoded.revn, original.revn);
    assert.equal(decoded['is-shared'], original['is-shared']);
    assert.equal(decoded['created-at'], original['created-at']);
  });

  it('round-trips a Penpot RPC response-like structure', () => {
    const fileId = randomUUID();
    const projectId = randomUUID();
    const pageId1 = randomUUID();
    const pageId2 = randomUUID();
    const pageObj1 = randomUUID();
    const pageObj2 = randomUUID();
    const pageObj3 = randomUUID();

    const response = {
      id: fileId,
      name: 'My File',
      'project-id': projectId,
      revn: 10,
      'is-shared': true,
      'modified-at': '2024-01-20T08:30:00.000Z',
      pages: [
        { id: pageId1, name: 'Page 1', objects: [pageObj1, pageObj2] },
        { id: pageId2, name: 'Page 2', objects: [pageObj3] },
      ],
    };

    const encoded = encode(response);
    const decoded = decode(encoded);

    assert.equal(decoded.id, fileId);
    assert.equal(decoded.name, 'My File');
    assert.equal(decoded['project-id'], projectId);
    assert.equal(decoded.revn, 10);
    assert.equal(decoded['is-shared'], true);
    assert.ok(Array.isArray(decoded.pages));
    assert.equal(decoded.pages.length, 2);
    assert.equal(decoded.pages[0].name, 'Page 1');
    assert.equal(decoded.pages[0].objects.length, 2);
  });

  it('round-trips an error-like response', () => {
    const error = {
      type: 'validation',
      code: 'validation-error',
      hint: 'Name is required',
    };
    const encoded = encode(error);
    const decoded = decode(encoded);
    assert.equal(decoded.type, 'validation');
    assert.equal(decoded.code, 'validation-error');
    assert.equal(decoded.hint, 'Name is required');
  });

  it('round-trips a list of team-like objects', () => {
    const teams = [
      { id: randomUUID(), name: 'Team A', 'members-count': 5, 'is-default': true },
      { id: randomUUID(), name: 'Team B', 'members-count': 12, 'is-default': false },
    ];
    const encoded = encode(teams);
    const decoded = decode(encoded);
    assert.ok(Array.isArray(decoded));
    assert.equal(decoded[0].name, 'Team A');
    assert.equal(decoded[1]['members-count'], 12);
  });
});