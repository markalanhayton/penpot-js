import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SYNC_ATTRS, SWAP_KEEP_ATTRS, resolveSyncGroup, componentAttrQ, instanceRootQ, instanceHeadQ, mainInstanceQ, inComponentCopyQ, detachShape, unheadShape, reheadShape, isVariantQ, isVariantContainerQ, setTouchedGroup, touchedGroupQ, buildSwapSlotGroup, swapSlotQ, normalTouchedGroups, groupToSwapSlot, getSwapSlot, setSwapSlot, matchSwapSlotQ, removeSwapSlot, validTouchedGroupQ, diffComponents } from '../../src/types/component.js';

describe('component', () => {
  it('SYNC_ATTRS has expected entries', () => {
    assert.equal(SYNC_ATTRS.fills, 'fill-group');
    assert.equal(SYNC_ATTRS.x, 'geometry-group');
    assert.equal(SYNC_ATTRS.strokes, 'stroke-group');
  });

  it('resolveSyncGroup simple', () => {
    assert.equal(resolveSyncGroup('rect', 'fills'), 'fill-group');
  });

  it('resolveSyncGroup multi-type attr', () => {
    assert.equal(resolveSyncGroup('path', 'content'), 'geometry-group');
    assert.equal(resolveSyncGroup('text', 'content'), 'content-group');
  });

  it('resolveSyncGroup unknown attr', () => {
    assert.equal(resolveSyncGroup('rect', 'nonexistent'), null);
  });

  it('SWAP_KEEP_ATTRS has entries', () => {
    assert.equal(SWAP_KEEP_ATTRS.size, 12);
    assert.equal(SWAP_KEEP_ATTRS.has('interactions'), true);
  });

  it('componentAttrQ returns true for sync attrs', () => {
    assert.equal(componentAttrQ('fills'), true);
    assert.equal(componentAttrQ('shape-ref'), true);
    assert.equal(componentAttrQ('nonexistent'), false);
  });

  it('instanceRootQ', () => {
    assert.equal(instanceRootQ({ 'component-root': true }), true);
    assert.equal(instanceRootQ({ 'component-root': false }), false);
    assert.equal(instanceRootQ({}), false);
  });

  it('instanceHeadQ', () => {
    assert.equal(instanceHeadQ({ 'component-id': 'abc' }), true);
    assert.equal(instanceHeadQ({}), false);
  });

  it('mainInstanceQ', () => {
    assert.equal(mainInstanceQ({ 'main-instance': true }), true);
    assert.equal(mainInstanceQ({}), false);
  });

  it('inComponentCopyQ', () => {
    assert.equal(inComponentCopyQ({ 'shape-ref': 'abc' }), true);
    assert.equal(inComponentCopyQ({}), false);
  });

  it('detachShape removes component keys', () => {
    const shape = { id: '1', 'component-id': 'c', 'component-file': 'f', 'component-root': true, 'shape-ref': 'r', name: 'test' };
    const result = detachShape(shape);
    assert.equal(result.id, '1');
    assert.equal(result.name, 'test');
    assert.equal(result['component-id'], undefined);
    assert.equal(result['component-file'], undefined);
  });

  it('unheadShape removes head keys', () => {
    const shape = { id: '1', 'component-id': 'c', 'component-root': true, 'main-instance': true, 'shape-ref': 'r' };
    const result = unheadShape(shape);
    assert.equal(result.id, '1');
    assert.equal(result['shape-ref'], 'r');
    assert.equal(result['component-id'], undefined);
  });

  it('reheadShape adds component links', () => {
    const shape = { id: '1' };
    const result = reheadShape(shape, 'file1', 'comp1');
    assert.equal(result['component-file'], 'file1');
    assert.equal(result['component-id'], 'comp1');
  });

  it('isVariantQ', () => {
    assert.equal(isVariantQ({ 'variant-id': 'v1' }), true);
    assert.equal(isVariantQ({}), false);
  });

  it('isVariantContainerQ', () => {
    assert.equal(isVariantContainerQ({ 'is-variant-container': true }), true);
    assert.equal(isVariantContainerQ({}), false);
  });

  it('setTouchedGroup / touchedGroupQ', () => {
    const touched = setTouchedGroup(null, 'fill-group');
    assert.equal(touchedGroupQ({ touched }, 'fill-group'), true);
    assert.equal(touchedGroupQ({ touched }, 'stroke-group'), false);
  });

  it('swap slot operations', () => {
    const group = buildSwapSlotGroup('abc-123');
    assert.equal(swapSlotQ(group), true);
    assert.equal(groupToSwapSlot(group), 'abc-123');
    assert.equal(swapSlotQ('fill-group'), false);
  });

  it('getSwapSlot / setSwapSlot', () => {
    let shape = {};
    shape = setSwapSlot(shape, 'abc-123');
    assert.equal(getSwapSlot(shape), 'abc-123');
    shape = removeSwapSlot(shape);
    assert.equal(getSwapSlot(shape), null);
  });

  it('normalTouchedGroups excludes swap slots', () => {
    let s = {};
    s = { ...s, touched: setTouchedGroup(s.touched, 'fill-group') };
    s = setSwapSlot(s, 'abc');
    const normal = normalTouchedGroups(s);
    assert.equal(normal.has('fill-group'), true);
    for (const g of normal) assert.equal(swapSlotQ(g), false);
  });

  it('validTouchedGroupQ', () => {
    assert.equal(validTouchedGroupQ('fill-group'), true);
    assert.equal(validTouchedGroupQ('swap-slot-abc'), true);
    assert.equal(validTouchedGroupQ('invalid-group'), false);
  });

  it('diffComponents', () => {
    const c1 = { id: '1', name: 'A', version: 1 };
    const c2 = { id: '1', name: 'B', version: 1 };
    const diff = diffComponents(c1, c2);
    assert.equal(diff.has('name'), true);
    assert.equal(diff.has('id'), false);
  });
});