import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPool, runMigrations } from '../src/db/sqlite.js';
import { createToken, verifyToken, createRegistrationToken, createSessionToken } from '../src/auth/tokens.js';
import { derivePassword, verifyPassword } from '../src/auth/password.js';
import registerAuthCommands from '../src/rpc/auth.js';
import { registerMethod, getRegisteredMethods } from '../src/rpc/dispatcher.js';

function createTestPool() {
  const pool = createPool(':memory:');
  runMigrations(pool.db);
  return pool;
}

function destroyTestPool(pool) {
  pool.db.close();
}

describe('Registration flow', () => {
  let pool;
  let handlers = {};

  before(() => {
    pool = createTestPool();
    registerAuthCommands((name, def) => {
      handlers[name] = def;
    }, pool);
  });

  after(() => {
    destroyTestPool(pool);
  });

  describe('prepare-register-profile', () => {
    it('creates a registration token for a new email', async () => {
      const result = await handlers['prepare-register-profile'].handler({
        fullname: 'Test User',
        email: 'newuser@example.com',
        password: 'secret123',
      });

      assert.ok(result.token, 'should return a token');
      const { valid, claims } = await verifyToken(result.token);
      assert.equal(valid, true);
      assert.equal(claims.iss, 'prepared-register');
      assert.equal(claims.email, 'newuser@example.com');
      assert.equal(claims.fullname, 'Test User');
      assert.equal(claims.password, 'secret123');
    });

    it('rejects registration for an active existing email', async () => {
      const now = new Date().toISOString();
      pool.insertReturning('profile', {
        id: '00000000-0000-0000-0000-000000000001',
        fullname: 'Existing',
        email: 'existing@example.com',
        password: '!',
        is_active: '1',
        is_demo: '0',
        is_blocked: '0',
        auth_source: 'password',
        created_at: now,
        modified_at: now,
      });

      await assert.rejects(
        () => handlers['prepare-register-profile'].handler({
          fullname: 'Another',
          email: 'existing@example.com',
          password: 'test123',
        }),
        { type: 'conflict' }
      );
    });

    it('allows registration for inactive existing email', async () => {
      const now = new Date().toISOString();
      pool.insertReturning('profile', {
        id: '00000000-0000-0000-0000-000000000002',
        fullname: 'Inactive',
        email: 'inactive@example.com',
        password: '!',
        is_active: '0',
        is_demo: '0',
        is_blocked: '0',
        auth_source: 'password',
        created_at: now,
        modified_at: now,
      });

      const result = await handlers['prepare-register-profile'].handler({
        fullname: 'New User',
        email: 'inactive@example.com',
        password: 'test123',
      });
      assert.ok(result.token);
    });

    it('trims and lowercases email', async () => {
      const result = await handlers['prepare-register-profile'].handler({
        fullname: 'Trim User',
        email: '  Trim@EXAMPLE.COM  ',
        password: 'test123',
      });

      const { claims } = await verifyToken(result.token);
      assert.equal(claims.email, 'trim@example.com');
    });

    it('includes invitationToken in claims when provided', async () => {
      const inviteToken = await createToken({ iss: 'team-invitation', memberId: 'abc' }, '1h');
      const result = await handlers['prepare-register-profile'].handler({
        fullname: 'Invited User',
        email: 'invited@example.com',
        password: 'test123',
        invitationToken: inviteToken,
      });

      const { claims } = await verifyToken(result.token);
      assert.equal(claims.invitationToken, inviteToken);
    });
  });

  describe('register-profile', () => {
    const testCtx = { userAgent: 'test-agent', ipAddr: '127.0.0.1' };

    it('completes registration with a valid token (email verification enabled)', async () => {
      const regToken = await createRegistrationToken('reguser@example.com', 'Reg User', 'pass123');
      const result = await handlers['register-profile'].handler({ token: regToken }, testCtx);

      assert.ok(result.id, 'should return id');
      assert.equal(result.email, 'reguser@example.com');

      const profile = pool.getOne('profile', { email: 'reguser@example.com' });
      assert.ok(profile, 'profile should exist in DB');
      assert.equal(profile.is_active, '0', 'profile should be inactive until email verified');
    });

    it('creates default team and project for new user', async () => {
      const regToken = await createRegistrationToken('teamuser@example.com', 'Team User', 'pass456');
      const result = await handlers['register-profile'].handler({ token: regToken }, testCtx);

      const profile = pool.getOne('profile', { email: 'teamuser@example.com' });
      assert.ok(profile.default_team_id, 'profile should have default_team_id');
      assert.ok(profile.default_project_id, 'profile should have default_project_id');

      const team = pool.getOne('team', { id: profile.default_team_id });
      assert.ok(team, 'default team should exist');

      const project = pool.getOne('project', { id: profile.default_project_id });
      assert.ok(project, 'default project should exist');
    });

    it('hashes password with Argon2id', async () => {
      const regToken = await createRegistrationToken('hashtest@example.com', 'Hash Test', 'mypassword');
      await handlers['register-profile'].handler({ token: regToken }, testCtx);

      const profile = pool.getOne('profile', { email: 'hashtest@example.com' });
      assert.ok(profile.password, 'password should be stored');
      assert.ok(profile.password.startsWith('$argon2id$'), 'password should be Argon2id hash');

      const { valid } = await verifyPassword(profile.password, 'mypassword');
      assert.equal(valid, true);
    });

    it('rejects invalid token', async () => {
      await assert.rejects(
        () => handlers['register-profile'].handler({ token: 'invalid-token' }, testCtx),
        { type: 'validation' }
      );
    });

    it('rejects expired token', async () => {
      const expiredToken = await createToken({ iss: 'prepared-register', email: 'exp@example.com' }, '1s');
      await new Promise(r => setTimeout(r, 1100));

      await assert.rejects(
        () => handlers['register-profile'].handler({ token: expiredToken }, testCtx),
        { type: 'validation' }
      );
    });

    it('rejects token with wrong issuer', async () => {
      const wrongToken = await createToken({ iss: 'authentication', uid: 'abc' }, '1h');
      await assert.rejects(
        () => handlers['register-profile'].handler({ token: wrongToken }, testCtx),
        { type: 'validation' }
      );
    });

    it('returns basic info for duplicate blocked user', async () => {
      const now = new Date().toISOString();
      pool.insertReturning('profile', {
        id: '00000000-0000-0000-0000-000000000099',
        fullname: 'Blocked',
        email: 'blocked-dupe@example.com',
        password: '!',
        is_active: '1',
        is_demo: '0',
        is_blocked: '1',
        auth_source: 'password',
        created_at: now,
        modified_at: now,
      });

      const regToken = await createRegistrationToken('blocked-dupe@example.com', 'Dup2', 'pass');
      const result = await handlers['register-profile'].handler({ token: regToken }, testCtx);
      assert.equal(result.id, '00000000-0000-0000-0000-000000000099');
      assert.equal(result.email, 'blocked-dupe@example.com');
    });

    it('logs in existing active user on duplicate registration attempt', async () => {
      const now = new Date().toISOString();
      const existingId = '00000000-0000-0000-0000-000000000100';
      const hashedPw = await derivePassword('existingpass');
      pool.insertReturning('profile', {
        id: existingId,
        fullname: 'Existing Active',
        email: 'existing-active@example.com',
        password: hashedPw,
        is_active: '1',
        is_demo: '0',
        is_blocked: '0',
        auth_source: 'password',
        created_at: now,
        modified_at: now,
      });

      const regToken = await createRegistrationToken('existing-active@example.com', 'New Person', 'newpass');
      const result = await handlers['register-profile'].handler({ token: regToken }, testCtx);

      assert.ok(result.profile, 'should return profile');
      assert.ok(result.token, 'should return session token');
      assert.equal(result.profile.id, existingId);
    });

    it('returns basic info for blocked user on duplicate attempt', async () => {
      const now = new Date().toISOString();
      pool.insertReturning('profile', {
        id: '00000000-0000-0000-0000-000000000200',
        fullname: 'Blocked',
        email: 'blocked@example.com',
        password: '!',
        is_active: '1',
        is_demo: '0',
        is_blocked: '1',
        auth_source: 'password',
        created_at: now,
        modified_at: now,
      });

      const regToken = await createRegistrationToken('blocked@example.com', 'Blocked Person', 'pass');
      const result = await handlers['register-profile'].handler({ token: regToken }, testCtx);

      assert.equal(result.id, '00000000-0000-0000-0000-000000000200');
      assert.equal(result.email, 'blocked@example.com');
      assert.ok(!result.token, 'should not return session token for blocked user');
    });
  });

  describe('End-to-end registration flow', () => {
    const testCtx = { userAgent: 'test-agent', ipAddr: '127.0.0.1' };

    it('full prepare-then-register flow', async () => {
      const prepResult = await handlers['prepare-register-profile'].handler({
        fullname: 'E2E User',
        email: 'e2e@example.com',
        password: 'e2epassword',
      });

      assert.ok(prepResult.token, 'prepare should return token');

      const regResult = await handlers['register-profile'].handler(
        { token: prepResult.token },
        testCtx
      );

      assert.ok(regResult.id, 'should return id');
      assert.equal(regResult.email, 'e2e@example.com');

      const profile = pool.getOne('profile', { email: 'e2e@example.com' });
      assert.ok(profile.default_team_id, 'should have default team');
      assert.ok(profile.default_project_id, 'should have default project');
    });
  });
});