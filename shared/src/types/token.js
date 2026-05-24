const TOKEN_NAME_RE = /^[a-zA-Z0-9_-][a-zA-Z0-9$_-]*(\.[a-zA-Z0-9$_-]+)*$/;
const TOKEN_REF_RE = /^\{[a-zA-Z0-9_-][a-zA-Z0-9$_-]*(\.[a-zA-Z0-9$_-]+)*\}$/;

export const tokenTypeToDtcg = {
  'boolean': 'boolean',
  'border-radius': 'borderRadius',
  'color': 'color',
  'dimensions': 'dimension',
  'font-family': 'fontFamilies',
  'font-size': 'fontSizes',
  'font-weight': 'fontWeights',
  'letter-spacing': 'letterSpacing',
  'number': 'number',
  'opacity': 'opacity',
  'other': 'other',
  'rotation': 'rotation',
  'shadow': 'shadow',
  'sizing': 'sizing',
  'spacing': 'spacing',
  'string': 'string',
  'stroke-width': 'borderWidth',
  'text-case': 'textCase',
  'text-decoration': 'textDecoration',
  'typography': 'typography',
};

export const dtcgToTokenType = Object.fromEntries(
  Object.entries(tokenTypeToDtcg).map(([k, v]) => [v, k])
);
dtcgToTokenType['fontWeight'] = 'font-weight';
dtcgToTokenType['fontSize'] = 'font-size';
dtcgToTokenType['fontFamily'] = 'font-family';
dtcgToTokenType['boxShadow'] = 'shadow';

export const compositeTokenTypeToDtcg = { ...tokenTypeToDtcg, 'line-height': 'lineHeights' };
export const compositeDtcgToTokenType = { ...dtcgToTokenType, 'lineHeights': 'line-height', 'lineHeight': 'line-height' };

export const tokenTypes = new Set(Object.keys(tokenTypeToDtcg));

export const borderRadiusKeys = new Set(['r1', 'r2', 'r3', 'r4']);
export const colorKeys = new Set(['fill', 'stroke-color']);
export const sizingBaseKeys = new Set(['width', 'height']);
export const sizingLayoutItemKeys = new Set(['layout-item-min-w', 'layout-item-max-w', 'layout-item-min-h', 'layout-item-max-h']);
export const sizingKeys = new Set([...sizingBaseKeys, ...sizingLayoutItemKeys]);
export const spacingGapKeys = new Set(['row-gap', 'column-gap']);
export const spacingPaddingKeys = new Set(['p1', 'p2', 'p3', 'p4']);
export const spacingGapPaddingKeys = new Set([...spacingGapKeys, ...spacingPaddingKeys]);
export const spacingMarginKeys = new Set(['m1', 'm2', 'm3', 'm4']);
export const spacingKeys = new Set([...spacingGapKeys, ...spacingPaddingKeys, ...spacingMarginKeys]);
export const strokeWidthKeys = new Set(['stroke-width']);
export const dimensionsKeys = new Set([...sizingKeys, ...spacingKeys, ...strokeWidthKeys, ...borderRadiusKeys]);
export const fontFamilyKeys = new Set(['font-family']);
export const fontSizeKeys = new Set(['font-size']);
export const fontWeightKeys = new Set(['font-weight']);
export const letterSpacingKeys = new Set(['letter-spacing']);
export const lineHeightKeys = new Set(['line-height']);
export const typographyTokenKeys = new Set(['typography']);
export const typographyKeys = new Set([...fontFamilyKeys, ...fontSizeKeys, ...fontWeightKeys, ...letterSpacingKeys, ...lineHeightKeys, ...typographyTokenKeys, ...new Set(['text-case', 'text-decoration'])]);
export const rotationKeys = new Set(['rotation']);
export const numberKeys = new Set([...lineHeightKeys, ...rotationKeys]);
export const opacityKeys = new Set(['opacity']);
export const shadowKeys = new Set(['shadow']);
export const textCaseKeys = new Set(['text-case']);
export const textDecorationKeys = new Set(['text-decoration']);
export const axisKeys = new Set(['x', 'y']);

