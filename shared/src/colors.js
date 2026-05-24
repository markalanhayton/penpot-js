import * as d from './data.js';
import * as mth from './math.js';

export const black = '#000000';
export const defaultLayout = '#DE4762';
export const gray20 = '#B1B2B5';
export const info = '#59B9E2';
export const testColor = '#fabada';
export const white = '#FFFFFF';
export const warning = '#FC8802';

export const newPrimary = '#7efff5';
export const newDanger = '#ff3277';
export const newWarning = '#fe4811';
export const newPrimaryLight = '#6911d4';
export const backgroundQuaternary = '#2e3434';
export const backgroundQuaternaryLight = '#eef0f2';
export const canvas = '#E8E9EA';

export const names = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4',
  azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000',
  blanchedalmond: '#ffebcd', blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a',
  burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00', chocolate: '#d2691e',
  coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c',
  cyan: '#00ffff', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9', darkgreen: '#006400', darkgrey: '#a9a9a9', darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b', darkolivegreen: '#556b2f', darkorange: '#ff8c00', darkorchid: '#9932cc',
  darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f', darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1', darkviolet: '#9400d3',
  deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969',
  dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22',
  fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700',
  goldenrod: '#daa520', gray: '#808080', green: '#008000', greenyellow: '#adff2f',
  grey: '#808080', honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c',
  indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa',
  lavenderblush: '#fff0f5', lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6',
  lightcoral: '#f08080', lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3',
  lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1', lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899', lightslategrey: '#778899',
  lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32',
  linen: '#faf0e6', magenta: '#ff00ff', maroon: '#800000', mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd', mediumorchid: '#ba55d3', mediumpurple: '#9370db', mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585', midnightblue: '#191970', mintcream: '#f5fffa', mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5', navajowhite: '#ffdead', navy: '#000080', oldlace: '#fdf5e6',
  olive: '#808000', olivedrab: '#6b8e23', orange: '#ffa500', orangered: '#ff4500',
  orchid: '#da70d6', palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee',
  palevioletred: '#db7093', papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f',
  pink: '#ffc0cb', plum: '#dda0dd', powderblue: '#b0e0e6', purple: '#800080',
  red: '#ff0000', rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513',
  salmon: '#fa8072', sandybrown: '#f4a460', seagreen: '#2e8b57', seashell: '#fff5ee',
  sienna: '#a0522d', silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd',
  slategray: '#708090', slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f',
  steelblue: '#4682b4', tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8',
  tomato: '#ff6347', turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3',
  white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00', yellowgreen: '#9acd32',
};

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const RGB_COLOR_RE = /^(?:rgb)?\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\)$/;

export function validHexColorQ(color) {
  return typeof color === 'string' && HEX_COLOR_RE.test(color);
}

export function parseRgb(color) {
  const match = color.match(RGB_COLOR_RE);
  if (!match) return undefined;
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
    return [r, g, b];
  }
  return undefined;
}

export function validRgbColorQ(color) {
  if (typeof color !== 'string') return false;
  return parseRgb(color) != null;
}

function normalizeHex(color) {
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
  }
  return color.toLowerCase();
}

export function rgbToStr([r, g, b, a]) {
  if (a != null) return `rgba(${r},${g},${b},${a})`;
  return `rgb(${r},${g},${b})`;
}

export function rgbToHsv([red, green, blue]) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const val = max;
  if (min === max) return [0, 0, val];
  const delta = max - min;
  const sat = delta / max;
  let hue;
  if (red === max) {
    hue = (green - blue) / delta;
  } else if (green === max) {
    hue = 2 + (blue - red) / delta;
  } else {
    hue = 4 + (red - green) / delta;
  }
  hue *= 60;
  if (hue < 0) hue += 360;
  if (hue > 360) hue -= 360;
  return [hue, sat, val];
}

export function hsvToRgb([h, s, brightness]) {
  if (s === 0) return [brightness, brightness, brightness];
  const sextant = Math.floor(h / 60);
  const remainder = h / 60 - sextant;
  brightness = brightness ?? 0;
  const val1 = Math.round(brightness * (1 - s));
  const val2 = Math.round(brightness * (1 - s * remainder));
  const val3 = Math.round(brightness * (1 - s * (1 - remainder)));
  switch (sextant) {
    case 1: return [val2, brightness, val1];
    case 2: return [val1, brightness, val3];
    case 3: return [val1, val2, brightness];
    case 4: return [val3, val1, brightness];
    case 5: return [brightness, val1, val2];
    case 6: return [brightness, val3, val1];
    default: return [brightness, val3, val1];
  }
}

export function hexToRgb(color) {
  try {
    const rgb = parseInt(color.slice(1), 16);
    const r = rgb >> 16;
    const g = (rgb >> 8) & 255;
    const b = rgb & 255;
    return [r, g, b];
  } catch {
    return [0, 0, 0];
  }
}

export function hexToLum(color) {
  const [r, g, b] = hexToRgb(color);
  return Math.sqrt(0.241 * r + 0.691 * g + 0.068 * b);
}

function intToHex(v) {
  return v.toString(16);
}

