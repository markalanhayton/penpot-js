import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Shape, createShape, isShape, SHAPE_TYPES, BLEND_MODES, hasImagesQ, hasValidStrokeAttrsQ, isAllowedSwitchKeepAttrQ, setupShape, setupRect, STROKE_ATTRS } from '../../src/types/shape_type.js';

describe('shape_type', () => {
  it('Shape class', () => {
    const s = createShape({ id: '1', name: 'Test', type: 'rect' });
    assert.ok(isShape(s));
    assert.equal(s.id, '1');
    assert.equal(s.type, 'rect');
  });

  it('isShape on plain object returns false', () => {
    assert.equal(isShape({ id: '1' }), false);
    assert.equal(isShape(null), false);
  });

  it('SHAPE_TYPES', () => {
    assert.equal(SHAPE_TYPES.size, 9);
    assert.equal(SHAPE_TYPES.has('frame'), true);
    assert.equal(SHAPE_TYPES.has('rect'), true);
    assert.equal(SHAPE_TYPES.has('text'), true);
  });

  it('BLEND_MODES', () => {
    assert.ok(BLEND_MODES.size >= 16);
    assert.equal(BLEND_MODES.has('normal'), true);
  });

  it('hasValidStrokeAttrsQ', () => {
    assert.equal(hasValidStrokeAttrsQ({ 'stroke-color': '#000' }), true);
    assert.equal(hasValidStrokeAttrsQ({ 'stroke-color': '#000', 'stroke-image': 'img' }), false);
    assert.equal(hasValidStrokeAttrsQ({ fills: 'yes' }), false);
  });

  it('hasImagesQ', () => {
    assert.equal(hasImagesQ({ fills: [{ 'fill-image': 'img1' }] }), true);
    assert.equal(hasImagesQ({ fills: [{ 'fill-color': '#000' }] }), false);
  });

  it('isAllowedSwitchKeepAttrQ', () => {
    assert.equal(isAllowedSwitchKeepAttrQ('fills', 'rect'), true);
    assert.equal(isAllowedSwitchKeepAttrQ('shapes', 'group'), true);
    assert.equal(isAllowedSwitchKeepAttrQ('nonexistent', 'rect'), false);
  });

  it('setupRect', () => {
    const s = setupRect({ x: 10, y: 20, width: 100, height: 50 });
    assert.ok(s.selrect);
    assert.ok(s.points);
    assert.ok(s.transform);
  });

  it('setupShape', () => {
    const s = setupShape({ type: 'rect', x: 0, y: 0, width: 100, height: 50 });
    assert.ok(isShape(s));
    assert.equal(s.type, 'rect');
    assert.ok(s.id);
    assert.ok(s.transform);
  });

  it('STROKE_ATTRS has entries', () => {
    assert.ok(STROKE_ATTRS.size > 10);
    assert.equal(STROKE_ATTRS.has('stroke-color'), true);
    assert.equal(STROKE_ATTRS.has('stroke-width'), true);
  });
});