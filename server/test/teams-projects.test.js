import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';

describe('Team RPC operations', () => {
  let pool;
  let ids;

  beforeEach(() => { pool = createTestPool(); ids = seedFullHierarchy(pool); });
  afterEach(() => { destroyTestPool(pool); });

  it('creates a new team', () => {
    const teamId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('team', {
      id: teamId, name: 'New Team', is_default: '0',
      created_at: now, modified_at: now,
    });
    const team = pool.get('SELECT * FROM team WHERE id = ?', [teamId]);
    assert.ok(team);
    assert.equal(team.name, 'New Team');
  });

  it('adds a member to a team', () => {
    const newProfileId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('profile', {
      id: newProfileId, fullname: 'User2', email: 'user2@example.com',
      password: '!', is_active: '1', is_demo: '0', is_blocked: '0',
      auth_source: 'password', created_at: now, modified_at: now,
    });
    pool.insertReturning('team_profile_rel', {
      team_id: ids.teamId, profile_id: newProfileId,
      is_owner: '0', is_admin: '0', can_edit: '1', is_member: '1',
      created_at: now, modified_at: now,
    });
    const rel = pool.get('SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ?', [ids.teamId, newProfileId]);
    assert.ok(rel);
    assert.equal(rel.can_edit, '1');
  });
});

describe('Project RPC operations', () => {
  let pool;
  let ids;

  beforeEach(() => { pool = createTestPool(); ids = seedFullHierarchy(pool); });
  afterEach(() => { destroyTestPool(pool); });

  it('creates a project under a team', () => {
    const projectId = uuidv4();
    const now = new Date().toISOString();
    pool.insertReturning('project', {
      id: projectId, team_id: ids.teamId, name: 'New Project',
      is_default: '0', created_at: now, modified_at: now,
    });
    const project = pool.get('SELECT * FROM project WHERE id = ?', [projectId]);
    assert.ok(project);
    assert.equal(project.team_id, ids.teamId);
  });

  it('soft-deletes a project', () => {
    pool.softDelete('project', { id: ids.projectId });
    const project = pool.get('SELECT * FROM project WHERE id = ?', [ids.projectId]);
    assert.ok(project.deleted_at);
  });
});