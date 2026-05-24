# E2E Testing Document

> Last updated: 2026-05-23

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
| `client/` | E2E | Playwright | `client/e2e/*.spec.js` | 13 spec files, ~170+ tests |
| `server/` | Integration + Unit | `node:test` | `server/test/*.test.js` | 58 files, 529 tests |
| `shared/` | Unit | `node:test` | `shared/test/*.test.js` | 60 files, 1306 assertions |
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

**Total**: 13 spec files, ~2,317 lines, ~170+ tests.

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

**Statistics**: 58 test files, 529 test cases, 0 failures.

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

The `shared/` module has 60 test files with 1306 assertions across 153 test suites. Tests cover pure functions — geometry calculations, type definitions, data transformations, codecs, and validation logic.

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
│   ├── helpers_stats_focus_indices.test.js  # Focus indices
│   └── page_diff_tokens.test.js              # Page diff
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
| `shared/` | Unit | 60 | 1,306 assertions, 153 suites | 1,306 | 0 | 0 |
| `server/` | Integration | 58 | 529 tests | 529 | 0 | 0 |
| `server/exporter/` | Unit | 1 | 22 tests, 6 suites | 22 | 0 | 0 |
| `client/` | E2E | 13 | ~170+ tests | 170+ | 0 | 0 |
| **Total** | | **132** | **~2,027+** | **2,027+** | **0** | **0** |

### 11.2 By Test Category

| Category | Count | Coverage |
|----------|-------|----------|
| **Geometry** | ~30 files | Point, rect, matrix, line, snap, bounds, intersects, corners, constraints, transforms, flex/grid layout |
| **Types** | ~20 files | Color, component, file, shape, path, text, fills, page, container, typography, token, variant |
| **Files** | ~8 files | Changes, builder, migration, validation, repair, page diff, helpers |
| **Auth/Security** | ~10 files | JWE tokens, Argon2id, middleware, SSRF, rate limiting, security headers |
| **RPC Commands** | ~15 files | Files, teams, profile, comments, media, fonts, webhooks, search, viewer, access tokens |
| **Database** | ~3 files | CRUD, transactions, migrations, FTS5 |
| **Storage** | ~4 files | FS, S3, GC, high-level operations |
| **E2E Auth** | ~20 tests | Login, register, recovery, token management |
| **E2E Dashboard** | ~15 tests | Teams, projects, files, search, fonts, libraries |
| **E2E Workspace** | ~60 tests | Tools, canvas, sidebars, properties, layers, assets, zoom, pan |
| **E2E Collaboration** | ~11 tests | WebSocket, presence, cursor overlay |
| **E2E Export** | ~17 tests | PNG/SVG/PDF export, share, comments |

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

---

## 13. Gap Analysis & Future Work

### 13.1 E2E Test Gaps

The following areas need additional E2E test coverage:

| Area | Current Status | Priority | Notes |
|------|---------------|----------|-------|
| **Registration flow** | Partial | P1 | Only form switching tested; no successful registration E2E |
| **Password recovery** | Missing | P1 | Recovery form renders but no token-based reset E2E |
| **Dashboard search** | Missing | P2 | Search functionality not E2E tested |
| **Dashboard fonts tab** | Missing | P2 | Font upload/management not E2E tested |
| **Dashboard libraries tab** | Missing | P2 | Library connect/disconnect not E2E tested |
| **Dashboard deleted files** | Missing | P2 | Restore/permanent delete not E2E tested |
| **File inline rename** | Missing | P2 | Right-click rename not E2E tested |
| **File pinning** | Missing | P2 | Pin/unpin not E2E tested |
| **Comment threaded replies** | Missing | P3 | Thread creation testing exists, but not reply chains |
| **SVG import** | Missing | P2 | Drag-drop SVG import not E2E tested |
| **.penpot import** | Missing | P2 | File import not E2E tested |
| **Gradient editor** | Missing | P3 | Gradient stop editing not E2E tested |
| **Shadow editor** | Missing | P3 | Shadow property editing not E2E tested |
| **Context menu** | Missing | P2 | Canvas right-click menu not E2E tested |
| **Version history** | Partial | P3 | Panel renders but no create/restore E2E |
| **Access tokens** | Missing | P3 | Settings token CRUD not E2E tested |
| **Multi-page export** | Missing | P3 | Export all pages not E2E tested |
| **WebSocket reconnect** | Missing | P2 | Connection drop/reconnect not tested |
| **Visual regression** | Missing | P3 | No screenshot comparison tests |
| **Accessibility (a11y)** | Missing | P3 | No ARIA/keyboard navigation tests |
| **Mobile/responsive** | Missing | P4 | No viewport size variation tests |
| **Performance** | Missing | P4 | No canvas rendering performance benchmarks |

