import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('db/migrate exports', async () => {
  const mod = await import('../src/db/migrate.js');

  it('exports getAppliedMigrations', () => {
    assert.equal(typeof mod.getAppliedMigrations, 'function');
  });

  it('exports getMigrationFiles', () => {
    assert.equal(typeof mod.getMigrationFiles, 'function');
  });

  it('exports runMigrations', () => {
    assert.equal(typeof mod.runMigrations, 'function');
  });

  it('getMigrationFiles returns migration objects', () => {
    const files = mod.getMigrationFiles();
    assert.ok(Array.isArray(files));
    assert.ok(files.length > 0);
    for (const f of files) {
      assert.ok(f.name);
      assert.ok(f.path);
      assert.ok(f.sql);
    }
  });

  it('migration 0024 adds revn to file_object_thumbnail and file_tagged_object_thumbnail', async () => {
    const helpers = await import('./helpers.js');
    const pool = helpers.createTestPool();
    try {
      const objCols = pool.query('PRAGMA table_info(file_object_thumbnail)').map(c => c.name);
      const tagCols = pool.query('PRAGMA table_info(file_tagged_object_thumbnail)').map(c => c.name);
      assert.ok(objCols.includes('revn'), 'file_object_thumbnail.revn should exist after migrations');
      assert.ok(tagCols.includes('revn'), 'file_tagged_object_thumbnail.revn should exist after migrations');
    } finally {
      helpers.destroyTestPool(pool);
    }
  });
});