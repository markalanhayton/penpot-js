import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasValidColorAttrs, hexColorString, validHexColor, validRgbColor,
  parseRgb, GRADIENT_TYPES, COLOR_ATTRS, black, white, defaultLayout,
  gray20, canvas, names, colorNames, emptyColor,
  libraryColorToColor, strokeToColor,
  rgbToStr, rgbToHsv, hsvToRgb, hexToRgb, rgbToHex, hexToLum,
  rgbToHsl, hexToHsv, hexToRgba, hexToHsl, hexToHsla,
  formatHsla, formatRgba, hslToRgb, hslToHex, hslToHsv,
  hsvToHex, hsvToHsl, rgbToHsb, hsbToRgb, hexToHsb, hsbToHex,
  hsvToHsb, hsbToHsv, expandHex, prependHash, removeHash,
  colorString, parse, nextRgb, reduceRange, sortColors,
  interpolateColor, interpolateGradient
} from '@penpot/shared/types/color';

describe('types/color', () => {
  it('hasValidColorAttrs with color', () => {
    assert.ok(hasValidColorAttrs({ color: '#ff0000' }));
  });

  it('hasValidColorAttrs with gradient', () => {
    assert.ok(hasValidColorAttrs({ gradient: { type: 'linear' } }));
  });

  it('hasValidColorAttrs with image', () => {
    assert.ok(hasValidColorAttrs({ image: { id: 'x' } }));
  });

  it('hasValidColorAttrs invalid when no color attr', () => {
    assert.ok(!hasValidColorAttrs({ opacity: 0.5 }));
  });

  it('hasValidColorAttrs invalid when multiple color attrs', () => {
    assert.ok(!hasValidColorAttrs({ color: '#ff0000', gradient: { type: 'linear' } }));
  });

  it('hexColorString', () => {
    assert.ok(hexColorString('#ff0000'));
    assert.ok(hexColorString('#f00'));
    assert.ok(!hexColorString('ff0000'));
    assert.ok(!hexColorString('#gg0000'));
  });

  it('validHexColor', () => {
    assert.ok(validHexColor('#abc'));
    assert.ok(validHexColor('#aabbcc'));
    assert.ok(!validHexColor('red'));
  });

  it('parseRgb', () => {
    assert.deepEqual(parseRgb('rgb(255, 128, 0)'), [255, 128, 0]);
    assert.equal(parseRgb('invalid'), undefined);
  });

  it('validRgbColor', () => {
    assert.ok(validRgbColor('rgb(255, 0, 0)'));
    assert.ok(!validRgbColor('#ff0000'));
    assert.ok(!validRgbColor(42));
  });

  it('constants', () => {
    assert.equal(black, '#000000');
    assert.equal(white, '#FFFFFF');
    assert.equal(canvas, '#E8E9EA');
  });

  it('names has CSS colors', () => {
    assert.equal(names.red, '#ff0000');
    assert.equal(names.blue, '#0000ff');
    assert.ok(Object.keys(names).length > 140);
  });

  it('colorNames is array of names keys', () => {
    assert.ok(Array.isArray(colorNames));
    assert.ok(colorNames.includes('red'));
  });

  it('emptyColor', () => {
    assert.equal(emptyColor.color, null);
    assert.equal(emptyColor.id, null);
  });

  it('hexToRgb', () => {
    assert.deepEqual(hexToRgb('#ff0000'), [255, 0, 0]);
    assert.deepEqual(hexToRgb('#000000'), [0, 0, 0]);
    assert.deepEqual(hexToRgb('#ffffff'), [255, 255, 255]);
  });

  it('rgbToHex', () => {
    assert.equal(rgbToHex([255, 0, 0]), '#ff0000');
    assert.equal(rgbToHex([0, 0, 0]), '#000000');
    assert.equal(rgbToHex([255, 255, 255]), '#ffffff');
  });

  it('hexToRgb / rgbToHex roundtrip', () => {
    assert.equal(rgbToHex(hexToRgb('#aabbcc')), '#aabbcc');
  });

  it('hexToLum', () => {
    const lum = hexToLum('#ffffff');
    assert.ok(lum > 0);
  });

  it('rgbToHsv / hsvToRgb', () => {
    const hsv = rgbToHsv([255, 0, 0]);
    assert.ok(Math.abs(hsv[0] - 0) < 1);
    const rgb = hsvToRgb(hsv);
    assert.ok(Math.abs(rgb[0] - 255) < 2);
    assert.ok(Math.abs(rgb[1] - 0) < 2);
    assert.ok(Math.abs(rgb[2] - 0) < 2);
  });

  it('rgbToHsl / hslToRgb', () => {
    const hsl = rgbToHsl([255, 0, 0]);
    assert.ok(Math.abs(hsl[0] - 0) < 1);
    const rgb = hslToRgb(hsl);
    assert.ok(Math.abs(rgb[0] - 255) < 2);
  });

  it('hexToHsv', () => {
    const hsv = hexToHsv('#00ff00');
    assert.ok(Math.abs(hsv[0] - 120) < 1);
  });

  it('hexToRgba', () => {
    assert.deepEqual(hexToRgba('#ff0000', 0.5), [255, 0, 0, 0.5]);
  });

  it('hexToHsl', () => {
    const hsl = hexToHsl('#ff0000');
    assert.ok(typeof hsl[0] === 'number');
  });

  it('hexToHsla', () => {
    const hsla = hexToHsla('#ff0000', 0.8);
    assert.equal(hsla.length, 4);
    assert.equal(hsla[3], 0.8);
  });

  it('formatHsla', () => {
    const s = formatHsla([0, 1, 0.5, 1]);
    assert.ok(s.includes('0'));
    assert.ok(s.includes('%'));
  });

  it('formatRgba', () => {
    const s = formatRgba([255, 0, 0, 0.5]);
    assert.ok(s.includes('255'));
  });

  it('hslToHex', () => {
    const hex = hslToHex([0, 1, 0.5]);
    assert.equal(hex, '#ff0000');
  });

  it('hslToHsv', () => {
    const hsv = hslToHsv([0, 1, 0.5]);
    assert.ok(Math.abs(hsv[0] - 0) < 1);
  });

  it('hsvToHex', () => {
    assert.equal(hsvToHex([0, 1, 255]), '#ff0000');
  });

  it('hsvToHsl', () => {
    const hsl = hsvToHsl([0, 1, 255]);
    assert.ok(typeof hsl[0] === 'number');
  });

  it('rgbToHsb / hsbToRgb', () => {
    const hsb = rgbToHsb([255, 0, 0]);
    assert.ok(Math.abs(hsb[0] - 0) < 1);
    assert.equal(hsb[1], 1);
    assert.ok(Math.abs(hsb[2] - 100) < 1);
    const rgb = hsbToRgb(hsb);
    assert.ok(Math.abs(rgb[0] - 255) < 2);
  });

  it('hexToHsb / hsbToHex', () => {
    const hsb = hexToHsb('#ff0000');
    assert.ok(Math.abs(hsb[2] - 100) < 1);
    const hex = hsbToHex(hsb);
    assert.equal(hex, '#ff0000');
  });

  it('hsvToHsb / hsbToHsv', () => {
    const hsb = hsvToHsb([0, 1, 255]);
    assert.equal(hsb[2], 100);
    const hsv = hsbToHsv(hsb);
    assert.equal(hsv[2], 255);
  });

  it('expandHex', () => {
    assert.equal(expandHex('f'), 'ffffff');
    assert.equal(expandHex('ff'), 'ffffff');
    assert.equal(expandHex('abc'), 'aabbcc');
    assert.equal(expandHex('aabbcc'), 'aabbcc');
  });

  it('prependHash', () => {
    assert.equal(prependHash('ff0000'), '#ff0000');
    assert.equal(prependHash('#ff0000'), '#ff0000');
  });

  it('removeHash', () => {
    assert.equal(removeHash('#ff0000'), 'ff0000');
    assert.equal(removeHash('ff0000'), 'ff0000');
  });

  it('colorString', () => {
    assert.ok(colorString('#ff0000'));
    assert.ok(colorString('red'));
    assert.ok(!colorString('notacolor'));
  });

  it('parse hex', () => {
    assert.equal(parse('#ff0000'), '#ff0000');
  });

  it('parse named color', () => {
    assert.equal(parse('red'), '#ff0000');
  });

  it('parse rgb string', () => {
    const result = parse('rgb(255, 0, 0)');
    assert.ok(result);
  });

  it('parse invalid returns undefined', () => {
    assert.equal(parse(42), undefined);
  });

  it('nextRgb', () => {
    assert.deepEqual(nextRgb([0, 0, 0]), [0, 0, 1]);
    assert.deepEqual(nextRgb([0, 0, 255]), [0, 1, 0]);
    assert.deepEqual(nextRgb([0, 255, 255]), [1, 0, 0]);
  });

  it('nextRgb throws at max', () => {
    assert.throws(() => nextRgb([255, 255, 255]));
  });

  it('reduceRange', () => {
    assert.equal(reduceRange(0.7, 8), 0.625);
  });

  it('libraryColorToColor', () => {
    const lc = { id: 'abc', color: '#ff0000', opacity: 0.5, name: 'Red' };
    const c = libraryColorToColor(lc, 'file1');
    assert.equal(c.color, '#ff0000');
    assert.equal(c['ref-id'], 'abc');
    assert.equal(c['ref-file'], 'file1');
  });

  it('strokeToColor', () => {
    const stroke = { 'stroke-color': '#FF0000', 'stroke-opacity': 0.8 };
    const c = strokeToColor(stroke);
    assert.equal(c.color, '#ff0000');
    assert.equal(c.opacity, 0.8);
  });

  it('rgbToStr', () => {
    assert.equal(rgbToStr([255, 0, 0]), 'rgb(255,0,0)');
    assert.equal(rgbToStr([255, 0, 0, 0.5]), 'rgba(255,0,0,0.5)');
  });

  it('interpolateColor', () => {
    const c1 = { color: '#000000', opacity: 1, offset: 0 };
    const c2 = { color: '#ffffff', opacity: 1, offset: 1 };
    const mid = interpolateColor(c1, c2, 0.5);
    assert.ok(mid.color);
    assert.equal(mid.offset, 0.5);
  });

  it('interpolateGradient', () => {
    const stops = [
      { color: '#000000', opacity: 1, offset: 0 },
      { color: '#ffffff', opacity: 1, offset: 1 }
    ];
    const result = interpolateGradient(stops, 0.5);
    assert.ok(result.color);
    assert.equal(result.offset, 0.5);
  });

  it('GRADIENT_TYPES', () => {
    assert.ok(GRADIENT_TYPES.has('linear'));
    assert.ok(GRADIENT_TYPES.has('radial'));
    assert.equal(GRADIENT_TYPES.size, 2);
  });

  it('rgbToHex throws on out of range', () => {
    assert.throws(() => rgbToHex([256, 0, 0]));
  });
});