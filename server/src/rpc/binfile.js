'use strict';
/**
 * @module rpc/binfile
 * @description Binary file import/export RPC commands — mirrors `app.rpc.commands.binfile`
 * and `app.binfile.v3` from the Clojure backend.
 *
 * | Method              | Auth | Since  |
 * |---------------------|:----:|--------|
 * | `export-binfile`    | Yes  | 1.15   |
 * | `import-binfile`    | Yes  | 1.15   |
 * | `get-export-status` | Yes  | 2.8    |
 *
 * The binfile format is a Penpot-specific ZIP archive for file transfer.
 * Export creates a ZIP with structured entries (manifest, pages, media,
 * components, colors, typographies, storage objects, thumbnails).
 * Import extracts and creates new files with ID remapping.
 *
 * ZIP structure (v3):
 * ```
 * manifest.json                  — Export manifest with type/version/files/relations
 * files/{fileId}.json            — Per-file metadata (name, is-shared, features, etc.)
 * pages/{pageId}.json            — Per-page data (name, objects, width, height)
 * media/{mediaId}.json           — Per-media metadata
 * components/{compId}.json       — Per-component metadata
 * colors/{colorId}.json          — Per-color metadata
 * typographies/{typoId}.json     — Per-typography metadata
 * tokens/{fileId}.json           — Per-file tokens-lib data
 * objects/{objectId}.json         — Per-storage-object metadata
 * objects/{objectId}{ext}         — Per-storage-object binary data
 * thumbnails/{tag}/{pageId}/{objId}.json — Thumbnail metadata
 * ```
 */

import { v4 as uuidv4 } from 'uuid';
import { ZipArchive } from 'archiver';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { RpcError } from './dispatcher.js';
import { decode, encode } from '../files/blob.js';
import { putStorageObject, getStorageObjectData, getStorageObject } from '../storage/fs.js';

const MANIFEST_TYPE = 'penpot/export-files';
const MANIFEST_VERSION = 3;

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

function collectMediaRefs(data) {
  const refs = new Set();
  if (!data) return refs;
  const pages = data.pages || Object.values(data.pagesIndex || {});
  for (const page of pages) {
    const objects = page?.objects || {};
    const objArr = Array.isArray(objects) ? objects : Object.values(objects);
    for (const shape of objArr) {
      if (!shape) continue;
      scanShapeMedia(shape, refs);
    }
  }
  return refs;
}

function scanShapeMedia(shape, refs) {
  if (!shape) return;
  if (shape.fills) {
    for (const fill of shape.fills) {
      if (fill && fill['fill-type'] === 'image' && fill['fill-image-media']) {
        refs.add(fill['fill-image-media']);
      }
    }
  }
  if (shape.strokes) {
    for (const stroke of shape.strokes) {
      if (stroke && stroke['stroke-type'] === 'image' && stroke['stroke-image-media']) {
        refs.add(stroke['stroke-image-media']);
      }
    }
  }
  const children = shape.shapes || shape.children || [];
  const childArr = Array.isArray(children) ? children : Object.values(children);
  for (const child of childArr) {
    if (typeof child === 'object' && child !== null) scanShapeMedia(child, refs);
  }
}

function remapIds(data, idMap) {
  if (!data || !idMap) return data;
  const json = JSON.stringify(data);
  const remapped = json.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    (match) => idMap[match] || match
  );
  try {
    return JSON.parse(remapped);
  } catch {
    return data;
  }
}

function cleanShapePreDecode(shape) {
  if (!shape || typeof shape !== 'object') return shape;
  const cleaned = { ...shape };
  if (cleaned['bool-content'] !== undefined && cleaned['boolContent'] === undefined) {
    cleaned['boolContent'] = cleaned['bool-content'];
    delete cleaned['bool-content'];
  }
  if (cleaned['shadow-color'] !== undefined && cleaned['shadowColor'] === undefined) {
    cleaned['shadowColor'] = cleaned['shadow-color'];
    delete cleaned['shadow-color'];
  }
  if (cleaned['fill-color-ref-file'] !== undefined && cleaned['fillColorRefFile'] === undefined) {
    cleaned['fillColorRefFile'] = cleaned['fill-color-ref-file'];
    delete cleaned['fill-color-ref-file'];
  }
  if (cleaned['stroke-color-ref-file'] !== undefined && cleaned['strokeColorRefFile'] === undefined) {
    cleaned['strokeColorRefFile'] = cleaned['stroke-color-ref-file'];
    delete cleaned['stroke-color-ref-file'];
  }
  const childKeys = ['shapes', 'children'];
  for (const key of childKeys) {
    if (Array.isArray(cleaned[key])) {
      cleaned[key] = cleaned[key].map(child =>
        typeof child === 'object' ? cleanShapePreDecode(child) : child
      );
    }
  }
  return cleaned;
}

