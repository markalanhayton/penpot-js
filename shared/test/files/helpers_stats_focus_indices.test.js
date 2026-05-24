import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as defaults from '../../src/files/defaults.js';
import * as stats from '../../src/files/stats.js';
import * as helpers from '../../src/files/helpers.js';
import * as focus from '../../src/files/focus.js';
import * as indices from '../../src/files/indices.js';
import * as uuid from '../../src/uuid.js';

describe('files/defaults', () => {
  it('version is 67', () => {
    assert.equal(defaults.version, 67);
  });
});

describe('files/stats', () => {
  it('emptyShapeCounts has zero totals', () => {
    assert.equal(stats.emptyShapeCounts.total, 0);
    assert.deepEqual(stats.emptyShapeCounts.byType, {});
  });

  it('countShapesByType counts shapes, skipping root', () => {
    const objects = {
      [uuid.zero]: { type: 'frame' },
      a: { type: 'rect' },
      b: { type: 'rect' },
      c: { type: 'frame' },
    };
    const result = stats.countShapesByType(objects);
    assert.equal(result.total, 3);
    assert.equal(result.byType.rect, 2);
    assert.equal(result.byType.frame, 1);
  });

  it('countShapesByType returns empty for empty input', () => {
    assert.deepEqual(stats.countShapesByType({}), stats.emptyShapeCounts);
    assert.deepEqual(stats.countShapesByType(null), stats.emptyShapeCounts);
  });

  it('calcFileStats aggregates correctly', () => {
    const fdata = {
      pagesIndex: {
        p1: { objects: { a: { type: 'rect' }, b: { type: 'text' } } },
      },
      components: { c1: { id: 'c1' } },
      deletedComponents: { dc1: { id: 'dc1' } },
      colors: { col1: { id: 'col1' } },
      typographies: { t1: { id: 't1' } },
    };
    const result = stats.calcFileStats(fdata);
    assert.equal(result.pageCount, 1);
    assert.equal(result.shapeCounts.total, 2);
    assert.equal(result.componentCount, 1);
    assert.equal(result.deletedComponentCount, 1);
    assert.equal(result.colorCount, 1);
    assert.equal(result.typographyCount, 1);
  });
});

