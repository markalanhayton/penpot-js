# Penpot Full Migration Plan: Clojure/ClojureScript → Modern ES JavaScript

**Date**: 2026-05-19
**Status**: Draft
**Constraint**: No third-party frameworks. No TypeScript. No React. Pure Modern ES JS (ES2022+), HTML, CSS, Web Components, Node.js ESM.

---

## 1. Executive Summary

This document outlines a plan to migrate the entire Penpot codebase from Clojure/ClojureScript to **pure Modern ES JavaScript** — no TypeScript, no React, no third-party UI frameworks. The frontend uses Web Components + Custom Elements. The backend uses Node.js ESM (continuing `server`). Shared code is plain ES modules runnable in both browser and Node.js.

| Module | Current Language | Source Files | Lines | Target |
|--------|-----------------|-------------|-------|--------|
| `frontend/` | ClojureScript + SCSS | 939 (654 cljs, 285 scss) | ~133K | ES JS + CSS (Web Components) |
| `backend/` | Clojure | 142 + 158 SQL | ~48K | ES JS (Node.js ESM) |
| `common/` | Cljc + JS + Java | 164 | ~67K | ES JS (dual-env modules) |
| `exporter/` | ClojureScript | 17 | ~4K | ES JS (Node.js ESM) |
| `render-wasm/` | Rust | 83 | N/A | No change |
| **Total** | | **~1,346 non-Rust** | **~252K** | |

**Estimated effort**: 14–20 months with a team of 3–5 senior engineers.

This is **2–3 months shorter** than the TypeScript+React plan because:
- No type system to design/maintain (saves ~10% of effort per module)
- No framework migration learning curve
- No build step for the browser (native ES modules)
- Web Components already started (4 custom elements exist)
- Simpler debug cycle (what you write is what runs)

---

## 2. Architecture Overview (Current)

### Frontend

- **State management**: Potok (custom event-sourcing store)
  - Single atom `app.main.store/state`
  - Events: `UpdateEvent` (sync state transition), `WatchEvent` (async side effects), `EffectEvent` (pure side effects)
  - Dispatch via `st/emit!`; reactive stream via `st/stream`
- **Component framework**: Rumext v2 (React wrapper with macros)
  - `mf/defc` macro for component definition
  - Hooks: `mf/use-state`, `mf/use-effect`, `mf/use-memo`, `mf/use-fn`, `mf/deref`
  - Hiccup templating: `[:div {:class "foo"} "content"]`
  - CSS Modules via `stl/css` and `stl/css-case`
- **Derived state**: ~90 Okulary lenses (`app.main.refs`)
- **High-frequency events**: RxJS behavior subjects (`app.main.streams`) for mouse/keyboard
- **Routing**: reitit (ClojureScript router)
- **RPC**: `cmd!` multimethod dispatches to backend via Transit+JSON
- **WASM bridge**: ~1,400 lines of ClojureScript calling 60+ exported WASM functions
- **Web Workers**: Snap, thumbnails, selection, import
- **Code splitting**: Lazy-loaded modules (auth, viewer, workspace, dashboard, settings)

### Backend

- **System**: Integrant component lifecycle (dependency graph)
- **HTTP**: Yetti (Undertow JVM server)
- **RPC**: `sv/defmethod` macro + `sv/scan-ns` for auto-registration (26 command namespaces)
- **Database**: `next.jdbc` + HikariCP, PostgreSQL (JSONB, LargeObject, cursors, advisory locks)
- **Redis**: Lettuce client for pub/sub message bus, task queue, rate limiting
- **Task queue**: Custom Redis-based dispatcher + cron scheduler
- **WebSocket**: Undertow WebSocket for real-time collaborative editing
- **Storage**: S3 / filesystem / GCS backends
- **Migrations**: SQL files tracked in `migrations` table

### Common (Shared)

- Data types: Shape, File, Page, Color, Component, Token, etc. (45+ type namespaces)
- Geometry: Points, rects, matrices, modifiers, snap calculations (40 files)
- File operations: Changes, builders, migrations, repair
- Schema: Malli validation abstraction
- Platform-specific code via `#?(:clj ... :cljs ...)` reader conditionals
- Performance macros: `dm/select-keys`, `dm/get-in`, `dm/str`, `dm/fmt`

---

## 3. Target Architecture

### 3.1 Core Principles

1. **No frameworks** — The application IS the framework. Buildonly what you need.
2. **No build step for browser** — Native ES modules with `import`/`export`. No bundler required in development.
3. **No compilation** — What you write is what runs. No TypeScript, no JSX, no Babel.
4. **Web Components everywhere** — Custom Elements + light DOM (BEM-style class scoping) for all UI.
5. **Node.js ESM** — Backend uses `.mjs` or `"type": "module"` in package.json.
6. **JSDoc for type hints** — Use `@typedef`, `@param`, `@returns` for editor intellisense. Not enforced at build time.
7. **CSS-in-CSS** — Plain CSS or SCSS (Vite processes it in production builds). No CSS-in-JS.

### 3.2 Technology Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Language** | ES2022+ JavaScript | No compilation step; native browser support; JSDoc for IDE hints |
| **Module system** | ES Modules (`import`/`export`) | Native in browser and Node.js; no bundler needed for dev |
| **UI components** | Web Components (Custom Elements + light DOM) | Browser-native, no framework, BEM-style scoping, already started |
| **Templating** | `<template>` + `cloneNode()` or literal HTML | No JSX; no virtual DOM; direct DOM manipulation |
| **State management** | Custom Potok-like store (hand-built) | Direct port of existing Potok patterns; no library needed |
| **Reactivity** | Custom signal/store + RxJS (already in use as `beicon`) | High-frequency events need streams; Potok events need a store |
| **Styling** | Light DOM `<style>` + BEM class names + CSS custom properties | BEM-scoped per component; custom properties for theming |
| **Routing** | Custom router using `history.pushState` + popstate | ~100 lines; no framework needed for 8 routes |
| **Backend framework** | Fastify (Node.js ESM) | Mature HTTP framework, plugin ecosystem, already in use |
| **Database** | SQLite (`better-sqlite3`) | Fast dev iteration, zero-config, single-file DB; SQLite only per project decision |
| **Redis** | `ioredis` | Only non-trivial dependency; pub/sub + task queue |
| **Transit** | `transit-js` (already in use) | Wire protocol compatibility |
| **Schema validation** | Hand-built validators (JSDoc-typed) | No Zod; validate with functions + throw |
| **Testing** | `node:test` (backend) + Playwright (e2e) | Built-in Node test runner; Playwright already in use |
| **Dev server** | Vite (dev only, no bundling in dev) | HMR, SCSS processing, production bundling |
| **Linting** | ESLint + JSDoc plugin | Standard JS tooling |

### 3.3 Why No Framework Works Here

| Concern | Solution |
|---------|----------|
| **10K shapes on canvas** | Shapes don't use DOM. WASM/Skia renders to a single `<canvas>`. DOM only has the canvas element + overlay UI. React's VDOM diffing was overhead, not help. |
| **Component reuse** | Web Components are natively reusable. `<penpot-color-picker>` works everywhere. No framework needed. |
| **Code splitting** | Dynamic `import()` — native ES module feature. Load workspace only when user opens a file. |
| **Scoped styles** | BEM-style class names (`penpot-xxx__yyy`) provide effective CSS scoping. Light DOM is simpler, more debuggable, and better for plugin compatibility than Shadow DOM. |
| **List rendering** | Shapes aren't a DOM list — they're canvas pixels. UI lists (layers, assets) are small (<500 items). Simple `for` loop + DOM update is fine. |
| **Event handling** | `addEventListener` + Custom Events. Standard DOM event bubbling — no `composed: true` needed since light DOM. |
| **State sharing** | Custom store with `subscribe()` pattern. Components read from store in `connectedCallback()`. |

### 3.4 Project Structure (Target)

