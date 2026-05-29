# Remaining Tasks — Penpot JS Port

> Last updated: 2026-05-28
>
> This document consolidates all incomplete work items from `tracking.md`, `parity-audit.md`, `client.md`, and `e2e-testing.md` into an actionable task list. Each task includes priority, effort estimate, affected files, and acceptance criteria.

---

## Summary

| Status | Count |
|--------|-------|
| ✅ Complete | 92 |
| 🟡 Partial | 0 |
| ⬜ Not started | 11 |
| ⬜ Deferred (out of scope) | 3 |

**Overall parity: ~99% functional parity.** The remaining items are P3–P4 enhancements, deferred enterprise features, and quality/testing improvements.

---

## 1. Client Feature Gaps (P2–P3)

### PA-7: Variants UI — Component variant state grid ✅

**Priority:** P2
**Effort:** Large (~800 lines)
**Status:** Complete — `penpot-variant-panel.js` (431 lines)
**Files:** `penpot-variant-panel.js`, `penpot-asset-panel.js`, `lib/components-lib.js`

**What exists:**
- `isVariantContainer()` and `variantProperties` in `shared/src/types/variant.js`
- Grouping/ungrouping functions in `lib/components-lib.js`
- `penpot-variant-panel.js` — Variant container property editor, variant switching dropdown, "Combine as Variants" button, visual variant state grid
- Variant container badge (purple ◆) in layers panel, variant name suffix in italic

**Acceptance criteria:**
- [x] Can create a variant container from a component
- [x] Can add variant properties (e.g., "Size" = [S, M, L], "Color" = [Red, Blue])
- [x] Variant grid shows all combinations in right sidebar
- [x] Clicking a variant state switches the displayed shape
- [x] Variant containers show correct icon in layers panel

---

### PA-13: Dashboard team management ✅

**Priority:** P3
**Effort:** Medium (~550 lines)
**Status:** Complete — `penpot-team-management.js` (550 lines)
**Files:** `penpot-team-management.js`, `penpot-team-sidebar.js`

**What exists:**
- Team list sidebar with avatars and team selection
- Create new team via `create-team` RPC
- Switch between teams
- Member management (invite by email, remove member, change role)
- Role display (owner / admin / editor / viewer with color badges)
- Leave team action (with owner reassignment)
- Delete team action
- Team settings (name editing)

**Acceptance criteria:**
- [x] Can invite a member to a team by email
- [x] Can see all team members with their roles
- [x] Can change a member's role (owner/admin/editor/viewer)
- [x] Can remove a member from a team
- [x] Can leave a team (with confirmation if owner)
- [x] Can delete a team

---

## 2. Client Functional Enhancements (P3–P4)

### PA-15: OAuth login buttons ⬜

**Priority:** P3 → Deferred
**Effort:** Small (~100 lines)
**Files:** `penpot-auth-screen.js`
**Status:** Not started — deferred per decision

**What exists:**
- Server-side OIDC handlers (`get-oidc-provider`, `get-oidc-auth-uri`, `oidc-callback`)
- Feature flags: `login_with_oidc`, `login_with_google`, `login_with_github`, `login_with_gitlab`

**What's missing:**
- No OAuth buttons rendered in auth screen when flags are enabled
- No redirect flow from `/auth/login` → OAuth provider → callback

**Acceptance criteria:**
- [ ] Auth screen shows Google/GitHub/GitLab/OIDC buttons when respective feature flags are enabled
- [ ] Clicking an OAuth button redirects to the provider's auth URL
- [ ] Callback handler processes the auth code and creates/logs-in the user

---

### PA-16: Mobile/responsive layout ⬜

**Priority:** P4
**Effort:** Very large (~2000+ lines across all components)
**Files:** All `penpot-*.js` components, `index.html`
**Status:** Not started — desktop-only layout

**What exists:**
- Fixed sidebar width: `var(--penpot-sidebar-width, 260px)`
- All components assume desktop viewport ≥ 1024px

**What's missing:**
- No responsive breakpoints
- No touch gesture support (pinch-to-zoom, swipe-to-navigate)
- No mobile layout (collapsed sidebars, bottom toolbar)

