import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { RpcError } from '../src/rpc/dispatcher.js';
import registerProfileCommands from '../src/rpc/profile.js';

function captureHandlers(pool) {
  const handlers = {};
  const register = (name, def) => { handlers[name] = def.handler; };
  registerProfileCommands(register, pool);
  return handlers;
}

describe('rpc/profile — get-profile', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns profile for authenticated user', async () => {
    const profile = await handlers['get-profile']({}, { profileId: ids.profileId });
    assert.ok(profile);
    assert.equal(profile.id, ids.profileId);
  });

  it('returns null without profileId', async () => {
    const profile = await handlers['get-profile']({}, {});
    assert.equal(profile, null);
  });
});

describe('rpc/profile — update-profile', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('updates fullname and lang', async () => {
    const result = await handlers['update-profile'](
      { fullname: 'Updated Name', lang: 'es' },
      { profileId: ids.profileId }
    );
    assert.equal(result.fullname, 'Updated Name');
    assert.equal(result.lang, 'es');
  });

  it('only updates provided fields', async () => {
    const before = await handlers['get-profile']({}, { profileId: ids.profileId });
    const result = await handlers['update-profile'](
      { theme: 'dark' },
      { profileId: ids.profileId }
    );
    assert.equal(result.theme, 'dark');
    assert.equal(result.fullname, before.fullname);
  });
});

describe('rpc/profile — delete-profile', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('soft-deletes profile and deactivates sessions', async () => {
    const now = new Date().toISOString();
    pool.run(
      'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      ['sess-1', ids.profileId, 'test', now, now, '1']
    );

    await handlers['delete-profile']({}, { profileId: ids.profileId });

    const profile = pool.get('SELECT deleted_at, is_active FROM profile WHERE id = ?', [ids.profileId]);
    assert.ok(profile.deleted_at);
    assert.equal(profile.is_active, '0');

    const session = pool.get('SELECT is_active FROM http_session WHERE id = ?', ['sess-1']);
    assert.equal(session.is_active, '0');
  });
});

describe('rpc/profile — delete-profile-photo', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('sets photo_id to null', async () => {
    const now = new Date().toISOString();
    pool.run('INSERT INTO storage_object (id, created_at, size, backend, touched_at) VALUES (?, ?, 0, ?, ?)', ['so-photo', now, 'fs', now]);
    pool.run('UPDATE profile SET photo_id = ? WHERE id = ?', ['so-photo', ids.profileId]);

    await handlers['delete-profile-photo']({}, { profileId: ids.profileId });

    const profile = pool.get('SELECT photo_id FROM profile WHERE id = ?', [ids.profileId]);
    assert.equal(profile.photo_id, null);
  });
});

describe('rpc/profile — update-profile-props', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('stores allowed props and returns them', async () => {
    const result = await handlers['update-profile-props'](
      { props: { renderer: 'skia', 'v2-info-shown': true } },
      { profileId: ids.profileId }
    );
    assert.equal(result.renderer, 'skia');
    assert.equal(result['v2-info-shown'], true);
  });

  it('ignores disallowed keys', async () => {
    const result = await handlers['update-profile-props'](
      { props: { renderer: 'canvas', evilKey: 'hack' } },
      { profileId: ids.profileId }
    );
    assert.equal(result.renderer, 'canvas');
    assert.equal(result.evilKey, undefined);
  });

  it('deletes props set to null', async () => {
    await handlers['update-profile-props'](
      { props: { renderer: 'skia' } },
      { profileId: ids.profileId }
    );
    const result = await handlers['update-profile-props'](
      { props: { renderer: null } },
      { profileId: ids.profileId }
    );
    assert.equal(result.renderer, undefined);
  });

  it('rejects non-object props', async () => {
    await assert.rejects(
      () => handlers['update-profile-props'](
        { props: 'invalid' },
        { profileId: ids.profileId }
      ),
      { type: 'validation' }
    );
  });
});

describe('rpc/profile — request-email-change', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('rejects missing email', async () => {
    await assert.rejects(
      () => handlers['request-email-change']({}, { profileId: ids.profileId }),
      { type: 'validation' }
    );
  });

  it('rejects already-existing email', async () => {
    await assert.rejects(
      () => handlers['request-email-change'](
        { email: 'test@example.com' },
        { profileId: ids.profileId }
      ),
      { type: 'validation' }
    );
  });

  it('changes email directly when SMTP is disabled', async () => {
    delete process.env.PENPOT_SMTP_ENABLED;
    delete process.env.PENPOT_SMTP_HOST;

    const result = await handlers['request-email-change'](
      { email: 'newemail@example.com' },
      { profileId: ids.profileId }
    );
    assert.equal(result.changed, true);

    const profile = pool.get('SELECT email FROM profile WHERE id = ?', [ids.profileId]);
    assert.equal(profile.email, 'newemail@example.com');
  });
});

describe('rpc/profile — update-profile-notifications', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('updates notification preferences in props', async () => {
    await handlers['update-profile-notifications'](
      { dashboardComments: 'mentions', emailComments: 'none', emailInvites: 'all' },
      { profileId: ids.profileId }
    );

    const profile = pool.get('SELECT props FROM profile WHERE id = ?', [ids.profileId]);
    const props = JSON.parse(profile.props);
    assert.equal(props.notifications.dashboardComments, 'mentions');
    assert.equal(props.notifications.emailComments, 'none');
  });
});

describe('rpc/profile — get-subscription-usage', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns editors list for owned teams', async () => {
    const result = await handlers['get-subscription-usage'](
      {},
      { profileId: ids.profileId }
    );
    assert.ok(result.editors);
    assert.ok(Array.isArray(result.editors));
  });
});