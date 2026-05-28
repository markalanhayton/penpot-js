import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import registerAuthCommands from '../src/rpc/auth.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

const FAKE_ARGON2ID_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$Rdesc1c6U4t18x9jd5p+9VjZfl9mAAvd1TNKOg8MKKM';

describe('Auth RPC — login-with-password', () => {
  let pool;
  let dispatcher;

  beforeEach(() => {
    process.env.PENPOT_FLAGS = 'enable-login-with-password enable-registration';
    pool = createTestPool();
    dispatcher = createDispatcher();
    registerAuthCommands(dispatcher.register, pool);
  });

  afterEach(() => {
    destroyTestPool(pool);
    delete process.env.PENPOT_FLAGS;
  });

  it('throws for non-existent email', async () => {
    const handler = dispatcher.methods.get('login-with-password').handler;
    await assert.rejects(
      () => handler({ email: 'nobody@example.com', password: 'secret' }, {}),
      { code: 'object-not-found' }
    );
  });

  it('throws authorization-error for inactive profile', async () => {
    const now = new Date().toISOString();
    const inactiveId = uuidv4();
    pool.insertReturning('profile', {
      id: inactiveId,
      fullname: 'Inactive User',
      email: 'inactive@example.com',
      password: FAKE_ARGON2ID_HASH,
      is_active: '0',
      is_demo: '0',
      is_blocked: '0',
      auth_source: 'password',
      created_at: now,
      modified_at: now,
    });

    const handler = dispatcher.methods.get('login-with-password').handler;
    await assert.rejects(
      () => handler({ email: 'inactive@example.com', password: 'secret' }, {}),
      { code: 'authorization-error' }
    );
  });

  it('throws authorization-error for blocked profile', async () => {
    const now = new Date().toISOString();
    const blockedId = uuidv4();
    pool.insertReturning('profile', {
      id: blockedId,
      fullname: 'Blocked User',
      email: 'blocked@example.com',
      password: FAKE_ARGON2ID_HASH,
      is_active: '1',
      is_demo: '0',
      is_blocked: '1',
      auth_source: 'password',
      created_at: now,
      modified_at: now,
    });

    const handler = dispatcher.methods.get('login-with-password').handler;
    await assert.rejects(
      () => handler({ email: 'blocked@example.com', password: 'secret' }, {}),
      { code: 'authorization-error' }
    );
  });

  it('throws authorization-error for SSO-only profile (no password set)', async () => {
    const now = new Date().toISOString();
    const ssoId = uuidv4();
    pool.insertReturning('profile', {
      id: ssoId,
      fullname: 'SSO User',
      email: 'sso@example.com',
      password: '!',
      is_active: '1',
      is_demo: '0',
      is_blocked: '0',
      auth_source: 'oidc',
      created_at: now,
      modified_at: now,
    });

    const handler = dispatcher.methods.get('login-with-password').handler;
    await assert.rejects(
      () => handler({ email: 'sso@example.com', password: 'secret' }, {}),
      { code: 'authorization-error' }
    );
  });

  it('trims and lowercases email before lookup', async () => {
    const handler = dispatcher.methods.get('login-with-password').handler;
    await assert.rejects(
      () => handler({ email: '  NOBODY@Example.COM  ', password: 'secret' }, {}),
      { code: 'object-not-found' }
    );
  });
});

describe('Auth RPC — logout', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerAuthCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('deactivates a session when ctx.sessionId is provided', async () => {
    const now = new Date().toISOString();
    const sessionId = uuidv4();
    pool.run(
      'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, ids.profileId, 'test', now, now, '1']
    );

    const handler = dispatcher.methods.get('logout').handler;
    const result = await handler({}, { sessionId });

    assert.equal(result, null);

    const session = pool.get('SELECT is_active FROM http_session WHERE id = ?', [sessionId]);
    assert.equal(session.is_active, '0');
  });

  it('does nothing when ctx.sessionId is absent', async () => {
    const now = new Date().toISOString();
    const sessionId = uuidv4();
    pool.run(
      'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, ids.profileId, 'test', now, now, '1']
    );

    const handler = dispatcher.methods.get('logout').handler;
    const result = await handler({}, {});

    assert.equal(result, null);

    const session = pool.get('SELECT is_active FROM http_session WHERE id = ?', [sessionId]);
    assert.equal(session.is_active, '1');
  });

  it('returns null even for non-existent session id', async () => {
    const handler = dispatcher.methods.get('logout').handler;
    const fakeSessionId = uuidv4();
    const result = await handler({}, { sessionId: fakeSessionId });
    assert.equal(result, null);
  });
});

