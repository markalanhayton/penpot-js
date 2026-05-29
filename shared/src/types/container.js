import { seek, indexBy, withoutKeys } from '../data.js';
import { next, zero } from '../uuid.js';
import { instanceRootQ, instanceHeadQ, mainInstanceQ, inComponentCopyQ, isVariantContainerQ, isVariantQ, SWAP_KEEP_ATTRS } from './component.js';
import { getPage, pagesSeq } from './pages_list.js';
import { componentsSeq, deletedComponentsSeq, getComponent as getComponentById } from './components_list.js';
import { getChildrenIdsWithSelf, getParentsWithSelf, componentsNestingLoopQ, frameShapeQ, generateUniqueName } from '../files/helpers.js';
import { anyLayoutQ, gridLayoutQ, autoWidthQ, autoHeightQ } from './shape/layout.js';
import { getFrameIdByPosition } from './shape_tree.js';
import { point, subtract as pointSubtract } from '../geom/point.js';
import { move as shapeMove } from '../geom/shapes/shapes.js';

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

export function getNestingLevelDelta(objects, shape, newParent) {
  const origHeads = getParentCopyHeads(objects, shape)
    .filter((h) => h.id !== shape.id);
  const destHeads = getParentCopyHeads(objects, newParent);

  let commonCount = 0;
  const len = Math.min(origHeads.length, destHeads.length);
  for (let i = 0; i < len; i++) {
    if (origHeads[i].id === destHeads[i].id) {
      commonCount++;
    } else {
      break;
    }
  }

  return origHeads.length - commonCount;
}

export function convertShapeInComponent(root, objects, fileId) {
  const newId = next();
  const insideComponent = getInstanceRoot(objects, root) != null;
  let newRoot = {
    ...root,
    'component-id': newId,
    'component-file': fileId,
    'main-instance': true,
  };
  if (!insideComponent) {
    newRoot['component-root'] = true;
  }
  const children = getChildrenIdsWithSelf(objects, root.id)
    .map((id) => objects[id])
    .filter(Boolean);

  const newChildren = children
    .filter((c) => c.id !== root.id)
    .map((c) => {
      const result = { ...c };
      delete result['component-root'];
      return result;
    });

  const newRootWithId = { ...newRoot, id: newId };
  const allNewShapes = [newRootWithId, ...newChildren];
  return [newRootWithId, allNewShapes];
}

export function removeSwapKeepAttrs(shape) {
  const layoutItemHSizing = (anyLayoutQ(shape) && autoWidthQ(shape)) ? 'auto' : undefined;
  const layoutItemVSizing = (anyLayoutQ(shape) && autoHeightQ(shape)) ? 'auto' : undefined;

  let result = withoutKeys(shape, SWAP_KEEP_ATTRS);
  if (layoutItemHSizing != null) {
    result = { ...result, 'layout-item-h-sizing': layoutItemHSizing };
  }
  if (layoutItemVSizing != null) {
    result = { ...result, 'layout-item-v-sizing': layoutItemVSizing };
  }
  return result;
}

