import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';

function registerFileCommands(pool) {
  const commands = {};

  commands['get-file'] = async (params) => {
    const file = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', [params.id]);
    if (!file) throw new Error('not-found:File not found');
    return file;
  };

  commands['rename-file'] = async (params) => {
    pool.run('UPDATE file SET name = ?, modified_at = ? WHERE id = ?', [params.name, new Date().toISOString(), params.id]);
    const file = pool.get('SELECT * FROM file WHERE id = ?', [params.id]);
    return file;
  };

  commands['delete-file'] = async (params) => {
    const now = new Date().toISOString();
    pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [now, params.id]);
    return { id: params.id };
  };

  commands['link-file-to-library'] = async (params) => {
    const { fileId, libraryId } = params;
    const now = new Date().toISOString();
    pool.run(
      'INSERT OR IGNORE INTO file_library_rel (file_id, library_file_id, created_at, synced_at) VALUES (?, ?, ?, ?)',
      [fileId, libraryId, now, now]
    );
    return null;
  };

  commands['unlink-file-from-library'] = async (params) => {
    pool.run('DELETE FROM file_library_rel WHERE file_id = ? AND library_file_id = ?', [params.fileId, params.libraryId]);
    return null;
  };

  commands['get-file-summary'] = async (params) => {
    const { id } = params;
    const file = pool.get('SELECT id, name, project_id, is_shared, revn, modified_at, created_at FROM file WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!file) throw new Error('not-found:File not found');
    const pages = pool.query('SELECT id, name, ordering FROM page WHERE file_id = ? AND deleted_at IS NULL ORDER BY ordering', [id]);
    const libraryCount = pool.get('SELECT COUNT(*) as cnt FROM file_library_rel WHERE file_id = ?', [id]);
    return {
      id: file.id,
      name: file.name,
      projectId: file.project_id,
      isShared: file.is_shared === '1',
      revn: file.revn,
      modifiedAt: file.modified_at,
      createdAt: file.created_at,
      pageCount: pages.length,
      libraryCount: libraryCount?.cnt || 0,
    };
  };

  commands['get-file-libraries'] = async (params) => {
    const { fileId } = params;
    const libraries = pool.query(
      `SELECT f.id, f.name, f.is_shared, f.revn, f.modified_at, f.created_at
       FROM file f
       JOIN file_library_rel flr ON flr.library_file_id = f.id
       WHERE flr.file_id = ? AND f.deleted_at IS NULL`,
      [fileId]
    );
    return libraries;
  };

  commands['get-library-file-references'] = async (params) => {
    const { libraryId } = params;
    const references = pool.query(
      `SELECT f.id, f.name, f.project_id, f.revn, f.modified_at
       FROM file f
       JOIN file_library_rel flr ON flr.file_id = f.id
       WHERE flr.library_file_id = ? AND f.deleted_at IS NULL`,
      [libraryId]
    );
    return references;
  };

  return commands;
}