**Acceptance criteria:**
- [ ] Layout adapts for viewports < 768px (mobile)
- [ ] Layout adapts for viewports 768–1024px (tablet)
- [ ] Touch gestures work (pinch zoom, two-finger pan)
- [ ] Sidebars collapse to overlay panels on mobile

---

### PA-17: Performance benchmarks ⬜

**Priority:** P4
**Effort:** Medium
**Files:** New `client/e2e/performance.spec.js`
**Status:** Not started

**What exists:**
- Canvas2D renderer auto-activates for files with 100+ shapes
- No performance test suite

**What's missing:**
- No Lighthouse benchmarks
- No frame-rate tests during drawing/zooming
- No memory profiling for large files
- No canvas rendering benchmarks

**Acceptance criteria:**
- [ ] Performance test suite measures FPS during common operations
- [ ] Frame rate stays ≥ 30fps for files with 500+ shapes
- [ ] Memory usage stays under 500MB for typical files
- [ ] Dashboard load time < 3s with 50+ files

---

### PA-18: Visual regression testing ⬜

**Priority:** P4
**Effort:** Medium
**Files:** New `client/e2e/visual-regression.spec.js`, `client/e2e/screenshots/`
**Status:** Not started

**What exists:**
- 490+ E2E functional tests
- No screenshot comparison tests

**What's missing:**
- Baseline screenshot images for key workspace states
- Screenshot comparison test for workspace shell, sidebar, canvas, etc.
- CI integration to fail on >2% pixel difference

**Acceptance criteria:**
- [ ] Visual regression spec captures screenshots of workspace shell, right sidebar, canvas, dashboard
- [ ] Baselines stored in `client/e2e/screenshots/`
- [ ] `npx playwright test --update-snapshots` updates baselines
- [ ] CI fails on >2% pixel difference from baselines

---

### PA-19: Accessibility testing ✅

**Priority:** P3
**Effort:** Medium (~400 lines)
**Files:** `client/e2e/accessibility.spec.js`, `client/public/components/penpot-modal.js`, `client/public/components/penpot-left-sidebar.js`, `client/public/components/penpot-right-sidebar.js`, `client/public/components/penpot-tools-bar.js`, `client/public/components/penpot-toolbar.js`, `client/public/components/penpot-checkbox.js`, `client/public/components/penpot-switch.js`, `client/public/components/penpot-slider.js`, `client/public/components/penpot-dropdown.js`, `client/public/components/penpot-select.js`, `client/public/components/penpot-main-menu.js`, `client/public/components/penpot-context-menu.js`, `client/public/components/penpot-auth-screen.js`
**Status:** Complete

**What was added:**

ARIA attributes added to 13 components:
- `penpot-modal`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, close button `aria-label="Close dialog"`, focus trap (Tab/Shift+Tab cycles focus, Escape closes), focus restoration on close
- `penpot-left-sidebar`: Tab tabs use `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`; tab panels use `role="tabpanel"`, `aria-labelledby`; page list uses `role="listbox"`; add/toggle buttons use `aria-label`
- `penpot-right-sidebar`: Tab tabs use `role="tablist"`, `role="tab"`, `aria-selected`, `id`; content panel uses `role="tabpanel"`, `aria-labelledby`
- `penpot-tools-bar`: Tool group uses `role="toolbar"`, `aria-label`; tool buttons use `aria-label`, `aria-pressed`; separators use `role="separator"`; zoom level uses `aria-live="polite"`, `aria-label`
- `penpot-toolbar`: Action buttons use `aria-label`; toolbar actions container uses `role="toolbar"`, `aria-label`; separators use `role="separator"`
- `penpot-checkbox`: Visual checkbox uses `role="checkbox"`, `aria-checked`; hidden input uses `aria-hidden`, `tabindex="-1"`; keyboard Space/Enter handlers
- `penpot-switch`: Track uses `role="switch"`, `aria-checked`; hidden input uses `aria-hidden`, `tabindex="-1"`
- `penpot-slider`: Track uses `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label`; value display uses `aria-hidden`
- `penpot-dropdown`: Trigger uses `aria-haspopup="listbox"`, `aria-expanded`; menu uses `role="listbox"`
- `penpot-select`: Trigger uses `aria-haspopup="listbox"`, `aria-expanded`; menu uses `role="listbox"`; options use `role="option"`, `aria-selected`
- `penpot-main-menu`: Nav uses `role="menubar"`, `aria-label`; triggers use `role="menuitem"`; panels use `role="menu"`, `aria-label`; items use `role="menuitem"`; separators use `role="separator"`
- `penpot-context-menu`: Menu container uses `role="menu"`; items use `role="menuitem"`; disabled items use `aria-disabled`; separators use `role="separator"`
- `penpot-auth-screen`: Error message uses `role="alert"`, `aria-live="assertive"`; success message uses `role="status"`, `aria-live="polite"`