export function makeComponentInstance(page, component, libraryData, position, options) {
  const {
    mainInstance = false,
    forceId,
    forceFrameId,
    keepIds = false,
    forceParentId,
  } = options ?? {};

  const componentPage = getPage(libraryData, component['main-instance-page']);
  const componentShape = {
    ...getShape(componentPage, component['main-instance-id']),
    'parent-id': null,
    'frame-id': zero,
  };
  const cleanedShape = removeSwapKeepAttrs(componentShape);

  const origPos = point(cleanedShape.x ?? 0, cleanedShape.y ?? 0);
  const delta = pointSubtract(position, origPos);

  const objects = page.objects ?? {};
  const unames = new Set(Object.values(objects).map((s) => s.name).filter(Boolean));

  const componentChildren = indexBy(
    getChildrenIdsWithSelf(objects, cleanedShape.id).map((id) => objects[id]).filter(Boolean),
    (s) => s.id
  );

  const frameId = forceParentId ?? forceFrameId ?? getFrameIdByPosition(
    objects,
    point(origPos.x + delta.x, origPos.y + delta.y),
    { skipComponents: true, bottomFrames: true, validator: (s) => componentChildren[s.id] == null && !inComponentCopyQ(s) }
  ) ?? zero;

  const idsMap = {};

  function updateNewShape(newShape, originalShape) {
    const newShapeName = newShape.name;
    const originalIsRoot = instanceRootQ(originalShape);

    if (originalIsRoot) {
      const uniqueName = generateUniqueName(newShapeName, unames);
      unames.add(uniqueName);
    }

    idsMap[originalShape.id] = newShape.id;

    let result = shapeMove(newShape, delta);
    delete result.touched;
    delete result['variant-id'];
    delete result['variant-name'];

    if (mainInstance && originalIsRoot) {
      result = { ...result, 'main-instance': true };
    } else {
      delete result['main-instance'];
    }

    if (mainInstance) {
      delete result['shape-ref'];
    } else {
      result = { ...result, 'shape-ref': originalShape.id };
    }

    if (originalShape['parent-id'] == null) {
      result = {
        ...result,
        'component-id': component.id,
        'component-file': libraryData.id ?? libraryData['file-id'],
        'component-root': true,
        name: originalIsRoot ? generateUniqueName(newShapeName, unames) : newShapeName,
      };
    } else {
      delete result['component-root'];
    }

    return result;
  }

  const [newShape, newShapes] = cloneShapeHelper(cleanedShape, frameId, componentPage.objects, {
    updateNewShape,
    forceId,
    keepIds,
    frameId,
    destObjects: objects,
  });

  function remapIds(shape) {
    let result = { ...shape };
    result['parent-id'] = result['parent-id'] ?? result['frame-id'];
    if (gridLayoutQ(result) && result['grid-cell-ids']) {
      const remapped = {};
      for (const [k, v] of Object.entries(result['grid-cell-ids'])) {
        remapped[idsMap[k] ?? k] = idsMap[v] ?? v;
      }
      result = { ...result, 'grid-cell-ids': remapped };
    }
    return result;
  }

  return [remapIds(newShape), newShapes.map(remapIds)];
}

// Simplified clone for makeComponentInstance.
// Differs from shape_tree.cloneShape: no updateOriginalShape callback,
// no _oldId tracking, no bool-content/grid-cell-ids remapping (handled
// separately in makeComponentInstance via remapIds).
function cloneShapeHelper(shape, parentId, objects, options) {
  const { updateNewShape, forceId, keepIds, frameId, destObjects } = options;
  const effectiveNewShapeFn = typeof updateNewShape === 'function' ? updateNewShape : (s) => s;

  const newId = forceId != null ? forceId : keepIds ? shape.id : next();
  let effectiveFrameId = frameId;
  if (effectiveFrameId == null) {
    const parent = (destObjects ?? objects)[parentId];
    if (parent && parent.type === 'frame') {
      effectiveFrameId = parentId;
    } else {
      effectiveFrameId = parent?.['frame-id'] ?? zero;
    }
  }

  let newDirectChildren = [];
  let newAllShapes = [];

  const childIds = shape.shapes ? [...shape.shapes] : [];
  for (const childId of childIds) {
    const child = objects[childId];
    if (child == null) continue;
    const childFrameId = shape.type === 'frame' ? newId : effectiveFrameId;
    const [newChild, newChildShapes] = cloneShapeHelper(child, newId, objects, {
      updateNewShape: effectiveNewShapeFn,
      forceId: null,
      keepIds,
      frameId: childFrameId,
      destObjects,
    });
    newDirectChildren = [...newDirectChildren, newChild];
    newAllShapes = [...newAllShapes, ...newChildShapes];
  }

  let newShape = {
    ...shape,
    id: newId,
    'parent-id': parentId,
    'frame-id': effectiveFrameId,
  };
  if (shape.shapes) {
    newShape = { ...newShape, shapes: newDirectChildren.map((c) => c.id) };
  }

  newShape = effectiveNewShapeFn(newShape, shape);
  const allShapes = [newShape, ...newAllShapes];
  return [newShape, allShapes];
}

export function collectMainShapes(shape, objects) {
  if (mainInstanceQ(shape)) return [shape];
  const children = (shape.shapes ?? []).map((id) => objects[id]).filter(Boolean);
  if (children.length === 0) return [];
  return children.flatMap((child) => collectMainShapes(child, objects));
}

export function getComponentFromShape(shape, libraries) {
  const library = libraries[shape['component-file']];
  if (!library) return undefined;
  return library?.data?.components?.[shape['component-id']];
}