```
penpot/
├── common/                      # Shared ES modules (browser + Node.js)
│   ├── src/
│   │   ├── types/               # Shape, File, Page, Color, Component, Token...
│   │   │   ├── shape.js
│   │   │   ├── file.js
│   │   │   ├── page.js
│   │   │   └── ...
│   │   ├── geom/                # Points, rects, matrices, modifiers, snap
│   │   │   ├── point.js
│   │   │   ├── rect.js
│   │   │   ├── matrix.js
│   │   │   └── ...
│   │   ├── files/               # Changes, builders, migrations, repair
│   │   ├── schema/              # Validation functions
│   │   ├── transit/             # Transit encoding/decoding
│   │   ├── uuid.js
│   │   ├── time.js
│   │   ├── exceptions.js
│   │   └── index.js
│   └── package.json             # "type": "module", "exports" map
│
├── server/                      # Node.js API server (continued)
│   ├── src/
│   │   ├── rpc/                 # RPC handlers
│   │   │   ├── auth.js          # Already exists
│   │   │   ├── files.js
│   │   │   ├── teams.js
│   │   │   └── ...
│   │   ├── http/                # HTTP server, middleware, routes
│   │   ├── db/                  # PostgreSQL queries, migrations
│   │   ├── redis/               # Message bus, task queue, rate limiting
│   │   ├── storage/             # S3/FS/GCS backends
│   │   ├── auth/                # Tokens, passwords, sessions
│   │   ├── tasks/               # Background job handlers
│   │   ├── websocket/          # Real-time notifications
│   │   └── index.js
│   └── package.json
│
├── client/                      # SPA design editor (Web Components)
│   ├── src/
│   │   ├── store/               # Potok-like store + RxJS streams
│   │   │   ├── store.js         # Central state atom + dispatch
│   │   │   ├── refs.js          # Derived selectors
│   │   │   └── streams.js       # Mouse/keyboard/wasm subjects
│   │   ├── components/          # Web Components
│   │   │   ├── penpot-app.js            # Root app element
│   │   │   ├── penpot-auth-screen.js    # Already exists (light DOM)
│   │   │   ├── penpot-dashboard.js      # Already exists (light DOM)
│   │   │   ├── penpot-workspace.js      # Already exists (light DOM)
│   │   │   ├── penpot-viewer.js         # Already exists (light DOM)
│   │   │   ├── penpot-color-picker.js
│   │   │   ├── penpot-layer-panel.js
│   │   │   ├── penpot-asset-panel.js
│   │   │   ├── penpot-options-panel.js
│   │   │   └── ...                       # ~149 DS components
│   │   ├── canvas/              # Canvas rendering bridge
│   │   │   ├── wasm-bridge.js   # WASM function bindings
│   │   │   ├── wasm-mem.js      # Shared memory management
│   │   │   ├── serializers.js   # Shape → WASM enum translation
│   │   │   └── viewport.js     # Viewport/scroll/zoom
│   │   ├── rpc/                 # RPC client
│   │   │   └── rpc.js           # Already exists
│   │   ├── workers/             # Web Workers
│   │   │   ├── snap-worker.js
│   │   │   ├── thumbnail-worker.js
│   │   │   ├── selection-worker.js
│   │   │   └── import-worker.js
│   │   ├── router/              # Client-side router
│   │   │   └── router.js        # ~100 lines, history.pushState
│   │   ├── i18n/                # Internationalization
│   │   ├── plugins/             # Plugin runtime API
│   │   └── index.js             # App entry point
│   ├── public/
│   │   └── index.html           # SPA shell
│   ├── styles/                  # Global CSS
│   ├── package.json
│   └── vite.config.js           # Dev server + production bundling
│
├── server/exporter/                 # Headless Playwright export service
│   ├── src/
│   │   ├── http.js
│   │   ├── export-frames.js
│   │   ├── export-shapes.js
│   │   ├── renderer-svg.js
│   │   ├── renderer-pdf.js
│   │   ├── renderer-bitmap.js
│   │   └── browser.js
│   └── package.json
│
├── render-wasm/                 # No change (Rust → WASM)
├── plugins/                     # No change (already JS)
├── mcp/                         # No change (already JS)
├── pnpm-workspace.yaml
└── package.json
```

### 3.5 Dual-Environment Modules (`common/`)

Common modules must run in both browser and Node.js. Strategy:

```javascript
// shared/src/uuid.js — works in both environments
export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Node.js fallback (pre-19)
  return require('crypto').randomUUID();
}

// OR: Use conditional exports in package.json
// "exports": {
//   "browser": "./src/uuid.browser.js",
//   "default": "./src/uuid.node.js"
// }
```

Prefer the **single-file with `typeof` checks** approach for most utilities. Only split files when the Node.js version needs imports that can't exist in the browser (e.g., `net`, `fs`).

---

## 4. Migration Strategy

### 4.1 Approach: Incremental Module-by-Module

Migrate one module at a time, maintaining a **running system** at every step. The Clojure and JS systems coexist during migration, sharing the same database and wire protocol.

### 4.2 Coexistence Strategy

During migration, the old and new systems must coexist:

1. **Wire compatibility**: Both old and new backends speak the same Transit+JSON protocol
2. **Database compatibility**: Both read/write the same PostgreSQL schema
3. **Shared session tokens**: JWE token format must match exactly
4. **Gradual traffic shifting**: Route specific RPC methods to the new backend via proxy

```
                    ┌─────────────────┐
                    │  Frontend (old)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Reverse Proxy  │──── New Backend (Node.js)
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Old Backend (JVM)│
                    └─────────────────┘
```

### 4.3 Phase Order & Dependencies

```
Phase 1: common/ → ES JS (foundation, no dependencies)
    │
    ├── Phase 2a: backend/ → Node.js ESM (depends on Phase 1)
    │
    └── Phase 2b: frontend/ → Web Components (depends on Phase 1, parallel with 2a)
         │
         └── Phase 3: exporter/ → Node.js ESM (depends on Phase 2a)
```

---

## 5. Phase 1: Common Module Migration

**Duration**: 3–4 months | **Engineers**: 2 | **Files**: ~164 | **Lines**: ~67K

### 5.1 Migration Order

| Step | Namespace Group | Files | Complexity | Notes |
|------|----------------|-------|------------|-------|
| 1 | `app.common.uuid`, `app.common.time`, `app.common.exceptions`, `app.common.logging` | ~8 | Low | Pure utility, no dependencies |
| 2 | `app.common.data` (macros → functions) | ~4 | Low | Macros become simple utility functions |
| 3 | `app.common.schema` → validation functions | ~7 | Medium | Replace Malli with hand-built validators |
| 4 | `app.common.types.*` | ~45 | High | Core data types; ~15 complex types with schemas |
| 5 | `app.common.geom.*` | ~40 | High | Complex geometry; must maintain exact numeric results |
| 6 | `app.common.files.*` | ~17 | High | File operations, change tracking, migrations |
| 7 | `app.common.svg`, `app.common.logic`, `app.common.transit`, `app.common.json` | ~12 | Medium | SVG paths, logic, serialization |

### 5.2 Key Design Decisions

#### No TypeScript — How Do We Get Type Safety?

| Technique | What It Gives |
|-----------|---------------|
| **JSDoc `@typedef`** | IDE autocompletion, inline docs, hover info |
| **JSDoc `@param` / `@returns`** | Function signature hints in VS Code |
| **`node --check`** | Syntax validation (catches typos, missing vars) |
| **ESLint + JSDoc plugin** | Enforces JSDoc presence, catches `undefined` references |
| **Runtime validation** | Schema validation functions for data at boundaries (API input, DB output) |
| **`Object.freeze()`** | Prevent accidental mutation of "immutable" data structures |

Example:

```javascript
/**
 * @typedef {Object} Shape
 * @property {string} id - UUID
 * @property {'frame'|'group'|'rect'|'circle'|'path'|'text'|'image'|'svg'|'bool'} type
 * @property {string} name
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} rotation
 * @property {Fill[]} fills
 * @property {Stroke[]} strokes
 * @property {Shadow[]} shadows
 * @property {number} opacity
 */

/**
 * Creates a new shape with default values.
 * @param {Partial<Shape>} overrides
 * @returns {Shape}
 */
export function createShape(overrides = {}) {
  return Object.freeze({
    id: uuid(),
    type: 'rect',
    name: 'Rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    fills: [],
    strokes: [],
    shadows: [],
    opacity: 1,
    ...overrides,
  });
}
```

#### Immutable Data Without Immer

Clojure's immutable data is core to the architecture. Without Immer or Immutable.js:

```javascript
// Strategy 1: Object.freeze() + spread for updates
export function updateShape(shape, props) {
  return Object.freeze({ ...shape, ...props });
}

// Strategy 2: Structured clone for deep updates
export function deepUpdate(obj, path, value) {
  const clone = structuredClone(obj);
  let target = clone;
  for (let i = 0; i < path.length - 1; i++) {
    target = target[path[i]];
  }
  target[path[path.length - 1]] = value;
  return Object.freeze(clone);
}

// Strategy 3: Mutable workers for hot paths
// Geometry calculations can mutate freely — they produce new values, not state changes
export function transformPoint(point, matrix) {
  // Mutation is fine here — point is a local value, not shared state
  const x = matrix.a * point.x + matrix.c * point.y + matrix.e;
  const y = matrix.b * point.x + matrix.d * point.y + matrix.f;
  return { x, y };
}
```

#### Macro Replacements

| Clojure Macro | JS Replacement |
|---------------|----------------|
| `dm/select-keys` | `function pick(obj, keys) { return Object.fromEntries(keys.map(k => [k, obj[k]])); }` |
| `dm/get-in` | `function getIn(obj, path) { return path.reduce((o, k) => o?.[k], obj); }` |
| `dm/str` / `dm/fmt` | Template literals `` `Hello ${name}` `` |
| `dm/export` | Named re-exports `export { foo } from './bar.js'` |
| `dm/get-prop` | Direct property access `obj.prop` (native in JS) |

#### Schema Validation Without Zod

```javascript
// shared/src/schema.js
export function validateShape(shape) {
  const errors = [];
  if (typeof shape.id !== 'string') errors.push('id must be a string');
  if (!SHAPE_TYPES.includes(shape.type)) errors.push(`invalid type: ${shape.type}`);
  if (typeof shape.x !== 'number') errors.push('x must be a number');
  // ... etc
  if (errors.length > 0) {
    throw new ValidationError('Shape validation failed', errors);
  }
  return true;
}

// Or: use a simple schema definition + validator
const shapeSchema = {
  id: 'string',
  type: ['frame', 'group', 'rect', 'circle', 'path', 'text', 'image', 'svg', 'bool'],
  name: 'string',
  x: 'number',
  y: 'number',
  width: 'number',
  height: 'number',
  rotation: 'number',
  fills: { type: 'array', schema: fillSchema },
  strokes: { type: 'array', schema: strokeSchema },
};

export function validate(schema, data, path = '') {
  // ...recursive schema validator, ~200 lines total
}
```

#### Reader Conditionals

