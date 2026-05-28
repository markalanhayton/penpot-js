import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import registerProfileCommands from '../src/rpc/profile.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

describe('Profile RPC — delete-profile', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProfileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('soft-deletes profile by setting deleted_at and is_active=0', async () => {
    const handler = dispatcher.methods.get('delete-profile').handler;
    const result = await handler({}, { profileId: ids.profileId });
    assert.equal(result.id, ids.profileId);

    const profile = pool.get('SELECT * FROM profile WHERE id = ?', [ids.profileId]);
    assert.ok(profile.deleted_at);
    assert.equal(profile.is_active, '0');
  });

  it('deactivates all http_sessions for the profile', async () => {
    const now = new Date().toISOString();
    const sessionId = uuidv4();
    pool.run(
      'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, ids.profileId, 'test', now, now, '1']
    );

    const handler = dispatcher.methods.get('delete-profile').handler;
    await handler({}, { profileId: ids.profileId });

    const session = pool.get('SELECT * FROM http_session WHERE id = ?', [sessionId]);
    assert.equal(session.is_active, '0');
  });

  it('does not affect sessions of other profiles', async () => {
    const otherProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: otherProfileId, fullname: 'Other', email: 'other@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    const sessionId = uuidv4();
    pool.run(
      'INSERT INTO http_session (id, profile_id, user_agent, created_at, modified_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, otherProfileId, 'test', now, now, '1']
    );

    const handler = dispatcher.methods.get('delete-profile').handler;
    await handler({}, { profileId: ids.profileId });

    const session = pool.get('SELECT * FROM http_session WHERE id = ?', [sessionId]);
    assert.equal(session.is_active, '1');
  });
});

describe('Profile RPC — delete-profile-photo', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProfileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('sets photo_id to NULL on profile', async () => {
    const now = new Date().toISOString();
    const storageId = uuidv4();
    pool.insertOnConflictDoNothing('storage_object', {
      id: storageId, size: 100, backend: 'fs',
      content_type: 'image/jpeg', bucket: 'profile',
      created_at: now, metadata: '{}',
    });
    pool.run('UPDATE profile SET photo_id = ? WHERE id = ?', [storageId, ids.profileId]);

    const handler = dispatcher.methods.get('delete-profile-photo').handler;
    const result = await handler({}, { profileId: ids.profileId });
    assert.equal(result, null);

    const profile = pool.get('SELECT * FROM profile WHERE id = ?', [ids.profileId]);
    assert.equal(profile.photo_id, null);
  });

  it('returns null when profile has no photo', async () => {
    const handler = dispatcher.methods.get('delete-profile-photo').handler;
    const result = await handler({}, { profileId: ids.profileId });
    assert.equal(result, null);
  });

  it('returns null for deleted profile (still clears photo if exists)', async () => {
    const handler = dispatcher.methods.get('delete-profile-photo').handler;
    const result = await handler({}, { profileId: uuidv4() });
    assert.equal(result, null);
  });
});

describe('Profile RPC — update-profile-notifications', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProfileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('sets notification preferences in profile props', async () => {
    const handler = dispatcher.methods.get('update-profile-notifications').handler;
    const result = await handler({
      dashboardComments: 'none',
      emailComments: 'mentions',
      emailInvites: 'all',
    }, { profileId: ids.profileId });
    assert.equal(result, null);

    const profile = pool.get('SELECT * FROM profile WHERE id = ?', [ids.profileId]);
    const props = JSON.parse(profile.props);
    assert.equal(props.notifications.dashboardComments, 'none');
    assert.equal(props.notifications.emailComments, 'mentions');
    assert.equal(props.notifications.emailInvites, 'all');
  });

  it('defaults notification values to "all" when not provided', async () => {
    const handler = dispatcher.methods.get('update-profile-notifications').handler;
    await handler({}, { profileId: ids.profileId });

    const profile = pool.get('SELECT * FROM profile WHERE id = ?', [ids.profileId]);
    const props = JSON.parse(profile.props);
    assert.equal(props.notifications.dashboardComments, 'all');
    assert.equal(props.notifications.emailComments, 'all');
    assert.equal(props.notifications.emailInvites, 'all');
  });

  it('throws not-found for deleted profile', async () => {
    const now = new Date().toISOString();
    const deletedId = uuidv4();
    pool.insertReturning('profile', {
      id: deletedId, fullname: 'Deleted', email: 'deleted@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
      deleted_at: now,
    });

    const handler = dispatcher.methods.get('update-profile-notifications').handler;
    await assert.rejects(
      () => handler({ dashboardComments: 'none' }, { profileId: deletedId }),
      { code: 'object-not-found' }
    );
  });

  it('preserves existing props when updating notifications', async () => {
    pool.run('UPDATE profile SET props = ? WHERE id = ?', [JSON.stringify({ customKey: 'kept' }), ids.profileId]);

    const handler = dispatcher.methods.get('update-profile-notifications').handler;
    await handler({ dashboardComments: 'none' }, { profileId: ids.profileId });

    const profile = pool.get('SELECT * FROM profile WHERE id = ?', [ids.profileId]);
    const props = JSON.parse(profile.props);
    assert.equal(props.customKey, 'kept');
    assert.equal(props.notifications.dashboardComments, 'none');
  });
});

