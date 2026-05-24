/**
 * @module test/helpers
 * Test utilities: in-memory DB creation, migration running, mock factories.
 */

import { createPool, runMigrations, closeDb } from '../src/db/sqlite.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create an in-memory SQLite database with all migrations applied.
 * @returns {Promise<import('../src/db/sqlite.js').DatabasePool>}
 */
export function createTestPool() {
  const pool = createPool(':memory:');
  runMigrations(pool.db);
  return pool;
}

/**
 * Close a test database pool.
 * @param {import('../src/db/sqlite.js').DatabasePool} pool
 */
export function destroyTestPool(pool) {
  closeDb(pool);
}

/**
 * Seed a full team → project → profile → file hierarchy for integration tests.
 * Returns all created IDs.
 */
export function seedFullHierarchy(pool) {
  const now = new Date().toISOString();
  const profileId = uuidv4();
  const teamId = uuidv4();
  const projectId = uuidv4();
  const fileId = uuidv4();

  pool.transaction(() => {
    pool.insertReturning('profile', {
      id: profileId,
      fullname: 'Test User',
      email: 'test@example.com',
      password: '!',
      is_active: '1',
      is_demo: '0',
      is_blocked: '0',
      auth_source: 'password',
      created_at: now,
      modified_at: now,
    });

    pool.insertReturning('team', {
      id: teamId,
      name: 'Test Team',
      is_default: '1',
      features: '[]',
      created_at: now,
      modified_at: now,
    });

    pool.insertReturning('team_profile_rel', {
      team_id: teamId,
      profile_id: profileId,
      is_owner: '1',
      is_admin: '1',
      can_edit: '1',
      is_member: '1',
      created_at: now,
      modified_at: now,
    });

    pool.insertReturning('project', {
      id: projectId,
      team_id: teamId,
      name: 'Test Project',
      is_default: '1',
      created_at: now,
      modified_at: now,
    });

    pool.insertReturning('file', {
      id: fileId,
      project_id: projectId,
      name: 'Test File',
      is_shared: '0',
      revn: 0,
      features: '[]',
      fonts: '[]',
      created_at: now,
      modified_at: now,
    });
  });

  return { profileId, teamId, projectId, fileId };
}