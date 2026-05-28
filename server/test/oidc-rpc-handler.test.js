import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import registerOidcCommands from '../src/auth/oidc.js';
import { createToken, verifyToken } from '../src/auth/tokens.js';
import { flagEnabled } from '../src/config/index.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

describe('OIDC RPC — get-oidc-provider', () => {
  let pool;
  let dispatcher;

  beforeEach(() => {
    pool = createTestPool();
    dispatcher = createDispatcher();
    registerOidcCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns null for empty email', async () => {
    const handler = dispatcher.methods.get('get-oidc-provider').handler;
    const result = await handler({ email: '' }, {});
    assert.equal(result, null);
  });

  it('returns null for null email', async () => {
    const handler = dispatcher.methods.get('get-oidc-provider').handler;
    const result = await handler({ email: null }, {});
    assert.equal(result, null);
  });

  it('returns null for email with no matching SSO provider', async () => {
    const handler = dispatcher.methods.get('get-oidc-provider').handler;
    const result = await handler({ email: 'user@nomatch.com' }, {});
    assert.equal(result, null);
  });

  it('returns provider when matching domain exists in sso_provider', async () => {
    const now = new Date().toISOString();
    const providerId = uuidv4();
    pool.insertReturning('sso_provider', {
      id: providerId,
      created_at: now,
      modified_at: now,
      is_enabled: '1',
      type: 'oidc',
      domain: 'acme.com',
      client_id: 'acme-client',
      client_secret: 'acme-secret',
      base_uri: 'https://idp.acme.com',
      user_info_source: 'auto',
    });

    const handler = dispatcher.methods.get('get-oidc-provider').handler;
    const result = await handler({ email: 'alice@acme.com' }, {});

    assert.ok(result);
    assert.equal(result.id, providerId);
    assert.equal(result.type, 'oidc');
  });

  it('returns null for disabled SSO provider', async () => {
    const now = new Date().toISOString();
    const providerId = uuidv4();
    pool.insertReturning('sso_provider', {
      id: providerId,
      created_at: now,
      modified_at: now,
      is_enabled: '0',
      type: 'oidc',
      domain: 'disabled-corp.com',
      client_id: 'disabled-client',
      client_secret: 'disabled-secret',
      base_uri: 'https://idp.disabled-corp.com',
      user_info_source: 'auto',
    });

    const handler = dispatcher.methods.get('get-oidc-provider').handler;
    const result = await handler({ email: 'admin@disabled-corp.com' }, {});
    assert.equal(result, null);
  });

  it('trims and lowercases email before extracting domain', async () => {
    const now = new Date().toISOString();
    const providerId = uuidv4();
    pool.insertReturning('sso_provider', {
      id: providerId,
      created_at: now,
      modified_at: now,
      is_enabled: '1',
      type: 'oidc',
      domain: 'mycompany.com',
      client_id: 'mc-client',
      client_secret: 'mc-secret',
      base_uri: 'https://idp.mycompany.com',
      user_info_source: 'auto',
    });

    const handler = dispatcher.methods.get('get-oidc-provider').handler;
    const result = await handler({ email: '  User@MyCompany.COM  ' }, {});
    assert.ok(result);
    assert.equal(result.id, providerId);
  });
});

