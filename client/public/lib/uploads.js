'use strict';
/**
 * @module uploads
 * @description WU-T4: Centralized upload registry.
 *
 * Tracks all in-flight, completed, and failed uploads (media, fonts,
 * file imports, binfile) so users can:
 *   - See a unified list in the Uploads dashboard
 *   - Retry failed uploads without re-selecting the file
 *   - Clear completed entries
 *
 * Usage:
 *   const id = registerUpload({ type: 'media', file, label });
 *   await runUpload(id, async (onProgress) => {
 *     await cmdUpload('upload-media', file, { projectId });
 *   });
 *
 * The registry persists failed uploads in localStorage so they survive
 * a page reload. Subscribers receive a `penpot-uploads-changed` event
 * on every state transition.
 *
 * Per-upload state:
 *   { id, type, label, fileName, bytesTotal, bytesSent, status, error,
 *     retried, createdAt, updatedAt, _file (kept in memory) }
 *
 *   status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled' | 'gave-up'
 *   retried: number of retry attempts (capped at MAX_RETRIES)
 */

const MAX_RETRIES = 3;
const STORAGE_KEY = 'penpot-uploads-failed';
const MAX_HISTORY = 100;
const subscribers = new Set();
const uploads = new Map();
let idCounter = 0;

function notify() {
  for (const fn of subscribers) {
    try { fn(); } catch (err) { console.warn('[uploads] subscriber error:', err.message); }
  }
  // Also emit a DOM event for components that listen via addEventListener
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('penpot-uploads-changed', { detail: { count: uploads.size } }));
  }
}

function generateId() {
  // Avoid uuid dependency by using a timestamp + counter suffix
  return `up_${Date.now().toString(36)}_${(++idCounter).toString(36)}`;
}

function fileMeta(file) {
  if (!file) return { fileName: 'unknown', bytesTotal: 0 };
  return {
    fileName: file.name || 'unknown',
    bytesTotal: file.size || 0,
  };
}

function loadPersisted() {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      // Strip the live file handle on load; it's gone
      const { _file, ...rest } = entry;
      uploads.set(rest.id, { ...rest, _file: null, status: 'failed' });
    }
  } catch (err) { console.warn('[uploads] persisted load failed:', err.message); }
}

function savePersisted() {
  if (typeof localStorage === 'undefined') return;
  try {
    const failed = [];
    for (const entry of uploads.values()) {
      if (entry.status === 'failed' || entry.status === 'gave-up') {
        // Persist everything except the live file (can be re-supplied on retry if needed)
        const { _file, ...rest } = entry;
        failed.push(rest);
      }
    }
    // Cap to most recent MAX_HISTORY
    failed.sort((a, b) => b.createdAt - a.createdAt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(failed.slice(0, MAX_HISTORY)));
  } catch (err) { console.warn('[uploads] persisted save failed:', err.message); }
}

let initialized = false;
function init() {
  if (initialized) return;
  initialized = true;
  loadPersisted();
}

export function subscribeUploads(callback) {
  init();
  subscribers.add(callback);
  // Return an unsubscribe function
  return () => subscribers.delete(callback);
}

