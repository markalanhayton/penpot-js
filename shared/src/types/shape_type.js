import { matrix } from '../geom/matrix.js';
import { point } from '../geom/point.js';
import { makeRect } from '../geom/rect.js';
import { next, zero } from '../uuid.js';
import { defaultColor } from './shape/attrs.js';

const SHAPE_SYMBOL = Symbol('penpot/shape');

export class Shape {
  constructor(attrs) {
    Object.assign(this, attrs);
    this[SHAPE_SYMBOL] = true;
  }
}

export function createShape(attrs) {
  return new Shape(attrs);
}

export function isShape(o) {
  return o != null && o[SHAPE_SYMBOL] === true;
}

export const STROKE_CAPS_LINE = new Set(['round', 'square']);
export const STROKE_CAPS_MARKER = new Set(['line-arrow', 'triangle-arrow', 'square-marker', 'circle-marker', 'diamond-marker']);
export const STROKE_CAPS = new Set([...STROKE_CAPS_LINE, ...STROKE_CAPS_MARKER, null]);

export const SHAPE_TYPES = new Set([
  'frame', 'group', 'bool', 'rect', 'path', 'text', 'circle', 'svg-raw', 'image',
]);

export const BLEND_MODES = new Set([
  'normal', 'darken', 'multiply', 'color-burn', 'lighten', 'screen',
  'color-dodge', 'overlay', 'soft-light', 'hard-light', 'difference',
  'exclusion', 'hue', 'saturation', 'color', 'luminosity',
]);

export const HORIZONTAL_CONSTRAINT_TYPES = new Set(['left', 'right', 'leftright', 'center', 'scale']);
export const VERTICAL_CONSTRAINT_TYPES = new Set(['top', 'bottom', 'topbottom', 'center', 'scale']);
export const TEXT_ALIGN_TYPES = new Set(['left', 'right', 'center', 'justify']);
export const BOOL_TYPES = new Set(['union', 'difference', 'exclude', 'intersection']);
export const GROW_TYPES = new Set(['auto-width', 'auto-height', 'fixed']);

export const VALID_STROKE_ATTRS = new Set(['stroke-image', 'stroke-color', 'stroke-color-gradient']);

export function hasValidStrokeAttrsQ(color) {
  const attrs = new Set(Object.keys(color));
  const intersection = [...attrs].filter((k) => VALID_STROKE_ATTRS.has(k));
  return intersection.length === 1;
}

export function hasImagesQ(shape) {
  return (shape.fills?.some((f) => f['fill-image']) ?? false) ||
         (shape.strokes?.some((s) => s['stroke-image']) ?? false);
}

const ALLOWED_SHAPE_ATTRS = new Set([
  'page-id', 'component-id', 'component-file', 'component-root', 'main-instance',
  'remote-synced', 'shape-ref', 'touched', 'blocked', 'collapsed', 'locked',
  'hidden', 'masked-group', 'fills', 'proportion', 'proportion-lock', 'constraints-h',
  'constraints-v', 'fixed-scroll', 'r1', 'r2', 'r3', 'r4', 'rotation', 'opacity',
  'grids', 'exports', 'strokes', 'blend-mode', 'interactions', 'shadow', 'blur',
  'grow-type', 'applied-tokens', 'plugin-data',
]);

const ALLOWED_SHAPE_GEOM_ATTRS = new Set(['x', 'y', 'width', 'height']);
const ALLOWED_SHAPE_BASE_ATTRS = new Set(['id', 'name', 'type', 'selrect', 'points', 'transform', 'transform-inverse', 'parent-id', 'frame-id']);
const ALLOWED_BOOL_ATTRS = new Set(['shapes', 'bool-type', 'content']);
const ALLOWED_GROUP_ATTRS = new Set(['shapes']);
const ALLOWED_FRAME_ATTRS = new Set(['shapes', 'hide-fill-on-export', 'show-content', 'hide-in-viewer',
  'layout', 'layout-flex-dir', 'layout-gap-type', 'layout-gap',
  'layout-align-items', 'layout-justify-content', 'layout-align-content',
  'layout-wrap-type', 'layout-padding-type', 'layout-padding',
  'layout-grid-dir', 'layout-justify-items', 'layout-grid-columns', 'layout-grid-rows']);
