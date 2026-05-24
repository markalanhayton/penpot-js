import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../../src/colors.js';

describe('colors constants', () => {
  it('has named colors', () => {
    assert.equal(c.black, '#000000');
    assert.equal(c.white, '#FFFFFF');
    assert.ok(c.names.red);
  });

  it('colorNames is an array', () => {
    assert.ok(Array.isArray(c.colorNames));
    assert.ok(c.colorNames.length > 100);
  });

  it('emptyColor has undefined values', () => {
    assert.equal(c.emptyColor.color, undefined);
    assert.equal(c.emptyColor.opacity, undefined);
  });
});

describe('colors hex validation', () => {
  it('validHexColorQ accepts valid hex', () => {
    assert.equal(c.validHexColorQ('#ff0000'), true);
    assert.equal(c.validHexColorQ('#f00'), true);
    assert.equal(c.validHexColorQ('ff0000'), false);
    assert.equal(c.validHexColorQ(123), false);
  });

  it('parse resolves colors', () => {
    assert.equal(c.parse('#ff0000'), '#ff0000');
    assert.equal(c.parse('red'), '#ff0000');
    assert.equal(c.parse('RED'), '#ff0000');
    assert.equal(c.parse('invalidcolor'), undefined);
  });
});

describe('colors rgb conversion', () => {
  it('hexToRgb converts hex to rgb', () => {
    assert.deepEqual(c.hexToRgb('#ff0000'), [255, 0, 0]);
    assert.deepEqual(c.hexToRgb('#0000ff'), [0, 0, 255]);
  });

  it('rgbToHex converts rgb to hex', () => {
    assert.equal(c.rgbToHex([255, 0, 0]), '#ff0000');
    assert.equal(c.rgbToHex([0, 255, 0]), '#00ff00');
  });

  it('hexToRgb roundtrip', () => {
    const [r, g, b] = c.hexToRgb('#336699');
    assert.equal(c.rgbToHex([r, g, b]), '#336699');
  });

  it('rgbToStr formats rgb', () => {
    assert.equal(c.rgbToStr([255, 128, 0]), 'rgb(255,128,0)');
    assert.equal(c.rgbToStr([255, 128, 0, 0.5]), 'rgba(255,128,0,0.5)');
  });
});

describe('colors hsl conversion', () => {
  it('rgbToHsl converts correctly', () => {
    const [h, s, l] = c.rgbToHsl([255, 0, 0]);
    assert.ok(Math.abs(h - 0) < 1 || Math.abs(h - 360) < 1);
    assert.ok(s > 0.9);
    assert.ok(l > 0.4);
  });

  it('hslToRgb converts back', () => {
    const [h, s, l] = c.rgbToHsl([128, 64, 200]);
    const [r, g, b] = c.hslToRgb([h, s, l]);
    assert.ok(Math.abs(r - 128) <= 1);
    assert.ok(Math.abs(g - 64) <= 1);
    assert.ok(Math.abs(b - 200) <= 1);
  });

  it('hslToHex works', () => {
    const hex = c.hslToHex([0, 1, 0.5]);
    assert.equal(hex, '#ff0000');
  });
});

describe('colors hsv conversion', () => {
  it('rgbToHsv converts correctly', () => {
    const [h, s, v] = c.rgbToHsv([255, 0, 0]);
    assert.ok(Math.abs(h) < 1 || Math.abs(h - 360) < 1);
    assert.equal(s, 1);
    assert.equal(v, 255);
  });

  it('hsvToRgb converts back', () => {
    const [h, s, v] = c.rgbToHsv([64, 128, 200]);
    const [r, g, b] = c.hsvToRgb([h, s, v]);
    assert.ok(Math.abs(r - 64) <= 1);
    assert.ok(Math.abs(g - 128) <= 1);
    assert.ok(Math.abs(b - 200) <= 1);
  });

  it('hsvToHex works', () => {
    const hex = c.hexToHsv('#ff0000');
    assert.ok(Array.isArray(hex));
    assert.equal(hex.length, 3);
  });
});

describe('colors utility', () => {
  it('hexToLum returns luminance', () => {
    const lumWhite = c.hexToLum('#ffffff');
    const lumBlack = c.hexToLum('#000000');
    assert.ok(lumWhite > lumBlack);
  });

  it('hexToRgba appends opacity', () => {
    assert.deepEqual(c.hexToRgba('#ff0000', 0.5), [255, 0, 0, 0.5]);
  });

  it('hexToHsla appends opacity', () => {
    const hsla = c.hexToHsla('#ff0000', 0.5);
    assert.equal(hsla.length, 4);
    assert.equal(hsla[3], 0.5);
  });

  it('prependHash adds hash', () => {
    assert.equal(c.prependHash('ff0000'), '#ff0000');
    assert.equal(c.prependHash('#ff0000'), '#ff0000');
  });

  it('removeHash removes hash', () => {
    assert.equal(c.removeHash('#ff0000'), 'ff0000');
    assert.equal(c.removeHash('ff0000'), 'ff0000');
  });

  it('expandHex expands short hex', () => {
    assert.equal(c.expandHex('f'), 'ffffff');
    assert.equal(c.expandHex('ff'), 'ffffff');
    assert.equal(c.expandHex('f00'), 'ff0000');
  });

  it('colorStringQ validates color strings', () => {
    assert.equal(c.colorStringQ('#ff0000'), true);
    assert.equal(c.colorStringQ('red'), true);
    assert.equal(c.colorStringQ('invalid'), false);
    assert.equal(c.colorStringQ(123), false);
  });

  it('nextRgb increments blue', () => {
    assert.deepEqual(c.nextRgb([0, 0, 0]), [0, 0, 1]);
  });

  it('sortColors compares by hue/value', () => {
    assert.ok(typeof c.sortColors({ color: '#ff0000' }, { color: '#0000ff' }) === 'number');
  });

  it('formatHsla formats hsla string', () => {
    const result = c.formatHsla([120, 0.5, 0.75, 1]);
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('120'));
  });

  it('formatRgba formats rgba string', () => {
    const result = c.formatRgba([255, 128, 64, 0.5]);
    assert.ok(result.includes('255'));
    assert.ok(result.includes('0.5'));
  });

  it('reduceRange rounds to range', () => {
    assert.equal(c.reduceRange(0.5, 2), 0.5);
    assert.equal(c.reduceRange(1.3, 4), 1.25);
    assert.equal(c.reduceRange(0.7, 4), 0.5);
  });

  it('parseRgb parses rgb strings', () => {
    assert.deepEqual(c.parseRgb('rgb(255, 128, 64)'), [255, 128, 64]);
    assert.equal(c.parseRgb('invalid'), undefined);
  });

  it('validRgbColorQ validates rgb strings', () => {
    assert.equal(c.validRgbColorQ('rgb(255, 128, 64)'), true);
    assert.equal(c.validRgbColorQ('invalid'), false);
  });
});