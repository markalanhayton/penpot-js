/**
 * @module test/process-changes.test
 * Unit tests for the process-changes engine.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processChanges } from '../public/lib/process-changes.js';

function makePage(id, objects = {}) {
  return { id, name: `Page ${id}`, objects };
}

function makeShape(id, props = {}) {
  return {
    id,
    type: 'rect',
    x: 0, y: 0, width: 100, height: 100,
    parentId: 'frame1',
    selrect: { x: 0, y: 0, width: 100, height: 100 },
    ...props,
  };
}

describe('processChanges', () => {
  describe('add-obj', () => {
    it('adds a shape to a page (pagesIndex model)', () => {
      const data = {
        pages: ['p1'],
        pagesIndex: {
          p1: makePage('p1', { frame1: makeShape('frame1', { type: 'frame', shapes: [], parentId: undefined }) }),
        },
      };

      const shape = makeShape('s1');
      processChanges(data, [{ type: 'add-obj', pageId: 'p1', obj: shape, parentId: 'frame1' }]);

      assert.ok(data.pagesIndex.p1.objects.s1);
      assert.equal(data.pagesIndex.p1.objects.s1.id, 's1');
      assert.deepEqual(data.pagesIndex.p1.objects.frame1.shapes, ['s1']);
    });

    it('adds a shape to a page (array model)', () => {
      const data = {
        pages: [makePage('p1', { frame1: makeShape('frame1', { type: 'frame', shapes: [], parentId: undefined }) })],
      };

      const shape = makeShape('s1');
      processChanges(data, [{ type: 'add-obj', pageId: 'p1', obj: shape, parentId: 'frame1' }]);

      assert.ok(data.pages[0].objects.s1);
      assert.deepEqual(data.pages[0].objects.frame1.shapes, ['s1']);
    });

    it('adds at specific index', () => {
      const frame = makeShape('frame1', { type: 'frame', shapes: ['s0'], parentId: undefined });
      const data = {
        pages: ['p1'],
        pagesIndex: { p1: makePage('p1', { frame1: frame, s0: makeShape('s0') }) },
      };

      const shape = makeShape('s1');
      processChanges(data, [{ type: 'add-obj', pageId: 'p1', obj: shape, parentId: 'frame1', index: 0 }]);

      assert.deepEqual(data.pagesIndex.p1.objects.frame1.shapes, ['s1', 's0']);
    });
  });

  describe('mod-obj', () => {
    it('sets a single attribute via set operation', () => {
      const shape = makeShape('s1', { x: 10, y: 20 });
      const data = {
        pages: ['p1'],
        pagesIndex: { p1: makePage('p1', { s1: shape }) },
      };

      processChanges(data, [{
        type: 'mod-obj', id: 's1', pageId: 'p1',
        operations: [{ type: 'set', attr: 'x', val: 50 }],
      }]);

      assert.equal(data.pagesIndex.p1.objects.s1.x, 50);
      assert.equal(data.pagesIndex.p1.objects.s1.y, 20);
    });

    it('sets multiple attributes in one change', () => {
      const shape = makeShape('s1', { x: 10, y: 20, width: 100 });
      const data = {
        pages: ['p1'],
        pagesIndex: { p1: makePage('p1', { s1: shape }) },
      };

      processChanges(data, [{
        type: 'mod-obj', id: 's1', pageId: 'p1',
        operations: [
          { type: 'set', attr: 'x', val: 50 },
          { type: 'set', attr: 'width', val: 200 },
        ],
      }]);

      assert.equal(data.pagesIndex.p1.objects.s1.x, 50);
      assert.equal(data.pagesIndex.p1.objects.s1.width, 200);
      assert.equal(data.pagesIndex.p1.objects.s1.y, 20);
    });

    it('assigns multiple attributes at once', () => {
      const shape = makeShape('s1', { x: 10, y: 20 });
      const data = {
        pages: ['p1'],
        pagesIndex: { p1: makePage('p1', { s1: shape }) },
      };

      processChanges(data, [{
        type: 'mod-obj', id: 's1', pageId: 'p1',
        operations: [{ type: 'assign', value: { x: 50, y: 60 } }],
      }]);

      assert.equal(data.pagesIndex.p1.objects.s1.x, 50);
      assert.equal(data.pagesIndex.p1.objects.s1.y, 60);
    });

    it('sets touched flag', () => {
      const shape = makeShape('s1');
      const data = {
        pages: ['p1'],
        pagesIndex: { p1: makePage('p1', { s1: shape }) },
      };

      processChanges(data, [{
        type: 'mod-obj', id: 's1', pageId: 'p1',
        operations: [{ type: 'set-touched', touched: true }],
      }]);

      assert.equal(data.pagesIndex.p1.objects.s1.touched, true);
    });

    it('ignores missing shape silently', () => {
      const data = {
        pages: ['p1'],
        pagesIndex: { p1: makePage('p1', {}) },
      };

      processChanges(data, [{
        type: 'mod-obj', id: 'nonexistent', pageId: 'p1',
        operations: [{ type: 'set', attr: 'x', val: 50 }],
      }]);
    });
  });

  describe('del-obj', () => {
    it('deletes a shape and removes from parent', () => {
      const parent = makeShape('frame1', { type: 'frame', shapes: ['s1', 's2'], parentId: undefined });
      const shape = makeShape('s1', { parentId: 'frame1' });
      const shape2 = makeShape('s2', { parentId: 'frame1' });
      const data = {
        pages: ['p1'],
        pagesIndex: { p1: makePage('p1', { frame1: parent, s1: shape, s2: shape2 }) },
      };

      processChanges(data, [{ type: 'del-obj', id: 's1', pageId: 'p1' }]);

      assert.equal(data.pagesIndex.p1.objects.s1, undefined);
      assert.deepEqual(data.pagesIndex.p1.objects.frame1.shapes, ['s2']);
    });
  });

  describe('mov-objects', () => {
    it('moves shapes between parents', () => {
      const parent1 = makeShape('f1', { type: 'frame', shapes: ['s1'], parentId: undefined });
      const parent2 = makeShape('f2', { type: 'frame', shapes: [], parentId: undefined });
      const shape = makeShape('s1', { parentId: 'f1' });
      const data = {
        pages: ['p1'],
        pagesIndex: { p1: makePage('p1', { f1: parent1, f2: parent2, s1: shape }) },
      };

      processChanges(data, [{ type: 'mov-objects', pageId: 'p1', parentId: 'f2', shapes: ['s1'] }]);

      assert.deepEqual(data.pagesIndex.p1.objects.f1.shapes, []);
      assert.deepEqual(data.pagesIndex.p1.objects.f2.shapes, ['s1']);
      assert.equal(data.pagesIndex.p1.objects.s1.parentId, 'f2');
    });
  });

  describe('add-page', () => {
    it('adds a new page to pagesIndex model', () => {
      const data = { pages: [], pagesIndex: {} };
      processChanges(data, [{ type: 'add-page', id: 'p1', name: 'Page 1' }]);

      assert.ok(data.pagesIndex.p1);
      assert.equal(data.pagesIndex.p1.name, 'Page 1');
      assert.deepEqual(data.pages, ['p1']);
    });

    it('adds a new page to array model', () => {
      const data = { pages: [] };
      processChanges(data, [{ type: 'add-page', id: 'p1', name: 'Page 1' }]);

      assert.equal(data.pages.length, 1);
      assert.equal(data.pages[0].id, 'p1');
    });
  });

  describe('del-page', () => {
    it('deletes a page from pagesIndex model', () => {
      const data = {
        pages: ['p1', 'p2'],
        pagesIndex: { p1: makePage('p1'), p2: makePage('p2') },
      };

      processChanges(data, [{ type: 'del-page', id: 'p1' }]);

      assert.equal(data.pagesIndex.p1, undefined);
      assert.deepEqual(data.pages, ['p2']);
    });
  });

  describe('add-color / mod-color / del-color', () => {
    it('adds a color', () => {
      const data = { pages: [], pagesIndex: {}, colors: [] };
      processChanges(data, [{ type: 'add-color', color: { id: 'c1', color: '#ff0000' } }]);

      assert.equal(data.colors.length, 1);
      assert.equal(data.colors[0].color, '#ff0000');
    });

    it('modifies a color', () => {
      const data = { pages: [], pagesIndex: {}, colors: [{ id: 'c1', color: '#ff0000' }] };
      processChanges(data, [{ type: 'mod-color', color: { id: 'c1', color: '#00ff00' } }]);

      assert.equal(data.colors[0].color, '#00ff00');
    });

    it('deletes a color', () => {
      const data = { pages: [], pagesIndex: {}, colors: [{ id: 'c1', color: '#ff0000' }] };
      processChanges(data, [{ type: 'del-color', id: 'c1' }]);

      assert.equal(data.colors.length, 0);
    });
  });

  describe('no-op cases', () => {
    it('handles empty changes array', () => {
      const data = { pages: ['p1'], pagesIndex: { p1: makePage('p1') } };
      const result = processChanges(data, []);
      assert.equal(result, data);
    });

    it('handles null changes', () => {
      const data = { pages: [] };
      const result = processChanges(data, null);
      assert.equal(result, data);
    });

    it('skips unknown change types', () => {
      const data = { pages: [], pagesIndex: {} };
      processChanges(data, [{ type: 'unknown-type' }]);
    });
  });
});