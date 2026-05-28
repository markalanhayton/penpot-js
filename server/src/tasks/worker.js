'use strict';
/**
 * @module tasks/worker
 * @description Task queue and worker system — mirrors `app.worker` from the Clojure backend.
 *
 * Provides a database-backed task queue with:
 * - Task submission from RPC handlers
 * - Concurrent task execution with configurable parallelism
 * - Exponential backoff retry on failure
 * - Task status tracking (new, running, completed, failed)
 * - Periodic cleanup of completed tasks
 *
 * ### Architecture
 *
 * ```
 * RPC Handler → submitTask(type, params) → task table
 *                                                  ↓
 *                              Worker loop polls for tasks → execute handler
 *                                                    ↓
 *                              Mark completed / increment retry on failure
 * ```
 *
 * ### Adding a new task type
 *
 * 1. Define a handler function in `handlers` below.
 * 2. Register it with `registerHandler(type, fn)`.
 * 3. Submit it from an RPC handler with `submitTask(type, params, pool)`.
 *
 * @example
 * import { submitTask, registerHandler } from './worker.js';
 * registerHandler('delete-object', async (params, pool) => { ... });
 * submitTask('delete-object', { objectType: 'file', id: fileId }, pool);
 */

import { config } from '../config/index.js';
import { tasksTiming } from '../metrics/index.js';

/** @type {Map<string, TaskHandler>} Registered task type handlers. */
const handlers = new Map();

/** @type {boolean} Whether the worker loop is currently running. */
let running = false;

/** @type {ReturnType<typeof setInterval>|null} The polling interval handle. */
let pollInterval = null;

/** @type {number} Maximum concurrent tasks being processed. */
const MAX_CONCURRENCY = parseInt(process.env.PENPOT_WORKER_CONCURRENCY || '4', 10);

/** @type {number} Polling interval in milliseconds. */
const POLL_INTERVAL_MS = parseInt(process.env.PENPOT_WORKER_POLL_INTERVAL || '2000', 10);

/** @type {number} Maximum retry count before marking a task as permanently failed. */
const MAX_RETRIES = parseInt(process.env.PENPOT_WORKER_MAX_RETRIES || '3', 10);

/** @type {number} Base delay for exponential backoff (milliseconds). */
const RETRY_BASE_DELAY_MS = parseInt(process.env.PENPOT_WORKER_RETRY_DELAY || '5000', 10);

/**
 * @typedef {function(object, import('../db/sqlite.js').DatabasePool): Promise<void>} TaskHandler
 * A function that processes a task of a given type.
 *
 * @param {object} params - Task parameters (deserialized from JSON).
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @returns {Promise<void>}
 */

/**
 * Register a task handler for a given type.
 *
 * @param {string} type - Task type identifier (e.g. `'delete-object'`, `'offload-file-data'`).
 * @param {TaskHandler} handler - The handler function.
 */
export function registerHandler(type, handler) {
  handlers.set(type, handler);
}

/**
 * Submit a task to the task queue.
 *
 * @param {string} type - Task type identifier.
 * @param {object} params - Task parameters (will be JSON-serialized).
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {{ maxRetries?: number, label?: string, priority?: number }} [opts] - Task options.
 * @returns {string} The task UUID.
 */
export function submitTask(type, params, pool, opts = {}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  pool.insertOnConflictDoNothing('task', {
    id,
    type,
    state: 'new',
    params: JSON.stringify(params),
    max_retries: opts.maxRetries ?? MAX_RETRIES,
    label: opts.label || null,
    priority: opts.priority ?? 0,
    created_at: now,
    modified_at: now,
  });

  return id;
}

/**
 * Start the worker polling loop.
 *
 * Polls the `task` table for tasks in `new` or `retry` state and executes
 * them up to `MAX_CONCURRENCY` in parallel.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 */
export function startWorker(pool) {
  if (running) return;
  running = true;

  console.log('[worker] Starting task worker');
  pollInterval = setInterval(() => pollAndExecute(pool), POLL_INTERVAL_MS);

  // Also poll immediately
  setTimeout(() => pollAndExecute(pool), 100);
}

/**
 * Stop the worker loop.
 */
export function stopWorker() {
  running = false;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  console.log('[worker] Task worker stopped');
}

/**
 * Poll the task table for pending tasks and execute them.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 */
