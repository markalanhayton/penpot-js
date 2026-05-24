/**
 * @module ws/notifications
 * @description WebSocket real-time notification handler — mirrors
 * `app.http.websocket` from the Clojure backend.
 *
 * Endpoint: `/ws/notifications`
 *
 * ### Protocol
 *
 * All messages are JSON with a `type` field for dispatch:
 *
 * | Client → Server type     | Description                        |
 * |--------------------------|------------------------------------|
 * | `subscribe-team`         | Subscribe to team-level updates     |
 * | `subscribe-file`         | Subscribe to file-level updates     |
 * | `unsubscribe-file`       | Unsubscribe from file updates       |
 * | `broadcast`              | Broadcast a message to a topic     |
 * | `pointer-update`         | Share cursor position in a file    |
 * | `keepalive`              | Prevent connection timeout         |
 *
 * ### Authentication
 *
 * Connections must authenticate via one of:
 * 1. `?token=` query parameter (JWE session token)
 * 2. `?session-id=` + `?profile-id=` query parameters (internal use)
 * 3. `auth-token` cookie from the HTTP upgrade request
 * 4. `Authorization: Bearer <token>` header
 *
 * Unauthenticated connections are closed with code `4001`.
 *
 * ### Architecture
 *
 * Since backend-js uses SQLite (single-instance), all pub/sub is handled
 * in-process via the EventBus. No Redis is needed.
 */

import { WebSocket } from 'ws';
import { verifyToken } from '../auth/tokens.js';
import { config } from '../config/index.js';
import { wsConnections, wsMessages, wsSessionTiming } from '../metrics/index.js';
import { msgBus } from './msgbus.js';

/** @type {Map<string, Set<WSConnection>>} topic → set of subscribed connections */
const channels = new Map();

/**
 * Broadcast a message to all subscribers of a topic.
 * This is the primary export used by RPC handlers to push real-time updates.
 * Messages are delivered both to local WebSocket subscribers and to the EventBus
 * for any other in-process subscribers (SSE, etc.).
 *
 * @param {string} topic - Topic identifier (file ID, team ID, or profile ID).
 * @param {Record<string, *>} message - Message payload to broadcast.
 */
export function broadcast(topic, message) {
  broadcastToTopic(topic, message);
  msgBus.publish(topic, message);
}

/**
 * Register the WebSocket handler on the Fastify server.
 *
 * Installs a `/ws/notifications` route that upgrades HTTP connections to
 * WebSocket, authenticates the client, and begins processing messages.
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance.
 * @returns {Promise<void>}
 */
export function setupWebSocket(fastify) {
  fastify.register(async function (scope) {
    await scope.register(import('@fastify/websocket'));

    scope.get('/ws/notifications', { websocket: true }, async (socket, request) => {
     try {
    const sessionId = request.query?.['session-id'] || null;

    // Auth — verify session via token from query param or cookie
    let authenticatedProfileId = null;
    const token = request.query?.['token']
      || request.cookies?.[config.auth.cookieName]
      || (request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : null);

    if (token) {
      const { valid, claims } = await verifyToken(token);
      if (valid && claims?.uid) {
        authenticatedProfileId = claims.uid;
      }
    }

    if (!authenticatedProfileId) {
      socket.close(4001, 'Authentication required');
      return;
    }

    /** @type {WSConnection} */
    const connection = {
      ws: socket,
      profileId: authenticatedProfileId,
      sessionId: sessionId || crypto.randomUUID(),
      subscriptions: new Set(),
      connectedAt: Date.now(),
    };

    // Subscribe to own profile topic
    subscribe(connection, authenticatedProfileId);

    // Track connection in metrics
    wsConnections.inc();

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        wsMessages.labels('recv').inc();
        handleMessage(connection, msg);
      } catch (err) {
        console.error('[ws] Invalid message:', err.message);
      }
    });

    socket.on('close', () => {
      // Track disconnection in metrics and session duration
      wsConnections.dec();
      wsSessionTiming.observe((Date.now() - connection.connectedAt) / 1000);
      // Send disconnect/presence notification to all subscribed topics
      for (const topic of connection.subscriptions) {
        publish(connection.profileId, topic, {
          type: 'presence',
          'profile-id': connection.profileId,
          'session-id': connection.sessionId,
          status: 'disconnect',
        });
      }
      // Unsubscribe from all topics
      for (const topic of connection.subscriptions) {
        unsubscribe(connection, topic);
      }
    });

    socket.on('error', (err) => {
      console.error('[ws] Error:', err.message);
    });
    } catch (err) {
      console.error('[ws] WebSocket handler error:', err.message, err.stack?.split('\n')[0]);
      try { if (typeof socket?.close === 'function') socket.close(1011, 'Internal server error'); } catch {}
    }
   });
  });
}

