'use strict';
/**
 * @module test/path-transform.test
 * Unit tests for SVG path-d transform helpers in shapes.js.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePathD, stringifyPathD, transformPathD, getPathDBounds } from '../public/lib/path-d.js';

describe('parsePathD + stringifyPathD', () => {
  it('parses and round-trips a simple polyline M/L', () => {
    const d = 'M 10 20 L 30 40 L 50 60';
    const tokens = parsePathD(d);
    assert.equal(tokens.length, 3);
    assert.equal(tokens[0].cmd, 'M');
    assert.deepEqual(tokens[0].args, [10, 20]);
    assert.equal(tokens[1].cmd, 'L');
    assert.deepEqual(tokens[1].args, [30, 40]);
    assert.equal(stringifyPathD(tokens), 'M 10 20 L 30 40 L 50 60');
  });

  it('parses negative and decimal numbers', () => {
    const tokens = parsePathD('M -1.5 2.25 L 0 0');
    assert.deepEqual(tokens[0].args, [-1.5, 2.25]);
    assert.deepEqual(tokens[1].args, [0, 0]);
  });

  it('handles relative commands', () => {
    const tokens = parsePathD('M 0 0 l 10 10 m 0 10 l -5 0');
    assert.equal(tokens[0].cmd, 'M');
    assert.equal(tokens[1].cmd, 'l');
    assert.equal(tokens[2].cmd, 'm');
    assert.equal(tokens[3].cmd, 'l');
  });

  it('handles H/V commands', () => {
    const tokens = parsePathD('M 0 0 H 10 V 20 H 0 Z');
    assert.equal(tokens[1].cmd, 'H');
    assert.deepEqual(tokens[1].args, [10]);
    assert.equal(tokens[2].cmd, 'V');
    assert.deepEqual(tokens[2].args, [20]);
  });

  it('handles C (cubic) commands', () => {
    const tokens = parsePathD('M 0 0 C 1 2 3 4 5 6');
    assert.equal(tokens[1].cmd, 'C');
    assert.deepEqual(tokens[1].args, [1, 2, 3, 4, 5, 6]);
  });

  it('handles A (arc) commands', () => {
    const tokens = parsePathD('M 0 0 A 5 5 0 1 1 10 10');
    assert.equal(tokens[1].cmd, 'A');
    assert.deepEqual(tokens[1].args, [5, 5, 0, 1, 1, 10, 10]);
  });
});

describe('transformPathD - translate', () => {
  it('translates a polyline by (dx, dy)', () => {
    const d = 'M 10 20 L 30 40 L 50 60';
    const out = transformPathD(d, { dx: 100, dy: 200 });
    assert.equal(out, 'M 110 220 L 130 240 L 150 260');
  });

  it('returns input unchanged when delta is zero', () => {
    const d = 'M 10 20 L 30 40';
    assert.equal(transformPathD(d, {}), d);
  });

  it('handles negative translation', () => {
    const d = 'M 100 200 L 300 400';
    const out = transformPathD(d, { dx: -50, dy: -100 });
    assert.equal(out, 'M 50 100 L 250 300');
  });

  it('translates H and V commands', () => {
    const d = 'M 0 0 H 100 V 200';
    const out = transformPathD(d, { dx: 10, dy: 20 });
    assert.equal(out, 'M 10 20 H 110 V 220');
  });

  it('translates cubic bezier control points', () => {
    const d = 'M 0 0 C 10 20 30 40 50 60';
    const out = transformPathD(d, { dx: 100, dy: 200 });
    assert.equal(out, 'M 100 200 C 110 220 130 240 150 260');
  });
});

describe('transformPathD - scale', () => {
  it('scales a polyline around the local origin', () => {
    const d = 'M 10 20 L 30 40';
    const out = transformPathD(d, { scaleX: 2, scaleY: 2, scaleOriginX: 0, scaleOriginY: 0 });
    assert.equal(out, 'M 20 40 L 60 80');
  });

  it('scales a polyline around its bounding box', () => {
    const d = 'M 10 20 L 30 40 L 50 60';
    const bounds = getPathDBounds(d);
    assert.deepEqual(bounds, { x: 10, y: 20, width: 40, height: 40 });
    const scaleX = 100 / bounds.width;
    const scaleY = 200 / bounds.height;
    const out = transformPathD(d, { scaleX, scaleY, scaleOriginX: bounds.x, scaleOriginY: bounds.y });
    // Original points (10,20)->(30,40)->(50,60) map to (10,20)->(60,120)->(110,220)
    // when scaled to 100x200 (middle point is 50% across both axes).
    assert.equal(out, 'M 10 20 L 60 120 L 110 220');
  });

  it('scales relative commands by the scale factor', () => {
    const d = 'M 0 0 l 10 10 l 10 10';
    const out = transformPathD(d, { scaleX: 2, scaleY: 2, scaleOriginX: 0, scaleOriginY: 0 });
    assert.equal(out, 'M 0 0 l 20 20 l 20 20');
  });
});

describe('transformPathD - translate + scale (resize simulation)', () => {
  it('resizes a polyline from 40x40 to 100x200', () => {
    const d = 'M 10 20 L 30 40 L 50 60';
    const bounds = getPathDBounds(d);
    assert.deepEqual(bounds, { x: 10, y: 20, width: 40, height: 40 });
    const scaleX = 100 / 40;
    const scaleY = 200 / 40;
    const out = transformPathD(d, {
      scaleX, scaleY,
      scaleOriginX: bounds.x, scaleOriginY: bounds.y,
      dx: 0, dy: 0,
    });
    assert.equal(out, 'M 10 20 L 60 120 L 110 220');
  });
});

describe('getPathDBounds', () => {
  it('returns 0,0,0,0 for empty input', () => {
    assert.deepEqual(getPathDBounds(''), { x: 0, y: 0, width: 0, height: 0 });
  });

  it('computes bounds for a polyline', () => {
    const bounds = getPathDBounds('M 10 20 L 30 80 L 50 40');
    assert.equal(bounds.x, 10);
    assert.equal(bounds.y, 20);
    assert.equal(bounds.width, 40);
    assert.equal(bounds.height, 60);
  });

  it('handles negative coordinates', () => {
    const bounds = getPathDBounds('M -10 -20 L 10 20');
    assert.equal(bounds.x, -10);
    assert.equal(bounds.y, -20);
    assert.equal(bounds.width, 20);
    assert.equal(bounds.height, 40);
  });
});

describe('polyline move/resize scenario (bbox integrity)', () => {
  // Simulates the full svg-import -> tool-manager pipeline for a polyline
  // to make sure the bounding box always contains the polyline after each
  // operation.

  function importPolyline(points, closed = false) {
    const nums = points.trim().split(/[\s,]+/).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    const worldBBox = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
    const d = pointsToLocalPath(points, closed);
    return {
      type: 'path',
      x: worldBBox.x,
      y: worldBBox.y,
      width: worldBBox.width,
      height: worldBBox.height,
      d,
    };
  }

  function pointsToLocalPath(pointsStr, closed) {
    const nums = pointsStr.trim().split(/[\s,]+/).map(Number);
    if (nums.length < 4) return 'M 0 0';
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const parts = [`M ${nums[0] - minX} ${nums[1] - minY}`];
    for (let i = 2; i < nums.length - 1; i += 2) {
      parts.push(`L ${nums[i] - minX} ${nums[i + 1] - minY}`);
    }
    if (closed) parts.push('Z');
    return parts.join(' ');
  }

  function moveShape(shape, dx, dy) {
    shape.x += dx;
    shape.y += dy;
  }

  function resizeShape(shape, x, y, w, h) {
    const d = shape.d;
    if (d) {
      const dBounds = getPathDBounds(d);
      const scaleX = w / shape.width;
      const scaleY = h / shape.height;
      shape.d = transformPathD(d, {
        dx: -dBounds.x, dy: -dBounds.y,
        scaleX, scaleY,
        scaleOriginX: 0, scaleOriginY: 0,
      });
    }
    shape.x = x;
    shape.y = y;
    shape.width = w;
    shape.height = h;
  }

  function renderPathD(shape) {
    // Mirrors shapes.js#renderPath: translate(shape.x, shape.y) applied to local d
    const tokens = parsePathD(shape.d);
    return tokens.map(({ cmd, args }) => {
      const newArgs = args.slice();
      const isRel = cmd >= 'a' && cmd <= 'z';
      const upper = isRel ? cmd.toUpperCase() : cmd;
      if (upper === 'M' || upper === 'L' || upper === 'T') {
        for (let i = 0; i < newArgs.length; i += 2) {
          if (isRel) continue;
          newArgs[i] += shape.x;
          newArgs[i + 1] += shape.y;
        }
      }
      return { cmd, args: newArgs };
    });
  }

  function worldBounds(shape) {
    const d = shape.d;
    if (!d) return { x: shape.x, y: shape.y, width: 0, height: 0 };
    const dBounds = getPathDBounds(d);
    return {
      x: dBounds.x + shape.x,
      y: dBounds.y + shape.y,
      width: dBounds.width,
      height: dBounds.height,
    };
  }

  it('keeps bbox surrounding the polyline after import', () => {
    const shape = importPolyline('10 20 30 40 50 60');
    // After svg-import fix: d is in local coords (top-left at 0, 0).
    // shape.x/y are the world position of the d's top-left (= pathBBox top-left in world).
    // For points (10,20) (30,40) (50,60) with viewBox offset 0, x=10, y=20.
    assert.deepEqual(shape, {
      type: 'path',
      x: 10, y: 20, width: 40, height: 40,
      d: 'M 0 0 L 20 20 L 40 40',
    });
    assert.equal(worldBounds(shape).x, 10);
    assert.equal(worldBounds(shape).y, 20);
    assert.equal(worldBounds(shape).width, 40);
    assert.equal(worldBounds(shape).height, 40);
  });

  it('keeps bbox surrounding the polyline after move', () => {
    const shape = importPolyline('10 20 30 40 50 60');
    moveShape(shape, 100, 200);
    const wb = worldBounds(shape);
    const selBox = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    assert.ok(wb.x >= selBox.x, 'polyline left >= selbox left');
    assert.ok(wb.y >= selBox.y, 'polyline top >= selbox top');
    assert.ok(wb.x + wb.width <= selBox.x + selBox.width, 'polyline right <= selbox right');
    assert.ok(wb.y + wb.height <= selBox.y + selBox.height, 'polyline bottom <= selbox bottom');
  });

  it('keeps bbox surrounding the polyline after multiple moves', () => {
    const shape = importPolyline('0 0 10 10 20 0');
    moveShape(shape, 50, 50);
    moveShape(shape, -20, 100);
    moveShape(shape, 10, -10);
    const wb = worldBounds(shape);
    const selBox = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    assert.ok(wb.x >= selBox.x);
    assert.ok(wb.y >= selBox.y);
    assert.ok(wb.x + wb.width <= selBox.x + selBox.width);
    assert.ok(wb.y + wb.height <= selBox.y + selBox.height);
  });

  it('keeps bbox surrounding the polyline after resize', () => {
    const shape = importPolyline('10 20 30 40 50 60');
    resizeShape(shape, 10, 20, 80, 80);
    const wb = worldBounds(shape);
    const selBox = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    assert.deepEqual(wb, selBox, 'after resize, polyline bbox equals selection bbox');
  });

  it('keeps bbox surrounding the polyline after move+resize+move', () => {
    const shape = importPolyline('0 0 25 10 50 0');
    resizeShape(shape, 0, 0, 200, 200);
    moveShape(shape, 100, 50);
    moveShape(shape, -25, 25);
    const wb = worldBounds(shape);
    const selBox = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    assert.ok(wb.x >= selBox.x, `wb.x=${wb.x} >= selBox.x=${selBox.x}`);
    assert.ok(wb.y >= selBox.y, `wb.y=${wb.y} >= selBox.y=${selBox.y}`);
    assert.ok(wb.x + wb.width <= selBox.x + selBox.width + 0.001, `wb right ${wb.x + wb.width} <= selBox right ${selBox.x + selBox.width}`);
    assert.ok(wb.y + wb.height <= selBox.y + selBox.height + 0.001, `wb bottom ${wb.y + wb.height} <= selBox bottom ${selBox.y + selBox.height}`);
  });

  it('simulates pen-tool creation: d converted from world to local coords', () => {
    // The pen tool builds d in world coords (raw point positions), then
    // computes the world bbox. The fix: convert d to local coords.
    const worldPoints = [[10, 20], [30, 40], [50, 60]];
    const worldBBox = {
      x: Math.min(...worldPoints.map(p => p[0])),
      y: Math.min(...worldPoints.map(p => p[1])),
      width: 40,
      height: 40,
    };
    const worldD = `M ${worldPoints[0][0]} ${worldPoints[0][1]} L ${worldPoints[1][0]} ${worldPoints[1][1]} L ${worldPoints[2][0]} ${worldPoints[2][1]}`;
    const localD = transformPathD(worldD, { dx: -worldBBox.x, dy: -worldBBox.y });

    const shape = {
      type: 'path',
      x: worldBBox.x,
      y: worldBBox.y,
      width: worldBBox.width,
      height: worldBBox.height,
      d: localD,
    };

    // The d's local top-left is at (0, 0), so world bbox should be shape.x/y.
    assert.equal(getPathDBounds(shape.d).x, 0);
    assert.equal(getPathDBounds(shape.d).y, 0);
    assert.equal(getPathDBounds(shape.d).width, 40);
    assert.equal(getPathDBounds(shape.d).height, 40);

    // After renderPath's translate(10, 20), the d's world bbox matches the
    // selection bbox exactly.
    const wb = worldBounds(shape);
    assert.equal(wb.x, 10);
    assert.equal(wb.y, 20);
    assert.equal(wb.width, 40);
    assert.equal(wb.height, 40);
  });
});
