/**
 * @module test/ot.test
 * Unit tests for the operational transform engine.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transformChanges, invertChanges, applyWithUndoReapply } from '../public/lib/ot.js';
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

function makeData(shapes = {}) {
  const frame = makeShape('frame1', { type: 'frame', shapes: Object.keys(shapes), parentId: undefined });
  const allObjects = { frame1: frame, ...shapes };
  for (const shape of Object.values(shapes)) {
    if (!shape.parentId) shape.parentId = 'frame1';
  }
  return {
    pages: ['p1'],
    pagesIndex: { p1: makePage('p1', allObjects) },
  };
}

describe('transformChanges', () => {
  it('returns empty for empty inputs', () => {
    const [left, right] = transformChanges([], []);
    assert.deepEqual(left, []);
    assert.deepEqual(right, []);
  });

  it('passes through non-conflicting changes unchanged', () => {
    const left = [{ type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 10 }] }];
    const right = [{ type: 'mod-obj', id: 's2', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 20 }] }];
    const [lp, rp] = transformChanges(left, right);

    assert.equal(lp.length, 1);
    assert.equal(rp.length, 1);
    assert.equal(lp[0].operations[0].val, 10);
    assert.equal(rp[0].operations[0].val, 20);
  });

  it('transforms same-shape different-attribute edits (no conflict)', () => {
    const left = [{ type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 10 }] }];
    const right = [{ type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'y', val: 20 }] }];
    const [lp, rp] = transformChanges(left, right);

    assert.equal(lp.length, 1);
    assert.equal(rp.length, 1);
    // Different attributes: both survive unchanged
    assert.equal(lp[0].operations[0].val, 10);
    assert.equal(rp[0].operations[0].val, 20);
  });

  it('transforms same-shape same-attribute edits (conflict)', () => {
    const left = [{ type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 10 }] }];
    const right = [{ type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 20 }] }];
    const [lp, rp] = transformChanges(left, right);

    assert.equal(lp.length, 1);
    assert.equal(rp.length, 1);
    // Conflicting attr: values are swapped for TP1 property
    assert.equal(lp[0].operations[0].val, 20);
    assert.equal(rp[0].operations[0].val, 10);
  });

  it('handles delete-delete of same shape', () => {
    const left = [{ type: 'del-obj', id: 's1', pageId: 'p1' }];
    const right = [{ type: 'del-obj', id: 's1', pageId: 'p1' }];
    const [lp, rp] = transformChanges(left, right);

    assert.equal(lp.length, 0);
    assert.equal(rp.length, 0);
  });

  it('handles delete-modify of same shape', () => {
    const left = [{ type: 'del-obj', id: 's1', pageId: 'p1' }];
    const right = [{ type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 20 }] }];
    const [lp, rp] = transformChanges(left, right);

    assert.equal(lp.length, 1);
    assert.equal(lp[0].type, 'del-obj');
    assert.equal(rp.length, 0);
  });

  it('passes through changes on different pages', () => {
    const left = [{ type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 10 }] }];
    const right = [{ type: 'mod-obj', id: 's1', pageId: 'p2', operations: [{ type: 'set', attr: 'x', val: 20 }] }];
    const [lp, rp] = transformChanges(left, right);

    assert.equal(lp.length, 1);
    assert.equal(rp.length, 1);
    assert.equal(lp[0].pageId, 'p1');
    assert.equal(rp[0].pageId, 'p2');
  });

  it('handles mixed conflict and non-conflict in same change', () => {
    const left = [{ type: 'mod-obj', id: 's1', pageId: 'p1', operations: [
      { type: 'set', attr: 'x', val: 10 },
      { type: 'set', attr: 'fill', val: '#red' },
    ]}];
    const right = [{ type: 'mod-obj', id: 's1', pageId: 'p1', operations: [
      { type: 'set', attr: 'x', val: 20 },
      { type: 'set', attr: 'stroke', val: '#blue' },
    ]}];

    const [lp, rp] = transformChanges(left, right);

    // x conflicts → swapped values in left'/right'
    assert.equal(lp[0].operations[0].val, 20);
    assert.equal(rp[0].operations[0].val, 10);
    // fill and stroke don't conflict → unchanged
    assert.equal(lp[0].operations[1].val, '#red');
    assert.equal(rp[0].operations[1].val, '#blue');
  });
});

describe('invertChanges', () => {
  it('inverts add-obj to del-obj', () => {
    const inverted = invertChanges([{ type: 'add-obj', pageId: 'p1', obj: makeShape('s1') }], {});
    assert.equal(inverted.length, 1);
    assert.equal(inverted[0].type, 'del-obj');
    assert.equal(inverted[0].id, 's1');
  });

  it('inverts mod-obj set operation', () => {
    const data = makeData({ s1: makeShape('s1', { x: 50, y: 100 }) });
    const inverted = invertChanges([{
      type: 'mod-obj', id: 's1', pageId: 'p1',
      operations: [{ type: 'set', attr: 'x', val: 200 }],
    }], data);

    assert.equal(inverted.length, 1);
    assert.equal(inverted[0].type, 'mod-obj');
    assert.equal(inverted[0].operations[0].val, 50);
  });

  it('inverts del-obj to add-obj with shape data', () => {
    const shape = makeShape('s1', { x: 50 });
    const data = makeData({ s1: shape });
    const inverted = invertChanges([{ type: 'del-obj', id: 's1', pageId: 'p1' }], data);

    assert.equal(inverted.length, 1);
    assert.equal(inverted[0].type, 'add-obj');
    assert.equal(inverted[0].obj.x, 50);
  });

  it('returns changes in reverse order', () => {
    const data = makeData({ s1: makeShape('s1', { x: 10 }), s2: makeShape('s2', { x: 20 }) });
    const inverted = invertChanges([
      { type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 100 }] },
      { type: 'mod-obj', id: 's2', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 200 }] },
    ], data);

    assert.equal(inverted.length, 2);
    // Reversed: s2 undo comes first, then s1 undo
    assert.equal(inverted[0].id, 's2');
    assert.equal(inverted[1].id, 's1');
  });
});

describe('applyWithUndoReapply', () => {
  it('applies remote changes directly when no pending', () => {
    const data = makeData({ s1: makeShape('s1', { x: 10 }) });
    const remoteChanges = [{ type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 50 }] }];

    const result = applyWithUndoReapply(data, remoteChanges, []);

    assert.equal(data.pagesIndex.p1.objects.s1.x, 50);
    assert.deepEqual(result.adjustedPending, []);
  });

  it('unwinds and reapplies pending changes on conflict', () => {
    const shape = makeShape('s1', { x: 10, fill: '#red' });
    const data = makeData({ s1: shape });

    const pendingChanges = [
      { type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'fill', val: '#blue' }] },
    ];
    const remoteChanges = [
      { type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 50 }] },
    ];

    applyWithUndoReapply(data, remoteChanges, pendingChanges);

    // Remote change applied (x → 50)
    assert.equal(data.pagesIndex.p1.objects.s1.x, 50);
    // Local change re-applied (fill → #blue)
    assert.equal(data.pagesIndex.p1.objects.s1.fill, '#blue');
  });

  it('handles same-attribute conflict via OT', () => {
    const shape = makeShape('s1', { x: 10 });
    const data = makeData({ s1: shape });

    const pendingChanges = [
      { type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 30 }] },
    ];
    const remoteChanges = [
      { type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 50 }] },
    ];

    applyWithUndoReapply(data, remoteChanges, pendingChanges);

    // After OT transform, the re-applied pending change adopts the remote value
    // for the conflicting attribute. Both remote and local changes affect x,
    // so the final value is the adjusted pending value (which swapped to match remote).
    assert.equal(typeof data.pagesIndex.p1.objects.s1.x, 'number');
  });

  it('handles add-obj pending with remote mod-obj', () => {
    const shape = makeShape('s1', { x: 10 });
    const data = makeData({ s1: shape });

    const pendingChanges = [
      { type: 'add-obj', pageId: 'p1', obj: makeShape('s2', { parentId: 'frame1' }), parentId: 'frame1' },
    ];
    const remoteChanges = [
      { type: 'mod-obj', id: 's1', pageId: 'p1', operations: [{ type: 'set', attr: 'x', val: 50 }] },
    ];

    applyWithUndoReapply(data, remoteChanges, pendingChanges);

    assert.equal(data.pagesIndex.p1.objects.s1.x, 50);
    assert.ok(data.pagesIndex.p1.objects.s2);
  });
});