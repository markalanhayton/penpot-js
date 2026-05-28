'use strict';
/**
 * @module transit/test
 * @description Tests for the Transit+JSON encoder/decoder.
 */

import { encode, decode, encodeResponse, decodeRequest, toKebabCase, toCamelCase, camelToKebab, kebabToCamel } from './index.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
    console.error(`  Expected: ${JSON.stringify(expected)}`);
    console.error(`  Actual:   ${JSON.stringify(actual)}`);
  }
}

// --- Basic Decoding Tests ---

console.log('Testing Transit decode...');

// Keyword strings
assertEqual(decode('"~:file-id"'), 'file-id', 'keyword decode');
assertEqual(decode('"~:id"'), 'id', 'keyword decode short');

// UUID strings
assert(decode('"~u550e8400-e29b-41d4-a716-446655440000"') === '550e8400-e29b-41d4-a716-446655440000', 'UUID decode');

// Date/time strings
const decodedDate = decode('"~m1700000000000"');
assert(decodedDate === new Date(1700000000000).toISOString(), 'date decode');

// Plain strings
assertEqual(decode('"hello"'), 'hello', 'plain string decode');

// Numbers
assertEqual(decode('42'), 42, 'integer decode');
assertEqual(decode('3.14'), 3.14, 'float decode');

// Booleans
assertEqual(decode('true'), true, 'boolean true decode');
assertEqual(decode('false'), false, 'boolean false decode');

// Null
assertEqual(decode('null'), null, 'null decode');

// --- Array-as-Map Decoding ---

// Simple object (Transit map encoding)
const simpleObj = decode('["^ ", "~:id", "abc123", "~:name", "My File"]');
assertEqual(simpleObj.id, 'abc123', 'simple object id');
assertEqual(simpleObj.name, 'My File', 'simple object name');

// Nested object
const nested = decode('["^ ", "~:file", ["^ ", "~:id", "f1", "~:revn", 5]]');
assertEqual(nested.file.id, 'f1', 'nested object id');
assertEqual(nested.file.revn, 5, 'nested object revn');

// --- Set Decoding ---
const setVal = decode('["~#set", ["~:a", "~:b", "~:c"]]');
assert(setVal instanceof Set, 'set type');
assert(setVal.has('a'), 'set contains a');
assert(setVal.has('b'), 'set contains b');
assert(setVal.has('c'), 'set contains c');

// --- Tagged Map Decoding ---
const rect = decode('["^ rect", "~:x", 10, "~:y", 20, "~:width", 100, "~:height", 50]');
assertEqual(rect.__type, 'rect', 'rect type');
assertEqual(rect.x, 10, 'rect x');
assertEqual(rect.y, 20, 'rect y');

const point = decode('["^ point", "~:x", 5, "~:y", 10]');
assertEqual(point.__type, 'point', 'point type');

const pointer = decode('["^ penpot/pointer", "~:id", "abc", "~:page-id", "p1"]');
assertEqual(pointer.id, 'abc', 'pointer id');

// --- Basic Encoding Tests ---

console.log('Testing Transit encode...');

// Strings
const encStr = encode('hello');
assertEqual(JSON.parse(encStr), 'hello', 'encode plain string');

// Numbers
const encInt = encode(42);
assertEqual(JSON.parse(encInt), 42, 'encode integer');

const encFloat = encode(3.14);
assertEqual(JSON.parse(encFloat), 3.14, 'encode float');

// Booleans
const encBool = encode(true);
assertEqual(JSON.parse(encBool), true, 'encode boolean');

// Null
const encNull = encode(null);
assertEqual(JSON.parse(encNull), null, 'encode null');

// UUIDs
const encUuid = encode('550e8400-e29b-41d4-a716-446655440000');
assert(JSON.parse(encUuid) === '~u550e8400-e29b-41d4-a716-446655440000', 'encode UUID');

