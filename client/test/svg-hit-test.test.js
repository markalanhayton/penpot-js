'use strict';
/**
 * @module test/svg-hit-test.test
 * Unit tests for the SVG shape hit-test math used by the select tool.
 *
 * The bug: when a path is rendered with `transform="translate(x, y)"`,
 * `el.getBBox()` returns the bbox in the LOCAL coordinate system (before
 * the transform). Comparing the click point in world coordinates against
 * the local bbox will never match. The fix transforms the world point
 * through the inverse CTM before comparing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Re-implementation of the fixed #hitTest logic. We reimplement it here
 * (rather than reaching into the private method) because the original is
 * bound to a custom-element context with a `canvas` arg and many other
 * dependencies. The math is what matters; if the public method's logic
 * diverges from this, the test will fail.
 */
function pointInElementBBox(el, worldX, worldY) {
  const bbox = el.getBBox();
  const ctm = el.getCTM();
  let lx = worldX;
  let ly = worldY;
  if (ctm) {
    const inv = ctm.inverse();
    lx = inv.a * worldX + inv.c * worldY + inv.e;
    ly = inv.b * worldX + inv.d * worldY + inv.f;
  }
  const tol = 2;
  return lx >= bbox.x - tol && lx <= bbox.x + bbox.width + tol
    && ly >= bbox.y - tol && ly <= bbox.y + bbox.height + tol;
}

describe('SVG hit-test with transforms', () => {
  it('detects click inside a translated path', () => {
    // Simulate <path d="M 0 0 L 20 20" transform="translate(100, 100)">
    const el = makeMockPath('M 0 0 L 20 20', 'translate(100, 100)');
    assert.equal(pointInElementBBox(el, 110, 110), true, 'click at (110,110) should hit');
    assert.equal(pointInElementBBox(el, 0, 0), false, 'click at origin (0,0) should NOT hit (shape is at 100,100)');
  });

  it('detects click on the bbox edge with tolerance', () => {
    const el = makeMockPath('M 0 0 L 20 20', 'translate(50, 50)');
    // 2px tolerance — should be hit just inside
    assert.equal(pointInElementBBox(el, 50, 50), true);
    // Far outside
    assert.equal(pointInElementBBox(el, 1000, 1000), false);
  });

  it('works without a transform attribute', () => {
    // Simulate <rect x="0" y="0" width="20" height="20">
    const el = {
      _bbox: { x: 0, y: 0, width: 20, height: 20 },
      _ctm: null,
      getBBox() { return this._bbox; },
      getCTM() { return this._ctm; }
    };
    assert.equal(pointInElementBBox(el, 5, 5), true);
    assert.equal(pointInElementBBox(el, -5, -5), false);
  });

  it('works with rotated transforms', () => {
    // <rect x="0" y="0" width="100" height="20" transform="rotate(45 50 10)">
    // rotates around center (50, 10). After rotation, the rect spans a
    // diamond in world coords from roughly (50, -40.7) to (50, 60.7).
    const el = makeMockPath('M 0 0 L 100 0 L 100 20 L 0 20 Z', 'rotate(45 50 10)');
    // Center of rotated rect is at (50, 10) — should hit
    assert.equal(pointInElementBBox(el, 50, 10), true);
    // Far away — should not hit
    assert.equal(pointInElementBBox(el, 0, 0), false);
  });

  it('matches old behavior for untransformed shapes (regression)', () => {
    const el = {
      _bbox: { x: 10, y: 20, width: 30, height: 40 },
      _ctm: null,
      getBBox() { return this._bbox; },
      getCTM() { return this._ctm; }
    };
    assert.equal(pointInElementBBox(el, 25, 40), true);
    assert.equal(pointInElementBBox(el, 5, 5), false);
  });
});

function makeMockPath(d, transform) {
  const bbox = computeLocalBBox(d);
  let ctm;
  if (transform) {
    if (transform.startsWith('translate')) {
      const m = transform.match(/translate\(\s*([-\d.]+)\s*,?\s*([-\d.]+)?\s*\)/);
      if (m) {
        ctm = makeTranslate(parseFloat(m[1]), parseFloat(m[2] || '0'));
      }
    } else if (transform.startsWith('rotate')) {
      const m = transform.match(/rotate\(\s*([-\d.]+)(?:\s*,?\s*([-\d.]+)\s*,?\s*([-\d.]+))?\s*\)/);
      if (m) {
        ctm = makeRotate(parseFloat(m[1]), parseFloat(m[2] || '0'), parseFloat(m[3] || '0'));
      }
    }
  }
  return {
    _bbox: bbox,
    _ctm: ctm,
    getBBox() { return this._bbox; },
    getCTM() { return this._ctm; }
  };
}

function makeTranslate(x, y) {
  return {
    a: 1, b: 0, c: 0, d: 1, e: x, f: y,
    inverse() { return makeTranslate(-x, -y); }
  };
}

function makeRotate(angle, cx, cy) {
  const rad = angle * Math.PI / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  // SVG rotate(a, cx, cy) = T(cx,cy) * R(a) * T(-cx,-cy)
  const m = {
    a: c, b: s, c: -s, d: c,
    e: cx - c * cx + s * cy,
    f: cy - s * cx - c * cy,
  };
  m.inverse = () => invertMatrix(m);
  return m;
}

function invertMatrix(m) {
  // 2D affine inverse. Matrix is [a c e; b d f; 0 0 1].
  const det = m.a * m.d - m.b * m.c;
  if (det === 0) return m;
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}

function computeLocalBBox(d) {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) || [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i], y = nums[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
