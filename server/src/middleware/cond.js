'use strict';
/**
 * @module middleware/cond
 * @description Conditional execution / ETag middleware — mirrors `app.rpc.cond`
 * from the Clojure backend.
 *
 * Implements HTTP-style conditional processing for RPC methods, allowing clients
 * to send an ETag-like key and receive a `304 Not Modified` shortcut response
 * when the resource hasn't changed.
 *
 * ### How it works
 *
 * When an RPC method is wrapped with `withConditional`:
 * 1. The handler is called normally.
 * 2. A fingerprint (ETag) of the result is computed using `keyFn`.
 * 3. If the client sends a `__key` parameter matching the fingerprint, the
 *    handler can short-circuit with a 304-like response.
 *
 * Note: In the Node.js port, conditional execution is disabled by default
 * (matching the Clojure backend's `*enabled*` dynamic var defaulting to `false`).
 * Set `PENPOT_FLAGS=enable-conditional-exec` to enable it.
 *
 * ### Usage
 *
 * ```js
 * import { withConditional } from '../middleware/cond.js';
 *
 * register('get-file', {
 *   auth: true,
 *   handler: withConditional(
 *     async (params, ctx) => { /* ... *\/ },
 *     { keyFn: (result) => `${result.revn}:${result.modifiedAt}` }
 *   ),
 * });
 * ```
 */

import { flagEnabled } from '../config/index.js';
import crypto from 'node:crypto';

/**
 * Generate a short hash fingerprint from a string key.
 * Uses SHA-256 for fast, deterministic hashing.
 *
 * @param {string} key - The string to hash.
 * @returns {string} A Base64url-encoded hash (truncated to 20 chars for brevity).
 */
function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('base64url').substring(0, 20);
}

/**
 * Wrap an RPC handler with conditional execution / ETag support.
 *
 * When conditional execution is enabled (via `enable-conditional-exec` flag),
 * and the client sends a `__key` parameter matching the current resource fingerprint,
 * the handler returns a `{ __cond: 'not-modified', key: '<etag>' }` response
 * instead of the full data.
 *
 * @param {function} handler - The async RPC handler function.
 * @param {{ keyFn?: function(any): string }} [opts] - Options.
 * @param {function(any): string} opts.keyFn - Function to compute a string key from the result.
 * @returns {function} Wrapped handler.
 */
export function withConditional(handler, opts = {}) {
  const { keyFn } = opts;

  if (!keyFn) return handler;

  return async function condWrapper(params, ctx) {
    const result = await handler(params, ctx);

    if (!flagEnabled('conditional-exec')) {
      return result;
    }

    try {
      const currentKey = keyFn(result);
      const etag = hashKey(currentKey);

      // If the client sent a key and it matches, signal not-modified
      if (params.__key && params.__key === etag) {
        return { __cond: 'not-modified', key: etag };
      }

      // Attach ETag to the response in a way the dispatcher can read
      if (result && typeof result === 'object') {
        result.__etag = etag;
      }

      return result;
    } catch {
      // If key computation fails, just return the result as-is
      return result;
    }
  };
}