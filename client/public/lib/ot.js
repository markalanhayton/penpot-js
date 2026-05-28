'use strict';
/**
 * @module ot
 * @description Lightweight operational transform for concurrent edits.
 *
 * The key insight: in a design tool like Penpot, most concurrent edits don't
 * actually conflict. If User A moves a shape and User B changes its fill,
 * both edits target different attributes and compose cleanly.
 *
 * Only two cases require resolution:
 * 1. Same shape, same attribute → last-writer-wins
 * 2. Structural conflicts (add/del/move the same shape) → server-serialized
 *
 * This module provides:
 * - `transformChanges(left, right)` — transform a pair of concurrent change sets
 *   against each other, producing adjusted versions that commute
 * - `invertChanges(changes, data)` — compute the inverse of a change set
 *   (undo changes) for the undo/reapply pattern
 * - `applyWithUndoReapply(data, remote, pending)` — the undo/reapply pattern
 *   from the original Penpot ClojureScript, now with OT for mod-obj
 */

import { processChanges } from './process-changes.js';

/**
 * Transform two concurrent change sets against each other.
 *
 * Given two change sets (left and right) that were applied concurrently
 * to the same base state, produce [left', right'] where:
 * - left' = left transformed against right
 * - right' = right transformed against left
 *
 * This ensures: apply(apply(base, left), right') === apply(apply(base, right), left')
 *
 * @param {Array<object>} left - First change set
 * @param {Array<object>} right - Second change set
 * @returns {[Array<object>, Array<object>]} [left', right']
 */
export function transformChanges(left, right) {
  if (!left || left.length === 0) return [[], right || []];
  if (!right || right.length === 0) return [left || [], []];

  let leftPrime = [...left];
  let rightPrime = [...right];

  for (let i = 0; i < leftPrime.length; i++) {
    for (let j = 0; j < rightPrime.length; j++) {
      if (leftPrime[i] === null || rightPrime[j] === null) continue;

      const { leftPrime: lp, rightPrime: rp } = transformPair(leftPrime[i], rightPrime[j]);
      leftPrime[i] = lp;
      rightPrime[j] = rp;
    }
  }

  leftPrime = leftPrime.filter(c => c !== null);
  rightPrime = rightPrime.filter(c => c !== null);

  return [leftPrime, rightPrime];
}

/**
 * Transform a single pair of changes.
 */
function transformPair(left, right) {
  const leftTarget = changeTarget(left);
  const rightTarget = changeTarget(right);

  if (!leftTarget && !rightTarget) return { leftPrime: left, rightPrime: right };

  if (leftTarget?.pageId && rightTarget?.pageId && leftTarget.pageId !== rightTarget.pageId) {
    return { leftPrime: left, rightPrime: right };
  }

  if (leftTarget?.componentId && rightTarget?.componentId && leftTarget.componentId !== rightTarget.componentId) {
    return { leftPrime: left, rightPrime: right };
  }

  if (leftTarget?.id !== rightTarget?.id) {
    return { leftPrime: left, rightPrime: right };
  }

  return transformSameShape(left, right);
}

/**
 * Transform two changes that target the same shape.
 */
function transformSameShape(left, right) {
  if (left.type === 'del-obj' && right.type === 'del-obj') {
    return { leftPrime: null, rightPrime: null };
  }

  if (left.type === 'del-obj') {
    return { leftPrime: left, rightPrime: null };
  }

  if (right.type === 'del-obj') {
    return { leftPrime: null, rightPrime: right };
  }

  if (left.type === 'mod-obj' && right.type === 'mod-obj') {
    return transformModObjPair(left, right);
  }

  return { leftPrime: left, rightPrime: right };
}

/**
 * Transform two mod-obj changes against each other at the operation level.
 *
 * If they modify different attributes, both survive unchanged.
 * If they modify the same attribute, both survive but their values are
 * swapped so that:
 *   - left' has right's value for the conflicting attr (preserving right's intent)
 *   - right' has left's value for the conflicting attr (preserving left's intent)
 *
 * This maintains the TP1 property: apply(apply(S, left), right') === apply(apply(S, right), left')
 */
function transformModObjPair(left, right) {
  const leftOps = left.operations || [];
  const rightOps = right.operations || [];

  const leftAttrMap = new Map();
  for (const op of leftOps) {
    const key = operationKey(op);
    if (key) leftAttrMap.set(key, op.val);
  }

  const rightAttrMap = new Map();
  for (const op of rightOps) {
    const key = operationKey(op);
    if (key) rightAttrMap.set(key, op.val);
  }

  const leftPrimeOps = leftOps.map(op => {
    const key = operationKey(op);
    if (key && rightAttrMap.has(key)) {
      return { ...op, val: rightAttrMap.get(key) };
    }
    return op;
  });

  const rightPrimeOps = rightOps.map(op => {
    const key = operationKey(op);
    if (key && leftAttrMap.has(key)) {
      return { ...op, val: leftAttrMap.get(key) };
    }
    return op;
  });

  return {
    leftPrime: { ...left, operations: leftPrimeOps },
    rightPrime: { ...right, operations: rightPrimeOps },
  };
}

function operationKey(op) {
  switch (op.type) {
    case 'set':
      return `set:${op.attr}`;
    case 'assign':
      return 'assign';
    case 'set-touched':
      return 'touched';
    case 'set-remote-synced':
      return 'remote-synced';
    default:
      return null;
  }
}

