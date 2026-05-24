import * as d from '../data.js';
import * as cfh from '../files/helpers.js';
import * as cgb from './bounds_map.js';
import * as cgt from './modif_tree.js';
import * as gpt from './point.js';
import * as gco from './shapes/common.js';
import * as gct from './shapes/constraints.js';
import * as gcfl from './shapes/flex_layout/index.js';
import * as gcgl from './shapes/grid_layout/index.js';
import * as gpp from './shapes/pixel_precision.js';
import * as gpo from './shapes/points.js';
import * as gtr from './shapes/transforms.js';
import * as cgst from './shapes/tree_seq.js';
import * as ctm from '../modifiers.js';
import * as ctl from '../types/shape/layout.js';
import { zero as uuidZero } from '../uuid.js';

function setChildrenModifiers(modifTree, children, objects, bounds, parent, transformedParentBounds, ignoreConstraints) {
  const modifiers = modifTree?.[parent.id]?.modifiers;

  if (ctm.isEmpty(modifiers)) return modifTree;

  if (ctm.onlyMove(modifiers)) {
    return children.reduce((tree, childId) => cgt.addModifiersToTree(tree, childId, modifiers), modifTree);
  }

  const parentId = parent.id;
  const parentBounds = gtr.transformBounds(bounds[parentId] ?? bounds[uuidZero], ctm.selectParent(modifiers));
  const effectiveParentBounds = parentBounds;

  return children.reduce((tree, childId) => {
    const child = objects[childId];
    if (!child) return tree;

    const childBounds = bounds[childId];
    const childModifiers = gct.calcChildModifiers(
      parent, child, modifiers, ignoreConstraints,
      childBounds, parentBounds, effectiveParentBounds
    );

    return cgt.addModifiersToTree(tree, childId, childModifiers);
  }, modifTree);
}

function setFlexLayoutModifiers(modifTree, children, objects, bounds, parent, transformedParentBounds) {
  const bmap = cgb.transformBoundsMap(bounds, objects, modifTree, children);

  const layoutChildren = children
    .map(id => objects[id])
    .filter(Boolean)
    .filter(s => !gco.invalidGeometryQ(s))
    .map(child => {
      const cb = bmap[child.id];
      if (!cb) return null;
      return [gpo.parentCoordsBounds(cb, transformedParentBounds), child];
    })
    .filter(Boolean);

  const layoutData = gcfl.calcLayoutData(parent, transformedParentBounds, layoutChildren.map(lc => lc[1]).map((c, i) => layoutChildren[i] ? [layoutChildren[i][0], c] : null).filter(Boolean), bmap, objects);
  const orderedChildren = layoutData.reverse ? [...layoutChildren].reverse() : layoutChildren;
  const maxIdx = orderedChildren.length - 1;
  const layoutLines = layoutData.layoutLines;

  let currentTree = modifTree;
  let lineIdx = 0;
  let fromIdx = 0;

  while (lineIdx < layoutLines.length && fromIdx <= maxIdx) {
    const line = layoutLines[lineIdx];
    const toIdx = fromIdx + line.numChildren;
    const lineChildren = orderedChildren.slice(fromIdx, toIdx);

    let layoutLine = line;
    for (const [childBounds, child] of lineChildren) {
      const result = gcfl.layoutChildModifiers(parent, transformedParentBounds, child, childBounds, layoutLine);
      layoutLine = result[0];
      currentTree = cgt.addModifiersToTree(currentTree, child.id, result[1]);
    }

    lineIdx++;
    fromIdx = toIdx;
  }

  return currentTree;
}

function setGridLayoutModifiers(modifTree, objects, bounds, parent, transformedParentBounds) {
  const bmap = cgb.transformBoundsMap(bounds, objects, modifTree, parent.shapes);

  const children = cfh.getImmediateChildren(objects, parent.id, { removeHidden: true })
    .map(child => {
      const cb = bmap[child.id];
      if (!cb) return null;
      return [gpo.parentCoordsBounds(cb, transformedParentBounds), child];
    })
    .filter(Boolean);

  const gridData = gcgl.calcLayoutData(parent, transformedParentBounds, children, bmap, objects);

  let currentTree = modifTree;
  for (const [childBounds, child] of children) {
    const cellData = gcgl.getCellData(gridData, transformedParentBounds, childBounds);
    if (cellData) {
      const childMods = gcgl.childModifiers(parent, transformedParentBounds, child, childBounds, gridData, cellData);
      currentTree = cgt.addModifiersToTree(currentTree, child.id, childMods);
    }
  }

  return currentTree;
}

