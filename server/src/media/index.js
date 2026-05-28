'use strict';
/**
 * @module media
 * @description Media & font postprocessing — mirrors `app.media` from the Clojure backend.
 *
 * Uses **[sharp](https://sharp.pixelplumbing.com/)** (libvips) for all image processing,
 * replacing the Clojure backend's im4java/ImageMagick approach. For font processing, uses
 * child processes for fontforge/sfnt2woff/woff2_decompress where available on the system.
 *
 * ### Supported operations
 *
 * | Command              | Description                                        | Clojure equivalent     |
 * |----------------------|----------------------------------------------------|------------------------|
 * | `info`               | Get image dimensions, type, and size               | `:info`                |
 * | `generic-thumbnail`  | Resize image maintaining aspect ratio             | `:generic-thumbnail`   |
 * | `profile-thumbnail`  | Crop-to-square thumbnail for profile photos        | `:profile-thumbnail`   |
 * | `generate-fonts`     | Convert between font formats (TTF/OTF/WOFF/WOFF2)| `:generate-fonts`      |
 * | `download-image`     | Download image from URL with validation           | `download-image`       |
 *
 * ### Thumbnail defaults (mirrors Clojure backend)
 *
 * | Context        | Width | Height | Quality | Format |
 * |----------------|-------|--------|---------|--------|
 * | File media     | 100   | 100    | 85      | JPEG   |
 * | Profile avatar | 256   | 256    | 85      | JPEG   |
 *
 * ### Image validation pipeline
 *
 * Mirrors the Clojure backend's validation and sanitisation:
 * 1. **MIME type validation** — `validateMediaType()` rejects unsupported formats
 * 2. **Size validation** — `validateMediaSize()` enforces file size limits
 * 3. **EOF sanitisation** — `sanitizeImage()` truncates trailing data after image
 *    EOF markers (PNG IEND, JPEG EOI, GIF trailer, WebP RIFF) to prevent data exfiltration
 *
 * ### Temporary file management
 *
 * All processing creates temp files via `createTempFile()` which are tracked for
 * automatic cleanup. Call `cleanupTempFiles()` when processing is complete, or use
 * the `withTempFiles()` helper which cleans up automatically.
 *
 * @example
 * import { run, validateMediaType, validateMediaSize } from './media/index.js';
 *
 * // Get image info
 * const info = await run({ cmd: 'info', input: { path: '/tmp/photo.jpg', mtype: 'image/jpeg' } });
 * console.log(info.width, info.height); // 1920 1080
 *
 * // Generate a thumbnail
 * const thumb = await run({
 *   cmd: 'generic-thumbnail',
 *   input: { path: '/tmp/photo.jpg', mtype: 'image/jpeg' },
 *   format: 'jpeg',
 *   quality: 80,
 *   width: 200,
 *   height: 200,
 * });
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config/index.js';

const execFileAsync = promisify(execFile);

// --- Temp file management (mirrors app.storage.tmp) ---

/** @type {Set<string>} Set of temp file paths created during this process. */
const tempFiles = new Set();

/**
 * Create a temporary file path. The file is tracked for later cleanup.
 *
 * @param {object} [opts={}] Options.
 * @param {string} [opts.prefix='penpot.media.'] - Filename prefix.
 * @param {string} [opts.suffix=''] - Filename suffix (e.g. extension).
 * @returns {string} Absolute path to a temporary file (not yet created on disk).
 */
export function createTempFile({ prefix = 'penpot.media.', suffix = '' } = {}) {
  const tmpPath = path.join(os.tmpdir(), `${prefix}${crypto.randomUUID()}${suffix}`);
  tempFiles.add(tmpPath);
  return tmpPath;
}

/**
 * Delete all tracked temp files from the filesystem.
 *
 * Call this after media processing is complete to prevent temp file leaks.
 * Mirrors the Clojure backend's temp file management where files are created
 * during processing and cleaned up after storage objects are persisted.
 *
 * @returns {number} Number of files successfully deleted.
 */
export function cleanupTempFiles() {
  let deleted = 0;
  for (const filePath of tempFiles) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    } catch { /* ignore cleanup errors */ }
    tempFiles.delete(filePath);
  }
  return deleted;
}

