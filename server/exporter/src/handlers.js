import { DEFAULTS } from './config.js';
import { handleExportShapes } from './handlers/export_shapes.js';
import { handleExportFrames } from './handlers/export_frames.js';
import { logger } from './util.js';

const COMMANDS = {
  'export-shapes': handleExportShapes,
  'export-frames': handleExportFrames,
};

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf-8');
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function validateAuth(req, config) {
  if (!config.secretKey) return true;
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)auth-token=([^;]+)/);
  const token = match?.[1] || req.headers['x-auth-token'];
  return token === config.secretKey;
}

function validateCommand(params) {
  const { cmd } = params;
  if (!cmd) return { valid: false, error: 'Missing cmd parameter' };
  if (!COMMANDS[cmd]) return { valid: false, error: `Unknown command: ${cmd}` };
  if (cmd === 'export-shapes') {
    if (params.exports?.some(e => !DEFAULTS.VALID_TYPES.includes(e.type))) {
      return { valid: false, error: `Invalid export type. Valid: ${DEFAULTS.VALID_TYPES.join(', ')}` };
    }
    if (!params.exports?.length) {
      return { valid: false, error: 'No exports specified' };
    }
    if (params.exports.length > (params.exportLimit || DEFAULTS.EXPORT_LIMIT)) {
      return { valid: false, error: `Too many exports (max ${DEFAULTS.EXPORT_LIMIT})` };
    }
  }
  if (cmd === 'export-frames' && !params.exports?.length) {
    return { valid: false, error: 'No frames specified' };
  }
  return { valid: true };
}

export async function handleRequest(req, config) {
  if (req.method === 'GET' && req.url === '/health') {
    return { status: 200, body: { status: 'ok', timestamp: new Date().toISOString() } };
  }

  if (req.method !== 'POST') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  if (!validateAuth(req, config)) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  let params;
  try {
    params = await readBody(req);
  } catch (err) {
    return { status: 400, body: { error: 'Invalid request body' } };
  }

  const validation = validateCommand(params);
  if (!validation.valid) {
    return { status: 400, body: { error: validation.error } };
  }

  const handler = COMMANDS[params.cmd];
  try {
    const result = await handler(params, config);
    return { status: 200, body: result };
  } catch (err) {
    logger.error('Export handler error', { cmd: params.cmd, error: err.message, stack: err.stack });
    return { status: 500, body: { error: err.message || 'Export failed' } };
  }
}