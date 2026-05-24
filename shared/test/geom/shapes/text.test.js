import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as gte from '../../../src/geom/shapes/text.js';
import * as grc from '../../../src/geom/rect.js';
import * as gpt from '../../../src/geom/point.js';

describe('shapes/text', () => {
  it('positionDataToRect converts position data to rect', () => {
    const r = gte.positionDataToRect({ x: 10, y: 30, width: 20, height: 10 });
    assert.equal(r.x, 10);
    assert.equal(r.y, 20);
    assert.equal(r.width, 20);
    assert.equal(r.height, 10);
  });

  it('shapeToRect uses selrect when no position-data', () => {
    const shape = { selrect: grc.makeRect(0, 0, 10, 10) };
    const r = gte.shapeToRect(shape);
    assert.equal(r.x, 0);
    assert.equal(r.width, 10);
  });

  it('overlapsPositionDataQ returns false when no position-data', () => {
    const shape = { points: [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)] };
    const result = gte.overlapsPositionDataQ(shape, []);
    assert.equal(result, false);
  });
});