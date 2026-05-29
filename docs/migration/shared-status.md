# shared

Shared ES2022+ JavaScript modules for the Penpot JS port — dual-env (browser + Node.js).

## Status

**Phase 1 complete** — 152 JS files, 1,596 tests across 232 test suites, 0 failures.

Ported modules include: uuid, exceptions, time, data, encoding, observable, math, json, transit, geom (point, rect, matrix), colors, modifiers, schema, spec, features, flags, i18n, version, path names, buffer, perf, pprint, record, objects map, weak maps, SVG, media, thumbnails, and all types/* modules (fills, component, container, file, library, page, path, shape, text, token, typography, variant, identity).

## Recent Changes

- **SC-1 complete**: `types/file.js` — 32 new functions ported from upstream `common/src/app/common/types/file.cljc` (51 exported functions total, up from 19). Key additions: `findRefShape`, `findNearMatch`, `findRefComponent`, `findRemoteShape`, `getComponentContainer`, `getComponentShape`, `getRefShape`, `getShapeInCopy`, `advanceShapeRef`, `directCopyQ`, `findSwapSlot`, `matchSwapSlotQ`, `findRefIdForSwapped`, `getRefChainUntilTargetRef`, `getTouchedFromRefChainUntilTargetRef`, `getComponentShapes`, `loadComponentObjects`, `deleteComponentData`, `restoreComponent`, `purgeComponent`, `usesAssetQ`, `findAssetTypeUsages`, `usedInQ`, `usedAssetsChangedSince`, `getOrAddLibraryPage`, `absorbAssets`, `detachExternalReferences`, `updateObjectsTree`, `getComponentContainerFromHead`, `isMainOfKnownComponentQ`, `dumpShape`, `dumpComponent`. Stub implementations in `validate.js`, `comp_processors.js`, `variants.js`, and `libraries.js` replaced with real implementations from `file.js`.
- **Bug fixes**: `Object.assign` mutation bug fixed (replaced with spread syntax), `detachExternalReferences` text content detachment fixed (was no-op, now properly strips external refs from text nodes), `transformNodes` exported from `typography.js`.
- **Key lesson**: Clojure's `with-meta`/`meta` pattern → JS uses `_fileCtx`/`_containerCtx` properties. Must use spread `{...shape, prop}` not `Object.assign(shape, {})` to avoid mutating shared shape objects.

## Quick Start

```bash
npm install
npm test
```

## Module Structure

```
src/           # Source modules (ES2022+)
test/          # Test files (node:test + node:assert)
```

## License

MPL-2.0 (matching upstream Penpot)