import { isVariantContainerQ, isVariantQ, getSwapSlot, removeSwapSlot, setSwapSlot } from '../types/component.js';
import { propertiesToName, mergeProperties, addNewProps, removePrefix, pathToProperties, VALUE_PREFIX } from '../types/variant.js';
import { splitGroupName, mergePathItem } from '../path_names.js';
import * as pcb from '../files/changes_builder.js';
import * as cll from './libraries.js';
import * as cls from './shapes.js';
import * as clvp from './variant_properties.js';
import * as cfh from '../files/helpers.js';
import * as cfv from '../files/variant.js';
import * as ctn from '../types/container.js';
import { zero as uuidZero } from '../uuid.js';
import { getIn, indexOf } from '../data.js';
import { findRefShape as findRefShapeImpl, findRemoteShape as findRemoteShapeImpl, getTouchedFromRefChainUntilTargetRef as getTouchedImpl, findRefIdForSwapped as findRefIdForSwappedImpl } from '../types/file.js';

export const SHAPE_TYPE_CLASSIFICATION = {
  frame: 'container',
  group: 'container',
  rect: 'shape',
  circle: 'shape',
  bool: 'shape',
  path: 'shape',
};

export function generateAddNewVariant(changes, shape, variantId, newComponentId, newShapeId, propNum) {
  const data = pcb.getLibraryData(changes);
  const objects = pcb.getObjects(changes);
  const componentId = shape['component-id'];

  const propsValues = cfv.extractPropertiesValues(data, objects, variantId);
  const lastProp = propsValues[propsValues.length - 1];
  const value = VALUE_PREFIX + (lastProp ? lastProp.value.length + 1 : 1);

  const [newShape, updatedChanges] = cll.generateDuplicateComponent(
    changes,
    { data },
    componentId,
    newComponentId,
    { 'new-shape-id': newShapeId, 'apply-changes-local-library?': true }
  );

  let result = updatedChanges;
  if (propNum >= 0) {
    result = clvp.generateUpdatePropertyValue(result, newComponentId, propNum, value);
  }
  result = pcb.changeParent(result, shape['parent-id'], [newShape], 0);

  return result;
}

function generatePath(path, objects, baseId, shape) {
  const getType = (type) => SHAPE_TYPE_CLASSIFICATION[type] || type;
  if (baseId === shape.id) return path;
  return generatePath(
    path + " " + shape.name + getType(shape.type),
    objects,
    baseId,
    objects[shape['parent-id']]
  );
}

function addUniquePath(shapes, objects, baseId) {
  const counts = {};
  const result = [];
  for (const shape of shapes) {
    const path = generatePath("", objects, baseId, shape);
    const num = counts[path] ?? 1;
    counts[path] = num + 1;
    result.push({ ...shape, 'shape-path': `${path}-${num}` });
  }
  return result;
}

function keepSwappedItem(changes, relatedShapeInNew, origSwappedChild, ldata, page, swapRefId) {
  const beforeChanges = pcb.emptyChanges();
  const bc = pcb.withPage(beforeChanges, page);
  const bcWithObj = pcb.withObjects(bc, page.objects);
  const beforeResult = pcb.changeParent(bcWithObj, uuidZero, [origSwappedChild], 0, { 'allow-altering-copies': true });

  const objects = pcb.getObjects(changes);
  const prevSwapSlot = getSwapSlot(origSwappedChild);
  const currentParent = objects?.[relatedShapeInNew['parent-id']];
  const pos = indexOf(currentParent?.shapes, relatedShapeInNew.id);

  let result = pcb.concatChanges(beforeResult, changes);

  result = pcb.changeParent(result, relatedShapeInNew['parent-id'], [origSwappedChild], pos, { 'allow-altering-copies': true });

  if (prevSwapSlot === swapRefId) {
    result = pcb.updateShapes(result, [origSwappedChild.id], (s) =>
      setSwapSlot(removeSwapSlot(s), relatedShapeInNew['shape-ref'])
    );
  }

  const [_, deleteResult] = cls.generateDeleteShapes(result, ldata, page, objects, new Set([relatedShapeInNew.id]), { 'allow-altering-copies': true });
  return deleteResult;
}

function childOfSwappedQ(shape, objects, baseParentId) {
  const ancestors = cfh.getParentHeads(objects, shape);
  const filtered = ancestors.filter((a) => a.id !== baseParentId);
  if (filtered.length === 0) return false;

  const startIndex = ancestors.findIndex((a) => a.id === baseParentId);
  if (startIndex === -1) return false;

  const relevant = ancestors.slice(startIndex + 1, -1);
  return relevant.some((a) => getSwapSlot(a) != null);
}

