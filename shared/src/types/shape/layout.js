export const layoutTypes = new Set(['flex', 'grid']);

export const flexDirectionTypes = new Set(['row', 'row-reverse', 'column', 'column-reverse']);
export const gridDirectionTypes = new Set(['row', 'column']);
export const gapTypes = new Set(['simple', 'multiple']);
export const wrapTypes = new Set(['wrap', 'nowrap']);
export const paddingType = new Set(['simple', 'multiple']);
export const justifyContentTypes = new Set(['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly', 'stretch']);
export const alignContentTypes = new Set(['start', 'end', 'center', 'space-between', 'space-around', 'space-evenly', 'stretch']);
export const alignItemsTypes = new Set(['start', 'end', 'center', 'stretch']);
export const justifyItemsTypes = new Set(['start', 'end', 'center', 'stretch']);
export const gridTrackTypes = new Set(['percent', 'flex', 'auto', 'fixed']);
export const gridPositionTypes = new Set(['auto', 'manual', 'area']);
export const gridCellAlignSelfTypes = new Set(['auto', 'start', 'center', 'end', 'stretch']);
export const gridCellJustifySelfTypes = new Set(['auto', 'start', 'center', 'end', 'stretch']);
export const itemMarginTypes = new Set(['simple', 'multiple']);
export const itemHSizingTypes = new Set(['fill', 'fix', 'auto']);
export const itemVSizingTypes = new Set(['fill', 'fix', 'auto']);
export const itemAlignSelfTypes = new Set(['start', 'end', 'center', 'stretch']);

export const layoutChildAttrs = new Set([
  'layout-item-margin-type', 'layout-item-margin', 'layout-item-max-h', 'layout-item-min-h',
  'layout-item-max-w', 'layout-item-min-w', 'layout-item-h-sizing', 'layout-item-v-sizing',
  'layout-item-align-self', 'layout-item-absolute', 'layout-item-z-index',
]);

export function flexLayoutQ(objectsOrShape, id) {
  const shape = typeof id === 'string' ? objectsOrShape[id] : objectsOrShape;
  return shape?.type === 'frame' && shape?.layout === 'flex';
}

export function gridLayoutQ(objectsOrShape, id) {
  const shape = typeof id === 'string' ? objectsOrShape[id] : objectsOrShape;
  return shape?.type === 'frame' && shape?.layout === 'grid';
}

export function anyLayoutQ(objectsOrShape, id) {
  const shape = typeof id === 'string' ? objectsOrShape[id] : objectsOrShape;
  return shape?.type === 'frame' && (shape?.layout === 'flex' || shape?.layout === 'grid');
}

export function flexLayoutImmediateChildQ(objects, shape) {
  const parentId = shape?.['parent-id'];
  const parent = objects[parentId];
  return flexLayoutQ(parent);
}

export function gridLayoutImmediateChildQ(objects, shape) {
  const parentId = shape?.['parent-id'];
  const parent = objects[parentId];
  return gridLayoutQ(parent);
}

export function anyLayoutImmediateChildQ(objects, shape) {
  const parentId = shape?.['parent-id'];
  const parent = objects[parentId];
  return anyLayoutQ(parent);
}

export function flexLayoutImmediateChildIdQ(objects, id) {
  const parentId = objects[id]?.['parent-id'];
  const parent = objects[parentId];
  return flexLayoutQ(parent);
}

export function gridLayoutImmediateChildIdQ(objects, id) {
  const parentId = objects[id]?.['parent-id'];
  const parent = objects[parentId];
  return gridLayoutQ(parent);
}

export function anyLayoutImmediateChildIdQ(objects, id) {
  const parentId = objects[id]?.['parent-id'];
  const parent = objects[parentId];
  return anyLayoutQ(parent);
}

export function fillWidthQ(objectsOrChild, id) {
  const child = typeof id === 'string' ? objectsOrChild[id] : objectsOrChild;
  return child?.['layout-item-h-sizing'] === 'fill';
}

