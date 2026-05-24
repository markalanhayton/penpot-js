import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { create, isObjectsMap, count, get, has, set, del, keys, vals, entries, toObject, fromObject, wrap, reduceKv } from '../src/objects_map.js';

describe('objects-map', () => {
  it('create empty', () => {
    const m = create();
    assert.equal(isObjectsMap(m), true);
    assert.equal(count(m), 0);
  });

  it('create from object', () => {
    const m = create({ a: 1, b: 2 });
    assert.equal(count(m), 2);
    assert.equal(get(m, 'a'), 1);
    assert.equal(get(m, 'b'), 2);
  });

  it('create from Map', () => {
    const source = new Map([['x', 10], ['y', 20]]);
    const m = create(source);
    assert.equal(count(m), 2);
    assert.equal(get(m, 'x'), 10);
  });

  it('has / get with not-found', () => {
    const m = create({ a: 1 });
    assert.equal(has(m, 'a'), true);
    assert.equal(has(m, 'b'), false);
    assert.equal(get(m, 'b', -1), -1);
  });

  it('set returns new map', () => {
    const m1 = create({ a: 1 });
    const m2 = set(m1, 'b', 2);
    assert.equal(count(m1), 1);
    assert.equal(count(m2), 2);
    assert.equal(get(m2, 'b'), 2);
  });

  it('del returns new map', () => {
    const m1 = create({ a: 1, b: 2 });
    const m2 = del(m1, 'a');
    assert.equal(count(m1), 2);
    assert.equal(count(m2), 1);
    assert.equal(has(m2, 'a'), false);
  });

  it('keys / vals / entries', () => {
    const m = create({ a: 1, b: 2 });
    assert.deepEqual(keys(m).sort(), ['a', 'b']);
    assert.deepEqual(vals(m).sort(), [1, 2]);
    assert.equal(entries(m).length, 2);
  });

  it('toObject / fromObject', () => {
    const obj = { a: 1, b: 2 };
    const m = fromObject(obj);
    assert.equal(count(m), 2);
    assert.deepEqual(toObject(m), obj);
  });

  it('wrap plain object', () => {
    const m = wrap({ x: 42 });
    assert.equal(isObjectsMap(m), true);
    assert.equal(get(m, 'x'), 42);
  });

  it('wrap objects-map returns same', () => {
    const m1 = create({ a: 1 });
    const m2 = wrap(m1);
    assert.equal(m1, m2);
  });

  it('reduceKv', () => {
    const m = create({ a: 1, b: 2 });
    const sum = reduceKv(m, (acc, k, v) => acc + v, 0);
    assert.equal(sum, 3);
  });
});