/**
 * @module rpc/dispatcher
 * @description RPC method registry and HTTP request dispatcher — mirrors
 * `app.http.rpc` from the Clojure backend.
 *
 * Method names use **kebab-case strings** matching the Clojure `::kebab-case`
 * keywords exactly (e.g. `'login-with-password'`, `'get-profile'`).
 *
 * ### Authentication flow
 *
 * 1. **Session cookie** (`auth-token` cookie) → JWE → profile ID
 * 2. **Access token header** (`X-Access-Token`) → DB lookup → profile ID
 * 3. **Anonymous** — methods with `auth: false` allow unauthenticated access
 *
 * ### Error handling
 *
 * Handlers throw `RpcError` instances (via the `errors` factory) which are
 * automatically mapped to HTTP status codes:
 *
 * | `type`              | HTTP status |
 * |---------------------|-------------|
 * | `'not-found'`       | 404         |
 * | `'validation'`      | 400         |
 * | `'authorization'`   | 403         |
 * | `'authentication'`  | 401         |
 * | `'conflict'`        | 409         |
 * | other               | 500         |
 */

import { verifyToken } from '../auth/tokens.js';
import { config, flagEnabled } from '../config/index.js';
import { extractAuth } from '../middleware/auth.js';
import { decode as transitDecode, encode as transitEncode, decodeRequest, encodeResponse, toKebabCase, toCamelCase } from '../transit/index.js';

/** @type {Map<string, RpcMethodDefinition>} Registered RPC methods. */
const methods = new Map();

/**
 * Custom error class for RPC-level failures with structured error responses.
 *
 * Each instance carries a `type`, `code`, and `hint` that are serialised to JSON
 * and returned with the appropriate HTTP status code.
 */
export class RpcError extends Error {
  /**
   * @param {string} type - Error category (e.g. `'not-found'`, `'validation'`).
   * @param {string} code - Machine-readable error code (e.g. `'object-not-found'`).
   * @param {string} hint - Human-readable error description.
   * @param {Record<string, *>} [extra={}] - Additional properties to include in the JSON body.
   */
  constructor(type, code, hint, extra = {}) {
    super(hint);
    this.type = type;
    this.code = code;
    this.hint = hint;
    this.extra = extra;
  }

  /**
   * Serialise the error to a JSON-compatible object.
   *
   * @returns {{ type: string, code: string, hint: string } & Record<string, *>}
   */
  toJSON() {
    return { type: this.type, code: this.code, hint: this.hint, ...this.extra };
  }
}

/**
 * Factory functions for common RPC error types. Each returns a new `RpcError`.
 *
 * @type {{
 *   notFound: (hint: string, extra?: Record<string, *>) => RpcError,
 *   validation: (hint: string, extra?: Record<string, *>) => RpcError,
 *   authorization: (hint: string, extra?: Record<string, *>) => RpcError,
 *   conflict: (hint: string, extra?: Record<string, *>) => RpcError,
 *   internal: (hint: string, extra?: Record<string, *>) => RpcError,
 *   authentication: (hint: string, extra?: Record<string, *>) => RpcError,
 * }}
 */
export const errors = {
  notFound: (hint, extra = {}) => new RpcError('not-found', 'object-not-found', hint, extra),
  validation: (hint, extra = {}) => new RpcError('validation', 'validation-error', hint, extra),
  authorization: (hint, extra = {}) => new RpcError('authorization', 'authorization-error', hint, extra),
  conflict: (hint, extra = {}) => new RpcError('conflict', 'conflict-error', hint, extra),
  internal: (hint, extra = {}) => new RpcError('internal', 'internal-error', hint, extra),
  authentication: (hint, extra = {}) => new RpcError('authentication', 'authentication-required', hint, extra),
};

/**
 * @typedef {object} RpcMethodDefinition
 * @property {boolean} auth - Whether authentication is required. When `false`,
 *   the method is accessible without a session.
 * @property {function(Record<string, *>, RpcContext): Promise<*>} handler -
 *   The method implementation. Receives the request `params` and a `ctx` object.
 * @property {string|null} [params=null] - Parameter type hint (informational).
 * @property {string|null} [result=null] - Result type hint (informational).
 * @property {string|null} [added=null] - Penpot version when the method was added.
 */

