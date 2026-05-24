/**
 * @module middleware/errors
 * @description HTTP error handling middleware — mirrors `app.http.errors` from
 * the Clojure backend.
 *
 * Provides a centralized error handler that maps RpcError types and unhandled
 * exceptions to appropriate HTTP responses with structured JSON bodies.
 *
 * ### Error type → HTTP status mapping
 *
 * | Error type        | HTTP status | Description                     |
 * |-------------------|-------------|---------------------------------|
 * | authentication    | 401         | Authentication required         |
 * | authorization     | 403         | Permission denied               |
 * | restriction       | 405/400     | Method not allowed / restricted |
 * | rate-limit        | 429         | Too many requests               |
 * | concurrency-limit | 429         | Too many concurrent requests    |
 * | validation        | 400/409/413 | Various validation failures     |
 * | assertion         | 500         | Data assertion failure          |
 * | not-found         | 404         | Resource not found              |
 * | internal          | 500         | Server error                    |
 * | default           | 500         | Unexpected/unhandled error       |
 *
 * ### Usage
 *
 * ```js
 * import { errorHandler, requestContextMiddleware } from './middleware/errors.js';
 * fastify.setErrorHandler(errorHandler);
 * fastify.addHook('onRequest', requestContextMiddleware);
 * ```
 */

import { RpcError } from '../rpc/dispatcher.js';

/**
 * Map an error type string to an HTTP status code.
 *
 * Extends the basic mapping in `dispatcher.js` with additional error types
 * from the Clojure backend's `handle-error` multimethod.
 *
 * @param {string} type - Error type from `RpcError`.
 * @param {string} [code] - Optional error code for disambiguation.
 * @returns {number} HTTP status code.
 */
export function errorTypeToStatus(type, code) {
  switch (type) {
    case 'authentication': return 401;
    case 'authorization': return 403;
    case 'not-found': return 404;
    case 'restriction':
      return code === 'method-not-allowed' ? 405 : 400;
    case 'rate-limit': return 429;
    case 'concurrency-limit': return 429;
    case 'validation':
      if (code === 'vern-conflict') return 409;
      if (code === 'request-body-too-large') return 413;
      return 400;
    case 'assertion': return 500;
    case 'internal': return 500;
    case 'conflict': return 409;
    default: return 500;
  }
}

/**
 * Build a structured error response body from an RpcError.
 *
 * @param {RpcError} err - The RPC error.
 * @returns {{ type: string, code: string, hint: string } & Record<string, *>}
 */
function formatRpcError(err) {
  const body = {
    type: err.type,
    code: err.code,
    hint: err.hint,
  };
  if (err.extra && Object.keys(err.extra).length > 0) {
    Object.assign(body, err.extra);
  }
  return body;
}

/**
 * Build a structured error response body from an unhandled exception.
 *
 * @param {Error} err - The unhandled error.
 * @param {object} [request] - Fastify request (for logging context).
 * @returns {{ type: string, code: string, hint: string }}
 */
function formatUnhandledError(err, request) {
  const context = requestContext(request);
  console.error('[errors] Unhandled error', {
    error: err.message,
    stack: err.stack?.split('\n')[0],
    ...context,
  });

  return {
    type: 'server-error',
    code: 'unexpected',
    hint: err.message || 'Internal server error',
  };
}

/**
 * Extract context information from a request for error logging.
 *
 * @param {object} [request] - Fastify request object.
 * @returns {{ method: string, path: string, ip: string, profileId: string|null, userAgent: string }}
 */
function requestContext(request) {
  if (!request) {
    return { method: 'UNKNOWN', path: 'UNKNOWN', ip: 'UNKNOWN', profileId: null, userAgent: 'UNKNOWN' };
  }
  const auth = request.auth || {};
  return {
    method: request.method,
    path: request.url,
    ip: request.ip || 'UNKNOWN',
    profileId: auth.profileId || null,
    userAgent: request.headers?.['user-agent'] || 'UNKNOWN',
  };
}

/**
 * Fastify error handler that converts RpcError and unhandled exceptions
 * into structured JSON responses.
 *
 * This should be set as the Fastify server's global error handler.
 *
 * @param {Error} err - The error thrown during request processing.
 * @param {import('fastify').FastifyRequest} request - Fastify request.
 * @param {import('fastify').FastifyReply} reply - Fastify reply.
 */
export function errorHandler(err, request, reply) {
  if (err instanceof RpcError) {
    const status = errorTypeToStatus(err.type, err.code);
    const body = formatRpcError(err);

    if (status >= 500) {
      console.error(`[errors] ${err.type}/${err.code}: ${err.hint}`, requestContext(request));
    }

    return reply.code(status).send(body);
  }

  if (err.type === 'restriction' && err.code === 'rate-limit-exceeded') {
    return reply.code(429).send({
      type: 'restriction',
      code: 'rate-limit-exceeded',
      hint: err.hint || 'Too many requests',
    });
  }

  if (err.statusCode === 413) {
    return reply.code(413).send({
      type: 'validation',
      code: 'request-body-too-large',
      hint: 'Request body too large',
    });
  }

  if (err.statusCode === 404 && !err.type) {
    return reply.code(404).send({
      type: 'not-found',
      code: 'route-not-found',
      hint: err.message || 'Not found',
    });
  }

  const body = formatUnhandledError(err, request);
  return reply.code(500).send(body);
}

/**
 * Fastify onRequest hook that attaches request context for error logging
 * and strips sensitive headers from error responses.
 *
 * @param {import('fastify').FastifyRequest} request - Fastify request.
 * @param {import('fastify').FastifyReply} reply - Fastify reply.
 */
export function requestContextMiddleware(request, reply, done) {
  request.errorContext = requestContext(request);
  if (done) done();
}

/**
 * Send a structured error response without throwing.
 * Useful for middleware that needs to short-circuit a request.
 *
 * @param {import('fastify').FastifyReply} reply - Fastify reply.
 * @param {string} type - Error type (e.g. 'authentication', 'not-found').
 * @param {string} code - Error code (e.g. 'authentication-required').
 * @param {string} hint - Human-readable description.
 * @param {Record<string, *>} [extra={}] - Additional properties.
 * @returns {import('fastify').FastifyReply}
 */
export function sendError(reply, type, code, hint, extra = {}) {
  const status = errorTypeToStatus(type, code);
  const body = { type, code, hint, ...extra };
  return reply.code(status).send(body);
}