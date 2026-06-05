import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuidv4 } from 'uuid';
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

  it('persists MCP token in access_token table', async () => {
    const first = await handlers['get-current-mcp-token'](
      {},
      { profileId: ids.profileId }
    );

    const tokens = await handlers['get-access-tokens']({}, { profileId: ids.profileId });
    const mcpTokens = tokens.filter(t => t.name === 'mcp-token');
    assert.equal(mcpTokens.length, 1);
    assert.equal(mcpTokens[0].id, first.id);
  });

  it('creates a new MCP token on each call (no deduplication)', async () => {
    await handlers['get-current-mcp-token']({}, { profileId: ids.profileId });
    await handlers['get-current-mcp-token']({}, { profileId: ids.profileId });

    const tokens = await handlers['get-access-tokens']({}, { profileId: ids.profileId });
    const mcpTokens = tokens.filter(t => t.name === 'mcp-token');
    assert.equal(mcpTokens.length, 2);
  });
});

describe('rpc/access-token — get-api-tokens', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns empty array when no api tokens exist', async () => {
    const result = await handlers['get-api-tokens']({}, { profileId: ids.profileId });
    assert.deepEqual(result, []);
  });

  it('returns only api type tokens', async () => {
    await handlers['create-access-token'](
      { name: 'Personal', type: 'personal', perms: ['read'] },
      { profileId: ids.profileId }
    );

    pool.insertReturning('access_token', {
      id: uuidv4(),
      profile_id: ids.profileId,
      name: 'API Key',
      type: 'api',
      token: 'ptpat_api_test',
      perms: JSON.stringify(['read']),
      scopes: JSON.stringify(['files:read', 'files:write']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await handlers['get-api-tokens']({}, { profileId: ids.profileId });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'API Key');
    assert.deepEqual(result[0].scopes, ['files:read', 'files:write']);
  });

  it('parses scopes JSON correctly', async () => {
    pool.insertReturning('access_token', {
      id: uuidv4(),
      profile_id: ids.profileId,
      name: 'Scoped Token',
      type: 'api',
      token: 'ptpat_api_scoped',
      perms: JSON.stringify(['read']),
      scopes: JSON.stringify(['teams:read', 'projects:write']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await handlers['get-api-tokens']({}, { profileId: ids.profileId });
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].scopes, ['teams:read', 'projects:write']);
  });

  it('handles malformed scopes gracefully', async () => {
    pool.insertReturning('access_token', {
      id: uuidv4(),
      profile_id: ids.profileId,
      name: 'Bad Scopes',
      type: 'api',
      token: 'ptpat_api_bad',
      perms: JSON.stringify(['read']),
      scopes: 'not-valid-json',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await handlers['get-api-tokens']({}, { profileId: ids.profileId });
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].scopes, []);
  });
});

describe('rpc/access-token — create-access-token edge cases', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('creates token with custom scopes', async () => {
    const result = await handlers['create-access-token'](
      { name: 'Scoped', perms: ['read'], scopes: ['files:read', 'teams:read'] },
      { profileId: ids.profileId }
    );
    assert.deepEqual(result.scopes, ['files:read', 'teams:read']);
  });

  it('creates token with expiration', async () => {
    const expiresAt = '2027-01-01T00:00:00.000Z';
    const result = await handlers['create-access-token'](
      { name: 'Expiring', perms: ['read'], expiration: expiresAt },
      { profileId: ids.profileId }
    );
    assert.equal(result.expiresAt, expiresAt);
  });

  it('defaults scopes to empty array', async () => {
    const result = await handlers['create-access-token'](
      { name: 'No Scopes', perms: ['read'] },
      { profileId: ids.profileId }
    );
    assert.deepEqual(result.scopes, []);
  });

  it('defaults type to personal', async () => {
    const result = await handlers['create-access-token'](
      { name: 'Default Type' },
      { profileId: ids.profileId }
    );
    assert.equal(result.type, 'personal');
  });
});

describe('rpc/access-token — delete-access-token edge cases', () => {
  let pool;
  let ids;
  let handlers;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    handlers = captureHandlers(pool);
  });
  afterEach(() => { destroyTestPool(pool); });

  it('returns id when deleting existing token', async () => {
    const created = await handlers['create-access-token'](
      { name: 'To Delete', perms: ['read'] },
      { profileId: ids.profileId }
    );

    const result = await handlers['delete-access-token']({ id: created.id });
    assert.equal(result.id, created.id);
  });

  it('succeeds for non-existent token (idempotent)', async () => {
    const fakeId = uuidv4();
    const result = await handlers['delete-access-token']({ id: fakeId });
    assert.equal(result.id, fakeId);
  });
});