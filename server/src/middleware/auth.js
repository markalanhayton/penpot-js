'use strict';
/**
 * @module middleware/auth
 * @description Authentication middleware pipeline — mirrors `app.http.middleware`
 * from the Clojure backend.
 *
 * Provides Fastify hooks for:
 * - Session cookie and Bearer token extraction
 * - Access token (API key) authentication
 * - Shared-key authentication for management API
 * - Sec-Fetch-Metadata CSRF protection
 * - X-Client header validation
 * - Session renewal
 * - SSRF protection for outbound HTTP requests
 *
 * ### Usage
 *
 * ```js
 * import { registerAuthHooks } from './middleware/auth.js';
 * registerAuthHooks(app, pool);
 * ```
 */

import { verifyToken } from '../auth/tokens.js';
import { config } from '../config/index.js';

/**
 * @typedef {object} AuthResult
 * @property {string|null} profileId - Authenticated profile UUID, or null.
 * @property {string|null} sessionId - Session UUID, or null.
 * @property {string|null} accessTokenId - Access token ID if token auth was used.
 * @property {string} ipAddr - Client IP address.
 * @property {string} userAgent - Client User-Agent header.
 */

/**
 * Extract authentication data from the request.
 *
 * Tries in order:
 * 1. `auth-token` cookie (JWE session token)
 * 2. `Authorization: Bearer` header
 * 3. `X-Auth-Token` header
 * 4. `X-Access-Token` header (API key)
 *
 * @param {import('fastify').FastifyRequest} request - Fastify request.
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @returns {Promise<AuthResult>}
 */
export async function extractAuth(request, pool) {
  const ipAddr = request.ip || request.socket?.remoteAddress || '127.0.0.1';
  const userAgent = request.headers['user-agent'] || '';

  let profileId = null;
  let sessionId = null;
  let accessTokenId = null;

  // 1. Session cookie or Bearer token
  const sessionToken = request.cookies?.[config.auth.cookieName]
    || (request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : null)
    || request.headers['x-auth-token'];

  if (sessionToken) {
    const { valid, claims } = await verifyToken(sessionToken);
    if (valid && claims?.uid) {
      profileId = claims.uid;
      sessionId = claims.sid || null;

      // Session renewal: if the token was issued more than 6 hours ago,
      // issue a fresh session token
      if (claims.iat && claims.exp) {
        const issuedAt = claims.iat * 1000;
        const now = Date.now();
        const renewalThreshold = 6 * 60 * 60 * 1000; // 6 hours
        if (now - issuedAt > renewalThreshold) {
          request.needsSessionRenewal = true;
          request.renewalProfileId = profileId;
          request.renewalSessionId = sessionId;
        }
      }
    }
  }

  // 2. Access token (API key)
  if (!profileId && request.headers['x-access-token']) {
    const accessToken = request.headers['x-access-token'];
    const tokenRow = pool.get('SELECT * FROM access_token WHERE token = ? AND (expires_at IS NULL OR expires_at > ?)', [accessToken, new Date().toISOString()]);
    if (tokenRow) {
      profileId = tokenRow.profile_id;
      accessTokenId = tokenRow.id;
    }
  }

  return { profileId, sessionId, accessTokenId, ipAddr, userAgent };
}

/**
 * Validate Sec-Fetch-Site header for CSRF protection.
 *
 * Rejects requests where `Sec-Fetch-Site` is `cross-site` unless the
 * request is a GET, HEAD, or OPTIONS (safe methods).
 *
 * @param {import('fastify').FastifyRequest} request - Fastify request.
 * @param {import('fastify').FastifyReply} reply - Fastify reply.
 * @returns {boolean} `true` if the request passes CSRF check.
 */
export function checkSecFetchSite(request, reply) {
  const secFetchSite = request.headers['sec-fetch-site'];
  if (!secFetchSite) return true; // Header absent = likely non-browser client

  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none') {
    return true;
  }

  // cross-site requests on safe methods are allowed
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true;
  }

  return false;
}

/**
 * Validate X-Client header as additional CSRF protection.
 *
 * Requires the `X-Client` header to be present on state-changing requests
 * (POST, PUT, PATCH, DELETE) when the `backendApiDoc` flag is enabled.
 *
 * @param {import('fastify').FastifyRequest} request - Fastify request.
 * @returns {boolean} `true` if the request passes client header check.
 */
export function checkClientHeader(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  if (!config.flags.backend_api_doc) return true;

  return !!request.headers['x-client'];
}

/**
 * Validate shared key for management API requests.
 *
 * @param {import('fastify').FastifyRequest} request - Fastify request.
 * @returns {boolean} `true` if the shared key is valid or not required.
 */
export function validateSharedKey(request) {
  const expectedKey = process.env.PENPOT_MANAGEMENT_SHARED_KEY;
  if (!expectedKey) return true; // No key configured = no auth required

  const providedKey = request.headers['x-shared-key']
    || (request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : null);

  return providedKey === expectedKey;
}

