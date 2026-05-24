import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pcb from '../src/files/changes_builder.js';

const uuidZero = '00000000-0000-0000-0000-000000000000';

describe('changes_builder', () => {
  it('emptyChanges creates empty changes object', () => {
    const c = pcb.emptyChanges();
    assert.deepEqual(c['redo-changes'], []);
    assert.deepEqual(c['undo-changes'], []);
  });

  it('emptyChanges with origin', () => {
    const c = pcb.emptyChanges('workspace');
    assert.equal(c.origin, 'workspace');
  });

  it('setSaveUndoQ sets save-undo?', () => {
    const c = pcb.setSaveUndoQ(pcb.emptyChanges(), true);
    assert.equal(c['save-undo?'], true);
  });

  it('setStackUndoQ sets stack-undo?', () => {
    const c = pcb.setStackUndoQ(pcb.emptyChanges(), true);
    assert.equal(c['stack-undo?'], true);
  });

  it('setUndoGroup sets undo-group', () => {
    const c = pcb.setUndoGroup(pcb.emptyChanges(), 'group-1');
    assert.equal(c['undo-group'], 'group-1');
  });

  it('setUndoGroup ignores null', () => {
    const c = pcb.setUndoGroup(pcb.emptyChanges(), null);
    assert.equal(c['undo-group'], undefined);
  });

  it('setTranslationQ sets translation?', () => {
    const c = pcb.setTranslationQ(pcb.emptyChanges(), true);
    assert.equal(c['translation?'], true);
  });

  it('setTranslationQ ignores false', () => {
    const c = pcb.setTranslationQ(pcb.emptyChanges(), false);
    assert.equal(c['translation?'], undefined);
  });

  it('concatChanges merges redo and undo', () => {
    const c1 = { 'redo-changes': [{ type: 'a' }], 'undo-changes': [{ type: 'u1' }] };
    const c2 = { 'redo-changes': [{ type: 'b' }], 'undo-changes': [{ type: 'u2' }] };
    const result = pcb.concatChanges(c1, c2);
    assert.deepEqual(result['redo-changes'], [{ type: 'a' }, { type: 'b' }]);
    assert.deepEqual(result['undo-changes'], [{ type: 'u2' }, { type: 'u1' }]);
  });

  it('addColor adds redo and undo', () => {
    const c = pcb.emptyChanges();
    const color = { id: 'color-1', name: 'Red' };
    const result = pcb.addColor(c, color);
    assert.equal(result['redo-changes'].length, 1);
    assert.equal(result['redo-changes'][0].type, 'add-color');
    assert.equal(result['undo-changes'].length, 1);
    assert.equal(result['undo-changes'][0].type, 'del-color');
  });

  it('deleteColor adds redo and undo', () => {
    const c = pcb.emptyChanges();
    const result = pcb.deleteColor(c, 'color-1');
    assert.equal(result['redo-changes'][0].type, 'del-color');
    assert.equal(result['undo-changes'][0].type, 'add-color');
  });

  it('addMedia adds redo and undo', () => {
    const c = pcb.emptyChanges();
    const media = { id: 'media-1', name: 'image.png' };
    const result = pcb.addMedia(c, media);
    assert.equal(result['redo-changes'][0].type, 'add-media');
    assert.equal(result['undo-changes'][0].type, 'del-media');
  });

  it('addTypography adds redo and undo', () => {
    const c = pcb.emptyChanges();
    const typo = { id: 'typo-1', name: 'Heading' };
    const result = pcb.addTypography(c, typo);
    assert.equal(result['redo-changes'][0].type, 'add-typography');
    assert.equal(result['undo-changes'][0].type, 'del-typography');
  });

  it('deleteComponent adds redo and undo', () => {
    const c = pcb.emptyChanges();
    const result = pcb.deleteComponent(c, 'comp-1', 'page-1');
    assert.equal(result['redo-changes'][0].type, 'del-component');
    assert.equal(result['undo-changes'][0].type, 'restore-component');
  });

  it('restoreComponent adds redo and undo', () => {
    const c = pcb.emptyChanges();
    const result = pcb.restoreComponent(c, 'comp-1', 'page-1', null);
    assert.equal(result['redo-changes'][0].type, 'restore-component');
    assert.equal(result['undo-changes'][0].type, 'del-component');
  });

  it('setActiveTokenThemes adds redo and undo', () => {
    const c = pcb.emptyChanges();
    const result = pcb.setActiveTokenThemes(c, new Set(['path/to/theme']));
    assert.equal(result['redo-changes'][0].type, 'set-active-token-themes');
    assert.equal(result['undo-changes'][0].type, 'set-active-token-themes');
  });

  it('amendLastChange modifies last redo', () => {
    const c = pcb.emptyChanges();
    const c2 = pcb.addColor(c, { id: 'c1', name: 'Red' });
    const result = pcb.amendLastChange(c2, (change) => ({ ...change, extra: true }));
    assert.equal(result['redo-changes'][0].extra, true);
  });

  it('setTextContent adds redo and undo', () => {
    const c = pcb.emptyChanges();
    const result = pcb.setTextContent(c, 'shape-1', 'new content', 'old content');
    assert.equal(result['redo-changes'][0].type, 'mod-obj');
    assert.equal(result['redo-changes'][0].operations[0].attr, 'content');
    assert.equal(result['undo-changes'][0].operations[0].val, 'old content');
  });

  it('moveTokenSet adds redo and undo', () => {
    const c = pcb.emptyChanges();
    const result = pcb.moveTokenSet(c, { 'from-path': ['a'], 'to-path': ['b'], 'before-path': null, 'before-group?': null, 'prev-before-path': null, 'prev-before-group?': null });
    assert.equal(result['redo-changes'][0].type, 'move-token-set');
    assert.equal(result['undo-changes'][0].type, 'move-token-set');
  });

  it('moveTokenSetGroup adds redo and undo', () => {
    const c = pcb.emptyChanges();
    const result = pcb.moveTokenSetGroup(c, { 'from-path': ['a'], 'to-path': ['b'], 'before-path': null, 'before-group?': null, 'prev-before-path': null, 'prev-before-group?': null });
    assert.equal(result['redo-changes'][0].type, 'move-token-set-group');
    assert.equal(result['undo-changes'][0].type, 'move-token-set-group');
  });
});