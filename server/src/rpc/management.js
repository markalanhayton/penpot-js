/**
 * @module rpc/management
 * @description Management RPC commands — mirrors `app.rpc.commands.management` from the Clojure backend.
 *
 * | Method                    | Auth | Since |
 * |---------------------------|:----:|-------|
 * | `duplicate-file`          | Yes  | 1.16  |
 * | `duplicate-project`       | Yes  | 1.16  |
 * | `move-files`              | Yes  | 1.16  |
 * | `move-project`            | Yes  | 1.16  |
 * | `clone-template`          | Yes  | 1.16  |
 * | `get-builtin-templates`   | Yes  | 1.19  |
 */

import { v4 as uuidv4 } from 'uuid';
import { RpcError } from './dispatcher.js';
import { encode, decode } from '../files/blob.js';

function checkEditionPermissions(pool, profileId, teamId) {
  const rel = pool.get(
    `SELECT is_owner, is_admin, can_edit FROM team_profile_rel WHERE team_id = ? AND profile_id = ?`,
    [teamId, profileId]
  );
  if (!rel || (rel.is_owner !== '1' && rel.is_admin !== '1' && rel.can_edit !== '1')) {
    throw new RpcError('authorization', 'access-denied', 'Edit access required');
  }
  return rel;
}

async function getFileWithData(pool, fileId) {
  const file = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', { id: fileId });
  if (!file) return null;

  let data = null;
  const fileData = pool.get('SELECT * FROM file_data WHERE file_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1', [fileId, 'main']);
  if (fileData && fileData.data) {
    try { data = await decode(fileData.data); } catch { try { data = JSON.parse(typeof fileData.data === 'string' ? fileData.data : fileData.data.toString()); } catch { data = null; } }
  } else if (file.data) {
    try { data = typeof file.data === 'string' ? JSON.parse(file.data) : file.data; } catch { data = null; }
  }
  if (!data) data = { pages: [], pagesIndex: {}, components: {}, media: {}, colors: [], typographies: {} };

  return { file, data };
}