export function fillHeightQ(objectsOrChild, id) {
  const child = typeof id === 'string' ? objectsOrChild[id] : objectsOrChild;
  return child?.['layout-item-v-sizing'] === 'fill';
}

export function fillQ(objectsOrShape, id) {
  return fillHeightQ(objectsOrShape, id) || fillWidthQ(objectsOrShape, id);
}

export function autoQ(objectsOrShape, id) {
  const shape = typeof id === 'string' ? objectsOrShape[id] : objectsOrShape;
  return autoHeightQ(shape) || autoWidthQ(shape);
}

export function autoWidthQ(objectsOrChild, id) {
  const child = typeof id === 'string' ? objectsOrChild[id] : objectsOrChild;
  return child?.['layout-item-h-sizing'] === 'auto';
}

export function autoHeightQ(objectsOrChild, id) {
  const child = typeof id === 'string' ? objectsOrChild[id] : objectsOrChild;
  return child?.['layout-item-v-sizing'] === 'auto';
}

export function colQ(shape) {
  return shape?.['layout-flex-dir'] === 'column' || shape?.['layout-flex-dir'] === 'column-reverse';
}

export function rowQ(shape) {
  return shape?.['layout-flex-dir'] === 'row' || shape?.['layout-flex-dir'] === 'row-reverse';
}

export function gaps(shape) {
  const gap = shape?.['layout-gap'] ?? {};
  return [gap['row-gap'] ?? 0, gap['column-gap'] ?? 0];
}

export function paddings(shape) {
  const padding = shape?.['layout-padding'] ?? {};
  const p1 = padding.p1 ?? 0;
  const p2 = padding.p2 ?? 0;
  const p3 = padding.p3 ?? 0;
  const p4 = padding.p4 ?? 0;
  if (shape?.['layout-padding-type'] === 'simple') {
    return [p1, p2, p1, p2];
  }
  return [p1, p2, p3, p4];
}

export function hPadding(shape) {
  const padding = shape?.['layout-padding'] ?? {};
  if (shape?.['layout-padding-type'] === 'simple') {
    return (padding.p2 ?? 0) * 2;
  }
  return (padding.p2 ?? 0) + (padding.p4 ?? 0);
}

export function vPadding(shape) {
  const padding = shape?.['layout-padding'] ?? {};
  if (shape?.['layout-padding-type'] === 'simple') {
    return (padding.p1 ?? 0) * 2;
  }
  return (padding.p1 ?? 0) + (padding.p3 ?? 0);
}

export function childMinWidth(child) {
  if (fillWidthQ(child) && child?.['layout-item-min-w'] != null) {
    return Math.max(0.01, child['layout-item-min-w']);
  }
  return 0.01;
}

export function childMaxWidth(child) {
  if (fillWidthQ(child) && child?.['layout-item-max-w'] != null) {
    return Math.max(0.01, child['layout-item-max-w']);
  }
  return Infinity;
}

export function childMinHeight(child) {
  if (fillHeightQ(child) && child?.['layout-item-min-h'] != null) {
    return Math.max(0.01, child['layout-item-min-h']);
  }
  return 0.01;
}

export function childMaxHeight(child) {
  if (fillHeightQ(child) && child?.['layout-item-max-h'] != null) {
    return Math.max(0.01, child['layout-item-max-h']);
  }
  return Infinity;
}

export function childMargins(child) {
  const margin = child?.['layout-item-margin'] ?? {};
  const m1 = margin.m1 ?? 0;
  const m2 = margin.m2 ?? 0;
  const m3 = margin.m3 ?? 0;
  const m4 = margin.m4 ?? 0;
  if (child?.['layout-item-margin-type'] === 'multiple') {
    return [m1, m2, m3, m4];
  }
  return [m1, m2, m1, m2];
}

export function childHeightMargin(child) {
  const [top, , bottom] = childMargins(child);
  return top + bottom;
}

