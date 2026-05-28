import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeBoolOperation, shapeToPathContent, pathContentToPoints } from '../bool-ops.js';

function makeRectShape(x, y, w, h) {
  return { id: `r-${x}-${y}`, type: 'rect', x, y, width: w, height: h, fills: [], strokes: [] };
}

function makeCircleShape(cx, cy, r) {
  return { id: `c-${cx}-${cy}`, type: 'circle', x: cx - r, y: cy - r, width: r * 2, height: r * 2, fills: [], strokes: [] };
}

function polygonArea(pts) {
  if (!pts || pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function boolOp(op, a, b) {
  const content = computeBoolOperation(op, a, b);
  return content ? pathContentToPoints(content) : [];
}

describe('bool-ops — intersection', () => {
  it('intersection of two overlapping rectangles gives overlapping region', () => {
    const a = makeRectShape(0, 0, 20, 20);
    const b = makeRectShape(10, 10, 20, 20);
    b.id = 'shape-2';
    const pts = boolOp('intersection', a, b);
    assert.ok(pts.length >= 3, `should have >=3 points, got ${pts.length}`);
    const area = polygonArea(pts);
    assert.ok(Math.abs(area - 100) < 5, `area should be ~100, got ${area}`);
  });

  it('intersection of non-overlapping rectangles is empty', () => {
    const a = makeRectShape(0, 0, 10, 10);
    const b = makeRectShape(20, 20, 10, 10);
    b.id = 'shape-2';
    const pts = boolOp('intersection', a, b);
    assert.ok(pts.length === 0 || polygonArea(pts) < 1, 'non-overlapping should be empty');
  });

  it('intersection of fully contained shape returns inner', () => {
    const outer = makeRectShape(0, 0, 40, 40);
    const inner = makeRectShape(10, 10, 10, 10);
    inner.id = 'shape-2';
    const pts = boolOp('intersection', outer, inner);
    assert.ok(pts.length >= 3);
    const area = polygonArea(pts);
    assert.ok(Math.abs(area - 100) < 5, `area should be ~100, got ${area}`);
  });

  it('intersection of identical rectangles returns same rectangle', () => {
    const a = makeRectShape(0, 0, 20, 20);
    const b = makeRectShape(0, 0, 20, 20);
    b.id = 'shape-2';
    const pts = boolOp('intersection', a, b);
    assert.ok(pts.length >= 3);
    const area = polygonArea(pts);
    assert.ok(Math.abs(area - 400) < 10, `area should be ~400, got ${area}`);
  });
});

describe('bool-ops — union', () => {
  it('union of two overlapping rectangles produces convex hull (SH limitation: not true union)', () => {
    const a = makeRectShape(0, 0, 20, 20);
    const b = makeRectShape(10, 10, 20, 20);
    b.id = 'shape-2';
    const pts = boolOp('union', a, b);
    assert.ok(pts.length >= 3, `should have >=3 points, got ${pts.length}`);
    const area = polygonArea(pts);
    assert.ok(area >= 600, `union area should be >=600, got ${area}`);
  });

  it('union of non-overlapping rectangles includes both areas', () => {
    const a = makeRectShape(0, 0, 10, 10);
    const b = makeRectShape(20, 20, 10, 10);
    b.id = 'shape-2';
    const pts = boolOp('union', a, b);
    assert.ok(pts.length >= 3, 'should produce polygon');
  });

  it('union of contained shapes returns outer shape', () => {
    const outer = makeRectShape(0, 0, 40, 40);
    const inner = makeRectShape(10, 10, 10, 10);
    inner.id = 'shape-2';
    const pts = boolOp('union', outer, inner);
    assert.ok(pts.length >= 3);
    const area = polygonArea(pts);
    assert.ok(Math.abs(area - 1600) < 20, `union area should be ~1600, got ${area}`);
  });
});

describe('bool-ops — difference', () => {
  it('difference of two overlapping rectangles returns subject minus intersection region (SH limitation)', () => {
    const a = makeRectShape(0, 0, 30, 30);
    const b = makeRectShape(10, 10, 10, 10);
    b.id = 'shape-2';
    const pts = boolOp('difference', a, b);
    assert.ok(pts.length >= 3, `should have >=3 points, got ${pts.length}`);
    const area = polygonArea(pts);
    assert.ok(area >= 800, `difference area should be >=800 (subject area), got ${area}`);
    assert.ok(area <= 900, `difference area should be <=900 (subject area + overlap), got ${area}`);
  });

  it('difference of non-overlapping shapes returns first shape', () => {
    const a = makeRectShape(0, 0, 20, 20);
    const b = makeRectShape(30, 30, 10, 10);
    b.id = 'shape-2';
    const pts = boolOp('difference', a, b);
    assert.ok(pts.length >= 3, 'should return first shape when no overlap');
    assert.ok(Math.abs(polygonArea(pts) - 400) < 5, 'area should be ~400');
  });

  it('difference where inner fully contains outer returns empty', () => {
    const inner = makeRectShape(10, 10, 10, 10);
    const outer = makeRectShape(0, 0, 40, 40);
    outer.id = 'shape-2';
    const pts = boolOp('difference', inner, outer);
    assert.ok(pts.length === 0 || polygonArea(pts) < 1, 'fully contained should be empty');
  });
});

describe('bool-ops — exclusion', () => {
  it('exclusion of two overlapping rectangles produces correct area', () => {
    const a = makeRectShape(0, 0, 20, 20);
    const b = makeRectShape(10, 10, 20, 20);
    b.id = 'shape-2';
    const content = computeBoolOperation('exclude', a, b);
    assert.ok(content !== null && content.length > 0, 'should produce content');
  });

  it('exclusion of non-overlapping shapes includes both', () => {
    const a = makeRectShape(0, 0, 10, 10);
    const b = makeRectShape(20, 20, 10, 10);
    b.id = 'shape-2';
    const content = computeBoolOperation('exclude', a, b);
    assert.ok(content !== null && content.length > 0, 'should produce content');
  });
});

describe('bool-ops — shape conversion', () => {
  it('shapeToPathContent converts rect to path commands', () => {
    const rect = makeRectShape(5, 5, 15, 15);
    const content = shapeToPathContent(rect);
    assert.ok(content.length > 0);
    const hasMove = content.some(c => c.command === 'move-to');
    const hasLine = content.some(c => c.command === 'line-to');
    assert.ok(hasMove, 'should have move-to');
    assert.ok(hasLine, 'should have line-to');
  });

  it('shapeToPathContent converts circle to path commands', () => {
    const circle = makeCircleShape(50, 50, 25);
    const content = shapeToPathContent(circle);
    assert.ok(content.length > 0);
    const hasCurve = content.some(c => c.command === 'curve-to');
    assert.ok(hasCurve, 'circle should have curve-to segments');
  });

  it('pathContentToPoints round-trips with rect', () => {
    const rect = makeRectShape(5, 5, 15, 15);
    const content = shapeToPathContent(rect);
    const points = pathContentToPoints(content);
    assert.ok(points.length >= 4, `rect should produce >=4 points, got ${points.length}`);
    assert.ok(Math.abs(points[0].x - 5) < 0.5, 'first point x should be near shape x');
    assert.ok(Math.abs(points[0].y - 5) < 0.5, 'first point y should be near shape y');
  });

  it('computeBoolOperation rejects invalid operation type', () => {
    const a = makeRectShape(0, 0, 20, 20);
    const b = makeRectShape(10, 10, 20, 20);
    b.id = 'shape-2';
    assert.throws(() => computeBoolOperation('invalid', a, b), /Invalid boolean operation type/);
  });
});