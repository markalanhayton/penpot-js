# Penpot Migration Tracking

> Last updated: 2026-05-24

Migration from Clojure/ClojureScript to pure ES2022+ JavaScript.
Full plan: [`migration-plan.md`](migration-plan.md)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete |
| 🟡 | In progress / partial |
| 🔴 | Not started |
| ⬜ | N/A / Skipped |

---

## Phase Overview

| Phase | Module | Target | Status | Files | Tests |
|-------|--------|--------|--------|-------|-------|
| 1 | `common/` → `shared/` | ES JS (dual-env) | ✅ **Complete** | 150 JS | 1306 assertions, 153 suites, 0 fail |
| 2a | `backend/` → `server/` | Node.js ESM (Fastify + SQLite) | 🟡 **~92%** | 65 JS | 58 test files, 564 tests, 564 pass, 0 fail |
| 2b | `frontend/` → `client/` | Web Components + CSS | ✅ **99% functional parity** | 93 JS | 13 E2E spec files, 170+ E2E tests + 35 unit tests + 450+ atomic E2E scenarios |
| 3 | `exporter/` → `server/exporter/` | Node.js ESM | ✅ **Complete** | 13 JS | 22 tests, 6 suites, 0 fail |

---

## Phase 1: Common Module → ES JS ✅

**Status**: Complete | **Start**: 2025-05 | **End**: 2026-05-20

### 1.1 Top-Level Utilities

| Module | Source | Port | Status |
|--------|--------|------|--------|
| `uuid` | `app.common.uuid` | `uuid.js` | ✅ |
| `exceptions` | `app.common.exceptions` | `exceptions.js` | ✅ |
| `time` | `app.common.time` | `time.js` | ✅ |
| `data` | `app.common.data` | `data.js` | ✅ |
| `data/macros` | `app.common.data.macros` | `data/macros.js` | ✅ |
| `data/undo_stack` | `app.common.data.undo_stack` | `data/undo_stack.js` | ✅ |
| `math` | `app.common.math` | `math.js` | ✅ |
| `json` | `app.common.json` | `json.js` | ✅ |
| `encoding` | (new) | `encoding.js` | ✅ |
| `observable` | (new) | `observable.js` | ✅ |
| `i18n` | `app.common.i18n` | `i18n.js` | ✅ |
| `version` | `app.common.version` | `version.js` | ✅ |
| `path_names` | `app.common.path_names` | `path_names.js` | ✅ |
| `buffer` | `app.common.buffer` | `buffer.js` | ✅ |
| `perf` | `app.common.perf` | `perf.js` | ✅ |
| `pprint` | `app.common.pprint` | `pprint.js` | ✅ |
| `schema` | `app.common.schema` | `schema.js` | ✅ |
| `uri` | `app.common.uri` | `uri.js` | ✅ |
| `spec` | `app.common.spec` | `spec.js` | ✅ |
| `thumbnails` | `app.common.thumbnails` | `thumbnails.js` | ✅ |
| `record` | `app.common.record` | `record.js` | ✅ |
| `weak` | `app.common.weak` | `weak.js` | ✅ |
| `weak/impl_weak_map` | `app.common.weak.impl_weak_map` | `weak/impl_weak_map.js` | ✅ |
| `weak/impl_weak_value_map` | (new JS) | `weak/impl_weak_value_map.js` | ✅ |
| `colors` | `app.common.colors` | `colors.js` | ✅ |
| `attrs` | `app.common.attrs` | `attrs.js` | ✅ |
| `flags` | `app.common.flags` | `flags.js` | ✅ |
| `features` | `app.common.features` | `features.js` | ✅ |
| `media` | `app.common.media` | `media.js` | ✅ |
| `transit` | `app.common.transit` | `transit.js` | ✅ |
| `logging` | `app.common.logging` | `logging.js` | ✅ |
| `objects_map` | `app.common.types.objects_map` | `objects_map.js` | ✅ |
| `svg` | `app.common.svg` | `svg.js` | ✅ |
| `svg/path/arc_to_bezier` | `app.common.svg.path.arc_to_bezier` | `svg/path/arc_to_bezier.js` | ✅ |
| `svg/path` (barrel) | `app.common.svg.path` | `svg/path/index.js` | ✅ |
| `text` | `app.common.text` | `text.js` | ✅ |

**Excluded (intentionally):**
- `schema/*` (7 submodules) — Malli-specific, replaced by `schema.js` hand-built validators
- `test_helpers/*` (7 modules) — testing infrastructure, not production code
- `debug.clj`, `fressian.clj`, `generic_pool.clj` — JVM-only, not applicable to JS
- `svg/path/legacy_parser2.cljc` — redundant, functionality covered by `types/path/svg_parser.js`

### 1.2 Geometry (`geom/`)

| Module | Source | Port | Status |
|--------|--------|------|--------|
| `geom/point` | `app.common.geom.point` | `geom/point.js` | ✅ |
| `geom/rect` | `app.common.geom.rect` | `geom/rect.js` | ✅ |
| `geom/matrix` | `app.common.geom.matrix` | `geom/matrix.js` | ✅ |
| `geom/line` | `app.common.geom.line` | `geom/line.js` | ✅ |
| `geom/proportions` | `app.common.geom.proportions` | `geom/proportions.js` | ✅ |
| `geom/align` | `app.common.geom.align` | `geom/align.js` | ✅ |
| `geom/snap` | `app.common.geom.snap` | `geom/snap.js` | ✅ |
| `geom/grid` | `app.common.geom.grid` | `geom/grid.js` | ✅ |
| `geom/bounds_map` | `app.common.geom.bounds_map` | `geom/bounds_map.js` | ✅ |
| `geom/modif_tree` | `app.common.geom.modif_tree` | `geom/modif_tree.js` | ✅ |
| `geom/modifiers` | `app.common.geom.modifiers` | `geom/modifiers.js` | ✅ |
| `geom/shapes/common` | `app.common.geom.shapes.common` | `geom/shapes/common.js` | ✅ |
| `geom/shapes/points` | `app.common.geom.shapes.points` | `geom/shapes/points.js` | ✅ |
| `geom/shapes/rect` | `app.common.geom.shapes.rect` | `geom/shapes/rect.js` | ✅ |
| `geom/shapes/transforms` | `app.common.geom.shapes.transforms` | `geom/shapes/transforms.js` | ✅ |
| `geom/shapes/constraints` | `app.common.geom.shapes.constraints` | `geom/shapes/constraints.js` | ✅ |
| `geom/shapes/corners` | `app.common.geom.shapes.corners` | `geom/shapes/corners.js` | ✅ |
| `geom/shapes/intersect` | `app.common.geom.shapes.intersect` | `geom/shapes/intersect.js` | ✅ |
| `geom/shapes/text` | `app.common.geom.shapes.text` | `geom/shapes/text.js` | ✅ |
| `geom/shapes/strokes` | `app.common.geom.shapes.strokes` | `geom/shapes/strokes.js` | ✅ |
| `geom/shapes/effects` | `app.common.geom.shapes.effects` | `geom/shapes/effects.js` | ✅ |
| `geom/shapes/bounds` | `app.common.geom.shapes.bounds` | `geom/shapes/bounds.js` | ✅ |
| `geom/shapes/fit_frame` | `app.common.geom.shapes.fit_frame` | `geom/shapes/fit_frame.js` | ✅ |
| `geom/shapes/shapes` | `app.common.geom.shapes` | `geom/shapes/shapes.js` | ✅ |
| `geom/shapes/pixel_precision` | `app.common.geom.shapes.pixel_precision` | `geom/shapes/pixel_precision.js` | ✅ |
| `geom/shapes/tree_seq` | `app.common.geom.shapes.tree_seq` | `geom/shapes/tree_seq.js` | ✅ |
| `geom/shapes/min_size_layout` | `app.common.geom.shapes.min_size_layout` | `geom/shapes/min_size_layout.js` | ✅ |
| `geom/shapes/flex_layout/bounds` | `app.common.geom.shapes.flex_layout.bounds` | `geom/shapes/flex_layout/bounds.js` | ✅ |
| `geom/shapes/flex_layout/drop_area` | `app.common.geom.shapes.flex_layout.drop_area` | `geom/shapes/flex_layout/drop_area.js` | ✅ |
| `geom/shapes/flex_layout/layout_data` | `app.common.geom.shapes.flex_layout.layout_data` | `geom/shapes/flex_layout/layout_data.js` | ✅ |
| `geom/shapes/flex_layout/modifiers` | `app.common.geom.shapes.flex_layout.modifiers` | `geom/shapes/flex_layout/modifiers.js` | ✅ |
| `geom/shapes/flex_layout/params` | `app.common.geom.shapes.flex_layout.params` | `geom/shapes/flex_layout/params.js` | ✅ |
| `geom/shapes/flex_layout/positions` | `app.common.geom.shapes.flex_layout.positions` | `geom/shapes/flex_layout/positions.js` | ✅ |
| `geom/shapes/flex_layout` (barrel) | `app.common.geom.shapes.flex_layout` | `geom/shapes/flex_layout/index.js` | ✅ |
| `geom/shapes/grid_layout/areas` | `app.common.geom.shapes.grid_layout.areas` | `geom/shapes/grid_layout/areas.js` | ✅ |
| `geom/shapes/grid_layout/bounds` | `app.common.geom.shapes.grid_layout.bounds` | `geom/shapes/grid_layout/bounds.js` | ✅ |
| `geom/shapes/grid_layout/layout_data` | `app.common.geom.shapes.grid_layout.layout_data` | `geom/shapes/grid_layout/layout_data.js` | ✅ |
| `geom/shapes/grid_layout/params` | `app.common.geom.shapes.grid_layout.params` | `geom/shapes/grid_layout/params.js` | ✅ |
| `geom/shapes/grid_layout/positions` | `app.common.geom.shapes.grid_layout.positions` | `geom/shapes/grid_layout/positions.js` | ✅ |
| `geom/shapes/grid_layout` (barrel) | `app.common.geom.shapes.grid_layout` | `geom/shapes/grid_layout/index.js` | ✅ |

