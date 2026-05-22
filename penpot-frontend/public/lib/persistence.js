/**
 * @module persistence
 * @description Batches local shape changes and persists them to the server
 * via the `update-file` RPC command. Debounces writes and handles revision conflicts.
 *
 * Port of app.main.data.persistence (ClojureScript) to pure ES JS.
 */

import { cmd } from './rpc.js';
import { appStore } from './store.js';

const DEBOUNCE_MS = 2000;
const MAX_RETRIES = 3;

let pendingChanges = [];
let fileRev = 0;
let fileVern = 0;
let fileId = null;
let saveTimer = null;
let saving = false;

export function initPersistence(id, revn, vern) {
  fileId = id;
  fileRev = revn || 0;
  fileVern = vern || 0;
  pendingChanges = [];
  saving = false;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

export function getRevision() { return fileRev; }

export function enqueueChange(change) {
  change.revn = fileRev;
  change.created_at = new Date().toISOString();
  pendingChanges.push(change);
  scheduleSave();
}

export function enqueueChanges(changes) {
  for (const change of changes) {
    change.revn = fileRev;
    change.created_at = new Date().toISOString();
    pendingChanges.push(change);
  }
  scheduleSave();
}

/**
 * Create a change object from a local shape mutation.
 * These mirror the ClojureScript change format used by `update-file`.
 */
export function makeCreateChange(pageId, shape) {
  return {
    type: 'add-obj',
    page_id: pageId,
    obj_id: shape.id,
    operations: [
      { type: 'add-obj', id: shape.id, obj: shapeToTransit(shape) },
    ],
  };
}

export function makeModifyChange(pageId, shapeId, kvs) {
  const ops = [];
  for (const [attr, value] of Object.entries(kvs)) {
    ops.push({ type: 'set-obj', id: shapeId, attr, val: value });
  }
  return {
    type: 'mod-obj',
    page_id: pageId,
    obj_id: shapeId,
    operations: ops,
  };
}

export function makeDeleteChange(pageId, shapeId) {
  return {
    type: 'del-obj',
    page_id: pageId,
    obj_id: shapeId,
    operations: [
      { type: 'del-obj', id: shapeId },
    ],
  };
}

export function makeMoveChange(pageId, shapeId, fromIdx, toIdx) {
  return {
    type: 'mov-obj',
    page_id: pageId,
    obj_id: shapeId,
    operations: [
      { type: 'mov-obj', id: shapeId, from_idx: fromIdx, to_idx: toIdx },
    ],
  };
}

function shapeToTransit(shape) {
  const obj = { ...shape };
  delete obj.$$typeof;
  return obj;
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => flushSave(), DEBOUNCE_MS);
}

export async function flushSave() {
  if (!fileId || pendingChanges.length === 0 || saving) return;

  saving = true;

  const changes = pendingChanges.splice(0);
  pendingChanges = [];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await cmd('update-file', {
        id: fileId,
        revn: fileRev,
        vern: fileVern,
        session_id: crypto.randomUUID(),
        changes,
      });

      if (Array.isArray(result)) {
        for (const entry of result) {
          if (entry.revn != null && entry.revn > fileRev) {
            fileRev = entry.revn;
            appStore.set('currentFileRev', fileRev);
          }
        }
      } else if (result && result.revn != null) {
        fileRev = result.revn;
        appStore.set('currentFileRev', fileRev);
      }

      saving = false;
      if (pendingChanges.length > 0) {
        scheduleSave();
      }
      return;
    } catch (err) {
      if (err.code === 'revn-conflict' || err.code === 'vern-conflict') {
        fileRev++;
        try {
          const freshFile = await cmd('get-file', { id: fileId });
          if (freshFile) {
            appStore.set('currentFile', freshFile);
            appStore.dispatch('file-conflict-resolved', freshFile);
          }
        } catch {}
        console.warn('[persistence] Revision conflict, local changes may be lost');
        saving = false;
        return;
      }
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      console.error('[persistence] Failed to save after retries:', err);
      pendingChanges.unshift(...changes);
      saving = false;
      return;
    }
  }

  saving = false;
}

export function destroyPersistence() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  flushSave();
  pendingChanges = [];
  fileId = null;
}