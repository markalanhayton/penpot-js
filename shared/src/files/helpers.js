import * as d from '../data.js';
import * as gco from '../geom/shapes/common.js';
import * as uuid from '../uuid.js';

export function rootQ(shape) {
  return shape?.type === 'frame' && shape?.id === uuid.zero;
}

export function isDirectChildOfRootQ(objectsOrShape, id) {
  const shape = id !== undefined ? objectsOrShape[id] : objectsOrShape;
  return shape != null && (shape.frameId ?? shape['frame-id']) === uuid.zero;
}

export function rootFrameQ(objectsOrShape, id) {
  if (id !== undefined) {
    if (id === uuid.zero) return false;
    return rootFrameQ(objectsOrShape[id]);
  }
  const shape = objectsOrShape;
  return shape != null && shape.id !== uuid.zero && shape.type === 'frame' && (shape.frameId ?? shape['frame-id']) === uuid.zero;
}

export function frameShapeQ(objectsOrShape, id) {
  const shape = id !== undefined ? objectsOrShape[id] : objectsOrShape;
  return shape != null && shape.type === 'frame';
}

export function groupShapeQ(objectsOrShape, id) {
  const shape = id !== undefined ? objectsOrShape[id] : objectsOrShape;
  return shape != null && shape.type === 'group';
}

export function maskShapeQ(shape) {
  return groupShapeQ(shape) && !!(shape.maskedGroup ?? shape['masked-group']);
}

export function boolShapeQ(shape) {
  return shape != null && shape.type === 'bool';
}

export function textShapeQ(objectsOrShape, id) {
  const shape = id !== undefined ? objectsOrShape[id] : objectsOrShape;
  return shape != null && shape.type === 'text';
}

export function rectShapeQ(shape) {
  return shape != null && shape.type === 'rect';
}

export function circleShapeQ(shape) {
  return shape?.type === 'circle';
}

export function imageShapeQ(shape) {
  return shape != null && shape.type === 'image';
}

export function svgRawShapeQ(objectsOrShape, id) {
  const shape = id !== undefined ? objectsOrShape[id] : objectsOrShape;
  return shape != null && shape.type === 'svg-raw';
}

export function pathShapeQ(objectsOrShape, id) {
  const shape = id !== undefined ? objectsOrShape[id] : objectsOrShape;
  return shape != null && shape.type === 'path';
}

export function unframedShapeQ(shape) {
  return shape != null && !frameShapeQ(shape) && (shape.frameId ?? shape['frame-id']) === uuid.zero;
}

export function hasChildrenQ(objectsOrShape, id) {
  const shape = id !== undefined ? objectsOrShape[id] : objectsOrShape;
  return d.notEmpty(shape?.shapes);
}

export function hasLayoutQ(objects, id) {
  const shape = objects[id];
  return !!(shape && shape.layout);
}

export function groupLikeShapeQ(objectsOrShape, id) {
  const shape = id !== undefined ? objectsOrShape[id] : objectsOrShape;
  return groupShapeQ(shape) || boolShapeQ(shape) || (svgRawShapeQ(shape) && hasChildrenQ(shape));
}

export function getSelectedType(objects, selected) {
  if (selected.length === 1) {
    return objects[selected[0]]?.type;
  }
  return 'multiple';
}

export function getShapeType(objects, id) {
  const shape = objects[id];
  if (rootQ(shape)) return 'root';
  return shape?.type;
}

export function getChildrenIds(objects, id, opts) {
  const { ignoreChildrenFn } = opts || {};

  function getChildrenIdsRec(currentId, processed) {
    if (processed.has(currentId)) return [];
    const shape = objects[currentId];
    let childIds = shape?.shapes || [];
    if (ignoreChildrenFn) {
      childIds = childIds.filter(cid => !ignoreChildrenFn(objects[cid]));
    }
    const result = [...childIds];
    for (const cid of childIds) {
      result.push(...getChildrenIdsRec(cid, new Set([...processed, currentId])));
    }
    return result;
  }

  return getChildrenIdsRec(id, new Set());
}

export function getChildrenIdsWithSelf(objects, id) {
  return [id, ...getChildrenIds(objects, id)];
}

export function getChildren(objects, id) {
  return getChildrenIds(objects, id).map(cid => objects[cid]).filter(Boolean);
}

export function getChildrenWithSelf(objects, id) {
  return getChildrenIdsWithSelf(objects, id).map(cid => objects[cid]).filter(Boolean);
}

export function getChild(objects, id, childId) {
  const shape = objects[id];
  if (id === childId) return shape;
  for (const cid of (shape?.shapes || [])) {
    const result = getChild(objects, cid, childId);
    if (result) return result;
  }
  return undefined;
}