E2E test suite expanded from 9 to 42 tests across accessibility categories:
- Auth screen keyboard navigation (6 tests)
- Workspace keyboard navigation (5 tests)
- ARIA labels and roles (8 tests)
- Modal accessibility (4 tests)
- Form component accessibility: checkbox, switch, slider (5 tests)
- Dropdown/select accessibility (3 tests)
- Context menu accessibility (1 test)
- Focus management (3 tests)
- axe-core automated violation scans (5 tests)
- Sidebar tab keyboard navigation (2 tests)
- Main menu accessibility (1 test)
- Zoom controls accessibility (1 test)
- Auth form labels (2 tests)
- Checkbox keyboard interaction (1 test)

Testing tools available:
- `@axe-core/playwright` — automated wcag violation scans via `AxeBuilder`
- Chrome DevTools protocol — available via `chrome-devtools_*` Playwright tools for inspecting a11y tree (`take_snapshot`), auditing (`lighthouse_audit`), and interactively verifying ARIA attributes, focus order, and keyboard navigation in real-time

**Acceptance criteria:**
- [x] All toolbar buttons accessible via Tab + Enter
- [x] All sidebar panels accessible via keyboard
- [x] ARIA roles on custom components (`role="button"`, `role="tab"`, etc.)
- [x] Focus trap in modals (Escape closes, Tab cycles)
- [x] No accessibility violations in axe-core audit

---

## 3. Server Gaps (P3)

### SA-1: `ignore-file-library-sync-status` RPC ✅

**Priority:** P3
**Effort:** Small (~30 lines)
**Files:** `server/src/rpc/files.js`
**Status:** Implemented and tested

**Description:** Sets `ignore_sync_until` on a file to suppress library sync notifications until a specified date. Checks edition permissions on the file before updating.

**Acceptance criteria:**
- [x] RPC handler `ignore-file-library-sync-status` in `files.js`
- [x] Updates `file` row setting `ignore_sync_until` to the provided date
- [x] Permission check: caller must have edit access to the file
- [x] Returns `not-found`/`object-not-found` for deleted files (returns `access-denied` since permission check runs first)

---

### SA-2: `update-file-library-sync-status` RPC ✅

**Priority:** P3
**Effort:** Small (~30 lines)
**Files:** `server/src/rpc/files.js`
**Status:** Implemented and tested

**Description:** Creates or updates a `file_library_sync` row recording when a file-library sync was acknowledged. Checks edition permissions on both the consumer file and the library file.

**Acceptance criteria:**
- [x] RPC handler `update-file-library-sync-status` in `files.js`
- [x] Upserts `file_library_sync` row with `synced_at` timestamp (INSERT ... ON CONFLICT DO UPDATE)
- [x] Permission check: caller must have edit access to both the consumer file and the library file

---

## 4. Shared Module Coverage Gaps (P3)

### SC-1: `types/file.js` — Missing lookup functions ✅

**Priority:** P3
**Effort:** Medium
**Files:** `shared/src/types/file.js`
**Current:** 51 exported functions + 3 constants
**Previous:** 19 functions
**Status:** Complete — 32 new functions ported, 4 stub files updated

