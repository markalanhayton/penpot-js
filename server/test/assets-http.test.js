import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool } from './helpers.js';

describe('http/assets — storage object queries', () => {
  let pool;

  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('resolves file_media_object by id with mtype', () => {
    const now = new Date().toISOString();
    pool.run("INSERT INTO profile (id, fullname, email, is_active, created_at, modified_at) VALUES (?, ?, ?, '1', ?, ?)", ['p3', 'T3', 't3@t.com', now, now]);
    pool.run("INSERT INTO team (id, name, is_default, created_at, modified_at) VALUES (?, ?, '1', ?, ?)", ['t3', 'Team3', now, now]);
    pool.run("INSERT INTO project (id, team_id, name, is_default, created_at, modified_at) VALUES (?, ?, ?, '1', ?, ?)", ['pr3', 't3', 'P3', now, now]);
    pool.run("INSERT INTO file (id, project_id, name, is_shared, revn, created_at, modified_at) VALUES (?, ?, ?, '0', 0, ?, ?)", ['f3', 'pr3', 'F3', now, now]);

    pool.run("INSERT INTO storage_object (id, created_at, size, backend, content_type, touched_at) VALUES (?, ?, 100, ?, ?, ?)", ['so-3', now, 'fs', 'image/png', now]);
    pool.run("INSERT INTO storage_object (id, created_at, size, backend, content_type, bucket, touched_at) VALUES (?, ?, 200, ?, ?, ?, ?)", ['so-4', now, 'fs', 'image/jpeg', 'my-bucket', now]);

    pool.insertReturning('file_media_object', {
      id: 'fmo-3', file_id: 'f3', name: 'test.png', width: 10, height: 10, mtype: 'image/png',
      media_id: 'so-3', created_at: now, modified_at: now,
    });

    const obj = pool.get('SELECT mo.id, mo.media_id, mo.mtype FROM file_media_object mo WHERE mo.id = ? AND mo.deleted_at IS NULL', ['fmo-3']);
    assert.ok(obj, 'should find file_media_object');
    assert.equal(obj.mtype, 'image/png');
  });

  it('finds storage_object with content_type and bucket', () => {
    const now = new Date().toISOString();
    pool.run("INSERT INTO storage_object (id, created_at, size, backend, content_type, bucket, touched_at) VALUES (?, ?, 300, ?, ?, ?, ?)", ['so-5', now, 'fs', 'application/pdf', 'pdf-bucket', now]);

    const obj = pool.get('SELECT id, content_type, bucket FROM storage_object WHERE id = ?', ['so-5']);
    assert.equal(obj.content_type, 'application/pdf');
    assert.equal(obj.bucket, 'pdf-bucket');
  });

  it('excludes soft-deleted file_media_objects', () => {
    const now = new Date().toISOString();
    pool.run("INSERT INTO profile (id, fullname, email, is_active, created_at, modified_at) VALUES (?, ?, ?, '1', ?, ?)", ['p4', 'T4', 't4@t.com', now, now]);
    pool.run("INSERT INTO team (id, name, is_default, created_at, modified_at) VALUES (?, ?, '1', ?, ?)", ['t4', 'Team4', now, now]);
    pool.run("INSERT INTO project (id, team_id, name, is_default, created_at, modified_at) VALUES (?, ?, ?, '1', ?, ?)", ['pr4', 't4', 'P4', now, now]);
    pool.run("INSERT INTO file (id, project_id, name, is_shared, revn, created_at, modified_at) VALUES (?, ?, ?, '0', 0, ?, ?)", ['f4', 'pr4', 'F4', now, now]);
    pool.run("INSERT INTO storage_object (id, created_at, size, backend, touched_at) VALUES (?, ?, 0, ?, ?)", ['so-6', now, 'fs', now]);

    pool.insertReturning('file_media_object', {
      id: 'fmo-4', file_id: 'f4', name: 'del.jpg', width: 1, height: 1, mtype: 'image/jpeg',
      media_id: 'so-6', created_at: now, modified_at: now,
    });

    pool.run("UPDATE file_media_object SET deleted_at = ? WHERE id = ?", [now, 'fmo-4']);

    const obj = pool.get('SELECT id FROM file_media_object WHERE id = ? AND deleted_at IS NULL', ['fmo-4']);
    assert.equal(obj, undefined, 'soft-deleted object should not be visible');
  });
});