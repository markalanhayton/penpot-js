import * as gmt from './geom/matrix.js';
import * as gpt from './geom/point.js';
import * as gsh from './geom/shapes/shapes.js';
import * as mth from './math.js';
import * as uuid from './uuid.js';

export const xmlIdRegex = /#([:A-Z_a-z\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][.\-:0-9\xB7A-Z_a-z\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0300-\u036F\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*)/gu;

export const matricesRegex = /(matrix|translate|scale|rotate|skewX|skewY)\(([^\)]*)\)/g;
export const numberRegex = /[+-]?\d*(\.\d+)?([eE][+-]?\d+)?/g;

export const tagsToRemove = new Set([
  'linearGradient', 'radialGradient', 'metadata', 'mask', 'clipPath', 'filter', 'title'
]);

export const svgTags = new Set([
  'a', 'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor',
  'animateMotion', 'animateTransform', 'circle', 'clipPath', 'color-profile',
  'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix',
  'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting',
  'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB',
  'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode',
  'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight',
  'feTile', 'feTurbulence', 'filter', 'font', 'font-face', 'font-face-format',
  'font-face-name', 'font-face-src', 'font-face-uri', 'foreignObject', 'g',
  'glyph', 'glyphRef', 'hkern', 'image', 'line', 'linearGradient', 'marker',
  'mask', 'metadata', 'missing-glyph', 'mpath', 'path', 'pattern', 'polygon',
  'polyline', 'radialGradient', 'rect', 'set', 'stop', 'style', 'svg', 'switch',
  'symbol', 'text', 'textPath', 'title', 'tref', 'tspan', 'use', 'view', 'vkern'
]);

export const svgAttrs = new Set([
  'accent-height', 'accumulate', 'additive', 'alphabetic', 'amplitude',
  'arabic-form', 'ascent', 'attributeName', 'attributeType', 'azimuth',
  'baseFrequency', 'baseProfile', 'bbox', 'begin', 'bias', 'by', 'calcMode',
  'cap-height', 'class', 'clipPathUnits', 'contentScriptType',
  'contentStyleType', 'cx', 'cy', 'd', 'descent', 'diffuseConstant', 'divisor',
  'dur', 'dx', 'dy', 'edgeMode', 'elevation', 'end', 'exponent',
  'externalResourcesRequired', 'fill', 'filterRes', 'filterUnits', 'font-family',
  'font-size', 'font-stretch', 'font-style', 'font-variant', 'font-weight',
  'format', 'from', 'fx', 'fy', 'g1', 'g2', 'glyph-name', 'glyphRef',
  'gradientTransform', 'gradientUnits', 'hanging', 'height', 'horiz-adv-x',
  'horiz-origin-x', 'horiz-origin-y', 'id', 'ideographic', 'in', 'in2',
  'intercept', 'k', 'k1', 'k2', 'k3', 'k4', 'kernelMatrix', 'kernelUnitLength',
  'keyPoints', 'keySplines', 'keyTimes', 'lang', 'lengthAdjust',
  'limitingConeAngle', 'local', 'markerHeight', 'markerUnits', 'markerWidth',
  'maskContentUnits', 'maskUnits', 'mathematical', 'max', 'media', 'method',
  'min', 'mode', 'name', 'numOctaves', 'offset', 'operator', 'order', 'orient',
  'orientation', 'origin', 'overline-position', 'overline-thickness', 'panose-1',
  'path', 'pathLength', 'patternContentUnits', 'patternTransform', 'patternUnits',
  'points', 'pointsAtX', 'pointsAtY', 'pointsAtZ', 'preserveAlpha',
  'preserveAspectRatio', 'primitiveUnits', 'r', 'radius', 'refX', 'refY',
  'rendering-intent', 'repeatCount', 'repeatDur', 'requiredExtensions',
  'requiredFeatures', 'restart', 'result', 'rotate', 'rx', 'ry', 'scale', 'seed',
  'slope', 'spacing', 'specularConstant', 'specularExponent', 'spreadMethod',
  'startOffset', 'stdDeviation', 'stemh', 'stemv', 'stitchTiles',
  'strikethrough-position', 'strikethrough-thickness', 'string', 'style',
  'surfaceScale', 'systemLanguage', 'tableValues', 'target', 'targetX', 'targetY',
  'textLength', 'title', 'to', 'transform', 'type', 'u1', 'u2',
  'underline-position', 'underline-thickness', 'unicode', 'unicode-range',
  'units-per-em', 'v-alphabetic', 'v-hanging', 'v-ideographic', 'v-mathematical',
  'values', 'version', 'vert-adv-y', 'vert-origin-x', 'vert-origin-y', 'viewBox',
  'viewTarget', 'width', 'widths', 'x', 'x-height', 'x1', 'x2',
  'xChannelSelector', 'xmlns:xlink', 'xlink:actuate', 'xlink:arcrole',
  'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type',
  'xml:base', 'xml:lang', 'xml:space', 'y', 'y1', 'y2', 'yChannelSelector', 'z',
  'zoomAndPan'
]);

