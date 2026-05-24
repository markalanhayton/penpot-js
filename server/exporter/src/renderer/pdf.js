import { acquireContext } from '../browser.js';
import { DEFAULTS } from '../config.js';
import { sleep, logger } from '../util.js';
import { buildRenderUrl, buildContextOptions } from './bitmap.js';
import { uploadResource } from './resources.js';
import { execFile } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

export async function renderPdf(params, config) {
  const { objects, pageId, fileId, shareId, scale = 1, token, isWasm, skipChildren } = params;

  const contextOpts = buildContextOptions({ ...params, config, isWasm: false, scale: 1 });
  const wrapped = await acquireContext(contextOpts);

  const tempDir = await mkdtemp(join(tmpdir(), 'penpot-pdf-'));

  try {
    const pdfPaths = [];

    for (const obj of objects) {
      const url = buildRenderUrl(config, {
        fileId,
        pageId,
        objectId: obj.id,
        shareId,
        scale: 1,
        isWasm: false,
        skipChildren,
      });

      logger.debug('Navigating to PDF render URL', { objectId: obj.id });

      await wrapped.context; // ensure context ready
      const page = await wrapped.newPage();

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: config.renderTimeout });

        const selector = `#screenshot-${obj.id}`;
        await page.waitForSelector(selector, { timeout: config.renderTimeout });

        await syncPageSize(page, selector);

        await sleep(DEFAULTS.RENDER_FONT_LOAD_WAIT_MS);

        const pdfPath = join(tempDir, `${obj.filename || obj.name || obj.id}.pdf`);

        await page.pdf({
          path: pdfPath,
          scale,
          printBackground: true,
          preferCSSPageSize: true,
        });

        pdfPaths.push(pdfPath);
      } finally {
        await page.close();
      }
    }

    let finalPdfPath;
    if (pdfPaths.length === 1) {
      finalPdfPath = pdfPaths[0];
    } else {
      finalPdfPath = await mergePdfs(pdfPaths, join(tempDir, 'merged.pdf'));
    }

    const pdfData = await readFile(finalPdfPath);

    const resource = await uploadResource(pdfData, config, {
      name: objects[0]?.name || 'export',
      filename: `${objects[0]?.name || 'export'}.pdf`,
      mtype: DEFAULTS.MIME_TYPES.pdf,
      isBuffer: true,
    });

    return [resource];
  } finally {
    await wrapped.release();
    try { await rm(tempDir, { recursive: true, force: true }); } catch {}
  }
}

async function syncPageSize(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const style = document.createElement('style');
    style.textContent = `@page { size: ${width}px ${height}px; margin: 0; }`;
    document.head.appendChild(style);
  }, selector);
}

async function mergePdfs(paths, outputPath) {
  if (paths.length === 0) throw new Error('No PDFs to merge');
  if (paths.length === 1) return paths[0];

  const pdfuniteResult = await mergeWithPdfunite(paths, outputPath);
  if (pdfuniteResult) return pdfuniteResult;

  logger.info('pdfunite not available, using pure-JS PDF merge fallback');
  const jsResult = await mergeWithPdfLib(paths, outputPath);
  if (jsResult) return jsResult;

  logger.warn('All PDF merge methods failed, falling back to first page');
  return paths[0];
}

async function mergeWithPdfunite(paths, outputPath) {
  return new Promise((resolve) => {
    const args = [...paths, outputPath];
    execFile('pdfunite', args, (err) => {
      if (err) {
        logger.debug('pdfunite not available', { error: err.message });
        resolve(null);
      } else {
        resolve(outputPath);
      }
    });
  });
}

async function mergeWithPdfLib(paths, outputPath) {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const mergedPdf = await PDFDocument.create();

    for (const pdfPath of paths) {
      try {
        const pdfBytes = await readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        for (const page of pages) {
          mergedPdf.addPage(page);
        }
      } catch (err) {
        logger.warn('Failed to load PDF page for merge, skipping', { path: pdfPath, error: err.message });
      }
    }

    if (mergedPdf.getPageCount() === 0) {
      logger.warn('No pages merged from pdf-lib');
      return null;
    }

    const mergedBytes = await mergedPdf.save();
    const { writeFile } = await import('node:fs/promises');
    await writeFile(outputPath, mergedBytes);
    return outputPath;
  } catch (err) {
    logger.debug('pdf-lib not available for PDF merge', { error: err.message });
    return null;
  }
}