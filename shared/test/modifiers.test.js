import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Modifiers, empty, move, moveParent, resize, resizeParent, rotation, removeChildren, addChildren, reflow, scaleContent, changeProperty, addModifiers, moveModifiers, isEmpty, hasChildModifiers, hasGeometry, hasStructure, onlyMove, selectChild, selectParent, selectGeometry, selectStructure, modifiersToTransform, applyModifier, applyStructureModifiers, GeometricOperation, StructureOperation } from '../src/modifiers.js';
import { point } from '../src/geom/point.js';
import { matrix } from '../src/geom/matrix.js';

describe('modifiers', () => {
  it('empty creates modifiers with empty arrays', () => {
    const m = empty();
    assert.ok(m instanceof Modifiers);
    assert.equal(m.lastOrder, 0);
    assert.deepEqual(m.geometryParent, []);
    assert.deepEqual(m.geometryChild, []);
    assert.deepEqual(m.structureParent, []);
    assert.deepEqual(m.structureChild, []);
  });

  it('move adds to geometryChild', () => {
    const m = move(empty(), point(10, 20));
    assert.equal(m.geometryChild.length, 1);
    assert.equal(m.geometryChild[0].type, 'move');
    assert.equal(m.geometryChild[0].vector.x, 10);
    assert.equal(m.geometryChild[0].vector.y, 20);
  });

  it('move with near-zero vector is no-op', () => {
    const m = move(empty(), point(0, 0));
    assert.equal(m.geometryChild.length, 0);
  });

  it('moveParent adds to geometryParent', () => {
    const m = moveParent(empty(), point(5, 10));
    assert.equal(m.geometryParent.length, 1);
    assert.equal(m.geometryParent[0].type, 'move');
  });

  it('consecutive moves merge', () => {
    let m = empty();
    m = move(m, point(10, 0));
    m = move(m, point(5, 0));
    assert.equal(m.geometryChild.length, 1);
    assert.equal(m.geometryChild[0].vector.x, 15);
  });

  it('resize adds to geometryChild', () => {
    const m = resize(empty(), point(2, 2), point(0, 0));
    assert.equal(m.geometryChild.length, 1);
    assert.equal(m.geometryChild[0].type, 'resize');
  });

  it('rotation adds to both geometry and structure child', () => {
    const m = rotation(empty(), point(100, 100), 45);
    assert.equal(m.geometryChild.length, 1);
    assert.equal(m.structureChild.length, 1);
    assert.equal(m.geometryChild[0].type, 'rotation');
    assert.equal(m.structureChild[0].type, 'rotation');
  });

  it('rotation with zero angle is no-op', () => {
    const m = rotation(empty(), point(100, 100), 0);
    assert.equal(m.geometryChild.length, 0);
    assert.equal(m.structureChild.length, 0);
  });

  it('removeChildren adds structure-parent op', () => {
    const m = removeChildren(empty(), ['id1', 'id2']);
    assert.equal(m.structureParent.length, 1);
    assert.equal(m.structureParent[0].type, 'remove-children');
    assert.deepEqual(m.structureParent[0].value, ['id1', 'id2']);
  });

  it('removeChildren with empty array is no-op', () => {
    const m = removeChildren(empty(), []);
    assert.equal(m.structureParent.length, 0);
  });

  it('addChildren adds structure-parent op', () => {
    const m = addChildren(empty(), ['id1'], 0);
    assert.equal(m.structureParent.length, 1);
    assert.equal(m.structureParent[0].type, 'add-children');
  });

  it('reflow adds structure-parent op', () => {
    const m = reflow(empty());
    assert.equal(m.structureParent.length, 1);
    assert.equal(m.structureParent[0].type, 'reflow');
  });

  it('scaleContent adds structure-child op', () => {
    const m = scaleContent(empty(), 2);
    assert.equal(m.structureChild.length, 1);
    assert.equal(m.structureChild[0].type, 'scale-content');
    assert.equal(m.structureChild[0].value, 2);
  });

  it('changeProperty adds structure-parent op', () => {
    const m = changeProperty(empty(), 'opacity', 0.5);
    assert.equal(m.structureParent.length, 1);
    assert.equal(m.structureParent[0].type, 'change-property');
    assert.equal(m.structureParent[0].property, 'opacity');
    assert.equal(m.structureParent[0].value, 0.5);
  });

  it('addModifiers combines two modifiers', () => {
    let m1 = move(empty(), point(10, 20));
    let m2 = move(empty(), point(5, 5));
    const combined = addModifiers(m1, m2);
    assert.equal(combined.lastOrder, m1.lastOrder + m2.lastOrder);
  });

  it('moveModifiers shorthand', () => {
    const m = moveModifiers(point(10, 20));
    assert.equal(m.geometryChild.length, 1);
    assert.equal(m.geometryChild[0].vector.x, 10);
  });

  it('isEmpty on empty modifiers', () => {
    assert.equal(isEmpty(empty()), true);
  });

  it('isEmpty on non-empty modifiers', () => {
    const m = move(empty(), point(1, 1));
    assert.equal(isEmpty(m), false);
  });

  it('hasGeometry', () => {
    const m = move(empty(), point(1, 1));
    assert.equal(hasGeometry(m), true);
  });

  it('hasStructure on modifiers with structure ops', () => {
    const m = reflow(empty());
    assert.equal(hasStructure(m), true);
  });

  it('onlyMove on move-only modifiers', () => {
    const m = move(empty(), point(1, 1));
    assert.equal(onlyMove(m), true);
  });

  it('onlyMove false when has structure', () => {
    const m = reflow(empty());
    assert.equal(onlyMove(m), false);
  });

  it('selectChild zeroes parent ops', () => {
    let m = moveParent(empty(), point(1, 1));
    m = move(m, point(2, 2));
    const child = selectChild(m);
    assert.equal(child.geometryParent.length, 0);
    assert.equal(child.structureParent.length, 0);
    assert.equal(child.geometryChild.length, 1);
  });

  it('selectParent zeroes child ops', () => {
    let m = moveParent(empty(), point(1, 1));
    m = move(m, point(2, 2));
    const parent = selectParent(m);
    assert.equal(parent.geometryChild.length, 0);
    assert.equal(parent.structureChild.length, 0);
    assert.equal(parent.geometryParent.length, 1);
  });

  it('modifiersToTransform on move', () => {
    const m = move(empty(), point(10, 20));
    const t = modifiersToTransform(m);
    assert.equal(t.e, 10);
    assert.equal(t.f, 20);
  });

  it('applyModifier rotation', () => {
    const shape = { rotation: 90 };
    const result = applyModifier(shape, { type: 'rotation', value: 45 });
    assert.equal(result.rotation, 135);
  });

  it('applyModifier add-children', () => {
    const shape = { shapes: ['a', 'b'] };
    const result = applyModifier(shape, { type: 'add-children', value: ['c'], index: 1 });
    assert.deepEqual(result.shapes, ['a', 'c', 'b']);
  });

  it('applyModifier remove-children', () => {
    const shape = { shapes: ['a', 'b', 'c'] };
    const result = applyModifier(shape, { type: 'remove-children', value: ['b'] });
    assert.deepEqual(result.shapes, ['a', 'c']);
  });

  it('applyModifier change-property', () => {
    const shape = { opacity: 1 };
    const result = applyModifier(shape, { type: 'change-property', property: 'opacity', value: 0.5 });
    assert.equal(result.opacity, 0.5);
  });

  it('applyStructureModifiers', () => {
    const shape = { rotation: 0, shapes: ['a'] };
    const mods = addChildren(changeProperty(empty(), 'opacity', 0.5), ['b'], 1);
    const result = applyStructureModifiers(shape, mods);
    assert.equal(result.opacity, 0.5);
    assert.deepEqual(result.shapes, ['a', 'b']);
  });
});