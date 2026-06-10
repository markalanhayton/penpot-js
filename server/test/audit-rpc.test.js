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

describe('rpc/audit — get-audit-events', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  async function pushEvents(events) {
    return handlers['push-audit-events'](
      { events },
      { profileId: ids.profileId, requestAt: new Date(), ipAddr: '127.0.0.1' }
    );
  }

  if (!eitherEnabled) {
    it('returns empty result when audit-log flag is disabled', async () => {
      const result = await handlers['get-audit-events']({}, {});
      assert.deepEqual(result, { events: [], total: 0 });
    });
    return;
  }

  async function seedSampleEvents() {
    const now = Date.now();
    const iso = (offsetMs) => new Date(now + offsetMs).toISOString();
    await pushEvents([
      { type: 'action', name: 'create-file', source: 'frontend', trackedAt: iso(-10000) },
      { type: 'action', name: 'update-shape', source: 'frontend', trackedAt: iso(-8000), props: { shapeType: 'rect' } },
      { type: 'navigation', name: 'open-workspace', source: 'frontend', trackedAt: iso(-6000) },
      { type: 'action', name: 'delete-shape', source: 'backend', trackedAt: iso(-4000) },
    ]);
  }

  it('returns events and total count for unfiltered query', async () => {
    await seedSampleEvents();
    const result = await handlers['get-audit-events']({}, { profileId: ids.profileId });
    assert.equal(result.total, 4);
    assert.equal(result.events.length, 4);
    assert.equal(result.events[0].name, 'delete-shape');
    assert.equal(result.events[3].name, 'create-file');
  });

  it('returns camelCased fields with parsed props/context JSON', async () => {
    await pushEvents([{
      type: 'action', name: 'update-shape', source: 'frontend',
      props: { shapeType: 'rect' }, context: { fileId: 'abc123' },
    }]);
    const result = await handlers['get-audit-events']({}, { profileId: ids.profileId });
    const event = result.events[0];
    assert.ok(event.trackedAt, 'camelCased trackedAt present');
    assert.ok(event.profileId, 'camelCased profileId present');
    assert.equal(event.props.shapeType, 'rect');
    assert.equal(event.context.fileId, 'abc123');
  });

  it('filters by profileId', async () => {
    await pushEvents([{ type: 'action', name: 'evt-a' }]);
    const otherPid = '11111111-1111-1111-1111-111111111111';
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: otherPid, fullname: 'Other', email: 'other@example.com', password: '!',
      is_active: '1', is_demo: '0', is_blocked: '0', auth_source: 'password',
      created_at: now, modified_at: now,
    });
    await handlers['push-audit-events'](
      { events: [{ type: 'action', name: 'evt-b' }] },
      { profileId: otherPid, requestAt: new Date(), ipAddr: null }
    );
    const result = await handlers['get-audit-events']({ profileId: ids.profileId }, { profileId: ids.profileId });
    assert.equal(result.total, 1);
    assert.equal(result.events[0].name, 'evt-a');
  });

  it('filters by eventType', async () => {
    await seedSampleEvents();
    const result = await handlers['get-audit-events']({ eventType: 'action' }, { profileId: ids.profileId });
    assert.equal(result.total, 3);
    assert.ok(result.events.every(e => e.type === 'action'));
  });

  it('filters by eventName', async () => {
    await seedSampleEvents();
    const result = await handlers['get-audit-events']({ eventName: 'create-file' }, { profileId: ids.profileId });
    assert.equal(result.total, 1);
    assert.equal(result.events[0].name, 'create-file');
  });

  it('filters by source', async () => {
    await seedSampleEvents();
    const result = await handlers['get-audit-events']({ source: 'backend' }, { profileId: ids.profileId });
    assert.equal(result.total, 1);
    assert.equal(result.events[0].name, 'delete-shape');
  });

  it('filters by from/to date range', async () => {
    await seedSampleEvents();
    const now = Date.now();
    const result = await handlers['get-audit-events']({
      from: new Date(now - 7000).toISOString(),
      to: new Date(now - 5000).toISOString(),
    }, { profileId: ids.profileId });
    assert.equal(result.total, 1);
    assert.equal(result.events[0].name, 'open-workspace');
  });

  it('filters by teamId via team_profile_rel', async () => {
    await pushEvents([{ type: 'action', name: 'team-evt' }]);
    const otherTeam = '22222222-2222-2222-2222-222222222222';
    const otherProfile = '33333333-3333-3333-3333-333333333333';
    const now = new Date().toISOString();
    pool.insertReturning('team', {
      id: otherTeam, name: 'Other Team', is_default: '0', features: '[]',
      created_at: now, modified_at: now,
    });
    pool.insertReturning('profile', {
      id: otherProfile, fullname: 'Outside', email: 'outside@example.com', password: '!',
      is_active: '1', is_demo: '0', is_blocked: '0', auth_source: 'password',
      created_at: now, modified_at: now,
    });
    await handlers['push-audit-events'](
      { events: [{ type: 'action', name: 'other-team-evt' }] },
      { profileId: otherProfile, requestAt: new Date(), ipAddr: null }
    );
    const result = await handlers['get-audit-events']({ teamId: ids.teamId }, { profileId: ids.profileId });
    assert.equal(result.total, 1);
    assert.equal(result.events[0].name, 'team-evt');
  });

  it('respects pagination (limit + offset)', async () => {
    await seedSampleEvents();
    const page1 = await handlers['get-audit-events']({ limit: 2, offset: 0 }, { profileId: ids.profileId });
    assert.equal(page1.total, 4);
    assert.equal(page1.events.length, 2);
    assert.equal(page1.events[0].name, 'delete-shape');
    assert.equal(page1.events[1].name, 'open-workspace');

    const page2 = await handlers['get-audit-events']({ limit: 2, offset: 2 }, { profileId: ids.profileId });
    assert.equal(page2.events.length, 2);
    assert.equal(page2.events[0].name, 'update-shape');
    assert.equal(page2.events[1].name, 'create-file');
  });

  it('clamps limit to a max of 200', async () => {
    await seedSampleEvents();
    const result = await handlers['get-audit-events']({ limit: 99999 }, { profileId: ids.profileId });
    assert.ok(result.events.length <= 200);
  });

  it('excludes archived events by default and includes them when includeArchived=true', async () => {
    await pushEvents([{ type: 'action', name: 'live' }]);
    await pushEvents([{ type: 'action', name: 'archived' }]);
    pool.db.prepare('UPDATE audit_log SET archived_at = ? WHERE name = ?').run(new Date().toISOString(), 'archived');

    const def = await handlers['get-audit-events']({}, { profileId: ids.profileId });
    assert.equal(def.total, 1);
    assert.equal(def.events[0].name, 'live');

    const all = await handlers['get-audit-events']({ includeArchived: true }, { profileId: ids.profileId });
    assert.equal(all.total, 2);
  });

  it('returns empty array when no events match', async () => {
    const result = await handlers['get-audit-events']({ eventName: 'nonexistent' }, { profileId: ids.profileId });
    assert.equal(result.total, 0);
    assert.deepEqual(result.events, []);
  });
});