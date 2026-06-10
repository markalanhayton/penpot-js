'use strict';
/**
 * @module test/drag-absolute-anchor.test
 * Unit tests for the absolute-positioning drag math.
 *
 * Behavior: when dragging a shape, the point the user clicked on should
 * always stay anchored to the cursor. The drag math uses absolute
 * positioning (not delta accumulation):
 *
 *   newShapePos = originalShapePos + (currentCursorPos - clickStartPos)
 *
 * This avoids cumulative floating-point drift and is more predictable
 * than delta accumulation.
 *
 * Bonus: snap adjustment is applied to the absolute new position, not
 * to the delta. So snapping shifts the shape by the snap amount while
 * the cursor's click-offset changes by the same amount (the snap is
 * "sticky" — once snapped, the offset stays the snapped value).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function makeShape(x, y) {
  return { id: 's1', type: 'rect', x, y, width: 100, height: 100 };
}

function applyDrag(shape, clickStartPos, cursorPos, originalPos, snap = { x: 0, y: 0 }) {
  const totalDx = cursorPos.x - clickStartPos.x;
  const totalDy = cursorPos.y - clickStartPos.y;
  shape.x = originalPos.x + totalDx + snap.x;
  shape.y = originalPos.y + totalDy + snap.y;
}

describe('absolute-positioning drag (click anchor)', () => {
  it('preserves click offset on single shape drag', () => {
    const shape = makeShape(40, 40);
    const clickStart = { x: 50, y: 50 };
    const original = { x: shape.x, y: shape.y };
    const clickOffset = { x: clickStart.x - original.x, y: clickStart.y - original.y };
    assert.equal(clickOffset.x, 10);

    const moves = [
      { x: 51, y: 50 },  // 1px right
      { x: 53, y: 51 },  // 2px right, 1px down
      { x: 53, y: 54 },  // 0 right, 3px down
      { x: 58, y: 56 },  // 5px right, 2px down
      { x: 68, y: 61 },  // 10px right, 5px down
    ];

    for (const cursor of moves) {
      applyDrag(shape, clickStart, cursor, original);
      const newOffset = { x: cursor.x - shape.x, y: cursor.y - shape.y };
      assert.equal(newOffset.x, clickOffset.x, 'X click offset preserved');
      assert.equal(newOffset.y, clickOffset.y, 'Y click offset preserved');
    }
  });

  it('preserves click offset for negative deltas (drag up-left)', () => {
    const shape = makeShape(100, 100);
    const clickStart = { x: 110, y: 120 };
    const original = { x: shape.x, y: shape.y };

    applyDrag(shape, clickStart, { x: 105, y: 110 }, original);
    assert.equal(shape.x, 95, 'shape.x = 100 + (105-110) = 95');
    assert.equal(shape.y, 90, 'shape.y = 100 + (110-120) = 90');
  });

  it('preserves click offset through many small moves', () => {
    const shape = makeShape(50, 50);
    const clickStart = { x: 75, y: 80 };
    const original = { x: shape.x, y: shape.y };

    let cursor = { x: 75, y: 80 };
    for (let i = 0; i < 100; i++) {
      cursor = { x: cursor.x + Math.sin(i * 0.1) * 0.5, y: cursor.y + Math.cos(i * 0.1) * 0.3 };
      applyDrag(shape, clickStart, cursor, original);
      const offset = { x: cursor.x - shape.x, y: cursor.y - shape.y };
      const expected = { x: clickStart.x - original.x, y: clickStart.y - original.y };
      // Float precision: 12 decimal places
      assert.equal(offset.x.toFixed(12), expected.x.toFixed(12));
      assert.equal(offset.y.toFixed(12), expected.y.toFixed(12));
    }
  });

  it('applies snap adjustment to absolute position, shifting the click offset', () => {
    // Snap is an intentional feature that shifts the shape by a few pixels
    // when it crosses a snap guide. The click offset changes by the snap
    // amount — this is by design.
    const shape = makeShape(40, 40);
    const clickStart = { x: 50, y: 50 };
    const original = { x: shape.x, y: shape.y };

    // Cursor moves 5px right, snap kicks in shifting 3px right
    applyDrag(shape, clickStart, { x: 55, y: 50 }, original, { x: 3, y: 0 });
    assert.equal(shape.x, 48, 'shape.x = 40 + (55-50) + 3 = 48');
    // Click offset: cursor 55 - shape 48 = 7. Original was 10. So it shifted by snap.x = 3.
    const newOffset = 55 - shape.x;
    assert.equal(newOffset, 7, 'Snap.x shifted the click offset by 3 (intentional)');
  });

  it('preserves multi-shape selection: all shapes move by the same delta', () => {
    const s1 = makeShape(40, 40);
    const s2 = makeShape(200, 200);
    const s3 = makeShape(400, 400);
    const orig1 = { x: s1.x, y: s1.y };
    const orig2 = { x: s2.x, y: s2.y };
    const orig3 = { x: s3.x, y: s3.y };
    const clickStart = { x: 50, y: 50 }; // clicked on s1
    const cursor = { x: 100, y: 100 };

    const totalDx = cursor.x - clickStart.x;
    const totalDy = cursor.y - clickStart.y;
    for (const [shape, orig] of [[s1, orig1], [s2, orig2], [s3, orig3]]) {
      shape.x = orig.x + totalDx;
      shape.y = orig.y + totalDy;
    }

    // All three shapes moved by the same delta
    assert.equal(s1.x, 90, 's1 = 40 + 50 = 90');
    assert.equal(s2.x, 250, 's2 = 200 + 50 = 250');
    assert.equal(s3.x, 450, 's3 = 400 + 50 = 450');
    // The clicked shape's click offset is preserved
    const newOffset = { x: cursor.x - s1.x, y: cursor.y - s1.y };
    assert.equal(newOffset.x, 10);
    assert.equal(newOffset.y, 10);
  });

  it('absolute vs delta: end result is the same', () => {
    // Verify the absolute-positioning approach is mathematically
    // equivalent to delta accumulation for the FINAL position.
    const shapeA = makeShape(40, 40);
    const shapeB = makeShape(40, 40);
    const clickStart = { x: 50, y: 50 };
    const original = { x: shapeA.x, y: shapeA.y };

    // Absolute: each move sets shape to original + totalDelta
    const moves = [
      { x: 51, y: 50 },
      { x: 53, y: 51 },
      { x: 53, y: 54 },
      { x: 58, y: 56 },
      { x: 68, y: 61 },
    ];
    for (const cursor of moves) {
      applyDrag(shapeA, clickStart, cursor, original);
    }

    // Delta: each move adds delta to current
    const originalB = { x: shapeB.x, y: shapeB.y };
    let lastCursor = clickStart;
    for (const cursor of moves) {
      shapeB.x += cursor.x - lastCursor.x;
      shapeB.y += cursor.y - lastCursor.y;
      lastCursor = cursor;
    }

    // Both end at the same position
    assert.equal(shapeA.x, shapeB.x);
    assert.equal(shapeA.y, shapeB.y);
  });
});
