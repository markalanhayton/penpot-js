---
name: run-tests
description: Run all tests across the Penpot JS port modules (shared, server, server/exporter, client E2E) and report results. Includes dev server prerequisites, common pitfalls, and troubleshooting.
---

# Skill: Run All Tests

Run the full test suite across all Penpot JS port modules and report results.

## When to Use

- Before committing significant changes
- When the user asks to "run all tests" or "run e2e testing"
- After making changes to `shared/`, `server/`, `server/exporter/`, or `client/`
- When verifying a bug fix or feature implementation

## Prerequisites

- Node.js 20+
- pnpm installed (workspace uses pnpm)
- Playwright chromium browser installed (`npx playwright install chromium` in `client/`)
- Both dev servers running for E2E tests (backend on port 6060, frontend on port 3449)

## Test Suites

| Suite | Directory | Command | Runner | Typical Time |
|-------|-----------|---------|--------|-------------|
| Shared unit | `shared/` | `npm test` | node:test | ~4s |
| Server integration | `server/` | `npm test` | node:test | ~15s |
| Server exporter unit | `server/exporter/` | `node --test test/exporter.test.js` | node:test | <1s |
| Client E2E | `client/` | `npx playwright test --reporter=list` | Playwright | ~90s |

**Total: ~2,876 tests across all suites.**

## Workflow

### 1. Run shared unit tests first (fastest)

```bash
cd shared && npm test
```

Expected: 176 suites, 1,492 assertions, 0 failures.

### 2. Run server integration tests

```bash
cd server && npm test
```

Expected: 75 files, 872 tests, 287 suites, 0 failures.

### 3. Run server exporter unit tests

```bash
cd server/exporter && node --test test/exporter.test.js
```

Expected: 6 suites, 22 tests, 0 failures.

### 4. Run client E2E tests (slowest — requires servers)

```bash
cd client && npx playwright test --reporter=list
```

Expected: 30 spec files, 490 tests, 0 failures.

The Playwright config (`client/playwright.config.js`) auto-starts both servers:
- Backend: `node ../server/src/index.js` on port 6060
- Frontend: `node server.js` on port 3449

Set `reuseExistingServer: true` means already-running servers are reused.

**Environment variables** the server needs (auto-set in playwright config):
- `PENPOT_INITIAL_ADMIN_EMAIL=admin@penpot.local`
- `PENPOT_INITIAL_ADMIN_PASSWORD=penpot123`

### 5. Report results

Summarize all results in a table:

| Suite | Tests | Pass | Fail | Status |
|-------|-------|------|------|--------|
| shared/ | 1,492 | 1,492 | 0 | PASS/FAIL |
| server/ | 872 | 872 | 0 | PASS/FAIL |
| server/exporter/ | 22 | 22 | 0 | PASS/FAIL |
| client/ (E2E) | 490 | 490 | 0 | PASS/FAIL |
| **Total** | **2,876** | **2,876** | **0** | |

If any suite fails, list the failing test names and error messages.

## Common Pitfalls

### Dev server MIME type bug

The client dev server (`client/server.js`) had a bug where `/shared/constants.js`
(imported via the import map in `index.html`) was missing from the static file
tree, causing the SPA fallback to serve `index.html` with `Content-Type:
text/html`. Browsers reject ES modules with wrong MIME types, preventing the
app from booting.

**Fix applied (2026-05-26):** Two changes in `client/server.js`:
1. Added `/shared/` route that serves files from `../shared/src/` with correct
   MIME types.
2. Changed SPA fallback to return 404 (not `index.html`) for requests with
   known static file extensions (`.js`, `.css`, etc.).

**How to verify:** After starting the dev server, check that
`/shared/constants.js` returns `Content-Type: application/javascript`:

```bash
curl -sI http://localhost:3449/shared/constants.js | grep content-type
# Should print: content-type: application/javascript
```

If it returns `text/html`, the fix is not applied.

### Playwright timeout

E2E tests can exceed the default timeout (2 minutes). Run them with:

```bash
npx playwright test --reporter=list --timeout=60000
```

For debugging, use headed mode:

```bash
npx playwright test --headed --timeout=120000
```

### Port conflicts

If port 6060 or 3449 is already in use, Playwright will reuse the existing
server (`reuseExistingServer: true`). Kill stale processes:

```bash
# Find processes on the ports
lsof -i :6060
lsof -i :3449

# Kill them
kill -9 <PID>
```

### Missing Playwright browsers

First-time setup requires:

```bash
cd client && npx playwright install chromium
```

## Running Individual Suites

```bash
# Single shared test file
cd shared && node --test test/geom/point.test.js

# Single server test file
cd server && node --test test/auth-middleware.test.js

# Single client E2E spec
cd client && npx playwright test e2e/auth.spec.js

# Client E2E with visible browser
cd client && npx playwright test --headed

# Server tests matching a pattern
cd server && node --test test/files*.test.js

# Shared geometry tests only
cd shared && node --test test/geom/**/*.test.js
```

## Key Principles

- **Run shared + server first** — they're fast and catch most regressions.
- **E2E tests need both servers** — Playwright auto-starts them, but verify
  they're healthy if tests fail.
- **Check MIME types** — if the app shows a blank screen, verify
  `/shared/constants.js` returns `application/javascript`.
- **Report all results** — always summarize in a table, even if all pass.
- **0 failures is the baseline** — any failure requires investigation before
  proceeding.