/**
 * Register an RPC method.
 *
 * @param {string} name - Method name in kebab-case (e.g. `'login-with-password'`).
 * @param {RpcMethodDefinition} definition - The method definition.
 */
export function registerMethod(name, definition) {
  methods.set(name, {
    auth: definition.auth !== false,
    handler: definition.handler,
    params: definition.params || null,
    result: definition.result || null,
    added: definition.added || null,
  });
}

/**
 * Get all registered RPC methods with their metadata.
 *
 * @returns {IterableIterator<[string, RpcMethodDefinition]>}
 */
export function getRegisteredMethods() {
  return methods.entries();
}

/**
 * Map an RPC error `type` to an HTTP status code.
 *
 * @param {string} type - Error type from `RpcError`.
 * @returns {number} HTTP status code.
 */
function errorTypeToStatus(type) {
  switch (type) {
    case 'not-found': return 404;
    case 'validation': return 400;
    case 'authorization': return 403;
    case 'authentication': return 401;
    case 'conflict': return 409;
    default: return 500;
  }
}

/**
 * @typedef {object} RpcContext
 * @property {import('../db/sqlite.js').DatabasePool} pool - Database pool with query helpers.
 * @property {string|null} profileId - Authenticated profile UUID, or `null`.
 * @property {string|null} sessionId - HTTP session UUID, or `null`.
 * @property {string} ipAddr - Client IP address.
 * @property {string} userAgent - Client `User-Agent` header.
 * @property {string} requestId - Unique request identifier (UUID v4).
 * @property {Date} requestAt - Timestamp when the request was received.
 * @property {boolean} [isManagement] - `true` if this is a management API request.
 */

/**
 * Create a Fastify route handler for RPC API endpoints
 * (`/api/rpc/command/:methodName` and `/api/main/methods/:methodName`).
 *
 * Resolves authentication from session cookie, `X-Auth-Token`, or
 * `Authorization: Bearer` header, then dispatches to the registered handler.
 *
 * **GET requests** are only allowed for `get-*` methods (read-only).
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @returns {function(import('fastify').FastifyRequest, import('fastify').FastifyReply): Promise<*>}
 *   Fastify request handler.
 */
