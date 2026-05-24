import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as gsc from '../../../src/geom/shapes/corners.js';

describe('corners', () => {
  it('fixRadius single radius fits', () => {
    assert.equal(gsc.fixRadius(100, 100, 10), 10);
  });

  it('fixRadius single radius clamps', () => {
    assert.equal(gsc.fixRadius(10, 10, 100), 5);
  });

  it('fixRadius four radii fits', () => {
    assert.deepEqual(gsc.fixRadius(200, 200, 10, 10, 10, 10), [10, 10, 10, 10]);
  });

  it('fixRadius four radii clamps', () => {
    const result = gsc.fixRadius(20, 40, 10, 20, 10, 20);
    assert.ok(result[0] < 10);
    assert.ok(result[1] < 20);
  });

  it('shapeCorners1 returns 0 for zero r1', () => {
    assert.equal(gsc.shapeCorners1({ width: 100, height: 100, r1: 0 }), 0);
  });

  it('shapeCorners1 returns 0 for missing r1', () => {
    assert.equal(gsc.shapeCorners1({ width: 100, height: 100 }), 0);
  });

  it('shapeCorners1 returns radius for reasonable r1', () => {
    assert.equal(gsc.shapeCorners1({ width: 100, height: 100, r1: 10 }), 10);
  });

  it('shapeCorners4 returns radii when all set', () => {
    assert.deepEqual(
      gsc.shapeCorners4({ width: 200, height: 200, r1: 10, r2: 20, r3: 10, r4: 20 }),
      [10, 20, 10, 20]
    );
  });

  it('shapeCorners4 returns raw when some missing', () => {
    assert.deepEqual(
      gsc.shapeCorners4({ width: 200, height: 200, r1: 10, r2: null, r3: 10, r4: null }),
      [10, null, 10, null]
    );
  });

  it('updateCornersScale scales all corners', () => {
    const shape = { width: 100, height: 100, r1: 10, r2: 20, r3: 10, r4: 20 };
    const result = gsc.updateCornersScale(shape, 2);
    assert.equal(result.r1, 20);
    assert.equal(result.r2, 40);
    assert.equal(result.r3, 20);
    assert.equal(result.r4, 40);
  });
});