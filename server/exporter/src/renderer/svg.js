import { acquireContext } from '../browser.js';
import { DEFAULTS } from '../config.js';
import { withTempFile, sleep, logger } from '../util.js';
import { uploadResource } from './resources.js';
import { buildRenderUrl, buildContextOptions } from './bitmap.js';

export async function renderSvg(params, config) {
  const { objects, pageId, fileId, shareId, scale = 1, token, isWasm, skipChildren } = params;

  const contextOpts = buildContextOptions({ ...params, config, isWasm: false });
  contextOpts.deviceScaleFactor = scale;
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
        isWasm: false,
        skipChildren,
        renderEmbed: true,
      });

      logger.debug('Navigating to SVG render URL', { objectId: obj.id });

      await page.goto(url, { waitUntil: 'networkidle', timeout: config.renderTimeout });

      const selector = `#screenshot-${obj.id}`;
      await page.waitForSelector(selector, { timeout: config.renderTimeout });

      await sleep(DEFAULTS.RENDER_FONT_LOAD_WAIT_MS);

      const svgContent = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const svg = el.querySelector('svg') || el.closest('svg');
        return svg ? svg.outerHTML : null;
      }, selector);

      if (!svgContent) {
        throw new Error(`SVG element not found for ${obj.id}`);
      }

      const foreignObjects = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return [];
        const svg = el.querySelector('svg') || el.closest('svg');
        if (!svg) return [];
        const fos = svg.querySelectorAll('foreignObject');
        return Array.from(fos).map((fo, i) => ({
          index: i,
          id: fo.id || `fo-${i}`,
          width: fo.getAttribute('width'),
          height: fo.getAttribute('height'),
        }));
      }, selector);

      let finalSvg = svgContent;

      if (foreignObjects.length > 0) {
        if (config.enableTextVectorization !== false) {
          finalSvg = await vectorizeTextInSvg(page, selector, foreignObjects, finalSvg, config);
        } else if (!config.enableSvgo) {
          finalSvg = await rasterizeForeignObjects(page, selector, foreignObjects, finalSvg, params, config);
        }
      }

      finalSvg = finalSvg.replace(/&nbsp;/g, '&#160;');

      const resource = await uploadResource(Buffer.from(finalSvg, 'utf-8'), config, {
        name: obj.name,
        filename: obj.filename || `${obj.name}${DEFAULTS.EXTENSIONS.svg}`,
        mtype: DEFAULTS.MIME_TYPES.svg,
        isBuffer: true,
      });

      results.push(resource);
    }

    return results;
  } finally {
    await wrapped.release();
  }
}