function setModifiersConstraints(objects, bounds, ignoreConstraints, modifTree, parent) {
  const parentId = parent.id;
  const children = parent.shapes;
  const rootQ = parentId === uuidZero;
  const modifiers = ctm.selectGeometry(modifTree?.[parentId]?.modifiers);
  const hasModifiersQ = ctm.childModifiersQ(modifiers);
  const parentQ = cfh.groupLikeShapeQ(parent) || cfh.frameShapeQ(parent);
  const transformedParentBounds = gtr.transformBounds(bounds[parentId] ?? bounds[uuidZero], modifiers);

  if (hasModifiersQ && parentQ && !rootQ) {
    return setChildrenModifiers(modifTree, children, objects, bounds, parent, transformedParentBounds, ignoreConstraints);
  }

  return modifTree;
}

function setModifiersLayout(objects, bounds, ignoreConstraints, modifTree, parent) {
  const parentId = parent.id;
  const rootQ = parentId === uuidZero;
  const modifiers = ctm.selectGeometry(modifTree?.[parentId]?.modifiers);
  const hasModifiersQ = ctm.childModifiersQ(modifiers);
  const flexLayoutQ = ctl.flexLayoutQ(parent);
  const gridLayoutQ = ctl.gridLayoutQ(parent);
  const parentQ = cfh.groupLikeShapeQ(parent) || cfh.frameShapeQ(parent);

  const transformedParentBounds = gtr.transformBounds(bounds[parentId] ?? bounds[uuidZero], modifiers);

  const childrenModifiers = (flexLayoutQ || gridLayoutQ)
    ? parent.shapes.filter(id => ctl.positionAbsoluteQ(objects, id))
    : parent.shapes;

  const childrenLayout = (flexLayoutQ || gridLayoutQ)
    ? parent.shapes.filter(id => !ctl.positionAbsoluteQ(objects, id))
    : null;

  let result = modifTree;

  if (hasModifiersQ && parentQ && !rootQ) {
    result = setChildrenModifiers(result, childrenModifiers, objects, bounds, parent, transformedParentBounds, ignoreConstraints);
  }

  if (flexLayoutQ) {
    result = setFlexLayoutModifiers(result, childrenLayout, objects, bounds, parent, transformedParentBounds);
  }

  if (gridLayoutQ) {
    result = setGridLayoutModifiers(result, objects, bounds, parent, transformedParentBounds);
  }

  return result;
}

export function propagateModifiersConstraints(objects, bounds, ignoreConstraints, shapes) {
  return propagateModifiersConstraintsTree(objects, bounds, ignoreConstraints, {}, shapes);
}

export function propagateModifiersConstraintsTree(objects, bounds, ignoreConstraints, modifTree, shapes) {
  return shapes.reduce((tree, shape) => setModifiersConstraints(objects, bounds, ignoreConstraints, tree, shape), modifTree);
}

export function propagateModifiersLayouts(objects, bounds, ignoreConstraints, shapes) {
  return propagateModifiersLayoutsTree(objects, bounds, ignoreConstraints, {}, shapes);
}

export function propagateModifiersLayoutsTree(objects, bounds, ignoreConstraints, modifTree, shapes) {
  return shapes.reduce((tree, shape) => setModifiersLayout(objects, bounds, ignoreConstraints, tree, shape), modifTree);
}

function calcAutoModifiers(objects, bounds, parent) {
  const parentId = parent.id;
  const parentBounds = bounds[parentId];

  function setParentAutoWidth(modifiers, autoWidth) {
    const origin = gpo.origin(parentBounds);
    const currentWidth = gpo.widthPoints(parentBounds);
    const scaleWidth = autoWidth / currentWidth;
    return ctm.resize(modifiers, gpt.point(scaleWidth, 1), origin, parent.transform, parent.transformInverse);
  }

  function setParentAutoHeight(modifiers, autoHeight) {
    const origin = gpo.origin(parentBounds);
    const currentHeight = gpo.heightPoints(parentBounds);
    const scaleHeight = autoHeight / currentHeight;
    return ctm.resize(modifiers, gpt.point(1, scaleHeight), origin, parent.transform, parent.transformInverse);
  }

  const children = cfh.getImmediateChildren(objects, parentId)
    .filter(c => !ctl.positionAbsoluteQ(objects, c.id))
    .filter(c => !gco.invalidGeometryQ(c));

  const autoQ = ctl.autoQ(parent) ||
    (ctl.gridLayoutQ(objects, parent.parentId) && ctl.fillQ(parent));

  const autoWidthQ = ctl.autoWidthQ(parent) ||
    (ctl.gridLayoutQ(objects, parent.parentId) && ctl.fillWidthQ(parent));

  const autoHeightQ = ctl.autoHeightQ(parent) ||
    (ctl.gridLayoutQ(objects, parent.parentId) && ctl.fillHeightQ(parent));

  let contentBounds = null;

  if (d.notEmpty(children) && autoQ) {
    if (ctl.flexLayoutQ(parent)) {
      contentBounds = gcfl.layoutContentBounds(bounds, parent, children, objects);
    } else if (ctl.gridLayoutQ(parent)) {
      const childBoundPairs = children
        .map(child => {
          const cb = bounds[child.id];
          return cb ? [cb, child] : null;
        })
        .filter(Boolean);
      const layoutData = gcgl.calcLayoutData(parent, parentBounds, childBoundPairs, bounds, objects);
      contentBounds = gcgl.layoutContentBounds(bounds, parent, layoutData);
    }
  }

  const autoWidth = contentBounds ? gpo.widthPoints(contentBounds) : null;
  const autoHeight = contentBounds ? gpo.heightPoints(contentBounds) : null;

  let modifiers = ctm.empty();

  if (autoWidth != null && autoWidthQ) {
    modifiers = setParentAutoWidth(modifiers, autoWidth);
  }

  if (autoHeight != null && autoHeightQ) {
    modifiers = setParentAutoHeight(modifiers, autoHeight);
  }

  return modifiers;
}

