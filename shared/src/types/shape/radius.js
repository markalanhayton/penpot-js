import { editableAttrs } from './attrs.js';

export function canGetBorderRadius(shape) {
  return shape.type === 'rect' || shape.type === 'frame';
}

export function hasRadius(shape) {
  const attrs = editableAttrs[shape.type];
  return attrs ? attrs.has('r1') : false;
}

export function allEqual(shape) {
  return shape.r1 === shape.r2 && shape.r2 === shape.r3 && shape.r3 === shape.r4;
}

export function radiusMode(shape) {
  return allEqual(shape) ? 'radius-1' : 'radius-4';
}

export function setRadiusToAllCorners(shape, value) {
  if (!canGetBorderRadius(shape)) return shape;
  return { ...shape, r1: value, r2: value, r3: value, r4: value };
}

export function setRadiusToSingleCorner(shape, attr, value) {
  if (!canGetBorderRadius(shape)) return shape;
  let a = attr;
  if (shape['flip-x']) {
    const map = { r1: 'r2', r2: 'r1', r3: 'r4', r4: 'r3' };
    a = map[a] || a;
  }
  if (shape['flip-y']) {
    const map = { r1: 'r4', r2: 'r3', r3: 'r2', r4: 'r1' };
    a = map[a] || a;
  }
  return { ...shape, [a]: value };
}

export function setRadiusForCorners(shape, attrs, value) {
  let result = shape;
  for (const attr of attrs) {
    result = setRadiusToSingleCorner(result, attr, value);
  }
  return result;
}