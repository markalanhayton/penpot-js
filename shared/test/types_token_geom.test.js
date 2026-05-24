import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as token from '../src/types/token.js';
import * as grid from '../src/geom/grid.js';
import * as modifTree from '../src/geom/modif_tree.js';
import * as ctm from '../src/modifiers.js';

describe('types/token', () => {
  it('tokenTypes contains expected types', () => {
    assert.ok(token.tokenTypes.has('boolean'));
    assert.ok(token.tokenTypes.has('color'));
    assert.ok(token.tokenTypes.has('dimensions'));
    assert.ok(token.tokenTypes.has('typography'));
  });

  it('tokenTypeToDtcg maps token types', () => {
    assert.equal(token.tokenTypeToDtcg['color'], 'color');
    assert.equal(token.tokenTypeToDtcg['font-size'], 'fontSizes');
    assert.equal(token.tokenTypeToDtcg['border-radius'], 'borderRadius');
  });

  it('dtcgToTokenType maps DTCG types', () => {
    assert.equal(token.dtcgToTokenType['color'], 'color');
    assert.equal(token.dtcgToTokenType['fontSizes'], 'font-size');
    assert.equal(token.dtcgToTokenType['fontWeights'], 'font-weight');
  });

  it('tokenAttrQ checks if attr is a token attribute', () => {
    assert.ok(token.tokenAttrQ('fill'));
    assert.ok(token.tokenAttrQ('width'));
    assert.ok(token.tokenAttrQ('opacity'));
    assert.ok(!token.tokenAttrQ('unknown'));
  });

  it('tokenAttrToShapeAttr maps token attr to shape attr', () => {
    assert.equal(token.tokenAttrToShapeAttr('fill'), 'fills');
    assert.equal(token.tokenAttrToShapeAttr('stroke-color'), 'strokes');
    assert.equal(token.tokenAttrToShapeAttr('width'), 'width');
  });

  it('shapeAttrToTokenAttrs maps shape attr to token attrs', () => {
    const result = token.shapeAttrToTokenAttrs('fills');
    assert.ok(result.has('fill'));
  });

  it('applyTokenToShape applies token to shape', () => {
    const shape = { id: 's1', 'applied-tokens': {} };
    const tok = { name: 'colors.primary', type: 'color', value: '#ff0000' };
    const result = token.applyTokenToShape({ shape, token: tok, attributes: ['fill'] });
    assert.equal(result['applied-tokens']['fill'], 'colors.primary');
  });

  it('unapplyTokensFromShape removes token attrs', () => {
    const shape = { id: 's1', 'applied-tokens': { fill: 'colors.primary', width: 'spacing.md' } };
    const result = token.unapplyTokensFromShape(shape, new Set(['fill']));
    assert.equal(result['applied-tokens']['fill'], undefined);
    assert.equal(result['applied-tokens']['width'], 'spacing.md');
  });

  it('findTokenValueReferences extracts references', () => {
    const refs = token.findTokenValueReferences('{colors.primary} + {spacing.md}');
    assert.ok(refs.has('colors.primary'));
    assert.ok(refs.has('spacing.md'));
    assert.equal(refs.size, 2);
  });

  it('tokenValueSelfReferenceQ detects self references', () => {
    assert.ok(token.tokenValueSelfReferenceQ('colors.primary', 'Uses {colors.primary}'));
    assert.ok(!token.tokenValueSelfReferenceQ('colors.primary', 'Uses {other.token}'));
  });

  it('referencesTokenQ checks recursively', () => {
    assert.ok(token.referencesTokenQ('{colors.primary}', 'colors.primary'));
    assert.ok(token.referencesTokenQ({ nested: '{colors.primary}' }, 'colors.primary'));
    assert.ok(!token.referencesTokenQ('no references', 'colors.primary'));
  });

  it('updateTokenValueReferences replaces references', () => {
    const result = token.updateTokenValueReferences('{colors.old} + {spacing.md}', 'colors.old', 'colors.new');
    assert.equal(result, '{colors.new} + {spacing.md}');
  });

  it('validTextDecoration normalizes and validates', () => {
    assert.equal(token.validTextDecoration('underline'), 'underline');
    assert.equal(token.validTextDecoration(' NONE '), 'none');
    assert.equal(token.validTextDecoration('invalid'), null);
  });

  it('parseFontWeight parses weight and italic', () => {
    const result = token.parseFontWeight('bold italic');
    assert.equal(result.variant, 'bold');
    assert.equal(result.italicQ, true);
  });

  it('validFontWeightVariant converts aliases', () => {
    const result = token.validFontWeightVariant('regular');
    assert.equal(result.weight, '400');
    assert.equal(result.style, undefined);
  });

  it('validFontWeightVariant handles italic', () => {
    const result = token.validFontWeightVariant('bold italic');
    assert.equal(result.weight, '700');
    assert.equal(result.style, 'italic');
  });

  it('splitFontFamily splits comma-separated families', () => {
    const families = token.splitFontFamily('Arial, Helvetica, sans-serif');
    assert.deepEqual(families, ['Arial', 'Helvetica', 'sans-serif']);
  });

  it('joinFontFamily joins with comma-space', () => {
    const result = token.joinFontFamily(['Arial', 'Helvetica']);
    assert.equal(result, 'Arial, Helvetica');
  });

  it('shapeTypeToAttributes returns correct attributes', () => {
    const rectAttrs = token.shapeTypeToAttributes('rect', false);
    assert.ok(rectAttrs.has('width'));
    assert.ok(rectAttrs.has('fill'));

    const textAttrs = token.shapeTypeToAttributes('text', false);
    assert.ok(textAttrs.has('font-size'));
  });

  it('insertRef inserts reference at position', () => {
    const result = token.insertRef('hello world', 5, 'my.token');
    assert.ok(result.value.includes('{my.token}'));
  });
});

