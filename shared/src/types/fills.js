import * as d from '../data.js';
import { raise } from '../exceptions.js';

export const MAX_GRADIENT_STOPS = 256;
export const MAX_FILLS = 256;

export const FILL_ATTRS = new Set([
  'fill-color-ref-file', 'fill-color-ref-id', 'fill-opacity',
  'fill-color', 'fill-color-gradient', 'fill-image'
]);

export const VALID_FILL_ATTRS = new Set(['fill-image', 'fill-color', 'fill-color-gradient']);

export function hasValidFillAttrs(fill) {
  const keys = new Set(Object.keys(fill));
  const intersection = [...keys].filter(k => VALID_FILL_ATTRS.has(k));
  return intersection.length === 1;
}

export function validFill(fill) {
  return hasValidFillAttrs(fill);
}

export function fillsIs(o) {
  return Array.isArray(o);
}

export function coerce(o) {
  if (o == null) return [];
  if (fillsIs(o)) return o;
  if (Array.isArray(o)) return o;
  raise({ type: 'internal', code: 'invalid-type', hint: `cannot coerce ${o} to fills` });
}

export function getImageIds(fills) {
  if (Array.isArray(fills)) {
    const ids = new Set();
    for (const fill of fills) {
      if (fill['fill-image']?.id) ids.add(fill['fill-image'].id);
    }
    return ids;
  }
  return new Set();
}

export function fillsAssoc(fills, position, fill) {
  if (fills == null) return [fill];
  const arr = coerce(fills);
  const copy = [...arr];
  copy[position] = fill;
  return copy;
}

export function fillsUpdate(fills, fn, ...args) {
  const arr = [...(fills || [])];
  const result = fn(arr, ...args);
  return Array.isArray(result) ? result : [];
}

export function fillsCreate(...elements) {
  return [...elements];
}

export function fillsPrepend(fills, fill) {
  return [fill, ...(fills || [])];
}

export function fillToColor(fill) {
  return d.withoutNils({
    color: fill['fill-color'],
    opacity: fill['fill-opacity'],
    gradient: fill['fill-color-gradient'],
    image: fill['fill-image'],
    'ref-id': fill['fill-color-ref-id'],
    'ref-file': fill['fill-color-ref-file']
  });
}