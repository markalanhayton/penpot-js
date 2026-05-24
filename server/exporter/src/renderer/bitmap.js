import { acquireContext } from '../browser.js';
import { DEFAULTS } from '../config.js';
import { withTempFile, sleep, logger } from '../util.js';
import { uploadResource } from './resources.js';

function buildRenderUrl(config, params) {
  const { fileId, pageId, objectId, shareId, scale, isWasm, skipChildren, renderEmbed } = params;
  const base = config.publicUri.replace(/\/+$/, '');
  const url = new URL(`${base}/render.html`);
  url.searchParams.set('file-id', fileId);
  url.searchParams.set('page-id', pageId);
  if (objectId) url.searchParams.set('object-id', objectId);
  if (shareId) url.searchParams.set('share-id', shareId);
  url.searchParams.set('route', 'objects');
  if (scale) url.searchParams.set('scale', String(scale));
  if (isWasm) url.searchParams.set('wasm', 'true');
  if (skipChildren) url.searchParams.set('skip-children', 'true');
  if (renderEmbed) url.searchParams.set('render-embed', 'true');
  return url.toString();
}

function buildContextOptions(params) {
  const { scale, isWasm, token } = params;
  const opts = {
    ...DEFAULTS.CONTEXT_OPTIONS,
  };
  if (isWasm) {
    opts.deviceScaleFactor = 1;
  } else if (scale) {
    opts.deviceScaleFactor = scale;
  }
  if (token) {
    opts.storageState = {
      cookies: [{
        name: 'auth-token',
        value: token,
        domain: new URL(params.config?.publicUri || 'http://localhost:3449').hostname,
        path: '/',
      }],
    };
  }
  return opts;
}

export async function renderBitmap(params, config) {
  const { type = 'png', objects, pageId, fileId, shareId, scale = 1, isWasm, token, skipChildren } = params;

  const contextOpts = buildContextOptions({ ...params, config });
  const wrapped = await acquireContext(contextOpts);

  try {
    const page = await wrapped.newPage();
    const results = [];

    for (const obj of objects) {
      const url = buildRenderUrl(config, {
        fileId,
        pageId,
        objectId: obj.id,
        shareId,
        scale,
        isWasm,
        skipChildren,
      });

      logger.debug('Navigating to render URL', { objectId: obj.id, type, scale });

      await page.goto(url, { waitUntil: 'networkidle', timeout: config.renderTimeout });

      const selector = `#screenshot-${obj.id}`;
      await page.waitForSelector(selector, { timeout: config.renderTimeout });

      await sleep(DEFAULTS.RENDER_FONT_LOAD_WAIT_MS);

      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element ${selector} not found after navigation`);
      }

      const result = await withTempFile(DEFAULTS.EXTENSIONS[type], async (tmpPath) => {
        const screenshotOpts = {
          type: type === 'jpeg' ? 'jpeg' : 'png',
          omitBackground: type !== 'jpeg',
        };

        await element.screenshot({ ...screenshotOpts, path: tmpPath });

        if (type === 'webp') {
          await convertToWebP(tmpPath, config);
        }

        const resource = await uploadResource(tmpPath, config, {
          name: obj.name,
          filename: obj.filename || `${obj.name}${DEFAULTS.EXTENSIONS[type]}`,
          mtype: DEFAULTS.MIME_TYPES[type],
        });

        return resource;
      });

      results.push(result);
    }

    return results;
  } finally {
    await wrapped.release();
  }
}

async function convertToWebP(pngPath, config) {
  const { execFile } = await import('node:child_process');
  const webpPath = pngPath.replace(/\.png$/, '.webp');

  await new Promise((resolve, reject) => {
    execFile('convert', [pngPath, '-quality', '100', `WEBP:${webpPath}`], (err) => {
      if (err) reject(new Error(`ImageMagick WebP conversion failed: ${err.message}`));
      else resolve();
    });
  });

  const { rename } = await import('node:fs/promises');
  await rename(webpPath, pngPath);
}

export { buildRenderUrl, buildContextOptions };