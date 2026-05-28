'use strict';
/**
 * @module file-import
 * @description Import .penpot files (ZIP archives with manifest.json).
 * Handles blob analysis, chunked upload, data normalization, and server-side import.
 *
 * Supports three import formats:
 * - v3 ZIP: Structured archive with manifest.json, files/, pages/, media/,
 *   components/, colors/, typographies/, objects/, and thumbnails/ directories
 * - v1 ZIP: Legacy archive with loose JSON/SVG page files
 * - Blob: Single encoded binary blob (server handles decoding)
 */

import { cmd, cmdUpload } from './rpc.js';
import { cmdStream } from './rpc.js';

const PENPOT_MANIFEST_TYPE = 'penpot/export-files';
const CHUNK_SIZE = 10 * 1024 * 1024;

export async function analyzeFile(file) {
  if (!file) return { type: 'unknown' };

  const mtype = file.type || '';
  const name = file.name || '';

  if (mtype === 'application/zip' || name.endsWith('.penpot') || name.endsWith('.zip')) {
    try {
      const JSZip = await loadJSZip();
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const manifestFile = zip.file('manifest.json');

      if (manifestFile) {
        const manifestText = await manifestFile.async('string');
        const manifest = JSON.parse(manifestText);
        if (manifest.type === PENPOT_MANIFEST_TYPE || manifest.kind === 'penpot/export') {
          const files = [];
          const fileEntries = manifest.files || [];

          for (const mf of fileEntries) {
            const fileZipPath = `files/${mf.id}.json`;
            const fileZipEntry = zip.file(fileZipPath);

            let fileData = mf.data || null;
            if (!fileData && fileZipEntry) {
              try {
                const content = await fileZipEntry.async('string');
                fileData = JSON.parse(content);
                fileData = fileData.data || fileData;
              } catch (e) {
                console.warn('[file-import] Could not parse file entry:', e.message);
              }
            }

            const mediaRefs = fileData ? extractMediaFromData(fileData) : [];
            const mediaEntries = {};
            for (const mediaId of mediaRefs) {
              const mediaZipPath = `media/${mediaId}.json`;
              const mediaZipEntry = zip.file(mediaZipPath);
              if (mediaZipEntry) {
                try {
                  const mediaContent = await mediaZipEntry.async('string');
                  mediaEntries[mediaId] = JSON.parse(mediaContent);
                } catch (err) { console.warn('[file-import] Failed to parse media entry', mediaId, ':', err?.message || err); }
              } else if (fileData && fileData.media && fileData.media[mediaId]) {
                mediaEntries[mediaId] = fileData.media[mediaId];
              }
            }

            files.push({
              id: mf.id,
              name: mf.name || 'Untitled',
              isShared: mf['is-shared'] || false,
              features: mf.features || [],
              data: fileData,
              media: mediaEntries,
              hasStructuredZip: !!fileZipEntry,
            });
          }

          return {
            type: 'penpot-v3',
            version: manifest.version || 3,
            files,
            relations: manifest.relations || [],
            zip,
            buffer,
            blob: file,
          };
        }
      }

      const pages = [];
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && (relativePath.endsWith('.json') || relativePath.endsWith('.svg'))) {
          if (!relativePath.startsWith('manifest') &&
              !relativePath.startsWith('files/') &&
              !relativePath.startsWith('media/') &&
              !relativePath.startsWith('components/') &&
              !relativePath.startsWith('colors/') &&
              !relativePath.startsWith('typographies/') &&
              !relativePath.startsWith('objects/') &&
              !relativePath.startsWith('thumbnails/') &&
              !relativePath.startsWith('tokens/') &&
              !relativePath.includes('__MACOSX')) {
            pages.push(relativePath);
          }
        }
      });

      if (pages.length > 0) {
        return { type: 'penpot-v1', blob: file, name: name.replace(/\.[^.]+$/, ''), zip, pages };
      }

      return { type: 'penpot-v1', blob: file, name: name.replace(/\.[^.]+$/, '') };
    } catch (err) {
      console.error('[file-import] archive parse error:', err);
      return { type: 'unknown', blob: file, error: err.message };
    }
  }

  if (mtype === 'application/octet-stream' || name.endsWith('.penpot')) {
    return { type: 'penpot-v1', blob: file, name: name.replace(/\.[^.]+$/, '') };
  }

  return { type: 'unknown', blob: file };
}

let _JSZip = null;
async function loadJSZip() {
  if (_JSZip) return _JSZip;
  if (typeof window !== 'undefined' && window.JSZip) {
    _JSZip = window.JSZip;
    return _JSZip;
  }
  const mod = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
  _JSZip = mod.default || mod;
  return _JSZip;
}

