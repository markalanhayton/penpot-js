export const FONT_TYPES = new Set([
  'font/ttf',
  'font/woff',
  'font/woff2',
  'font/otf'
]);

export const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
]);

const FORMAT_TO_EXTENSION = new Map([
  ['png', '.png'],
  ['jpeg', '.jpg'],
  ['webp', '.webp'],
  ['gif', '.gif'],
  ['svg', '.svg'],
]);

export function formatToExtension(format) {
  return FORMAT_TO_EXTENSION.get(format);
}

const FORMAT_TO_MTYPE = new Map([
  ['png', 'image/png'],
  ['jpeg', 'image/jpeg'],
  ['jpg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
  ['svg', 'image/svg+xml'],
]);

export function formatToMtype(format) {
  return FORMAT_TO_MTYPE.get(format) ?? 'application/octet-stream';
}

const MTYPE_TO_FORMAT = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpeg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/svg+xml', 'svg'],
]);

export function mtypeToFormat(mtype) {
  return MTYPE_TO_FORMAT.get(mtype);
}

const MTYPE_TO_EXTENSION = new Map([
  ['image/apng', '.apng'],
  ['image/avif', '.avif'],
  ['image/gif', '.gif'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/svg+xml', '.svg'],
  ['image/webp', '.webp'],
  ['application/zip', '.zip'],
  ['application/penpot', '.penpot'],
  ['application/pdf', '.pdf'],
  ['text/plain', '.txt'],
  ['font/woff', '.woff'],
  ['font/woff2', '.woff2'],
  ['font/ttf', '.ttf'],
  ['font/otf', '.otf'],
  ['application/octet-stream', '.bin'],
]);

export function mtypeToExtension(mtype) {
  return MTYPE_TO_EXTENSION.get(mtype);
}

const FONT_WEIGHT_TO_NAME = new Map([
  [100, 'Hairline'],
  [200, 'Extra Light'],
  [300, 'Light'],
  [400, 'Regular'],
  [500, 'Medium'],
  [600, 'Semi Bold'],
  [700, 'Bold'],
  [800, 'Extra Bold'],
  [900, 'Black'],
  [950, 'Extra Black'],
]);

export function fontWeightToName(weight) {
  return FONT_WEIGHT_TO_NAME.get(weight) ?? 'Regular';
}

const IMAGE_EXT_RE = /(\.png)|(\.jpg)|(\.jpeg)|(\.webp)|(\.gif)|(\.svg)$/;

export function stripImageExtension(filename) {
  return filename.replace(IMAGE_EXT_RE, '');
}

export function parseFontWeight(variant) {
  if (/(?:^|[-_\s])(hairline|thin)(?=(?:[-_\s]|$|italic\b))/i.test(variant))             return 100;
  if (/(?:^|[-_\s])(extra\s*light|ultra\s*light)(?=(?:[-_\s]|$|italic\b))/i.test(variant)) return 200;
  if (/(?:^|[-_\s])light(?=(?:[-_\s]|$|italic\b))/i.test(variant))                       return 300;
  if (/(?:^|[-_\s])(normal|regular)(?=(?:[-_\s]|$|italic\b))/i.test(variant))            return 400;
  if (/(?:^|[-_\s])medium(?=(?:[-_\s]|$|italic\b))/i.test(variant)                       ) return 500;
  if (/(?:^|[-_\s])(semi\s*bold|demi\s*bold)(?=(?:[-_\s]|$|italic\b))/i.test(variant))    return 600;
  if (/(?:^|[-_\s])(extra\s*bold|ultra\s*bold)(?=(?:[-_\s]|$|italic\b))/i.test(variant))  return 800;
  if (/(?:^|[-_\s])bold(?=(?:[-_\s]|$|italic\b))/i.test(variant)                        ) return 700;
  if (/(?:^|[-_\s])(extra\s*black|ultra\s*black)(?=(?:[-_\s]|$|italic\b))/i.test(variant)) return 950;
  if (/(?:^|[-_\s])(black|heavy|solid)(?=(?:[-_\s]|$|italic\b))/i.test(variant))          return 900;
  return 400;
}

export function parseFontStyle(variant) {
  if (/(?:^|[-_\s])italic(?:[-_\s]|$)/i.test(variant) || /italic$/i.test(variant)) {
    return 'italic';
  }
  return 'normal';
}

export function fontDisplayVariant(variantName, weight, style) {
  if (typeof variantName === 'string' && variantName.trim() !== '') {
    return variantName.trim();
  }
  const base = fontWeightToName(weight);
  if (style === 'italic') return `${base} Italic`;
  return base;
}