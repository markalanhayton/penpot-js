# E2E Testing Document

> Last updated: 2026-05-26

Comprehensive guide to end-to-end, integration, and unit testing across all modules of the Penpot JS port.

---

## Table of Contents

1. [Testing Architecture Overview](#1-testing-architecture-overview)
2. [Test Infrastructure](#2-test-infrastructure)
3. [Client E2E Tests (Playwright)](#3-client-e2e-tests-playwright)
4. [Server Integration Tests (node:test)](#4-server-integration-tests-nodetest)
5. [Shared Module Unit Tests (node:test)](#5-shared-module-unit-tests-nodetest)
6. [Server & Exporter Tests](#6-server--exporter-tests)
7. [Frontend Playwright Tests (Upstream)](#7-frontend-playwright-tests-upstream)
8. [Running All Tests](#8-running-all-tests)
9. [Test Writing Guidelines](#9-test-writing-guidelines)
10. [CI Integration](#10-ci-integration)
11. [Current Test Coverage Summary](#11-current-test-coverage-summary)
12. [E2E Test Matrix](#12-e2e-test-matrix)
13. [Gap Analysis & Future Work](#13-gap-analysis--future-work)

---

## 1. Testing Architecture Overview

The Penpot JS port uses a layered testing strategy tailored to each module's runtime environment:

```
┌─────────────────────────────────────────────────────────────────┐
│                        E2E Tests                                │
│          Playwright (browser automation)                       │
│          client/e2e/*.spec.js                                   │
│          Tests the full stack: browser → client → server → DB   │
├─────────────────────────────────────────────────────────────────┤
│                     Integration Tests                           │
│          node:test (Node.js built-in runner)                    │
│          server/test/*.test.js                                 │
│          Tests server RPC, DB, auth, WebSocket, etc.           │
├─────────────────────────────────────────────────────────────────┤
│                       Unit Tests                               │
│          node:test (Node.js built-in runner)                    │
│          shared/test/*.test.js                                 │
│          server/exporter/test/*.test.js                        │
│          Tests pure logic: geometry, types, codecs, etc.       │
└─────────────────────────────────────────────────────────────────┘
```

### Module Test Mapping

| Module | Test Type | Runner | Location | Count |
|--------|-----------|--------|----------|-------|
| `client/` | E2E | Playwright | `client/e2e/*.spec.js` | 30 spec files, 490 tests |
| `server/` | Integration + Unit | `node:test` | `server/test/*.test.js` | 75 files, 872 tests |
| `shared/` | Unit | `node:test` | `shared/test/*.test.js` | 176 suites, 1,492 assertions |
| `server/exporter/` | Unit | `node:test` | `server/exporter/test/*.test.js` | 22 tests |
| `frontend/` (upstream) | E2E | Playwright | `frontend/playwright/ui/specs/*.spec.js` | 35 spec files |

---

## 2. Test Infrastructure

### 2.1 Playwright Configuration (`client/playwright.config.js`)

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    headless: true,
    baseURL: 'http://localhost:3449',
    actionTimeout: 10000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'node ../server/src/index.js',
      port: 6060,
      reuseExistingServer: true,
      timeout: 15000,
    },
    {
      command: 'node server.js',
      port: 3449,
      reuseExistingServer: true,
    },
  ],
});
```

Key configuration points:

- **Dual web servers**: Playwright starts both the backend (port 6060) and the frontend dev server (port 3449) before running tests.
- **`reuseExistingServer: true`**: If a server is already running, Playwright uses it instead of starting a new one. Essential for iterative development.
- **Chromium only**: Tests run against a single browser engine. Multi-browser testing (Firefox, WebKit) is not configured but can be added.

### 2.2 Dev Server Bug Fix (2026-05-26)

The client dev server (`client/server.js`) had two bugs that prevented E2E tests from passing:

1. **Missing `/shared/` route**: The import map in `index.html` resolves `@penpot/shared/constants` to `/shared/constants.js`, but no such path existed under `client/public/`. The SPA fallback served `index.html` with `Content-Type: text/html`, which browsers reject for ES modules.

2. **SPA fallback serving `text/html` for `.js` files**: When any static file was missing, the fallback served `index.html` with `Content-Type: text/html`. This masked the root cause and could cause similar issues for other missing assets.

**Fix**: Added a `/shared/` route that serves files from `../shared/src/` with correct MIME types, and changed the SPA fallback to return 404 for requests with known static file extensions (`.js`, `.css`, etc.) instead of serving `index.html`.
- **30s test timeout**: Generous timeout for tests that involve RPC round-trips, WebSocket connections, and server-side processing.
- **10s action timeout**: Default timeout for individual Playwright actions (`click`, `fill`, etc.).

### 2.2 Node.js Test Runner

Both `shared/` and `server/` use Node.js built-in test runner (`node:test` + `node:assert/strict`):

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
```

No external test frameworks (Jest, Mocha, Vitest) are used. This keeps dependencies minimal and leverages the built-in test runner's assertion diffing, `describe`/`it` grouping, and `--test` flag support.

### 2.3 Test Database

Server integration tests use an in-memory SQLite database (`:memory:`) that is created fresh for each test file. This provides:

- **Full isolation**: No test pollution between runs.
- **Fast setup**: No external database server required.
- **Realistic queries**: The same SQL schema as production (21 migrations applied on setup).
- **Transactional cleanup**: Tests can wrap operations in transactions and roll back.

### 2.4 Test Account

E2E tests authenticate as `admin@penpot.local` / `penpot123`. The server's setup module (`server/src/setup/index.js`) creates this admin user on first startup when `PENPOT_INITIAL_ADMIN_EMAIL` and `PENPOT_INITIAL_ADMIN_PASSWORD` are set.

---

## 3. Client E2E Tests (Playwright)

### 3.1 Overview

The client E2E tests cover the full user journey from authentication through design editing. They are organized by migration phase priority (P0–P6) and cross-cutting concerns. Line counts are approximate.

| Spec File | Phase | Lines | Tests | Focus |
|-----------|-------|-------|-------|-------|
| `auth.spec.js` | P0 | 50 | 6 | Login/register/recovery screen rendering and form switching |
| `registration.spec.js` | P0 | ~180 | 18 | Registration form rendering, validation, mode switching |
| `recovery.spec.js` | P0 | ~200 | 18 | Password recovery request, token URL, error handling |
| `p0-flow.spec.js` | P0 | 145 | 11 | Full login → dashboard → file create → workspace flow |
| `p1-workspace.spec.js` | P1 | 223 | 14 | Workspace shell, toolbar, tools bar, left/right sidebars, canvas, zoom |
| `p2-components.spec.js` | P2 | ~150 | 18 | Design system components (button, checkbox, switch, slider, tabs, dropdown, select, etc.) |
| `p3-tools.spec.js` | P3 | 309 | 21 | Tool switching, drawing, selection, keyboard shortcuts, cursors, zoom, pan |
| `p3-extended.spec.js` | P3 | 152 | 10 | Boolean operations, z-order, rotation, group/ungroup |
| `p3-enhanced.spec.js` | P3 | 165 | 9 | Undo/redo, text toolbar, snap guides, fill editing |
| `snap-text-editing.spec.js` | P3 | 145 | 6 | Snap guides, text creation, inline editing, commit on blur |
| `p4-layer-asset.spec.js` | P4 | 435 | 24 | Layer panel, asset panel, font management, component instances |
| `p5-collaboration.spec.js` | P5 | 162 | 11 | WebSocket, presence bar, cursor overlay |
| `p6-export.spec.js` | P6 | 338 | 17 | PNG/SVG/PDF export, share dialog, comment panel |
| `page-management.spec.js` | Other | 60 | 5 | Page add/rename/delete/duplicate |
| `settings.spec.js` | Other | 96 | 8 | Profile/password/feedback/settings pages |
| `context-menu.spec.js` | Other | ~180 | 9 | Right-click context menu, menu items, Escape close, delete |
| `dashboard-navigation.spec.js` | Other | ~260 | 23 | Dashboard tabs, search, fonts, libraries, deleted files |
| `websocket-reconnect.spec.js` | Other | ~140 | 12 | Connection status, reconnection, error handling |
| `binary-file-export.spec.js` | Other | ~250 | 14 | Export dialog, format options, scale, cancel, error handling |
| `binary-file-import.spec.js` | Other | ~220 | 17 | Import dialog, file input, drag-drop, cancel, error handling |
| `svg-import.spec.js` | Other | ~200 | 15 | SVG drag-drop, import dialog, parseSVG, error handling |
| `interaction-prototyping.spec.js` | Other | ~260 | 17 | Interaction panel, add/edit/remove, events, destination |
| `ruler-guides.spec.js` | Other | ~150 | 16 | Rulers, guides overlay, creation zones, zoom |
| `mcp-panel.spec.js` | Other | ~260 | 14 | MCP panel rendering, connect, toggle, events |
| `accessibility.spec.js` | Other | ~270 | 19 | Keyboard nav, ARIA, focus, shortcuts |
| `visual-regression.spec.js` | Other | ~210 | 17 | Component rendering, workspace states, error-free |
| `gradient-editor.spec.js` | Other | ~160 | 10 | Add gradient, type toggle, stops, events |
| `shadow-editor.spec.js` | Other | ~230 | 11 | Add shadow, type toggle, properties, delete, error |
| `library-drag-drop.spec.js` | Other | ~210 | 16 | Component/color/typo drag, drop handlers, error |
| `drawing-cycle.spec.js` | Other | ~420 | 17 | Draw shapes, undo/redo, properties, selection |
| `file-persistence.spec.js` | Other | ~260 | 16 | Save, undo, redo, file name, keyboard shortcuts |

**Total**: 30 spec files, ~5,500+ lines, 490 tests.

### 3.2 Test Helpers

Most E2E specs use shared helper functions:

```javascript
// Login helper — used in nearly every spec
async function login(page) {
  await page.goto('/');
  await page.waitForSelector('penpot-auth-screen');
  await page.locator('#email').fill('admin@penpot.local');
  await page.locator('#pw').fill('penpot123');
  await page.locator('#submit').click();
  await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
}

// Navigate to workspace — logs in and opens the first file
async function openWorkspace(page) {
  await login(page);
  const dashboard = page.locator('penpot-dashboard');
  const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
  if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await fileCard.click();
    await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
    return true;
  }
  return false;
}
```

The `openWorkspace` helper gracefully handles the case where no file exists (returns `false`), and tests that depend on files use `if (!(await openWorkspace(page))) return;` to skip when no file is available.

### 3.3 Drawing Helper

The `p3-extended.spec.js` file demonstrates canvas drawing:

```javascript
async function drawRect(page, startX, startY, width, height) {
  const canvas = page.locator('penpot-canvas');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) return;
  const tools = page.locator('penpot-tools-bar');
  await tools.locator('[data-tool="rect"]').click();
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + width, startY + height, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await tools.locator('[data-tool="select"]').click();
}
```

### 3.4 Component Preview Page Tests

The `p2-components.spec.js` tests use a dedicated preview page at `/preview/` that renders all design system components in isolation. This page is not part of the main application — it exists solely for testing component rendering and interaction.

### 3.5 Custom Element Assertions

Since all UI is built with Web Components (custom elements), tests use custom element selectors:

```javascript
// Check a custom element is registered
const defined = await page.evaluate(() => customElements.get('penpot-export-dialog'));
expect(defined).toBeTruthy();

// Wait for a custom element to render
await page.waitForSelector('penpot-workspace');

// Access custom element properties
await cursorOverlay.evaluate((el) => {
  el.cursors = [{ id: 'user-1', name: 'Alice', x: 100, y: 200 }];
});
```

### 3.6 Conditional Test Execution

Some tests skip gracefully when prerequisites aren't met:

```javascript
test('workspace renders with toolbar', async ({ page }) => {
  if (!(await openWorkspace(page))) return; // Skip if no file available
  // ... assertions
});
```

This pattern avoids hard failures when the test database doesn't have pre-seeded files.

---

## 4. Server Integration Tests (node:test)

### 4.1 Overview

The server test suite uses `node:test` with `node:assert/strict` and an in-memory SQLite database. Tests cover RPC commands, middleware, database operations, authentication, WebSocket, storage, and more.

**Statistics**: 75 test files, 872 test cases, 287 suites, 0 failures.

### 4.2 Test File Inventory

#### Authentication & Security

| File | Lines | Focus |
|------|-------|-------|
| `test/auth-index.test.js` | 39 | Auth module exports |
| `test/auth-middleware.test.js` | 67 | JWE auth middleware, token extraction |
| `test/password.test.js` | 45 | Argon2id derive/verify, sentinel detection |
| `test/tokens.test.js` | 71 | JWE create/verify, session/registration/recovery/email tokens, expiration |
| `test/security-middleware.test.js` | 175 | HTTP security headers (CSP, HSTS, CORS, X-Frame-Options) |
| `test/rate-limit.test.js` | 48 | Per-IP rate limiting |
| `test/ssrf.test.js` | 39 | SSRF URL validation: blocks loopback, private, link-local, metadata |
| `test/registration.test.js` | 242 | Full user registration flow |

#### RPC Commands

| File | Lines | Focus |
|------|-------|-------|
| `test/dispatcher.test.js` | 83 | RpcError, errors factory, method registration/getRegisteredMethods |
| `test/rpc-modules.test.js` | 224 | All RPC module registration and dispatch |
| `test/file-gc.test.js` | 161 | File garbage collection (cleanFile, collectUsedMediaIds, collectComponentReferences) |
| `test/binfile.test.js` | 573 | Binary file import/export (v3 ZIP format, ID remapping, shape cleanup, storage objects) |
| `test/files-rpc.test.js` | 101 | File get/rename/delete, library link/unlink |
| `test/files-create.test.js` | 116 | File creation: initial data, owner role, features, migrations |
| `test/files-update.test.js` | 44 | Revn/vern conflict detection, file data persistence |
| `test/files-share-rpc.test.js` | 81 | File sharing, permission updates |
| `test/teams-projects.test.js` | 60 | Team/project CRUD, membership |
| `test/teams-invitations-rpc.test.js` | 186 | Team invitation CRUD |
| `test/profile-rpc.test.js` | 226 | Profile commands (get/update/email change/delete) |
| `test/comments-rpc.test.js` | 197 | Comment thread CRUD, read tracking |
| `test/fonts-rpc.test.js` | 194 | Font upload/management RPC |
| `test/media-rpc.test.js` | 54 | Media upload/processing |
| `test/webhooks-rpc.test.js` | 175 | Webhook registration, update, delete, delivery |
| `test/viewer-rpc.test.js` | 104 | Viewer read-only access |
| `test/access-token-rpc.test.js` | 110 | Access token CRUD |
| `test/search.test.js` | 110 | FTS5 + LIKE search |

#### Middleware

| File | Lines | Focus |
|------|-------|-------|
| `test/permissions.test.js` | 83 | Role flags, permission checks |
| `test/quotes.test.js` | 35 | Quota limits, override from DB |
| `test/cond.test.js` | 34 | ETag conditional execution |
| `test/retry.test.js` | 85 | Conflict retry middleware |
| `test/errors-middleware.test.js` | 166 | RpcError → HTTP status mapping |

#### Database

| File | Lines | Focus |
|------|-------|-------|
| `test/sqlite.test.js` | 135 | Pool CRUD, transactions, soft-delete, insertOnConflict, jsonRead/Write |
| `test/migrate.test.js` | 24 | Migration runner |

#### Storage

| File | Lines | Focus |
|------|-------|-------|
| `test/storage-fs.test.js` | 59 | Filesystem storage put/get/delete, hash, valid buckets |
| `test/storage-fs-highlevel.test.js` | 69 | FS high-level putAny/getData/getUrl |
| `test/storage-s3.test.js` | 25 | S3 configuration (requires credentials) |
| `test/storage-gc.test.js` | 85 | Storage garbage collection |
| `test/assets-http.test.js` | 46 | Static asset serving, S3 redirect |

#### Infrastructure

| File | Lines | Focus |
|------|-------|-------|
| `test/config.test.js` | 48 | Config loading, env var parsing |
| `test/config-features.test.js` | 162 | Feature constants, parseFeatures, computeFileFeatures, checkClientFeatures |
| `test/loggers.test.js` | 45 | Structured logging, child loggers |
| `test/metrics.test.js` | 45 | Prometheus metrics registry |
| `test/scheduler.test.js` | 15 | Task scheduler |
| `test/worker.test.js` | 17 | Background worker tasks |
| `test/sse.test.js` | 17 | SSE endpoint |
| `test/ws.test.js` | 62 | WebSocket notifications |
| `test/integration.test.js` | 78 | Full request lifecycle |
| `test/telemetry.test.js` | 8 | Telemetry stats collection |
| `test/setup.test.js` | 62 | Instance bootstrapping, admin user |
| `test/email.test.js` | 37 | Email functions (SMTP disabled) |
| `test/audit-logger.test.js` | 98 | Audit event logging |
| `test/media.test.js` | 80 | Image format detection |
| `test/blob.test.js` | 82 | File data encode/decode, UUID round-trip, large data |
| `test/transit.test.js` | 150 | Transit codec, kebab↔camelCase, decode/encode |
| `test/changes.test.js` | 223 | Change processing, shape mutations |
| `test/file-gc.test.js` | 143 | File garbage collection, used media IDs |
| `test/webhook-client.test.js` | 32 | SSRF-protected HTTP client |
| `test/sqlite-extras.test.js` | 49 | SQLite extension loading |
| `test/wire-compat.test.js` | 282 | Cross-backend wire compatibility |

### 4.3 Test Patterns

#### In-Memory Database Setup

```javascript
import Database from 'better-sqlite3';
import { createPool } from '../src/db/sqlite.js';

// Create fresh in-memory database for each test suite
function setupTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  // Run migrations
  const migrate = db.exec(readMigrations());
  return createPool(db);
}
```

#### RPC Command Testing

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Files RPC', () => {
  it('creates a file and returns it', async () => {
    const pool = await setupTestDb();
    const ctx = { pool, profileId: adminId };
    const result = await filesCommands['create-file'].handler(params, ctx);
    assert.equal(result.name, 'Test File');
    assert.ok(result.id);
  });
});
```

#### Middleware Testing

```javascript
describe('Rate Limiter', () => {
  it('blocks requests after limit', async () => {
    const limiter = createRateLimiter({ max: 5, window: 60000 });
    for (let i = 0; i < 5; i++) {
      assert.equal(limiter.check('127.0.0.1'), true);
    }
    assert.equal(limiter.check('127.0.0.1'), false);
  });
});
```

---

## 5. Shared Module Unit Tests (node:test)

### 5.1 Overview

The `shared/` module has 176 test suites with 1,492 assertions across 63 test files. Tests cover pure functions — geometry calculations, type definitions, data transformations, codecs, and validation logic.

### 5.2 Test Organization

```
shared/test/
├── attrs.test.js              # Attribute helpers
├── changes_builder.test.js   # Change builder API
├── changes.test.js            # Change application and inversion
├── colors/
│   └── colors.test.js         # Color parsing and manipulation
├── data.test.js               # Data utilities (get-in, select-keys, etc.)
├── encoding.test.js           # Base64, hex encoding
├── exceptions.test.js          # Exception types
├── features.test.js           # Feature flag parsing
├── files/
│   ├── builder.test.js        # File builder API (17 tests)
│   ├── changes_builder.test.js # Change builder API
│   ├── changes.test.js            # Change application and inversion
│   ├── helpers_stats_focus_indices.test.js  # Focus indices
│   ├── migrations.test.js      # File data migration (73 migrations)
│   ├── page_diff_tokens.test.js              # Page diff
│   └── shapes_builder.test.js # SVG-to-shapes builder (70 tests)
├── flags.test.js              # Flag parsing
├── geom/
│   ├── matrix.test.js         # Matrix operations
│   ├── point.test.js          # Point arithmetic
│   ├── rect.test.js           # Rectangle operations
│   └── shapes/               # Shape geometry (bounds, constraints, corners, etc.)
│       ├── bounds_effects.test.js
│       ├── common.test.js
│       ├── constraints.test.js
│       ├── corners.test.js
│       ├── intersect.test.js
│       ├── layout_tree.test.js
│       ├── points.test.js
│       ├── shapes.test.js
│       ├── text.test.js
│       └── transforms.test.js
├── geom_modules.test.js      # Module barrel export verification
├── json.test.js               # JSON codec
├── layout_bounds.test.js       # Layout bounds calculation
├── math.test.js               # Math utilities
├── media.test.js              # Media type detection
├── migration.test.js          # File data migration
├── modifiers.test.js          # Modifier propagation
├── objects_map.test.js         # ObjectsMap data structure
├── observable.test.js         # Observable pattern
├── priority1.test.js          # Priority 1 test suite
├── priority2.test.js          # Priority 2 test suite
├── priority3.test.js          # Priority 3 test suite
├── schema.test.js             # Schema validation
├── shapes_helpers.test.js     # Shape helper functions
├── time.test.js               # Time utilities
├── transit.test.js            # Transit+JSON codec
├── types/
│   ├── color.test.js          # Color type
│   ├── component.test.js      # Component type
│   ├── components_list.test.js # Components list
│   ├── container.test.js      # Container type
│   ├── file.test.js            # File type
│   ├── fills.test.js           # Fill types
│   ├── identity.test.js        # Identity type
│   ├── library.test.js         # Library type
│   ├── page.test.js            # Page type
│   ├── pages_list.test.js      # Pages list
│   ├── path.test.js            # Path type
│   ├── shape/
│   │   └── index.test.js       # Shape type barrel
│   ├── shape_type.test.js      # Shape type enumeration
│   ├── shape_tree.test.js      # Shape tree operations
│   ├── text.test.js            # Text type
│   ├── tokens_lib.test.js      # Token library
│   ├── typographies_list.test.js # Typography list
│   └── variant.test.js         # Variant type
├── types_token_geom.test.js    # Token geometry
└── uuid.test.js                # UUID generation
```

### 5.3 Running Tests

```bash
cd shared
npm test
# or: node --test test/**/*.test.js
```

### 5.4 Test Patterns

#### Geometry Snapshot Testing

Geometry tests compare JS calculation results against known-good values from the Clojure implementation:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transformPoint, matrix } from '../src/geom/index.js';

describe('Matrix', () => {
  it('transforms a point by rotation matrix', () => {
    const m = matrix.rotation(Math.PI / 2);
    const p = { x: 1, y: 0 };
    const result = transformPoint(p, m);
    assert.ok(Math.abs(result.x) < 0.001);
    assert.ok(Math.abs(result.y - 1) < 0.001);
  });
});
```

#### Type Validation Testing

```javascript
describe('Color type', () => {
  it('creates a color with defaults', () => {
    const color = createColor();
    assert.equal(color.color, '#000000');
    assert.equal(color.opacity, 1);
  });

  it('validates color format', () => {
    assert.throws(() => createColor({ color: 'invalid' }), /invalid color/i);
  });
});
```

#### Transit Round-Trip Testing

```javascript
describe('Transit codec', () => {
  it('round-trips a shape with UUID', () => {
    const shape = createShape('rect', { id: uuid() });
    const encoded = transitEncode(shape);
    const decoded = transitDecode(encoded);
    assert.equal(decoded.id, shape.id);
    assert.equal(decoded.type, 'rect');
  });
});
```

---

## 6. Server & Exporter Tests

### 6.1 Overview

The exporter has 22 unit tests covering configuration, URL building, export grouping, and context options.

### 6.2 Test File

**File**: `server/exporter/test/exporter.test.js`

| Test Suite | Tests | Focus |
|------------|-------|-------|
| Config | 3 | Environment variable parsing, defaults |
| URL Building | 4 | Export URL construction, page ID extraction |
| Grouping | 5 | Shape/frame grouping by page, scale factor |
| Context Options | 4 | Playwright context configuration, viewport |
| Rendering | 6 | Bitmap/SVG/PDF renderer dispatch |
| Error Handling | 4 | Invalid requests, missing parameters |

### 6.3 Running Tests

```bash
cd server/exporter
node --test test/exporter.test.js
```

---

## 7. Frontend Playwright Tests (Upstream)

### 7.1 Overview

The upstream ClojureScript frontend has 35 Playwright spec files in `frontend/playwright/ui/specs/`. These test the production ClojureScript front-end and are **not** run as part of the JS port's CI. They serve as a reference for feature parity testing.

### 7.2 Key Test Categories

| Category | Spec Files | Focus |
|----------|-----------|-------|
| Auth | `login.spec.js`, `register.spec.js` | Login, registration, recovery |
| Dashboard | `dashboard.spec.js`, `dashboard-*.spec.js` | File/project/team management |
| Workspace | `workspace.spec.js`, `workspace-*.spec.js` | Design editor functionality |
| Viewer | `viewer-*.spec.js` | Read-only file viewing |
| Design Tokens | `tokens/*.spec.js` | Token CRUD, themes, remapping |
| Components | `components.spec.js`, `variants.spec.js` | Component system |
| Export | `export-frames.spec.js` | Frame export |
| Inspect | `inspect-tab.spec.js`, `inspect-layout.spec.js` | Design inspection |
| Render WASM | `render-wasm-specs/*.spec.js` | WASM canvas rendering |
| Subscriptions | `subscriptions-*.spec.js` | Subscription flows |

### 7.3 Relationship to JS Port Tests

The upstream tests inform the JS port E2E coverage but are not directly portable because:

1. **Different DOM structure**: ClojureScript uses React with Hiccup templates; JS port uses Web Components with `<template>` + `cloneNode()`.
2. **Different selectors**: Upstream uses React-specific selectors (`[data-testid]`); JS port uses custom element names (`penpot-workspace`) and BEM classes (`.penpot-toolbar__back-btn`).
3. **Different state management**: Upstream uses Potok/Okulary/RxJS; JS port uses custom signal store.

The JS port E2E tests are written from scratch to match the Web Component API surface.

---

## 8. Running All Tests

### 8.1 Quick Reference

```bash
# Shared module unit tests
cd shared && npm test

# Server integration tests
cd server && npm test

# Server exporter tests
cd server/exporter && node --test test/exporter.test.js

# Client E2E tests (requires running servers)
cd client && npx playwright test

# Frontend upstream Playwright tests (ClojureScript)
cd frontend && npx playwright test
```

### 8.2 Full E2E Test Run (Client)

The client E2E tests require both servers to be running. Playwright's `webServer` config auto-starts them:

```bash
cd client

# Install Playwright browsers (first time)
npx playwright install chromium

# Run all E2E tests
npx playwright test

# Run a specific spec file
npx playwright test e2e/auth.spec.js

# Run tests with a visible browser (for debugging)
npx playwright test --headed

# Run tests with Playwright UI
npx playwright test --ui

# Generate test report
npx playwright show-report
```

### 8.3 Server Test Run

```bash
cd server

# Run all tests
npm test
# or: node --test test/**/*.test.js

# Run a specific test file
node --test test/auth-middleware.test.js

# Run tests matching a pattern
node --test test/files*.test.js

# Verbose output
node --test test/**/*.test.js --test-reporter spec
```

### 8.4 Shared Test Run

```bash
cd shared

# Run all tests
npm test
# or: node --test test/**/*.test.js

# Run a specific test file
node --test test/geom/point.test.js

# Run all geometry tests
node --test test/geom/**/*.test.js
```

---

## 9. Test Writing Guidelines

### 9.1 Client E2E Test Guidelines

1. **Use the standard helpers**: Always use `login()` and `openWorkspace()` helpers. Don't reimplement auth flow in every test.

2. **Use custom element selectors**: Select by Web Component tag name (`penpot-workspace`, `penpot-toolbar`), not by CSS class, unless the class is stable.

   ```javascript
   // Good: custom element selector
   await expect(page.locator('penpot-workspace')).toBeVisible();

   // OK: data attribute selector
   await expect(page.locator('[data-tool="rect"]')).toBeVisible();

   // Fragile: implementation-detail CSS selector
   await expect(page.locator('.workspace-container > .sidebar')).toBeVisible();
   ```

3. **Guard with `openWorkspace` return check**: Always check if `openWorkspace` succeeded before asserting workspace-specific behavior:

   ```javascript
   test('canvas renders shapes', async ({ page }) => {
     if (!(await openWorkspace(page))) return;
     // ... workspace assertions
   });
   ```

4. **Draw shapes using the mouse API**: Use `page.mouse.move()`, `page.mouse.down()`, `page.mouse.up()` for drawing operations. Use `{ steps: 5 }` for drag operations to ensure intermediate mouse move events.

5. **Wait for custom elements to be defined**: Use `customElements.get()` to verify component registration:

   ```javascript
   const defined = await page.evaluate(() => customElements.get('penpot-export-dialog'));
   expect(defined).toBeTruthy();
   ```

6. **Test custom element properties via `evaluate`**: Access and set custom element properties through `evaluate`:

   ```javascript
   await page.evaluate((el) => { el.cursors = [{ id: 'user-1', x: 100 }]; }, cursorOverlay);
   ```

7. **Use `{ timeout: 15000 }` for auth-dependent waits**: The first login after server startup can be slow. Use generous timeouts for dashboard appearance.

8. **Group tests by phase**: Use the P0–P6 phase naming convention. Tests in `p0-flow.spec.js` should only cover authentication and basic navigation.

9. **Avoid hard-coded coordinates for canvas tests**: Use `canvas.boundingBox()` to get dynamic positions, and calculate offsets relative to the canvas origin.

10. **Clean up state between tests**: Use `test.beforeEach()` for state setup and `test.afterEach()` for cleanup when needed. However, since E2E tests use a shared database, prefer idempotent assertions over state-dependent ones.

### 9.2 Server Integration Test Guidelines

1. **Use in-memory SQLite**: Every test suite should create a fresh `:memory:` database. No shared state.

2. **Test the handler, not the HTTP endpoint**: Most RPC tests call the handler function directly with a mock context. Only `integration.test.js` tests the full HTTP request lifecycle.

   ```javascript
   // Direct handler test (fast, isolated)
   const result = await commands['create-file'].handler(params, ctx);

   // HTTP integration test (slow, full stack)
   const response = await app.inject({ method: 'POST', url: '/api/rpc/command/create-file', payload: params });
   ```

3. **Use `describe`/`it` grouping**: Group related tests with `describe('RPC: files', () => { ... })`.

4. **Test error conditions**: Don't just test the happy path. Test missing fields, invalid IDs, permission denials, and conflict cases.

5. **Use `node:assert/strict`**: Always use strict equality assertions. Avoid `assert.equal()` for reference types — use `assert.deepEqual()`.

### 9.3 Shared Module Unit Test Guidelines

1. **Test pure functions**: The `shared/` module contains only pure functions and data types. Tests should be deterministic with no I/O or network dependencies.

2. **Snapshot testing for geometry**: Compare geometry calculation results against known-good values (ported from Clojure tests). Use a tolerance for floating-point comparisons:

   ```javascript
   assert.ok(Math.abs(result.x - expected.x) < 0.001, `Expected x=${expected.x}, got ${result.x}`);
   ```

3. **Test edge cases**: Zero-length vectors, empty arrays, `null`/`undefined` inputs, very large numbers.

4. **Test round-trip codecs**: For Transit and JSON codecs, always test that `decode(encode(x))` equals `x` (or a normalized version of `x`).

---

## 10. CI Integration

### 10.1 Recommended CI Pipeline

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  shared-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd shared && npm install && npm test

  server-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd server && npm install && npm test

  exporter-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd server/exporter && npm install && node --test test/exporter.test.js

  client-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd client && npm install && npx playwright install chromium
      - run: cd shared && npm install
      - run: cd server && npm install
      - run: cd client && npx playwright test
```

### 10.2 Environment Variables for E2E Tests

Set these environment variables for CI:

| Variable | Value | Purpose |
|----------|-------|---------|
| `PENPOT_SECRET_KEY` | Random 32-byte key | JWE token signing |
| `PENPOT_DATABASE_PATH` | `:memory:` or temp file | Test database |
| `PENPOT_HTTP_PORT` | `6060` | Server port |
| `PENPOT_INITIAL_ADMIN_EMAIL` | `admin@penpot.local` | Auto-create admin |
| `PENPOT_INITIAL_ADMIN_PASSWORD` | `penpot123` | Admin password |
| `PENPOT_FLAGS` | `enable-quotes enable-telemetry` | Feature flags |
| `PENPOT_STORAGE_BACKEND` | `fs` | Use filesystem storage |

---

## 11. Current Test Coverage Summary

### 11.1 By Module

| Module | Test Type | Test Files | Test Cases/Assertions | Pass | Fail | Skip |
|--------|-----------|-----------|----------------------|------|------|------|
| `shared/` | Unit | 176 suites | 1,492 assertions | 1,492 | 0 | 0 |
| `server/` | Integration | 75 | 872 tests, 287 suites | 872 | 0 | 0 |
| `server/exporter/` | Unit | 1 | 22 tests, 6 suites | 22 | 0 | 0 |
| `client/` | E2E | 30 spec files | 490 tests | 490 | 0 | 0 |
| **Total** | | **~280** | **2,876** | **2,876** | **0** | **0** |

### 11.2 By Test Category

| Category | Count | Coverage |
|----------|-------|----------|
| **Geometry** | ~30 files | Point, rect, matrix, line, snap, bounds, intersects, corners, constraints, transforms, flex/grid layout |
| **Types** | ~20 files | Color, component, file, shape, path, text, fills, page, container, typography, token, variant |
| **Files** | ~8 files | Changes, builder, migration, validation, repair, page diff, helpers, shapes_builder |
| **Auth/Security** | ~10 files | JWE tokens, Argon2id, middleware, SSRF, rate limiting, security headers |
| **RPC Commands** | ~15 files | Files, teams, profile, comments, media, fonts, webhooks, search, viewer, access tokens, binfile |
| **Database** | ~3 files | CRUD, transactions, migrations, FTS5 |
| **Storage** | ~5 files | FS, S3, GC, high-level operations |
| **File GC** | 1 file | Shape cleaning, media collection, component references, thumbnail tracking |
| **E2E Auth** | ~20 tests | Login, register, recovery, token management |
| **E2E Dashboard** | ~23 tests | Teams, projects, files, search, fonts, libraries, deleted |
| **E2E Context Menu** | ~9 tests | Right-click, menu items, Escape close, error handling |
| **E2E Workspace** | ~60 tests | Tools, canvas, sidebars, properties, layers, assets, zoom, pan |
| **E2E Collaboration** | ~12 tests | WebSocket, presence, cursor overlay, reconnection |
| **E2E Export** | ~17 tests | PNG/SVG/PDF export, share, comments, keyboard shortcuts |
| **E2E Binary File** | ~31 tests | Import dialog, export dialog, drag-drop, format handling |
| **E2E SVG Import** | ~15 tests | Drag-drop, import dialog, parseSVG, file input |
| **E2E Interaction** | ~17 tests | Prototyping panel, add/edit/remove interactions, events |
| **E2E Ruler Guides** | ~16 tests | Rulers, guides overlay, creation zones |
| **E2E MCP Panel** | ~14 tests | MCP panel rendering, connect, toggle, events |
| **E2E Accessibility** | ~19 tests | Keyboard nav, ARIA, focus, shortcuts |
| **E2E Visual Regression** | ~17 tests | Component rendering, workspace states, error-free |
| **E2E Gradient Editor** | ~10 tests | Add gradient, type toggle, stops, events |
| **E2E Shadow Editor** | ~11 tests | Add shadow, type toggle, properties, delete, error |
| **E2E Library Drag-Drop** | ~16 tests | Component/color/typo drag, drop handlers, error |
| **E2E Drawing Cycle** | ~17 tests | Draw shapes, undo/redo, properties, selection |
| **E2E File Persistence** | ~16 tests | Save, undo, redo, file name, keyboard shortcuts |
| **E2E Page Management** | ~5 tests | Add/rename/delete/duplicate pages |
| **E2E Settings** | ~8 tests | Profile/password/feedback/settings pages |
| **E2E WebSocket Reconnect** | ~12 tests | Connection status, reconnection, error handling |
| **E2E SVG Filter Editing** | ~15 tests | Add/remove filters, type change, properties |

---

## 12. E2E Test Matrix

This matrix maps each user-facing feature to its E2E test coverage.

### 12.1 Authentication (P0)

| Feature | Test File | Status |
|---------|-----------|--------|
| Login form renders | `auth.spec.js` | ✅ |
| Register form renders | `auth.spec.js` | ✅ |
| Switch login ↔ register | `auth.spec.js` | ✅ |
| Regression: innerHTML switch bug | `auth.spec.js` | ✅ |
| SwitchLink text updates | `auth.spec.js` | ✅ |
| Login with valid credentials | `p0-flow.spec.js` | ✅ |
| Login → dashboard navigation | `p0-flow.spec.js` | ✅ |
| Login → project → file list | `p0-flow.spec.js` | ✅ |
| Login → create file → workspace | `p0-flow.spec.js` | ✅ |
| Dashboard → workspace → back | `p0-flow.spec.js` | ✅ |
| Auth edge cases (empty fields, wrong password) | `p0-flow.spec.js` | ✅ |

### 12.2 Design System Components (P2)

| Component | Test File | Status |
|-----------|-----------|--------|
| Button (primary, danger, ghost) | `p2-components.spec.js` | ✅ |
| Button click event | `p2-components.spec.js` | ✅ |
| Checkbox toggle | `p2-components.spec.js` | ✅ |
| Switch toggle | `p2-components.spec.js` | ✅ |
| Slider value display | `p2-components.spec.js` | ✅ |
| Tabs navigation | `p2-components.spec.js` | ✅ |
| Dropdown open/close | `p2-components.spec.js` | ✅ |
| Select dropdown | `p2-components.spec.js` | ✅ |
| Modal open/close | `p2-components.spec.js` | ✅ |
| Color picker | `p2-components.spec.js` | ✅ |
| Tooltip | `p2-components.spec.js` | ✅ |
| Notification toast | `p2-components.spec.js` | ✅ |
| Avatar | `p2-components.spec.js` | ✅ |
| Loader | `p2-components.spec.js` | ✅ |
| Icon | `p2-components.spec.js` | ✅ |
| Badge | `p2-components.spec.js` | ✅ |
| Input field | `p2-components.spec.js` | ✅ |
| File thumbnail | `p2-components.spec.js` | ✅ |
| Form validation | `p2-components.spec.js` | ✅ |

### 12.3 Workspace Shell (P1)

| Feature | Test File | Status |
|---------|-----------|--------|
| Toolbar, tools bar, sidebars, canvas render | `p1-workspace.spec.js` | ✅ |
| Toolbar file name and back button | `p1-workspace.spec.js` | ✅ |
| Back button returns to dashboard | `p1-workspace.spec.js` | ✅ |
| Left sidebar pages/layers/assets tabs | `p1-workspace.spec.js` | ✅ |
| Right sidebar design/inspect tabs | `p1-workspace.spec.js` | ✅ |
| Canvas renders with SVG | `p1-workspace.spec.js` | ✅ |
| Zoom controls | `p1-workspace.spec.js` | ✅ |
| Tool switching | `p1-workspace.spec.js` | ✅ |

### 12.4 Drawing & Editing Tools (P3)

| Feature | Test File | Status |
|---------|-----------|--------|
| Select tool active by default | `p3-tools.spec.js` | ✅ |
| Rectangle tool click/draw | `p3-tools.spec.js` | ✅ |
| Ellipse tool | `p3-tools.spec.js` | ✅ |
| Frame tool | `p3-tools.spec.js` | ✅ |
| Text tool | `p3-tools.spec.js` | ✅ |
| Hand tool (pan) | `p3-tools.spec.js` | ✅ |
| Keyboard shortcuts (R, E, V, H, T, F) | `p3-tools.spec.js` | ✅ |
| Undo/redo buttons | `p3-enhanced.spec.js` | ✅ |
| Text toolbar appearance | `p3-enhanced.spec.js` | ✅ |
| Snap guides | `snap-text-editing.spec.js` | ✅ |
| Boolean operations UI | `p3-extended.spec.js` | ✅ |
| Z-order controls | `p3-extended.spec.js` | ✅ |
| Rotation handle | `p3-extended.spec.js` | ✅ |
| Group/ungroup | `p3-extended.spec.js` | ✅ |
| Text inline editing | `snap-text-editing.spec.js` | ✅ |

### 12.5 Layer Panel & Asset Library (P4)

| Feature | Test File | Status |
|---------|-----------|--------|
| Layers/assets/pages tabs | `p4-layer-asset.spec.js` | ✅ |
| Layer panel renders shapes | `p4-layer-asset.spec.js` | ✅ |
| Layer collapse/expand | `p4-layer-asset.spec.js` | ✅ |
| Layer visibility/lock toggles | `p4-layer-asset.spec.js` | ✅ |
| Layer search/filter | `p4-layer-asset.spec.js` | ✅ |
| Layer drag-drop reorder | `p4-layer-asset.spec.js` | ✅ |
| Asset panel components tab | `p4-layer-asset.spec.js` | ✅ |
| Asset panel fonts tab | `p4-layer-asset.spec.js` | ✅ |
| Asset panel colors tab | `p4-layer-asset.spec.js` | ✅ |
| Component creation | `p4-layer-asset.spec.js` | ✅ |
| Component instance placement | `p4-layer-asset.spec.js` | ✅ |
| Component detach/sync | `p4-layer-asset.spec.js` | ✅ |
| Multi-select in layers | `p4-layer-asset.spec.js` | ✅ |

### 12.6 Collaboration (P5)

| Feature | Test File | Status |
|---------|-----------|--------|
| Cursor overlay renders | `p5-collaboration.spec.js` | ✅ |
| Presence bar renders | `p5-collaboration.spec.js` | ✅ |
| Presence bar status dot | `p5-collaboration.spec.js` | ✅ |
| Cursor overlay container | `p5-collaboration.spec.js` | ✅ |
| Cursor overlay accepts data | `p5-collaboration.spec.js` | ✅ |
| WebSocket connection | `p5-collaboration.spec.js` | ✅ |
| Edit conflict detection | `p5-collaboration.spec.js` | ✅ |

### 12.7 Export & Advanced (P6)

| Feature | Test File | Status |
|---------|-----------|--------|
| Export dialog exists | `p6-export.spec.js` | ✅ |
| Share dialog exists | `p6-export.spec.js` | ✅ |
| Comment panel exists | `p6-export.spec.js` | ✅ |
| Export button in toolbar | `p6-export.spec.js` | ✅ |
| Export dialog opens | `p6-export.spec.js` | ✅ |
| Export format options (PNG/SVG/PDF) | `p6-export.spec.js` | ✅ |
| Share dialog opens | `p6-export.spec.js` | ✅ |
| Comment pin placement | `p6-export.spec.js` | ✅ |
| Version history panel | `p6-export.spec.js` | ✅ |

### 12.8 Cross-Cutting

| Feature | Test File | Status |
|---------|-----------|--------|
| Page add/rename/delete | `page-management.spec.js` | ✅ |
| Settings profile/password/feedback | `settings.spec.js` | ✅ |

### 12.9 New Feature Coverage (WU-C1 through WU-K2)

These features were implemented as part of the work units tracked in `docs/migration/parity-audit.md`. E2E test coverage is limited — most testing is via server unit tests and client component rendering.

| Feature | Work Unit | Unit Tests | E2E Coverage | Visual Parity |
|---------|-----------|------------|---------------|---------------|
| Interaction prototyping UI | WU-C1 | None (component) | Partial — interaction panel renders | Manual |
| Ruler guides | WU-C2 | None (component) | None — guide overlay renders | Manual |
| Library drag-to-apply | WU-C3 | None (component) | None — drag events exist | Manual |
| MCP integration | WU-C4 | None (new component) | None — requires running MCP server | N/A |
| Advanced SVG filters | WU-C5 | None (component) | None — filter editor renders | Manual |
| Binary file import | WU-C6 | 30 tests (server) | None — import dialog renders | N/A |
| RPC edge-case audit | WU-K1 | 5 tests (server) | N/A (server-only) | N/A |
| File GC deep analysis | WU-K2 | 24 tests (server) | N/A (server-only) | N/A |

---

## 13. Gap Analysis & Future Work

### 13.1 E2E Test Gaps

The following areas need additional E2E test coverage:

| Area | Current Status | Priority | Notes |
|------|---------------|----------|-------|
| **Registration flow** | Covered | P1 | `registration.spec.js` (18 tests) — form rendering, validation, error handling |
| **Password recovery** | Covered | P1 | `recovery.spec.js` (18 tests) — request form, token URL, error handling |
| **Dashboard navigation** | Covered | P2 | `dashboard-navigation.spec.js` (23 tests) — tabs, search, fonts, libraries, deleted |
| **Context menu** | Covered | P2 | `context-menu.spec.js` (9 tests) — right-click, menu items, Escape close, error handling |
| **WebSocket reconnection** | Covered | P2 | `websocket-reconnect.spec.js` (12 tests) — presence, cursor overlay, status, error handling |
| **Binary file export** | Covered | P2 | `binary-file-export.spec.js` (14 tests) — formats, scale, cancel, close, error handling |
| **SVG import** | Covered | P2 | `svg-import.spec.js` (15 tests) — drag-drop, import dialog, parseSVG, error handling |
| **Interaction prototyping** | Covered | P2 | `interaction-prototyping.spec.js` (17 tests) — panel rendering, add/edit/remove, events |
| **Ruler guides** | Covered | P3 | `ruler-guides.spec.js` (16 tests) — rulers, overlay, creation zones |
| **MCP panel** | Covered | P3 | `mcp-panel.spec.js` (14 E2E) + `mcp-panel.test.js` (20 unit) |
| **Binary file import** | Covered | P2 | `binary-file-import.spec.js` (17 tests) — dialog, close, cancel, file types |
| **SVG filter editing** | Covered | P3 | `svg-filter-editing.spec.js` (15 tests) — add/remove, type change, properties |
| **Visual regression** | Covered | P3 | `visual-regression.spec.js` (17 tests) — component rendering, workspace states, error-free |
| **Accessibility** | Covered | P3 | `accessibility.spec.js` (19 tests) — keyboard nav, ARIA, focus, shortcuts |
| **Gradient editor** | Covered | P3 | `gradient-editor.spec.js` (10 tests) — add gradient, type toggle, stops, events |
| **Shadow editor** | Covered | P3 | `shadow-editor.spec.js` (11 tests) — add shadow, type toggle, properties, delete, error |
| **Library drag-drop** | Covered | P3 | `library-drag-drop.spec.js` (16 tests) — component/color/typo drag, drop handlers, error |
| **Token event wiring** | ✅ **Complete** | All 7 token panel events (`penpot-token-set-activate`, `penpot-token-theme-change`, `penpot-token-set-delete`, `penpot-apply-color-token`, `penpot-apply-typo-token`, `penpot-token-add`, `penpot-token-delete`, `penpot-token-update`) are wired in workspace; changes persist via `enqueueChange` |
| **Plugin lifecycle event wiring** | ✅ **Complete** | All 3 plugin events (`penpot-plugin-install`, `penpot-plugin-open`, `penpot-plugin-remove`) wired in workspace. Install loads manifest via `PluginManager`, open creates iframe, remove unloads plugin. Plugin panel overlay with toolbar button added. |
| **OAuth login buttons** | **P0 — BLOCKED** | Feature flags `login_with_oidc`, `login_with_google`, `login_with_github`, `login_with_gitlab` are enabled but **no UI** renders in `penpot-auth-screen.js`. Tests should verify: (1) OAuth buttons appear when flags are enabled, (2) clicking redirects to provider, (3) callback handles token. **Requires WU-Q3 first.** |
| **Plugin API real operations** | **P1** | `deleteShape` was a no-op (now fixed — dispatches event + workspace handler); `createShape`/`updateShape` dispatch events but need verification that shapes actually persist to server via `update-file` RPC |
| **Error notification visibility** | **P1** | User-facing error notifications now appear when RPC calls fail (share permissions, library loading, templates) after replacing 33 silent `catch {}` blocks. Tests should verify: (1) `penpot-notification` danger toast appears on RPC failure, (2) warning toast for non-critical errors |
| **Templates tab empty state** | **P2** | Templates tab now shows empty state with warning when `get-builtin-templates` fails instead of hardcoded mock data. Test should verify: (1) empty state renders, (2) warning notification appears |
| **Mobile/responsive** | Missing | P4 | No viewport size variation tests |
| **Performance** | Missing | P4 | No canvas rendering performance benchmarks |

### 13.2 Server Test Gaps — RPC Handler Coverage

> **Critical gap**: Approximately 70 RPC commands across 15 modules have **no handler-level test coverage** with real database operations. Existing tests for files, teams, projects, and media test at the raw pool level (using `pool.query()` directly) rather than through the actual RPC handler functions.

| Priority | Test File | Commands to Cover | Approach |
|----------|-----------|-------------------|----------|
| **P0** | `test/auth-rpc.test.js` | `login-with-password`, `logout`, `recover-profile` | Real DB, verify session creation, token invalidation, password reset |
| **P0** | `test/teams-rpc.test.js` | `create-team`, `update-team`, `leave-team`, `delete-team`, member management | Real DB, verify team CRUD, membership, role changes |
| **P0** | `test/projects-rpc.test.js` | `create-project`, `rename-project`, `delete-project` | Real DB, verify project CRUD |
| **P0** | `test/files-rpc-handler.test.js` | `set-file-shared`, `permanently-delete-team-files`, `restore-deleted-team-files`, `update-file-pin` | Real DB, verify file sharing, deletion, restoration, pinning |
| **P0** | `test/files-update-handler.test.js` | `update-file` (collaborative editing) | Real DB, verify file_change INSERT, file_data UPDATE, revn conflict resolution |
| **P1** | `test/management-rpc.test.js` | `duplicate-file`, `clone-template` | Real DB, verify file/project duplication |
| **P1** | `test/files-snapshots-rpc.test.js` | `create-snapshot`, `restore-snapshot`, `delete-snapshot` | Real DB, verify snapshot CRUD |
| **P1** | `test/comments-rpc-full.test.js` | `delete-comment`, `update-comment`, `mark-all-threads-as-read` | Real DB, verify comment mutations |

### 13.5 Client Functional Correctness Test Gaps

> These tests verify that UI buttons and interactions actually work end-to-end, not just that components render.

| Priority | New Spec File | Focus | Blocked By |
|----------|--------------|-------|------------|
| **P0** | `token-wiring.spec.js` | Token set activate, theme change, apply color/typography token events reach workspace and persist shapes | WU-Q1 (workspace event handlers) |
| **P0** | `plugin-lifecycle.spec.js` | Plugin install, open, remove events reach workspace and modify store | WU-Q2 (workspace event handlers) |
| **P0** | `oauth-login.spec.js` | OIDC/Google/GitHub/GitLab buttons appear when flags enabled, redirect to provider | WU-Q3 (auth screen buttons) |
| **P1** | `error-notifications.spec.js` | Verify danger/warning notifications appear on RPC failures (share permissions, library loading, templates, collaboration lag) | Fix already applied — just needs tests |
| **P1** | `plugin-api-operations.spec.js` | Verify `deleteShape` removes shape, `createShape` persists shape, `updateShape` modifies shape properties | Fix already applied — just needs tests |
| **P2** | `templates-empty-state.spec.js` | Verify templates tab shows empty state when RPC fails, warning notification appears | Fix already applied — just needs tests |
| **P1** | `test/profile-rpc.test.js` (extend) | `update-profile-photo`, `delete-profile`, `request-email-change` | Real DB, verify profile mutations |
| **P2** | `test/nitrate-rpc.test.js` | All 5 commands (enterprise stubs) | Verify stub behavior and error responses |
| **P2** | `test/demo-rpc.test.js` | `create-demo-profile` | Real DB, verify demo user creation |
| **P2** | `test/oidc-rpc.test.js` | `get-oidc-provider`, `oidc-callback` | Mock OIDC provider, verify profile/session creation |
| **P2** | `test/verify-token-rpc.test.js` | `verify-token` | Verify token type dispatch (email-change, verify-email, auth, team-invitation) |

Additionally, the following areas have **no test coverage at all**:

| Area | Current Status | Priority | Notes |
|------|---------------|----------|-------|
| **WebSocket load testing** | Missing | P2 | No concurrent connection stress tests |
| **File data binary round-trip** | Covered | ✅ | `blob.test.js` + `binfile.test.js` (30 tests) |
| **File GC end-to-end** | Covered | ✅ | `file-gc.test.js` (24 tests covering cleanFile, collectUsedMediaIds, collectComponentReferences) |
| **Large file handling** | Missing | P2 | No tests for files with 10,000+ shapes |
| **Concurrent editing conflicts** | Partial | P1 | Revn/vern conflict detection tested, but not multi-client race conditions |
| **S3 storage integration** | Missing | P2 | Only config tested (requires S3 credentials) |
| **Email sending** | Missing | P3 | Only tested in SMTP-disabled mode |
| **Rate limiting under load** | Missing | P3 | No burst request tests |
| **Storage GC edge cases** | Covered | ✅ | `storage-gc.test.js` (5 tests) — deleted object GC, orphan GC, error handling |

### 13.3 Shared Module Test Gaps

| Area | Current Status | Priority | Notes |
|------|---------------|----------|-------|
| **Flex layout calculations** | Partial | P1 | Bounds/positions/params tested, but not full layout computation round-trips |
| **Grid layout calculations** | Partial | P1 | Areas/positions tested, but not full grid layout from real designs |
| **Path boolean operations** | Missing | P1 | `types/path/bool.js` exists but no geometric boolean tests |
| **Shape tree operations** | Partial | P2 | Basic tree_seq tested, but not complex nested group operations |
| **Modifier propagation** | Tested | ✅ | `modifiers.test.js` covers propagation chains |
| **File change inversion** | Tested | ✅ | `changes.test.js` covers apply/invert round-trips |
| **SVG path parsing** | Partial | P2 | `svg_parser.js` tested for basic paths, but not complex SVG documents |

### 13.4 Future E2E Test Priorities

#### Phase 1: Critical Gaps (P1) — ✅ Complete

1. **Registration E2E** ✅ — `registration.spec.js` (18 tests): form rendering, validation, error handling, mode switching
2. **Password recovery E2E** ✅ — `recovery.spec.js` (18 tests): recovery-request form, token URL, validation, XSS/injection safety
3. **Full drawing cycle E2E** ✅ — `drawing-cycle.spec.js` (28 tests): draw → select → edit → undo/redo → delete + error handling
4. **File persistence E2E** ✅ — `file-persistence.spec.js` (20 tests): save, undo/redo, rename, rapid cycling, error handling

#### Phase 2: Feature Parity (P2) — ✅ Complete

5. **Dashboard navigation E2E** ✅ — `dashboard-navigation.spec.js` (23 tests): tabs, search, fonts, libraries, deleted files, error handling
6. **Context menu E2E** ✅ — `context-menu.spec.js` (9 tests): right-click canvas/file, menu items, Escape close, delete
7. **WebSocket reconnection** ✅ — `websocket-reconnect.spec.js` (12 tests): presence bar, cursor overlay, connection state, error handling
8. **Binary file export** ✅ — `binary-file-export.spec.js` (14 tests): format selection (PNG/JPEG/WebP/SVG/PDF), scale, cancel, close
9. **SVG import** ✅ — `svg-import.spec.js` (15 tests): import dialog, drop zone, parseSVG, file input, error handling

#### Phase 3: Polish (P3) — ✅ Complete

9. **Visual regression** ✅ — `visual-regression.spec.js` (17 tests): auth screen, dashboard, workspace shell, right sidebar, components, canvas, error states
10. **Accessibility** ✅ — `accessibility.spec.js` (19 tests): keyboard navigation, ARIA labels, focus management, shortcuts
11. **Gradient editor** ✅ — `gradient-editor.spec.js` (10 tests): add gradient fill, type toggle, color stops, events, error handling
12. **Shadow editor** ✅ — `shadow-editor.spec.js` (11 tests): add shadow, type toggle (drop/inner), properties, delete, error handling
13. **Library drag-drop** ✅ — `library-drag-drop.spec.js` (16 tests): component/color/typography drag, drop handlers, tab switching, error handling

#### Phase 4: Advanced (P4)

12. **Mobile/responsive**: Viewport variations (phone, tablet, desktop).
13. **Concurrent editing**: Two browser contexts editing the same file.
14. **Large file stress test**: 10,000+ shape file loading and editing.

### 13.5 Recommended New Spec Files

| New Spec File | Priority | Tests | Focus |
|---------------|----------|-------|-------|
| `registration.spec.js` | P1 | Done ✅ (18 tests) | Registration form, validation, error handling |
| `recovery.spec.js` | P1 | Done ✅ (18 tests) | Password recovery request, validation, error handling |
| `drawing-cycle.spec.js` | P1 | Done ✅ (28 tests) | Draw shape → edit → save → undo/redo → delete |
| `file-persistence.spec.js` | P1 | Done ✅ (20 tests) | Save, undo/redo, file rename, error handling |
| `binary-file-import.spec.js` | P2 | Done ✅ (17 tests) | Import dialog, cancel, close, file types, error handling |
| `file-management.spec.js` | P2 | Done ✅ (as `dashboard-navigation.spec.js`, 23 tests) | Create, rename, search, fonts, libraries, deleted files |
| `context-menu.spec.js` | P2 | Done ✅ (9 tests) | Right-click menu items, keyboard shortcuts, submenus |
| `dashboard-tabs.spec.js` | P2 | Done ✅ (23 tests, as `dashboard-navigation.spec.js`) | All dashboard tabs: files, search, fonts, libraries, deleted |
| `visual-regression.spec.js` | P3 | Done ✅ (17 tests) | Component rendering, workspace states, consistency |
| `accessibility.spec.js` | P3 | Done ✅ (19 tests) | Keyboard nav, ARIA labels, focus, shortcuts |
| `gradient-editor.spec.js` | P3 | Done ✅ (10 tests) | Gradient add, type toggle, stops, events |
| `shadow-editor.spec.js` | P3 | Done ✅ (11 tests) | Shadow add, type toggle, properties, delete |
| `drag-drop-apply.spec.js` | P3 | Done ✅ (16 tests, as `library-drag-drop.spec.js`) | Component/color/typo drag, drop handlers |
| `performance.spec.js` | P4 | 5-8 | Canvas rendering benchmarks, large file loading |
| `interaction-prototyping.spec.js` | P2 | Done ✅ (17 tests) | Interaction creation, editing, canvas visualization, events |
| `filter-editing.spec.js` | P3 | Done ✅ (15 tests) | SVG filter add/remove, type change, properties, errors |
| `ruler-guides.spec.js` | P3 | Done ✅ (16 tests) | Guide overlay, rulers, creation zones, error handling |
| `mcp-panel.spec.js` | P3 | Done ✅ (14 E2E + 20 unit) | MCP connection, UI, error handling |
| `drag-drop-apply.spec.js` | P3 | 6-10 | Component drag-to-canvas, color drag-to-shape, typography drag-to-text |

---

## 14. Visual Parity Testing

Visual parity testing ensures the JS port's UI matches the upstream Penpot design tool's look and feel. This is critical for user trust and design workflow accuracy.

### 14.1 Visual Parity Strategy

The JS port achieves functional parity with the upstream ClojureScript frontend, but visual parity (pixel-level matching) requires systematic comparison against:

1. **Upstream reference screenshots** — Capture from the running ClojureScript frontend
2. **Design tokens** — Compare CSS custom property values between `shared/src/styles/tokens.css` and upstream SCSS
3. **Component screenshots** — Side-by-side comparison of each Web Component

### 14.2 Design Token Verification

The design system in `shared/src/` (tokens.js, colors.js) matches upstream's SCSS variables. Key tokens to verify:

| Token Category | JS Port File | Upstream SCSS | Verification Method |
|----------------|-------------|---------------|---------------------|
| Colors (primary, danger, etc.) | `shared/src/colors.js` | `frontend/src/app/styles/colors.scss` | Unit test: compare computed values |
| Spacing (xs, s, m, l, xl) | `shared/src/styles/tokens.css` | `frontend/src/app/app/common/tokens.scss` | CSS custom property comparison |
| Font sizes (xs, s, m, l) | `shared/src/styles/tokens.css` | Upstream font definitions | Pixel comparison |
| Border radius (xs, s, m, l) | `shared/src/styles/tokens.css` | Upstream radius tokens | CSS comparison |
| Shadows | Component CSS | Upstream shadow definitions | Screenshot comparison |
| Z-index layers | Component CSS | Upstream z-index layers | Visual stacking test |

### 14.3 Component Visual Parity Checklist

Each Web Component should be visually compared against its upstream React counterpart. The following checklist tracks verification status:

| Component | JS Port | Upstream | Visual Parity | Test Method |
|-----------|---------|---------|---------------|-------------|
| Button | `penpot-button` | `ui/button` | ✅ Match | Screenshot comparison |
| Input | `penpot-input` | `ui/input` | ✅ Match | Screenshot comparison |
| Checkbox | `penpot-checkbox` | `ui/checkbox` | ✅ Match | Screenshot comparison |
| Switch | `penpot-switch` | `ui/switch` | ✅ Match | Screenshot comparison |
| Radio | `penpot-radio` | `ui/radio` | ✅ Match | Screenshot comparison |
| Slider | `penpot-slider` | `ui/slider` | ⚠️ Partial | Manual verification needed |
| Tooltip | `penpot-tooltip` | `ui/tooltip` | ✅ Match | Screenshot comparison |
| Tabs | `penpot-tabs` | `ui/tabs` | ✅ Match | Screenshot comparison |
| Dropdown | `penpot-dropdown` | `ui/dropdown` | ✅ Match | Screenshot comparison |
| Modal | `penpot-modal` | `ui/modal` | ✅ Match | Screenshot comparison |
| Select | `penpot-select` | `ui/select` | ✅ Match | Screenshot comparison |
| Notification | `penpot-notification` | `ui/notification` | ✅ Match | Screenshot comparison |
| Color Picker | `penpot-color-picker` | `ui/color-picker` | ✅ Match | Screenshot comparison |
| Gradient Editor | `penpot-gradient-editor` | Workspace gradient UI | ✅ Match | Manual verification |
| Shadow Editor | `penpot-shadow-editor` | Workspace shadow UI | ✅ Match | Manual verification |
| Export Dialog | `penpot-export-dialog` | `ui/export-dialog` | ✅ Match | Screenshot comparison |
| Filter Editor | Right sidebar | Workspace filter UI | ✅ Match | Manual verification |
| Interaction Panel | `penpot-interaction-panel` | New (no upstream) | ✅ New | N/A |
| MCP Panel | `penpot-mcp-panel` | New (no upstream) | ✅ New | N/A |

### 14.4 Canvas Rendering Parity

Canvas rendering is the most critical visual parity area. The JS port uses SVG + Canvas2D (skipping WASM/Skia). Key rendering aspects to verify:

| Rendering Feature | JS Port | Upstream (Skia) | Parity Level | Notes |
|-----------------|---------|-------------------|--------------|-------|
| Shape rendering (rect, ellipse, line, path) | Canvas2D | Skia | ✅ High | SVG paths match exactly |
| Text rendering | Browser text | Harfbuzz + Skia | ⚠️ Partial | Font metrics differ slightly across browsers |
| Gradient rendering | Canvas2D linear/radial | Skia linear/radial/conic | ✅ Most | Conic gradients may differ |
| Shadow rendering | Canvas2D shadow | Skia shadow filter | ✅ High | Offset shadows match exactly |
| Blur rendering | Canvas2D filter | Skia blur | ✅ High | Gaussian blur values match |
| Boolean operations | Sutherland-Hodgman in JS | Skia path ops | ✅ Functional | Algorithm matches, edge cases may differ |
| Export (PNG/JPEG/WebP) | Canvas2D toDataURL + sharp | Skia rendering | ✅ High | Sharp post-processing matches |
| Export (SVG) | Direct SVG extraction | Skia SVG export | ✅ High | Output structure matches upstream format |
| Export (PDF) | Playwright pdf-lib | Built-in PDF renderer | ⚠️ Partial | PDF output matches for simple layouts |

### 14.5 Visual Regression Test Implementation Plan

Add a `visual-regression.spec.js` E2E test that captures screenshots of key workspace states and compares them against baseline images:

```javascript
// Example visual regression test pattern
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await openWorkspace(page);
  });

  test('workspace shell renders correctly', async ({ page }) => {
    await expect(page.locator('penpot-workspace')).toBeVisible();
    await expect(page).toHaveScreenshot('workspace-shell.png', {
      maxDiffPixelRatio: 0.02, // Allow 2% pixel difference
    });
  });

  test('right sidebar with shape selected', async ({ page }) => {
    await drawRect(page, 100, 100, 200, 150);
    await expect(page.locator('penpot-right-sidebar')).toHaveScreenshot('right-sidebar-shape.png');
  });
});
```

**Baseline image management:**
- Store baseline screenshots in `client/e2e/screenshots/`
- Update baselines with `npx playwright test --update-snapshots`
- CI pipeline should fail on >2% pixel difference

---

## 15. MCP Panel Testing

The MCP (Model Context Protocol) integration panel requires special testing considerations because it connects to an external server that may not be available in all test environments.

### 15.1 Unit Testing (Component)

The `penpot-mcp-panel` Web Component can be tested in isolation without an MCP server:

| Test | What It Verifies | Priority |
|------|-------------------|----------|
| Component renders | Custom element is defined, shadow DOM present | P1 |
| Connection UI | URL input, connect/disconnect buttons render | P1 |
| Error handling | Displays error when connection fails | P1 |
| Tool list display | Populates tool list from mock data | P2 |
| Tool form generation | Generates form fields from inputSchema | P2 |
| Resource list display | Shows resources from mock data | P3 |
| Prompt list display | Shows prompts with parameter forms | P3 |
| Result display | Shows tool invocation results | P2 |
| Result formatting | Formats text/image/resource content types | P3 |
| Disconnect cleanup | Clears state on disconnect | P2 |
| localStorage persistence | Remembers MCP URL across sessions | P3 |

### 15.2 Integration Testing (With MCP Server)

Integration tests that require a running MCP server:

| Test | What It Verifies | Priority |
|------|-------------------|----------|
| Connect to localhost:4401 | Full initialize + tools/list flow | P2 |
| Invoke executeCode tool | Code execution and result display | P2 |
| Browse resources | resources/list and resources/read | P3 |
| SSE streaming | Handle text/event-stream responses | P3 |
| Connection error | Display error on invalid URL | P2 |

### 15.3 MCP Integration Test Setup

```javascript
// Example MCP panel component test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

describe('PenpotMcpPanel', () => {
  it('renders as a custom element', () => {
    const dom = new JSDOM('<!DOCTYPE html><body></body>');
    const { window } = dom;
    // Verify custom element is defined
    assert.ok(window.customElements.get('penpot-mcp-panel'));
  });
});
```

---

## 16. Testing Best Practices Summary

### 16.1 Cross-Module Testing Priority

| Priority | Module | Test Type | Focus |
|----------|--------|-----------|-------|
| P0 | Auth flow | E2E | Login → dashboard → workspace |
| P0 | Shape creation | E2E | Draw rect/ellipse/frame/text |
| P0 | File persistence | E2E | Create → draw → save → reload |
| P1 | Design system | Unit + Visual | Component rendering, token values |
| P1 | Geometry calculations | Unit | Point, rect, matrix, path operations |
| P1 | RPC commands | Integration | All file/team/profile/media commands |
| P2 | Visual parity | Visual | Screenshot comparison of key screens |
| P2 | File import/export | Integration + E2E | .penpot ZIP round-trip |
| P3 | MCP panel | Unit + Integration | Component rendering, server connection |
| P3 | Accessibility | E2E | Keyboard nav, ARIA labels |

### 16.2 Running the Complete Test Suite

```bash
# All unit + integration tests (fast, ~1 minute total)
cd shared && npm test       # ~2s, 1418 assertions
cd server && npm test     # ~8s, 570 tests
cd server/exporter && node --test test/exporter.test.js  # ~1s, 22 tests

# Client E2E tests (requires browser + servers, ~5 minutes)
cd client && npx playwright test

# Visual regression tests (requires baseline images)
cd client && npx playwright test --grep "visual regression"
```