export function createRpcHandler(pool) {
  return async (request, reply) => {
    const methodName = request.params.methodName;

    // GET/HEAD only allowed for read methods
    if (['GET', 'HEAD'].includes(request.method) && !methodName.startsWith('get-')) {
      return reply.code(405).send({
        type: 'validation',
        code: 'method-not-allowed',
        hint: 'GET requests only allowed for get-* methods',
      });
    }

    const methodDef = methods.get(methodName);
    if (!methodDef) {
      return reply.code(404).send({
        type: 'not-found',
        code: 'method-not-found',
        hint: `Method '${methodName}' not found`,
      });
    }

    // Auth resolution: use the shared auth middleware
    const { profileId, sessionId, accessTokenId } = request.auth || await extractAuth(request, pool);

    // Auth enforcement
    if (methodDef.auth && !profileId) {
      return reply.code(403).send({
        type: 'authentication',
        code: 'authentication-required',
        hint: 'Authentication is required',
      });
    }

    // Parse request body based on Content-Type (Transit+JSON or plain JSON)
    let params;
    const contentType = request.headers['content-type'] || '';
    const rawBody = request.body;

    if (contentType.includes('multipart/form-data')) {
      params = {};
      try {
        const data = await request.file();
        if (data) {
          const fileFields = {};
          const otherFields = {};

          if (data.fields) {
            for (const [key, value] of Object.entries(data.fields)) {
              if (value && typeof value === 'object' && value.file) {
                fileFields[key] = value;
              } else {
                const val = value?.value ?? value?.toString?.() ?? value;
                try { otherFields[key] = JSON.parse(val); } catch { otherFields[key] = val; }
              }
            }
          }

          if (data.file) {
            const tmpFile = data.file;
            const tmpMtype = tmpFile.mimetype || data.mimetype || 'application/octet-stream';
            const tmpSize = tmpFile.file?.bytesRead ?? tmpFile.file?.byteLength ?? 0;
            params = {
              ...otherFields,
              content: {
                path: tmpFile.filepath,
                mtype: tmpMtype,
                size: tmpSize,
                filename: tmpFile.filename || 'upload',
              },
            };
          } else {
            params = otherFields;
          }
        }

        const parts = request.parts ? request.parts() : null;
        if (parts) {
          for await (const part of parts) {
            if (part.type === 'file' && !params.content) {
              params.content = {
                path: part.file.filepath,
                mtype: part.file.mimetype || 'application/octet-stream',
                size: part.file.file?.bytesRead ?? 0,
                filename: part.file.filename || 'upload',
              };
            } else if (part.type === 'field' || part.field) {
              const field = part.field || part;
              try { params[field.fieldname] = JSON.parse(field.value); } catch { params[field.fieldname] = field.value; }
            }
          }
        }
      } catch { /* multipart parsing failed */ }
    } else if (typeof rawBody === 'string' && contentType.includes('transit+json')) {
      // Transit+JSON request — decode with Transit parser
      params = decodeRequest(rawBody, contentType);
    } else if (typeof rawBody === 'object' && rawBody !== null) {
      // Fastify already parsed JSON — convert keys to kebab-case
      params = toKebabCase(rawBody);
    } else if (typeof rawBody === 'string') {
      // Plain string body — try JSON parse then convert keys
      try {
        params = toKebabCase(JSON.parse(rawBody));
      } catch {
        params = { body: rawBody };
      }
    } else {
      params = {};
    }

    // The Penpot frontend sends an RPC envelope: {id, method, params}.
    // Extract the inner params so handlers receive only the command parameters.
    if (params && typeof params === 'object' && params.params && typeof params.params === 'object') {
      params = params.params;
    }

    // Convert kebab-case keys back to camelCase so handlers can use
    // params.teamId instead of params['team-id']. The Clojure backend
    // uses kebab-case internally, but all JS handler code uses camelCase.
    params = toCamelCase(params);

    // For GET requests, also merge query string params
    if (['GET', 'HEAD'].includes(request.method)) {
      params = { ...params, ...(request.query || {}) };
    }

    /** @type {RpcContext} */
    const context = {
      pool,
      profileId,
      sessionId,
      ipAddr: request.ip,
      userAgent: request.headers['user-agent'] || '',
      requestId: crypto.randomUUID(),
      requestAt: new Date(),
    };

    try {
      const result = await methodDef.handler(params, context);

      if (result === null || result === undefined) {
        return reply.code(204).send();
      }
      if (Buffer.isBuffer(result) || result?._readableState) {
        return reply.type('application/octet-stream').send(result);
      }

      // Format response based on Accept header and query parameters
      const accept = request.headers['accept'] || '';
      const queryString = request.url?.includes('?') ? request.url.split('?')[1] : '';
      const { body: responseBody, contentType: responseContentType } = encodeResponse(result, {
        accept,
        queryString,
      });

      return reply.type(responseContentType).send(responseBody);
    } catch (err) {
      if (err instanceof RpcError) {
        // Error responses are always Transit+JSON verbose (matching Clojure backend)
        const { body: errorBody } = encodeResponse(err.toJSON(), { verbose: true });
        return reply.code(errorTypeToStatus(err.type))
          .type('application/transit+json')
          .send(errorBody);
      }
      console.error(`[rpc] Error in ${methodName}:`, err);
      const { body: errorBody } = encodeResponse(
        { type: 'internal', code: 'internal-error', hint: err.message },
        { verbose: true }
      );
      return reply.code(500).type('application/transit+json').send(errorBody);
    }
  };
}

