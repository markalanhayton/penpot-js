# Penpot Migration Tracking

> Last updated: 2026-05-21

Migration from Clojure/ClojureScript to pure ES2022+ JavaScript.
Full plan: [`common-js/MIGRATION_PLAN.md`](../../common-js/MIGRATION_PLAN.md)

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
| 1 | `common/` → `common-js/` | ES JS (dual-env) | ✅ **Complete** | 150 JS | 1306 assertions, 0 fail |
| 2a | `backend/` → `backend-js/` | Node.js ESM (Fastify + SQLite) | 🟡 **~85%** | 64 JS | 519 assertions, 0 fail |
| 2b | `frontend/` → `frontend-js/` | Web Components + CSS | 🟡 **~75%** | 73 JS | 13 E2E specs, 156 tests pass |
| 3 | `exporter/` → `exporter-js/` | Node.js ESM | 🔴 **Not started** | — | — |

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
| `files/migrations` | `app.common.files.migrations` | `files/migrations.js` (stub) | ✅ |
| `files/repair` | `app.common.files.repair` | `files/repair.js` (stub) | ✅ |
| `files/builder` | `app.common.files.builder` | `files/builder.js` (stub) | ✅ |
| `files/shapes_helpers` | `app.common.files.shapes_helpers` | `files/shapes_helpers.js` (stub) | ✅ |
| `files/shapes_builder` | `app.common.files.shapes_builder` | `files/shapes_builder.js` (stub) | ✅ |

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
| SQLite database layer | ✅ | `better-sqlite3`, 15 migrations; SQLite only (no PostgreSQL) |
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

### 2a.2 RPC Commands (24+ namespaces)

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
| `binfile` | ✅ | Import/export |
| `verify_token` | ✅ | Multi-type token verification |

### 2a.3 Known Gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| Redis pub/sub | ~~P1~~ Done | Replaced with pure Node.js EventBus (`ws/msgbus.js`) — SQLite is single-instance, no Redis needed |
| FTS5 full-text search | P2 | `search-files` uses FTS5 with LIKE fallback; migration 0009 |
| File GC cross-library checks | ~~P2~~ Done | Cross-library component GC implemented in scheduler |
| ~~74 failing tests~~ | ~~P2~~ Done | All 383 tests now pass (0 fail) |
| Wire compatibility tests | P1 | Shadow-traffic testing against Clojure backend not yet set up |
| Migrations parity | ✅ **Complete** | 15 SQL migrations achieving full PG schema parity: indexes, constraints, triggers, data migrations, cascade logic, deletion protection, CHECK constraints, PK restructures, expression indexes |

### 2a.4 Test Status

| Metric | Value |
|--------|-------|
| Test files | 56 |
| Test cases | 519 |
| Passing | 519 |
| Failing | 0 |
| Cancelled | 0 |
| Skipped | 0 |

---

## Phase 2b: Frontend → Web Components 🟡

**Status**: ~75% complete | **Start**: 2025-06 | **Current**: Full pipeline auth→dashboard→workspace; 73 source files; ~12,800 lines

### 2b.1 What Exists (73 source files)

#### Core Infrastructure (21 files, all done)

| Component | Status | Lines | Notes |
|-----------|--------|-------|-------|
| `app.js` | ✅ | 116 | Root bootstrap, auth token, route rendering, WS init |
| `server.js` | ✅ | 80 | Static file serving + proxy to backend |
| `lib/store.js` | ✅ | 171 | Potok-like store: events, effects, signals, subscriptions |
| `lib/router.js` | ✅ | 108 | 12 routes, auth guards, param extraction, history API |
| `lib/rpc.js` | ✅ | 191 | Transit+JSON, GET/POST, retry, SSE streaming, file upload |
| `lib/transit.js` | ✅ | 299 | Full Transit codec: keywords, UUIDs, dates, sets, Penpot types |
| `lib/ws.js` | ✅ | 294 | WebSocket client, file/team subscription, cursor broadcast |
| `lib/shapes.js` | ✅ | 404 | SVG rendering for all shape types including bool, rotation handle |
| `lib/types.js` | ✅ | 130 | Shape factory, type predicates, createBoolShape |
| `lib/history.js` | ✅ | 52 | Undo/redo stack |
| `lib/tokens.js` | ✅ | 162 | CSS custom property design system |
| `lib/tool-manager.js` | ✅ | 663 | Tool registry, switching, keyboard shortcuts, bool ops, z-order, undo/redo, dblclick |
| `lib/export.js` | ✅ | 277 | PNG/SVG/PDF export, .penpot import, server-side export |
| `lib/i18n.js` | ✅ | 93 | Translation mechanism with English defaults |
| `lib/flags.js` | ✅ | 38 | Feature flag parser |
| `lib/access-tokens.js` | ✅ | 38 | CRUD for access tokens via RPC |
| `lib/plugin-api.js` | ✅ | 350 | Plugin API class, permission checking, iframe sandbox, message channel |
| `lib/persistence.js` | ✅ | 163 | update-file RPC batching, debounced save, retry, conflict resolution |
| `lib/snap.js` | ✅ | 117 | Shape-to-shape and canvas-edge snap guides during drag/resize |
| `lib/shortcuts.js` | ✅ | 115 | Keyboard shortcut registry and wiring to tool-manager actions |
| `lib/svg-import.js` | ✅ | 175 | SVG file parser (rect, circle, ellipse, path, line, polygon, text, group) |

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