### 1.3 Types (`types/`)

| Module | Source | Port | Status |
|--------|--------|------|--------|
| `types/color` | `app.common.types.color` | `types/color.js` | ✅ |
| `types/component` | `app.common.types.component` | `types/component.js` | ✅ |
| `types/components_list` | `app.common.types.components_list` | `types/components_list.js` | ✅ |
| `types/container` | `app.common.types.container` | `types/container.js` | ✅ |
| `types/file` | `app.common.types.file` | `types/file.js` | ✅ |
| `types/fills` | `app.common.types.fills` | `types/fills.js` + `types/fills/impl.js` | ✅ |
| `types/font` | `app.common.types.font` | `types/font.js` | ✅ |
| `types/grid` | `app.common.types.grid` | `types/grid.js` | ✅ |
| `types/library` | `app.common.types.library` | `types/library.js` | ✅ |
| `types/modifiers` | `app.common.types.modifiers` | `modifiers.js` (top-level) | ✅ |
| `types/nitrate_permissions` | `app.common.types.nitrate_permissions` | `types/nitrate_permissions.js` | ✅ |
| `types/objects_map` | `app.common.types.objects_map` | `objects_map.js` (top-level) | ✅ |
| `types/organization` | `app.common.types.organization` | `types/organization.js` | ✅ |
| `types/page` | `app.common.types.page` | `types/page.js` | ✅ |
| `types/pages_list` | `app.common.types.pages_list` | `types/pages_list.js` | ✅ |
| `types/path` | `app.common.types.path` | `types/path.js` + `types/path/*` | ✅ |
| `types/path/bool` | `app.common.types.path.bool` | `types/path/bool.js` | ✅ |
| `types/path/helpers` | `app.common.types.path.helpers` | `types/path/helpers.js` | ✅ |
| `types/path/impl` | `app.common.types.path.impl` | `types/path/impl.js` | ✅ |
| `types/path/segment` | `app.common.types.path.segment` | `types/path/segment.js` | ✅ |
| `types/path/shape_to_path` | `app.common.types.path.shape_to_path` | `types/path/shape_to_path.js` | ✅ |
| `types/path/subpath` | `app.common.types.path.subpath` | `types/path/subpath.js` | ✅ |
| `types/path/svg_parser` | (new JS) | `types/path/svg_parser.js` | ✅ |
| `types/plugins` | `app.common.types.plugins` | `types/plugins.js` | ✅ |
| `types/profile` | `app.common.types.profile` | `types/profile.js` | ✅ |
| `types/project` | `app.common.types.project` | `types/project.js` | ✅ |
| `types/shape` | `app.common.types.shape` | `types/shape_type.js` | ✅ |
| `types/shape/attrs` | `app.common.types.shape.attrs` | `types/shape/attrs.js` | ✅ |
| `types/shape/blur` | `app.common.types.shape.blur` | `types/shape/blur.js` | ✅ |
| `types/shape/export` | `app.common.types.shape.export` | `types/shape/export.js` | ✅ |
| `types/shape/interactions` | `app.common.types.shape.interactions` | `types/shape/interactions.js` | ✅ |
| `types/shape/layout` | `app.common.types.shape.layout` | `types/shape/layout.js` | ✅ |
| `types/shape/radius` | `app.common.types.shape.radius` | `types/shape/radius.js` | ✅ |
| `types/shape/shadow` | `app.common.types.shape.shadow` | `types/shape/shadow.js` | ✅ |
| `types/shape/text` | `app.common.types.shape.text` | `types/shape/text.js` | ✅ |
| `types/shape/token` | `app.common.types.shape.token` | `types/shape/token.js` | ✅ |
| `types/shape_tree` | `app.common.types.shape_tree` | `types/shape_tree.js` | ✅ |
| `types/stroke` | `app.common.types.stroke` | `types/stroke.js` | ✅ |
| `types/team` | `app.common.types.team` | `types/team.js` | ✅ |
| `types/text` | `app.common.types.text` | `types/text.js` | ✅ |
| `types/token` | `app.common.types.token` | `types/token.js` | ✅ |
| `types/tokens_lib` | `app.common.types.tokens_lib` | `types/tokens_lib.js` | ✅ |
| `types/typography` | `app.common.types.typography` | `types/typography.js` | ✅ |
| `types/typographies_list` | `app.common.types.typographies_list` | `types/typographies_list.js` | ✅ |
| `types/variant` | `app.common.types.variant` | `types/variant.js` | ✅ |

### 1.4 Files (`files/`)

| Module | Source | Port | Status |
|--------|--------|------|--------|
| `files/variant` | `app.common.files.variant` | `files/variant.js` | ✅ |
| `files/comp_processors` | `app.common.files.comp_processors` | `files/comp_processors.js` | ✅ |
| `files/validate` | `app.common.files.validate` | `files/validate.js` | ✅ |
| `files/changes_builder` | `app.common.files.changes_builder` | `files/changes_builder.js` | ✅ |
| `files/changes` | `app.common.files.changes` | `files/changes.js` | ✅ |
| `files/defaults` | `app.common.files.defaults` | `files/defaults.js` | ✅ |
| `files/focus` | `app.common.files.focus` | `files/focus.js` | ✅ |
| `files/helpers` | `app.common.files.helpers` | `files/helpers.js` | ✅ |
| `files/indices` | `app.common.files.indices` | `files/indices.js` | ✅ |
| `files/page_diff` | `app.common.files.page_diff` | `files/page_diff.js` | ✅ |
| `files/stats` | `app.common.files.stats` | `files/stats.js` | ✅ |
| `files/tokens` | `app.common.files.tokens` | `files/tokens.js` | ✅ |
| `files/migrations` | `app.common.files.migrations` | `files/migrations.js` — 73 migrations (52 legacy + 21 named) | ✅ |
| `files/repair` | `app.common.files.repair` | `files/repair.js` — 241 lines, 12 repair handlers | ✅ |
| `files/builder` | `app.common.files.builder` | `files/builder.js` — 26 exported functions, stateful builder API | ✅ |
| `files/shapes_helpers` | `app.common.files.shapes_helpers` | `files/shapes_helpers.js` — 199 lines, full implementation | ✅ |
| `files/shapes_builder` | `app.common.files.shapes_builder` | `files/shapes_builder.js` — 57 exported functions, SVG-to-shapes builder | ✅ |

### 1.5 Logic (`logic/`)

| Module | Source | Port | Status |
|--------|--------|------|--------|
| `logic/tokens` | `app.common.logic.tokens` | `logic/tokens.js` | ✅ |
| `logic/variant_properties` | `app.common.logic.variant_properties` | `logic/variant_properties.js` | ✅ |
| `logic/variants` | `app.common.logic.variants` | `logic/variants.js` | ✅ |
| `logic/shapes` | `app.common.logic.shapes` | `logic/shapes.js` | ✅ |
| `logic/libraries` | `app.common.logic.libraries` | `logic/libraries.js` | ✅ |

---

## Phase 2a: Backend → Node.js ESM 🟡

**Status**: ~85% complete | **Start**: 2025-06 | **Current**: 2026-05

### 2a.1 Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| HTTP server (Fastify) | ✅ | All RPC routes registered |
| SQLite database layer | ✅ | `better-sqlite3`, 21 migrations; SQLite only (no PostgreSQL) |
| Transit+JSON codec | ✅ | Compatible with Clojure backend |
| JWE auth / Argon2id | ✅ | Token creation/verification |
| Configuration system | ✅ | 40+ `PENPOT_*` env vars |
| Feature flags | ✅ | `config/features.js` |
| Structured logging | ✅ | Pino-based, JSON/text output |
| Metrics (Prometheus) | ✅ | 13 metrics at `/api/metrics` |
| WebSocket notifications | ✅ | `ws/notifications.js` |
| SSE endpoint | ✅ | `http/sse.js` |
| Background task scheduler | ✅ | 7 periodic tasks |
| Email sending (nodemailer) | ✅ | SMTP with HTML templates |
| Filesystem storage | ✅ | `storage/fs.js` |
| S3/MinIO storage | ✅ | `storage/s3.js`, presigned URLs |
| OIDC/SSO authentication | ✅ | Google, GitHub, GitLab, custom SSO |
| RPC middleware (auth, rate-limit, permissions, quotes, retry, cond) | ✅ | All 6 middleware layers |
| Image processing (sharp) | ✅ | Thumbnails, resize, format detection |

### 2a.2 RPC Commands (27 namespaces, 149 commands)

