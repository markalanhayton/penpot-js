'use strict';
/**
 * @module metrics
 * @description Prometheus metrics endpoint — mirrors `app.metrics` from the Clojure backend.
 *
 * Exposes a `/metrics` endpoint in Prometheus text exposition format with counters,
 * gauges, histograms, and summaries for RPC timing, WebSocket connections,
 * task execution, session management, and HTTP dispatch.
 *
 * ### Metrics exposed
 *
 * | Name                                          | Type       | Labels     |
 * |-----------------------------------------------|------------|------------|
 * | `penpot_rpc_update_file_changes_total`        | Counter    | —          |
 * | `penpot_rpc_update_file_bytes_processed_total`| Counter    | —          |
 * | `penpot_rpc_main_timing`                     | Histogram  | `name`     |
 * | `penpot_rpc_management_timing`               | Histogram  | `name`     |
 * | `penpot_websocket_active_connections`         | Gauge      | —          |
 * | `penpot_websocket_message_total`              | Counter    | `op`       |
 * | `penpot_websocket_session_timing`            | Summary    | —          |
 * | `penpot_http_session_update_total`            | Counter    | —          |
 * | `penpot_tasks_timing`                        | Histogram  | `name`     |
 * | `penpot_rpc_climit_queue`                    | Gauge      | `name`     |
 * | `penpot_rpc_climit_permits`                  | Gauge      | `name`     |
 * | `penpot_rpc_climit_timing`                   | Histogram  | `name`     |
 * | `penpot_http_server_dispatch_timing`         | Histogram  | —          |
 *
 * ### Usage
 *
 * ```js
 * import { register, rpcTiming, wsConnections } from './metrics/index.js';
 *
 * // Observe RPC timing
 * const end = rpcTiming.labels('get-file').startTimer();
 * // ... handle request ...
 * end();
 *
 * // Increment WebSocket connections
 * wsConnections.inc();
 * ```
 *
 * @example
 * // Register the metrics endpoint on Fastify:
 * import { registerMetricsEndpoint } from './metrics/index.js';
 * registerMetricsEndpoint(app);
 */

import client from 'prom-client';

/** @type {import('prom-client').Registry} */
export const register = new client.Registry();

// Default Node.js metrics (memory, CPU, etc.)
client.collectDefaultMetrics({ register });

// --- Histogram buckets (matching Clojure backend) ---
const HISTOGRAM_BUCKETS = [1, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500];

// --- Summary quantiles ---
const SUMMARY_QUANTILES = [0.5, 0.9, 0.99];
const SUMMARY_MAX_AGE = 3600;
const SUMMARY_AGE_BUCKETS = 12;

/**
 * Counter: Total number of file changes submitted via `update-file`.
 * Mirrors `penpot_rpc_update_file_changes_total`.
 */
export const updateFileChanges = new client.Counter({
  name: 'penpot_rpc_update_file_changes_total',
  help: 'A total number of changes submitted to update-file',
  registers: [register],
});

/**
 * Counter: Total bytes processed by `update-file`.
 * Mirrors `penpot_rpc_update_file_bytes_processed_total`.
 */
export const updateFileBytesProcessed = new client.Counter({
  name: 'penpot_rpc_update_file_bytes_processed_total',
  help: 'A total number of bytes processed by update-file',
  registers: [register],
});

/**
 * Histogram: RPC command timing for the `/api/rpc/command/` and `/api/main/methods/` endpoints.
 * Mirrors `penpot_rpc_main_timing`.
 */
export const rpcMainTiming = new client.Histogram({
  name: 'penpot_rpc_main_timing',
  help: 'RPC command method call timing for main',
  labelNames: ['name'],
  buckets: HISTOGRAM_BUCKETS,
  registers: [register],
});

/**
 * Histogram: RPC command timing for management API endpoints.
 * Mirrors `penpot_rpc_management_timing`.
 */
export const rpcManagementTiming = new client.Histogram({
  name: 'penpot_rpc_management_timing',
  help: 'RPC command method call timing for management',
  labelNames: ['name'],
  buckets: HISTOGRAM_BUCKETS,
  registers: [register],
});

