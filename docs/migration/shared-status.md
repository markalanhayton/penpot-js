# shared

Shared ES2022+ JavaScript modules for the Penpot JS port — dual-env (browser + Node.js).

## Status

**Phase 1 complete** — 150 JS files, 1306 assertions across 153 test suites, 0 failures.

Ported modules include: uuid, exceptions, time, data, encoding, observable, math, json, transit, geom (point, rect, matrix), colors, modifiers, schema, spec, features, flags, i18n, version, path names, buffer, perf, pprint, record, objects map, weak maps, SVG, media, thumbnails, and all types/* modules (fills, component, container, file, library, page, path, shape, text, token, typography, variant, identity).

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