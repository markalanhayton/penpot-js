import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VALID_CONTAINER_TYPES, makeContainer, unmakeContainer, pageQ, componentQ, getShape, shapesSeq, updateShape, getContainerRoot, getInstanceRoot, findComponentMain, insideComponentMainQ, containersSeq, objectContainersSeq } from '../../src/types/container.js';
import { zero } from '../../src/uuid.js';

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
});