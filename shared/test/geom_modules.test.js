import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as line from '../src/geom/line.js';
import * as proportions from '../src/geom/proportions.js';
import * as align from '../src/geom/align.js';
import * as snap from '../src/geom/snap.js';
import * as grid from '../src/geom/grid.js';

describe('geom/line', () => {
  it('lineValue calculates line equation value', () => {
    const line1 = [[0, 0], [1, 0]];
    const point = { x: 0.5, y: 1 };
    const result = line.lineValue(line1, point);
    assert.ok(Math.abs(result) > 0);
  });

  it('lineValue returns non-zero for point off the line', () => {
    const result = line.lineValue([[0, 0], [1, 0]], { x: 0.5, y: 1 });
    assert.ok(result !== 0);
  });

  it('lineValue returns zero for point on the line', () => {
    const result = line.lineValue([[0, 0], [1, 0]], { x: 0.5, y: 0 });
    assert.equal(result, 0);
  });
});

describe('geom/proportions', () => {
  it('assignProportions sets proportion from selrect', () => {
    const shape = { selrect: { width: 100, height: 50 } };
    const result = proportions.assignProportions(shape);
    assert.equal(result.proportion, 2);
  });

  it('setupProportionsSize sets proportion and lock', () => {
    const shape = { selrect: { width: 200, height: 100 } };
    const result = proportions.setupProportionsSize(shape);
    assert.equal(result.proportion, 2);
    assert.equal(result['proportion-lock'], true);
  });

  it('setupProportionsConst sets proportion to 1', () => {
    const shape = { type: 'rect' };
    const result = proportions.setupProportionsConst(shape);
    assert.equal(result.proportion, 1);
    assert.equal(result['proportion-lock'], false);
  });

  it('setupProportions returns shape unchanged for text type', () => {
    const shape = { type: 'text', selrect: { width: 100, height: 50 } };
    const result = proportions.setupProportions(shape);
    assert.equal(result.proportion, undefined);
  });

  it('setupProportions sets proportions for rect type', () => {
    const shape = { type: 'rect', selrect: { width: 100, height: 50 } };
    const result = proportions.setupProportions(shape);
    assert.equal(result.proportion, 1);
    assert.equal(result['proportion-lock'], false);
  });

  it('setupProportionsImage sets proportion from metadata', () => {
    const shape = { metadata: { width: 300, height: 200 } };
    const result = proportions.setupProportionsImage(shape);
    assert.equal(result.proportion, 1.5);
    assert.equal(result['proportion-lock'], true);
  });
});

describe('geom/align', () => {
  it('calcAlignPos aligns hleft', () => {
    const result = align.calcAlignPos(
      { x: 10, y: 20, width: 100, height: 50 },
      { x: 0, y: 0, width: 200, height: 100 },
      'hleft'
    );
    assert.equal(result.x, 0);
    assert.equal(result.y, 20);
  });

  it('calcAlignPos aligns hcenter', () => {
    const result = align.calcAlignPos(
      { x: 10, y: 20, width: 100, height: 50 },
      { x: 0, y: 0, width: 200, height: 100 },
      'hcenter'
    );
    assert.equal(result.x, 50);
    assert.equal(result.y, 20);
  });

  it('calcAlignPos aligns vtop', () => {
    const result = align.calcAlignPos(
      { x: 10, y: 20, width: 100, height: 50 },
      { x: 0, y: 0, width: 200, height: 100 },
      'vtop'
    );
    assert.equal(result.x, 10);
    assert.equal(result.y, 0);
  });

  it('calcAlignPos aligns vcenter', () => {
    const result = align.calcAlignPos(
      { x: 10, y: 20, width: 100, height: 50 },
      { x: 0, y: 0, width: 200, height: 100 },
      'vcenter'
    );
    assert.equal(result.x, 10);
    assert.equal(result.y, 25);
  });

  it('calcAlignPos aligns hright', () => {
    const result = align.calcAlignPos(
      { x: 10, y: 20, width: 100, height: 50 },
      { x: 0, y: 0, width: 200, height: 100 },
      'hright'
    );
    assert.equal(result.x, 100);
    assert.equal(result.y, 20);
  });

  it('calcAlignPos aligns vbottom', () => {
    const result = align.calcAlignPos(
      { x: 10, y: 20, width: 100, height: 50 },
      { x: 0, y: 0, width: 200, height: 100 },
      'vbottom'
    );
    assert.equal(result.x, 10);
    assert.equal(result.y, 50);
  });

  it('adjustToViewport adjusts wider viewport', () => {
    const viewport = { width: 800, height: 600 };
    const srect = { x: 0, y: 0, width: 400, height: 300 };
    const result = align.adjustToViewport(viewport, srect);
    assert.ok(result.width >= 400);
    assert.ok(result.height >= 300);
  });

  it('adjustToViewport with padding', () => {
    const viewport = { width: 800, height: 600 };
    const srect = { x: 0, y: 0, width: 400, height: 300 };
    const result = align.adjustToViewport(viewport, srect, { padding: 50 });
    assert.ok(result.x <= 0);
    assert.ok(result.y <= 0);
    assert.ok(result.width >= 400);
    assert.ok(result.height >= 300);
  });

  it('adjustToViewport respects minZoom', () => {
    const viewport = { width: 800, height: 600 };
    const srect = { x: 100, y: 100, width: 10000, height: 10000 };
    const result = align.adjustToViewport(viewport, srect, { minZoom: 0.1 });
    assert.ok(result.width <= 8000);
    assert.ok(result.height <= 6000);
  });

  it('VALID_ALIGN_AXIS contains all axis values', () => {
    assert.ok(align.VALID_ALIGN_AXIS.has('hleft'));
    assert.ok(align.VALID_ALIGN_AXIS.has('hcenter'));
    assert.ok(align.VALID_ALIGN_AXIS.has('hright'));
    assert.ok(align.VALID_ALIGN_AXIS.has('vtop'));
    assert.ok(align.VALID_ALIGN_AXIS.has('vcenter'));
    assert.ok(align.VALID_ALIGN_AXIS.has('vbottom'));
  });
});

describe('geom/snap', () => {
  it('rectToSnapPoints returns 5 points', () => {
    const rect = { x: 0, y: 0, width: 100, height: 50 };
    const points = snap.rectToSnapPoints(rect);
    assert.equal(points.size, 5);
  });

  it('rectToSnapPoints returns null for null rect', () => {
    assert.equal(snap.rectToSnapPoints(null), null);
  });

  it('guideToSnapPoints returns x axis point', () => {
    const guide = { axis: 'x', position: 50 };
    const points = snap.guideToSnapPoints(guide, null);
    assert.equal(points.size, 1);
  });

  it('guideToSnapPoints returns y axis point', () => {
    const guide = { axis: 'y', position: 75 };
    const points = snap.guideToSnapPoints(guide, null);
    assert.equal(points.size, 1);
  });
});