describe('Profile RPC — request-email-change', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProfileCommands(dispatcher.register, pool);
    delete process.env.PENPOT_SMTP_ENABLED;
    delete process.env.PENPOT_SMTP_HOST;
  });

  afterEach(() => {
    destroyTestPool(pool);
    delete process.env.PENPOT_SMTP_ENABLED;
    delete process.env.PENPOT_SMTP_HOST;
  });

  it('throws validation error when email is missing', async () => {
    const handler = dispatcher.methods.get('request-email-change').handler;
    await assert.rejects(
      () => handler({ email: '' }, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });

  it('throws validation error when email is already in use', async () => {
    const handler = dispatcher.methods.get('request-email-change').handler;
    await assert.rejects(
      () => handler({ email: 'test@example.com' }, { profileId: ids.profileId }),
      { code: 'email-already-exists' }
    );
  });

  it('changes email directly when SMTP is disabled', async () => {
    const handler = dispatcher.methods.get('request-email-change').handler;
    const result = await handler({ email: 'new@example.com' }, { profileId: ids.profileId });
    assert.equal(result.changed, true);

    const profile = pool.get('SELECT * FROM profile WHERE id = ?', [ids.profileId]);
    assert.equal(profile.email, 'new@example.com');
  });

  it('trims and lowercases the email', async () => {
    const handler = dispatcher.methods.get('request-email-change').handler;
    const result = await handler({ email: '  New@Example.COM  ' }, { profileId: ids.profileId });
    assert.equal(result.changed, true);

    const profile = pool.get('SELECT * FROM profile WHERE id = ?', [ids.profileId]);
    assert.equal(profile.email, 'new@example.com');
  });

  it('throws not-found for deleted profile', async () => {
    const now = new Date().toISOString();
    const deletedId = uuidv4();
    pool.insertReturning('profile', {
      id: deletedId, fullname: 'Deleted', email: 'deleted2@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
      deleted_at: now,
    });

    const handler = dispatcher.methods.get('request-email-change').handler;
    await assert.rejects(
      () => handler({ email: 'brandnew@example.com' }, { profileId: deletedId }),
      { code: 'object-not-found' }
    );
  });
});

describe('Profile RPC — update-profile-props', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProfileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('sets allowed props and returns only allowed keys', async () => {
    const handler = dispatcher.methods.get('update-profile-props').handler;
    const result = await handler({
      props: { 'onboarding-viewed': true, renderer: 'skia' },
    }, { profileId: ids.profileId });
    assert.equal(result['onboarding-viewed'], true);
    assert.equal(result.renderer, 'skia');
  });

  it('ignores disallowed prop keys', async () => {
    const handler = dispatcher.methods.get('update-profile-props').handler;
    const result = await handler({
      props: { 'evil-key': 'hack', renderer: 'cpu' },
    }, { profileId: ids.profileId });
    assert.equal(result['evil-key'], undefined);
    assert.equal(result.renderer, 'cpu');
  });

  it('deletes prop when value is null', async () => {
    pool.run('UPDATE profile SET props = ? WHERE id = ?', [JSON.stringify({ renderer: 'skia', 'v2-info-shown': true }), ids.profileId]);

    const handler = dispatcher.methods.get('update-profile-props').handler;
    const result = await handler({
      props: { renderer: null },
    }, { profileId: ids.profileId });
    assert.equal(result.renderer, undefined);
    assert.equal(result['v2-info-shown'], true);
  });

  it('throws validation error when props is not an object', async () => {
    const handler = dispatcher.methods.get('update-profile-props').handler;
    await assert.rejects(
      () => handler({ props: 'invalid' }, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });

  it('throws not-found for deleted profile', async () => {
    const now = new Date().toISOString();
    const deletedId = uuidv4();
    pool.insertReturning('profile', {
      id: deletedId, fullname: 'Deleted', email: 'deleted3@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
      deleted_at: now,
    });

    const handler = dispatcher.methods.get('update-profile-props').handler;
    await assert.rejects(
      () => handler({ props: { renderer: 'skia' } }, { profileId: deletedId }),
      { code: 'object-not-found' }
    );
  });
});

describe('Profile RPC — get-subscription-usage', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerProfileCommands(dispatcher.register, pool);
  });

  afterEach(() => { destroyTestPool(pool); });

  it('returns editors from teams where profile is owner', async () => {
    const handler = dispatcher.methods.get('get-subscription-usage').handler;
    const result = await handler({}, { profileId: ids.profileId });
    assert.ok(Array.isArray(result.editors));
    assert.equal(result.editors.length, 1);
    assert.equal(result.editors[0].id, ids.profileId);
    assert.equal(result.editors[0].name, 'Test User');
    assert.equal(result.editors[0].email, 'test@example.com');
  });

  it('returns empty editors for non-owner profile', async () => {
    const otherProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: otherProfileId, fullname: 'NonOwner', email: 'nonowner@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: otherProfileId,
      is_owner: '0', is_admin: '0', can_edit: '1', is_member: '1',
      created_at: now, modified_at: now,
    });

    const handler = dispatcher.methods.get('get-subscription-usage').handler;
    const result = await handler({}, { profileId: otherProfileId });
    assert.ok(Array.isArray(result.editors));
    assert.equal(result.editors.length, 0);
  });

  it('excludes editors from deleted teams', async () => {
    pool.run('UPDATE team SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), ids.teamId]);

    const handler = dispatcher.methods.get('get-subscription-usage').handler;
    const result = await handler({}, { profileId: ids.profileId });
    assert.equal(result.editors.length, 0);
  });
});