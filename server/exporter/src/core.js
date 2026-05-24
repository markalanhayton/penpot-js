import http from 'node:http';
import { loadConfig, DEFAULTS } from './config.js';
import { initBrowserPool, destroyBrowserPool, getPoolStats } from './browser.js';
import { initRedis, destroyRedis, publish as redisPublish } from './redis.js';
import { handleRequest } from './handlers.js';
import { logger } from './util.js';

let server = null;

export async function start(userConfig = {}) {
  const config = { ...loadConfig(), ...userConfig };

  logger.info('Starting Penpot exporter', {
    host: config.exporterHost,
    port: config.exporterPort,
    publicUri: config.publicUri,
    poolMax: config.browserPoolMax,
  });

  await initBrowserPool(config);

  if (config.redisUri) {
    await initRedis(config.redisUri);
    logger.info('Redis connected', { uri: config.redisUri.replace(/\/\/.*@/, '//***@') });
  } else {
    logger.info('Redis not configured, progress notifications disabled');
  }

  server = http.createServer(async (req, res) => {
    const start = Date.now();
    try {
      const result = await handleRequest(req, config);
      res.writeHead(result.status || 200, {
        'Content-Type': result.contentType || 'application/json',
        ...(result.headers || {}),
      });
      if (result.body) {
        res.end(typeof result.body === 'string' ? result.body : JSON.stringify(result.body));
      } else {
        res.end();
      }
    } catch (err) {
      logger.error('Request handler error', { error: err.message, url: req.url });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    const duration = Date.now() - start;
    logger.debug('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
    });
  });

  server.timeout = config.renderTimeout;

  return new Promise((resolve, reject) => {
    server.listen(config.exporterPort, config.exporterHost, () => {
      logger.info(`Exporter listening on ${config.exporterHost}:${config.exporterPort}`);
      resolve({ server, config });
    });
    server.on('error', reject);
  });
}

export async function stop() {
  logger.info('Shutting down exporter');
  if (server) {
    await new Promise(resolve => server.close(resolve));
    server = null;
  }
  await destroyBrowserPool();
  await destroyRedis();
  logger.info('Exporter shut down complete');
}

export { getPoolStats };

export function publishProgress(tenant, profileId, payload) {
  const topic = tenant ? `${tenant}.${profileId}` : profileId;
  redisPublish(topic, payload);
}