export const allKeys = new Set([...axisKeys, ...borderRadiusKeys, ...colorKeys, ...dimensionsKeys, ...numberKeys, ...opacityKeys, ...rotationKeys, ...shadowKeys, ...sizingKeys, ...spacingKeys, ...strokeWidthKeys, ...typographyKeys, ...typographyTokenKeys]);

const positionAttributes = new Set(['x', 'y']);
const genericAttributes = new Set([...colorKeys, ...strokeWidthKeys, ...rotationKeys, ...sizingKeys, ...opacityKeys, ...shadowKeys, ...positionAttributes]);
const rectAttributes = new Set([...genericAttributes, ...borderRadiusKeys]);
const frameWithLayoutAttributes = new Set([...rectAttributes, ...spacingGapPaddingKeys]);
const textAttributes = new Set([...genericAttributes, ...typographyKeys, ...numberKeys]);

export function shapeTypeToAttributes(type, isLayout) {
  switch (type) {
    case 'bool': return genericAttributes;
    case 'circle': return genericAttributes;
    case 'rect': return rectAttributes;
    case 'frame': return isLayout ? frameWithLayoutAttributes : rectAttributes;
    case 'image': return rectAttributes;
    case 'path': return genericAttributes;
    case 'svg-raw': return genericAttributes;
    case 'text': return textAttributes;
    default: return null;
  }
}

export function appliableAttrsForShape(attributes, shapeType, isLayout) {
  const validAttrs = shapeTypeToAttributes(shapeType, isLayout);
  if (!validAttrs) return new Set();
  const result = new Set();
  for (const attr of attributes) {
    if (validAttrs.has(attr)) result.add(attr);
  }
  return result;
}

export function anyAppliableAttrForShapeQ(attributes, tokenType, isLayout) {
  const validAttrs = shapeTypeToAttributes(tokenType, isLayout);
  if (!validAttrs) return false;
  for (const attr of attributes) {
    if (validAttrs.has(attr)) return true;
  }
  return false;
}

export const attrsInTextContent = new Set([...typographyKeys, 'fill']);

export const tokensByInput = {
  'width': ['sizing', 'dimensions'],
  'height': ['sizing', 'dimensions'],
  'max-width': ['sizing', 'dimensions'],
  'max-height': ['sizing', 'dimensions'],
  'min-width': ['sizing', 'dimensions'],
  'min-height': ['sizing', 'dimensions'],
  'x': ['dimensions'],
  'y': ['dimensions'],
  'rotation': ['rotation', 'number'],
  'border-radius': ['border-radius', 'dimensions'],
  'row-gap': ['spacing', 'dimensions'],
  'column-gap': ['spacing', 'dimensions'],
  'horizontal-padding': ['spacing', 'dimensions'],
  'vertical-padding': ['spacing', 'dimensions'],
  'sided-paddings': ['spacing', 'dimensions'],
  'horizontal-margin': ['spacing', 'dimensions'],
  'vertical-margin': ['spacing', 'dimensions'],
  'sided-margins': ['spacing', 'dimensions'],
  'line-height': ['line-height', 'number'],
  'opacity': ['opacity'],
  'stroke-width': ['stroke-width', 'dimensions'],
  'font-size': ['font-size'],
  'font-weight': ['font-weight'],
  'text-decoration': ['text-decoration'],
  'text-case': ['text-case'],
  'letter-spacing': ['letter-spacing'],
  'dimensions': ['dimensions'],
  'fill': ['color'],
  'stroke-color': ['color'],
  'typography': ['typography'],
  'number': ['number'],
  'sizing': ['sizing', 'dimensions'],
  'spacing': ['spacing', 'dimensions'],
};

export function tokenAttrQ(attr) {
  return allKeys.has(attr);
}

export function tokenAttrToShapeAttr(tokenAttr) {
  switch (tokenAttr) {
    case 'fill': return 'fills';
    case 'stroke-color': return 'strokes';
    case 'stroke-width': return 'strokes';
    default: return tokenAttr;
  }
}

