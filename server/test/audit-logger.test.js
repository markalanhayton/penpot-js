import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { submit, submitFromRpc, archiveTask, gcTask } from '../src/loggers/audit.js';

describe('submit', () => {
  let pool;
  let profileId;

  beforeEach(() => {
    pool = createTestPool();
    const seed = seedFullHierarchy(pool);
    profileId = seed.profileId;
  });
  afterEach(() => { destroyTestPool(pool); });

  it('inserts an audit event into audit_log', async () => {
    await submit(pool, { type: 'login', profileId, ipAddr: '127.0.0.1' });

    const rows = pool.query('SELECT * FROM audit_log');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, 'login');
    assert.equal(rows[0].profile_id, profileId);
    assert.equal(rows[0].ip_addr, '127.0.0.1');
  });

  it('defaults type to custom when not provided', async () => {
    await submit(pool, { profileId, name: 'test-event' });

    const rows = pool.query('SELECT * FROM audit_log');
    assert.equal(rows[0].type, 'custom');
    assert.equal(rows[0].name, 'test-event');
  });

  it('sets tracked_at and created_at', async () => {
    await submit(pool, { type: 'test', profileId });

    const rows = pool.query('SELECT tracked_at, created_at FROM audit_log');
    assert.ok(rows[0].tracked_at);
    assert.ok(rows[0].created_at);
  });

  it('stores event data as props JSON', async () => {
    await submit(pool, { type: 'test', profileId, data: { key: 'value' } });

    const rows = pool.query('SELECT props FROM audit_log');
    const props = JSON.parse(rows[0].props);
    assert.equal(props.key, 'value');
  });

  it('does not throw on database errors (catches gracefully)', async () => {
    await submit(pool, { type: 'test', profileId: null });
    assert.ok(true, 'should not throw — error is caught internally');
  });
});

describe('submitFromRpc', () => {
  let pool;
  let profileId;

  beforeEach(() => {
    pool = createTestPool();
    const seed = seedFullHierarchy(pool);
    profileId = seed.profileId;
  });
  afterEach(() => { destroyTestPool(pool); });

  it('extracts context from RPC ctx', async () => {
    const ctx = { profileId, ipAddr: '10.0.0.1', userAgent: 'TestBot' };
    await submitFromRpc(pool, 'update-file', {}, ctx, { fileId: 'f1' });

    const rows = pool.query('SELECT * FROM audit_log');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, 'update-file');
    assert.equal(rows[0].profile_id, profileId);
  });
});

describe('archiveTask', () => {
  let pool;

  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('returns 0 when no archive URI is set', async () => {
    delete process.env.PENPOT_AUDIT_LOG_ARCHIVE_URI;
    const count = await archiveTask(pool);
    assert.equal(count, 0);
  });
});

describe('gcTask', () => {
  let pool;
  let profileId;

  beforeEach(() => {
    pool = createTestPool();
    const seed = seedFullHierarchy(pool);
    profileId = seed.profileId;
  });
  afterEach(() => { destroyTestPool(pool); });

  it('deletes archived audit log entries', async () => {
    const now = new Date().toISOString();
    pool.run("INSERT INTO audit_log (id, profile_id, type, name, created_at, archived_at) VALUES (?, ?, ?, ?, ?, ?)",
      ['al-1', profileId, 'login', 'login', now, now]);
    pool.run("INSERT INTO audit_log (id, profile_id, type, name, created_at) VALUES (?, ?, ?, ?, ?)",
      ['al-2', profileId, 'logout', 'logout', now]);

    const deleted = await gcTask(pool);
    assert.equal(deleted, 1);

    const remaining = pool.query('SELECT id FROM audit_log');
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, 'al-2');
  });

  it('returns 0 when no archived entries exist', async () => {
    const deleted = await gcTask(pool);
    assert.equal(deleted, 0);
  });
});