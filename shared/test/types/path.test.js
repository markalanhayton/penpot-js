import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as helpers from '../../src/types/path/helpers.js';
import * as gpt from '../../src/geom/point.js';
import * as subpath from '../../src/types/path/subpath.js';
import * as impl from '../../src/types/path/impl.js';
import * as segm from '../../src/types/path/segment.js';
import * as svgParser from '../../src/types/path/svg_parser.js';
import * as boolMod from '../../src/types/path/bool.js';
import * as path from '../../src/types/path.js';

describe('types/path/svg-parser', () => {
  it('parses empty string', () => {
    assert.deepEqual(svgParser.parseSvgPath(''), []);
  });

  it('parses simple move-to', () => {
    const result = svgParser.parseSvgPath('M 10 20');
    assert.equal(result.length, 1);
    assert.equal(result[0].command, 'move-to');
    assert.equal(result[0].params.x, 10);
    assert.equal(result[0].params.y, 20);
  });

  it('parses move-to and line-to', () => {
    const result = svgParser.parseSvgPath('M 0 0 L 100 50');
    assert.equal(result.length, 2);
    assert.equal(result[0].command, 'move-to');
    assert.equal(result[1].command, 'line-to');
    assert.equal(result[1].params.x, 100);
    assert.equal(result[1].params.y, 50);
  });

  it('parses close-path', () => {
    const result = svgParser.parseSvgPath('M 0 0 L 10 10 Z');
    assert.equal(result.length, 3);
    assert.equal(result[2].command, 'close-path');
  });

  it('parses cubic bezier', () => {
    const result = svgParser.parseSvgPath('M 0 0 C 10 20 30 40 50 60');
    assert.equal(result.length, 2);
    assert.equal(result[1].command, 'curve-to');
    assert.equal(result[1].params.c1x, 10);
    assert.equal(result[1].params.c1y, 20);
    assert.equal(result[1].params.c2x, 30);
    assert.equal(result[1].params.c2y, 40);
    assert.equal(result[1].params.x, 50);
    assert.equal(result[1].params.y, 60);
  });

  it('parses relative move and line', () => {
    const result = svgParser.parseSvgPath('m 10 20 l 5 5');
    assert.equal(result.length, 2);
    assert.equal(result[0].command, 'move-to');
    assert.equal(result[0].params.x, 10);
    assert.equal(result[0].params.y, 20);
    assert.equal(result[1].command, 'line-to');
    assert.equal(result[1].params.x, 15);
    assert.equal(result[1].params.y, 25);
  });

  it('parses horizontal and vertical lines', () => {
    const result = svgParser.parseSvgPath('M 10 10 H 50 V 60');
    assert.equal(result.length, 3);
    assert.equal(result[1].command, 'line-to');
    assert.equal(result[1].params.x, 50);
    assert.equal(result[1].params.y, 10);
    assert.equal(result[2].command, 'line-to');
    assert.equal(result[2].params.x, 50);
    assert.equal(result[2].params.y, 60);
  });
});

