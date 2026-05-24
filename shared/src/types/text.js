import * as d from '../data.js';

export const textTypographyAttrs = ['typography-ref-id', 'typography-ref-file'];

export const textFillAttrs = [
  'fill-color', 'fill-opacity', 'fill-color-ref-id', 'fill-color-ref-file', 'fill-color-gradient',
];

export const textFontAttrs = [
  'font-id', 'font-family', 'font-variant-id', 'font-size', 'font-weight', 'font-style',
];

export const textAlignAttrs = ['text-align'];

export const textDirectionAttrs = ['text-direction'];

export const textSpacingAttrs = ['line-height', 'letter-spacing'];

export const textValignAttrs = ['vertical-align'];

export const textDecorationAttrs = ['text-decoration'];

export const textTransformAttrs = ['text-transform'];

export const textFills = ['fills'];

export const shapeAttrs = ['grow-type'];

export const rootAttrs = [...textValignAttrs];

export const paragraphAttrs = [...textAlignAttrs, ...textDirectionAttrs];

export const textNodeAttrs = [
  ...textTypographyAttrs, ...textFontAttrs, ...textSpacingAttrs,
  ...textDecorationAttrs, ...textTransformAttrs, ...textFills,
];

export const textAllAttrs = new Set([...shapeAttrs, ...rootAttrs, ...paragraphAttrs, ...textNodeAttrs]);

export const textStyleAttrs = [...rootAttrs, ...paragraphAttrs, ...textNodeAttrs];

export const defaultRootAttrs = { 'vertical-align': 'top' };

export const defaultTextFills = [{ 'fill-color': '#000000', 'fill-opacity': 1 }];

export const defaultParagraphAttrs = { 'text-align': 'left', 'text-direction': 'ltr' };

export const defaultTextAttrs = {
  'typography-ref-file': null,
  'typography-ref-id': null,
  'font-id': 'sourcesanspro',
  'font-family': 'sourcesanspro',
  'font-variant-id': 'regular',
  'font-size': '14',
  'font-weight': '400',
  'font-style': 'normal',
  'line-height': '1.2',
  'letter-spacing': '0',
  'text-transform': 'none',
  'text-align': 'left',
  'text-decoration': 'none',
  'text-direction': 'ltr',
};

export function getDefaultTextFills() {
  return defaultTextFills;
}

export function getDefaultTextAttrs() {
  return { ...defaultTextAttrs, fills: getDefaultTextFills() };
}

export const typographyFields = [
  'font-id', 'font-family', 'font-variant-id', 'font-size',
  'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform',
];

export const defaultTypography = {
  ...d.pick(defaultTextAttrs, typographyFields),
  name: 'Source Sans Pro Regular',
};

export function nodeSeq(root, matchQ) {
  const pred = matchQ ?? (() => true);
  const result = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node && typeof node === 'object') {
      if (pred(node)) result.push(node);
      if (Array.isArray(node.children)) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }
  }
  return result.length > 0 ? result : undefined;
}

export function isTextNodeQ(node) {
  return node && node.type === undefined && typeof node.text === 'string';
}

export function isParagraphSetNodeQ(node) {
  return node && node.type === 'paragraph-set';
}

export function isParagraphNodeQ(node) {
  return node && node.type === 'paragraph';
}

export function isRootNodeQ(node) {
  return node && node.type === 'root';
}

export function isNodeQ(node) {
  return isTextNodeQ(node) || isParagraphNodeQ(node) || isParagraphSetNodeQ(node) || isRootNodeQ(node);
}

export function isContentNodeQ(node) {
  return isTextNodeQ(node) || isParagraphNodeQ(node) || isRootNodeQ(node);
}

export function transformNodes(root, predOrTransform, transform) {
  let pred, transformFn;
  if (transform === undefined) {
    pred = () => true;
    transformFn = predOrTransform;
  } else {
    pred = predOrTransform;
    transformFn = transform;
  }

  function walk(item) {
    if (item && typeof item === 'object' && isNodeQ(item)) {
      let result = pred(item) ? transformFn(item) : item;
      if (result && Array.isArray(result.children)) {
        result = { ...result, children: result.children.map(walk) };
      }
      return result;
    }
    return item;
  }

  return walk(root);
}

