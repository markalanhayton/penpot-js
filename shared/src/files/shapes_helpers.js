import * as pcb from './changes_builder.js';
import * as cfh from './helpers.js';
import * as ctl from '../types/shape/layout.js';
import * as cts from '../types/shape_type.js';
import * as gsh from '../geom/shapes/common.js';
import { getf, patchObject } from '../data.js';
import { zero as uuidZero } from '../uuid.js';

export function prepareAddShape(changes, shape, objects) {
  const meta = shape.__meta || {};
  const index = meta.index;
  const modQ = meta['mod?'];
  const cell = modQ ? null : meta.cell;

  changes = pcb.withObjects(changes, objects);

  if (index != null) {
    changes = pcb.addObject(changes, shape, { index });
  } else {
    changes = pcb.addObject(changes, shape);
  }

  if (shape['parent-id'] != null) {
    changes = pcb.changeParent(changes, shape['parent-id'], [shape], index);
  }

  if (cell != null) {
    const [row, column] = cell;
    changes = pcb.updateShapes(changes, [shape['parent-id']], (s) => ctl.pushIntoCell(s, [shape.id], row, column));
  }

  if (ctl.gridLayoutQ(objects, shape['parent-id'])) {
    changes = pcb.updateShapes(changes, [shape['parent-id']], (parent, objs) => ctl.assignCells(parent, objs), { 'with-objects?': true });
  }

  return [shape, changes];
}

export function prepareMoveShapesIntoFrame(changes, frameId, shapes, objects, removeLayoutDataQ) {
  const parentId = objects?.[frameId]?.['parent-id'];
  const filteredShapes = shapes.filter((id) => id !== parentId);
  const toMove = filteredShapes.map(getf(objects)).filter(Boolean);

  if (!toMove || toMove.length === 0) return changes;

  if (removeLayoutDataQ && !ctl.anyLayoutQ(objects, frameId)) {
    changes = pcb.updateShapes(changes, filteredShapes, (s) => ctl.removeLayoutItemData(s));
  }

  changes = pcb.updateShapes(changes, filteredShapes, (s) =>
    cfh.frameShapeQ(s) ? { ...s, 'hide-in-viewer': true } : s
  );

  changes = pcb.changeParent(changes, frameId, toMove, 0);

  if (ctl.gridLayoutQ(objects, frameId)) {
    changes = pcb.updateShapes(changes, [frameId], (parent, objs) => ctl.assignCells(parent, objs), { 'with-objects?': true });
    changes = pcb.reorderGridChildren(changes, [frameId]);
  }

  return changes;
}

