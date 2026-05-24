import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasValidFillAttrs, validFill, fillsIs, coerce, getImageIds,
  fillsAssoc, fillsCreate, fillsPrepend, fillToColor,
  MAX_GRADIENT_STOPS, MAX_FILLS, FILL_ATTRS, VALID_FILL_ATTRS
} from '@penpot/shared/types/fills';

describe('types/fills', () => {
  it('constants', () => {
    assert.equal(MAX_GRADIENT_STOPS, 256);
    assert.equal(MAX_FILLS, 256);
    assert.ok(VALID_FILL_ATTRS.has('fill-color'));
    assert.ok(VALID_FILL_ATTRS.has('fill-image'));
    assert.ok(VALID_FILL_ATTRS.has('fill-color-gradient'));
  });

  it('hasValidFillAttrs', () => {
    assert.ok(hasValidFillAttrs({ 'fill-color': '#ff0000' }));
    assert.ok(hasValidFillAttrs({ 'fill-color-gradient': { type: 'linear' } }));
    assert.ok(hasValidFillAttrs({ 'fill-image': { id: 'x' } }));
    assert.ok(!hasValidFillAttrs({ opacity: 0.5 }));
  });

  it('fillsIs', () => {
    assert.ok(fillsIs([]));
    assert.ok(!fillsIs(null));
    assert.ok(!fillsIs({}));
  });

  it('coerce', () => {
    assert.deepEqual(coerce(null), []);
    assert.deepEqual(coerce([]), []);
    assert.deepEqual(coerce([{ 'fill-color': '#ff0000' }]), [{ 'fill-color': '#ff0000' }]);
  });

  it('getImageIds', () => {
    const fills = [
      { 'fill-color': '#ff0000' },
      { 'fill-image': { id: 'img1' } }
    ];
    const ids = getImageIds(fills);
    assert.ok(ids.has('img1'));
    assert.equal(ids.size, 1);
  });

  it('fillsAssoc', () => {
    const result = fillsAssoc(null, 0, { 'fill-color': '#ff0000' });
    assert.deepEqual(result, [{ 'fill-color': '#ff0000' }]);
  });

  it('fillsCreate', () => {
    const result = fillsCreate({ 'fill-color': '#000' }, { 'fill-color': '#fff' });
    assert.equal(result.length, 2);
  });

  it('fillsPrepend', () => {
    const result = fillsPrepend([{ 'fill-color': '#000' }], { 'fill-color': '#fff' });
    assert.equal(result[0]['fill-color'], '#fff');
    assert.equal(result.length, 2);
  });

  it('fillToColor', () => {
    const fill = { 'fill-color': '#ff0000', 'fill-opacity': 0.5, 'fill-color-ref-id': 'abc' };
    const color = fillToColor(fill);
    assert.equal(color.color, '#ff0000');
    assert.equal(color.opacity, 0.5);
    assert.equal(color['ref-id'], 'abc');
  });

  it('fillToColor without nils', () => {
    const fill = { 'fill-color': '#ff0000' };
    const color = fillToColor(fill);
    assert.equal(color.color, '#ff0000');
    assert.equal(color.opacity, undefined);
  });
});