export function getParent(objects, id) {
  const shape = objects[id];
  if (!shape) return undefined;
  return objects[shape.parentId ?? shape['parent-id']];
}

export function getParentId(objects, id) {
  const shape = objects[id];
  if (!shape) return undefined;
  return shape.parentId ?? shape['parent-id'];
}

export function getParentIds(objects, shapeId) {
  const result = [];
  let current = shapeId;
  while (true) {
    const parentId = getParentId(objects, current);
    if (parentId == null || parentId === current) break;
    result.push(parentId);
    current = parentId;
  }
  return result;
}

export function getParentIdsSeq(objects, shapeId) {
  const parentId = getParentId(objects, shapeId);
  if (parentId == null || parentId === shapeId) return [];
  const rest = getParentIdsSeq(objects, parentId);
  return [parentId, ...rest];
}

export function getParentIdsSeqWithSelf(objects, shapeId) {
  return [shapeId, ...getParentIdsSeq(objects, shapeId)];
}

export function getParents(objects, shapeId) {
  const result = [];
  let current = shapeId;
  while (true) {
    const parentId = objects[current]?.parentId ?? objects[current]?.['parent-id'];
    if (parentId == null || parentId === current) break;
    result.push(objects[parentId]);
    current = parentId;
  }
  return result;
}

export function getParentSeq(objects, shapeOrId, shapeId) {
  if (shapeId === undefined) {
    const id = shapeOrId;
    const shape = objects[id];
    return getParentSeq(objects, shape, id);
  }
  const shape = shapeOrId;
  const parentId = shape?.parentId ?? shape?.['parent-id'];
  const parent = objects[parentId];
  if (parent == null || parentId === shapeId) return [];
  return [parent, ...getParentSeq(objects, parent, parentId)];
}

export function getParentsWithSelf(objects, id) {
  const lookup = d.getf(objects);
  return [lookup(id), ...getParentIds(objects, id).map(lookup)];
}

export function hiddenParentQ(objects, shapeId) {
  let parentId = getParentId(objects, shapeId);
  let currentId = shapeId;
  while (parentId != null && currentId !== uuid.zero && parentId !== uuid.zero) {
    if (objects[parentId]?.hidden) return true;
    currentId = parentId;
    parentId = getParentId(objects, currentId);
  }
  return false;
}

export function getParentIdsWithIndex(objects, shapeId) {
  const parentList = [];
  const parentIndices = {};
  let current = shapeId;
  while (true) {
    const parentId = getParentId(objects, current);
    const parent = objects[parentId];
    if (parent == null || parentId === current) break;
    parentList.push(parentId);
    parentIndices[parentId] = (parent.shapes || []).indexOf(current);
    current = parentId;
  }
  return [parentList, parentIndices];
}

export function getSiblingsIds(objects, id) {
  const parent = getParent(objects, id);
  return (parent?.shapes || []).filter(sid => sid !== id);
}

export function getFrame(objects, shapeOrId) {
  if (shapeOrId === undefined) return objects[uuid.zero];
  if (typeof shapeOrId === 'object' && shapeOrId !== null) {
    if (frameShapeQ(shapeOrId)) return shapeOrId;
    return objects[shapeOrId.frameId ?? shapeOrId['frame-id']];
  }
  if (shapeOrId === uuid.zero) return objects[uuid.zero];
  const shape = objects[shapeOrId];
  return getFrame(objects, shape);
}

export function getRootFrame(objects, shapeId) {
  let frameId;
  if (frameShapeQ(objects, shapeId)) {
    frameId = shapeId;
  } else {
    frameId = objects[shapeId]?.frameId ?? objects[shapeId]?.['frame-id'];
  }
  const frame = objects[frameId];
  if (rootQ(frame) || !frame) return undefined;
  if (rootFrameQ(frame)) return frame;
  return getRootFrame(objects, frame.frameId ?? frame['frame-id']);
}

export function getParentFrame(objects, shapeOrId) {
  if (typeof shapeOrId === 'object' && shapeOrId !== null) {
    return objects[shapeOrId.frameId ?? shapeOrId['frame-id']];
  }
  if (shapeOrId === uuid.zero) return objects[uuid.zero];
  const shape = objects[shapeOrId];
  return getFrame(objects, shape);
}

export function validFrameTargetQ(objects, parentId, shapeId) {
  const shape = objects[shapeId];
  return !frameShapeQ(shape) || parentId === uuid.zero;
}

export function getPositionOnParent(objects, id) {
  const obj = objects[id];
  const pid = obj?.parentId ?? obj?.['parent-id'];
  const prt = objects[pid];
  return (prt?.shapes || []).indexOf(id);
}