| Command Group | Status | Notes |
|---------------|--------|-------|
| `auth` (register, login, recovery, verify-email) | ✅ | Full end-to-end |
| `files` (CRUD, library link/unlink, stats) | ✅ | |
| `files_update` (collaborative editing) | ✅ | |
| `files_share` | ✅ | |
| `files_snapshots` | ✅ | |
| `files_thumbnails` | ✅ | |
| `projects` | ✅ | |
| `teams` | ✅ | |
| `teams_invitations` | ✅ | |
| `profile` | ✅ | |
| `comments` | ✅ | Read tracking |
| `media` | ✅ | Upload/processing |
| `fonts` | ✅ | |
| `webhooks` | ✅ | Registration + delivery |
| `feedback` | ✅ | |
| `audit` | ✅ | |
| `management` | ✅ | |
| `nitrate` | ✅ | Enterprise stubs |
| `ldap` | ✅ | Auth stubs |
| `viewer` | ✅ | Read-only |
| `demo` | ✅ | |
| `search` | ✅ | |
| `access_token` | ✅ | |
| `binfile` | ✅ | Import/export (v3 ZIP format with manifest, ID remapping, shape cleanup, storage objects, feature migrations) |
| `get-file-summary` | ✅ | Lightweight file metadata without loading data blob |
| `get-file-libraries` | ✅ | Libraries linked to a specific file |
| `get-library-file-references` | ✅ | Files that reference a given library |
| `verify_token` | ✅ | Multi-type token verification |

### 2a.3 Known Gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| 3 | Redis pub/sub | ~~P1~~ Done | Replaced with pure Node.js EventBus (`ws/msgbus.js`) — SQLite is single-instance, no Redis needed |
| FTS5 full-text search | P2 | `search-files` uses FTS5 with LIKE fallback; migration 0009 |
| File GC cross-library checks | ~~P2~~ Done | Cross-library component GC implemented in scheduler |
| ~~74 failing tests~~ | ~~P2~~ Done | All 564 tests pass (0 fail) |
| Wire compatibility tests | ✅ **Complete** | 10 tests in `test/wire-compat.test.js`; auto-skips when backends offline |
| Migrations parity | ✅ **Complete** | 21 SQL migrations achieving full PG schema parity: indexes, constraints, triggers, data migrations, cascade logic, deletion protection, CHECK constraints, PK restructures, expression indexes |

### 2a.4 Test Status

| Metric | Value |
|--------|-------|
| Test files | 57 |
| Test files | 57 → 58 |
| Test cases | 529 → 564 |
| Passing | 564 |
| Failing | 0 |
| Cancelled | 0 |
| Skipped | 0 |

---

## Phase 2b: Frontend → Web Components ✅

**Status**: ~99.5% functional parity | **Start**: 2025-06 | **Current**: Full pipeline auth→dashboard→workspace; 93 source files (~9,200 lines lib + ~15,400 lines components + ~300 lines tools/app ≈ ~24,900 lines total); alignment/distribution, stroke editing, blur, per-corner radius, context menus with submenus, deleted files, cursor broadcast, share persistence, component buttons, dashboard menus, multi-select layers, per-fill opacity, layer search/filter, JPEG/WebP export, mask/clip, access tokens UI, version history, text properties, flip controls, fill visibility toggle, stroke alignment, frame presets, fixed duplicate shortcuts, fixed nudge persistence, **nested drag-drop into frames/groups**, component detach/sync UI, import/export, plugin API, thumbnail generation, **color rename/recent colors/gradient swatches**, **typography rename/edit**, **viewer page nav + zoom + inspect**, **dashboard share context menu**, **move-to-project**, **comment pin placement + threaded replies**, **per-group reset overrides**, **per-property override indicators (colored dots)**, **typography edit dialog**, **gradient color add**, **nudge settings UI**, **selection-update WS**, **publish/unpublish library**, **library content browsing**, **library color/typo sync**, **swap component dropdown**, **file pinning**, **advanced search**, **gradient handles on canvas**, **flatten path**, **delete account/change email**, **heading formats + line height**, **text on path**, **auto-resize mode**, **measurements overlay**, **SVG gradient/mask/clip import**, **templates**, **onboarding tour**, **font preview in dropdown**, **interaction prototyping**, **library drag-to-apply**, **viewer interaction playback**

### 2b.1 What Exists (93 source files)

#### Core Infrastructure (33 files, all done)

| Component | Status | Lines | Notes |
|-----------|--------|-------|-------|
| `app.js` | ✅ | 133 | Root bootstrap, auth token, route rendering, WS init, settings routes |
| `server.js` | ✅ | 80 | Static file serving + proxy to backend |
| `lib/store.js` | ✅ | 171 | Potok-like store: events, effects, signals, subscriptions |
| `lib/router.js` | ✅ | 108 | 13 routes, auth guards, param extraction, history API, settings-tokens route |
| `lib/rpc.js` | ✅ | 191 | Transit+JSON, GET/POST, retry, SSE streaming, file upload |
| `lib/transit.js` | ✅ | 299 | Full Transit codec: keywords, UUIDs, dates, sets, Penpot types |
| `lib/ws.js` | ✅ | 299 | WebSocket client, file/team subscription, cursor broadcast |
| `lib/shapes.js` | ✅ | 590 | SVG rendering for all shape types including bool, rotation handle, masked groups, flip transforms |
| `lib/types.js` | ✅ | 155 | Shape factory, type predicates, createBoolShape |
| `lib/history.js` | ✅ | 52 | Undo/redo stack |
| `lib/tokens.js` | ✅ | 162 | CSS custom property design system |
| `lib/tool-manager.js` | ✅ | 836 | Tool registry, switching, keyboard shortcuts (no duplicates), bool ops, z-order, undo/redo, dblclick, persistent nudge |
| `lib/export.js` | ✅ | 346 | PNG/JPEG/WebP/SVG/PDF export, .penpot import, server-side export |
| `lib/i18n.js` | ✅ | 93 | Translation mechanism with English defaults |
| `lib/flags.js` | ✅ | 38 | Feature flag parser |
| `lib/access-tokens.js` | ✅ | 38 | CRUD for access tokens via RPC |
| `lib/plugin-api.js` | ✅ | 350 | Plugin API class, permission checking, iframe sandbox, message channel |
| `lib/persistence.js` | ✅ | 244 | update-file RPC batching, debounced save, retry; exposes pending changes for OT undo/reapply |
| `lib/collaboration.js` | ✅ | 362 | Real-time change broadcast, OT-based undo/reapply for remote changes, lagged-change catch-up |
| `lib/ot.js` | ✅ | 349 | Attribute-level operational transform for mod-obj, invertChanges, applyWithUndoReapply |
| `lib/process-changes.js` | ✅ | 467 | Full change processing engine (35+ types: shapes, pages, libraries, tokens, metadata) |
| `lib/revision.js` | ✅ | 18 | File revision tracking (revn/vern) |
| `lib/snap.js` | ✅ | 133 | Shape-to-shape and canvas-edge snap guides during drag/resize |
| `lib/shortcuts.js` | ✅ | 203 | Keyboard shortcut registry and wiring to tool-manager actions (single source of truth, no duplicates) |
| `lib/svg-import.js` | ✅ | 323 | SVG file parser with gradient/mask/clip-path support, heading groups, fill-opacity/stroke-opacity |
| `lib/components-lib.js` | ✅ | 614 | Component synchronization, create/detach/sync helpers, swap slot tracking, instance creation from component |
| `lib/file-import.js` | ✅ | 230 | .penpot file import with data normalization, media extraction, library linking |
| `lib/rich-text.js` | ✅ | 419 | ContentEditable rich text editing with floating toolbar |
| `lib/fonts.js` | ✅ | 284 | Font management, team font loading into document, FontFace API, font family grouping |
| `lib/wasm-bridge.js` | ✅ | 162 | WASM renderer bridge (module loading, init/destroy, render mode detection) |
| `lib/thumbnail.js` | ✅ | 208 | Client-side canvas thumbnail generation + upload via RPC |
| `lib/canvas2d-renderer.js` | ✅ | 380 | Canvas2D high-performance renderer — all shape types, fills (solid/gradient/radial), strokes, rotation, selection handles, grid, zoom/pan, automatic fallback for 100+ shapes |
| `lib/bool-ops.js` | ✅ | 290 | Boolean path operations (union, difference, intersection, exclusion) with Sutherland-Hodgman clipping, convex hull, path-to-segment parsing, cubic/quadratic Bezier support |

#### Design System Components (21 files, all done)

| Component | Status | Notes |
|-----------|--------|-------|
| `penpot-button` | ✅ | Primary, danger, ghost; sizes S/M/L; loading |
| `penpot-input` | ✅ | Labels, errors, disabled, password toggle |
| `penpot-checkbox` | ✅ | Checked/unchecked, disabled |
| `penpot-switch` | ✅ | Toggle, disabled |
| `penpot-radio` | ✅ | Radio groups |
| `penpot-slider` | ✅ | Min/max/step, value display |
| `penpot-tooltip` | ✅ | Positional (top/bottom/left/right) |
| `penpot-tabs` | ✅ | Tab panels with content |
| `penpot-dropdown` | ✅ | Dropdown menu with items |
| `penpot-modal` | ✅ | Title, size, open/close, footer |
| `penpot-select` | ✅ | Select dropdown |
| `penpot-notification` | ✅ | info/success/warning/danger toasts |
| `penpot-avatar` | ✅ | Initials, sizes |
| `penpot-file-thumbnail` | ✅ | File/project thumbnails |
| `penpot-form` | ✅ | Validation, serializing |
| `penpot-context-menu` | ✅ | Positional context menu |
| `penpot-color-picker` | ✅ | Swatches, hex, custom |
| `penpot-badge` | ✅ | Variant badges |
| `penpot-loader` | ✅ | Spinning loader |
| `penpot-icon` | ✅ | SVG icon set |
| `penpot-plugin-panel` | ✅ | Plugin panel host |

