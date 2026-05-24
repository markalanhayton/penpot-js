/**
 * @module middleware/rate-limit
 * @description Rate limiting and concurrency limiting middleware — mirrors
 * `app.rpc.climit` from the Clojure backend.
 *
 * Provides per-profile and global concurrency limiting for CPU-intensive
 * operations like image processing, font generation, and file updates.
 *
 * ### Usage
 *
 * ```js
 * import { rateLimit, climit } from '../middleware/rate-limit.js';
 *
 * // Apply to a route handler:
 * register('upload-file-media-object', {
 *   auth: true,
 *   handler: climit('process-image', handler, { perProfile: 2, global: 10 }),
 * });
 * ```
 *
 * ### Limit types
 *
 * | Type         | Description                                              |
 * |--------------|----------------------------------------------------------|
 * | `perProfile` | Max concurrent requests per profile (default: 2)        |
 * | `global`     | Max concurrent requests across all profiles (default: 10) |
 */

/** @type {Map<string, { count: number, queue: Array<function> }>} */
const globalSlots = new Map();

/** @type {Map<string, Map<string, { count: number, queue: Array<function> }>>} */
const profileSlots = new Map();

/**
 * Acquire a concurrency slot. If all slots are occupied, the request is
 * queued and will be processed when a slot becomes available.
 *
 * @param {string} key - Limiter key (e.g. 'process-image')
 * @param {string} profileId - Profile UUID for per-profile limiting.
 * @param {{ perProfile?: number, global?: number }} limits
 * @returns {Promise<void>} Resolves when a slot is acquired.
 */
function acquireSlot(key, profileId, limits) {
  const { perProfile = 2, global: globalLimit = 10 } = limits;

  // Check global limit
  if (!globalSlots.has(key)) {
    globalSlots.set(key, { count: 0, queue: [] });
  }
  const globalSlot = globalSlots.get(key);

  // Check per-profile limit
  if (!profileSlots.has(key)) {
    profileSlots.set(key, new Map());
  }
  const profileMap = profileSlots.get(key);
  if (!profileMap.has(profileId)) {
    profileMap.set(profileId, { count: 0, queue: [] });
  }
  const profileSlot = profileMap.get(profileId);

  return new Promise((resolve) => {
    if (globalSlot.count < globalLimit && profileSlot.count < perProfile) {
      globalSlot.count++;
      profileSlot.count++;
      resolve();
    } else {
      // Queue the request
      const tryAcquire = () => {
        if (globalSlot.count < globalLimit && profileSlot.count < perProfile) {
          globalSlot.count++;
          profileSlot.count++;
          resolve();
          return true;
        }
        return false;
      };

      // Add to both queues
      globalSlot.queue.push(tryAcquire);
      profileSlot.queue.push(tryAcquire);
    }
  });
}

/**
 * Release a concurrency slot after the handler completes.
 *
 * @param {string} key - Limiter key.
 * @param {string} profileId - Profile UUID.
 */
function releaseSlot(key, profileId) {
  const globalSlot = globalSlots.get(key);
  const profileMap = profileSlots.get(key);
  const profileSlot = profileMap?.get(profileId);

  if (globalSlot) {
    globalSlot.count = Math.max(0, globalSlot.count - 1);
    // Process queued requests
    while (globalSlot.queue.length > 0 && globalSlot.count < 10) {
      const next = globalSlot.queue.shift();
      if (next()) break;
    }
  }

  if (profileSlot) {
    profileSlot.count = Math.max(0, profileSlot.count - 1);
    while (profileSlot.queue.length > 0 && profileSlot.count < 2) {
      const next = profileSlot.queue.shift();
      if (next()) break;
    }
  }
}

/**
 * Wrap an RPC handler with concurrency limiting.
 * Mirrors `app.rpc.climit/invoke!` from the Clojure backend.
 *
 * @param {string} key - Limiter key (e.g. 'process-image', 'file-thumbnail-ops').
 * @param {function} handler - The original async handler function.
 * @param {{ perProfile?: number, global?: number }} [limits] - Concurrency limits.
 * @returns {function} Wrapped handler that enforces concurrency limits.
 *
 * @example
 * register('upload-file-media-object', {
 *   auth: true,
 *   handler: climit('process-image', async (params, ctx) => { ... }, { perProfile: 2, global: 10 }),
 * });
 */
export function climit(key, handler, limits = {}) {
  return async function rateLimitedHandler(params, ctx) {
    const profileId = ctx.profileId || 'anonymous';
    await acquireSlot(key, profileId, limits);
    try {
      return await handler(params, ctx);
    } finally {
      releaseSlot(key, profileId);
    }
  };
}

/**
 * Simple rate limiter that rejects requests exceeding a rate threshold.
 * Uses a sliding window approach with per-profile tracking.
 *
 * @param {string} key - Limiter key.
 * @param {function} handler - The handler to rate-limit.
 * @param {{ windowMs?: number, maxRequests?: number }} [opts]
 * @returns {function} Wrapped handler that enforces rate limits.
 */
export function rateLimit(key, handler, opts = {}) {
  const { windowMs = 60000, maxRequests = 60 } = opts;

  /** @type {Map<string, Array<number>>} */
  const windows = new Map();

  return async function rateLimitedHandler(params, ctx) {
    const profileId = ctx.profileId || ctx.ipAddr || 'anonymous';
    const now = Date.now();

    if (!windows.has(profileId)) {
      windows.set(profileId, []);
    }

    const timestamps = windows.get(profileId);

    // Remove expired timestamps
    const cutoff = now - windowMs;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= maxRequests) {
      throw {
        type: 'restriction',
        code: 'rate-limit-exceeded',
        hint: `Too many requests. Limit: ${maxRequests} per ${windowMs / 1000}s`,
      };
    }

    timestamps.push(now);

    return await handler(params, ctx);
  };
}

/**
 * Clean up stale rate limit tracking data periodically.
 * Should be called from a background task.
 */
export function cleanupRateLimitData() {
  const now = Date.now();
  const STALE_MS = 5 * 60 * 1000; // 5 minutes

  for (const [key, slot] of globalSlots) {
    if (slot.count === 0 && slot.queue.length === 0) {
      globalSlots.delete(key);
    }
  }

  for (const [key, profileMap] of profileSlots) {
    for (const [profileId, profileSlot] of profileMap) {
      if (profileSlot.count === 0 && profileSlot.queue.length === 0) {
        profileMap.delete(profileId);
      }
    }
    if (profileMap.size === 0) {
      profileSlots.delete(key);
    }
  }
}