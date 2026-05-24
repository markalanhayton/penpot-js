import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { propertiesToName, nextPropertyNumber, addNewProp, addNewProps, propertiesMapToFormula, propertiesFormulaToMap, validPropertiesFormulaQ, findPropertiesToRemove, findPropertiesToUpdate, findPropertiesToAdd, mergeProperties, compareProperties, sameVariantQ, distance, variantNameToName, findBooleanPair, updateNumberInRepeatedItem } from '../../src/types/variant.js';

describe('variant', () => {
  it('propertiesToName', () => {
    assert.equal(propertiesToName([{ name: 'P1', value: 'A' }, { name: 'P2', value: 'B' }]), 'A, B');
    assert.equal(propertiesToName([{ name: 'P1', value: 'A' }, { name: 'P2', value: '' }]), 'A');
  });

  it('nextPropertyNumber', () => {
    assert.equal(nextPropertyNumber([]), 1);
    assert.equal(nextPropertyNumber([{ name: 'Property 1', value: 'x' }]), 2);
    assert.equal(nextPropertyNumber([{ name: 'Property 5', value: 'x' }]), 6);
  });

  it('addNewProp', () => {
    const result = addNewProp([], 'A');
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Property 1');
    assert.equal(result[0].value, 'A');
  });

  it('addNewProps', () => {
    const result = addNewProps([], ['A', 'B']);
    assert.equal(result.length, 2);
    assert.equal(result[1].name, 'Property 2');
  });

  it('propertiesMapToFormula', () => {
    const result = propertiesMapToFormula([{ name: 'P1', value: 'A' }, { name: 'P2', value: '' }]);
    assert.equal(result, 'P1=A');
  });

  it('propertiesFormulaToMap', () => {
    const result = propertiesFormulaToMap('P1=A, P2=B');
    assert.equal(result.length, 2);
    assert.equal(result[0].name, 'P1');
    assert.equal(result[0].value, 'A');
  });

  it('validPropertiesFormulaQ', () => {
    assert.equal(validPropertiesFormulaQ('P1=A, P2=B'), true);
    assert.equal(validPropertiesFormulaQ('P1='), false);
    assert.equal(validPropertiesFormulaQ(''), false);
  });

  it('findPropertiesToRemove', () => {
    const prev = [{ name: 'P1', value: 'A' }, { name: 'P2', value: 'B' }];
    const upd = [{ name: 'P1', value: 'A' }];
    const result = findPropertiesToRemove(prev, upd);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'P2');
  });

  it('findPropertiesToUpdate', () => {
    const prev = [{ name: 'P1', value: 'A' }];
    const upd = [{ name: 'P1', value: 'C' }, { name: 'P2', value: 'B' }];
    const result = findPropertiesToUpdate(prev, upd);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'P1');
  });

  it('findPropertiesToAdd', () => {
    const prev = [{ name: 'P1', value: 'A' }];
    const upd = [{ name: 'P1', value: 'A' }, { name: 'P2', value: 'B' }];
    const result = findPropertiesToAdd(prev, upd);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'P2');
  });

  it('mergeProperties', () => {
    const p1 = [{ name: 'P1', value: 'A' }, { name: 'P2', value: 'B' }];
    const p2 = [{ name: 'P1', value: 'C' }, { name: 'P3', value: 'D' }];
    const result = mergeProperties(p1, p2);
    assert.equal(result[0].value, 'C');
  });

  it('compareProperties with same values', () => {
    const list = [[{ name: 'P1', value: 'A' }], [{ name: 'P1', value: 'A' }]];
    const result = compareProperties(list);
    assert.equal(result[0].value, 'A');
  });

  it('compareProperties with different values', () => {
    const list = [[{ name: 'P1', value: 'A' }], [{ name: 'P1', value: 'B' }]];
    const result = compareProperties(list, '*');
    assert.equal(result[0].value, '*');
  });

  it('sameVariantQ', () => {
    assert.equal(sameVariantQ([{ 'variant-id': 'v1' }, { 'variant-id': 'v1' }]), true);
    assert.equal(sameVariantQ([{ 'variant-id': 'v1' }, { 'variant-id': 'v2' }]), false);
  });

  it('distance', () => {
    const p1 = [{ value: 'A' }, { value: 'B' }];
    const p2 = [{ value: 'A' }, { value: 'C' }];
    const d = distance(p1, p2);
    assert.ok(d > 0);
  });

  it('distance zero for same props', () => {
    const p1 = [{ value: 'A' }, { value: 'B' }];
    const p2 = [{ value: 'A' }, { value: 'B' }];
    assert.equal(distance(p1, p2), 0);
  });

  it('variantNameToName', () => {
    const variant = { name: 'Button', 'variant-name': 'Large, Red' };
    assert.equal(variantNameToName(variant), 'Button / Large / Red');
  });

  it('findBooleanPair', () => {
    const result = findBooleanPair(['on', 'off']);
    assert.deepEqual(result, { on: true, off: false });
  });

  it('findBooleanPair no match', () => {
    const result = findBooleanPair(['red', 'blue']);
    assert.equal(result, null);
  });

  it('findBooleanPair needs exactly 2 items', () => {
    assert.equal(findBooleanPair(['on']), null);
  });

  it('updateNumberInRepeatedItem', () => {
    assert.equal(updateNumberInRepeatedItem([], 'Button'), 'Button');
    assert.equal(updateNumberInRepeatedItem(['Button'], 'Button'), 'Button (1)');
  });
});