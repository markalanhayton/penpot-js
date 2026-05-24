import { point, isPoint } from '../geom/point.js';
import { makeRect } from '../geom/rect.js';
import { next, zero, isZero } from '../uuid.js';
import { seek, insertAtIndex, notEmpty, unstableSort, withoutObj } from '../data.js';
import { instanceHeadQ, mainInstanceQ, inComponentCopyQ } from './component.js';

export function addShape(id, shape, container, frameId, parentId, index, ignoreTouched) {
  const updateParentShapes = (shapes) => {
    shapes = [...(shapes ?? [])];
    if (shapes.includes(id)) return shapes;
    if (index == null) return [...shapes, id];
    return insertAtIndex(shapes, index, [id]);
  };

  const updateParent = (parent) => {
    let result = { ...parent, shapes: updateParentShapes(parent.shapes) };
    result.shapes = result.shapes.filter((s) => s != null);
    if (inComponentCopyQ(parent) && !ignoreTouched) {
      delete result['remote-synced'];
    }
    return result;
  };

  const effectiveParentId = container.objects[parentId] ? parentId : zero;
  const effectiveFrameId = container.objects[frameId] ? frameId : zero;

  const objects = {
    ...container.objects,
    [id]: { ...shape, 'frame-id': effectiveFrameId, 'parent-id': effectiveParentId, id },
    [effectiveParentId]: updateParent(container.objects[effectiveParentId]),
  };

  return { ...container, objects };
}

export function parentOfQ(parent, child) {
  return parent.id === child['parent-id'];
}

export function getShape(container, id) {
  return container.objects?.[id];
}

export function setShape(container, shape) {
  return { ...container, objects: { ...container.objects, [shape.id]: shape } };
}

export function deleteShape(container, shapeId, ignoreTouched = false) {
  const deleteFromParent = (parent) => {
    let result = { ...parent, shapes: withoutObj(parent.shapes ?? [], shapeId) };
    if (result['shape-ref'] && !ignoreTouched) {
      delete result['remote-synced'];
    }
    return result;
  };

  const deleteFromObjects = (objects) => {
    const target = objects[shapeId];
    if (!target) return objects;

    const parentId = target['parent-id'] ?? target['frame-id'] ?? zero;
    const childrenIds = getChildrenIds(objects, shapeId);
    let result = { ...objects };
    delete result[shapeId];
    for (const cid of childrenIds) delete result[cid];
    const parent = result[parentId];
    if (parent) result[parentId] = deleteFromParent(parent);
    return result;
  };

  return { ...container, objects: deleteFromObjects(container.objects) };
}

export function fixBrokenChildren(container, id) {
  const objects = container.objects;
  const shape = objects[id];
  if (!shape || !shape.shapes) return container;
  const validShapes = shape.shapes.filter((sid) => sid in objects);
  if (validShapes.length === shape.shapes.length) return container;
  return { ...container, objects: { ...objects, [id]: { ...shape, shapes: validShapes } } };
}

export function getFrames(objects, options) {
  const { skipComponents = false, skipCopies = false, ignoreIndex = false } = options ?? {};
  return Object.values(objects).filter((shape) => {
    if (!isFrameShape(shape)) return false;
    if (skipComponents && instanceHeadQ(shape)) return false;
    if (skipCopies && instanceHeadQ(shape) && !mainInstanceQ(shape)) return false;
    return true;
  });
}

export function getFrameIds(objects, options) {
  return getFrames(objects, options).map((f) => f.id);
}

export function getNestedFrames(objects, frameId) {
  const children = getChildren(objects, frameId);
  return new Set(children.filter(isFrameShape).map((f) => f.id));
}

export function getRootFrameIds(objects) {
  return Object.values(objects)
    .filter((s) => s['parent-id'] === zero || s['parent-id'] == null)
    .filter(isFrameShape)
    .map((f) => f.id);
}

export function getRootObjects(objects) {
  return Object.values(objects)
    .filter((s) => s['parent-id'] === zero || s['parent-id'] == null);
}

export function getRootShapes(objects) {
  return Object.values(objects)
    .filter((s) => (s['parent-id'] === zero || s['parent-id'] == null) && !isFrameShape(s));
}

export function getRootShapeIds(objects) {
  return getRootShapes(objects).map((s) => s.id);
}

function isFrameShape(shape) {
  return shape?.type === 'frame';
}

function getChildren(objects, parentId) {
  const parent = objects[parentId];
  if (!parent || !parent.shapes) return [];
  return parent.shapes.map((id) => objects[id]).filter(Boolean);
}