// Date strings
const encDate = encode('2024-01-15T10:30:00.000Z');
const parsed = JSON.parse(encDate);
assert(parsed.startsWith('~m'), 'encode date string with ~m prefix');

// Objects with kebab-case keys
const encObj = encode({ 'file-id': 'abc', 'rev-n': 5 });
const parsedObj = JSON.parse(encObj);
// Should encode as Transit map ["^ ", "~:file-id", "abc", "~:rev-n", 5]
assert(Array.isArray(parsedObj), 'encoded object is array');
assert(parsedObj[0] === '^ ', 'encoded object starts with "^ "');

// Objects with camelCase keys (should leave as-is)
const encCamel = encode({ fileId: 'abc', revN: 5 });
const parsedCamel = JSON.parse(encCamel);
assert(Array.isArray(parsedCamel), 'encoded camelCase object is array');

// --- Round-trip Tests ---

console.log('Testing round-trip encode/decode...');

// Simple object round-trip
const orig = { id: 'abc', name: 'Test', revn: 5, isShared: false };
const encoded = encode(orig);
const decoded = decode(encoded);
assertEqual(decoded.id, orig.id, 'round-trip id');
assertEqual(decoded.name, orig.name, 'round-trip name');
assertEqual(decoded.revn, orig.revn, 'round-trip revn');

// Nested object round-trip
const nested2 = { file: { id: 'f1', pages: ['p1', 'p2'], data: { components: {} } } };
const encNested = encode(nested2);
const decNested = decode(encNested);
assertEqual(decNested.file.id, 'f1', 'nested round-trip file.id');
assertEqual(decNested.file.pages.length, 2, 'nested round-trip pages');

// --- Request Decoding Tests ---

console.log('Testing request decoding...');

const transitBody = '["^ ", "~:id", "~u550e8400-e29b-41d4-a716-446655440000", "~:name", "My File"]';
const decodedReq = decodeRequest(transitBody, 'application/transit+json');
assertEqual(decodedReq.id, '550e8400-e29b-41d4-a716-446655440000', 'transit request id');
assertEqual(decodedReq.name, 'My File', 'transit request name');

const jsonBody = '{"id":"abc","fileId":"f1"}';
const decodedJson = decodeRequest(jsonBody, 'application/json');
assertEqual(decodedJson.id, 'abc', 'json request id');
// camelCase keys should be converted to kebab-case
assertEqual(decodedJson['file-id'], 'f1', 'json camelCase → kebab-case');

// --- Response Encoding Tests ---

console.log('Testing response encoding...');

// Transit response (default)
const transitResp = encodeResponse({ id: 'abc', revn: 5 }, { accept: 'application/transit+json' });
assertEqual(transitResp.contentType, 'application/transit+json', 'transit response content-type');

// JSON response
const jsonResp = encodeResponse({ id: 'abc', revn: 5 }, { accept: 'application/json' });
assertEqual(jsonResp.contentType, 'application/json', 'json response content-type');
assert('file-id' in JSON.parse(jsonResp.body) === false, 'json response uses camelCase');

// Force JSON format
const forceJson = encodeResponse({ id: 'abc' }, { queryString: '_fmt=json' });
assertEqual(forceJson.contentType, 'application/json', 'forced json content-type');

// --- Key Conversion Tests ---

console.log('Testing key conversion...');

assertEqual(camelToKebab('fileId'), 'file-id', 'camelToKebab');
assertEqual(camelToKebab('isShared'), 'is-shared', 'camelToKebab isShared');
assertEqual(camelToKebab('revn'), 'revn', 'camelToKebab no uppercase');
assertEqual(camelToKebab('hasMediaTrimmed'), 'has-media-trimmed', 'camelToKebab multiple');

assertEqual(kebabToCamel('file-id'), 'fileId', 'kebabToCamel');
assertEqual(kebabToCamel('is-shared'), 'isShared', 'kebabToCamel isShared');
assertEqual(kebabToCamel('has-media-trimmed'), 'hasMediaTrimmed', 'kebabToCamel multiple');

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);