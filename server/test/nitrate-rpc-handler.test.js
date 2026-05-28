import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import registerNitrateCommands from '../src/rpc/nitrate.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

describe('Nitrate RPC — get-nitrate-connectivity', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerNitrateCommands(dispatcher.register, pool);
  });

  afterEach(() => {
    destroyTestPool(pool);
    delete process.env.PENPOT_NITRATE_HOST;
    delete process.env.PENPOT_NITRATE_URL;
  });

  it('throws nitrate-not-configured when no nitrate URL is set', async () => {
    delete process.env.PENPOT_NITRATE_HOST;
    delete process.env.PENPOT_NITRATE_URL;

    const handler = dispatcher.methods.get('get-nitrate-connectivity').handler;
    await assert.rejects(
      () => handler({}, { profileId: ids.profileId }),
      { code: 'nitrate-not-configured' }
    );
  });

  it('returns connected:false when nitrate host is unreachable', async () => {
    process.env.PENPOT_NITRATE_HOST = 'http://127.0.0.1:9999';

    const handler = dispatcher.methods.get('get-nitrate-connectivity').handler;
    const result = await handler({}, { profileId: ids.profileId });

    assert.equal(result.connected, false);
    assert.equal(result.licenses, false);
  });
});

describe('Nitrate RPC — redeem-nitrate-activation-code', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    process.env.PENPOT_NITRATE_HOST = 'http://127.0.0.1:9999';
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerNitrateCommands(dispatcher.register, pool);
  });

  afterEach(() => {
    destroyTestPool(pool);
    delete process.env.PENPOT_NITRATE_HOST;
    delete process.env.PENPOT_NITRATE_URL;
  });

  it('throws validation error when activation code is missing', async () => {
    const handler = dispatcher.methods.get('redeem-nitrate-activation-code').handler;
    await assert.rejects(
      () => handler({}, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });

  it('throws not-found for non-existent profile', async () => {
    const handler = dispatcher.methods.get('redeem-nitrate-activation-code').handler;
    await assert.rejects(
      () => handler({ activationCode: 'SOME-CODE' }, { profileId: uuidv4() }),
      { code: 'object-not-found' }
    );
  });

  it('throws invalid-activation-code for present profile (stub always rejects)', async () => {
    const handler = dispatcher.methods.get('redeem-nitrate-activation-code').handler;
    await assert.rejects(
      () => handler({ activationCode: 'TEST-CODE-123' }, { profileId: ids.profileId }),
      { code: 'invalid-activation-code' }
    );
  });
});

describe('Nitrate RPC — leave-org', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    process.env.PENPOT_NITRATE_HOST = 'http://127.0.0.1:9999';
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerNitrateCommands(dispatcher.register, pool);
  });

  afterEach(() => {
    destroyTestPool(pool);
    delete process.env.PENPOT_NITRATE_HOST;
    delete process.env.PENPOT_NITRATE_URL;
  });

  it('soft-deletes teams in teamsToDelete list', async () => {
    const handler = dispatcher.methods.get('leave-org').handler;
    const result = await handler({
      teamsToDelete: [ids.teamId],
      teamsToLeave: [],
    }, { profileId: ids.profileId });

    assert.equal(result, null);

    const team = pool.get('SELECT * FROM team WHERE id = ?', [ids.teamId]);
    assert.ok(team.deleted_at);
    assert.ok(team.name.startsWith('[left] '));
  });

  it('removes profile from teams in teamsToLeave list', async () => {
    const handler = dispatcher.methods.get('leave-org').handler;
    const result = await handler({
      teamsToDelete: [],
      teamsToLeave: [{ id: ids.teamId }],
    }, { profileId: ids.profileId });

    assert.equal(result, null);

    const rel = pool.get(
      'SELECT * FROM team_profile_rel WHERE team_id = ? AND profile_id = ?',
      [ids.teamId, ids.profileId]
    );
    assert.equal(rel, undefined);
  });

  it('renames default team with no files when defaultTeamId is provided', async () => {
    pool.run('UPDATE file SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), ids.fileId]);

    const handler = dispatcher.methods.get('leave-org').handler;
    await handler({
      teamsToDelete: [],
      teamsToLeave: [],
      defaultTeamId: ids.teamId,
    }, { profileId: ids.profileId });

    const team = pool.get('SELECT * FROM team WHERE id = ?', [ids.teamId]);
    assert.ok(team.name.startsWith('[left] '));
    assert.equal(team.is_default, '0');
  });
});