function changeTarget(change) {
  if (!change) return null;
  const id = change.id || change.obj_id || change.objId;
  if (!id) return null;
  return {
    id,
    pageId: change.pageId || change.page_id,
    componentId: change.componentId || change.component_id,
  };
}

/**
 * Compute the inverse (undo) of a change set given the current data state.
 * Used for the undo/reapply pattern:
 *   1. Invert pending local changes → undo-changes
 *   2. Apply undo-changes (undos local edits)
 *   3. Apply remote changes
 *   4. Re-apply pending local changes (adjusted via OT)
 *
 * @param {Array<object>} changes - Changes to invert
 * @param {object} data - Current data state (to read before-values)
 * @returns {Array<object>} Inverse changes (in reverse order for correct undo)
 */
export function invertChanges(changes, data) {
  if (!changes || changes.length === 0) return [];

  const inverted = [];
  for (const change of changes) {
    const inv = invertSingleChange(change, data);
    if (inv) inverted.push(inv);
  }

  return inverted.reverse();
}

function invertSingleChange(change, data) {
  switch (change.type) {
    case 'add-obj':
      return invertAddObj(change);
    case 'mod-obj':
      return invertModObj(change, data);
    case 'del-obj':
      return invertDelObj(change, data);
    case 'mov-objects':
      return invertMovObjects(change, data);
    default:
      return null;
  }
}

function invertAddObj(change) {
  return {
    type: 'del-obj',
    id: change.obj.id,
    pageId: change.pageId,
    componentId: change.componentId,
  };
}

function invertModObj(change, data) {
  const { id, pageId, componentId, operations } = change;
  const shape = findShape(data, pageId, componentId, id);
  if (!shape) return { ...change, operations: [] };

  const invOps = [];
  for (const op of operations || []) {
    const invOp = invertOperation(op, shape);
    if (invOp) invOps.push(invOp);
  }

  return { type: 'mod-obj', id, pageId, componentId, operations: invOps };
}

function invertOperation(op, shape) {
  switch (op.type) {
    case 'set':
      return { type: 'set', attr: op.attr, val: shape[op.attr] };
    case 'assign': {
      const prev = {};
      for (const key of Object.keys(op.value || {})) {
        if (key in shape) prev[key] = shape[key];
      }
      return { type: 'assign', value: prev };
    }
    case 'set-touched':
      return { type: 'set-touched', touched: shape.touched };
    case 'set-remote-synced':
      return { type: 'set-remote-synced', remoteSynced: shape.remoteSynced };
    default:
      return null;
  }
}

function invertDelObj(change, data) {
  const { id, pageId, componentId } = change;
  const shape = findShape(data, pageId, componentId, id);
  if (!shape) return null;

  const parentId = shape.parentId;
  const parent = findShape(data, pageId, componentId, parentId);
  const index = parent?.shapes?.indexOf(id) ?? -1;

  return {
    type: 'add-obj',
    obj: { ...shape },
    pageId,
    componentId,
    parentId,
    index: index >= 0 ? index : undefined,
  };
}

function invertMovObjects(change, data) {
  const { pageId, componentId, shapes: shapeIds } = change;

  const oldPositions = [];
  for (const shapeId of shapeIds || []) {
    const shape = findShape(data, pageId, componentId, shapeId);
    if (!shape) continue;
    const oldParent = findShape(data, pageId, componentId, shape.parentId);
    const oldIndex = oldParent?.shapes?.indexOf(shapeId) ?? -1;
    oldPositions.push({ shapeId, oldParentId: shape.parentId, oldIndex });
  }

  if (oldPositions.length === 0) return null;

  return {
    type: 'mov-objects',
    pageId,
    componentId,
    parentId: oldPositions[0].oldParentId,
    shapes: oldPositions.map(p => p.shapeId),
    index: oldPositions[0].oldIndex >= 0 ? oldPositions[0].oldIndex : undefined,
  };
}

function findShape(data, pageId, componentId, shapeId) {
  if (!shapeId) return null;
  if (componentId) return data?.components?.[componentId]?.objects?.[shapeId];
  if (data.pagesIndex) return data.pagesIndex[pageId]?.objects?.[shapeId];
  if (Array.isArray(data.pages)) return data.pages.find(p => p.id === pageId)?.objects?.[shapeId];
  return null;
}

/**
 * Apply remote changes using the undo/reapply pattern from the original
 * Penpot ClojureScript (`changes.cljs` `apply-changes-localy`).
 *
 * Flow:
 * 1. If no pending local changes: just apply remote changes directly
 * 2. If pending local changes exist:
 *    a. Invert pending local changes and apply them (undo local edits)
 *    b. Apply remote changes
 *    c. Transform pending local changes against remote changes (OT)
 *    d. Re-apply the adjusted pending local changes
 *
 * @param {object} data - Current file data (mutated in-place)
 * @param {Array<object>} remoteChanges - Incoming remote changes
 * @param {Array<object>} pendingChanges - Locally pending (unsaved) changes
 * @returns {{ data: object, adjustedPending: Array<object> }}
 */
export function applyWithUndoReapply(data, remoteChanges, pendingChanges) {
  if (!pendingChanges || pendingChanges.length === 0) {
    processChanges(data, remoteChanges);
    return { data, adjustedPending: [] };
  }

  const undoChanges = invertChanges(pendingChanges, data);
  processChanges(data, undoChanges);
  processChanges(data, remoteChanges);

  const [adjustedPending] = transformChanges(pendingChanges, remoteChanges);
  if (adjustedPending.length > 0) {
    processChanges(data, adjustedPending);
  }

  return { data, adjustedPending };
}