function normalizePage(page, pageIndex) {
  if (!page) return null;
  const normalized = { ...page };
  if (!normalized.id) normalized.id = crypto.randomUUID();
  if (!normalized.name) normalized.name = `Page ${pageIndex + 1}`;

  if (normalized.objects) {
    if (Array.isArray(normalized.objects)) {
      const map = {};
      for (const obj of normalized.objects) {
        if (obj && obj.id) map[obj.id] = obj;
      }
      normalized.objects = map;
    }
    for (const [id, obj] of Object.entries(normalized.objects)) {
      if (obj && obj.shapes && Array.isArray(obj.shapes)) {
        obj.shapes = obj.shapes.map(s => typeof s === 'string' ? s : s?.id).filter(Boolean);
      }
      if (obj && obj.children && Array.isArray(obj.children)) {
        obj.shapes = obj.children.map(c => typeof c === 'string' ? c : c?.id).filter(Boolean);
        delete obj.children;
      }
    }
  } else {
    normalized.objects = {};
  }

  if (!normalized.width) normalized.width = 1200;
  if (!normalized.height) normalized.height = 800;

  return normalized;
}

function normalizeFileData(data) {
  if (!data) {
    return {
      pages: [],
      pagesIndex: {},
      components: {},
      media: {},
      colors: {},
      typographies: {},
    };
  }

  const normalized = { ...data };

  if (normalized.pages && Array.isArray(normalized.pages)) {
    normalized.pages = normalized.pages.map((p, i) => normalizePage(p, i)).filter(Boolean);
  } else if (normalized.pagesIndex) {
    const pages = [];
    const index = { ...normalized.pagesIndex };
    for (const [pageId, pageData] of Object.entries(index)) {
      const page = normalizePage({ ...pageData, id: pageId }, pages.length);
      if (page) {
        pages.push(page);
        index[pageId] = { ...pageData, id: pageId };
      }
    }
    normalized.pages = pages;
    normalized.pagesIndex = index;
  } else {
    normalized.pages = [];
  }

  if (!normalized.pagesIndex && normalized.pages) {
    normalized.pagesIndex = {};
    for (const page of normalized.pages) {
      normalized.pagesIndex[page.id] = page;
    }
  }

  normalized.components = normalized.components || normalized.component || {};
  normalized.media = normalized.media || {};
  normalized.colors = normalized.colors || {};
  normalized.typographies = normalized.typographies || {};

  if (normalized['tokens-lib'] || normalized.tokensLib) {
    normalized['tokens-lib'] = normalized['tokens-lib'] || normalized.tokensLib;
    delete normalized.tokensLib;
  }

  return normalized;
}

function extractMediaFromData(data) {
  const mediaRefs = [];
  if (!data) return mediaRefs;

  function scanShape(shape) {
    if (!shape) return;
    if (shape.fills) {
      for (const fill of shape.fills) {
        if (fill['fill-type'] === 'image' && fill['fill-image-media']) {
          mediaRefs.push(fill['fill-image-media']);
        }
      }
    }
    if (shape.strokes) {
      for (const stroke of shape.strokes) {
        if (stroke['stroke-type'] === 'image' && stroke['stroke-image-media']) {
          mediaRefs.push(stroke['stroke-image-media']);
        }
      }
    }
    const children = shape.shapes || shape.children || [];
    const childArray = Array.isArray(children) ? children : Object.values(children);
    for (const child of childArray) {
      if (typeof child === 'object' && child !== null) scanShape(child);
    }
  }

  const pages = data.pages || Object.values(data.pagesIndex || {});
  for (const page of pages) {
    const objects = page?.objects || {};
    if (Array.isArray(objects)) {
      for (const obj of objects) scanShape(obj);
    } else {
      for (const obj of Object.values(objects)) {
        scanShape(obj);
      }
    }
  }

  return [...new Set(mediaRefs)];
}

