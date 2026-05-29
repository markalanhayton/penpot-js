'use strict';
/**
 * @module config/features
 * @description Feature flag constants and computation — mirrors `app.common.features`
 * from the Clojure common module.
 *
 * Defines the feature sets used when creating files and computing team-level
 * features. The logic follows the Clojure implementation closely:
 *
 * - `defaultFeatures` are enabled for all teams/files.
 * - `noMigrationFeatures` don't require a file data migration.
 * - `frontendOnlyFeatures` are not persisted on the file but can be on the team.
 * - `backendOnlyFeatures` have proper fallbacks on the frontend.
 * - `noTeamInheritableFeatures` are not propagated to the team on file creation.
 *
 * @see common/src/app/common/features.cljc
 */

/**
 * All features the system knows about. Any feature not in this set is
 * rejected during file creation / update.
 * @type {Set<string>}
 */
export const supportedFeatures = new Set([
  'fdata/objects-map',
  'fdata/pointer-map',
  'fdata/shape-data-type',
  'fdata/path-data',
  'components/v2',
  'styles/v2',
  'layout/grid',
  'plugins/runtime',
  'tokens/numeric-input',
  'design-tokens/v1',
  'text-editor/v2-html-paste',
  'text-editor/v2',
  'text-editor-wasm/v1',
  'render-wasm/v1',
  'variants/v1',
]);

/**
 * Features enabled by default for all teams/files.
 * @type {Set<string>}
 */
export const defaultFeatures = new Set([
  'fdata/shape-data-type',
  'fdata/path-data',
  'styles/v2',
  'layout/grid',
  'components/v2',
  'plugins/runtime',
  'design-tokens/v1',
  'tokens/numeric-input',
  'variants/v1',
]);

/**
 * Features that only affect the frontend and are not persisted on the file
 * (but can be permanently enabled on the team).
 * @type {Set<string>}
 */
export const frontendOnlyFeatures = new Set([
  'styles/v2',
  'plugins/runtime',
  'text-editor/v2-html-paste',
  'text-editor/v2',
  'text-editor-wasm/v1',
  'tokens/numeric-input',
  'render-wasm/v1',
  'fdata/pointer-map',
  'fdata/objects-map',
]);

/**
 * Backend-only features that have proper fallback on the frontend.
 * @type {Set<string>}
 */
export const backendOnlyFeatures = new Set([
  'fdata/pointer-map',
  'fdata/objects-map',
]);

/**
 * Features that should not be propagated to the team when a file is
 * created or modified.
 * @type {Set<string>}
 */
export const noTeamInheritableFeatures = new Set([
  'fdata/path-data',
  'fdata/shape-data-type',
]);

/**
 * Features that do not require an explicit file data migration (or
 * the migration is not mandatory). This is the union of specific
 * features, `frontendOnlyFeatures`, and `backendOnlyFeatures`.
 * @type {Set<string>}
 */
export const noMigrationFeatures = new Set([
  'layout/grid',
  'design-tokens/v1',
  'fdata/shape-data-type',
  'fdata/path-data',
  'tokens/numeric-input',
  'variants/v1',
  ...frontendOnlyFeatures,
  ...backendOnlyFeatures,
]);

/**
 * Map from PENPOT_FLAGS flag names (with hyphens or underscores) to
 * feature identifiers used in the file/team feature sets.
 * Keys use underscore form to match `flagEnabled()` lookups.
 */
export const FLAG_FEATURE_MAP = {
  feature_styles_v2: 'styles/v2',
  feature_fdata_objects_map: 'fdata/objects-map',
  feature_fdata_pointer_map: 'fdata/pointer-map',
  feature_plugins: 'plugins/runtime',
  feature_design_tokens: 'design-tokens/v1',
  feature_text_editor_v2: 'text-editor/v2',
  feature_text_editor_v2_html_paste: 'text-editor/v2-html-paste',
  feature_text_editor_wasm_v1: 'text-editor-wasm/v1',
  feature_render_wasm: 'render-wasm/v1',
  feature_variants: 'variants/v1',
  feature_token_input: 'tokens/numeric-input',
};

/**
 * Get the globally enabled feature set derived from the current feature
 * flags. Returns `defaultFeatures` union with any flag-derived features.
 *
 * @param {Record<string, boolean>} flags - The merged feature flags object.
 * @returns {Set<string>} The set of globally enabled feature identifiers.
 */
export function getEnabledFeatures(flags) {
  const result = new Set(defaultFeatures);
  for (const [flag, feature] of Object.entries(FLAG_FEATURE_MAP)) {
    if (flags[flag]) result.add(feature);
  }
  return result;
}