describe('geom/grid', () => {
  it('calculateSize calculates grid size', () => {
    const size = grid.calculateSize(1000, 100, 10, 5);
    assert.ok(size > 0);
  });

  it('gridAreas returns areas for column grid', () => {
    const frame = { x: 0, y: 0, width: 1000, height: 800 };
    const gridDef = {
      type: 'column',
      params: { size: 3, gutter: 10, margin: 20, 'item-length': null, type: 'center' },
    };
    const areas = grid.gridAreas(frame, gridDef);
    assert.ok(areas.length > 0);
    assert.ok(areas[0].width > 0);
  });

  it('gridGutter returns gutter for column grid', () => {
    const frame = { x: 0, y: 0, width: 1000, height: 800 };
    const gridDef = { type: 'column', params: { gutter: 10, margin: 20, 'item-length': null, type: 'center' } };
    const gutter = grid.gridGutter(frame, gridDef);
    assert.equal(gutter, 10);
  });
});

describe('geom/modif_tree', () => {
  it('addModifiersToTree adds modifiers for shape', () => {
    const tree = {};
    const modifiers = ctm.move(ctm.empty(), 10, 20);
    const result = modifTree.addModifiersToTree(tree, 'shape-1', modifiers);
    assert.ok(result['shape-1']);
    assert.ok(result['shape-1'].modifiers);
  });

  it('addModifiersToTree returns unchanged tree for empty modifiers', () => {
    const tree = { 'shape-1': { modifiers: ctm.move(ctm.empty(), 5, 0) } };
    const result = modifTree.addModifiersToTree(tree, 'shape-2', ctm.empty());
    assert.ok(result['shape-1']);
  });

  it('mergeModifTree merges two trees', () => {
    const tree1 = { 'shape-1': { modifiers: ctm.move(ctm.empty(), 10, 0) } };
    const tree2 = { 'shape-2': { modifiers: ctm.move(ctm.empty(), 0, 20) } };
    const result = modifTree.mergeModifTree(tree1, tree2);
    assert.ok(result['shape-1']);
    assert.ok(result['shape-2']);
  });
});