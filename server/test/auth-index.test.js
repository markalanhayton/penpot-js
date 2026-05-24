import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, stripPrivateAttrs } from '../src/auth/index.js';
import { createTestPool, destroyTestPool } from './helpers.js';

describe('createSession', () => {
  let pool;
  pool = createTestPool();

  it('creates a session and returns token + sessionId', async () => {
    const profileId = '00000000-0000-0000-0000-000000000001';
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: profileId, fullname: 'Test', email: 'test@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });

    const result = await createSession(pool, profileId);
    assert.ok(result.token);
    assert.ok(result.sessionId);
    destroyTestPool(pool);
  });
});

describe('stripPrivateAttrs', () => {
  it('removes password key', () => {
    const obj = { name: 'visible', password: 'secret' };
    assert.equal(stripPrivateAttrs(obj).password, undefined);
    assert.equal(stripPrivateAttrs(obj).name, 'visible');
  });

  it('returns non-null object without password', () => {
    const obj = { id: 1, password: 'x' };
    assert.deepEqual(stripPrivateAttrs(obj), { id: 1 });
  });

  it('returns null unchanged', () => {
    assert.equal(stripPrivateAttrs(null), null);
  });

  it('returns object without password unchanged', () => {
    const obj = { name: 'test', email: 'a@b' };
    assert.deepEqual(stripPrivateAttrs(obj), { name: 'test', email: 'a@b' });
  });
});