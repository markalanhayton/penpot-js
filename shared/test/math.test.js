import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PI, nan, isFinite, finite, abs, sin, cos, acos, tan, atan2,
  neg, sq, pow, sqrt, cubicroot, floor, round, ceil, precision,
  toFixed, radians, degrees, hypot, distance, log10, clamp,
  almostZero, roundToZero, close, lerp, maxAbs, sign,
} from '../src/math.js';

describe('math', () => {
  it('PI equals Math.PI', () => assert.equal(PI, Math.PI));

  it('nan() checks for NaN', () => {
    assert.ok(nan(NaN));
    assert.ok(!nan(0));
    assert.ok(!nan(Infinity));
  });

  it('isFinite() checks for finite numbers', () => {
    assert.ok(isFinite(42));
    assert.ok(isFinite(0));
    assert.ok(!isFinite(Infinity));
    assert.ok(!isFinite(NaN));
    assert.ok(!isFinite(null));
  });

  it('finite() returns value or default', () => {
    assert.equal(finite(42, 0), 42);
    assert.equal(finite(Infinity, 0), 0);
    assert.equal(finite(NaN, -1), -1);
  });

  it('abs()', () => assert.equal(abs(-5), 5));
  it('sin()', () => assert.ok(Math.abs(sin(0)) < 1e-10));
  it('cos()', () => assert.ok(Math.abs(cos(0) - 1) < 1e-10));
  it('neg()', () => assert.equal(neg(5), -5));
  it('sq()', () => assert.equal(sq(3), 9));
  it('pow()', () => assert.equal(pow(2, 10), 1024));
  it('sqrt()', () => assert.equal(sqrt(144), 12));

  it('cubicroot()', () => {
    assert.ok(Math.abs(cubicroot(27) - 3) < 1e-10);
    assert.ok(Math.abs(cubicroot(-27) - (-3)) < 1e-10);
  });

  it('floor()', () => assert.equal(floor(3.7), 3));
  it('ceil()', () => assert.equal(ceil(3.2), 4));

  it('round() without step', () => assert.equal(round(3.7), 4));
  it('round() with step', () => assert.equal(round(13.4, 0.5), 13.5));

  it('precision()', () => assert.equal(precision(3.14159, 2), 3.14));
  it('precision() returns undefined for non-number', () => assert.equal(precision('x', 2), undefined));

  it('toFixed()', () => assert.equal(toFixed(3.14159, 2), '3.14'));

  it('radians()', () => assert.ok(Math.abs(radians(180) - PI) < 1e-10));
  it('degrees()', () => assert.ok(Math.abs(degrees(PI) - 180) < 1e-10));

  it('hypot()', () => assert.ok(Math.abs(hypot(3, 4) - 5) < 1e-10));

  it('distance()', () => {
    const d = distance([0, 0], [3, 4]);
    assert.equal(d, 5);
  });

  it('clamp()', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(15, 0, 10), 10);
  });

  it('almostZero()', () => {
    assert.ok(almostZero(0));
    assert.ok(almostZero(1e-5));
    assert.ok(!almostZero(0.01));
  });

  it('roundToZero()', () => {
    assert.equal(roundToZero(1e-5), 0);
    assert.equal(roundToZero(0.01), 0.01);
  });

  it('close()', () => {
    assert.ok(close(1.0, 1.001));
    assert.ok(!close(1.0, 1.1));
    assert.ok(close(1.0, 1.01, 0.02));
  });

  it('lerp()', () => {
    assert.equal(lerp(0, 10, 0.5), 5);
    assert.equal(lerp(0, 10, 0), 0);
    assert.equal(lerp(0, 10, 1), 10);
  });

  it('maxAbs()', () => assert.equal(maxAbs(-5, 3), 5));

  it('sign()', () => {
    assert.equal(sign(-5), -1);
    assert.equal(sign(5), 1);
    assert.equal(sign(0), 1);
  });
});