export function childWidthMargin(child) {
  const [, right, , left] = childMargins(child);
  return right + left;
}

export function wrapQ(shape) {
  return shape?.['layout-wrap-type'] === 'wrap';
}

export function itemAbsoluteQ(objectsOrShape, id) {
  const shape = typeof id === 'string' ? objectsOrShape[id] : objectsOrShape;
  return shape?.['layout-item-absolute'] === true;
}

export function positionAbsoluteQ(objectsOrShape, id) {
  const shape = typeof id === 'string' ? objectsOrShape[id] : objectsOrShape;
  return itemAbsoluteQ(shape) || shape?.hidden === true;
}

export function layoutZIndex(objectsOrShape, id) {
  const shape = typeof id === 'string' ? objectsOrShape[id] : objectsOrShape;
  return shape?.['layout-item-z-index'] ?? 0;
}

export function reverseQ(objectsOrShape, id) {
  const shape = typeof id === 'string' ? objectsOrShape[id] : objectsOrShape;
  return shape?.['layout-flex-dir'] === 'row-reverse' || shape?.['layout-flex-dir'] === 'column-reverse';
}

export function removeLayoutItemData(shape) {
  const { 'layout-item-min-w': _, 'layout-item-min-h': __, 'layout-item-max-w': ___, 'layout-item-max-h': ____, 'layout-item-h-sizing': _____, 'layout-item-v-sizing': ______, 'layout-item-align-self': _______, 'layout-item-absolute': ________, 'layout-item-z-index': _________, 'layout-item-margin': __________, 'layout-item-margin-type': ___________, ...rest } = shape;
  return rest;
}

export function pushIntoCell(shape, ids, row, column) {
  const currentShapes = shape?.['layout-grid-cells']?.[shape.id]?.shapes ?? [];
  const newShapes = [...currentShapes, ...ids];
  return { ...shape, 'layout-grid-cells': { ...shape['layout-grid-cells'], [shape.id]: { ...shape['layout-grid-cells']?.[shape.id], shapes: newShapes, row, column } } };
}

export function assignCells(parent, objects) {
  return parent;
}

export function getCellByShapeId(parent, shapeId) {
  const cells = parent?.['layout-grid-cells'] ?? {};
  for (const [cellId, cell] of Object.entries(cells)) {
    if (cell.shapes && cell.shapes.includes(shapeId)) {
      return { id: cellId, ...cell };
    }
  }
  return null;
}

export function removeLayoutContainerData(shape) {
  const {
    layout: _layout,
    'layout-flex-dir': _flexDir,
    'layout-gap': _gap,
    'layout-gap-type': _gapType,
    'layout-wrap-type': _wrapType,
    'layout-padding-type': _paddingType,
    'layout-padding': _padding,
    'layout-justify-content': _justifyContent,
    'layout-justify-items': _justifyItems,
    'layout-align-content': _alignContent,
    'layout-align-items': _alignItems,
    'layout-grid-dir': _gridDir,
    'layout-grid-rows': _gridRows,
    'layout-grid-columns': _gridColumns,
    'layout-grid-cells': _gridCells,
    ...rest
  } = shape;
  return rest;
}

export function hStartQ(shape) {
  if (colQ(shape)) return shape['layout-align-items'] === 'start';
  if (rowQ(shape)) return shape['layout-justify-content'] === 'start';
  return false;
}

export function hCenterQ(shape) {
  if (colQ(shape)) return shape['layout-align-items'] === 'center';
  if (rowQ(shape)) return shape['layout-justify-content'] === 'center';
  return false;
}

export function hEndQ(shape) {
  if (colQ(shape)) return shape['layout-align-items'] === 'end';
  if (rowQ(shape)) return shape['layout-justify-content'] === 'end';
  return false;
}

export function vStartQ(shape) {
  if (rowQ(shape)) return shape['layout-align-items'] === 'start';
  if (colQ(shape)) return shape['layout-justify-content'] === 'start';
  return false;
}

