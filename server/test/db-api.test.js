'use strict';

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createPool, runMigrations, closeDb, camelToSnake, snakeToCamel, rowToCamel, rowsToCamel } from '../src/db/sqlite.js';

function createTestPool() {
  const pool = createPool(':memory:');
  runMigrations(pool.db);
  return pool;
}

describe('Database Pool — CRUD Operations', () => {
  let pool;

  beforeEach(() => {
    pool = createTestPool();
  });

  afterEach(() => {
    closeDb();
  });

  it('insert and query a row', () => {
    const id = pool.uuid();
    pool.insert('profile', {
      id,
      email: 'test@example.com',
      password: 'hash',
      fullname: 'Test User',
    });
    const row = pool.getOne('profile', { id });
    assert.equal(row.id, id);
    assert.equal(row.email, 'test@example.com');
    assert.equal(row.fullname, 'Test User');
  });

  it('insertReturning returns full row', () => {
    const id = pool.uuid();
    const row = pool.insertReturning('profile', {
      id,
      email: 'returning@example.com',
      password: 'hash',
      fullname: 'Returning User',
    });
    assert.equal(row.id, id);
    assert.equal(row.email, 'returning@example.com');
    assert.ok(typeof row.created_at === 'string', 'created_at should be a string');
  });

  it('update rows and verify changes', () => {
    const id = pool.uuid();
    pool.insert('profile', { id, email: 'old@example.com', password: 'h', fullname: 'Old' });
    const result = pool.update('profile', { email: 'new@example.com' }, { id });
    assert.equal(result.changes, 1);
    const row = pool.getOne('profile', { id });
    assert.equal(row.email, 'new@example.com');
  });

  it('updateReturning returns updated row', () => {
    const id = pool.uuid();
    pool.insert('profile', { id, email: 'up@example.com', password: 'h', fullname: 'Up' });
    const row = pool.updateReturning('profile', { email: 'updated@example.com' }, { id });
    assert.equal(row.email, 'updated@example.com');
  });

  it('deleteFrom is blocked by deletion protection on profile', () => {
    const id = pool.uuid();
    pool.insert('profile', { id, email: 'del@example.com', password: 'h', fullname: 'Del' });
    assert.throws(() => {
      pool.deleteFrom('profile', { id });
    }, (err) => {
      return err.code === 'SQLITE_CONSTRAINT_TRIGGER';
    });
  });

  it('softDelete sets deleted_at timestamp', () => {
    const id = pool.uuid();
    pool.insert('profile', { id, email: 'soft@example.com', password: 'h', fullname: 'Soft' });
    pool.softDelete('profile', { id });
    const row = pool.getOne('profile', { id });
    assert.ok(row.deleted_at, 'deleted_at should be set after softDelete');
  });

  it('insertOnConflictDoNothing ignores duplicate inserts', () => {
    const id = pool.uuid();
    pool.insert('profile', { id, email: 'conflict@example.com', password: 'h', fullname: 'First' });
    const result = pool.insertOnConflictDoNothing('profile', { id, email: 'conflict@example.com', password: 'h2', fullname: 'Second' }, ['id']);
    assert.equal(result, null);
    const row = pool.getOne('profile', { id });
    assert.equal(row.fullname, 'First', 'original row should remain unchanged');
  });

  it('insertMany bulk inserts rows', () => {
    const teamId = pool.uuid();
    pool.insert('team', { id: teamId, name: 'Bulk Team' });
    const profileIds = [pool.uuid(), pool.uuid(), pool.uuid()];
    for (const pid of profileIds) {
      pool.insert('profile', { id: pid, email: `bulk${pid.slice(0, 4)}@example.com`, password: 'h', fullname: `User ${pid.slice(0, 4)}` });
    }
    pool.insertMany('team_profile_rel', ['teamId', 'profileId', 'canEdit'], profileIds.map(pid => [teamId, pid, '1']));
    const rows = pool.query('SELECT * FROM team_profile_rel WHERE team_id = ?', [teamId]);
    assert.equal(rows.length, 3);
  });

  it('transaction commits on success', () => {
    const id1 = pool.uuid();
    const id2 = pool.uuid();
    pool.transaction(() => {
      pool.insert('profile', { id: id1, email: 'tx1@example.com', password: 'h', fullname: 'TX1' });
      pool.insert('profile', { id: id2, email: 'tx2@example.com', password: 'h', fullname: 'TX2' });
    });
    assert.ok(pool.getOne('profile', { id: id1 }));
    assert.ok(pool.getOne('profile', { id: id2 }));
  });

  it('transaction rolls back on error', () => {
    const id = pool.uuid();
    pool.insert('profile', { id, email: 'before@example.com', password: 'h', fullname: 'Before' });
    assert.throws(() => {
      pool.transaction(() => {
        pool.update('profile', { email: 'during@example.com' }, { id });
        throw new Error('intentional rollback');
      });
    });
    const row = pool.getOne('profile', { id });
    assert.equal(row.email, 'before@example.com', 'should roll back to original state');
  });

  it('jsonRead and jsonWrite handle JSON columns', () => {
    const id = pool.uuid();
    const data = { theme: 'dark', flags: ['flag1', 'flag2'] };
    pool.insert('profile', { id, email: 'json@example.com', password: 'h', fullname: 'JSON', props: JSON.stringify(data) });
    const row = pool.getOne('profile', { id });
    const parsed = pool.jsonRead(row.props);
    assert.equal(parsed.theme, 'dark');
    assert.deepEqual(parsed.flags, ['flag1', 'flag2']);
  });

  it('isDuplicateKeyError detects unique constraint violations', () => {
    const email = 'unique@example.com';
    pool.insert('profile', { id: pool.uuid(), email, password: 'h', fullname: 'First' });
    assert.throws(() => {
      pool.insert('profile', { id: pool.uuid(), email, password: 'h2', fullname: 'Second' });
    }, (err) => {
      return pool.isDuplicateKeyError(err);
    });
  });

  it('query returns array of camelCase rows', () => {
    for (let i = 0; i < 3; i++) {
      pool.insert('profile', { id: pool.uuid(), email: `q${i}@example.com`, password: 'h', fullname: `Q${i}` });
    }
    const rows = pool.query('SELECT * FROM profile', []);
    assert.equal(rows.length, 3);
    assert.ok(rows[0].email.startsWith('q'));
    assert.ok(rows[0].created_at !== undefined, 'should have snake_case keys from SQLite');
  });

  it('get returns first matching row', () => {
    const id = pool.uuid();
    pool.insert('profile', { id, email: 'get@example.com', password: 'h', fullname: 'Get' });
    const row = pool.get('SELECT * FROM profile WHERE id = ?', [id]);
    assert.equal(row.id, id);
  });

  it('getOne with null where returns null for non-existent row', () => {
    const row = pool.getOne('profile', { id: 'nonexistent-uuid' });
    assert.equal(row, undefined);
  });

  it('notDeleted helper generates IS NULL filter', () => {
    const nd = pool.notDeleted();
    assert.equal(nd, 'deleted_at IS NULL');
    const ndTable = pool.notDeleted('team');
    assert.equal(ndTable, 'team.deleted_at IS NULL');
  });
});