Each `.cljc` has `#?(:clj ... :cljs ...)` blocks. Strategy:
- Take the `:cljs` branch as the primary (it's already JS)
- Use `typeof` checks for platform differences
- Only split files when Node.js needs `require('...')` imports

### 5.3 Validation & Testing

- Port existing tests to `node:test`
- Add schema validation tests
- **Geometry snapshot tests**: Output compared against known-good Clojure results
- **Transit round-trip tests**: JS Transit encoding byte-compatible with Clojure Transit

---

## 6. Phase 2a: Backend Migration

**Duration**: 3–4 months | **Engineers**: 2 | **Lines**: ~48K

### 6.1 Current State (`server`)

Already partially ported:
- Node.js `http` server
- SQLite database
- Auth RPC handlers (login, register, recovery)
- Token creation/verification (JWE with `jose`)
- Password hashing (Argon2id)
- Transit encoding/decoding
- RPC dispatcher
- Middleware (Sec-Fetch, client header checks)

### 6.2 Migration Order

| Step | Module | Clojure Source | Complexity | Notes |
|------|--------|---------------|------------|-------|
| 1 | SQLite + migrations | `app.db`, `app.migrations` | Medium | Port SQL migrations; SQLite only per project decision |
| 2 | System lifecycle | `app.main` system config | Low | Simple `init()`/`shutdown()` functions; no Integrant needed |
| 3 | Redis (message bus, task queue, rate limiting) | `app.msgbus`, `app.util.redis`, `app.tasks` | High | ioredis pub/sub, BLPOP task queue |
| 4 | RPC middleware chain | `app.rpc.middleware`, `app.http.middleware` | Medium | Auth, CORS, rate limiting, format negotiation |
| 5 | RPC commands (26 namespaces) | `app.rpc.commands.*` | High | 26 command groups; ~300 individual methods |
| 6 | WebSocket notifications | `app.http.websocket` | Medium | `ws` library for collaborative editing |
| 7 | Storage backends | `app.storage.*` | Medium | S3 (AWS SDK), FS, GCS |
| 8 | Background tasks | `app.tasks.*` | Medium | Cron scheduler, task runners |
| 9 | Email sending | `app.email` | Low | Nodemailer |
| 10 | Audit loggers | `app.loggers.*` | Low | Webhook, Mattermost, database logging |
| 11 | Management API | `app.rpc.management` | Low | Admin endpoints |
| 12 | Binary file import/export | `app.binfile` | Medium | Binary format v1/v2/v3 |

### 6.3 Fastify HTTP Framework

The backend uses [Fastify](https://fastify.dev/) as its HTTP framework. This was chosen over raw `node:http` because:

1. **Plugin ecosystem** — Auth, rate limiting, CORS, multipart, SSE all have Fastify plugins.
2. **Schema validation** — Built-in JSON schema validation for request/response.
3. **Lifecycle hooks** — `onRequest`, `preHandler`, `onSend` for auth, logging, error handling.
4. **Performance** — Fastify is one of the fastest Node.js frameworks.
5. **TypeScript-friendly** — Good JSDoc support for route definitions.

```javascript
// server/src/index.js (simplified)
import Fastify from 'fastify';
import { registerAllCommands } from './rpc/dispatcher.js';

const app = Fastify({ logger: true });

// Register RPC handler
app.register(async (instance) => {
  instance.post('/rpc', async (request, reply) => {
    const result = await handleRequest(request.body, request);
    return result;
  });
});

await app.listen({ port: 6060 });
```

### 6.4 System Lifecycle (No Integrant)

Replace Integrant's dependency graph with explicit initialization order:

```javascript
// server/src/index.js
export async function start(config) {
  const db = await initDatabase(config.database);
  const redis = await initRedis(config.redis);
  const storage = initStorage(config.storage, db);
  const msgbus = initMsgBus(redis);
  const taskQueue = initTaskQueue(redis, msgbus);
  const rpcMethods = registerRpcMethods({ db, redis, storage, msgbus, config });

  const server = createHttpServer({
    rpcMethods,
    db,
    redis,
    config,
  });

  const wsServer = createWebSocketServer({ msgbus, db });

  taskQueue.start();
  server.listen(config.port);

  return {
    async shutdown() {
      server.close();
      wsServer.close();
      await taskQueue.stop();
      redis.disconnect();
      db.pool.end();
    }
  };
}
```

### 6.5 RPC Method Registration (No `sv/defmethod`)

Replace Clojure's `sv/defmethod` + `sv/scan-ns` with explicit registration:

```javascript
// server/src/rpc/methods.js
import * as authMethods from './auth.js';
import * as fileMethods from './files.js';
import * as teamMethods from './teams.js';
// ... etc

const methods = new Map();

function register(name, opts, handler) {
  methods.set(name, { ...opts, handler });
}

// Auto-register all exported functions from a module
function registerModule(mod, prefix) {
  for (const [name, fn] of Object.entries(mod)) {
    if (typeof fn === 'function' && name.endsWith('Handler')) {
      const rpcName = `${prefix}/${name.replace('Handler', '').replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      methods.set(rpcName, fn);
    }
  }
}

registerModule(authMethods, 'auth');
registerModule(fileMethods, 'files');
registerModule(teamMethods, 'teams');

export { methods, register };
```

OR: Each method file exports a descriptor:

```javascript
// server/src/rpc/files.js
export const getFiles = {
  name: 'get-files',
  auth: true,
  validate: (params) => {
    if (!params.projectId) throw new RpcError('missing-project-id');
  },
  handler: async ({ db, profileId, params }) => {
    return db.query('SELECT * FROM file WHERE project_id = $1', [params.projectId]);
  }
};
```

### 6.6 Database: PostgreSQL

```javascript
// server/src/db/index.js
import pg from 'pg';

export function initDatabase(config) {
  const pool = new pg.Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.poolSize || 20,
  });

  return {
    pool,
    async query(sql, params = []) {
      const { rows } = await pool.query(sql, params);
      return rows;
    },
    async getOne(sql, params = []) {
      const { rows } = await pool.query(sql, params);
      return rows[0] || null;
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  };
}
```

---

## 7. Phase 2b: Frontend Migration

**Duration**: 7–11 months | **Engineers**: 3–5 | **Lines**: ~133K

This is the largest phase. The key insight: **shapes don't live in the DOM**. The canvas is a single `<canvas>` element rendered by WASM/Skia. DOM is only for UI chrome (sidebar, toolbar, panels). This makes vanilla JS + Web Components viable — there's no 10K-element list to diff.

### 7.1 Architecture: The Canvas Is NOT DOM

```
┌──────────────────────────────────────────────────────┐
│  <penpot-workspace>  (Web Component)                  │
│  ┌────────────────────────────────┬─────────────────┐│
│  │  <canvas>  (WASM/Skia renders │  Sidebar panels  ││
│  │   all shapes as pixels here)   │  (DOM elements)  ││
│  │                                │                  ││
│  │  ~1 DOM element for 10K shapes │  ~100 elements   ││
│  └────────────────────────────────┴─────────────────┘│
│  ┌──────────────────────────────────────────────────┐│
│  │  Toolbar (DOM elements, ~30 elements)            ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

The workspace has:
- **1 `<canvas>` element** for the actual design rendering
- **~130 DOM elements** for UI chrome (toolbar, sidebar, panels)
- **No shape elements in the DOM** — WASM renders shapes as pixels

This means the "no virtual DOM" concern is moot. There's nothing to diff.

### 7.2 Migration Order

| Step | Module | Files | Complexity | Notes |
|------|--------|-------|------------|-------|
| 1 | SPA shell + router | ~5 | Low | `index.html` + `router.js` (~100 lines) |
| 2 | Store (Potok port) | ~3 | High | Central state atom + event dispatch |
| 3 | Auth screens | ~15 | Low | Already partially done (web components) |
| 4 | RPC client | ~2 | Low | Already done (`rpc.js`, `transit.js`) |
| 5 | Dashboard views | ~30 | Medium | Projects, files, fonts, teams |
| 6 | UI foundations (design system) | ~149 | High | Color picker, dropdown, modal, etc. |
| 7 | Viewer/playback | ~10 | Medium | Read-only file viewing |
| 8 | WASM bridge | ~4 | Very High | 60+ C function bindings; exact serialization |
| 9 | Workspace canvas + tools | ~30 | Very High | Drawing, selection, transform, text |
| 10 | Workspace sidebar | ~20 | High | Layers, assets, options |
| 11 | Text editor | ~15 | Very High | WASM text editor integration |
| 12 | Design tokens | ~30 | High | Token management |
| 13 | Inspect panel | ~15 | Medium | Attribute display |
| 14 | Plugin API | ~10 | Medium | Plugin runtime bridge |
| 15 | Web Workers | ~4 | Medium | Snap, thumbnails, selection, import |
| 16 | i18n | ~3 | Low | String translation system |

### 7.3 State Management: Potok → Pure JS Store

Direct port of Potok's event-sourcing model. No Zustand, no Redux — just functions.

```javascript
// client/src/store/store.js

/**
 * Creates a Potok-like store.
 * @param {Object} initialState
 * @returns {{ getState, dispatch, subscribe, stream }}
 */
export function createStore(initialState) {
  let state = Object.freeze(initialState);
  const subscribers = new Set();
  const eventQueue = [];

  const eventHandlers = new Map();  // event type → handler function

  function getState() {
    return state;
  }

  function dispatch(event, payload) {
    const handler = eventHandlers.get(event);
    if (!handler) return;

    // UpdateEvent: synchronous state transition
    const newState = handler(state, payload);
    if (newState !== state) {
      state = Object.freeze(newState);
      notifySubscribers();
    }

    // Queue WatchEvent side effects
    if (handler.watch) {
      eventQueue.push({ event, payload, type: 'watch' });
    }
  }

  function subscribe(selector, callback) {
    let prevValue = selector(state);
    const subscriber = () => {
      const nextValue = selector(state);
      if (nextValue !== prevValue) {
        prevValue = nextValue;
        callback(nextValue);
      }
    };
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  function notifySubscribers() {
    for (const sub of subscribers) sub();
  }

  function registerEvent(eventType, handler) {
    eventHandlers.set(eventType, handler);
  }

  return { getState, dispatch, subscribe, registerEvent };
}
```

#### Derived State (replaces Okulary lenses)

