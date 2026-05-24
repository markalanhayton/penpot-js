/**
 * @module fonts
 * @description Font management — mirrors app.main.data.fonts from ClojureScript.
 * Handles font blob processing, chunked uploads, RPC integration,
 * and font family grouping.
 */

import { cmd, cmdUpload } from './rpc.js';

const CHUNK_SIZE = 10 * 1024 * 1024;

const FONT_MIME_TYPES = {
  '\x00\x01\x00\x00': 'font/ttf',
  '\x4F\x54\x54\x4F': 'font/otf',
  '\x77\x4F\x46\x00': 'font/woff',
  '\x77\x4F\x46\x32': 'font/woff2',
};

const WEIGHT_NAMES = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black',
  950: 'Extra Black',
};

function detectMimeFromMagic(arrayBuffer) {
  const view = new Uint8Array(arrayBuffer, 0, 4);
  const magic = String.fromCharCode(view[0], view[1], view[2], view[3]);
  return FONT_MIME_TYPES[magic] || null;
}

function weightToName(weight, style) {
  const base = WEIGHT_NAMES[weight] || `Weight ${weight}`;
  if (style === 'italic') return `${base} Italic`;
  return base;
}

export function variantDisplayName(variant) {
  if (variant.variantName) return variant.variantName;
  return weightToName(variant.fontWeight, variant.fontStyle);
}

function parseFontMetadata(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const mtype = detectMimeFromMagic(arrayBuffer);

  let fontFamily = 'Unknown Font';
  let fontWeight = 400;
  let fontStyle = 'normal';

  if (mtype === 'font/ttf' || mtype === 'font/otf') {
    try {
      const numTables = view.getUint16(4, false);
      for (let i = 0; i < numTables; i++) {
        const offset = 12 + i * 16;
        const tag = String.fromCharCode(
          view.getUint8(offset), view.getUint8(offset + 1),
          view.getUint8(offset + 2), view.getUint8(offset + 3)
        );

        if (tag === 'name') {
          const tableOffset = view.getUint32(offset + 8, false);
          const nameCount = view.getUint16(tableOffset + 2, false);
          const stringOffset = tableOffset + view.getUint16(tableOffset + 4, false);

          let preferredFamily = '';
          let family = '';
          let preferredSubfamily = '';
          let subfamily = '';

          for (let j = 0; j < nameCount; j++) {
            const recOffset = tableOffset + 6 + j * 12;
            const nameID = view.getUint16(recOffset + 6, false);
            const length = view.getUint16(recOffset + 8, false);
            const strOffset = view.getUint16(recOffset + 10, false);

            const platformID = view.getUint16(recOffset, false);
            const encodingID = view.getUint16(recOffset + 2, false);

            let str = '';
            if (platformID === 3 && encodingID === 1) {
              const charOffset = stringOffset + strOffset;
              for (let k = 0; k < length && charOffset + k + 2 <= view.byteLength; k += 2) {
                str += String.fromCharCode(view.getUint16(charOffset + k, false));
              }
            } else if (platformID === 1 && encodingID === 0) {
              const charOffset = stringOffset + strOffset;
              for (let k = 0; k < length && charOffset + k < view.byteLength; k++) {
                str += String.fromCharCode(view.getUint8(charOffset + k));
              }
            }

            if (nameID === 16) preferredFamily = str;
            else if (nameID === 1) family = family || str;
            else if (nameID === 17) preferredSubfamily = str;
            else if (nameID === 2) subfamily = subfamily || str;
          }

          fontFamily = preferredFamily || family || 'Unknown Font';
          const sub = (preferredSubfamily || subfamily).toLowerCase();
          if (sub.includes('italic')) fontStyle = 'italic';
          if (sub.includes('thin') || sub.includes('100')) fontWeight = 100;
          else if (sub.includes('extra light') || sub.includes('200')) fontWeight = 200;
          else if (sub.includes('light') || sub.includes('300')) fontWeight = 300;
          else if (sub.includes('medium') || sub.includes('500')) fontWeight = 500;
          else if (sub.includes('semi bold') || sub.includes('semibold') || sub.includes('600')) fontWeight = 600;
          else if (sub.includes('bold') && !sub.includes('extra') && !sub.includes('semi')) fontWeight = 700;
          else if (sub.includes('extra bold') || sub.includes('800')) fontWeight = 800;
          else if (sub.includes('black') || sub.includes('900')) fontWeight = 900;
          break;
        }
      }
    } catch { /* parse failed, use defaults */ }
  }

  return { fontFamily, fontWeight, fontStyle, mtype };
}

