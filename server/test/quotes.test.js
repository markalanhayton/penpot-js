import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { checkQuota } from '../src/middleware/quotes.js';
import { RpcError } from '../src/rpc/dispatcher.js';
import { v4 as uuidv4 } from 'uuid';

describe('checkQuota', () => {
  let pool;
  let ids;

  beforeEach(() => { pool = createTestPool(); ids = seedFullHierarchy(pool); });
  afterEach(() => { destroyTestPool(pool); });

  it('does not throw when under limit', () => {
    checkQuota(pool, 'files-per-project', {
      profileId: ids.profileId,
      teamId: ids.teamId,
      projectId: ids.projectId,
    });
  });

  it('throws when quota exceeded (add override row)', () => {
    pool.insertReturning('usage_quote', {
      id: uuidv4(),
      target: 'quotes-files-per-project',
      quote: 1,
      project_id: ids.projectId,
    });
    assert.throws(() => checkQuota(pool, 'files-per-project', {
      profileId: ids.profileId,
      teamId: ids.teamId,
      projectId: ids.projectId,
    }), RpcError);
  });

  it('handles unknown quota type', () => {
    assert.throws(() => checkQuota(pool, 'nonexistent-quota', {}), RpcError);
  });
});