import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import registerVerifyTokenCommands from '../src/rpc/verify_token.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

describe('Verify Token RPC — verify-token', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    process.env.PENPOT_SECRET_KEY = 'test-secret-key-for-verify-token-min32ch!';
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerVerifyTokenCommands(dispatcher.register, pool);
  });

  afterEach(() => {
    destroyTestPool(pool);
    delete process.env.PENPOT_SECRET_KEY;
  });

  it('rejects missing token parameter', async () => {
    const handler = dispatcher.methods.get('verify-token').handler;
    await assert.rejects(
      () => handler({}, {}),
      { code: 'validation-error' }
    );
  });

  it('rejects invalid/malformed token', async () => {
    const handler = dispatcher.methods.get('verify-token').handler;
    await assert.rejects(
      () => handler({ token: 'not-a-real-token' }, {}),
      { code: 'invalid-token' }
    );
  });

  it('rejects token with unknown issuer', async () => {
    const { createToken } = await import('../src/auth/tokens.js');
    const token = await createToken({ iss: 'unknown-issuer', uid: ids.profileId }, '15m');

    const handler = dispatcher.methods.get('verify-token').handler;
    await assert.rejects(
      () => handler({ token }, {}),
      { code: 'invalid-token' }
    );
  });

  it('processes verify-email token and returns profile with session token', async () => {
    const { createVerifyEmailToken } = await import('../src/auth/tokens.js');
    const token = await createVerifyEmailToken(ids.profileId);

    const handler = dispatcher.methods.get('verify-token').handler;
    const result = await handler({ token }, {});

    assert.ok(result.profile);
    assert.equal(result.profile.id, ids.profileId);
    assert.ok(result.token);
    assert.equal(result.iss, 'verify-email');
  });

  it('processes auth token and returns profile', async () => {
    const { createToken } = await import('../src/auth/tokens.js');
    const token = await createToken({ iss: 'auth', uid: ids.profileId }, '15m');

    const handler = dispatcher.methods.get('verify-token').handler;
    const result = await handler({ token }, {});

    assert.ok(result.profile);
    assert.equal(result.profile.id, ids.profileId);
    assert.equal(result.iss, 'auth');
  });

  it('processes change-email token and updates email', async () => {
    const { createToken } = await import('../src/auth/tokens.js');
    const newEmail = 'changed@example.com';
    const token = await createToken({ iss: 'change-email', uid: ids.profileId, email: newEmail }, '15m');

    const handler = dispatcher.methods.get('verify-token').handler;
    const result = await handler({ token }, {});

    assert.ok(result.profile);
    assert.equal(result.profile.email, newEmail);

    const profile = pool.get('SELECT * FROM profile WHERE id = ?', [ids.profileId]);
    assert.equal(profile.email, newEmail);
  });

  it('rejects empty string token', async () => {
    const handler = dispatcher.methods.get('verify-token').handler;
    await assert.rejects(
      () => handler({ token: '' }, {}),
      { code: 'validation-error' }
    );
  });
});