import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { objectToSnake, openDb, getDb, closeDb, getMigrationFiles, getAppliedMigrations, runMigrations } from '../src/db/sqlite.js';

describe('objectToSnake', () => {
  it('converts all keys to snake_case', () => {
    const result = objectToSnake({ profileId: '1', isDefault: true });
    assert.equal(result.profile_id, '1');
    assert.equal(result.is_default, true);
  });

  it('handles empty object', () => {
    assert.deepEqual(objectToSnake({}), {});
  });
});

describe('openDb', () => {
  it('creates an in-memory database', () => {
    const db = openDb(':memory:');
    assert.ok(db);
    assert.ok(db.prepare);
    db.close();
  });
});

describe('getDb', () => {
  it('returns null when no DB is set', () => {
    closeDb();
    assert.equal(getDb(), null);
  });
});

describe('getMigrationFiles', () => {
  it('returns array with name, path, sql', () => {
    const files = getMigrationFiles();
    assert.ok(Array.isArray(files));
    assert.ok(files.length > 0);
    assert.ok(files[0].name);
    assert.ok(files[0].path);
    assert.ok(files[0].sql);
  });
});

describe('getAppliedMigrations + runMigrations', () => {
  it('runs migrations and tracks them', () => {
    closeDb();
    const db = openDb(':memory:');
    const applied = getAppliedMigrations(db);
    assert.ok(Array.isArray(applied));

    runMigrations(db);

    const appliedAfter = getAppliedMigrations(db);
    assert.ok(appliedAfter.length > 0);
    closeDb();
  });
});