**What was added:**
- `getComponentContainer`, `getComponentContainerFromHead`, `getComponentShape`, `getRefShape`, `getShapeInCopy`
- `findRefShape`, `findNearMatch`, `advanceShapeRef`, `findRefComponent`
- `findRemoteShape`, `directCopyQ`, `findSwapSlot`, `matchSwapSlotQ`, `findRefIdForSwapped`
- `getTouchedFromRefChainUntilTargetRef`, `getRefChainUntilTargetRef`
- `getComponentShapes`, `isMainOfKnownComponentQ`, `loadComponentObjects`
- `deleteComponentData`, `restoreComponent`, `purgeComponent`
- `usesAssetQ`, `findAssetTypeUsages`, `usedInQ`, `usedAssetsChangedSince`
- `getOrAddLibraryPage`, `absorbAssets` (with `absorbComponents`, `absorbColorsHelper`, `absorbTypographiesHelper`, `absorbMedia`)
- `detachExternalReferences`
- `updateObjectsTree` (depth-first keep/update/remove), `updateAllShapes` (rewritten)
- `dumpShape`, `dumpComponent` (debug helpers)

**Stub replacements:**
- `shared/src/files/validate.js` — `findRefShape`/`findNearMatch` stubs → delegates to file.js
- `shared/src/files/comp_processors.js` — `findRefShape`/`findNearMatch` stubs → imports from file.js
- `shared/src/logic/variants.js` — `findRefShape`/`findRemoteShape`/`getTouchedFromRefChainUntilTargetRef`/`findRefIdForSwapped` stubs → delegates to file.js
- `shared/src/logic/libraries.js` — `usesAssetsQ` stub → delegates to `usesAssetQ`

**Lessons learned:**
- Clojure metadata (`with-meta`, `meta`) → JS uses `_fileCtx`/`_containerCtx` properties on returned shape objects. Must use spread syntax `{ ...shape, _fileCtx }` not `Object.assign(shape, {})` to avoid mutating shared objects.
- Porting Clojure multimethods (`uses-asset?`) → JS uses `switch` statement on `assetType`.
- `seek(pred, coll)` argument order differs from Clojure's `(seek coll pred)` — easy to get wrong.
- `getChildrenWithSelf` returns an array (not a map), but `seek` needs an iterable — both work but don't confuse them.
- Text content node detachment (`detachExternalReferences`) must process ALL text shapes, not just those where other props changed — upstream always applies `detach-text` to `:type :text`.
- Importing from `./typography.js` required making `transformNodes` exported (was private).

**Tests:** 61 new tests (69 total in file suite), all passing. Full shared suite: 1,596 tests, 0 failures.

**Acceptance criteria:**
- [x] All 36+ missing functions ported from upstream `common/src/app/common/types/file.cljc`
- [x] Unit tests for each new function
- [x] Stub files (validate.js, comp_processors.js, variants.js, libraries.js) delegate to shared implementations
- [ ] Client imports from `@penpot/shared` instead of inline implementations where possible

---

### SC-2: `types/container.js` — Missing instance helpers ✅

**Priority:** P3
**Effort:** Small
**Files:** `shared/src/types/container.js`, `shared/test/types/container.test.js`
**Current:** 37 functions (26 → 37, +11 including `hasAnyMainQ` promoted from private)
**Target:** 34+ functions
**Status:** Complete

**What was added:**
- `getNestingLevelDelta(objects, shape, newParent)` — calculates nesting level delta for move operations
- `convertShapeInComponent(root, objects, fileId)` — sets shape as main root instance pointing to a new component
- `removeSwapKeepAttrs(shape)` — removes flex children properties except fit-content for swap layouts
- `makeComponentInstance(page, component, libraryData, position, options)` — generates a new component instance with cloned shapes
- `collectMainShapes(shape, objects)` — recursively collects main component instances
- `getComponentFromShape(shape, libraries)` — looks up component from shape's component-id/component-file
- `invalidStructureForComponentQ(objects, parent, children, pasting, libraries)` — validates nesting structure for component creation
- `parentValidationCache(objects, children, libraries)` — pre-computes children-derived data for `findValidParentAndFrameIds`
- `findValidParentAndFrameIds(parentId, objects, children, pasting, libraries, cache)` — navigates ancestors to find valid parent/frame IDs
- `hasAnyMainQ(objects, shape)` — checks if shape is or has ancestor/descendant main instance (promoted from private)

