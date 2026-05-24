import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { components, componentsSeq, deletedComponentsSeq, addComponent, getComponent, getDeletedComponent, deleteComponent, markComponentDeleted, markComponentUndeleted, updateComponent, setComponentModified, getComponentAnnotation, usedComponentsChangedSince } from '../../src/types/components_list.js';

describe('components-list', () => {
  it('components empty by default', () => {
    const result = components({});
    assert.deepEqual(result, {});
  });

  it('addComponent and getComponent', () => {
    const fd = addComponent({ components: {} }, { id: 'c1', name: 'Button', path: '/', 'main-instance-id': 's1', 'main-instance-page': 'p1' });
    assert.ok(getComponent(fd, 'c1'));
    assert.equal(getComponent(fd, 'c1').name, 'Button');
  });

  it('addComponent with annotation and variant', () => {
    const fd = addComponent({ components: {} }, { id: 'c1', name: 'V', path: '/', 'main-instance-id': 's1', 'main-instance-page': 'p1', annotation: 'ann', 'variant-id': 'v1', 'variant-properties': [{ name: 'P1', value: 'A' }] });
    assert.equal(getComponent(fd, 'c1').annotation, 'ann');
    assert.equal(getComponent(fd, 'c1')['variant-id'], 'v1');
  });

  it('getComponent excludes deleted by default', () => {
    let fd = addComponent({ components: {} }, { id: 'c1', name: 'A', path: '/', 'main-instance-id': 's1', 'main-instance-page': 'p1' });
    fd = markComponentDeleted(fd, 'c1');
    assert.equal(getComponent(fd, 'c1'), undefined);
    assert.ok(getComponent(fd, 'c1', true));
  });

  it('componentsSeq excludes deleted', () => {
    let fd = addComponent({ components: {} }, { id: 'c1', name: 'A', path: '/', 'main-instance-id': 's1', 'main-instance-page': 'p1' });
    fd = addComponent(fd, { id: 'c2', name: 'B', path: '/', 'main-instance-id': 's2', 'main-instance-page': 'p1' });
    assert.equal(componentsSeq(fd).length, 2);
    fd = markComponentDeleted(fd, 'c1');
    assert.equal(componentsSeq(fd).length, 1);
  });

  it('deletedComponentsSeq', () => {
    let fd = addComponent({ components: {} }, { id: 'c1', name: 'A', path: '/', 'main-instance-id': 's1', 'main-instance-page': 'p1' });
    assert.equal(deletedComponentsSeq(fd).length, 0);
    fd = markComponentDeleted(fd, 'c1');
    assert.equal(deletedComponentsSeq(fd).length, 1);
  });

  it('markComponentDeleted/Undeleted', () => {
    let fd = addComponent({ components: {} }, { id: 'c1', name: 'A', path: '/', 'main-instance-id': 's1', 'main-instance-page': 'p1' });
    fd = markComponentDeleted(fd, 'c1');
    assert.ok(getDeletedComponent(fd, 'c1'));
    fd = markComponentUndeleted(fd, 'c1');
    assert.equal(getDeletedComponent(fd, 'c1'), undefined);
    assert.ok(getComponent(fd, 'c1'));
  });

  it('deleteComponent removes entirely', () => {
    let fd = addComponent({ components: {} }, { id: 'c1', name: 'A', path: '/', 'main-instance-id': 's1', 'main-instance-page': 'p1' });
    fd = deleteComponent(fd, 'c1');
    assert.equal(getComponent(fd, 'c1', true), undefined);
  });

  it('updateComponent', () => {
    let fd = addComponent({ components: {} }, { id: 'c1', name: 'A', path: '/', 'main-instance-id': 's1', 'main-instance-page': 'p1' });
    fd = updateComponent(fd, 'c1', (c) => ({ ...c, name: 'B' }));
    assert.equal(getComponent(fd, 'c1').name, 'B');
  });

  it('setComponentModified', () => {
    let fd = addComponent({ components: {} }, { id: 'c1', name: 'A', path: '/', 'main-instance-id': 's1', 'main-instance-page': 'p1' });
    const before = getComponent(fd, 'c1')['modified-at'];
    fd = setComponentModified(fd, 'c1');
    const after = getComponent(fd, 'c1')['modified-at'];
    assert.ok(after >= before);
  });

  it('components include-deleted option', () => {
    let fd = addComponent({ components: {} }, { id: 'c1', name: 'A', path: '/', 'main-instance-id': 's1', 'main-instance-page': 'p1' });
    fd = markComponentDeleted(fd, 'c1');
    assert.equal(Object.keys(components(fd)).length, 0);
    assert.equal(Object.keys(components(fd, { includeDeleted: true })).length, 1);
  });
});