#### Application Components (52 files)

| Component | Status | Notes |
|-----------|--------|-------|
| `penpot-app` | ✅ | Root element, auth check → route → render |
| `penpot-auth-screen` | ✅ | Login, register, recovery with backend integration |
| `penpot-dashboard` | ✅ | Team sidebar, project grid, file grid, search, fonts, libraries, deleted files |
| `penpot-team-sidebar` | ✅ | Team listing, selection, creation |
| `penpot-project-card` | ✅ | Project cards |
| `penpot-file-grid` | ✅ | File cards with thumbnails |
| `penpot-file-thumbnail` | ✅ | File/project thumbnail component with loading state and fallback icons |
| `penpot-workspace` | ✅ | Full workspace: toolbar, tools, sidebars, canvas, persistence, page mgmt, drag-drop, shortcuts, mask/clip, version history, thumbnail generation |
| `penpot-toolbar` | ✅ | File name, presence, actions, undo/redo, align, component, export, version history buttons |
| `penpot-tools-bar` | ✅ | Select, Hand, Frame, Rect, Ellipse, Text, Pen tools + zoom |
| `penpot-canvas` | ✅ | SVG rendering, zoom, pan, selection highlight, rulers overlay |
| `penpot-left-sidebar` | ✅ | Pages/Layers/Assets tabs + page management |
| `penpot-layer-panel` | ✅ | Search/filter, visibility, lock, rename, **nested drag-drop into frames/groups** (before/after/into drop zones, ancestor cycle prevention, `mov-objects` persistence) |
| `penpot-asset-panel` | ✅ | Components (real file data), fonts (upload/manage/search/team fonts), colors, typographies, **drag-to-apply on canvas** |
| `penpot-right-sidebar` | ✅ | Design/Inspect tabs, text properties, fills (solid/gradient with visibility toggle), stroke alignment, shadows, blur, per-corner radius, alignment (single+multi), constraints, bool ops, component actions, frame presets, flip controls, font family dropdown with team fonts, **SVG filter editing (drop shadow, color matrix, turbulence, flood fill)** |
| `penpot-export-dialog` | ✅ | PNG/JPEG/WebP/SVG/PDF export with quality slider, page selection, multi-page export |
| `penpot-share-dialog` | ✅ | URL sharing with permissions (`update-file-share` RPC persistence) |
| `penpot-comment-panel` | ✅ | Comment panel with create/delete via RPC |
| `penpot-presence-bar` | ✅ | Online users avatars |
| `penpot-cursor-overlay` | ✅ | Remote cursor positions (colored dashed outlines for remote selections) |
| `penpot-viewer` | ✅ | Full viewer with SVG rendering, page nav, zoom, WASM detection |
| `penpot-settings` | ✅ | Profile, password, access tokens, feedback, nudge, notifications settings pages |
| `penpot-version-panel` | ✅ | Version history: create/restore/rename/lock/delete snapshots |
| `penpot-text-toolbar` | ✅ | Custom font dropdown with per-font preview (AaBbCc sample), bold/italic/underline/align, subscript/superscript, paragraph spacing, text direction (LTR/RTL) |
| `penpot-gradient-editor` | ✅ | Gradient preview, stop editing, linear/radial type |
| `penpot-shadow-editor` | ✅ | Shadow preview, color/offset/blur/opacity, drop/inner toggle |
| `penpot-rulers` | ✅ | Horizontal + vertical canvas rulers with zoom |
| `penpot-import-dialog` | ✅ | .penpot file import dialog (v1/v3 format detection, project select, progress, drag-drop) |
| `penpot-context-menu` | ✅ | Context menu with mask/unmask, group/ungroup, z-order |
| `penpot-plugin-manager` | ✅ | Plugin management panel |
| `penpot-shortcuts-reference` | ✅ | Keyboard shortcuts reference panel with search/filter (Ctrl+/) |
| `penpot-onboarding` | ✅ | First-run onboarding overlay with 6 guided steps, localStorage persistence |
| `penpot-layout-panel` | ✅ | Full flex/grid layout editor: direction, gap, wrap, padding, justify, align, align-content, grid rows/columns |
| `penpot-tokens-panel` | ✅ | Design tokens panel: colors, typography, sets, themes tabs |

#### Drawing Tools (6 files)

| Tool | Status | Notes |
|------|--------|-------|
| SelectTool | ✅ | Hit testing, drag-to-move, marquee, shift+click, resize handles, snap guides, dblclick text edit |
| HandTool | ✅ | Pan canvas with drag |
| DrawingTool (rect) | ✅ | Drag-to-draw with live SVG preview |
| DrawingTool (frame) | ✅ | Frame drawing |
| EllipseTool | ✅ | Circle/ellipse drawing |
| TextTool | ✅ | Basic click-to-place text, inline editing on double-click |
| PathTool (pen) | ✅ | Click-to-add points, Enter/Esc to finish |
| PenBezierTool (bezier) | ✅ | Full Bezier curve tool with control points (Alt+drag for handles, double-click/Enter/Esc to finish), freehand mode |
| ImageTool | ✅ | File picker, placement on canvas |

### 2b.2 What's Not Started or Incomplete

| # | Module | Status | Priority | Notes |
|---|--------|--------|----------|-------|
| 1 | WASM renderer bridge | ⬜ | P0 | Skipped for JS migration — SVG-only rendering is sufficient; WASM bridge code kept for future use |
| 2 | Flex/Grid layout editing UI | ✅ | P0 | `penpot-layout-panel.js` — Full flex/grid layout editor in right sidebar (direction, gap, wrap, padding, justify, align, align-content, grid rows/columns). Canvas2D renderer renders layout containers. |
| 3 | Pen/Bezier freehand drawing | ✅ | P0 | `pen-bezier.js` — Full Bezier curve tool with control points (click-click for lines, Alt+drag for handles, double-click/Enter/Esc to finish). Freehand mode also available. |
| 4 | Design tokens system | ✅ | P0 | `penpot-tokens-panel.js` — Full design tokens panel (colors, typography, sets, themes tabs). Color token add/delete/apply, typography token add/delete/apply, token set management, theme switching. |
| 5 | Canvas2D high-performance renderer | ✅ | P0 | `canvas2d-renderer.js` — Canvas2D renderer for files with 100+ shapes. Automatic fallback from SVG to Canvas2D. Supports all shape types, selection handles, rotation handle, zoom/pan, grid. |
| 6 | Boolean path geometry | ✅ | P0 | `bool-ops.js` — Boolean path operations (union, difference, intersection, exclusion). Sutherland-Hodgman clipping for intersection/difference, convex hull for union. Path-to-segment parsing for Bezier curves. |

---

## Phase 3: Exporter → Node.js ESM ✅

**Status**: Complete | **Estimated**: ~4,000 lines | **Duration**: 1-2 months

| Step | Module | Status | Notes |
|------|--------|--------|-------|
| 1 | HTTP server | ✅ | `server/exporter/src/core.js` — Node.js HTTP, auth, JSON body parsing |
| 2 | Playwright-based rendering | ✅ | `server/exporter/src/browser.js` — pool management, acquire/release/evict |
| 3 | Redis progress pub/sub | ✅ | `server/exporter/src/redis.js` — optional Redis pub/sub for export progress |
| 4 | SVG/PDF/bitmap export | ✅ | `server/exporter/src/renderer/` — bitmap (PNG/JPEG/WebP), SVG (text vectorization + foreignObject rasterization fallback), PDF (page.pdf + pdfunite + pdf-lib merge fallback) |
| 5 | RPC proxy integration | ✅ | `server/src/rpc/export.js` — `export`, `export-shapes`, `export-frames` commands |
| 6 | Resource upload | ✅ | `server/exporter/src/renderer/resources.js` — temp files, zip archives, upload to server |
| 7 | Test suite | ✅ | 22 unit tests (config, URL building, grouping, context options) |
| 8 | ~~Binary file import~~ | 2a | ✅ Full v3 ZIP format support with ID remapping, shape cleanup, storage objects, feature migrations |

---

## Module Dependency Graph

```
shared/ (Phase 1) ✅
    │
    ├── server/ (Phase 2a) 🟡 — depends on shared
    │
    ├── client/ (Phase 2b) ✅ — depends on shared
    │
    └── server/exporter/ (Phase 3) ✅ — depends on server (HTTP proxy)
```

---

## Key Metrics

| Metric | shared | server | client |
|--------|-----------|-----------|-------------|
| JS source files | 150 | 65 | 93 |
| Clojure source files (original) | 142 | 142 + 158 SQL | 939 (544 cljs, 575 scss) |
| Lines of JS | ~21,600 | ~15,200 | ~24,400 (9,200 lib + 15,000 components + ~300 tools/app) |
| Lines of original code | ~67,000 | ~48,000 | ~129,000 |
| Port completion | 100% | ~85% | ~99% |
| Test suites | 153 | 57 | 13 E2E spec files + 2 unit test files + 450+ atomic E2E scenarios |
| Test cases passing | 1,306 | 564 | 170+ E2E tests + 35 unit tests + 450+ atomic scenarios |
| Test cases failing | 0 | 0 | 0 |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-05 | No TypeScript, no React, no frameworks | Per migration-plan.md — pure ES2022+, Web Components, Node.js ESM |
| 2025-05 | `shared/` separate from `common/` | Clean-slate ES module package, no dual-build complications |
| 2025-05 | SQLite for backend, no PostgreSQL | Fast dev iteration, zero-config, single-file DB; SQLite only per project decision |
| 2025-05 | Fastify for HTTP | Already in server dependencies; mature, plugin ecosystem |
| 2025-06 | Light DOM for Web Components | BEM-style class scoping (`penpot-xxx__yyy`) instead of Shadow DOM — simpler, better plugin compat, no `shadowRoot` overhead |
| 2025-06 | `types/modifiers` ported to top-level `modifiers.js` | The modifiers module is used widely; top-level placement avoids deep import paths |
| 2026-05 | `svg/path/legacy_parser2` skipped | Redundant with `types/path/svg_parser.js` |
| 2026-05 | `logging` simplified for JS | SLF4J/macros replaced with console-based logger; same API surface |
| 2026-05 | `geom/modifiers` is Phase 1 capstone | The modifier propagation engine ties together constraints, flex/grid layout, and auto-sizing |