export default function registerManagementCommands(register, pool) {
  register('duplicate-file', {
    auth: true,
    added: '1.16',
    handler: async (params, ctx) => {
      const { fileId, name } = params;

      const source = await getFileWithData(pool, fileId);
      if (!source) {
        throw new RpcError('not-found', 'object-not-found', 'File not found');
      }

      const project = pool.get('SELECT * FROM project WHERE id = ? AND deleted_at IS NULL', { id: source.file.project_id });
      if (!project) {
        throw new RpcError('not-found', 'object-not-found', 'Project not found');
      }

      checkEditionPermissions(pool, ctx.profileId, project.team_id);

      const newFileId = uuidv4();
      const newProjectId = source.file.project_id;
      const newName = name || `${source.file.name} (copy)`;
      const now = new Date().toISOString();

      const encoded = await encode(source.data, { version: 5 });

      pool.insertOnConflictDoNothing('file', {
        id: newFileId,
        project_id: newProjectId,
        name: newName,
        revn: 1,
        is_shared: '0',
        has_media_trimmed: '0',
        created_at: now,
        modified_at: now,
      });

      pool.insertOnConflictDoNothing('file_data', {
        id: uuidv4(),
        file_id: newFileId,
        type: 'main',
        data: encoded,
        created_at: now,
        modified_at: now,
      });

      pool.insertOnConflictDoNothing('file_profile_rel', {
        file_id: newFileId,
        profile_id: ctx.profileId,
        is_owner: '1',
        is_admin: '1',
        can_edit: '1',
        created_at: now,
      });

      const mediaObjects = pool.query('SELECT * FROM file_media_object WHERE file_id = ? AND deleted_at IS NULL', [fileId]);
      for (const mo of mediaObjects) {
        const newMoId = uuidv4();
        pool.insertOnConflictDoNothing('file_media_object', {
          id: newMoId,
          file_id: newFileId,
          name: mo.name,
          width: mo.width,
          height: mo.height,
          media_id: mo.media_id,
          media_type: mo.media_type,
          content_type: mo.content_type,
          created_at: now,
          modified_at: now,
        });
      }

      pool.run('UPDATE project SET modified_at = ? WHERE id = ?', [now, newProjectId]);

      return { id: newFileId, name: newName, projectId: newProjectId, revn: 1 };
    },
  });

  register('duplicate-project', {
    auth: true,
    added: '1.16',
    handler: async (params, ctx) => {
      const { projectId, name } = params;

      const sourceProject = pool.get('SELECT * FROM project WHERE id = ? AND deleted_at IS NULL', { id: projectId });
      if (!sourceProject) {
        throw new RpcError('not-found', 'object-not-found', 'Project not found');
      }

      checkEditionPermissions(pool, ctx.profileId, sourceProject.team_id);

      const newProjectId = uuidv4();
      const newName = name || `${sourceProject.name} (copy)`;
      const now = new Date().toISOString();

      pool.insertOnConflictDoNothing('project', {
        id: newProjectId,
        team_id: sourceProject.team_id,
        name: newName,
        created_at: now,
        modified_at: now,
      });

      pool.insertOnConflictDoNothing('team_profile_rel', {
        id: uuidv4(),
        team_id: sourceProject.team_id,
        profile_id: ctx.profileId,
        is_owner: '0',
        is_admin: '1',
        can_edit: '1',
        created_at: now,
      });

      pool.insertOnConflictDoNothing('project_profile_rel', {
        project_id: newProjectId,
        profile_id: ctx.profileId,
        is_owner: '1',
        is_admin: '1',
        can_edit: '1',
        created_at: now,
      });

      const sourceFiles = pool.query('SELECT * FROM file WHERE project_id = ? AND deleted_at IS NULL', [projectId]);
      const resultFiles = [];

      for (const sf of sourceFiles) {
        const source = await getFileWithData(pool, sf.id);
        if (!source) continue;

        const newFileId = uuidv4();
        const encoded = await encode(source.data, { version: 5 });

        pool.insertOnConflictDoNothing('file', {
          id: newFileId,
          project_id: newProjectId,
          name: sf.name,
          revn: 1,
          is_shared: '0',
          has_media_trimmed: '0',
          created_at: now,
          modified_at: now,
        });

        pool.insertOnConflictDoNothing('file_data', {
          id: uuidv4(),
          file_id: newFileId,
          type: 'main',
          data: encoded,
          created_at: now,
          modified_at: now,
        });

        resultFiles.push(newFileId);
      }

      return { id: newProjectId, name: newName, teamId: sourceProject.team_id, fileIds: resultFiles };
    },
  });

  register('move-files', {
    auth: true,
    added: '1.16',
    handler: async (params, ctx) => {
      const { ids, projectId } = params;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new RpcError('validation', 'validation-error', 'At least one file ID is required');
      }

      const destProject = pool.get('SELECT * FROM project WHERE id = ? AND deleted_at IS NULL', { id: projectId });
      if (!destProject) {
        throw new RpcError('not-found', 'object-not-found', 'Destination project not found');
      }

      checkEditionPermissions(pool, ctx.profileId, destProject.team_id);

      const placeholders = ids.map(() => '?').join(',');
      const files = pool.query(
        `SELECT id, project_id FROM file WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
        ids
      );

      for (const file of files) {
        const srcProject = pool.get('SELECT team_id FROM project WHERE id = ?', { id: file.project_id });
        if (srcProject) {
          checkEditionPermissions(pool, ctx.profileId, srcProject.team_id);
        }
      }

      pool.run(
        `UPDATE file SET project_id = ? WHERE id IN (${placeholders})`,
        [projectId, ...ids]
      );

      pool.run(
        `DELETE FROM file_library_rel WHERE file_id IN (${placeholders})
         AND library_file_id IN (
           SELECT lf.id FROM file lf JOIN project lp ON lp.id = lf.project_id
           WHERE lp.team_id != ?
         )`,
        [...ids, destProject.team_id]
      );

      const now = new Date().toISOString();
      pool.run('UPDATE project SET modified_at = ? WHERE id = ?', [now, projectId]);

      return ids;
    },
  });

  register('move-project', {
    auth: true,
    added: '1.16',
    handler: async (params, ctx) => {
      const { teamId, projectId } = params;

      const project = pool.get('SELECT * FROM project WHERE id = ? AND deleted_at IS NULL', { id: projectId });
      if (!project) {
        throw new RpcError('not-found', 'object-not-found', 'Project not found');
      }

      if (project.team_id === teamId) {
        throw new RpcError('validation', 'validation-error', 'Project is already in this team');
      }

      const destTeam = pool.get('SELECT * FROM team WHERE id = ? AND deleted_at IS NULL', { id: teamId });
      if (!destTeam) {
        throw new RpcError('not-found', 'object-not-found', 'Destination team not found');
      }

      checkEditionPermissions(pool, ctx.profileId, project.team_id);
      checkEditionPermissions(pool, ctx.profileId, teamId);

      pool.run('UPDATE project SET team_id = ? WHERE id = ?', [teamId, projectId]);

      pool.run(
        `DELETE FROM file_library_rel WHERE file_id IN (
           SELECT f.id FROM file f WHERE f.project_id = ?
         ) AND library_file_id IN (
           SELECT lf.id FROM file lf JOIN project lp ON lp.id = lf.project_id
           WHERE lp.team_id != ?
         )`,
        [projectId, teamId]
      );

      const now = new Date().toISOString();
      pool.run('UPDATE project SET modified_at = ? WHERE id = ?', [now, projectId]);

      return { id: projectId, teamId };
    },
  });

  register('clone-template', {
    auth: true,
    added: '1.16',
    handler: async (params, ctx) => {
      const { projectId, templateId } = params;

      const project = pool.get('SELECT * FROM project WHERE id = ? AND deleted_at IS NULL', { id: projectId });
      if (!project) {
        throw new RpcError('not-found', 'object-not-found', 'Project not found');
      }

      checkEditionPermissions(pool, ctx.profileId, project.team_id);

      const template = await getTemplateData(templateId);
      if (!template) {
        throw new RpcError('not-found', 'template-not-found', 'Template not found');
      }

      const now = new Date().toISOString();
      const newFileId = uuidv4();
      let data = template;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { /* keep */ }
      }

      const encoded = await encode(data, { version: 5 });

      pool.insertOnConflictDoNothing('file', {
        id: newFileId,
        project_id: projectId,
        name: template.name || 'Template',
        revn: 1,
        is_shared: '0',
        has_media_trimmed: '0',
        created_at: now,
        modified_at: now,
      });

      pool.insertOnConflictDoNothing('file_data', {
        id: uuidv4(),
        file_id: newFileId,
        type: 'main',
        data: encoded,
        created_at: now,
        modified_at: now,
      });

      pool.run('UPDATE project SET modified_at = ? WHERE id = ?', [now, projectId]);

      return [newFileId];
    },
  });

  register('get-builtin-templates', {
    auth: true,
    added: '1.19',
    handler: async (_params, _ctx) => {
      const templates = [
        { id: 'wireframe-kit', name: 'Wireframe Kit' },
        { id: 'design-system', name: 'Design System' },
        { id: 'landing-page', name: 'Landing Page' },
        { id: 'mobile-app', name: 'Mobile App' },
        { id: 'dashboard', name: 'Dashboard' },
      ];
      return templates;
    },
  });
}

async function getTemplateData(templateId) {
  const templatesPath = process.env.PENPOT_TEMPLATES_PATH;
  if (!templatesPath) return null;

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const templateFile = path.join(templatesPath, `${templateId}.json`);
    const content = await fs.readFile(templateFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}