function cleanShapePostDecode(shape) {
  if (!shape || typeof shape !== 'object') return shape;
  const cleaned = { ...shape };
  if (cleaned.type === 'frame' && cleaned.shapes && cleaned.shapes.length > 0) {
    let hasRoot = false;
    for (const childId of cleaned.shapes) {
      if (typeof childId === 'string' && childId.startsWith('root-')) {
        hasRoot = true;
        break;
      }
    }
    if (hasRoot) {
      cleaned.shapes = cleaned.shapes.filter(id =>
        typeof id !== 'string' || !id.startsWith('root-')
      );
    }
  }
  if (cleaned['flex-direction'] !== undefined) {
    const flexDirMap = {
      'row': 'row',
      'row-reverse': 'row-reverse',
      'column': 'column',
      'column-reverse': 'column-reverse',
      'lr': 'row',
      'rl': 'row-reverse',
      'tb': 'column',
      'bt': 'column-reverse',
    };
    if (flexDirMap[cleaned['flex-direction']] && !cleaned['layout-flex-dir']) {
      cleaned['layout-flex-dir'] = flexDirMap[cleaned['flex-direction']];
      delete cleaned['flex-direction'];
    }
  }
  return cleaned;
}

function cleanImportData(data) {
  if (!data) return data;
  const cleaned = { ...data };
  const pages = cleaned.pages || Object.values(cleaned.pagesIndex || {});
  const cleanedPages = pages.map(page => {
    if (!page) return page;
    const cPage = { ...page };
    if (cPage.objects) {
      const objMap = {};
      const objects = Array.isArray(cPage.objects) ? cPage.objects : Object.values(cPage.objects);
      for (const shape of objects) {
        if (!shape || !shape.id) continue;
        objMap[shape.id] = cleanShapePostDecode(cleanShapePreDecode(shape));
      }
      cPage.objects = objMap;
    }
    return cPage;
  });
  if (Array.isArray(cleaned.pages)) {
    cleaned.pages = cleanedPages;
  }
  if (cleaned.pagesIndex) {
    cleaned.pagesIndex = {};
    for (const page of cleanedPages) {
      if (page && page.id) cleaned.pagesIndex[page.id] = page;
    }
  }
  return cleaned;
}

function applyFeatureMigrations(data) {
  if (!data) return data;
  const result = { ...data };
  result.version = result.version || 0;
  if (!result.features) result.features = [];
  if (typeof result.features === 'object' && !Array.isArray(result.features)) {
    result.features = Object.keys(result.features);
  }
  const requiredFeatures = [
    'fdata/shape-data-type',
    'styles/v2',
    'layout/grid',
    'components/v2',
    'plugins/runtime',
    'design-tokens/v1',
    'variants/v1',
  ];
  const featureSet = new Set([...result.features, ...requiredFeatures]);
  result.features = [...featureSet];
  return result;
}

function createIdMap(data) {
  const idMap = {};
  function addId(oldId) {
    if (!oldId || idMap[oldId]) return idMap[oldId] || oldId;
    const newId = uuidv4();
    idMap[oldId] = newId;
    return newId;
  }
  if (data.id) addId(data.id);
  if (data.pages) {
    if (Array.isArray(data.pages)) {
      for (const pageId of data.pages) {
        if (typeof pageId === 'string') addId(pageId);
      }
    }
  }
  if (data.pagesIndex) {
    for (const [pageId, pageData] of Object.entries(data.pagesIndex)) {
      addId(pageId);
      if (pageData && pageData.objects) {
        const objects = Array.isArray(pageData.objects) ? pageData.objects : Object.values(pageData.objects);
        for (const shape of objects) {
          if (shape && shape.id) addId(shape.id);
        }
      }
    }
  }
  if (data.components) {
    for (const compId of Object.keys(data.components)) {
      addId(compId);
    }
  }
  if (data.media) {
    for (const mediaId of Object.keys(data.media)) {
      addId(mediaId);
    }
  }
  if (data.colors) {
    if (Array.isArray(data.colors)) {
      for (const color of data.colors) {
        if (color && color.id) addId(color.id);
      }
    } else {
      for (const colorId of Object.keys(data.colors)) {
        addId(colorId);
      }
    }
  }
  if (data.typographies) {
    if (Array.isArray(data.typographies)) {
      for (const typo of data.typographies) {
        if (typo && typo.id) addId(typo.id);
      }
    } else {
      for (const typoId of Object.keys(data.typographies)) {
        addId(typoId);
      }
    }
  }
  return idMap;
}

