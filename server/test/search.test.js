import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';

describe('FTS5 file search', async () => {
  const mod = await import('../src/rpc/search.js');
  let pool;

  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('search-files returns results for matching file names', async () => {
    const { profileId, teamId, projectId } = seedFullHierarchy(pool);

    pool.insertReturning('file', {
      id: crypto.randomUUID(),
      project_id: projectId,
      name: 'Design System',
      is_shared: '0',
      revn: 1,
      version: 1,
      vern: 1,
    });
    pool.insertReturning('file', {
      id: crypto.randomUUID(),
      project_id: projectId,
      name: 'Homepage Mockup',
      is_shared: '0',
      revn: 1,
      version: 1,
      vern: 1,
    });
    pool.insertReturning('file', {
      id: crypto.randomUUID(),
      project_id: projectId,
      name: 'Icon Library',
      is_shared: '0',
      revn: 1,
      version: 1,
      vern: 1,
    });

    // Rebuild the FTS5 index to include new files
    mod.rebuildSearchIndex(pool);

    const methods = {};
    mod.default((name, def) => { methods[name] = def; }, pool);

    const results = await methods['search-files'].handler(
      { teamId, searchTerm: 'Design' },
      { profileId }
    );

    assert.ok(Array.isArray(results), 'search-files returns an array');
    const designResult = results.find(r => r.name === 'Design System');
    assert.ok(designResult, 'Design System should appear in results');
  });

  it('search-files returns empty array for empty search term', async () => {
    const { profileId, teamId } = seedFullHierarchy(pool);
    const methods = {};
    mod.default((name, def) => { methods[name] = def; }, pool);

    const results = await methods['search-files'].handler(
      { teamId, searchTerm: '' },
      { profileId }
    );
    assert.deepEqual(results, []);
  });

  it('search-files returns empty array for whitespace-only search term', async () => {
    const { profileId, teamId } = seedFullHierarchy(pool);
    const methods = {};
    mod.default((name, def) => { methods[name] = def; }, pool);

    const results = await methods['search-files'].handler(
      { teamId, searchTerm: '   ' },
      { profileId }
    );
    assert.deepEqual(results, []);
  });

  it('search-files rejects non-team members', async () => {
    const methods = {};
    mod.default((name, def) => { methods[name] = def; }, pool);

    await assert.rejects(
      () => methods['search-files'].handler(
        { teamId: crypto.randomUUID(), searchTerm: 'test' },
        { profileId: crypto.randomUUID() }
      ),
      { type: 'authorization' }
    );
  });

  it('search-rebuild-index does not throw', () => {
    seedFullHierarchy(pool);
    assert.doesNotThrow(() => mod.rebuildSearchIndex(pool));
  });

  it('search finds files by name via FTS5 or LIKE', async () => {
    const { profileId, teamId, projectId } = seedFullHierarchy(pool);

    pool.insertReturning('file', {
      id: crypto.randomUUID(),
      project_id: projectId,
      name: 'Brand Guidelines',
      is_shared: '0',
      revn: 1,
      version: 1,
      vern: 1,
    });

    // Rebuild FTS5 index after inserting file
    mod.rebuildSearchIndex(pool);

    const methods = {};
    mod.default((name, def) => { methods[name] = def; }, pool);

    // Search should find "Brand Guidelines" whether via FTS5 or LIKE fallback
    const results = await methods['search-files'].handler(
      { teamId, searchTerm: 'Brand' },
      { profileId }
    );
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0, 'should find at least one result');
    const brandResult = results.find(r => r.name === 'Brand Guidelines');
    assert.ok(brandResult, 'Brand Guidelines should appear in results');
  });
});