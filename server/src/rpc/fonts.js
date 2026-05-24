/**
 * @module rpc/fonts
 * @description Font management RPC commands — mirrors `app.rpc.commands.fonts`
 * from the Clojure backend.
 *
 * Handles font variant CRUD, font file storage, and font family downloads.
 *
 * ### Method summary
 *
 * | Method                    | Auth required | Since |
 * |---------------------------|:-------------:|-------|
 * | `get-font-variants`      | Yes           | v1.18 |
 * | `create-font-variant`    | Yes           | v1.18 |
 * | `update-font`            | Yes           | v1.18 |
 * | `delete-font`            | Yes           | v1.18 |
 * | `delete-font-variant`    | Yes           | v1.18 |
 * | `download-font`          | Yes           | v2.15 |
 * | `download-font-family`   | Yes           | v2.15 |
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { rowToCamel, rowsToCamel } from '../db/sqlite.js';
import {
  validateMediaType,
  validateMediaSize,
  FONT_TYPES,
  generateFonts,
  withTempFiles,
  calculateHash,
} from '../media/index.js';
import {
  putStorageObject,
  touchStorageObject,
  getStorageObject,
  getStorageObjectUrl,
  getStorageObjectData,
  storeObject,
} from '../storage/fs.js';
import { RpcError } from '../rpc/dispatcher.js';

const VALID_WEIGHTS = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
const VALID_STYLES = new Set(['normal', 'italic']);

/**
 * Check that the authenticated profile has read access to a team.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} profileId
 * @param {string} teamId
 * @throws {RpcError}
 */
function checkTeamReadPermissions(pool, profileId, teamId) {
  const rel = pool.get(
    `SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ? AND is_member = '1'`,
    { team_id: teamId, profile_id: profileId }
  );
  if (!rel) {
    throw new RpcError('authorization', 'access-denied', 'You don\'t have access to this team');
  }
}

/**
 * Check that the authenticated profile has edit access to a team.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} profileId
 * @param {string} teamId
 * @throws {RpcError}
 */
function checkTeamEditionPermissions(pool, profileId, teamId) {
  const rel = pool.get(
    `SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ? AND can_edit = '1'`,
    { team_id: teamId, profile_id: profileId }
  );
  if (!rel) {
    throw new RpcError('authorization', 'access-denied', 'You don\'t have edit access to this team');
  }
}

/**
 * Resolve team ID from various context parameters (team ID, project ID, or file ID).
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {{ teamId?: string, projectId?: string, fileId?: string }} params
 * @returns {string|null} Team UUID, or null if not found.
 */
function resolveTeamId(pool, { teamId, projectId, fileId }) {
  if (teamId) return teamId;

  if (projectId) {
    const project = pool.get('SELECT team_id FROM project WHERE id = ?', { id: projectId });
    return project ? project.team_id : null;
  }

  if (fileId) {
    const file = pool.get('SELECT project_id FROM file WHERE id = ?', { id: fileId });
    if (!file) return null;
    const project = pool.get('SELECT team_id FROM project WHERE id = ?', { id: file.project_id });
    return project ? project.team_id : null;
  }

  return null;
}

/**
 * Build a font filename from variant metadata and MIME type.
 * Mirrors `app.rpc.commands.fonts/make-variant-filename`.
 *
 * @param {Record<string, *>} variant - Font variant row.
 * @param {string} mtype - MIME type (e.g. 'font/woff2').
 * @returns {string} Human-readable filename.
 */
function makeVariantFilename(variant, mtype) {
  const ext = mtypeToExtension(mtype);
  const style = variant.font_style === 'normal' ? '' : `-${variant.font_style}`;
  return `${variant.font_family}-${variant.font_weight}${style}.${ext}`;
}

/**
 * Map MIME type to file extension.
 *
 * @param {string} mtype - MIME type.
 * @returns {string} File extension without dot.
 */