#### Application Components (22 files)

| Component | Status | Notes |
|-----------|--------|-------|
| `penpot-app` | ✅ | Root element, auth check → route → render |
| `penpot-auth-screen` | ✅ | Login, register, recovery with backend integration |
| `penpot-dashboard` | ✅ | Team sidebar, project grid, file grid, search, fonts, libraries |
| `penpot-team-sidebar` | ✅ | Team listing, selection, creation |
| `penpot-project-card` | ✅ | Project cards |
| `penpot-workspace` | ✅ | Full workspace: toolbar, tools, sidebars, canvas, persistence, page mgmt, drag-drop, shortcuts |
| `penpot-toolbar` | ✅ | File name, presence, actions, undo/redo buttons |
| `penpot-tools-bar` | ✅ | Select, Hand, Frame, Rect, Ellipse, Text, Pen tools + zoom |
| `penpot-canvas` | ✅ | SVG rendering, zoom, pan, selection highlight, rulers overlay |
| `penpot-left-sidebar` | ✅ | Pages/Layers/Assets tabs + page management |
| `penpot-right-sidebar` | ✅ | Design/Inspect tabs, property editing, fills/shadows/bool, CSS/SVG code export |
| `penpot-layer-panel` | ✅ | Visibility, lock, reorder, rename |
| `penpot-asset-panel` | ✅ | Components, fonts, media (sample data) |
| `penpot-export-dialog` | ✅ | PNG/SVG/PDF export with options |
| `penpot-share-dialog` | ✅ | URL sharing with permissions |
| `penpot-comment-panel` | ✅ | Comment panel placeholder |
| `penpot-presence-bar` | ✅ | Online users avatars |
| `penpot-cursor-overlay` | ✅ | Remote cursor positions |
| `penpot-viewer` | 🟡 | Stub only — "View-only render" placeholder |
| `penpot-settings` | ✅ | Profile, password, feedback settings pages |
| `penpot-text-toolbar` | ✅ | Font family/size, bold/italic/underline/align |
| `penpot-gradient-editor` | ✅ | Gradient preview, stop editing, linear/radial type |
| `penpot-shadow-editor` | ✅ | Shadow preview, color/offset/blur/opacity, drop/inner toggle |
| `penpot-rulers` | ✅ | Horizontal + vertical canvas rulers with zoom |

#### Drawing Tools (7 files)

| Tool | Status | Notes |
|------|--------|-------|
| SelectTool | ✅ | Hit testing, drag-to-move, marquee, shift+click, resize handles, snap guides, dblclick text edit |
| HandTool | ✅ | Pan canvas with drag |
| DrawingTool (rect) | ✅ | Drag-to-draw with live SVG preview |
| DrawingTool (frame) | ✅ | Frame drawing |
| EllipseTool | ✅ | Circle/ellipse drawing |
| TextTool | ✅ | Basic click-to-place text, inline editing on double-click |
| PathTool (pen) | ✅ | Click-to-add points, Enter/Esc to finish |
| ImageTool | ✅ | File picker, placement on canvas |

### 2b.2 What's Not Started or Incomplete