describe('files/helpers', () => {
  const rootId = uuid.zero;
  const frameId = '11111111-1111-1111-1111-111111111111';
  const groupId = '22222222-2222-2222-2222-222222222222';
  const rectId = '33333333-3333-3333-4444-444444444444';
  const textId = '44444444-4444-4444-4444-444444444444';
  const boolId = '55555555-5555-5555-5555-555555555555';
  const imgId = '66666666-6666-6666-6666-666666666666';
  const svgId = '77777777-7777-7777-7777-777777777777';
  const pathId = '88888888-8888-8888-8888-888888888888';
  const circleId = '99999999-9999-9999-9999-999999999999';

  const objects = {
    [rootId]: { id: rootId, type: 'frame', frameId: rootId, shapes: [frameId] },
    [frameId]: { id: frameId, type: 'frame', frameId: rootId, parentId: rootId, shapes: [groupId, rectId] },
    [groupId]: { id: groupId, type: 'group', frameId: frameId, parentId: frameId, shapes: [textId] },
    [textId]: { id: textId, type: 'text', frameId: frameId, parentId: groupId, shapes: [] },
    [rectId]: { id: rectId, type: 'rect', frameId: frameId, parentId: frameId, shapes: [] },
    [boolId]: { id: boolId, type: 'bool', frameId: frameId, parentId: frameId, shapes: [] },
    [imgId]: { id: imgId, type: 'image', frameId: frameId, parentId: frameId, shapes: [] },
    [svgId]: { id: svgId, type: 'svg-raw', frameId: frameId, parentId: frameId, shapes: [] },
    [pathId]: { id: pathId, type: 'path', frameId: frameId, parentId: frameId, shapes: [] },
    [circleId]: { id: circleId, type: 'circle', frameId: frameId, parentId: frameId, shapes: [] },
  };

  it('rootQ checks root frame', () => {
    assert.equal(helpers.rootQ(objects[rootId]), true);
    assert.equal(helpers.rootQ(objects[frameId]), false);
  });

  it('frameShapeQ identifies frames', () => {
    assert.equal(helpers.frameShapeQ(objects, frameId), true);
    assert.equal(helpers.frameShapeQ(objects, rectId), false);
  });

  it('groupShapeQ identifies groups', () => {
    assert.equal(helpers.groupShapeQ(objects, groupId), true);
    assert.equal(helpers.groupShapeQ(objects, rectId), false);
  });

  it('boolShapeQ identifies bool shapes', () => {
    assert.equal(helpers.boolShapeQ(objects[boolId]), true);
    assert.equal(helpers.boolShapeQ(objects[rectId]), false);
  });

  it('textShapeQ identifies text shapes', () => {
    assert.equal(helpers.textShapeQ(objects, textId), true);
    assert.equal(helpers.textShapeQ(objects, rectId), false);
  });

  it('imageShapeQ identifies image shapes', () => {
    assert.equal(helpers.imageShapeQ(objects[imgId]), true);
    assert.equal(helpers.imageShapeQ(objects[rectId]), false);
  });

  it('svgRawShapeQ identifies svg-raw shapes', () => {
    assert.equal(helpers.svgRawShapeQ(objects, svgId), true);
    assert.equal(helpers.svgRawShapeQ(objects, rectId), false);
  });

  it('pathShapeQ identifies path shapes', () => {
    assert.equal(helpers.pathShapeQ(objects, pathId), true);
    assert.equal(helpers.pathShapeQ(objects, rectId), false);
  });

  it('circleShapeQ identifies circle shapes', () => {
    assert.equal(helpers.circleShapeQ(objects[circleId]), true);
    assert.equal(helpers.circleShapeQ(objects[rectId]), false);
  });

  it('getChildrenIds returns all descendants', () => {
    const ids = helpers.getChildrenIds(objects, frameId);
    assert.ok(ids.includes(groupId));
    assert.ok(ids.includes(textId));
    assert.ok(ids.includes(rectId));
    assert.equal(ids.includes(frameId), false);
  });

  it('getChildrenIdsWithSelf includes self', () => {
    const ids = helpers.getChildrenIdsWithSelf(objects, frameId);
    assert.ok(ids.includes(frameId));
    assert.ok(ids.includes(groupId));
  });

  it('getParent returns parent shape', () => {
    assert.equal(helpers.getParent(objects, textId)?.id, groupId);
    assert.equal(helpers.getParent(objects, groupId)?.id, frameId);
  });

  it('getParentId returns parent id', () => {
    assert.equal(helpers.getParentId(objects, textId), groupId);
  });

  it('getParentIds returns chain of parent ids', () => {
    const ids = helpers.getParentIds(objects, textId);
    assert.deepEqual(ids, [groupId, frameId, rootId]);
  });

  it('isParentQ checks ancestry', () => {
    assert.equal(helpers.isParentQ(objects, textId, frameId), true);
    assert.equal(helpers.isParentQ(objects, textId, rootId), true);
    assert.equal(helpers.isParentQ(objects, textId, rectId), false);
  });

  it('isDirectChildOfRootQ checks direct root child', () => {
    assert.equal(helpers.isDirectChildOfRootQ(objects, frameId), true);
    assert.equal(helpers.isDirectChildOfRootQ(objects, groupId), false);
  });

  it('rootFrameQ identifies root frames', () => {
    assert.equal(helpers.rootFrameQ(objects, frameId), true);
    assert.equal(helpers.rootFrameQ(objects, rootId), false);
  });

  it('maskShapeQ identifies masks', () => {
    assert.equal(helpers.maskShapeQ({ type: 'group', maskedGroup: true }), true);
    assert.equal(helpers.maskShapeQ(objects[groupId]), false);
  });

  it('hasChildrenQ checks children', () => {
    assert.equal(helpers.hasChildrenQ(objects, frameId), true);
    assert.equal(helpers.hasChildrenQ(objects, textId), false);
  });

  it('groupLikeShapeQ checks group-like', () => {
    assert.equal(helpers.groupLikeShapeQ(objects, groupId), true);
    assert.equal(helpers.groupLikeShapeQ(objects, boolId), true);
    assert.equal(helpers.groupLikeShapeQ(objects, rectId), false);
  });

  it('getSiblingsIds returns siblings', () => {
    const siblings = helpers.getSiblingsIds(objects, rectId);
    assert.ok(siblings.includes(groupId));
    assert.ok(!siblings.includes(rectId));
  });

  it('getPositionOnParent returns index', () => {
    const pos = helpers.getPositionOnParent(objects, groupId);
    assert.equal(pos, 0);
  });

  it('generateUniqueName generates unique names', () => {
    const existing = new Set(['Rect', 'Rect 1']);
    assert.equal(helpers.generateUniqueName('Rect', existing), 'Rect 2');
  });

  it('generateUniqueName with suffix option', () => {
    const existing = new Set(['Button']);
    const result = helpers.generateUniqueName('Button', existing, { suffix: 'copy' });
    assert.equal(result, 'Button-copy');
  });

  it('generateUniqueName immediateSuffix starts suffixing', () => {
    const existing = new Set(['Shape']);
    assert.equal(helpers.generateUniqueName('Shape', existing, { immediateSuffix: true }), 'Shape 1');
  });

  it('appendAtTheEnd deduplicates', () => {
    assert.deepEqual(helpers.appendAtTheEnd([1, 2, 3], [3, 4]), [1, 2, 3, 4]);
  });

  it('cleanLoops removes children of selected', () => {
    const cleaned = helpers.cleanLoops(objects, [frameId, groupId]);
    assert.ok(!cleaned.includes(groupId));
    assert.ok(cleaned.includes(frameId));
  });

  it('getFrameObjects returns subtree', () => {
    const frameObjects = helpers.getFrameObjects(objects, frameId);
    assert.ok(frameObjects[frameId]);
    assert.ok(frameObjects[groupId]);
    assert.ok(!frameObjects[rootId]);
  });

  it('isChildQ checks parent-child', () => {
    assert.equal(helpers.isChildQ(objects, frameId, textId), true);
    assert.equal(helpers.isChildQ(objects, rectId, textId), false);
  });

  it('makeContainer sets type', () => {
    const c = helpers.makeContainer({ id: 'a' }, 'page');
    assert.equal(c.type, 'page');
  });

  it('pageQ checks page type', () => {
    assert.equal(helpers.pageQ({ type: 'page' }), true);
    assert.equal(helpers.pageQ({ type: 'component' }), false);
  });

  it('componentQ checks component type', () => {
    assert.equal(helpers.componentQ({ type: 'component' }), true);
  });

  it('getUsedNames extracts names', () => {
    const names = helpers.getUsedNames([{ name: 'A' }, { name: 'B' }, { name: 'A' }]);
    assert.ok(names.has('A'));
    assert.ok(names.has('B'));
    assert.equal(names.size, 2);
  });

  it('selectedWithChildren includes descendants', () => {
    const sel = helpers.selectedWithChildren(objects, new Set([frameId]));
    assert.ok(sel.has(frameId));
    assert.ok(sel.has(groupId));
    assert.ok(sel.has(textId));
  });

  it('objectsByFrame groups objects', () => {
    const byFrame = helpers.objectsByFrame(objects);
    assert.ok(byFrame[frameId]);
    assert.ok(byFrame[frameId][groupId]);
  });

  it('commonParentFrame finds common frame', () => {
    const frame = helpers.commonParentFrame(objects, [textId, rectId]);
    assert.equal(frame, frameId);
  });
});

