import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { postWebhook } from '../src/http/client.js';

describe('postWebhook SSRF protection', () => {
  it('blocks loopback addresses', async () => {
    const result = await postWebhook('http://127.0.0.1/webhook', '{}');
    assert.equal(result.status, null);
    assert.ok(result.error.includes('blocked'));
  });

  it('blocks localhost', async () => {
    const result = await postWebhook('http://localhost/webhook', '{}');
    assert.equal(result.status, null);
    assert.ok(result.error.includes('blocked'));
  });

  it('blocks link-local metadata endpoint', async () => {
    const result = await postWebhook('http://169.254.169.254/latest/', '{}');
    assert.equal(result.status, null);
    assert.ok(result.error.includes('blocked'));
  });

  it('blocks private network', async () => {
    const result = await postWebhook('http://10.0.0.1/', '{}');
    assert.equal(result.status, null);
    assert.ok(result.error.includes('blocked'));
  });

  it('accepts external URLs (even if connection fails)', async () => {
    const result = await postWebhook('https://nonexistent.example.invalid/webhook', '{}', { timeout: 500 });
    assert.ok(result.error);
    assert.ok(!result.error.includes('blocked'));
  });
});