import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.PENPOT_TEST_URL || 'http://localhost:6060';
let serverAvailable = false;

before(async () => {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    serverAvailable = r.status === 200;
  } catch {
    serverAvailable = false;
  }
});

describe('Integration: live server', { concurrency: false }, () => {
  it('responds to health check', async () => {
    if (!serverAvailable) return;
    const r = await fetch(`${BASE}/api/health`);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.version);
  });

  it('returns 403 for auth-required RPC without credentials', async () => {
    if (!serverAvailable) return;
    const r = await fetch(`${BASE}/api/rpc/command/create-team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client': 'penpot-client' },
      body: JSON.stringify({ id: '1', method: 'create-team', params: { name: 'Test' } }),
    });
    assert.equal(r.status, 403);
    const body = await r.json();
    assert.equal(body.type, 'authentication');
  });

  it('returns 404 for unknown RPC method', async () => {
    if (!serverAvailable) return;
    const r = await fetch(`${BASE}/api/rpc/command/nonexistent-method`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client': 'penpot-client' },
      body: JSON.stringify({ id: '1', method: 'nonexistent-method', params: {} }),
    });
    assert.equal(r.status, 404);
    const body = await r.json();
    assert.equal(body.type, 'not-found');
  });

  it('returns 405 for GET on mutation RPC method', async () => {
    if (!serverAvailable) return;
    const r = await fetch(`${BASE}/api/rpc/command/create-team`);
    assert.equal(r.status, 405);
  });

  it('returns enabled flags from RPC', async () => {
    if (!serverAvailable) return;
    const r = await fetch(`${BASE}/api/rpc/command/get-enabled-flags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client': 'penpot-client' },
      body: JSON.stringify({ id: '1', method: 'get-enabled-flags', params: {} }),
    });
    assert.equal(r.status, 204);
  });

  it('register-profile creates a user session', async () => {
    if (!serverAvailable) return;
    const email = `inttest${Date.now()}@example.com`;
    // prepare
    const r1 = await fetch(`${BASE}/api/rpc/command/prepare-register-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client': 'penpot-client', 'Accept': 'application/json' },
      body: JSON.stringify({ id: '1', method: 'prepare-register-profile', params: { fullname: 'Test User', email, password: 'TestPass123!' } }),
    });
    assert.equal(r1.status, 200);
    const prep = await r1.json();
    assert.ok(prep.token, 'should return registration token');

    // register
    const r2 = await fetch(`${BASE}/api/rpc/command/register-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client': 'penpot-client', 'Accept': 'application/json' },
      body: JSON.stringify({ id: '2', method: 'register-profile', params: { token: prep.token } }),
    });
    assert.ok(r2.status === 200 || r2.status === 201, `register status: ${r2.status}`);
  });
});