export function updateTextContent(shape, predFn, updateFn, attrs) {
  const updateAttrsFn = (node) => updateFn(node, attrs);
  const transform = (content) => transformNodes(content, predFn, updateAttrsFn);
  return { ...shape, content: transform(shape.content) };
}

export function generateShapeName(text) {
  return text.slice(0, Math.min(280, text.length));
}

function compareTextContent(a, b, callbacks) {
  if (a === b) return new Set();

  if (typeof a !== typeof b) return new Set(['text-content-structure']);

  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    const allKeys = new Set([...keysA, ...keysB]);
    allKeys.delete('key');

    let acc = new Set();
    for (const k of allKeys) {
      const v1 = a[k];
      const v2 = b[k];

      if (k === 'children') {
        if (!Array.isArray(v1) || !Array.isArray(v2) || v1.length !== v2.length) {
          return new Set(['text-content-structure']);
        }
        for (let i = 0; i < v1.length; i++) {
          const childDiff = compareTextContent(v1[i], v2[i], callbacks);
          acc = new Set([...acc, ...childDiff]);
        }
      } else if (k === 'text') {
        if (v1 !== v2) {
          acc = callbacks.textCb(acc);
        }
      } else {
        if (v1 !== v2) {
          acc = callbacks.attributeCb(acc, k);
        }
      }
    }
    return acc;
  }

  return new Set(['text-content-structure']);
}

export function equalAttrsQ(item, attrs, ignoreQ = true) {
  const itemAttrs = { ...item };
  delete itemAttrs.text;
  delete itemAttrs.type;
  delete itemAttrs.key;
  delete itemAttrs.children;

  const passes = ignoreQ || Object.keys(itemAttrs).length === 0 || JSON.stringify(itemAttrs) === JSON.stringify(attrs);
  if (!passes) return false;

  if (item.children) {
    return item.children.every((child) => equalAttrsQ(child, attrs, false));
  }
  return true;
}

export function getFirstParagraphTextAttrs(content) {
  const first = content?.children?.[0]?.children?.[0];
  if (!first) return {};
  const result = { ...first };
  delete result.text;
  delete result.type;
  delete result.key;
  delete result.children;
  return result;
}

export function getDiffType(a, b) {
  return compareTextContent(a, b, {
    textCb: (acc) => new Set([...acc, 'text-content-text']),
    attributeCb: (acc, _k) => new Set([...acc, 'text-content-attribute']),
  });
}

export function getDiffAttrs(a, b) {
  const diffAttrs = compareTextContent(a, b, {
    textCb: (acc) => acc,
    attributeCb: (acc, attr) => new Set([...acc, attr]),
  });

  if (!diffAttrs.has('text-content-structure')) {
    return diffAttrs;
  }

  const attrs = getFirstParagraphTextAttrs(a);
  if (equalAttrsQ(a, attrs) && equalAttrsQ(b, attrs)) {
    return new Set();
  }

  const result = new Set(diffAttrs);
  result.delete('text-content-structure');
  return result;
}

export function equalStructureQ(a, b) {
  if (typeof a !== typeof b && !(a && b && typeof a === 'object' && typeof b === 'object')) {
    return false;
  }

  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const childrenA = a.children ?? [];
    const childrenB = b.children ?? [];
    if (childrenA.length !== childrenB.length) return false;
    return childrenA.every((c, i) => equalStructureQ(c, childrenB[i]));
  }

  return true;
}

export function copyTextKeys(origin, destiny) {
  if (!origin || typeof origin !== 'object') return destiny;

  const result = {};
  for (const k of Object.keys(destiny)) {
    if (k === 'key') continue;
    if (k === 'children') {
      result[k] = origin.children.map((o, i) => copyTextKeys(o, destiny.children[i]));
    } else if (k === 'text') {
      result[k] = origin.text;
    } else {
      result[k] = destiny[k];
    }
  }
  return result;
}