```javascript
// client/src/store/refs.js
import { store } from './store.js';

export function createRef(selector) {
  let value = selector(store.getState());
  const subscribers = new Set();

  store.subscribe(selector, (newValue) => {
    if (newValue !== value) {
      value = newValue;
      for (const cb of subscribers) cb(value);
    }
  });

  return {
    deref: () => value,
    subscribe: (callback) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    }
  };
}

// Pre-defined refs (mirrors app.main.refs)
export const profileRef = createRef(s => s.profile);
export const fileRef = createRef(s => s.file);
export const selectedIdsRef = createRef(s => s.selectedIds);
export const currentToolRef = createRef(s => s.currentTool);
// ... ~90 more
```

#### High-Frequency Streams (replaces beicon/RxJS)

```javascript
// client/src/store/streams.js

/**
 * Simple BehaviorSubject-like stream.
 * @template T
 * @param {T} initialValue
 * @returns {{ next, subscribe, getValue }}
 */
export function createStream(initialValue) {
  let value = initialValue;
  const subscribers = new Set();

  return {
    next(newValue) {
      value = newValue;
      for (const cb of subscribers) cb(value);
    },
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    getValue() {
      return value;
    }
  };
}

export const mouseStream = createStream({ x: 0, y: 0, buttons: 0 });
export const keyboardStream = createStream(new Set());
export const viewportStream = createStream({ x: 0, y: 0, zoom: 1 });
```

Why no RxJS? The frontend only uses `.subscribe()`, `.map()`, `.filter()`, `.debounce()`, and `.sample()` on streams. All implementable in ~50 lines. RxJS's 200+ operators are unused.

If reactive chains (event A triggers event B which triggers async request C) prove complex, add a minimal `pipe()` utility:

```javascript
export function pipe(stream, ...operators) {
  let output = stream;
  for (const op of operators) {
    output = op(output);
  }
  return output;
}

export function debounce(ms) {
  return (stream) => {
    const result = createStream(stream.getValue());
    let timer;
    stream.subscribe((v) => {
      clearTimeout(timer);
      timer = setTimeout(() => result.next(v), ms);
    });
    return result;
  };
}
```

### 7.4 Web Component Patterns

#### Base Component Class

```javascript
// client/src/components/base.js

/**
 * Base class for Penpot Web Components.
 * Provides store subscription lifecycle and render scheduling.
 */
export class PenpotElement extends HTMLElement {
  #rendered = false;
  #unsubscribers = [];

  connectedCallback() {
    this.#rendered = true;
    this.render();
  }

  disconnectedCallback() {
    this.#rendered = false;
    for (const unsub of this.#unsubscribers) unsub();
    this.#unsubscribers = [];
  }

  /**
   * Subscribe to a store ref. Auto-unsubscribes on disconnect.
   * @param {{ subscribe: (cb: Function) => Function }} ref
   * @param {Function} callback
   */
  watch(ref, callback) {
    const unsub = ref.subscribe(callback);
    this.#unsubscribers.push(unsub);
  }

  /**
   * Schedule a render on next microtask (debounced).
   */
  scheduleRender() {
    if (this.#renderPending) return;
    this.#renderPending = true;
    queueMicrotask(() => {
      this.#renderPending = false;
      if (this.#rendered) this.render();
    });
  }

  render() {
    // Override in subclass
  }
}
```

#### Component Example: Login Form

```javascript
// client/src/components/penpot-login-form.js
import { PenpotElement } from './base.js';
import styles from './penpot-login-form.css' with { type: 'css' };

export class PenpotLoginForm extends PenpotElement {
  #template = `
    <div class="login-form">
      <input type="email" id="email" placeholder="Email">
      <input type="password" id="password" placeholder="Password">
      <div class="error" id="error"></div>
      <button id="submit">Sign In</button>
    </div>
  `;

  constructor() {
    super();
    this.innerHTML = this.#template;
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#submit').addEventListener('click', () => {
      const email = this.querySelector('#email').value;
      const password = this.querySelector('#password').value;
      this.dispatchEvent(new CustomEvent('login-submit', {
        detail: { email, password },
        bubbles: true,
      }));
    });
  }

  set error(msg) {
    const el = this.querySelector('#error');
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  render() {}
}

customElements.define('penpot-login-form', PenpotLoginForm);
```

#### Component Example: Color Picker

```javascript
// client/src/components/penpot-color-picker.js
import { PenpotElement } from './base.js';
import styles from './penpot-color-picker.css' with { type: 'css' };

export class PenpotColorPicker extends PenpotElement {
  static get observedAttributes() {
    return ['value', 'disabled'];
  }

  constructor() {
    super();
    this.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = styles;
    this.prepend(style);
  }

  connectedCallback() {
    super.connectedCallback();
    this.render();
  }

  attributeChangedCallback(name, old, value) {
    if (old === value || !this.isConnected) return;
    this.scheduleRender();
  }

  render() {
    const value = this.getAttribute('value') || '#000000';
    this.innerHTML = `
      <style>${styles}</style>
      <div class="penpot-color-picker__picker">
        <input type="color" value="${value}" id="input">
        <div class="penpot-color-picker__preview" style="background: ${value}"></div>
      </div>
    `;
    this.querySelector('#input').addEventListener('input', (e) => {
      this.dispatchEvent(new CustomEvent('color-change', {
        detail: { value: e.target.value },
        bubbles: true,
      }));
    });
  }
}

customElements.define('penpot-color-picker', PenpotColorPicker);
```

### 7.5 Light DOM Decision: Simpler Than Shadow DOM

The original `client` web components used **light DOM** (no Shadow DOM). After evaluation, the full migration also uses **light DOM** with BEM-style class scoping because:

1. **Simpler debugging** — Light DOM is directly inspectable in DevTools. No shadow boundary to pierce.
2. **Better plugin compatibility** — Plugins can freely query and modify DOM within penpot components without `shadowRoot` access workarounds.
3. **CSS custom properties work natively** — Global theming variables cascade through light DOM without piercing.
4. **BEM-style class scoping** — `penpot-xxx__yyy` class names prevent collisions between components. Each component uses its own BEM namespace.
5. **The innerHTML bug** — Was caused by replacing `switchText.innerHTML` which destroyed an `<a>` element. This is avoided by targeting specific elements with `getElementById()` / `querySelector()` instead of wholesale `innerHTML` replacement.
6. **No `attachShadow` overhead** — Light DOM is faster for components that render many children (canvas, workspace, etc.).

### 7.6 WASM Bridge

The WASM bridge is the most critical component. It must call 60+ C-exported functions with exact parameter types and memory layout.

```javascript
// client/src/canvas/wasm-bridge.js

let wasm = null;
let mem = null;

export async function initWasm(canvas) {
  const module = await import('../../render-wasm/penpot_renderer.js');
  wasm = await module.default({ canvas });
  mem = wasm._get_mem();
}

export function render(timestamp) {
  wasm._render(timestamp);
}

export function pushShape(shape) {
  const idPtr = mem.allocUUID(shape.id);
  wasm._use_shape(idPtr);
  wasm._set_shape_type(toShapeType(shape.type));
  wasm._set_shape_selrect(shape.x, shape.y, shape.width, shape.height);
  wasm._set_shape_rotation(shape.rotation);
  wasm._set_shape_opacity(shape.opacity);

  if (shape.fills.length > 0) pushFills(shape.fills);
  if (shape.strokes.length > 0) pushStrokes(shape.strokes);
  // ... etc for all properties
}

function toShapeType(type) {
  const ENUM = {
    frame: 0, group: 1, rect: 2, circle: 3,
    path: 4, text: 5, image: 6, svg: 7, bool: 8
  };
  return ENUM[type] ?? 0;
}
```

### 7.7 Router

~100 lines, no framework:

```javascript
// client/src/router/router.js

const routes = new Map();
let currentRoute = null;

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

export function navigate(path, replace = false) {
  if (replace) {
    history.replaceState(null, '', path);
  } else {
    history.pushState(null, '', path);
  }
  resolve();
}

function resolve() {
  const url = new URL(window.location.href);
  for (const [pattern, handler] of routes) {
    const match = matchRoute(pattern, url);
    if (match) {
      if (currentRoute === match.route) return;
      currentRoute = match.route;
      handler(match.params, url.searchParams);
      return;
    }
  }
  // 404
  currentRoute = null;
}

function matchRoute(pattern, url) {
  const patternParts = pattern.split('/');
  const urlParts = url.pathname.split('/');
  if (patternParts.length !== urlParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = urlParts[i];
    } else if (patternParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return { route: pattern, params };
}

window.addEventListener('popstate', resolve);
```

### 7.8 Code Splitting

Native `import()` — no framework needed:

```javascript
// client/src/components/penpot-app.js
export class PenpotApp extends HTMLElement {
  async connectedCallback() {
    const route = this.getAttribute('route');
    this.innerHTML = '<div class="loading">Loading...</div>';

    try {
      if (route === 'auth') {
        const { PenpotAuthScreen } = await import('./penpot-auth-screen.js');
        this.replaceChildren(new PenpotAuthScreen());
      } else if (route === 'dashboard') {
        const { PenpotDashboard } = await import('./penpot-dashboard.js');
        this.replaceChildren(new PenpotDashboard());
      } else if (route === 'workspace') {
        const { PenpotWorkspace } = await import('./penpot-workspace.js');
        this.replaceChildren(new PenpotWorkspace());
      } else if (route === 'viewer') {
        const { PenpotViewer } = await import('./penpot-viewer.js');
        this.replaceChildren(new PenpotViewer());
      }
    } catch (err) {
      this.innerHTML = `<div class="error">Failed to load: ${err.message}</div>`;
    }
  }
}

customElements.define('penpot-app', PenpotApp);
```

