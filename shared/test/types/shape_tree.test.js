import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addShape, deleteShape, getShape, setShape, getFrames, getRootFrameIds, getRootShapes, rotatedFrameQ } from '../../src/types/shape_tree.js';
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
});