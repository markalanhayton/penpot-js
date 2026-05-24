import { seek, notEmpty } from '../data.js';

export const SYNC_ATTRS = {
  name: 'name-group',
  fills: 'fill-group',
  'hide-fill-on-export': 'fill-group',
  content: { path: 'geometry-group', text: 'content-group' },
  'position-data': 'content-group',
  hidden: 'visibility-group',
  blocked: 'modifiable-group',
  'grow-type': 'text-font-group',
  'font-family': 'text-font-group',
  'font-size': 'text-font-group',
  'font-style': 'text-font-group',
  'font-weight': 'text-font-group',
  'letter-spacing': 'text-display-group',
  'line-height': 'text-display-group',
  'text-align': 'text-display-group',
  strokes: 'stroke-group',
  'stroke-width': 'stroke-group',
  'fill-color': 'fill-group',
  'fill-opacity': 'fill-group',
  r1: 'radius-group',
  r2: 'radius-group',
  r3: 'radius-group',
  r4: 'radius-group',
  type: 'geometry-group',
  selrect: 'geometry-group',
  points: 'geometry-group',
  locked: 'geometry-group',
  proportion: 'geometry-group',
  'proportion-lock': 'geometry-group',
  x: 'geometry-group',
  y: 'geometry-group',
  width: 'geometry-group',
  height: 'geometry-group',
  rotation: 'geometry-group',
  transform: 'geometry-group',
  'transform-inverse': 'geometry-group',
  opacity: 'layer-effects-group',
  'blend-mode': 'layer-effects-group',
  shadow: 'shadow-group',
  blur: 'blur-group',
  'masked-group': 'mask-group',
  'constraints-h': 'constraints-group',
  'constraints-v': 'constraints-group',
  'fixed-scroll': 'constraints-group',
  'bool-type': 'content-group',
  'bool-content': 'content-group',
  exports: 'exports-group',
  grids: 'grids-group',
  'show-content': 'show-content',
  layout: 'layout-container',
  'layout-align-content': 'layout-align-content',
  'layout-align-items': 'layout-align-items',
  'layout-flex-dir': 'layout-flex-dir',
  'layout-gap': 'layout-gap',
  'layout-gap-type': 'layout-gap',
  'layout-justify-content': 'layout-justify-content',
  'layout-justify-items': 'layout-justify-items',
  'layout-wrap-type': 'layout-wrap-type',
  'layout-padding-type': 'layout-padding',
  'layout-padding': 'layout-padding',
  'layout-grid-dir': 'layout-grid-dir',
  'layout-grid-rows': 'layout-grid-rows',
  'layout-grid-columns': 'layout-grid-columns',
  'layout-grid-cells': 'layout-grid-cells',
  'layout-item-margin': 'layout-item-margin',
  'layout-item-margin-type': 'layout-item-margin',
  'layout-item-h-sizing': 'layout-item-h-sizing',
  'layout-item-v-sizing': 'layout-item-v-sizing',
  'layout-item-max-h': 'layout-item-max-h',
  'layout-item-min-h': 'layout-item-min-h',
  'layout-item-max-w': 'layout-item-max-w',
  'layout-item-min-w': 'layout-item-min-w',
  'layout-item-absolute': 'layout-item-absolute',
  'layout-item-z-index': 'layout-item-z-index',
  'layout-item-align-self': 'layout-item-align-self',
};

export const SWAP_KEEP_ATTRS = new Set([
  'layout-item-margin',
  'layout-item-margin-type',
  'layout-item-h-sizing',
  'layout-item-v-sizing',
  'layout-item-max-h',
  'layout-item-min-h',
  'layout-item-max-w',
  'layout-item-min-w',
  'layout-item-absolute',
  'layout-item-z-index',
  'layout-item-align-self',
  'interactions',
]);

const ALL_TOUCHED_GROUPS = new Set();
for (const [key, val] of Object.entries(SYNC_ATTRS)) {
  if (typeof val === 'object') {
    for (const v of Object.values(val)) ALL_TOUCHED_GROUPS.add(v);
  } else {
    ALL_TOUCHED_GROUPS.add(val);
  }
}

export function resolveSyncGroup(type, attr) {
  const group = SYNC_ATTRS[attr];
  if (group == null) return null;
  if (typeof group === 'object') return group[type] ?? null;
  return group;
}

export function componentAttrQ(attr) {
  return attr in SYNC_ATTRS ||
         attr === 'shape-ref' ||
         attr === 'applied-tokens' ||
         attr === 'component-id' ||
         attr === 'component-file' ||
         attr === 'component-root';
}

export function instanceRootQ(shape) {
  return shape['component-root'] === true;
}

export function instanceHeadQ(shape) {
  return shape['component-id'] != null;
}

export function subinstanceHeadQ(shape) {
  return shape['component-id'] != null && shape['component-root'] == null;
}

export function subcopyHeadQ(shape) {
  return shape['component-id'] != null && shape['component-root'] == null && shape['shape-ref'] != null;
}

