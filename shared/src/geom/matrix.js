import * as gpt from './point.js';
import * as mth from '../math.js';

const PRECISION = 6;

export class Matrix {
  constructor(a, b, c, d, e, f) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }

  toString() {
    return formatPrecision(this, PRECISION);
  }
}

export function isMatrix(v) {
  return v instanceof Matrix;
}

export function matrix(a, b, c, d, e, f) {
  if (a === undefined) return new Matrix(1, 0, 0, 1, 0, 0);
  return new Matrix(a, b, c, d, e, f);
}

export const base = matrix();

export function isBase(v) {
  return v === base;
}

export function formatPrecision(mtx, prec) {
  if (!mtx) return undefined;
  return `matrix(${mth.toFixed(mtx.a, prec)}, ${mth.toFixed(mtx.b, prec)}, ${mth.toFixed(mtx.c, prec)}, ${mth.toFixed(mtx.d, prec)}, ${mth.toFixed(mtx.e, prec)}, ${mth.toFixed(mtx.f, prec)})`;
}

export function close(m1, m2) {
  return mth.close(m1.a, m2.a) && mth.close(m1.b, m2.b) &&
         mth.close(m1.c, m2.c) && mth.close(m1.d, m2.d) &&
         mth.close(m1.e, m2.e) && mth.close(m1.f, m2.f);
}

export function isUnit(m1) {
  return m1 != null &&
         mth.close(m1.a, 1) && mth.close(m1.b, 0) &&
         mth.close(m1.c, 0) && mth.close(m1.d, 1) &&
         mth.close(m1.e, 0) && mth.close(m1.f, 0);
}

export function multiply(m1, m2, ...others) {
  if (others.length > 0) {
    return others.reduce((acc, m) => multiplyMutable(acc, m), multiply(m1, m2));
  }

  if (m1 == null && m2 == null) return matrix();
  if (m1 == null) return m2;
  if (m2 == null) return m1;

  return new Matrix(
    m1.a * m2.a + m1.c * m2.b,
    m1.b * m2.a + m1.d * m2.b,
    m1.a * m2.c + m1.c * m2.d,
    m1.b * m2.c + m1.d * m2.d,
    m1.a * m2.e + m1.c * m2.f + m1.e,
    m1.b * m2.e + m1.d * m2.f + m1.f
  );
}

export function multiplyMutable(m1, m2) {
  const m1a = m1.a, m1b = m1.b, m1c = m1.c, m1d = m1.d, m1e = m1.e, m1f = m1.f;
  const m2a = m2.a, m2b = m2.b, m2c = m2.c, m2d = m2.d, m2e = m2.e, m2f = m2.f;
  return new Matrix(
    m1a * m2a + m1c * m2b,
    m1b * m2a + m1d * m2b,
    m1a * m2c + m1c * m2d,
    m1b * m2c + m1d * m2d,
    m1a * m2e + m1c * m2f + m1e,
    m1b * m2e + m1d * m2f + m1f
  );
}

export function addTranslate(m1, m2, ...others) {
  if (others.length > 0) {
    return others.reduce((acc, m) => addTranslate(acc, m), addTranslate(m1, m2));
  }
  return new Matrix(1, 0, 0, 1, m1.e + m2.e, m1.f + m2.f);
}

export function substract(m1, m2) {
  return new Matrix(
    m1.a - m2.a, m1.b - m2.b, m1.c - m2.c,
    m1.d - m2.d, m1.e - m2.e, m1.f - m2.f
  );
}

export function translateMatrix(pt, y) {
  if (typeof pt === 'number') return new Matrix(1, 0, 0, 1, pt, y);
  return new Matrix(1, 0, 0, 1, pt.x, pt.y);
}

export function translateMatrixNeg(pt, y) {
  if (typeof pt === 'number') return new Matrix(1, 0, 0, 1, -pt, -y);
  return new Matrix(1, 0, 0, 1, -pt.x, -pt.y);
}

export function scaleMatrix(pt, center) {
  if (center === undefined) {
    return new Matrix(pt.x, 0, 0, pt.y, 0, 0);
  }
  const sx = pt.x, sy = pt.y, cx = center.x, cy = center.y;
  return new Matrix(sx, 0, 0, sy, -cx * sx + cx, -cy * sy + cy);
}