async function pollAndExecute(pool) {
  const pending = pool.query(
    `SELECT * FROM task WHERE state IN ('new', 'retry') AND (scheduled_at IS NULL OR scheduled_at <= ?)
     ORDER BY priority DESC, created_at ASC LIMIT ?`,
    [new Date().toISOString(), MAX_CONCURRENCY * 2]
  );

  const executing = [];

  for (const task of pending) {
    if (executing.length >= MAX_CONCURRENCY) break;

    const handler = handlers.get(task.type);
    if (!handler) {
      console.warn(`[worker] No handler for task type: ${task.type}`);
      pool.run("UPDATE task SET state = 'failed', modified_at = ? WHERE id = ?", [new Date().toISOString(), task.id]);
      continue;
    }

    // Mark as running
    pool.run("UPDATE task SET state = 'running', modified_at = ? WHERE id = ?", [new Date().toISOString(), task.id]);

    const promise = executeTask(task, handler, pool);
    executing.push(promise);
  }

  if (executing.length > 0) {
    await Promise.allSettled(executing);
  }
}

/**
 * Execute a single task with retry backoff on failure.
 *
 * @param {object} task - The task row from the database.
 * @param {TaskHandler} handler - The registered handler for this task type.
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 */
async function executeTask(task, handler, pool) {
  const startTime = Date.now();
  try {
    const params = typeof task.params === 'string' ? JSON.parse(task.params) : (task.params || {});
    await handler(params, pool);
    pool.run("UPDATE task SET state = 'completed', modified_at = ? WHERE id = ?", [new Date().toISOString(), task.id]);
    tasksTiming.labels(task.type).observe(Date.now() - startTime);
  } catch (err) {
    console.error(`[worker] Task ${task.id} (${task.type}) failed:`, err.message);

    const retryCount = (task.retry_num || 0) + 1;
    const maxRetries = task.max_retries || MAX_RETRIES;

    if (retryCount >= maxRetries) {
      pool.run("UPDATE task SET state = 'failed', modified_at = ?, error = ? WHERE id = ?", [
        new Date().toISOString(),
        err.message?.substring(0, 500) || 'Unknown error',
        task.id,
      ]);
    } else {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount - 1);
      const scheduledAt = new Date(Date.now() + delay).toISOString();

      pool.run(`UPDATE task SET state = 'retry', retry_num = ?, scheduled_at = ?, modified_at = ? WHERE id = ?`, [
        retryCount, scheduledAt, new Date().toISOString(), task.id,
      ]);
    }
  }
}

// --- Built-in task handlers ---

/**
 * Delete-object task handler — cascading deletion of entities and their
 * associated storage objects, files, media, thumbnails, etc.
 */
registerHandler('delete-object', async (params, pool) => {
  const { objectType, id } = params;

  switch (objectType) {
    case 'file': {
      const mediaObjects = pool.query('SELECT media_id FROM file_media_object WHERE file_id = ? AND deleted_at IS NULL', [id]);
      for (const mo of mediaObjects) {
        if (mo.media_id) pool.run("UPDATE storage_object SET deleted_at = ? WHERE id = ?", [new Date().toISOString(), mo.media_id]);
      }
      pool.run("UPDATE file_thumbnail SET deleted_at = ? WHERE file_id = ?", [new Date().toISOString(), id]);
      pool.run("UPDATE file_tagged_object_thumbnail SET deleted_at = ? WHERE file_id = ?", [new Date().toISOString(), id]);
      pool.run("UPDATE file_data SET deleted_at = ? WHERE file_id = ?", [new Date().toISOString(), id]);
      pool.run("UPDATE file_change SET deleted_at = ? WHERE file_id = ?", [new Date().toISOString(), id]);
      pool.run("UPDATE file_media_object SET deleted_at = ? WHERE file_id = ?", [new Date().toISOString(), id]);
      pool.run("UPDATE file SET deleted_at = ? WHERE id = ?", [new Date().toISOString(), id]);
      break;
    }
    case 'project': {
      const files = pool.query('SELECT id FROM file WHERE project_id = ? AND deleted_at IS NULL', [id]);
      for (const file of files) {
        submitTask('delete-object', { objectType: 'file', id: file.id }, pool);
      }
      pool.run("UPDATE project SET deleted_at = ? WHERE id = ?", [new Date().toISOString(), id]);
      break;
    }
    case 'team': {
      const projects = pool.query('SELECT id FROM project WHERE team_id = ? AND deleted_at IS NULL', [id]);
      for (const project of projects) {
        submitTask('delete-object', { objectType: 'project', id: project.id }, pool);
      }
      pool.run("UPDATE team SET deleted_at = ? WHERE id = ?", [new Date().toISOString(), id]);
      break;
    }
    case 'profile': {
      const teams = pool.query(
        `SELECT t.id FROM team t JOIN team_profile_rel tpr ON tpr.team_id = t.id
         WHERE tpr.profile_id = ? AND t.is_owner = '1' AND t.deleted_at IS NULL`,
        [id]
      );
      for (const team of teams) {
        submitTask('delete-object', { objectType: 'team', id: team.id }, pool);
      }
      pool.run("DELETE FROM team_profile_rel WHERE profile_id = ?", [id]);
      pool.run("DELETE FROM project_profile_rel WHERE profile_id = ?", [id]);
      pool.run("DELETE FROM file_profile_rel WHERE profile_id = ?", [id]);
      pool.run("UPDATE profile SET deleted_at = ? WHERE id = ?", [new Date().toISOString(), id]);
      break;
    }
    default:
      console.warn(`[worker] Unknown delete-object type: ${objectType}`);
  }
});