function getChildrenIds(objects, parentId) {
  const result = [];
  const parent = objects[parentId];
  if (!parent || !parent.shapes) return result;
  const stack = [...parent.shapes];
  while (stack.length > 0) {
    const id = stack.pop();
    result.push(id);
    const child = objects[id];
    if (child?.shapes) stack.push(...child.shapes);
  }
  return result;
}

function getParentsWithSelf(objects, id) {
  const result = [];
  let current = id;
  const visited = new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
    const shape = objects[current];
    if (!shape) break;
    result.push(shape);
    current = shape['parent-id'];
  }
  return result;
}

function getParentIdsWithIndex(objects, id) {
  const parents = [];
  const indexMap = {};
  let current = id;
  const visited = new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
    const shape = objects[current];
    if (!shape) break;
    parents.push(current);
    const parent = objects[shape['parent-id']];
    if (parent?.shapes) {
      const idx = parent.shapes.indexOf(current);
      indexMap[current] = idx;
    }
    current = shape['parent-id'];
  }
  return [parents, indexMap];
}

function getBase(idA, idB, idParents) {
  const [parentsA] = idParents[idA] ?? [[], {}];
  const [parentsB] = idParents[idB] ?? [[], {}];

  const chainA = [idA, ...parentsA.map((s) => objects[s]?.id ?? s)];
  const setB = new Set([idB, ...parentsB.map((s) => objects[s]?.id ?? s)]);

  const baseId = seek((id) => setB.has(id), chainA) ?? zero;
  return baseId;
}

function isShapeOverShapeQ(objects, baseShapeId, overShapeId, bottomFrames, idParents) {
  const baseId = getBase(baseShapeId, overShapeId, idParents);

  if (baseId === baseShapeId) {
    return bottomFrames && isFrameShape(objects[baseId]);
  }
  if (baseId === overShapeId) {
    return !bottomFrames || !isFrameShape(objects[baseId]);
  }

  return false;
}

export function sortZIndex(objects, ids, options) {
  const { bottomFrames = false } = options ?? {};
  const idParents = {};
  for (const id of ids) {
    idParents[id] = getParentIdsWithIndex(objects, id);
  }

  return [...ids].sort((idA, idB) => {
    if (idA === idB) return 0;
    return isShapeOverShapeQ(objects, idA, idB, bottomFrames, idParents) ? 1 : -1;
  });
}

export function sortZIndexObjects(objects, items, options) {
  const { bottomFrames = false } = options ?? {};
  const idParents = {};
  for (const item of items) {
    idParents[item.id] = getParentIdsWithIndex(objects, item.id);
  }

  return unstableSort((objA, objB) => {
    if (objA.id === objB.id) return 0;
    return isShapeOverShapeQ(objects, objA.id, objB.id, bottomFrames, idParents) ? 1 : -1;
  }, items);
}

export function getFrameByPosition(objects, position, options) {
  if (!isPoint(position)) throw new Error('expected a point');
  const frames = getFrames(objects, options);
  const sorted = sortZIndexObjects(objects, frames, options);
  const validator = options?.validator ?? (() => true);
  return seek((f) => position != null && hasPointQ(f, position) && validator(f), sorted) ?? objects[zero];
}

export function getFrameIdByPosition(objects, position, options) {
  const frame = getFrameByPosition(objects, position, options);
  return frame?.id ?? null;
}

export function getFramesByPosition(objects, position, options) {
  return sortZIndexObjects(
    objects,
    getFrames(objects, options).filter((f) => position != null && hasPointQ(f, position)),
    options
  );
}

export function topNestedFrame(objects, position, excluded) {
  const frames = getFramesByPosition(objects, position);
  const filtered = excluded
    ? frames.filter((f) => !excluded.has(f.id))
    : frames;
  const visible = filtered.filter((f) => !f.hidden && !f.blocked);
  const frameSet = new Set(visible.map((f) => f.id));

  let current = visible[0];
  if (!current) return zero;

  while (current) {
    const childFrameId = seek((id) => frameSet.has(id), [...(current.shapes ?? [])].reverse());
    if (childFrameId == null) return current.id ?? zero;
    current = objects[childFrameId];
  }
  return zero;
}

export function getViewerFrames(objects, options) {
  const frames = getFrames(objects);
  const sorted = sortZIndexObjects(objects, frames);
  if (options?.allFrames) return sorted;
  return sorted.filter((f) => !f['hide-in-viewer']);
}

export function rotatedFrameQ(frame) {
  const rot = frame.rotation ?? 0;
  return !(-0.001 < rot && rot < 0.001);
}

function hasPointQ(shape, pt) {
  if (!shape.selrect) return false;
  const s = shape.selrect;
  return pt.x >= s.x && pt.x <= s.x + s.width && pt.y >= s.y && pt.y <= s.y + s.height;
}