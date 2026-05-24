import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { climit, rateLimit, cleanupRateLimitData } from '../src/middleware/rate-limit.js';

describe('climit', () => {
  it('allows request when under limit', async () => {
    const handler = async () => 'ok';
    const wrapped = climit('test-op', handler, { perProfile: 2, global: 10 });
    const result = await wrapped({}, { profileId: 'user-1' });
    assert.equal(result, 'ok');
  });

  it('passes params and ctx through', async () => {
    const handler = async (params, ctx) => ({ fileId: params.fileId, profileId: ctx.profileId });
    const wrapped = climit('test-pass', handler, { perProfile: 2, global: 10 });
    const result = await wrapped({ fileId: 'f1' }, { profileId: 'u1' });
    assert.equal(result.fileId, 'f1');
    assert.equal(result.profileId, 'u1');
  });
});

describe('rateLimit', () => {
  it('allows request under limit', async () => {
    const handler = async () => 'ok';
    const wrapped = rateLimit('test-rl', handler, { windowMs: 60000, maxRequests: 10 });
    const result = await wrapped({}, { profileId: 'user-1' });
    assert.equal(result, 'ok');
  });

  it('rejects request over limit', async () => {
    let calls = 0;
    const handler = async () => { calls++; return 'ok'; };
    const wrapped = rateLimit('test-reject', handler, { windowMs: 60000, maxRequests: 2 });

    await wrapped({}, { profileId: 'user-r' });
    await wrapped({}, { profileId: 'user-r' });

    await assert.rejects(
      () => wrapped({}, { profileId: 'user-r' }),
      (err) => err.code === 'rate-limit-exceeded'
    );
  });

  it('tracks profiles independently', async () => {
    const handler = async () => 'ok';
    const wrapped = rateLimit('test-multi', handler, { windowMs: 60000, maxRequests: 1 });

    await wrapped({}, { profileId: 'user-a' });
    await wrapped({}, { profileId: 'user-b' });
  });
});

describe('cleanupRateLimitData', () => {
  it('does not throw', () => {
    cleanupRateLimitData();
  });
});