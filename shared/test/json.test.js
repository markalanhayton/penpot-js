import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  encode, decode, toJs, toClj, readKebabKey, writeCamelKey,
} from '../src/json.js';

describe('json', () => {
  it('writeCamelKey converts kebab to camel', () => {
    assert.equal(writeCamelKey('file-id'), 'fileId');
    assert.equal(writeCamelKey('my-long-key'), 'myLongKey');
  });

  it('readKebabKey converts camel to kebab', () => {
    assert.equal(readKebabKey('fileId'), 'file-id');
    assert.equal(readKebabKey('myLongKey'), 'my-long-key');
  });

  it('readKebabKey passes through strings with /', () => {
    assert.equal(readKebabKey('uri/path'), 'uri/path');
  });

  it('encode() serializes to JSON', () => {
    const result = encode({ a: 1, b: 'hello' });
    assert.equal(JSON.parse(result).a, 1);
  });

  it('decode() parses JSON', () => {
    const result = decode('{"a":1,"b":"hello"}');
    assert.equal(result.a, 1);
    assert.equal(result.b, 'hello');
  });

  it('encode() with keyFn converts keys', () => {
    const input = { 'file-id': 1 };
    const result = JSON.parse(encode(input, { keyFn: writeCamelKey }));
    assert.ok('fileId' in result);
  });

  it('decode() with keyFn converts keys', () => {
    const input = '{"fileId":1}';
    const result = decode(input, { keyFn: readKebabKey });
    assert.ok('file-id' in result);
  });

  it('toJs() converts nested objects', () => {
    const input = { 'my-key': { 'nested-key': 42 } };
    const result = toJs(input, { keyFn: writeCamelKey });
    assert.ok('myKey' in result);
    assert.ok('nestedKey' in result.myKey);
  });

  it('toClj() converts nested objects', () => {
    const input = { myKey: { nestedKey: 42 } };
    const result = toClj(input, { keyFn: readKebabKey });
    assert.ok('my-key' in result);
    assert.ok('nested-key' in result['my-key']);
  });

  it('encode/decode roundtrip', () => {
    const obj = { name: 'test', count: 42, items: [1, 2, 3] };
    const encoded = encode(obj);
    const decoded = decode(encoded);
    assert.deepEqual(decoded, obj);
  });

  it('encode handles null', () => {
    assert.equal(encode(null), 'null');
  });

  it('decode handles null', () => {
    assert.equal(decode('null'), null);
  });
});