/**
 * Execute a function with automatic temp file cleanup.
 *
 * Creates a tracking context, runs the function, then cleans up all temp files
 * created during execution. Mirrors the Clojure pattern where temp files are
 * created during processing and removed after storage objects are persisted.
 *
 * @template T
 * @param {function(): Promise<T>} fn - Async function to execute.
 * @returns {Promise<T>} The return value of `fn`.
 *
 * @example
 * const result = await withTempFiles(async () => {
 *   const tmpPath = createTempFile({ suffix: '.jpg' });
 *   // ... process tmpPath ...
 *   return someResult;
 * });
 * // All temp files created inside are automatically cleaned up
 */
export async function withTempFiles(fn) {
  const beforeSize = tempFiles.size;
  try {
    return await fn();
  } finally {
    // Only clean up files created during this call, not pre-existing ones
    const allPaths = [...tempFiles];
    for (const filePath of allPaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch { /* ignore */ }
      tempFiles.delete(filePath);
    }
  }
}

// --- Content hashing (mirrors app.storage/calculate-hash) ---

/**
 * Calculate a SHA-256 content hash for an object.
 *
 * Mirrors `app.storage/calculate-hash` which uses SHA-256 for deduplication.
 * Used to identify duplicate storage objects.
 *
 * @param {Buffer|string} data - Binary data or file path to hash.
 * @returns {string} Hex-encoded SHA-256 hash.
 */
export function calculateHash(data) {
  if (typeof data === 'string') {
    const buf = fs.readFileSync(data);
    return crypto.createHash('sha256').update(buf).digest('hex');
  }
  return crypto.createHash('sha256').update(data).digest('hex');
}

// --- MIME type constants (mirrors app.common.media) ---

/** @type {Set<string>} Supported image MIME types for upload. */
export const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

/** @type {Set<string>} Supported font MIME types for upload. */
export const FONT_TYPES = new Set([
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
  'application/x-font-ttf',
  'application/x-font-otf',
  'application/x-font-woff',
  'application/x-font-woff2',
  'application/font-ttf',
  'application/font-otf',
  'application/font-woff',
  'application/font-woff2',
]);

/** @type {Set<string>} All supported media MIME types (image + font). */
export const ALL_MEDIA_TYPES = new Set([...IMAGE_TYPES, ...FONT_TYPES]);

/**
 * Map from MIME type to canonical file extension.
 * Mirrors `app.common.media/mtype->extension` and `app.common.media/format->extension`.
 *
 * @type {Record<string, string>}
 */
export const MTYPE_TO_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
};

/**
 * Map from canonical format name to MIME type.
 * Mirrors `app.common.media/format->mtype`.
 *
 * @type {Record<string, string>}
 */
export const FORMAT_TO_MTYPE = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

/**
 * Resolve a MIME type to a canonical file extension.
 *
 * @param {string} mtype - MIME type (e.g. `'image/jpeg'`).
 * @returns {string|null} File extension without dot (e.g. `'jpg'`), or `null`.
 */
export function mtypeToExtension(mtype) {
  return MTYPE_TO_EXTENSION[mtype] || null;
}

// --- Thumbnail option presets (mirrors app.rpc.commands.media/thumbnail-options) ---

/**
 * Default thumbnail options for file media objects.
 * Mirrors the Clojure backend's `thumbnail-options` constant.
 *
 * @type {{ width: number, height: number, quality: number, format: string }}
 */
export const MEDIA_THUMBNAIL_OPTIONS = {
  width: 100,
  height: 100,
  quality: 85,
  format: 'jpeg',
};

/**
 * Default thumbnail options for profile avatars.
 * Mirrors the Clojure backend's profile thumbnail size (256x256).
 *
 * @type {{ width: number, height: number, quality: number, format: string }}
 */
export const PROFILE_THUMBNAIL_OPTIONS = {
  width: 256,
  height: 256,
  quality: 85,
  format: 'jpeg',
};

// --- Validation functions (mirrors app.media/validate-media-type!, validate-media-size!) ---

