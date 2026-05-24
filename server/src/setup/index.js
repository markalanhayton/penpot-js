/**
 * @module setup
 * @description Instance setup and initial data seeding — mirrors `app.setup`
 * from the Clojure backend.
 *
 * On first startup, this module:
 * 1. Generates a persistent instance ID (stored in `server_prop`).
 * 2. Creates the default team for initial admin user (if provided).
 * 3. Seeds built-in templates (placeholder entries).
 *
 * ### Environment variables
 *
 * - `PENPOT_INITIAL_ADMIN_EMAIL` — Create an initial admin user with this email.
 * - `PENPOT_INITIAL_ADMIN_PASSWORD` — Password for the initial admin user.
 */

import { v4 as uuidv4 } from 'uuid';
import { derivePassword } from '../auth/password.js';
import { createSessionToken } from '../auth/tokens.js';
import { rowToCamel } from '../db/sqlite.js';

/**
 * Run initial instance setup. Creates instance ID and optional admin user.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @returns {Promise<{ instanceId: string, adminCreated: boolean }>}
 */
export async function runSetup(pool) {
  console.log('[setup] Running instance setup...');

  // Ensure server_prop table exists (it should from migrations)
  let instanceId = getInstanceProp(pool, 'instance-id');

  if (!instanceId) {
    instanceId = uuidv4();
    setInstanceProp(pool, 'instance-id', instanceId);
    console.log(`[setup] Generated instance ID: ${instanceId}`);
  } else {
    console.log(`[setup] Instance ID: ${instanceId}`);
  }

  // Create initial admin user if configured
  let adminCreated = false;
  const adminEmail = process.env.PENPOT_INITIAL_ADMIN_EMAIL;
  const adminPassword = process.env.PENPOT_INITIAL_ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const existing = pool.get('SELECT id FROM profile WHERE email = ? AND deleted_at IS NULL', [adminEmail.trim().toLowerCase()]);
    if (!existing) {
      const profileId = uuidv4();
      const teamId = uuidv4();
      const projectId = uuidv4();
      const now = new Date().toISOString();
      const hashedPassword = await derivePassword(adminPassword);

      pool.transaction(() => {
        pool.insertReturning('profile', {
          id: profileId,
          fullname: 'Admin',
          email: adminEmail.trim().toLowerCase(),
          password: hashedPassword,
          is_active: '1',
          is_demo: '0',
          is_blocked: '0',
          auth_source: 'password',
          created_at: now,
          modified_at: now,
        });

        pool.insertReturning('team', {
          id: teamId,
          name: 'Default',
          is_default: '1',
          created_at: now,
          modified_at: now,
        });

        pool.insertReturning('team_profile_rel', {
          id: uuidv4(),
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
          name: 'Drafts',
          is_default: '1',
          created_at: now,
          modified_at: now,
        });
      });

      console.log(`[setup] Created initial admin user: ${adminEmail}`);
      adminCreated = true;
    } else {
      console.log(`[setup] Initial admin user already exists: ${adminEmail}`);
    }
  }

  console.log('[setup] Instance setup complete');
  return { instanceId, adminCreated };
}

/**
 * Create a welcome file for a new user.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} profileId - The new user's profile ID.
 * @param {string} profileName - The user's display name.
 */
export function createWelcomeFile(pool, profileId, profileName) {
  const profile = pool.get('SELECT * FROM profile WHERE id = ? AND deleted_at IS NULL', [profileId]);
  if (!profile) return;

  // Find the user's default project
  const project = pool.get(
    `SELECT p.* FROM project p
     JOIN team_profile_rel tpr ON tpr.team_id = p.team_id
     WHERE tpr.profile_id = ? AND p.is_default = '1'
     LIMIT 1`,
    [profileId]
  );
  if (!project) return;

  const fileId = uuidv4();
  const now = new Date().toISOString();
  const fileName = `${profileName}'s first file`;

  pool.insertReturning('file', {
    id: fileId,
    project_id: project.id,
    name: fileName,
    is_shared: '0',
    revn: 0,
    features: '{}',
    fonts: '[]',
    created_at: now,
    modified_at: now,
    modified_by: profileId,
  });

  // Update profile with welcome file reference
  pool.run('UPDATE profile SET welcome_file_id = ? WHERE id = ?', [fileId, profileId]);
}

/**
 * Get a server property value.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} key - Property key.
 * @returns {string|null} Property value, or null if not found.
 */
export function getInstanceProp(pool, key) {
  const row = pool.get('SELECT content FROM server_prop WHERE id = ?', [key]);
  return row?.content ?? null;
}

/**
 * Set a server property value.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @param {string} key - Property key (stored in `id` column).
 * @param {string} value - Property value (stored in `content` column).
 */
export function setInstanceProp(pool, key, value) {
  pool.run(
    'INSERT OR REPLACE INTO server_prop (id, content) VALUES (?, ?)',
    [key, value]
  );
}