const ALLOWED_IMAGE_ATTRS = new Set(['metadata']);
const ALLOWED_SVG_ATTRS = new Set(['content']);
const ALLOWED_PATH_ATTRS = new Set(['content']);
const ALLOWED_TEXT_ATTRS = new Set(['content']);
const ALLOWED_GENERIC_ATTRS = new Set([...ALLOWED_SHAPE_ATTRS, ...ALLOWED_SHAPE_GEOM_ATTRS, ...ALLOWED_SHAPE_BASE_ATTRS]);

const ALLOWED_ATTRS_BY_TYPE = new Map([
  ['group', new Set([...ALLOWED_GROUP_ATTRS, ...ALLOWED_GENERIC_ATTRS])],
  ['frame', new Set([...ALLOWED_FRAME_ATTRS, ...ALLOWED_GENERIC_ATTRS])],
  ['bool', new Set([...ALLOWED_BOOL_ATTRS, ...ALLOWED_SHAPE_ATTRS, ...ALLOWED_SHAPE_BASE_ATTRS])],
  ['rect', ALLOWED_GENERIC_ATTRS],
  ['circle', ALLOWED_GENERIC_ATTRS],
  ['image', new Set([...ALLOWED_IMAGE_ATTRS, ...ALLOWED_GENERIC_ATTRS])],
  ['svg-raw', new Set([...ALLOWED_SVG_ATTRS, ...ALLOWED_GENERIC_ATTRS])],
  ['path', new Set([...ALLOWED_PATH_ATTRS, ...ALLOWED_SHAPE_ATTRS, ...ALLOWED_SHAPE_BASE_ATTRS])],
  ['text', new Set([...ALLOWED_TEXT_ATTRS, ...ALLOWED_GENERIC_ATTRS])],
]);

export function isAllowedSwitchKeepAttrQ(attr, type) {
  const allowed = ALLOWED_ATTRS_BY_TYPE.get(type);
  return allowed ? allowed.has(attr) : false;
}

const MINIMAL_RECT_ATTRS = {
  type: 'rect',
  name: 'Rectangle',
  fills: [{ 'fill-color': defaultColor, 'fill-opacity': 1 }],
  strokes: [],
  r1: 0, r2: 0, r3: 0, r4: 0,
};

const MINIMAL_IMAGE_ATTRS = {
  type: 'image',
  r1: 0, r2: 0, r3: 0, r4: 0,
  fills: [],
  strokes: [],
};

const MINIMAL_FRAME_ATTRS = {
  'frame-id': zero,
  fills: [{ 'fill-color': '#ffffff', 'fill-opacity': 1 }],
  strokes: [],
  name: 'Board',
  shapes: [],
  r1: 0, r2: 0, r3: 0, r4: 0,
  'hide-fill-on-export': false,
};

const MINIMAL_CIRCLE_ATTRS = {
  type: 'circle',
  name: 'Ellipse',
  fills: [{ 'fill-color': defaultColor, 'fill-opacity': 1 }],
  strokes: [],
};

const MINIMAL_GROUP_ATTRS = {
  type: 'group',
  name: 'Group',
  fills: [],
  strokes: [],
  shapes: [],
};

const MINIMAL_BOOL_ATTRS = {
  type: 'bool',
  name: 'Bool',
  fills: [],
  strokes: [],
  shapes: [],
};

const MINIMAL_TEXT_ATTRS = {
  type: 'text',
  name: 'Text',
};

const MINIMAL_PATH_ATTRS = {
  type: 'path',
  name: 'Path',
  fills: [],
  strokes: [{ 'stroke-style': 'solid', 'stroke-alignment': 'inner', 'stroke-width': 2, 'stroke-color': '#000000', 'stroke-opacity': 1 }],
};

const MINIMAL_SVG_RAW_ATTRS = {
  type: 'svg-raw',
  fills: [],
  strokes: [],
};

const MINIMAL_MULTIPLE_ATTRS = {
  type: 'multiple',
};

const MINIMAL_SHAPE_BY_TYPE = new Map([
  ['rect', MINIMAL_RECT_ATTRS],
  ['image', MINIMAL_IMAGE_ATTRS],
  ['circle', MINIMAL_CIRCLE_ATTRS],
  ['path', MINIMAL_PATH_ATTRS],
  ['frame', MINIMAL_FRAME_ATTRS],
  ['bool', MINIMAL_BOOL_ATTRS],
  ['group', MINIMAL_GROUP_ATTRS],
  ['text', MINIMAL_TEXT_ATTRS],
  ['svg-raw', MINIMAL_SVG_RAW_ATTRS],
  ['multiple', MINIMAL_MULTIPLE_ATTRS],
]);

