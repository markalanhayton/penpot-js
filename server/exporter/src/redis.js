import { logger } from './util.js';

let subscriber = null;
let publisher = null;
let connection = null;

export async function initRedis(uri) {
  if (!uri) return;
  try {
    const { createClient } = await import('redis');
    connection = createClient({ url: uri });
    connection.on('error', (err) => logger.error('Redis connection error', { error: err.message }));
    await connection.connect();
    publisher = connection.duplicate();
    await publisher.connect();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn('Redis connection failed, progress notifications disabled', { error: err.message });
    publisher = null;
    connection = null;
  }
}

export async function destroyRedis() {
  if (publisher) {
    try { await publisher.quit(); } catch {}
    publisher = null;
  }
  if (connection) {
    try { await connection.quit(); } catch {}
    connection = null;
  }
}

export async function publish(topic, message) {
  if (!publisher) {
    logger.debug('Redis publish skipped (not connected)', { topic });
    return;
  }
  try {
    await publisher.publish(topic, JSON.stringify(message));
  } catch (err) {
    logger.error('Redis publish failed', { topic, error: err.message });
  }
}

export async function subscribe(topic, callback) {
  if (!connection) return;
  if (!subscriber) {
    subscriber = connection.duplicate();
    await subscriber.connect();
  }
  await subscriber.subscribe(topic, (message) => {
    try {
      callback(JSON.parse(message));
    } catch (err) {
      logger.error('Redis subscriber callback error', { error: err.message });
    }
  });
}