/**
 * Gauge: Currently active WebSocket connections.
 * Mirrors `penpot_websocket_active_connections`.
 */
export const wsConnections = new client.Gauge({
  name: 'penpot_websocket_active_connections',
  help: 'Active websocket connections gauge',
  registers: [register],
});

/**
 * Counter: WebSocket messages processed, by operation type.
 * Mirrors `penpot_websocket_message_total`.
 */
export const wsMessages = new client.Counter({
  name: 'penpot_websocket_message_total',
  help: 'Counter of processed messages',
  labelNames: ['op'],
  registers: [register],
});

/**
 * Summary: WebSocket session duration in seconds.
 * Mirrors `penpot_websocket_session_timing`.
 */
export const wsSessionTiming = new client.Summary({
  name: 'penpot_websocket_session_timing',
  help: 'Websocket session timing (seconds)',
  percentiles: SUMMARY_QUANTILES,
  maxAgeSeconds: SUMMARY_MAX_AGE,
  ageBuckets: SUMMARY_AGE_BUCKETS,
  registers: [register],
});

/**
 * Counter: Session update batch events.
 * Mirrors `penpot_http_session_update_total`.
 */
export const sessionUpdateTotal = new client.Counter({
  name: 'penpot_http_session_update_total',
  help: 'A counter of session update batch events',
  registers: [register],
});

/**
 * Histogram: Background task execution timing in milliseconds.
 * Mirrors `penpot_tasks_timing`.
 */
export const tasksTiming = new client.Histogram({
  name: 'penpot_tasks_timing',
  help: 'Background tasks timing (milliseconds)',
  labelNames: ['name'],
  buckets: HISTOGRAM_BUCKETS,
  registers: [register],
});

/**
 * Gauge: Current number of queued RPC submissions (concurrency limiter).
 * Mirrors `penpot_rpc_climit_queue`.
 */
export const rpcClimitQueue = new client.Gauge({
  name: 'penpot_rpc_climit_queue',
  help: 'Current number of queued submissions',
  labelNames: ['name'],
  registers: [register],
});

/**
 * Gauge: Current number of available permits (concurrency limiter).
 * Mirrors `penpot_rpc_climit_permits`.
 */
export const rpcClimitPermits = new client.Gauge({
  name: 'penpot_rpc_climit_permits',
  help: 'Current number of available permits',
  labelNames: ['name'],
  registers: [register],
});

/**
 * Histogram: Time between queuing and executing on the concurrency limiter.
 * Mirrors `penpot_rpc_climit_timing`.
 */
export const rpcClimitTiming = new client.Histogram({
  name: 'penpot_rpc_climit_timing',
  help: 'Time between queuing and executing on the CLIMIT',
  labelNames: ['name'],
  buckets: HISTOGRAM_BUCKETS,
  registers: [register],
});

/**
 * Histogram: HTTP server request dispatch duration.
 * Mirrors `penpot_http_server_dispatch_timing`.
 */
export const httpDispatchTiming = new client.Histogram({
  name: 'penpot_http_server_dispatch_timing',
  help: 'Histogram of dispatch handler timing',
  buckets: HISTOGRAM_BUCKETS,
  registers: [register],
});

/**
 * Register the Prometheus `/metrics` endpoint on a Fastify server.
 * Responds with all registered metrics in Prometheus text format.
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance.
 */
export function registerMetricsEndpoint(fastify) {
  fastify.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', register.contentType);
    return reply.send(await register.metrics());
  });
}

/**
 * Create a timer for RPC method execution.
 * Returns a function that, when called, records the elapsed time in milliseconds.
 *
 * @param {string} methodName - The RPC method name.
 * @param {'main'|'management'} [route='main'] - Which timing histogram to use.
 * @returns {() => void} Call to stop the timer and record the observation.
 */
export function startRpcTimer(methodName, route = 'main') {
  const histogram = route === 'management' ? rpcManagementTiming : rpcMainTiming;
  return histogram.labels(methodName).startTimer();
}

/**
 * Create a timer for background task execution.
 *
 * @param {string} taskName - The task type name.
 * @returns {() => void} Call to stop the timer and record the observation.
 */
export function startTaskTimer(taskName) {
  return tasksTiming.labels(taskName).startTimer();
}