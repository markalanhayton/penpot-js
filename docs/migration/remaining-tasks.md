# Remaining Tasks — Penpot JS Port

> Last updated: 2026-05-28
>
> This document consolidates all incomplete work items from `tracking.md`, `parity-audit.md`, `client.md`, and `e2e-testing.md` into an actionable task list. Each task includes priority, effort estimate, affected files, and acceptance criteria.

---

## Summary

| Status | Count |
|--------|-------|
| ✅ Complete | 80 |
| 🟡 Partial | 2 |
| ⬜ Not started | 24 |
| ⬜ Deferred (out of scope) | 3 |

**Overall parity: ~99% functional parity.** The remaining items are P2–P4 enhancements, deferred enterprise features, and quality/testing improvements.

---

## 1. Client Feature Gaps (P2–P3)

### PA-7: Variants UI — Component variant state grid 🟡

**Priority:** P2
**Effort:** Large (~800 lines)
**Status:** Partial — data model exists, UI missing
**Files:** `penpot-right-sidebar.js`, `penpot-asset-panel.js`, `lib/components-lib.js`
**Upstream:** `frontend/src/app/main/data/workspace/variants.cljs` (758 lines)

**What exists:**
- `isVariantContainer()` and `variantProperties` in `shared/src/types/variant.js`
- Grouping/ungrouping functions in `lib/components-lib.js`

**What's missing:**
- No UI for creating variant properties (property name + values grid)
- No variant state grid (matrix of property combinations)
- No visual switching between variant states in the sidebar
- No "Main Component" vs "Variant" visual indicator beyond the diamond/star icons in layers

**Acceptance criteria:**
- [ ] Can create a variant container from a component
- [ ] Can add variant properties (e.g., "Size" = [S, M, L], "Color" = [Red, Blue])
- [ ] Variant grid shows all combinations in right sidebar
- [ ] Clicking a variant state switches the displayed shape
- [ ] Variant containers show correct icon in layers panel

---

### PA-13: Dashboard team management 🟡

**Priority:** P3
**Effort:** Medium (~500 lines)
**Status:** Partial — team list and create-team work, member management missing
**Files:** `penpot-team-sidebar.js`, `penpot-dashboard.js`
**Upstream:** `frontend/src/app/main/ui/dashboard/sidebar.cljs` (1439), `frontend/src/app/main/ui/dashboard/team.cljs` (1568)

**What exists:**
- Team list sidebar with avatars and team selection
- Create new team via `create-team` RPC
- Switch between teams

**What's missing:**
- Member management (invite, remove, change role)
- Role display (owner / admin / member)
- Leave team action
- Team settings panel (name, description, avatar)
- Member list with search/pagination

**Acceptance criteria:**
- [ ] Can invite a member to a team by email
- [ ] Can see all team members with their roles
- [ ] Can change a member's role (owner/admin/member)
- [ ] Can remove a member from a team
- [ ] Can leave a team (with confirmation if owner)
- [ ] Can edit team name and description

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

### PA-19: Accessibility testing ⬜

**Priority:** P3
**Effort:** Medium (~400 lines)
**Files:** New `client/e2e/accessibility.spec.js`
**Status:** Not started

**What exists:**
- Basic `tabindex` and `aria-label` on some components
- No accessibility test suite

**What's missing:**
- Keyboard navigation for all toolbar/sidebar actions
- ARIA roles and labels on all interactive elements
- Screen reader announcements for state changes
- Focus trap in modals
- High-contrast mode support

**Acceptance criteria:**
- [ ] All toolbar buttons accessible via Tab + Enter
- [ ] All sidebar panels accessible via keyboard
- [ ] ARIA roles on custom components (`role="button"`, `role="tab"`, etc.)
- [ ] Focus trap in modals (Escape closes, Tab cycles)
- [ ] No accessibility violations in axe-core audit

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

### SC-1: `types/file.js` — Missing lookup functions ⬜

**Priority:** P3
**Effort:** Medium
**Files:** `shared/src/types/file.js`
**Current:** 19 functions
**Target:** 55 functions
**Gap:** ~36 functions: `find-ref-shape`, `find-near-match`, `find-ref-component`, `dump-shape`, `dump-component`, `load-component-objects`, `delete-component`, `absorb-assets`, `update-objects-tree`, etc.

**Note:** The client has inline implementations for many of these. Porting to shared would improve code reuse and test coverage.

**Acceptance criteria:**
- [ ] All 36 missing functions ported from upstream `common/src/app/common/types/file.cljc`
- [ ] Unit tests for each new function
- [ ] Client imports from `@penpot/shared` instead of inline implementations where possible