export function shapeAttrToTokenAttrs(shapeAttr, changedSubAttr) {
  if (shapeAttr === 'fills') return new Set(['fill']);
  if (shapeAttr === 'strokes' && changedSubAttr == null) return new Set(['stroke-width', 'stroke-color']);
  if (shapeAttr === 'strokes') {
    if (changedSubAttr?.includes('stroke-color')) return new Set(['stroke-color']);
    if (changedSubAttr?.includes('stroke-width')) return new Set(['stroke-width']);
  }
  if (shapeAttr === 'layout-padding') {
    return changedSubAttr?.length ? new Set(changedSubAttr) : new Set(['p1', 'p2', 'p3', 'p4']);
  }
  if (shapeAttr === 'layout-item-margin') {
    return changedSubAttr?.length ? new Set(changedSubAttr) : new Set(['m1', 'm2', 'm3', 'm4']);
  }
  if (fontSizeKeys.has(shapeAttr)) return new Set([shapeAttr, 'typography']);
  if (letterSpacingKeys.has(shapeAttr)) return new Set([shapeAttr, 'typography']);
  if (fontFamilyKeys.has(shapeAttr)) return new Set([shapeAttr, 'typography']);
  if (shapeAttr === 'line-height') return new Set(['line-height', 'typography']);
  if (shapeAttr === 'text-transform') return new Set(['text-case', 'typography']);
  if (textDecorationKeys.has(shapeAttr)) return new Set([shapeAttr, 'typography']);
  if (fontWeightKeys.has(shapeAttr)) return new Set([shapeAttr, 'typography']);
  if (borderRadiusKeys.has(shapeAttr)) return new Set([shapeAttr]);
  if (shadowKeys.has(shapeAttr)) return new Set([shapeAttr]);
  if (sizingKeys.has(shapeAttr)) return new Set([shapeAttr]);
  if (opacityKeys.has(shapeAttr)) return new Set([shapeAttr]);
  if (spacingKeys.has(shapeAttr)) return new Set([shapeAttr]);
  if (rotationKeys.has(shapeAttr)) return new Set([shapeAttr]);
  if (numberKeys.has(shapeAttr)) return new Set([shapeAttr]);
  if (axisKeys.has(shapeAttr)) return new Set([shapeAttr]);
  return new Set();
}

function generateAttrMap(token, attributes) {
  const result = {};
  for (const attr of attributes) {
    result[attr] = token.name;
  }
  return result;
}

export function applyTokenToShape({ shape, token, attributes }) {
  const mapToApply = generateAttrMap(token, attributes);
  return { ...shape, 'applied-tokens': { ...(shape['applied-tokens'] ?? {}), ...mapToApply } };
}

export function unapplyTokensFromShape(shape, attributes) {
  const appliedTokens = { ...(shape['applied-tokens'] ?? {}) };
  for (const attr of attributes) {
    delete appliedTokens[attr];
  }
  return { ...shape, 'applied-tokens': appliedTokens };
}

export function unapplyLayoutItemTokens(shape) {
  return unapplyTokensFromShape(shape, [...sizingLayoutItemKeys, ...spacingMarginKeys]);
}

export function findTokenValueReferences(tokenValue) {
  if (typeof tokenValue !== 'string') return new Set();
  const refs = new Set();
  const re = /\{([^}]*)\}/g;
  let match;
  while ((match = re.exec(tokenValue)) !== null) {
    refs.add(match[1]);
  }
  return refs;
}

export function tokenValueSelfReferenceQ(tokenName, tokenValue) {
  const refs = findTokenValueReferences(tokenValue);
  return refs.has(tokenName);
}

export function referencesTokenQ(value, tokenName) {
  if (typeof value === 'string') return findTokenValueReferences(value).has(tokenName);
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).some((v) => referencesTokenQ(v, tokenName));
  }
  if (Array.isArray(value)) return value.some((v) => referencesTokenQ(v, tokenName));
  return false;
}

export function compositeTokenReferenceQ(tokenValue) {
  return typeof tokenValue === 'string';
}

export function updateTokenValueReferences(value, oldName, newName) {
  if (typeof value === 'string') {
    const escaped = oldName.replace(/\./g, '\\.');
    return value.replace(new RegExp(`\\{${escaped}\\}`, 'g'), `{${newName}}`);
  }
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = updateTokenValueReferences(v, oldName, newName);
    }
    return result;
  }
  if (Array.isArray(value)) return value.map((v) => updateTokenValueReferences(v, oldName, newName));
  return value;
}

