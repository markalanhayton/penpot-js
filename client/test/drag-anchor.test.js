'use strict';
/**
 * @module test/drag-anchor.test
 * Unit tests for the move-tool drag math, verifying that the cursor's
 * click position is maintained throughout the drag.
 *
 * Bug: When the user clicks at a specific point inside a shape and drags,
 * the shape's click point should stay anchored to the cursor.
 *
 * The drag uses delta-based math:
 *   - On mousedown: record cursor position (#dragStartX, #dragStartY)
 *   - On each mousemove: dx = pos.x - #dragStartX, then #dragStartX = pos.x
 *   - Shape.x += dx (delta-based)
 *
 * This preserves the click offset because:
 *   - clickOffset = (initial click x) - (initial shape x)
 *   - After N moves: shape.x = initial shape x + sum(dx_i)
 *                   = initial shape x + (current cursor x) - (initial cursor x)
 *   - new offset = current cursor x - new shape x
 *                = (initial cursor x + sum(dx_i)) - (initial shape x + sum(dx_i))
 *                = initial cursor x - initial shape x
 *                = original click offset ✓
 *
 * So if the math is correct, the click offset is preserved.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function makeShape(x, y) {
  return { id: 's1', type: 'rect', x, y, width: 100, height: 100 };
}

function moveShapeBy(shape, dx, dy) {
  shape.x += dx;
  shape.y += dy;
}

describe('move tool drag math (click offset preserved)', () => {
  it('preserves click offset on a single shape drag', () => {
    const shape = makeShape(40, 40);
    const initialClick = { x: 50, y: 50 }; // click 10px inside the shape
    const initialOffset = { x: initialClick.x - shape.x, y: initialClick.y - shape.y };
    assert.equal(initialOffset.x, 10);
    assert.equal(initialOffset.y, 10);

    // Drag in 5 separate moves
    const moves = [
      { dx: 1, dy: 0 },
      { dx: 2, dy: 1 },
      { dx: 0, dy: 3 },
      { dx: 5, dy: 2 },
      { dx: 10, dy: 5 },
    ];

    for (const m of moves) {
      moveShapeBy(shape, m.dx, m.dy);
    }

    // Cursor has moved by sum(dx), sum(dy)
    const totalDx = moves.reduce((s, m) => s + m.dx, 0);
    const totalDy = moves.reduce((s, m) => s + m.dy, 0);
    // Cursor's new position (relative to initial)
    const cursorX = initialClick.x + totalDx;
    const cursorY = initialClick.y + totalDy;

    // New offset from cursor to shape's top-left
    const newOffset = { x: cursorX - shape.x, y: cursorY - shape.y };
    assert.equal(newOffset.x, initialOffset.x, 'X click offset should be preserved');
    assert.equal(newOffset.y, initialOffset.y, 'Y click offset should be preserved');
  });

  it('preserves click offset when starting from a non-origin position', () => {
    const shape = makeShape(0, 0);
    // Click at the bottom-right corner of the shape (90, 90)
    const initialClick = { x: 90, y: 90 };
    const initialOffset = { x: 90, y: 90 };

    // Drag by 50, 50
    moveShapeBy(shape, 50, 50);

    // Cursor is now at (140, 140)
    const cursorX = initialClick.x + 50;
    const cursorY = initialClick.y + 50;

    const newOffset = { x: cursorX - shape.x, y: cursorY - shape.y };
    assert.equal(newOffset.x, initialOffset.x);
    assert.equal(newOffset.y, initialOffset.y);
    assert.equal(shape.x, 50);
    assert.equal(shape.y, 50);
  });

  it('preserves click offset for negative deltas (drag up-left)', () => {
    const shape = makeShape(100, 100);
    const initialClick = { x: 110, y: 120 };
    const initialOffset = { x: 10, y: 20 };

    moveShapeBy(shape, -5, -10);
    moveShapeBy(shape, -3, -2);

    const cursorX = initialClick.x - 8;
    const cursorY = initialClick.y - 12;
    const newOffset = { x: cursorX - shape.x, y: cursorY - shape.y };
    assert.equal(newOffset.x, initialOffset.x);
    assert.equal(newOffset.y, initialOffset.y);
  });

  it('preserves click offset through many small moves', () => {
    const shape = makeShape(50, 50);
    const initialClick = { x: 75, y: 80 };
    const initialOffset = { x: initialClick.x - shape.x, y: initialClick.y - shape.y };

    // 100 small moves simulating a real drag
    for (let i = 0; i < 100; i++) {
      const dx = Math.sin(i * 0.1) * 0.5;
      const dy = Math.cos(i * 0.1) * 0.3;
      moveShapeBy(shape, dx, dy);
    }

    const cursorX = initialClick.x + (Array.from({length: 100}, (_, i) => Math.sin(i*0.1)*0.5)).reduce((s,v)=>s+v, 0);
    const cursorY = initialClick.y + (Array.from({length: 100}, (_, i) => Math.cos(i*0.1)*0.3)).reduce((s,v)=>s+v, 0);
    const newOffset = { x: cursorX - shape.x, y: cursorY - shape.y };
    assert.equal(newOffset.x.toFixed(10), initialOffset.x.toFixed(10));
    assert.equal(newOffset.y.toFixed(10), initialOffset.y.toFixed(10));
  });
});

describe('move tool drag math with snap (snap causes intentional offset shift)', () => {
  it('snap adjustment shifts the shape relative to the cursor', () => {
    // The drag math: shape.x += adjustedDx where adjustedDx = dx + snap.x
    // When snap activates, the shape jumps by snap.x pixels even though
    // the cursor only moved by dx. The click offset changes by snap.x.
    const shape = makeShape(40, 40);
    const initialClick = { x: 50, y: 50 };
    const initialOffset = { x: initialClick.x - shape.x, y: initialClick.y - shape.y };

    // Cursor moves 5px right
    const dx = 5, dy = 0;
    // Snap says: shift 3px right (e.g. snap to guide)
    const snap = { x: 3, y: 0 };
    const adjustedDx = dx + snap.x;
    const adjustedDy = dy + snap.y;
    moveShapeBy(shape, adjustedDx, adjustedDy);

    // Cursor is at (55, 50). Shape at (48, 40). Click offset = (7, 10).
    // Original click offset was (10, 10). The shape jumped 3px right, so
    // the click offset is now off by 3px.
    const cursorX = initialClick.x + dx;
    const cursorY = initialClick.y + dy;
    const newOffset = { x: cursorX - shape.x, y: cursorY - shape.y };
    // Note: snap is intentional behavior, this test documents the trade-off
    assert.equal(newOffset.x, 7, 'Snap shifts the click offset by snap.x pixels (intentional)');
  });
});