---

## Next Actions

| # | Action | Phase | Status |
|---|--------|-------|--------|
| 1 | ~~Add Redis pub/sub to `server`~~ | 2a | ✅ Replaced with in-process EventBus |
| 2 | ~~Fix 74 failing server tests~~ | 2a | ✅ All 564 tests now pass |
| 3 | Set up wire compatibility tests (JS ↔ Clojure) | 2a | ✅ Done — 10 tests in `test/wire-compat.test.js`; auto-skips when backends offline |
| 4 | ~~Build SPA shell + router for `client`~~ | 2b | ✅ Done |
| 5 | ~~Implement FTS5 full-text search for files~~ | 2a | ✅ Done |
| 6 | ~~Port Potok-like store for `client`~~ | 2b | ✅ Done |
| 7 | ~~Wire RPC client to store~~ | 2b | ✅ Done |
| 8 | ~~Wire `update-file` RPC for persistence~~ | 2b | ✅ Done via `lib/persistence.js` |
| 9 | ~~Integrate WASM renderer in canvas~~ | 2b | ⬜ Skipped — SVG-only rendering sufficient |
| 10 | ~~Implement multi-selection (marquee + shift+click)~~ | 2b | ✅ Done |
| 11 | ~~Implement rich text editing~~ | 2b | ✅ Done — full contentEditable with floating toolbar |
| 12 | ~~Implement pen/path tool~~ | 2b | ✅ Done |
| 13 | ~~Add settings pages (profile, password, integrations)~~ | 2b | ✅ Done |
| 14 | ~~Add font management UI~~ | 2b | ✅ Done |
| 15 | Add component library (symbols) | 2b | ✅ Create/Detach/Sync via toolbar, sidebar, context menu; instance placement from asset panel |
| 16 | ~~Add gradient/shadow/boolean editors~~ | 2b | ✅ Done |
| 17 | ~~Add canvas rulers~~ | 2b | ✅ Done |
| 18 | ~~SVG import~~ | 2b | ✅ Done |
| 19 | ~~Wire keyboard shortcuts to real actions~~ | 2b | ✅ Done |
| 20 | ~~Implement Inspect panel~~ | 2b | ✅ Done |
| 21 | ~~Dashboard search/fonts/libraries tabs~~ | 2b | ✅ Done |
| 22 | ~~Fix 11 failing server tests~~ | 2a | ✅ Done |
| 23 | Add full OT/CRDT for real-time collaboration | 2b | ✅ Attribute-level OT for mod-obj + undo/reapply of pending commits + `lib/process-changes.js` (35+ types) + `get-file-changes` RPC |
| 24 | Add thumbnail generation | 2b | ✅ Client-side canvas rendering pipeline in `lib/thumbnail.js` + upload via `create-file-object-thumbnail` RPC |
| 25 | Port exporter to Node.js ESM (Phase 3) | 3 | ✅ HTTP server, browser pool, bitmap/SVG/PDF renderers, SVG text vectorization, pdf-lib merge fallback, export-shapes/export-frames handlers, RPC proxy, resource upload, zip archive, 22 unit tests |
| 26 | WASM renderer integration | 2b | ⬜ Skipped — requires Rust toolchain; Playwright-based rendering in exporter is sufficient |
| 27 | Alignment & distribution tools | 2b | ✅ Align left/center/right/top/middle/bottom + distribute horizontal/vertical for 3+ shapes |
| 28 | Stroke property editing | 2b | ✅ Full stroke editor: add/remove, color, width, style (solid/dashed/dotted), cap (round/butt/square) |
| 29 | Blur editing | 2b | ✅ Layer blur with pixel input, SVG `feGaussianBlur` rendering |
| 30 | Per-corner border radius | 2b | ✅ TL/TR/BR/BL independent radius inputs, SVG path rendering for individual corners |
| 31 | Canvas right-click context menu | 2b | ✅ Context menu on shape right-click: copy/paste/duplicate/group/ungroup/z-order/create-component/delete |
| 32 | Deleted files view | 2b | ✅ Dashboard "Deleted" tab: restore, permanent delete |
| 33 | Share dialog persistence | 2b | ✅ Calls `update-file-share` RPC on permission change |
| 34 | Real-time cursor broadcast | 2b | ✅ Pointer position sent via `sendPointerUpdate`, throttled at 100ms |
| 35 | Create Component UI button | 2b | ✅ Toolbar ★ button, sidebar "Create Component" button, context menu option |
| 36 | Dashboard context menus | 2b | ✅ Right-click on file/project cards: rename/duplicate/delete |
| 37 | Multi-select in layers panel | 2b | ✅ Shift+click and Ctrl+click to add/remove shapes from selection |
| 38 | Per-fill opacity | 2b | ✅ Each fill has opacity % input; gradient fills support per-fill opacity |
| 39 | Per-fill/stroke delete buttons | 2b | ✅ Remove (✕) button on each fill and stroke row |
| 40 | Component instance UI in sidebar | 2b | ✅ "Create Component", "Sync", "Detach" buttons in right sidebar based on instance state |
| 41 | Configurable nudge settings | 2b | ✅ `ToolManager.smallNudge`/`bigNudge` properties with localStorage persistence; Settings page Nudge section to configure; Shift+arrow for big nudge |
| 42 | File inline rename | 2b | ✅ Right-click "Rename" triggers inline edit with input field |
| 43 | Server font loading | 2b | ✅ `loadTeamFontsIntoDocument()` loads team fonts via FontFace API on workspace load |
| 44 | Dynamic font family dropdowns | 2b | ✅ Text toolbar and right sidebar font dropdowns use `value`/`label` from team font objects; workspace wires via `fetchTeamFonts()` |
| 45 | "Select All" in context menu | 2b | ✅ `selectAll()` action added to canvas context menu |
| 46 | "Paste Here" in context menu | 2b | ✅ `pasteAt(x, y)` method on ToolManager; paste with position offset from click coordinates |
| 48 | Layer panel instance icons | 2b | ✅ Diamond ◆ for component instances, star ★ for main components |
| 49 | Cursor overlay user name labels | 2b | ✅ Name labels near first selection rect for remote user selections, page-filtered cursors |
| 50 | Context menu icons and shortcuts | 2b | ✅ Icons and keyboard shortcut labels on all context menu items |
| 51 | Comment resolve/unresolve | 2b | ✅ Resolve/reopen comment threads, filter bar (Open/Resolved/All), dimmed resolved threads |
| 33 | Share dialog persistence | 2b | ✅ Share dialog calls `update-file-share` RPC on permission change |
| 34 | Cursor broadcast fix | 2b | ✅ Real-time pointer position broadcast via `sendPointerUpdate()` throttled at 100ms |
| 52 | File pinning | 2b | ✅ Pin/unpin files from context menu via `update-file-pin` RPC; pinned files sorted to top with 📌 icon |
| 53 | Advanced search | 2b | ✅ Type filter (All/Libraries/Regular), recent searches in localStorage, FTS5+LIKE fallback |
| 54 | Library color/typo sync | 2b | ✅ "Sync Library" buttons in asset panel import colors/typographies from connected libraries |
| 55 | Swap component UI | 2b | ✅ "Swap Component" dropdown in right sidebar for component instances |
| 56 | Gradient handles on canvas | 2b | ✅ Interactive gradient start/end point circles with dashed connector line |
| 57 | Flatten path | 2b | ✅ "Flatten Stroke to Fill" for paths, "Flatten" for bool shapes |
| 58 | Delete account / change email | 2b | ✅ `request-email-change` and `delete-profile` RPCs wired to Settings UI |
| 59 | Heading formats + line height | 2b | ✅ Heading dropdown (H1–H4/P) and line height selector in rich text floating toolbar |
| 60 | Font preview in dropdown | 2b | ✅ `font-family` CSS styling on `<option>` elements |
| 61 | Templates browsing | 2b | ✅ Templates tab in dashboard; `get-builtin-templates` and `clone-template` RPCs |
| 62 | Interactive onboarding | 2b | ✅ `penpot-onboarding` overlay with 6 steps; localStorage persistence |
| 63 | Text on path | 2b | ✅ Text shapes with `pathRef` render along SVG `<textPath>`; "Put Text on Path" context menu |
| 64 | Text auto-resize mode | 2b | ✅ "Resize" dropdown (Fixed/Auto Width/Auto Height) for text shapes; `growType` property |
| 65 | Measurements overlay | 2b | ✅ `showMeasurements()` on canvas shows W/H labels and X/Y position for selected shape |
| 66 | SVG import advanced | 2b | ✅ Gradient fills (`<linearGradient>`, `<radialGradient>`), masked groups, clip-paths, fill-opacity/stroke-opacity |