### 7.9 CSS Strategy

Each Web Component gets a co-located CSS file:

```css
/* client/src/components/penpot-color-picker.css */
penpot-color-picker {
  display: inline-block;
}
.picker {
  display: flex;
  align-items: center;
  gap: var(--penpot-spacing-xs);
}
.preview {
  width: 24px;
  height: 24px;
  border-radius: var(--penpot-radius-sm);
  border: 1px solid var(--penpot-border-color);
}
```

Loaded via `<style>` tags in light DOM:
```javascript
import styles from './penpot-color-picker.css';
// In render(): this.innerHTML = `<style>${styles}</style>...`;
```

Global CSS custom properties provide theming that cascades through light DOM automatically.

### 7.10 Web Workers

```javascript
// client/src/canvas/snap-worker-client.js
let worker = null;

export function initSnapWorker() {
  worker = new Worker(new URL('./snap-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    // Dispatch snap results to store
  };
  return worker;
}

export function requestSnapCalculation(shapes, viewport) {
  if (!worker) initSnapWorker();
  worker.postMessage({ type: 'snap', shapes, viewport });
}
```

### 7.11 i18n

```javascript
// client/src/i18n/index.js
const translations = new Map();
let currentLocale = 'en';

export function setLocale(locale) {
  currentLocale = locale;
}

export function registerTranslations(locale, messages) {
  translations.set(locale, messages);
}

export function t(key, params = {}) {
  const messages = translations.get(currentLocale) ?? {};
  let text = messages[key] ?? key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}
```

---

## 8. Phase 3: Exporter Migration

**Duration**: 1–2 months | **Engineers**: 1 | **Lines**: ~4K

Smallest module. Already a Node.js app — just needs ClojureScript → JS conversion.

### Migration Steps

1. Port HTTP server to Fastify
2. Port Playwright-based rendering handlers
3. Port Redis task queue integration
4. Port SVG/PDF/bitmap export logic
5. Test against same export tasks as ClojureScript version

---

## 9. render-wasm Module

**No migration.** The WASM module is Rust, language-agnostic. Only the JS bridge layer needs updating (Phase 2b, step 8).

---

## 10. JavaScript Design Patterns

