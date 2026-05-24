import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { rowToCamel, rowsToCamel, camelToSnake, snakeToCamel } from '../src/db/sqlite.js';

describe('camelToSnake / snakeToCamel', () => {
  it('converts camelCase to snake_case', () => {
    assert.equal(camelToSnake('profileId'), 'profile_id');
    assert.equal(camelToSnake('isDefault'), 'is_default');
    assert.equal(camelToSnake('projectId'), 'project_id');
  });

  it('converts snake_case to camelCase', () => {
    assert.equal(snakeToCamel('profile_id'), 'profileId');
    assert.equal(snakeToCamel('is_default'), 'isDefault');
  });
});

describe('rowToCamel / rowsToCamel', () => {
  it('converts a single row', () => {
    assert.deepEqual(rowToCamel({ profile_id: '1', is_default: 1 }), { profileId: '1', isDefault: 1 });
  });

  it('converts an array of rows', () => {
    const result = rowsToCamel([{ a_b: 1 }, { a_b: 2 }]);
    assert.equal(result.length, 2);
    assert.equal(result[0].aB, 1);
  });
});

describe('DatabasePool', () => {
  let pool;

  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('creates an in-memory pool', () => {
    assert.ok(pool);
    assert.ok(pool.db);
    assert.ok(pool.query);
    assert.ok(pool.get);
    assert.ok(pool.run);
  });

  it('inserts and retrieves a row with insertReturning', () => {
    const now = new Date().toISOString();
    const result = pool.insertReturning('team', {
      id: 'test-1',
      name: 'My Team',
      is_default: '1',
      created_at: now,
      modified_at: now,
    });
    assert.equal(result.id, 'test-1');
    assert.equal(result.name, 'My Team');
  });

  it('queries rows with query', () => {
    const now = new Date().toISOString();
    pool.insertReturning('team', { id: 't1', name: 'A', is_default: '1', created_at: now, modified_at: now });
    pool.insertReturning('team', { id: 't2', name: 'B', is_default: '0', created_at: now, modified_at: now });
    const rows = pool.query('SELECT * FROM team ORDER BY name');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, 'A');
  });

  it('gets a single row with get', () => {
    const now = new Date().toISOString();
    pool.insertReturning('team', { id: 't1', name: 'A', is_default: '1', created_at: now, modified_at: now });
    const row = pool.get('SELECT * FROM team WHERE id = ?', ['t1']);
    assert.equal(row.name, 'A');
  });

  it('returns undefined for missing row', () => {
    const row = pool.get('SELECT * FROM team WHERE id = ?', ['nonexistent']);
    assert.equal(row, undefined);
  });

  it('updates a row', () => {
    const now = new Date().toISOString();
    pool.insertReturning('team', { id: 't1', name: 'A', is_default: '1', created_at: now, modified_at: now });
    pool.run('UPDATE team SET name = ? WHERE id = ?', ['Updated', 't1']);
    const row = pool.get('SELECT name FROM team WHERE id = ?', ['t1']);
    assert.equal(row.name, 'Updated');
  });

  it('soft-deletes a row', () => {
    const now = new Date().toISOString();
    pool.insertReturning('team', { id: 't1', name: 'A', is_default: '1', created_at: now, modified_at: now });
    pool.softDelete('team', { id: 't1' });
    const row = pool.get('SELECT * FROM team WHERE id = ?', ['t1']);
    assert.ok(row.deleted_at);
  });

  it('transactions commit on success', () => {
    const now = new Date().toISOString();
    pool.transaction(() => {
      pool.insertReturning('team', { id: 'tx1', name: 'Tx', is_default: '1', created_at: now, modified_at: now });
      pool.insertReturning('team', { id: 'tx2', name: 'Tx2', is_default: '0', created_at: now, modified_at: now });
    });
    const count = pool.get('SELECT COUNT(*) as cnt FROM team');
    assert.equal(count.cnt, 2);
  });

  it('transactions rollback on error', () => {
    const now = new Date().toISOString();
    try {
      pool.transaction(() => {
        pool.insertReturning('team', { id: 'tx1', name: 'Tx', is_default: '1', created_at: now, modified_at: now });
        throw new Error('fail');
      });
    } catch { /* expected */ }
    const count = pool.get('SELECT COUNT(*) as cnt FROM team');
    assert.equal(count.cnt, 0);
  });

  it('insertOnConflictDoNothing skips duplicate', () => {
    const now = new Date().toISOString();
    pool.insertReturning('team', { id: 't1', name: 'A', is_default: '1', created_at: now, modified_at: now });
    const result = pool.insertOnConflictDoNothing('team', { id: 't1', name: 'B', is_default: '0', created_at: now, modified_at: now });
    assert.equal(result, null);
    const row = pool.get('SELECT name FROM team WHERE id = ?', ['t1']);
    assert.equal(row.name, 'A');
  });

  it('jsonRead / jsonWrite', () => {
    assert.equal(pool.jsonRead(null), null);
    assert.deepEqual(pool.jsonRead('{"a":1}'), { a: 1 });
    assert.equal(pool.jsonWrite({ a: 1 }), '{"a":1}');
    assert.equal(pool.jsonWrite(null), null);
  });
});

describe('seedFullHierarchy', () => {
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('creates profile, team, project, and file', () => {
    const ids = seedFullHierarchy(pool);
    assert.ok(ids.profileId);
    assert.ok(ids.teamId);
    assert.ok(ids.projectId);
    assert.ok(ids.fileId);

    const profile = pool.get('SELECT * FROM profile WHERE id = ?', [ids.profileId]);
    assert.ok(profile);

    const team = pool.get('SELECT * FROM team WHERE id = ?', [ids.teamId]);
    assert.ok(team);

    const project = pool.get('SELECT * FROM project WHERE id = ?', [ids.projectId]);
    assert.ok(project);

    const file = pool.get('SELECT * FROM file WHERE id = ?', [ids.fileId]);
    assert.ok(file);
  });
});