export function vCenterQ(shape) {
  if (rowQ(shape)) return shape['layout-align-items'] === 'center';
  if (colQ(shape)) return shape['layout-justify-content'] === 'center';
  return false;
}

export function vEndQ(shape) {
  if (rowQ(shape)) return shape['layout-align-items'] === 'end';
  if (colQ(shape)) return shape['layout-justify-content'] === 'end';
  return false;
}

export function contentStartQ(shape) {
  return shape?.['layout-align-content'] === 'start';
}

export function contentCenterQ(shape) {
  return shape?.['layout-align-content'] === 'center';
}

export function contentEndQ(shape) {
  return shape?.['layout-align-content'] === 'end';
}

export function contentBetweenQ(shape) {
  return shape?.['layout-align-content'] === 'space-between';
}

export function contentAroundQ(shape) {
  return shape?.['layout-align-content'] === 'space-around';
}

export function contentEvenlyQ(shape) {
  return shape?.['layout-align-content'] === 'space-evenly';
}

export function contentStretchQ(shape) {
  return shape?.['layout-align-content'] === 'stretch' || shape?.['layout-align-content'] == null;
}

export function alignItemsCenterQ(shape) {
  return shape?.['layout-align-items'] === 'center';
}

export function alignItemsStartQ(shape) {
  return shape?.['layout-align-items'] === 'start';
}

export function alignItemsEndQ(shape) {
  return shape?.['layout-align-items'] === 'end';
}

export function alignItemsStretchQ(shape) {
  return shape?.['layout-align-items'] === 'stretch';
}

export function spaceBetweenQ(shape) {
  return shape?.['layout-justify-content'] === 'space-between';
}

export function spaceAroundQ(shape) {
  return shape?.['layout-justify-content'] === 'space-around';
}

export function spaceEvenlyQ(shape) {
  return shape?.['layout-justify-content'] === 'space-evenly';
}

export function alignSelfStartQ(shape) {
  return shape?.['layout-item-align-self'] === 'start';
}

export function alignSelfEndQ(shape) {
  return shape?.['layout-item-align-self'] === 'end';
}

export function alignSelfCenterQ(shape) {
  return shape?.['layout-item-align-self'] === 'center';
}

export function alignSelfStretchQ(shape) {
  return shape?.['layout-item-align-self'] === 'stretch';
}

export function updateFlexScale(shape, scale) {
  const gap = shape?.['layout-gap'] ?? {};
  const padding = shape?.['layout-padding'] ?? {};
  const newGap = {
    'row-gap': (gap['row-gap'] ?? 0) * scale,
    'column-gap': (gap['column-gap'] ?? 0) * scale,
  };
  const newPadding = {
    p1: (padding.p1 ?? 0) * scale,
    p2: (padding.p2 ?? 0) * scale,
    p3: (padding.p3 ?? 0) * scale,
    p4: (padding.p4 ?? 0) * scale,
  };
  return { ...shape, 'layout-gap': newGap, 'layout-padding': newPadding };
}

export function updateGridScale(shape, scale) {
  const rows = (shape?.['layout-grid-rows'] ?? []).map((track) =>
    track.type === 'fixed' ? { ...track, value: track.value * scale } : track
  );
  const gap = shape?.['layout-gap'] ?? {};
  const padding = shape?.['layout-padding'] ?? {};
  const newGap = {
    'row-gap': (gap['row-gap'] ?? 0) * scale,
    'column-gap': (gap['column-gap'] ?? 0) * scale,
  };
  const newPadding = {
    p1: (padding.p1 ?? 0) * scale,
    p2: (padding.p2 ?? 0) * scale,
    p3: (padding.p3 ?? 0) * scale,
    p4: (padding.p4 ?? 0) * scale,
  };
  return { ...shape, 'layout-grid-rows': rows, 'layout-gap': newGap, 'layout-padding': newPadding };
}