'use strict';
/**
 * @module rpc/files
 * @description File management RPC commands — mirrors `app.rpc.commands.files`
 * from the Clojure backend (get-*, create, rename, delete, sharing, libraries).
 *
 * ### Method summary
 *
 * | Method                  | Auth required | Since  |
 * |-------------------------|:-------------:|--------|
 * | `get-file`              | Yes           | 1.17   |
 * | `get-file-fragment`     | No            | 1.17   |
 * | `get-project-files`     | Yes           | 1.17   |
 * | `get-page`              | Yes           | 1.17   |
 * | `create-file`           | Yes           | 1.17   |
 * | `rename-file`           | Yes           | 1.17   |
 * | `set-file-shared`       | Yes           | 1.17   |
 * | `delete-file`           | Yes           | 1.17   |
 * | `link-file-to-library`  | Yes           | 1.17   |
 * | `unlink-file-from-library` | Yes        | 1.17   |
 * | `get-file-info`         | No            | 2.2    |
 * | `get-team-shared-files` | Yes           | 1.17   |
 * | `get-team-deleted-files` | Yes          | 2.12   |
 * | `get-team-recent-files` | Yes           | 1.17   |
 * | `has-file-libraries`    | Yes           | 1.15.1 |
 * | `get-file-stats`        | Yes           | 2.17   |
 * | `get-library-usage`     | Yes           | 2.10   |
 * | `get-team-libraries`     | Yes           | 2.20   |
 * | `permanently-delete-team-files` | Yes  | 2.13   |
 * | `restore-deleted-team-files`  | Yes    | 2.13   |
 * | `update-file-pin`             | Yes           | 2.23   |
 * | `get-file-summary`          | Yes           | 2.8    |
 * | `get-file-libraries`        | Yes           | 2.8    |
 * | `get-library-file-references` | Yes          | 2.10   |
 * | `update-file-library-sync-status` | Yes     | 2.17   |
 * | `ignore-file-library-sync-status` | Yes    | 2.17   |
 */

import { v4 as uuidv4 } from 'uuid';
import { rowToCamel, rowsToCamel } from '../db/sqlite.js';
import { RpcError } from '../rpc/dispatcher.js';
import {
  getTeamEnabledFeatures,
  checkClientFeatures,
  computeFileFeatures,
  computeNewTeamFeatures,
  parseFeatures,
  serializeFeatures,
  FLAG_FEATURE_MAP,
} from '../config/features.js';
import { checkProjectEditionPermissions, checkReadPermissions, checkEditionPermissions } from '../middleware/permissions.js';
import { checkQuota } from '../middleware/quotes.js';
import { flagEnabled } from '../config/index.js';
import { decode } from '../files/blob.js';
import { encode } from '../files/blob.js';