export const svgPresentationAttrs = new Set([
  'alignment-baseline', 'baseline-shift', 'clip-path', 'clip-rule', 'clip',
  'color-interpolation-filters', 'color-interpolation', 'color-profile',
  'color-rendering', 'color', 'cursor', 'direction', 'display',
  'dominant-baseline', 'enable-background', 'fill-opacity', 'fill-rule', 'fill',
  'filter', 'flood-color', 'flood-opacity', 'font-family', 'font-size-adjust',
  'font-size', 'font-stretch', 'font-style', 'font-variant', 'font-weight',
  'glyph-orientation-horizontal', 'glyph-orientation-vertical',
  'image-rendering', 'kerning', 'letter-spacing', 'lighting-color',
  'marker-end', 'marker-mid', 'marker-start', 'mask', 'opacity', 'overflow',
  'pointer-events', 'shape-rendering', 'stop-color', 'stop-opacity',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'stroke',
  'text-anchor', 'text-decoration', 'text-rendering', 'unicode-bidi',
  'visibility', 'word-spacing', 'writing-mode', 'mask-type'
]);

export const inheritableProps = new Set([
  'style', 'clip-rule', 'color', 'color-interpolation',
  'color-interpolation-filters', 'color-profile', 'color-rendering', 'cursor',
  'direction', 'dominant-baseline', 'fill', 'fill-opacity', 'fill-rule',
  'font', 'font-family', 'font-size', 'font-size-adjust', 'font-stretch',
  'font-style', 'font-variant', 'font-weight', 'glyph-orientation-horizontal',
  'glyph-orientation-vertical', 'image-rendering', 'letter-spacing', 'marker',
  'marker-end', 'marker-mid', 'marker-start', 'paint-order', 'pointer-events',
  'shape-rendering', 'stroke', 'stroke-dasharray', 'stroke-dashoffset',
  'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity',
  'stroke-width', 'text-anchor', 'text-rendering', 'transform', 'visibility',
  'word-spacing', 'writing-mode'
]);

export const gradientTags = new Set(['linearGradient', 'radialGradient']);

export const filterTags = new Set([
  'filter', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite',
  'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feFlood',
  'feGaussianBlur', 'feImage', 'feMerge', 'feMorphology', 'feOffset',
  'feSpecularLighting', 'feTile', 'feTurbulence'
]);

export const parentTags = new Set(['g', 'svg', 'text', 'tspan']);

export const svgGroupSafeTags = new Set([
  'animate', 'animateColor', 'animateMotion', 'animateTransform', 'set', 'desc',
  'metadata', 'title', 'circle', 'ellipse', 'line', 'path', 'polygon',
  'polyline', 'rect', 'defs', 'g', 'svg', 'symbol', 'use', 'linearGradient',
  'radialGradient', 'a', 'altGlyphDef', 'clipPath', 'color-profile', 'cursor',
  'filter', 'font', 'font-face', 'foreignObject', 'image', 'marker', 'mask',
  'pattern', 'style', 'switch', 'text', 'view'
]);