function createZipArchive(manifest, fileDataEntries, storageObjects) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', (err) => reject(err));
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    for (const [path, data] of fileDataEntries) {
      if (Buffer.isBuffer(data)) {
        archive.append(data, { name: path });
      } else {
        archive.append(JSON.stringify(data), { name: path });
      }
    }
    for (const [path, buffer] of storageObjects) {
      archive.append(buffer, { name: path });
    }
    archive.finalize();
  });
}

async function loadFileData(pool, fileId) {
  const fileData = pool.get(
    'SELECT * FROM file_data WHERE file_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1',
    [fileId, 'main']
  );
  if (!fileData || !fileData.data) return null;
  try {
    return typeof fileData.data === 'string' || Buffer.isBuffer(fileData.data)
      ? await decode(fileData.data)
      : fileData.data;
  } catch {
    try {
      return JSON.parse(typeof fileData.data === 'string' ? fileData.data : fileData.data.toString());
    } catch {
      return null;
    }
  }
}

async function waitForExport(pool, taskId, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const task = pool.get('SELECT * FROM storage_object WHERE id = ? AND deleted_at IS NULL', { id: taskId });
    if (task) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

export default function registerBinfileCommands(register, pool) {

  register('export-binfile', {
    auth: true,
    added: '1.15',
    handler: async (params, ctx) => {
      const { fileId, includeLibraries = false, embedAssets = false } = params;

      checkReadPermissions(pool, ctx.profileId, fileId);

      const file = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', { id: fileId });
      if (!file) {
        throw new RpcError('not-found', 'object-not-found', 'File not found');
      }

      const data = await loadFileData(pool, fileId);
      if (!data) {
        throw new RpcError('not-found', 'object-not-found', 'File data not found');
      }

      const fileIdStr = file.id;
      const featureStr = typeof file.features === 'string' ? file.features : '';

      const fileFeatures = featureStr
        ? featureStr.split(',').map(f => f.trim()).filter(Boolean)
        : [];

      const manifestFiles = [{
        id: fileIdStr,
        name: file.name,
        'is-shared': file.is_shared === '1',
        features: fileFeatures,
        data: {},
      }];

      const fileDataEntries = [];

      fileDataEntries.push([`files/${fileIdStr}.json`, {
        id: fileIdStr,
        name: file.name,
        'is-shared': file.is_shared === '1',
        features: fileFeatures,
        data: data,
      }]);

      const mediaRefs = collectMediaRefs(data);
      const mediaObjects = pool.query(
        'SELECT * FROM file_media_object WHERE file_id = ? AND deleted_at IS NULL',
        [fileId]
      );
      for (const mObj of mediaObjects) {
        if (mediaRefs.has(mObj.media_id) || embedAssets) {
          fileDataEntries.push([`media/${mObj.media_id}.json`, {
            id: mObj.id,
            mediaId: mObj.media_id,
            name: mObj.name,
            mtype: mObj.mtype,
            width: mObj.width,
            height: mObj.height,
            isLocal: mObj.is_local === '1',
          }]);
          if (mObj.media_id) {
            try {
              const blobData = getStorageObjectData(mObj.media_id);
              if (blobData) {
                const ext = getExtFromMtype(mObj.mtype);
                fileDataEntries.push([`objects/${mObj.media_id}.json`, {
                  id: mObj.media_id,
                  content_type: mObj.mtype,
                  size: blobData.length,
                }]);
                fileDataEntries.push([`objects/${mObj.media_id}${ext}`, blobData]);
              }
            } catch (e) {
              console.warn(`[binfile] Could not export storage object ${mObj.media_id}: ${e.message}`);
            }
          }
          if (mObj.thumbnail_id) {
            try {
              const thumbData = getStorageObjectData(mObj.thumbnail_id);
              if (thumbData) {
                fileDataEntries.push([`objects/${mObj.thumbnail_id}.json`, {
                  id: mObj.thumbnail_id,
                  content_type: 'image/png',
                  size: thumbData.length,
                }]);
                fileDataEntries.push([`objects/${mObj.thumbnail_id}.png`, thumbData]);
              }
            } catch (e) {
              console.warn(`[binfile] Could not export thumbnail ${mObj.thumbnail_id}: ${e.message}`);
            }
          }
        }
      }

      if (data.colors) {
        const colors = Array.isArray(data.colors) ? data.colors : Object.entries(data.colors).map(([id, c]) => ({ id, ...c }));
        for (const color of colors) {
          if (color && color.id) {
            fileDataEntries.push([`colors/${color.id}.json`, color]);
          }
        }
      }

      if (data.typographies) {
        const typos = Array.isArray(data.typographies) ? data.typographies : Object.entries(data.typographies).map(([id, t]) => ({ id, ...t }));
        for (const typo of typos) {
          if (typo && typo.id) {
            fileDataEntries.push([`typographies/${typo.id}.json`, typo]);
          }
        }
      }

      if (data.components) {
        for (const [compId, comp] of Object.entries(data.components)) {
          if (comp) {
            fileDataEntries.push([`components/${compId}.json`, comp]);
          }
        }
      }

      const relations = [];

      if (includeLibraries) {
        const libRels = pool.query('SELECT * FROM file_library_rel WHERE file_id = ?', [fileId]);
        for (const rel of libRels) {
          const libFile = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', { id: rel.library_file_id });
          if (libFile) {
            const libData = await loadFileData(pool, libFile.id);
            const libFeatures = (typeof libFile.features === 'string' ? libFile.features : '').split(',').map(f => f.trim()).filter(Boolean);

            manifestFiles.push({
              id: libFile.id,
              name: libFile.name,
              'is-shared': true,
              features: libFeatures,
              data: {},
            });

            fileDataEntries.push([`files/${libFile.id}.json`, {
              id: libFile.id,
              name: libFile.name,
              'is-shared': true,
              features: libFeatures,
              data: libData || { pages: [], pagesIndex: {}, components: {}, media: {}, colors: {}, typographies: {} },
            }]);

            relations.push([fileIdStr, libFile.id]);

            if (libData) {
              const libMediaRefs = collectMediaRefs(libData);
              const libMediaObjects = pool.query(
                'SELECT * FROM file_media_object WHERE file_id = ? AND deleted_at IS NULL',
                [libFile.id]
              );
              for (const mObj of libMediaObjects) {
                if (libMediaRefs.has(mObj.media_id) || embedAssets) {
                  fileDataEntries.push([`media/${mObj.media_id}.json`, {
                    id: mObj.id,
                    mediaId: mObj.media_id,
                    name: mObj.name,
                    mtype: mObj.mtype,
                    width: mObj.width,
                    height: mObj.height,
                    isLocal: mObj.is_local === '1',
                  }]);
                  if (mObj.media_id) {
                    try {
                      const blobData = getStorageObjectData(mObj.media_id);
                      if (blobData) {
                        const ext = getExtFromMtype(mObj.mtype);
                        fileDataEntries.push([`objects/${mObj.media_id}.json`, {
                          id: mObj.media_id,
                          content_type: mObj.mtype,
                          size: blobData.length,
                        }]);
                        fileDataEntries.push([`objects/${mObj.media_id}${ext}`, blobData]);
                      }
                    } catch (e) {
                      console.warn(`[binfile] Could not export lib storage object ${mObj.media_id}: ${e.message}`);
                    }
                  }
              }

              if (libData.colors) {
                const libColors = Array.isArray(libData.colors) ? libData.colors : Object.entries(libData.colors).map(([id, c]) => ({ id, ...c }));
                for (const color of libColors) {
                  if (color && color.id) fileDataEntries.push([`colors/${color.id}.json`, color]);
                }
              }
              if (libData.typographies) {
                const libTypos = Array.isArray(libData.typographies) ? libData.typographies : Object.entries(libData.typographies).map(([id, t]) => ({ id, ...t }));
                for (const typo of libTypos) {
                  if (typo && typo.id) fileDataEntries.push([`typographies/${typo.id}.json`, typo]);
                }
              }
              if (libData.components) {
                for (const [compId, comp] of Object.entries(libData.components)) {
                  if (comp) fileDataEntries.push([`components/${compId}.json`, comp]);
                }
              }
            }
            }
          }
        }
      }

      const manifest = {
        type: MANIFEST_TYPE,
        version: MANIFEST_VERSION,
        'generated-by': 'penpot-js',
        created: new Date().toISOString(),
        features: [],
        files: manifestFiles,
        relations,
      };

      const zipBuffer = await createZipArchive(manifest, fileDataEntries, []);

      const storageObj = putStorageObject(pool, zipBuffer, {
        contentType: 'application/zip',
        bucket: 'tempfile',
      });

      const publicUri = process.env.PENPOT_PUBLIC_URI || 'http://localhost:6060';
      return {
        id: storageObj.id,
        uri: `${publicUri}/assets/by-id/${storageObj.id}`,
        name: `${file.name}.penpot`,
      };
    },
  });

  register('import-binfile', {
    auth: true,
    added: '1.15',
    handler: async (params, ctx) => {
      const { projectId, name, file: uploadedFile, uploadId, version, fileId: overwriteFileId } = params;

      checkEditionPermissions(pool, ctx.profileId, projectId);

      let rawBuffer = null;

      if (uploadId) {
        const session = pool.get('SELECT * FROM upload_session WHERE id = ? AND deleted_at IS NULL', { id: uploadId });
        if (!session) {
          throw new RpcError('not-found', 'object-not-found', 'Upload session not found');
        }
        if (session.file_path) {
          try {
            rawBuffer = await readFile(session.file_path);
          } catch (readErr) {
            throw new RpcError('validation', 'validation-error', `Could not read uploaded file: ${readErr.message}`);
          }
          try { await rm(session.file_path).catch(() => {}); } catch {}
        } else {
          throw new RpcError('validation', 'validation-error', 'Upload session has no file data');
        }
      } else if (uploadedFile) {
        if (Buffer.isBuffer(uploadedFile)) {
          rawBuffer = uploadedFile;
        } else if (typeof uploadedFile === 'string') {
          rawBuffer = Buffer.from(uploadedFile);
        } else if (uploadedFile instanceof ArrayBuffer) {
          rawBuffer = Buffer.from(uploadedFile);
        } else if (uploadedFile instanceof Uint8Array) {
          rawBuffer = Buffer.from(uploadedFile);
        }
      }

      if (!rawBuffer) {
        throw new RpcError('validation', 'validation-error', 'No file data provided');
      }

      const parsed = await parseImportBuffer(rawBuffer);
      return importParsedFiles(pool, parsed, { projectId, profileId: ctx.profileId, name, overwriteFileId });
    },
  });

  register('get-export-status', {
    auth: true,
    added: '2.8',
    handler: async (params, ctx) => {
      const { id } = params;
      if (!id) throw new RpcError('validation', 'validation-error', 'Export ID required');

      const obj = getStorageObject(pool, id);
      if (!obj || obj.deleted_at) {
        return { status: 'not-found' };
      }
      return {
        status: 'completed',
        id: obj.id,
        size: obj.size,
        contentType: obj.content_type,
      };
    },
  });
}

function getExtFromMtype(mtype) {
  if (!mtype) return '.bin';
  if (mtype.includes('png')) return '.png';
  if (mtype.includes('jpeg') || mtype.includes('jpg')) return '.jpg';
  if (mtype.includes('webp')) return '.webp';
  if (mtype.includes('gif')) return '.gif';
  if (mtype.includes('svg')) return '.svg';
  if (mtype.includes('pdf')) return '.pdf';
  if (mtype.includes('woff2')) return '.woff2';
  if (mtype.includes('woff')) return '.woff';
  if (mtype.includes('ttf')) return '.ttf';
  if (mtype.includes('otf')) return '.otf';
  return '.bin';
}

export { parseImportBuffer, importParsedFiles };

async function importParsedFiles(pool, parsed, opts) {
  const { projectId, profileId, name, overwriteFileId } = opts;
  const result = [];
  const sharedFileIds = {};
  const sourceToNewIdMap = {};

  for (let i = 0; i < parsed.files.length; i++) {
    const entry = parsed.files[i];
    const newFileId = uuidv4();
    const fileName = (i === 0 ? name : null) || entry.name || `Imported File${parsed.files.length > 1 ? ` ${i + 1}` : ''}`;
    const now = new Date().toISOString();

    let data = entry.data || { pages: [], pagesIndex: {}, components: {}, media: {}, colors: {}, typographies: {} };

    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { /* keep as is */ }
    }

    data = remapIds(data, createIdMap(data));
    data = normalizeImportData(data);
    data = cleanImportData(data);
    data = applyFeatureMigrations(data);

    const mediaRefMap = {};
    if (data.media && typeof data.media === 'object') {
      const mediaEntries = Array.isArray(data.media) ? data.media : Object.entries(data.media).map(([id, m]) => ({ id, ...m }));
      for (const mediaObj of mediaEntries) {
        if (!mediaObj || !mediaObj.mediaId && !mediaObj.id) continue;
        const oldMediaId = mediaObj.mediaId || mediaObj.id;
        const newMediaId = uuidv4();
        mediaRefMap[oldMediaId] = newMediaId;

        const existingMedia = pool.get('SELECT id FROM file_media_object WHERE media_id = ? AND deleted_at IS NULL', [oldMediaId]);

        if (!existingMedia) {
          const mediaZipEntry = parsed.media.get(oldMediaId);
          if (mediaZipEntry) {
            data.media[oldMediaId] = typeof mediaZipEntry === 'object' && !Buffer.isBuffer(mediaZipEntry)
              ? { ...mediaZipEntry, mediaId: newMediaId }
              : { ...data.media[oldMediaId], mediaId: newMediaId };
          }

          const storageEntry = parsed.storageObjects.get(oldMediaId);
          if (storageEntry) {
            try {
              const storageMeta = storageEntry.meta;
              const storageData = storageEntry.data;
              const storedObj = putStorageObject(pool, storageData, {
                contentType: storageMeta?.content_type || 'application/octet-stream',
                bucket: 'file-media-object',
                size: storageData.length,
                deduplicate: true,
              });

              let thumbnailId = null;
              if (mediaZipEntry && mediaZipEntry.thumbnail_id) {
                const thumbEntry = parsed.storageObjects.get(mediaZipEntry.thumbnail_id);
                if (thumbEntry) {
                  const thumbStoredObj = putStorageObject(pool, thumbEntry.data, {
                    contentType: 'image/png',
                    bucket: 'file-media-object',
                    size: thumbEntry.data.length,
                    deduplicate: true,
                  });
                  thumbnailId = thumbStoredObj.id;
                }
              }

              pool.insertOnConflictDoNothing('file_media_object', {
                id: uuidv4(),
                file_id: newFileId,
                media_id: storedObj.id,
                name: mediaZipEntry?.name || 'image',
                mtype: storageMeta?.content_type || 'image/png',
                width: mediaZipEntry?.width || 0,
                height: mediaZipEntry?.height || 0,
                thumbnail_id: thumbnailId,
                created_at: now,
              });
            } catch (mediaErr) {
              console.warn(`[binfile] media import warning for ${oldMediaId}: ${mediaErr.message}`);
            }
          } else {
            pool.insertOnConflictDoNothing('file_media_object', {
              id: uuidv4(),
              file_id: newFileId,
              media_id: newMediaId,
              mtype: mediaZipEntry?.mtype || mediaZipEntry?.['content-type'] || 'image/png',
              width: mediaZipEntry?.width || 0,
              height: mediaZipEntry?.height || 0,
              created_at: now,
            });
          }
        }
      }

      const mediaJsonStr = JSON.stringify(data.media);
      let remappedMediaStr = mediaJsonStr;
      for (const [oldId, newId] of Object.entries(mediaRefMap)) {
        remappedMediaStr = remappedMediaStr.replaceAll(oldId, newId);
      }
      try { data.media = JSON.parse(remappedMediaStr); } catch { /* keep as is */ }
    }

    const encoded = await encode(data, { version: 5 });

    if (overwriteFileId && i === 0) {
      pool.run('UPDATE file_data SET deleted_at = ? WHERE file_id = ?', [now, overwriteFileId]);
      pool.insertOnConflictDoNothing('file_data', {
        id: uuidv4(),
        file_id: overwriteFileId,
        type: 'main',
        data: encoded,
        created_at: now,
        modified_at: now,
      });
      pool.run('UPDATE file SET revn = revn + 1, modified_at = ? WHERE id = ?', [now, overwriteFileId]);
      result.push(overwriteFileId);
      sourceToNewIdMap[entry.id || 'file-0'] = overwriteFileId;
    } else {
      pool.insertOnConflictDoNothing('file', {
        id: newFileId,
        project_id: projectId,
        name: fileName,
        revn: 1,
        is_shared: entry['is-shared'] ? '1' : '0',
        created_at: now,
        modified_at: now,
        features: Array.isArray(data.features) ? data.features.join(',') : '',
      });

      pool.insertOnConflictDoNothing('file_data', {
        id: uuidv4(),
        file_id: newFileId,
        type: 'main',
        data: encoded,
        created_at: now,
        modified_at: now,
      });

      const proj = pool.get('SELECT team_id FROM project WHERE id = ?', { id: projectId });
      if (proj) {
        pool.insertOnConflictDoNothing('file_profile_rel', {
          file_id: newFileId,
          profile_id: profileId,
          is_owner: '1',
          is_admin: '1',
          can_edit: '1',
          created_at: now,
        });
      }

      if (entry['is-shared']) {
        sharedFileIds[entry.id || newFileId] = newFileId;
      }

      sourceToNewIdMap[entry.id || `file-${i}`] = newFileId;
      result.push(newFileId);
    }
  }

  if (Object.keys(sharedFileIds).length > 0 && result.length > 0) {
    const mainFileId = result[0];
    for (const [sourceId, libFileId] of Object.entries(sharedFileIds)) {
      if (libFileId !== mainFileId) {
        pool.run(
          'INSERT OR IGNORE INTO file_library_rel (file_id, library_file_id, created_at) VALUES (?, ?, ?)',
          [mainFileId, libFileId, new Date().toISOString()]
        );
      }
    }
  }

  for (const [sourceFileId, targetFileId] of Object.entries(sharedFileIds)) {
    pool.run(
      'INSERT OR IGNORE INTO file_library_rel (file_id, library_file_id, created_at) VALUES (?, ?, ?)',
      [result[0], targetFileId, new Date().toISOString()]
    );
  }

  if (parsed.relations && parsed.relations.length > 0) {
    for (const rel of parsed.relations) {
      if (Array.isArray(rel) && rel.length >= 2) {
        const [sourceLibId, targetLibId] = rel;
        const newLibId = sourceToNewIdMap[targetLibId] || sourceToNewIdMap[sourceLibId];
        if (newLibId && result[0]) {
          pool.run(
            'INSERT OR IGNORE INTO file_library_rel (file_id, library_file_id, created_at) VALUES (?, ?, ?)',
            [result[0], newLibId, new Date().toISOString()]
          );
        }
      }
    }
  }

  pool.run('UPDATE project SET modified_at = ? WHERE id = ?', [new Date().toISOString(), projectId]);

  return result;
}

