/**
 * @module rpc/files_update
 * @description File update RPC command — mirrors `app.rpc.commands.files-update`
 * from the Clojure backend.
 *
 * This is the collaborative editing engine. Every design change from the frontend
 * (moving shapes, changing colors, adding frames, etc.) flows through this handler.
 *
 * ### Method summary
 *
 * | Method         | Auth required | Since |
 * |----------------|:-------------:|-------|
 * | `update-file`  | Yes           | v1.17 |
 */

import { v4 as uuidv4 } from 'uuid';
import { rowToCamel } from '../db/sqlite.js';
import { RpcError } from '../rpc/dispatcher.js';
import { processChanges } from '../files/changes.js';
import { encode, decode } from '../files/blob.js';
import { climit } from '../middleware/rate-limit.js';
import { broadcast } from '../ws/notifications.js';

/**
 * Check edition permissions for a file.
 */
function checkEditionPermissions(pool, profileId, fileId) {
  const file = pool.get(
    `SELECT f.id FROM file f
     JOIN project p ON p.id = f.project_id
     JOIN team_profile_rel tpr ON tpr.team_id = p.team_id
     WHERE f.id = ? AND f.deleted_at IS NULL
       AND tpr.profile_id = ? AND tpr.can_edit = '1'`,
    { id: fileId, profile_id: profileId }
  );
  if (!file) {
    throw new RpcError('authorization', 'access-denied', 'Edit access required');
  }
}

/**
 * Get file data from the database and decode it.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} fileId
 * @returns {Promise<{ file: object, data: object }>}
 */
async function getFileWithData(pool, fileId) {
  const file = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', { id: fileId });
  if (!file) {
    throw new RpcError('not-found', 'object-not-found', 'File not found');
  }

  let data = null;

  // Try to load from file_data table first (storage backend)
  const fileData = pool.get('SELECT * FROM file_data WHERE file_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1', [fileId, 'main']);
  if (fileData && fileData.data) {
    // Decode blob data
    data = await decode(fileData.data);
  } else if (file.data) {
    // Fall back to inline data column (legacy)
    if (typeof file.data === 'string') {
      try {
        data = JSON.parse(file.data);
      } catch {
        data = await decode(Buffer.from(file.data, 'base64'));
      }
    } else if (Buffer.isBuffer(file.data)) {
      data = await decode(file.data);
    } else {
      data = file.data;
    }
  }

  if (!data) {
    data = {
      pages: [],
      pagesIndex: {},
      components: {},
      media: {},
      colors: [],
      typographies: {},
    };
  }

  return { file, data };
}

/**
 * Persist updated file data to the database (synchronous, for use inside transactions).
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} fileId
 * @param {Buffer} encoded - Pre-encoded file data blob.
 * @param {number} newRevn - The new revision number.
 */
function persistFileSync(pool, fileId, encoded, newRevn) {
  const now = new Date().toISOString();

  const existing = pool.get('SELECT * FROM file_data WHERE file_id = ? AND type = ?', [fileId, 'main']);
  if (existing) {
    pool.run(
      'UPDATE file_data SET data = ?, modified_at = ? WHERE file_id = ? AND id = ?',
      [encoded, now, fileId, existing.id]
    );
  } else {
    pool.insertOnConflictDoNothing('file_data', {
      file_id: fileId,
      id: uuidv4(),
      type: 'main',
      backend: 'db',
      metadata: '{}',
      data: encoded,
      created_at: now,
      modified_at: now,
    });
  }

  pool.run(
    'UPDATE file SET revn = ?, modified_at = ?, has_media_trimmed = ? WHERE id = ?',
    [newRevn, now, '0', fileId]
  );

  const file = pool.get('SELECT project_id FROM file WHERE id = ?', { id: fileId });
  if (file) {
    pool.run('UPDATE project SET modified_at = ? WHERE id = ?', [now, file.project_id]);
  }
}

/**
 * Persist updated file data to the database (async version for non-transactional use).
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} fileId
 * @param {object} data - The file data object.
 * @param {number} newRevn - The new revision number.
 */
async function persistFile(pool, fileId, data, newRevn) {
  const now = new Date().toISOString();

  // Encode the file data
  const encoded = await encode(data, { version: 5 });

  // Store in file_data table
  const existing = pool.get('SELECT * FROM file_data WHERE file_id = ? AND type = ?', [fileId, 'main']);
  if (existing) {
    pool.run(
      'UPDATE file_data SET data = ?, modified_at = ? WHERE file_id = ? AND id = ?',
      [encoded, now, fileId, existing.id]
    );
  } else {
    pool.insertOnConflictDoNothing('file_data', {
      file_id: fileId,
      id: uuidv4(),
      type: 'main',
      backend: 'db',
      metadata: '{}',
      data: encoded,
      created_at: now,
      modified_at: now,
    });
  }

  // Update file metadata
  pool.run(
    'UPDATE file SET revn = ?, modified_at = ?, has_media_trimmed = ? WHERE id = ?',
    [newRevn, now, '0', fileId]
  );

  // Update project modified_at
  const file = pool.get('SELECT project_id FROM file WHERE id = ?', { id: fileId });
  if (file) {
    pool.run('UPDATE project SET modified_at = ? WHERE id = ?', [now, file.project_id]);
  }
}

/**
 * Get lagged changes (changes that arrived after the client's known revn).
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} fileId
 * @param {number} revn
 * @returns {Array<object>}
 */