export function instanceOfQ(shape, fileId, componentId) {
  return shape['component-id'] != null &&
         shape['component-file'] != null &&
         shape['component-id'] === componentId &&
         shape['component-file'] === fileId;
}

export function isMainOfQ(shapeMain, shapeInst) {
  return shapeInst['shape-ref'] === shapeMain.id;
}

export function mainInstanceQ(shape) {
  return shape['main-instance'] === true;
}

export function inComponentCopyQ(shape) {
  return shape['shape-ref'] != null;
}

export function inComponentCopyNotHeadQ(shape) {
  return shape['shape-ref'] != null && shape['component-id'] == null;
}

export function inComponentCopyNotRootQ(shape) {
  return shape['shape-ref'] != null && shape['component-root'] == null;
}

export function mainInstanceOfQ(shapeId, pageId, component) {
  return shapeId === component['main-instance-id'] && pageId === component['main-instance-page'];
}

export function isVariantQ(item) {
  return item['variant-id'] != null;
}

export function isVariantContainerQ(shape) {
  return !!shape['is-variant-container'];
}

export function setTouchedGroup(touched, group) {
  if (group == null) return touched;
  const s = touched ?? new Set();
  s.add(group);
  return s;
}

export function touchedGroupQ(shape, group) {
  const touched = shape.touched ?? new Set();
  return touched.has(group);
}

export function buildSwapSlotGroup(swapSlot) {
  if (swapSlot == null) return null;
  return `swap-slot-${swapSlot}`;
}

export function swapSlotQ(group) {
  return typeof group === 'string' && group.startsWith('swap-slot-');
}

export function normalTouchedGroups(shape) {
  const touched = shape.touched ?? new Set();
  const result = new Set();
  for (const g of touched) {
    if (!swapSlotQ(g)) result.add(g);
  }
  return result;
}

export function groupToSwapSlot(group) {
  if (typeof group === 'string' && group.startsWith('swap-slot-')) {
    const uuidStr = group.slice(10);
    return uuidStr || null;
  }
  return null;
}

export function getSwapSlot(shape) {
  const touched = shape.touched ?? new Set();
  const group = seek(swapSlotQ, [...touched]);
  return group ? groupToSwapSlot(group) : null;
}

export function setSwapSlot(shape, swapSlot) {
  if (swapSlot == null) return shape;
  const touched = shape.touched ?? new Set();
  const group = buildSwapSlotGroup(swapSlot);
  touched.add(group);
  return { ...shape, touched };
}

export function matchSwapSlotQ(shapeMain, shapeInst) {
  const slotMain = getSwapSlot(shapeMain);
  const slotInst = getSwapSlot(shapeInst);
  if (slotInst == null) return false;
  return slotMain === slotInst || shapeMain.id === slotInst;
}

export function removeSwapSlot(shape) {
  const touched = shape.touched ?? new Set();
  const newTouched = new Set();
  for (const g of touched) {
    if (!swapSlotQ(g)) newTouched.add(g);
  }
  return { ...shape, touched: newTouched };
}

export function getDeletedComponentRoot(component) {
  const mainId = component['main-instance-id'];
  if (mainId != null) return component.objects?.[mainId];
  return component.objects?.[component.id];
}

export function usesLibraryComponentsQ(shape, libraryId) {
  return shape['component-id'] != null && shape['component-file'] === libraryId;
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

export function unheadShape(shape) {
  const result = { ...shape };
  delete result['component-root'];
  delete result['component-file'];
  delete result['component-id'];
  delete result['main-instance'];
  return result;
}

export function reheadShape(shape, componentFile, componentId) {
  return { ...shape, 'component-file': componentFile, 'component-id': componentId };
}

export function diffComponents(comp1, comp2) {
  function extractIds(shape) {
    if (typeof shape !== 'object' || shape == null) return [];
    const result = [shape.id];
    const children = shape.children ?? shape.shapes ?? [];
    for (const child of children) {
      result.push(...extractIds(child));
    }
    return result;
  }

  const allKeys = new Set([...Object.keys(comp1), ...Object.keys(comp2)]);
  const result = new Set();
  for (const key of allKeys) {
    if (key === 'objects') {
      if (JSON.stringify(extractIds(comp1[key])) !== JSON.stringify(extractIds(comp2[key]))) {
        result.add(key);
      }
    } else if (comp1[key] !== comp2[key]) {
      result.add(key);
    }
  }
  return result;
}

export function allowDuplicateQ(objects, shape) {
  const parent = objects[shape['parent-id']];
  return !inComponentCopyNotHeadQ(shape) &&
         (!instanceHeadQ(shape) || !inComponentCopyQ(parent));
}

export function validTouchedGroupQ(group) {
  if (ALL_TOUCHED_GROUPS.has(group)) return true;
  if (swapSlotQ(group) && groupToSwapSlot(group) != null) return true;
  return false;
}