async function parseImportBuffer(buffer) {
  if (buffer.length < 4) {
    throw new RpcError('validation', 'validation-error', 'File too short to be a valid archive');
  }

  const header = buffer.subarray(0, 4).toString('hex');
  if (header === '504b0304') {
    return parseZipArchive(buffer);
  }

  try {
    const data = await decode(buffer);
    if (data && data.type === MANIFEST_TYPE) {
      return {
        type: 'penpot-v3-inline',
        files: data.files || [],
        media: new Map(),
        storageObjects: new Map(),
        relations: data.relations || [],
      };
    }
    if (data && data.kind === 'penpot/export') {
      return {
        type: 'penpot-v3-inline',
        files: data.files || [],
        media: new Map(),
        storageObjects: new Map(),
        relations: data.relations || [],
      };
    }
    return {
      type: 'penpot-blob',
      files: [{ data, name: 'Imported File' }],
      media: new Map(),
      storageObjects: new Map(),
      relations: [],
    };
  } catch {
    try {
      const data = JSON.parse(buffer.toString('utf8'));
      return {
        type: 'penpot-json',
        files: Array.isArray(data) ? data : [{ data, name: 'Imported File' }],
        media: new Map(),
        storageObjects: new Map(),
        relations: [],
      };
    } catch {
      throw new RpcError('validation', 'validation-error', 'Could not parse file data');
    }
  }
}