async function getLaggedChanges(pool, fileId, revn) {
  const rows = pool.query(
    `SELECT id, revn, file_id, session_id, changes
     FROM file_change
     WHERE file_id = ? AND revn > ? AND changes IS NOT NULL
     ORDER BY created_at ASC`,
    [fileId, revn]
  );

  const result = [];
  for (const row of rows) {
    try {
      const changes = Buffer.isBuffer(row.changes) ? await decode(row.changes) : JSON.parse(row.changes);
      result.push({
        id: row.id,
        revn: row.revn,
        fileId: row.file_id,
        sessionId: row.session_id,
        changes,
      });
    } catch {
      // Ignore malformed change records
    }
  }

  return result;
}

/**
 * Send WebSocket notifications to connected clients.
 *
 * Publishes a `file-change` event to the file's topic, then also publishes
 * a `library-change` event if the file is shared (used as a library).
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} fileId - The file ID that changed.
 * @param {object} message - The notification payload.
 */
function sendNotification(pool, fileId, message) {
  broadcast(fileId, message);

  // If this file is shared, notify subscribers of the library topic too
  const file = pool.get('SELECT is_shared FROM file WHERE id = ?', { id: fileId });
  if (file && file.is_shared === '1') {
    broadcast(fileId, { ...message, type: 'library-change' });
  }
}

/**
 * Register the update-file RPC command.
 *
 * @param {function(string, import('./dispatcher.js').RpcMethodDefinition): void} register
 * @param {import('../db/sqlite.js').DatabasePool} pool
 */
export default function registerFilesUpdateCommands(register, pool) {

  const updateFileHandler = async (params, ctx) => {
    const { id, sessionId, revn, vern, changes, changesWithMetadata, features, skipValidate } = params;

    checkEditionPermissions(pool, ctx.profileId, id);

    // Get current file and data
    const { file, data } = await getFileWithData(pool, id);

    // Version conflict detection
    if (vern !== undefined && vern !== (file.vern || 0)) {
      throw new RpcError('validation', 'vern-conflict',
        'A different version has been restored for the file',
        { incomingVern: vern, storedVern: file.vern || 0 });
    }

    if (revn > (file.revn || 0)) {
      throw new RpcError('validation', 'revn-conflict',
        'The incoming revision number is greater than stored version',
        { incomingRevn: revn, storedRevn: file.revn || 0 });
    }

    // Extract changes from the different formats
    let allChanges = [];
    if (changesWithMetadata && Array.isArray(changesWithMetadata)) {
      for (const item of changesWithMetadata) {
        if (item.changes) allChanges.push(...item.changes);
      }
    } else if (changes) {
      allChanges = changes;
    }

    if (allChanges.length === 0) {
      return [{
        changes: [],
        fileId: id,
        id: uuidv4(),
        revn: file.revn || 0,
        sessionId,
      }];
    }

    // Process changes (mutates data in-place)
    const newRevn = (file.revn || 0) + 1;
    processChanges(data, allChanges);

    // Encode file data and changes before the transaction (async work must be outside)
    const [encodedData, allChangesEncoded] = await Promise.all([
      encode(data, { version: 5 }),
      encode(allChanges, { version: 5 }),
    ]);

    // Persist the updated file and record change in a transaction to prevent
    // concurrent write corruption (SQLite BEGIN IMMEDIATE acquires a write lock)
    const result = pool.transaction(() => {
      // Re-check revn inside the transaction to catch concurrent edits
      const currentFile = pool.get('SELECT revn, vern FROM file WHERE id = ?', { id });
      if (currentFile && (currentFile.revn || 0) !== (file.revn || 0)) {
        throw new RpcError('conflict', 'revn-conflict',
          'File was modified by another session during this update',
          { incomingRevn: file.revn || 0, storedRevn: currentFile.revn || 0 });
      }

      persistFileSync(pool, id, encodedData, newRevn);

      const now = new Date().toISOString();
      const changeId = uuidv4();

      pool.insertOnConflictDoNothing('file_change', {
        id: changeId,
        file_id: id,
        session_id: sessionId,
        profile_id: ctx.profileId,
        created_at: now,
        modified_at: now,
        revn: newRevn,
        version: file.version || 0,
        changes: allChangesEncoded,
        deleted_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

      return changeId;
    });

    // Send WebSocket notification to all connected clients
    sendNotification(pool, id, {
      type: 'file-change',
      profileId: ctx.profileId,
      fileId: id,
      sessionId,
      revn: newRevn,
      vern: file.vern || 0,
      changes: allChanges,
    });

    // Return lagged changes for the client to catch up
    const lagged = await getLaggedChanges(pool, id, revn);

    return [{
      changes: allChanges,
      fileId: id,
      id: result,
      revn: newRevn,
      sessionId,
      lagged,
    }];
  };

  register('update-file', {
    auth: true,
    added: '1.17',
    handler: climit('update-file', updateFileHandler, { perProfile: 5, global: 50 }),
  });

  register('get-file-changes', {
    auth: true,
    added: '2.4',
    async handler(params, ctx) {
      const { id, since } = params;

      const file = pool.get('SELECT id FROM file WHERE id = ? AND deleted_at IS NULL', { id });
      if (!file) {
        throw new RpcError('not-found', 'object-not-found', 'File not found');
      }

      const sinceRevn = since || 0;
      const lagged = await getLaggedChanges(pool, id, sinceRevn);

      return { changes: lagged };
    },
  });
}
