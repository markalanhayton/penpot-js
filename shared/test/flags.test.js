import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  login, email, varia, allFlags, defaultFlags, parse, current
} from '@penpot/shared/flags';

describe('flags', () => {
  it('login has correct entries', () => {
    assert.ok(login.has('registration'));
    assert.ok(login.has('login-with-password'));
    assert.ok(login.has('login-with-github'));
  });

  it('email has correct entries', () => {
    assert.ok(email.has('email-verification'));
    assert.ok(email.has('smtp'));
  });

  it('varia has correct entries', () => {
    assert.ok(varia.has('backend-api-doc'));
    assert.ok(varia.has('onboarding'));
    assert.ok(varia.has('token-color'));
  });

  it('allFlags is union of login, email, varia', () => {
    assert.ok(allFlags.has('registration'));
    assert.ok(allFlags.has('email-verification'));
    assert.ok(allFlags.has('backend-api-doc'));
  });

  it('defaultFlags is an array', () => {
    assert.ok(Array.isArray(defaultFlags));
    assert.ok(defaultFlags.includes('enable-registration'));
  });

  it('parse enable flags', () => {
    const result = parse(['enable-registration', 'enable-onboarding']);
    assert.ok(result.has('registration'));
    assert.ok(result.has('onboarding'));
  });

  it('parse disable flags', () => {
    const result = parse(['enable-registration'], ['disable-registration']);
    assert.ok(!result.has('registration'));
  });

  it('parse ignores unknown flags', () => {
    const result = parse(['some-unknown-flag']);
    assert.equal(result.size, 0);
  });

  it('current is a Set', () => {
    assert.ok(current instanceof Set);
  });
});