/**
 * Validate that an upload's MIME type is allowed.
 *
 * @param {{ mtype?: string, filename?: string }} upload - Upload object with `mtype` field.
 * @param {Set<string>} [allowed=IMAGE_TYPES] - Set of allowed MIME types.
 * @returns {{ mtype?: string, filename?: string }} The upload object (unchanged) for chaining.
 * @throws {Error} If the MIME type is not in the allowed set.
 */
export function validateMediaType(upload, allowed = IMAGE_TYPES) {
  if (!allowed.has(upload.mtype)) {
    const err = new Error('Seems like you are uploading an invalid media object');
    err.type = 'validation';
    err.code = 'media-type-not-allowed';
    throw err;
  }
  return upload;
}

/**
 * Validate font-specific MIME type.
 *
 * @param {{ mtype?: string }} upload - Upload object with `mtype` field.
 * @returns {{ mtype?: string }} The upload object for chaining.
 * @throws {Error} If the MIME type is not a font type.
 */
export function validateFontType(upload) {
  return validateMediaType(upload, FONT_TYPES);
}

/**
 * Validate that an upload's file size does not exceed the configured maximum.
 *
 * Uses `PENPOT_MEDIA_MAX_FILE_SIZE` (default 30 MB) for images and
 * `PENPOT_FONT_MAX_FILE_SIZE` (default 30 MB) for fonts.
 *
 * @param {{ size: number, mtype?: string }} upload - Upload object with `size` (bytes) and `mtype`.
 * @param {'media'|'font'} [kind='media'] - Whether to check against media or font size limit.
 * @returns {{ size: number, mtype?: string }} The upload object (unchanged) for chaining.
 * @throws {Error} If the file size exceeds the limit.
 */
export function validateMediaSize(upload, kind = 'media') {
  const maxSize = kind === 'font' ? config.font.maxFileSize : config.media.maxFileSize;
  if (upload.size > maxSize) {
    const err = new Error(`The uploaded file size ${upload.size} is greater than the maximum ${maxSize}`);
    err.type = 'restriction';
    err.code = kind === 'font' ? 'font-max-file-size-reached' : 'media-max-file-size-reached';
    throw err;
  }
  return upload;
}

// --- EOF sanitisation (mirrors app.media.sanitize) ---

/**
 * Sanitise an image file by truncating any data after the format's EOF marker.
 * Prevents exfiltration of non-image bytes appended to valid image files.
 *
 * Supported formats:
 * - **PNG**: truncates after the IEND chunk CRC32
 * - **JPEG**: truncates after the last EOI marker (`0xFF 0xD9`)
 * - **GIF**: truncates after the last trailer byte (`0x3B`)
 * - **WebP**: truncates to the size declared in the RIFF header
 * - **SVG**: no-op (text format, no binary EOF marker)
 *
 * @param {string} filePath - Path to the image file.
 * @param {string} mtype - MIME type (e.g. `'image/png'`).
 * @returns {Promise<number>} New file size after truncation (or original size if unchanged).
 */
export async function sanitizeImage(filePath, mtype) {
  const typesNeedingEof = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

  if (mtype === 'image/svg+xml') {
    const stat = await fs.promises.stat(filePath);
    return stat.size;
  }

  const buffer = await fs.promises.readFile(filePath);

  if (buffer.length === 0) return 0;

  const eofOffset = findEofOffset(buffer, mtype);

  if (eofOffset === null) {
    if (typesNeedingEof.includes(mtype)) {
      const err = new Error('image format EOF marker not found');
      err.type = 'validation';
      err.code = 'invalid-image';
      throw err;
    }
    return buffer.length;
  }

  if (eofOffset < buffer.length) {
    const truncated = Buffer.from(buffer.subarray(0, eofOffset));
    await fs.promises.writeFile(filePath, truncated);
    return eofOffset;
  }

  return buffer.length;
}

/**
 * Find the byte offset after the last EOF marker in an image buffer.
 *
 * @param {Buffer} buffer - Image file bytes.
 * @param {string} mtype - MIME type.
 * @returns {number|null} Byte offset after the EOF marker, or `null` if not applicable.
 */
