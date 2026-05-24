import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Matrix, isMatrix, matrix, base, isBase, formatPrecision,
  close, isUnit, multiply, addTranslate, substract,
  translateMatrix, translateMatrixNeg, scaleMatrix, rotateMatrix,
  skewMatrix, rotate, scale, translate, skew, mEqual,
  transformIn, determinant, inverse, roundMatrix,
  transformPointCenter, isMove, matrixToString, matrixToJSON,
  strToMatrix, decodeMatrix
} from '@penpot/shared/geom/matrix';
import { point } from '@penpot/shared/geom/point';

describe('Matrix', () => {
  it('creates identity matrix', () => {
    const m = matrix();
    assert.ok(isMatrix(m));
    assert.equal(m.a, 1);
    assert.equal(m.b, 0);
    assert.equal(m.c, 0);
    assert.equal(m.d, 1);
    assert.equal(m.e, 0);
    assert.equal(m.f, 0);
  });

  it('creates matrix from values', () => {
    const m = matrix(2, 3, 4, 5, 6, 7);
    assert.equal(m.a, 2);
    assert.equal(m.b, 3);
    assert.equal(m.f, 7);
  });

  it('base is identity', () => {
    assert.ok(isBase(base));
    assert.equal(base.a, 1);
    assert.equal(base.d, 1);
  });

  it('isUnit', () => {
    assert.ok(isUnit(matrix()));
    assert.ok(!isUnit(matrix(2, 0, 0, 1, 0, 0)));
  });

  it('close', () => {
    const m1 = matrix(1.0001, 0, 0, 1.0001, 0, 0);
    const m2 = matrix(1.0002, 0, 0, 1.0002, 0, 0);
    assert.ok(close(m1, m2));
  });

  it('multiply identity', () => {
    const m = matrix(2, 3, 4, 5, 6, 7);
    const r = multiply(base, m);
    assert.equal(r.a, 2);
    assert.equal(r.f, 7);
  });

  it('multiply null treated as identity', () => {
    const m = matrix(2, 0, 0, 2, 0, 0);
    const r1 = multiply(null, null);
    assert.ok(isMatrix(r1));
    assert.equal(r1.a, 1);
    assert.deepEqual(multiply(null, m), m);
    assert.deepEqual(multiply(m, null), m);
  });

  it('multiply two matrices', () => {
    const m1 = matrix(1, 0, 0, 1, 10, 20);
    const m2 = matrix(2, 0, 0, 2, 0, 0);
    const r = multiply(m1, m2);
    assert.equal(r.a, 2);
    assert.equal(r.d, 2);
    assert.equal(r.e, 10);
    assert.equal(r.f, 20);
  });

  it('multiply multiple matrices', () => {
    const m1 = matrix(2, 0, 0, 2, 0, 0);
    const m2 = matrix(1, 0, 0, 1, 10, 0);
    const m3 = matrix(1, 0, 0, 1, 0, 20);
    const r = multiply(m1, m2, m3);
    assert.equal(r.e, 20);
    assert.equal(r.f, 40);
  });

  it('addTranslate', () => {
    const m1 = matrix(1, 0, 0, 1, 10, 20);
    const m2 = matrix(1, 0, 0, 1, 5, 15);
    const r = addTranslate(m1, m2);
    assert.equal(r.a, 1);
    assert.equal(r.e, 15);
    assert.equal(r.f, 35);
  });

  it('substract', () => {
    const m1 = matrix(2, 3, 4, 5, 6, 7);
    const m2 = matrix(1, 1, 1, 1, 1, 1);
    const r = substract(m1, m2);
    assert.equal(r.a, 1);
    assert.equal(r.b, 2);
    assert.equal(r.f, 6);
  });

  it('translateMatrix from point', () => {
    const m = translateMatrix(point(10, 20));
    assert.equal(m.a, 1);
    assert.equal(m.e, 10);
    assert.equal(m.f, 20);
  });

  it('translateMatrix from numbers', () => {
    const m = translateMatrix(10, 20);
    assert.equal(m.e, 10);
    assert.equal(m.f, 20);
  });

  it('translateMatrixNeg', () => {
    const m = translateMatrixNeg(point(10, 20));
    assert.equal(m.e, -10);
    assert.equal(m.f, -20);
  });

  it('scaleMatrix without center', () => {
    const m = scaleMatrix(point(2, 3));
    assert.equal(m.a, 2);
    assert.equal(m.d, 3);
    assert.equal(m.e, 0);
    assert.equal(m.f, 0);
  });

  it('scaleMatrix with center', () => {
    const m = scaleMatrix(point(2, 2), point(10, 10));
    assert.equal(m.a, 2);
    assert.equal(m.d, 2);
    assert.equal(m.e, -10);
    assert.equal(m.f, -10);
  });

  it('rotateMatrix without center', () => {
    const m = rotateMatrix(0);
    assert.ok(Math.abs(m.a - 1) < 1e-6);
    assert.ok(Math.abs(m.b) < 1e-6);
  });

  it('rotateMatrix 90 degrees', () => {
    const m = rotateMatrix(90);
    assert.ok(Math.abs(m.a) < 1e-6);
    assert.ok(Math.abs(m.b - 1) < 1e-6);
    assert.ok(Math.abs(m.c - (-1)) < 1e-6);
    assert.ok(Math.abs(m.d) < 1e-6);
  });

  it('determinant', () => {
    const m = matrix(2, 3, 4, 5, 0, 0);
    assert.equal(determinant(m), -2);
  });

  it('determinant identity is 1', () => {
    assert.equal(determinant(base), 1);
  });

  it('inverse', () => {
    const m = matrix(2, 0, 0, 2, 10, 20);
    const inv = inverse(m);
    assert.ok(inv);
    assert.equal(inv.a, 0.5);
    assert.equal(inv.d, 0.5);
    assert.equal(inv.e, -5);
    assert.equal(inv.f, -10);
  });

  it('inverse singular returns undefined', () => {
    const m = matrix(0, 0, 0, 0, 0, 0);
    assert.equal(inverse(m), undefined);
  });

  it('inverse round-trip', () => {
    const m = matrix(3, 1, 2, 4, 5, 6);
    const inv = inverse(m);
    const r = multiply(m, inv);
    assert.ok(close(r, base));
  });

  it('isMove', () => {
    assert.ok(isMove(translateMatrix(10, 20)));
    assert.ok(!isMove(rotateMatrix(45)));
  });

  it('roundMatrix', () => {
    const m = new Matrix(1.123456789, 0, 0, 1, 0.987654321, 0);
    const r = roundMatrix(m);
    assert.ok(Math.abs(r.a - 1.1235) < 1e-4);
  });

  it('mEqual', () => {
    const m1 = matrix(1, 0, 0, 1, 0, 0);
    const m2 = matrix(1, 0, 0, 1, 0, 0);
    const m3 = matrix(2, 0, 0, 1, 0, 0);
    assert.ok(mEqual(m1, m2, 0.01));
    assert.ok(!mEqual(m1, m3, 0.01));
  });

  it('transformIn', () => {
    const pt = point(10, 10);
    const m = scaleMatrix(point(2, 2));
    const r = transformIn(pt, m);
    assert.ok(r);
  });

  it('transformIn nulls', () => {
    const m = matrix(2, 0, 0, 2, 0, 0);
    assert.equal(transformIn(null, m), m);
    assert.equal(transformIn(point(0, 0), null), null);
  });

  it('skewMatrix', () => {
    const m = skewMatrix(0, 0);
    assert.equal(m.a, 1);
    assert.equal(m.d, 1);
  });

  it('translate shortcut', () => {
    const m = translate(base, point(10, 20));
    assert.equal(m.e, 10);
    assert.equal(m.f, 20);
  });

  it('scale shortcut', () => {
    const m = scale(base, point(2, 3));
    assert.equal(m.a, 2);
    assert.equal(m.d, 3);
  });

  it('rotate shortcut', () => {
    const m = rotate(base, 90);
    assert.ok(Math.abs(m.b - 1) < 1e-6);
  });

  it('skew shortcut', () => {
    const m = skew(base, 45, 0);
    assert.ok(Math.abs(m.c - 1) < 0.01);
  });

  it('transformPointCenter', () => {
    const pt = point(10, 10);
    const ctr = point(5, 5);
    const m = rotateMatrix(90);
    const r = transformPointCenter(pt, ctr, m);
    assert.ok(r);
  });

  it('matrixToString', () => {
    const m = matrix(1, 2, 3, 4, 5, 6);
    assert.equal(matrixToString(m), '1,2,3,4,5,6');
  });

  it('matrixToJSON', () => {
    const m = matrix(1, 0, 0, 1, 10, 20);
    const j = matrixToJSON(m);
    assert.deepEqual(j, { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 });
  });

  it('matrixToJSON non-matrix passthrough', () => {
    assert.equal(matrixToJSON('foo'), 'foo');
  });

  it('strToMatrix', () => {
    const m = strToMatrix('1,0,0,1,10,20');
    assert.ok(isMatrix(m));
    assert.equal(m.e, 10);
    assert.equal(m.f, 20);
  });

  it('decodeMatrix from object', () => {
    const m = decodeMatrix({ a: 1, b: 0, c: 0, d: 1, e: 5, f: 10 });
    assert.ok(isMatrix(m));
    assert.equal(m.e, 5);
  });

  it('decodeMatrix from string', () => {
    const m = decodeMatrix('1,0,0,1,5,10');
    assert.ok(isMatrix(m));
    assert.equal(m.e, 5);
  });

  it('decodeMatrix passthrough for Matrix', () => {
    const m = matrix();
    assert.equal(decodeMatrix(m), m);
  });

  it('formatPrecision', () => {
    const m = matrix(1.123456, 0, 0, 1, 0, 0);
    const s = formatPrecision(m, 2);
    assert.ok(s.includes('1.12'));
  });

  it('toString', () => {
    const m = matrix(1, 0, 0, 1, 0, 0);
    assert.ok(m.toString().startsWith('matrix('));
  });
});