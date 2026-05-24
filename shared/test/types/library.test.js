import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as lib from '../../src/types/library.js';

describe('library/colors', () => {
  it('getColors returns colors map', () => {
    const fd = { colors: { c1: { id: 'c1' } } };
    assert.deepEqual(lib.getColors(fd), { c1: { id: 'c1' } });
  });

  it('getColors returns empty for no colors', () => {
    assert.deepEqual(lib.getColors({}), {});
  });

  it('getColor retrieves color by id', () => {
    const fd = { colors: { c1: { id: 'c1', color: '#ff0000' } } };
    assert.equal(lib.getColor(fd, 'c1').color, '#ff0000');
  });

  it('getColor returns undefined for missing', () => {
    assert.equal(lib.getColor({}, 'c1'), undefined);
  });

  it('addColor adds to file data', () => {
    const fd = { colors: {} };
    const color = { id: 'c1', color: '#ff0000' };
    const result = lib.addColor(fd, color);
    assert.ok(result.colors.c1);
    assert.equal(result.colors.c1.color, '#ff0000');
    assert.ok(result.colors.c1.modifiedAt);
  });

  it('setColor updates existing color', () => {
    const fd = { colors: { c1: { id: 'c1', color: '#old' } } };
    const result = lib.setColor(fd, { id: 'c1', color: '#new' });
    assert.equal(result.colors.c1.color, '#new');
  });

  it('updateColor updates with function', () => {
    const fd = { colors: { c1: { id: 'c1', color: '#ff0000' } } };
    const result = lib.updateColor(fd, 'c1', (c) => ({ ...c, color: '#00ff00' }));
    assert.equal(result.colors.c1.color, '#00ff00');
  });

  it('deleteColor removes color', () => {
    const fd = { colors: { c1: { id: 'c1' }, c2: { id: 'c2' } } };
    const result = lib.deleteColor(fd, 'c1');
    assert.ok(!result.colors.c1);
    assert.ok(result.colors.c2);
  });

  it('getRefColor returns matching library color', () => {
    const libData = { id: 'lib1', colors: { c1: { id: 'c1', color: '#ref' } } };
    const color = { 'ref-file': 'lib1', 'ref-id': 'c1' };
    assert.equal(lib.getRefColor(libData, color).color, '#ref');
  });

  it('getRefColor returns undefined for non-matching library', () => {
    const libData = { id: 'lib2', colors: {} };
    const color = { 'ref-file': 'lib1', 'ref-id': 'c1' };
    assert.equal(lib.getRefColor(libData, color), undefined);
  });
});

describe('library/sync', () => {
  it('syncColors syncs fill colors from library', () => {
    const shape = {
      fills: [{ 'fill-color-ref-file': 'lib1', 'fill-color-ref-id': 'c1', 'fill-color': '#old' }],
    };
    const libColors = { c1: { color: '#new', opacity: 1, gradient: null } };
    const result = lib.syncColors(shape, 'lib1', libColors);
    assert.equal(result.fills[0]['fill-color'], '#new');
  });

  it('syncColors syncs stroke colors from library', () => {
    const shape = {
      strokes: [{ 'stroke-color-ref-file': 'lib1', 'stroke-color-ref-id': 'c1', 'stroke-color': '#old' }],
    };
    const libColors = { c1: { color: '#new', opacity: 1, gradient: null } };
    const result = lib.syncColors(shape, 'lib1', libColors);
    assert.equal(result.strokes[0]['stroke-color'], '#new');
  });

  it('syncColors leaves non-library colors unchanged', () => {
    const shape = {
      fills: [{ 'fill-color-ref-file': 'lib2', 'fill-color-ref-id': 'c1', 'fill-color': '#mine' }],
    };
    const libColors = { c1: { color: '#new', opacity: 1, gradient: null } };
    const result = lib.syncColors(shape, 'lib1', libColors);
    assert.equal(result.fills[0]['fill-color'], '#mine');
  });
});