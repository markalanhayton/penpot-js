import { raise } from './exceptions.js';

export let previous = new Set();
export let current = new Set();
export let newFeatures = null;

export let wrapWithObjectsMapFn = (x) => x;
export let wrapWithPointerMapFn = (x) => x;

export const supportedFeatures = new Set([
  'fdata/objects-map', 'fdata/pointer-map', 'fdata/shape-data-type',
  'fdata/path-data', 'components/v2', 'styles/v2', 'layout/grid',
  'plugins/runtime', 'tokens/numeric-input', 'design-tokens/v1',
  'text-editor/v2-html-paste', 'text-editor/v2', 'text-editor-wasm/v1',
  'render-wasm/v1', 'variants/v1'
]);

export const defaultFeatures = new Set([
  'fdata/shape-data-type', 'fdata/path-data', 'styles/v2',
  'layout/grid', 'components/v2', 'plugins/runtime',
  'design-tokens/v1', 'tokens/numeric-input', 'variants/v1'
]);

export const frontendOnlyFeatures = new Set([
  'styles/v2', 'plugins/runtime', 'text-editor/v2-html-paste',
  'text-editor/v2', 'text-editor-wasm/v1', 'tokens/numeric-input',
  'render-wasm/v1'
]);

export const backendOnlyFeatures = new Set([
  'fdata/pointer-map', 'fdata/objects-map'
]);

export const noTeamInheritableFeatures = new Set([
  'fdata/path-data', 'fdata/shape-data-type'
]);

export const noMigrationFeatures = new Set([
  'layout/grid', 'design-tokens/v1', 'fdata/shape-data-type',
  'fdata/path-data', 'tokens/numeric-input', 'variants/v1',
  ...frontendOnlyFeatures, ...backendOnlyFeatures
]);

const FLAG_TO_FEATURE = new Map([
  ['feature-styles-v2', 'styles/v2'],
  ['feature-fdata-objects-map', 'fdata/objects-map'],
  ['feature-fdata-pointer-map', 'fdata/pointer-map'],
  ['feature-plugins', 'plugins/runtime'],
  ['feature-design-tokens', 'design-tokens/v1'],
  ['feature-text-editor-v2', 'text-editor/v2'],
  ['feature-text-editor-v2-html-paste', 'text-editor/v2-html-paste'],
  ['feature-text-editor-wasm', 'text-editor-wasm/v1'],
  ['feature-render-wasm', 'render-wasm/v1'],
  ['feature-variants', 'variants/v1'],
  ['feature-token-input', 'tokens/numeric-input'],
]);

function flagToFeature(flag) {
  return FLAG_TO_FEATURE.get(flag);
}

export function migrateLegacyFeatures(features) {
  const result = features ? new Set(features) : new Set();
  if (result.has('storage/pointer-map')) {
    result.add('fdata/pointer-map');
    result.delete('storage/pointer-map');
  }
  if (result.has('storage/objects-map')) {
    result.add('fdata/objects-map');
    result.delete('storage/objects-map');
  }
  if (result.has('internal/geom-record') || result.has('internal/shape-record')) {
    result.add('fdata/shape-data-type');
    result.delete('internal/geom-record');
    result.delete('internal/shape-record');
  }
  return result;
}

function setDifference(a, b) {
  const result = new Set(a);
  for (const v of b) result.delete(v);
  return result;
}

function setUnion(a, b) {
  const result = new Set(a);
  for (const v of b) result.add(v);
  return result;
}

function setIntersection(a, b) {
  const result = new Set();
  for (const v of a) { if (b.has(v)) result.add(v); }
  return result;
}

export function getEnabledFeatures(flags) {
  const result = new Set(defaultFeatures);
  for (const flag of flags) {
    const feature = flagToFeature(flag);
    if (feature) result.add(feature);
  }
  return result;
}

export function getTeamEnabledFeatures(flags, team) {
  const enabledFeatures = getEnabledFeatures(flags);
  const teamFeatures = new Set();
  if (team.features) {
    for (const f of team.features) {
      if (!f.startsWith('ephimeral/')) teamFeatures.add(f);
    }
  }
  return setUnion(setIntersection(enabledFeatures, noMigrationFeatures), teamFeatures);
}

