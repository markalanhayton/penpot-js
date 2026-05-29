---
name: design-patterns
description: Apply GoF design patterns and JS architectural best practices when writing or refactoring code in the Penpot JS port. Use when implementing new modules, refactoring existing ones, or reviewing code for architectural improvements. Reference: https://github.com/fbeline/design-patterns-JS
---

# Skill: JS Design Patterns — Penpot JS Port

Architectural patterns and GoF design pattern guidance for the Penpot JS port codebase. Each pattern maps to a concrete area of the codebase with current status and target refactoring.

## When to Use

- Writing new RPC handlers, middleware, or storage backends
- Refactoring existing modules for better separation of concerns
- Reviewing code for architectural improvements
- Adding new storage backends, auth providers, or media processors
- Designing undo/redo or collaboration features in the client

## Full Architecture Guide

See `docs/migration/architecture-guide.md` for detailed code examples and migration steps.

## Pattern Map

### High Priority

| Pattern | Where | Current | Target |
|---------|-------|---------|--------|
| **Strategy + Abstract Factory** | `server/src/storage/` | Inconsistent APIs (`putStorageObject` vs `putS3Object`), dispatch in s3.js `*Any()` | Unified `StorageBackend` interface; `createStorageBackend(config)` factory |
| **Command + Mediator + Memento** | `client/public/lib/collaboration.js`, `ot.js` | Plain `{type, ...}` change objects, manual undo-reapply | `AddObjCommand.execute()/undo()`, `ConflictMediator.resolve()`, `PagesMemento` snapshots |

### Medium Priority

| Pattern | Where | Current | Target |
|---------|-------|---------|--------|
| **Chain of Responsibility** | `server/src/rpc/dispatcher.js` | 170-line monolith `createRpcHandler` | `AuthHandler → BodyParserHandler → RpcExecutorHandler` pipeline |
| **Chain of Responsibility + Decorator** | `server/src/middleware/` | Imperative `fastify.addHook()`, nested `climit(withConditional(permissions(handler)))` | `pipeline([auth(), rateLimit(), permissions(), handler])` |
| **Strategy + Abstract Factory** | `server/src/auth/oidc.js` | Hardcoded `if/else` on provider type for Google/GitHub/GitLab | `OIDCProviderStrategy` with `getAuthUri()`, `exchangeCode()`, `extractUserInfo()` |
| **Decorator** | `client/public/lib/rpc.js` | `cmd()` mixes transport, auth, encoding, retry, timeout | `withRetry(withAuth(withEncoding(transport), getToken), 3)` composable decorators |
| **State + Proxy** | `client/public/lib/ws.js` | Implicit state via module-level booleans (`ws`, `reconnecting`) | `WSDisconnected → WSConnecting → WSConnected` state transitions |

### Already Applied (No Change Needed)

| Pattern | Where |
|---------|-------|
| **Command** | RPC handler registry: `register(name, { auth, handler })` |
| **Factory Method** | Error factories: `errors.notFound()`, `errors.validation()` |
| **Observer** | `store.js` signals, `msgbus.js` pub/sub |
| **Facade** | `db/sqlite.js` pool object with `get`, `insertReturning`, `softDelete` |
| **Template Method** | `media/index.js` `withTempFiles()` RAII cleanup |
| **Singleton** | `config/index.js` frozen config, `db/sqlite.js` module-level `_db` |

## Pattern Details and Code Examples

### Strategy — Storage Backends

**Reference:** `strategy_es6.js` — `ShoppingCart(discount)` with pluggable `guestStrategy`, `regularStrategy`

**Current problem:** `fs.js` and `s3.js` have different function names and signatures. Dispatch functions (`putStorageObjectAny`, `getStorageObjectDataAny`) live inside `s3.js` and check `config.storage.backend`.

**Target pattern:**

```js
// server/src/storage/base.js
export class StorageBackend {
  async put({ id, data, contentType, metadata }) { throw new Error('not implemented'); }
  async get(id) { throw new Error('not implemented'); }
  async getUrl(id) { throw new Error('not implemented'); }
  async delete(id) { throw new Error('not implemented'); }
  async touch(id) { throw new Error('not implemented'); }
}

// server/src/storage/index.js — Abstract Factory
import { FsStorage } from './fs.js';
import { S3Storage } from './s3.js';

export function createStorageBackend(config) {
  if (config.storageBackend === 'fs') return new FsStorage(config);
  if (config.storageBackend === 's3') return new S3Storage(config);
  throw new Error(`Unknown storage backend: ${config.storageBackend}`);
}

// Usage in RPC handlers:
const storage = createStorageBackend(config);
await storage.put({ id, data, contentType, metadata });
```

### Command — OT Change Types

**Reference:** `command_es6.js` — `OnCommand(turbine).execute()`, `OffCommand(turbine).execute()`

**Target pattern:**

