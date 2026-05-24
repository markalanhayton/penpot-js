import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  supportedFeatures, defaultFeatures, frontendOnlyFeatures,
  backendOnlyFeatures, noTeamInheritableFeatures, noMigrationFeatures,
  migrateLegacyFeatures, getEnabledFeatures, getTeamEnabledFeatures,
  checkClientFeatures
} from '@penpot/shared/features';

describe('features', () => {
  it('supportedFeatures has entries', () => {
    assert.ok(supportedFeatures.has('components/v2'));
    assert.ok(supportedFeatures.has('render-wasm/v1'));
    assert.ok(supportedFeatures.size > 10);
  });

  it('defaultFeatures has entries', () => {
    assert.ok(defaultFeatures.has('components/v2'));
    assert.ok(defaultFeatures.has('styles/v2'));
  });

  it('frontendOnlyFeatures', () => {
    assert.ok(frontendOnlyFeatures.has('text-editor/v2'));
    assert.ok(frontendOnlyFeatures.has('render-wasm/v1'));
  });

  it('backendOnlyFeatures', () => {
    assert.ok(backendOnlyFeatures.has('fdata/objects-map'));
    assert.ok(backendOnlyFeatures.has('fdata/pointer-map'));
  });

  it('noTeamInheritableFeatures', () => {
    assert.ok(noTeamInheritableFeatures.has('fdata/path-data'));
  });

  it('noMigrationFeatures is superset', () => {
    assert.ok(noMigrationFeatures.size >= frontendOnlyFeatures.size + backendOnlyFeatures.size);
  });

  it('migrateLegacyFeatures', () => {
    const result = migrateLegacyFeatures(new Set(['storage/pointer-map', 'storage/objects-map']));
    assert.ok(result.has('fdata/pointer-map'));
    assert.ok(result.has('fdata/objects-map'));
    assert.ok(!result.has('storage/pointer-map'));
  });

  it('migrateLegacyFeatures internal/geom-record', () => {
    const result = migrateLegacyFeatures(new Set(['internal/geom-record']));
    assert.ok(result.has('fdata/shape-data-type'));
    assert.ok(!result.has('internal/geom-record'));
  });

  it('getEnabledFeatures', () => {
    const flags = ['feature-styles-v2', 'feature-render-wasm'];
    const features = getEnabledFeatures(flags);
    assert.ok(features.has('styles/v2'));
    assert.ok(features.has('render-wasm/v1'));
    assert.ok(features.has('components/v2'));
  });

  it('getTeamEnabledFeatures', () => {
    const flags = ['feature-render-wasm'];
    const team = { features: new Set(['components/v2']) };
    const features = getTeamEnabledFeatures(flags, team);
    assert.ok(features.has('components/v2'));
  });

  it('checkClientFeatures passes with matching features', () => {
    const enabled = new Set(['components/v2', 'styles/v2']);
    const client = new Set(['components/v2', 'styles/v2']);
    const result = checkClientFeatures(enabled, client);
    assert.ok(result.has('components/v2'));
  });

  it('checkClientFeatures passes when missing frontend-only', () => {
    const enabled = new Set(['components/v2', 'render-wasm/v1']);
    const client = new Set(['components/v2']);
    const result = checkClientFeatures(enabled, client);
    assert.ok(result instanceof Set);
  });
});