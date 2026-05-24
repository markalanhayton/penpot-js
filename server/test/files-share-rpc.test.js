import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { RpcError } from '../src/rpc/dispatcher.js';
import registerFileShareCommands from '../src/rpc/files_share.js';

function captureHandlers(pool) {
  const handlers = {};
  const register = (name, def) => { handlers[name] = def.handler; };
  registerFileShareCommands(register, pool);
  return handlers;
}

describe('rpc/files-share — create-share-link', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('creates a share link for a file', async () => {
    const result = await handlers['create-share-link'](
      { fileId: ids.fileId, permissions: ['view'] },
      { profileId: ids.profileId }
    );
    assert.ok(result.id);
    assert.ok(result.token);
    assert.equal(result.fileId, ids.fileId);

    const row = pool.get('SELECT * FROM share_link WHERE file_id = ?', [ids.fileId]);
    assert.ok(row);
    assert.ok(row.token);
  });

  it('throws authorization for non-editor', async () => {
    const now = new Date().toISOString();
    const viewerId = 'viewer-sl';
    pool.insertReturning('profile', {
      id: viewerId, fullname: 'Viewer', email: 'viewer-sl@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: viewerId,
      is_owner: '0', is_admin: '0', can_edit: '0', is_member: '1',
      created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['create-share-link'](
        { fileId: ids.fileId },
        { profileId: viewerId }
      ),
      { type: 'authorization' }
    );
  });
});

describe('rpc/files-share — delete-share-link', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('deletes a share link', async () => {
    const created = await handlers['create-share-link'](
      { fileId: ids.fileId },
      { profileId: ids.profileId }
    );

    await handlers['delete-share-link']({ id: created.id }, { profileId: ids.profileId });

    const row = pool.get('SELECT * FROM share_link WHERE id = ?', [created.id]);
    assert.equal(row, undefined);
  });

  it('throws not-found for missing link', async () => {
    await assert.rejects(
      () => handlers['delete-share-link']({ id: 'nonexistent' }, { profileId: ids.profileId }),
      { type: 'not-found' }
    );
  });
});