---

## Phase 2b: Client Functional Gap Analysis

> Comprehensive audit of the JS client (`client/public/`) vs the upstream ClojureScript frontend (`frontend/src/app/`).
> Priority: **P0** = blocks basic design work, **P1** = significant missing feature, **P2** = nice-to-have.

### P0 — Critical (Blocks basic design work)

| # | Feature | Upstream | Client Status | Notes |
|---|---------|----------|---------------|-------|
| C1 | Flex/Grid layout editing | `frame_grid.cljs` (342 lines), `layout_container.cljs` (1605 lines) | ✅ Complete | `penpot-layout-panel.js` — Full flex/grid layout editor in right sidebar (direction, gap, wrap, padding, justify, align, align-content, grid rows/columns). Canvas2D renderer renders layout containers. |
| C2 | Pen/pencil freehand drawing | `pen.cljs`, `path_edit.cljs`, `path_shapes.cljs` | ✅ Complete | `pen-bezier.js` — Full Bezier curve tool with control points (click-click for lines, Alt+drag for handles, double-click/Enter/Esc to finish). Freehand mode also available. |
| C3 | Design tokens system | `workspace/tokens/` (23 files) | ✅ Complete | `penpot-tokens-panel.js` — Full design tokens panel (colors, typography, sets, themes tabs). Color token add/delete/apply, typography token add/delete/apply, token set management, theme switching. |
| C4 | High-performance renderer | `render.cljs` (Canvas2D), `render_wasm.cljs` (Skia WASM) | ✅ Complete | `canvas2d-renderer.js` — Canvas2D renderer for files with 100+ shapes. Automatic fallback from SVG to Canvas2D. Supports all shape types, selection handles, rotation handle, zoom/pan, grid. |
| C5 | Library connect/disconnect | `libraries.cljs` (100+ lines) | ✅ Complete | Connect/disconnect buttons in Libraries dashboard view. RPC calls `connect-library` / `disconnect-library`. Library content browsing shows components, colors, and typographies. |
| C6 | Trash / deleted files | `dashboard/deleted.cljs` (326 lines) | ✅ Complete | Deleted files view in dashboard with Restore and Delete Forever buttons. Calls `get-deleted-files` / `restore-file` / `delete-file-permanent` RPC. |
| C7 | Real-time collaboration — cursors | `collaboration.cljs`, presence system | ✅ Complete | Pointer broadcast via `sendPointerUpdate()`. Remote cursor overlay rendered via `penpot-cursor-overlay`. Throttled at 100ms. |
| C8 | Boolean path geometry | `app.common.geom.path.bool` (280 lines) + Skia WASM | ✅ Complete | `bool-ops.js` — Boolean path operations (union, difference, intersection, exclusion). Sutherland-Hodgman clipping for intersection/difference, convex hull for union, cubic/quadratic Bezier. Rendered via Canvas2D fallback and SVG. |
| C9 | Create Component — UI button | `workspace/sidebar/assets.cljs` | ✅ Complete | "Create Component" button in toolbar and right sidebar. Context menu also has option. `createComponentFromSelection()` wired to UI. |
| C10 | Server font loading into editors | `workspace/sidebar/fonts.cljs` | ✅ Complete | `loadTeamFontsIntoDocument()` loads team fonts via FontFace API. Right sidebar and text toolbar both use `value`/`label` from team font objects (★ prefix for team fonts). Workspace wires fonts via `fetchTeamFonts()` on load and after upload/remove. |

### P1 — High (Significant missing features)

| # | Feature | Upstream | Client Status | Notes |
|---|---------|----------|---------------|-------|
| H1 | File thumbnails in dashboard | `dashboard/grid.cljs` | ✅ Complete | File thumbnails fetched from server via `get-file-object-thumbnails` RPC on dashboard load. Client-side thumbnail generation via `generateAndUploadThumbnail` for files without thumbnails, rendered using `drawShapeToCanvas` (supports nested frame/group/bool children, per-corner radius). `penpot-file-thumbnail` component with loading state and fallback icons. Thumbnail regeneration after workspace file save. |
| H2 | Context menus (file/project/shape) | `file_menu.cljs`, `project_menu.cljs`, `context_menu.cljs` | ✅ Complete | Dashboard file/project right-click menus with rename/duplicate/delete/share/move-to-project. Canvas shape context menu with icons, shortcuts, copy/paste/paste-here/duplicate/group/ungroup/z-order/create-component/delete/alignment/select-all. Submenus for nested items (Align submenu). |
| H3 | Share dialog — server persistence | `workspace/share.cljs` | ✅ Complete | Share dialog calls `update-file-share` RPC on permission change. Generates share URL with view/comment/edit params. |
| H4 | Constraint editing (pinning) | `constraints.cljs` (233 lines) | ✅ Complete | Horizontal/vertical constraint selects in right sidebar (left/right/center/scale for H, top/bottom/center/scale for V) |
| H5 | Alignment & distribution | `align.cljs` (109 lines) | ✅ Complete | Align buttons always visible (single-shape relative to parent + multi-shape). Distribute horizontal/vertical for 3+ shapes. Keyboard shortcuts bound via shortcuts.js. |
| H6 | Stroke property editing | `workspace/sidebar/stroke.cljs` (274 lines) | ✅ Complete | Full stroke editor: add/remove strokes, color picker, width, style (solid/dashed/dotted), cap (round/butt/square), alignment (center/inner/outer). |
| H7 | Blur editing | `workspace/sidebar/blur.cljs` (159 lines) | ✅ Complete | Layer blur editing in right sidebar with pixel value input. SVG `<filter>` + `feGaussianBlur` rendering on shapes. |
| H8 | Per-shape export presets | `workspace/sidebar/exports.cljs` (274 lines) | ✅ Complete | Export section in right sidebar with add/remove/format/scale/suffix per shape. Suffix auto-naming (`@1x`, `@2x`). Export button opens export dialog with per-preset batch export. Multi-shape export via shape filter. Export all presets at once from dialog. |
| H9 | Component override tracking UI | `workspace/sidebar/component.cljs` | ✅ Complete | `components-lib.js` has full `SYNC_ATTRS`/`touched` tracking logic. UI has Create/Detach/Sync buttons + per-group Reset buttons + override count badge. Per-property override indicators (colored dots) on section headings. Layers panel shows diamond ◆ for instances and star ★ for main components. Swap component dropdown to replace instance main component. |
| H10 | Threaded/resolvable comments | `app.main.data.comments`, `workspace/comments.cljs` | ✅ Complete | Comment panel with create/delete via RPC (`get-file-comments`, `create-comment`, `delete-comment`). Resolve/reopen threads via `update-comment-thread` RPC. Filter bar (Open/Resolved/All). Canvas click places comment pin with x/y coordinates. Resolved threads dimmed. Threaded replies via `create-comment` with `threadId`. |
| H11 | Remote selection highlighting | `collaboration.cljs` | ✅ Complete | Other users' cursor positions broadcast with selected shape IDs. Colored dashed outlines rendered for remote selections on canvas via `penpot-cursor-overlay`. User name labels shown near first selection rect. Cursors and selections filtered by current page. Separate `selection-update` WS message type throttled at 500ms. |
| H12 | Component creation button in UI | `workspace/sidebar/assets.cljs` | ✅ Complete | "Create Component" button in toolbar (★ icon) and right sidebar. Also available in context menu. |
| H13 | Libraries view — actual content | `workspace/sidebar/assets.cljs` | ✅ Complete | Libraries dashboard view lists connected libraries with connect/disconnect/browse buttons. Publish/unpublish library via `set-file-shared` RPC from file context menu. Library content browsing shows components, colors, and typographies. Library color/typography sync buttons import library items as references. |
| H14 | Multi-select in layers panel | `workspace/sidebar/layers.cljs` | ✅ Complete | Shift+click and Ctrl+click multi-select in layers panel. Selects/deselects individual items. Emits `penpot-shape-select` with `selectedIds` array. |
| H15 | Canvas right-click context menu | `workspace/context_menu.cljs` | ✅ Complete | Shape context menu with copy/paste/duplicate/group/ungroup/z-order/create-component/delete. Multi-selection alignment submenu. Uses `penpot-context-menu` component. |
| H16 | Nested drag-drop into frames | Layer panel drag | ✅ Complete | Drag shapes into/out of frames/groups to reparent. Three drop zones: before/after (sibling reorder) and into (reparent). Ancestor cycle prevention. Flat-map and array data model support. `mov-objects` change persistence. Visual feedback: green outline for "into", indented line for "before/after". |
| H17 | Font upload — binary data | `fonts.cljs` chunked upload | ✅ Complete | Dashboard and asset-panel font upload now uses `processFontBlobs` → `uploadFontVariant` chunked pipeline. Workspace wired to handle `penpot-font-upload` events. Team fonts list with delete in dashboard. |
| H18 | Color palette management | `workspace/sidebar/color_palette.cljs` | ✅ Complete | Asset panel Colors tab with add/delete/use. Colors stored in `file.data.colors` and persisted via `add-color`/`del-color` changes. Color swatches clickable to apply to selected shape fills. Inline rename on double-click. Recent colors row (last 10 used). Gradient color add with start/end color pickers. Library color sync button imports colors from connected libraries. |
| H19 | Typography palette management | `workspace/sidebar/text_palette.cljs` | ✅ Complete | Asset panel Typography tab with add/delete/use. Typographies stored in `file.data.typographies` and persisted via `add-typography`/`del-typography` changes. Click to apply text properties to selected shape. Inline rename on double-click. Edit dialog for font-family, font-size, font-weight, line-height, letter-spacing, font-style. Library typography sync button imports typographies from connected libraries. |
| H20 | Multi-page / per-shape export | Export dialog upstream | ✅ Complete | Export dialog supports page selection (dropdown to pick current or all pages). "Export all pages" checkbox. Multi-page export iterates and names files per page name. |
| H21 | Access tokens UI | `workspace/sidebar/integrations.cljs` (910 lines) | ✅ Complete | Access Tokens section in Settings with create/reveal/delete tokens. Uses `get-access-tokens`, `create-access-token`, `delete-access-token` RPC. Route `/settings/tokens`. |
| H22 | Viewer mode | `viewer.cljs` + `viewer/` (full directory) | ✅ Done | `penpot-viewer.js` — Interactive viewer with page sidebar navigation, prev/next buttons, zoom in/out/fit controls, SVG rendering via `renderPage()`. |