export async function processFontBlobs(files) {
  const results = [];
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const meta = parseFontMetadata(buffer);
    results.push({
      file,
      buffer,
      fontFamily: meta.fontFamily,
      fontWeight: meta.fontWeight,
      fontStyle: meta.fontStyle,
      mtype: meta.mtype,
      filename: file.name,
    });
  }
  return results;
}

export function groupFontsByFamily(fonts) {
  const groups = new Map();
  for (const f of fonts) {
    const key = `${f.fontFamily}::${f.fontWeight}::${f.fontStyle}`;
    if (!groups.has(key)) {
      groups.set(key, { fontFamily: f.fontFamily, fontWeight: f.fontWeight, fontStyle: f.fontStyle, items: [] });
    }
    groups.get(key).items.push(f);
  }
  return [...groups.values()];
}

async function uploadChunked(buffer, mtype) {
  const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
  const { sessionId } = await cmd('create-upload-session', { totalChunks });

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, buffer.byteLength);
    const chunk = buffer.slice(start, end);
    const ext = mtypeToExt(mtype);
    const blob = new Blob([chunk], { type: mtype || 'application/octet-stream' });
    const file = new File([blob], `chunk-${i}.${ext}`, { type: mtype || 'application/octet-stream' });

    await cmdUpload('upload-chunk', file, { sessionId, index: String(i) });
  }

  return sessionId;
}

function mtypeToExt(mtype) {
  const map = {
    'font/ttf': 'ttf', 'font/otf': 'otf',
    'font/woff': 'woff', 'font/woff2': 'woff2',
  };
  return map[mtype] || 'bin';
}

export async function uploadFontVariant(teamId, fontGroup) {
  const fontId = crypto.randomUUID();
  const uploads = {};
  let mtype = null;

  for (const item of fontGroup.items) {
    const detectedMtype = item.mtype || detectMimeFromMagic(item.buffer);
    if (!detectedMtype) continue;
    mtype = detectedMtype;
    const sessionId = await uploadChunked(item.buffer, detectedMtype);
    uploads[detectedMtype] = sessionId;
  }

  if (Object.keys(uploads).length === 0) {
    throw new Error('No valid font files to upload');
  }

  const result = await cmd('create-font-variant', {
    teamId,
    fontId,
    fontFamily: fontGroup.fontFamily,
    fontWeight: fontGroup.fontWeight,
    fontStyle: fontGroup.fontStyle,
    variantName: weightToName(fontGroup.fontWeight, fontGroup.fontStyle),
    uploads,
  });

  return result;
}

export async function fetchTeamFonts(teamId) {
  const variants = await cmd('get-font-variants', { teamId });
  return groupVariantsByFamily(variants);
}

export function groupVariantsByFamily(variants) {
  const list = Array.isArray(variants) ? variants : [];
  const families = new Map();
  for (const v of list) {
    const fid = v.fontId || v.font_id;
    if (!families.has(fid)) {
      families.set(fid, {
        fontId: fid,
        fontFamily: v.fontFamily || v.font_family,
        variants: [],
      });
    }
    families.get(fid).variants.push(v);
  }
  return [...families.values()];
}

export async function renameFontFamily(teamId, fontId, name) {
  return cmd('update-font', { teamId, id: fontId, name });
}

export async function deleteFontFamily(teamId, fontId) {
  return cmd('delete-font', { teamId, id: fontId });
}

export async function deleteFontVariant(teamId, variantId) {
  return cmd('delete-font-variant', { teamId, id: variantId });
}

export async function downloadFont(variantId) {
  return cmd('download-font', { id: variantId });
}

export async function downloadFontFamily(fontId) {
  return cmd('download-font-family', { fontId });
}

const loadedFontUrls = new Set();

export async function loadTeamFontsIntoDocument(teamId) {
  try {
    const families = await fetchTeamFonts(teamId);
    for (const family of families) {
      for (const variant of family.variants) {
        const fontUrl = variant.fontUrl || variant.font_url ||
          (variant.id ? `/api/rpc/command/download-font?id=${variant.id}` : null);
        if (!fontUrl || loadedFontUrls.has(fontUrl)) continue;
        loadedFontUrls.add(fontUrl);
        const fontFace = new FontFace(
          family.fontFamily,
          `url('${fontUrl}')`,
          { weight: String(variant.fontWeight || variant.font_weight || 400), style: variant.fontStyle || variant.font_style || 'normal' }
        );
        try {
          const loaded = await fontFace.load();
          document.fonts.add(loaded);
        } catch (e) {
          console.warn('[fonts] Failed to load font:', family.fontFamily, e);
        }
      }
    }
  } catch (e) {
    console.warn('[fonts] Failed to load team fonts:', e);
  }
}

export function getLoadedFontFamilies() {
  return [...document.fonts].map(f => f.family).filter((v, i, a) => a.indexOf(v) === i);
}