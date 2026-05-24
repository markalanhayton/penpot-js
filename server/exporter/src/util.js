import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let currentLevel = LEVELS[process.env.PENPOT_EXPORTER_LOG_LEVEL?.toLowerCase() || 'info'] ?? LEVELS.info;

function formatMsg(level, msg, data) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}] [exporter]`;
  if (!data || Object.keys(data).length === 0) return `${prefix} ${msg}`;
  return `${prefix} ${msg} ${JSON.stringify(data)}`;
}

export const logger = {
  debug(msg, data) {
    if (currentLevel <= LEVELS.debug) console.debug(formatMsg('debug', msg, data));
  },
  info(msg, data) {
    if (currentLevel <= LEVELS.info) console.info(formatMsg('info', msg, data));
  },
  warn(msg, data) {
    if (currentLevel <= LEVELS.warn) console.warn(formatMsg('warn', msg, data));
  },
  error(msg, data) {
    if (currentLevel <= LEVELS.error) console.error(formatMsg('error', msg, data));
  },
  setLevel(level) {
    currentLevel = LEVELS[level.toLowerCase()] ?? LEVELS.info;
  },
};

export function generateId() {
  return randomUUID();
}

export async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'penpot-export-'));
  try {
    return await fn(dir);
  } finally {
    try { await rm(dir, { recursive: true, force: true }); } catch {}
  }
}

export async function withTempFile(ext, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'penpot-export-'));
  const path = join(dir, `output${ext || ''}`);
  try {
    return await fn(path);
  } finally {
    try { await rm(dir, { recursive: true, force: true }); } catch {}
  }
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function clampValue(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function sanitizeFilename(name) {
  return String(name || 'export').replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 200);
}