export function rgbToHex([r, g, b]) {
  r = Math.round(r);
  g = Math.round(g);
  b = Math.round(b);
  if ((r & 255) !== r || (g & 255) !== g || (b & 255) !== b) {
    throw new Error(`not valid rgb: r=${r} g=${g} b=${b}`);
  }
  const rgb = (r << 16) | (g << 8) | b;
  return r < 16 ? `#${intToHex(0x1000000 | rgb).slice(1)}` : `#${intToHex(rgb)}`;
}

export function rgbToHsl([r, g, b]) {
  const normR = r / 255;
  const normG = g / 255;
  const normB = b / 255;
  const max = Math.max(normR, normG, normB);
  const min = Math.min(normR, normG, normB);
  const l = (max + min) / 2;
  let h;
  if (max === min) {
    h = 0;
  } else if (max === normR) {
    h = 60 * ((normG - normB) / (max - min));
  } else if (max === normG) {
    h = 120 + 60 * ((normB - normR) / (max - min));
  } else {
    h = 240 + 60 * ((normR - normG) / (max - min));
  }
  const s = l > 0 && l <= 0.5
    ? (max - min) / (2 * l)
    : (max - min) / (2 - 2 * l);
  return [((h + 360) % 360), s, l];
}

export function hexToHsv(v) {
  return rgbToHsv(hexToRgb(v));
}

export function hexToRgba(data, opacity) {
  return [...hexToRgb(data), opacity];
}

export function hexToHsl(hex) {
  return rgbToHsl(hexToRgb(hex));
}

export function hexToHsla(data, opacity) {
  return [...hexToHsl(data), opacity];
}

export function formatHsla([h, s, l, a]) {
  const precision = 2;
  const roundedH = Math.round(h);
  const roundedS = d.formatNumber(100 * s, precision);
  const roundedL = d.formatNumber(100 * l, precision);
  const roundedA = d.formatNumber(a, precision);
  return `${roundedH} ${roundedS}% ${roundedL}% / ${roundedA}`;
}

export function formatRgba([r, g, b, a]) {
  const roundedA = d.formatNumber(a, 2);
  return `${r}, ${g}, ${b}, ${roundedA}`;
}

function hueToRgb(v1, v2, vh) {
  if (vh < 0) vh += 1;
  else if (vh > 1) vh -= 1;
  if (6 * vh < 1) return v1 + (v2 - v1) * 6 * vh;
  if (2 * vh < 1) return v2;
  if (3 * vh < 2) return v1 + (v2 - v1) * (2 / 3 - vh) * 6;
  return v1;
}

export function hslToRgb([h, s, l]) {
  if (s === 0) {
    const o = l * 255;
    return [o, o, o];
  }
  const normH = h / 360;
  const temp2 = l < 0.5 ? l * (1 + s) : l + s - s * l;
  const temp1 = 2 * l - temp2;
  return [
    Math.round(255 * hueToRgb(temp1, temp2, normH + 1 / 3)),
    Math.round(255 * hueToRgb(temp1, temp2, normH)),
    Math.round(255 * hueToRgb(temp1, temp2, normH - 1 / 3)),
  ];
}

export function hslToHex(v) {
  return rgbToHex(hslToRgb(v));
}

export function hslToHsv(hsl) {
  return rgbToHsv(hslToRgb(hsl));
}

export function hsvToHex(hsv) {
  return rgbToHex(hsvToRgb(hsv));
}

export function hsvToHsl(hsv) {
  return hexToHsl(hsvToHex(hsv));
}

export function expandHex(v) {
  if (/^[0-9A-Fa-f]$/.test(v)) return v + v + v + v + v + v;
  if (/^[0-9A-Fa-f]{2}$/.test(v)) return v + v + v;
  if (/^[0-9A-Fa-f]{3}$/.test(v)) return v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
  return v;
}

export function prependHash(color) {
  return color.startsWith('#') ? color : `#${color}`;
}

export function removeHash(color) {
  return color.startsWith('#') ? color.slice(1) : color;
}

export function colorStringQ(color) {
  return typeof color === 'string' && (validHexColorQ(color) || validRgbColorQ(color) || color.toLowerCase() in names);
}

export function parse(color) {
  if (typeof color !== 'string') return undefined;
  if (validHexColorQ(color) || validHexColorQ(`#${color}`)) {
    return normalizeHex(color);
  }
  const rgb = parseRgb(color);
  if (rgb) return rgbToHex(rgb);
  return names[color.toLowerCase()];
}

export const colorNames = Object.keys(names);

export const emptyColor = { color: undefined, id: undefined, fileId: undefined, gradient: undefined, opacity: undefined };

export function nextRgb([r, g, b]) {
  if (r === 255 && g === 255 && b === 255) throw new Error(`cannot get next color: r=${r} g=${g} b=${b}`);
  if (g === 255 && b === 255) return [r + 1, 0, 0];
  if (b === 255) return [r, g + 1, 0];
  return [r, g, b + 1];
}

export function reduceRange(value, range) {
  return Math.floor(value * range) / range;
}

export function sortColors(a, b) {
  const [ah, , av] = hexToHsv(a.color);
  const [bh, , bv] = hexToHsv(b.color);
  const ahr = reduceRange(ah / 60, 8);
  const bhr = reduceRange(bh / 60, 8);
  const avn = av / 255;
  const bvn = bv / 255;
  const va = ahr * 100 + avn * 10;
  const vb = bhr * 100 + bvn * 10;
  return va - vb;
}