describe('File RPC operations', () => {
  let pool;
  let ids;

  beforeEach(() => { pool = createTestPool(); ids = seedFullHierarchy(pool); });
  afterEach(() => { destroyTestPool(pool); });

  describe('get-file', () => {
    it('returns an existing file', async () => {
      const cmds = registerFileCommands(pool);
      const file = await cmds['get-file']({ id: ids.fileId });
      assert.equal(file.id, ids.fileId);
      assert.equal(file.name, 'Test File');
    });

    it('throws for missing file', async () => {
      const cmds = registerFileCommands(pool);
      assert.rejects(() => cmds['get-file']({ id: 'nonexistent' }), /not-found/);
    });
  });

  describe('rename-file', () => {
    it('renames a file', async () => {
      const cmds = registerFileCommands(pool);
      const file = await cmds['rename-file']({ id: ids.fileId, name: 'New Name' });
      assert.equal(file.name, 'New Name');
    });
  });

  describe('delete-file', () => {
    it('soft-deletes a file', async () => {
      const cmds = registerFileCommands(pool);
      await cmds['delete-file']({ id: ids.fileId });
      const file = pool.get('SELECT * FROM file WHERE id = ?', [ids.fileId]);
      assert.ok(file.deleted_at);
    });
  });

  describe('link/unlink library', () => {
    it('links a file to a library', async () => {
      const libId = uuidv4();
      const now = new Date().toISOString();
      pool.insertReturning('file', {
        id: libId, project_id: ids.projectId, name: 'Lib',
        is_shared: '1', revn: 0, features: '[]', fonts: '[]',
        created_at: now, modified_at: now,
      });

      const cmds = registerFileCommands(pool);
      await cmds['link-file-to-library']({ fileId: ids.fileId, libraryId: libId });

      const rel = pool.get('SELECT * FROM file_library_rel WHERE file_id = ? AND library_file_id = ?', [ids.fileId, libId]);
      assert.ok(rel);
    });

    it('unlinks a file from a library', async () => {
      const libId = uuidv4();
      const now = new Date().toISOString();
      pool.insertReturning('file', {
        id: libId, project_id: ids.projectId, name: 'Lib',
        is_shared: '1', revn: 0, features: '[]', fonts: '[]',
        created_at: now, modified_at: now,
      });
      pool.run(
        'INSERT OR IGNORE INTO file_library_rel (file_id, library_file_id, created_at, synced_at) VALUES (?, ?, ?, ?)',
        [ids.fileId, libId, now, now]
      );

      const cmds = registerFileCommands(pool);
      await cmds['unlink-file-from-library']({ fileId: ids.fileId, libraryId: libId });

      const rel = pool.get('SELECT * FROM file_library_rel WHERE file_id = ? AND library_file_id = ?', [ids.fileId, libId]);
      assert.equal(rel, undefined);
    });
  });

  describe('get-file-summary', () => {
    it('returns file summary without loading full data', async () => {
      const cmds = registerFileCommands(pool);
      const summary = await cmds['get-file-summary']({ id: ids.fileId });
      assert.equal(summary.id, ids.fileId);
      assert.equal(summary.name, 'Test File');
      assert.equal(summary.isShared, false);
      assert.ok(summary.pageCount !== undefined);
      assert.ok(summary.libraryCount !== undefined);
    });
  });

  describe('get-file-libraries', () => {
    it('returns empty array for file with no libraries', async () => {
      const cmds = registerFileCommands(pool);
      const libs = await cmds['get-file-libraries']({ fileId: ids.fileId });
      assert.ok(Array.isArray(libs));
      assert.equal(libs.length, 0);
    });

    it('returns linked libraries for a file', async () => {
      const libId = uuidv4();
      const now = new Date().toISOString();
      pool.insertReturning('file', {
        id: libId, project_id: ids.projectId, name: 'My Library',
        is_shared: '1', revn: 0, features: '[]', fonts: '[]',
        created_at: now, modified_at: now,
      });
      pool.run(
        'INSERT OR IGNORE INTO file_library_rel (file_id, library_file_id, created_at, synced_at) VALUES (?, ?, ?, ?)',
        [ids.fileId, libId, now, now]
      );

      const cmds = registerFileCommands(pool);
      const libs = await cmds['get-file-libraries']({ fileId: ids.fileId });
      assert.equal(libs.length, 1);
      assert.equal(libs[0].id, libId);
      assert.equal(libs[0].name, 'My Library');
    });
  });

  describe('get-library-file-references', () => {
    it('returns files that reference a library', async () => {
      const libId = uuidv4();
      const now = new Date().toISOString();
      pool.insertReturning('file', {
        id: libId, project_id: ids.projectId, name: 'Shared Library',
        is_shared: '1', revn: 0, features: '[]', fonts: '[]',
        created_at: now, modified_at: now,
      });
      pool.run(
        'INSERT OR IGNORE INTO file_library_rel (file_id, library_file_id, created_at, synced_at) VALUES (?, ?, ?, ?)',
        [ids.fileId, libId, now, now]
      );

      const cmds = registerFileCommands(pool);
      const refs = await cmds['get-library-file-references']({ libraryId: libId });
      assert.ok(Array.isArray(refs));
      assert.equal(refs.length, 1);
      assert.equal(refs[0].id, ids.fileId);
    });

    it('returns empty array for library with no references', async () => {
      const libId = uuidv4();
      const now = new Date().toISOString();
      pool.insertReturning('file', {
        id: libId, project_id: ids.projectId, name: 'Unlinked Library',
        is_shared: '1', revn: 0, features: '[]', fonts: '[]',
        created_at: now, modified_at: now,
      });

      const cmds = registerFileCommands(pool);
      const refs = await cmds['get-library-file-references']({ libraryId: libId });
      assert.ok(Array.isArray(refs));
      assert.equal(refs.length, 0);
    });
  });
});