function mtypeToExtension(mtype) {
  const map = {
    'font/ttf': 'ttf',
    'font/otf': 'otf',
    'font/woff': 'woff',
    'font/woff2': 'woff2',
    'application/x-font-ttf': 'ttf',
    'application/x-font-otf': 'otf',
    'application/x-font-woff': 'woff',
    'application/x-font-woff2': 'woff2',
    'application/font-ttf': 'ttf',
    'application/font-otf': 'otf',
    'application/font-woff': 'woff',
    'application/font-woff2': 'woff2',
  };
  return map[mtype] || 'bin';
}

/**
 * Assemble font data from chunked upload sessions.
 * Mirrors `app.rpc.commands.media/assemble-chunks` for fonts.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 * @param {string} sessionId - Upload session ID.
 * @returns {{ path: string, mtype: string, size: number }}
 */
function assembleChunks(pool, sessionId) {
  const session = pool.get('SELECT * FROM upload_session WHERE id = ?', { id: sessionId });
  if (!session) {
    throw new RpcError('validation', 'validation-error', 'Upload session not found');
  }

  const chunks = pool.query(
    "SELECT * FROM storage_object WHERE metadata IS NOT NULL AND deleted_at IS NULL ORDER BY (json_extract(metadata, '$.chunk_index')) ASC",
    {}
  ).filter(row => {
    try {
      const meta = JSON.parse(row.metadata || '{}');
      return meta.upload_id === sessionId;
    } catch { return false; }
  });

  if (chunks.length !== session.total_chunks) {
    throw new RpcError('validation', 'missing-chunks',
      `Expected ${session.total_chunks} chunks, found ${chunks.length}`);
  }

  // Note: For font chunks, we return info about the session for further processing
  // The actual content assembly happens in the handler
  return { session, chunks };
}

/**
 * Register all font-related RPC commands.
 *
 * @param {function(string, import('./dispatcher.js').RpcMethodDefinition): void} register
 * @param {import('../db/sqlite.js').DatabasePool} pool
 */
