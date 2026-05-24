/**
 * @module ws/msgbus
 * @description Message bus for real-time notifications — mirrors `app.msgbus`
 * from the Clojure backend.
 *
 * Provides a topic-based publish/subscribe system for in-process communication.
 * Since backend-js uses SQLite (a single-file database), it is inherently
 * single-instance, so Redis is unnecessary — all messaging is local.
 *
 * ### Architecture
 *
 * ```
 * Single instance:
 *   Publisher → in-process → Subscribers
 * ```
 *
 * ### Usage
 *
 * ```js
 * import { createMsgBus } from './ws/msgbus.js';
 *
 * const bus = createMsgBus();
 *
 * // Subscribe to a topic
 * const unsub = bus.subscribe('file-update', (message) => {
 *   console.log('File updated:', message.fileId);
 * });
 *
 * // Publish a message
 * bus.publish('file-update', { fileId: 'abc-123', data: '...' });
 *
 * // Unsubscribe
 * unsub();
 * ```
 */

/**
 * Create a message bus instance.
 *
 * @returns {{ publish: function(string, object): void, subscribe: function(string, function): function, unsubscribe: function(string, function): void, close: function(): void }}
 */
export function createMsgBus() {
  /** @type {Map<string, Set<function>>} Local topic subscriptions */
  const localSubs = new Map();

  /**
   * Get or create a local subscriber set for a topic.
   *
   * @param {string} topic - The topic name.
   * @returns {Set<function>} Set of subscriber callbacks.
   */
  function getSubscribers(topic) {
    if (!localSubs.has(topic)) {
      localSubs.set(topic, new Set());
    }
    return localSubs.get(topic);
  }

  /**
   * Publish a message to all subscribers of a topic.
   *
   * @param {string} topic - Topic name (e.g. 'file-update', 'team-notification').
   * @param {object} message - Message payload (must be JSON-serializable).
   */
  function publish(topic, message) {
    const subscribers = localSubs.get(topic);
    if (subscribers && subscribers.size > 0) {
      for (const callback of subscribers) {
        try {
          callback(message);
        } catch (err) {
          console.error(`[msgbus] Error in subscriber for topic '${topic}':`, err);
        }
      }
    }
  }

  /**
   * Subscribe to a topic.
   *
   * @param {string} topic - Topic name.
   * @param {function(object): void} callback - Called when a message is published.
   * @returns {function} Unsubscribe function.
   */
  function subscribe(topic, callback) {
    const subscribers = getSubscribers(topic);
    subscribers.add(callback);

    return function unsubscribe() {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        localSubs.delete(topic);
      }
    };
  }

  /**
   * Unsubscribe a specific callback from a topic.
   *
   * @param {string} topic - Topic name.
   * @param {function} callback - The callback to remove.
   */
  function unsubscribe(topic, callback) {
    const subscribers = localSubs.get(topic);
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        localSubs.delete(topic);
      }
    }
  }

  /**
   * Close the message bus. Clears all subscriptions.
   */
  function close() {
    localSubs.clear();
  }

  return { publish, subscribe, unsubscribe, close };
}

/** Singleton message bus instance for the application. */
export const msgBus = createMsgBus();