async function vectorizeTextInSvg(page, selector, foreignObjects, svgContent, config) {
  let modifiedSvg = svgContent;

  for (const fo of foreignObjects) {
    try {
      const foData = await page.evaluate(({ sel, foIndex }) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const svg = el.querySelector('svg') || el.closest('svg');
        if (!svg) return null;
        const foreignObject = svg.querySelectorAll('foreignObject')[foIndex];
        if (!foreignObject) return null;

        const bbox = foreignObject.getBoundingClientRect();

        const textElements = foreignObject.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6, li, a, text');
        const textPaths = [];

        for (const textEl of textElements) {
          const computedStyle = window.getComputedStyle(textEl);
          const textContent = textEl.textContent || '';

          if (!textContent.trim() && !textEl.querySelector('img, svg')) continue;

          const elRect = textEl.getBoundingClientRect();
          const x = elRect.left - bbox.left;
          const y = elRect.top - bbox.top;

          const fontSize = parseFloat(computedStyle.fontSize) || 14;
          const fontFamily = computedStyle.fontFamily || 'sans-serif';
          const fontWeight = computedStyle.fontWeight || 'normal';
          const fontStyle = computedStyle.fontStyle || 'normal';
          const letterSpacing = computedStyle.letterSpacing || 'normal';
          const fill = computedStyle.color || '#000000';
          const textAlign = computedStyle.textAlign || 'start';
          const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.2;
          const textDecoration = computedStyle.textDecoration || 'none';

          const lines = [];
          const rawLines = textContent.split('\n');
          for (const line of rawLines) {
            if (line.trim()) lines.push(line);
          }

          if (lines.length === 0 && !textEl.querySelector('img, svg')) continue;

          textPaths.push({
            x, y,
            text: lines.join('\n'),
            fontSize,
            fontFamily,
            fontWeight,
            fontStyle,
            letterSpacing,
            fill,
            textAlign,
            lineHeight,
            textDecoration,
            width: elRect.width,
            textAnchor: textAlign === 'center' ? 'middle' : (textAlign === 'end' ? 'end' : 'start'),
          });
        }

        return { textPaths, width: parseFloat(foreignObject.getAttribute('width') || bbox.width), height: parseFloat(foreignObject.getAttribute('height') || bbox.height), foX: parseFloat(foreignObject.getAttribute('x') || 0), foY: parseFloat(foreignObject.getAttribute('y') || 0) };
      }, { sel: selector, foIndex: fo.index });

      if (!foData || foData.textPaths.length === 0) {
        modifiedSvg = await rasterizeSingleForeignObject(page, selector, fo, modifiedSvg, config);
        continue;
      }

      let svgTextElements = '';
      for (const tp of foData.textPaths) {
        const lines = tp.text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const textY = tp.y + (i * tp.lineHeight) + tp.fontSize * 0.8;
          const textX = tp.textAlign === 'center' ? (tp.foX || 0) + foData.width / 2 : (tp.textAlign === 'end' ? (tp.foX || 0) + foData.width : (tp.foX || 0));

          let attrs = `x="${textX}" y="${textY}"`;
          attrs += ` font-size="${tp.fontSize}"`;
          attrs += ` font-family="${tp.fontFamily.replace(/"/g, '&quot;')}"`;
          attrs += ` font-weight="${tp.fontWeight}"`;
          if (tp.fontStyle !== 'normal') attrs += ` font-style="${tp.fontStyle}"`;
          if (tp.letterSpacing !== 'normal') attrs += ` letter-spacing="${tp.letterSpacing}"`;
          attrs += ` fill="${tp.fill}"`;
          if (tp.textAnchor !== 'start') attrs += ` text-anchor="${tp.textAnchor}"`;
          if (tp.textDecoration.includes('underline')) attrs += ` text-decoration="underline"`;
          if (tp.textDecoration.includes('line-through')) attrs += ` text-decoration="line-through"`;

          svgTextElements += `<text ${attrs}>${escapeXml(lines[i])}</text>\n`;
        }
      }

      const textGroup = `<g class="penpot-vectorized-text">${svgTextElements}</g>`;

      const foRegex = new RegExp(`<foreignObject[^>]*id=["']?${escapeRegex(fo.id)}["']?[^>]*>[\\s\\S]*?<\\/foreignObject>`, 'i');
      if (foRegex.test(modifiedSvg)) {
        modifiedSvg = modifiedSvg.replace(foRegex, textGroup);
      } else {
        const genericFoRegex = new RegExp(`<foreignObject[^>]*>[\\s\\S]*?<\\/foreignObject>`, 'i');
        modifiedSvg = modifiedSvg.replace(genericFoRegex, textGroup);
      }

    } catch (err) {
      logger.warn('Failed to vectorize text in foreignObject, falling back to rasterization', { index: fo.index, error: err.message });
      modifiedSvg = await rasterizeSingleForeignObject(page, selector, fo, modifiedSvg, config);
    }
  }

  return modifiedSvg;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function rasterizeSingleForeignObject(page, selector, fo, svgContent, config) {
  try {
    const screenshot = await withTempFile('.png', async (tmpPath) => {
      const foSelector = `${selector} foreignObject:nth-of-type(${fo.index + 1})`;
      const foElement = await page.$(foSelector);
      if (!foElement) return null;

      await foElement.screenshot({ path: tmpPath, type: 'png', omitBackground: true });
      const { readFile } = await import('node:fs/promises');
      return await readFile(tmpPath);
    });

    if (screenshot) {
      const base64 = screenshot.toString('base64');
      const imgTag = `<image width="${fo.width || '100%'}" height="${fo.height || '100%'}" href="data:image/png;base64,${base64}"/>`;
      const foRegex = new RegExp(`<foreignObject[^>]*id=["']?${escapeRegex(fo.id)}["']?[^>]*>[\\s\\S]*?<\\/foreignObject>`, 'i');
      if (foRegex.test(svgContent)) {
        return svgContent.replace(foRegex, imgTag);
      } else {
        const genericFoRegex = new RegExp(`<foreignObject[^>]*>[\\s\\S]*?<\\/foreignObject>`, 'i');
        return svgContent.replace(genericFoRegex, imgTag);
      }
    }
  } catch (err) {
    logger.warn('Failed to rasterize foreignObject', { index: fo.index, error: err.message });
  }
  return svgContent;
}

async function rasterizeForeignObjects(page, selector, foreignObjects, svgContent, params, config) {
  let modifiedSvg = svgContent;

  for (const fo of foreignObjects) {
    modifiedSvg = await rasterizeSingleForeignObject(page, selector, fo, modifiedSvg, config);
  }

  return modifiedSvg;
}