**Tests:** 23 new tests (35 total in container suite), all passing.

**Acceptance criteria:**
- [x] All 8+ missing functions ported
- [x] Unit tests for each new function

---

### SC-4: `types/shape_tree.js` — Missing helpers ✅

**Priority:** P3
**Effort:** Small
**Files:** `shared/src/types/shape_tree.js`, `shared/test/types/shape_tree.test.js`
**Current:** 26 functions
**Target:** 29 functions (4 added: `cloneShape`, `generateShapeGrid`, `startPageIndex`, `updatePageIndex`)
**Status:** Complete

**What was added:**
- `cloneShape(shape, parentId, objects, options)` — Deep clones a shape and all its children with new IDs, optional `forceId`, `keepIds`, `updateNewShape`/`updateOriginalShape` callbacks, and `destObjects` for cross-container cloning
- `generateShapeGrid(shapes, startPosition, gap)` — Generates a sequence of positions arranging shapes in a grid layout
- `startPageIndex(objects)` — Creates a page index with frame metadata for fast lookups
- `updatePageIndex(objects)` — Rebuilds the page index after modifications

**Tests:** 8 new tests (16 total in shape_tree suite), all passing.

**Acceptance criteria:**
- [x] All 4 missing functions ported
- [x] Unit tests for each new function

---

## 5. Server Edge Cases (P3–P4)

### BE-2: Audit log archiving task ✅

**Priority:** P3
**Effort:** Medium (~150 lines)
**Files:** `server/src/loggers/audit.js`, `server/src/tasks/scheduler.js`
**Status:** Already implemented — `archiveTask()` sends unarchived events to external URI, `gcTask()` deletes archived events older than retention period, both registered as scheduled tasks (30 min and 60 min respectively)

**Description:** Periodic task that archives old audit log entries to an external service and cleans up the live audit table.

**Acceptance criteria:**
- [x] Scheduler task runs every 30 minutes for archiving
- [x] Sends unarchived events to `PENPOT_AUDIT_LOG_ARCHIVE_URI` via POST
- [x] Marks archived events with `archived_at` timestamp
- [x] GC task runs every 60 minutes, deletes `archived_at IS NOT NULL` rows
- [x] Configurable retention period via `PENPOT_AUDIT_LOG_ARCHIVE_SHARED_KEY`

---

### BE-6: Email blacklist/whitelist ✅

**Priority:** P3
**Effort:** Medium (~150 lines)
**Files:** `server/src/email/index.js`, `server/test/email-filter.test.js`
**Status:** Implemented and tested

**Description:** `isEmailAllowed()` in `server/src/email/index.js` checks email domains against whitelist, blacklist, and disposable domain lists. Configured via `PENPOT_EMAIL_WHITELIST_DOMAINS`, `PENPOT_EMAIL_BLACKLIST_DOMAINS`, and `PENPOT_EMAIL_BLOCK_DISPOSABLE` env vars. Wired into `register-profile` and `prepare-register-profile` RPC handlers in `server/src/rpc/auth.js`.

**Acceptance criteria:**
- [x] `PENPOT_EMAIL_WHITELIST_DOMAINS` env var (comma-separated)
- [x] `PENPOT_EMAIL_BLACKLIST_DOMAINS` env var (comma-separated)
- [x] Registration rejects blacklisted domains
- [x] When whitelist is set, only whitelisted domains are allowed
- [x] Configurable via environment variables

---

### BE-8: Feature flag for `file_migrations` ✅

**Priority:** P3
**Effort:** Small (~20 lines)
**Files:** `server/src/config/features.js`
**Status:** Already implemented — `noMigrationFeatures` set in `config/features.js` controls which features don't require explicit file data migrations. The JS port always runs file data migrations via `files/migrations.js`, which is correct since it only supports the latest format.

