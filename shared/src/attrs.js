import * as gsh from './geom/shapes/shapes.js';
import * as mth from './math.js';
import * as txt from './types/text.js';

const UNSET = Symbol('unset');

function getAttr(obj, attr) {
  const direct = obj[attr];
  if (direct === 'multiple') return 'multiple';

  if (attr === 'ox' || attr === 'oy') {
    if (direct !== undefined) return direct;
    if (obj.points && obj.points !== 'multiple') {
      const rect = gsh.shapesToRect([obj]);
      return attr === 'ox' ? rect?.x : rect?.y;
    }
    return obj[attr] ?? UNSET;
  }

  if (attr === 'width' || attr === 'height') {
    if (direct !== undefined) return direct;
    if (obj.selrect && obj.selrect !== 'multiple') {
      return obj.selrect[attr];
    }
    return obj[attr] ?? UNSET;
  }

  return obj[attr] ?? UNSET;
}

function defaultEqual(val1, val2) {
  if (typeof val1 === 'number' && typeof val2 === 'number') {
    return mth.close(val1, val2);
  }
  return val1 === val2;
}

export function getAttrsMulti(objs, attrs, eqfn, sel) {
  if (eqfn === undefined) eqfn = defaultEqual;
  if (sel === undefined) sel = (v) => v;

  const result = {};
  for (const attr of attrs) {
    let value = UNSET;

    for (const curr of objs) {
      if (value === 'multiple') break;

      const newVal = getAttr(curr, attr);

      if (newVal === UNSET) continue;
      if (newVal === 'multiple') { value = 'multiple'; continue; }
      if (value === UNSET) { value = sel(newVal); continue; }
      if (eqfn(newVal, value)) continue;

      value = 'multiple';
    }

    if (value !== UNSET) {
      result[attr] = value;
    }
  }

  return result;
}

export function getTextAttrsMulti({ content }, defaults, attrs) {
  const rootAttrsList = attrs.filter((a) => txt.rootAttrs.includes(a));
  const paragraphAttrsList = attrs.filter((a) => txt.paragraphAttrs.includes(a));
  const textNodeAttrsList = attrs.filter((a) => txt.textNodeAttrs.includes(a));

  const rootNodes = txt.nodeSeq(content, txt.isRootNodeQ) ?? [];
  const paragraphNodes = txt.nodeSeq(content, txt.isParagraphNodeQ) ?? [];
  const textNodes = txt.nodeSeq(content, txt.isTextNodeQ) ?? [];

  return {
    ...defaults,
    ...getAttrsMulti(rootNodes, rootAttrsList),
    ...getAttrsMulti(paragraphNodes, paragraphAttrsList),
    ...getAttrsMulti(textNodes, textNodeAttrsList),
  };
}