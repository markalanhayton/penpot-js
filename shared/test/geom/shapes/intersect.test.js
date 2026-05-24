import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as gsi from '../../../src/geom/shapes/intersect.js';
import * as gpt from '../../../src/geom/point.js';
import * as grc from '../../../src/geom/rect.js';

describe('intersect/segments', () => {
  it('orientation clockwise (screen coords)', () => {
    const o = gsi.orientation(gpt.point(0, 0), gpt.point(10, 0), gpt.point(5, -5));
    assert.equal(o, 'clockwise');
  });

  it('orientation counter-clockwise (screen coords)', () => {
    const o = gsi.orientation(gpt.point(0, 0), gpt.point(10, 0), gpt.point(5, 5));
    assert.equal(o, 'counter-clockwise');
  });

  it('orientation coplanar', () => {
    const o = gsi.orientation(gpt.point(0, 0), gpt.point(10, 0), gpt.point(5, 0));
    assert.equal(o, 'coplanar');
  });

  it('intersectSegmentsQ crossing segments', () => {
    const seg1 = [gpt.point(0, 0), gpt.point(10, 10)];
    const seg2 = [gpt.point(10, 0), gpt.point(0, 10)];
    assert.equal(gsi.intersectSegmentsQ(seg1, seg2), true);
  });

  it('intersectSegmentsQ parallel non-overlapping', () => {
    const seg1 = [gpt.point(0, 0), gpt.point(10, 0)];
    const seg2 = [gpt.point(0, 10), gpt.point(10, 10)];
    assert.equal(gsi.intersectSegmentsQ(seg1, seg2), false);
  });
});

describe('intersect/lines', () => {
  it('pointsToLines creates closed lines', () => {
    const points = [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10)];
    const lines = gsi.pointsToLines(points);
    assert.equal(lines.length, 3);
  });

  it('intersectsLinesQ detects intersection', () => {
    const linesA = [[gpt.point(0, 0), gpt.point(10, 10)]];
    const linesB = [[gpt.point(10, 0), gpt.point(0, 10)]];
    assert.equal(gsi.intersectsLinesQ(linesA, linesB), true);
  });
});

describe('intersect/point-in-polygon', () => {
  it('isPointInsideEvenoddQ inside square', () => {
    const rect = grc.makeRect(0, 0, 20, 20);
    const lines = grc.rectToLines(rect);
    assert.equal(gsi.isPointInsideEvenoddQ(gpt.point(10, 10), lines), true);
  });

  it('isPointInsideEvenoddQ outside square', () => {
    const rect = grc.makeRect(0, 0, 20, 20);
    const lines = grc.rectToLines(rect);
    assert.equal(gsi.isPointInsideEvenoddQ(gpt.point(50, 50), lines), false);
  });
});

describe('intersect/ellipse', () => {
  it('isPointInsideEllipseQ center of ellipse', () => {
    const result = gsi.isPointInsideEllipseQ(
      gpt.point(50, 50),
      { cx: 50, cy: 50, rx: 25, ry: 25, transform: undefined }
    );
    assert.equal(result, true);
  });

  it('isPointInsideEllipseQ outside ellipse', () => {
    const result = gsi.isPointInsideEllipseQ(
      gpt.point(100, 100),
      { cx: 50, cy: 50, rx: 25, ry: 25, transform: undefined }
    );
    assert.equal(result, false);
  });
});

describe('intersect/rect-overlap', () => {
  it('overlapsRectPointsQ overlapping rects', () => {
    const rect = grc.makeRect(0, 0, 10, 10);
    const points = [gpt.point(5, 5), gpt.point(15, 5), gpt.point(15, 15), gpt.point(5, 15)];
    assert.equal(gsi.overlapsRectPointsQ(rect, points), true);
  });

  it('overlapsRectPointsQ non-overlapping rects', () => {
    const rect = grc.makeRect(0, 0, 10, 10);
    const points = [gpt.point(20, 20), gpt.point(30, 20), gpt.point(30, 30), gpt.point(20, 30)];
    assert.equal(gsi.overlapsRectPointsQ(rect, points), false);
  });
});

describe('intersect/line-line', () => {
  it('lineLineIntersect finds intersection', () => {
    const p = gsi.lineLineIntersect(
      gpt.point(0, 0), gpt.point(10, 0),
      gpt.point(5, -5), gpt.point(5, 5)
    );
    assert.ok(p != null);
    assert.ok(Math.abs(p.x - 5) < 0.1);
    assert.ok(Math.abs(p.y) < 0.1);
  });
});

describe('intersect/has-point', () => {
  it('fastHasPointQ inside rect shape', () => {
    const shape = { x: 0, y: 0, width: 10, height: 10 };
    assert.equal(gsi.fastHasPointQ(shape, gpt.point(5, 5)), true);
  });

  it('fastHasPointQ outside rect shape', () => {
    const shape = { x: 0, y: 0, width: 10, height: 10 };
    assert.equal(gsi.fastHasPointQ(shape, gpt.point(15, 15)), false);
  });

  it('hasPointRectQ point inside rect', () => {
    const rect = grc.makeRect(0, 0, 10, 10);
    assert.equal(gsi.hasPointRectQ(rect, gpt.point(5, 5)), true);
  });

  it('rectContainsShapeQ all points inside', () => {
    const rect = grc.makeRect(0, 0, 20, 20);
    const shape = {
      points: [gpt.point(5, 5), gpt.point(10, 5), gpt.point(10, 10), gpt.point(5, 10)],
    };
    assert.equal(gsi.rectContainsShapeQ(rect, shape), true);
  });
});

describe('intersect/overlaps', () => {
  it('overlapsQ null shape returns true', () => {
    assert.equal(gsi.overlapsQ(null, grc.makeRect(0, 0, 10, 10)), true);
  });

  it('overlapsQ simple rect shape', () => {
    const shape = {
      type: 'rect',
      points: [gpt.point(5, 5), gpt.point(15, 5), gpt.point(15, 15), gpt.point(5, 15)],
    };
    const result = gsi.overlapsQ(shape, grc.makeRect(0, 0, 10, 10));
    assert.equal(result, true);
  });
});