/**
 * Compute the team-enabled feature set, following the Clojure logic:
 *
 *   teamFeatures = intersection(globalEnabled, noMigrationFeatures) ∪ team.features
 *
 * @param {Record<string, boolean>} flags - Feature flags.
 * @param {{ features?: string[] | Set<string> }} team - Team DB row with `features`.
 * @returns {Set<string>}
 */
export function getTeamEnabledFeatures(flags, team) {
  const enabledFeatures = getEnabledFeatures(flags);
  const teamFeatures = parseFeatures(team.features);
  const intersection = new Set([...enabledFeatures].filter(f => noMigrationFeatures.has(f)));
  return new Set([...intersection, ...teamFeatures]);
}

/**
 * Validate that the client features include all required backend features
 * (excluding frontend-only and backend-only). Throws an RpcError if not.
 *
 * @param {Set<string>} enabledFeatures - Server-side enabled features.
 * @param {Set<string> | string[] | null} clientFeatures - Features sent by the client.
 * @param {typeof import('../rpc/dispatcher.js').RpcError} RpcError - Error class to throw.
 * @returns {Set<string>} The `enabledFeatures` set (unchanged).
 */
export function checkClientFeatures(enabledFeatures, clientFeatures, RpcError) {
  if (!clientFeatures || !Array.isArray(clientFeatures)) return enabledFeatures;

  const clientSet = new Set(clientFeatures);
  const notSupported = new Set(
    [...enabledFeatures].filter(
      f => !clientSet.has(f) && !frontendOnlyFeatures.has(f) && !backendOnlyFeatures.has(f)
    )
  );

  if (notSupported.size > 0) {
    const feature = [...notSupported][0];
    throw new RpcError(
      'restriction',
      'feature-not-supported',
      `Client does not support feature: ${feature}`,
      { feature }
    );
  }

  return enabledFeatures;
}

/**
 * Compute the final feature set for a newly created file.
 *
 * The logic:
 * 1. Start with `teamEnabledFeatures` (from `getTeamEnabledFeatures`).
 * 2. Client may send `features` — intersect with `noMigrationFeatures`,
 *    subtract `frontendOnlyFeatures`, and union into the result.
 *
 * @param {Set<string>} teamEnabledFeatures - Team-enabled features.
 * @param {string[] | null} clientFeatures - Features sent by the client in the request.
 * @returns {Set<string>} Final feature set for the file.
 */
export function computeFileFeatures(teamEnabledFeatures, clientFeatures) {
  let result = new Set(teamEnabledFeatures);

  if (clientFeatures && Array.isArray(clientFeatures)) {
    const clientNoMigration = new Set(
      clientFeatures.filter(f => noMigrationFeatures.has(f) && !frontendOnlyFeatures.has(f))
    );
    result = new Set([...result, ...clientNoMigration]);
  }

  // Filter out any unsupported features
  result = new Set([...result].filter(f => supportedFeatures.has(f)));
  return result;
}

/**
 * Determine which features from `fileFeatures` are new compared to
 * `teamFeatures` and should be propagated to the team (excluding
 * `noTeamInheritableFeatures`).
 *
 * @param {Set<string>} fileFeatures - The file's feature set.
 * @param {Set<string>} teamFeatures - The team's current feature set.
 * @returns {Set<string> | null} Features to add to the team, or null if none.
 */
export function computeNewTeamFeatures(fileFeatures, teamFeatures) {
  const newFeatures = new Set(
    [...fileFeatures].filter(
      f => !teamFeatures.has(f) && !noTeamInheritableFeatures.has(f)
    )
  );
  return newFeatures.size > 0 ? newFeatures : null;
}

// --- Helpers ---

/**
 * Parse a features value from the database (stored as TEXT).
 * Handles JSON arrays, JSON sets, comma-separated strings, and already-set values.
 *
 * @param {string | string[] | Set<string> | null | undefined} value
 * @returns {Set<string>}
 */
export function parseFeatures(value) {
  if (!value) return new Set();
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value);

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '{}') return new Set();
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return new Set(parsed);
    } catch {
      // Try comma-separated
      return new Set(trimmed.split(',').map(s => s.trim()).filter(Boolean));
    }
  }
  return new Set();
}

/**
 * Serialize a feature set for database storage.
 * Stores as a JSON array (matching Clojure's PostgreSQL array convention).
 *
 * @param {Set<string>} features
 * @returns {string} JSON array string.
 */
export function serializeFeatures(features) {
  return JSON.stringify([...features]);
}