export function camelize(s) {
  if (typeof s !== 'string') return null;
  const vendor = s.startsWith('-');
  let result = s.replace(':', '-').replace(/-./g, (x) => x[1].toUpperCase());
  if (vendor) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

export function propKey(k) {
  if (typeof k === 'string' || typeof k === 'number') {
    k = String(k);
  } else {
    return null;
  }
  if (k === '' || k == null) return null;
  if (k === 'class') return 'className';
  if (k === 'for') return 'htmlFor';
  const kn1 = k.charAt(0);
  if (kn1 === kn1.toUpperCase()) {
    const camel = camelize(k);
    return camel ? camel.charAt(0).toUpperCase() + camel.slice(1) : null;
  }
  return camelize(k);
}

export const svgProps = new Set([
  ...[...svgAttrs].map(propKey),
  ...[...svgPresentationAttrs].map(propKey)
].filter((k) => k != null));

export function parseStyle(style) {
  const result = {};
  const items = style.split(';');
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const k = trimmed.slice(0, colonIdx).trim();
    const v = trimmed.slice(colonIdx + 1).trim();
    if (k && !(k in result)) {
      result[k] = v;
    }
  }
  return result;
}

export function formatStyles(attrs) {
  if (!('style' in attrs)) return attrs;
  const style = attrs.style;
  if (typeof style === 'string') {
    return { ...attrs, style: parseStyle(style) };
  }
  return attrs;
}

export function attrsToProps(attrs, whitelist = true) {
  const result = {};
  for (const [k, v] of Object.entries(attrs)) {
    const pk = propKey(k);
    if (pk == null) continue;
    if (v == null) continue;
    if (pk === 'style') {
      const sv = typeof v === 'string' ? parseStyle(v) : v;
      const converted = attrsToProps(sv, false);
      if (Object.keys(converted).length > 0) {
        result[pk] = converted;
      }
    } else {
      if (!whitelist || svgProps.has(pk)) {
        result[pk] = typeof v === 'string' ? v.trim() : v;
      }
    }
  }
  return result;
}

export function extractIds(val) {
  if (typeof val === 'string') {
    const results = [];
    const regex = new RegExp(xmlIdRegex.source, xmlIdRegex.flags);
    let m;
    while ((m = regex.exec(val)) !== null) {
      results.push(m[1]);
    }
    return results;
  }
  if (Array.isArray(val)) {
    return val.flatMap(extractIds);
  }
  return [];
}

export function fixDotNumber(numStr) {
  if (numStr.startsWith('.')) {
    return '0' + numStr;
  }
  if (numStr.startsWith('-.')) {
    return '-0' + numStr.slice(1);
  }
  return numStr;
}

export function parseNumbers(data) {
  const matches = data.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
  if (!matches) return [];
  const results = [];
  for (const s of matches) {
    const parsed = parseFloat(s);
    if (!Number.isNaN(parsed)) {
      results.push(parsed);
    }
  }
  return results;
}

function formatTranslateParams(params) {
  if (params.length === 1) {
    return [gpt.point(params[0], 0)];
  }
  return [gpt.point(params[0], params[1])];
}

function formatScaleParams(params) {
  if (params.length === 1) {
    return [gpt.point(params[0])];
  }
  return [gpt.point(params[0], params[1])];
}

function formatRotateParams(params) {
  if (params.length === 1) {
    return [params[0], gpt.point(0, 0)];
  }
  return [params[0], gpt.point(params[1], params[2])];
}

function formatSkewXParams(params) {
  return [params[0], 0];
}

function formatSkewYParams(params) {
  return [0, params[0]];
}

function toMatrix(type, params) {
  switch (type) {
    case 'matrix':
      return gmt.matrix(...params);
    case 'translate':
      return gmt.translateMatrix(...formatTranslateParams(params));
    case 'scale':
      return gmt.scaleMatrix(...formatScaleParams(params));
    case 'rotate':
      return gmt.rotateMatrix(...formatRotateParams(params));
    case 'skewX':
      return gmt.skewMatrix(...formatSkewXParams(params));
    case 'skewY':
      return gmt.skewMatrix(...formatSkewYParams(params));
    default:
      return gmt.matrix();
  }
}

