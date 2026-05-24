import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import registerAccessTokenCommands from '../src/rpc/access_token.js';

function captureHandlers(pool) {
  const handlers = {};
  const register = (name, def) => { handlers[name] = def.handler; };
  registerAccessTokenCommands(register, pool);
  return handlers;
}

describe('rpc/access-token — create-access-token', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('creates a token with ptpat prefix', async () => {
    const result = await handlers['create-access-token'](
      { name: 'CI Token', perms: ['read'] },
      { profileId: ids.profileId }
    );
    assert.ok(result.id);
    assert.ok(result.token.startsWith('ptpat_'));
    assert.equal(result.name, 'CI Token');
    assert.deepEqual(result.perms, ['read']);

    const row = pool.get('SELECT * FROM access_token WHERE profile_id = ?', [ids.profileId]);
    assert.ok(row);
    assert.equal(row.name, 'CI Token');
  });

  it('defaults perms to read only', async () => {
    const result = await handlers['create-access-token'](
      { name: 'Default' },
      { profileId: ids.profileId }
    );
    assert.deepEqual(result.perms, ['read']);
  });
});

describe('rpc/access-token — delete-access-token', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('deletes an access token', async () => {
    const created = await handlers['create-access-token'](
      { name: 'To Delete' },
      { profileId: ids.profileId }
    );

    const result = await handlers['delete-access-token']({ id: created.id });
    assert.equal(result.id, created.id);

    const row = pool.get('SELECT * FROM access_token WHERE id = ?', [created.id]);
    assert.equal(row, undefined);
  });
});

describe('rpc/access-token — get-access-tokens', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns tokens for a profile', async () => {
    await handlers['create-access-token'](
      { name: 'Token 1' },
      { profileId: ids.profileId }
    );
    await handlers['create-access-token'](
      { name: 'Token 2', perms: ['read', 'write'] },
      { profileId: ids.profileId }
    );

    const tokens = await handlers['get-access-tokens']({}, { profileId: ids.profileId });
    assert.equal(tokens.length, 2);
    assert.ok(tokens.every(t => t.name));
  });

  it('returns empty for profile with no tokens', async () => {
    const tokens = await handlers['get-access-tokens']({}, { profileId: ids.profileId });
    assert.deepEqual(tokens, []);
  });
});

describe('rpc/access-token — get-current-mcp-token', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('creates an MCP token', async () => {
    const result = await handlers['get-current-mcp-token'](
      {},
      { profileId: ids.profileId }
    );
    assert.ok(result.id);
    assert.ok(result.token.startsWith('ptpat_mcp_'));
    assert.equal(result.name, 'mcp-token');
    assert.deepEqual(result.perms, ['read', 'write']);
  });
});