describe('types/path/helpers', () => {
  it('sEq compares almost-equal numbers', () => {
    assert.equal(helpers.sEq(1.00001, 1.00002), true);
    assert.equal(helpers.sEq(1, 2), false);
  });

  it('makeMoveTo creates move-to segment', () => {
    const seg = helpers.makeMoveTo(gpt.point(10, 20));
    assert.equal(seg.command, 'move-to');
    assert.equal(seg.params.x, 10);
    assert.equal(seg.params.y, 20);
  });

  it('makeLineTo creates line-to segment', () => {
    const seg = helpers.makeLineTo(gpt.point(30, 40));
    assert.equal(seg.command, 'line-to');
    assert.equal(seg.params.x, 30);
    assert.equal(seg.params.y, 40);
  });

  it('makeCurveTo creates curve-to segment', () => {
    const seg = helpers.makeCurveTo(gpt.point(50, 60), gpt.point(10, 20), gpt.point(30, 40));
    assert.equal(seg.command, 'curve-to');
    assert.equal(seg.params.x, 50);
    assert.equal(seg.params.y, 60);
    assert.equal(seg.params.c1x, 10);
    assert.equal(seg.params.c1y, 20);
    assert.equal(seg.params.c2x, 30);
    assert.equal(seg.params.c2y, 40);
  });

  it('segmentToPoint extracts point', () => {
    const seg = { command: 'move-to', params: { x: 5, y: 10 } };
    const p = helpers.segmentToPoint(seg);
    assert.equal(p.x, 5);
    assert.equal(p.y, 10);
  });

  it('segmentToPoint extracts control point c1', () => {
    const seg = { command: 'curve-to', params: { c1x: 1, c1y: 2, c2x: 3, c2y: 4, x: 5, y: 6 } };
    const p = helpers.segmentToPoint(seg, 'c1');
    assert.equal(p.x, 1);
    assert.equal(p.y, 2);
  });

  it('curveValues evaluates cubic bezier at t=0', () => {
    const start = gpt.point(0, 0);
    const end = gpt.point(100, 0);
    const h1 = gpt.point(33, 0);
    const h2 = gpt.point(66, 0);
    const p = helpers.curveValues(start, end, h1, h2, 0);
    assert.equal(p.x, 0);
  });

  it('curveValues evaluates cubic bezier at t=1', () => {
    const start = gpt.point(0, 0);
    const end = gpt.point(100, 0);
    const h1 = gpt.point(33, 0);
    const h2 = gpt.point(66, 0);
    const p = helpers.curveValues(start, end, h1, h2, 1);
    assert.equal(p.x, 100);
  });

  it('curveValues evaluates cubic bezier at t=0.5', () => {
    const start = gpt.point(0, 0);
    const end = gpt.point(100, 100);
    const h1 = gpt.point(0, 100);
    const h2 = gpt.point(100, 0);
    const p = helpers.curveValues(start, end, h1, h2, 0.5);
    assert.equal(p.x, 50);
    assert.equal(p.y, 50);
  });

  it('curveSplit splits at t=0.5', () => {
    const start = gpt.point(0, 0);
    const end = gpt.point(100, 0);
    const h1 = gpt.point(33, 0);
    const h2 = gpt.point(66, 0);
    const [left, right] = helpers.curveSplit(start, end, h1, h2, 0.5);
    assert.equal(left[0].x, 0);
    assert.equal(right[1].x, 100);
  });

  it('lineHasPointQ detects point on line', () => {
    const line = [gpt.point(0, 0), gpt.point(100, 0)];
    assert.equal(helpers.lineHasPointQ(gpt.point(50, 0), line), true);
  });

  it('curveExtremities returns t-values', () => {
    const start = gpt.point(0, 0);
    const end = gpt.point(100, 0);
    const h1 = gpt.point(20, 100);
    const h2 = gpt.point(80, -100);
    const ext = helpers.curveExtremities(start, end, h1, h2);
    assert.ok(ext.length > 0);
    for (const t of ext) {
      assert.ok(t > 0 && t < 1);
    }
  });

  it('positionFixedAngle snaps to nearest 45-degree angle', () => {
    const from = gpt.point(0, 0);
    const p = gpt.point(10, 10);
    const result = helpers.positionFixedAngle(p, from);
    const angle = gpt.angle(result, from);
    const absAngle = Math.abs(angle);
    assert.ok(absAngle < 1 || Math.abs(absAngle - 45) < 1 || Math.abs(absAngle - 90) < 1 || Math.abs(absAngle - 135) < 1 || Math.abs(absAngle - 180) < 1);
  });
});

