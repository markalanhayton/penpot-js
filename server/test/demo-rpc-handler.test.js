import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { flagEnabled } from '../src/config/index.js';
import registerDemoCommands from '../src/rpc/demo.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

describe('Demo RPC — create-demo-profile', () => {
  let pool;
  let dispatcher;

  beforeEach(() => {
    pool = createTestPool();
    seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerDemoCommands(dispatcher.register, pool);
  });

  afterEach(() => {
    destroyTestPool(pool);
  });

  it('throws demo-users-not-allowed when demo-users flag is not enabled', async () => {
    if (flagEnabled('demo-users')) return;

    const handler = dispatcher.methods.get('create-demo-profile').handler;
    await assert.rejects(
      () => handler({}, {}),
      { code: 'demo-users-not-allowed' }
    );
  });

  it('creates a demo profile with email and password when flag is enabled', async () => {
    if (!flagEnabled('demo-users')) return;

    const handler = dispatcher.methods.get('create-demo-profile').handler;
    const result = await handler({}, {});

    assert.ok(result.email);
    assert.ok(result.password);
    assert.ok(result.email.startsWith('demo-'));
    assert.ok(result.email.includes('@example.com'));
  });

  it('inserts the demo profile into the database with is_demo flag', async () => {
    if (!flagEnabled('demo-users')) return;

    const handler = dispatcher.methods.get('create-demo-profile').handler;
    const result = await handler({}, {});

    const profile = pool.get('SELECT * FROM profile WHERE email = ?', [result.email]);
    assert.ok(profile);
    assert.equal(profile.is_demo, '1');
    assert.equal(profile.is_active, '1');
    assert.ok(profile.deleted_at);
  });

  it('adds the demo profile to the default team', async () => {
    if (!flagEnabled('demo-users')) return;

    const handler = dispatcher.methods.get('create-demo-profile').handler;
    const result = await handler({}, {});

    const profile = pool.get('SELECT * FROM profile WHERE email = ?', [result.email]);
    const rel = pool.get(
      'SELECT * FROM team_profile_rel WHERE profile_id = ? AND is_admin = ?',
      [profile.id, '1']
    );
    assert.ok(rel);
  });

  it('sets deleted_at in the future based on PENPOT_DELETION_DELAY', async () => {
    if (!flagEnabled('demo-users')) return;

    process.env.PENPOT_DELETION_DELAY = '3600';

    const handler = dispatcher.methods.get('create-demo-profile').handler;
    const result = await handler({}, {});

    const profile = pool.get('SELECT * FROM profile WHERE email = ?', [result.email]);
    assert.ok(profile.deleted_at);
    const deletedAt = new Date(profile.deleted_at).getTime();
    const now = Date.now();
    assert.ok(deletedAt > now, 'deleted_at should be in the future');

    delete process.env.PENPOT_DELETION_DELAY;
  });
});