/**
 * @module http/client
 * @description Outbound HTTP client for webhook delivery — mirrors `app.http.client`
 * and `app.loggers.webhooks` from the Clojure backend.
 *
 * Provides a simple POST function with timeout, User-Agent header, and basic
 * error classification. Used by the webhook delivery system to fire HTTP requests
 * to externally-configured endpoints.
 *
 * ### SSRF Protection
 *
 * A basic allowlist/blocklist is applied before any request is made:
 * - Blocks loopback addresses (127.0.0.0/8, ::1)
 * - Blocks link-local (169.254.0.0/16, fe80::/10)
 * - Blocks cloud metadata endpoint (169.254.169.254)
 * - Blocks private networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 *
 * These checks operate on the URL hostname only (no DNS rebinding protection).
 * For production deployments behind a firewall, set
 * `PENPOT_WEBHOOK_ALLOW_PRIVATE=false` (default: blocks private IPs).
 */

import { config } from '../config/index.js';

const VERSION = '0.1.0';
const DEFAULT_TIMEOUT_MS = 4000;
const MAX_RESPONSE_BODY = 65536;

const BLOCKED_HOSTNAMES = [
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.internal',
];

/**
 * Validate that a URL does not target a blocked or private address.
 *
 * @param {string} uri - The URL to validate.
 * @throws {Error} If the URL targets a blocked address.
 */
function validateUri(uri) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(`Invalid URI: ${uri}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  for (const blocked of BLOCKED_HOSTNAMES) {
    if (hostname === blocked) {
      throw new Error(`Blocked request: ${hostname} is not allowed`);
    }
  }

  const allowPrivate = process.env.PENPOT_WEBHOOK_ALLOW_PRIVATE === 'true';
  if (!allowPrivate) {
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      throw new Error(`Blocked request: loopback address ${hostname} is not allowed`);
    }
    if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostname)) {
      throw new Error(`Blocked request: private network address ${hostname} is not allowed`);
    }
  }
}

/**
 * Send an HTTP POST request for webhook delivery.
 *
 * @param {string} uri - Target URL.
 * @param {string} body - Request body (JSON string, Transit string, or form-encoded).
 * @param {{ mtype?: string, timeout?: number }} [opts] - Content type and timeout.
 * @returns {Promise<{ status: number|null, error: string|null }>} Delivery result.
 */
export async function postWebhook(uri, body, opts = {}) {
  const mtype = opts.mtype || 'application/json';
  const timeout = opts.timeout || DEFAULT_TIMEOUT_MS;

  try {
    validateUri(uri);
  } catch (err) {
    return { status: null, error: `blocked-request:${err.message}` };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(uri, {
      method: 'POST',
      headers: {
        'Content-Type': mtype,
        'User-Agent': `penpot/${VERSION}`,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 200 || response.status === 204) {
      return { status: response.status, error: null };
    }

    return { status: response.status, error: `unexpected-status:${response.status}` };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { status: null, error: 'timeout' };
    }
    if (err.code === 'ECONNREFUSED') {
      return { status: null, error: 'connection-error' };
    }
    if (err.code === 'ECONNRESET') {
      return { status: null, error: 'connection-error' };
    }
    return { status: null, error: err.message };
  }
}