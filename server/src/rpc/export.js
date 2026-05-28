'use strict';
import { RpcError } from './dispatcher.js';
import { config } from '../config/index.js';

const EXPORTER_URL = config.exporterUri || process.env.PENPOT_EXPORTER_URI || 'http://localhost:6061';
const EXPORTER_TIMEOUT = 60000;

async function proxyToExporter(params, ctx) {
  const body = {
    ...params,
    'profile-id': ctx.profileId,
    token: ctx.sessionId || ctx.requestId,
  };

  const response = await fetch(`${EXPORTER_URL}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': ctx.sessionId ? `auth-token=${ctx.sessionId}` : '',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(EXPORTER_TIMEOUT),
  });

  if (!response.ok) {
    const text = await response.text();
    throw RpcError('validation', 'export-failed', `Exporter returned ${response.status}: ${text}`);
  }

  return await response.json();
}

export default function registerExportCommands(register) {
  register('export', {
    auth: true,
    added: '2.0',
    params: 'ExportParams',
    result: 'ExportResult',
    async handler(params, ctx) {
      if (!params.cmd) {
        throw RpcError('validation', 'missing-command', 'Missing cmd parameter');
      }
      return proxyToExporter(params, ctx);
    },
  });

  register('export-shapes', {
    auth: true,
    added: '2.0',
    params: 'ExportShapesParams',
    result: 'ExportResult',
    async handler(params, ctx) {
      return proxyToExporter({ ...params, cmd: 'export-shapes' }, ctx);
    },
  });

  register('export-frames', {
    auth: true,
    added: '2.0',
    params: 'ExportFramesParams',
    result: 'ExportResult',
    async handler(params, ctx) {
      return proxyToExporter({ ...params, cmd: 'export-frames' }, ctx);
    },
  });
}