/**
 * Subscribe a connection to a topic.
 *
 * @param {WSConnection} connection - The WebSocket connection.
 * @param {string} topic - Topic identifier (profile ID, team ID, or file ID).
 */
function subscribe(connection, topic) {
  if (!channels.has(topic)) {
    channels.set(topic, new Set());
  }
  channels.get(topic).add(connection);
  connection.subscriptions.add(topic);
}

/**
 * Unsubscribe a connection from a topic and clean up empty topic sets.
 *
 * @param {WSConnection} connection - The WebSocket connection.
 * @param {string} topic - Topic identifier.
 */
function unsubscribe(connection, topic) {
  const set = channels.get(topic);
  if (set) {
    set.delete(connection);
    if (set.size === 0) {
      channels.delete(topic);
    }
  }
  connection.subscriptions.delete(topic);
}

/**
 * Dispatch an incoming WebSocket message based on its `type` field.
 *
 * @param {WSConnection} connection - The sending connection.
 * @param {Record<string, *>} msg - Parsed JSON message with a `type` field.
 */
function handleMessage(connection, msg) {
  const { type } = msg;

  switch (type) {
    case 'subscribe-team':
      subscribe(connection, msg['team-id']);
      break;

    case 'subscribe-file':
      subscribe(connection, msg['file-id']);
      publish(connection.profileId, msg['file-id'], {
        type: 'join-file',
        'file-id': msg['file-id'],
        'profile-id': connection.profileId,
        'session-id': connection.sessionId,
      });
      break;

    case 'unsubscribe-file':
      publish(connection.profileId, msg['file-id'], {
        type: 'leave-file',
        'file-id': msg['file-id'],
        'profile-id': connection.profileId,
        'session-id': connection.sessionId,
      });
      unsubscribe(connection, msg['file-id']);
      break;

    case 'broadcast':
      broadcastToTopic(msg.topic || connection.profileId, {
        ...msg,
        'profile-id': connection.profileId,
        'session-id': connection.sessionId,
      });
      break;

    case 'pointer-update':
      broadcastToTopic(msg['file-id'], {
        type: 'pointer-update',
        'file-id': msg['file-id'],
        'profile-id': connection.profileId,
        'session-id': connection.sessionId,
        x: msg.x,
        y: msg.y,
        page: msg.page,
      });
      break;

    case 'selection-update':
      broadcastToTopic(msg['file-id'], {
        type: 'selection-update',
        'file-id': msg['file-id'],
        'profile-id': connection.profileId,
        'session-id': connection.sessionId,
        page: msg.page,
        'selected-ids': msg['selected-ids'] || [],
      });
      break;

    case 'keepalive':
      // No-op, just prevents connection timeout
      break;

    default:
      console.warn(`[ws] Unknown message type: ${type}`);
  }
}

/**
 * Publish a message to a topic, filtering out the sender's own session.
 *
 * @param {string} senderProfileId - The sender's profile UUID.
 * @param {string} topic - Topic to publish to.
 * @param {Record<string, *>} message - Message payload to broadcast.
 */
function publish(senderProfileId, topic, message) {
  const set = channels.get(topic);
  if (!set) return;

  const payload = JSON.stringify(message);
  for (const conn of set) {
    if (!conn || !conn.ws || conn.ws.readyState === WebSocket.CLOSING) continue;
    // Filter out messages from self session
    if (conn.profileId === senderProfileId && conn.sessionId === message?.['session-id']) {
      continue;
    }
    if (conn.ws.readyState === WebSocket.OPEN) {
      wsMessages.labels('send').inc();
      conn.ws.send(payload);
    }
  }
}

/**
 * Broadcast a message to all subscribers of a topic (including the sender).
 *
 * @param {string} topic - Topic to broadcast to.
 * @param {Record<string, *>} message - Message payload to broadcast.
 */
function broadcastToTopic(topic, message) {
  const set = channels.get(topic);
  if (!set) return;

  const payload = JSON.stringify(message);
  for (const conn of set) {
    if (!conn || !conn.ws || conn.ws.readyState !== WebSocket.OPEN) continue;
    wsMessages.labels('send').inc();
    conn.ws.send(payload);
  }
}