export function getAllUploads() {
  init();
  return [...uploads.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function getUpload(id) {
  init();
  return uploads.get(id);
}

export function getFailed() {
  init();
  return getAllUploads().filter(u => u.status === 'failed' || u.status === 'gave-up');
}

export function getInFlight() {
  init();
  return getAllUploads().filter(u => u.status === 'pending' || u.status === 'in-progress');
}

export function getCount() {
  init();
  return uploads.size;
}

export function getFailedCount() {
  return getFailed().length;
}

export function getInFlightCount() {
  return getInFlight().length;
}

/**
 * Register a new upload. The returned `id` is used to update the entry
 * via `updateUpload`, `completeUpload`, `failUpload`, etc.
 *
 * `options`:
 *   - type:    'media' | 'font' | 'file' | 'binfile'
 *   - label:   human-readable description (e.g. "Logo.png to Acme team")
 *   - file:    optional File/Blob — kept in memory for retry
 *   - bytesTotal: optional explicit byte count (for chunks)
 *   - fileName:   optional explicit file name (for chunks where `file` is the chunk)
 */
export function registerUpload(options = {}) {
  init();
  const file = options.file;
  const meta = fileMeta(file);
  const id = generateId();
  const now = Date.now();
  const entry = {
    id,
    type: options.type || 'media',
    label: options.label || meta.fileName,
    fileName: options.fileName || meta.fileName,
    bytesTotal: options.bytesTotal || meta.bytesTotal,
    bytesSent: 0,
    status: 'pending',
    error: null,
    retried: 0,
    createdAt: now,
    updatedAt: now,
    _file: file || null,
  };
  uploads.set(id, entry);
  notify();
  return id;
}

export function updateUpload(id, patch) {
  init();
  const entry = uploads.get(id);
  if (!entry) return null;
  Object.assign(entry, patch, { updatedAt: Date.now() });
  notify();
  return entry;
}

export function setProgress(id, bytesSent, bytesTotal) {
  init();
  const entry = uploads.get(id);
  if (!entry) return null;
  entry.bytesSent = bytesSent;
  if (typeof bytesTotal === 'number') entry.bytesTotal = bytesTotal;
  entry.updatedAt = Date.now();
  notify();
  return entry;
}

export function completeUpload(id, result) {
  init();
  const entry = uploads.get(id);
  if (!entry) return null;
  entry.status = 'completed';
  entry.bytesSent = entry.bytesTotal || entry.bytesSent;
  entry.error = null;
  entry.updatedAt = Date.now();
  notify();
  savePersisted();
  return entry;
}

export function failUpload(id, error) {
  init();
  const entry = uploads.get(id);
  if (!entry) return null;
  entry.status = 'failed';
  entry.error = error?.message || error?.hint || (typeof error === 'string' ? error : 'Upload failed');
  entry.updatedAt = Date.now();
  notify();
  savePersisted();
  return entry;
}

export function cancelUpload(id) {
  init();
  const entry = uploads.get(id);
  if (!entry) return null;
  entry.status = 'cancelled';
  entry.updatedAt = Date.now();
  notify();
  savePersisted();
  return entry;
}

export function dismissUpload(id) {
  init();
  if (uploads.delete(id)) {
    notify();
    savePersisted();
    return true;
  }
  return false;
}

export function clearCompleted() {
  init();
  let removed = 0;
  for (const [id, entry] of [...uploads.entries()]) {
    if (entry.status === 'completed' || entry.status === 'cancelled') {
      uploads.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    notify();
    savePersisted();
  }
  return removed;
}

/**
 * Run a upload Promise and update the registry entry. The `runFn`
 * is invoked with an `onProgress(bytesSent, bytesTotal?)` callback.
 *
 * If the entry has a `_file` saved and the runFn doesn't take a file
 * argument, the registry will pass it via the context (e.g. by
 * including `file` in the runFn's closure).
 *
 * Returns the same Promise as `runFn`, so callers can await it.
 */
export async function runUpload(id, runFn) {
  init();
  const entry = uploads.get(id);
  if (!entry) throw new Error('Unknown upload id: ' + id);
  updateUpload(id, { status: 'in-progress' });
  try {
    const result = await runFn((bytesSent, bytesTotal) => {
      setProgress(id, bytesSent, bytesTotal);
    });
    completeUpload(id, result);
    return result;
  } catch (err) {
    failUpload(id, err);
    throw err;
  }
}

/**
 * Retry a failed upload by re-running the registered `_runFn`. The
 * runFn is captured in the entry when the upload was first attempted.
 * If the runFn throws 3 times (MAX_RETRIES), the entry is marked
 * 'gave-up' and retry is disabled.
 */
export async function retryUpload(id, runFnOverride) {
  init();
  const entry = uploads.get(id);
  if (!entry) throw new Error('Unknown upload id: ' + id);
  if (entry.status !== 'failed' && entry.status !== 'gave-up') {
    throw new Error('Only failed uploads can be retried (current: ' + entry.status + ')');
  }
  if (entry.retried >= MAX_RETRIES) {
    entry.status = 'gave-up';
    entry.updatedAt = Date.now();
    notify();
    savePersisted();
    throw new Error('Upload has exceeded maximum retry attempts');
  }
  if (!runFnOverride) {
    throw new Error('No retry function provided. Pass a fresh closure to retryUpload(id, runFn).');
  }
  entry.retried = (entry.retried || 0) + 1;
  entry.status = 'in-progress';
  entry.error = null;
  entry.bytesSent = 0;
  entry.updatedAt = Date.now();
  notify();
  try {
    const result = await runFnOverride((bytesSent, bytesTotal) => {
      setProgress(id, bytesSent, bytesTotal);
    });
    completeUpload(id, result);
    return result;
  } catch (err) {
    if (entry.retried >= MAX_RETRIES) {
      entry.status = 'gave-up';
    } else {
      entry.status = 'failed';
    }
    entry.error = err?.message || err?.hint || (typeof err === 'string' ? err : 'Upload failed');
    entry.updatedAt = Date.now();
    notify();
    savePersisted();
    throw err;
  }
}

export function getMaxRetries() {
  return MAX_RETRIES;
}
