/**
 * @module index
 * @description Main entry point — mirrors `app.main` system startup from the Clojure backend.
 *
 * Starts the Fastify HTTP server with RPC routing, WebSocket notifications,
 * a background task scheduler, and database migration runner. All configuration
 * is read from `PENPOT_*` environment variables via the {@link module:config} module.
 *
 * ### Startup sequence
 *
 * 1. Ensure storage directory exists
 * 2. Create/open SQLite database and run migrations
 * 3. Register all RPC command modules
 * 4. Create Fastify server with CORS, cookies, form body, and multipart plugins
 * 5. Register RPC route handlers
 * 6. Register WebSocket handler at `/ws/notifications`
 * 7. Start background task scheduler
 * 8. Listen on `PENPOT_HTTP_HOST:PENPOT_HTTP_PORT`
 * 9. Register graceful shutdown handlers (SIGINT/SIGTERM)
 *
 * ### RPC routes
 *
 * | Route                                      | Methods           | Auth              |
 * |---------------------------------------------|-------------------|--------------------|
 * | `/api/rpc/command/:methodName`             | GET, POST         | Method-dependent   |
 * | `/api/main/methods/:methodName`             | GET, POST         | Method-dependent   |
 * | `/api/management/methods/:methodName`        | GET, POST         | Shared key          |
 * | `/api/health`                              | GET               | None               |
 * | `/api/metrics`                             | GET               | None               |
 * | `/ws/notifications`                         | WebSocket upgrade | Session token      |
 */

import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import { createPool, runMigrations, closeDb } from './db/sqlite.js';
import { createRpcHandler, createManagementHandler, registerAllCommands, RpcError } from './rpc/dispatcher.js';
import { config, flagEnabled } from './config/index.js';
import { setupWebSocket } from './ws/notifications.js';
import { startTaskScheduler, stopTaskScheduler } from './tasks/scheduler.js';
import { startWorker, stopWorker } from './tasks/worker.js';
import { registerAuthHooks } from './middleware/auth.js';
import { errorHandler, requestContextMiddleware } from './middleware/errors.js';
import { registerSecurityHeaders, registerCorsHeaders } from './middleware/security.js';
import { ensureStorageDir } from './storage/fs.js';
import { registerSSEEndpoint } from './http/sse.js';
import { runSetup } from './setup/index.js';
import { registerMetricsEndpoint, rpcMainTiming, httpDispatchTiming } from './metrics/index.js';

/**
 * Simple console logger with `[penpot]` prefix.
 *
 * @type {{ info: function(string): void, error: function(string): void, warn: function(string): void }}
 */
const logger = {
  info: (msg) => console.log(`[penpot] ${msg}`),
  error: (msg) => console.error(`[penpot] ERROR: ${msg}`),
  warn: (msg) => console.warn(`[penpot] WARN: ${msg}`),
};

/**
 * Start the Penpot backend server.
 *
 * Creates the database pool, runs migrations, registers RPC commands,
 * sets up HTTP/WebSocket routing, and starts listening.
 *
 * @returns {Promise<import('fastify').FastifyInstance>} The Fastify server instance.
 */