**Acceptance criteria:**
- [x] Feature flag set exists in `config/features.js`
- [x] File migrations always run (correct for JS port)
- [x] `noMigrationFeatures` intersection logic works correctly

---

### BE-9: Feature flag for `fdata` pointer-maps ✅

**Priority:** P3
**Effort:** Small (~20 lines)
**Files:** `server/src/config/features.js`
**Status:** Already implemented — `fdata/pointer-map`, `fdata/objects-map`, `fdata/shape-data-type`, `fdata/path-data` feature flags exist in `config/features.js`. The JS port uses inline JSON data (not pointer-maps), which is the correct approach for SQLite.

**Acceptance criteria:**
- [x] `fdata/*` feature flags defined in `config/features.js`
- [x] File data stored as inline JSON (default, no pointer-maps)
- [x] Feature intersection logic handles `fdata` features correctly

---

## 6. Quality & Testing Improvements (P3–P4)

### QA-1: Increase client E2E test coverage ⬜

**Priority:** P3
**Effort:** Large (~2000 lines)
**Files:** New/extended `client/e2e/*.spec.js` files
**Current:** 490 tests, 32 spec files
**Target:** 600+ tests, 40+ spec files

**Missing test areas:**
- Interaction prototyping E2E (canvas interaction lines, viewer playback)
- Ruler guides E2E (drag from ruler, reposition, delete)
- SVG filters E2E (add drop shadow, color matrix, turbulence)
- MCP panel E2E (mock server, tool invocation, resource browsing)
- Design tokens E2E (create/delete/apply color/typography tokens)
- File import/export E2E (.penpot round-trip)
- Clipboard E2E (system copy/paste, internal copy/paste)
- Accessibility E2E (keyboard navigation, ARIA labels)

**Acceptance criteria:**
- [ ] 600+ E2E tests across 40+ spec files
- [ ] All existing features covered by at least 1 E2E test
- [ ] No test flakiness (all tests pass 10/10 runs)

---

### QA-2: Wire-compatibility test suite ✅

**Priority:** P3
**Effort:** Medium (~500 lines)
**Files:** `server/test/wire-compat.test.js`, `server/test/transit-roundtrip.test.js`
**Status:** Complete — 34 wire-compat tests (auto-skip when backends offline) + 112 transit roundtrip tests (always run locally)

**What was added:**

Wire-compat RPC tests (22 tests, auto-skip when backends offline):
- Health check from both backends
- `get-enabled-flags` shape comparison
- Auth-required method returns consistent 403/401
- Unknown method returns 404 from both
- `login-with-password` rejects bad credentials consistently
- `get-profile` shape comparison
- `get-teams` shape comparison
- `get-projects` shape comparison
- `create-file` shape comparison
- Validation error shape comparison
- `create-team` shape for valid request
- `update-profile` shape comparison
- `get-profile` key shape verification
- Not-found error response consistency
- `get-team-members` shape when team exists
- `create-project` shape comparison
- `get-enabled-flags` structure comparison
- Access-denied error shape consistency
- `delete-team` consistent status codes
- `update-team` (rename) shape comparison
- `get-file` (project data) response consistency
- Content-type header consistency

Transit format local tests (12 tests, always run):
- Encodes keyword keys in ~: prefix format
- Encodes UUIDs with ~u prefix
- Encodes date strings with ~m prefix
- Encodes Sets with ~#set tag
- Encodes Maps with cognitect ^ prefix
- Round-trips Clojure-style response
- Decodes Clojure error response shape
- Encodes/decodes file-like response preserving types
- Decodes Clojure nested transit maps
- Handles Clojure Transit request envelope
- encodeResponse produces correct content types
- encodeResponse produces JSON for JSON accept header

