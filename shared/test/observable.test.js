import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Observable, BehaviorSubject, filter, map, debounce } from '../src/observable.js';

describe('Observable', () => {
  it('subscribe() and notify()', () => {
    const obs = new Observable();
    const received = [];
    obs.subscribe((data) => received.push(data));
    obs.notify(1);
    obs.notify(2);
    assert.deepEqual(received, [1, 2]);
  });

  it('subscribe() returns unsubscribe function', () => {
    const obs = new Observable();
    const received = [];
    const unsub = obs.subscribe((data) => received.push(data));
    obs.notify(1);
    unsub();
    obs.notify(2);
    assert.deepEqual(received, [1]);
  });

  it('clear() removes all observers', () => {
    const obs = new Observable();
    obs.subscribe(() => {});
    obs.subscribe(() => {});
    obs.clear();
    assert.equal(obs.size, 0);
  });

  it('size() returns observer count', () => {
    const obs = new Observable();
    assert.equal(obs.size, 0);
    const unsub1 = obs.subscribe(() => {});
    assert.equal(obs.size, 1);
    const unsub2 = obs.subscribe(() => {});
    assert.equal(obs.size, 2);
    unsub1();
    assert.equal(obs.size, 1);
  });

  it('observer errors do not break other observers', () => {
    const obs = new Observable();
    const received = [];
    obs.subscribe(() => { throw new Error('boom'); });
    obs.subscribe((data) => received.push(data));
    obs.notify(42);
    assert.deepEqual(received, [42]);
  });
});

describe('BehaviorSubject', () => {
  it('getValue() returns current value', () => {
    const subject = new BehaviorSubject(0);
    assert.equal(subject.getValue(), 0);
    subject.next(42);
    assert.equal(subject.getValue(), 42);
  });

  it('subscribe() receives current value immediately', () => {
    const subject = new BehaviorSubject(10);
    const received = [];
    subject.subscribe((data) => received.push(data));
    assert.deepEqual(received, [10]);
    subject.next(20);
    assert.deepEqual(received, [10, 20]);
  });
});

describe('filter', () => {
  it('filters notifications by predicate', () => {
    const source = new Observable();
    const evens = filter(source, (x) => x % 2 === 0);
    const received = [];
    evens.subscribe((data) => received.push(data));
    source.notify(1);
    source.notify(2);
    source.notify(3);
    source.notify(4);
    assert.deepEqual(received, [2, 4]);
  });
});

describe('map', () => {
  it('transforms notifications', () => {
    const source = new Observable();
    const doubled = map(source, (x) => x * 2);
    const received = [];
    doubled.subscribe((data) => received.push(data));
    source.notify(1);
    source.notify(5);
    assert.deepEqual(received, [2, 10]);
  });
});