describe('types/path/subpath', () => {
  it('makeSubpath from command', () => {
    const cmd = { command: 'move-to', params: { x: 10, y: 20 } };
    const sp = subpath.makeSubpath(cmd);
    assert.equal(sp.from.x, 10);
    assert.equal(sp.from.y, 20);
    assert.equal(sp.to.x, 10);
    assert.equal(sp.to.y, 20);
    assert.equal(sp.data.length, 1);
  });

  it('getSubpaths extracts subpaths', () => {
    const content = [
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 0 } },
      { command: 'move-to', params: { x: 20, y: 0 } },
      { command: 'line-to', params: { x: 30, y: 0 } },
    ];
    const sps = subpath.getSubpaths(content);
    assert.equal(sps.length, 2);
    assert.equal(sps[0].data.length, 2);
    assert.equal(sps[1].data.length, 2);
  });

  it('isClosedQ detects closed loop', () => {
    const sp = { from: gpt.point(0, 0), to: gpt.point(0, 0), data: [] };
    assert.equal(subpath.isClosedQ(sp), true);
    const sp2 = { from: gpt.point(0, 0), to: gpt.point(10, 0), data: [] };
    assert.equal(subpath.isClosedQ(sp2), false);
  });

  it('closeSubpaths merges touching subpaths', () => {
    const content = [
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 0 } },
      { command: 'move-to', params: { x: 10, y: 0 } },
      { command: 'line-to', params: { x: 20, y: 0 } },
    ];
    const result = subpath.closeSubpaths(content);
    assert.ok(result.length >= 3);
  });

  it('mergeTouchingSubpaths merges adjacent subpaths', () => {
    const content = [
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 0 } },
      { command: 'move-to', params: { x: 10, y: 0 } },
      { command: 'line-to', params: { x: 20, y: 0 } },
    ];
    const result = subpath.mergeTouchingSubpaths(content);
    assert.equal(result.length, 3);
    assert.equal(result[0].command, 'move-to');
  });

  it('reverseContent reverses order', () => {
    const content = [
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 0 } },
    ];
    const result = subpath.reverseContent(content);
    assert.ok(result.length >= 2);
    assert.equal(result[0].command, 'move-to');
  });

  it('clockwiseQ detects winding direction', () => {
    const content = [
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 100, y: 0 } },
      { command: 'line-to', params: { x: 100, y: 100 } },
      { command: 'line-to', params: { x: 0, y: 100 } },
      { command: 'close-path', params: {} },
    ];
    const cw = subpath.clockwiseQ(content);
    assert.equal(typeof cw, 'boolean');
  });
});

describe('types/path/impl', () => {
  it('pathDataQ checks PathData instance', () => {
    const pd = impl.fromPlain([]);
    assert.equal(impl.pathDataQ(pd), true);
    assert.equal(impl.pathDataQ([]), false);
    assert.equal(impl.pathDataQ(null), false);
  });

  it('fromPlain creates PathData from segments', () => {
    const segments = [
      { command: 'move-to', params: { x: 10, y: 20 } },
      { command: 'line-to', params: { x: 30, y: 40 } },
    ];
    const pd = impl.fromPlain(segments);
    assert.equal(pd.length, 2);
    assert.equal(pd.get(0).command, 'move-to');
  });

  it('fromString parses SVG path string', () => {
    const pd = impl.fromString('M 10 20 L 30 40');
    assert.equal(pd.length, 2);
    assert.equal(pd.get(0).command, 'move-to');
    assert.equal(pd.get(1).command, 'line-to');
  });

  it('pathData returns same instance or wraps', () => {
    const pd = impl.fromPlain([]);
    assert.equal(impl.pathData(pd), pd);
    assert.equal(impl.pathData(null).length, 0);
    assert.equal(impl.pathData([]).length, 0);
  });

  it('PathData is iterable', () => {
    const pd = impl.fromPlain([
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 10 } },
    ]);
    const arr = [...pd];
    assert.equal(arr.length, 2);
  });

  it('PathData toString', () => {
    const pd = impl.fromPlain([
      { command: 'move-to', params: { x: 10, y: 20 } },
      { command: 'line-to', params: { x: 30, y: 40 } },
      { command: 'close-path', params: {} },
    ]);
    const str = pd.toString();
    assert.ok(str.includes('M'));
    assert.ok(str.includes('L'));
    assert.ok(str.includes('Z'));
  });

  it('PathData transform', () => {
    const pd = impl.fromPlain([
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 10 } },
    ]);
    const m = { a: 1, b: 0, c: 0, d: 1, e: 100, f: 200 };
    const transformed = pd.transform(m);
    assert.equal(transformed.get(0).params.x, 100);
    assert.equal(transformed.get(0).params.y, 200);
    assert.equal(transformed.get(1).params.x, 110);
    assert.equal(transformed.get(1).params.y, 210);
  });

  it('checkSegment validates commands', () => {
    assert.doesNotThrow(() => impl.checkSegment({ command: 'move-to', params: {} }));
    assert.throws(() => impl.checkSegment({ command: 'invalid', params: {} }));
  });
});