export function invalidStructureForComponentQ(objects, parent, children, pasting, libraries) {
  const mergedObjects = {
    ...objects,
    ...Object.fromEntries(children.map((c) => [c.id, c])),
  };

  function removeQ(shape) {
    const component = getComponentFromShape(shape, libraries);
    return component && !component.deleted;
  }

  const selectedComponents = collectMainShapesHelper(children, mergedObjects)
    .filter((s) => !(pasting && removeQ(s)));

  const selectedMainInstanceQ = selectedComponents.length > 0;
  const parentInComponentQ = inAnyComponentQ(mergedObjects, parent);

  const ascendants = getParentsWithSelf(mergedObjects, parent.id).filter(Boolean);
  const compsNestingLoop = children.some(
    () => componentsNestingLoopQ(children, ascendants)
  );

  return (
    inComponentCopyQ(parent) ||
    hasAnyCopyParentQ(mergedObjects, parent) ||
    (selectedMainInstanceQ && parentInComponentQ) ||
    compsNestingLoop
  );
}

function collectMainShapesHelper(children, objects) {
  const result = [];
  for (const child of children) {
    if (mainInstanceQ(child)) {
      result.push(child);
    } else {
      const childChildren = (child.shapes ?? []).map((id) => objects[id]).filter(Boolean);
      result.push(...collectMainShapesHelper(childChildren, objects));
    }
  }
  return result;
}

export function parentValidationCache(objects, children, libraries) {
  const childrenIds = new Set(children.map((c) => c.id));
  const topChildren = children.filter((c) => !childrenIds.has(c['parent-id']));
  const allMainQ = topChildren.every((c) => mainInstanceQ(c));

  function getVariantId(shape) {
    if (!shape['component-id']) return undefined;
    const component = getComponentFromShape(shape, libraries);
    return component?.['variant-id'];
  }

  const descendants = [];
  for (const child of children) {
    descendants.push(...getChildrenIdsWithSelf(objects, child.id).map((id) => objects[id]).filter(Boolean));
  }

  const anyVariantContainerDescendant = descendants.some((d) => isVariantContainerQ(d));
  const descendantsVariantIdsSet = new Set(descendants.map(getVariantId).filter(Boolean));
  const anyMainDescendant = children.some(
    (shape) => getChildrenIdsWithSelf(objects, shape.id).some((id) => mainInstanceQ(objects[id]))
  );

  return {
    topChildren,
    allMainQ,
    descendants,
    anyVariantContainerDescendant,
    descendantsVariantIdsSet,
    anyMainDescendant,
  };
}

export function findValidParentAndFrameIds(parentId, objects, children, pasting, libraries, cache) {
  const effectiveCache = cache ?? parentValidationCache(objects, children, libraries);

  function getFrame(pid) {
    if (frameShapeQ(objects, pid)) return pid;
    return objects[pid]?.['frame-id'];
  }

  const { topChildren, allMainQ, anyVariantContainerDescendant, descendantsVariantIdsSet, anyMainDescendant } = effectiveCache;

  let currentParentId = parentId;
  const visited = new Set();

  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parent = objects[currentParentId];
    if (!parent) break;

    const noChanges = topChildren.every((c) => c['parent-id'] === currentParentId) && !pasting;

    if (noChanges) {
      return [currentParentId, getFrame(currentParentId)];
    }

    const ascendants = getParentsWithSelf(objects, currentParentId).filter(Boolean);
    const anyMainAscendant = ascendants.some((s) => mainInstanceQ(s));
    const anyVariantContainerAscendant = ascendants.some((s) => isVariantContainerQ(s));

    const structureInvalid = invalidStructureForComponentQ(objects, parent, children, pasting, libraries);
    const mainDescendantOk = pasting || !mainInstanceQ(parent) || !anyMainDescendant;
    const variantOk = (!anyVariantContainerAscendant && !anyMainAscendant) || !anyVariantContainerDescendant;
    const variantParentOk = !isVariantContainerQ(parent) || allMainQ;
    const variantBrotherOk = !pasting || !isVariantQ(parent) || !descendantsVariantIdsSet.has(parent['variant-id']);

    if (!structureInvalid && mainDescendantOk && variantOk && variantParentOk && variantBrotherOk) {
      return [currentParentId, getFrame(currentParentId)];
    }

    currentParentId = parent['parent-id'];
  }

  return [null, null];
}

export function hasAnyMainQ(objects, shape) {
  const children = getChildrenIdsWithSelf(objects, shape.id)
    .map((id) => objects[id])
    .filter(Boolean);
  const parents = getParentsWithSelf(objects, shape.id).filter(Boolean);
  return children.some(mainInstanceQ) || parents.some(mainInstanceQ);
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