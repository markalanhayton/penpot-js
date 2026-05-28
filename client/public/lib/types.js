'use strict';
import { createDefaultContent } from '@penpot/shared/types/text.js';

export const SHAPE_TYPES = [
  'frame', 'group', 'rect', 'circle', 'ellipse', 'path',
  'text', 'image', 'svg-raw', 'bool'
];

export const FILL_TYPES = ['solid', 'linear-gradient', 'radial-gradient', 'image'];
export const STROKE_CAP_TYPES = ['round', 'square', 'butt'];
export const STROKE_JOIN_TYPES = ['round', 'bevel', 'miter'];
export const BLEND_MODES = ['normal', 'darken', 'multiply', 'color-burn', 'lighten', 'screen', 'color-dodge', 'overlay', 'soft-light', 'hard-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];

export function createShape(type, overrides = {}) {
  const isContainer = type === 'frame' || type === 'group' || type === 'bool';
  const base = {
    id: crypto.randomUUID(),
    type,
    name: defaultName(type),
    x: 0, y: 0,
    width: 0, height: 0,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [],
    strokes: [],
    shadows: [],
    constraintsH: 'scale',
    constraintsV: 'scale',
    ...(isContainer ? { shapes: [] } : {}),
  };

  if (type === 'text') {
    base.content = overrides.content || createDefaultContent(overrides.text || 'Text');
    base.fontSize = parseFloat(overrides.fontSize || overrides['font-size'] || '14');
    base.fontFamily = overrides.fontFamily || overrides['font-family'] || 'sourcesanspro';
    base.fontWeight = overrides.fontWeight || overrides['font-weight'] || '400';
    base.fontStyle = overrides.fontStyle || overrides['font-style'] || 'normal';
    base.lineHeight = parseFloat(overrides.lineHeight || overrides['line-height'] || '1.2');
    base.letterSpacing = parseFloat(overrides.letterSpacing || overrides['letter-spacing'] || '0');
    base.textAlign = overrides.textAlign || overrides['text-align'] || 'left';
    base.textDecoration = overrides.textDecoration || overrides['text-decoration'] || 'none';
    base.growType = overrides.growType || overrides['grow-type'] || 'auto-height';
    if (!overrides.fills || overrides.fills.length === 0) {
      base.fills = [{ color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
    }
  }

  return { ...base, ...overrides };
}

function defaultName(type) {
  const names = {
    frame: 'Frame', rect: 'Rectangle', circle: 'Ellipse',
    path: 'Path', text: 'Text', image: 'Image',
    group: 'Group', 'svg-raw': 'SVG', bool: 'Boolean',
  };
  return names[type] || 'Shape';
}

export function createPage(id, name = 'Page 1', overrides = {}) {
  return {
    id: id || crypto.randomUUID(),
    name,
    objects: {},
    shapes: [],
    ...overrides,
  };
}

export function createFile(id, name = 'Untitled', overrides = {}) {
  return {
    id: id || crypto.randomUUID(),
    name,
    projectId: null,
    isShared: false,
    revn: 0,
    features: [],
    fonts: [],
    pages: [],
    pagesIndex: {},
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    ...overrides,
  };
}

export function isFrame(shape) {
  return shape.type === 'frame';
}

export function isGroup(shape) {
  return shape.type === 'group';
}

export function isText(shape) {
  return shape.type === 'text';
}

export function isImage(shape) {
  return shape.type === 'image';
}

export function isPath(shape) {
  return shape.type === 'path';
}

export function isBool(shape) {
  return shape.type === 'bool';
}

export function isRect(shape) {
  return shape.type === 'rect';
}

export const BOOL_TYPES = ['union', 'difference', 'intersection', 'exclude'];

export function createBoolShape(boolType, shapes, headIndex = 0) {
  if (!BOOL_TYPES.includes(boolType)) throw new Error(`Invalid bool type: ${boolType}`);
  if (shapes.length < 2) throw new Error('Boolean operation requires at least 2 shapes');

  const head = shapes[headIndex] || shapes[0];
  const minX = Math.min(...shapes.map(s => s.x));
  const minY = Math.min(...shapes.map(s => s.y));
  const maxX = Math.max(...shapes.map(s => s.x + s.width));
  const maxY = Math.max(...shapes.map(s => s.y + s.height));

  return createShape('bool', {
    name: `Boolean ${boolType}`,
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
    boolType,
    shapes: shapes.map(s => s.id),
    fills: head.fills && head.fills.length > 0 ? [...head.fills] : [],
    strokes: head.strokes && head.strokes.length > 0 ? [...head.strokes] : [],
  });
}

export function isCircle(shape) {
  return shape.type === 'circle' || shape.type === 'ellipse';
}

export function hasChildren(shape) {
  return isFrame(shape) || isGroup(shape);
}

export function getShapeName(shape) {
  return shape.name || defaultName(shape.type);
}

const SHAPE_ICONS = {
  frame: '\u25A1',
  group: '\u2299',
  rect: '\u25AD',
  circle: '\u25CB',
  ellipse: '\u25CB',
  path: '\u270E',
  text: 'T',
  image: '\u25B3',
  'svg-raw': '\u2605',
  bool: '\u2229',
};

export function getShapeIcon(type) {
  return SHAPE_ICONS[type] || '\u25A1';
}