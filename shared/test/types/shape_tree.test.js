import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addShape, deleteShape, getShape, setShape, getFrames, getRootFrameIds, getRootShapes, rotatedFrameQ, cloneShape, generateShapeGrid, startPageIndex, updatePageIndex } from '../../src/types/shape_tree.js';
import { zero } from '../../src/uuid.js';

describe('shape_tree', () => {
  const rootId = '00000000-0000-0000-0000-000000000000';
  const frameId = '11111111-1111-1111-1111-111111111111';
  const shapeId = '22222222-2222-2222-2222-222222222222';
  const childId = '33333333-3333-3333-3333-333333333333';

  function makeContainer() {
    return {
      objects: {
        [rootId]: { id: rootId, type: 'frame', 'parent-id': null, shapes: [frameId], name: 'Root' },
        [frameId]: { id: frameId, type: 'frame', 'parent-id': rootId, shapes: [shapeId], name: 'Board', selrect: { x: 0, y: 0, width: 800, height: 600 } },
        [shapeId]: { id: shapeId, type: 'rect', 'parent-id': frameId, 'frame-id': frameId, name: 'Rectangle' },
      },
    };
  }

  it('getShape', () => {
    const c = makeContainer();
    assert.equal(getShape(c, frameId)?.name, 'Board');
    assert.equal(getShape(c, 'nonexistent'), undefined);
  });

  it('setShape', () => {
    const c = makeContainer();
    const updated = setShape(c, { id: frameId, type: 'frame', name: 'Renamed' });
    assert.equal(updated.objects[frameId].name, 'Renamed');
  });

  it('addShape', () => {
    const c = makeContainer();
    const child = { id: childId, type: 'circle', name: 'Circle' };
    const result = addShape(childId, child, c, frameId, frameId, null, false);
    assert.ok(result.objects[childId]);
    assert.ok(result.objects[frameId].shapes.includes(childId));
  });

  it('deleteShape', () => {
    const c = makeContainer();
    const result = deleteShape(c, shapeId);
    assert.equal(result.objects[shapeId], undefined);
    assert.ok(!result.objects[frameId].shapes.includes(shapeId));
  });

  it('getFrames', () => {
    const c = makeContainer();
    const frames = getFrames(c.objects);
    assert.ok(frames.length >= 1);
    assert.equal(frames.every((f) => f.type === 'frame'), true);
  });

  it('getRootFrameIds', () => {
    const c = makeContainer();
    const ids = getRootFrameIds(c.objects);
    assert.ok(ids.length >= 1);
  });

  it('getRootShapes', () => {
    const c = makeContainer();
    const shapes = getRootShapes(c.objects);
    assert.ok(Array.isArray(shapes));
  });

  it('rotatedFrameQ', () => {
    assert.equal(rotatedFrameQ({ rotation: 45 }), true);
    assert.equal(rotatedFrameQ({ rotation: 0 }), false);
    assert.equal(rotatedFrameQ({}), false);
  });

  it('cloneShape — clones a shape with new id', () => {
    const c = makeContainer();
    const shape = c.objects[shapeId];
    const [newShape, newShapes, updatedShapes] = cloneShape(shape, frameId, c.objects);
    assert.notEqual(newShape.id, shapeId, 'clone gets a new id');
    assert.equal(newShape['parent-id'], frameId, 'clone parent is set');
    assert.equal(newShape.type, 'rect', 'clone preserves type');
    assert.equal(newShapes.length, 1, 'one shape in result');
  });

  it('cloneShape — clones a group with children', () => {
    const groupId = '44444444-4444-4444-4444-444444444444';
    const innerId = '55555555-5555-5555-5555-555555555555';
    const c = {
      objects: {
        [rootId]: { id: rootId, type: 'frame', 'parent-id': null, shapes: [groupId], name: 'Root' },
        [groupId]: { id: groupId, type: 'group', 'parent-id': rootId, 'frame-id': rootId, shapes: [innerId], name: 'Group' },
        [innerId]: { id: innerId, type: 'rect', 'parent-id': groupId, 'frame-id': rootId, name: 'Inner' },
      },
    };
    const group = c.objects[groupId];
    const [newGroup, newShapes, _] = cloneShape(group, rootId, c.objects);
    assert.notEqual(newGroup.id, groupId, 'group gets new id');
    assert.equal(newShapes.length, 2, 'group + child = 2 shapes');
    assert.equal(newGroup.shapes.length, 1, 'group has one child');
    const newInner = newShapes.find((s) => s.id !== newGroup.id);
    assert.equal(newInner['parent-id'], newGroup.id, 'child parent points to new group');
  });

  it('cloneShape — keepIds preserves original ids', () => {
    const c = makeContainer();
    const shape = c.objects[shapeId];
    const [newShape] = cloneShape(shape, frameId, c.objects, { keepIds: true });
    assert.equal(newShape.id, shapeId, 'keepIds preserves original id');
  });

  it('cloneShape — forceId uses provided id', () => {
    const c = makeContainer();
    const shape = c.objects[shapeId];
    const forcedId = 'forced-id-00000000-000000000000';
    const [newShape] = cloneShape(shape, frameId, c.objects, { forceId: forcedId });
    assert.equal(newShape.id, forcedId, 'forceId is used');
  });

  it('generateShapeGrid — generates grid positions', () => {
    const shapes = [
      { width: 100, height: 50, selrect: { x: 0, y: 0, width: 100, height: 50 } },
      { width: 80, height: 40, selrect: { x: 0, y: 0, width: 80, height: 40 } },
      { width: 120, height: 60, selrect: { x: 0, y: 0, width: 120, height: 60 } },
      { width: 90, height: 45, selrect: { x: 0, y: 0, width: 90, height: 45 } },
    ];
    const positions = generateShapeGrid(shapes, { x: 0, y: 0 }, 10);
    assert.equal(positions.length, 4, '4 positions for 4 shapes');
    assert.equal(positions[0].x, 0, 'first position x=0');
    assert.equal(positions[0].y, 0, 'first position y=0');
    assert.ok(positions._width > 0, 'grid has width');
    assert.ok(positions._height > 0, 'grid has height');
  });

  it('generateShapeGrid — empty shapes returns empty', () => {
    const positions = generateShapeGrid([], { x: 0, y: 0 }, 10);
    assert.deepEqual(positions, [], 'empty input');
  });

  it('startPageIndex — adds frame index', () => {
    const c = makeContainer();
    const indexed = startPageIndex(c.objects);
    assert.ok(Array.isArray(indexed._indexFrames), 'adds _indexFrames');
    assert.ok(indexed._indexFrames.includes(frameId), 'frame id in index');
  });

  it('updatePageIndex — rebuilds frame index', () => {
    const c = makeContainer();
    const indexed = updatePageIndex(c.objects);
    assert.ok(Array.isArray(indexed._indexFrames), 'adds _indexFrames');
    assert.ok(indexed._indexFrames.includes(frameId), 'frame id in index');
  });
});