function findEofOffset(buffer, mtype) {
  switch (mtype) {
    case 'image/png': return findLastPngIend(buffer);
    case 'image/jpeg': return findLastJpegEoi(buffer);
    case 'image/gif': return findLastGifTrailer(buffer);
    case 'image/webp': return findWebpEnd(buffer);
    default: return null;
  }
}

/**
 * Find the byte offset after the PNG IEND chunk.
 * PNG IEND = 4-byte length + 4-byte "IEND" + 4-byte CRC32.
 *
 * @param {Buffer} buffer
 * @returns {number|null}
 */
function findLastPngIend(buffer) {
  const marker = Buffer.from([0x49, 0x45, 0x4E, 0x44]); // "IEND"
  const idx = buffer.lastIndexOf(marker);
  if (idx === -1) return null;
  // IEND chunk: [length 4B][IEND 4B][CRC 4B] — IEND starts at idx, CRC ends at idx+8
  return idx + 8;
}

/**
 * Find the byte offset after the last JPEG EOI marker (0xFF 0xD9).
 * @param {Buffer} buffer
 * @returns {number|null}
 */
function findLastJpegEoi(buffer) {
  for (let i = buffer.length - 1; i >= 1; i--) {
    if (buffer[i] === 0xD9 && buffer[i - 1] === 0xFF) {
      return i + 1;
    }
  }
  return null;
}

/**
 * Find the byte offset after the last GIF trailer byte (0x3B).
 * @param {Buffer} buffer
 * @returns {number|null}
 */
function findLastGifTrailer(buffer) {
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (buffer[i] === 0x3B) {
      return i + 1;
    }
  }
  return null;
}

/**
 * Find the end of a WebP file from its RIFF header size declaration.
 * @param {Buffer} buffer
 * @returns {number|null}
 */
function findWebpEnd(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] !== 0x52 || buffer[1] !== 0x49 || buffer[2] !== 0x46 || buffer[3] !== 0x46) return null;
  if (buffer[8] !== 0x57 || buffer[9] !== 0x45 || buffer[10] !== 0x42 || buffer[11] !== 0x50) return null;
  const riffSize = buffer.readUInt32LE(4);
  return riffSize + 8;
}

// --- Image processing with sharp (mirrors app.media/process multimethods) ---

/**
 * Determine if an image is large enough to warrant generating a separate thumbnail.
 * Mirrors `big-enough-for-thumbnail?` from the Clojure backend.
 *
 * @param {{ width: number, height: number }} info - Image info from `getImageInfo()`.
 * @param {{ width?: number, height?: number }} [opts=MEDIA_THUMBNAIL_OPTIONS] - Minimum dimensions.
 * @returns {boolean} `true` if the image is larger than the thumbnail dimensions.
 */
export function bigEnoughForThumbnail(info, opts = MEDIA_THUMBNAIL_OPTIONS) {
  return info.width > opts.width || info.height > opts.height;
}

/**
 * Check if a MIME type is SVG.
 *
 * @param {string} mtype - MIME type.
 * @returns {boolean}
 */
export function isSvgImage(mtype) {
  return mtype === 'image/svg+xml';
}

/**
 * Get basic image info (dimensions, format, size) using sharp.
 * For SVG files, parses the XML to extract width/height/viewBox.
 * Handles EXIF orientation and validates MIME type mismatches.
 *
 * Mirrors `app.media/process :info`.
 *
 * @param {{ path: string, mtype?: string }} input - Input file info.
 * @returns {Promise<{ path: string, mtype: string, width: number, height: number, size: number, ts: Date, data?: string }>}
 * @throws {Error} If the image is invalid or the MIME type doesn't match the content.
 */
