import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool } from './helpers.js';
import { gcDeletedStorageObjects, gcOrphanedStorageObjects } from '../src/tasks/storage_gc.js';

describe('gcDeletedStorageObjects', () => {
  let pool;

  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('deletes storage objects past retention', async () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString();
    pool.run('INSERT INTO storage_object (id, created_at, size, backend) VALUES (?, ?, 100, ?)', ['old-1', old, 'fs']);
    pool.run('INSERT INTO storage_object (id, created_at, size, backend) VALUES (?, ?, 200, ?)', ['new-1', now, 'fs']);

    pool.run("UPDATE storage_object SET deleted_at = ? WHERE id = ?", [old, 'old-1']);
    pool.run("UPDATE storage_object SET deleted_at = ? WHERE id = ?", [now, 'new-1']);

    const deletedIds = [];
    const fakeStorage = { deleteObject(id) { deletedIds.push(id); } };

    const count = await gcDeletedStorageObjects(pool, fakeStorage);
    assert.equal(count, 1);
    assert.ok(deletedIds.includes('old-1'));

    const remaining = pool.query("SELECT id FROM storage_object WHERE id = ?", ['new-1']);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, 'new-1');
  });

  it('skips non-deleted objects', async () => {
    const now = new Date().toISOString();
    pool.run('INSERT INTO storage_object (id, created_at, size, backend) VALUES (?, ?, 50, ?)', ['alive-1', now, 'fs']);

    const fakeStorage = { deleteObject() {} };
    const count = await gcDeletedStorageObjects(pool, fakeStorage);
    assert.equal(count, 0);
  });

  it('continues on storage delete errors', async () => {
    const old = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString();
    pool.run('INSERT INTO storage_object (id, created_at, size, backend) VALUES (?, ?, 10, ?)', ['fail-1', old, 'fs']);
    pool.run('INSERT INTO storage_object (id, created_at, size, backend) VALUES (?, ?, 20, ?)', ['ok-1', old, 'fs']);
    pool.run("UPDATE storage_object SET deleted_at = ? WHERE id = 'fail-1'", [old]);
    pool.run("UPDATE storage_object SET deleted_at = ? WHERE id = 'ok-1'", [old]);

    const deletedIds = [];
    const fakeStorage = {
      deleteObject(id) {
        if (id === 'fail-1') throw new Error('storage error');
        deletedIds.push(id);
      },
    };

    const count = await gcDeletedStorageObjects(pool, fakeStorage);
    assert.equal(count, 1);
    assert.ok(deletedIds.includes('ok-1'));
  });
});

describe('gcOrphanedStorageObjects', () => {
  let pool;

  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('removes unreferenced orphaned objects', async () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString();

    pool.run('INSERT INTO storage_object (id, created_at, size, backend, touched_at) VALUES (?, ?, 50, ?, ?)', ['orphan-1', old, 'fs', old]);
    pool.run('INSERT INTO storage_object (id, created_at, size, backend, touched_at) VALUES (?, ?, 60, ?, ?)', ['recent-1', now, 'fs', now]);

    const deletedIds = [];
    const fakeStorage = { deleteObject(id) { deletedIds.push(id); } };

    const count = await gcOrphanedStorageObjects(pool, fakeStorage);
    assert.equal(count, 1);
    assert.ok(deletedIds.includes('orphan-1'));
  });

  it('keeps objects still referenced by file_media_object', async () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString();

    const { profileId, teamId, projectId, fileId } = (() => {
      const pId = 'prof-1', tId = 'team-1', prId = 'proj-1', fId = 'file-1';
      const n = new Date().toISOString();
      pool.run("INSERT INTO profile (id, fullname, email, is_active, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)", [pId, 'Test', 't@t.com', '1', n, n]);
      pool.run("INSERT INTO team (id, name, is_default, created_at, modified_at) VALUES (?, ?, '1', ?, ?)", [tId, 'Team', n, n]);
      pool.run("INSERT INTO project (id, team_id, name, is_default, created_at, modified_at) VALUES (?, ?, ?, '1', ?, ?)", [prId, tId, 'Proj', n, n]);
      pool.run("INSERT INTO file (id, project_id, name, is_shared, revn, created_at, modified_at) VALUES (?, ?, ?, '0', 0, ?, ?)", [fId, prId, 'File', n, n]);
      return { profileId: pId, teamId: tId, projectId: prId, fileId: fId };
    })();

    pool.run('INSERT INTO storage_object (id, created_at, size, backend, touched_at) VALUES (?, ?, 100, ?, ?)', ['ref-1', old, 'fs', old]);
    pool.run('INSERT INTO file_media_object (id, file_id, name, width, height, mtype, media_id, created_at, modified_at) VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)', ['fmo-1', fileId, 'image.png', 'image/png', 'ref-1', now, now]);

    const fakeStorage = { deleteObject() {} };
    const count = await gcOrphanedStorageObjects(pool, fakeStorage);
    assert.equal(count, 0);

    const obj = pool.get("SELECT id FROM storage_object WHERE id = ?", ['ref-1']);
    assert.ok(obj, 'referenced object should not be deleted');
  });
});