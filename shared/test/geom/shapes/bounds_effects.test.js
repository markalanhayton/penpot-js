import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as effects from '../../../src/geom/shapes/effects.js';
import * as strokes from '../../../src/geom/shapes/strokes.js';
import * as bounds from '../../../src/geom/shapes/bounds.js';
import * as areas from '../../../src/geom/shapes/grid_layout/areas.js';

describe('geom/shapes/effects', () => {
  it('updateShadowScale scales all shadow params', () => {
    const shadow = { offsetX: 4, offsetY: 6, spread: 2, blur: 8 };
    const result = effects.updateShadowScale(shadow, 2);
    assert.equal(result.offsetX, 8);
    assert.equal(result.offsetY, 12);
    assert.equal(result.spread, 4);
    assert.equal(result.blur, 16);
  });

  it('updateShadowsScale scales all shadows on shape', () => {
    const shape = { shadow: [{ offsetX: 2, offsetY: 3, spread: 1, blur: 4 }] };
    const result = effects.updateShadowsScale(shape, 3);
    assert.equal(result.shadow[0].offsetX, 6);
  });

  it('updateShadowsScale handles no shadow', () => {
    const shape = { shadow: undefined };
    const result = effects.updateShadowsScale(shape, 2);
    assert.equal(result.shadow, undefined);
  });

  it('updateBlurScale scales blur value', () => {
    const shape = { blur: { type: 'layer-blur', value: 10 } };
    const result = effects.updateBlurScale(shape, 3);
    assert.equal(result.blur.value, 30);
  });

  it('updateBlurScale handles no blur', () => {
    const shape = { blur: undefined };
    const result = effects.updateBlurScale(shape, 2);
    assert.equal(result.blur, undefined);
  });
});

describe('geom/shapes/strokes', () => {
  it('updateStrokeWidth scales stroke width', () => {
    const stroke = { strokeWidth: 2 };
    const result = strokes.updateStrokeWidth(stroke, 3);
    assert.equal(result.strokeWidth, 6);
  });

  it('updateStrokesWidth scales all strokes', () => {
    const shape = { strokes: [{ strokeWidth: 1 }, { strokeWidth: 2 }] };
    const result = strokes.updateStrokesWidth(shape, 2);
    assert.equal(result.strokes[0].strokeWidth, 2);
    assert.equal(result.strokes[1].strokeWidth, 4);
  });

  it('updateStrokesWidth handles no strokes', () => {
    const shape = { strokes: undefined };
    const result = strokes.updateStrokesWidth(shape, 2);
    assert.equal(result.strokes, undefined);
  });
});

describe('geom/shapes/bounds', () => {
  it('shapeStrokeMargin for non-path shape', () => {
    const margin = bounds.shapeStrokeMargin({ type: 'rect' }, 2);
    assert.ok(margin > 0);
    assert.equal(margin, Math.sqrt(2 * 2 * 2));
  });

  it('shapeStrokeMargin for path shape', () => {
    const margin = bounds.shapeStrokeMargin({ type: 'path' }, 2);
    assert.ok(margin > 0);
  });

  it('shapeToFilters creates filter list', () => {
    const shape = {
      shadow: [{ id: 's1', style: 'drop-shadow', offsetX: 2, offsetY: 3, spread: 1, blur: 4 }],
      blur: { type: 'layer-blur', value: 5 },
    };
    const filters = bounds.shapeToFilters(shape);
    assert.ok(filters.length > 0);
    assert.ok(filters.some(f => f.type === 'drop-shadow'));
    assert.ok(filters.some(f => f.type === 'layer-blur'));
  });

  it('calculatePadding with no strokes/shadows', () => {
    const padding = bounds.calculatePadding({ type: 'rect', strokes: [], shadow: [] });
    assert.equal(padding.horizontal, 0);
    assert.equal(padding.vertical, 0);
  });

  it('calculatePadding with strokes', () => {
    const padding = bounds.calculatePadding({ type: 'rect', strokes: [{ strokeWidth: 4, strokeAlignment: 'center' }], shadow: [] });
    assert.ok(padding.horizontal > 0);
  });

  it('calculateBaseBounds returns a rect', () => {
    const shape = { type: 'rect', selrect: { x: 0, y: 0, width: 100, height: 50, x1: 0, y1: 0, x2: 100, y2: 50 }, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }], strokes: [], shadow: [] };
    const result = bounds.calculateBaseBounds(shape, true, false);
    assert.ok(result !== undefined);
    assert.ok(result.width >= 0);
  });
});

describe('geom/shapes/grid-layout/areas', () => {
  it('makeArea from coords', () => {
    const area = areas.makeArea(1, 2, 3, 4);
    assert.deepEqual(area, [1, 2, 3, 4]);
  });

  it('makeArea from cell props', () => {
    const area = areas.makeArea({ column: 1, row: 2, columnSpan: 3, rowSpan: 4 });
    assert.deepEqual(area, [1, 2, 3, 4]);
  });

  it('areaToCellProps', () => {
    const props = areas.areaToCellProps([1, 2, 3, 4]);
    assert.equal(props.column, 1);
    assert.equal(props.row, 2);
    assert.equal(props.columnSpan, 3);
    assert.equal(props.rowSpan, 4);
  });

  it('containsQ detects containment', () => {
    const a = [0, 0, 10, 10];
    const b = [2, 2, 5, 5];
    assert.equal(areas.containsQ(a, b), true);
    assert.equal(areas.containsQ(b, a), false);
  });

  it('intersectsQ detects intersection', () => {
    const a = [0, 0, 10, 10];
    const b = [5, 5, 10, 10];
    assert.equal(areas.intersectsQ(a, b), true);
    const c = [20, 20, 5, 5];
    assert.equal(areas.intersectsQ(a, c), false);
  });

  it('difference subtracts areas', () => {
    const a = [0, 0, 10, 10];
    const b = [2, 2, 6, 6];
    const result = areas.difference(a, b);
    assert.ok(result.length > 0);
    assert.ok(result.length <= 4);
  });

  it('difference returns empty when no intersection', () => {
    const a = [0, 0, 5, 5];
    const b = [10, 10, 5, 5];
    const result = areas.difference(a, b);
    assert.equal(result.length, 0);
  });

  it('difference returns empty when b contains a', () => {
    const a = [2, 2, 3, 3];
    const b = [0, 0, 10, 10];
    const result = areas.difference(a, b);
    assert.equal(result.length, 0);
  });
});