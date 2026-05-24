import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { DEFAULTS } from '../config.js';
import { logger } from '../util.js';

export async function uploadResource(source, config, opts = {}) {
  const {
    name = 'export',
    filename = 'export',
    mtype = DEFAULTS.MIME_TYPES.png,
    isBuffer = false,
  } = opts;

  const data = isBuffer ? source : await readFile(source);
  const id = randomUUID();

  logger.debug('Uploading resource', { id, filename, mtype, size: data.length });

  if (config.managementKey && config.publicUri) {
    try {
      const uploadResult = await uploadToServer(data, config, { filename, mtype });
      return {
        id: uploadResult.id || id,
        name,
        filename,
        mtype,
        uri: uploadResult.uri || `${config.publicUri}/api/management/resources/${uploadResult.id || id}`,
        data,
        size: data.length,
      };
    } catch (err) {
      logger.warn('Server upload failed, storing locally', { error: err.message });
    }
  }

  return {
    id,
    name,
    filename,
    mtype,
    uri: `/tmp/exports/${id}/${filename}`,
    data,
    size: data.length,
  };
}

async function uploadToServer(data, config, { filename, mtype }) {
  const url = new URL('/api/management/methods/upload-tempfile', config.publicUri);
  const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`;

  const filePart = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${mtype}`,
    '',
  ].join('\r\n');
  const endPart = `\r\n--${boundary}--\r\n`;

  const payload = Buffer.concat([
    Buffer.from(filePart, 'utf-8'),
    Buffer.isBuffer(data) ? data : Buffer.from(data),
    Buffer.from(endPart, 'utf-8'),
  ]);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(payload.length),
      'X-Shared-Key': `exporter ${config.managementKey}`,
    },
    body: payload,
    signal: AbortSignal.timeout(config.uploadTimeout || 30000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} ${text}`);
  }

  return await response.json();
}

export async function createZipArchive(files, config, { name = 'export' } = {}) {
  const { default: archiver } = await import('archiver');

  const tmpDir = await mkdtemp(join(tmpdir(), 'penpot-zip-'));
  const zipPath = join(tmpDir, `${name}.zip`);

  try {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const { createWriteStream } = await import('node:fs');

    await new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);
      archive.on('error', reject);
      output.on('error', reject);
      output.on('close', resolve);
      archive.pipe(output);

      for (const file of files) {
        archive.append(file.data, { name: file.filename });
      }

      archive.finalize();
    });

    const zipData = await readFile(zipPath);
    return await uploadResource(zipData, config, {
      name,
      filename: `${name}.zip`,
      mtype: DEFAULTS.MIME_TYPES.zip,
      isBuffer: true,
    });
  } finally {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}