'use strict';
/**
 * @module path-d
 * @description Pure helpers for parsing, transforming, and measuring SVG path `d`
 * strings. These have no external dependencies so they can be used in both
 * the browser and Node test environments.
 *
 * Used by:
 * - shapes.js (renderPath applies a translate(shape.x, shape.y))
 * - tool-manager.js (moveShape / resizeShape transform the `d` so polyline
 *   points follow their bounding box when the user drags or resizes the shape)
 */

/**
 * Parse an SVG path `d` string into a list of command tokens.
 * Each token is { cmd, args } where args is a flat array of numbers.
 * Handles M/L/H/V/C/S/Q/T/A/Z and their relative (lowercase) variants.
 * @param {string} d
 * @returns {Array<{cmd: string, args: number[]}>}
 */
export function parsePathD(d) {
  if (!d) return [];
  const tokens = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let m;
  while ((m = re.exec(d)) !== null) {
    const cmd = m[1];
    const numStr = m[2].trim();
    if (!numStr && cmd !== 'Z' && cmd !== 'z') {
      tokens.push({ cmd, args: [] });
      continue;
    }
    const args = numStr
      .split(/[\s,]+/)
      .filter(s => s.length > 0)
      .map(Number);
    tokens.push({ cmd, args });
  }
  return tokens;
}

/**
 * Re-emit a list of parsed path tokens back into a `d` string.
 * @param {Array<{cmd: string, args: number[]}>} tokens
 * @returns {string}
 */
export function stringifyPathD(tokens) {
  if (!tokens || tokens.length === 0) return '';
  const out = [];
  for (const { cmd, args } of tokens) {
    if (args.length === 0) {
      out.push(cmd);
      continue;
    }
    const formatted = args.map(n => {
      if (!Number.isFinite(n)) return '0';
      return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
    }).join(' ');
    out.push(`${cmd} ${formatted}`);
  }
  return out.join(' ').trim();
}

function applyPoint(arr, i, isRel, dx, dy, scaleX, scaleY, ox, oy) {
  if (i + 1 >= arr.length) return;
  if (isRel) {
    arr[i] = arr[i] * scaleX;
    arr[i + 1] = arr[i + 1] * scaleY;
  } else {
    arr[i] = (arr[i] - ox) * scaleX + ox + dx;
    arr[i + 1] = (arr[i + 1] - oy) * scaleY + oy + dy;
  }
}

function applyCoord(arr, i, isRel, dx, dy, scaleX, scaleY, ox, oy, isX) {
  if (isRel) {
    arr[i] = arr[i] * (isX ? scaleX : scaleY);
  } else {
    const v = arr[i];
    arr[i] = (v - ox) * (isX ? scaleX : scaleY) + ox + (isX ? dx : dy);
  }
}

/**
 * Apply a transform to every coordinate pair in an SVG path `d` string.
 * Supports both absolute (uppercase) and relative (lowercase) commands.
 *
 * For absolute commands, points are transformed as:
 *   p' = (p - origin) * (scaleX, scaleY) + origin + (dx, dy)
 * For relative commands, the offset is scaled by (scaleX, scaleY) but the
 * translation (dx, dy) is added only to the cumulative cursor, not the
 * individual token (relative offsets are deltas).
 *
 * @param {string} d
 * @param {Object} opts
 * @param {number} [opts.dx=0] - translation X for absolute points
 * @param {number} [opts.dy=0] - translation Y for absolute points
 * @param {number} [opts.scaleX=1] - scale factor X around the shape's local origin
 * @param {number} [opts.scaleY=1] - scale factor Y around the shape's local origin
 * @param {number} [opts.scaleOriginX=0] - X coordinate of the scale origin
 * @param {number} [opts.scaleOriginY=0] - Y coordinate of the scale origin
 * @returns {string} the transformed `d` string
 */