describe('Nitrate RPC — remove-team-from-org', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    process.env.PENPOT_NITRATE_HOST = 'http://127.0.0.1:9999';
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerNitrateCommands(dispatcher.register, pool);
  });

  afterEach(() => {
    destroyTestPool(pool);
    delete process.env.PENPOT_NITRATE_HOST;
    delete process.env.PENPOT_NITRATE_URL;
  });

  it('throws access-denied when profile is not team owner', async () => {
    pool.run(
      "UPDATE team_profile_rel SET is_owner = '0' WHERE team_id = ? AND profile_id = ?",
      [ids.teamId, ids.profileId]
    );

    const handler = dispatcher.methods.get('remove-team-from-org').handler;
    await assert.rejects(
      () => handler({ teamId: ids.teamId, organizationId: uuidv4() }, { profileId: ids.profileId }),
      { code: 'access-denied' }
    );
  });

  it('throws validation error when trying to remove default team', async () => {
    const handler = dispatcher.methods.get('remove-team-from-org').handler;
    await assert.rejects(
      () => handler({ teamId: ids.teamId, organizationId: uuidv4() }, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });

  it('returns null when owner removes non-default team from org', async () => {
    const nonDefaultTeamId = uuidv4();
    pool.insertReturning('team', {
      id: nonDefaultTeamId, name: 'Non-Default Team', is_default: '0',
      features: '[]', created_at: new Date().toISOString(), modified_at: new Date().toISOString(),
    });
    pool.insertReturning('team_profile_rel', {
      team_id: nonDefaultTeamId, profile_id: ids.profileId,
      is_owner: '1', is_admin: '1', can_edit: '1', is_member: '1',
      created_at: new Date().toISOString(), modified_at: new Date().toISOString(),
    });

    const handler = dispatcher.methods.get('remove-team-from-org').handler;
    const result = await handler({ teamId: nonDefaultTeamId, organizationId: uuidv4() }, { profileId: ids.profileId });
    assert.equal(result, null);
  });
});

describe('Nitrate RPC — add-team-to-organization', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    process.env.PENPOT_NITRATE_HOST = 'http://127.0.0.1:9999';
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerNitrateCommands(dispatcher.register, pool);
  });

  afterEach(() => {
    destroyTestPool(pool);
    delete process.env.PENPOT_NITRATE_HOST;
    delete process.env.PENPOT_NITRATE_URL;
  });

  it('throws access-denied when profile is not team owner', async () => {
    pool.run(
      "UPDATE team_profile_rel SET is_owner = '0' WHERE team_id = ? AND profile_id = ?",
      [ids.teamId, ids.profileId]
    );

    const handler = dispatcher.methods.get('add-team-to-organization').handler;
    await assert.rejects(
      () => handler({ teamId: ids.teamId, organizationId: uuidv4() }, { profileId: ids.profileId }),
      { code: 'access-denied' }
    );
  });

  it('throws validation error when trying to add default team to organization', async () => {
    const handler = dispatcher.methods.get('add-team-to-organization').handler;
    await assert.rejects(
      () => handler({ teamId: ids.teamId, organizationId: uuidv4() }, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });

  it('returns null when owner adds non-default team to organization', async () => {
    const nonDefaultTeamId = uuidv4();
    pool.insertReturning('team', {
      id: nonDefaultTeamId, name: 'Non-Default Team', is_default: '0',
      features: '[]', created_at: new Date().toISOString(), modified_at: new Date().toISOString(),
    });
    pool.insertReturning('team_profile_rel', {
      team_id: nonDefaultTeamId, profile_id: ids.profileId,
      is_owner: '1', is_admin: '1', can_edit: '1', is_member: '1',
      created_at: new Date().toISOString(), modified_at: new Date().toISOString(),
    });

    const handler = dispatcher.methods.get('add-team-to-organization').handler;
    const result = await handler({ teamId: nonDefaultTeamId, organizationId: uuidv4() }, { profileId: ids.profileId });
    assert.equal(result, null);
  });
});