This section maps patterns from [patterns.dev](https://www.patterns.dev/#patterns) to specific areas of the Penpot migration. Each pattern is applied where it solves a real problem — not applied dogmatically everywhere.

### 10.1 Observer Pattern — Store & Event System

**Used for**: Central state store (replaces Potok), WebSocket notifications, real-time collaborative editing events.

The Observer pattern is the backbone of the entire frontend state architecture. Potok IS an Observer pattern implementation. We port it directly.

```javascript
// shared/src/observable.js
export class Observable {
  #observers = new Set();

  subscribe(callback) {
    this.#observers.add(callback);
    return () => this.#observers.delete(callback);
  }

  notify(data) {
    for (const observer of this.#observers) {
      observer(data);
    }
  }

  get size() {
    return this.#observers.size;
  }
}
```

**Where it's used**:
| Component | What's Observable | Who Subscribes |
|-----------|-------------------|---------------|
| `store.js` | State changes (snapshots) | Web Components via `watch()` in `connectedCallback()` |
| `streams.js` | Mouse position, keyboard state | Canvas overlay, tool handlers, WASM gesture handlers |
| `websocket.js` | Incoming collaborative edit messages | Store dispatch, cursor rendering |
| `wasm-bridge.js` | Render-complete events | Viewport, selection overlay |

**Why not RxJS**: The frontend only uses `.subscribe()`, `.filter()`, `.debounce()`, and `.sample()`. All implementable as small composable functions on top of Observable. No need for 200+ operators.

```javascript
// composable stream operators
export function filter(observable, predicate) {
  const filtered = new Observable();
  observable.subscribe((data) => {
    if (predicate(data)) filtered.notify(data);
  });
  return filtered;
}

export function debounce(observable, ms) {
  const debounced = new Observable();
  let timer;
  observable.subscribe((data) => {
    clearTimeout(timer);
    timer = setTimeout(() => debounced.notify(data), ms);
  });
  return debounced;
}

export function sample(observable, sampler) {
  const sampled = new Observable();
  sampler.subscribe(() => {
    const value = observable.getValue?.();
    if (value !== undefined) sampled.notify(value);
  });
  return sampled;
}
```

### 10.2 Mediator Pattern — RPC Dispatcher & Component Communication

**Used for**: Backend RPC middleware chain, frontend component cross-communication.

Instead of components talking directly to each other (N:N coupling), they communicate through a mediator.

**Backend middleware chain** — Each middleware function receives the request, does its work, and passes control to the next:

```javascript
// server/src/http/middleware.js
export function composeMiddleware(...middlewares) {
  return async (req, res, finalHandler) => {
    let index = 0;

    async function next() {
      if (index >= middlewares.length) {
        return finalHandler(req, res);
      }
      const middleware = middlewares[index++];
      await middleware(req, res, next);
    }

    await next();
  };
}

// Usage:
const handler = composeMiddleware(
  corsMiddleware,
  authMiddleware,
  rateLimitMiddleware,
  parseBodyMiddleware,
  validateParamsMiddleware,
);

handler(req, res, rpcMethodHandler);
```

**Frontend event bus** — Components that need to communicate across light DOM boundaries without tight coupling:

```javascript
// client/src/store/event-bus.js
const bus = new Observable();

export const eventBus = {
  emit: (type, detail) => bus.notify({ type, detail }),
  on: (type, callback) => {
    const filtered = filter(bus, (e) => e.type === type);
    return filtered.subscribe((e) => callback(e.detail));
  },
};
```

```javascript
// A color picker emits a change
this.dispatchEvent(new CustomEvent('penpot-event', {
  detail: { type: 'color-change', value: '#ff0000' },
  bubbles: true,
  composed: true,
}));

// The sidebar listens without knowing about the color picker
eventBus.on('color-change', (color) => {
  store.dispatch('update-fill', { color });
});
```

### 10.3 Proxy Pattern — Reactive State, Validation, Lazy Loading

**Used for**: Reactive state access (auto-track dependencies), property validation on data objects, lazy WASM module loading.

**Reactive state via Proxy** — When code reads from state, the Proxy records which properties were accessed. This enables precise re-rendering (only components that read changed properties re-render):

```javascript
// shared/src/reactive.js
let currentTracker = null;

export function trackDependencies(fn) {
  const deps = new Set();
  const prevTracker = currentTracker;
  currentTracker = deps;
  try {
    fn();
    return deps;
  } finally {
    currentTracker = prevTracker;
  }
}

export function reactive(obj) {
  return new Proxy(obj, {
    get(target, prop) {
      if (currentTracker) currentTracker.add(prop);
      return Reflect.get(target, prop);
    },
  });
}
```

When a Web Component reads `state.file.name` during render, the Proxy records `file` and `name` as dependencies. On next state change, only components that depend on changed properties get `scheduleRender()` called.

**Validation Proxy** — Runtime type checks at data boundaries (API input, DB output) without compile-time types:

```javascript
// shared/src/validated.js
export function validated(shapeSchema, obj) {
  return new Proxy(obj, {
    set(target, prop, value) {
      const field = shapeSchema[prop];
      if (field && field.type && typeof value !== field.type) {
        throw new TypeError(`Shape.${prop} expected ${field.type}, got ${typeof value}`);
      }
      return Reflect.set(target, prop, value);
    },
  });
}
```

Usage only at boundaries (API responses, DB rows). Not used for internal operations — too slow for hot paths.

**Lazy WASM module** — Proxy defers loading until first access:

```javascript
// client/src/canvas/wasm-lazy.js
let wasmPromise = null;

export const wasm = new Proxy({}, {
  get(target, prop) {
    if (!wasmPromise) {
      wasmPromise = import('./wasm-bridge.js').then(m => m.init());
    }
    return wasmPromise.then(w => w[prop]);
  },
});
```

### 10.4 Factory Pattern — Shape Creation, RPC Response Builders, Component Instantiation

**Used for**: Creating shapes (each type has different defaults), building RPC responses, Web Component instantiation.

**Shape factory** — Each shape type (rect, circle, path, text, frame, etc.) has different default properties and validation:

```javascript
// shared/src/types/shape-factory.js
const shapeFactories = {
  rect: (overrides) => Object.freeze({
    id: uuid(), type: 'rect', name: 'Rectangle',
    x: 0, y: 0, width: 100, height: 100,
    rotation: 0, opacity: 1,
    fills: [], strokes: [], shadows: [],
    rx: 0, ry: 0,
    ...overrides,
  }),

  text: (overrides) => Object.freeze({
    id: uuid(), type: 'text', name: 'Text',
    x: 0, y: 0, width: 100, height: 24,
    rotation: 0, opacity: 1,
    fills: [defaultFill], strokes: [], shadows: [],
    content: { type: 'root', children: [] },
    fontFamily: 'Roboto', fontSize: 14,
    ...overrides,
  }),

  frame: (overrides) => Object.freeze({
    id: uuid(), type: 'frame', name: 'Frame',
    x: 0, y: 0, width: 300, height: 200,
    rotation: 0, opacity: 1,
    fills: [], strokes: [], shadows: [],
    children: [],
    layout: null,
    ...overrides,
  }),
};

export function createShape(type, overrides = {}) {
  const factory = shapeFactories[type];
  if (!factory) throw new Error(`Unknown shape type: ${type}`);
  return factory(overrides);
}
```

**Component factory** — Centralizes Web Component creation with consistent patterns:

```javascript
// client/src/components/factory.js
export function defineElement(name, initializer) {
  const observed = initializer.observedAttributes ?? [];

  class PenpotElement extends HTMLElement {
    #rendered = false;
    #unsubs = [];

    static get observedAttributes() { return observed; }

    constructor() {
      super();
      initializer.construct?.(this);
    }

    connectedCallback() {
      this.#rendered = true;
      initializer.connect?.(this);
    }

    disconnectedCallback() {
      this.#rendered = false;
      for (const unsub of this.#unsubs) unsub();
      this.#unsubs = [];
      initializer.disconnect?.(this);
    }

    attributeChangedCallback(name, old, value) {
      if (old === value || !this.#rendered) return;
      initializer.attributeChanged?.(this, name, old, value);
    }

    watch(ref, callback) {
      this.#unsubs.push(ref.subscribe(callback));
    }

    scheduleRender() {
      if (this._pending) return;
      this._pending = true;
      queueMicrotask(() => {
        this._pending = false;
        if (this.#rendered) initializer.render?.(this);
      });
    }
  }

  customElements.define(name, PenpotElement);
  return PenpotElement;
}
```

```javascript
// Usage — a color picker in ~20 lines
defineElement('penpot-color-picker', {
  observedAttributes: ['value', 'disabled'],
  construct(self) {
    // Light DOM — no attachShadow needed
  },
  connect(self) {
    self.render();
    self.querySelector('#input').addEventListener('input', (e) => {
      self.dispatchEvent(new CustomEvent('change', {
        detail: { value: e.target.value },
        bubbles: true,
      }));
    });
  },
  attributeChanged(self) { self.scheduleRender(); },
  render(self) {
    const value = self.getAttribute('value') || '#000000';
    self.innerHTML = `
      <input type="color" id="input" value="${value}">
      <div class="penpot-color-picker__preview" style="background:${value}"></div>`;
  },
});
```

### 10.5 Flyweight Pattern — Shape Data, Font Objects, Color Definitions

**Used for**: Sharing identical shape properties across thousands of instances. A file with 10,000 shapes often reuses the same fill color, font, or stroke pattern.

**Why it matters**: Without flyweights, 10,000 shapes × 3 fills = 30,000 fill objects. With flyweights, maybe 50 unique fill objects shared across 30,000 references.

```javascript
// shared/src/types/flyweight.js
export class FlyweightPool {
  #pool = new Map();
  #keyFn;

  constructor(keyFn) {
    this.#keyFn = keyFn;
  }

  get(obj) {
    const key = this.#keyFn(obj);
    if (this.#pool.has(key)) return this.#pool.get(key);
    const frozen = Object.freeze(obj);
    this.#pool.set(key, frozen);
    return frozen;
  }

  get size() {
    return this.#pool.size;
  }
}

// Fill flyweight — identical fills share the same object reference
export const fillPool = new FlyweightPool((fill) =>
  `${fill.type}:${fill.color}:${fill.opacity}:${fill.style}`
);

// Common fills are created once, reused everywhere
const blackFill = fillPool.get({ type: 'solid', color: '#000000', opacity: 1 });
const noneFill = fillPool.get({ type: 'none' });
```

**Font flyweight** — A 10,000-shape file might use only 15 fonts:

```javascript
export const fontPool = new FlyweightPool((font) =>
  `${font.family}:${font.style}:${font.weight}:${font.variant}`
);
```

### 10.6 Command Pattern — Undo/Redo, RPC Method Dispatch, Workspace Tool Actions

**Used for**: Undo/redo stack (every user action is a reversible command), RPC method dispatch, workspace tool operations.

**Undo/redo** — This is the classic Command pattern use case. Every user action (move, resize, fill change, etc.) is a command object with `execute()` and `undo()`:

```javascript
// shared/src/commands/move-shape.js
export function createMoveCommand(shapeId, from, to) {
  return {
    type: 'move-shape',
    shapeId,
    from: { ...from },
    to: { ...to },
    execute(state) {
      return updateShapeInState(state, this.shapeId, {
        x: this.to.x, y: this.to.y,
      });
    },
    undo(state) {
      return updateShapeInState(state, this.shapeId, {
        x: this.from.x, y: this.from.y,
      });
    },
  };
}
```

```javascript
// shared/src/commands/undo-stack.js
export function createUndoStack() {
  const undoStack = [];
  const redoStack = [];

  return {
    execute(command, state) {
      const newState = command.execute(state);
      undoStack.push(command);
      redoStack.length = 0;
      return newState;
    },
    undo(state) {
      const command = undoStack.pop();
      if (!command) return state;
      const newState = command.undo(state);
      redoStack.push(command);
      return newState;
    },
    redo(state) {
      const command = redoStack.pop();
      if (!command) return state;
      const newState = command.execute(state);
      undoStack.push(command);
      return newState;
    },
    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },
  };
}
```

**RPC method dispatch** — Each RPC method is a command object:

```javascript
// server/src/rpc/commands/command.js
export function createRpcCommand(definition) {
  return {
    name: definition.name,
    auth: definition.auth ?? false,
    validate: definition.validate ?? null,
    execute: definition.handler,
  };
}

// server/src/rpc/commands/get-file.js
export const getFileCommand = createRpcCommand({
  name: 'get-file',
  auth: true,
  validate(params) {
    if (!params.id) throw new RpcError('missing-id');
  },
  async handler({ db, profileId, params }) {
    const file = await db.getOne(
      'SELECT * FROM file WHERE id = $1 AND deleted_at IS NULL',
      [params.id]
    );
    if (!file) throw new RpcError('file-not-found');
    return { file };
  },
});
```

### 10.7 Prototype Pattern — Web Components, Base Classes

**Used for**: Web Component inheritance chain, shared behavior via prototype chain.

Web Components naturally use the Prototype pattern through JavaScript's class inheritance:

```javascript
// client/src/components/base-element.js
export class PenpotElement extends HTMLElement {
  #rendered = false;
  #unsubs = [];

  connectedCallback() {
    this.#rendered = true;
    this.onConnect?.();
  }

  disconnectedCallback() {
    this.#rendered = false;
    for (const unsub of this.#unsubs) unsub();
    this.#unsubs = [];
    this.onDisconnect?.();
  }

  attributeChangedCallback(name, old, value) {
    if (old === value || !this.#rendered) return;
    this.onAttributeChanged?.(name, old, value);
  }

  watch(ref, callback) {
    const unsub = ref.subscribe(callback);
    this.#unsubs.push(unsub);
    return unsub;
  }

  scheduleRender() {
    if (this._renderPending) return;
    this._renderPending = true;
    queueMicrotask(() => {
      this._renderPending = false;
      if (this.#rendered) this.render?.();
    });
  }
}

// Subclass inherits via prototype chain
export class PenpotPanel extends PenpotElement {
  constructor() {
    super();
    // Light DOM — no attachShadow needed
  }

  onConnect() {
    this.render();
  }

  onAttributeChanged() {
    this.scheduleRender();
  }
}
```

All Penpot panel components (layers, assets, options, etc.) inherit from `PenpotPanel`, which inherits from `PenpotElement`, which inherits from `HTMLElement`. Methods are shared through the prototype chain — no duplication.

### 10.8 Mixin Pattern — Shared Component Behaviors

**Used for**: Adding shared behaviors to Web Components without deep inheritance chains (draggable, collapsible, selectable, droppable).

Web Components don't have hooks. Mixins provide reusable behavior composition without inheritance:

```javascript
// client/src/components/mixins/draggable.js
export function DraggableMixin(Base) {
  return class Draggable extends Base {
    #dragState = null;

    onConnect() {
      super.onConnect?.();
      this.addEventListener('pointerdown', this.#onPointerDown);
    }

    onDisconnect() {
      super.onDisconnect?.();
      this.removeEventListener('pointerdown', this.#onPointerDown);
    }

    #onPointerDown = (e) => {
      this.#dragState = { startX: e.clientX, startY: e.clientY };
      this.setPointerCapture(e.pointerId);
      this.addEventListener('pointermove', this.#onPointerMove);
      this.addEventListener('pointerup', this.#onPointerUp);
      this.dispatchEvent(new CustomEvent('drag-start', { bubbles: true, composed: true }));
    };

    #onPointerMove = (e) => {
      const dx = e.clientX - this.#dragState.startX;
      const dy = e.clientY - this.#dragState.startY;
      this.dispatchEvent(new CustomEvent('drag-move', {
        detail: { dx, dy }, bubbles: true, composed: true,
      }));
    };

    #onPointerUp = () => {
      this.removeEventListener('pointermove', this.#onPointerMove);
      this.removeEventListener('pointerup', this.#onPointerUp);
      this.dispatchEvent(new CustomEvent('drag-end', { bubbles: true, composed: true }));
    };
  };
}

// client/src/components/mixins/collapsible.js
export function CollapsibleMixin(Base) {
  return class Collapsible extends Base {
    static get observedAttributes() {
      return [...(super.observedAttributes ?? []), 'collapsed'];
    }

    get collapsed() {
      return this.hasAttribute('collapsed');
    }

    set collapsed(value) {
      this.toggleAttribute('collapsed', value);
    }

    toggle() {
      this.collapsed = !this.collapsed;
    }
  };
}
```

**Composing multiple mixins**:

```javascript
// A resizable, draggable panel
class MyPanel extends CollapsibleMixin(DraggableMixin(PenpotPanel)) {
  render() {
    // ... has .collapsed, .toggle(), drag events, all from mixins
  }
}
customElements.define('my-panel', MyPanel);
```

### 10.9 Singleton Pattern — Store Instance, WASM Module, WebSocket Connection

**Used for**: Global application store, WASM module instance (only one Skia context), WebSocket connection manager.

**IMPORTANT**: In ES modules, a module-level `let`/`const` with named exports is already a singleton. No class-based singleton needed:

```javascript
// client/src/store/store.js — IS a singleton via ES module
import { Observable } from '../../shared/src/observable.js';

let state = Object.freeze(initialState);
const changeObservable = new Observable();

export function getState() { return state; }

export function dispatch(eventType, payload) {
  const handler = eventHandlers.get(eventType);
  if (!handler) return;
  const newState = handler(state, payload);
  if (newState !== state) {
    state = Object.freeze(newState);
    changeObservable.notify(state);
  }
}

export function subscribe(selector, callback) {
  let prev = selector(state);
  return changeObservable.subscribe((newState) => {
    const next = selector(newState);
    if (next !== prev) {
      prev = next;
      callback(next);
    }
  });
}
```

Any module that `import { getState, dispatch, subscribe } from './store.js'` gets the same state instance. ES modules are singletons by default.

**WASM singleton** — Only one Skia rendering context per page:

```javascript
// client/src/canvas/wasm-module.js
let instance = null;

export async function getWasmModule(canvas) {
  if (!instance) {
    const module = await import('../../render-wasm/penpot_renderer.js');
    instance = await module.default({ canvas });
  }
  return instance;
}
```

### 10.10 Provider Pattern — Dependency Injection via Custom Element Attributes & Context

**Used for**: Passing global state (theme, profile, locale) down to deep component trees without prop drilling.

Web Components don't have React's Context API. The Provider pattern is implemented via:
1. **CSS custom properties** — Theme values cascade through light DOM automatically
2. **DOM event delegation** — Events bubble up through light DOM normally
3. **Custom Element attributes/properties** — Passed declaratively in HTML
4. **Module-level imports** — Singletons imported directly

```javascript
// Theme provider as CSS custom properties (no JS needed!)
:root {
  --penpot-bg-primary: #ffffff;
  --penpot-bg-secondary: #f5f5f5;
  --penpot-text-primary: #1a1a1a;
  --penpot-accent: #7c3aed;
  --penpot-radius-sm: 4px;
  --penpot-radius-md: 8px;
  --penpot-spacing-xs: 4px;
  --penpot-spacing-sm: 8px;
}

[data-theme="dark"] {
  --penpot-bg-primary: #1a1a1a;
  --penpot-bg-secondary: #2d2d2d;
  --penpot-text-primary: #e5e5e5;
}
```

Any Web Component in light DOM automatically inherits these via `var(--penpot-bg-primary)`. No prop drilling, no context, no provider component.

**For non-CSS values** (profile, locale, permissions), use a module-level provider:

```javascript
// client/src/store/context.js
const context = {
  profile: null,
  locale: 'en',
  permissions: new Set(),
};

const contextObservable = new Observable();

export function getContext() { return context; }

export function setContext(updates) {
  Object.assign(context, updates);
  contextObservable.notify(context);
}

export function onContextChange(callback) {
  return contextObservable.subscribe(callback);
}
```

Components read context in `connectedCallback()` and subscribe to changes.

### 10.11 Module Pattern — ES Modules (Built-In)

**Used for**: Everything. ES Modules are the native JavaScript module pattern.

The Module Pattern from the GoF era (IIFE + closures) is replaced by native `import`/`export`. Each file is a module with private scope. Named exports are the public API.

```javascript
// shared/src/geom/matrix.js — private helpers stay private
function multiplyRow(row, matrix) { ... }  // not exported = private

export function multiply(a, b) {            // exported = public
  return [
    multiplyRow(a[0], b), multiplyRow(a[1], b),
    multiplyRow(a[2], b), multiplyRow(a[3], b),
  ];
}

export function identity() {
  return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
}
```

No IIFE needed. No namespace objects needed. `import { multiply, identity } from './matrix.js'` is the Module Pattern.

### 10.12 Islands Architecture — Route-Level Component Loading

**Used for**: Loading only the JS needed for the current view (auth, dashboard, workspace, viewer).

Web Components are naturally island-like — each `<penpot-workspace>` is an isolated chunk of functionality. Combined with dynamic `import()`, each route loads only its island:

```html
<!-- index.html — static shell, zero JS needed for initial paint -->
<style>
  penpot-app { display: block; height: 100vh; }
  .loading { display: flex; align-items: center; justify-content: center; height: 100%; }
</style>
<penpot-app>
  <div class="loading">Loading Penpot...</div>
</penpot-app>
<script type="module" src="/src/index.js"></script>
```

```javascript
// client/src/index.js
import { router } from './router/router.js';
import { store } from './store/store.js';

// Static import: shared infrastructure (small, always needed)
// Dynamic import: route-specific islands (large, loaded on demand)

router.registerRoute('/auth/:page', async (params) => {
  const { PenpotAuthScreen } = await import('./components/penpot-auth-screen.js');
  document.querySelector('penpot-app').replaceChildren(new PenpotAuthScreen());
});

router.registerRoute('/dashboard/:page', async (params) => {
  const { PenpotDashboard } = await import('./components/penpot-dashboard.js');
  document.querySelector('penpot-app').replaceChildren(new PenpotDashboard());
});

router.registerRoute('/workspace', async (params) => {
  const { PenpotWorkspace } = await import('./components/penpot-workspace.js');
  document.querySelector('penpot-app').replaceChildren(new PenpotWorkspace());
});
```

Each route loads its island independently. Auth screen loads instantly (small). Workspace loads heavy (WASM + canvas + tools) but only when needed.

### 10.13 PRPL Pattern — Loading Sequence Optimization

**Used for**: Production deployment — Push critical resources, Render initial route, Pre-cache lazy routes, Lazy-load the rest.

```html
<!-- Push: Critical CSS + app shell inlined -->
<head>
  <link rel="preload" href="/src/store/store.js" as="script" crossorigin>
  <link rel="preload" href="/src/router/router.js" as="script" crossorigin>
  <link rel="preload" href="/shared/src/transit/index.js" as="script" crossorigin>
  <style>/* critical CSS inlined */</style>
</head>
```

```javascript
// Render: Initial route starts immediately
router.resolve(); // renders auth or dashboard based on URL

// Pre-cache: After initial render, prefetch likely next routes
requestIdleCallback(() => {
  if (currentRoute === 'auth') {
    import('./components/penpot-dashboard.js');  // prefetch dashboard
  }
  if (currentRoute === 'dashboard') {
    import('./components/penpot-workspace.js');  // prefetch workspace
  }
});
```

In production with Vite, this becomes optimized rollup chunks:
- `vendor.js` — transit, common (preloaded)
- `store.js` — state management (preloaded)
- `auth.js` — auth island (loaded on `/auth/*`)
- `dashboard.js` — dashboard island (loaded on `/dashboard/*`)
- `workspace.js` — workspace island (loaded on `/workspace`)
- `wasm-bridge.js` — WASM glue (loaded with workspace)

### 10.14 Dynamic Import — Code Splitting

**Used for**: Loading heavy modules only when needed (WASM, workspace tools, design tokens, plugins).

```javascript
// Import on interaction — WASM loads only when user opens a file
document.querySelector('penpot-app').addEventListener('workspace-open', async () => {
  const { initWasm } = await import('./canvas/wasm-bridge.js');
  await initWasm(canvas);
});

// Import on visibility — token panel loads when sidebar tab is clicked
tabElement.addEventListener('click', async () => {
  const { PenpotTokenPanel } = await import('./components/penpot-token-panel.js');
  sidebar.replaceChildren(new PenpotTokenPanel());
});

// Import on route — heavy workspace loads only on /workspace route
if (url.pathname === '/workspace') {
  const { PenpotWorkspace } = await import('./components/penpot-workspace.js');
  app.replaceChildren(new PenpotWorkspace());
}
```

### 10.15 List Virtualization — Layer Panel, Asset Panel

**Used for**: Rendering only visible items in the layer panel (hundreds of layers) and asset panel (thousands of components).

No React virtual list library needed — implement a simple virtual scroller:

```javascript
// client/src/components/penpot-virtual-list.js
export class PenpotVirtualList extends PenpotElement {
  #itemHeight = 32;
  #items = [];
  #visibleStart = 0;
  #visibleEnd = 0;
  #renderFn = null;

  onConnect() {
    this.addEventListener('scroll', this.#onScroll, { passive: true });
    this.#updateVisibleRange();
    this.render();
  }

  setItems(items) {
    this.#items = items;
    this.#updateVisibleRange();
    this.render();
  }

  setRenderFn(fn) {
    this.#renderFn = fn;
  }

  #onScroll = () => {
    this.#updateVisibleRange();
    this.scheduleRender();
  };

  #updateVisibleRange() {
    const scrollTop = this.scrollTop;
    const viewHeight = this.clientHeight;
    this.#visibleStart = Math.floor(scrollTop / this.#itemHeight);
    this.#visibleEnd = Math.min(
      this.#visibleStart + Math.ceil(viewHeight / this.#itemHeight) + 2,
      this.#items.length
    );
  }

  render() {
    if (!this.#renderFn) return;
    const frag = document.createDocumentFragment();
    for (let i = this.#visibleStart; i < this.#visibleEnd; i++) {
      const el = this.#renderFn(this.#items[i], i);
      el.style.transform = `translateY(${i * this.#itemHeight}px)`;
      frag.appendChild(el);
    }
    this.querySelector('.viewport').replaceChildren(frag);
  }
}
```

### 10.16 Pattern Application Summary

| Pattern | Where Applied | Replaces |
|---------|---------------|----------|
| **Observer** | Store, streams, WebSocket, WASM events | Potok + beicon/RxJS |
| **Mediator** | RPC middleware chain, event bus, component communication | Integrant middleware, React context |
| **Proxy** | Reactive state tracking, validation at boundaries, lazy WASM loading | Clojure's `atom` watchers, Malli validation |
| **Factory** | Shape creation, RPC command objects, Web Component definitions | Clojure record types, `sv/defmethod` |
| **Flyweight** | Fill/stroke/font pools shared across 10K+ shapes | Clojure's persistent data structure sharing |
| **Command** | Undo/redo stack, RPC dispatch, workspace tool actions | Potok events (already command-like) |
| **Prototype** | Web Component class hierarchy (`PenpotElement` → `PenpotPanel` → specific panels) | Rumext component inheritance |
| **Mixin** | Draggable, collapsible, selectable behaviors on components | React HOCs / hooks |
| **Singleton** | Store module, WASM module, WebSocket connection | ES modules (natively singleton) |
| **Provider** | CSS custom properties (theme), module-level context (profile, locale) | React Context API |
| **Module** | All files — native `import`/`export` | Clojure namespaces, `require` |
| **Islands** | Route-level lazy component loading | shadow-cljs code splitting |
| **PRPL** | Production deploy: preload critical, prefetch likely, lazy-load rest | shadow-cljs `:shared` module |
| **Dynamic Import** | WASM, workspace tools, design tokens, plugins | shadow-cljs `:main-workspace` target |
| **List Virtualization** | Layer panel, asset panel, search results | React virtualized lists |

---

## 11. Build & Dev Tooling

### 11.1 Development: No Build Step

In development, the browser loads ES modules directly:

```html
<!-- client/public/index.html -->
<script type="module" src="/src/index.js"></script>
```

Vite serves files as-is with HMR injection. No bundling, no compilation.

### 11.2 Production: Vite Bundling

```javascript
// client/vite.config.js
export default {
  root: 'public',
  build: {
    outDir: '../dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'common': ['../shared/src/index.js'],
          'transit': ['transit-js'],
        }
      }
    }
  },
  css: {
    modules: false  // Using BEM-style class scoping in light DOM, not CSS Modules
  }
};
```

### 11.3 Linting & Code Quality

```javascript
// eslint.config.js
export default [
  {
    files: ['**/*.js'],
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
    }
  }
];
```

### 11.4 No TypeScript — JSDoc Instead

JSDoc provides ~80% of TypeScript's benefits without compilation:

- **VS Code**: Full IntelliSense, autocomplete, go-to-definition, refactoring
- **JSDoc types**: `@typedef`, `@param`, `@returns`, `@template`, `@enum`
- **Runtime**: No build step; `node --check` for syntax; `node:test` for behavior
- **Enforcement**: ESLint JSDoc plugin ensures annotations exist

```javascript
/**
 * @template T
 * @typedef {(state: Object, payload: T) => Object} UpdateEvent
 */

