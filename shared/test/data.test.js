import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  pick, getIn, setIn, dissocIn, deepMerge, withoutNils,
  patchObject, indexBy, groupBy, seek, indexOf, indexOfPred,
  removeAtIndex, replaceById, withoutObj, enumerate,
  concatVec, concatSet, zip, zipAll, mapMap,
  filterMap, removeMap, updateVals, updateWhen,
  assocWhen, inRange, notEmpty, vecWithoutNils,
  withNext, withPrev, withPrevNext, distinctBy,
  truncate, obfuscateString, assert as assertFn,
} from '../src/data.js';

describe('data', () => {
  it('pick() selects keys from object', () => {
    const obj = { a: 1, b: 2, c: 3 };
    assert.deepEqual(pick(obj, ['a', 'c']), { a: 1, c: 3 });
  });

  it('pick() omits missing keys', () => {
    const obj = { a: 1 };
    assert.deepEqual(pick(obj, ['a', 'b']), { a: 1 });
  });

  it('getIn() accesses nested paths', () => {
    const obj = { a: { b: { c: 42 } } };
    assert.equal(getIn(obj, ['a', 'b', 'c']), 42);
  });

  it('getIn() returns default for missing paths', () => {
    assert.equal(getIn({ a: 1 }, ['b', 'c'], 'default'), 'default');
  });

  it('getIn() returns default for null intermediate', () => {
    assert.equal(getIn({ a: null }, ['a', 'b'], 'default'), 'default');
  });

  it('setIn() sets nested value', () => {
    const obj = { a: { b: 1 } };
    const result = setIn(obj, ['a', 'b'], 42);
    assert.equal(result.a.b, 42);
    assert.equal(obj.a.b, 1);
  });

  it('dissocIn() removes nested key', () => {
    const obj = { a: { b: 1, c: 2 } };
    const result = dissocIn(obj, ['a', 'b']);
    assert.deepEqual(result, { a: { c: 2 } });
  });

  it('deepMerge() merges deeply', () => {
    const a = { x: { a: 1, b: 2 } };
    const b = { x: { b: 3, c: 4 } };
    assert.deepEqual(deepMerge(a, b), { x: { a: 1, b: 3, c: 4 } });
  });

  it('withoutNils() removes null/undefined values', () => {
    assert.deepEqual(withoutNils({ a: 1, b: null, c: undefined, d: 0 }), { a: 1, d: 0 });
  });

  it('patchObject() applies patches', () => {
    const obj = { a: 1, b: { foo: 1, bar: 2 }, c: 10 };
    const changes = { a: 2, b: { foo: null, k: 3 } };
    const result = patchObject(obj, changes);
    assert.equal(result.a, 2);
    assert.equal(result.b.foo, undefined);
    assert.equal(result.b.bar, 2);
    assert.equal(result.b.k, 3);
    assert.equal(result.c, 10);
  });

  it('indexBy() creates lookup map', () => {
    const items = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
    const result = indexBy(items, (x) => x.id);
    assert.equal(result.a.v, 1);
    assert.equal(result.b.v, 2);
  });

  it('indexBy() with value fn', () => {
    const items = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
    const result = indexBy(items, (x) => x.id, (x) => x.v);
    assert.equal(result.a, 1);
    assert.equal(result.b, 2);
  });

  it('groupBy() groups items', () => {
    const items = ['a', 'bb', 'ccc', 'dd'];
    const result = groupBy(items, (x) => x.length);
    assert.deepEqual(result[1], ['a']);
    assert.deepEqual(result[2], ['bb', 'dd']);
    assert.deepEqual(result[3], ['ccc']);
  });

  it('seek() finds first matching item', () => {
    assert.equal(seek((x) => x > 3, [1, 2, 3, 4, 5]), 4);
    assert.equal(seek((x) => x > 10, [1, 2, 3], 'nope'), 'nope');
  });

  it('indexOf() finds index', () => {
    assert.equal(indexOf([10, 20, 30], 20), 1);
    assert.equal(indexOf([10, 20, 30], 40), -1);
  });

  it('indexOfPred() finds index by predicate', () => {
    assert.equal(indexOfPred([1, 2, 3], (x) => x > 2), 2);
  });

  it('removeAtIndex() removes element at index', () => {
    assert.deepEqual(removeAtIndex([10, 20, 30], 1), [10, 30]);
  });

  it('replaceById() replaces item by id', () => {
    const coll = [{ id: 1, v: 'a' }, { id: 2, v: 'b' }];
    const result = replaceById(coll, { id: 2, v: 'c' });
    assert.equal(result[1].v, 'c');
  });

  it('withoutObj() removes elements equal to obj', () => {
    assert.deepEqual(withoutObj([1, 2, 3, 2], 2), [1, 3]);
  });

  it('enumerate() returns index-value pairs', () => {
    assert.deepEqual(enumerate(['a', 'b', 'c']), [[0, 'a'], [1, 'b'], [2, 'c']]);
  });

  it('enumerate() with start offset', () => {
    assert.deepEqual(enumerate(['a', 'b'], 5), [[5, 'a'], [6, 'b']]);
  });

  it('concatVec() concatenates arrays', () => {
    assert.deepEqual(concatVec([1, 2], [3, 4]), [1, 2, 3, 4]);
  });

  it('concatSet() combines sets', () => {
    const result = concatSet(new Set([1, 2]), new Set([2, 3]));
    assert.ok(result.has(1));
    assert.ok(result.has(2));
    assert.ok(result.has(3));
  });

  it('zip() pairs elements', () => {
    assert.deepEqual(zip([1, 2, 3], ['a', 'b', 'c']), [[1, 'a'], [2, 'b'], [3, 'c']]);
  });

  it('zipAll() pairs with padding', () => {
    assert.deepEqual(zipAll([1, 2], ['a']), [[1, 'a'], [2, undefined]]);
  });

  it('mapMap() maps over object values', () => {
    const result = mapMap((k, v) => v * 2, { a: 1, b: 2 });
    assert.deepEqual(result, { a: 2, b: 4 });
  });

  it('filterMap() filters object entries', () => {
    const result = filterMap(([, v]) => v > 1, { a: 1, b: 2, c: 3 });
    assert.deepEqual(result, { b: 2, c: 3 });
  });

  it('removeMap() removes object entries', () => {
    const result = removeMap(([, v]) => v > 1, { a: 1, b: 2, c: 3 });
    assert.deepEqual(result, { a: 1 });
  });

  it('updateVals() transforms all values', () => {
    assert.deepEqual(updateVals({ a: 1, b: 2 }, (v) => v + 10), { a: 11, b: 12 });
  });

  it('updateWhen() updates only existing keys', () => {
    assert.deepEqual(updateWhen({ a: 1 }, 'a', (v) => v + 1), { a: 2 });
    assert.deepEqual(updateWhen({ a: 1 }, 'b', (v) => v + 1), { a: 1 });
  });

  it('assocWhen() sets only existing keys', () => {
    assert.deepEqual(assocWhen({ a: 1 }, 'a', 2), { a: 2 });
    assert.deepEqual(assocWhen({ a: 1 }, 'b', 2), { a: 1 });
  });

  it('inRange() checks bounds', () => {
    assert.ok(inRange(10, 5));
    assert.ok(!inRange(10, -1));
    assert.ok(!inRange(10, 10));
  });

  it('notEmpty() checks non-empty collections', () => {
    assert.ok(notEmpty([1]));
    assert.ok(!notEmpty([]));
    assert.ok(notEmpty({ a: 1 }));
    assert.ok(!notEmpty({}));
  });

  it('vecWithoutNils() filters nils', () => {
    assert.deepEqual(vecWithoutNils([1, null, 2, undefined, 3]), [1, 2, 3]);
  });

  it('withNext() pairs with next element', () => {
    assert.deepEqual(withNext([1, 2, 3]), [[1, 2], [2, 3], [3, null]]);
  });

  it('withPrev() pairs with previous element', () => {
    assert.deepEqual(withPrev([1, 2, 3]), [[1, null], [2, 1], [3, 2]]);
  });

  it('withPrevNext() pairs with prev and next', () => {
    assert.deepEqual(withPrevNext([1, 2, 3]), [[1, null, 2], [2, 1, 3], [3, 2, null]]);
  });

  it('distinctBy() creates deduplication filter', () => {
    const items = [{ k: 1 }, { k: 2 }, { k: 1 }, { k: 3 }];
    const result = items.filter(distinctBy((x) => x.k));
    assert.equal(result.length, 3);
  });

  it('truncate() truncates strings', () => {
    assert.equal(truncate('hello world', 5), 'hello');
    assert.equal(truncate('hi', 5), 'hi');
  });

  it('obfuscateString() masks sensitive strings', () => {
    assert.equal(obfuscateString('password123'), 'p*********3');
    assert.equal(obfuscateString('ab'), '**');
    assert.equal(obfuscateString('abc', false), 'abc');
  });

  it('assert() throws on failure', () => {
    assert.throws(() => assertFn('must be true', () => false));
    assert.doesNotThrow(() => assertFn('must be true', () => true));
  });
});