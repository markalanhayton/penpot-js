import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowed } from '../src/email/index.js';

describe('Email domain filtering', () => {
  describe('isEmailAllowed', () => {
    it('allows all emails when no filters are configured', () => {
      assert.equal(isEmailAllowed('user@example.com', {}), true);
      assert.equal(isEmailAllowed('user@gmail.com', {}), true);
    });

    it('blocks non-whitelisted domains when whitelist is set', () => {
      const opts = { whitelist: 'gmail.com,example.org' };
      assert.equal(isEmailAllowed('user@gmail.com', opts), true);
      assert.equal(isEmailAllowed('user@example.org', opts), true);
      assert.equal(isEmailAllowed('user@other.com', opts), false);
    });

    it('allows whitelisted subdomains', () => {
      const opts = { whitelist: 'gmail.com' };
      assert.equal(isEmailAllowed('user@gmail.com', opts), true);
      assert.equal(isEmailAllowed('user@sub.gmail.com', opts), true);
      assert.equal(isEmailAllowed('user@other.com', opts), false);
    });

    it('blocks blacklisted domains', () => {
      const opts = { blacklist: 'mailinator.com,tempmail.com' };
      assert.equal(isEmailAllowed('user@mailinator.com', opts), false);
      assert.equal(isEmailAllowed('user@tempmail.com', opts), false);
      assert.equal(isEmailAllowed('user@gmail.com', opts), true);
    });

    it('blocks blacklisted subdomains', () => {
      const opts = { blacklist: 'mailinator.com' };
      assert.equal(isEmailAllowed('user@mailinator.com', opts), false);
      assert.equal(isEmailAllowed('user@sub.mailinator.com', opts), false);
      assert.equal(isEmailAllowed('user@gmail.com', opts), true);
    });

    it('whitelist takes priority over blacklist', () => {
      const opts = { whitelist: 'mailinator.com', blacklist: 'mailinator.com' };
      assert.equal(isEmailAllowed('user@mailinator.com', opts), true);
      assert.equal(isEmailAllowed('user@gmail.com', opts), false);
    });

    it('blocks disposable domains when blockDisposable is enabled', () => {
      const opts = { blockDisposable: true };
      assert.equal(isEmailAllowed('user@mailinator.com', opts), false);
      assert.equal(isEmailAllowed('user@guerrillamail.com', opts), false);
      assert.equal(isEmailAllowed('user@10minutemail.com', opts), false);
      assert.equal(isEmailAllowed('user@sub.mailinator.com', opts), false);
      assert.equal(isEmailAllowed('user@gmail.com', opts), true);
    });

    it('does not block disposable domains when blockDisposable is disabled', () => {
      const opts = { blockDisposable: false };
      assert.equal(isEmailAllowed('user@mailinator.com', opts), true);
      assert.equal(isEmailAllowed('user@gmail.com', opts), true);
    });

    it('rejects invalid email input', () => {
      assert.equal(isEmailAllowed(null, {}), false);
      assert.equal(isEmailAllowed(undefined, {}), false);
      assert.equal(isEmailAllowed('', {}), false);
      assert.equal(isEmailAllowed('no-at-sign', {}), false);
    });

    it('is case-insensitive for domain matching', () => {
      const opts = { whitelist: 'Gmail.Com' };
      assert.equal(isEmailAllowed('user@GMAIL.COM', opts), true);
      assert.equal(isEmailAllowed('user@gmail.com', opts), true);
    });

    it('allows blacklist + blockDisposable together', () => {
      const opts = { blacklist: 'evil.com', blockDisposable: true };
      assert.equal(isEmailAllowed('user@evil.com', opts), false);
      assert.equal(isEmailAllowed('user@mailinator.com', opts), false);
      assert.equal(isEmailAllowed('user@gmail.com', opts), true);
    });

    it('uses global config when no override is provided', () => {
      assert.equal(typeof isEmailAllowed('user@example.com'), 'boolean');
    });
  });
});