'use strict';
/**
 * @module rpc
 * @description RPC client for Penpot backend. Handles Transit+JSON encoding,
 * GET/POST routing, auth tokens, retry with exponential backoff,
 * SSE streaming, and structured error handling.
 */

import { transitEncode, transitDecode } from './transit.js';
import { appStore } from './store.js';

let authToken = null;

export function setAuthToken(token) { authToken = token; }
export function getAuthToken() { return authToken; }
export function clearAuthToken() { authToken = null; }

// --- Error types ---

export class RpcError extends Error {
  constructor(type, code, hint, status) {
    super(hint || code);
    this.name = 'RpcError';
    this.type = type;
    this.code = code;
    this.hint = hint;
    this.status = status;
  }
}

// --- Retry configuration ---

const MAX_RETRIES = 2;
const BASE_DELAY = 500;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT = 30000; // 30 seconds

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRetryDelay(attempt) {
  return BASE_DELAY * Math.pow(2, attempt) + Math.random() * 200;
}

// --- Main RPC command ---

export async function cmd(command, params) {
  const url = `/api/rpc/command/${command}`;
  const method = command.startsWith('get-') ? 'GET' : 'POST';

  const headers = { 'X-Client': 'penpot-client', 'Accept': 'application/transit+json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let body = undefined;
  let fullUrl = url;

  if (method === 'GET' && params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) sp.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    fullUrl = `${url}?${sp.toString()}`;
  } else if (params) {
    headers['Content-Type'] = 'application/transit+json';
    body = transitEncode(params);
  }

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      let response;
      try {
        response = await fetch(fullUrl, { method, headers, body, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      return await handleResponse(response);
    } catch (err) {
      if (err instanceof RpcError) {
        if (!RETRYABLE_STATUSES.has(err.status) || attempt === MAX_RETRIES) throw err;
        lastError = err;
      } else if (err.name === 'AbortError') {
        lastError = new RpcError('timeout', 'request-timeout', `Request to ${command} timed out after ${REQUEST_TIMEOUT}ms`, 0);
        if (attempt === MAX_RETRIES) throw lastError;
      } else {
        lastError = err;
        if (attempt === MAX_RETRIES) throw lastError;
      }
      await sleep(getRetryDelay(attempt));
    }
  }
  throw lastError;
}

// --- SSE streaming ---

export function cmdStream(command, params) {
  const url = `/api/rpc/command/${command}`;
  const headers = { 'X-Client': 'penpot-client', 'Accept': 'text/event-stream' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let body;
  if (params) {
    headers['Content-Type'] = 'application/transit+json';
    body = transitEncode(params);
  }

  return new ReadableStream({
    async start(controller) {
      const response = await fetch(url, { method: 'POST', headers, body });
      if (!response.ok) {
        controller.error(new RpcError('http', `http-${response.status}`, response.statusText, response.status));
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data) {
              try { controller.enqueue(transitDecode(data)); }
              catch { /* fallback: enqueue raw data if transit decode fails */ controller.enqueue(data); }
            }
          }
        }
      }
    }
  });
}

// --- File upload ---

export async function cmdUpload(command, file, params = {}) {
  const url = `/api/rpc/command/${command}`;
  const headers = { 'X-Client': 'penpot-client' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const formData = new FormData();
  formData.append('file', file);
  for (const [k, v] of Object.entries(params)) {
    formData.append(k, v);
  }

  const response = await fetch(url, { method: 'POST', headers, body: formData });
  return handleResponse(response);
}

// --- Response handling ---

async function handleResponse(response) {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('content-type') || '';
  const isTransit = contentType.includes('transit+json');

  if (!response.ok) {
    throw await parseRpcError(response, contentType, isTransit);
  }

  const text = await response.text();
  if (!text) return undefined;
  if (isTransit) return transitDecode(text);
  try { return JSON.parse(text); }
  catch { /* not JSON, return raw text */ return text; }
}

async function parseRpcError(response, contentType, isTransit) {
  const text = await response.text();

  if (text && isTransit) {
    try {
      const decoded = transitDecode(text);
      const type = decoded.type || decoded['~:type'] || 'unknown';
      const code = decoded.code || decoded['~:code'] || `http-${response.status}`;
      const hint = decoded.hint || decoded['~:hint'] || decoded.message || text;
      return new RpcError(type, code, hint, response.status);
    } catch { /* transit decode failed, try JSON next */ }
  }

  if (text) {
    try {
      const json = JSON.parse(text);
      return new RpcError(
        json.type || 'unknown',
        json.code || `http-${response.status}`,
        json.hint || json.message || text,
        response.status
      );
    } catch { /* JSON parse also failed, return raw text error below */ }
  }

  return new RpcError('unknown', `http-${response.status}`, text || response.statusText, response.status);
}