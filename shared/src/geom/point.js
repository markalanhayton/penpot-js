import * as mth from '../math.js';

export class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

export function isPoint(v) {
  return v instanceof Point;
}

export function isPointLike(v) {
  return v != null && typeof v === 'object' && typeof v.x === 'number' && typeof v.y === 'number';
}

export function point(x, y) {
  if (x === undefined) return new Point(0, 0);
  if (isPoint(x)) return x;
  if (typeof x === 'number') {
    if (y === undefined) return new Point(x, x);
    return new Point(x, y);
  }
  if (isPointLike(x)) return new Point(x.x, x.y);
  throw new Error(`invalid arguments (point constructor): ${x}`);
}

export function close(p1, p2) {
  return mth.close(p1.x, p2.x) && mth.close(p1.y, p2.y);
}

export function angleToPoint(pt, angle, distance) {
  return new Point(
    pt.x + distance * mth.cos(angle),
    pt.y - distance * mth.sin(angle)
  );
}

export function add(p1, p2) {
  return new Point(p1.x + p2.x, p1.y + p2.y);
}

export function subtract(p1, p2) {
  return new Point(p1.x - p2.x, p1.y - p2.y);
}

export function multiply(p1, p2) {
  return new Point(p1.x * p2.x, p1.y * p2.y);
}

export function divide(p1, p2) {
  return new Point(p1.x / p2.x, p1.y / p2.y);
}

export function min(p1, p2) {
  if (p1 == null) return p2;
  if (p2 == null) return p1;
  return new Point(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y));
}

export function max(p1, p2) {
  if (p1 == null) return p2;
  if (p2 == null) return p1;
  return new Point(Math.max(p1.x, p2.x), Math.max(p1.y, p2.y));
}

export function inverse(pt) {
  return new Point(1.0 / pt.x, 1.0 / pt.y);
}

export function negate(pt) {
  return new Point(-pt.x, -pt.y);
}

export function distance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return mth.hypot(dx, dy);
}

export function distanceVector(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return new Point(mth.abs(dx), mth.abs(dy));
}

export function length(pt) {
  return mth.hypot(pt.x, pt.y);
}

export function angle(pt, center) {
  if (center === undefined) {
    return mth.degrees(mth.atan2(pt.y, pt.x));
  }
  const x = pt.x - center.x;
  const y = pt.y - center.y;
  return mth.degrees(mth.atan2(y, x));
}

export function angleWithOther(p1, p2) {
  const len1 = length(p1);
  const len2 = length(p2);
  if (mth.almostZero(len1) || mth.almostZero(len2)) return 0;
  let a = (p1.x * p2.x + p1.y * p2.y) / (len1 * len2);
  a = mth.acos(a < -1 ? -1 : a > 1 ? 1 : a);
  const d = mth.degrees(a);
  return Number.isNaN(d) ? 0 : d;
}

export function angleSign(p1, p2) {
  return (p1.y * p2.x > p1.x * p2.y) ? -1 : 1;
}

export function signedAngleWithOther(v1, v2) {
  return angleSign(v1, v2) * angleWithOther(v1, v2);
}

export function updateAngle(p, a) {
  const len = length(p);
  const rad = mth.radians(a);
  return new Point(mth.cos(rad) * len, mth.sin(rad) * len);
}

export function quadrant(p) {
  if (p.x >= 0) return p.y >= 0 ? 1 : 4;
  return p.y >= 0 ? 2 : 3;
}

export function round(pt, decimals) {
  if (decimals === undefined) decimals = 0;
  return new Point(mth.precision(pt.x, decimals), mth.precision(pt.y, decimals));
}

export function roundStep(pt, step) {
  return new Point(mth.round(pt.x, step), mth.round(pt.y, step));
}

export function transform(p, m) {
  if (!isPoint(p)) return undefined;
  if (m == null) return p;
  return new Point(
    p.x * m.a + p.y * m.c + m.e,
    p.x * m.b + p.y * m.d + m.f
  );
}

export function matrixToPoint(m) {
  return new Point(m.e, m.f);
}

export function toVec(p1, p2) {
  return subtract(p2, p1);
}

export function scale(p, scalar) {
  return new Point(p.x * scalar, p.y * scalar);
}

export function dot(p1, p2) {
  return p1.x * p2.x + p1.y * p2.y;
}

export function unit(p1) {
  const len = length(p1);
  if (mth.almostZero(len)) return new Point(0, 0);
  return new Point(p1.x / len, p1.y / len);
}

export function perpendicular(pt) {
  return new Point(-pt.y, pt.x);
}

export function project(v1, v2) {
  const v2Unit = unit(v2);
  const scalarProj = dot(v1, v2Unit);
  return scale(v2Unit, scalarProj);
}

export function centerPoints(points) {
  const k = point(points.length);
  return points.reduce((acc, p) => add(acc, divide(p, k)), point());
}

export function normalLeft({ x, y }) {
  return unit(point(-y, x));
}

export function normalRight({ x, y }) {
  return unit(point(y, -x));
}

export function pointLineDistance(pt, linePt1, linePt2) {
  const x0 = pt.x, y0 = pt.y;
  const x1 = linePt1.x, y1 = linePt1.y;
  const x2 = linePt2.x, y2 = linePt2.y;
  return mth.abs(x0 * (y2 - y1) - y0 * (x2 - x1) + x2 * y1 - y2 * x1) / distance(linePt2, linePt1);
}

export function almostZero(p) {
  return mth.almostZero(p.x) && mth.almostZero(p.y);
}

export function isZero(p) {
  return p.x === 0 && p.y === 0;
}

export function lerp(p1, p2, t) {
  return new Point(mth.lerp(p1.x, p2.x, t), mth.lerp(p1.y, p2.y, t));
}

export function rotate(p, c, a) {
  const rad = mth.radians(a);
  const px = p.x, py = p.y, cx = c.x, cy = c.y;
  const sa = mth.sin(rad), ca = mth.cos(rad);
  return new Point(
    ca * (px - cx) + sa * (py - cy) * -1 + cx,
    sa * (px - cx) + ca * (py - cy) + cy
  );
}

export function scaleFrom(pt, center, value) {
  return add(pt, scale(unit(toVec(center, pt)), value));
}

export function noZeros(p) {
  return new Point(
    mth.almostZero(p.x) ? 0.001 : p.x,
    mth.almostZero(p.y) ? 0.001 : p.y
  );
}

export function resize(vector, newLength) {
  const oldLength = length(vector);
  return scale(vector, newLength / oldLength);
}

export function absPoint(p) {
  return new Point(mth.abs(p.x), mth.abs(p.y));
}

export function pointToString(p) {
  if (!isPoint(p)) return p;
  return `${p.x},${p.y}`;
}

export function pointToJSON(p) {
  if (!isPoint(p)) return p;
  return { x: p.x, y: p.y };
}

export function decodePoint(p) {
  if (p instanceof Point) return p;
  if (typeof p === 'object' && p !== null) return new Point(p.x, p.y);
  if (typeof p === 'string') {
    const [x, y] = p.split(',').map(Number);
    return new Point(x, y);
  }
  return p;
}