export async function startServer() {
  logger.info('Starting Penpot backend (Node.js/SQLite)');
  logger.info(`Database: ${config.database.path}`);
  logger.info(`HTTP: ${config.http.host}:${config.http.port}`);
  logger.info(`Public URI: ${config.publicUri}`);

  // Warn if the default secret key is used in a non-localhost deployment
  if (config.auth.secretKey === 'penpot-dev-secret-key-change-me') {
    const host = config.host || '';
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0') {
      logger.warn('SECURITY: PENPOT_SECRET_KEY is set to the default value. Change it in production!');
    } else {
      logger.warn('PENPOT_SECRET_KEY is using the default value. Set PENPOT_SECRET_KEY for production deployments.');
    }
  }

  // Initialize storage directory
  ensureStorageDir();

  // Initialize database and run migrations
  const pool = createPool(config.database.path);
  logger.info('Running database migrations...');
  const migrationCount = runMigrations(pool.db);
  logger.info(`Migrations: ${migrationCount} applied`);

  // Run instance setup (creates instance ID, optional admin user)
  const { instanceId, adminCreated } = await runSetup(pool);
  logger.info(`Instance: ${instanceId}${adminCreated ? ' (admin created)' : ''}`);

  // Register all RPC command modules
  await registerAllCommands(pool);

  // Create Fastify server
  const app = Fastify({
    logger: false,
    bodyLimit: config.http.maxBodySize,
  });

  // Register plugins
  await app.register(cookie);
  await app.register(formbody);
  await app.register(multipart);

  // Register Transit+JSON content type parser.
  // This ensures Fastify passes the raw body string for Transit requests
  // instead of trying to JSON-parse them. The actual Transit parsing happens
  // in the RPC dispatcher (see createRpcHandler).
  app.addContentTypeParser('application/transit+json', { parseAs: 'string' }, (req, body, done) => {
    done(null, body);
  });

  // Authentication and security hooks
  registerAuthHooks(app, pool);

  // Error handler — structured error responses for all RpcError types
  app.setErrorHandler(errorHandler);

  // Request context middleware — attaches error logging context
  app.addHook('onRequest', requestContextMiddleware);

  // Security headers (CSP, HSTS, X-Content-Type-Options, etc.)
  registerSecurityHeaders(app, {
    enableCsp: true,
    enableHsts: config.publicUri?.startsWith('https'),
    cspOptions: {
      extraConnectSrc: [config.publicUri].filter(Boolean),
    },
  });

  // CORS headers for API routes
  registerCorsHeaders(app, {
    origin: config.corsOrigin || '*',
    credentials: true,
  });

  // RPC routes — mirrors app.http routing
  const rpcHandler = createRpcHandler(pool);
  const managementHandler = createManagementHandler(pool);

  // Primary API routes (same paths as Clojure backend)
  app.post('/api/rpc/command/:methodName', rpcHandler);
  app.get('/api/rpc/command/:methodName', rpcHandler);
  app.post('/api/main/methods/:methodName', rpcHandler);
  app.get('/api/main/methods/:methodName', rpcHandler);
  app.post('/api/management/methods/:methodName', managementHandler);
  app.get('/api/management/methods/:methodName', managementHandler);

  // Health check
  app.get('/api/health', async (request, reply) => {
    return { status: 'ok', version: '0.1.0' };
  });

  // Prometheus metrics endpoint — mirrors /metrics in Clojure backend
  registerMetricsEndpoint(app);

  // RPC timing middleware — records request duration for all RPC calls
  app.addHook('onResponse', async (request, reply) => {
    const methodName = request.params?.methodName;
    if (methodName && reply.statusCode < 500) {
      const elapsed = reply.elapsedTime || 0;
      rpcMainTiming.labels(methodName).observe(elapsed);
    }
  });

  // Debug endpoint — mirrors /dbg in Clojure backend
  if (flagEnabled('backend_api_doc')) {
    app.get('/api/debug', async (request, reply) => {
      const { methods: registeredMethods } = await import('./rpc/dispatcher.js');
      let methodList;
      try {
        // Access the internal methods Map from the dispatcher module
        const dispatcherModule = await import('./rpc/dispatcher.js');
        const methodEntries = [];
        for (const [name, def] of dispatcherModule.getRegisteredMethods()) {
          methodEntries.push({
            name,
            auth: def.auth,
            added: def.added,
          });
        }
        methodList = methodEntries;
      } catch {
        methodList = [];
      }
      return {
        methods: methodList,
        flags: config.flags,
        version: '0.1.0',
        database: config.database.path,
        uptime: process.uptime(),
      };
    });
  }

  // Static assets serving (mirrors /internal/assets/)
  try {
    const fastifyStatic = (await import('@fastify/static')).default;
    await app.register(fastifyStatic, {
      root: ensureStorageDir(),
      prefix: '/internal/assets/',
      decorateReply: false,
    });
  } catch {
    logger.warn('Static file serving not available (root directory not found)');
  }

  // Frontend static files — serve the built ClojureScript SPA
  const frontendDir = config.frontendDir;
  if (frontendDir) {
    try {
      const fastifyStatic = (await import('@fastify/static')).default;
      const nodePath = await import('node:path');
      const nodeFs = await import('node:fs/promises');
      const frontendRoot = nodePath.resolve(frontendDir);

      // Serve static assets under specific prefixes
      for (const prefix of ['/js', '/css', '/images', '/fonts', '/media', '/libs']) {
        const subDir = nodePath.join(frontendRoot, prefix.slice(1));
        try {
          await nodeFs.access(subDir);
          await app.register(fastifyStatic, { root: subDir, prefix, wildcard: true, decorateReply: false });
        } catch { /* dir doesn't exist, skip */ }
      }

      // Favicon
      try {
        const favicon = await nodeFs.readFile(nodePath.join(frontendRoot, 'favicon.svg'));
        app.get('/favicon.svg', async () => favicon);
      } catch { /* no favicon */ }

      // Serve index.html for the root and all SPA routes
      let indexHtml = null;
      try {
        indexHtml = await nodeFs.readFile(nodePath.join(frontendRoot, 'index.html'), 'utf8');
      } catch { /* no index.html */ }

      if (indexHtml) {
        // Config JS — inject penpotPublicURI and flags before the app loads
        const configJs = `var penpotPublicURI = "${config.publicUri}";\n`;
        app.get('/js/config.js', async () => ({ type: 'application/javascript', body: configJs }));

        // Root route
        app.get('/', async (request, reply) => {
          return reply.type('text/html').send(indexHtml);
        });

        // SPA fallback for all non-API GET routes
        app.setNotFoundHandler((request, reply, next) => {
          if (request.method === 'GET' && !request.url.startsWith('/api/') && !request.url.startsWith('/ws/')) {
            return reply.type('text/html').send(indexHtml);
          }
          next();
        });

        logger.info(`Frontend served from ${frontendRoot}`);
      }
    } catch (err) {
      logger.warn(`Frontend serving not available: ${err.message}`);
    }
  }

  // WebSocket for real-time notifications
  try {
    await setupWebSocket(app);
    logger.info('WebSocket handler registered at /ws/notifications');
  } catch (err) {
    logger.warn(`WebSocket setup failed: ${err.message}`);
  }

  // Server-Sent Events endpoint
  registerSSEEndpoint(app);
  logger.info('SSE endpoint registered at /api/sse');

  // Start background task scheduler and worker
  startTaskScheduler(pool);
  startWorker(pool);

  // Start server
  try {
    await app.listen({ port: config.http.port, host: config.http.host });
    logger.info(`Server listening on ${config.http.host}:${config.http.port}`);
    logger.info(`RPC endpoints:`);
    logger.info(`  POST /api/rpc/command/:methodName`);
    logger.info(`  POST /api/main/methods/:methodName`);
    logger.info(`  GET  /api/rpc/command/:methodName (get-* only)`);
    logger.info(`  GET  /api/main/methods/:methodName (get-* only)`);
    logger.info(`  POST /api/management/methods/:methodName`);
    logger.info(`Flags: ${Object.entries(config.flags).filter(([, v]) => v).map(([k]) => k).join(', ')}`);
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down...`);
    stopTaskScheduler();
    stopWorker();
    await app.close();
    closeDb();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return app;
}

// Auto-start if run directly
if (process.argv[1] && process.argv[1].includes('index.js')) {
  startServer();
}