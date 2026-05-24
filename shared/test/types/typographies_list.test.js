import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as tl from '../../src/types/typographies_list.js';
import * as dt from '../../src/time.js';

describe('typographies-list', () => {
  it('typographiesSeq returns empty for no typographies', () => {
    assert.deepEqual(tl.typographiesSeq({}), []);
  });

  it('addTypography adds to file data', () => {
    const fd = { typographies: {} };
    const typo = { id: 't1', name: 'Heading' };
    const result = tl.addTypography(fd, typo);
    assert.ok(result.typographies.t1);
    assert.equal(result.typographies.t1.name, 'Heading');
    assert.ok(result.typographies.t1.modifiedAt);
  });

  it('getTypography retrieves typography', () => {
    const fd = { typographies: { t1: { id: 't1', name: 'Heading' } } };
    assert.equal(tl.getTypography(fd, 't1').name, 'Heading');
  });

  it('getTypography returns undefined for missing', () => {
    assert.equal(tl.getTypography({}, 't1'), undefined);
  });

  it('setTypography updates existing', () => {
    const fd = { typographies: { t1: { id: 't1', name: 'Old' } } };
    const result = tl.setTypography(fd, { id: 't1', name: 'New' });
    assert.equal(result.typographies.t1.name, 'New');
  });

  it('updateTypography updates with function', () => {
    const fd = { typographies: { t1: { id: 't1', name: 'Heading', fontSize: '14' } } };
    const result = tl.updateTypography(fd, 't1', (t) => ({ ...t, fontSize: '16' }));
    assert.equal(result.typographies.t1.fontSize, '16');
  });

  it('deleteTypography removes typography', () => {
    const fd = { typographies: { t1: { id: 't1' }, t2: { id: 't2' } } };
    const result = tl.deleteTypography(fd, 't1');
    assert.ok(!result.typographies.t1);
    assert.ok(result.typographies.t2);
  });

  it('getRefTypography returns matching library typography', () => {
    const libData = { id: 'lib1', typographies: { t1: { id: 't1', name: 'Ref' } } };
    const typo = { 'typography-ref-file': 'lib1', 'typography-ref-id': 't1' };
    const result = tl.getRefTypography(libData, typo);
    assert.equal(result.name, 'Ref');
  });

  it('getRefTypography returns undefined for non-matching library', () => {
    const libData = { id: 'lib2', typographies: {} };
    const typo = { 'typography-ref-file': 'lib1', 'typography-ref-id': 't1' };
    assert.equal(tl.getRefTypography(libData, typo), undefined);
  });
});