export async function getImageInfo(input) {
  // SVG: parse XML for dimensions rather than using sharp
  if (input.mtype === 'image/svg+xml') {
    return await getSvgInfo(input);
  }

  const metadata = await sharp(input.path).metadata();

  let width = metadata.width;
  let height = metadata.height;

  // Handle EXIF orientation — swap dimensions for 90/270 degree rotations
  if (metadata.orientation && metadata.orientation >= 5 && metadata.orientation <= 8) {
    [width, height] = [height, width];
  }

  // Determine MIME type from sharp format detection
  const detectedMtype = FORMAT_TO_MTYPE[metadata.format] || input.mtype || 'application/octet-stream';

  // Validate that detected format matches declared MIME type (mirrors app.media :info)
  if (input.mtype && detectedMtype !== 'application/octet-stream' && input.mtype !== detectedMtype) {
    const err = new Error(`Seems like you are uploading a file whose content does not match the extension. Expected: ${input.mtype}. Got: ${detectedMtype}`);
    err.type = 'validation';
    err.code = 'media-type-mismatch';
    throw err;
  }

  const stat = await fs.promises.stat(input.path);

  return {
    path: input.path,
    mtype: detectedMtype,
    width,
    height,
    size: stat.size,
    ts: new Date(),
  };
}

/**
 * Get SVG image dimensions by parsing the XML.
 * Uses a secure SAX-like approach that strips DOCTYPE declarations
 * to prevent XXE attacks. Mirrors `app.media/parse-svg` and `get-basic-info-from-svg`.
 *
 * @param {{ path: string, mtype?: string }} input - SVG file info.
 * @returns {Promise<{ path: string, mtype: string, width: number, height: number, size: number, ts: Date }>}
 * @throws {Error} If the SVG is invalid or doesn't provide dimensions.
 */
async function getSvgInfo(input) {
  const content = await fs.promises.readFile(input.path, 'utf-8');

  const info = parseSvgDimensions(content);
  if (!info) {
    const err = new Error('uploaded svg has invalid content');
    err.type = 'validation';
    err.code = 'invalid-svg-file';
    throw err;
  }

  const stat = await fs.promises.stat(input.path);

  return {
    path: input.path,
    mtype: 'image/svg+xml',
    width: info.width,
    height: info.height,
    size: stat.size,
    ts: new Date(),
  };
}

/**
 * Parse SVG dimensions from XML content.
 * Extracts width/height attributes or viewBox to determine dimensions.
 * Strips DOCTYPE declarations for security (mirrors app.media/strip-doctype).
 *
 * @param {string} text - Raw SVG file content.
 * @returns {{ width: number, height: number }|null} Dimensions, or null if not parseable.
 */
function parseSvgDimensions(text) {
  // Strip DOCTYPE for security (mirrors app.media/strip-doctype)
  const safeText = text.replace(/<!DOCTYPE[^>]*>/gi, '');

  // Extract the opening <svg ...> tag
  const svgMatch = safeText.match(/<svg[^>]*>/i);
  if (!svgMatch) return null;

  const svgTag = svgMatch[0];

  // Try width/height attributes first
  const widthMatch = svgTag.match(/\bwidth\s*=\s*"([^"]*)"/i);
  const heightMatch = svgTag.match(/\bheight\s*=\s*"([^"]*)"/i);

  if (widthMatch && heightMatch) {
    const width = parseFloat(widthMatch[1]);
    const height = parseFloat(heightMatch[1]);
    if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
      return { width: Math.round(width), height: Math.round(height) };
    }
  }

  // Try viewBox
  const viewBoxMatch = svgTag.match(/\bviewBox\s*=\s*"([^"]*)"/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/);
    if (parts.length >= 4) {
      const width = parseFloat(parts[2]);
      const height = parseFloat(parts[3]);
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        return { width: Math.round(width), height: Math.round(height) };
      }
    }
  }

  return null;
}

/**
 * Generate a generic thumbnail maintaining aspect ratio.
 * Images are auto-oriented (EXIF rotation), stripped of metadata, and resized
 * to fit within the specified dimensions while maintaining aspect ratio.
 *
 * Mirrors `app.media/process :generic-thumbnail`.
 *
 * @param {{ input: { path: string, mtype?: string }, format?: 'jpeg'|'png'|'webp', quality?: number, width: number, height: number }} params
 * @returns {Promise<{ path: string, mtype: string, format: string, size: number, width: number, height: number, data: string }>}
 */