| # | Module | Status | Priority | Notes |
|---|--------|--------|----------|-------|
| 1 | WASM renderer bridge | 🔴 | P0 | No high-performance canvas rendering; SVG only |
| 2 | ~~Document persistence (save)~~ | ✅ | ~~P0~~ | `update-file` RPC wired via `lib/persistence.js`, debounced batching |
| 3 | Rich text editing | 🟡 | P1 | Double-click to edit text inline; font selection toolbar exists |
| 4 | ~~Multi-selection~~ | ✅ | ~~P1~~ | Marquee + shift+click in SelectTool |
| 5 | ~~Pen/Path tool~~ | ✅ | ~~P1~~ | PathTool: click-to-add, Enter/Esc to finish |
| 6 | Font management | 🔴 | P2 | No font upload, listing, selection UI |
| 7 | Component library (symbols) | 🔴 | P2 | No component creation/consumption |
| 8 | Real-time OT/CRDT | 🔴 | P2 | WS works, but no conflict resolution |
| 9 | ~~Settings pages~~ | ✅ | ~~P2~~ | Profile/password/feedback settings pages with RPC integration |
| 10 | ~~Gradient editor~~ | ✅ | ~~P3~~ | Gradient preview, stop editing, linear/radial type selection |
| 11 | ~~Shadow editor~~ | ✅ | ~~P3~~ | Shadow preview, color/offset/blur/opacity, drop/inner toggle |
| 12 | ~~Boolean operations~~ | ✅ | ~~P3~~ | Union/difference/intersection/exclude in ToolManager + shortcuts |
| 13 | ~~Snap/alignment guides~~ | ✅ | ~~P3~~ | Shape-to-shape and canvas-edge snapping during drag/resize |
| 14 | ~~Copy/paste shapes~~ | ✅ | ~~P3~~ | Ctrl+C/V/X in ToolManager |
| 15 | ~~Page management UI~~ | ✅ | ~~P3~~ | Add/rename/delete/duplicate pages in left sidebar |
| 16 | ~~Canvas rulers~~ | ✅ | ~~P3~~ | Horizontal + vertical rulers with zoom, in `penpot-rulers.js` |
| 17 | ~~Image upload~~ | ✅ | ~~P3~~ | ImageTool: file picker, placement on canvas + SVG import + drag-drop |
| 18 | ~~SVG import~~ | ✅ | ~~P4~~ | File picker + drag-drop SVG parsing into shapes; basic rect/circle/ellipse/path/text |
| 19 | ~~Group/ungroup~~ | ✅ | ~~P3~~ | Ctrl+G/Ctrl+Shift+G shortcuts in ToolManager |
| 20 | ~~Undo/redo toolbar buttons~~ | ✅ | ~~P2~~ | Toolbar buttons wired, Ctrl+Z/Ctrl+Shift+Z keyboard shortcuts |
| 21 | ~~Inspect panel~~ | ✅ | ~~P2~~ | CSS/SVG properties code export, position/size/fill/shadow inspection |
| 22 | i18n locales | 🟡 | P3 | Mechanism exists, only English |
| 23 | Plugin manager UI | 🟡 | P2 | API ready, no workspace UI |
| 24 | Shortcuts wiring | ✅ | ~~P2~~ | `lib/shortcuts.js` wired to tool-manager actions; toolbar, canvas, z-order, bool ops all bound |
| 25 | Thumbnail generation | 🟡 | P3 | Components exist, rendering not implemented |
| 26 | ~~Z-order controls~~ | ✅ | ~~P3~~ | Bring forward/send backward/bring to front/send to back |
| 27 | ~~Rotation handle~~ | ✅ | ~~P3~~ | Rotation handle on canvas with drag interaction |
| 28 | ~~Dashboard sub-pages~~ | ✅ | ~~P3~~ | Search, fonts, libraries tabs in dashboard; search uses RPC |
| 29 | ~~View-only viewer~~ | 🟡 | P2 | Stub only — needs canvas rendering and file loading |

---

## Phase 3: Exporter → Node.js ESM 🔴

**Status**: Not started | **Estimated**: ~4,000 lines | **Duration**: 1-2 months

| Step | Module | Notes |
|------|--------|-------|
| 1 | HTTP server | Port from ClojureScript to `node:http` |
| 2 | Playwright-based rendering | Already uses Playwright, minimal changes |
| 3 | Redis task queue | Wire into backend-js task system |
| 4 | SVG/PDF/bitmap export | Port export logic |
| 5 | Test against same export tasks | Wire compatibility |
| 6 | Binary file import | Port binfile module |

---

## Module Dependency Graph

```
common-js/ (Phase 1) ✅
    │
    ├── backend-js/ (Phase 2a) 🟡 — depends on common-js
    │
    ├── frontend-js/ (Phase 2b) 🟡 — depends on common-js
    │
    └── exporter-js/ (Phase 3) 🔴 — depends on backend-js
```

---

## Key Metrics

