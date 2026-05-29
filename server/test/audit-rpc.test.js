import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { flagEnabled, mergedFlags } from '../src/config/index.js';
import registerAuditCommands from '../src/rpc/audit.js';

function captureHandlers(pool) {
  const handlers = {};
  const register = (name, def) => { handlers[name] = def.handler; };
  registerAuditCommands(register, pool);
  return handlers;
}

const auditEnabled = flagEnabled('audit-log');
const telemetryEnabled = flagEnabled('telemetry');
const eitherEnabled = auditEnabled || telemetryEnabled;

describe('rpc/audit — push-audit-events', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns null when events is not an array', async () => {
    const result = await handlers['push-audit-events'](
      { events: null },
      { profileId: ids.profileId, requestAt: new Date() }
    );
    assert.equal(result, null);
  });

  it('returns null when events is empty array', async () => {
    const result = await handlers['push-audit-events'](
      { events: [] },
      { profileId: ids.profileId, requestAt: new Date() }
    );
    assert.equal(result, null);
  });

  it('returns null even when flags disabled and valid events provided', async () => {
    const events = [{ type: 'action', name: 'test-event' }];
    const result = await handlers['push-audit-events'](
      { events },
      { profileId: ids.profileId, requestAt: new Date(), ipAddr: null }
    );
    assert.equal(result, null);
  });

  it('skips events missing type or name', async () => {
    if (!eitherEnabled) return;
    const events = [
      { type: 'action', name: 'valid-event' },
      { type: 'action' },
      { name: 'no-type' },
      {},
    ];
    await handlers['push-audit-events'](
      { events },
      { profileId: ids.profileId, requestAt: new Date(), ipAddr: '127.0.0.1' }
    );

    const rows = pool.query('SELECT * FROM audit_log WHERE profile_id = ?', [ids.profileId]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'valid-event');
  });

  it('persists audit events when flags enabled', async () => {
    if (!eitherEnabled) return;
    const events = [
      { type: 'action', name: 'create-file', source: 'frontend', trackedAt: new Date().toISOString() },
    ];
    await handlers['push-audit-events'](
      { events },
      { profileId: ids.profileId, requestAt: new Date(), ipAddr: '127.0.0.1' }
    );

    const rows = pool.query('SELECT * FROM audit_log WHERE profile_id = ?', [ids.profileId]);
    assert.ok(rows.length >= 1);
    assert.equal(rows[0].name, 'create-file');
    assert.equal(rows[0].source, 'frontend');
    assert.equal(rows[0].type, 'action');
  });

  it('stores event props and context as JSON', async () => {
    if (!eitherEnabled) return;
    const events = [{
      type: 'action',
      name: 'update-shape',
      source: 'frontend',
      props: { shapeType: 'rect' },
      context: { fileId: 'abc123' },
    }];
    await handlers['push-audit-events'](
      { events },
      { profileId: ids.profileId, requestAt: new Date(), ipAddr: '127.0.0.1' }
    );

    const row = pool.get('SELECT * FROM audit_log WHERE name = ? AND profile_id = ?', ['update-shape', ids.profileId]);
    assert.ok(row);
    const parsedProps = JSON.parse(row.props);
    assert.equal(parsedProps.shapeType, 'rect');
    const parsedContext = JSON.parse(row.context);
    assert.equal(parsedContext.fileId, 'abc123');
  });

  it('uses requestAt as fallback timestamp when trackedAt missing', async () => {
    if (!eitherEnabled) return;
    const requestAt = new Date('2026-01-15T10:30:00.000Z');
    const events = [{
      type: 'action',
      name: 'no-timestamp-event',
      source: 'frontend',
    }];
    await handlers['push-audit-events'](
      { events },
      { profileId: ids.profileId, requestAt, ipAddr: null }
    );

    const row = pool.get('SELECT tracked_at FROM audit_log WHERE name = ?', ['no-timestamp-event']);
    assert.ok(row);
    assert.ok(row.tracked_at.includes('2026-01-15'));
  });

  it('defaults source to frontend when not provided', async () => {
    if (!eitherEnabled) return;
    const events = [{
      type: 'action',
      name: 'default-source-event',
    }];
    await handlers['push-audit-events'](
      { events },
      { profileId: ids.profileId, requestAt: new Date(), ipAddr: null }
    );

    const row = pool.get('SELECT source FROM audit_log WHERE name = ?', ['default-source-event']);
    assert.ok(row);
    assert.equal(row.source, 'frontend');
  });

  it('persists multiple events in a single call', async () => {
    if (!eitherEnabled) return;
    const events = [
      { type: 'action', name: 'event-a' },
      { type: 'navigation', name: 'event-b' },
      { type: 'interaction', name: 'event-c' },
    ];
    await handlers['push-audit-events'](
      { events },
      { profileId: ids.profileId, requestAt: new Date(), ipAddr: null }
    );

    const rows = pool.query('SELECT * FROM audit_log WHERE profile_id = ?', [ids.profileId]);
    assert.equal(rows.length, 3);
  });
});

describe('rpc/audit — get-enabled-flags', () => {
  let pool;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns public feature flags as an object', async () => {
    const result = await handlers['get-enabled-flags']({}, {});
    assert.ok(typeof result === 'object');
    assert.ok('registration' in result);
    assert.ok('login_with_password' in result);
  });

  it('returns boolean values for each flag', async () => {
    const result = await handlers['get-enabled-flags']({}, {});
    for (const [key, val] of Object.entries(result)) {
      assert.equal(typeof val, 'boolean', `Flag ${key} should be boolean, got ${typeof val}`);
    }
  });

  it('includes all public OAuth flags', async () => {
    const result = await handlers['get-enabled-flags']({}, {});
    assert.ok('login_with_oidc' in result);
    assert.ok('login_with_google' in result);
    assert.ok('login_with_github' in result);
    assert.ok('login_with_gitlab' in result);
  });

  it('does not include internal-only flags', async () => {
    const result = await handlers['get-enabled-flags']({}, {});
    assert.ok(!('backend_internal' in result));
    assert.ok(!('fdata/pointer-map' in result));
  });

  it('does not require authentication (no profileId needed)', async () => {
    const result = await handlers['get-enabled-flags']({}, {});
    assert.ok(result);
  });

  it('includes telemetry flag', async () => {
    const result = await handlers['get-enabled-flags']({}, {});
    assert.ok('telemetry' in result);
  });
});