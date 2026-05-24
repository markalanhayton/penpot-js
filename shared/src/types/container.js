import { seek } from '../data.js';
import { zero } from '../uuid.js';
import { instanceRootQ, instanceHeadQ, mainInstanceQ, inComponentCopyQ, inComponentCopyNotHeadQ, inComponentCopyNotRootQ, isVariantContainerQ, usesLibraryComponentsQ } from './component.js';
import { getPage, pagesSeq } from './pages_list.js';
import { componentsSeq, deletedComponentsSeq, getComponent as getComponentById } from './components_list.js';

export const VALID_CONTAINER_TYPES = new Set(['page', 'component']);

export function makeContainer(pageOrComponent, type) {
  return { ...pageOrComponent, type };
}

export function unmakeContainer(container) {
  const { type, ...rest } = container;
  return rest;
}

export function pageQ(container) {
  return container?.type === 'page';
}

export function componentQ(container) {
  return container?.type === 'component';
}

export function getContainer(file, type, id) {
  if (type === 'page') {
    const page = getPage(file.data ?? file, id);
    return page ? makeContainer(page, 'page') : undefined;
  }
  if (type === 'component') {
    const comp = getComponentById(file.data ?? file, id);
    return comp ? makeContainer(comp, 'component') : undefined;
  }
  return undefined;
}

export function getShape(container, shapeId) {
  return container.objects?.[shapeId];
}

export function shapesSeq(container) {
  return Object.values(container.objects ?? {});
}

export function updateShape(container, shapeId, f) {
  const objects = container.objects ?? {};
  if (!(shapeId in objects)) return container;
  return {
    ...container,
    objects: { ...objects, [shapeId]: f(objects[shapeId]) },
  };
}

export function getContainerRoot(container) {
  return seek(
    (s) => s['parent-id'] == null || s['parent-id'] === zero,
    shapesSeq(container)
  );
}

export function getDirectChildren(container, shape) {
  return (shape.shapes ?? []).map((id) => getShape(container, id)).filter(Boolean);
}

export function getChildrenInInstance(objects, id) {
  function getChildrenRec(children, currentId) {
    const shape = objects[currentId];
    if (!shape) return children;
    if (instanceHeadQ(shape) && children.length > 0) return children;
    const newChildren = [...children, shape];
    for (const childId of shape.shapes ?? []) {
      const result = getChildrenRec(newChildren, childId);
      newChildren.length = 0;
      for (const item of result) newChildren.push(item);
    }
    return newChildren;
  }
  return getChildrenRec([], id);
}

export function getComponentShape(objects, shape, options) {
  const { allowMain = false } = options ?? {};
  const parent = objects[shape?.['parent-id']];

  if (shape == null) return undefined;
  if (shape['parent-id'] == null || shape['parent-id'] === zero) return undefined;
  if (instanceRootQ(shape)) return shape;
  if (!inComponentCopyQ(shape) && !allowMain) return undefined;
  if (instanceHeadQ(shape) && !(inComponentCopyQ(parent))) return shape;
  if (parent) return getComponentShape(objects, parent, options);
  return undefined;
}

export function getHeadShape(objects, shape, options) {
  const { allowMain = false } = options ?? {};

  if (shape == null) return undefined;
  if (shape['parent-id'] == null || shape['parent-id'] === zero) return undefined;
  if (instanceHeadQ(shape)) return shape;
  if (!inComponentCopyQ(shape) && !allowMain) return undefined;
  const parent = objects[shape['parent-id']];
  if (parent) return getHeadShape(objects, parent, options);
  return undefined;
}

export function getChildHeads(objects, shapeId) {
  const shape = objects[shapeId];
  if (!shape) return [];
  if (instanceHeadQ(shape)) return [shape];
  return (shape.shapes ?? []).flatMap((id) => getChildHeads(objects, id));
}

export function getParentHeads(objects, shape) {
  const result = [];
  let current = shape;
  while (current) {
    if (instanceHeadQ(current)) result.unshift(current);
    current = objects[current['parent-id']];
  }
  return result;
}

export function getParentCopyHeads(objects, shape) {
  const result = [];
  let current = shape;
  while (current) {
    if (instanceHeadQ(current) && inComponentCopyQ(current)) result.unshift(current);
    current = objects[current['parent-id']];
  }
  return result;
}

export function getInstanceRoot(objects, shape) {
  if (shape == null) return undefined;
  if (shape['parent-id'] == null || shape['parent-id'] === zero) return undefined;
  if (instanceRootQ(shape)) return shape;
  const parent = objects[shape['parent-id']];
  if (parent) return getInstanceRoot(objects, parent);
  return undefined;
}

export function findComponentMain(objects, shape, onlyDirectChild = true) {
  let current = shape;
  const visited = new Set();

  while (current) {
    if (current == null || current['parent-id'] == null || current['parent-id'] === zero) return undefined;
    if (visited.has(current.id)) return undefined;
    visited.add(current.id);

    if (current['main-instance'] === true) return current;

    if (onlyDirectChild && instanceHeadQ(current)) return undefined;
    if (!onlyDirectChild && instanceRootQ(current)) return undefined;

    current = objects[current['parent-id']];
  }
  return undefined;
}

export function insideComponentMainQ(objects, shape, onlyDirectChild = true) {
  return findComponentMain(objects, shape, onlyDirectChild) != null;
}

export function inAnyComponentQ(objects, shape) {
  return inComponentCopyQ(shape) || instanceHeadQ(shape) || insideComponentMainQ(objects, shape);
}

export function getFirstValidParent(objects, id) {
  const shape = objects[id];
  if (!shape) return undefined;
  if (inComponentCopyQ(shape) || isVariantContainerQ(shape)) {
    return getFirstValidParent(objects, shape['parent-id']);
  }
  return shape;
}

export function hasAnyCopyParentQ(objects, shape) {
  const parent = objects[shape?.['parent-id']];
  if (!parent) return false;
  if (inComponentCopyQ(parent)) return true;
  return hasAnyCopyParentQ(objects, parent);
}

export function detachShape(shape) {
  const result = { ...shape };
  delete result['component-id'];
  delete result['component-file'];
  delete result['component-root'];
  delete result['main-instance'];
  delete result['remote-synced'];
  delete result['shape-ref'];
  delete result['touched'];
  return result;
}

export function validShapeForComponentQ(objects, shape) {
  return !hasAnyMainQ(objects, shape) && !hasAnyCopyParentQ(objects, shape);
}

function hasAnyMainQ(objects, shape) {
  const stack = [shape];
  while (stack.length > 0) {
    const current = stack.pop();
    if (mainInstanceQ(current)) return true;
    for (const childId of current.shapes ?? []) {
      const child = objects[childId];
      if (child) stack.push(child);
    }
  }

  let parent = objects[shape['parent-id']];
  while (parent) {
    if (mainInstanceQ(parent)) return true;
    parent = objects[parent['parent-id']];
  }
  return false;
}

export function containersSeq(fileData) {
  const pages = pagesSeq(fileData).map((p) => makeContainer(p, 'page'));
  const comps = componentsSeq(fileData).map((c) => makeContainer(c, 'component'));
  return [...pages, ...comps];
}

export function objectContainersSeq(fileData) {
  const pages = pagesSeq(fileData).map((p) => makeContainer(p, 'page'));
  const deletedComps = deletedComponentsSeq(fileData).map((c) => makeContainer(c, 'component'));
  return [...pages, ...deletedComps];
}