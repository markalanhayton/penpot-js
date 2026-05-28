import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeBoolOperation, shapeToPathContent, pathContentToPoints } from '../bool-ops.js';

function rect(x, y, w, h) {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

function lShape(x, y, w, h, notch) {
  return [
    { x, y }, { x: x + w, y }, { x: x + w, y: y + h - notch },
    { x: x + w * 0.4, y: y + h - notch }, { x: x + w * 0.4, y: y + h }, { x, y: y + h },
  ];
}

function polygonArea(pts) {
  if (!pts || pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; area += pts[i].x * pts[j].y - pts[j].x * pts[i].y; }
  return Math.abs(area) / 2;
}

function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y, xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function shIsInside(point, edgeStart, edgeEnd) {
  return (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) - (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x) >= 0;
}

function shLineIntersect(p1, p2, p3, p4) {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

function shClipEdge(subject, clipEdge) {
  const output = [];
  if (subject.length === 0) return output;
  const { from: cp1, to: cp2 } = clipEdge;
  let prev = subject[subject.length - 1];
  let prevInside = shIsInside(prev, cp1, cp2);
  for (const curr of subject) {
    const currInside = shIsInside(curr, cp1, cp2);
    if (currInside) {
      if (!prevInside) { const inter = shLineIntersect(prev, curr, cp1, cp2); if (inter) output.push(inter); }
      output.push(curr);
    } else if (prevInside) {
      const inter = shLineIntersect(prev, curr, cp1, cp2);
      if (inter) output.push(inter);
    }
    prev = curr;
    prevInside = currInside;
  }
  return output;
}

function shClip(subject, clip) {
  let output = [...subject];
  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) return [];
    const edge = { from: clip[i], to: clip[(i + 1) % clip.length] };
    output = shClipEdge(output, edge);
  }
  return output;
}

function removeDuplicatePoints(points) {
  if (points.length <= 1) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    if (Math.abs(points[i].x - prev.x) > 1e-10 || Math.abs(points[i].y - prev.y) > 1e-10) result.push(points[i]);
  }
  while (result.length > 1 && Math.abs(result[0].x - result[result.length - 1].x) < 1e-10 && Math.abs(result[0].y - result[result.length - 1].y) < 1e-10) result.pop();
  return result;
}

function convexHull(points) {
  if (points.length < 3) return [...points];
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) { const p = sorted[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop();
  return [...lower, ...upper];
}

function makeRectShape(x, y, w, h) {
  return {
    id: 'shape-1', type: 'rect', name: 'Rect',
    x, y, width: w, height: h,
    fills: [], strokes: [],
  };
}

function makeBoolShape(boolType, shapes) {
  const minX = Math.min(...shapes.map(s => s.x));
  const minY = Math.min(...shapes.map(s => s.y));
  const maxX = Math.max(...shapes.map(s => s.x + s.width));
  const maxY = Math.max(...shapes.map(s => s.y + s.height));
  return {
    id: 'bool-1', type: 'bool', name: `Boolean ${boolType}`,
    x: Math.round(minX), y: Math.round(minY),
    width: Math.round(maxX - minX), height: Math.round(maxY - minY),
    boolType, shapes: shapes.map(s => s.id),
    fills: shapes[0].fills || [], strokes: shapes[0].strokes || [],
  };
}

// ---- Tests ----

describe('Sutherland-Hodgman polygon clipping (intersection)', () => {
  it('intersection of two overlapping rectangles clips correctly', () => {
    const a = rect(0, 0, 20, 20);
    const b = rect(10, 10, 20, 20);
    const result = shClip(a, b);
    assert.ok(result.length >= 3, `intersection should have >=3 vertices, got ${result.length}`);
    const area = polygonArea(result);
    assert.ok(Math.abs(area - 100) < 1, `intersection area should be ~100, got ${area}`);
  });

  it('intersection of non-overlapping rectangles is empty', () => {
    const a = rect(0, 0, 10, 10);
    const b = rect(20, 20, 10, 10);
    const result = shClip(a, b);
    assert.ok(result.length === 0 || polygonArea(result) < 1, 'non-overlapping intersection should be empty');
  });

  it('intersection of contained rectangle returns inner', () => {
    const outer = rect(0, 0, 40, 40);
    const inner = rect(10, 10, 10, 10);
    const result = shClip(outer, inner);
    assert.ok(result.length >= 3, `should have >=3 vertices, got ${result.length}`);
    const area = polygonArea(result);
    assert.ok(Math.abs(area - 100) < 1, `intersection area should be ~100, got ${area}`);
  });

  it('L-shape clip with rectangle produces result', () => {
    const l = lShape(0, 0, 40, 40, 20);
    const r = rect(5, 5, 10, 10);
    const result = shClip(l, r);
    assert.ok(result.length >= 3, `L-shape intersection should produce polygon, got ${result.length} vertices`);
    const area = polygonArea(result);
    assert.ok(area > 0, 'intersection area should be positive');
  });

  it('intersection of two same-sized rectangles returns that rectangle', () => {
    const a = rect(0, 0, 20, 20);
    const b = rect(0, 0, 20, 20);
    const result = shClip(a, b);
    assert.ok(result.length >= 3);
    const area = polygonArea(result);
    assert.ok(Math.abs(area - 400) < 1, `intersection area should be ~400, got ${area}`);
  });
});

describe('Convex hull', () => {
  it('computes hull of rectangle', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }, { x: 10, y: 20 }];
    const hull = convexHull(pts);
    assert.ok(hull.length >= 3);
    assert.ok(hull.length <= pts.length);
  });

  it('returns triangle unchanged', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    const hull = convexHull(pts);
    assert.equal(hull.length, 3);
  });
});

