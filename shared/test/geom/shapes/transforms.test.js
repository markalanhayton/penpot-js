import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as gtr from '../../../src/geom/shapes/transforms.js';
import * as gpt from '../../../src/geom/point.js';
import * as grc from '../../../src/geom/rect.js';
import * as gmt from '../../../src/geom/matrix.js';
import * as ctm from '../../../src/modifiers.js';

describe('transforms/move', () => {
  it('move translates shape', () => {
    const shape = {
      type: 'rect',
      x: 0, y: 0,
      selrect: grc.makeRect(0, 0, 10, 10),
      points: [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)],
    };
    const result = gtr.move(shape, gpt.point(5, 10));
    assert.equal(result.x, 5);
    assert.equal(result.y, 10);
    assert.equal(result.selrect.x, 5);
    assert.equal(result.selrect.y, 10);
    assert.equal(result.points[0].x, 5);
    assert.equal(result.points[0].y, 10);
  });

  it('absoluteMove moves shape to exact position', () => {
    const shape = {
      type: 'rect',
      x: 10, y: 20,
      selrect: grc.makeRect(10, 20, 10, 10),
      points: [gpt.point(10, 20), gpt.point(20, 20), gpt.point(20, 30), gpt.point(10, 30)],
    };
    const result = gtr.absoluteMove(shape, gpt.point(0, 0));
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
  });

  it('movePositionData translates position data', () => {
    const pd = [{ x: 10, y: 20 }, { x: 30, y: 40 }];
    const result = gtr.movePositionData(pd, gpt.point(5, 10));
    assert.equal(result[0].x, 15);
    assert.equal(result[0].y, 30);
    assert.equal(result[1].x, 35);
    assert.equal(result[1].y, 50);
  });

  it('movePositionData null returns null', () => {
    assert.equal(gtr.movePositionData(null, gpt.point(1, 1)), null);
  });

  it('transformPositionData transforms position data', () => {
    const pd = [{ x: 10, y: 20 }];
    const result = gtr.transformPositionData(pd, gmt.matrix(1, 0, 0, 1, 5, 10));
    assert.equal(result[0].x, 15);
    assert.equal(result[0].y, 30);
  });
});

describe('transforms/matrix', () => {
  it('transformMatrix no transform returns identity-like', () => {
    const shape = { selrect: grc.makeRect(0, 0, 10, 10) };
    const m = gtr.transformMatrix(shape, { noFlip: true });
    assert.ok(m != null);
  });

  it('transformStr with no transform returns empty string', () => {
    const shape = { transform: null, flipX: false, flipY: false, selrect: grc.makeRect(0, 0, 10, 10) };
    assert.equal(gtr.transformStr(shape, { noFlip: true }), '');
  });
});

describe('transforms/calculate', () => {
  it('calculateSelrect from points', () => {
    const points = [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)];
    const center = gpt.point(5, 5);
    const r = gtr.calculateSelrect(points, center);
    assert.ok(r != null);
    assert.ok(Math.abs(r.width - 10) < 1);
    assert.ok(Math.abs(r.height - 10) < 1);
  });

  it('transformRect transforms a rect', () => {
    const rect = grc.makeRect(0, 0, 10, 10);
    const m = gmt.translateMatrix(gpt.point(5, 5));
    const result = gtr.transformRect(rect, m);
    assert.ok(result != null);
    assert.equal(result.x, 5);
    assert.equal(result.y, 5);
  });
});

describe('transforms/apply', () => {
  it('applyTransform with null returns shape unchanged', () => {
    const shape = { x: 0, y: 0, type: 'rect' };
    const result = gtr.applyTransform(shape, null);
    assert.equal(result.x, 0);
  });

  it('applyTransform with move matrix moves shape', () => {
    const shape = {
      type: 'rect',
      x: 0, y: 0,
      selrect: grc.makeRect(0, 0, 10, 10),
      points: [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)],
    };
    const m = gmt.matrix(1, 0, 0, 1, 5, 10);
    const result = gtr.applyTransform(shape, m);
    assert.equal(result.selrect.x, 5);
    assert.equal(result.selrect.y, 10);
  });
});

describe('transforms/transformShape', () => {
  it('transformShape with null modifiers returns shape', () => {
    const shape = { id: '1', type: 'rect' };
    const result = gtr.transformShape(shape, null);
    assert.deepEqual(result, shape);
  });

  it('transformShape with empty modifiers returns shape', () => {
    const shape = { id: '1', type: 'rect' };
    const result = gtr.transformShape(shape, ctm.empty());
    assert.deepEqual(result, shape);
  });
});

describe('transforms/selrect', () => {
  it('transformSelrect with modifiers', () => {
    const rect = grc.makeRect(0, 0, 10, 10);
    const mod = ctm.moveParent(ctm.empty(), gpt.point(5, 5));
    const result = gtr.transformSelrect(rect, mod);
    assert.ok(result != null);
  });

  it('transformSelrectMatrix transforms rect', () => {
    const rect = grc.makeRect(0, 0, 10, 10);
    const m = gmt.translateMatrix(gpt.point(5, 5));
    const result = gtr.transformSelrectMatrix(rect, m);
    assert.ok(result != null);
    assert.equal(result.x, 5);
    assert.equal(result.y, 5);
  });
});

describe('transforms/group', () => {
  it('updateGroupSelrect recalculates from children', () => {
    const group = {
      type: 'group',
      shapes: ['c1'],
      selrect: grc.makeRect(0, 0, 10, 10),
      points: [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)],
    };
    const children = [
      {
        selrect: grc.makeRect(2, 2, 5, 5),
        points: [gpt.point(2, 2), gpt.point(7, 2), gpt.point(7, 7), gpt.point(2, 7)],
      },
    ];
    const result = gtr.updateGroupSelrect(group, children);
    assert.ok(result != null);
    assert.ok(result.selrect != null);
  });

  it('updateMaskSelrect copies mask child geometry', () => {
    const group = {
      type: 'mask',
      shapes: ['c1'],
      selrect: grc.makeRect(0, 0, 10, 10),
      points: [],
    };
    const children = [
      {
        id: 'c1',
        selrect: grc.makeRect(5, 5, 20, 20),
        points: [gpt.point(5, 5), gpt.point(25, 5), gpt.point(25, 25), gpt.point(5, 25)],
        flipX: false,
        flipY: true,
      },
    ];
    const result = gtr.updateMaskSelrect(group, children);
    assert.equal(result.x, 5);
    assert.equal(result.y, 5);
    assert.equal(result.flipX, false);
    assert.equal(result.flipY, true);
  });
});

describe('transforms/objects-modifiers', () => {
  it('applyObjectsModifiers with empty map returns same', () => {
    const objects = { a: { id: 'a', type: 'rect' } };
    const result = gtr.applyObjectsModifiers(objects, {});
    assert.deepEqual(result, objects);
  });
});