describe('files/focus', () => {
  const rootId = uuid.zero;
  const frameId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const rectId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const textId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  const objects = {
    [rootId]: { id: rootId, type: 'frame', frameId: rootId, shapes: [frameId] },
    [frameId]: { id: frameId, type: 'frame', frameId: rootId, parentId: rootId, shapes: [rectId, textId] },
    [rectId]: { id: rectId, type: 'rect', frameId: frameId, parentId: frameId, shapes: [] },
    [textId]: { id: textId, type: 'text', frameId: frameId, parentId: frameId, shapes: [] },
  };

  it('focusObjects returns subset', () => {
    const focused = focus.focusObjects(objects, new Set([rectId]));
    assert.ok(focused[rectId]);
    assert.ok(focused[rootId]);
  });

  it('filterNotFocus filters ids', () => {
    const ids = [rectId, textId];
    const filtered = focus.filterNotFocus(objects, new Set([rectId]), ids);
    assert.deepEqual(filtered, [rectId]);
  });

  it('isInFocusQ checks focus membership', () => {
    assert.equal(focus.isInFocusQ(objects, new Set([frameId]), rectId), true);
    assert.equal(focus.isInFocusQ(objects, new Set([frameId]), rootId), false);
  });
});

describe('files/indices', () => {
  const rootId = uuid.zero;
  const frameId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const rectId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const objects = {
    [rootId]: { id: rootId, type: 'frame', frameId: rootId, shapes: [frameId] },
    [frameId]: { id: frameId, type: 'frame', frameId: rootId, parentId: rootId, shapes: [rectId] },
    [rectId]: { id: rectId, type: 'rect', frameId: frameId, parentId: frameId, shapes: [] },
  };

  it('generateChildAllParentsIndex builds index', () => {
    const index = indices.generateChildAllParentsIndex(objects);
    assert.ok(index[frameId]);
    assert.ok(index[rectId]);
    assert.deepEqual(index[frameId], [rootId]);
    assert.deepEqual(index[rectId], [frameId, rootId]);
  });

  it('createClipIndex handles bool shapes', () => {
    const boolId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const maskId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    const childId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const testObjects = {
      [rootId]: { id: rootId, type: 'frame', frameId: rootId, shapes: [maskId] },
      [maskId]: { id: maskId, type: 'group', frameId: rootId, parentId: rootId, 'masked-group': true, shapes: [boolId] },
      [boolId]: { id: boolId, type: 'bool', frameId: maskId, parentId: maskId, shapes: [childId] },
      [childId]: { id: childId, type: 'rect', frameId: maskId, parentId: boolId, shapes: [] },
    };
    const parentsIndex = indices.generateChildAllParentsIndex(testObjects);
    const clipIndex = indices.createClipIndex(testObjects, parentsIndex);
    assert.ok(clipIndex[childId]?.length > 0);
    assert.ok(clipIndex[childId].some(s => s.id === boolId));
  });
});