async function parseZipArchive(buffer) {
  const JSZip = await getJSZip();

  let manifest = null;
  const files = [];
  const media = new Map();
  const storageObjects = new Map();
  const relations = [];

  const tmpDir = await mkdtemp(join(tmpdir(), 'penpot-import-'));
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);

    const manifestFile = zip.file('manifest.json');
    if (manifestFile) {
      const manifestText = await manifestFile.async('string');
      manifest = JSON.parse(manifestText);
    }

    const fileEntries = [];
    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir) {
        fileEntries.push({ path: relativePath, entry: zipEntry });
      }
    });

    for (const { path: entryPath, entry } of fileEntries) {
      if (entryPath === 'manifest.json') continue;

      if (entryPath.startsWith('files/') && entryPath.endsWith('.json')) {
        const content = await entry.async('string');
        try {
          const fileData = JSON.parse(content);
          files.push(fileData);
        } catch (e) {
          console.warn(`[binfile] Failed to parse file entry ${entryPath}: ${e.message}`);
        }
      } else if (entryPath.startsWith('media/') && entryPath.endsWith('.json')) {
        const content = await entry.async('string');
        try {
          const mediaObj = JSON.parse(content);
          if (mediaObj.mediaId || mediaObj.id) {
            media.set(mediaObj.mediaId || mediaObj.id, mediaObj);
          }
        } catch (e) {
          console.warn(`[binfile] Failed to parse media entry ${entryPath}: ${e.message}`);
        }
      } else if (entryPath.startsWith('objects/') && entryPath.endsWith('.json')) {
        const content = await entry.async('string');
        try {
          const meta = JSON.parse(content);
          const objectId = meta.id || entryPath.replace('objects/', '').replace('.json', '');
          const ext = getExtFromMtype(meta.content_type);
          const binaryPath = `objects/${objectId}${ext}`;
          const binaryEntry = zip.file(binaryPath);
          if (binaryEntry) {
            const binaryData = await binaryEntry.async('nodebuffer');
            storageObjects.set(objectId, { meta, data: binaryData });
          } else {
            storageObjects.set(objectId, { meta, data: null });
          }
        } catch (e) {
          console.warn(`[binfile] Failed to parse storage object entry ${entryPath}: ${e.message}`);
        }
      }
    }

    if (manifest) {
      if (manifest.relations && Array.isArray(manifest.relations)) {
        relations.push(...manifest.relations);
      }
      if (manifest.files && manifest.files.length > 0 && files.length === 0) {
        for (const mf of manifest.files) {
          if (mf.data) {
            files.push({
              id: mf.id,
              name: mf.name,
              'is-shared': mf['is-shared'],
              features: mf.features,
              data: mf.data,
            });
          }
        }
      }
    }

    for (const fileData of files) {
      if (fileData.data && fileData.data.media) {
        const dataMedia = fileData.data.media;
        const mediaEntries = Array.isArray(dataMedia) ? dataMedia : Object.entries(dataMedia).map(([id, m]) => ({ id, ...m }));
        const pageMediaRefs = collectMediaRefs(fileData.data);
        for (const mObj of mediaEntries) {
          if (mObj && (mObj.mediaId || mObj.id)) {
            const mid = mObj.mediaId || mObj.id;
            if (!media.has(mid) && pageMediaRefs.has(mid)) {
              media.set(mid, mObj);
            }
          }
        }
      }
    }
  } catch (e) {
    if (e instanceof RpcError) throw e;
    throw new RpcError('validation', 'validation-error', `Failed to parse ZIP archive: ${e.message}`);
  } finally {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch {}
  }

  if (files.length === 0 && !manifest) {
    throw new RpcError('validation', 'validation-error', 'No valid file data found in archive');
  }

  if (files.length === 0) {
    const jsonEntries = [];
    for (const { path: entryPath, entry } of Array.from(zip.file || [])) {
      if (!entryPath.startsWith('manifest') && entryPath.endsWith('.json')) {
        try {
          const content = await entry.async('string');
          const pageData = JSON.parse(content);
          if (pageData.objects || pageData.pages) {
            jsonEntries.push(pageData);
          }
        } catch {}
      }
    }
    if (jsonEntries.length > 0) {
      files.push({
        name: 'Imported File',
        data: { pages: jsonEntries, pagesIndex: {}, components: {}, media: {}, colors: {}, typographies: {} },
      });
    }
  }

  return {
    type: manifest ? 'penpot-v3-zip' : 'penpot-v1-zip',
    files,
    media,
    storageObjects,
    relations,
  };
}