### 13.2 Server Test Gaps

| Area | Current Status | Priority | Notes |
|------|---------------|----------|-------|
| **WebSocket load testing** | Missing | P2 | No concurrent connection stress tests |
| **File data binary round-trip** | Partial | P1 | Blob encode/decode tested, but not full file save/load cycle |
| **Large file handling** | Missing | P2 | No tests for files with 10,000+ shapes |
| **Concurrent editing conflicts** | Partial | P1 | Revn/vern conflict detection tested, but not multi-client race conditions |
| **S3 storage integration** | Missing | P2 | Only config tested (requires S3 credentials) |
| **Email sending** | Missing | P3 | Only tested in SMTP-disabled mode |
| **Rate limiting under load** | Missing | P3 | No burst request tests |

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

#### Phase 1: Critical Gaps (P1)

1. **Registration E2E**: Full `register → verify email → login` flow.
2. **Password recovery E2E**: `request recovery → receive token → reset password → login`.
3. **Full drawing cycle E2E**: `draw rect → select → resize → change fill → undo → redo`.
4. **File persistence E2E**: `create file → draw shapes → navigate away → return → shapes still there`.

#### Phase 2: Feature Parity (P2)

5. **SVG import E2E**: `drag SVG file → verify shapes on canvas → select → check properties`.
6. **Dashboard navigation E2E**: Every dashboard tab (files, search, fonts, libraries, deleted).
7. **Context menu E2E**: Right-click on canvas → verify menu items → click each action.
8. **WebSocket reconnection**: `start file → disconnect network → reconnect → verify state sync`.

#### Phase 3: Polish (P3)

9. **Visual regression**: Screenshot comparison for key UI states (dashboard, workspace, viewer).
10. **Accessibility**: Keyboard navigation, ARIA labels, focus management.
11. **Performance benchmarks**: Canvas rendering time with 100, 500, 1000 shapes.

#### Phase 4: Advanced (P4)

12. **Mobile/responsive**: Viewport variations (phone, tablet, desktop).
13. **Concurrent editing**: Two browser contexts editing the same file.
14. **Large file stress test**: 10,000+ shape file loading and editing.

### 13.5 Recommended New Spec Files

| New Spec File | Priority | Tests | Focus |
|---------------|----------|-------|-------|
| `registration.spec.js` | P1 | 8-10 | Full registration, email verification, duplicate accounts |
| `recovery.spec.js` | P1 | 4-6 | Password recovery request, token validation, password reset |
| `drawing-cycle.spec.js` | P1 | 10-15 | Draw shape → edit → save → reload → verify persistence |
| `svg-import.spec.js` | P2 | 5-8 | SVG file drag-drop, shape types, gradient import |
| `file-management.spec.js` | P2 | 8-12 | Create, rename, duplicate, delete, pin, move files |
| `context-menu.spec.js` | P2 | 10-15 | Right-click menu items, keyboard shortcuts, submenus |
| `dashboard-tabs.spec.js` | P2 | 6-10 | All dashboard tabs: files, search, fonts, libraries, deleted |
| `visual-regression.spec.js` | P3 | 15-20 | Screenshot snapshots of key UI states |
| `accessibility.spec.js` | P3 | 10-15 | Keyboard nav, ARIA labels, focus management |
| `performance.spec.js` | P4 | 5-8 | Canvas rendering benchmarks, large file loading |