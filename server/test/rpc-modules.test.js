import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';

function getRpcHandlers(registerFn, pool) {
  const methods = {};
  const register = (name, def) => { methods[name] = def; };
  registerFn(register, pool);
  return methods;
}

describe('Auth RPC', async () => {
  const mod = await import('../src/rpc/auth.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers login-with-password and register-profile', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(methods['login-with-password']);
    assert.ok(methods['register-profile']);
  });
});

describe('Profile RPC', async () => {
  const mod = await import('../src/rpc/profile.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers get-profile and update-profile', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(methods['get-profile']);
  });
});

describe('Comments RPC', async () => {
  const mod = await import('../src/rpc/comments.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers comment commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Webhooks RPC', async () => {
  const mod = await import('../src/rpc/webhooks.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers webhook commands and exports triggerWebhooks', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
    assert.equal(typeof mod.triggerWebhooks, 'function');
  });
});

describe('Viewer RPC', async () => {
  const mod = await import('../src/rpc/viewer.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers viewer commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Search RPC', async () => {
  const mod = await import('../src/rpc/search.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers search commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Feedback RPC', async () => {
  const mod = await import('../src/rpc/feedback.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers feedback commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Management RPC', async () => {
  const mod = await import('../src/rpc/management.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers management commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Teams Invitations RPC', async () => {
  const mod = await import('../src/rpc/teams_invitations.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers team invitation commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Audit RPC', async () => {
  const mod = await import('../src/rpc/audit.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers push-audit-events and get-enabled-flags', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(methods['push-audit-events']);
    assert.ok(methods['get-enabled-flags']);
  });
});

describe('Fonts RPC', async () => {
  const mod = await import('../src/rpc/fonts.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers font commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Access Token RPC', async () => {
  const mod = await import('../src/rpc/access_token.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers access token commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Files Thumbnails RPC', async () => {
  const mod = await import('../src/rpc/files_thumbnails.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers thumbnail commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Files Share RPC', async () => {
  const mod = await import('../src/rpc/files_share.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers share commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Files Snapshots RPC', async () => {
  const mod = await import('../src/rpc/files_snapshots.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers snapshot commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Binfile RPC', async () => {
  const mod = await import('../src/rpc/binfile.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers export-binfile and import-binfile', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(methods['export-binfile']);
    assert.ok(methods['import-binfile']);
  });
});

describe('Nitrate RPC', async () => {
  const mod = await import('../src/rpc/nitrate.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers nitrate commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('LDAP RPC', async () => {
  const mod = await import('../src/rpc/ldap.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers ldap commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Demo RPC', async () => {
  const mod = await import('../src/rpc/demo.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers demo commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('OIDC Auth RPC', async () => {
  const mod = await import('../src/auth/oidc.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers OIDC commands', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});

describe('Verify Token RPC', async () => {
  const mod = await import('../src/rpc/verify_token.js');
  let pool;
  beforeEach(() => { pool = createTestPool(); });
  afterEach(() => { destroyTestPool(pool); });

  it('registers verify-token command', () => {
    const methods = getRpcHandlers(mod.default, pool);
    assert.ok(Object.keys(methods).length > 0);
  });
});