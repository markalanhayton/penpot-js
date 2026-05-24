import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pageDiff from '../../src/files/page_diff.js';
import * as tokens from '../../src/files/tokens.js';

describe('files/page-diff', () => {
  it('detects new shapes', () => {
    const oldPage = { objects: { a: { type: 'rect', frameId: 'f1' } } };
    const newPage = { objects: { a: { type: 'rect', frameId: 'f1' }, b: { type: 'text', frameId: 'f1' } } };
    const diff = pageDiff.calculatePageDiff(oldPage, newPage, ['type']);
    assert.equal(diff.newShapes.length, 1);
    assert.equal(diff.newShapes[0].type, 'text');
  });

  it('detects removed shapes', () => {
    const oldPage = { objects: { a: { type: 'rect', frameId: 'f1' }, b: { type: 'text', frameId: 'f1' } } };
    const newPage = { objects: { a: { type: 'rect', frameId: 'f1' } } };
    const diff = pageDiff.calculatePageDiff(oldPage, newPage, ['type']);
    assert.equal(diff.removedShapes.length, 1);
    assert.equal(diff.removedShapes[0].type, 'text');
  });

  it('detects frame changes', () => {
    const oldPage = { objects: { f1: { type: 'frame', frameId: 'root' } } };
    const newPage = { objects: { f1: { type: 'frame', frameId: 'root', name: 'changed' } } };
    const diff = pageDiff.calculatePageDiff(oldPage, newPage, ['name']);
    assert.equal(diff.updatedFrames.length, 1);
  });

  it('detects changed frame ownership', () => {
    const oldPage = { objects: { a: { type: 'rect', frameId: 'f1' } } };
    const newPage = { objects: { a: { type: 'rect', frameId: 'f2' } } };
    const diff = pageDiff.calculatePageDiff(oldPage, newPage, ['type', 'frameId']);
    assert.equal(diff.changeFrameShapes.length, 1);
  });

  it('detects unchanged objects', () => {
    const page = { objects: { a: { type: 'rect', frameId: 'f1' } } };
    const diff = pageDiff.calculatePageDiff(page, page, ['type']);
    assert.equal(diff.updatedShapes.length, 0);
    assert.equal(diff.newShapes.length, 0);
    assert.equal(diff.removedShapes.length, 0);
  });
});

describe('files/tokens', () => {
  it('parseTokenValue parses number', () => {
    const result = tokens.parseTokenValue(42);
    assert.deepEqual(result, { value: 42 });
  });

  it('parseTokenValue parses string with unit', () => {
    const result = tokens.parseTokenValue('16px');
    assert.deepEqual(result, { value: 16, unit: 'px' });
  });

  it('parseTokenValue parses percent', () => {
    const result = tokens.parseTokenValue('50%');
    assert.deepEqual(result, { value: 50, unit: '%' });
  });

  it('parseTokenValue returns undefined for invalid', () => {
    assert.equal(tokens.parseTokenValue('abc'), undefined);
  });

  it('attributesMap creates name mapping', () => {
    const result = tokens.attributesMap(['fill', 'stroke'], { name: 'primary' });
    assert.equal(result.fill, 'primary');
    assert.equal(result.stroke, 'primary');
  });

  it('removeAttributesForToken removes matching', () => {
    const applied = { fill: 'primary', stroke: 'secondary', opacity: 'primary' };
    const result = tokens.removeAttributesForToken(['fill', 'opacity'], 'primary', applied);
    assert.equal(result.fill, undefined);
    assert.equal(result.stroke, 'secondary');
    assert.equal(result.opacity, undefined);
  });

  it('tokenAttributeAppliedQ checks application', () => {
    const token = { name: 'primary' };
    const shape = { appliedTokens: { fill: 'primary', stroke: 'secondary' } };
    assert.equal(tokens.tokenAttributeAppliedQ(token, shape, 'fill'), true);
    assert.equal(tokens.tokenAttributeAppliedQ(token, shape, 'stroke'), false);
  });

  it('tokenAppliedQ checks multiple attributes', () => {
    const token = { name: 'primary' };
    const shape = { appliedTokens: { fill: 'primary', stroke: 'secondary' } };
    assert.equal(tokens.tokenAppliedQ(token, shape, ['fill', 'stroke']), true);
    assert.equal(tokens.tokenAppliedQ(token, shape, ['stroke']), false);
  });

  it('colorTokenQ checks type', () => {
    assert.equal(tokens.colorTokenQ({ type: 'color' }), true);
    assert.equal(tokens.colorTokenQ({ type: 'opacity' }), false);
  });

  it('isReferenceQ checks for braces', () => {
    assert.equal(tokens.isReferenceQ({ value: '{colors.primary}' }), true);
    assert.equal(tokens.isReferenceQ({ value: '#ff0000' }), false);
  });
});