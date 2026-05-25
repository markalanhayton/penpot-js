import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { collectUsedMediaIds, collectMediaFromShape, collectMediaFromShapes, collectComponentReferences, cleanFile } from '../src/tasks/file-gc.js';

describe('collectMediaFromShape', () => {
  it('extracts fillImage', () => {
    const usedIds = new Set();
    collectMediaFromShape({ fillImage: 'media-1' }, usedIds);
    assert.ok(usedIds.has('media-1'));
  });

  it('extracts fills array images', () => {
    const usedIds = new Set();
    collectMediaFromShape({ fills: [{ fillImage: 'media-2' }] }, usedIds);
    assert.ok(usedIds.has('media-2'));
  });

  it('extracts strokes array images', () => {
    const usedIds = new Set();
    collectMediaFromShape({ strokes: [{ strokeImage: 'media-3' }] }, usedIds);
    assert.ok(usedIds.has('media-3'));
  });

  it('extracts metadata.mediaId', () => {
    const usedIds = new Set();
    collectMediaFromShape({ metadata: { mediaId: 'media-4' } }, usedIds);
    assert.ok(usedIds.has('media-4'));
  });

  it('handles null shape', () => {
    const usedIds = new Set();
    collectMediaFromShape(null, usedIds);
    assert.equal(usedIds.size, 0);
  });

  it('handles empty shape', () => {
    const usedIds = new Set();
    collectMediaFromShape({}, usedIds);
    assert.equal(usedIds.size, 0);
  });

  it('walks children array', () => {
    const usedIds = new Set();
    collectMediaFromShape({
      children: [{ fillImage: 'child-media' }],
    }, usedIds);
    assert.ok(usedIds.has('child-media'));
  });

  it('walks children object (objects map)', () => {
    const usedIds = new Set();
    collectMediaFromShape({
      children: {
        'shape-1': { fillImage: 'child-obj-media' },
      },
    }, usedIds);
    assert.ok(usedIds.has('child-obj-media'));
  });
});

describe('collectUsedMediaIds', () => {
  it('collects from pagesIndex objects', () => {
    const data = {
      pagesIndex: {
        'page-1': {
          objects: {
            'shape-1': { fillImage: 'media-10' },
          },
        },
      },
    };
    const usedIds = new Set();
    collectUsedMediaIds(data, usedIds);
    assert.ok(usedIds.has('media-10'));
  });

  it('collects from file-level media map', () => {
    const data = {
      media: { 'media-20': { id: 'media-20' } },
    };
    const usedIds = new Set();
    collectUsedMediaIds(data, usedIds);
    assert.ok(usedIds.has('media-20'));
  });

  it('collects from components', () => {
    const data = {
      components: {
        'comp-1': {
          objects: {
            'shape-1': { fillImage: 'comp-media' },
          },
        },
      },
    };
    const usedIds = new Set();
    collectUsedMediaIds(data, usedIds);
    assert.ok(usedIds.has('comp-media'));
  });

  it('handles null data', () => {
    const usedIds = new Set();
    collectUsedMediaIds(null, usedIds);
    assert.equal(usedIds.size, 0);
  });
});

describe('collectComponentReferences', () => {
  it('collects componentId with matching libraryFileId', () => {
    const usedIds = new Set();
    const objects = {
      'shape-1': { componentId: 'comp-1', componentFileId: 'lib-file-id' },
    };
    collectComponentReferences(objects, 'lib-file-id', usedIds);
    assert.ok(usedIds.has('comp-1'));
  });

  it('ignores componentId from different library', () => {
    const usedIds = new Set();
    const objects = {
      'shape-1': { componentId: 'comp-1', componentFileId: 'other-lib-id' },
    };
    collectComponentReferences(objects, 'lib-file-id', usedIds);
    assert.equal(usedIds.size, 0);
  });

  it('collects componentRoot references', () => {
    const usedIds = new Set();
    const objects = {
      'shape-1': { componentRoot: 'comp-2', componentFileId: 'lib-file-id' },
    };
    collectComponentReferences(objects, 'lib-file-id', usedIds);
    assert.ok(usedIds.has('comp-2'));
  });

  it('collects shapeRef component references', () => {
    const usedIds = new Set();
    const objects = {
      'shape-1': { shapeRef: { fileId: 'lib-file-id', componentId: 'comp-3' } },
    };
    collectComponentReferences(objects, 'lib-file-id', usedIds);
    assert.ok(usedIds.has('comp-3'));
  });

  it('handles null objects', () => {
    const usedIds = new Set();
    collectComponentReferences(null, 'lib-file-id', usedIds);
    assert.equal(usedIds.size, 0);
  });

  it('handles shapes without component references', () => {
    const usedIds = new Set();
    const objects = {
      'shape-1': { type: 'rect', x: 10, y: 20 },
    };
    collectComponentReferences(objects, 'lib-file-id', usedIds);
    assert.equal(usedIds.size, 0);
  });
});

describe('cleanFile', () => {
  it('removes nil keys from top-level data', () => {
    const data = { pagesIndex: {}, components: {}, nullValue: null, undefinedValue: undefined };
    const result = cleanFile(data);
    assert.equal(result.nullValue, undefined);
    assert.equal(result.undefinedValue, undefined);
    assert.deepEqual(Object.keys(result).sort(), ['components', 'pagesIndex']);
  });

  it('fixes bool-content → content migration', () => {
    const data = {
      pagesIndex: {
        'page-1': {
          id: 'page-1',
          objects: {
            'shape-1': { type: 'bool', boolContent: [{ type: 'rect' }], id: 'shape-1' },
          },
        },
      },
    };
    const result = cleanFile(data);
    const shape = result.pagesIndex['page-1'].objects['shape-1'];
    assert.deepEqual(shape.content, [{ type: 'rect' }]);
    assert.equal(shape.boolContent, undefined);
  });

  it('fixes legacy flex direction names', () => {
    const data = {
      pagesIndex: {
        'page-1': {
          id: 'page-1',
          objects: {
            'shape-1': { type: 'frame', layoutFlexDir: 'reverse-row', id: 'shape-1' },
          },
        },
      },
    };
    const result = cleanFile(data);
    assert.equal(result.pagesIndex['page-1'].objects['shape-1'].layoutFlexDir, 'row-reverse');
  });

  it('fixes root shape with zero UUID', () => {
    const zeroId = '00000000-0000-0000-0000-000000000000';
    const data = {
      pagesIndex: {
        'page-1': {
          id: 'page-1',
          objects: {
            [zeroId]: { id: zeroId, type: 'frame' },
          },
        },
      },
    };
    const result = cleanFile(data);
    const root = result.pagesIndex['page-1'].objects[zeroId];
    assert.equal(root.parentId, zeroId);
    assert.equal(root.frameId, zeroId);
  });

  it('cleans components with nil objects', () => {
    const data = {
      components: {
        'comp-1': {
          id: 'comp-1',
          objects: { 'shape-1': { type: 'rect' }, '': null },
        },
      },
    };
    const result = cleanFile(data);
    const comp = result.components['comp-1'];
    assert.ok(comp.objects['shape-1']);
    assert.equal(comp.objects[''], undefined);
  });

  it('handles null data gracefully', () => {
    const result = cleanFile(null);
    assert.equal(result, null);
  });
});