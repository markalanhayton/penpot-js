import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as layout from '../src/types/shape/layout.js';
import * as boundsMap from '../src/geom/bounds_map.js';
import * as modifTree from '../src/geom/modif_tree.js';

describe('types/shape/layout', () => {
  it('layoutTypes contains flex and grid', () => {
    assert.ok(layout.layoutTypes.has('flex'));
    assert.ok(layout.layoutTypes.has('grid'));
  });

  it('flexDirectionTypes contains all directions', () => {
    assert.ok(layout.flexDirectionTypes.has('row'));
    assert.ok(layout.flexDirectionTypes.has('row-reverse'));
    assert.ok(layout.flexDirectionTypes.has('column'));
    assert.ok(layout.flexDirectionTypes.has('column-reverse'));
  });

  it('flexLayoutQ detects flex layout', () => {
    const shape = { type: 'frame', layout: 'flex' };
    assert.ok(layout.flexLayoutQ(shape));
    assert.ok(!layout.flexLayoutQ({ type: 'frame', layout: 'grid' }));
    assert.ok(!layout.flexLayoutQ({ type: 'rect', layout: 'flex' }));
  });

  it('gridLayoutQ detects grid layout', () => {
    const shape = { type: 'frame', layout: 'grid' };
    assert.ok(layout.gridLayoutQ(shape));
    assert.ok(!layout.gridLayoutQ({ type: 'frame', layout: 'flex' }));
  });

  it('anyLayoutQ detects any layout', () => {
    assert.ok(layout.anyLayoutQ({ type: 'frame', layout: 'flex' }));
    assert.ok(layout.anyLayoutQ({ type: 'frame', layout: 'grid' }));
    assert.ok(!layout.anyLayoutQ({ type: 'frame' }));
  });

  it('fillWidthQ checks h-sizing', () => {
    const child = { 'layout-item-h-sizing': 'fill' };
    assert.ok(layout.fillWidthQ(child));
    assert.ok(!layout.fillWidthQ({ 'layout-item-h-sizing': 'fix' }));
  });

  it('fillHeightQ checks v-sizing', () => {
    const child = { 'layout-item-v-sizing': 'fill' };
    assert.ok(layout.fillHeightQ(child));
    assert.ok(!layout.fillHeightQ({ 'layout-item-v-sizing': 'fix' }));
  });

  it('colQ checks column direction', () => {
    assert.ok(layout.colQ({ 'layout-flex-dir': 'column' }));
    assert.ok(layout.colQ({ 'layout-flex-dir': 'column-reverse' }));
    assert.ok(!layout.colQ({ 'layout-flex-dir': 'row' }));
  });

  it('rowQ checks row direction', () => {
    assert.ok(layout.rowQ({ 'layout-flex-dir': 'row' }));
    assert.ok(layout.rowQ({ 'layout-flex-dir': 'row-reverse' }));
    assert.ok(!layout.rowQ({ 'layout-flex-dir': 'column' }));
  });

  it('gaps returns row and column gap', () => {
    const shape = { 'layout-gap': { 'row-gap': 10, 'column-gap': 5 } };
    const [rowGap, colGap] = layout.gaps(shape);
    assert.equal(rowGap, 10);
    assert.equal(colGap, 5);
  });

  it('gaps returns zeros for missing gap', () => {
    const [rowGap, colGap] = layout.gaps({});
    assert.equal(rowGap, 0);
    assert.equal(colGap, 0);
  });

  it('hPadding calculates horizontal padding', () => {
    const shape = { 'layout-padding-type': 'simple', 'layout-padding': { p1: 10, p2: 20, p3: 30, p4: 40 } };
    assert.equal(layout.hPadding(shape), 40);
  });

  it('hPadding with multiple padding', () => {
    const shape = { 'layout-padding-type': 'multiple', 'layout-padding': { p1: 10, p2: 20, p3: 30, p4: 40 } };
    assert.equal(layout.hPadding(shape), 60);
  });

  it('vPadding calculates vertical padding', () => {
    const shape = { 'layout-padding-type': 'simple', 'layout-padding': { p1: 10, p2: 20, p3: 30, p4: 40 } };
    assert.equal(layout.vPadding(shape), 20);
  });

  it('childMinWidth returns min for fill items', () => {
    const child = { 'layout-item-min-w': 50, 'layout-item-h-sizing': 'fill' };
    assert.equal(layout.childMinWidth(child), 50);
  });

  it('childMinWidth returns default for non-fill items', () => {
    assert.equal(layout.childMinWidth({}), 0.01);
  });

  it('childMargins calculates margins for simple type', () => {
    const child = { 'layout-item-margin-type': 'simple', 'layout-item-margin': { m1: 10, m2: 20, m3: 10, m4: 20 } };
    assert.deepEqual(layout.childMargins(child), [10, 20, 10, 20]);
  });

  it('childMargins calculates margins for multiple type', () => {
    const child = { 'layout-item-margin-type': 'multiple', 'layout-item-margin': { m1: 10, m2: 20, m3: 30, m4: 40 } };
    assert.deepEqual(layout.childMargins(child), [10, 20, 30, 40]);
  });

  it('itemAbsoluteQ checks absolute positioning', () => {
    assert.ok(layout.itemAbsoluteQ({ 'layout-item-absolute': true }));
    assert.ok(!layout.itemAbsoluteQ({ 'layout-item-absolute': false }));
  });

  it('wrapQ checks wrap type', () => {
    assert.ok(layout.wrapQ({ 'layout-wrap-type': 'wrap' }));
    assert.ok(!layout.wrapQ({ 'layout-wrap-type': 'nowrap' }));
  });
});

describe('geom/bounds_map', () => {
  it('objectsToBoundsMap creates bounds map from objects', () => {
    const objects = {
      's1': { points: [{ x: 0, y: 0 }, { x: 100, y: 50 }], type: 'rect' },
      's2': { points: [{ x: 10, y: 10 }, { x: 200, y: 100 }], type: 'rect' },
    };
    const result = boundsMap.objectsToBoundsMap(objects);
    assert.ok('s1' in result);
    assert.ok('s2' in result);
  });

  it('transformBoundsMap returns updated bounds', () => {
    const bMap = { 's1': { x: 0, y: 0, width: 100, height: 50 } };
    const objects = { 's1': { id: 's1', type: 'rect' } };
    const modifTree = {};
    const result = boundsMap.transformBoundsMap(bMap, objects, modifTree);
    assert.ok('s1' in result);
  });
});