export function findAutoLayouts(objects, shapes) {
  return new Set(shapes.filter(shape => {
    if (ctl.autoQ(shape)) return true;
    if (ctl.gridLayoutQ(objects, shape.parentId) && ctl.fillQ(shape)) return true;
    return false;
  }).map(s => s.id));
}

export function fullTreeQ(objects, layoutId) {
  const layoutJustifyContent = objects[layoutId]?.layoutJustifyContent;
  return ['center', 'end', 'space-around', 'space-evenly', 'stretch'].includes(layoutJustifyContent);
}

export function sizingAutoModifiers(modifTree, sizingAutoLayouts, objects, bounds, ignoreConstraints) {
  const result = [...sizingAutoLayouts].reverse().reduce(([tree, bmap], layoutId) => {
    const layout = objects[layoutId];
    const autoMods = calcAutoModifiers(objects, bmap, layout);

    if (ctm.isEmpty(autoMods) && !ctl.gridLayoutQ(layout)) {
      return [tree, bmap];
    }

    const fromLayout = [...sizingAutoLayouts].find(id => cfh.getParentIds(objects, layoutId).includes(id));

    const shapes = (fromLayout && !fullTreeQ(objects, fromLayout))
      ? cgst.resolveSubtree(fromLayout, layoutId, objects)
      : cgst.resolveTree(new Set([layoutId]), objects);

    let autoModifTree = { [layoutId]: { modifiers: autoMods } };
    autoModifTree = propagateModifiersLayoutsTree(objects, bmap, ignoreConstraints, autoModifTree, shapes);

    const newBounds = cgb.transformBoundsMap(bmap, objects, autoModifTree);
    const mergedTree = cgt.mergeModifTree(tree, autoModifTree);

    return [mergedTree, newBounds];
  }, [modifTree, bounds]);

  return result[0];
}

export function filterLayoutsIds(objects, modifTree) {
  return new Set(
    Object.entries(modifTree)
      .filter(([, { modifiers }]) => {
        if (ctm.isEmpty(modifiers)) return false;
        if (cfh.rootFrameQ(objects, modifiers) && ctm.onlyMove(modifiers)) return false;
        return true;
      })
      .map(([id]) => id)
  );
}

export function setObjectsModifiers(modifTree, objects, params) {
  const {
    ignoreConstraints = false,
    snapPixelQ = false,
    snapPrecision = 1,
    snapIgnoreAxis = null,
  } = params || {};

  let oldModifTree = null;

  let currentObjects = objects;
  currentObjects = cgt.applyStructureModifiersToObjects(currentObjects, modifTree);

  const shapesTreeAll = cgst.resolveTree(new Set(Object.keys(modifTree)), currentObjects);
  const shapesTreeLayout = cgst.resolveTree(filterLayoutsIds(currentObjects, modifTree), currentObjects);

  let boundsMap = cgb.objectsToBoundsMap(currentObjects);

  let currentModifTree = modifTree;

  if (snapPixelQ) {
    currentModifTree = gpp.adjustPixelPrecision(currentModifTree, currentObjects, snapPrecision, snapIgnoreAxis);
  }

  currentModifTree = propagateModifiersConstraintsTree(currentObjects, boundsMap, ignoreConstraints, currentModifTree, shapesTreeAll);

  boundsMap = cgb.transformBoundsMap(boundsMap, currentObjects, currentModifTree);

  let modifTreeLayout = propagateModifiersLayoutsTree(currentObjects, boundsMap, ignoreConstraints, shapesTreeLayout);

  currentModifTree = cgt.mergeModifTree(currentModifTree, modifTreeLayout);

  boundsMap = cgb.transformBoundsMap(boundsMap, currentObjects, modifTreeLayout);

  const sizingAutoLayouts = findAutoLayouts(currentObjects, shapesTreeLayout);

  currentModifTree = sizingAutoModifiers(currentModifTree, sizingAutoLayouts, currentObjects, boundsMap, ignoreConstraints);

  return currentModifTree;
}