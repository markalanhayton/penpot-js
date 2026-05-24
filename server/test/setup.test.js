import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool } from './helpers.js';
import { runSetup, createWelcomeFile, getInstanceProp, setInstanceProp } from '../src/setup/index.js';

describe('runSetup', () => {
  let savedAdminEmail;
  let savedAdminPassword;

  beforeEach(() => {
    savedAdminEmail = process.env.PENPOT_INITIAL_ADMIN_EMAIL;
    savedAdminPassword = process.env.PENPOT_INITIAL_ADMIN_PASSWORD;
    delete process.env.PENPOT_INITIAL_ADMIN_EMAIL;
    delete process.env.PENPOT_INITIAL_ADMIN_PASSWORD;
  });

  afterEach(() => {
    if (savedAdminEmail !== undefined) process.env.PENPOT_INITIAL_ADMIN_EMAIL = savedAdminEmail;
    else delete process.env.PENPOT_INITIAL_ADMIN_EMAIL;
    if (savedAdminPassword !== undefined) process.env.PENPOT_INITIAL_ADMIN_PASSWORD = savedAdminPassword;
    else delete process.env.PENPOT_INITIAL_ADMIN_PASSWORD;
  });

  it('creates instance ID and returns it', async () => {
    const pool = createTestPool();
    const { instanceId, adminCreated } = await runSetup(pool);
    assert.ok(instanceId);
    assert.ok(typeof instanceId === 'string');
    assert.equal(adminCreated, false);
    destroyTestPool(pool);
  });

  it('returns same instance ID on second call', async () => {
    const pool = createTestPool();
    const first = await runSetup(pool);
    const second = await runSetup(pool);
    assert.equal(first.instanceId, second.instanceId);
    destroyTestPool(pool);
  });
});

describe('getInstanceProp / setInstanceProp', () => {
  it('sets and gets a property', () => {
    const pool = createTestPool();
    setInstanceProp(pool, 'test-key', 'test-value');
    assert.equal(getInstanceProp(pool, 'test-key'), 'test-value');
    destroyTestPool(pool);
  });

  it('returns null for missing property', () => {
    const pool = createTestPool();
    assert.equal(getInstanceProp(pool, 'nonexistent'), null);
    destroyTestPool(pool);
  });

  it('overwrites existing property', () => {
    const pool = createTestPool();
    setInstanceProp(pool, 'key1', 'val1');
    setInstanceProp(pool, 'key1', 'val2');
    assert.equal(getInstanceProp(pool, 'key1'), 'val2');
    destroyTestPool(pool);
  });
});

describe('createWelcomeFile', () => {
  it('does not throw for profile without project', () => {
    const pool = createTestPool();
    createWelcomeFile(pool, 'nonexistent-id', 'Test');
    destroyTestPool(pool);
  });
});