export async function uploadAndImport(projectId, file, options = {}) {
  const { name, fileId, onProgress } = options;

  if (onProgress) onProgress('uploading', 0);

  const { sessionId } = await cmd('create-upload-session', {
    totalChunks: Math.ceil(file.size / CHUNK_SIZE),
  });

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const chunkFile = new File([chunk], `chunk-${i}.bin`, { type: 'application/octet-stream' });
    await cmdUpload('upload-chunk', chunkFile, { sessionId, index: String(i) });
    if (onProgress) onProgress('uploading', Math.round(((i + 1) / totalChunks) * 50));
  }

  if (onProgress) onProgress('processing', 50);

  const importParams = {
    projectId,
    name: name || file.name?.replace(/\.[^.]+$/, '') || 'Imported file',
    version: 3,
    'upload-id': sessionId,
  };

  if (fileId) importParams['file-id'] = fileId;

  try {
    const stream = cmdStream('import-binfile', importParams);
    const reader = stream.getReader();
    const results = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) results.push(value);
    }

    if (onProgress) onProgress('complete', 100);
    return results;
  } catch (err) {
    console.warn('[file-import] Streaming import failed, falling back to server import:', err?.message || err);
    const result = await cmd('import-binfile', importParams);
    if (onProgress) onProgress('complete', 100);
    return result;
  }
}

export async function importFileToProject(projectId, file, options = {}) {
  const { onProgress } = options;
  const analysis = await analyzeFile(file);

  if (analysis.type === 'unknown') {
    throw new Error('Unsupported file format');
  }

  const results = [];

  if (analysis.type === 'penpot-v3' && analysis.files.length > 0) {
    if (analysis.hasStructuredZip && analysis.buffer) {
      if (onProgress) onProgress('uploading', 10);
      const result = await uploadAndImport(projectId, analysis.blob || new Blob([analysis.buffer]), {
        name: analysis.files[0]?.name,
        onProgress,
      });
      results.push(result);
    } else {
      for (let i = 0; i < analysis.files.length; i++) {
        const fileEntry = analysis.files[i];
        let fileData = fileEntry.data || fileEntry;

        if (typeof fileData === 'string') {
          try { fileData = JSON.parse(fileData); } catch (err) { console.warn('[file-import] Skipping malformed file entry:', err?.message || err); continue; }
        }

        fileData = normalizeFileData(fileData);

        if (fileEntry.media && Object.keys(fileEntry.media).length > 0) {
          if (!fileData.media) fileData.media = {};
          Object.assign(fileData.media, fileEntry.media);
        }

        const fileBlob = analysis.blob || (analysis.buffer ? new Blob([analysis.buffer]) : null);
        if (!fileBlob) throw new Error('No file blob available for import');

        const progressWrapper = onProgress
          ? (stage, pct) => onProgress(stage, Math.round(10 + (pct * 80 * (i + 1) / analysis.files.length) / 100 + 10 * i / analysis.files.length))
          : undefined;

        const result = await uploadAndImport(projectId, fileBlob, {
          name: fileEntry.name,
          onProgress: progressWrapper,
        });
        results.push(result);
      }
    }
  } else if (analysis.type === 'penpot-v1' && analysis.zip) {
    try {
      const pages = [];
      const pagePromises = [];

      analysis.zip.forEach((path, entry) => {
        if (!entry.dir && path.endsWith('.json') && !path.includes('__MACOSX')) {
          pagePromises.push(entry.async('string').then(content => {
            try {
              const pageData = JSON.parse(content);
              return normalizePage(pageData, pages.length);
            } catch (err) { console.warn('[file-import] Skipping malformed page entry:', err?.message || err); return null; }
          }));
        }
      });

      const parsedPages = await Promise.all(pagePromises);
      for (const page of parsedPages) {
        if (page) pages.push(page);
      }

      if (onProgress) onProgress('uploading', 20);

      const fileBlob = analysis.blob || (analysis.buffer ? new Blob([analysis.buffer]) : null);
      if (!fileBlob) throw new Error('No file blob available for import');

      const result = await uploadAndImport(projectId, fileBlob, {
        name: analysis.name,
        onProgress,
      });
      results.push(result);
    } catch (err) {
      console.error('[file-import] v1 zip parse error:', err);
      const fileBlob = analysis.blob || (analysis.buffer ? new Blob([analysis.buffer]) : null);
      if (!fileBlob) throw err;
      const result = await uploadAndImport(projectId, fileBlob, {
        name: analysis.name,
        onProgress,
      });
      results.push(result);
    }
  } else {
    const fileBlob = analysis.blob || (analysis.buffer ? new Blob([analysis.buffer]) : null);
    if (!fileBlob) throw new Error('No file data available');
    const result = await uploadAndImport(projectId, fileBlob, {
      name: analysis.name,
      onProgress,
    });
    results.push(result);
  }

  return results;
}

export async function exportFile(fileId, options = {}) {
  const { includeLibraries = false } = options;

  const result = await cmd('export-binfile', {
    fileId,
    includeLibraries,
  });

  return result;
}

export { normalizeFileData, normalizePage, extractMediaFromData };