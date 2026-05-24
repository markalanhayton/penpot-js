import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('SSE module exports', async () => {
  const mod = await import('../src/http/sse.js');

  it('exports registerSSEEndpoint', () => {
    assert.equal(typeof mod.registerSSEEndpoint, 'function');
  });

  it('exports broadcastSSE', () => {
    assert.equal(typeof mod.broadcastSSE, 'function');
  });

  it('exports getSSEClientCount', () => {
    assert.equal(typeof mod.getSSEClientCount, 'function');
  });

  it('getSSEClientCount returns 0 with no clients', () => {
    assert.equal(mod.getSSEClientCount(), 0);
  });
});