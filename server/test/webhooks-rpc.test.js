import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { RpcError } from '../src/rpc/dispatcher.js';
import registerWebhooksCommands from '../src/rpc/webhooks.js';

function captureHandlers(pool) {
  const handlers = {};
  const register = (name, def) => { handlers[name] = def.handler; };
  registerWebhooksCommands(register, pool);
  return handlers;
}

describe('rpc/webhooks — create-webhook', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('creates a webhook for a team', async () => {
    const result = await handlers['create-webhook'](
      { teamId: ids.teamId, uri: 'https://example.com/hook', mtype: 'application/json' },
      { profileId: ids.profileId }
    );
    assert.ok(result.id);
    assert.equal(result.uri, 'https://example.com/hook');
    assert.equal(result.isActive, true);

    const row = pool.get('SELECT * FROM webhook WHERE team_id = ?', [ids.teamId]);
    assert.ok(row);
  });

  it('rejects invalid mtype', async () => {
    await assert.rejects(
      () => handlers['create-webhook'](
        { teamId: ids.teamId, uri: 'https://x.com/h', mtype: 'text/plain' },
        { profileId: ids.profileId }
      ),
      { type: 'validation' }
    );
  });

  it('rejects missing uri', async () => {
    await assert.rejects(
      () => handlers['create-webhook'](
        { teamId: ids.teamId, uri: '', mtype: 'application/json' },
        { profileId: ids.profileId }
      ),
      { type: 'validation' }
    );
  });

  it('rejects non-admin/non-owner', async () => {
    const now = new Date().toISOString();
    const memberId = 'member-1';
    pool.insertReturning('profile', {
      id: memberId, fullname: 'Member', email: 'member@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: memberId,
      is_owner: '0', is_admin: '0', can_edit: '1', is_member: '1',
      created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['create-webhook'](
        { teamId: ids.teamId, uri: 'https://x.com/h', mtype: 'application/json' },
        { profileId: memberId }
      ),
      { type: 'authorization' }
    );
  });

  it('enforces max webhooks per team', async () => {
    for (let i = 0; i < 8; i++) {
      await handlers['create-webhook'](
        { teamId: ids.teamId, uri: `https://x.com/h${i}`, mtype: 'application/json' },
        { profileId: ids.profileId }
      );
    }

    await assert.rejects(
      () => handlers['create-webhook'](
        { teamId: ids.teamId, uri: 'https://x.com/h9', mtype: 'application/json' },
        { profileId: ids.profileId }
      ),
      { type: 'restriction' }
    );
  });
});

describe('rpc/webhooks — get-webhooks', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns webhooks for a team', async () => {
    await handlers['create-webhook'](
      { teamId: ids.teamId, uri: 'https://x.com/h1', mtype: 'application/json' },
      { profileId: ids.profileId }
    );
    await handlers['create-webhook'](
      { teamId: ids.teamId, uri: 'https://x.com/h2', mtype: 'application/transit+json' },
      { profileId: ids.profileId }
    );

    const webhooks = await handlers['get-webhooks'](
      { teamId: ids.teamId },
      { profileId: ids.profileId }
    );
    assert.equal(webhooks.length, 2);
    assert.equal(webhooks[0].teamId, ids.teamId);
    assert.equal(webhooks[1].teamId, ids.teamId);
  });
});

describe('rpc/webhooks — update-webhook', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('updates webhook uri and mtype', async () => {
    const created = await handlers['create-webhook'](
      { teamId: ids.teamId, uri: 'https://x.com/old', mtype: 'application/json' },
      { profileId: ids.profileId }
    );

    const updated = await handlers['update-webhook'](
      { id: created.id, uri: 'https://x.com/new', mtype: 'application/transit+json' },
      { profileId: ids.profileId }
    );
    assert.equal(updated.uri, 'https://x.com/new');
    assert.equal(updated.mtype, 'application/transit+json');
  });

  it('rejects invalid mtype on update', async () => {
    const created = await handlers['create-webhook'](
      { teamId: ids.teamId, uri: 'https://x.com/h', mtype: 'application/json' },
      { profileId: ids.profileId }
    );

    await assert.rejects(
      () => handlers['update-webhook'](
        { id: created.id, mtype: 'text/html' },
        { profileId: ids.profileId }
      ),
      { type: 'validation' }
    );
  });
});

