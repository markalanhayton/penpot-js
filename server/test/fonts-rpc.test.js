import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { RpcError } from '../src/rpc/dispatcher.js';
import registerFontCommands from '../src/rpc/fonts.js';

function captureHandlers(pool) {
  const handlers = {};
  const register = (name, def) => { handlers[name] = def.handler; };
  registerFontCommands(register, pool);
  return handlers;
}

describe('rpc/fonts — get-font-variants', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns empty when no variants exist', async () => {
    const result = await handlers['get-font-variants'](
      { teamId: ids.teamId },
      { profileId: ids.profileId }
    );
    assert.deepEqual(result, []);
  });

  it('returns existing variants', async () => {
    const now = new Date().toISOString();
    pool.insertOnConflictDoNothing('team_font_variant', {
      id: 'fv-1',
      team_id: ids.teamId,
      profile_id: ids.profileId,
      font_id: 'font-1',
      font_family: 'Inter',
      font_weight: 400,
      font_style: 'normal',
      created_at: now,
      modified_at: now,
    });

    const result = await handlers['get-font-variants'](
      { teamId: ids.teamId },
      { profileId: ids.profileId }
    );
    assert.equal(result.length, 1);
    assert.equal(result[0].fontFamily, 'Inter');
  });

  it('resolves team from projectId', async () => {
    const result = await handlers['get-font-variants'](
      { projectId: ids.projectId },
      { profileId: ids.profileId }
    );
    assert.deepEqual(result, []);
  });

  it('resolves team from fileId', async () => {
    const result = await handlers['get-font-variants'](
      { fileId: ids.fileId },
      { profileId: ids.profileId }
    );
    assert.deepEqual(result, []);
  });

  it('throws authorization for nonexistent team', async () => {
    await assert.rejects(
      () => handlers['get-font-variants'](
        { teamId: 'nonexistent' },
        { profileId: ids.profileId }
      ),
      { type: 'authorization' }
    );
  });

  it('throws authorization for non-member', async () => {
    const now = new Date().toISOString();
    const outsiderId = 'outsider-f';
    pool.insertReturning('profile', {
      id: outsiderId, fullname: 'Out', email: 'out@x.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['get-font-variants'](
        { teamId: ids.teamId },
        { profileId: outsiderId }
      ),
      { type: 'authorization' }
    );
  });
});

describe('rpc/fonts — delete-font-variant', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('soft-deletes a font variant', async () => {
    const now = new Date().toISOString();
    pool.insertOnConflictDoNothing('team_font_variant', {
      id: 'fv-del',
      team_id: ids.teamId,
      profile_id: ids.profileId,
      font_id: 'font-del',
      font_family: 'Roboto',
      font_weight: 700,
      font_style: 'italic',
      created_at: now,
      modified_at: now,
    });

    await handlers['delete-font-variant'](
      { teamId: ids.teamId, id: 'fv-del' },
      { profileId: ids.profileId }
    );

    const variant = pool.get('SELECT deleted_at FROM team_font_variant WHERE id = ?', ['fv-del']);
    assert.ok(variant.deleted_at);
  });

  it('throws not-found for missing variant', async () => {
    await assert.rejects(
      () => handlers['delete-font-variant'](
        { teamId: ids.teamId, id: 'nonexistent' },
        { profileId: ids.profileId }
      ),
      { type: 'not-found' }
    );
  });
});

describe('rpc/fonts — delete-font', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('soft-deletes all variants for a font', async () => {
    const now = new Date().toISOString();
    const fontId = 'font-multi';
    pool.insertOnConflictDoNothing('team_font_variant', {
      id: 'fv-m1', team_id: ids.teamId, profile_id: ids.profileId,
      font_id: fontId, font_family: 'Nunito', font_weight: 400, font_style: 'normal',
      created_at: now, modified_at: now,
    });
    pool.insertOnConflictDoNothing('team_font_variant', {
      id: 'fv-m2', team_id: ids.teamId, profile_id: ids.profileId,
      font_id: fontId, font_family: 'Nunito', font_weight: 700, font_style: 'italic',
      created_at: now, modified_at: now,
    });

    await handlers['delete-font'](
      { teamId: ids.teamId, id: fontId },
      { profileId: ids.profileId }
    );

    const variants = pool.query('SELECT deleted_at FROM team_font_variant WHERE font_id = ?', [fontId]);
    assert.equal(variants.length, 2);
    assert.ok(variants.every(v => v.deleted_at));
  });

  it('throws not-found when no variants exist', async () => {
    await assert.rejects(
      () => handlers['delete-font'](
        { teamId: ids.teamId, id: 'nonexistent' },
        { profileId: ids.profileId }
      ),
      { type: 'not-found' }
    );
  });
});

describe('rpc/fonts — update-font', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('updates font family name', async () => {
    const now = new Date().toISOString();
    pool.insertOnConflictDoNothing('team_font_variant', {
      id: 'fv-upd', team_id: ids.teamId, profile_id: ids.profileId,
      font_id: 'font-upd', font_family: 'OldName', font_weight: 400, font_style: 'normal',
      created_at: now, modified_at: now,
    });

    await handlers['update-font'](
      { teamId: ids.teamId, id: 'font-upd', name: 'NewName' },
      { profileId: ids.profileId }
    );

    const variant = pool.get('SELECT font_family FROM team_font_variant WHERE font_id = ?', ['font-upd']);
    assert.equal(variant.font_family, 'NewName');
  });
});