export function prepareCreateArtboardFromSelection(changes, id, parentId, objects, selected, index, frameName, withoutFillQ, targetCellId, delta) {
  const selectedObjs = selected.map(getf(objects)).filter(Boolean);
  if (!selectedObjs || selectedObjs.length === 0) return [null, changes];

  const selectedPrime = cfh.orderByIndexedShapes(objects, selected);
  const newIndex = index != null
    ? index
    : cfh.getPositionOnParent(objects, selectedPrime[0]?.id) + 1;

  const srect = gsh.shapesToRect(selectedObjs);
  const selectedId = selected[0];
  const selectedObj = objects[selectedId];

  const frameId = selectedObj?.['frame-id'];
  const resolvedParentId = parentId || selectedObj?.['parent-id'];
  const baseParent = objects[resolvedParentId];

  let layoutAttrs;
  if (selected.length === 1 && baseParent && ctl.anyLayoutQ(baseParent)) {
    layoutAttrs = {};
    for (const attr of ctl.layoutChildAttrs) {
      if (selectedObj[attr] !== undefined) layoutAttrs[attr] = selectedObj[attr];
    }
  }

  let resolvedTargetCellId = targetCellId;
  if (resolvedTargetCellId == null && ctl.gridLayoutQ(objects, resolvedParentId)) {
    const ncols = baseParent?.['layout-grid-columns']?.length ?? 1;
    let best = null;
    let bestKey = Infinity;
    for (const sid of selected) {
      const cell = ctl.getCellByShapeId(baseParent, sid);
      if (cell) {
        const key = cell.row * ncols + cell.column;
        if (key < bestKey) {
          bestKey = key;
          best = cell;
        }
      }
    }
    resolvedTargetCellId = best?.id ?? null;
  }

  let attrs = {
    type: 'frame',
    x: srect.x + (delta ? delta.x || 0 : 0),
    y: srect.y + (delta ? delta.y || 0 : 0),
    width: srect.width,
    height: srect.height,
  };

  if (id != null) attrs.id = id;
  if (frameName != null) attrs.name = frameName;

  attrs['frame-id'] = frameId;
  attrs['parent-id'] = resolvedParentId;
  attrs.shapes = [...selected];

  if (layoutAttrs && Object.keys(layoutAttrs).length > 0) {
    attrs = patchObject(attrs, layoutAttrs);
  }

  if (frameId !== uuidZero || withoutFillQ) {
    attrs.fills = [];
    attrs['hide-in-viewer'] = true;
    attrs['show-content'] = true;
  }

  let shape = cts.setupShape(attrs);
  shape = Object.assign(Object.create(null), shape, { __meta: { index: newIndex } });

  let result = changes;
  [shape, result] = prepareAddShape(result, shape, objects);
  result = prepareMoveShapesIntoFrame(result, shape.id, selectedPrime, objects, false);

  if (ctl.gridLayoutQ(objects, resolvedParentId)) {
    result = pcb.updateShapes(result, [resolvedParentId], (parent, objs) => {
      let p = { ...parent };
      p['layout-grid-cells'] = baseParent['layout-grid-cells'];
      p['layout-grid-rows'] = baseParent['layout-grid-rows'];
      p['layout-grid-columns'] = baseParent['layout-grid-columns'];
      if (resolvedTargetCellId != null) {
        p = { ...p, 'layout-grid-cells': { ...p['layout-grid-cells'], [resolvedTargetCellId]: { ...p['layout-grid-cells'][resolvedTargetCellId], shapes: [shape.id] } } };
      }
      return ctl.assignCells(p, objs);
    }, { 'with-objects?': true });
    result = pcb.reorderGridChildren(result, [resolvedParentId]);
  }

  return [shape, result];
}

export function prepareCreateEmptyArtboard(changes, frameId, parentId, objects, index, frameName, withoutFillQ, targetCellId) {
  const baseParent = objects?.[parentId];

  let attrs = {
    type: 'frame',
    x: 0,
    y: 0,
    width: 0.01,
    height: 0.01,
  };

  if (frameId != null) attrs.id = frameId;
  if (frameName != null) attrs.name = frameName;

  attrs['frame-id'] = frameId;
  attrs['parent-id'] = parentId;
  attrs.shapes = [];

  if (frameId !== uuidZero || withoutFillQ) {
    attrs.fills = [];
    attrs['hide-in-viewer'] = true;
  }

  let shape = cts.setupShape(attrs);
  shape = Object.assign(Object.create(null), shape, { __meta: { index } });

  let result = changes;
  [shape, result] = prepareAddShape(result, shape, objects);

  if (ctl.gridLayoutQ(objects, shape['parent-id'])) {
    if (targetCellId != null) {
      result = pcb.updateShapes(result, [shape['parent-id']], (parent) => {
        let p = { ...parent };
        p['layout-grid-cells'] = { ...baseParent['layout-grid-cells'] };
        p['layout-grid-cells'] = { ...p['layout-grid-cells'], [targetCellId]: { ...p['layout-grid-cells'][targetCellId], shapes: [frameId] } };
        return { ...p, position: 'auto' };
      });
    }
    result = pcb.updateShapes(result, [shape['parent-id']], (parent, objs) => ctl.assignCells(parent, objs), { 'with-objects?': true });
    result = pcb.reorderGridChildren(result, [shape['parent-id']]);
  }

  return [shape, result];
}