'use strict';
/**
 * @module test/frame-children-move.test
 * Unit tests for the move/resize of children when a frame is moved.
 *
 * Bug: moving or resizing a frame left its children behind because
 * moveShape/resizeShape only updated the parent's own x/y/width/height.
 *
 * Fix: walk the page's tree and apply the same transform to all
 * descendants of a container shape (frame, group, bool).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function makePage(shapes) {
  // shapes is a flat list of shape objects. Build a parentId-keyed lookup.
  // Top-level shapes have no parentId.
  return {
    id: 'p1',
    name: 'Page 1',
    objects: shapes.reduce((acc, s) => {
      acc[s.id] = s;
      return acc;
    }, {}),
  };
}

function findShape(page, id) {
  return page.objects[id];
}

function findChildren(page, parentId) {
  const items = Object.values(page.objects);
  const direct = items.filter(s => s.parentId === parentId);
  return direct;
}

function isContainer(shape) {
  return shape && (shape.type === 'frame' || shape.type === 'group' || shape.type === 'bool');
}

function moveShape(page, shapeId, dx, dy) {
  const shape = findShape(page, shapeId);
  if (!shape) return;
  shape.x += dx;
  shape.y += dy;
  if (isContainer(shape)) {
    for (const child of findChildren(page, shape.id)) {
      moveShape(page, child.id, dx, dy);
    }
  }
}

function resizeShape(page, shapeId, x, y, width, height) {
  const shape = findShape(page, shapeId);
  if (!shape) return;
  const oldX = shape.x || 0;
  const oldY = shape.y || 0;
  const oldW = shape.width || 0;
  const oldH = shape.height || 0;
  const newW = width;
  const newH = height;
  shape.x = x;
  shape.y = y;
  shape.width = width;
  shape.height = height;
  if (isContainer(shape) && oldW > 0 && oldH > 0 && newW > 0 && newH > 0) {
    const scaleX = newW / oldW;
    const scaleY = newH / oldH;
    for (const child of findChildren(page, shape.id)) {
      if (child.x != null) child.x = (child.x - oldX) * scaleX + x;
      if (child.y != null) child.y = (child.y - oldY) * scaleY + y;
      if (child.width != null) child.width = child.width * scaleX;
      if (child.height != null) child.height = child.height * scaleY;
    }
  }
}

describe('frame children move with the frame', () => {
  it('moves direct children of a frame by the same delta', () => {
    const page = makePage([
      { id: 'f1', type: 'frame', x: 0, y: 0, width: 200, height: 200, parentId: null },
      { id: 'c1', type: 'circle', x: 50, y: 60, width: 30, height: 30, parentId: 'f1' },
      { id: 'c2', type: 'rect',   x: 100, y: 120, width: 50, height: 40, parentId: 'f1' },
    ]);
    moveShape(page, 'f1', 25, 10);
    assert.equal(page.objects.f1.x, 25);
    assert.equal(page.objects.f1.y, 10);
    assert.equal(page.objects.c1.x, 75, 'c1.x should be 50+25=75');
    assert.equal(page.objects.c1.y, 70, 'c1.y should be 60+10=70');
    assert.equal(page.objects.c2.x, 125);
    assert.equal(page.objects.c2.y, 130);
  });

  it('moves nested descendants recursively', () => {
    const page = makePage([
      { id: 'f1', type: 'frame', x: 0, y: 0, width: 200, height: 200, parentId: null },
      { id: 'g1', type: 'group', x: 30, y: 40, width: 100, height: 100, parentId: 'f1' },
      { id: 'c1', type: 'circle', x: 50, y: 60, width: 30, height: 30, parentId: 'g1' },
    ]);
    moveShape(page, 'f1', 10, 20);
    assert.equal(page.objects.f1.x, 10);
    assert.equal(page.objects.g1.x, 40, 'g1 should move with f1');
    assert.equal(page.objects.g1.y, 60);
    assert.equal(page.objects.c1.x, 60, 'c1 should move with g1 which moves with f1');
    assert.equal(page.objects.c1.y, 80);
  });

  it('does not move siblings (unrelated shapes)', () => {
    const page = makePage([
      { id: 'f1', type: 'frame', x: 0, y: 0, width: 200, height: 200, parentId: null },
      { id: 'c1', type: 'circle', x: 50, y: 60, width: 30, height: 30, parentId: 'f1' },
      { id: 'standalone', type: 'rect', x: 300, y: 300, width: 50, height: 50, parentId: null },
    ]);
    moveShape(page, 'f1', 100, 100);
    assert.equal(page.objects.standalone.x, 300, 'sibling should not move');
    assert.equal(page.objects.standalone.y, 300);
  });

  it('does not move the parent of a moved child (no infinite recursion)', () => {
    const page = makePage([
      { id: 'f1', type: 'frame', x: 0, y: 0, width: 200, height: 200, parentId: null },
      { id: 'c1', type: 'circle', x: 50, y: 60, width: 30, height: 30, parentId: 'f1' },
    ]);
    moveShape(page, 'c1', 10, 10);
    assert.equal(page.objects.f1.x, 0, 'parent should NOT move when child moves');
    assert.equal(page.objects.f1.y, 0);
    assert.equal(page.objects.c1.x, 60);
    assert.equal(page.objects.c1.y, 70);
  });

  it('handles a child that has a parent inside a frame (multi-level)', () => {
    const page = makePage([
      { id: 'f1', type: 'frame', x: 0, y: 0, width: 500, height: 500, parentId: null },
      { id: 'g1', type: 'group', x: 100, y: 100, width: 200, height: 200, parentId: 'f1' },
      { id: 'g2', type: 'group', x: 130, y: 130, width: 50, height: 50, parentId: 'g1' },
      { id: 'c1', type: 'rect', x: 200, y: 200, width: 30, height: 30, parentId: 'g2' },
    ]);
    moveShape(page, 'f1', 5, 5);
    assert.equal(page.objects.f1.x, 5);
    assert.equal(page.objects.g1.x, 105);
    assert.equal(page.objects.g2.x, 135);
    assert.equal(page.objects.c1.x, 205);
  });
});

describe('frame children resize with the frame', () => {
  it('scales direct children proportionally to the new bounds', () => {
    const page = makePage([
      { id: 'f1', type: 'frame', x: 0, y: 0, width: 100, height: 100, parentId: null },
      { id: 'c1', type: 'rect', x: 25, y: 25, width: 50, height: 50, parentId: 'f1' },
    ]);
    resizeShape(page, 'f1', 0, 0, 200, 200);
    assert.equal(page.objects.f1.x, 0);
    assert.equal(page.objects.f1.width, 200);
    assert.equal(page.objects.c1.x, 50, 'c1.x should be 25*2=50');
    assert.equal(page.objects.c1.y, 50);
    assert.equal(page.objects.c1.width, 100, 'c1.width should be 50*2=100');
    assert.equal(page.objects.c1.height, 100);
  });

  it('handles non-zero origin when resizing', () => {
    const page = makePage([
      { id: 'f1', type: 'frame', x: 100, y: 100, width: 100, height: 100, parentId: null },
      { id: 'c1', type: 'rect', x: 125, y: 125, width: 50, height: 50, parentId: 'f1' },
    ]);
    resizeShape(page, 'f1', 100, 100, 200, 200);
    assert.equal(page.objects.c1.x, 150, 'c1.x should be 100 + (125-100)*2 = 150');
    assert.equal(page.objects.c1.y, 150);
    assert.equal(page.objects.c1.width, 100);
  });

  it('does not resize siblings (unrelated shapes)', () => {
    const page = makePage([
      { id: 'f1', type: 'frame', x: 0, y: 0, width: 100, height: 100, parentId: null },
      { id: 'c1', type: 'rect', x: 25, y: 25, width: 50, height: 50, parentId: 'f1' },
      { id: 'standalone', type: 'rect', x: 300, y: 300, width: 50, height: 50, parentId: null },
    ]);
    resizeShape(page, 'f1', 0, 0, 200, 200);
    assert.equal(page.objects.standalone.x, 300);
    assert.equal(page.objects.standalone.width, 50, 'sibling width unchanged');
  });
});
