import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VALID_CONTAINER_TYPES,
  makeContainer, unmakeContainer, pageQ, componentQ,
  getShape, shapesSeq, updateShape, getContainerRoot,
  getInstanceRoot, findComponentMain, insideComponentMainQ,
  containersSeq, objectContainersSeq,
  getNestingLevelDelta, convertShapeInComponent, removeSwapKeepAttrs,
  collectMainShapes, getComponentFromShape, hasAnyMainQ,
  invalidStructureForComponentQ, parentValidationCache,
  findValidParentAndFrameIds, validShapeForComponentQ,
} from '../../src/types/container.js';
import { zero, next } from '../../src/uuid.js';

function makeObjects(shapes) {
  const objects = {};
  for (const s of shapes) {
    objects[s.id] = { ...s };
  }
  return objects;
}

describe('container', () => {
  it('VALID_CONTAINER_TYPES', () => {
    assert.ok(VALID_CONTAINER_TYPES.has('page'));
    assert.ok(VALID_CONTAINER_TYPES.has('component'));
    assert.equal(VALID_CONTAINER_TYPES.size, 2);
  });

  it('makeContainer / unmakeContainer', () => {
    const c = makeContainer({ id: 'p1', name: 'A' }, 'page');
    assert.equal(c.type, 'page');
    assert.equal(pageQ(c), true);
    const u = unmakeContainer(c);
    assert.equal(u.type, undefined);
    assert.equal(u.name, 'A');
  });

  it('componentQ', () => {
    const c = makeContainer({ id: 'c1' }, 'component');
    assert.equal(componentQ(c), true);
    assert.equal(pageQ(c), false);
  });

  it('getShape', () => {
    const container = { objects: { s1: { id: 's1', type: 'rect' } } };
    assert.equal(getShape(container, 's1')?.type, 'rect');
    assert.equal(getShape(container, 'missing'), undefined);
  });

  it('shapesSeq', () => {
    const container = { objects: { a: { id: 'a' }, b: { id: 'b' } } };
    assert.equal(shapesSeq(container).length, 2);
  });

  it('updateShape', () => {
    const container = { objects: { s1: { id: 's1', name: 'A' } } };
    const updated = updateShape(container, 's1', (s) => ({ ...s, name: 'B' }));
    assert.equal(updated.objects.s1.name, 'B');
  });

  it('getContainerRoot', () => {
    const container = { objects: { s1: { id: 's1', 'parent-id': null, name: 'Root' } } };
    const root = getContainerRoot(container);
    assert.equal(root?.name, 'Root');
  });

  it('getInstanceRoot', () => {
    const objects = {
      s1: { id: 's1', 'parent-id': 's2', 'component-root': true, name: 'Root' },
      s2: { id: 's2', 'parent-id': zero, name: 'Frame' },
    };
    const result = getInstanceRoot(objects, objects.s1);
    assert.equal(result?.name, 'Root');
  });

  it('findComponentMain with main instance', () => {
    const objects = {
      s1: { id: 's1', 'parent-id': 's2', 'main-instance': true, name: 'Main' },
      s2: { id: 's2', 'parent-id': zero },
    };
    const result = findComponentMain(objects, objects.s1);
    assert.equal(result?.name, 'Main');
  });

  it('insideComponentMainQ', () => {
    const objects = {
      s1: { id: 's1', 'parent-id': 's2', 'main-instance': true },
      s2: { id: 's2', 'parent-id': zero },
    };
    assert.equal(insideComponentMainQ(objects, objects.s1), true);
  });

  it('containersSeq', () => {
    const fd = {
      pages: ['p1'],
      'pages-index': { p1: { id: 'p1', name: 'A' } },
      components: { c1: { id: 'c1', name: 'B' } },
    };
    const result = containersSeq(fd);
    assert.equal(result.length, 2);
  });

  it('objectContainersSeq excludes non-deleted components', () => {
    const fd = {
      pages: [],
      'pages-index': {},
      components: { c1: { id: 'c1', name: 'B', deleted: true } },
    };
    const result = objectContainersSeq(fd);
    assert.equal(result.length, 1);
    assert.equal(componentQ(result[0]), true);
  });

  it('getNestingLevelDelta - same nesting', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero },
      head1: { id: 'head1', 'parent-id': 'root', 'component-id': 'c1', 'shape-ref': 'main1' },
      child: { id: 'child', 'parent-id': 'head1' },
    };
    const delta = getNestingLevelDelta(objects, objects.child, objects.root);
    assert.equal(delta, 1);
  });

  it('getNestingLevelDelta - zero when moving within same component', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero },
      head1: { id: 'head1', 'parent-id': 'root', 'component-id': 'c1', 'shape-ref': 'main1' },
      child: { id: 'child', 'parent-id': 'head1' },
    };
    const delta = getNestingLevelDelta(objects, objects.child, objects.head1);
    assert.equal(delta, 0);
  });

  it('convertShapeInComponent - creates new component root', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero, type: 'frame' },
      shape: { id: 'shape', 'parent-id': 'root', type: 'rect', name: 'Rect' },
    };
    const [newRoot, allShapes] = convertShapeInComponent(objects.shape, objects, 'file-1');
    assert.equal(newRoot['component-id'] != null, true);
    assert.equal(newRoot['component-file'], 'file-1');
    assert.equal(newRoot['main-instance'], true);
    assert.equal(newRoot['component-root'], true);
    assert.equal(newRoot.type, 'rect');
    assert.ok(allShapes.length >= 1);
  });

  it('removeSwapKeepAttrs - removes swap-keep attrs and preserves auto sizing', () => {
    const shape = {
      id: 's1',
      type: 'frame',
      layout: 'flex',
      'layout-item-h-sizing': 'auto',
      'layout-item-v-sizing': 'fill',
      'layout-item-margin': { top: 10 },
      interactions: [],
      name: 'Test',
    };
    const result = removeSwapKeepAttrs(shape);
    assert.equal(result['layout-item-margin'], undefined);
    assert.equal(result.interactions, undefined);
    assert.equal(result['layout-item-h-sizing'], 'auto');
    assert.equal(result['layout-item-v-sizing'], undefined);
    assert.equal(result.name, 'Test');
  });

  it('removeSwapKeepAttrs - preserves auto sizing when layout matches', () => {
    const shape = {
      id: 's1',
      type: 'frame',
      layout: 'flex',
      'layout-item-h-sizing': 'auto',
      'layout-item-v-sizing': 'auto',
    };
    const result = removeSwapKeepAttrs(shape);
    assert.equal(result['layout-item-h-sizing'], 'auto');
    assert.equal(result['layout-item-v-sizing'], 'auto');
  });

  it('removeSwapKeepAttrs - no layout keeps nothing from swap keep', () => {
    const shape = {
      id: 's1',
      type: 'rect',
      'layout-item-margin': { top: 10 },
      interactions: [],
    };
    const result = removeSwapKeepAttrs(shape);
    assert.equal(result['layout-item-margin'], undefined);
    assert.equal(result.interactions, undefined);
    assert.equal(result['layout-item-h-sizing'], undefined);
    assert.equal(result['layout-item-v-sizing'], undefined);
  });

  it('collectMainShapes - collects main instances', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero, shapes: ['main1'] },
      main1: { id: 'main1', 'parent-id': 'root', 'main-instance': true, shapes: ['child1'] },
      child1: { id: 'child1', 'parent-id': 'main1' },
    };
    const result = collectMainShapes(objects.root, objects);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'main1');
  });

  it('collectMainShapes - returns empty for shape without main instances', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero, shapes: ['child1'] },
      child1: { id: 'child1', 'parent-id': 'root' },
    };
    const result = collectMainShapes(objects.root, objects);
    assert.equal(result.length, 0);
  });

  it('collectMainShapes - recurses through children', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero, shapes: ['mid'] },
      mid: { id: 'mid', 'parent-id': 'root', shapes: ['main1'] },
      main1: { id: 'main1', 'parent-id': 'mid', 'main-instance': true },
    };
    const result = collectMainShapes(objects.root, objects);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'main1');
  });

  it('getComponentFromShape - finds component in libraries', () => {
    const shape = { id: 's1', 'component-id': 'comp1', 'component-file': 'lib1' };
    const libraries = {
      lib1: { data: { components: { comp1: { id: 'comp1', name: 'MyComp' } } } },
    };
    const result = getComponentFromShape(shape, libraries);
    assert.equal(result.name, 'MyComp');
  });

  it('getComponentFromShape - returns undefined for missing library', () => {
    const shape = { id: 's1', 'component-id': 'comp1', 'component-file': 'lib-missing' };
    const result = getComponentFromShape(shape, {});
    assert.equal(result, undefined);
  });

  it('hasAnyMainQ - detects main instance in children', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero, shapes: ['main1'] },
      main1: { id: 'main1', 'parent-id': 'root', 'main-instance': true },
    };
    assert.equal(hasAnyMainQ(objects, objects.root), true);
  });

  it('hasAnyMainQ - detects main instance in parents', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero, 'main-instance': true },
      child: { id: 'child', 'parent-id': 'root' },
    };
    assert.equal(hasAnyMainQ(objects, objects.child), true);
  });

  it('hasAnyMainQ - returns false when no main instances', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero },
      child: { id: 'child', 'parent-id': 'root' },
    };
    assert.equal(hasAnyMainQ(objects, objects.child), false);
  });

  it('validShapeForComponentQ - returns true for normal shape', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero },
      shape: { id: 'shape', 'parent-id': 'root' },
    };
    assert.equal(validShapeForComponentQ(objects, objects.shape), true);
  });

  it('validShapeForComponentQ - returns false when has main parent', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero, 'main-instance': true },
      shape: { id: 'shape', 'parent-id': 'root' },
    };
    assert.equal(validShapeForComponentQ(objects, objects.shape), false);
  });

  it('parentValidationCache - computes topChildren', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero },
      c1: { id: 'c1', 'parent-id': 'root' },
    };
    const children = [objects.c1];
    const cache = parentValidationCache(objects, children, {});
    assert.equal(cache.topChildren.length, 1);
    assert.equal(cache.allMainQ, false);
  });

  it('parentValidationCache - detects all-main children', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero },
      c1: { id: 'c1', 'parent-id': 'root', 'main-instance': true },
    };
    const children = [objects.c1];
    const cache = parentValidationCache(objects, children, {});
    assert.equal(cache.allMainQ, true);
  });

  it('findValidParentAndFrameIds - returns parent when structure is valid', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero, type: 'frame' },
      parent: { id: 'parent', 'parent-id': 'root', 'frame-id': 'root' },
      child: { id: 'child', 'parent-id': 'parent' },
    };
    const children = [objects.child];
    const cache = parentValidationCache(objects, children, {});
    const [parentId, frameId] = findValidParentAndFrameIds('parent', objects, children, false, {}, cache);
    assert.equal(parentId, 'parent');
  });

  it('findValidParentAndFrameIds - skips copy parent when pasting', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero, type: 'frame' },
      copy: { id: 'copy', 'parent-id': 'root', type: 'frame', 'shape-ref': 'ref1', 'component-id': 'c1' },
      child: { id: 'child', 'parent-id': 'copy' },
    };
    const children = [objects.child];
    const [parentId] = findValidParentAndFrameIds('copy', objects, children, true, {});
    assert.equal(parentId, 'root');
  });

  it('findValidParentAndFrameIds - walks up past copy parent', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero, type: 'frame' },
      copy: { id: 'copy', 'parent-id': 'root', type: 'frame', 'shape-ref': 'ref1', 'component-id': 'c1' },
      good: { id: 'good', 'parent-id': 'copy', type: 'frame', 'frame-id': 'root' },
      child: { id: 'child', 'parent-id': 'good' },
    };
    const children = [objects.child];
    const [parentId] = findValidParentAndFrameIds('good', objects, children, true, {});
    assert.equal(parentId, 'root');
  });

  it('invalidStructureForComponentQ - returns true when parent is a copy', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero, shapes: ['parent'] },
      parent: { id: 'parent', 'parent-id': 'root', 'shape-ref': 'ref1', 'component-id': 'c1', shapes: ['child'] },
      child: { id: 'child', 'parent-id': 'parent' },
    };
    const result = invalidStructureForComponentQ(objects, objects.parent, [objects.child], false, {});
    assert.equal(result, true);
  });

  it('invalidStructureForComponentQ - returns false for normal structure', () => {
    const objects = {
      root: { id: 'root', 'parent-id': zero, shapes: ['parent'] },
      parent: { id: 'parent', 'parent-id': 'root', shapes: ['child'] },
      child: { id: 'child', 'parent-id': 'parent' },
    };
    const result = invalidStructureForComponentQ(objects, objects.parent, [objects.child], false, {});
    assert.equal(result, false);
  });
});