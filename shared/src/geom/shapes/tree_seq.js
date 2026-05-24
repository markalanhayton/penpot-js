import * as d from '../../data.js';
import * as uuid from '../../uuid.js';
import * as ctl from '../../types/shape/layout.js';

function hasChildrenQ(objects, id) {
  const shape = objects[id];
  return shape?.shapes && shape.shapes.length > 0;
}

function isChildQ(objects, parentId, childId) {
  let currentId = childId;
  while (currentId) {
    const shape = objects[currentId];
    if (!shape) return false;
    if (shape.parentId === parentId) return true;
    if (shape.parentId === currentId || shape.parentId === uuid.ZERO) return false;
    currentId = shape.parentId;
  }
  return false;
}

function getParentIds(objects, id) {
  const result = [];
  let currentId = id;
  while (currentId) {
    const shape = objects[currentId];
    if (!shape || shape.parentId === currentId || shape.parentId === uuid.ZERO) break;
    currentId = shape.parentId;
    if (currentId) result.push(currentId);
  }
  return result;
}

export function getChildrenSeq(id, objects) {
  function* walk(currentId) {
    const shape = objects[currentId];
    if (!shape || !shape.shapes || shape.shapes.length === 0) return;
    let children = shape.shapes;
    if (ctl.flexLayoutQ(shape) && ctl.reverseQ(shape)) {
      children = [...children].reverse();
    }
    for (const childId of children) {
      const child = objects[childId];
      if (child) {
        yield child;
        yield* walk(childId);
      }
    }
  }
  return [...walk(id)];
}

export function getReflowRoot(id, objects) {
  return getReflowRootImpl(id, id, objects);
}

function getReflowRootImpl(currentId, lastRoot, objects) {
  const shape = objects[currentId];
  if (!shape || currentId === uuid.zero) return lastRoot;

  const parentId = shape['parent-id'];
  const parent = objects[parentId];
  if (!parent) return lastRoot;

  const parentIsFrame = parent?.type === 'frame';

  if (parentIsFrame && !ctl.anyLayoutQ(parent)) {
    return lastRoot;
  }

  if (ctl.anyLayoutQ(parent) && ctl.autoQ(parent)) {
    return getReflowRootImpl(parentId, parentId, objects);
  }

  if (ctl.anyLayoutQ(parent)) {
    return parentId;
  }

  return getReflowRootImpl(parentId, lastRoot, objects);
}

export function searchCommonRoots(ids, objects) {
  function findRoot(roots, id) {
    if (id === uuid.ZERO) return roots;

    const root = getReflowRoot(id, objects);
    let newRoots = new Set(roots);

    if (hasChildrenQ(objects, root)) {
      newRoots = new Set([...newRoots].filter(rid => !isChildQ(objects, root, rid)));
    }

    const containsParent = [...newRoots].some(rid =>
      getParentIds(objects, root).includes(rid)
    );

    if (!containsParent) {
      newRoots.add(root);
    }

    return newRoots;
  }

  return [...ids].reduce(findRoot, new Set());
}

export function resolveTree(ids, objects) {
  if (!ids || !(ids instanceof Set)) return [];

  const childSeq = searchCommonRoots(ids, objects)
    .flatMap(rootId => getChildrenSeq(rootId, objects));

  if (ids.has(uuid.ZERO)) {
    return [objects[uuid.ZERO], ...childSeq].filter(Boolean);
  }
  return childSeq;
}

export function resolveSubtree(fromId, toId, objects) {
  const fromSeq = getChildrenSeq(fromId, objects);
  const takeUntilIdx = fromSeq.findIndex(s => s.id === toId);
  const prefix = takeUntilIdx >= 0 ? fromSeq.slice(0, takeUntilIdx + 1) : fromSeq;

  const toSeq = getChildrenSeq(toId, objects);

  return [...prefix, ...toSeq.slice(1)];
}