export async function genericThumbnail(params) {
  const { input, format = 'jpeg', quality = 80, width, height } = params;

  const outputPath = createTempFile({ prefix: 'penpot.media.', suffix: `.${format}` });

  const pipeline = sharp(input.path)
    .rotate() // auto-orient based on EXIF
    .withMetadata({ orientation: undefined })
    .resize(width, height, { fit: 'inside', withoutEnlargement: true });

  const formatOptions = getSharpFormatOptions(format, quality);
  await pipeline[format](formatOptions).toFile(outputPath);

  const stat = await fs.promises.stat(outputPath);
  const metadata = await sharp(outputPath).metadata();

  return {
    path: outputPath,
    mtype: formatToMtype(format),
    format,
    size: stat.size,
    width: metadata.width,
    height: metadata.height,
    data: outputPath,
  };
}

/**
 * Generate a profile thumbnail cropped to an exact square size.
 * The image is auto-oriented, then center-cropped to the specified dimensions.
 *
 * Mirrors `app.media/process :profile-thumbnail`.
 *
 * @param {{ input: { path: string, mtype?: string }, format?: 'jpeg'|'png'|'webp', quality?: number, width: number, height: number }} params
 * @returns {Promise<{ path: string, mtype: string, format: string, size: number, width: number, height: number, data: string }>}
 */
export async function profileThumbnail(params) {
  const { input, format = 'jpeg', quality = 80, width, height } = params;

  const outputPath = createTempFile({ prefix: 'penpot.media.', suffix: `.${format}` });

  const pipeline = sharp(input.path)
    .rotate()
    .withMetadata({ orientation: undefined })
    .resize(width, height, { fit: 'cover', position: 'center' });

  const formatOptions = getSharpFormatOptions(format, quality);
  await pipeline[format](formatOptions).toFile(outputPath);

  const stat = await fs.promises.stat(outputPath);
  const metadata = await sharp(outputPath).metadata();

  return {
    path: outputPath,
    mtype: formatToMtype(format),
    format,
    size: stat.size,
    width: metadata.width,
    height: metadata.height,
    data: outputPath,
  };
}

/**
 * Convert sharp format name to MIME type.
 *
 * @param {string} format - Sharp format (`'jpeg'`, `'png'`, `'webp'`).
 * @returns {string} MIME type.
 */
function formatToMtype(format) {
  return FORMAT_TO_MTYPE[format] || 'application/octet-stream';
}

/**
 * Build sharp format-specific options object.
 *
 * @param {string} format - Target format.
 * @param {number} quality - Quality (1-100).
 * @returns {object} Sharp format options.
 */
function getSharpFormatOptions(format, quality) {
  switch (format) {
    case 'jpeg': return { quality, mozjpeg: true };
    case 'png': return { quality, compressionLevel: 6 };
    case 'webp': return { quality };
    default: return { quality };
  }
}

// --- Image download from URL (mirrors app.media/download-image) ---

/**
 * Download an image from a URL, validate it, and sanitize it.
 *
 * Mirrors `app.media/download-image`. The image is:
 * 1. Downloaded with redirect following (up to 3 redirects)
 * 2. Validated for MIME type and size
 * 3. Sanitized (EOF truncation) to prevent data exfiltration
 * 4. Written to a temporary file
 *
 * @param {string} uri - The URL to download the image from.
 * @param {{ mtype?: string, maxRedirects?: number }} [opts={}] - Options.
 * @returns {Promise<{ path: string, mtype: string, size: number }>} Download result with local file path.
 * @throws {Error} If the download fails, MIME type is invalid, or size exceeds limits.
 *
 * @example
 * const downloaded = await downloadImage('https://example.com/avatar.jpg');
 * // { path: '/tmp/penpot.media.abc123', mtype: 'image/jpeg', size: 52428 }
 */