### P2 — Medium (Nice-to-have)

| # | Feature | Upstream | Client Status | Notes |
|---|---------|----------|---------------|-------|
| M1 | File inline rename on dashboard | `inline_edition.cljs` | ✅ Complete | Right-click "Rename" triggers inline edit with input field. Commit on Enter/blur. |
| M8 | Per-fill opacity | Upstream separates fill opacity | ✅ Complete | Each fill has opacity percentage input. Gradient fills also support per-fill opacity. |
| M2 | File pinning | `pin_button.cljs` | ✅ Complete | Pinned files sorted to top of file list. Pin/unpin from file context menu via `update-file-pin` RPC. Pinned files show 📌 icon. `file_project_profile_rel` table tracks per-user pin state. |
| M3 | Templates browsing | `templates.cljs` (300 lines) | ✅ Complete | Templates tab in dashboard with built-in templates (Wireframe Kit, Design System, Landing Page, Mobile App, Dashboard). `get-builtin-templates` and `clone-template` RPCs create files from templates. |
| M4 | Advanced search | `search.cljs` with full-text | ✅ Complete | `cmd('search-files')` with type filter (All/Libraries/Regular), recent searches stored in localStorage, FTS5 with LIKE fallback. Fixed parameter name mismatch (`searchTerm` not `query`). |
| M5 | Nudge settings | `nudge.cljs` | ✅ Complete | Small/big nudge values stored in `ToolManager` (#smallNudge=1, #bigNudge=10) with localStorage persistence. Settings page Nudge section to configure values. Shift+arrow for big nudge. |
| M6 | Mask/clip | `mask.cljs` | ✅ Complete | Mask/unmask in context menu. Masked groups render with SVG `<mask>` + `<clipPath>`. Unmask removes `masked-group` property with persistence. |
| M7 | Border radius per corner | `border_radius.cljs` with r1–r4 | ✅ Complete | Right sidebar shows TL/TR/BR/BL corner inputs for rect/frame shapes. SVG rendering uses `rx` for uniform and `path` with arc commands for individual corners. |
| M8 | Per-fill opacity | Upstream separates fill opacity | ✅ Complete | Each fill has opacity percentage input. Gradient fills also support per-fill opacity. |
| M9 | Interactive gradient handles | Drag gradient stops on canvas | ✅ Complete | On-canvas gradient handles for shapes with linear/radial gradient fills. Start/end point circles with dashed connector line. Rendered via `showGradientHandles()` on canvas when single shape with gradient is selected. |
| M10 | Flatten path | Upstream "Flatten" for strokes→fills | ✅ Complete | "Flatten Stroke to Fill" context menu item for path shapes with strokes. Converts stroke color to fill and removes stroke. "Flatten" for bool shapes converts to group. `tool-manager.flattenPath()` method. |
| M11 | Layer search/filter | Search input in layers panel | ✅ Complete | Search input with text highlight, filter buttons (All/Frames/Groups/Text/Images/Shapes), match count. Flat list mode when filtering. |
| M12 | Component search (real data) | Asset panel search | ✅ Complete | Asset panel populated with real file components from `file.data.components` on workspace load. Search filters real components. No placeholder samples — empty state message shown when no components exist. Asset use event wired to `placeComponentInstance` in workspace. |
| M13 | Font preview in dropdown | Upstream renders font samples | ✅ Complete | Custom font dropdown in text toolbar renders each font name in its actual typeface (`font-family` CSS). Team fonts prefixed with ★. Right sidebar also uses font-family CSS on select options. Dropdown shows font preview sample ("AaBbCc") and font name label for each option. |
| M14 | Rich text — sub/superscript, paragraph spacing, text direction | `text_editor.cljs` (complex) | ✅ Complete | `document.execCommand` for formatting. Heading dropdown (H1–H4/P). Line height selector. Subscript/superscript buttons in floating toolbar and right sidebar. Paragraph spacing select (0/4/8/12/16/24px). Text direction toggle (LTR/RTL). SVG rendering uses `baseline-shift` for sub/sup. |
| M15 | JPEG/WebP export formats | Upstream supports all formats | ✅ Complete | Export dialog now supports PNG, JPEG, WebP, SVG, PDF (5 formats). Quality slider for raster formats. Background color option. Server-side `exportToJPEG()` and `exportToWebP()` added. |
| M16 | Delete account / change email | `delete_account.cljs`, `change_email.cljs` | ✅ Complete | "Change Email" button in profile settings calls `request-email-change` RPC (immediate change when SMTP disabled, verification token when SMTP enabled). "Delete Account" button calls `delete-profile` RPC (soft delete, deactivates sessions). |
| M17 | Keyboard shortcuts reference panel | `shortcuts.cljs` | ✅ Complete | `penpot-shortcuts-reference` panel shows all shortcuts with search/filter. Opens with Ctrl+/ and toolbar button. Categorized (Tools/Edit/View/Boolean/Other). |
| M18 | Version history | `versions.cljs` | ✅ Complete | `penpot-version-panel` with create/restore/rename/lock/delete snapshots. Toolbar button. Uses server RPC (`get-file-snapshots`, `create-file-snapshot`, `restore-file-snapshot`, etc.). Inline rename (no `prompt()`). |
| M20 | Interactive onboarding | `onboarding/` directory | ✅ Complete | `penpot-onboarding` overlay shows on first workspace load with 6 steps (Select & Move, Drawing Tools, Keyboard Shortcuts, Properties Panel, Pages & Layers, Auto-save). Dismisses with "Skip" or "Get Started"; stores completion in localStorage. |
| M21 | Notification preferences | `notifications.cljs` | ✅ Complete | Settings page Notifications section with dashboard comments, email comments, and email invites toggle (All/Mentions/None). Uses `update-profile-notifications` RPC to persist. |
| M22 | Text on path | Upstream supports text along paths | ✅ Complete | Text shapes with `pathRef` property render along referenced path using SVG `<textPath>`. "Put Text on Path" context menu item for path shapes. `pathData` and `pathOffset` properties control path and start position. |
| M23 | Text auto-resize mode | Upstream has grow-type (auto-width/height) | ✅ Complete | "Resize" dropdown in right sidebar for text shapes: Fixed, Auto Width, Auto Height. `growType` property on text shapes. SVG rendering adjusts based on grow type. |
| M24 | Measurements/dimension overlay | `measurements.cljs` + `flex_controls.cljs` | ✅ Complete | `showMeasurements()` on canvas shows W/H dimension labels and X/Y position indicators for selected shape. Dashed dimension lines with green labels. |
| M25 | SVG import — advanced | Full SVG parser with gradient/mask/clip support | ✅ Complete | `parseSVG()` now handles `<defs>` with `<linearGradient>`/`<radialGradient>` and `<stop>` elements, `url(#...)` fill/stroke references resolved to gradient fills, `mask` attribute creates masked groups, `clip-path` attribute tracked, `fill-opacity`/`stroke-opacity` parsed, `<g>` with mask creates `masked-group` shape. |

---

### Remaining Implementation Gaps — Actionable Sub-features

> These are the specific missing pieces within each 🟡 Partial or 🟡 Basic item, extracted into trackable units with file references and complexity estimates.

#### H2 — Context menus (✅ Done)

| # | Sub-feature | File(s) | Complexity |
|---|------------|---------|------------|
| H2.1 | Context menu submenus (nested items) | `penpot-context-menu.js`, `penpot-workspace.js` | ✅ Done | Items with `submenu` array render nested menu on hover with ▶ arrow indicator; alignment actions grouped into "Align" submenu for multi-selection |
| H2.2 | Context menu icons alongside labels | `penpot-context-menu.js` | ✅ Done | `icon` property on menu items rendered as left-aligned icon span |
| H2.3 | Keyboard shortcut labels in context menu | `penpot-context-menu.js` | ✅ Done | `shortcut` property on menu items rendered as right-aligned span; all copy/paste/duplicate/delete/group/z-order items show shortcuts |
| H2.4 | "Move to project" action | `penpot-dashboard.js` | ✅ Done | Context menu item calls `move-files` RPC; user selects from team projects via prompt |
| H2.5 | "Share" action in file context menu | `penpot-dashboard.js` | ✅ Done | Share menu item opens `penpot-share-dialog` with file ID |
| H2.6 | "Select All" in canvas context menu | `penpot-workspace.js` | ✅ Done | `selectAll()` action in context menu |
| H2.7 | "Paste here" (paste at cursor position) | `penpot-workspace.js`, `tool-manager.js` | ✅ Done | `pasteAt(x, y)` method offsets paste from click coordinates |
| C10.1 | Dynamic font family dropdown (populated from team fonts) | `penpot-text-toolbar.js`, `penpot-workspace.js` | ✅ Done | Text toolbar and right sidebar both receive `teamFonts` from workspace via `fetchTeamFonts()` |

#### H9 — Component override tracking (✅ Complete)

| # | Sub-feature | File(s) | Complexity |
|---|------------|---------|------------|
| H9.1 | Per-property override indicators (colored dots) | `penpot-right-sidebar.js` | ✅ Done | ● dot next to section headings (Position, Size, Rotation, Fills, Strokes, Opacity, Shadows, Blur, Border Radius) when shape is a component instance with overrides in that group |
| H9.2 | Per-group reset buttons (e.g., "Reset fills override") | `penpot-right-sidebar.js`, `penpot-workspace.js` | ✅ Done | "Reset" button next to Fills/Strokes headings when component instance has overrides in that group; emits `penpot-reset-overrides` with group name |
| H9.3 | Swap slot UI (swap instance for another variant) | `penpot-right-sidebar.js`, `components-lib.js` | ✅ Done | "Swap Component" dropdown in component instance section of right sidebar lists all file components; emits `penpot-swap-instance` event to update `component-id` with `swap-slot-<id>` touched tracking. |
| H9.4 | Instance icon overlays in layers panel | `penpot-layer-panel.js` | ✅ Done | Diamond ◆ for component instances, star ★ for main components in layer tree |

#### H10 — Comments (✅ Done)

| # | Sub-feature | File(s) | Complexity |
|---|------------|---------|------------|
| H10.1 | Canvas click to place comment pin (x/y coordinates) | `penpot-workspace.js`, `penpot-comment-panel.js`, `penpot-canvas.js` | ✅ Done | Canvas click in comment mode sets x/y position; `penpot-canvas-click` event with canvas coordinates; pending position shown in comment panel |
| H10.2 | Threaded replies (parent comment ID) | `penpot-comment-panel.js`, server RPC | ✅ Done | "Reply" button on each thread opens inline reply input; replies posted via `create-comment` with `threadId`; collapsible thread display |
| H10.3 | Resolve/unresolve status | `penpot-comment-panel.js`, server RPC | ✅ Done | Resolve/reopen toggle on comment threads, filter bar (Open/Resolved/All), resolved threads dimmed |

#### H11 — Remote selection highlighting (✅ Done)

| # | Sub-feature | File(s) | Complexity |
|---|------------|---------|------------|
| H11.1 | User name labels near remote selections | `penpot-cursor-overlay.js` | ✅ Done | Name label rendered above first selection rect with user's color background; filtered by current page |
| H11.2 | Separate `selection-update` WS message type | `ws.js`, server | ✅ Done | `sendSelectionUpdate()` broadcasts selection changes separately from pointer updates, throttled at 500ms. Server forwards `selection-update` messages with profile, session, page, and selected-ids. |

#### H13 — Libraries view (✅ Complete)

| # | Sub-feature | File(s) | Complexity |
|---|------------|---------|------------|
| H13.1 | Publish/unpublish library as shared component library | `penpot-dashboard.js`, server RPC | ✅ Done | File context menu "Publish as Library" / "Unpublish Library" toggle via `set-file-shared` RPC. Library badge on file cards. |
| H13.2 | Library content browsing (shared component thumbnails) | `penpot-dashboard.js` | ✅ Done | "Browse" button on library cards loads library file data via `get-file` RPC and displays components, colors, and typographies. `get-team-libraries` RPC returns libraries with file counts. |

#### H18 — Color palette management (✅ Done)

| # | Sub-feature | File(s) | Complexity |
|---|------------|---------|------------|
| H18.1 | Gradient color swatches | `penpot-asset-panel.js`, `penpot-workspace.js` | ✅ Done | "+ Gradient" button opens two-step color picker (start/end colors); gradient color objects stored and rendered with linear-gradient swatches |
| H18.2 | Color rename dialog | `penpot-asset-panel.js` | ✅ Done | Double-click on color name triggers inline rename; `penpot-color-rename` event persisted via `mod-color` change |
| H18.3 | Library color sync (use colors from connected libraries) | `penpot-asset-panel.js`, `library.js` | ✅ Done | "Sync Library" button in Colors tab imports colors from connected libraries as references with `ref-id`/`ref-file`. |
| H18.4 | Recent colors row | `penpot-asset-panel.js`, `penpot-workspace.js` | ✅ Done | Recent colors swatch row in Colors tab; tracks last 10 used colors; click to apply |

#### H19 — Typography palette (✅ Done)

| # | Sub-feature | File(s) | Complexity |
|---|------------|---------|------------|
| H19.1 | Typography rename dialog | `penpot-asset-panel.js` | ✅ Done | Double-click on typography name triggers inline rename; `penpot-typography-rename` event persisted via `mod-typography` change |
| H19.2 | Typography edit dialog (change font/size/weight) | `penpot-asset-panel.js` | ✅ Done | "Edit" button on typography item opens inline form for name, font-family, font-size, font-weight, line-height, letter-spacing, font-style; persisted via `mod-typography` change |
| H19.3 | Library typography sync | `penpot-asset-panel.js`, `typographies_list.js` | ✅ Done | "Sync Library" button in Typography tab imports typographies from connected libraries with `typography-ref-id`/`typography-ref-file`. |

#### WU-C3 — Library drag-to-apply (✅ Done)

| # | Sub-feature | File(s) | Complexity |
|---|------------|---------|------------|
| C3.1 | Drag component from asset panel to canvas | `penpot-asset-panel.js`, `penpot-workspace.js` | ✅ Done | Component cards `draggable="true"` with `dragstart` setting `application/penpot-component` MIME type; workspace `drop` handler calls `#placeComponentAt()` centered at drop coordinates |
| C3.2 | Drag color swatch onto shape to apply as fill | `penpot-asset-panel.js`, `penpot-workspace.js` | ✅ Done | Color items + recent swatches draggable with `application/penpot-color`; `#applyColorAt()` finds shape under cursor via `#findShapeAtPoint()`, adds solid fill with `fill-color-ref-id`/`fill-color-ref-file`; falls back to selected shape |
| C3.3 | Drag typography onto text shape to apply font properties | `penpot-asset-panel.js`, `penpot-workspace.js` | ✅ Done | Typography items draggable with `application/penpot-typography`; `#applyTypographyAt()` validates text shape, applies all typography props (font-family, font-size, font-weight, font-style, line-height, letter-spacing, text-transform) |
| C3.4 | Visual feedback during drag (highlight + opacity) | `penpot-workspace.js` | ✅ Done | `penpot-workspace__drag-over` CSS class adds primary-color outline and reduced opacity on canvas during asset drag |

#### H22 — Viewer mode (✅ Done)

| # | Sub-feature | File(s) | Complexity |
|---|------------|---------|------------|
| H22.1 | Interactive page navigation (next/prev buttons) | `penpot-viewer.js` | ✅ Done | Page sidebar list, prev/next buttons, click-to-navigate |
| H22.2 | Zoom controls in viewer | `penpot-viewer.js` | ✅ Done | Zoom in/out/fit buttons, zoom label, scale transform |
| H22.3 | Inspect panel (view shape properties) | `penpot-viewer.js` | ✅ Done | Click shape to see name, type, position (X/Y), size (W/H), rotation, opacity, fills, strokes in right sidebar |

#### C10 — Font picker in text toolbar (✅ Complete)

| # | Sub-feature | File(s) | Complexity |
|---|------------|---------|------------|
| C10.1 | Dynamic font family dropdown (populated from team fonts) | `penpot-text-toolbar.js`, `fonts.js` | ✅ Done | Text toolbar uses custom dropdown with per-font preview (AaBbCc sample in actual typeface). Right sidebar uses font-family CSS on `<option>` elements. Both receive `teamFonts` from workspace via `fetchTeamFonts()`; `★` prefix distinguishes team fonts from system fonts |

---

## Remaining Parity Work Units

> See [`parity-audit.md`](parity-audit.md) §8 for detailed work unit specifications.
> 
> | ID | Module | Description | Priority |
> |---|--------|-------------|----------|
> | WU-S1 | shared/ | File format migrations | P2 | ✅ Complete — 73 migrations, 16 tests |
> | WU-S2 | shared/ | File builder | P2 | ✅ Complete — 26 functions, 17 tests |
> | WU-S3 | shared/ | SVG-to-shapes builder | P2 |
> | WU-C1 | client/ | Interaction prototyping UI | P2 | ✅ Complete — interaction panel, canvas visualization, viewer playback |
> | WU-C2 | client/ | Ruler guides (drag from ruler to canvas) | P2 |
> | WU-C3 | client/ | Library drag-to-apply | P2 | ✅ Complete — drag-and-drop from asset panel to canvas |
> | WU-C4 | client/ | MCP integration in client | P3 |
> | WU-C5 | client/ | Advanced SVG filter editing | P3 |
> | WU-C6 | client/ + server/ | Binary file import/export (v3 ZIP format) | P2 | ✅ Complete — ZIP archive export with manifest/structured entries, ID remapping, shape cleanup, storage objects, feature migrations, 30 tests |
> | WU-K1 | server/ | RPC edge-case audit | P3 | ✅ Complete — 3 missing commands implemented (get-file-summary, get-file-libraries, get-library-file-references), 149 total commands, 564 tests |
> | WU-K2 | server/ | File GC edge cases | P3 |