describe('Auth RPC — get-sso-provider', () => {
  let pool;
  let dispatcher;

  beforeEach(() => {
    pool = createTestPool();
    dispatcher = createDispatcher();
    registerAuthCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns null for empty email', async () => {
    const handler = dispatcher.methods.get('get-sso-provider').handler;
    const result = await handler({ email: '' }, {});
    assert.equal(result, null);
  });

  it('returns null for null-ish email', async () => {
    const handler = dispatcher.methods.get('get-sso-provider').handler;
    const result = await handler({ email: null }, {});
    assert.equal(result, null);
  });

  it('returns null for unknown domain', async () => {
    const handler = dispatcher.methods.get('get-sso-provider').handler;
    const result = await handler({ email: 'user@unknown-domain.com' }, {});
    assert.equal(result, null);
  });

  it('returns provider when matching domain exists', async () => {
    const now = new Date().toISOString();
    const providerId = uuidv4();
    pool.insertReturning('sso_provider', {
      id: providerId,
      created_at: now,
      modified_at: now,
      is_enabled: '1',
      type: 'oidc',
      domain: 'example.com',
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      base_uri: 'https://idp.example.com',
      token_uri: 'https://idp.example.com/token',
      auth_uri: 'https://idp.example.com/authorize',
      user_uri: 'https://idp.example.com/userinfo',
      user_info_source: 'auto',
    });

    const handler = dispatcher.methods.get('get-sso-provider').handler;
    const result = await handler({ email: 'user@example.com' }, {});

    assert.ok(result);
    assert.equal(result.domain, 'example.com');
    assert.equal(result.clientId, 'test-client-id');
    assert.equal(result.type, 'oidc');
  });

  it('returns null for disabled provider', async () => {
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

    const handler = dispatcher.methods.get('get-sso-provider').handler;
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

    const handler = dispatcher.methods.get('get-sso-provider').handler;
    const result = await handler({ email: '  User@MyCompany.COM  ' }, {});
    assert.ok(result);
    assert.equal(result.domain, 'mycompany.com');
  });
});

describe('Auth RPC — request-profile-recovery', () => {
  let pool;
  let dispatcher;

  beforeEach(() => {
    pool = createTestPool();
    dispatcher = createDispatcher();
    registerAuthCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns ok for non-existent email (no enumeration)', async () => {
    const handler = dispatcher.methods.get('request-profile-recovery').handler;
    const result = await handler({ email: 'ghost@nowhere.com' }, {});
    assert.deepEqual(result, { status: 'ok' });
  });

  it('returns ok for existing email', async () => {
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: uuidv4(),
      fullname: 'Recoverable User',
      email: 'recover@example.com',
      password: FAKE_ARGON2ID_HASH,
      is_active: '1',
      is_demo: '0',
      is_blocked: '0',
      auth_source: 'password',
      created_at: now,
      modified_at: now,
    });

    process.env.PENPOT_SECRET_KEY = 'test-secret-key-for-recovery-tests-min32!';
    process.env.PENPOT_SMTP_ENABLED = 'false';

    const handler = dispatcher.methods.get('request-profile-recovery').handler;
    const result = await handler({ email: 'recover@example.com' }, {});
    assert.deepEqual(result, { status: 'ok' });

    delete process.env.PENPOT_SECRET_KEY;
    delete process.env.PENPOT_SMTP_ENABLED;
  });

  it('trims and lowercases email before lookup', async () => {
    const handler = dispatcher.methods.get('request-profile-recovery').handler;
    const result = await handler({ email: '  NoMatch@Example.COM  ' }, {});
    assert.deepEqual(result, { status: 'ok' });
  });

  it('skips deleted profiles', async () => {
    const now = new Date().toISOString();
    const deletedId = uuidv4();
    pool.insertReturning('profile', {
      id: deletedId,
      fullname: 'Deleted User',
      email: 'deleted-recovery@example.com',
      password: FAKE_ARGON2ID_HASH,
      is_active: '0',
      is_demo: '0',
      is_blocked: '0',
      auth_source: 'password',
      created_at: now,
      modified_at: now,
      deleted_at: now,
    });

    const handler = dispatcher.methods.get('request-profile-recovery').handler;
    const result = await handler({ email: 'deleted-recovery@example.com' }, {});
    assert.deepEqual(result, { status: 'ok' });
  });
});