---

### SC-2: `types/container.js` — Missing instance helpers ⬜

**Priority:** P3
**Effort:** Small
**Files:** `shared/src/types/container.js`
**Current:** 26 functions
**Target:** 34 functions
**Gap:** ~8 functions: `convert-shape-in-component`, `make-component-instance`, `find-valid-parent-and-frame-ids`, etc.

**Acceptance criteria:**
- [ ] All 8 missing functions ported
- [ ] Unit tests for each new function

---

### SC-4: `types/shape_tree.js` — Missing helpers ⬜

**Priority:** P3
**Effort:** Small
**Files:** `shared/src/types/shape_tree.js`
**Current:** 25 functions
**Target:** 29 functions
**Gap:** `clone-shape`, `generate-shape-grid`, `start-page-index`, `update-page-index`

**Acceptance criteria:**
- [ ] All 4 missing functions ported
- [ ] Unit tests for each new function

---

## 5. Server Edge Cases (P3–P4)

### BE-2: Audit log archiving task ⬜

**Priority:** P3
**Effort:** Medium (~100 lines)
**Files:** `server/src/tasks/audit_archive.js` (new)
**Upstream:** `backend/src/app/loggers/audit/archive_task.clj`

**Description:** Periodic task that archives old audit log entries to a separate table and cleans up the live audit table.

**Acceptance criteria:**
- [ ] Scheduler task runs nightly
- [ ] Moves audit entries older than 90 days to `audit_archive` table
- [ ] Deletes archived entries from `audit` table
- [ ] Configurable retention period via `PENPOT_AUDIT_RETENTION_DAYS`

---

### BE-6: Email blacklist/whitelist ⬜

**Priority:** P3
**Effort:** Medium (~150 lines)
**Files:** `server/src/auth/blacklist.js` (new), `server/src/auth/whitelist.js` (new)
**Upstream:** `backend/src/app/email/blacklist.clj`, `backend/src/app/email/whitelist.clj`

**Description:** Check email domains against blacklist/whitelist during registration. Prevents signup from disposable email domains.

**Acceptance criteria:**
- [ ] `PENPOT_EMAIL_BLACKLIST_DOMAINS` env var (comma-separated)
- [ ] `PENPOT_EMAIL_WHITELIST_DOMAINS` env var (comma-separated)
- [ ] Registration rejects blacklisted domains
- [ ] When whitelist is set, only whitelisted domains are allowed
- [ ] Configurable via environment variables

---

### BE-8: Feature flag for `file_migrations` ⬜

**Priority:** P3
**Effort:** Small (~20 lines)
**Files:** `server/src/config/features.js`

**Description:** The JS port always runs file data migrations. The upstream has a feature flag to conditionally enable new migration format. Not currently needed since the JS port only supports the latest format.

**Acceptance criteria:**
- [ ] `PENPOT_FEATURE_FILE_MIGRATIONS` env var (default: `true`)
- [ ] When disabled, `migrateFile()` skips named format migrations (but still runs legacy migrations)

---

### BE-9: Feature flag for `fdata` pointer-maps ⬜

**Priority:** P3
**Effort:** Small (~20 lines)
**Files:** `server/src/config/features.js`

**Description:** The upstream uses pointer-maps for file data when the `fdata` feature is enabled. The JS port uses inline data (JSON objects). This feature flag would toggle between inline and pointer-map storage, but since the JS port only uses inline storage, it's not currently needed.

**Acceptance criteria:**
- [ ] `PENPOT_FEATURE_FDATA` env var (default: `false`)
- [ ] When disabled (default), file data stored as inline JSON
- [ ] When enabled, file data stored as pointer-map fragments (future optimization)

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

### QA-2: Wire-compatibility test suite ⬜

**Priority:** P3
**Effort:** Medium (~500 lines)
**Files:** `server/test/wire-compat.test.js` (existing, 10 tests)
**Current:** 10 tests (auto-skip when backends offline)
**Target:** 30+ tests for transit encode/decode compatibility

**Description:** Verify that the JS server produces Transit+JSON that the Clojure backend can read, and vice versa. Currently 10 tests that auto-skip when backends are offline.

**Acceptance criteria:**
- [ ] 30+ wire-compatibility tests covering all major transit types
- [ ] Tests can run locally with both backends running
- [ ] CI integration for running against upstream backend

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
| **P2** | PA-7 (Variants UI) | ~800 lines |
| **P3** | PA-13 (Team management), PA-19 (Accessibility), SC-1, SC-2, SC-4, BE-2, BE-6, BE-8, BE-9, QA-1, QA-2, QA-3 | ~4440 lines |
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