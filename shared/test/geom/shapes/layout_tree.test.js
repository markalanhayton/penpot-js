import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as layout from '../../../src/types/shape/layout.js';
import * as treeSeq from '../../../src/geom/shapes/tree_seq.js';
import * as uuid from '../../../src/uuid.js';

describe('types/shape/layout', () => {
  it('layoutTypes contains flex and grid', () => {
    assert.ok(layout.layoutTypes.has('flex'));
    assert.ok(layout.layoutTypes.has('grid'));
  });

  it('flexDirectionTypes has expected entries', () => {
    assert.equal(layout.flexDirectionTypes.size, 4);
    assert.ok(layout.flexDirectionTypes.has('row'));
    assert.ok(layout.flexDirectionTypes.has('column'));
  });

  it('flexLayoutQ checks for flex layout', () => {
    const shape = { type: 'frame', layout: 'flex' };
    assert.equal(layout.flexLayoutQ(shape), true);
    assert.equal(layout.flexLayoutQ({ type: 'frame', layout: 'grid' }), false);
    assert.equal(layout.flexLayoutQ({ type: 'rect' }), false);
  });

  it('gridLayoutQ checks for grid layout', () => {
    const shape = { type: 'frame', layout: 'grid' };
    assert.equal(layout.gridLayoutQ(shape), true);
  });

  it('anyLayoutQ checks for any layout', () => {
    assert.equal(layout.anyLayoutQ({ type: 'frame', layout: 'flex' }), true);
    assert.equal(layout.anyLayoutQ({ type: 'frame', layout: 'grid' }), true);
    assert.equal(layout.anyLayoutQ({ type: 'frame' }), false);
  });

  it('colQ checks column direction', () => {
    assert.equal(layout.colQ({ 'layout-flex-dir': 'column' }), true);
    assert.equal(layout.colQ({ 'layout-flex-dir': 'column-reverse' }), true);
    assert.equal(layout.colQ({ 'layout-flex-dir': 'row' }), false);
  });

  it('rowQ checks row direction', () => {
    assert.equal(layout.rowQ({ 'layout-flex-dir': 'row' }), true);
    assert.equal(layout.rowQ({ 'layout-flex-dir': 'row-reverse' }), true);
    assert.equal(layout.rowQ({ 'layout-flex-dir': 'column' }), false);
  });

  it('reverseQ checks reversed direction', () => {
    assert.equal(layout.reverseQ({ 'layout-flex-dir': 'row-reverse' }), true);
    assert.equal(layout.reverseQ({ 'layout-flex-dir': 'column-reverse' }), true);
    assert.equal(layout.reverseQ({ 'layout-flex-dir': 'row' }), false);
  });

  it('wrapQ checks wrap type', () => {
    assert.equal(layout.wrapQ({ 'layout-wrap-type': 'wrap' }), true);
    assert.equal(layout.wrapQ({ 'layout-wrap-type': 'nowrap' }), false);
  });

  it('fillWidthQ / fillHeightQ', () => {
    assert.equal(layout.fillWidthQ({ 'layout-item-h-sizing': 'fill' }), true);
    assert.equal(layout.fillWidthQ({ 'layout-item-h-sizing': 'auto' }), false);
    assert.equal(layout.fillHeightQ({ 'layout-item-v-sizing': 'fill' }), true);
  });

  it('autoWidthQ / autoHeightQ', () => {
    assert.equal(layout.autoWidthQ({ 'layout-item-h-sizing': 'auto' }), true);
    assert.equal(layout.autoHeightQ({ 'layout-item-v-sizing': 'auto' }), true);
  });

  it('gaps extracts row and column gap', () => {
    assert.deepEqual(layout.gaps({ 'layout-gap': { 'row-gap': 10, 'column-gap': 20 } }), [10, 20]);
    assert.deepEqual(layout.gaps({}), [0, 0]);
  });

  it('paddings with simple type mirrors', () => {
    const result = layout.paddings({ 'layout-padding-type': 'simple', 'layout-padding': { p1: 5, p2: 10, p3: 15, p4: 20 } });
    assert.deepEqual(result, [5, 10, 5, 10]);
  });

  it('paddings with multiple type uses all', () => {
    const result = layout.paddings({ 'layout-padding-type': 'multiple', 'layout-padding': { p1: 5, p2: 10, p3: 15, p4: 20 } });
    assert.deepEqual(result, [5, 10, 15, 20]);
  });

  it('hPadding / vPadding', () => {
    assert.equal(layout.hPadding({ 'layout-padding-type': 'simple', 'layout-padding': { p2: 10, p4: 20 } }), 20);
    assert.equal(layout.hPadding({ 'layout-padding-type': 'multiple', 'layout-padding': { p2: 10, p4: 20 } }), 30);
    assert.equal(layout.vPadding({ 'layout-padding-type': 'simple', 'layout-padding': { p1: 5, p3: 10 } }), 10);
  });

  it('childMinWidth / childMaxWidth', () => {
    assert.equal(layout.childMinWidth({ 'layout-item-h-sizing': 'fill', 'layout-item-min-w': 50 }), 50);
    assert.equal(layout.childMinWidth({ 'layout-item-h-sizing': 'fix' }), 0.01);
    assert.equal(layout.childMaxWidth({ 'layout-item-h-sizing': 'fill', 'layout-item-max-w': 200 }), 200);
    assert.equal(layout.childMaxWidth({ 'layout-item-h-sizing': 'fix' }), Infinity);
  });

  it('childMargins with simple type mirrors', () => {
    const result = layout.childMargins({ 'layout-item-margin-type': 'simple', 'layout-item-margin': { m1: 1, m2: 2, m3: 3, m4: 4 } });
    assert.deepEqual(result, [1, 2, 1, 2]);
  });

  it('childMargins with multiple type uses all', () => {
    const result = layout.childMargins({ 'layout-item-margin-type': 'multiple', 'layout-item-margin': { m1: 1, m2: 2, m3: 3, m4: 4 } });
    assert.deepEqual(result, [1, 2, 3, 4]);
  });

  it('hStartQ / vStartQ direction-aware', () => {
    assert.equal(layout.hStartQ({ 'layout-flex-dir': 'column', 'layout-align-items': 'start' }), true);
    assert.equal(layout.hStartQ({ 'layout-flex-dir': 'row', 'layout-justify-content': 'start' }), true);
    assert.equal(layout.vStartQ({ 'layout-flex-dir': 'row', 'layout-align-items': 'start' }), true);
  });

  it('removeLayoutItemData strips item keys', () => {
    const shape = { id: 's1', 'layout-item-min-w': 10, 'layout-item-h-sizing': 'fill', name: 'Test' };
    const result = layout.removeLayoutItemData(shape);
    assert.equal(result['layout-item-min-w'], undefined);
    assert.equal(result.name, 'Test');
  });

  it('itemAbsoluteQ checks absolute flag', () => {
    assert.equal(layout.itemAbsoluteQ({ 'layout-item-absolute': true }), true);
    assert.equal(layout.itemAbsoluteQ({ 'layout-item-absolute': false }), false);
    assert.equal(layout.itemAbsoluteQ({}), false);
  });

  it('layoutZIndex returns z-index or 0', () => {
    assert.equal(layout.layoutZIndex({ 'layout-item-z-index': 5 }), 5);
    assert.equal(layout.layoutZIndex({}), 0);
  });
});

