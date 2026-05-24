import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createToken, verifyToken, createSessionToken, createRegistrationToken, createPasswordRecoveryToken, createVerifyEmailToken } from '../src/auth/tokens.js';
import { randomUUID } from 'node:crypto';

describe('createToken / verifyToken', () => {
  it('creates and verifies a token', async () => {
    const token = await createToken({ iss: 'test', uid: 'abc' });
    const { valid, claims } = await verifyToken(token);
    assert.equal(valid, true);
    assert.equal(claims.uid, 'abc');
    assert.equal(claims.iss, 'test');
  });

  it('fails verification for invalid token', async () => {
    const { valid, claims } = await verifyToken('invalid-token-string');
    assert.equal(valid, false);
    assert.equal(claims, null);
  });

  it('fails verification for expired token', async () => {
    const token = await createToken({ iss: 'test' }, '1s');
    await new Promise(r => setTimeout(r, 1100));
    const { valid } = await verifyToken(token);
    assert.equal(valid, false);
  });

  it('creates token with no expiration when null is passed', async () => {
    const token = await createToken({ iss: 'test', uid: 'abc' }, null);
    const { valid, claims } = await verifyToken(token);
    assert.equal(valid, true);
    assert.equal(claims.uid, 'abc');
  });
});

describe('createSessionToken', () => {
  it('creates a valid authentication token', async () => {
    const profileId = randomUUID();
    const sessionId = randomUUID();
    const token = await createSessionToken(profileId, sessionId);
    const { valid, claims } = await verifyToken(token);
    assert.equal(valid, true);
    assert.equal(claims.iss, 'authentication');
    assert.equal(claims.uid, profileId);
    assert.equal(claims.sid, sessionId);
  });
});

describe('createRegistrationToken', () => {
  it('creates a prepared-register token', async () => {
    const token = await createRegistrationToken('user@test.com', 'Test', 'pass123');
    const { valid, claims } = await verifyToken(token);
    assert.equal(valid, true);
    assert.equal(claims.iss, 'prepared-register');
    assert.equal(claims.email, 'user@test.com');
  });
});

describe('createPasswordRecoveryToken', () => {
  it('creates a password-recovery token', async () => {
    const profileId = randomUUID();
    const token = await createPasswordRecoveryToken(profileId);
    const { valid, claims } = await verifyToken(token);
    assert.equal(valid, true);
    assert.equal(claims.iss, 'password-recovery');
    assert.equal(claims.uid, profileId);
  });
});

describe('createVerifyEmailToken', () => {
  it('creates a verify-email token', async () => {
    const profileId = randomUUID();
    const token = await createVerifyEmailToken(profileId);
    const { valid, claims } = await verifyToken(token);
    assert.equal(valid, true);
    assert.equal(claims.iss, 'verify-email');
    assert.equal(claims.uid, profileId);
  });
});