describe('rpc/webhooks — delete-webhook', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('deletes a webhook', async () => {
    const created = await handlers['create-webhook'](
      { teamId: ids.teamId, uri: 'https://x.com/h', mtype: 'application/json' },
      { profileId: ids.profileId }
    );

    await handlers['delete-webhook']({ id: created.id }, { profileId: ids.profileId });

    const row = pool.get('SELECT * FROM webhook WHERE id = ?', [created.id]);
    assert.equal(row, undefined);
  });

  it('throws not-found for missing webhook', async () => {
    await assert.rejects(
      () => handlers['delete-webhook']({ id: 'nonexistent' }, { profileId: ids.profileId }),
      { type: 'not-found' }
    );
  });

  it('throws authorization when non-admin deletes', async () => {
    const created = await handlers['create-webhook'](
      { teamId: ids.teamId, uri: 'https://x.com/h', mtype: 'application/json' },
      { profileId: ids.profileId }
    );

    const now = new Date().toISOString();
    const memberId = 'member-del';
    pool.insertReturning('profile', {
      id: memberId, fullname: 'Member', email: 'member-del@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: memberId,
      is_owner: '0', is_admin: '0', can_edit: '1', is_member: '1',
      created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['delete-webhook']({ id: created.id }, { profileId: memberId }),
      { type: 'authorization' }
    );
  });
});

describe('rpc/webhooks — update-webhook edge cases', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('throws not-found for missing webhook', async () => {
    await assert.rejects(
      () => handlers['update-webhook'](
        { id: 'nonexistent', uri: 'https://x.com/new' },
        { profileId: ids.profileId }
      ),
      { type: 'not-found' }
    );
  });

  it('throws authorization when non-admin updates', async () => {
    const created = await handlers['create-webhook'](
      { teamId: ids.teamId, uri: 'https://x.com/h', mtype: 'application/json' },
      { profileId: ids.profileId }
    );

    const now = new Date().toISOString();
    const memberId = 'member-upd';
    pool.insertReturning('profile', {
      id: memberId, fullname: 'Member', email: 'member-upd@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: memberId,
      is_owner: '0', is_admin: '0', can_edit: '1', is_member: '1',
      created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['update-webhook'](
        { id: created.id, uri: 'https://x.com/new' },
        { profileId: memberId }
      ),
      { type: 'authorization' }
    );
  });

  it('toggles webhook active status', async () => {
    const created = await handlers['create-webhook'](
      { teamId: ids.teamId, uri: 'https://x.com/h', mtype: 'application/json' },
      { profileId: ids.profileId }
    );

    const updated = await handlers['update-webhook'](
      { id: created.id, isActive: false },
      { profileId: ids.profileId }
    );
    assert.equal(updated.isActive, false);

    const row = pool.get('SELECT is_active FROM webhook WHERE id = ?', [created.id]);
    assert.equal(row.is_active, '0');
  });

  it('clears error fields on successful update', async () => {
    const created = await handlers['create-webhook'](
      { teamId: ids.teamId, uri: 'https://x.com/h', mtype: 'application/json' },
      { profileId: ids.profileId }
    );

    pool.run('UPDATE webhook SET error_code = ?, error_count = ? WHERE id = ?', [500, 3, created.id]);

    await handlers['update-webhook'](
      { id: created.id, uri: 'https://x.com/updated' },
      { profileId: ids.profileId }
    );

    const row = pool.get('SELECT error_code, error_count FROM webhook WHERE id = ?', [created.id]);
    assert.equal(row.error_code, null);
    assert.equal(row.error_count, 0);
  });
});

describe('rpc/webhooks — get-webhooks edge cases', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns empty array for team with no webhooks', async () => {
    const result = await handlers['get-webhooks'](
      { teamId: ids.teamId },
      { profileId: ids.profileId }
    );
    assert.deepEqual(result, []);
  });

  it('throws authorization for non-member', async () => {
    const now = new Date().toISOString();
    const outsiderId = 'outsider-wh';
    pool.insertReturning('profile', {
      id: outsiderId, fullname: 'Outsider', email: 'outsider-wh@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['get-webhooks']({ teamId: ids.teamId }, { profileId: outsiderId }),
      { type: 'authorization' }
    );
  });

  it('returns isActive as boolean', async () => {
    await handlers['create-webhook'](
      { teamId: ids.teamId, uri: 'https://x.com/h', mtype: 'application/json' },
      { profileId: ids.profileId }
    );

    const result = await handlers['get-webhooks'](
      { teamId: ids.teamId },
      { profileId: ids.profileId }
    );
    assert.equal(result.length, 1);
    assert.equal(typeof result[0].isActive, 'boolean');
    assert.equal(result[0].isActive, true);
  });
});