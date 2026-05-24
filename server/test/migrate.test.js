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
});