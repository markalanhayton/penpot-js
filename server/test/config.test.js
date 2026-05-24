import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { config, flagEnabled } from '../src/config/index.js';

describe('config', () => {
  it('is a frozen object', () => {
    assert.ok(Object.isFrozen(config));
  });

  it('has database config', () => {
    assert.ok(config.database);
    assert.ok(typeof config.database.path === 'string');
  });

  it('has http config', () => {
    assert.ok(config.http);
    assert.ok(typeof config.http.port === 'number');
  });

  it('has auth config', () => {
    assert.ok(config.auth);
    assert.ok(typeof config.auth.secretKey === 'string');
  });

  it('has smtp config', () => {
    assert.ok(config.smtp);
    assert.equal(typeof config.smtp.enabled, 'boolean');
  });

  it('has telemetry config', () => {
    assert.ok(config.telemetry);
    assert.ok(typeof config.telemetry.uri === 'string');
  });

  it('has storage config', () => {
    assert.ok(config.storage);
  });
});

describe('flagEnabled', () => {
  it('registration is enabled by default', () => {
    assert.equal(flagEnabled('registration'), true);
  });

  it('login_with_password is enabled by default', () => {
    assert.equal(flagEnabled('login-with-password'), true);
  });

  it('telemetry is disabled by default', () => {
    assert.equal(flagEnabled('telemetry'), false);
  });

  it('unknown flags are false', () => {
    assert.equal(flagEnabled('nonexistent-flag'), false);
  });

  it('accepts hyphenated flag names', () => {
    assert.equal(flagEnabled('login-with-password'), flagEnabled('login_with_password'));
  });
});