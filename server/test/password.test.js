import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { derivePassword, verifyPassword, isNoPasswordSet } from '../src/auth/password.js';

describe('derivePassword', () => {
  it('produces an argon2id hash string', async () => {
    const hash = await derivePassword('test-password');
    assert.ok(hash.startsWith('$argon2id$'));
  });

  it('produces different hashes for different passwords', async () => {
    const h1 = await derivePassword('pass1');
    const h2 = await derivePassword('pass2');
    assert.notEqual(h1, h2);
  });
});

describe('verifyPassword', () => {
  it('validates correct password', async () => {
    const hash = await derivePassword('correct');
    const { valid, update } = await verifyPassword(hash, 'correct');
    assert.equal(valid, true);
    assert.equal(update, false);
  });

  it('rejects wrong password', async () => {
    const hash = await derivePassword('correct');
    const { valid, update } = await verifyPassword(hash, 'wrong');
    assert.equal(valid, false);
    assert.equal(update, false);
  });

  it('handles malformed hash gracefully', async () => {
    const { valid, update } = await verifyPassword('not-a-hash', 'password');
    assert.equal(valid, false);
    assert.equal(update, false);
  });
});

describe('isNoPasswordSet', () => {
  it('returns true for "!" sentinel', () => {
    assert.equal(isNoPasswordSet('!'), true);
  });

  it('returns false for a real hash', async () => {
    const hash = await derivePassword('test');
    assert.equal(isNoPasswordSet(hash), false);
  });

  it('returns false for null', () => {
    assert.equal(isNoPasswordSet(null), false);
  });
});