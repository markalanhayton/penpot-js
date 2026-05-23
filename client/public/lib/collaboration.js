/**
 * @module collaboration
 * @description Change broadcast and conflict resolution for real-time collaboration.
 *
 * Handles incoming WS file-change messages, applies remote edits,
 * broadcasts local edits via WS, and resolves revision conflicts
 * with lagged-change catch-up.
 *
 * Uses the undo/reapply pattern from the original Penpot ClojureScript:
 * when remote changes arrive while local changes are pending, the
 * local changes are undone, the remote changes applied, and the
 * local changes re-applied (transformed via OT where needed).
 */

import { cmd } from './rpc.js';
import { appStore } from './store.js';
import { onWSMessage, sendWS } from './ws.js';
import { getRevision, setRevision, initRevision } from './revision.js';
import { setCollaborationHandlers } from './persistence.js';
import { processChanges } from './process-changes.js';
import { applyWithUndoReapply } from './ot.js';

let currentFileId = null;
let currentProfileId = null;
let sessionId = null;
let remoteChangeQueue = [];
let processingQueue = false;
let conflictCount = 0;
const MAX_CONFLICT_RETRIES = 3;
const CHANGE_BATCH_WINDOW = 50;
let batchTimer = null;
let batchedChanges = [];

export function initCollaboration(fileId, profileId) {
  currentFileId = fileId;
  currentProfileId = profileId;
  sessionId = crypto.randomUUID();
  remoteChangeQueue = [];
  conflictCount = 0;

  appStore.set('currentSessionId', sessionId);

  setCollaborationHandlers({
    resolveConflict,
    fetchLaggedChanges,
    broadcastChange,
    broadcastChanges,
    getPendingChanges,
  });

  onWSMessage('file-change', handleRemoteFileChange);
  onWSMessage('library-change', handleRemoteLibraryChange);
}

export function getSessionId() {
  return sessionId;
}

export function broadcastChange(change) {
  if (!currentFileId || !sessionId) return;

  if (batchTimer) clearTimeout(batchTimer);
  batchedChanges.push(change);

  batchTimer = setTimeout(() => {
    const changes = batchedChanges.splice(0);
    batchTimer = null;

    sendWS('file-change', {
      'file-id': currentFileId,
      'session-id': sessionId,
      'profile-id': currentProfileId,
      revn: getRevision(),
      changes,
    });
  }, CHANGE_BATCH_WINDOW);
}

export function broadcastChanges(changes) {
  if (!currentFileId || !sessionId || changes.length === 0) return;

  sendWS('file-change', {
    'file-id': currentFileId,
    'session-id': sessionId,
    'profile-id': currentProfileId,
    revn: getRevision(),
    changes,
  });
}

export function handleRemoteFileChange(data) {
  const fileId = data.fileId || data['file-id'];
  if (fileId !== currentFileId) return;

  const senderProfileId = data.profileId || data['profile-id'];
  const senderSessionId = data.sessionId || data['session-id'];

  if (senderSessionId && senderSessionId === sessionId) return;

  const changes = data.changes || [];
  const revn = data.revn;

  appStore.dispatch('remote-file-change', {
    fileId,
    profileId: senderProfileId,
    revn,
    changes,
  });

  if (changes.length > 0) {
    remoteChangeQueue.push({ changes, revn, senderProfileId });
    processRemoteChangeQueue();
  }
}

export function handleRemoteLibraryChange(data) {
  const fileId = data.fileId || data['file-id'];

  appStore.dispatch('remote-library-change', {
    fileId,
    data,
  });
}

async function processRemoteChangeQueue() {
  if (processingQueue || remoteChangeQueue.length === 0) return;
  processingQueue = true;

  try {
    while (remoteChangeQueue.length > 0) {
      const { changes, revn, senderProfileId } = remoteChangeQueue.shift();
      await applyRemoteChanges(changes, revn, senderProfileId);
    }
  } finally {
    processingQueue = false;
  }
}

async function applyRemoteChanges(changes, remoteRevn, senderProfileId) {
  const pages = appStore.get('pages');
  if (!pages) return;

  const localRevn = getRevision();

  if (remoteRevn != null && remoteRevn < localRevn) return;

  if (remoteRevn != null && remoteRevn > localRevn + 1) {
    const laggedChanges = await fetchLaggedChanges(currentFileId, localRevn);
    if (laggedChanges.length > 0) {
      const allLaggedOps = laggedChanges.flatMap(c => c.changes || []);
      const maxLaggedRevn = Math.max(...laggedChanges.map(c => c.revn || 0));
      applyRemoteChangesToPages(pages, allLaggedOps);
      setRevision(maxLaggedRevn);
      appStore.set('currentFileRev', maxLaggedRevn);

      appStore.dispatch('remote-changes-applied', { changes: allLaggedOps, revn: maxLaggedRevn, senderProfileId });

      if (remoteRevn <= maxLaggedRevn) {
        appStore.set('pages', [...pages]);
        return;
      }
    }
  }

  const pendingChanges = getPendingChanges();
  applyRemoteChangesToPages(pages, changes, pendingChanges);

  if (remoteRevn != null && remoteRevn > localRevn) {
    setRevision(remoteRevn);
    appStore.set('currentFileRev', remoteRevn);
  }

  appStore.set('pages', [...pages]);

  appStore.dispatch('remote-changes-applied', {
    changes,
    revn: remoteRevn,
    senderProfileId,
  });
}

