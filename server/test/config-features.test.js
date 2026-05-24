import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultFeatures,
  supportedFeatures,
  noMigrationFeatures,
  frontendOnlyFeatures,
  backendOnlyFeatures,
  noTeamInheritableFeatures,
  parseFeatures,
  serializeFeatures,
  getEnabledFeatures,
  getTeamEnabledFeatures,
  computeFileFeatures,
  computeNewTeamFeatures,
  checkClientFeatures,
  FLAG_FEATURE_MAP,
} from '../src/config/features.js';
import { RpcError } from '../src/rpc/dispatcher.js';

describe('features constants', () => {
  it('defaultFeatures is a subset of supportedFeatures', () => {
    for (const f of defaultFeatures) {
      assert.ok(supportedFeatures.has(f), `default feature "${f}" not in supportedFeatures`);
    }
  });

  it('frontendOnlyFeatures is a subset of supportedFeatures', () => {
    for (const f of frontendOnlyFeatures) {
      assert.ok(supportedFeatures.has(f), `frontend-only "${f}" not in supportedFeatures`);
    }
  });

  it('backendOnlyFeatures is a subset of supportedFeatures', () => {
    for (const f of backendOnlyFeatures) {
      assert.ok(supportedFeatures.has(f), `backend-only "${f}" not in supportedFeatures`);
    }
  });

  it('noMigrationFeatures includes frontendOnly and backendOnly', () => {
    for (const f of frontendOnlyFeatures) assert.ok(noMigrationFeatures.has(f));
    for (const f of backendOnlyFeatures) assert.ok(noMigrationFeatures.has(f));
  });

  it('FLAG_FEATURE_MAP has string values in supportedFeatures', () => {
    for (const [flag, feature] of Object.entries(FLAG_FEATURE_MAP)) {
      assert.ok(supportedFeatures.has(feature), `feature "${feature}" from flag "${flag}" not in supportedFeatures`);
    }
  });
});

describe('parseFeatures', () => {
  it('parses JSON array', () => {
    const result = parseFeatures('["components/v2","layout/grid"]');
    assert.deepEqual([...result], ['components/v2', 'layout/grid']);
  });

  it('parses empty JSON object', () => {
    assert.equal(parseFeatures('{}').size, 0);
  });

  it('parses null', () => {
    assert.equal(parseFeatures(null).size, 0);
  });

  it('parses undefined', () => {
    assert.equal(parseFeatures(undefined).size, 0);
  });

  it('parses an array directly', () => {
    const result = parseFeatures(['a', 'b']);
    assert.deepEqual([...result], ['a', 'b']);
  });

  it('parses a Set directly', () => {
    const s = new Set(['x']);
    assert.equal(parseFeatures(s), s);
  });
});

describe('serializeFeatures', () => {
  it('serializes to JSON array', () => {
    const result = serializeFeatures(new Set(['components/v2']));
    assert.equal(result, '["components/v2"]');
  });

  it('empty set serializes to empty array', () => {
    assert.equal(serializeFeatures(new Set()), '[]');
  });
});

describe('getEnabledFeatures', () => {
  it('returns defaultFeatures when no flags are set', () => {
    const result = getEnabledFeatures({});
    for (const f of defaultFeatures) {
      assert.ok(result.has(f), `missing default feature: ${f}`);
    }
  });

  it('includes flag-derived features', () => {
    const result = getEnabledFeatures({ feature_design_tokens: true });
    assert.ok(result.has('design-tokens/v1'));
  });
});

describe('getTeamEnabledFeatures', () => {
  it('combines global no-migration features with team features', () => {
    const team = { features: '["components/v2"]' };
    const result = getTeamEnabledFeatures({}, team);
    assert.ok(result.has('components/v2'));
  });

  it('returns no-migration features even when team has none', () => {
    const team = { features: '[]' };
    const result = getTeamEnabledFeatures({}, team);
    assert.ok(result.size > 0);
  });
});

describe('computeFileFeatures', () => {
  it('unions team features with client no-migration features', () => {
    const teamFeatures = new Set(['components/v2']);
    const clientFeatures = ['variants/v1'];
    const result = computeFileFeatures(teamFeatures, clientFeatures);
    assert.ok(result.has('components/v2'));
    assert.ok(result.has('variants/v1'));
  });

  it('excludes frontend-only features from client input', () => {
    const teamFeatures = new Set(['components/v2']);
    const clientFeatures = ['text-editor/v2'];
    const result = computeFileFeatures(teamFeatures, clientFeatures);
    assert.ok(!result.has('text-editor/v2'));
  });

  it('filters unsupported features', () => {
    const teamFeatures = new Set(['components/v2']);
    const result = computeFileFeatures(teamFeatures, ['not-a-real-feature']);
    assert.ok(!result.has('not-a-real-feature'));
  });
});

describe('computeNewTeamFeatures', () => {
  it('finds features in file but not in team', () => {
    const fileFeatures = new Set(['layout/grid', 'components/v2']);
    const teamFeatures = new Set(['components/v2']);
    const result = computeNewTeamFeatures(fileFeatures, teamFeatures);
    assert.ok(result);
    assert.ok(result.has('layout/grid'));
  });

  it('returns null when no new features', () => {
    const fileFeatures = new Set(['fdata/path-data', 'fdata/shape-data-type']);
    const teamFeatures = new Set();
    const result = computeNewTeamFeatures(fileFeatures, teamFeatures);
    assert.equal(result, null);
  });
});

describe('checkClientFeatures', () => {
  it('passes when client supports all required features', () => {
    const enabled = new Set(['components/v2']);
    const client = ['components/v2'];
    const result = checkClientFeatures(enabled, client, RpcError);
    assert.ok(result.has('components/v2'));
  });

  it('passes when client is null (non-set)', () => {
    const enabled = new Set(['components/v2']);
    const result = checkClientFeatures(enabled, null, RpcError);
    assert.equal(result, enabled);
  });

  it('throws when client lacks a required feature', () => {
    const enabled = new Set(['components/v2', 'layout/grid']);
    const client = ['components/v2'];
    assert.throws(() => checkClientFeatures(enabled, client, RpcError), {
      type: 'restriction',
    });
  });

  it('does not throw for missing frontend-only features', () => {
    const enabled = new Set(['text-editor/v2']);
    const client = [];
    const result = checkClientFeatures(enabled, client, RpcError);
    assert.ok(result.has('text-editor/v2'));
  });
});