export function getPrevSibling(objects, id) {
  const obj = objects[id];
  const pid = obj?.parentId ?? obj?.['parent-id'];
  const prt = objects[pid];
  const shapes = prt?.shapes || [];
  const pos = shapes.indexOf(id);
  if (pos != null && pos > 0) return shapes[pos - 1];
  return undefined;
}

export function getImmediateChildren(objects, shapeId, opts) {
  if (shapeId === undefined) shapeId = uuid.zero;
  const { removeHidden = false, removeBlocked = false } = opts || {};
  const lookup = d.getf(objects);
  const shape = lookup(shapeId);
  const childIds = shape?.shapes || [];
  return childIds
    .map(cid => lookup(cid))
    .filter(child => child != null)
    .filter(child => !(removeHidden && child.hidden))
    .filter(child => !(removeBlocked && child.blocked))
    .filter(child => !gco.invalidGeometryQ(child));
}

export function isParentQ(objects, shapeId, parentCandidate) {
  let currentId = shapeId;
  while (true) {
    if (currentId === parentCandidate) return true;
    if (currentId == null || currentId === uuid.zero) return false;
    const parentId = objects[currentId]?.parentId ?? objects[currentId]?.['parent-id'];
    if (parentId === currentId) return false;
    currentId = parentId;
  }
}

export function makeContainer(pageOrComponent, type) {
  return { ...pageOrComponent, type };
}

export function pageQ(container) {
  return container?.type === 'page';
}

export function componentQ(container) {
  return container?.type === 'component';
}

export function componentTouchedQ(objects, rootId) {
  const children = getChildrenWithSelf(objects, rootId);
  return children.some(c => c.touched && Object.keys(c.touched).length > 0) || false;
}

export function componentsNestingLoopQ(objectsOrChildren, shapeIdOrParents, parentId) {
  let children, parents;
  if (parentId !== undefined) {
    children = getChildrenWithSelf(objectsOrChildren, shapeIdOrParents);
    parents = getParentsWithSelf(objectsOrChildren, parentId);
  } else {
    children = objectsOrChildren;
    parents = shapeIdOrParents;
  }
  const childComponents = new Set(children.filter(c => c.componentId ?? c['component-id']).map(c => c.componentId ?? c['component-id']));
  const parentComponents = new Set(parents.filter(p => p.componentId ?? p['component-id']).map(p => p.componentId ?? p['component-id']));
  for (const id of childComponents) {
    if (parentComponents.has(id)) return true;
  }
  return false;
}

export function getUsedNames(elements) {
  const items = Array.isArray(elements) ? elements : Object.values(elements);
  return new Set(items.map(e => e.name).filter(Boolean));
}

export function generateUniqueName(baseName, existingNames, opts) {
  const { suffixFn, immediateSuffix, suffix } = opts || {};
  const effectiveSuffixFn = suffixFn ||
    (suffix
      ? (copyCount) => `-${suffix}${copyCount > 1 ? `-${copyCount}` : ''}`
      : (copyCount) => ` ${copyCount}`);

  const existingNameSet = new Set(existingNames);
  if (immediateSuffix) existingNameSet.add(baseName);

  if (!existingNameSet.has(baseName)) return baseName;
  let i = 1;
  while (true) {
    const name = baseName + effectiveSuffixFn(i);
    if (!existingNameSet.has(name)) return name;
    i++;
    if (i > 10000) return baseName;
  }
}

export function walkPages(f, data) {
  const pagesIndex = data.pagesIndex ?? data['pages-index'] ?? {};
  const updated = {};
  for (const [pageId, page] of Object.entries(pagesIndex)) {
    updated[pageId] = f(pageId, page);
  }
  return { ...data, pagesIndex: updated, ['pages-index']: updated };
}

export function updateObjectList(page, objectsList) {
  const objects = { ...(page.objects || {}) };
  for (const obj of objectsList) {
    objects[obj.id] = obj;
  }
  return { ...page, objects };
}