/**
 * Register all file-related RPC commands.
 *
 * @param {function(string, import('./dispatcher.js').RpcMethodDefinition): void} register - Method registration callback.
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 */
export default function registerFileCommands(register, pool) {

  register('get-file', {
    auth: true,
    added: '1.17',
    async handler(params) {
      const file = pool.get('SELECT * FROM file WHERE id = @id AND deleted_at IS NULL', { id: params.id });
      if (!file) throw new RpcError('not-found', 'object-not-found', 'File not found');

      const result = rowToCamel(file);

      let data = null;
      const fileData = pool.get('SELECT * FROM file_data WHERE file_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1', [file.id, 'main']);
      if (fileData && fileData.data) {
        try {
          data = await decode(fileData.data);
        } catch (err) {
          console.error('[get-file] Failed to decode file data:', err.message);
        }
      } else if (file.data) {
        if (typeof file.data === 'string') {
          try { data = JSON.parse(file.data); } catch { data = await decode(Buffer.from(file.data, 'base64')); }
        } else if (Buffer.isBuffer(file.data)) {
          data = await decode(file.data);
        } else {
          data = file.data;
        }
      }

      if (data) {
        result.data = data;
      }

      return result;
    }
  });

  register('get-file-fragment', {
    auth: false,
    added: '1.17',
    async handler(params) {
      const fragment = pool.get(
        'SELECT * FROM file_data_fragment WHERE file_id = @fileId AND id = @fragmentId',
        { fileId: params.fileId, fragmentId: params.fragmentId }
      );
      if (!fragment) throw new Error('not-found:File fragment not found');
      return rowToCamel(fragment);
    }
  });

  register('get-project-files', {
    auth: true,
    added: '1.17',
    async handler(params) {
      const rows = pool.query(
        'SELECT * FROM file WHERE project_id = @projectId AND deleted_at IS NULL ORDER BY name',
        { projectId: params.projectId }
      );
      return rowsToCamel(rows);
    }
  });

  register('get-page', {
    auth: true,
    added: '1.17',
    async handler(params) {
      const { fileId, pageId } = params;
      if (pageId) {
        const page = pool.get('SELECT * FROM page WHERE id = @id AND file_id = @fileId AND deleted_at IS NULL', { id: pageId, fileId });
        if (!page) throw new Error('not-found:Page not found');
        return rowToCamel(page);
      }
      const pages = pool.query(
        'SELECT * FROM page WHERE file_id = @fileId AND deleted_at IS NULL ORDER BY ordering',
        { fileId }
      );
      return rowsToCamel(pages);
    }
  });

  register('create-file', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { projectId, name, isShared, features: clientFeatures, pageId, createPage } = params;
      const profileId = ctx.profileId;

      // 1. Look up the project and check edition permissions
      const project = pool.get('SELECT * FROM project WHERE id = ? AND deleted_at IS NULL', { id: projectId });
      if (!project) throw new RpcError('not-found', 'object-not-found', 'Project not found');
      const teamId = project.team_id;
      checkProjectEditionPermissions(pool, profileId, projectId);

      // 2. Get team and compute enabled features
      const team = pool.get('SELECT * FROM team WHERE id = ? AND deleted_at IS NULL', [teamId]);
      if (!team) throw new RpcError('not-found', 'object-not-found', 'Team not found');

      // Build flags object from feature flag env vars
      const flags = {};
      for (const flag of Object.keys(FLAG_FEATURE_MAP)) {
        if (flagEnabled(flag)) flags[flag] = true;
      }

      let teamEnabledFeatures = getTeamEnabledFeatures(flags, team);
      checkClientFeatures(teamEnabledFeatures, clientFeatures, RpcError);

      // 3. Also include client-sent no-migration features (minus frontend-only)
      const fileFeatures = computeFileFeatures(teamEnabledFeatures, clientFeatures);

      // 4. Check quota
      checkQuota(pool, 'files-per-project', { profileId, teamId, projectId });

      // 5. Compute new features to propagate to team
      const teamFeatures = parseFeatures(team.features);
      const newTeamFeatures = computeNewTeamFeatures(fileFeatures, teamFeatures);
      if (newTeamFeatures) {
        const merged = new Set([...teamFeatures, ...newTeamFeatures]);
        pool.run('UPDATE team SET features = ? WHERE id = ?', [serializeFeatures(merged), teamId]);
      }

      // 6. Create file with initial data
      const fileId = params.id || uuidv4();
      const now = new Date().toISOString();
      const shouldCreatePage = createPage !== false;
      const initialPageId = pageId || uuidv4();

      const initialData = shouldCreatePage
        ? {
            pages: [initialPageId],
            pagesIndex: {
              [initialPageId]: {
                id: initialPageId,
                name: 'Page 1',
                objects: {},
              },
            },
            options: { componentsV2: true },
          }
        : { pages: [], pagesIndex: {} };

      const encodedData = await encode(initialData, { version: 5 });

      const result = pool.transaction(() => {
        const file = pool.insertReturning('file', {
          id: fileId,
          project_id: projectId,
          name: name || 'Untitled',
          is_shared: isShared ? '1' : '0',
          revn: 0,
          vern: 0,
          version: 0,
          features: serializeFeatures(fileFeatures),
          fonts: JSON.stringify([]),
          created_at: now,
          modified_at: now,
        });

        // Insert initial file data
        pool.insertOnConflictDoNothing('file_data', {
          file_id: fileId,
          id: uuidv4(),
          type: 'main',
          backend: 'db',
          metadata: '{}',
          data: encodedData,
          created_at: now,
          modified_at: now,
        });

        // Insert file migrations for all available (no-migration) features
        for (const feature of fileFeatures) {
          pool.run(
            'INSERT OR IGNORE INTO file_migration (file_id, name, created_at) VALUES (?, ?, ?)',
            [fileId, feature, now]
          );
        }

        // Assign owner role to creator
        pool.insertOnConflictDoNothing('file_profile_rel', {
          file_id: fileId,
          profile_id: profileId,
          is_owner: '1',
          is_admin: '1',
          can_edit: '1',
          created_at: now,
          modified_at: now,
        });

        // Create initial page row
        if (shouldCreatePage) {
          pool.insertOnConflictDoNothing('page', {
            id: initialPageId,
            file_id: fileId,
            name: 'Page 1',
            ordering: 0,
            created_at: now,
            modified_at: now,
          });
        }

        // Update project modified_at
        pool.run('UPDATE project SET modified_at = ? WHERE id = ?', [now, projectId]);

        return file;
      });

      // Return the created file with features as an array
      const created = rowToCamel(result);
      created.features = [...fileFeatures];
      created.data = initialData;
      return created;
    }
  });

  register('rename-file', {
    auth: true,
    added: '1.17',
    async handler(params) {
      const result = pool.updateReturning('file', {
        name: params.name,
        modified_at: new Date().toISOString(),
      }, { id: params.id });
      if (!result) throw new Error('not-found:File not found');
      return rowToCamel(result);
    }
  });

  register('set-file-shared', {
    auth: true,
    added: '1.17',
    async handler(params) {
      pool.update('file', {
        is_shared: params.isShared ? '1' : '0',
        modified_at: new Date().toISOString(),
      }, { id: params.id });
      return { id: params.id, isShared: params.isShared };
    }
  });

  register('delete-file', {
    auth: true,
    added: '1.17',
    async handler(params) {
      pool.softDelete('file', { id: params.id });
      return { id: params.id };
    }
  });

  register('link-file-to-library', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { fileId, libraryId } = params;

      if (fileId === libraryId) {
        throw new RpcError('validation', 'invalid-library', 'A file cannot be linked to itself');
      }

      const file = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', [fileId]);
      if (!file) throw new RpcError('not-found', 'object-not-found', 'File not found');

      const library = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', [libraryId]);
      if (!library) throw new RpcError('not-found', 'object-not-found', 'Library file not found');

      const now = new Date().toISOString();
      pool.run(
        'INSERT OR IGNORE INTO file_library_rel (file_id, library_file_id, created_at, synced_at) VALUES (?, ?, ?, ?)',
        [fileId, libraryId, now, now]
      );

      const libraries = pool.query(
        `SELECT f.* FROM file f
         JOIN file_library_rel flr ON flr.library_file_id = f.id
         WHERE flr.file_id = ? AND (f.deleted_at IS NULL OR f.deleted_at > ?)`,
        [fileId, now]
      );
      return rowsToCamel(libraries);
    }
  });

  register('unlink-file-from-library', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const { fileId, libraryId } = params;

      const file = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', [fileId]);
      if (!file) throw new RpcError('not-found', 'object-not-found', 'File not found');

      const library = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', [libraryId]);
      if (!library) throw new RpcError('not-found', 'object-not-found', 'Library file not found');

      pool.run(
        'DELETE FROM file_library_rel WHERE file_id = ? AND library_file_id = ?',
        [fileId, libraryId]
      );

      return null;
    }
  });

  register('get-file-info', {
    auth: false,
    added: '2.2.0',
    async handler(params) {
      const file = pool.get('SELECT * FROM file WHERE id = @id', { id: params.id });
      if (!file) throw new Error('not-found:File not found');
      return rowToCamel(file);
    }
  });

  register('get-team-shared-files', {
    auth: true,
    added: '1.17',
    async handler(params) {
      const rows = pool.query(
        `SELECT f.* FROM file f
         JOIN project p ON p.id = f.project_id
         JOIN team t ON t.id = p.team_id
         JOIN team_profile_rel tpr ON tpr.team_id = t.id
         WHERE tpr.profile_id = @profileId AND f.is_shared = '1' AND f.deleted_at IS NULL`,
        { profileId: params.teamId }
      );
      return rowsToCamel(rows);
    }
  });

  register('get-team-libraries', {
    auth: true,
    added: '2.20',
    async handler(params) {
      const rows = pool.query(
        `SELECT f.*, COUNT(DISTINCT flr.file_id) AS file_count
         FROM file f
         JOIN project p ON p.id = f.project_id
         JOIN team t ON t.id = p.team_id
         JOIN team_profile_rel tpr ON tpr.team_id = t.id
         LEFT JOIN file_library_rel flr ON flr.library_file_id = f.id
         WHERE tpr.profile_id = @profileId AND f.is_shared = '1' AND f.deleted_at IS NULL
         GROUP BY f.id`,
        { profileId: params.teamId }
      );
      return rowsToCamel(rows);
    }
  });

  register('get-team-deleted-files', {
    auth: true,
    added: '2.12',
    async handler(params) {
      const rows = pool.query(
        `SELECT f.* FROM file f
         JOIN project p ON p.id = f.project_id
         WHERE p.team_id = @teamId AND f.deleted_at IS NOT NULL`,
        { teamId: params.teamId }
      );
      return rowsToCamel(rows);
    }
  });

  register('get-team-recent-files', {
    auth: true,
    added: '1.17',
    async handler(params, ctx) {
      const rows = pool.query(
        `SELECT f.* FROM file f
         JOIN project p ON p.id = f.project_id
         JOIN team_profile_rel tpr ON tpr.team_id = p.team_id
         WHERE tpr.profile_id = @profileId AND f.deleted_at IS NULL
         ORDER BY f.modified_at DESC LIMIT 20`,
        { profileId: ctx?.profileId }
      );
      return rowsToCamel(rows);
    }
  });

  register('has-file-libraries', {
    auth: true,
    added: '1.15.1',
    async handler(params) {
      const result = pool.get(
        `SELECT COUNT(*) > 0 AS has_libraries
         FROM file_library_rel AS flr
         JOIN file AS fl ON (flr.library_file_id = fl.id)
         WHERE flr.file_id = ?
           AND (fl.deleted_at IS NULL OR fl.deleted_at > ?)`,
        [params.fileId, new Date().toISOString()]
      );
      return result?.has_libraries === 1 || result?.has_libraries === true;
    }
  });

  register('get-file-stats', {
    auth: true,
    added: '2.17',
    async handler(params) {
      const { id } = params;
      const now = new Date().toISOString();

      const pages = pool.get(
        'SELECT COUNT(*) as cnt FROM page WHERE file_id = ? AND deleted_at IS NULL',
        [id]
      );

      const libCounts = pool.get(
        `SELECT
           (SELECT COUNT(*)
              FROM file_library_rel AS flr
              JOIN file AS fl ON (fl.id = flr.library_file_id)
             WHERE flr.file_id = ?
               AND (fl.deleted_at IS NULL OR fl.deleted_at > ?)) AS library_count,
           (SELECT COUNT(*)
              FROM file_library_rel AS flr
              JOIN file AS fl ON (fl.id = flr.file_id)
             WHERE flr.library_file_id = ?
               AND (fl.deleted_at IS NULL OR fl.deleted_at > ?)) AS referenced_by_count`,
        [id, now, id, now]
      );

      const file = pool.get(
        'SELECT revn, modified_at FROM file WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      return {
        fileId: id,
        pageCount: pages?.cnt || 0,
        shapeCounts: {},
        componentCount: 0,
        deletedComponentCount: 0,
        colorCount: 0,
        typographyCount: 0,
        libraryCount: libCounts?.library_count || 0,
        referencedByCount: libCounts?.referenced_by_count || 0,
        revn: file?.revn || 0,
        updatedAt: file?.modified_at || now,
      };
    }
  });

  register('get-library-usage', {
    auth: true,
    added: '2.10',
    async handler(params, ctx) {
      const { fileId } = params;
      checkReadPermissions(pool, ctx.profileId, fileId);

      const row = pool.get(
        `SELECT COUNT(*) as used FROM file_library_rel AS flr
         JOIN file AS fl ON (flr.library_file_id = fl.id)
         WHERE flr.library_file_id = ?
           AND (fl.deleted_at IS NULL OR fl.deleted_at > ?)`,
        [fileId, new Date().toISOString()]
      );

      return { usedIn: row?.used || 0 };
    },
  });

  register('permanently-delete-team-files', {
    auth: true,
    added: '2.13',
    async handler(params, ctx) {
      const { teamId, ids } = params;
      if (!ids || !Array.isArray(ids) || ids.length === 0) return [];

      const rel = pool.get(
        `SELECT is_owner, is_admin FROM team_profile_rel WHERE team_id = ? AND profile_id = ?`,
        [teamId, ctx.profileId]
      );
      if (!rel || (rel.is_owner !== '1' && rel.is_admin !== '1')) {
        throw new RpcError('authorization', 'access-denied', 'Team admin access required');
      }

      const placeholders = ids.map(() => '?').join(',');
      const candidates = pool.query(
        `SELECT f.id FROM file AS f
         JOIN project AS p ON (p.id = f.project_id)
         JOIN team AS t ON (t.id = p.team_id)
         WHERE t.deleted_at IS NULL AND t.id = ? AND f.id IN (${placeholders})`,
        [teamId, ...ids]
      );

      const now = new Date().toISOString();
      const candidateIds = candidates.map(c => c.id);

      for (const fileId of candidateIds) {
        pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [now, fileId]);
      }

      return candidateIds;
    },
  });

  register('restore-deleted-team-files', {
    auth: true,
    added: '2.13',
    async handler(params, ctx) {
      const { teamId, ids } = params;
      if (!ids || !Array.isArray(ids) || ids.length === 0) return [];

      const rel = pool.get(
        `SELECT is_owner, is_admin FROM team_profile_rel WHERE team_id = ? AND profile_id = ?`,
        [teamId, ctx.profileId]
      );
      if (!rel || (rel.is_owner !== '1' && rel.is_admin !== '1')) {
        throw new RpcError('authorization', 'access-denied', 'Team admin access required');
      }

      const placeholders = ids.map(() => '?').join(',');

      const files = pool.query(
        `SELECT f.id, f.project_id FROM file AS f
         JOIN project AS p ON (p.id = f.project_id)
         JOIN team AS t ON (t.id = p.team_id)
         WHERE t.deleted_at IS NULL AND t.id = ? AND f.id IN (${placeholders})`,
        [teamId, ...ids]
      );

      const fileIds = files.map(f => f.id);
      const projectIds = [...new Set(files.map(f => f.project_id))];

      if (fileIds.length > 0) {
        const filePlaceholders = fileIds.map(() => '?').join(',');

        pool.run(
          `UPDATE file SET deleted_at = NULL, has_media_trimmed = '0' WHERE id IN (${filePlaceholders})`,
          fileIds
        );
        pool.run(
          `UPDATE file_media_object SET deleted_at = NULL WHERE file_id IN (${filePlaceholders})`,
          fileIds
        );
        pool.run(
          `UPDATE file_change SET deleted_at = NULL WHERE file_id IN (${filePlaceholders})`,
          fileIds
        );
        pool.run(
          `UPDATE file_data SET deleted_at = NULL WHERE file_id IN (${filePlaceholders})`,
          fileIds
        );
        pool.run(
          `UPDATE file_thumbnail SET deleted_at = NULL WHERE file_id IN (${filePlaceholders})`,
          fileIds
        );
        pool.run(
          `UPDATE file_tagged_object_thumbnail SET deleted_at = NULL WHERE file_id IN (${filePlaceholders})`,
          fileIds
        );
      }

      if (projectIds.length > 0) {
        const projPlaceholders = projectIds.map(() => '?').join(',');
        pool.run(
          `UPDATE project SET deleted_at = NULL WHERE id IN (${projPlaceholders})`,
          projectIds
        );
      }

      return fileIds;
    },
  });

  register('update-file-pin', {
    auth: true,
    added: '2.23',
    async handler(params, ctx) {
      const { fileId, projectId, isPinned } = params;
      if (!fileId || !projectId) {
        throw new RpcError('validation', 'missing-params', 'fileId and projectId are required');
      }
      const pinned = isPinned ? '1' : '0';
      const now = new Date().toISOString();

      pool.db.prepare(`
        INSERT INTO file_project_profile_rel (file_id, project_id, profile_id, is_pinned, modified_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(file_id, project_id, profile_id) DO UPDATE SET is_pinned = ?, modified_at = ?
      `).run(fileId, projectId, ctx.profileId, pinned, now, pinned, now);

      return { id: fileId, isPinned: isPinned || false };
    },
  });

  register('get-file-summary', {
    auth: true,
    added: '2.8',
    async handler(params, ctx) {
      const { id } = params;
      const file = pool.get('SELECT id, name, project_id, is_shared, revn, vern, modified_at, created_at FROM file WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!file) throw new RpcError('not-found', 'object-not-found', 'File not found');

      checkReadPermissions(pool, ctx.profileId, id);

      const pages = pool.query('SELECT id, name, ordering FROM page WHERE file_id = ? AND deleted_at IS NULL ORDER BY ordering', [id]);
      const libraryCount = pool.get('SELECT COUNT(*) as cnt FROM file_library_rel WHERE file_id = ?', [id]);

      return {
        id: file.id,
        name: file.name,
        projectId: file.project_id,
        isShared: file.is_shared === '1',
        revn: file.revn,
        vern: file.vern || 0,
        modifiedAt: file.modified_at,
        createdAt: file.created_at,
        pageCount: pages.length,
        libraryCount: libraryCount?.cnt || 0,
      };
    },
  });

  register('get-file-libraries', {
    auth: true,
    added: '2.8',
    async handler(params, ctx) {
      const { fileId } = params;

      checkReadPermissions(pool, ctx.profileId, fileId);

      const libraries = pool.query(
        `SELECT f.id, f.name, f.is_shared, f.revn, f.modified_at, f.created_at
         FROM file f
         JOIN file_library_rel flr ON flr.library_file_id = f.id
         WHERE flr.file_id = ? AND f.deleted_at IS NULL`,
        [fileId]
      );

      return rowsToCamel(libraries);
    },
  });

  register('get-library-file-references', {
    auth: true,
    added: '2.10',
    async handler(params, ctx) {
      const { libraryId } = params;

      const library = pool.get('SELECT id, is_shared FROM file WHERE id = ? AND deleted_at IS NULL', [libraryId]);
      if (!library) throw new RpcError('not-found', 'object-not-found', 'Library file not found');

      const references = pool.query(
        `SELECT f.id, f.name, f.project_id, f.revn, f.modified_at
         FROM file f
         JOIN file_library_rel flr ON flr.file_id = f.id
         WHERE flr.library_file_id = ? AND f.deleted_at IS NULL`,
        [libraryId]
      );

      return rowsToCamel(references);
    },
  });

  register('update-file-library-sync-status', {
    auth: true,
    added: '2.17',
    async handler(params, ctx) {
      const { fileId, libraryId } = params;

      checkEditionPermissions(pool, ctx.profileId, fileId);
      checkEditionPermissions(pool, ctx.profileId, libraryId);

      const now = new Date().toISOString();
      pool.run(
        `INSERT INTO file_library_sync (file_id, library_file_id, synced_at) VALUES (?, ?, ?)
         ON CONFLICT (file_id, library_file_id) DO UPDATE SET synced_at = EXCLUDED.synced_at`,
        [fileId, libraryId, now]
      );

      return { fileId, libraryId, syncedAt: now };
    },
  });

  register('ignore-file-library-sync-status', {
    auth: true,
    added: '2.17',
    async handler(params, ctx) {
      const { fileId, date } = params;

      checkEditionPermissions(pool, ctx.profileId, fileId);

      const file = pool.get(
        `UPDATE file SET ignore_sync_until = ?, modified_at = ? WHERE id = ? AND deleted_at IS NULL
         RETURNING id, name, is_shared, revn, vern, modified_at, created_at, ignore_sync_until`,
        [date, new Date().toISOString(), fileId]
      );

      if (!file) throw new RpcError('not-found', 'object-not-found', 'File not found');

      return rowToCamel(file);
    },
  });
}