| Metric | common-js | backend-js | frontend-js |
|--------|-----------|-----------|-------------|
| JS source files | 150 | 64 | 73 |
| Clojure source files (original) | 142 | 142 + 158 SQL | 939 (544 cljs, 575 scss) |
| Lines of JS | ~25,200 | ~17,000 | ~12,800 |
| Lines of original code | ~67,000 | ~48,000 | ~129,000 |
| Port completion | 100% | ~85% | ~75% |
| Test suites | 60 | 56 | 13 E2E spec files |
| Test cases passing | 1,306 | 519 | 156 E2E tests (P0:11 P1:14 P2:18 P3:46 P4:20 P5:11 P6:17) |
| Test cases failing | 0 | 0 | 0 |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-05 | No TypeScript, no React, no frameworks | Per MIGRATION_PLAN.md — pure ES2022+, Web Components, Node.js ESM |
| 2025-05 | `common-js/` separate from `common/` | Clean-slate ES module package, no dual-build complications |
| 2025-05 | SQLite for backend, no PostgreSQL | Fast dev iteration, zero-config, single-file DB; SQLite only per project decision |
| 2025-05 | Fastify for HTTP | Already in backend-js dependencies; mature, plugin ecosystem |
| 2025-06 | Shadow DOM for Web Components | Per MIGRATION_PLAN.md — scoped styles, no class name collisions |
| 2025-06 | `types/modifiers` ported to top-level `modifiers.js` | The modifiers module is used widely; top-level placement avoids deep import paths |
| 2026-05 | `svg/path/legacy_parser2` skipped | Redundant with `types/path/svg_parser.js` |
| 2026-05 | `logging` simplified for JS | SLF4J/macros replaced with console-based logger; same API surface |
| 2026-05 | `geom/modifiers` is Phase 1 capstone | The modifier propagation engine ties together constraints, flex/grid layout, and auto-sizing |

---

## Next Actions

| # | Action | Phase | Status |
|---|--------|-------|--------|
| 1 | ~~Add Redis pub/sub to `backend-js`~~ | 2a | ✅ Replaced with in-process EventBus |
| 2 | ~~Fix 74 failing backend-js tests~~ | 2a | ✅ All 383 tests now pass |
| 3 | Set up wire compatibility tests (JS ↔ Clojure) | 2a | P1 |
| 4 | ~~Build SPA shell + router for `frontend-js`~~ | 2b | ✅ Done |
| 5 | ~~Implement FTS5 full-text search for files~~ | 2a | ✅ Done |
| 6 | ~~Port Potok-like store for `frontend-js`~~ | 2b | ✅ Done |
| 7 | ~~Wire RPC client to store~~ | 2b | ✅ Done |
| 8 | ~~Wire `update-file` RPC for persistence~~ | 2b | ✅ Done via `lib/persistence.js` |
| 9 | Integrate WASM renderer in canvas | 2b | P0 |
| 10 | ~~Implement multi-selection (marquee + shift+click)~~ | 2b | ✅ Done |
| 11 | Implement rich text editing (font, inline) | 2b | 🟡 Partial — dblclick inline editing works |
| 12 | ~~Implement pen/path tool~~ | 2b | ✅ Done |
| 13 | ~~Add settings pages (profile, password, integrations)~~ | 2b | ✅ Done |
| 14 | Add font management UI | 2b | P2 |
| 15 | Add component library (symbols) | 2b | P2 |
| 16 | Add OT/CRDT for real-time collaboration | 2b | P2 |
| 17 | ~~Add gradient/shadow/boolean editors~~ | 2b | ✅ Done |
| 18 | ~~Add canvas rulers~~ | 2b | ✅ Done — `penpot-rulers.js` with horizontal + vertical zoom-aware rulers |
| 19 | ~~SVG import~~ | 2b | ✅ Done — `lib/svg-import.js` parser + drag-drop + file picker |
| 20 | ~~Wire keyboard shortcuts to real actions~~ | 2b | ✅ Done — `lib/shortcuts.js` wired via `wireShortcuts()` |
| 21 | ~~Implement Inspect panel~~ | 2b | ✅ Done — CSS/SVG code display, copy-to-clipboard |
| 22 | ~~Dashboard search/fonts/libraries tabs~~ | 2b | ✅ Done — search, fonts, libraries sub-pages |
| 23 | Font upload + management | 2b | P2 |
| 24 | Component instances (symbols) | 2b | P2 |
| 25 | OT/CRDT for real-time collaboration | 2b | P2 |
| 26 | Full rich text editing (multi-line, font selection) | 2b | P2 |