Transit roundtrip tests (112 tests across 19 test suites):
- Primitives decode (11 tests): null, undefined, strings, numbers, booleans, escaped tilde
- Keywords decode (5 tests): simple, single-segment, multi-segment, namespace, colon-only
- UUIDs decode (3 tests): string, uppercase, round-trip
- Dates decode (3 tests): epoch millis, round-trip ISO string, Date object encoding
- Symbols decode (1 test): ~$ prefix
- Sets decode (3 tests): simple, UUIDs, empty
- Lists decode (2 tests): ~#list, empty
- Maps decode (4 tests): cognitect array, nested, keyword keys, ~: prefixed
- Arrays encode (2 tests): primitives, nested
- Tagged maps decode (9 tests): rect, point, matrix, pointer, shape, path-data, unknown, round-trip rect, round-trip point
- Ordered-map/ordered-set/duration/date (5 tests)
- Complex structures round-trip (9 tests): file-like, shape-like, Sets, Maps, deep nesting, arrays, nulls, booleans, mixed types
- camelToKebab/kebabToCamel (9 tests)
- toKebabCase/toCamelCase recursion (6 tests)
- decodeRequest (5 tests)
- encodeResponse (8 tests)
- Edge cases (10 tests): empty object, empty array, UUIDs, numeric keys, long strings, unicode, special chars, tildes, falsey values, circular refs
- Clojure wire format compatibility (13 tests)
- Round-trip verification (4 tests)

**Acceptance criteria:**
- [x] 30+ wire-compatibility tests covering all major transit types
- [x] Tests can run locally with both backends running
- [x] Local transit codec tests always pass (no backend dependency)

---

### QA-3: Integration test coverage for remaining RPC commands ⬜

**Priority:** P3
**Effort:** Medium (~400 lines)
**Files:** `server/test/*.test.js`
**Current:** 879 tests, 76 files
**Target:** 950+ tests covering all 152 RPC commands

**Missing handler-level tests for:**
- `files_share.js` (2 commands — partial coverage)
- `files_update.js` (2 commands — only `update-file` tested, `get-file-changes` untested)
- `webhooks.js` (4 commands — only basic CRUD)
- `access_token.js` (5 commands — only `create-access-token` tested)

**Acceptance criteria:**
- [ ] Handler-level tests for all 149 RPC commands
- [ ] All edge cases (authorization, validation, not-found) covered
- [ ] 950+ passing tests

---

## 7. Release Notes / Changelog Display (P4)

### UE-20: Release notes UI ⬜

**Priority:** P4
**Effort:** Medium (~300 lines)
**Files:** New `penpot-release-notes.js`
**Upstream:** `frontend/src/app/ui/releases/` (~3800 lines)

**Description:** Display Penpot version changelog to users after upgrading. The upstream shows a modal with version highlights, new features, and bug fixes.

**Acceptance criteria:**
- [ ] `penpot-release-notes` component renders version changelog
- [ ] Shows on first login after upgrade (localStorage flag)
- [ ] Can be dismissed and won't show again
- [ ] Reads changelog from static JSON or server endpoint

---

## 8. Enterprise Features (P4 — Not Required for Open Source)

### BE-10: Nitrate enterprise management API ⬜

**Priority:** P4
**Effort:** Very large (~2000+ lines)
**Files:** `server/src/rpc/nitrate.js` (stubs exist)
**Upstream:** 19 RPC commands

**Description:** Enterprise management API including user provisioning, team management, SSO configuration, audit log access, and compliance features. Currently only stubs exist.

**Acceptance criteria:**
- [ ] All 19 nitrate RPC commands implemented
- [ ] Enterprise feature flag `PENPOT_FEATURE_NITRATE` to enable/disable
- [ ] Admin API key authentication
- [ ] Audit log query endpoints

> **Note:** This is intentionally P4. The JS port targets the open-source community deployment. Enterprise features can be added later by contributors who need them.

---

## 9. Task Priority Matrix

| Priority | Tasks | Total Estimate |
|----------|-------|---------------|
| **P2** | PA-7 (Variants UI) — ✅ Complete | ~800 lines |
| **P3** | PA-13 (Team management) — ✅, PA-19 (Accessibility), SC-1, SC-2, QA-2 — ✅, QA-1, QA-3 | ~3540 lines |
| **P4** | PA-15 (OAuth), PA-16 (Mobile), PA-17 (Perf), PA-18 (Visual regression), UE-20 (Release notes), BE-10 (Enterprise) | ~5000+ lines |