export async function downloadImage(uri, opts = {}) {
  const { maxRedirects = 3 } = opts;

  let response;
  try {
    response = await fetch(uri, {
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });
  } catch (cause) {
    const err = new Error(`unable to download image from '${uri}': ${cause.message}`);
    err.type = 'validation';
    err.code = 'unable-to-download-image';
    err.cause = cause;
    throw err;
  }

  if (!response.ok) {
    const err = new Error(`unable to download image from '${uri}': unexpected status code ${response.status}`);
    err.type = 'validation';
    err.code = 'unable-to-download-image';
    throw err;
  }

  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim() || 'application/octet-stream';

  // Validate MIME type
  const upload = { mtype: contentType, size: contentLength || 0, filename: 'download' };
  validateMediaType(upload, ALL_MEDIA_TYPES);

  // Validate size (using content-length header if available)
  if (contentLength > 0) {
    validateMediaSize(upload);
  }

  // Write to temp file
  const tmpPath = createTempFile({ prefix: 'penpot.media.download.' });
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.promises.writeFile(tmpPath, buffer);

  const actualSize = buffer.length;

  // Validate actual size against limit
  validateMediaSize({ mtype: contentType, size: actualSize });

  // Sanitize the downloaded file
  const newSize = await sanitizeImage(tmpPath, contentType);

  return {
    path: tmpPath,
    mtype: contentType,
    size: newSize < actualSize ? newSize : actualSize,
  };
}

// --- Font processing (mirrors app.media/process :generate-fonts) ---

/**
 * Detect the SFNT type of a font buffer (OTF vs TTF) from the first 4 bytes.
 *
 * @param {Buffer} data - First 4 bytes of the font file.
 * @returns {'otf'|'ttf'} The font type.
 * @throws {Error} If the magic bytes don't match OTF or TTF.
 */
function getSFNTType(data) {
  const hex = data.subarray(0, 4).toString('hex');
  if (hex === '4f54544f') return 'otf'; // "OTTO"
  if (hex === '00010000') return 'ttf';
  const err = new Error('unexpected font data');
  err.type = 'internal';
  err.code = 'unexpected-data';
  throw err;
}

/**
 * Check if an external command is available on the system PATH.
 *
 * @param {string} cmd - Command name (e.g. `'fontforge'`).
 * @returns {Promise<boolean>}
 */
