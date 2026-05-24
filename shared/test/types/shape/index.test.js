import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fontWeightApplied, EXPORT_TYPES, BLUR_TYPES, SHADOW_STYLES,
  validShadow, editableAttrs, defaultColor,
  canGetBorderRadius, hasRadius, allEqual, radiusMode,
  setRadiusToAllCorners, setRadiusToSingleCorner, setRadiusForCorners,
  NODE_TYPES, validContent
} from '@penpot/shared/types/shape';

describe('types/shape', () => {
  it('fontWeightApplied', () => {
    assert.ok(fontWeightApplied({ 'applied-tokens': { 'font-weight': 'bold' } }));
    assert.ok(fontWeightApplied({ 'applied-tokens': { typography: { 'font-weight': 'bold' } } }));
    assert.ok(!fontWeightApplied({ 'applied-tokens': {} }));
    assert.ok(!fontWeightApplied({}));
  });

  it('EXPORT_TYPES', () => {
    assert.ok(EXPORT_TYPES.has('png'));
    assert.ok(EXPORT_TYPES.has('pdf'));
    assert.equal(EXPORT_TYPES.size, 5);
  });

  it('BLUR_TYPES', () => {
    assert.ok(BLUR_TYPES.has('layer-blur'));
    assert.ok(BLUR_TYPES.has('background-blur'));
    assert.equal(BLUR_TYPES.size, 2);
  });

  it('SHADOW_STYLES', () => {
    assert.ok(SHADOW_STYLES.has('drop-shadow'));
    assert.ok(SHADOW_STYLES.has('inner-shadow'));
    assert.equal(SHADOW_STYLES.size, 2);
  });

  it('validShadow', () => {
    assert.ok(validShadow({
      style: 'drop-shadow', 'offset-x': 1, 'offset-y': 2,
      blur: 3, spread: 0, hidden: false
    }));
    assert.ok(!validShadow({ style: 'invalid' }));
  });

  it('editableAttrs has all shape types', () => {
    assert.ok(editableAttrs.frame instanceof Set);
    assert.ok(editableAttrs.group instanceof Set);
    assert.ok(editableAttrs.rect instanceof Set);
    assert.ok(editableAttrs.circle instanceof Set);
    assert.ok(editableAttrs.path instanceof Set);
    assert.ok(editableAttrs.text instanceof Set);
    assert.ok(editableAttrs.image instanceof Set);
    assert.ok(editableAttrs['svg-raw'] instanceof Set);
    assert.ok(editableAttrs.bool instanceof Set);
  });

  it('editableAttrs frame has correct attrs', () => {
    assert.ok(editableAttrs.frame.has('fills'));
    assert.ok(editableAttrs.frame.has('layout'));
    assert.ok(editableAttrs.frame.has('r1'));
  });

  it('defaultColor', () => {
    assert.equal(defaultColor, '#B1B2B5');
  });

  it('canGetBorderRadius', () => {
    assert.ok(canGetBorderRadius({ type: 'rect' }));
    assert.ok(canGetBorderRadius({ type: 'frame' }));
    assert.ok(!canGetBorderRadius({ type: 'text' }));
  });

  it('hasRadius', () => {
    assert.ok(hasRadius({ type: 'rect' }));
    assert.ok(hasRadius({ type: 'frame' }));
    assert.ok(hasRadius({ type: 'image' }));
    assert.ok(!hasRadius({ type: 'text' }));
    assert.ok(!hasRadius({ type: 'group' }));
  });

  it('allEqual', () => {
    assert.ok(allEqual({ r1: 10, r2: 10, r3: 10, r4: 10 }));
    assert.ok(!allEqual({ r1: 10, r2: 20, r3: 10, r4: 10 }));
  });

  it('radiusMode', () => {
    assert.equal(radiusMode({ r1: 10, r2: 10, r3: 10, r4: 10 }), 'radius-1');
    assert.equal(radiusMode({ r1: 10, r2: 20, r3: 10, r4: 10 }), 'radius-4');
  });

  it('setRadiusToAllCorners', () => {
    const r = setRadiusToAllCorners({ type: 'rect', r1: 0, r2: 0, r3: 0, r4: 0 }, 10);
    assert.equal(r.r1, 10);
    assert.equal(r.r4, 10);
  });

  it('setRadiusToAllCorners on unsupported shape', () => {
    const s = { type: 'text' };
    assert.deepEqual(setRadiusToAllCorners(s, 10), s);
  });

  it('setRadiusToSingleCorner', () => {
    const r = setRadiusToSingleCorner({ type: 'rect', r1: 0, r2: 0, r3: 0, r4: 0 }, 'r1', 15);
    assert.equal(r.r1, 15);
    assert.equal(r.r2, 0);
  });

  it('setRadiusForCorners', () => {
    const r = setRadiusForCorners({ type: 'rect', r1: 0, r2: 0, r3: 0, r4: 0 }, ['r1', 'r3'], 5);
    assert.equal(r.r1, 5);
    assert.equal(r.r2, 0);
    assert.equal(r.r3, 5);
  });

  it('NODE_TYPES', () => {
    assert.ok(NODE_TYPES.has('root'));
    assert.ok(NODE_TYPES.has('paragraph-set'));
    assert.ok(NODE_TYPES.has('paragraph'));
    assert.equal(NODE_TYPES.size, 3);
  });

  it('validContent', () => {
    assert.ok(validContent({ type: 'root' }));
    assert.ok(!validContent(null));
    assert.ok(!validContent({ type: 'paragraph' }));
  });
});