export default function registerFontCommands(register, pool) {

  // --- QUERY: get-font-variants ---

  register('get-font-variants', {
    auth: true,
    added: '1.18',
    async handler(params, ctx) {
      const { teamId, fileId, projectId } = params;
      const resolvedTeamId = resolveTeamId(pool, { teamId, projectId, fileId });

      if (!resolvedTeamId) {
        throw new RpcError('not-found', 'object-not-found', 'Team not found');
      }

      checkTeamReadPermissions(pool, ctx.profileId, resolvedTeamId);

      const variants = pool.query(
        `SELECT * FROM team_font_variant
         WHERE team_id = ? AND deleted_at IS NULL`,
        [resolvedTeamId]
      );

      return rowsToCamel(variants);
    }
  });

  // --- MUTATION: create-font-variant ---

  register('create-font-variant', {
    auth: true,
    added: '1.18',
    async handler(params, ctx) {
      const { teamId, fontId, fontFamily, fontWeight, fontStyle, uploads } = params;

      if (!VALID_WEIGHTS.has(fontWeight)) {
        throw new RpcError('validation', 'validation-error', `Invalid font weight: ${fontWeight}`);
      }
      if (!VALID_STYLES.has(fontStyle)) {
        throw new RpcError('validation', 'validation-error', `Invalid font style: ${fontStyle}`);
      }

      checkTeamEditionPermissions(pool, ctx.profileId, teamId);

      return await withTempFiles(async () => {
        // Prepare font data from uploads or direct data
        let fontData = params.data || {};
        if (uploads) {
          // Assemble chunked uploads
          for (const [mtype, sessionId] of Object.entries(uploads)) {
            const assembled = assembleChunks(pool, sessionId);
            // Concatenate chunks into a temp file
            const fs = await import('node:fs/promises');
            const tmpPath = path.join(os.tmpdir(), `penpot.font.${crypto.randomUUID()}`);
            const writeStream = require('fs').createWriteStream(tmpPath);
            for (const chunk of assembled.chunks) {
              const chunkData = getStorageObjectData(chunk.id);
              if (chunkData) writeStream.write(chunkData);
            }
            writeStream.end();
            await new Promise(resolve => writeStream.on('finish', resolve));

            const stat = await fs.stat(tmpPath);
            validateMediaType({ mtype, size: stat.size }, FONT_TYPES);
            validateMediaSize({ mtype, size: stat.size }, 'font');

            fontData[mtype] = tmpPath;
          }
        } else if (Object.keys(fontData).length > 0) {
          // Legacy: validate direct data entries
          for (const [mtype, content] of Object.entries(fontData)) {
            validateMediaType({ mtype, size: Buffer.isBuffer(content) ? content.length : 0 }, FONT_TYPES);
          }
        } else {
          throw new RpcError('validation', 'validation-error', 'Font data or uploads required');
        }

        // Generate missing font formats
        const generatedData = await generateFonts(fontData);

        // Verify at least one usable format was generated
        const hasUsableFormat =
          generatedData['font/otf'] || generatedData['font/ttf'] ||
          generatedData['font/woff'] || generatedData['font/woff2'];

        if (!hasUsableFormat) {
          throw new RpcError('validation', 'invalid-font-upload', 'Invalid font upload: unable to generate missing font assets');
        }

        // Store each font format as a storage object
        const assets = {};

        for (const [mtype, filePath] of Object.entries(generatedData)) {
          const fs = await import('node:fs/promises');
          const data = await fs.readFile(filePath);
          const hash = calculateHash(data);
          const obj = putStorageObject(pool, data, {
            contentType: mtype,
            bucket: 'team-font-variant',
            size: data.length,
            deduplicate: true,
          });

          if (mtype === 'font/otf') assets.otf = obj;
          else if (mtype === 'font/ttf') assets.ttf = obj;
          else if (mtype === 'font/woff') assets.woff1 = obj;
          else if (mtype === 'font/woff2') assets.woff2 = obj;
        }

        // Insert database row
        const id = uuidv4();
        const now = new Date().toISOString();
        const result = pool.insertOnConflictDoNothing('team_font_variant', {
          id,
          team_id: teamId,
          font_id: fontId || uuidv4(),
          font_family: fontFamily,
          font_weight: fontWeight,
          font_style: fontStyle,
          variant_name: params.variantName || null,
          otf_file_id: assets.otf?.id || null,
          ttf_file_id: assets.ttf?.id || null,
          woff1_file_id: assets.woff1?.id || null,
          woff2_file_id: assets.woff2?.id || null,
          created_at: now,
          modified_at: now,
        });

        return rowToCamel(pool.get('SELECT * FROM team_font_variant WHERE id = ?', { id }));
      });
    }
  });

  // --- MUTATION: update-font ---

  register('update-font', {
    auth: true,
    added: '1.18',
    async handler(params, ctx) {
      const { teamId, id, name } = params;

      checkTeamEditionPermissions(pool, ctx.profileId, teamId);

      pool.run(
        `UPDATE team_font_variant SET font_family = ?, modified_at = ?
         WHERE font_id = ? AND team_id = ?`,
        [name, new Date().toISOString(), id, teamId]
      );

      return { id, name };
    }
  });

  // --- MUTATION: delete-font ---

  register('delete-font', {
    auth: true,
    added: '1.18',
    async handler(params, ctx) {
      const { teamId, id } = params;

      checkTeamEditionPermissions(pool, ctx.profileId, teamId);

      // Soft-delete all variants for this font
      const variants = pool.query(
        `SELECT * FROM team_font_variant WHERE font_id = ? AND team_id = ? AND deleted_at IS NULL`,
        [id, teamId]
      );

      if (!variants.length) {
        throw new RpcError('not-found', 'object-not-found', 'Font not found');
      }

      const now = new Date().toISOString();
      for (const variant of variants) {
        pool.run(
          'UPDATE team_font_variant SET deleted_at = ? WHERE id = ?',
          [now, variant.id]
        );

        // Touch font file storage objects for GC
        for (const col of ['otf_file_id', 'ttf_file_id', 'woff1_file_id', 'woff2_file_id']) {
          if (variant[col]) {
            touchStorageObject(pool, variant[col]);
          }
        }
      }

      return { id, teamId };
    }
  });

  // --- MUTATION: delete-font-variant ---

  register('delete-font-variant', {
    auth: true,
    added: '1.18',
    async handler(params, ctx) {
      const { teamId, id } = params;

      checkTeamEditionPermissions(pool, ctx.profileId, teamId);

      const variant = pool.get(
        `SELECT * FROM team_font_variant WHERE id = ? AND team_id = ? AND deleted_at IS NULL`,
        { id, team_id: teamId }
      );

      if (!variant) {
        throw new RpcError('not-found', 'object-not-found', 'Font variant not found');
      }

      const now = new Date().toISOString();
      pool.run('UPDATE team_font_variant SET deleted_at = ? WHERE id = ?', [now, id]);

      // Touch font file storage objects for GC
      for (const col of ['otf_file_id', 'ttf_file_id', 'woff1_file_id', 'woff2_file_id']) {
        if (variant[col]) {
          touchStorageObject(pool, variant[col]);
        }
      }

      return { id };
    }
  });

  // --- QUERY: download-font ---

  register('download-font', {
    auth: true,
    added: '2.15',
    async handler(params, ctx) {
      const { id } = params;

      const variant = pool.get(
        'SELECT * FROM team_font_variant WHERE id = ? AND deleted_at IS NULL',
        { id }
      );

      if (!variant) {
        throw new RpcError('not-found', 'object-not-found', 'Font variant not found');
      }

      checkTeamReadPermissions(pool, ctx.profileId, variant.team_id);

      // Try to get the best available format (prefer TTF for broader compatibility)
      const mediaId = variant.ttf_file_id || variant.otf_file_id ||
        variant.woff2_file_id || variant.woff1_file_id;

      if (!mediaId) {
        throw new RpcError('not-found', 'object-not-found', 'No font file available');
      }

      const sobj = getStorageObject(pool, mediaId);
      const mtype = sobj?.content_type || 'application/octet-stream';

      return {
        id: mediaId,
        uri: getStorageObjectUrl(mediaId),
        name: makeVariantFilename(variant, mtype),
      };
    }
  });

  // --- QUERY: download-font-family ---

  register('download-font-family', {
    auth: true,
    added: '2.15',
    async handler(params, ctx) {
      const { fontId } = params;

      const variants = pool.query(
        `SELECT * FROM team_font_variant WHERE font_id = ? AND deleted_at IS NULL`,
        [fontId]
      );

      if (!variants.length) {
        throw new RpcError('not-found', 'object-not-found', 'Font family not found');
      }

      checkTeamReadPermissions(pool, ctx.profileId, variants[0].team_id);

      // Create a zip file containing all font variants
      const archiver = (await import('archiver')).default;
      const fs = await import('node:fs/promises');
      const os = await import('node:os');
      const path = await import('node:path');

      const tmpPath = path.join(os.tmpdir(), `penpot.font-family.${fontId}.zip`);
      const output = require('fs').createWriteStream(tmpPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      const zipPromise = new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
        archive.on('error', reject);
      });

      archive.pipe(output);

      for (const variant of variants) {
        const mediaId = variant.ttf_file_id || variant.otf_file_id ||
          variant.woff2_file_id || variant.woff1_file_id;
        if (!mediaId) continue;

        const sobj = getStorageObject(pool, mediaId);
        const mtype = sobj?.content_type || 'application/octet-stream';
        const fileName = makeVariantFilename(variant, mtype);
        const fontData = getStorageObjectData(mediaId);

        if (fontData) {
          archive.append(Buffer.from(fontData), { name: fileName });
        }
      }

      await archive.finalize();
      await zipPromise;

      // Store the zip as a temporary storage object with 30min TTL
      const zipData = await fs.readFile(tmpPath);
      const zipObj = putStorageObject(pool, zipData, {
        contentType: 'application/zip',
        bucket: 'tempfile',
        size: zipData.length,
        touchedAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      // Clean up temp file
      try { await fs.unlink(tmpPath); } catch { /* ignore */ }

      const ffamily = variants[0].font_family;
      return {
        id: zipObj.id,
        uri: getStorageObjectUrl(zipObj.id),
        name: `${ffamily}.zip`,
      };
    }
  });
}