async function commandExists(cmd) {
  try {
    await execFileAsync(cmd, ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate all font format variants from the provided input fonts.
 *
 * Mirrors the Clojure `:generate-fonts` multimethod. Accepts an object mapping
 * MIME types to file paths: `{ "font/ttf": "/path/to/font.ttf" }`.
 *
 * Tries to use system utilities (fontforge, sfnt2woff, woff2_decompress) when
 * available, falling back gracefully if a tool is not found.
 *
 * @param {Record<string, string>} input - Map of MIME type to file path.
 * @returns {Promise<Record<string, string>>} Map of MIME type to generated file path.
 */
export async function generateFonts(input) {
  const result = { ...input };
  const currentKeys = new Set(Object.keys(input));

  if (currentKeys.has('font/ttf')) {
    const ttfPath = input['font/ttf'];
    if (!result['font/otf']) {
      try { result['font/otf'] = await convertFont(ttfPath, 'otf'); } catch { /* fontforge not available */ }
    }
    if (!result['font/woff']) {
      try { result['font/woff'] = await convertFont(ttfPath, 'woff'); } catch { /* sfnt2woff not available */ }
    }
  }

  if (currentKeys.has('font/otf')) {
    const otfPath = input['font/otf'];
    if (!result['font/ttf']) {
      try { result['font/ttf'] = await convertFont(otfPath, 'ttf'); } catch { /* fontforge not available */ }
    }
    if (!result['font/woff']) {
      try { result['font/woff'] = await convertFont(otfPath, 'woff'); } catch { /* sfnt2woff not available */ }
    }
  }

  if (currentKeys.has('font/woff')) {
    if (!result['font/ttf'] && !result['font/otf']) {
      try {
        const sfntPath = await convertFont(input['font/woff'], 'sfnt');
        const sfntData = await fs.promises.readFile(sfntPath);
        const type = getSFNTType(sfntData);
        if (type === 'otf') {
          result['font/otf'] = sfntPath;
          try { result['font/ttf'] = await convertFont(sfntPath, 'ttf'); } catch { /* fontforge not available */ }
        } else {
          result['font/ttf'] = sfntPath;
          try { result['font/otf'] = await convertFont(sfntPath, 'otf'); } catch { /* fontforge not available */ }
        }
      } catch { /* conversion tools not available */ }
    }
  }

  if (currentKeys.has('font/woff2')) {
    if (!result['font/ttf'] && !result['font/otf']) {
      try {
        const decompressed = await decompressWoff2(input['font/woff2']);
        const sfntData = await fs.promises.readFile(decompressed);
        const type = getSFNTType(sfntData);
        if (type === 'otf') {
          result['font/otf'] = decompressed;
          try { result['font/ttf'] = await convertFont(decompressed, 'ttf'); } catch { /* fontforge not available */ }
        } else {
          result['font/ttf'] = decompressed;
          try { result['font/otf'] = await convertFont(decompressed, 'otf'); } catch { /* fontforge not available */ }
        }
      } catch { /* woff2_decompress not available */ }
    }
  }

  return result;
}

/**
 * Convert a font file to another format using fontforge.
 *
 * @param {string} inputPath - Path to the source font file.
 * @param {'otf'|'ttf'|'woff'|'sfnt'} targetFormat - Target format.
 * @returns {Promise<string>} Path to the converted font file.
 * @throws {Error} If fontforge is not available or conversion fails.
 */
async function convertFont(inputPath, targetFormat) {
  const ext = targetFormat === 'sfnt' ? 'ttf' : targetFormat;
  const outputPath = createTempFile({ prefix: 'penpot.font.', suffix: `.${ext}` });

  if (targetFormat === 'woff') {
    // Use sfnt2woff for WOFF conversion first (faster than fontforge)
    try {
      await execFileAsync('sfnt2woff', [inputPath], { timeout: 30000 });
      const woffPath = `${inputPath}.woff`;
      const exists = fs.existsSync(woffPath);
      if (exists) {
        await fs.promises.copyFile(woffPath, outputPath);
        try { await fs.promises.unlink(woffPath); } catch { /* ignore */ }
        return outputPath;
      }
    } catch { /* fall through to fontforge */ }
  }

  // Use fontforge for all other conversions (and woff fallback)
  const script = `Open('${inputPath.replace(/'/g, "\\'")}'); Generate('${outputPath.replace(/'/g, "\\'")}')`;
  await execFileAsync('fontforge', ['-lang', 'ff', '-c', script], { timeout: 60000 });
  return outputPath;
}

/**
 * Decompress a WOFF2 file using woff2_decompress.
 *
 * @param {string} inputPath - Path to the .woff2 file.
 * @returns {Promise<string>} Path to the decompressed .ttf file.
 */
async function decompressWoff2(inputPath) {
  const inputCopy = createTempFile({ prefix: 'penpot.font.', suffix: '.woff2' });
  await fs.promises.copyFile(inputPath, inputCopy);
  await execFileAsync('woff2_decompress', [inputCopy], { timeout: 60000 });
  const outputPath = inputCopy.replace(/\.woff2$/, '.ttf');
  return outputPath;
}

// --- Main dispatch function (mirrors app.media/run) ---

/**
 * Process a media command. Mirrors the Clojure multimethod `app.media/process`.
 *
 * Dispatches based on `params.cmd`:
 *
 * - `'info'` — Get image dimensions and metadata
 * - `'generic-thumbnail'` — Generate a proportional thumbnail
 * - `'profile-thumbnail'` — Generate a center-cropped square thumbnail
 * - `'generate-fonts'` — Convert between font formats
 *
 * @param {{ cmd: string, input?: object, format?: string, quality?: number, width?: number, height?: number }} params
 * @returns {Promise<object>} Result depends on the command type.
 * @throws {Error} If the command is not recognised.
 */
export async function run(params) {
  switch (params.cmd) {
    case 'info':
      return await getImageInfo(params.input);

    case 'generic-thumbnail':
      return await genericThumbnail(params);

    case 'profile-thumbnail':
      return await profileThumbnail(params);

    case 'generate-fonts':
      return await generateFonts(params.input);

    default:
      const err = new Error(`No impl found for process cmd: ${params.cmd}`);
      err.type = 'internal';
      err.code = 'not-implemented';
      throw err;
  }
}