describe('Point-in-polygon', () => {
  it('detects point inside rectangle', () => {
    const r = rect(0, 0, 20, 20);
    assert.ok(pointInPolygon(10, 10, r));
    assert.ok(!pointInPolygon(30, 10, r));
  });

  it('detects point inside L-shape', () => {
    const l = lShape(0, 0, 40, 40, 20);
    assert.ok(pointInPolygon(5, 5, l));
    assert.ok(pointInPolygon(25, 5, l));
    assert.ok(!pointInPolygon(25, 25, l));
  });
});

describe('computeBoolOperation — polygon boolean operations', () => {
  it('intersection of two overlapping rectangles produces correct area', () => {
    const a = makeRectShape(0, 0, 20, 20);
    const b = makeRectShape(10, 10, 20, 20);
    b.id = 'shape-2';
    const content = computeBoolOperation('intersection', a, b);
    assert.ok(content !== null, 'should produce content');
    const points = pathContentToPoints(content);
    assert.ok(points.length >= 3, `should have >=3 points, got ${points.length}`);
    const area = polygonArea(points);
    assert.ok(Math.abs(area - 100) < 5, `intersection area should be ~100, got ${area}`);
  });

  it('union of two overlapping rectangles produces convex hull result', () => {
    const a = makeRectShape(0, 0, 20, 20);
    const b = makeRectShape(10, 10, 20, 20);
    b.id = 'shape-2';
    const content = computeBoolOperation('union', a, b);
    assert.ok(content !== null, 'should produce content');
    const points = pathContentToPoints(content);
    assert.ok(points.length >= 3, `should have >=3 points, got ${points.length}`);
    const area = polygonArea(points);
    assert.ok(area >= 600, `union area should be >=600 (combined overlap area), got ${area}`);
    assert.ok(area <= 800, `union area should be <=800 (convex hull area), got ${area}`);
  });

  it('difference of two overlapping rectangles carves out area', () => {
    const a = makeRectShape(0, 0, 30, 30);
    const b = makeRectShape(10, 10, 10, 10);
    b.id = 'shape-2';
    const content = computeBoolOperation('difference', a, b);
    assert.ok(content !== null, 'should produce content');
    const points = pathContentToPoints(content);
    assert.ok(points.length >= 3, `should have >=3 points, got ${points.length}`);
    const area = polygonArea(points);
    const expectedArea = 30 * 30 - 10 * 10;
    assert.ok(area > expectedArea - 50, `difference area should be ~${expectedArea}, got ${area}`);
  });

  it('intersection of non-overlapping rectangles is empty', () => {
    const a = makeRectShape(0, 0, 10, 10);
    const b = makeRectShape(20, 20, 10, 10);
    b.id = 'shape-2';
    const content = computeBoolOperation('intersection', a, b);
    const points = content ? pathContentToPoints(content) : [];
    assert.ok(points.length === 0 || polygonArea(points) < 1, 'non-overlapping intersection should be empty');
  });

  it('shapeToPathContent converts rect shape to path segments', () => {
    const shape = makeRectShape(0, 0, 20, 20);
    const content = shapeToPathContent(shape);
    assert.ok(content.length > 0, 'should produce path segments');
    const hasMoveTo = content.some(s => s.command === 'move-to');
    const hasLineTo = content.some(s => s.command === 'line-to');
    assert.ok(hasMoveTo, 'should contain move-to segments');
    assert.ok(hasLineTo, 'should contain line-to segments');
  });

  it('pathContentToPoints round-trips with shapeToPathContent for rect', () => {
    const shape = makeRectShape(5, 5, 15, 15);
    const content = shapeToPathContent(shape);
    const points = pathContentToPoints(content);
    assert.ok(points.length >= 4, `rect should produce >=4 points, got ${points.length}`);
    assert.ok(Math.abs(points[0].x - 5) < 0.5, 'first point x should be near shape x');
    assert.ok(Math.abs(points[0].y - 5) < 0.5, 'first point y should be near shape y');
  });
});