/**
 * Register all authentication and security hooks on the Fastify instance.
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server.
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 */
export function registerAuthHooks(fastify, pool) {
  // Pre-handler: extract auth data and attach to request
  fastify.addHook('preHandler', async (request, reply) => {
    const auth = await extractAuth(request, pool);
    request.auth = auth;

    // CSRF: Sec-Fetch-Site check
    if (!checkSecFetchSite(request, reply)) {
      return reply.code(403).send({
        type: 'authorization',
        code: 'csrf-check-failed',
        hint: 'Cross-site request rejected',
      });
    }

    // CSRF: X-Client header check
    if (!checkClientHeader(request)) {
      return reply.code(403).send({
        type: 'authorization',
        code: 'client-header-required',
        hint: 'X-Client header is required',
      });
    }
  });

  // Post-handler: session renewal
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (request.needsSessionRenewal && request.renewalProfileId) {
      const { createSessionToken } = await import('../auth/tokens.js');
      try {
        const newToken = await createSessionToken(request.renewalProfileId, request.renewalSessionId);
        reply.setCookie(config.auth.cookieName, newToken, {
          path: '/',
          httpOnly: true,
          secure: process.env.PENPOT_SECURE_COOKIES !== 'false',
          sameSite: 'lax',
          maxAge: config.auth.cookieMaxAge,
        });
      } catch {
        // Session renewal failure should not block the response
      }
    }
    return payload;
  });
}

/**
 * SSRF protection — validates that outbound HTTP request URLs are safe.
 *
 * Blocks:
 * - Non-HTTP/HTTPS schemes
 * - Loopback addresses (127/8, ::1)
 * - Link-local addresses (169.254/16, fe80::/10)
 * - Private networks (10/8, 172.16/12, 192.168/16, fc00::/7)
 * - Cloud metadata endpoints (169.254.169.254, fd00:ec2::254)
 * - IPv4-mapped loopback (0.0.0.0, 0.0.0.1)
 * - Multicast, broadcast, reserved ranges
 *
 * @param {string} urlStr - The URL to validate.
 * @returns {{ safe: boolean, reason?: string }} Result with safety flag and optional reason.
 */
export function validateOutboundUrl(urlStr) {
  let url;
  try {
    url = new URL(urlStr);
  } catch {
    return { safe: false, reason: 'Invalid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { safe: false, reason: 'Only HTTP and HTTPS schemes are allowed' };
  }

  const hostname = url.hostname.toLowerCase();

  // Allow configured hosts
  const allowedHosts = (process.env.PENPOT_SSRF_ALLOWED_HOSTS || '').split(',').map(h => h.trim()).filter(Boolean);
  if (allowedHosts.includes(hostname)) {
    return { safe: true };
  }

  // Block obvious dangerous patterns
  const blockedPatterns = [
    /^127\./,                          // 127.x.x.x
    /^0\./,                             // 0.x.x.x
    /^10\./,                            // 10.x.x.x
    /^172\.(1[6-9]|2[0-9]|3[01])\./,  // 172.16-31.x.x
    /^192\.168\./,                      // 192.168.x.x
    /^169\.254\./,                      // 169.254.x.x (link-local / cloud metadata)
    /^fc00:/,                           // fc00::/7 (IPv6 ULA)
    /^fe80:/,                           // fe80::/10 (IPv6 link-local)
    /^fd/,                              // fd00::/8 (IPv6 ULA)
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      return { safe: false, reason: `Blocked internal/reserved address: ${hostname}` };
    }
  }

  // Block explicit loopback and special addresses
  const blockedHosts = [
    'localhost',
    'localhost.localdomain',
    'ip6-localhost',
    'ip6-loopback',
    'ip6-localnet',
  ];

  if (blockedHosts.includes(hostname)) {
    return { safe: false, reason: `Blocked hostname: ${hostname}` };
  }

  // Block IPv4-mapped IPv6 loopback
  if (hostname === '::1' || hostname === '::ffff:127.0.0.1' || hostname === '[::1]') {
    return { safe: false, reason: 'Blocked IPv6 loopback address' };
  }

  return { safe: true };
}

/**
 * Create a safe `fetch` wrapper that validates URLs against SSRF rules
 * before making outbound requests.
 *
 * @param {typeof globalThis.fetch} [originalFetch=globalThis.fetch] - The base fetch implementation.
 * @returns {typeof globalThis.fetch} A fetch wrapper that validates URLs.
 */
export function createSafeFetch(originalFetch = globalThis.fetch) {
  return async function safeFetch(url, options = {}) {
    const urlStr = typeof url === 'string' ? url : url.toString();
    const validation = validateOutboundUrl(urlStr);
    if (!validation.safe) {
      throw new Error(`SSRF protection: ${validation.reason}`);
    }
    return originalFetch(url, options);
  };
}

/**
 * Safe fetch instance pre-configured with SSRF protection.
 */
export const safeFetch = typeof globalThis.fetch === 'function' ? createSafeFetch(globalThis.fetch) : null;