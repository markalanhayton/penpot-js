/**
 * @module file-import
 * @description Import .penpot files (ZIP archives with manifest.json).
 * Handles blob analysis, chunked upload, and server-side import.
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
      const JSZip = await importJSZip();
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const manifestFile = zip.file('manifest.json');

      if (manifestFile) {
        const manifestText = await manifestFile.async('string');
        const manifest = JSON.parse(manifestText);
        if (manifest.type === PENPOT_MANIFEST_TYPE) {
          const files = manifest.files || [];
          return {
            type: 'penpot-v3',
            files: files.map(f => ({
              name: f.name || 'Untitled',
              uri: f.uri,
              isShared: f['is-shared'] || false,
            })),
            zip,
            buffer,
            blob: file,
          };
        }
      }

      return { type: 'penpot-v1', blob: file, name: name.replace(/\.[^.]+$/, '') };
    } catch {
      return { type: 'unknown', blob: file };
    }
  }

  if (mtype === 'application/octet-stream') {
    return { type: 'penpot-v1', blob: file, name: name.replace(/\.[^.]+$/, '') };
  }

  return { type: 'unknown', blob: file };
}

async function importJSZip() {
  if (typeof window !== 'undefined' && window.JSZip) return window.JSZip;
  const mod = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
  return mod.default || mod;
}

export async function uploadAndImport(projectId, file, options = {}) {
  const { name, fileId } = options;

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
  }

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

    return results;
  } catch {
    const result = await cmd('import-binfile', importParams);
    return result;
  }
}

export async function importFileToProject(projectId, file) {
  const analysis = await analyzeFile(file);

  if (analysis.type === 'unknown') {
    throw new Error('Unsupported file format');
  }

  const results = [];

  if (analysis.type === 'penpot-v3' && analysis.files.length > 0) {
    for (const fileEntry of analysis.files) {
      const result = await uploadAndImport(projectId, analysis.blob || analysis.zip, {
        name: fileEntry.name,
      });
      results.push(result);
    }
  } else {
    const result = await uploadAndImport(projectId, analysis.blob, {
      name: analysis.name,
    });
    results.push(result);
  }

  return results;
}