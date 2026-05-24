import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import registerViewerCommands from '../src/rpc/viewer.js';

function captureHandlers(pool) {
  const handlers = {};
  const register = (name, def) => { handlers[name] = def.handler; };
  registerViewerCommands(register, pool);
  return handlers;
}

describe('rpc/viewer — get-view-only-bundle permissions', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns bundle for team member', async () => {
    const result = await handlers['get-view-only-bundle'](
      { fileId: ids.fileId },
      { profileId: ids.profileId }
    );
    assert.ok(result.file);
    assert.equal(result.file.id, ids.fileId);
    assert.ok(result.users);
    assert.ok(result.team);
    assert.ok(result.project);
  });

  it('returns bundle via share link', async () => {
    const now = new Date().toISOString();
    const shareId = 'share-1';
    const token = 'abc123';
    pool.insertOnConflictDoNothing('share_link', {
      id: shareId,
      file_id: ids.fileId,
      token,
      permissions: '["view"]',
      created_at: now,
      modified_at: now,
    });

    const result = await handlers['get-view-only-bundle'](
      { fileId: ids.fileId, shareId },
      { profileId: null }
    );
    assert.ok(result.file);
    assert.ok(result.shareLinks);
  });

  it('throws authentication when no profileId and no shareId', async () => {
    await assert.rejects(
      () => handlers['get-view-only-bundle'](
        { fileId: ids.fileId },
        { profileId: null }
      ),
      { type: 'authentication' }
    );
  });

  it('throws authorization for non-member', async () => {
    const now = new Date().toISOString();
    const outsiderId = 'outsider-1';
    pool.insertReturning('profile', {
      id: outsiderId, fullname: 'Outsider', email: 'outsider@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });

    await assert.rejects(
      () => handlers['get-view-only-bundle'](
        { fileId: ids.fileId },
        { profileId: outsiderId }
      ),
      { type: 'authorization' }
    );
  });

  it('obfuscates emails in share mode', async () => {
    const now = new Date().toISOString();
    const shareId = 'share-2';
    pool.insertOnConflictDoNothing('share_link', {
      id: shareId,
      file_id: ids.fileId,
      token: 'xyz789',
      permissions: '["view"]',
      created_at: now,
      modified_at: now,
    });

    const result = await handlers['get-view-only-bundle'](
      { fileId: ids.fileId, shareId },
      { profileId: null }
    );
    const user = result.users.find(u => u.id === ids.profileId);
    assert.ok(user);
    assert.ok(!user.email.includes('test@example.com'), 'email should be obfuscated');
  });

  it('returns full emails in member mode', async () => {
    const result = await handlers['get-view-only-bundle'](
      { fileId: ids.fileId },
      { profileId: ids.profileId }
    );
    const user = result.users.find(u => u.id === ids.profileId);
    assert.ok(user);
    assert.equal(user.email, 'test@example.com');
  });
});