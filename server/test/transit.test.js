import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encode, decode, toKebabCase, toCamelCase,
  camelToKebab, kebabToCamel,
  decodeRequest, encodeResponse,
} from '../src/transit/index.js';
import { randomUUID } from 'node:crypto';

describe('camelToKebab', () => {
  it('converts camelCase to kebab-case', () => {
    assert.equal(camelToKebab('profileId'), 'profile-id');
    assert.equal(camelToKebab('isDefault'), 'is-default');
    assert.equal(camelToKebab('projectId'), 'project-id');
  });

  it('leaves already-kebab strings unchanged', () => {
    assert.equal(camelToKebab('file-id'), 'file-id');
  });

  it('handles single lowercase word', () => {
    assert.equal(camelToKebab('name'), 'name');
  });

  it('handles empty string', () => {
    assert.equal(camelToKebab(''), '');
  });

  it('does not convert Transit-prefixed strings', () => {
    assert.equal(camelToKebab('~:keyword'), '~:keyword');
  });
});

describe('kebabToCamel', () => {
  it('converts kebab-case to camelCase', () => {
    assert.equal(kebabToCamel('profile-id'), 'profileId');
    assert.equal(kebabToCamel('is-default'), 'isDefault');
  });

  it('leaves already-camelCase strings unchanged', () => {
    assert.equal(kebabToCamel('name'), 'name');
  });
});

describe('toKebabCase / toCamelCase recursion', () => {
  it('converts nested objects', () => {
    const obj = { profileId: 'abc', nestedObj: { childKey: 1 } };
    const result = toKebabCase(obj);
    assert.equal(result['profile-id'], 'abc');
    assert.equal(result['nested-obj']['child-key'], 1);
  });

  it('converts arrays', () => {
    const obj = [{ fileId: 'x' }];
    const result = toKebabCase(obj);
    assert.equal(result[0]['file-id'], 'x');
  });

  it('round trips camel → kebab → camel', () => {
    const original = { profileId: 'abc', isDefault: true, items: [{ fileKey: 'x' }] };
    const kebab = toKebabCase(original);
    const camel = toCamelCase(kebab);
    assert.deepEqual(camel, original);
  });

  it('handles null and undefined', () => {
    assert.equal(toKebabCase(null), null);
    assert.equal(toKebabCase(undefined), undefined);
    assert.equal(toCamelCase(null), null);
  });
});

describe('Transit decode', () => {
  it('decodes a keyword', () => {
    const result = decode('"~:file-id"');
    assert.equal(result, 'file-id');
  });

  it('decodes a UUID', () => {
    const id = randomUUID();
    const result = decode(`"~u${id}"`);
    assert.equal(result, id);
  });

  it('decodes a date', () => {
    const ms = 1700000000000;
    const result = decode(`"~m${ms}"`);
    assert.equal(result, new Date(ms).toISOString());
  });

  it('decodes a set', () => {
    const result = decode('["~#set",["a","b"]]');
    assert.ok(result instanceof Set);
    assert.ok(result.has('a'));
    assert.ok(result.has('b'));
  });

  it('decodes an object with keyword keys', () => {
    const result = decode('{"~:id":"abc","~:name":"test"}');
    assert.equal(result.id, 'abc');
    assert.equal(result.name, 'test');
  });

  it('decodes a cognitect map encoding ["^ ", k1, v1]', () => {
    const result = decode('["^ ","~:id","abc","~:name","test"]');
    assert.equal(result.id, 'abc');
    assert.equal(result.name, 'test');
  });

  it('decodes null', () => {
    assert.equal(decode('null'), null);
  });

  it('decodes a plain string', () => {
    assert.equal(decode('"hello"'), 'hello');
  });

  it('decodes a number', () => {
    assert.equal(decode('42'), 42);
  });
});

describe('Transit encode', () => {
  it('encodes UUID strings with ~u prefix', () => {
    const id = randomUUID();
    const encoded = encode({ id });
    assert.ok(encoded.includes(`~u${id}`));
  });

  it('encodes a Set', () => {
    const result = JSON.parse(encode(new Set(['a'])));
    assert.deepEqual(result[0], '~#set');
  });

  it('round-trips an object with UUIDs', () => {
    const id = randomUUID();
    const obj = { id, name: 'test', count: 5 };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.equal(decoded.id, id);
    assert.equal(decoded.name, 'test');
    assert.equal(decoded.count, 5);
  });
});

describe('decodeRequest', () => {
  it('decodes Transit+JSON content type', () => {
    const body = JSON.stringify({ '~:file-id': 'abc' });
    const result = decodeRequest(body, 'application/transit+json');
    assert.equal(result['file-id'], 'abc');
  });

  it('decodes plain JSON', () => {
    const body = JSON.stringify({ fileId: 'abc' });
    const result = decodeRequest(body, 'application/json');
    assert.equal(result['file-id'], 'abc');
  });

  it('returns empty object for null body', () => {
    assert.deepEqual(decodeRequest(null), {});
  });
});

describe('encodeResponse', () => {
  it('returns Transit+JSON by default', () => {
    const { contentType } = encodeResponse({ id: 'abc' }, {});
    assert.equal(contentType, 'application/transit+json');
  });

  it('returns JSON when _fmt=json in query', () => {
    const { contentType } = encodeResponse({ id: 'abc' }, { queryString: '_fmt=json' });
    assert.equal(contentType, 'application/json');
  });

  it('returns JSON when Accept prefers JSON', () => {
    const { contentType } = encodeResponse({ id: 'abc' }, { accept: 'application/json' });
    assert.equal(contentType, 'application/json');
  });
});