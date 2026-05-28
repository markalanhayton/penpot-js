'use strict';
/**
 * @module middleware/retry
 * @description RPC retry middleware — mirrors `app.rpc.retry` from the Clojure backend.
 *
 * Provides automatic retry logic for RPC handlers that may fail due to transient
 * conditions such as SQLite constraint violations (unique key conflicts).
 *
 * ### Usage
 *
 * ```js
 * import { withRetry } from '../middleware/retry.js';
 *
 * register('create-file', {
 *   auth: true,
 *   handler: withRetry(async (params, ctx) => {
 *     // handler that may conflict on unique constraints
 *   }, { maxRetries: 3 }),
 * });
 * ```
 *
 * ### Error classification
 *
 * Only specific error conditions trigger a retry:
 * - SQLite `SQLITE_CONSTRAINT_UNIQUE` errors (code `SQLITE_CONSTRAINT_UNIQUE`)
 * - Custom `RpcError` with code `'conflict-error'`
 */

import { RpcError } from '../rpc/dispatcher.js';

/**
 * Check if an error is retryable (a transient conflict that may succeed on retry).
 *
 * @param {Error} err - The thrown error.
 * @returns {boolean} `true` if the error is retryable.
 */
export function isRetryable(err) {
  if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') return true;
  if (err?.errno === 2067) return true;
  if (err instanceof RpcError && err.code === 'conflict-error') return true;
  return false;
}

/**
 * Wrap an RPC handler with automatic retry on transient failures.
 *
 * @param {function} handler - The async RPC handler function.
 * @param {{ maxRetries?: number, when?: function(Error): boolean, label?: string }} [opts]
 * @returns {function} Wrapped handler with retry logic.
 */
export function withRetry(handler, opts = {}) {
  const maxRetries = opts.maxRetries ?? 3;
  const when = opts.when || isRetryable;
  const label = opts.label || handler.name || 'rpc-handler';

  return async function retryWrapper(params, ctx) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await handler(params, ctx);
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries && when(err)) {
          console.warn(`[${label}] Retry ${attempt + 1}/${maxRetries} after error: ${err.message}`);
          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };
}