function findShapeRefChildOf(container, libraries, shape, parentId) {
  const refShape = findRefShape(null, container, libraries, shape, true);
  if (!refShape) return null;

  const refContainer = refShape?._containerCtx ?? null;
  const refObjects = refContainer?.objects ?? {};
  const refParents = cfh.getParentsWithSelf(refObjects, refShape.id);
  const parentSet = new Set(refParents.map((s) => s.id));

  if (parentSet.has(parentId)) return refShape;
  if (refContainer) return findShapeRefChildOf(refContainer, libraries, refShape, parentId);
  return null;
}

function addTouchedFromRefChain(container, libraries, shape) {
  const newTouched = getTouchedFromRefChainUntilTargetRef(container, libraries, shape, null);
  return { ...shape, touched: newTouched };
}

function findRefShape(file, container, libraries, shape, withContextQ) {
  return findRefShapeImpl(file, container, libraries, shape, { includeDeleted: false, withContext: withContextQ });
}

function findRemoteShape(container, libraries, shape, opts) {
  const withContext = opts?.['with-context?'] ?? opts?.withContext ?? false;
  return findRemoteShapeImpl(container, libraries, shape, { withContext });
}

function getTouchedFromRefChainUntilTargetRef(container, libraries, shape, targetRefId) {
  return getTouchedImpl(container, libraries, shape, targetRefId);
}

function findRefIdForSwapped(shape, container, libraries) {
  return findRefIdForSwappedImpl(shape, container, libraries);
}

export function generateKeepTouched(changes, newShape, originalShape, originalShapes, page, libraries, ldata) {
  const objects = pcb.getObjects(changes);
  const container = ctn.makeContainer(page, 'page');
  const pageObjects = page.objects;

  const origTouched = originalShapes
    .map((s) => addTouchedFromRefChain(container, libraries, s))
    .filter((s) => s.touched && Object.keys(s.touched).length > 0)
    .filter((s) => !childOfSwappedQ(s, pageObjects, originalShape.id));

  const newShapesWithPath = addUniquePath(
    [...cfh.getChildrenWithSelf(objects, newShape.id)].reverse(),
    objects,
    newShape.id
  );
  const newShapesMap = {};
  for (const s of newShapesWithPath) {
    newShapesMap[s['shape-path']] = s;
  }

  const origBaseRefShape = findRemoteShape(container, libraries, originalShape, { 'with-context?': true });
  const origRefObjects = origBaseRefShape?._containerCtx?.objects ?? {};

  const oRefShapesWp = addUniquePath(
    [...cfh.getChildrenWithSelf(origRefObjects, origBaseRefShape?.id)].reverse(),
    origRefObjects,
    origBaseRefShape?.id
  );
  const oRefShapesPMap = {};
  for (const s of oRefShapesWp) {
    oRefShapesPMap[s.id] = s['shape-path'];
  }

  let resultChanges = changes;
  const parentsOfSwapped = [];

  for (const origChildTouched of origTouched) {
    const swapSlot = getSwapSlot(origChildTouched);

    const origRefShape = swapSlot
      ? null
      : findShapeRefChildOf(container, libraries, origChildTouched, origBaseRefShape?.id);

    const origRefId = swapSlot
      ? findRefIdForSwapped(origChildTouched, container, libraries)
      : origRefShape?.id;

    const shapePath = oRefShapesPMap[origRefId];
    const relatedShapeInNew = newShapesMap[shapePath];

    if (relatedShapeInNew) {
      parentsOfSwapped.push(relatedShapeInNew['parent-id']);

      if (swapSlot) {
        resultChanges = keepSwappedItem(resultChanges, relatedShapeInNew, origChildTouched, ldata, page, origRefId);
      } else {
        resultChanges = cll.updateAttrsOnSwitch(
          resultChanges,
          relatedShapeInNew,
          origChildTouched,
          newShape,
          originalShape,
          origRefShape,
          container
        );
      }
    }
  }

  return [resultChanges, parentsOfSwapped];
}

export function changeShowInViewer(shape, hide) {
  return { ...shape, 'hide-in-viewer': hide };
}

export function addNewInteraction(shape, interaction) {
  const interactions = shape.interactions ?? [];
  return { ...shape, interactions: [...interactions, interaction] };
}

export function showInViewer(shape) {
  const { 'hide-in-viewer': _, ...rest } = shape;
  return rest;
}