/**
 * @typedef {Object} RpcConfig
 * @property {boolean} auth
 * @property {(params: Object) => void} [validate]
 * @property {(ctx: RpcContext) => Promise<Object>} handler
 */
```

---

## 12. Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **No compile-time type checking** | Runtime type errors in production | JSDoc + ESLint for development; runtime validation at data boundaries (API input, DB output); comprehensive test coverage |
| **WASM bridge serialization** | Rendering broken | Byte-level protocol tests; render comparison screenshots |
| **Geometry numeric precision** | Shapes render incorrectly | Snapshot-test against Clojure reference output |
| **Light DOM accessibility** | Screen readers work with light DOM | Ensure ARIA attributes are set correctly; test with screen readers |
| **Transit encoding compatibility** | Backend communication breaks | Wire compatibility tests |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Light DOM + plugins** | Plugin compatibility — easy with light DOM | Plugins access elements normally via `querySelector`; no shadow boundary |
| **Custom store race conditions** | State inconsistency | Port Potok patterns exactly; test concurrent dispatches |
| **No virtual DOM for UI lists** | Slow layer panel updates | Layer panels are small (<500 items); use `requestAnimationFrame` batching |
| **CSS scoping learning curve** | Misunderstanding BEM-style selectors | Document naming convention; use tag-name selectors and BEM-style `penpot-xxx__yyy` classes |
| **Hiring for vanilla JS** | Harder to find engineers | Modern JS is widely known; Web Components are standard; training materials exist |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **No bundler in dev** | Module load waterfall | HTTP/2 + preload headers; Vite transforms on the fly |
| **SCSS compilation** | Need a processor | Vite handles SCSS natively; no change needed |
| **i18n replacement** | Missing translations | Audit all `tr` calls; simple `t(key, params)` function |

---

## 13. Testing Strategy

### Unit Tests
- **`node:test`** for backend and common modules (built-in, zero dependencies)
- **Playwright `test()`** for frontend component tests
- Geometry function snapshot tests

### Integration Tests
- Backend RPC handler tests against real SQLite
- Transit round-trip tests (encode in JS → decode in Clojure and vice versa)
- Two-backend shadow traffic

### E2E Tests
- **Playwright** (already in use)
- Visual regression with screenshot comparison
- Test every screen: auth, dashboard, workspace, viewer, settings

### Performance Tests
- Benchmark state updates with 10K+ shapes
- Benchmark WASM bridge throughput
- Compare production bundle size before/after
- First contentful paint comparison

---

## 14. Timeline

### Optimistic (3 senior engineers, full-time)

```
Month 1-4:   Phase 1 — Common module (ES JS)
Month 2-5:   Phase 2a — Backend (parallel, starts month 2)
Month 3-13:  Phase 2b — Frontend (parallel, starts month 3)
Month 13-14: Phase 3 — Exporter
Month 14-16: Integration, QA, performance optimization
                                  Total: ~16 months