```js
// client/public/lib/ot-commands.js
export class AddObjCommand {
  constructor(shape) { this.shape = shape; }
  execute(pages) { pages[shape.pageId].objects[shape.id] = shape; }
  undo(pages)   { delete pages[shape.pageId].objects[shape.id]; }
}

export class ModObjCommand {
  constructor(id, attrs) { this.id = id; this.attrs = attrs; this.prev = null; }
  execute(pages) {
    const obj = findObject(pages, this.id);
    this.prev = { ...obj }; // Memento snapshot
    Object.assign(obj, this.attrs);
  }
  undo(pages) {
    const obj = findObject(pages, this.id);
    Object.assign(obj, this.prev);
  }
}

export class DelObjCommand {
  constructor(id, pageId) { this.id = id; this.pageId = pageId; this.prev = null; }
  execute(pages) {
    this.prev = pages[this.pageId].objects[this.id];
    delete pages[this.pageId].objects[this.id];
  }
  undo(pages) { pages[this.pageId].objects[this.id] = this.prev; }
}
```

### Chain of Responsibility — Middleware Pipeline

**Reference:** `chain-of-resp_es6.js` — `NumberDiscount.setNext(PriceDiscount).setNext(NoneDiscount)`

**Target pattern:**

```js
// server/src/middleware/pipeline.js
export function createPipeline(handlers) {
  return async (req, res) => {
    let ctx = { req, res, profileId: null, params: null };
    for (const handler of handlers) {
      const result = await handler(ctx);
      if (result === 'done') return; // response sent
      ctx = result; // pass modified context
    }
  };
}

// server/src/index.js
const rpcHandler = createPipeline([
  authHandler,        // resolves profileId
  bodyParserHandler,   // parses Transit/JSON/multipart
  rateLimitHandler,    // checks rate limits
  quotaHandler,       // checks storage quotas
  rpcExecutorHandler,  // dispatches to registered method
]);
```

### Decorator — RPC Client

**Reference:** `decorator_es6.js` — `SauceDecorator(pasta)` wrapping `Penne`

**Target pattern:**

```js
// client/public/lib/rpc-decorators.js
const withAuth = (transport, getToken) => async (url, opts) => {
  const token = getToken();
  return transport(url, {
    ...opts,
    headers: { ...opts.headers, Authorization: `Bearer ${token}` },
  });
};

const withRetry = (transport, maxRetries = 3) => async (url, opts) => {
  for (let i = 0; i <= maxRetries; i++) {
    try { return await transport(url, opts); }
    catch (e) { if (i === maxRetries) throw e; await sleep(2 ** i * 100); }
  }
};

const withEncoding = (transport, encode, decode) => async (url, opts) => {
  const encoded = encode(opts.body);
  const res = await transport(url, { ...opts, body: encoded, headers: { ...opts.headers, ...encode.headers } });
  return decode(res);
};

// Compose: withRetry(withAuth(withEncoding(baseFetch, transitEncode, transitDecode), getToken), 3)
```

### State — WebSocket Connection

**Reference:** `state_es6.js` — `WaitingForPayment → Shipping → Delivered`

**Target pattern:**

```js
// client/public/lib/ws-states.js
export class WSState {
  connect(ws) { throw new Error(`Cannot connect in ${this.name}`); }
  send(ws, msg) { throw new Error(`Cannot send in ${this.name}`); }
  disconnect(ws) { /* no-op by default */ }
}

export class WSDisconnected extends WSState {
  get name() { return 'disconnected'; }
  connect(ws) { ws._doConnect(); ws.transitionTo(new WSConnecting()); }
  send(ws, msg) { ws.enqueue(msg); }
}

export class WSConnecting extends WSState {
  get name() { return 'connecting'; }
  send(ws, msg) { ws.enqueue(msg); }
  disconnect(ws) { ws._ws?.close(); ws.transitionTo(new WSDisconnected()); }
  onOpen(ws) { ws.transitionTo(new WSConnected()); ws.flushQueue(); }
}

export class WSConnected extends WSState {
  get name() { return 'connected'; }
  send(ws, msg) { ws._ws.send(JSON.stringify(msg)); }
  disconnect(ws) { ws._ws.close(); ws.transitionTo(new WSDisconnected()); }
}
```

## ESM `'use strict'` Removal

The server uses `"type": "module"` in `package.json`. All `.js` files are ESM and are **always strict mode by specification**. The `'use strict';` directives at the top of 66 server source files are **redundant** and should not be added to new files.

**Rule:** Only add `'use strict';` to CommonJS files (using `require()`/`module.exports`). Never add it to ESM files (using `import`/`export`).

## Reference

- fbeline/design-patterns-JS: https://github.com/fbeline/design-patterns-JS
- Full architecture guide: `docs/migration/architecture-guide.md`
- Server AGENTS.md: `server/AGENTS.md`
- Client lib documentation: `client/public/lib/`