describe('Database Pool — Key Conversion', () => {
  it('camelToSnake converts camelCase to snake_case', () => {
    assert.equal(camelToSnake('profileId'), 'profile_id');
    assert.equal(camelToSnake('isDefault'), 'is_default');
    assert.equal(camelToSnake('id'), 'id');
    assert.equal(camelToSnake('updatedAt'), 'updated_at');
  });

  it('snakeToCamel converts snake_case to camelCase', () => {
    assert.equal(snakeToCamel('profile_id'), 'profileId');
    assert.equal(snakeToCamel('is_default'), 'isDefault');
    assert.equal(snakeToCamel('id'), 'id');
    assert.equal(snakeToCamel('updated_at'), 'updatedAt');
  });

  it('rowToCamel converts row keys', () => {
    const row = rowToCamel({ profile_id: '1', is_default: 0, name: 'test' });
    assert.deepEqual(row, { profileId: '1', isDefault: 0, name: 'test' });
  });

  it('rowToCamel returns null for null input', () => {
    assert.equal(rowToCamel(null), null);
  });

  it('rowsToCamel converts all rows', () => {
    const rows = rowsToCamel([{ id: 1 }, { id: 2 }]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, 1);
  });

  it('rowsToCamel returns empty array for null input', () => {
    assert.deepEqual(rowsToCamel(null), []);
  });
});

describe('Database Pool — Migration Runner', () => {
  afterEach(() => {
    closeDb();
  });

  it('applies all migrations successfully', () => {
    const pool = createPool(':memory:');
    const count = runMigrations(pool.db);
    assert.ok(count > 0, 'at least one migration should be applied');

    const tables = pool.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const tableNames = tables.map(r => r.name);
    assert.ok(tableNames.includes('profile'), 'profile table should exist');
    assert.ok(tableNames.includes('file'), 'file table should exist');
    assert.ok(tableNames.includes('team'), 'team table should exist');
    assert.ok(tableNames.includes('project'), 'project table should exist');
  });

  it('idempotent — running migrations again is a no-op', () => {
    const pool = createPool(':memory:');
    const count1 = runMigrations(pool.db);
    const count2 = runMigrations(pool.db);
    assert.equal(count2, 0, 'second run should apply 0 new migrations');
  });
});