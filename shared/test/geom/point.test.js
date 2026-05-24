import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Point, isPoint, isPointLike, point, close, angleToPoint,
  add, subtract, multiply, divide, min, max, inverse, negate,
  distance, distanceVector, length, angle, angleWithOther, angleSign,
  signedAngleWithOther, updateAngle, quadrant, round, roundStep,
  transform, matrixToPoint, toVec, scale, dot, unit, perpendicular,
  project, centerPoints, normalLeft, normalRight, pointLineDistance,
  almostZero, isZero, lerp, rotate, scaleFrom, noZeros, resize,
  absPoint, pointToString, pointToJSON, decodePoint
} from '@penpot/shared/geom/point';

describe('Point', () => {
  it('creates zero point', () => {
    const p = point();
    assert.ok(isPoint(p));
    assert.equal(p.x, 0);
    assert.equal(p.y, 0);
  });

  it('creates from single number (both coords)', () => {
    const p = point(5);
    assert.equal(p.x, 5);
    assert.equal(p.y, 5);
  });

  it('creates from x, y', () => {
    const p = point(3, 7);
    assert.equal(p.x, 3);
    assert.equal(p.y, 7);
  });

  it('creates from point (returns new instance)', () => {
    const p1 = point(1, 2);
    const p2 = point(p1);
    assert.equal(p2.x, 1);
    assert.equal(p2.y, 2);
  });

  it('creates from point-like object', () => {
    const p = point({ x: 10, y: 20 });
    assert.equal(p.x, 10);
    assert.equal(p.y, 20);
  });

  it('throws on invalid value', () => {
    assert.throws(() => point('invalid'), /invalid arguments/);
  });

  it('isPointLike', () => {
    assert.ok(isPointLike({ x: 1, y: 2 }));
    assert.ok(!isPointLike(null));
    assert.ok(!isPointLike({ x: 1 }));
  });

  it('close', () => {
    const p1 = point(1.0001, 2.0001);
    const p2 = point(1.0002, 2.0002);
    assert.ok(close(p1, p2));
  });

  it('add', () => {
    const r = add(point(1, 2), point(3, 4));
    assert.equal(r.x, 4);
    assert.equal(r.y, 6);
  });

  it('subtract', () => {
    const r = subtract(point(5, 7), point(2, 3));
    assert.equal(r.x, 3);
    assert.equal(r.y, 4);
  });

  it('multiply', () => {
    const r = multiply(point(2, 3), point(4, 5));
    assert.equal(r.x, 8);
    assert.equal(r.y, 15);
  });

  it('divide', () => {
    const r = divide(point(10, 20), point(2, 4));
    assert.equal(r.x, 5);
    assert.equal(r.y, 5);
  });

  it('min', () => {
    const r = min(point(1, 5), point(3, 2));
    assert.equal(r.x, 1);
    assert.equal(r.y, 2);
  });

  it('min with null', () => {
    const p = point(1, 2);
    assert.deepEqual(min(null, p), p);
    assert.deepEqual(min(p, null), p);
  });

  it('max', () => {
    const r = max(point(1, 5), point(3, 2));
    assert.equal(r.x, 3);
    assert.equal(r.y, 5);
  });

  it('inverse', () => {
    const r = inverse(point(2, 4));
    assert.equal(r.x, 0.5);
    assert.equal(r.y, 0.25);
  });

  it('negate', () => {
    const r = negate(point(3, -4));
    assert.equal(r.x, -3);
    assert.equal(r.y, 4);
  });

  it('distance', () => {
    const d = distance(point(0, 0), point(3, 4));
    assert.equal(d, 5);
  });

  it('distanceVector', () => {
    const dv = distanceVector(point(1, 1), point(4, 5));
    assert.equal(dv.x, 3);
    assert.equal(dv.y, 4);
  });

  it('length', () => {
    assert.equal(length(point(3, 4)), 5);
  });

  it('angle from x-axis', () => {
    const a = angle(point(1, 0));
    assert.equal(a, 0);
  });

  it('angle from center', () => {
    const a = angle(point(2, 1), point(1, 1));
    assert.equal(a, 0);
  });

  it('quadrant', () => {
    assert.equal(quadrant(point(1, 1)), 1);
    assert.equal(quadrant(point(-1, 1)), 2);
    assert.equal(quadrant(point(-1, -1)), 3);
    assert.equal(quadrant(point(1, -1)), 4);
  });

  it('round', () => {
    const r = round(point(1.567, 2.834), 2);
    assert.equal(r.x, 1.57);
    assert.equal(r.y, 2.83);
  });

  it('round default 0 decimals', () => {
    const r = round(point(1.5, 2.4));
    assert.equal(r.x, 2);
    assert.equal(r.y, 2);
  });

  it('scale', () => {
    const r = scale(point(3, 4), 2);
    assert.equal(r.x, 6);
    assert.equal(r.y, 8);
  });

  it('dot', () => {
    assert.equal(dot(point(1, 2), point(3, 4)), 11);
  });

  it('unit', () => {
    const u = unit(point(3, 4));
    assert.ok(Math.abs(u.x - 0.6) < 1e-6);
    assert.ok(Math.abs(u.y - 0.8) < 1e-6);
  });

  it('unit zero length returns zero', () => {
    const u = unit(point(0, 0));
    assert.equal(u.x, 0);
    assert.equal(u.y, 0);
  });

  it('perpendicular', () => {
    const p = perpendicular(point(1, 0));
    assert.ok(Math.abs(p.x) < 1e-6);
    assert.ok(Math.abs(p.y - 1) < 1e-6);
  });

  it('lerp', () => {
    const r = lerp(point(0, 0), point(10, 20), 0.5);
    assert.equal(r.x, 5);
    assert.equal(r.y, 10);
  });

  it('rotate', () => {
    const r = rotate(point(1, 0), point(0, 0), 90);
    assert.ok(Math.abs(r.x) < 1e-6);
    assert.ok(Math.abs(r.y - 1) < 1e-6);
  });

  it('toVec', () => {
    const v = toVec(point(1, 2), point(4, 6));
    assert.equal(v.x, 3);
    assert.equal(v.y, 4);
  });

  it('almostZero', () => {
    assert.ok(almostZero(point(0, 0)));
    assert.ok(!almostZero(point(0.01, 0)));
  });

  it('isZero', () => {
    assert.ok(isZero(point(0, 0)));
    assert.ok(!isZero(point(1, 0)));
  });

  it('absPoint', () => {
    const r = absPoint(point(-3, -4));
    assert.equal(r.x, 3);
    assert.equal(r.y, 4);
  });

  it('pointToString', () => {
    assert.equal(pointToString(point(3, 7)), '3,7');
  });

  it('pointToJSON', () => {
    const j = pointToJSON(point(1, 2));
    assert.deepEqual(j, { x: 1, y: 2 });
  });

  it('decodePoint from object', () => {
    const p = decodePoint({ x: 5, y: 10 });
    assert.ok(isPoint(p));
    assert.equal(p.x, 5);
  });

  it('decodePoint from string', () => {
    const p = decodePoint('3,7');
    assert.ok(isPoint(p));
    assert.equal(p.x, 3);
    assert.equal(p.y, 7);
  });

  it('transform with identity matrix', () => {
    const m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const r = transform(point(5, 10), m);
    assert.equal(r.x, 5);
    assert.equal(r.y, 10);
  });

  it('transform with translation', () => {
    const m = { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 };
    const r = transform(point(1, 2), m);
    assert.equal(r.x, 11);
    assert.equal(r.y, 22);
  });

  it('transform null matrix returns original', () => {
    const p = point(1, 2);
    assert.equal(transform(p, null), p);
  });

  it('noZeros replaces near-zero with 0.001', () => {
    const r = noZeros(point(0, 5));
    assert.equal(r.x, 0.001);
    assert.equal(r.y, 5);
  });

  it('resize', () => {
    const r = resize(point(3, 4), 10);
    assert.ok(Math.abs(length(r) - 10) < 1e-6);
  });

  it('scaleFrom', () => {
    const origin = point(0, 0);
    const pt = point(3, 4);
    const r = scaleFrom(pt, origin, 1);
    const expectedDist = distance(pt, origin) + 1;
    const actualDist = distance(r, origin);
    assert.ok(Math.abs(actualDist - expectedDist) < 1e-4);
  });

  it('angleWithOther', () => {
    const a = angleWithOther(point(1, 0), point(0, 1));
    assert.ok(Math.abs(a - 90) < 0.01);
  });

  it('angleSign', () => {
    assert.equal(angleSign(point(1, 0), point(0, 1)), 1);
  });

  it('matrixToPoint', () => {
    const p = matrixToPoint({ e: 5, f: 10 });
    assert.equal(p.x, 5);
    assert.equal(p.y, 10);
  });

  it('centerPoints', () => {
    const pts = [point(0, 0), point(10, 0), point(10, 10), point(0, 10)];
    const c = centerPoints(pts);
    assert.ok(Math.abs(c.x - 5) < 1e-6);
    assert.ok(Math.abs(c.y - 5) < 1e-6);
  });

  it('normalLeft', () => {
    const n = normalLeft({ x: 1, y: 0 });
    assert.ok(Math.abs(n.x) < 1e-6);
    assert.ok(Math.abs(n.y - 1) < 1e-6);
  });

  it('normalRight', () => {
    const n = normalRight({ x: 1, y: 0 });
    assert.ok(Math.abs(n.x) < 1e-6);
    assert.ok(Math.abs(n.y - (-1)) < 1e-6);
  });
});