export function rotateMatrix(angle, center) {
  if (center === undefined) {
    const a = mth.radians(angle);
    const c = mth.cos(a), s = mth.sin(a);
    return new Matrix(c, s, -s, c, 0, 0);
  }
  const cx = center.x, cy = center.y;
  const a = mth.radians(angle);
  const c = mth.cos(a), s = mth.sin(a);
  const ns = -s;
  const tx = c * (-cx) + ns * (-cy) + cx;
  const ty = s * (-cx) + c * (-cy) + cy;
  return new Matrix(c, s, ns, c, tx, ty);
}

export function skewMatrix(angleX, angleY, point) {
  if (point !== undefined) {
    return multiply(
      translateMatrix(point),
      skewMatrix(angleX, angleY),
      translateMatrix(gpt.negate(point))
    );
  }
  const m1 = mth.tan(mth.radians(angleX));
  const m2 = mth.tan(mth.radians(angleY));
  return new Matrix(1, m2, m1, 1, 0, 0);
}

export function rotate(m, angle, center) {
  if (center !== undefined) return multiply(m, rotateMatrix(angle, center));
  return multiply(m, rotateMatrix(angle));
}

export function scale(m, pt, center) {
  if (center !== undefined) return multiply(m, scaleMatrix(pt, center));
  return multiply(m, scaleMatrix(pt));
}

export function translate(m, pt) {
  return multiply(m, translateMatrix(pt));
}

export function skew(m, angleX, angleY, pt) {
  if (pt !== undefined) return multiply(m, skewMatrix(angleX, angleY, pt));
  return multiply(m, skewMatrix(angleX, angleY));
}

export function mEqual(m1, m2, threshold) {
  const thEq = (a, b) => mth.abs(a - b) <= threshold;
  return thEq(m1.a, m2.a) && thEq(m1.b, m2.b) &&
         thEq(m1.c, m2.c) && thEq(m1.d, m2.d) &&
         thEq(m1.e, m2.e) && thEq(m1.f, m2.f);
}

export function transformIn(pt, mtx) {
  if (pt != null && mtx != null) {
    return multiply(
      translateMatrix(pt),
      mtx,
      translateMatrix(gpt.negate(pt))
    );
  }
  return mtx;
}

export function determinant(mtx) {
  return mtx.a * mtx.d - mtx.c * mtx.b;
}

export function inverse(mtx) {
  const det = determinant(mtx);
  if (mth.almostZero(det)) return undefined;
  const { a, b, c, d, e, f } = mtx;
  return new Matrix(
    d / det, -b / det, -c / det, a / det,
    (c * f - d * e) / det,
    (b * e - a * f) / det
  );
}

export function roundMatrix(mtx) {
  return new Matrix(
    mth.precision(mtx.a, 4), mth.precision(mtx.b, 4),
    mth.precision(mtx.c, 4), mth.precision(mtx.d, 4),
    mth.precision(mtx.e, 4), mth.precision(mtx.f, 4)
  );
}

export function transformPointCenter(point, center, m) {
  if (point != null && m != null && center != null) {
    return gpt.transform(
      point,
      multiply(translateMatrix(center), m, translateMatrix(gpt.negate(center)))
    );
  }
  return point;
}

export function isMove(m) {
  return mth.almostZero(m.a - 1) && mth.almostZero(m.b) &&
         mth.almostZero(m.c) && mth.almostZero(m.d - 1);
}

export function matrixToString(o) {
  if (!isMatrix(o)) return o;
  return `${o.a},${o.b},${o.c},${o.d},${o.e},${o.f}`;
}

export function matrixToJSON(o) {
  if (!isMatrix(o)) return o;
  return { a: o.a, b: o.b, c: o.c, d: o.d, e: o.e, f: o.f };
}

const NUMBER_REGEX = /[+-]?\d*(\.\d+)?([eE][+-]?\d+)?/g;

export function strToMatrix(str) {
  const params = [...str.matchAll(NUMBER_REGEX)]
    .map(m => m[0])
    .filter(s => s.length > 0)
    .map(Number);
  return matrix(...params);
}

export function decodeMatrix(o) {
  if (o instanceof Matrix) return o;
  if (typeof o === 'object' && o !== null) return new Matrix(o.a, o.b, o.c, o.d, o.e, o.f);
  if (typeof o === 'string') return strToMatrix(o);
  return o;
}