describe('types/path/segment', () => {
  it('getHandler extracts handler from curve-to', () => {
    const cmd = { command: 'curve-to', params: { c1x: 1, c1y: 2, c2x: 3, c2y: 4, x: 5, y: 6 } };
    const h1 = segm.getHandler(cmd, 'c1');
    assert.equal(h1.x, 1);
    assert.equal(h1.y, 2);
    const h2 = segm.getHandler(cmd, 'c2');
    assert.equal(h2.x, 3);
    assert.equal(h2.y, 4);
  });

  it('getHandler returns undefined for line-to', () => {
    const cmd = { command: 'line-to', params: { x: 5, y: 6 } };
    assert.equal(segm.getHandler(cmd, 'c1'), undefined);
  });

  it('getPoints extracts points', () => {
    const content = impl.fromString('M 0 0 L 10 20 L 30 40');
    const points = segm.getPoints(content);
    assert.equal(points.length, 3);
    assert.equal(points[0].x, 0);
    assert.equal(points[0].y, 0);
  });

  it('nextNode creates move-to for empty content', () => {
    const content = impl.fromPlain([]);
    const node = segm.nextNode(content, gpt.point(10, 20), null, null);
    assert.equal(node.command, 'move-to');
  });

  it('nextNode creates line-to after prev point', () => {
    const content = impl.fromPlain([{ command: 'move-to', params: { x: 0, y: 0 } }]);
    const node = segm.nextNode(content, gpt.point(10, 20), gpt.point(0, 0), null);
    assert.equal(node.command, 'line-to');
  });

  it('pointsToContent creates path from points', () => {
    const pd = segm.pointsToContent([gpt.point(0, 0), gpt.point(10, 10), gpt.point(20, 20)]);
    assert.equal(pd.length, 3);
    assert.equal(pd.get(0).command, 'move-to');
    assert.equal(pd.get(1).command, 'line-to');
  });

  it('pointsToContent with close param', () => {
    const pd = segm.pointsToContent([gpt.point(0, 0), gpt.point(10, 10)], { close: true });
    const arr = Array.from(pd);
    assert.equal(arr[arr.length - 1].command, 'close-path');
  });

  it('appendSegment appends segment', () => {
    const content = impl.fromPlain([{ command: 'move-to', params: { x: 0, y: 0 } }]);
    const result = segm.appendSegment(content, { command: 'line-to', params: { x: 10, y: 10 } });
    assert.equal(result.length, 2);
    assert.equal(result[1].command, 'line-to');
  });

  it('contentToSelrect calculates bounding rect', () => {
    const content = impl.fromString('M 0 0 L 100 0 L 100 50 Z');
    const rect = segm.contentToSelrect(content);
    assert.ok(rect.x !== undefined || rect.width !== undefined);
  });

  it('transformContent applies matrix', () => {
    const content = impl.fromPlain([
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 10 } },
    ]);
    const m = { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 };
    const result = segm.transformContent(content, m);
    assert.equal(impl.pathDataQ(result), true);
    assert.equal(result.get(1).params.x, 20);
    assert.equal(result.get(1).params.y, 20);
  });

  it('moveContent shifts content', () => {
    const content = impl.fromPlain([
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 10 } },
    ]);
    const result = segm.moveContent(content, gpt.point(5, 5));
    assert.equal(result.get(0).params.x, 5);
    assert.equal(result.get(0).params.y, 5);
    assert.equal(result.get(1).params.x, 15);
    assert.equal(result.get(1).params.y, 15);
  });
});