```

### Conservative (2-3 engineers, part-time)

```
Month 1-5:   Phase 1 — Common module
Month 3-7:   Phase 2a — Backend
Month 4-15:  Phase 2b — Frontend
Month 15-16: Phase 3 — Exporter
Month 16-20: Integration, QA, performance optimization
                                  Total: ~20 months
```

**2–3 months shorter** than the TypeScript+React plan because:
- No type system design/maintenance (~10% savings per module)
- No framework learning curve
- No build configuration for the browser
- Simpler debug cycle (no compilation artifacts)
- Already have 4 working Web Components

---

## 15. Milestones & Deliverables

| Milestone | Deliverable | Acceptance Criteria |
|-----------|------------|---------------------|
| M1 | Common ES JS package | All types, geometry, file ops ported; validators; Transit compat; tests pass |
| M2 | Backend auth + core RPC | Login, register, file CRUD, teams working against PostgreSQL |
| M3 | Backend complete | All 26 RPC command groups; Redis; WebSocket; tasks; migrations |
| M4 | Frontend auth + dashboard | Login, register, projects, files views working |
| M5 | Frontend workspace (basic) | Canvas renders via WASM; selection; move; resize; text editing |
| M6 | Frontend workspace (advanced) | Components; tokens; Boolean ops; grid layout; plugins |
| M7 | Frontend complete | All views; all features; WASM bridge; workers; code splitting |
| M8 | Exporter complete | SVG, PDF, bitmap export working |
| M9 | Full system integration | Old backend disabled; all features working; performance acceptable |
| M10 | Production ready | Full test suite passing; performance benchmarks met; security audit done |

---

## 16. Team Requirements

| Role | Count | Skills |
|------|-------|--------|
| Senior JS Engineer | 2-3 | Modern ES JS, Web Components, DOM APIs, Canvas, Web Workers |
| Senior Backend Engineer | 1-2 | PostgreSQL, Redis, Node.js, WebSocket, task queues |
| Clojure→JS Bridge Engineer | 1 | Reads Clojure fluently, writes idiomatic JS |
| QA Engineer | 1 | Playwright, visual regression, performance testing |

**Minimum viable team**: 3 engineers (2 JS + 1 Clojure-bridge)

---

## 17. Comparison: TypeScript+React vs Vanilla JS+Web Components

| Factor | TypeScript + React | Vanilla JS + Web Components |
|--------|-------------------|-----------------------------|
| **Migration effort** | ~18-23 months | ~14-20 months |
| **Type safety** | High (compile-time) | Medium (JSDoc + runtime validation) |
| **Bundle size** | +40KB React runtime | Minimal |
| **Build step** | TS compile + JSX transform + bundler | SCSS processing only (Vite) |
| **Dev cycle speed** | Slower (compile step) | Faster (no compilation) |
| **Debugging** | Harder (React DevTools, source maps) | Easier (direct DOM, no abstractions) |
| **Component ecosystem** | Huge | Build everything (149 components) |
| **WASM lifecycle** | Easy (hooks) | Manual (callbacks — already solved with `#rendered` guard) |
| **State management** | Zustand + RxJS (2 libs) | Custom store (0 libs, direct Potok port) |
| **Canvas rendering** | React overhead (unneeded for `<canvas>`) | Direct, no overhead |
| **Hiring** | Easy (React ubiquitous) | Medium (Web Components less known, but JS is universal) |
| **Long-term maintenance** | Framework churn risk | Browser APIs are stable |
| **Plugin compatibility** | Easy | Light DOM — plugins access elements directly |
| **Code splitting** | React.lazy + Suspense | Native dynamic import() |
| **Style scoping** | CSS Modules (tooling) | BEM-style class names (browser-native) |

---

## 18. Quick-Start: What To Do Today

1. **Initialize `shared/src/`** with ES JS modules + `package.json` (`"type": "module"`)
2. **Port `app.common.uuid`** → `shared/src/uuid.js` (~15 min)
3. **Port `app.common.exceptions`** → `shared/src/exceptions.js` (~15 min)
4. **Port `app.common.time`** → `shared/src/time.js` (~30 min)
5. **Port `app.common.data.macros`** → `shared/src/data.js` (~30 min)
6. **Write first Transit compatibility test** (encode in JS, decode in Clojure)
7. **Set up ESLint + JSDoc plugin** for the new `common/` package
8. Light DOM confirmed for all Web Components — BEM-style class scoping (`penpot-xxx__yyy`) avoids Shadow DOM complexity