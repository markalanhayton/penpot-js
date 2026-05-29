import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { RpcError } from '../src/rpc/dispatcher.js';
import registerFontCommands from '../src/rpc/fonts.js';
import { putStorageObject } from '../src/storage/fs.js';

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

describe('rpc/fonts — create-font-variant', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('throws validation for invalid font weight', async () => {
    await assert.rejects(
      () => handlers['create-font-variant'](
        { teamId: ids.teamId, fontFamily: 'Test', fontWeight: 999, fontStyle: 'normal', data: { 'font/woff2': Buffer.alloc(0) } },
        { profileId: ids.profileId }
      ),
      { type: 'validation' }
    );
  });

  it('throws validation for invalid font style', async () => {
    await assert.rejects(
      () => handlers['create-font-variant'](
        { teamId: ids.teamId, fontFamily: 'Test', fontWeight: 400, fontStyle: 'oblique', data: { 'font/woff2': Buffer.alloc(0) } },
        { profileId: ids.profileId }
      ),
      { type: 'validation' }
    );
  });

  it('throws authorization for non-editor', async () => {
    const now = new Date().toISOString();
    const viewerId = 'viewer-font-create';
    pool.insertReturning('profile', {
      id: viewerId, fullname: 'Viewer', email: 'viewer-font@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['create-font-variant'](
        { teamId: ids.teamId, fontFamily: 'Test', fontWeight: 400, fontStyle: 'normal', data: { 'font/woff2': Buffer.alloc(0) } },
        { profileId: viewerId }
      ),
      { type: 'authorization' }
    );
  });

  it('throws validation when no font data or uploads provided', async () => {
    await assert.rejects(
      () => handlers['create-font-variant'](
        { teamId: ids.teamId, fontFamily: 'Test', fontWeight: 400, fontStyle: 'normal' },
        { profileId: ids.profileId }
      ),
      { type: 'validation' }
    );
  });
});

describe('rpc/fonts — download-font', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('throws not-found for nonexistent variant', async () => {
    await assert.rejects(
      () => handlers['download-font'](
        { id: 'nonexistent' },
        { profileId: ids.profileId }
      ),
      { type: 'not-found' }
    );
  });

  it('throws not-found for variant with no font files', async () => {
    const now = new Date().toISOString();
    pool.insertOnConflictDoNothing('team_font_variant', {
      id: 'fv-nofiles',
      team_id: ids.teamId,
      profile_id: ids.profileId,
      font_id: 'font-nofiles',
      font_family: 'EmptyFont',
      font_weight: 400,
      font_style: 'normal',
      otf_file_id: null,
      ttf_file_id: null,
      woff1_file_id: null,
      woff2_file_id: null,
      created_at: now,
      modified_at: now,
    });

    await assert.rejects(
      () => handlers['download-font'](
        { id: 'fv-nofiles' },
        { profileId: ids.profileId }
      ),
      { type: 'not-found' }
    );
  });

  it('throws authorization for non-member', async () => {
    const now = new Date().toISOString();
    const fakeFontData = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const storageObj = putStorageObject(pool, fakeFontData, {
      contentType: 'font/ttf',
      bucket: 'team-font-variant',
    });

    pool.insertOnConflictDoNothing('team_font_variant', {
      id: 'fv-dl-auth',
      team_id: ids.teamId,
      profile_id: ids.profileId,
      font_id: 'font-dl-auth',
      font_family: 'AuthFont',
      font_weight: 400,
      font_style: 'normal',
      ttf_file_id: storageObj.id,
      created_at: now,
      modified_at: now,
    });

    const outsiderId = 'outsider-font-dl';
    pool.insertReturning('profile', {
      id: outsiderId, fullname: 'Out', email: 'out-font-dl@x.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['download-font'](
        { id: 'fv-dl-auth' },
        { profileId: outsiderId }
      ),
      { type: 'authorization' }
    );
  });
});

describe('rpc/fonts — download-font-family', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('throws not-found for nonexistent font family', async () => {
    await assert.rejects(
      () => handlers['download-font-family'](
        { fontId: 'nonexistent' },
        { profileId: ids.profileId }
      ),
      { type: 'not-found' }
    );
  });

  it('throws authorization for non-member on font family download', async () => {
    const now = new Date().toISOString();
    const fontId = 'font-family-auth';
    const fakeFontData = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const storageObj = putStorageObject(pool, fakeFontData, {
      contentType: 'font/ttf',
      bucket: 'team-font-variant',
    });

    pool.insertOnConflictDoNothing('team_font_variant', {
      id: 'fv-fam-1',
      team_id: ids.teamId,
      profile_id: ids.profileId,
      font_id: fontId,
      font_family: 'FamilyFont',
      font_weight: 400,
      font_style: 'normal',
      ttf_file_id: storageObj.id,
      created_at: now,
      modified_at: now,
    });

    const outsiderId = 'outsider-font-fam';
    pool.insertReturning('profile', {
      id: outsiderId, fullname: 'Out', email: 'out-font-fam@x.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['download-font-family'](
        { fontId },
        { profileId: outsiderId }
      ),
      { type: 'authorization' }
    );
  });
});