function getMinimalShape(type) {
  return MINIMAL_SHAPE_BY_TYPE.get(type) ?? {};
}

function makeMinimalShape(type) {
  if (type === 'curve') type = 'path';
  let attrs = { ...getMinimalShape(type) };
  if (type !== 'path' && type !== 'bool') {
    attrs.x = attrs.x ?? 0;
    attrs.y = attrs.y ?? 0;
    attrs.width = attrs.width ?? 0.01;
    attrs.height = attrs.height ?? 0.01;
  }
  attrs.id = next();
  attrs['frame-id'] = zero;
  attrs['parent-id'] = zero;
  attrs.rotation = 0;
  return createShape(attrs);
}

export function setupRect(shape) {
  const selrect = shape.selrect ?? makeRect(shape.x, shape.y, shape.width, shape.height);
  const transform = shape.transform ?? matrix();
  const points = shape.points ?? rectToPoints(selrect, transform);
  return { ...shape, selrect, points, transform, 'transform-inverse': shape['transform-inverse'] ?? matrix() };
}

export function setupShape(props) {
  const type = props.type === 'curve' ? 'path' : props.type;
  let shape = makeMinimalShape(type);
  shape = { ...shape, ...withoutNils(props) };

  if (type === 'bool' || type === 'path') {
    shape = setupRect(shape);
  } else if (type === 'image') {
    shape = setupRect(shape);
    if (shape.metadata) {
      shape.proportion = shape.metadata.width / shape.metadata.height;
      shape['proportion-lock'] = true;
    }
  } else {
    shape = setupRect(shape);
  }

  if (!shape.transform) shape.transform = matrix();
  if (!shape['transform-inverse']) shape['transform-inverse'] = matrix();
  return shape;
}

function withoutNils(data) {
  if (data == null) return data;
  if (Array.isArray(data)) return data;
  if (typeof data !== 'object') return data;
  const result = {};
  for (const [k, v] of Object.entries(data)) {
    if (v != null) result[k] = v;
  }
  return result;
}

function rectToPoints(rect, transform) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const corners = [
    point(rect.x, rect.y),
    point(rect.x + rect.width, rect.y),
    point(rect.x + rect.width, rect.y + rect.height),
    point(rect.x, rect.y + rect.height),
  ];
  return corners;
}

export function processShapeColors(shape, processFn) {
  return shape;
}

export function getAllColors(shape) {
  const colors = [];
  for (const fill of (shape.fills ?? [])) {
    colors.push({ color: fill['fill-color'], opacity: fill['fill-opacity'], gradient: fill['fill-color-gradient'], image: fill['fill-image'],
      'ref-id': fill['fill-color-ref-id'], 'ref-file': fill['fill-color-ref-file'] });
  }
  for (const stroke of (shape.strokes ?? [])) {
    colors.push({ color: stroke['stroke-color'], opacity: stroke['stroke-opacity'], gradient: stroke['stroke-color-gradient'],
      'ref-id': stroke['stroke-color-ref-id'], 'ref-file': stroke['stroke-color-ref-file'] });
  }
  for (const shadow of (shape.shadow ?? [])) {
    if (shadow.color) {
      colors.push({ color: shadow.color.color, opacity: shadow.color.opacity, gradient: shadow.color.gradient,
        'ref-id': shadow.color['ref-id'], 'ref-file': shadow.color['ref-file'] });
    }
  }
  return colors;
}

export function usesLibraryColorQ(shape, libraryId, colorId) {
  const allColors = getAllColors(shape);
  return allColors.some((c) => c['ref-id'] === colorId && c['ref-file'] === libraryId);
}

export function usesLibraryColorsQ(shape, libraryId) {
  const allColors = getAllColors(shape);
  return allColors.some((c) => c['ref-id'] != null && c['ref-file'] === libraryId);
}

export const STROKE_ATTRS = new Set([
  'stroke-color-ref-file', 'stroke-color-ref-id', 'stroke-opacity', 'stroke-style',
  'stroke-width', 'stroke-alignment', 'stroke-cap-start', 'stroke-cap-end',
  'stroke-color', 'stroke-color-gradient', 'stroke-image', 'hidden',
]);