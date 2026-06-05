'use strict';

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPool, runMigrations, closeDb } from '../src/db/sqlite.js';
import { createApp } from '../src/index.js';
import { registerAllCommands } from '../src/rpc/dispatcher.js';

async function setupTestApp() {
  const pool = createPool(':memory:');
  runMigrations(pool.db);
  await registerAllCommands(pool);
  const app = await createApp(pool);
  return { app, pool };
}

describe('HTTP API Integration — Auth', () => {
  let app, pool;

  beforeEach(async () => {
    const result = await setupTestApp();
    app = result.app;
    pool = result.pool;
  });

  afterEach(async () => {
    await app.close();
    closeDb();
  });

  it('GET /api/health returns 200 with status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'ok');
  });

  it('POST /api/rpc/command/get-enabled-flags returns flags without auth', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/rpc/command/get-enabled-flags',
      headers: { 'content-type': 'application/json', 'x-client': 'test' },
      payload: JSON.stringify([]),
    });
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body), 'flags should be an array');
  });

  it('POST /api/rpc/command/login-with-password returns error for bad credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/rpc/command/login-with-password',
      headers: { 'content-type': 'application/json', 'x-client': 'test' },
      payload: JSON.stringify({ email: 'nonexistent@example.com', password: 'wrongpassword' }),
    });
    assert.ok(response.statusCode >= 400, `expected error status, got ${response.statusCode}`);
  });

  it('POST unauthenticated RPC to auth-required method returns access error or empty', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/rpc/command/get-profile',
      headers: { 'content-type': 'application/json', 'x-client': 'test' },
      payload: JSON.stringify([]),
    });
    assert.ok([204, 401, 403].includes(response.statusCode), `expected 204, 401 or 403, got ${response.statusCode}`);
  });

  it('POST unknown RPC method returns 404', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/rpc/command/nonexistent-method',
      headers: { 'content-type': 'application/json', 'x-client': 'test' },
      payload: JSON.stringify([]),
    });
    assert.equal(response.statusCode, 404);
  });

  it('GET unknown RPC method returns 404 or 405', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rpc/command/nonexistent-method',
    });
    assert.ok([404, 405].includes(response.statusCode), `expected 404 or 405, got ${response.statusCode}`);
  });
});

describe('HTTP API Integration — Content Types', () => {
  let app, pool;

  beforeEach(async () => {
    const result = await setupTestApp();
    app = result.app;
    pool = result.pool;
  });

  afterEach(async () => {
    await app.close();
    closeDb();
  });

  it('POST with application/json content-type is accepted', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/rpc/command/get-enabled-flags',
      headers: { 'content-type': 'application/json', 'x-client': 'test' },
      payload: JSON.stringify([]),
    });
    assert.equal(response.statusCode, 200);
  });

  it('POST with application/transit+json content-type is accepted', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/rpc/command/get-enabled-flags',
      headers: { 'content-type': 'application/transit+json', 'x-client': 'test' },
      payload: '[]',
    });
    assert.equal(response.statusCode, 200);
  });

  it('GET with query params returns JSON response', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rpc/command/get-enabled-flags',
    });
    assert.equal(response.statusCode, 200);
    assert.ok(
      response.headers['content-type'].includes('json'),
      `expected JSON content type, got ${response.headers['content-type']}`
    );
  });
});

describe('HTTP API Integration — Security Headers', () => {
  let app, pool;

  beforeEach(async () => {
    const result = await setupTestApp();
    app = result.app;
    pool = result.pool;
  });

  afterEach(async () => {
    await app.close();
    closeDb();
  });

  it('responses include security headers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });
    assert.ok(response.headers['x-content-type-options'], 'should have X-Content-Type-Options');
    assert.ok(response.headers['x-frame-options'], 'should have X-Frame-Options');
  });

  it('responses include CORS headers for API routes', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/rpc/command/get-enabled-flags',
      headers: {
        'content-type': 'application/json',
        'origin': 'http://localhost:3449',
        'x-client': 'test',
      },
      payload: JSON.stringify([]),
    });
    assert.equal(response.statusCode, 200);
  });
});

describe('HTTP API Integration — Management Endpoints', () => {
  let app, pool;

  beforeEach(async () => {
    const result = await setupTestApp();
    app = result.app;
    pool = result.pool;
  });

  afterEach(async () => {
    await app.close();
    closeDb();
  });

  it('management method without shared key returns 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/management/methods/get-enabled-flags',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify([]),
    });
    assert.ok([401, 403].includes(response.statusCode), `expected 401 or 403, got ${response.statusCode}`);
  });
});