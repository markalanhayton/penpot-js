import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_FONT_SIZE, EMPTY_FILE_DATA, makeFileData, makeFile, fileData, updateFileData, updatePages, updateComponents, findComponentFile, getComponentFromLibraries, getComponentRoot, getBaseFontSize, setBaseFontSize } from '../../src/types/file.js';

describe('file', () => {
  it('BASE_FONT_SIZE', () => {
    assert.equal(BASE_FONT_SIZE, '16px');
  });

  it('EMPTY_FILE_DATA', () => {
    assert.deepEqual(EMPTY_FILE_DATA.pages, []);
    assert.deepEqual(EMPTY_FILE_DATA['pages-index'], {});
  });

  it('makeFileData creates file with one page', () => {
    const fd = makeFileData('file1');
    assert.ok(fd.id);
    assert.ok(fd.options['components-v2']);
    assert.equal(fd.options['base-font-size'], '16px');
    const pageIds = fd.pages;
    assert.equal(pageIds.length, 1);
  });

  it('makeFile with defaults', () => {
    const f = makeFile({ name: 'Test' });
    assert.ok(f.id);
    assert.equal(f.name, 'Test');
    assert.equal(f.revn, 0);
    assert.ok(f['created-at']);
    assert.ok(f['modified-at']);
    assert.equal(f['is-shared'], false);
  });

  it('fileData', () => {
    const f = { data: { pages: [] } };
    assert.deepEqual(fileData(f), { pages: [] });
  });

  it('updateFileData', () => {
    const f = { data: { pages: [] } };
    const updated = updateFileData(f, (d) => ({ ...d, extra: true }));
    assert.ok(updated.data.extra);
  });

  it('getBaseFontSize default', () => {
    assert.equal(getBaseFontSize({}), '16px');
    assert.equal(getBaseFontSize({ options: { 'base-font-size': '12px' } }), '12px');
  });

  it('setBaseFontSize', () => {
    const fd = { options: {} };
    const updated = setBaseFontSize(fd, '10px');
    assert.equal(updated.options['base-font-size'], '10px');
  });
});