export function transformPathD(d, opts = {}) {
  const {
    dx = 0,
    dy = 0,
    scaleX = 1,
    scaleY = 1,
    scaleOriginX = 0,
    scaleOriginY = 0,
  } = opts;
  if (!d) return d;
  if (dx === 0 && dy === 0 && scaleX === 1 && scaleY === 1) return d;

  const tokens = parsePathD(d);
  const transformed = tokens.map(({ cmd, args }) => {
    const isRel = cmd >= 'a' && cmd <= 'z';
    const upper = isRel ? cmd.toUpperCase() : cmd;
    const newArgs = args.slice();

    if (upper === 'M' || upper === 'L' || upper === 'T') {
      for (let i = 0; i < newArgs.length; i += 2) {
        applyPoint(newArgs, i, isRel, dx, dy, scaleX, scaleY, scaleOriginX, scaleOriginY);
      }
    } else if (upper === 'H') {
      for (let i = 0; i < newArgs.length; i++) {
        applyCoord(newArgs, i, isRel, dx, dy, scaleX, 1, scaleOriginX, scaleOriginY, true);
      }
    } else if (upper === 'V') {
      for (let i = 0; i < newArgs.length; i++) {
        applyCoord(newArgs, i, isRel, dx, dy, 1, scaleY, scaleOriginX, scaleOriginY, false);
      }
    } else if (upper === 'C') {
      for (let i = 0; i < newArgs.length; i += 6) {
        applyPoint(newArgs, i, isRel, dx, dy, scaleX, scaleY, scaleOriginX, scaleOriginY);
        applyPoint(newArgs, i + 2, isRel, dx, dy, scaleX, scaleY, scaleOriginX, scaleOriginY);
        applyPoint(newArgs, i + 4, isRel, dx, dy, scaleX, scaleY, scaleOriginX, scaleOriginY);
      }
    } else if (upper === 'S' || upper === 'Q') {
      for (let i = 0; i < newArgs.length; i += 4) {
        applyPoint(newArgs, i, isRel, dx, dy, scaleX, scaleY, scaleOriginX, scaleOriginY);
        applyPoint(newArgs, i + 2, isRel, dx, dy, scaleX, scaleY, scaleOriginX, scaleOriginY);
      }
    } else if (upper === 'A') {
      for (let i = 0; i < newArgs.length; i += 7) {
        const rx = newArgs[i];
        const ry = newArgs[i + 1];
        const xRot = newArgs[i + 2];
        const large = newArgs[i + 3];
        const sweep = newArgs[i + 4];
        const x = newArgs[i + 5];
        const y = newArgs[i + 6];
        let nrx, nry, nx, ny;
        if (isRel) {
          nrx = rx * scaleX;
          nry = ry * scaleY;
          nx = x * scaleX;
          ny = y * scaleY;
        } else {
          nrx = rx * scaleX;
          nry = ry * scaleY;
          nx = (x - scaleOriginX) * scaleX + scaleOriginX + dx;
          ny = (y - scaleOriginY) * scaleY + scaleOriginY + dy;
        }
        newArgs[i] = nrx;
        newArgs[i + 1] = nry;
        newArgs[i + 2] = xRot;
        newArgs[i + 3] = large;
        newArgs[i + 4] = sweep;
        newArgs[i + 5] = nx;
        newArgs[i + 6] = ny;
      }
    }
    return { cmd, args: newArgs };
  });
  return stringifyPathD(transformed);
}

/**
 * Get the bounding box of an SVG path `d` string (in its own coordinate space).
 * Walks the path tracking the absolute cursor position, accumulating
 * min/max for control points and endpoints.
 * @param {string} d
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function getPathDBounds(d) {
  if (!d) return { x: 0, y: 0, width: 0, height: 0 };
  const tokens = parsePathD(d);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let cx = 0, cy = 0;
  let startX = 0, startY = 0;
  for (const { cmd, args } of tokens) {
    const isRel = cmd >= 'a' && cmd <= 'z';
    const upper = isRel ? cmd.toUpperCase() : cmd;
    if (upper === 'M' || upper === 'L' || upper === 'T') {
      for (let i = 0; i < args.length; i += 2) {
        if (isRel) { cx += args[i]; cy += args[i + 1]; }
        else { cx = args[i]; cy = args[i + 1]; }
        if (upper === 'M' && i === 0) { startX = cx; startY = cy; }
        minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
      }
    } else if (upper === 'H') {
      for (let i = 0; i < args.length; i++) {
        if (isRel) cx += args[i]; else cx = args[i];
        minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
      }
    } else if (upper === 'V') {
      for (let i = 0; i < args.length; i++) {
        if (isRel) cy += args[i]; else cy = args[i];
        minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
      }
    } else if (upper === 'C') {
      for (let i = 0; i < args.length; i += 6) {
        for (let j = 0; j < 3; j++) {
          if (isRel) { cx += args[i + j * 2]; cy += args[i + j * 2 + 1]; }
          else { cx = args[i + j * 2]; cy = args[i + j * 2 + 1]; }
          minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
        }
      }
    } else if (upper === 'S' || upper === 'Q') {
      for (let i = 0; i < args.length; i += 4) {
        for (let j = 0; j < 2; j++) {
          if (isRel) { cx += args[i + j * 2]; cy += args[i + j * 2 + 1]; }
          else { cx = args[i + j * 2]; cy = args[i + j * 2 + 1]; }
          minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
        }
      }
    } else if (upper === 'A') {
      for (let i = 0; i < args.length; i += 7) {
        if (isRel) { cx += args[i + 5]; cy += args[i + 6]; }
        else { cx = args[i + 5]; cy = args[i + 6]; }
        minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
      }
    } else if (upper === 'Z') {
      cx = startX; cy = startY;
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}