describe('Auth RPC — recover-profile', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerAuthCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('rejects invalid token', async () => {
    const handler = dispatcher.methods.get('recover-profile').handler;
    await assert.rejects(
      () => handler({ token: 'totally-invalid-token', password: 'newpass123' }, {}),
      { code: 'validation-error' }
    );
  });

  it('rejects token with wrong issuer', async () => {
    process.env.PENPOT_SECRET_KEY = 'test-secret-key-for-recover-wrong-iss-min32!';

    const { createToken } = await import('../src/auth/tokens.js');
    const wrongIssToken = await createToken({ iss: 'prepared-register', uid: ids.profileId }, '15m');

    const handler = dispatcher.methods.get('recover-profile').handler;
    await assert.rejects(
      () => handler({ token: wrongIssToken, password: 'newpass123' }, {}),
      { code: 'validation-error' }
    );

    delete process.env.PENPOT_SECRET_KEY;
  });

  it('resets password and invalidates sessions with valid recovery token', async () => {
    process.env.PENPOT_SECRET_KEY = 'test-secret-key-for-recover-valid-min32!!';

    const now = new Date().toISOString();
    const sessionId = uuidv4();
    pool.run(
      'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, ids.profileId, 'test', now, now, '1']
    );

    const { createPasswordRecoveryToken } = await import('../src/auth/tokens.js');
    const recoveryToken = await createPasswordRecoveryToken(ids.profileId);

    const handler = dispatcher.methods.get('recover-profile').handler;
    const result = await handler({ token: recoveryToken, password: 'newpass123' }, {});

    assert.deepEqual(result, { status: 'ok' });

    const profile = pool.get('SELECT password FROM profile WHERE id = ?', [ids.profileId]);
    assert.notEqual(profile.password, '!');

    const session = pool.get('SELECT is_active FROM http_session WHERE id = ?', [sessionId]);
    assert.equal(session.is_active, '0');

    delete process.env.PENPOT_SECRET_KEY;
  });

  it('invalidates all sessions for the profile after password reset', async () => {
    process.env.PENPOT_SECRET_KEY = 'test-secret-key-for-recover-sess-min32!!';

    const now = new Date().toISOString();
    const sess1 = uuidv4();
    const sess2 = uuidv4();
    pool.run(
      'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [sess1, ids.profileId, 'test1', now, now, '1']
    );
    pool.run(
      'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [sess2, ids.profileId, 'test2', now, now, '1']
    );

    const { createPasswordRecoveryToken } = await import('../src/auth/tokens.js');
    const recoveryToken = await createPasswordRecoveryToken(ids.profileId);

    const handler = dispatcher.methods.get('recover-profile').handler;
    const result = await handler({ token: recoveryToken, password: 'brandnewpass' }, {});

    assert.deepEqual(result, { status: 'ok' });

    const rows = pool.get(
      "SELECT COUNT(*) as cnt FROM http_session WHERE profile_id = ? AND is_active = '1'",
      [ids.profileId]
    );
    assert.equal(Number(rows.cnt), 0);

    delete process.env.PENPOT_SECRET_KEY;
  });
});