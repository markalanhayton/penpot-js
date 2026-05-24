import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as gpo from '../../../src/geom/shapes/points.js';
import * as gpt from '../../../src/geom/point.js';

describe('points', () => {
  const pts = [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)];

  it('origin returns first point', () => {
    const o = gpo.origin(pts);
    assert.equal(o.x, 0);
    assert.equal(o.y, 0);
  });

  it('hv returns horizontal vector', () => {
    const v = gpo.hv(pts);
    assert.equal(v.x, 10);
    assert.equal(v.y, 0);
  });

  it('vv returns vertical vector', () => {
    const v = gpo.vv(pts);
    assert.equal(v.x, 0);
    assert.equal(v.y, 10);
  });

  it('widthPoints returns width', () => {
    assert.equal(gpo.widthPoints(pts), 10);
  });

  it('heightPoints returns height', () => {
    assert.equal(gpo.heightPoints(pts), 10);
  });

  it('axisAlignedQ true for axis-aligned points', () => {
    assert.equal(gpo.axisAlignedQ(pts), true);
  });

  it('axisAlignedQ false for rotated points', () => {
    const rotPts = [gpt.point(0, 0), gpt.point(5, 5), gpt.point(0, 10), gpt.point(-5, 5)];
    assert.equal(gpo.axisAlignedQ(rotPts), false);
  });

  it('startHv returns vector with magnitude', () => {
    const v = gpo.startHv(pts, 5);
    assert.equal(v.x, 5);
    assert.equal(v.y, 0);
  });

  it('movePoints translates all points', () => {
    const moved = gpo.movePoints(pts, gpt.point(10, 20));
    assert.equal(moved[0].x, 10);
    assert.equal(moved[0].y, 20);
    assert.equal(moved[1].x, 20);
    assert.equal(moved[1].y, 20);
  });

  it('centerBounds returns center of bounds', () => {
    const c = gpo.centerBounds(pts);
    assert.equal(c.x, 5);
    assert.equal(c.y, 5);
  });

  it('parentCoordsBounds axis-aligned returns child', () => {
    const parent = [gpt.point(0, 0), gpt.point(100, 0), gpt.point(100, 100), gpt.point(0, 100)];
    const child = [gpt.point(10, 10), gpt.point(20, 10), gpt.point(20, 20), gpt.point(10, 20)];
    const result = gpo.parentCoordsBounds(child, parent);
    assert.equal(result[0].x, 10);
    assert.equal(result[0].y, 10);
  });

  it('parentCoordsBounds empty child returns parent', () => {
    const parent = [gpt.point(0, 0), gpt.point(100, 0), gpt.point(100, 100), gpt.point(0, 100)];
    const result = gpo.parentCoordsBounds([], parent);
    assert.deepEqual(result, parent);
  });
});