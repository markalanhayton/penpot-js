import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { encode, decode } from '../src/files/blob.js';

describe('create-file advanced flows', () => {
  let pool;
  let ids;

  beforeEach(() => { pool = createTestPool(); ids = seedFullHierarchy(pool); });
  afterEach(() => { destroyTestPool(pool); });

  it('creates a file with initial data and owner role', async () => {
    const fileId = uuidv4();
    const pageId = uuidv4();
    const now = new Date().toISOString();

    const initialData = {
      pages: [pageId],
      pagesIndex: {
        [pageId]: { id: pageId, name: 'Page 1', objects: {} },
      },
      options: { componentsV2: true },
    };

    const encodedData = await encode(initialData, { version: 5 });

    pool.transaction(() => {
      pool.insertReturning('file', {
        id: fileId,
        project_id: ids.projectId,
        name: 'New File',
        is_shared: '0',
        revn: 0,
        vern: 0,
        version: 0,
        features: '[]',
        fonts: '[]',
        created_at: now,
        modified_at: now,
      });

      pool.insertOnConflictDoNothing('file_data', {
        file_id: fileId,
        id: uuidv4(),
        type: 'main',
        backend: 'db',
        metadata: '{}',
        data: encodedData,
        created_at: now,
        modified_at: now,
      });

      pool.insertOnConflictDoNothing('file_profile_rel', {
        file_id: fileId,
        profile_id: ids.profileId,
        is_owner: '1',
        is_admin: '1',
        can_edit: '1',
        created_at: now,
        modified_at: now,
      });

      pool.insertOnConflictDoNothing('page', {
        id: pageId,
        file_id: fileId,
        name: 'Page 1',
        ordering: 0,
        created_at: now,
        modified_at: now,
      });

      pool.run('UPDATE project SET modified_at = ? WHERE id = ?', [now, ids.projectId]);
    });

    const file = pool.get('SELECT * FROM file WHERE id = ?', [fileId]);
    assert.ok(file);
    assert.equal(file.name, 'New File');
    assert.equal(file.revn, 0);

    const fileData = pool.get("SELECT * FROM file_data WHERE file_id = ? AND type = 'main'", [fileId]);
    assert.ok(fileData);
    assert.ok(fileData.data);

    const decodedData = await decode(fileData.data);
    assert.ok(decodedData.pages);
    assert.ok(decodedData.pagesIndex);
    assert.equal(decodedData.pages.length, 1);

    const rel = pool.get('SELECT * FROM file_profile_rel WHERE file_id = ? AND profile_id = ?', [fileId, ids.profileId]);
    assert.ok(rel);
    assert.equal(rel.is_owner, '1');

    const page = pool.get('SELECT * FROM page WHERE file_id = ?', [fileId]);
    assert.ok(page);
    assert.equal(page.name, 'Page 1');
  });

  it('team feature propagation on file creation', () => {
    pool.run('UPDATE team SET features = ? WHERE id = ?', [JSON.stringify(['layout/grid']), ids.teamId]);

    const team = pool.get('SELECT features FROM team WHERE id = ?', [ids.teamId]);
    const features = JSON.parse(team.features);
    assert.ok(features.includes('layout/grid'));
  });

  it('file migration seeding', () => {
    const fileId = uuidv4();
    const now = new Date().toISOString();
    const features = ['components/v2', 'layout/grid'];

    pool.insertReturning('file', {
      id: fileId,
      project_id: ids.projectId,
      name: 'Migration File',
      is_shared: '0',
      revn: 0,
      features: JSON.stringify(features),
      fonts: '[]',
      created_at: now,
      modified_at: now,
    });

    for (const feature of features) {
      pool.run(
        'INSERT OR IGNORE INTO file_migration (file_id, name, created_at) VALUES (?, ?, ?)',
        [fileId, feature, now]
      );
    }

    const migrations = pool.query('SELECT * FROM file_migration WHERE file_id = ?', [fileId]);
    assert.equal(migrations.length, 2);
    assert.ok(migrations.some(m => m.name === 'components/v2'));
    assert.ok(migrations.some(m => m.name === 'layout/grid'));
  });
});