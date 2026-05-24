import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as gco from '../../../src/geom/shapes/common.js';
import * as gpt from '../../../src/geom/point.js';
import * as grc from '../../../src/geom/rect.js';
import * as gmt from '../../../src/geom/matrix.js';

describe('shapes/common', () => {
  it('shapesToRect wraps multiple shapes', () => {
    const shapes = [
      { points: [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)] },
      { points: [gpt.point(20, 20), gpt.point(30, 20), gpt.point(30, 30), gpt.point(20, 30)] },
    ];
    const r = gco.shapesToRect(shapes);
    assert.ok(r != null);
    assert.equal(r.x, 0);
    assert.equal(r.y, 0);
  });

  it('pointsToCenter finds center of 4 points', () => {
    const points = [
      gpt.point(0, 0),
      gpt.point(10, 0),
      gpt.point(10, 10),
      gpt.point(0, 10),
    ];
    const c = gco.pointsToCenter(points);
    assert.equal(c.x, 5);
    assert.equal(c.y, 5);
  });

  it('shapeToCenter returns center of selrect', () => {
    const shape = { selrect: grc.makeRect(0, 0, 10, 10) };
    const c = gco.shapeToCenter(shape);
    assert.equal(c.x, 5);
    assert.equal(c.y, 5);
  });

  it('transformPoints identity returns same points', () => {
    const points = [gpt.point(1, 2), gpt.point(3, 4)];
    const result = gco.transformPoints(points, gmt.matrix());
    assert.equal(result[0].x, 1);
    assert.equal(result[0].y, 2);
    assert.equal(result[1].x, 3);
    assert.equal(result[1].y, 4);
  });

  it('transformPoints with null matrix returns points', () => {
    const points = [gpt.point(1, 2)];
    const result = gco.transformPoints(points, null);
    assert.deepEqual(result, points);
  });

  it('transformPoints with center translates around center', () => {
    const points = [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)];
    const center = gpt.point(5, 5);
    const mtx = gmt.translateMatrix(gpt.point(10, 20));
    const result = gco.transformPoints(points, center, mtx);
    assert.ok(result[0].x > 0);
  });

  it('transformSelrect transforms a rect', () => {
    const rect = grc.makeRect(0, 0, 10, 10);
    const mtx = gmt.translateMatrix(gpt.point(5, 5));
    const result = gco.transformSelrect(rect, mtx);
    assert.ok(result != null);
    assert.ok(result.x > 0);
  });

  it('invalidGeometryQ detects NaN in selrect', () => {
    const shape = { selrect: { x: NaN, y: 0, width: 10, height: 10 }, points: [] };
    assert.equal(gco.invalidGeometryQ(shape), true);
  });

  it('invalidGeometryQ returns false for valid shape', () => {
    const shape = {
      selrect: grc.makeRect(0, 0, 10, 10),
      points: [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)],
    };
    assert.equal(gco.invalidGeometryQ(shape), false);
  });

  it('shapeToPoints returns corrected points for unit transform', () => {
    const points = [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)];
    const shape = { transform: gmt.base, points };
    const result = gco.shapeToPoints(shape);
    assert.equal(result[0].x, 0);
    assert.equal(result[0].y, 0);
    assert.equal(result[1].x, 10);
    assert.equal(result[1].y, 0);
    assert.equal(result[3].x, 0);
    assert.equal(result[3].y, 10);
  });
});