/**
 * Create a Fastify route handler for the Management API
 * (`/api/management/methods/:methodName`).
 *
 * Management requests require a `X-Shared-Key` header matching
 * `PENPOT_MANAGEMENT_SHARED_KEY` for authorisation.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @returns {function(import('fastify').FastifyRequest, import('fastify').FastifyReply): Promise<*>}
 *   Fastify request handler.
 */
export function createManagementHandler(pool) {
  return async (request, reply) => {
    const methodName = request.params.methodName;
    const methodDef = methods.get(methodName);
    if (!methodDef) {
      return reply.code(404).send({ type: 'not-found', code: 'method-not-found', hint: `Management method '${methodName}' not found` });
    }

    const sharedKey = request.headers['x-shared-key'] || request.headers.authorization?.replace('Bearer ', '');
    const expectedKey = process.env.PENPOT_MANAGEMENT_SHARED_KEY;
    if (expectedKey && sharedKey !== expectedKey) {
      return reply.code(403).send({ type: 'authorization', code: 'authorization-error', hint: 'Invalid shared key' });
    }

    // Parse management request body (supports Transit and JSON)
    const mgmtContentType = request.headers['content-type'] || '';
    let mgmtParams;
    if (typeof request.body === 'string' && mgmtContentType.includes('transit+json')) {
      mgmtParams = decodeRequest(request.body, mgmtContentType);
    } else if (typeof request.body === 'object' && request.body !== null) {
      mgmtParams = toKebabCase(request.body);
    } else {
      mgmtParams = request.query || {};
    }

    /** @type {RpcContext} */
    const context = {
      pool, profileId: null, sessionId: null,
      ipAddr: request.ip, userAgent: request.headers['user-agent'] || '',
      requestId: crypto.randomUUID(), requestAt: new Date(), isManagement: true,
    };

    try {
      const result = await methodDef.handler(mgmtParams, context);
      if (result === null || result === undefined) return reply.code(204).send();

      const { body: responseBody, contentType: responseContentType } = encodeResponse(result, {
        accept: request.headers['accept'] || '',
      });
      return reply.type(responseContentType).send(responseBody);
    } catch (err) {
      if (err instanceof RpcError) {
        const { body: errorBody } = encodeResponse(err.toJSON(), { verbose: true });
        return reply.code(errorTypeToStatus(err.type))
          .type('application/transit+json')
          .send(errorBody);
      }
      console.error(`[management] Error in ${methodName}:`, err);
      const { body: errorBody } = encodeResponse(
        { type: 'internal', code: 'internal-error', hint: err.message },
        { verbose: true }
      );
      return reply.code(500).type('application/transit+json').send(errorBody);
    }
  };
}

/**
 * Dynamically import and register all RPC command modules.
 *
 * Each module must export a default function `(register, pool) => void`
 * that calls `register(methodName, definition)` for its commands.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool passed to each module.
 * @returns {Promise<void>}
 */
export async function registerAllCommands(pool) {
  const modules = [
    '../rpc/auth.js',
    '../rpc/teams.js',
    '../rpc/projects.js',
    '../rpc/files.js',
    '../rpc/files_update.js',
    '../rpc/profile.js',
    '../rpc/comments.js',
    '../rpc/media.js',
    '../rpc/access_token.js',
    '../rpc/files_thumbnails.js',
    '../rpc/fonts.js',
    '../rpc/files_snapshots.js',
    '../rpc/files_share.js',
    '../rpc/teams_invitations.js',
    '../rpc/audit.js',
    '../rpc/binfile.js',
    '../rpc/demo.js',
    '../rpc/feedback.js',
    '../rpc/ldap.js',
    '../rpc/management.js',
    '../rpc/nitrate.js',
    '../rpc/search.js',
    '../rpc/viewer.js',
    '../rpc/webhooks.js',
    '../rpc/verify_token.js',
    '../rpc/export.js',
    '../auth/oidc.js',
  ];

  for (const modPath of modules) {
    const mod = await import(modPath);
    mod.default(registerMethod, pool);
  }

  const methodNames = [...methods.keys()].sort();
  console.log(`[rpc] Registered ${methodNames.length} methods: ${methodNames.join(', ')}`);
}