export const textDecorationValues = new Set(['none', 'underline', 'strike-through']);

export function validTextDecoration(value) {
  const normalized = String(value).trim().toLowerCase();
  return textDecorationValues.has(normalized) ? normalized : null;
}

export const fontWeightAliases = {
  '100': new Set(['thin', 'hairline']),
  '200': new Set(['ultra light', 'extralight', 'extraleicht', 'extra-light', 'ultra-light', 'ultralight', 'extra light']),
  '300': new Set(['light', 'leicht']),
  '400': new Set(['book', 'normal', 'buch', 'regular']),
  '500': new Set(['kräftig', 'medium', 'kraeftig']),
  '600': new Set(['demi-bold', 'halbfett', 'demibold', 'demi bold', 'semibold', 'semi bold', 'semi-bold']),
  '700': new Set(['dreiviertelfett', 'bold']),
  '800': new Set(['extrabold', 'fett', 'extra-bold', 'ultrabold', 'ultra-bold', 'extra bold', 'ultra bold']),
  '900': new Set(['heavy', 'black', 'extrafett']),
  '950': new Set(['extra-black', 'extra black', 'ultra-black', 'ultra black']),
};

export const fontWeightValues = new Set(Object.keys(fontWeightAliases));

export const fontWeightMap = {};
for (const [weight, aliases] of Object.entries(fontWeightAliases)) {
  for (const alias of aliases) {
    fontWeightMap[alias] = weight;
  }
}

export function parseFontWeight(fontWeight) {
  const str = String(fontWeight).toLowerCase();
  const match = str.match(/^(.+?)\s*(italic)?$/);
  if (!match) return { variant: str, italicQ: false };
  return { variant: match[1], italicQ: match[2] != null };
}

export function validFontWeightVariant(value) {
  const { variant, italicQ } = parseFontWeight(value);
  const weight = fontWeightMap[variant] ?? variant;
  if (!fontWeightValues.has(weight)) return null;
  const result = { weight };
  if (italicQ) result.style = 'italic';
  return result;
}

export function splitFontFamily(fontValue) {
  return fontValue.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

export function joinFontFamily(fontFamilies) {
  return fontFamilies.join(', ');
}

function insideRefQ(value, position) {
  const left = value.slice(0, position);
  const lastOpen = left.lastIndexOf('{');
  const lastClose = left.lastIndexOf('}');
  return lastOpen !== -1 && (lastClose === -1 || lastClose < lastOpen);
}

function blockOpenStart(value, position) {
  const left = value.slice(0, position);
  let i = left.lastIndexOf('{');
  if (i === -1) return null;
  while (i > 0 && value[i - 1] === '{') i--;
  return i;
}

function insideClosedRefQ(value, position) {
  const left = value.slice(0, position);
  const right = value.slice(position);
  const openPos = left.lastIndexOf('{');
  const closePos = right.indexOf('}');
  const lastSpaceLeft = left.lastIndexOf(' ');
  const firstSpaceRight = right.indexOf(' ');
  return openPos !== -1 && closePos !== -1
    && (lastSpaceLeft === -1 || openPos > lastSpaceLeft)
    && (firstSpaceRight === -1 || closePos < firstSpaceRight);
}

function buildResult(value, prefixEnd, suffixStart, name) {
  const ref = `{${name}}`;
  const firstPart = value.slice(0, prefixEnd);
  const secondPart = value.slice(suffixStart);
  return { value: firstPart + ref + secondPart, cursor: firstPart.length + ref.length };
}

export function insertRef(value, position, name) {
  if (insideRefQ(value, position)) {
    if (insideClosedRefQ(value, position)) {
      const openPos = value.slice(0, position).lastIndexOf('{');
      let closePos = position + value.slice(position).indexOf('}');
      if (closePos < position) closePos = position;
      return buildResult(value, openPos, closePos + 1, name);
    }
    return buildResult(value, blockOpenStart(value, position) ?? position, position, name);
  }
  return buildResult(value, position, position, name);
}

export const tokenNameValidationRegex = TOKEN_NAME_RE;
export const tokenRefValidationRegex = TOKEN_REF_RE;