let _JSZip = null;
async function getJSZip() {
  if (_JSZip) return _JSZip;
  const mod = await import('jszip');
  _JSZip = mod.default || mod;
  return _JSZip;
}

function normalizeImportData(data) {
  if (!data) return { pages: [], pagesIndex: {}, components: {}, media: {}, colors: {}, typographies: {} };
  const normalized = { ...data };

  if (normalized.pages && Array.isArray(normalized.pages)) {
    normalized.pages = normalized.pages.map((p, i) => normalizeImportPage(p, i)).filter(Boolean);
  } else if (normalized.pagesIndex) {
    const pages = [];
    const idx = { ...normalized.pagesIndex };
    for (const [pageId, pageData] of Object.entries(idx)) {
      const page = normalizeImportPage({ ...pageData, id: pageId }, pages.length);
      if (page) {
        pages.push(page);
        idx[pageId] = page;
      }
    }
    normalized.pages = pages;
    normalized.pagesIndex = idx;
  } else {
    normalized.pages = [];
  }

  if (!normalized.pagesIndex && normalized.pages) {
    normalized.pagesIndex = {};
    for (const page of normalized.pages) {
      normalized.pagesIndex[page.id] = page;
    }
  }

  normalized.components = normalized.components || {};
  normalized.media = normalized.media || {};
  normalized.colors = normalized.colors || {};
  normalized.typographies = normalized.typographies || {};

  if (normalized['tokens-lib'] || normalized['tokensLib']) {
    normalized['tokens-lib'] = normalized['tokens-lib'] || normalized['tokensLib'];
    delete normalized.tokensLib;
  }

  return normalized;
}

function normalizeImportPage(page, index) {
  if (!page) return null;
  const normalized = { ...page };
  if (!normalized.id) normalized.id = uuidv4();
  if (!normalized.name) normalized.name = `Page ${index + 1}`;
  if (!normalized.width) normalized.width = 1200;
  if (!normalized.height) normalized.height = 800;

  if (normalized.objects) {
    if (Array.isArray(normalized.objects)) {
      const map = {};
      for (const obj of normalized.objects) {
        if (obj && obj.id) map[obj.id] = obj;
      }
      normalized.objects = map;
    }
    for (const obj of Object.values(normalized.objects)) {
      if (obj) {
        if (obj.shapes && Array.isArray(obj.shapes)) {
          obj.shapes = obj.shapes.map(s => typeof s === 'string' ? s : s?.id).filter(Boolean);
        }
        if (obj.children && Array.isArray(obj.children)) {
          obj.shapes = obj.children.map(c => typeof c === 'string' ? c : c?.id).filter(Boolean);
          delete obj.children;
        }
      }
    }
  } else {
    normalized.objects = {};
  }

  return normalized;
}