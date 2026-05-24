/**
 * @module rpc/binfile
 * @description Binary file import/export RPC commands — mirrors `app.rpc.commands.binfile` from the Clojure backend.
 *
 * | Method           | Auth | Since |
 * |------------------|:----:|-------|
 * | `export-binfile` | Yes  | 1.15  |
 * | `import-binfile` | Yes  | 1.15  |
 *
 * The binfile format is a Penpot-specific ZIP archive for file transfer.
 * Export creates a ZIP from file data; import extracts and creates a new file.
 */

import { v4 as uuidv4 } from 'uuid';
import { RpcError } from './dispatcher.js';
import { decode, encode } from '../files/blob.js';
import { putStorageObject } from '../storage/fs.js';

function checkReadPermissions(pool, profileId, fileId) {
  const file = pool.get(
    `SELECT f.id FROM file f
     JOIN project p ON p.id = f.project_id
     JOIN team_profile_rel tpr ON tpr.team_id = p.team_id
     WHERE f.id = ? AND f.deleted_at IS NULL AND tpr.profile_id = ?`,
    [fileId, profileId]
  );
  if (!file) {
    throw new RpcError('authorization', 'access-denied', 'No read access to file');
  }
}

function checkEditionPermissions(pool, profileId, projectId) {
  const project = pool.get('SELECT team_id FROM project WHERE id = ? AND deleted_at IS NULL', { id: projectId });
  if (!project) {
    throw new RpcError('not-found', 'object-not-found', 'Project not found');
  }
  const rel = pool.get(
    `SELECT is_owner, is_admin, can_edit FROM team_profile_rel
     WHERE team_id = ? AND profile_id = ?`,
    [project.team_id, profileId]
  );
  if (!rel || (rel.is_owner !== '1' && rel.is_admin !== '1' && rel.can_edit !== '1')) {
    throw new RpcError('authorization', 'access-denied', 'Edit access required');
  }
  return project;
}

export default function registerBinfileCommands(register, pool) {
  register('export-binfile', {
    auth: true,
    added: '1.15',
    handler: async (params, ctx) => {
      const { fileId, includeLibraries, embedAssets } = params;

      checkReadPermissions(pool, ctx.profileId, fileId);

      const file = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', { id: fileId });
      if (!file) {
        throw new RpcError('not-found', 'object-not-found', 'File not found');
      }

      let data = null;
      const fileData = pool.get('SELECT * FROM file_data WHERE file_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1', [fileId, 'main']);
      if (fileData && fileData.data) {
        try {
          data = typeof fileData.data === 'string' || Buffer.isBuffer(fileData.data) ? await decode(fileData.data) : fileData.data;
        } catch {
          try { data = JSON.parse(typeof fileData.data === 'string' ? fileData.data : fileData.data.toString()); } catch { data = null; }
        }
      }

      if (!data) {
        data = { pages: [], pagesIndex: {}, components: {}, media: {}, colors: [], typographies: {} };
      }

      const manifest = {
        kind: 'penpot/export',
        version: 3,
        created: new Date().toISOString(),
        features: [],
        files: [{
          id: file.id,
          name: file.name,
          data,
        }],
      };

      if (includeLibraries) {
        const libRels = pool.query('SELECT * FROM file_library_rel WHERE file_id = ?', [fileId]);
        for (const rel of libRels) {
          const libFile = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', { id: rel.library_file_id });
          if (libFile) {
            let libData = null;
            const libFileData = pool.get('SELECT * FROM file_data WHERE file_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1', [libFile.id, 'main']);
            if (libFileData && libFileData.data) {
              try { libData = await decode(libFileData.data); } catch { try { libData = JSON.parse(typeof libFileData.data === 'string' ? libFileData.data : libFileData.data.toString()); } catch { libData = null; } }
            }
            manifest.files.push({
              id: libFile.id,
              name: libFile.name,
              data: libData || { pages: [], pagesIndex: {}, components: {}, media: {}, colors: [], typographies: {} },
            });
          }
        }
      }

      const manifestJson = JSON.stringify(manifest);
      const encoded = await encode(manifestJson, { version: 5 });

      const storageObj = await putStorageObject(pool, {
        bucket: 'tempfile',
        content: encoded,
        contentType: 'application/zip',
      });

      const publicUri = process.env.PENPOT_PUBLIC_URI || 'http://localhost:6060';
      return { id: storageObj.id, uri: `${publicUri}/assets/by-id/${storageObj.id}`, name: `${file.name}.penpot` };
    },
  });

  register('import-binfile', {
    auth: true,
    added: '1.15',
    handler: async (params, ctx) => {
      const { projectId, name, file: uploadedFile, uploadId, version } = params;

      checkEditionPermissions(pool, ctx.profileId, projectId);

      const fileVersion = version || 3;
      let fileData = null;

      if (uploadId) {
        const session = pool.get('SELECT * FROM upload_session WHERE id = ? AND deleted_at IS NULL', { id: uploadId });
        if (!session) {
          throw new RpcError('not-found', 'object-not-found', 'Upload session not found');
        }
        if (session.file_path) {
          const fs = await import('fs/promises');
          try {
            const raw = await fs.readFile(session.file_path);
            fileData = JSON.parse(raw.toString());
          } catch {
            try { fileData = await decode(raw); } catch {
              throw new RpcError('validation', 'validation-error', 'Could not parse uploaded file');
            }
          }
        }
      } else if (uploadedFile) {
        try {
          if (Buffer.isBuffer(uploadedFile)) {
            try { fileData = await decode(uploadedFile); } catch { fileData = JSON.parse(uploadedFile.toString()); }
          } else if (typeof uploadedFile === 'string') {
            fileData = JSON.parse(uploadedFile);
          } else {
            fileData = uploadedFile;
          }
        } catch {
          throw new RpcError('validation', 'validation-error', 'Could not parse file data');
        }
      } else {
        throw new RpcError('validation', 'validation-error', 'Either file or uploadId is required');
      }

      if (!fileData) {
        throw new RpcError('validation', 'validation-error', 'No file data provided');
      }

      const importData = fileData.files || [fileData];
      const result = [];

      for (const entry of importData) {
        const fileId = uuidv4();
        const fileName = name || entry.name || 'Imported File';
        const now = new Date().toISOString();

        let data = entry.data || entry;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch { /* keep as is */ }
        }

        const encoded = await encode(data, { version: 5 });

        pool.insertOnConflictDoNothing('file', {
          id: fileId,
          project_id: projectId,
          name: fileName,
          revn: 1,
          is_shared: '0',
          created_at: now,
          modified_at: now,
        });

        pool.insertOnConflictDoNothing('file_data', {
          id: uuidv4(),
          file_id: fileId,
          type: 'main',
          data: encoded,
          created_at: now,
          modified_at: now,
        });

        const proj = pool.get('SELECT team_id FROM project WHERE id = ?', { id: projectId });
        if (proj) {
          pool.insertOnConflictDoNothing('file_profile_rel', {
            file_id: fileId,
            profile_id: ctx.profileId,
            is_owner: '1',
            is_admin: '1',
            can_edit: '1',
            created_at: now,
          });
        }

        result.push(fileId);
      }

      pool.run('UPDATE project SET modified_at = ? WHERE id = ?', [new Date().toISOString(), projectId]);

      return result;
    },
  });
}