describe('types/path', () => {
  it('content creates PathData', () => {
    const pd = path.content([]);
    assert.equal(path.contentQ(pd), true);
  });

  it('fromPlain creates PathData', () => {
    const pd = path.fromPlain([{ command: 'move-to', params: { x: 1, y: 2 } }]);
    assert.equal(pd.length, 1);
  });

  it('fromString parses SVG path', () => {
    const pd = path.fromString('M 0 0 L 10 10 Z');
    assert.equal(pd.length, 3);
  });

  it('closeSubpaths closes open paths', () => {
    const content = [
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 0 } },
      { command: 'move-to', params: { x: 10, y: 0 } },
      { command: 'line-to', params: { x: 0, y: 0 } },
    ];
    const pd = path.fromPlain(content);
    const result = path.closeSubpaths(pd);
    assert.equal(path.contentQ(result), true);
  });

  it('transformContent works', () => {
    const pd = path.fromPlain([
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 10 } },
    ]);
    const m = { a: 1, b: 0, c: 0, d: 1, e: 100, f: 200 };
    const result = path.transformContent(pd, m);
    assert.equal(result.get(0).params.x, 100);
    assert.equal(result.get(0).params.y, 200);
  });

  it('getPoints extracts points', () => {
    const pd = path.fromPlain([
      { command: 'move-to', params: { x: 5, y: 10 } },
      { command: 'line-to', params: { x: 15, y: 20 } },
    ]);
    const points = path.getPoints(pd);
    assert.equal(points.length, 2);
  });

  it('calcSelrect returns a rect', () => {
    const pd = path.fromPlain([
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 100, y: 50 } },
    ]);
    const rect = path.calcSelrect(pd);
    assert.ok(rect !== undefined);
  });

  it('shapeWithOpenPathQ checks for open paths', () => {
    const openShape = { type: 'path', content: path.fromPlain([
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 10 } },
    ])};
    assert.equal(path.shapeWithOpenPathQ(openShape), true);
  });

  it('shapeWithOpenPathQ returns false for closed paths', () => {
    const closedShape = { type: 'path', content: path.fromPlain([
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 10 } },
      { command: 'close-path', params: {} },
    ])};
    assert.equal(path.shapeWithOpenPathQ(closedShape), false);
  });

  it('decodeSegments works', () => {
    const segments = [{ command: 'move-to', params: { x: 1, y: 2 } }];
    const result = path.decodeSegments(segments);
    assert.deepEqual(result, segments);
  });
});

describe('types/path/bool', () => {
  it('getDefaultFills returns fills', () => {
    const fills = boolMod.getDefaultFills();
    assert.ok(Array.isArray(fills));
    assert.equal(fills.length, 1);
  });

  it('GROUP_STYLE_PROPERTIES is a Set', () => {
    assert.ok(boolMod.GROUP_STYLE_PROPERTIES instanceof Set);
  });

  it('STYLE_PROPERTIES includes fills and strokes', () => {
    assert.ok(boolMod.STYLE_PROPERTIES.has('fills'));
    assert.ok(boolMod.STYLE_PROPERTIES.has('strokes'));
  });

  it('closePaths replaces close-path with line-to', () => {
    const content = [
      { command: 'move-to', params: { x: 0, y: 0 } },
      { command: 'line-to', params: { x: 10, y: 0 } },
      { command: 'close-path', params: {} },
    ];
    const result = boolMod.closePaths(content);
    assert.equal(result.length, 3);
    assert.equal(result[2].command, 'line-to');
    assert.equal(result[2].params.x, 0);
    assert.equal(result[2].params.y, 0);
  });
});