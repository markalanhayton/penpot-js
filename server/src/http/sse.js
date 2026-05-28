'use strict';
/**
 * @module http/sse
 * @description Server-Sent Events endpoint — mirrors `app.http.sse` from the Clojure backend.
 *
 * Provides an SSE endpoint at `/api/sse` that streams real-time events to clients.
 * This is an alternative to WebSocket for clients that prefer a unidirectional
 * event stream (e.g. notifications, audit logs, live updates).
 *
 * ### Protocol
 *
 * Events are sent in the standard SSE format:
 * ```
 * event:<name>
 * data:<json-encoded-data>
 *
 * ```
 *
 * ### Authentication
 *
 * Requires a valid session token via `?token=` query parameter or `auth-token` cookie.
 * Unauthenticated connections are rejected with HTTP 401.
 *
 * ### Supported event sources
 *
 * | Topic prefix       | Description                              |
 * |--------------------|------------------------------------------|
 * | `team:<id>`        | Team-level notifications                 |
 * | `file:<id>`        | File-level updates (also via WebSocket)  |
 * | `profile:<id>`     | Profile-level notifications              |
 * | `global`           | System-wide broadcast events             |
 */

import { verifyToken } from '../auth/tokens.js';
import { config } from '../config/index.js';

/**
 * SSE response headers.
 * @type {Record<string, string>}
 */
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream;charset=UTF-8',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/**
 * @typedef {object} SSEClient
 * @property {import('http').ServerResponse} res - The HTTP response object.
 * @property {string} profileId - Authenticated profile UUID.
 * @property {Set<string>} subscriptions - Topic subscriptions.
 */

/** @type {Map<string, Set<SSEClient>>} topic → set of subscribed clients */
const sseChannels = new Map();

/** @type {Set<SSEClient>} All connected SSE clients */
const sseClients = new Set();

/**
 * Register the SSE endpoint on the Fastify server.
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance.
 */
export function registerSSEEndpoint(fastify) {
  fastify.get('/api/sse', async (request, reply) => {
    // Authenticate
    const token = request.query.token
      || request.cookies?.[config.auth.cookieName]
      || (request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : null);

    let profileId = null;
    if (token) {
      const { valid, claims } = await verifyToken(token);
      if (valid && claims?.uid) {
        profileId = claims.uid;
      }
    }

    if (!profileId) {
      return reply.code(401).send({ type: 'authentication', code: 'authentication-required', hint: 'Authentication required for SSE' });
    }

    // Force headers for SSE
    reply.raw.writeHead(200, SSE_HEADERS);
    reply.raw.flushHeaders();

    const client = {
      res: reply.raw,
      profileId,
      subscriptions: new Set(),
    };

    sseClients.add(client);
    subscribeSSE(client, `profile:${profileId}`);

    // Send initial connection event
    sendSSEEvent(client.res, 'connected', { profileId });

    // Handle query params for initial subscriptions
    const topics = request.query.topics;
    if (topics && typeof topics === 'string') {
      for (const topic of topics.split(',')) {
        subscribeSSE(client, topic);
      }
    }

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(':heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);

    // Clean up on disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(client);
      for (const topic of client.subscriptions) {
        const set = sseChannels.get(topic);
        if (set) {
          set.delete(client);
          if (set.size === 0) sseChannels.delete(topic);
        }
      }
    });

    // Don't close the response — Fastify must not end it
    return reply;
  });
}

/**
 * Subscribe an SSE client to a topic.
 *
 * @param {SSEClient} client - The SSE client.
 * @param {string} topic - Topic identifier.
 */
function subscribeSSE(client, topic) {
  if (!sseChannels.has(topic)) {
    sseChannels.set(topic, new Set());
  }
  sseChannels.get(topic).add(client);
  client.subscriptions.add(topic);
}

/**
 * Send an SSE event to a single client response stream.
 *
 * @param {import('http').ServerResponse} res - The raw HTTP response.
 * @param {string} event - Event name.
 * @param {Record<string, *>} data - Event data (will be JSON-encoded).
 */
function sendSSEEvent(res, event, data) {
  try {
    res.write(`event:${event}\ndata:${JSON.stringify(data)}\n\n`);
  } catch {
    // Client disconnected
  }
}

/**
 * Broadcast an SSE event to all subscribers of a topic.
 * This can be called from RPC handlers or background tasks to push
 * real-time updates to SSE clients.
 *
 * @param {string} topic - Topic to broadcast to (e.g. 'file:abc-123').
 * @param {string} event - Event name (e.g. 'file-update', 'notification').
 * @param {Record<string, *>} data - Event payload.
 */
export function broadcastSSE(topic, event, data) {
  const set = sseChannels.get(topic);
  if (!set) return;

  for (const client of set) {
    sendSSEEvent(client.res, event, data);
  }
}

/**
 * Get the number of currently connected SSE clients.
 * @returns {number}
 */
export function getSSEClientCount() {
  return sseClients.size;
}