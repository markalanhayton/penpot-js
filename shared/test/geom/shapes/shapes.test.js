import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as gsh from '../../../src/geom/shapes/shapes.js';
import * as gpt from '../../../src/geom/point.js';
import * as grc from '../../../src/geom/rect.js';

describe('shapes/facade', () => {
  it('translateToFrame moves shape by negative frame position', () => {
    const shape = {
      type: 'rect',
      x: 20, y: 20,
      selrect: grc.makeRect(20, 20, 10, 10),
      points: [gpt.point(20, 20), gpt.point(30, 20), gpt.point(30, 30), gpt.point(20, 30)],
    };
    const result = gsh.translateToFrame(shape, { x: 10, y: 10 });
    assert.equal(result.x, 10);
    assert.equal(result.y, 10);
  });

  it('translateFromFrame moves shape by frame position', () => {
    const shape = {
      type: 'rect',
      x: 0, y: 0,
      selrect: grc.makeRect(0, 0, 10, 10),
      points: [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)],
    };
    const result = gsh.translateFromFrame(shape, { x: 10, y: 10 });
    assert.equal(result.x, 10);
    assert.equal(result.y, 10);
  });

  it('shapeToRect from valid shape', () => {
    const r = gsh.shapeToRect({ x: 5, y: 10, width: 20, height: 30 });
    assert.ok(r != null);
    assert.equal(r.x, 5);
    assert.equal(r.y, 10);
    assert.equal(r.width, 20);
    assert.equal(r.height, 30);
  });

  it('shapeToRect with non-numeric returns undefined', () => {
    const r = gsh.shapeToRect({ x: 'a', y: 0, width: 10, height: 10 });
    assert.equal(r, undefined);
  });

  it('boundingBox returns rect wrapping shape points', () => {
    const shape = {
      points: [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)],
    };
    const r = gsh.boundingBox(shape);
    assert.ok(r != null);
    assert.equal(r.x, 0);
    assert.equal(r.y, 0);
  });

  it('leftBound returns x', () => {
    assert.equal(gsh.leftBound({ x: 5, y: 10 }), 5);
  });

  it('topBound returns y', () => {
    assert.equal(gsh.topBound({ x: 5, y: 10 }), 10);
  });

  it('fullyContainedQ inner in outer', () => {
    const outer = grc.makeRect(0, 0, 20, 20);
    const inner = grc.makeRect(5, 5, 5, 5);
    assert.equal(gsh.fullyContainedQ(outer, inner), true);
  });

  it('fullyContainedQ overlapping not contained', () => {
    const outer = grc.makeRect(0, 0, 10, 10);
    const partial = grc.makeRect(5, 5, 20, 20);
    assert.equal(gsh.fullyContainedQ(outer, partial), false);
  });

  it('padSelrec expands rect', () => {
    const rect = grc.makeRect(10, 10, 20, 20);
    const padded = gsh.padSelrec(rect, 1);
    assert.equal(padded.x, 9);
    assert.equal(padded.y, 9);
    assert.equal(padded.width, 22);
    assert.equal(padded.height, 22);
  });

  it('distanceSelrect computes distance point', () => {
    const sr1 = grc.makeRect(0, 0, 10, 10);
    const sr2 = grc.makeRect(15, 15, 10, 10);
    const d = gsh.distanceSelrect(sr1, sr2);
    assert.equal(d.x, 5);
    assert.equal(d.y, 5);
  });

  it('closeAttrsQ numbers close', () => {
    assert.equal(gsh.closeAttrsQ('x', 1.0, 1.001), true);
  });

  it('closeAttrsQ numbers far', () => {
    assert.equal(gsh.closeAttrsQ('x', 1.0, 5.0), false);
  });

  it('closeAttrsQ selrect close', () => {
    const sr1 = { x: 1, y: 2, x1: 1, y1: 2, x2: 11, y2: 12, width: 10, height: 10 };
    const sr2 = { x: 1.0005, y: 2.0005, x1: 1.0005, y1: 2.0005, x2: 11.0005, y2: 12.0005, width: 10.0005, height: 10.0005 };
    assert.equal(gsh.closeAttrsQ('selrect', sr1, sr2), true);
  });

  it('closeAttrsQ same values', () => {
    assert.equal(gsh.closeAttrsQ('name', 'hello', 'hello'), true);
  });

  it('closeAttrsQ different values', () => {
    assert.equal(gsh.closeAttrsQ('name', 'hello', 'world'), false);
  });

  it('re-exports: move is a function', () => {
    assert.equal(typeof gsh.move, 'function');
  });

  it('re-exports: applyTransform is a function', () => {
    assert.equal(typeof gsh.applyTransform, 'function');
  });

  it('re-exports: shapeCorners1 is a function', () => {
    assert.equal(typeof gsh.shapeCorners1, 'function');
  });

  it('re-exports: rectToPoints is a function', () => {
    assert.equal(typeof gsh.rectToPoints, 'function');
  });
});