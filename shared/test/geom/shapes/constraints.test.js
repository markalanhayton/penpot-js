import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as gct from '../../../src/geom/shapes/constraints.js';
import * as gpt from '../../../src/geom/point.js';

describe('constraints/helpers', () => {
  it('otherAxis x -> y', () => {
    assert.equal(gct.otherAxis('x'), 'y');
  });

  it('otherAxis y -> x', () => {
    assert.equal(gct.otherAxis('y'), 'x');
  });

  it('getDeltaStart', () => {
    const rect = { x1: 0, y1: 0, x2: 10, y2: 10, width: 10, height: 10 };
    const trRect = { x1: 5, y1: 3, x2: 15, y2: 13, width: 10, height: 10 };
    assert.equal(gct.getDeltaStart('x', rect, trRect), 5);
    assert.equal(gct.getDeltaStart('y', rect, trRect), 3);
  });

  it('getDeltaEnd', () => {
    const rect = { x1: 0, y1: 0, x2: 10, y2: 10, width: 10, height: 10 };
    const trRect = { x1: 5, y1: 3, x2: 15, y2: 13, width: 10, height: 10 };
    assert.equal(gct.getDeltaEnd('x', rect, trRect), 5);
    assert.equal(gct.getDeltaEnd('y', rect, trRect), 3);
  });

  it('getDeltaSize', () => {
    const rect = { x1: 0, y1: 0, x2: 10, y2: 10, width: 10, height: 10 };
    const trRect = { x1: 0, y1: 0, x2: 20, y2: 20, width: 20, height: 20 };
    assert.equal(gct.getDeltaSize('x', rect, trRect), 10);
    assert.equal(gct.getDeltaSize('y', rect, trRect), 10);
  });

  it('getDisplacement', () => {
    const d = gct.getDisplacement('x', 5);
    assert.equal(d.x, 5);
    assert.equal(d.y, 0);
  });

  it('getScale', () => {
    const s = gct.getScale('x', 2);
    assert.equal(s.x, 2);
    assert.equal(s.y, 1);
  });

  it('getSize', () => {
    const rect = { width: 10, height: 20 };
    assert.equal(gct.getSize('x', rect), 10);
    assert.equal(gct.getSize('y', rect), 20);
  });
});

describe('constraints/defaults', () => {
  const uuidZero = '00000000-0000-0000-0000-000000000000';

  it('defaultConstraintsH for root returns undefined', () => {
    assert.equal(gct.defaultConstraintsH({ parentId: uuidZero }), undefined);
  });

  it('defaultConstraintsH frame child returns left', () => {
    assert.equal(
      gct.defaultConstraintsH({ parentId: 'p1', frameId: 'p1' }),
      'left'
    );
  });

  it('defaultConstraintsH non-frame child returns scale', () => {
    assert.equal(
      gct.defaultConstraintsH({ parentId: 'p1', frameId: 'f1' }),
      'scale'
    );
  });

  it('defaultConstraintsV for root returns undefined', () => {
    assert.equal(gct.defaultConstraintsV({ parentId: uuidZero }), undefined);
  });

  it('defaultConstraintsV frame child returns top', () => {
    assert.equal(
      gct.defaultConstraintsV({ parentId: 'p1', frameId: 'p1' }),
      'top'
    );
  });
});

describe('constraints/const-to-type', () => {
  it('CONST_TO_TYPE_AXIS mapping', () => {
    assert.equal(gct.CONST_TO_TYPE_AXIS.get('left'), 'start');
    assert.equal(gct.CONST_TO_TYPE_AXIS.get('top'), 'start');
    assert.equal(gct.CONST_TO_TYPE_AXIS.get('right'), 'end');
    assert.equal(gct.CONST_TO_TYPE_AXIS.get('bottom'), 'end');
    assert.equal(gct.CONST_TO_TYPE_AXIS.get('leftright'), 'fixed');
    assert.equal(gct.CONST_TO_TYPE_AXIS.get('topbottom'), 'fixed');
    assert.equal(gct.CONST_TO_TYPE_AXIS.get('center'), 'center');
    assert.equal(gct.CONST_TO_TYPE_AXIS.get('scale'), 'scale');
  });

  it('sideVector returns horizontal for x', () => {
    const pts = [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)];
    const v = gct.sideVector('x', pts);
    assert.equal(v.x, 10);
    assert.equal(v.y, 0);
  });

  it('sideVector returns vertical for y', () => {
    const pts = [gpt.point(0, 0), gpt.point(10, 0), gpt.point(10, 10), gpt.point(0, 10)];
    const v = gct.sideVector('y', pts);
    assert.equal(v.x, 0);
    assert.equal(v.y, 10);
  });
});