export function copyAttrsKeys(content, attrs) {
  const result = {};
  for (const [k, v] of Object.entries(content)) {
    if (k === 'children') {
      result[k] = v.map((child) => copyAttrsKeys(child, attrs));
    } else {
      result[k] = attrs.hasOwnProperty(k) ? attrs[k] : v;
    }
  }
  return result;
}

export function contentHasTextQ(content, search) {
  const searchLower = search.toLowerCase();
  const nodes = nodeSeq(content, isTextNodeQ) ?? [];
  return nodes.some((n) => n.text.toLowerCase().includes(searchLower));
}

function replaceAllCaseInsensitive(text, search, replacement) {
  const textLower = text.toLowerCase();
  const searchLower = search.toLowerCase();
  const searchLen = search.length;
  let result = '';
  let idx = 0;

  while (true) {
    const found = textLower.indexOf(searchLower, idx);
    if (found === -1) {
      result += text.slice(idx);
      break;
    }
    result += text.slice(idx, found) + replacement;
    idx = found + searchLen;
  }
  return result;
}

export function replaceTextInContent(content, search, replacement) {
  return transformNodes(
    content,
    isTextNodeQ,
    (node) => ({ ...node, text: replaceAllCaseInsensitive(node.text, search, replacement) })
  );
}

export function contentToText(content) {
  const nodes = nodeSeq(content) ?? [];
  const paragraphs = [];
  let currentParagraph = [];

  for (const node of nodes) {
    if (isParagraphNodeQ(node)) {
      if (currentParagraph.length > 0 || paragraphs.length > 0) {
        paragraphs.push(currentParagraph);
      }
      currentParagraph = [];
    } else if (isTextNodeQ(node)) {
      currentParagraph.push(node.text);
    }
  }
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph);
  }

  return paragraphs.map((p) => p.join('')).join('\n');
}

export function contentToTextPlusStyles(node) {
  const result = [];

  function recStyleTextMap(acc, item, style) {
    const nodeStyle = { ...style, ...d.pick(item, [...textAllAttrs]) };

    let newAcc = acc;
    if (!isTextNodeQ(item)) {
      if (item.children) {
        for (const child of item.children) {
          newAcc = recStyleTextMap(newAcc, child, nodeStyle);
        }
      }
    } else {
      const head = newAcc.length > 0 ? newAcc[0] : [{}, ''];
      const [headStyle, headText] = head;

      if (JSON.stringify(headStyle) !== JSON.stringify(nodeStyle)) {
        newAcc.unshift([nodeStyle, item.text ?? '']);
      } else {
        newAcc[0] = [headStyle, headText + (item.text ?? '')];
      }
    }

    if (item.type === 'paragraph' && newAcc.length > 0) {
      const [hs, ht] = newAcc[0];
      newAcc[0] = [hs, ht + '\n'];
    }

    return newAcc;
  }

  return recStyleTextMap([], node, {}).reverse();
}

export function changeText(content, text, styles = {}) {
  const rootStyles = d.pick(content, rootAttrs);

  const paragraphNodes = nodeSeq(content, isParagraphNodeQ) ?? [];
  const textNodes = nodeSeq(content, isTextNodeQ) ?? [];

  const paragraphStyle = {
    ...defaultTextAttrs,
    ...styles,
    ...d.pick(paragraphNodes[0] ?? {}, [...textAllAttrs]),
  };

  const textStyle = {
    ...defaultTextAttrs,
    ...styles,
    ...d.pick(textNodes[0] ?? {}, [...textAllAttrs]),
  };

  const paragraphTexts = text.split('\n');

  const paragraphs = paragraphTexts.map((pt) => ({
    ...paragraphStyle,
    type: 'paragraph',
    children: [{ ...{ text: pt }, ...textStyle }],
  }));

  return d.patchObject(
    {
      type: 'root',
      children: [{ type: 'paragraph-set', children: paragraphs }],
    },
    rootStyles
  );
}