export function checkClientFeatures(enabledFeatures, clientFeatures) {
  if (!(clientFeatures instanceof Set)) return enabledFeatures;
  const notSupported = setDifference(
    setDifference(
      setDifference(enabledFeatures, clientFeatures),
      frontendOnlyFeatures
    ),
    backendOnlyFeatures
  );
  if (notSupported.size > 0) {
    const features = [...notSupported].join(',');
    raise({
      type: 'restriction',
      code: 'feature-not-supported',
      feature: [...notSupported][0],
      hint: `client declares no support for ${features} features`
    });
  }
  return enabledFeatures;
}

export function checkSupportedFeatures(enabledFeatures) {
  const notSupported = setDifference(enabledFeatures, supportedFeatures);
  const first = [...notSupported][0];
  if (first) {
    raise({
      type: 'restriction',
      code: 'feature-not-supported',
      feature: first,
      hint: `feature ${first} not supported on this backend`
    });
  }
  return enabledFeatures;
}

export function checkFileFeatures(enabledFeatures, fileFeatures) {
  const ff = new Set();
  if (fileFeatures) {
    for (const f of fileFeatures) {
      if (!f.startsWith('ephimeral/')) ff.add(f);
    }
  }

  const notSupported1 = setDifference(
    setDifference(enabledFeatures, ff),
    noMigrationFeatures
  );
  const first1 = [...notSupported1][0];
  if (first1) {
    raise({
      type: 'restriction',
      code: 'file-feature-mismatch',
      feature: first1,
      hint: `enabled feature ${first1} not present in file (missing migration)`
    });
  }

  if (!ff.has('components/v2')) {
    raise({
      type: 'restriction',
      code: 'file-in-components-v1',
      hint: 'components v1 is deprecated'
    });
  }

  const notSupported2 = setDifference(
    setDifference(
      setDifference(ff, enabledFeatures),
      backendOnlyFeatures
    ),
    frontendOnlyFeatures
  );
  const first2 = [...notSupported2][0];
  if (first2) {
    raise({
      type: 'restriction',
      code: 'file-feature-mismatch',
      feature: first2,
      hint: `file feature ${first2} not enabled`
    });
  }

  return enabledFeatures;
}

export function checkTeamsCompatibility(source, destination) {
  const srcF = source.features || new Set();
  const dstF = destination.features || new Set();

  if (srcF.has('ephimeral/migration')) {
    raise({ type: 'restriction', code: 'migration-in-progress', hint: 'the source team is in migration process' });
  }
  if (dstF.has('ephimeral/migration')) {
    raise({ type: 'restriction', code: 'migration-in-progress', hint: 'the destination team is in migration process' });
  }

  const ns1 = [...setDifference(setDifference(setDifference(srcF, dstF), noMigrationFeatures), defaultFeatures)];
  if (ns1.length > 0) {
    raise({ type: 'restriction', code: 'team-feature-mismatch', feature: ns1[0], hint: `the destination team does not have support ${ns1.join(',')} features` });
  }

  const ns2 = [...setDifference(setDifference(setDifference(dstF, srcF), noMigrationFeatures), defaultFeatures)];
  if (ns2.length > 0) {
    raise({ type: 'restriction', code: 'team-feature-mismatch', feature: ns2[0], hint: `the source team does not have support ${ns2.join(',')} features` });
  }
}

export function checkPasteFeatures(enabledFeatures, pasteFeatures) {
  const ns1 = setDifference(setDifference(enabledFeatures, pasteFeatures), noMigrationFeatures);
  if (ns1.size > 0) {
    raise({
      type: 'restriction',
      code: 'missing-features-in-paste-content',
      feature: [...ns1][0],
      hint: `expected features ${[...ns1].join(',')} not present in pasted content`
    });
  }

  const ns2 = setDifference(enabledFeatures, supportedFeatures);
  if (ns2.size > 0) {
    raise({
      type: 'restriction',
      code: 'paste-feature-not-supported',
      feature: [...ns2][0],
      hint: `features ${[...ns2].join(',')} not supported in the application`
    });
  }

  const ns3 = setDifference(setDifference(setDifference(pasteFeatures, enabledFeatures), backendOnlyFeatures), frontendOnlyFeatures);
  if (ns3.size > 0) {
    raise({
      type: 'restriction',
      code: 'paste-feature-not-enabled',
      feature: [...ns3][0],
      hint: `paste features ${[...ns3].join(',')} not enabled on the application`
    });
  }
}