export function appendAtTheEnd(prevIds, ids) {
  const result = [...prevIds];
  for (const id of ids) {
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

export function cleanLoops(objects, ids) {
  if (ids.length <= 1) return [...ids];
  const idsSet = new Set(ids);
  const parentSelectedQ = (id) => getParentIds(objects, id).some(pid => idsSet.has(pid));
  return ids.filter(id => !parentSelectedQ(id));
}

function indexedShapes(objects, selected) {
  const selectedSet = new Set(selected);
  const result = [];
  let index = 1;
  let addQ = false;
  let pending = new Set(selected);
  let stack = [...(objects[uuid.zero]?.shapes || [])].reverse();

  while (pending.size > 0 && stack.length > 0) {
    const shapeId = stack[0];
    stack = stack.slice(1);
    if (!selectedSet.has(shapeId)) {
      addQ = addQ || selectedSet.has(shapeId);
    } else {
      addQ = true;
    }
    pending.delete(shapeId);

    if (addQ) {
      result.push([index, shapeId]);
    }
    index++;

    const shape = objects[shapeId];
    if (shape?.shapes) {
      stack = [...shape.shapes.slice().reverse(), ...stack];
    }
  }
  return result;
}

export function expandRegionSelection(objects, selection) {
  const selectionSet = new Set(selection);
  const indexed = indexedShapes(objects, selectionSet);
  if (indexed.length === 0) return new Set();
  const indexes = indexed.map(([idx]) => idx);
  const from = Math.min(...indexes);
  const to = Math.max(...indexes);
  return new Set(indexed.filter(([idx]) => idx >= from && idx <= to).map(([, id]) => id));
}

export function orderByIndexedShapes(objects, selected) {
  const selectedSet = new Set(selected);
  const indexed = indexedShapes(objects, selectedSet);
  return indexed.map(([, id]) => id);
}

export function getIndexReplacement(shapes, objects) {
  const ordered = orderByIndexedShapes(objects, shapes);
  if (ordered.length === 0) return 0;
  return getPositionOnParent(objects, ordered[0]) + 1;
}

export function collectShapeMediaRefs(shape) {
  const refs = [];
  if (shape['fill-image']?.id) refs.push(shape['fill-image'].id);
  if (shape.metadata?.id) refs.push(shape.metadata.id);
  for (const fill of (shape.fills || [])) {
    if (fill['fill-image']?.id) refs.push(fill['fill-image'].id);
  }
  for (const stroke of (shape.strokes || [])) {
    if (stroke['stroke-image']?.id) refs.push(stroke['stroke-image'].id);
  }
  if (shape.content) {
    const stack = Array.isArray(shape.content) ? [...shape.content] : [];
    while (stack.length > 0) {
      const node = stack.pop();
      if (node && typeof node === 'object') {
        for (const fill of (node.fills || [])) {
          if (fill['fill-image']?.id) refs.push(fill['fill-image'].id);
        }
        if (node.children) stack.push(...node.children);
      }
    }
  }
  return refs;
}

export function collectUsedMedia(data) {
  const pagesIndex = data.pagesIndex ?? data['pages-index'] ?? {};
  const components = data.components ?? {};
  const media = data.media ?? {};
  const result = new Set();

  for (const page of Object.values(pagesIndex)) {
    for (const shape of Object.values(page.objects || {})) {
      for (const ref of collectShapeMediaRefs(shape)) {
        result.add(ref);
      }
    }
  }
  for (const comp of Object.values(components)) {
    for (const shape of Object.values(comp.objects || {})) {
      for (const ref of collectShapeMediaRefs(shape)) {
        result.add(ref);
      }
    }
  }
  for (const id of Object.keys(media)) {
    result.add(id);
  }
  return result;
}

export function relinkRefs(data, lookupIndex) {
  function processForm(form) {
    if (form == null || typeof form !== 'object' || Array.isArray(form)) return form;

    let result = { ...form };

    if (result.metadata && typeof result.metadata === 'object' && result.type === 'image') {
      if (result.metadata.id) result.metadata = { ...result.metadata, id: lookupIndex(result.metadata.id) };
    }

    if (result['fill-image'] && typeof result['fill-image'] === 'object') {
      if (result['fill-image'].id) result['fill-image'] = { ...result['fill-image'], id: lookupIndex(result['fill-image'].id) };
    }

    if (result['stroke-image'] && typeof result['stroke-image'] === 'object') {
      if (result['stroke-image'].id) result['stroke-image'] = { ...result['stroke-image'], id: lookupIndex(result['stroke-image'].id) };
    }

    if (uuid.isValid(result['fill-color-ref-file'])) {
      result['fill-color-ref-file'] = lookupIndex(result['fill-color-ref-file']);
    }

    if (uuid.isValid(result['stroke-color-ref-file'])) {
      result['stroke-color-ref-file'] = lookupIndex(result['stroke-color-ref-file']);
    }

    if (uuid.isValid(result['typography-ref-file'])) {
      result['typography-ref-file'] = lookupIndex(result['typography-ref-file']);
    }

    if (uuid.isValid(result['component-file'])) {
      result['component-file'] = lookupIndex(result['component-file']);
    }

    if (uuid.isValid(result['file-id'])) {
      result['file-id'] = lookupIndex(result['file-id']);
    }

    for (const key of Object.keys(result)) {
      if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
        result[key] = processForm(result[key]);
      } else if (Array.isArray(result[key])) {
        result[key] = result[key].map(item => processForm(item));
      }
    }

    return result;
  }

  return processForm(data);
}

export function getFrameObjects(objects, frameId) {
  const ids = [frameId, ...getChildrenIds(objects, frameId)];
  const result = {};
  for (const id of ids) {
    if (objects[id]) result[id] = objects[id];
  }
  return result;
}

export function objectsByFrame(objects) {
  const result = {};
  for (const [id, shape] of Object.entries(objects)) {
    const frameId = shape.type === 'frame' ? id : (shape.frameId ?? shape['frame-id']);
    if (!result[frameId]) result[frameId] = {};
    result[frameId][id] = shape;
  }
  return result;
}

export function selectedSubtree(objects, selected) {
  const selectedSet = new Set(selected);
  for (const id of selected) {
    for (const pid of getParentIds(objects, id)) {
      selectedSet.add(pid);
    }
  }

  const result = {};
  for (const id of selectedSet) {
    if (objects[id]) {
      result[id] = {
        ...objects[id],
        shapes: (objects[id].shapes || []).filter(sid => selectedSet.has(sid)),
      };
    }
  }
  return result;
}

export function isChildQ(objects, parentId, candidateChildId) {
  let curId = candidateChildId;
  while (true) {
    const curParentId = objects[curId]?.parentId ?? objects[curId]?.['parent-id'];
    if (parentId === curParentId) return true;
    if (curParentId === uuid.zero || curParentId == null) return false;
    curId = curParentId;
  }
}

export function reduceObjects(objects, checkChildrenQ, rootId, reducerFn, initVal) {
  if (typeof rootId === 'function') {
    return reduceObjects(objects, undefined, uuid.zero, checkChildrenQ, rootId);
  }
  if (typeof checkChildrenQ === 'function' && rootId === undefined) {
    return reduceObjects(objects, undefined, uuid.zero, checkChildrenQ, reducerFn);
  }
  if (checkChildrenQ === undefined) checkChildrenQ = null;
  if (rootId === undefined) rootId = uuid.zero;

  const rootChildren = objects[rootId]?.shapes || [];
  if (rootChildren.length === 0) return initVal;

  let currentVal = initVal;
  let stack = [...rootChildren];
  const processed = new Set();

  while (stack.length > 0) {
    const currentId = stack.shift();
    if (processed.has(currentId)) continue;
    processed.add(currentId);

    const currentShape = objects[currentId];
    if (!currentShape) continue;

    currentVal = reducerFn(currentVal, currentShape);

    if (checkChildrenQ === null || checkChildrenQ(currentShape)) {
      const childShapes = currentShape.shapes || [];
      stack = [...childShapes, ...stack];
    }
  }

  return currentVal;
}

export function selectedWithChildren(objects, selected) {
  const result = new Set(selected);
  for (const id of selected) {
    for (const cid of getChildrenIds(objects, id)) {
      result.add(cid);
    }
  }
  return result;
}

export function getShapeIdRootFrame(objects, shapeId) {
  const ids = [shapeId, ...getParentIds(objects, shapeId)];
  for (const id of ids) {
    const shape = objects[id];
    if (rootFrameQ(shape)) return shape.id;
  }
  return undefined;
}

export function commonParentFrame(objects, selected) {
  if (!selected || selected.length === 0) return undefined;
  let frameId = objects[selected[0]]?.frameId ?? objects[selected[0]]?.['frame-id'];
  let frameParents = getParentIds(objects, frameId);

  for (let i = 1; i < selected.length; i++) {
    const current = selected[i];
    const parentIds = new Set(getParentIds(objects, current));
    if (parentIds.has(frameId)) {
      frameParents = getParentIds(objects, frameId);
    } else {
      frameId = frameParents.find(fid => parentIds.has(fid));
      frameParents = getParentIds(objects, frameId);
    }
  }
  return frameId;
}

export function fixedScrollQ(shape) {
  return !!(shape['fixed-scroll'] && shape.parentId === shape.frameId && shape.frameId !== uuid.zero);
}

export function fixedQ(objects, shapeId) {
  const idsToCheck = [
    shapeId,
    ...getChildrenIds(objects, shapeId),
    ...getParentIds(objects, shapeId).filter(id => id !== uuid.zero && !rootFrameQ(objects, id)),
  ];
  return idsToCheck.some(id => objects[id] && fixedScrollQ(objects[id]));
}