/**
 * Offload-file-data task handler — moves file data from database to storage backend.
 * Reads file_data rows with backend='db' and writes them to the storage filesystem,
 * then updates the row to backend='storage' with a metadata reference.
 */
registerHandler('offload-file-data', async (params, pool) => {
  const { fileId } = params;
  if (!fileId) return;

  // Use the unified storage interface — dispatches to FS or S3 based on config
  const { putStorageObjectAny } = await import('../storage/s3.js');

  const rows = pool.query(
    "SELECT * FROM file_data WHERE file_id = ? AND backend = 'db' AND deleted_at IS NULL",
    [fileId]
  );

  for (const row of rows) {
    if (!row.data) continue;

    try {
      const storageObj = await putStorageObjectAny(pool, row.data, {
        contentType: 'application/octet-stream',
        bucket: 'file-data',
        size: row.data.length,
      });

      const metadata = JSON.stringify({ 'storage-ref-id': storageObj.id });
      pool.run(
        "UPDATE file_data SET backend = 'storage', metadata = ?, data = NULL, modified_at = ? WHERE file_id = ? AND id = ?",
        [metadata, new Date().toISOString(), row.file_id, row.id]
      );
    } catch (err) {
      console.error(`[worker] offload-file-data failed for file ${fileId}, row ${row.id}:`, err.message);
    }
  }
});

/**
 * File-gc task handler — analyzes a file's data and marks unused media/thumbnails.
 * Delegates to the file-gc module's fileGcFile for full GC processing.
 */
registerHandler('file-gc', async (params, pool) => {
  const { fileId, revn } = params;
  if (!fileId) return;

  const { fileGcFile } = await import('./file-gc.js');
  const now = new Date().toISOString();
  await fileGcFile(pool, fileId, revn || 0, now);
});

/**
 * Deliver-webhook task handler — POSTs an event payload to an external webhook URI.
 * Records delivery status and deactivates webhooks after repeated failures.
 */
registerHandler('deliver-webhook', async (params, pool) => {
  const { webhookId, event } = params;
  if (!webhookId || !event) return;

  const { postWebhook } = await import('../http/client.js');

  const webhook = pool.get('SELECT * FROM webhook WHERE id = ?', [webhookId]);
  if (!webhook || webhook.is_active !== '1') return;

  let body;
  let mtype = webhook.mtype || 'application/json';

  if (mtype === 'application/transit+json') {
    const { encode } = await import('../transit/index.js');
    body = encode(event);
  } else {
    body = JSON.stringify(event);
  }

  const { status, error } = await postWebhook(webhook.uri, body, { mtype });

  const now = new Date().toISOString();

  if (error) {
    const newErrorCount = (webhook.error_count || 0) + 1;
    const maxErrors = 3;

    if (newErrorCount >= maxErrors) {
      pool.run("UPDATE webhook SET error_count = ?, error_code = ?, is_active = '0', modified_at = ? WHERE id = ?",
        [newErrorCount, error, now, webhookId]);
    } else {
      pool.run('UPDATE webhook SET error_count = ?, error_code = ?, modified_at = ? WHERE id = ?',
        [newErrorCount, error, now, webhookId]);
    }
  } else {
    pool.run('UPDATE webhook SET error_count = 0, error_code = NULL, modified_at = ? WHERE id = ?',
      [now, webhookId]);
  }
});