describe('geom/shapes/tree-seq', () => {
  it('getChildrenSeq flattens children', () => {
    const rootId = uuid.next();
    const childId1 = uuid.next();
    const childId2 = uuid.next();
    const objects = {
      [rootId]: { id: rootId, shapes: [childId1, childId2] },
      [childId1]: { id: childId1, shapes: [] },
      [childId2]: { id: childId2, shapes: [] },
    };
    const seq = treeSeq.getChildrenSeq(rootId, objects);
    assert.equal(seq.length, 2);
    assert.equal(seq[0].id, childId1);
    assert.equal(seq[1].id, childId2);
  });

  it('getChildrenSeq with nested children', () => {
    const rootId = uuid.next();
    const childId1 = uuid.next();
    const grandchildId = uuid.next();
    const objects = {
      [rootId]: { id: rootId, shapes: [childId1] },
      [childId1]: { id: childId1, shapes: [grandchildId] },
      [grandchildId]: { id: grandchildId, shapes: [] },
    };
    const seq = treeSeq.getChildrenSeq(rootId, objects);
    assert.equal(seq.length, 2);
  });

  it('getReflowRoot walks up to layout', () => {
    const rootId = uuid.next();
    const childId = uuid.next();
    const objects = {
      [rootId]: { id: rootId, type: 'frame', layout: 'flex', 'parent-id': uuid.zero, shapes: [childId] },
      [childId]: { id: childId, type: 'rect', 'parent-id': rootId },
    };
    const root = treeSeq.getReflowRoot(childId, objects);
    assert.equal(root, rootId);
  });

  it('getReflowRoot returns last root when no layout found', () => {
    const parentId = uuid.next();
    const childId = uuid.next();
    const objects = {
      [parentId]: { id: parentId, type: 'frame', layout: undefined, 'parent-id': uuid.zero, shapes: [childId] },
      [childId]: { id: childId, type: 'rect', 'parent-id': parentId },
    };
    const root = treeSeq.getReflowRoot(childId, objects);
    assert.equal(root, childId);
  });
});