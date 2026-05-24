import { chromium } from 'playwright';
import { DEFAULTS } from './config.js';

const STATE = {
  browser: null,
  pool: [],
  active: new Set(),
  waiting: [],
  minSize: 0,
  maxSize: 5,
  idleTimeout: DEFAULTS.BROWSER_IDLE_TIMEOUT_MS,
  acquireTimeout: DEFAULTS.BROWSER_ACQUIRE_TIMEOUT_MS,
  evictionInterval: null,
  initialized: false,
};

export async function initBrowserPool(config) {
  STATE.minSize = config.browserPoolMin;
  STATE.maxSize = config.browserPoolMax;
  STATE.idleTimeout = config.browserIdleTimeout || DEFAULTS.BROWSER_IDLE_TIMEOUT_MS;
  STATE.acquireTimeout = config.browserAcquireTimeout || DEFAULTS.BROWSER_ACQUIRE_TIMEOUT_MS;

  if (!STATE.browser) {
    STATE.browser = await chromium.launch({
      args: DEFAULTS.CHROMIUM_ARGS,
    });
  }

  STATE.evictionInterval = setInterval(evictIdle, DEFAULTS.BROWSER_EVICTION_INTERVAL_MS);
  STATE.initialized = true;
  return STATE;
}

export async function destroyBrowserPool() {
  if (STATE.evictionInterval) {
    clearInterval(STATE.evictionInterval);
    STATE.evictionInterval = null;
  }

  for (const ctx of [...STATE.active]) {
    try { await ctx.close(); } catch {}
  }
  STATE.active.clear();

  for (const item of STATE.pool) {
    try { await item.context.close(); } catch {}
  }
  STATE.pool.length = 0;

  for (const { reject } of STATE.waiting) {
    reject(new Error('Browser pool destroyed'));
  }
  STATE.waiting.length = 0;

  if (STATE.browser) {
    await STATE.browser.close();
    STATE.browser = null;
  }
  STATE.initialized = false;
}

export async function acquireContext(contextOptions = {}) {
  if (!STATE.initialized) throw new Error('Browser pool not initialized');

  const startTime = Date.now();

  while (true) {
    if (STATE.pool.length > 0) {
      const item = STATE.pool.pop();
      STATE.active.add(item.context);
      return wrapContext(item.context);
    }

    if (STATE.active.size + STATE.pool.length < STATE.maxSize) {
      const ctx = await STATE.browser.newContext({
        ...DEFAULTS.CONTEXT_OPTIONS,
        ...contextOptions,
      });
      STATE.active.add(ctx);
      return wrapContext(ctx);
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= STATE.acquireTimeout) {
      throw new Error('Browser pool acquire timeout');
    }

    await new Promise(resolve => setTimeout(resolve, Math.min(100, STATE.acquireTimeout - elapsed)));
  }
}

function wrapContext(context) {
  return {
    context,
    async newPage() {
      return context.newPage();
    },
    async close() {
      STATE.active.delete(context);
      try {
        await context.close();
      } catch {}
      drainWaiting();
    },
    async release() {
      STATE.active.delete(context);
      STATE.pool.push({ context, lastUsed: Date.now() });
      drainWaiting();
    },
  };
}

function drainWaiting() {
  while (STATE.waiting.length > 0 && STATE.pool.length > 0) {
    const { resolve } = STATE.waiting.shift();
    const item = STATE.pool.pop();
    STATE.active.add(item.context);
    resolve(wrapContext(item.context));
  }
}

async function evictIdle() {
  const now = Date.now();
  const toEvict = [];
  STATE.pool = STATE.pool.filter(item => {
    if (now - item.lastUsed > STATE.idleTimeout && STATE.pool.length - toEvict.length > STATE.minSize) {
      toEvict.push(item.context);
      return false;
    }
    return true;
  });
  for (const ctx of toEvict) {
    try { await ctx.close(); } catch {}
  }
}

export function getPoolStats() {
  return {
    available: STATE.pool.length,
    active: STATE.active.size,
    waiting: STATE.waiting.length,
    maxSize: STATE.maxSize,
  };
}