function applyRemoteChangesToPages(pages, changes, pendingChanges) {
  const fileData = buildFileDataFromPages(pages);

  const result = applyWithUndoReapply(fileData, changes, pendingChanges || []);

  syncPagesFromFileData(pages, fileData);

  if (result.adjustedPending && result.adjustedPending.length > 0) {
    updatePendingChanges(result.adjustedPending);
  }
}

function buildFileDataFromPages(pages) {
  const pagesIndex = {};
  for (const page of pages) {
    pagesIndex[page.id] = page;
  }
  return {
    pages: pages.map(p => p.id),
    pagesIndex,
    colors: appStore.get('colors') || [],
    media: appStore.get('media') || {},
    components: appStore.get('components') || {},
    typographies: appStore.get('typographies') || {},
  };
}

function syncPagesFromFileData(pages, fileData) {
  if (!fileData.pagesIndex) return;

  for (const pageId of fileData.pages) {
    const pageData = fileData.pagesIndex[pageId];
    if (!pageData) continue;

    const existingIdx = pages.findIndex(p => p.id === pageId);
    if (existingIdx >= 0) {
      pages[existingIdx] = pageData;
    } else {
      pages.push(pageData);
    }
  }

  const removeIdxs = [];
  for (let i = 0; i < pages.length; i++) {
    if (!fileData.pagesIndex[pages[i].id]) {
      removeIdxs.push(i);
    }
  }
  for (let i = removeIdxs.length - 1; i >= 0; i--) {
    pages.splice(removeIdxs[i], 1);
  }
}

export async function resolveConflict(fileId, localRevn) {
  conflictCount++;

  if (conflictCount > MAX_CONFLICT_RETRIES) {
    appStore.dispatch('conflict-unresolved', {
      fileId,
      attempts: conflictCount,
      message: 'Max conflict retries exceeded, forcing full refresh',
    });
  }

  try {
    const laggedChanges = await fetchLaggedChanges(fileId, localRevn);
    if (laggedChanges.length > 0) {
      const pages = appStore.get('pages');
      if (pages) {
        const allLaggedOps = laggedChanges.flatMap(c => c.changes || []);

        const fileData = buildFileDataFromPages(pages);
        const pendingChanges = getPendingChanges();
        applyWithUndoReapply(fileData, allLaggedOps, pendingChanges);
        syncPagesFromFileData(pages, fileData);

        const maxRevn = Math.max(...laggedChanges.map(c => c.revn || 0), localRevn);
        appStore.set('currentFileRev', maxRevn);
        setRevision(maxRevn);

        appStore.dispatch('conflict-resolved-lagged', {
          fileId,
          revn: maxRevn,
          changeCount: laggedChanges.length,
        });
        conflictCount = 0;
        return;
      }
    }

    const result = await cmd('get-file', { id: fileId });
    if (result) {
      const newRevn = result.revn || 0;
      const newVern = result.vern || 0;

      const pages = result.data?.pagesIndex
        ? Object.entries(result.data.pagesIndex).map(([id, p]) => ({ id, name: p.name, objects: p.objects || {} }))
        : result.pages || [];

      appStore.set('currentFile', result);
      appStore.set('pages', pages);
      appStore.set('currentFileRev', newRevn);
      initRevision(newRevn, newVern);

      appStore.dispatch('conflict-resolved', { fileId, revn: newRevn });
      conflictCount = 0;
    }
  } catch (err) {
    console.error('[collaboration] conflict resolution failed:', err);
    appStore.dispatch('conflict-failed', { fileId, error: err.message });
  }
}

export async function fetchLaggedChanges(fileId, sinceRevn) {
  try {
    const result = await cmd('get-file-changes', { id: fileId, since: sinceRevn });
    return result?.changes || [];
  } catch {
    try {
      const result = await cmd('get-file', { id: fileId });
      if (result?.data?.changes) return result.data.changes;
    } catch {}
    return [];
  }
}

export function getPendingChanges() {
  const persistence = appStore.get('_persistenceState');
  if (!persistence) return [];
  const pending = persistence.pendingChanges || [];
  const normalized = [];
  for (const change of pending) {
    normalized.push(normalizeChange(change));
  }
  return normalized;
}

function updatePendingChanges(adjusted) {
  const persistence = appStore.get('_persistenceState');
  if (!persistence) return;
  persistence.pendingChanges = adjusted;
}

function normalizeChange(change) {
  if (!change) return change;
  if (change.type === 'add-obj' || change.type === 'mod-obj' || change.type === 'del-obj' || change.type === 'mov-objects') {
    return change;
  }
  const pageId = change.pageId || change.page_id;
  const objId = change.obj_id || change.objId;
  const operations = change.operations || [];

  if (change.type && pageId && objId) {
    const normalized = { type: change.type, id: objId, pageId };
    if (operations.length > 0) normalized.operations = operations;
    if (change.obj) normalized.obj = change.obj;
    if (change.componentId || change.component_id) {
      normalized.componentId = change.componentId || change.component_id;
    }
    return normalized;
  }

  return change;
}

export function getConflictCount() {
  return conflictCount;
}

export function destroyCollaboration() {
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  batchedChanges = [];
  remoteChangeQueue = [];
  processingQueue = false;
  currentFileId = null;
  currentProfileId = null;
  sessionId = null;
}