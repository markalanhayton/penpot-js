import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as cfc from '../src/files/changes.js';

function makeFileData() {
  return {
    id: 'file-1',
    pages: ['page-1'],
    'pages-index': {
      'page-1': {
        id: 'page-1',
        name: 'Page 1',
        objects: {},
      },
    },
    components: {},
    colors: {},
    media: {},
    typographies: {},
  };
}

describe('changes', () => {
  describe('processChanges', () => {
    it('returns data unchanged for empty changes', () => {
      const data = makeFileData();
      const result = cfc.processChanges(data, []);
      assert.deepEqual(result, data);
    });

    it('processes add-color change', () => {
      const data = makeFileData();
      const color = { id: 'c1', name: 'Red', color: '#ff0000' };
      const result = cfc.processChanges(data, [{ type: 'add-color', color }]);
      assert.ok(result.colors['c1']);
      assert.equal(result.colors['c1'].name, 'Red');
    });

    it('processes del-color change', () => {
      const data = { ...makeFileData(), colors: { c1: { id: 'c1', name: 'Red' } } };
      const result = cfc.processChanges(data, [{ type: 'del-color', id: 'c1' }]);
      assert.ok(!result.colors['c1']);
    });

    it('processes mod-color change', () => {
      const data = { ...makeFileData(), colors: { c1: { id: 'c1', name: 'Red' } } };
      const result = cfc.processChanges(data, [{ type: 'mod-color', color: { id: 'c1', name: 'Blue' } }]);
      assert.equal(result.colors['c1'].name, 'Blue');
    });

    it('processes add-media change', () => {
      const data = makeFileData();
      const media = { id: 'm1', name: 'image.png' };
      const result = cfc.processChanges(data, [{ type: 'add-media', object: media }]);
      assert.ok(result.media['m1']);
    });

    it('processes del-media change', () => {
      const data = { ...makeFileData(), media: { m1: { id: 'm1', name: 'image.png' } } };
      const result = cfc.processChanges(data, [{ type: 'del-media', id: 'm1' }]);
      assert.ok(!result.media['m1']);
    });

    it('processes add-typography change', () => {
      const data = makeFileData();
      const typo = { id: 't1', name: 'Heading' };
      const result = cfc.processChanges(data, [{ type: 'add-typography', typography: typo }]);
      assert.ok(result.typographies['t1']);
    });

    it('processes del-typography change', () => {
      const data = { ...makeFileData(), typographies: { t1: { id: 't1', name: 'Heading' } } };
      const result = cfc.processChanges(data, [{ type: 'del-typography', id: 't1' }]);
      assert.ok(!result.typographies['t1']);
    });

    it('processes add-component change', () => {
      const data = makeFileData();
      const result = cfc.processChanges(data, [{ type: 'add-component', id: 'comp1', path: '', name: 'My Component', 'main-instance-id': 's1', 'main-instance-page': 'page-1' }]);
      assert.ok(result.components['comp1']);
      assert.equal(result.components['comp1'].name, 'My Component');
    });

    it('processes del-component change', () => {
      const data = { ...makeFileData(), components: { comp1: { id: 'comp1', name: 'Test' } } };
      const result = cfc.processChanges(data, [{ type: 'del-component', id: 'comp1' }]);
      assert.ok(!result.components['comp1']);
    });

    it('processes set-tokens-lib change', () => {
      const data = makeFileData();
      const tokensLib = { id: 'tl1', name: 'Tokens' };
      const result = cfc.processChanges(data, [{ type: 'set-tokens-lib', 'tokens-lib': tokensLib }]);
      assert.deepEqual(result['tokens-lib'], tokensLib);
    });

    it('processes set-active-token-themes change', () => {
      const data = { ...makeFileData(), 'tokens-lib': { themes: {} } };
      const result = cfc.processChanges(data, [{ type: 'set-active-token-themes', 'theme-paths': new Set(['/theme1']) }]);
      assert.ok(result['tokens-lib']['active-theme-paths'].has('/theme1'));
    });

    it('processes add-page change', () => {
      const data = makeFileData();
      const result = cfc.processChanges(data, [{ type: 'add-page', id: 'page-2', name: 'Page 2' }]);
      assert.ok(result.pages.includes('page-2'));
      assert.ok(result['pages-index']['page-2']);
    });

    it('processes del-page change', () => {
      const data = makeFileData();
      const result = cfc.processChanges(data, [{ type: 'del-page', id: 'page-1' }]);
      assert.ok(!result.pages.includes('page-1'));
      assert.ok(!result['pages-index']['page-1']);
    });

    it('processes set-base-font-size change', () => {
      const data = makeFileData();
      const result = cfc.processChanges(data, [{ type: 'set-base-font-size', 'base-font-size': '18px' }]);
      assert.equal(result.options['base-font-size'], '18px');
    });

    it('processes mod-obj change on shapes', () => {
      const data = makeFileData();
      data['pages-index']['page-1'].objects = { s1: { id: 's1', type: 'rect', name: 'Old', x: 10, y: 20 } };
      const result = cfc.processChanges(data, [{ type: 'mod-obj', id: 's1', 'page-id': 'page-1', operations: [{ type: 'set', attr: 'name', val: 'New' }] }]);
      assert.equal(result['pages-index']['page-1'].objects['s1'].name, 'New');
      assert.equal(result['pages-index']['page-1'].objects['s1'].x, 10);
    });

    it('processes mod-page change', () => {
      const data = makeFileData();
      const result = cfc.processChanges(data, [{ type: 'mod-page', id: 'page-1', name: 'New Name' }]);
      assert.equal(result['pages-index']['page-1'].name, 'New Name');
    });

    it('chains multiple changes', () => {
      const data = makeFileData();
      const result = cfc.processChanges(data, [
        { type: 'add-color', color: { id: 'c1', name: 'Red', color: '#ff0000' } },
        { type: 'del-color', id: 'c1' },
      ]);
      assert.ok(!result.colors['c1']);
    });
  });

  describe('processOperation', () => {
    it('processes set operation', () => {
      const shape = { id: 's1', name: 'Old', x: 10 };
      const result = cfc.processOperation(shape, { type: 'set', attr: 'name', val: 'New' });
      assert.equal(result.name, 'New');
      assert.equal(result.x, 10);
    });

    it('processes assign operation', () => {
      const shape = { id: 's1', name: 'Old', x: 10 };
      const result = cfc.processOperation(shape, { type: 'assign', value: { name: 'New', y: 20 } });
      assert.equal(result.name, 'New');
      assert.equal(result.y, 20);
      assert.equal(result.x, 10);
    });

    it('processes set-touched with null removes touched', () => {
      const shape = { id: 's1', touched: new Set(['x']) };
      const result = cfc.processOperation(shape, { type: 'set-touched', touched: null });
      assert.ok(!('touched' in result));
    });

    it('processes set-remote-synced operation', () => {
      const shape = { id: 's1', 'component-id': 'c1', 'component-file': 'f1', 'shape-ref': 'r1' };
      const result = cfc.processOperation(shape, { type: 'set-remote-synced', 'remote-synced': true });
      assert.equal(result['remote-synced'], true);
    });
  });

  describe('componentsChanged', () => {
    it('returns null for unknown change types', () => {
      const result = cfc.componentsChanged(makeFileData(), { type: 'add-color' });
      assert.equal(result, null);
    });
  });

  describe('framesChanged', () => {
    it('returns null for unknown change types', () => {
      const result = cfc.framesChanged(makeFileData(), { type: 'add-color' });
      assert.equal(result, null);
    });
  });

  describe('set-guide changes', () => {
    it('adds a guide to a page', () => {
      const data = makeFileData();
      const result = cfc.processChanges(data, [{
        type: 'set-guide',
        'page-id': 'page-1',
        id: 'guide-1',
        params: { axis: 'x', position: 100 },
      }]);
      assert.ok(result['pages-index']['page-1'].guides);
      assert.deepEqual(result['pages-index']['page-1'].guides['guide-1'], {
        id: 'guide-1',
        axis: 'x',
        position: 100,
      });
    });

    it('updates an existing guide', () => {
      const data = {
        ...makeFileData(),
        'pages-index': {
          ...makeFileData()['pages-index'],
          'page-1': {
            ...makeFileData()['pages-index']['page-1'],
            guides: {
              'guide-1': { id: 'guide-1', axis: 'x', position: 100 },
            },
          },
        },
      };
      const result = cfc.processChanges(data, [{
        type: 'set-guide',
        'page-id': 'page-1',
        id: 'guide-1',
        params: { axis: 'x', position: 200 },
      }]);
      assert.equal(result['pages-index']['page-1'].guides['guide-1'].position, 200);
    });

    it('deletes a guide when params is null', () => {
      const data = {
        ...makeFileData(),
        'pages-index': {
          ...makeFileData()['pages-index'],
          'page-1': {
            ...makeFileData()['pages-index']['page-1'],
            guides: {
              'guide-1': { id: 'guide-1', axis: 'x', position: 100 },
            },
          },
        },
      };
      const result = cfc.processChanges(data, [{
        type: 'set-guide',
        'page-id': 'page-1',
        id: 'guide-1',
        params: null,
      }]);
      assert.equal(result['pages-index']['page-1'].guides, undefined);
    });

    it('handles guide with frame-id', () => {
      const data = makeFileData();
      const result = cfc.processChanges(data, [{
        type: 'set-guide',
        'page-id': 'page-1',
        id: 'guide-2',
        params: { axis: 'y', position: 50, 'frame-id': 'frame-1' },
      }]);
      assert.equal(result['pages-index']['page-1'].guides['guide-2']['frame-id'], 'frame-1');
    });

    it('handles guide with color', () => {
      const data = makeFileData();
      const result = cfc.processChanges(data, [{
        type: 'set-guide',
        'page-id': 'page-1',
        id: 'guide-3',
        params: { axis: 'x', position: 150, color: '#ff0000' },
      }]);
      assert.equal(result['pages-index']['page-1'].guides['guide-3'].color, '#ff0000');
    });

    it('removes guides key entirely when last guide is deleted', () => {
      const data = {
        ...makeFileData(),
        'pages-index': {
          ...makeFileData()['pages-index'],
          'page-1': {
            ...makeFileData()['pages-index']['page-1'],
            guides: {
              'guide-1': { id: 'guide-1', axis: 'x', position: 100 },
            },
          },
        },
      };
      const result = cfc.processChanges(data, [{
        type: 'set-guide',
        'page-id': 'page-1',
        id: 'guide-1',
        params: null,
      }]);
      assert.equal(result['pages-index']['page-1'].guides, undefined);
    });
  });
});