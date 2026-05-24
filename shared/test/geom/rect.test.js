import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Rect, isRect, makeRect, EMPTY_RECT, updateRect, closeRect,
  rectToPoints, rectToPoint, rectToCenter, rectToLines,
  pointsToRect, boundsToRect, joinRects, centerToRect,
  overlapsRects, containsPoint, containsRect, cornersToRect,
  clipRect, rectToJSON, decodeRect
} from '@penpot/shared/geom/rect';
import { point } from '@penpot/shared/geom/point';

describe('Rect', () => {
  it('makeRect default', () => {
    const r = makeRect();
    assert.ok(isRect(r));
    assert.equal(r.width, 0.01);
    assert.equal(r.height, 0.01);
  });

  it('makeRect from x, y, w, h', () => {
    const r = makeRect(10, 20, 30, 40);
    assert.equal(r.x, 10);
    assert.equal(r.y, 20);
    assert.equal(r.width, 30);
    assert.equal(r.height, 40);
    assert.equal(r.x1, 10);
    assert.equal(r.y1, 20);
    assert.equal(r.x2, 40);
    assert.equal(r.y2, 60);
  });

  it('makeRect ensures minimum size 0.01', () => {
    const r = makeRect(0, 0, -5, -3);
    assert.equal(r.width, 0.01);
    assert.equal(r.height, 0.01);
  });

  it('makeRect from two points', () => {
    const r = makeRect(point(10, 30), point(30, 10));
    assert.equal(r.x, 10);
    assert.equal(r.y, 10);
    assert.equal(r.width, 20);
    assert.equal(r.height, 20);
  });

  it('makeRect from object', () => {
    const r = makeRect({ x: 1, y: 2, width: 3, height: 4 });
    assert.equal(r.x, 1);
    assert.equal(r.y, 2);
    assert.equal(r.width, 3);
    assert.equal(r.height, 4);
  });

  it('makeRect from existing Rect (identity)', () => {
    const r1 = makeRect(1, 2, 3, 4);
    const r2 = makeRect(r1);
    assert.equal(r2.x, 1);
    assert.equal(r2.width, 3);
  });

  it('updateRect size/position syncs corners', () => {
    const r = makeRect(10, 20, 30, 40);
    const u = updateRect({ ...r, x: 15 }, 'size');
    assert.equal(u.x1, 15);
    assert.equal(u.x2, 45);
  });

  it('updateRect corners syncs size/position', () => {
    const r = new Rect(10, 20, 0, 0, 5, 15, 25, 35);
    const u = updateRect(r, 'corners');
    assert.equal(u.x, 5);
    assert.equal(u.width, 20);
    assert.equal(u.height, 20);
  });

  it('closeRect', () => {
    const r1 = makeRect(1.0001, 2, 3, 4);
    const r2 = makeRect(1.0002, 2, 3, 4);
    assert.ok(closeRect(r1, r2));
  });

  it('rectToPoints', () => {
    const pts = rectToPoints(makeRect(10, 20, 30, 40));
    assert.equal(pts.length, 4);
    assert.equal(pts[0].x, 10);
    assert.equal(pts[0].y, 20);
    assert.equal(pts[2].x, 40);
    assert.equal(pts[2].y, 60);
  });

  it('rectToPoint', () => {
    const p = rectToPoint(makeRect(5, 10, 20, 30));
    assert.equal(p.x, 5);
    assert.equal(p.y, 10);
  });

  it('rectToCenter', () => {
    const c = rectToCenter(makeRect(0, 0, 10, 20));
    assert.equal(c.x, 5);
    assert.equal(c.y, 10);
  });

  it('rectToLines', () => {
    const lines = rectToLines(makeRect(0, 0, 10, 10));
    assert.equal(lines.length, 4);
  });

  it('pointsToRect', () => {
    const pts = [point(0, 0), point(10, 5), point(3, 20)];
    const r = pointsToRect(pts);
    assert.equal(r.x, 0);
    assert.equal(r.y, 0);
    assert.equal(r.width, 10);
    assert.equal(r.height, 20);
  });

  it('pointsToRect empty returns undefined', () => {
    assert.equal(pointsToRect([]), undefined);
  });

  it('joinRects', () => {
    const r1 = makeRect(0, 0, 10, 10);
    const r2 = makeRect(5, 5, 20, 20);
    const j = joinRects([r1, r2]);
    assert.equal(j.x, 0);
    assert.equal(j.y, 0);
    assert.equal(j.width, 25);
    assert.equal(j.height, 25);
  });

  it('joinRects empty returns undefined', () => {
    assert.equal(joinRects([]), undefined);
  });

  it('centerToRect', () => {
    const r = centerToRect(point(10, 20), 6, 4);
    assert.equal(r.x, 7);
    assert.equal(r.y, 18);
    assert.equal(r.width, 6);
    assert.equal(r.height, 4);
  });

  it('centerToRect square (single size)', () => {
    const r = centerToRect(point(10, 20), 10);
    assert.equal(r.width, 10);
    assert.equal(r.height, 10);
  });

  it('overlapsRects true', () => {
    const r1 = makeRect(0, 0, 10, 10);
    const r2 = makeRect(5, 5, 10, 10);
    assert.ok(overlapsRects(r1, r2));
  });

  it('overlapsRects false', () => {
    const r1 = makeRect(0, 0, 10, 10);
    const r2 = makeRect(20, 20, 10, 10);
    assert.ok(!overlapsRects(r1, r2));
  });

  it('containsPoint', () => {
    const r = makeRect(0, 0, 10, 10);
    assert.ok(containsPoint(r, point(5, 5)));
    assert.ok(!containsPoint(r, point(15, 5)));
  });

  it('containsRect', () => {
    const outer = makeRect(0, 0, 20, 20);
    const inner = makeRect(5, 5, 10, 10);
    assert.ok(containsRect(outer, inner));
    assert.ok(!containsRect(inner, outer));
  });

  it('cornersToRect from points', () => {
    const r = cornersToRect(point(0, 0), point(10, 10));
    assert.equal(r.x, 0);
    assert.equal(r.y, 0);
    assert.equal(r.width, 10);
    assert.equal(r.height, 10);
  });

  it('clipRect', () => {
    const selrect = makeRect(0, 0, 20, 20);
    const bounds = makeRect(5, 5, 20, 20);
    const c = clipRect(selrect, bounds);
    assert.equal(c.x, 5);
    assert.equal(c.y, 5);
    assert.equal(c.width, 15);
    assert.equal(c.height, 15);
  });

  it('boundsToRect', () => {
    const r = boundsToRect([
      point(0, 0), point(10, 0),
      point(10, 10), point(0, 10)
    ]);
    assert.equal(r.x, 0);
    assert.equal(r.y, 0);
    assert.equal(r.width, 10);
    assert.equal(r.height, 10);
  });

  it('rectToJSON', () => {
    const j = rectToJSON(makeRect(1, 2, 3, 4));
    assert.deepEqual(j, { x: 1, y: 2, width: 3, height: 4, x1: 1, y1: 2, x2: 4, y2: 6 });
  });

  it('decodeRect from object', () => {
    const r = decodeRect({ x: 1, y: 2, width: 3, height: 4 });
    assert.ok(isRect(r));
    assert.equal(r.x, 1);
  });

  it('EMPTY_RECT', () => {
    assert.ok(isRect(EMPTY_RECT));
    assert.equal(EMPTY_RECT.width, 0.01);
  });
});