/**
 * @module middleware/security
 * @description HTTP security headers middleware — mirrors the security headers
 * from the Clojure backend's HTTP middleware stack.
 *
 * Adds common security headers to all responses:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 0
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Content-Security-Policy (configurable)
 * - Strict-Transport-Security (when HTTPS is enabled)
 * - Permissions-Policy
 *
 * ### Usage
 *
 * ```js
 * import { registerSecurityHeaders } from './middleware/security.js';
 * registerSecurityHeaders(fastify);
 * ```
 */

import { config } from '../config/index.js';

/**
 * Build the Content-Security-Policy header value.
 *
 * Defaults to a restrictive policy that allows:
 * - Scripts from self
 * - Styles from self and inline
 * - Images from self, data:, and blob:
 * - Fonts from self
 * - Connect from self (for RPC/WebSocket)
 * - Frame-ancestors none (prevents clickjacking)
 *
 * @param {object} [opts={}] - CSP options.
 * @param {string[]} [opts.extraScriptSrc=[]] - Additional script-src domains.
 * @param {string[]} [opts.extraConnectSrc=[]] - Additional connect-src domains.
 * @param {string[]} [opts.extraImgSrc=[]] - Additional img-src domains.
 * @param {string[]} [opts.extraStyleSrc=[]] - Additional style-src domains.
 * @param {string[]} [opts.extraFontSrc=[]] - Additional font-src domains.
 * @param {boolean} [opts.reportOnly=false] - If true, use Content-Security-Policy-Report-Only.
 * @returns {string} CSP header value.
 */
export function buildCSP(opts = {}) {
  const {
    extraScriptSrc = [],
    extraConnectSrc = [],
    extraImgSrc = [],
    extraStyleSrc = [],
    extraFontSrc = [],
  } = opts;

  const directives = [
    `default-src 'none'`,
    `script-src 'self' ${extraScriptSrc.join(' ')}`.trim(),
    `style-src 'self' 'unsafe-inline' ${extraStyleSrc.join(' ')}`.trim(),
    `img-src 'self' data: blob: ${extraImgSrc.join(' ')}`.trim(),
    `font-src 'self' ${extraFontSrc.join(' ')}`.trim(),
    `connect-src 'self' ${extraConnectSrc.join(' ')}`.trim(),
    `frame-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
  ];

  return directives.join('; ');
}

/**
 * Register security headers as a Fastify onSend hook.
 *
 * Adds security headers to every response, including CSP, HSTS,
 * X-Content-Type-Options, and others.
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server.
 * @param {object} [opts={}] - Security header options (passed to buildCSP).
 * @param {boolean} [opts.enableCsp=true] - Whether to set the Content-Security-Policy header.
 * @param {boolean} [opts.enableHsts=true] - Whether to set Strict-Transport-Security.
 * @param {string} [opts.hstsMaxAge='63072000'] - HSTS max-age in seconds (default 2 years).
 * @param {object} [opts.cspOptions={}] - Options passed to buildCSP.
 */
export function registerSecurityHeaders(fastify, opts = {}) {
  const {
    enableCsp = true,
    enableHsts = true,
    hstsMaxAge = '63072000',
    cspOptions = {},
  } = opts;

  const cspValue = buildCSP(cspOptions);

  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '0');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    if (enableCsp && !reply.sent) {
      reply.header('Content-Security-Policy', cspValue);
    }

    if (enableHsts && config.publicUri?.startsWith('https')) {
      reply.header('Strict-Transport-Security', `max-age=${hstsMaxAge}; includeSubDomains`);
    }

    if (!reply.hasHeader('Cache-Control')) {
      reply.header('Cache-Control', 'no-store');
    }

    return payload;
  });
}

/**
 * CORS headers middleware for the RPC API.
 *
 * The Penpot frontend communicates with the backend via Transit+JSON on the
 * same origin, so CORS headers are only needed for:
 * - Development (different port)
 * - Third-party integrations
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server.
 * @param {object} [opts={}] - CORS options.
 * @param {string} [opts.origin='*'] - Allowed origins.
 * @param {string[]} [opts.methods=['GET','POST','PUT','PATCH','DELETE','OPTIONS']] - Allowed methods.
 * @param {string[]} [opts.headers=['Content-Type','Authorization','X-Auth-Token','X-Client','X-Access-Token']] - Allowed headers.
 * @param {boolean} [opts.credentials=true] - Whether to allow credentials.
 * @param {number} [opts.maxAge=86400] - Preflight cache duration in seconds.
 */
export function registerCorsHeaders(fastify, opts = {}) {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization', 'X-Auth-Token', 'X-Client', 'X-Access-Token', 'X-Shared-Key'],
    credentials = true,
    maxAge = 86400,
  } = opts;

  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Methods', methods.join(', '));
    reply.header('Access-Control-Allow-Headers', headers.join(', '));
    reply.header('Access-Control-Allow-Credentials', String(credentials));
    reply.header('Access-Control-Max-Age', String(maxAge));

    if (request.method === 'OPTIONS') {
      reply.code(204);
      return reply.send();
    }
  });
}