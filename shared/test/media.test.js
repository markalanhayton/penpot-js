import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FONT_TYPES, IMAGE_TYPES, formatToExtension, formatToMtype,
  mtypeToFormat, mtypeToExtension, stripImageExtension,
  parseFontWeight, parseFontStyle, fontWeightToName, fontDisplayVariant
} from '@penpot/shared/media';

describe('media', () => {
  it('FONT_TYPES has correct entries', () => {
    assert.ok(FONT_TYPES.has('font/ttf'));
    assert.ok(FONT_TYPES.has('font/woff2'));
    assert.equal(FONT_TYPES.size, 4);
  });

  it('IMAGE_TYPES has correct entries', () => {
    assert.ok(IMAGE_TYPES.has('image/png'));
    assert.ok(IMAGE_TYPES.has('image/svg+xml'));
    assert.equal(IMAGE_TYPES.size, 5);
  });

  it('formatToExtension', () => {
    assert.equal(formatToExtension('png'), '.png');
    assert.equal(formatToExtension('jpeg'), '.jpg');
    assert.equal(formatToExtension('svg'), '.svg');
    assert.equal(formatToExtension('webp'), '.webp');
  });

  it('formatToMtype', () => {
    assert.equal(formatToMtype('png'), 'image/png');
    assert.equal(formatToMtype('jpg'), 'image/jpeg');
    assert.equal(formatToMtype('svg'), 'image/svg+xml');
    assert.equal(formatToMtype('unknown'), 'application/octet-stream');
  });

  it('mtypeToFormat', () => {
    assert.equal(mtypeToFormat('image/png'), 'png');
    assert.equal(mtypeToFormat('image/jpeg'), 'jpeg');
    assert.equal(mtypeToFormat('image/svg+xml'), 'svg');
    assert.equal(mtypeToFormat('text/html'), undefined);
  });

  it('mtypeToExtension', () => {
    assert.equal(mtypeToExtension('image/png'), '.png');
    assert.equal(mtypeToExtension('font/woff2'), '.woff2');
    assert.equal(mtypeToExtension('application/pdf'), '.pdf');
    assert.equal(mtypeToExtension('unknown/type'), undefined);
  });

  it('stripImageExtension', () => {
    assert.equal(stripImageExtension('photo.png'), 'photo');
    assert.equal(stripImageExtension('photo.jpg'), 'photo');
    assert.equal(stripImageExtension('photo.svg'), 'photo');
    assert.equal(stripImageExtension('photo.webp'), 'photo');
    assert.equal(stripImageExtension('photo.txt'), 'photo.txt');
  });

  it('parseFontWeight', () => {
    assert.equal(parseFontWeight('Thin'), 100);
    assert.equal(parseFontWeight('hairline'), 100);
    assert.equal(parseFontWeight('ExtraLight'), 200);
    assert.equal(parseFontWeight('Light'), 300);
    assert.equal(parseFontWeight('Regular'), 400);
    assert.equal(parseFontWeight('Medium'), 500);
    assert.equal(parseFontWeight('SemiBold'), 600);
    assert.equal(parseFontWeight('Bold'), 700);
    assert.equal(parseFontWeight('ExtraBold'), 800);
    assert.equal(parseFontWeight('Black'), 900);
    assert.equal(parseFontWeight('ExtraBlack'), 950);
    assert.equal(parseFontWeight('Italic-Bold'), 700);
    assert.equal(parseFontWeight('unknown'), 400);
  });

  it('parseFontStyle', () => {
    assert.equal(parseFontStyle('Bold Italic'), 'italic');
    assert.equal(parseFontStyle('italic'), 'italic');
    assert.equal(parseFontStyle('Regular'), 'normal');
    assert.equal(parseFontStyle('Bold'), 'normal');
  });

  it('fontWeightToName', () => {
    assert.equal(fontWeightToName(100), 'Hairline');
    assert.equal(fontWeightToName(400), 'Regular');
    assert.equal(fontWeightToName(700), 'Bold');
    assert.equal(fontWeightToName(900), 'Black');
  });

  it('fontDisplayVariant with custom name', () => {
    assert.equal(fontDisplayVariant(' My Style ', 400, 'normal'), 'My Style');
  });

  it('fontDisplayVariant with generated name', () => {
    assert.equal(fontDisplayVariant('', 700, 'italic'), 'Bold Italic');
    assert.equal(fontDisplayVariant('', 400, 'normal'), 'Regular');
  });
});