import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import registerLdapCommands from '../src/rpc/ldap.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

describe('LDAP RPC — login-with-ldap', () => {
  let pool;
  let dispatcher;

  beforeEach(() => {
    pool = createTestPool();
    seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerLdapCommands(dispatcher.register, pool);
  });

  afterEach(() => {
    destroyTestPool(pool);
    delete process.env.PENPOT_LDAP_URL;
    delete process.env.PENPOT_LDAP_BASE_DN;
    delete process.env.PENPOT_LDAP_BIND_DN;
    delete process.env.PENPOT_LDAP_BIND_PASSWORD;
  });

  it('throws ldap-not-initialized when PENPOT_LDAP_URL is not configured', async () => {
    delete process.env.PENPOT_LDAP_URL;

    const handler = dispatcher.methods.get('login-with-ldap').handler;
    await assert.rejects(
      () => handler({ email: 'user@example.com', password: 'pass' }, {}),
      { code: 'ldap-not-initialized' }
    );
  });

  it('throws wrong-credentials when email is missing', async () => {
    process.env.PENPOT_LDAP_URL = 'ldap://localhost:389';

    const handler = dispatcher.methods.get('login-with-ldap').handler;
    await assert.rejects(
      () => handler({ password: 'pass' }, {}),
      { code: 'wrong-credentials' }
    );
  });

  it('throws wrong-credentials when password is missing', async () => {
    process.env.PENPOT_LDAP_URL = 'ldap://localhost:389';

    const handler = dispatcher.methods.get('login-with-ldap').handler;
    await assert.rejects(
      () => handler({ email: 'user@example.com' }, {}),
      { code: 'wrong-credentials' }
    );
  });

  it('throws wrong-credentials when both email and password are missing', async () => {
    process.env.PENPOT_LDAP_URL = 'ldap://localhost:389';

    const handler = dispatcher.methods.get('login-with-ldap').handler;
    await assert.rejects(
      () => handler({}, {}),
      { code: 'wrong-credentials' }
    );
  });

  it('throws wrong-credentials when LDAP server is unreachable', async () => {
    process.env.PENPOT_LDAP_URL = 'ldap://127.0.0.1:33389';

    const handler = dispatcher.methods.get('login-with-ldap').handler;
    await assert.rejects(
      () => handler({ email: 'user@example.com', password: 'pass123' }, {}),
      { code: 'wrong-credentials' }
    );
  });

  it('requires PENPOT_LDAP_URL to be set — empty string is not enough', async () => {
    process.env.PENPOT_LDAP_URL = '';

    const handler = dispatcher.methods.get('login-with-ldap').handler;
    await assert.rejects(
      () => handler({ email: 'user@example.com', password: 'pass' }, {}),
      { code: 'ldap-not-initialized' }
    );
  });
});