export function parseTransform(transform) {
  if (typeof transform !== 'string') return gmt.matrix();
  const regex = new RegExp(matricesRegex.source, matricesRegex.flags);
  const matrices = [];
  let m;
  while ((m = regex.exec(transform)) !== null) {
    const type = m[1];
    const paramsStr = m[2];
    const params = parseNumbers(paramsStr);
    matrices.push(toMatrix(type, params));
  }
  return matrices.reduce((acc, mtx) => gmt.multiply(acc, mtx), gmt.matrix());
}

export function formatMove([x, y]) {
  return `M${x} ${y}`;
}

export function formatLine([x, y]) {
  return `L${x} ${y}`;
}

export function pointsToPath(pointsStr) {
  const nums = parseNumbers(pointsStr);
  const points = [];
  for (let i = 0; i < nums.length; i += 2) {
    points.push([nums[i], nums[i + 1]]);
  }
  if (points.length === 0) return '';
  const head = points[0];
  const other = points.slice(1);
  return formatMove(head) + other.map(formatLine).join('');
}

export function polylineToPath(node) {
  const attrs = { ...node.attrs };
  const pointsStr = attrs.points;
  delete attrs.points;
  attrs.d = pointsToPath(pointsStr);
  return { ...node, attrs, tag: 'path' };
}

export function polygonToPath(node) {
  const attrs = { ...node.attrs };
  const pointsStr = attrs.points;
  delete attrs.points;
  attrs.d = pointsToPath(pointsStr) + 'Z';
  return { ...node, attrs, tag: 'path' };
}

export function lineToPath(node) {
  const attrs = { ...node.attrs };
  const x1 = attrs.x1 ?? 0;
  const y1 = attrs.y1 ?? 0;
  const x2 = attrs.x2 ?? 0;
  const y2 = attrs.y2 ?? 0;
  delete attrs.x1;
  delete attrs.x2;
  delete attrs.y1;
  delete attrs.y2;
  attrs.d = `M${x1},${y1} L${x2},${y2}`;
  return { ...node, attrs, tag: 'path' };
}

export function addTransform(attrs, transform) {
  if (!transform) return attrs;
  const oldTransform = attrs.transform;
  const newTransform = (!oldTransform || oldTransform === '')
    ? transform
    : `${transform} ${oldTransform}`;
  return { ...attrs, transform: newTransform };
}

export function inheritAttributes(groupAttrs, node) {
  if (node == null || typeof node !== 'object') return node;
  let attrs = formatStyles(node.attrs ?? {});
  attrs = addTransform(attrs, groupAttrs.transform);
  const groupAttrsFormatted = formatStyles(groupAttrs);

  const inheritStyle = groupAttrsFormatted.style != null
    ? { ...groupAttrsFormatted.style }
    : {};
  if (attrs.style) {
    for (const k of Object.keys(attrs.style)) {
      delete inheritStyle[k];
    }
  }

  const inheritable = [...inheritableProps].filter((p) => !(p in attrs));
  const groupInheritable = {};
  for (const k of inheritable) {
    if (k in groupAttrsFormatted) {
      groupInheritable[k] = groupAttrsFormatted[k];
    }
  }
  if (Object.keys(inheritStyle).length > 0) {
    groupInheritable.style = inheritStyle;
  }

  let merged = { ...groupInheritable, ...attrs };
  for (const k of Object.keys(merged)) {
    if (merged[k] == null) delete merged[k];
  }
  return { ...node, attrs: merged };
}

export function mapNodes(mapfn, node) {
  if (node == null || typeof node !== 'object') return node;
  let result = mapfn(node);
  if (result.content != null && Array.isArray(result.content)) {
    result = { ...result, content: result.content.map((child) => mapNodes(mapfn, child)) };
  }
  return result;
}

export function reduceNodes(redfn, value, node) {
  if (node == null || typeof node !== 'object') return value;
  let result = redfn(value, node);
  if (node.content != null && Array.isArray(node.content)) {
    for (const child of node.content) {
      result = reduceNodes(redfn, result, child);
    }
  }
  return result;
}

export function calculateRatio(width, height) {
  return mth.hypot(width, height) / mth.sqrt(2);
}