import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  now, isInst, inst, instMs, isAfter, isBefore,
  isAfterOrEqual, isBeforeOrEqual, seconds, formatInst,
  plus, minus, diffMs, inFuture, inPast, tpointMs,
} from '../src/time.js';

describe('time', () => {
  it('now() returns a Date', () => {
    const d = now();
    assert.ok(d instanceof Date);
  });

  it('isInst() checks for Date', () => {
    assert.ok(isInst(new Date()));
    assert.ok(!isInst('2024-01-01'));
    assert.ok(!isInst(12345));
  });

  it('inst() converts various types to Date', () => {
    assert.ok(inst(new Date()) instanceof Date);
    assert.ok(inst(0) instanceof Date);
    assert.ok(inst('2024-01-01T00:00:00Z') instanceof Date);
    assert.equal(inst(null), null);
  });

  it('instMs() returns milliseconds', () => {
    const d = new Date('2024-06-15T12:00:00Z');
    assert.equal(instMs(d), d.getTime());
    assert.equal(instMs(null), 0);
  });

  it('isAfter / isBefore compare dates', () => {
    const a = new Date('2024-01-01');
    const b = new Date('2024-06-01');
    assert.ok(isAfter(b, a));
    assert.ok(isBefore(a, b));
    assert.ok(!isAfter(a, b));
    assert.ok(!isBefore(b, a));
  });

  it('isAfterOrEqual / isBeforeOrEqual', () => {
    const a = new Date('2024-01-01');
    const b = new Date('2024-01-01');
    assert.ok(isAfterOrEqual(a, b));
    assert.ok(isBeforeOrEqual(a, b));
  });

  it('seconds() converts date to epoch seconds', () => {
    const d = new Date('2024-01-01T00:00:00Z');
    const expected = Math.floor(d.getTime() / 1000);
    assert.equal(seconds(d), expected);
  });

  it('formatInst() formats ISO', () => {
    const d = new Date('2024-06-15T12:30:45.123Z');
    assert.equal(formatInst(d, 'iso'), '2024-06-15T12:30:45.123Z');
  });

  it('formatInst() formats iso-date', () => {
    const d = new Date('2024-06-15T12:30:45Z');
    assert.equal(formatInst(d, 'iso-date'), '2024-06-15');
  });

  it('formatInst() returns null for null', () => {
    assert.equal(formatInst(null), null);
  });

  it('plus() adds milliseconds', () => {
    const d = new Date('2024-01-01T00:00:00Z');
    const result = plus(d, 1000);
    assert.equal(result.getTime(), d.getTime() + 1000);
  });

  it('minus() subtracts milliseconds', () => {
    const d = new Date('2024-01-01T00:00:00Z');
    const result = minus(d, 1000);
    assert.equal(result.getTime(), d.getTime() - 1000);
  });

  it('plus() accepts duration object', () => {
    const d = new Date('2024-01-01T00:00:00Z');
    const result = plus(d, { hours: 1 });
    assert.equal(result.getTime(), d.getTime() + 3600000);
  });

  it('diffMs() computes difference', () => {
    const a = new Date('2024-01-01T00:00:00Z');
    const b = new Date('2024-01-01T00:00:05Z');
    assert.equal(diffMs(a, b), 5000);
  });

  it('inFuture() returns a future date', () => {
    const futureDate = inFuture(5000);
    assert.ok(futureDate.getTime() > Date.now() - 1000);
  });

  it('inPast() returns a past date', () => {
    const pastDate = inPast(5000);
    assert.ok(pastDate.getTime() < Date.now() + 1000);
  });

  it('tpointMs() measures elapsed time', () => {
    const tp = tpointMs();
    const start = performance.now();
    for (let i = 0; i < 1000000; i++) {}
    const elapsed = tp();
    assert.ok(elapsed >= 0);
    assert.ok(elapsed < 1000);
  });
});