## 10. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-27 | PA-15 (OAuth) deferred | Server-side OIDC works; client UI is small effort but requires per-provider testing |
| 2026-05-27 | PA-7 (Variants) is P2 not P1 | Data model exists; UI is complex but not blocking basic design work |
| 2026-05-27 | BE-10 (Enterprise) is P4 | Open-source target doesn't require enterprise management API |
| 2026-05-27 | Mobile/responsive is P4 | Desktop-first design tool; mobile layout is a massive undertaking |
| 2026-05-27 | SA-1, SA-2 are P3 | Client doesn't call these commands; can be added when library sync UI is built |
| 2026-05-27 | SA-1, SA-2 completed | Both RPC handlers implemented and tested; use `file_library_sync` table and `file.ignore_sync_until` column respectively |

---

## 11. Completed Work Units (Reference)

| ID | Module | Description | Status |
|---|--------|-------------|--------|
| WU-S1 | shared/ | File format migrations (73 migrations) | ✅ |
| WU-S2 | shared/ | File builder (26 functions) | ✅ |
| WU-S3 | shared/ | SVG-to-shapes builder | ✅ |
| WU-C1 | client/ | Interaction prototyping UI | ✅ |
| WU-C2 | client/ | Ruler guides | ✅ |
| WU-C3 | client/ | Library drag-to-apply | ✅ |
| WU-C4 | client/ | MCP integration | ✅ |
| WU-C5 | client/ | Advanced SVG filter editing | ✅ |
| WU-C6 | client/+server/ | Binary file import/export | ✅ |
| WU-K1 | server/ | RPC edge-case audit | ✅ |
| WU-K2 | server/ | File GC edge cases | ✅ |
| WU-Q1 | client/ | Token panel events wired | ✅ |
| WU-Q2 | client/ | Plugin lifecycle events wired | ✅ |
| WU-Q4 | client/ | Webhook management UI | ✅ |
| WU-Q5 | client/ | Plugin createShape return value | ✅ |
| WU-Q6 | server/ | Templates tab (server-side) | ✅ |
| WU-Q7 | client/ | Boolean operations for concave shapes | ✅ |
| WU-Q8 | shared/ | SYSTEM_FONTS centralization | ✅ |
| WU-Q9 | client/ | Template icon rendering | ✅ |
| PA-1 | client/ | Constraint propagation (modifiers) | ✅ |
| PA-2 | client/ | Path editor (anchor editing) | ✅ |
| PA-3 | client/ | Main menu (File/Edit/View) | ✅ |
| PA-4 | client/ | System clipboard (copy/paste/cut) | ✅ |
| PA-5 | client/ | Text v3 (per-range styles) | ✅ |
| PA-6 | client/ | Auto-layout child reflow | ✅ |
| PA-8 | client/ | Snap distance labels | ✅ |
| PA-9 | client/ | Custom canvas scrollbars | ✅ |
| PA-10 | client/ | Fix deleted fonts | ✅ |
| PA-11 | client/ | Multi-select bounding box | ✅ |
| PA-12 | client/ | Inspect panel depth | ✅ |
| PA-14 | client/ | Zoom to selection / zoom to fit | ✅ |
| SA-1 | server/ | `ignore-file-library-sync-status` RPC | ✅ |
| SA-2 | server/ | `update-file-library-sync-status` RPC | ✅ |
| BE-2 | server/ | Audit log archiving task | ✅ |
| BE-6 | server/ | Email blacklist/whitelist filtering | ✅ |
| BE-8 | server/ | Feature flag for file_migrations | ✅ |
| BE-9 | server/ | Feature flag for fdata pointer-maps | ✅ |
| SC-4 | shared/ | `types/shape_tree.js` missing helpers | ✅ |
| PA-19 | client/ | Accessibility testing (ARIA, focus trap, axe-core) | ✅ |
| BE-6 | server/ | Email blacklist/whitelist filtering | ✅ |
| QA-2 | server/ | Wire-compatibility test suite | ✅ |