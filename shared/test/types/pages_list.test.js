import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPage, getLastPage, addPage, pagesSeq, updatePage, deletePage } from '../../src/types/pages_list.js';
import { next } from '../../src/uuid.js';

describe('pages-list', () => {
  it('getPage returns undefined for missing', () => {
    assert.equal(getPage({}, 'missing'), undefined);
  });

  it('addPage and getPage', () => {
    const fd = addPage({ pages: [], 'pages-index': {} }, { id: 'p1', name: 'Page 1' });
    assert.ok(getPage(fd, 'p1'));
    assert.equal(getPage(fd, 'p1').name, 'Page 1');
  });

  it('addPage with index', () => {
    const fd1 = addPage({ pages: [], 'pages-index': {} }, { id: 'p1', name: 'A' });
    const fd2 = addPage(fd1, { id: 'p2', name: 'B', index: 0 });
    assert.deepEqual(fd2.pages, ['p2', 'p1']);
  });

  it('addPage idempotent', () => {
    const fd1 = addPage({ pages: [], 'pages-index': {} }, { id: 'p1', name: 'A' });
    const fd2 = addPage(fd1, { id: 'p1', name: 'A' });
    assert.deepEqual(fd2.pages, ['p1']);
  });

  it('getLastPage', () => {
    const fd = addPage({ pages: [], 'pages-index': {} }, { id: 'p1', name: 'A' });
    assert.equal(getLastPage(fd).name, 'A');
  });

  it('getLastPage empty', () => {
    assert.equal(getLastPage({ pages: [] }), undefined);
  });

  it('pagesSeq', () => {
    const fd = addPage({ pages: [], 'pages-index': {} }, { id: 'p1', name: 'A' });
    assert.equal(pagesSeq(fd).length, 1);
  });

  it('updatePage', () => {
    const fd = addPage({ pages: [], 'pages-index': {} }, { id: 'p1', name: 'A' });
    const updated = updatePage(fd, 'p1', (p) => ({ ...p, name: 'B' }));
    assert.equal(getPage(updated, 'p1').name, 'B');
  });

  it('deletePage', () => {
    const fd = addPage({ pages: [], 'pages-index': {} }, { id: 'p1', name: 'A' });
    const deleted = deletePage(fd, 'p1');
    assert.equal(deleted.pages.length, 0);
    assert.equal(getPage(deleted, 'p1'), undefined);
  });
});