describe('OIDC RPC — get-oidc-auth-uri', () => {
  let pool;
  let dispatcher;

  beforeEach(() => {
    process.env.PENPOT_SECRET_KEY = 'test-oidc-secret-key-min-32-chars!!';
    pool = createTestPool();
    dispatcher = createDispatcher();
    registerOidcCommands(dispatcher.register, pool);
  });

  afterEach(() => {
    destroyTestPool(pool);
    delete process.env.PENPOT_SECRET_KEY;
  });

  it('throws validation-error when provider ID is missing', async () => {
    const handler = dispatcher.methods.get('get-oidc-auth-uri').handler;
    await assert.rejects(
      () => handler({ provider: null }, {}),
      { code: 'validation-error' }
    );
  });

  it('throws provider-not-found for unknown provider ID', async () => {
    const handler = dispatcher.methods.get('get-oidc-auth-uri').handler;
    await assert.rejects(
      () => handler({ provider: 'nonexistent-provider' }, {}),
      { code: 'provider-not-found' }
    );
  });

  it('throws provider-disabled when OIDC login flag is not enabled', async () => {
    if (flagEnabled('login-with-oidc')) return;

    const now = new Date().toISOString();
    const providerId = uuidv4();
    pool.insertReturning('sso_provider', {
      id: providerId,
      created_at: now,
      modified_at: now,
      is_enabled: '1',
      type: 'oidc',
      domain: 'sso-test.com',
      client_id: 'sso-client-id',
      client_secret: 'sso-client-secret',
      base_uri: 'https://idp.sso-test.com',
      auth_uri: 'https://idp.sso-test.com/authorize',
      token_uri: 'https://idp.sso-test.com/token',
      user_uri: 'https://idp.sso-test.com/userinfo',
      user_info_source: 'auto',
    });

    const handler = dispatcher.methods.get('get-oidc-auth-uri').handler;
    await assert.rejects(
      () => handler({ provider: providerId }, {}),
      { code: 'provider-disabled' }
    );
  });

  it('generates auth URI with state for a configured custom SSO provider (when flag enabled)', async () => {
    if (!flagEnabled('login-with-oidc')) return;

    const now = new Date().toISOString();
    const providerId = uuidv4();
    pool.insertReturning('sso_provider', {
      id: providerId,
      created_at: now,
      modified_at: now,
      is_enabled: '1',
      type: 'oidc',
      domain: 'sso-test.com',
      client_id: 'sso-client-id',
      client_secret: 'sso-client-secret',
      base_uri: 'https://idp.sso-test.com',
      auth_uri: 'https://idp.sso-test.com/authorize',
      token_uri: 'https://idp.sso-test.com/token',
      user_uri: 'https://idp.sso-test.com/userinfo',
      user_info_source: 'auto',
    });

    const handler = dispatcher.methods.get('get-oidc-auth-uri').handler;
    const result = await handler({ provider: providerId }, {});

    assert.ok(result.redirectUri);
    assert.ok(result.state);
    assert.ok(result.redirectUri.startsWith('https://idp.sso-test.com/authorize?'));
    assert.ok(result.redirectUri.includes('client_id=sso-client-id'));
    assert.ok(result.redirectUri.includes('response_type=code'));
  });

  it('includes invitationToken in state when provided (when flag enabled)', async () => {
    if (!flagEnabled('login-with-oidc')) return;

    const now = new Date().toISOString();
    const providerId = uuidv4();
    pool.insertReturning('sso_provider', {
      id: providerId,
      created_at: now,
      modified_at: now,
      is_enabled: '1',
      type: 'oidc',
      domain: 'invite-test.com',
      client_id: 'invite-client',
      client_secret: 'invite-secret',
      base_uri: 'https://idp.invite-test.com',
      auth_uri: 'https://idp.invite-test.com/authorize',
      token_uri: 'https://idp.invite-test.com/token',
      user_uri: 'https://idp.invite-test.com/userinfo',
      user_info_source: 'auto',
    });

    const handler = dispatcher.methods.get('get-oidc-auth-uri').handler;
    const result = await handler({ provider: providerId, invitationToken: 'inv-123' }, {});

    const { valid, claims } = await verifyToken(result.state);
    assert.equal(valid, true);
    assert.equal(claims.iss, 'oidc');
    assert.equal(claims.provider, providerId);
    assert.equal(claims.invitationToken, 'inv-123');
  });

  it('throws oidc-discovery-failed when provider has baseUri but discovery endpoint is unreachable (when flag enabled)', async () => {
    if (!flagEnabled('login-with-oidc')) return;

    const now = new Date().toISOString();
    const providerId = uuidv4();
    pool.insertReturning('sso_provider', {
      id: providerId,
      created_at: now,
      modified_at: now,
      is_enabled: '1',
      type: 'oidc',
      domain: 'noauth-test.com',
      client_id: 'noauth-client',
      client_secret: 'noauth-secret',
      base_uri: 'https://idp.noauth-test.com',
      auth_uri: null,
      token_uri: null,
      user_uri: null,
      user_info_source: 'auto',
    });

    const handler = dispatcher.methods.get('get-oidc-auth-uri').handler;
    await assert.rejects(
      () => handler({ provider: providerId }, {}),
      { code: 'oidc-discovery-failed' }
    );
  });
});

describe('OIDC RPC — oidc-callback', () => {
  let pool;
  let dispatcher;

  beforeEach(() => {
    process.env.PENPOT_SECRET_KEY = 'test-oidc-callback-secret-key-min-32!';
    pool = createTestPool();
    dispatcher = createDispatcher();
    registerOidcCommands(dispatcher.register, pool);
  });

  afterEach(() => {
    destroyTestPool(pool);
    delete process.env.PENPOT_SECRET_KEY;
  });

  it('throws oidc-auth-failed when error parameter is present', async () => {
    const handler = dispatcher.methods.get('oidc-callback').handler;
    await assert.rejects(
      () => handler({ error: 'access_denied', errorDescription: 'User denied access' }, {}),
      { code: 'oidc-auth-failed' }
    );
  });

  it('throws oidc-auth-failed with error as hint when no errorDescription', async () => {
    const handler = dispatcher.methods.get('oidc-callback').handler;
    await assert.rejects(
      () => handler({ error: 'consent_required' }, {}),
      { code: 'oidc-auth-failed' }
    );
  });

  it('throws validation-error when code is missing', async () => {
    const handler = dispatcher.methods.get('oidc-callback').handler;
    await assert.rejects(
      () => handler({ state: 'some-state' }, {}),
      { code: 'validation-error' }
    );
  });

  it('throws validation-error when state is missing', async () => {
    const handler = dispatcher.methods.get('oidc-callback').handler;
    await assert.rejects(
      () => handler({ code: 'auth-code-123' }, {}),
      { code: 'validation-error' }
    );
  });

  it('throws invalid-token for invalid or expired state token', async () => {
    const handler = dispatcher.methods.get('oidc-callback').handler;
    await assert.rejects(
      () => handler({ code: 'auth-code', state: 'totally-invalid-state-token' }, {}),
      { code: 'invalid-token' }
    );
  });

  it('throws invalid-token when state token has wrong issuer', async () => {
    const wrongIssToken = await createToken({ iss: 'authentication', provider: 'google' }, '4h');

    const handler = dispatcher.methods.get('oidc-callback').handler;
    await assert.rejects(
      () => handler({ code: 'auth-code', state: wrongIssToken }, {}),
      { code: 'invalid-token' }
    );
  });

  it('throws provider-not-found when state token references non-existent provider', async () => {
    const stateToken = await createToken({ iss: 'oidc', provider: 'nonexistent' }, '4h');

    const handler = dispatcher.methods.get('oidc-callback').handler;
    await assert.rejects(
      () => handler({ code: 'auth-code', state: stateToken }, {}),
      { code: 'provider-not-found' }
    );
  });
});