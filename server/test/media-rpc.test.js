import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool } from './helpers.js';

describe('rpc/media — create-media-object', () => {
  let pool;

  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('inserts file_media_object row via pool', () => {
    const now = new Date().toISOString();
    const { profileId, teamId, projectId, fileId } = (() => {
      const pId = 'p1', tId = 't1', prId = 'pr1', fId = 'f1';
      pool.run("INSERT INTO profile (id, fullname, email, is_active, created_at, modified_at) VALUES (?, ?, ?, '1', ?, ?)", [pId, 'T', 't@t.com', now, now]);
      pool.run("INSERT INTO team (id, name, is_default, created_at, modified_at) VALUES (?, ?, '1', ?, ?)", [tId, 'Team', now, now]);
      pool.run("INSERT INTO project (id, team_id, name, is_default, created_at, modified_at) VALUES (?, ?, ?, '1', ?, ?)", [prId, tId, 'Proj', now, now]);
      pool.run("INSERT INTO file (id, project_id, name, is_shared, revn, created_at, modified_at) VALUES (?, ?, ?, '0', 0, ?, ?)", [fId, prId, 'File', now, now]);
      return { profileId: pId, teamId: tId, projectId: prId, fileId: fId };
    })();

    pool.run('INSERT INTO storage_object (id, created_at, size, backend, touched_at) VALUES (?, ?, 0, ?, ?)', ['so-1', now, 'fs', now]);

    pool.insertReturning('file_media_object', {
      id: 'fmo-1',
      file_id: fileId,
      name: 'photo.png',
      width: 800,
      height: 600,
      mtype: 'image/png',
      media_id: 'so-1',
      created_at: now,
      modified_at: now,
    });

    const fmo = pool.get('SELECT * FROM file_media_object WHERE id = ?', ['fmo-1']);
    assert.equal(fmo.id, 'fmo-1');
    assert.equal(fmo.file_id, fileId);
    assert.equal(fmo.name, 'photo.png');
    assert.equal(fmo.width, 800);
    assert.equal(fmo.height, 600);
    assert.equal(fmo.mtype, 'image/png');
    assert.equal(fmo.media_id, 'so-1');
  });

  it('soft-deletes file_media_object', () => {
    const now = new Date().toISOString();
    pool.run("INSERT INTO profile (id, fullname, email, is_active, created_at, modified_at) VALUES (?, ?, ?, '1', ?, ?)", ['p2', 'T2', 't2@t.com', now, now]);
    pool.run("INSERT INTO team (id, name, is_default, created_at, modified_at) VALUES (?, ?, '1', ?, ?)", ['t2', 'Team2', now, now]);
    pool.run("INSERT INTO project (id, team_id, name, is_default, created_at, modified_at) VALUES (?, ?, ?, '1', ?, ?)", ['pr2', 't2', 'P2', now, now]);
    pool.run("INSERT INTO file (id, project_id, name, is_shared, revn, created_at, modified_at) VALUES (?, ?, ?, '0', 0, ?, ?)", ['f2', 'pr2', 'F2', now, now]);
    pool.run('INSERT INTO storage_object (id, created_at, size, backend, touched_at) VALUES (?, ?, 0, ?, ?)', ['so-2', now, 'fs', now]);

    pool.insertReturning('file_media_object', {
      id: 'fmo-2', file_id: 'f2', name: 'img.jpg', width: 100, height: 100, mtype: 'image/jpeg',
      media_id: 'so-2', created_at: now, modified_at: now,
    });

    pool.run("UPDATE file_media_object SET deleted_at = ? WHERE id = ?", [now, 'fmo-2']);

    const fmo = pool.get('SELECT deleted_at FROM file_media_object WHERE id = ?', ['fmo-2']);
    assert.ok(fmo.deleted_at, 'deleted_at should be set');
  });
});