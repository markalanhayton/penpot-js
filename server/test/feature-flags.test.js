import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { backendOnlyFeatures, supportedFeatures, FLAG_FEATURE_MAP } from '../src/config/features.js';
import { flagEnabled } from '../src/config/index.js';

describe('Feature flags', () => {
  describe('flagEnabled', () => {
    it('returns true for default-enabled flags', () => {
      assert.equal(flagEnabled('registration'), true);
      assert.equal(flagEnabled('login_with_password'), true);
      assert.equal(flagEnabled('quotes'), true);
    });

    it('returns false for default-disabled flags', () => {
      assert.equal(flagEnabled('login_with_oidc'), false);
      assert.equal(flagEnabled('login_with_google'), false);
      assert.equal(flagEnabled('telemetry'), false);
    });

    it('normalizes hyphens to underscores', () => {
      assert.equal(flagEnabled('login-with-password'), true);
      assert.equal(flagEnabled('login_with_password'), true);
    });

    it('handles file_migrations flag', () => {
      assert.equal(flagEnabled('file_migrations'), true);
      assert.equal(flagEnabled('file-migrations'), true);
    });

    it('handles fdata flag', () => {
      assert.equal(flagEnabled('fdata'), false);
    });
  });

  describe('Flag parsing logic', () => {
    function parseFlags(flagsStr) {
      return (flagsStr || '')
        .split(/\s+/)
        .filter(Boolean)
        .reduce((acc, flag) => {
          if (flag.startsWith('enable-')) acc[flag.slice(7).replace(/-/g, '_')] = true;
          if (flag.startsWith('disable-')) acc[flag.slice(8).replace(/-/g, '_')] = false;
          return acc;
        }, {});
    }

    it('parses enable- prefix correctly', () => {
      const flags = parseFlags('enable-fdata enable-telemetry');
      assert.equal(flags.fdata, true);
      assert.equal(flags.telemetry, true);
    });

    it('parses disable- prefix correctly (slice(8) not slice(9))', () => {
      const flags = parseFlags('disable-file-migrations');
      assert.equal(flags.file_migrations, false);
      assert.equal(flags.ile_migrations, undefined);
    });

    it('parses mixed enable/disable flags', () => {
      const flags = parseFlags('enable-fdata disable-registration enable-telemetry');
      assert.equal(flags.fdata, true);
      assert.equal(flags.registration, false);
      assert.equal(flags.telemetry, true);
    });

    it('converts hyphens to underscores', () => {
      const flags = parseFlags('enable-login-with-password');
      assert.equal(flags.login_with_password, true);
    });

    it('handles empty flags string', () => {
      const flags = parseFlags('');
      assert.deepEqual(flags, {});
    });
  });

  describe('BE-8: file_migrations feature flag', () => {
    it('defaults to true (migrations enabled)', () => {
      assert.equal(flagEnabled('file_migrations'), true);
    });
  });

  describe('BE-9: fdata feature flag', () => {
    it('defaults to false (inline JSON storage)', () => {
      assert.equal(flagEnabled('fdata'), false);
    });

    it('fdata/pointer-map is in backendOnlyFeatures', () => {
      assert.equal(backendOnlyFeatures.has('fdata/pointer-map'), true);
    });

    it('fdata/objects-map is in backendOnlyFeatures', () => {
      assert.equal(backendOnlyFeatures.has('fdata/objects-map'), true);
    });

    it('fdata/pointer-map is in supportedFeatures', () => {
      assert.equal(supportedFeatures.has('fdata/pointer-map'), true);
    });

    it('fdata/objects-map is in supportedFeatures', () => {
      assert.equal(supportedFeatures.has('fdata/objects-map'), true);
    });

    it('maps feature_fdata_objects_map in FLAG_FEATURE_MAP', () => {
      assert.equal(FLAG_FEATURE_MAP.feature_fdata_objects_map, 'fdata/objects-map');
    });

    it('maps feature_fdata_pointer_map in FLAG_FEATURE_MAP', () => {
      assert.equal(FLAG_FEATURE_MAP.feature_fdata_pointer_map, 'fdata/pointer-map');
    });
  });
});