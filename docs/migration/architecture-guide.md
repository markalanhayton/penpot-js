# Architecture Guide — Penpot JS Port

> Design patterns, SQLite extensions, and architectural standards for the JS port.

## 1. GoF Design Patterns — Current Usage and Targets

Each pattern maps to a concrete area of the codebase. Patterns already in use are noted; patterns to introduce include specific files and the refactoring approach.

### High Priority

#### Strategy + Abstract Factory — Storage Backends

**Where:** `server/src/storage/fs.js`, `server/src/storage/s3.js`

**Current problem:** Two modules with inconsistent APIs (`putStorageObject` vs `putS3Object`). Dispatch logic (`*Any()` functions) lives inside `s3.js`, coupling backend selection to the S3 module. Adding a new backend (Azure Blob, etc.) requires modifying `s3.js`.

**Target:**

```js
// server/src/storage/index.js — Abstract Factory + Strategy
export function createStorageBackend(config) {
  if (config.storageBackend === 'fs') return new FsStorage(config);
  if (config.storageBackend === 's3') return new S3Storage(config);
  throw new Error(`Unknown storage backend: ${config.storageBackend}`);
}

class StorageBackend {
  async put({ id, data, contentType, metadata }) { throw new Error('not implemented'); }
  async get(id) { throw new Error('not implemented'); }
  async getUrl(id) { throw new Error('not implemented'); }
  async delete(id) { throw new Error('not implemented'); }
  async touch(id) { throw new Error('not implemented'); }
}

class FsStorage extends StorageBackend { /* delegates to current fs.js logic */ }
class S3Storage extends StorageBackend { /* delegates to current s3.js logic */ }
```

**Reference:** fbeline/design-patterns-JS — `strategy_es6.js` (function-based strategies), `abstract-factory_es6.js` (factory selection by kind).

---

#### Command + Mediator + Memento — Collaboration/OT

**Where:** `client/public/lib/collaboration.js`, `client/public/lib/ot.js`

**Current problem:** Changes (`add-obj`, `mod-obj`, `del-obj`) are plain `{type, ...}` objects processed by `switch` statements. The undo-reapply cycle in `applyWithUndoReapply()` manually tracks state without formal snapshots.

**Target:**

```js
// Command pattern — each change type implements execute() and undo()
class AddObjCommand {
  constructor(shape) { this.shape = shape; }
  execute(pages) { /* add shape */ }
  undo(pages)   { /* remove shape */ }
}

class ModObjCommand {
  constructor(id, attrs) { this.id = id; this.attrs = attrs; this.prev = null; }
  execute(pages) { this.prev = /* snapshot current */; /* apply attrs */ }
  undo(pages)   { /* restore this.prev */ }
}

// Mediator — resolves conflicts between local and remote changes
class ConflictMediator {
  resolve(localCmd, remoteCmd) { /* Strategy for same-key conflicts */ }
}

// Memento — enables clean state snapshots before applying remote changes
class PagesMemento {
  constructor(pages) { this.snapshot = structuredClone(pages); }
  restore() { return structuredClone(this.snapshot); }
}
```

**Reference:** fbeline/design-patterns-JS — `command_es6.js` (Command with execute), `mediator_es6.js` (Mediator coordinates colleagues), `memento_es6.js` (Caretaker + Originator).

---

### Medium Priority

#### Chain of Responsibility — RPC Dispatcher Middleware

**Where:** `server/src/rpc/dispatcher.js` (`createRpcHandler` ~170 lines)

**Current problem:** `createRpcHandler` mixes auth resolution, content-type detection, body parsing, parameter normalization, and response encoding in one monolithic function.

**Target:**

```js
// Each handler in the chain can process the request or pass to the next
class AuthHandler {
  handle(ctx, next) {
    const profile = extractAuth(ctx.req);
    if (!profile && method.auth) throw new RpcError('authorization', 'access-denied', '...');
    ctx.profileId = profile?.id;
    return next(ctx);
  }
}

class BodyParserHandler {
  handle(ctx, next) {
    ctx.params = parseBody(ctx.req); // Transit, JSON, multipart, or GET query
    return next(ctx);
  }
}

class RpcExecutorHandler {
  handle(ctx, next) {
    return ctx.method.handler(ctx.params, ctx);
  }
}

// Usage: createRpcHandler([authHandler, bodyParserHandler, rpcExecutorHandler])
```

**Reference:** fbeline/design-patterns-JS — `chain-of-resp_es6.js` (setNext chain with exec pass-through).

---

#### Strategy — OIDC Providers

**Where:** `server/src/auth/oidc.js`

**Current problem:** Provider-specific logic (Google, GitHub, GitLab) lives in `if/else` blocks within `resolveProvider()` and `getUserInfo()`. Adding a new OIDC provider requires modifying these functions.

**Target:**

```js
class OIDCProviderStrategy {
  constructor({ name, authUri, tokenUri, userInfoUri, scope, clientId, clientSecret }) { ... }
  getAuthUri(state, redirectUri) { /* ... */ }
  exchangeCode(code, redirectUri) { /* ... */ }
  extractUserInfo(rawInfo) { /* ... */ }
}

// Built-in providers are pre-configured Strategy instances
// Custom SSO providers loaded from DB also implement the same interface
```

**Reference:** fbeline/design-patterns-JS — `strategy_es6.js` (ShoppingCart with pluggable discount).

---

#### State + Proxy — WebSocket Connection

**Where:** `client/public/lib/ws.js`

**Current problem:** Connection lifecycle (disconnected, connecting, connected) is managed by module-level variables and `if` checks. Race conditions between `connectWS`/`disconnectWS`/`scheduleReconnect`.

**Target:**

```js
class WSDisconnected {
  connect(ws) { ws.transitionTo(new WSConnecting()); }
  send(ws, msg) { ws.enqueue(msg); } // queue while disconnected
  disconnect(ws) { /* no-op */ }
}
class WSConnecting {
  connect(ws) { /* no-op, already connecting */ }
  send(ws, msg) { ws.enqueue(msg); }
  disconnect(ws) { ws.transitionTo(new WSDisconnected()); }
}
class WSConnected {
  send(ws, msg) { ws._ws.send(JSON.stringify(msg)); }
  disconnect(ws) { ws._ws.close(); ws.transitionTo(new WSDisconnected()); }
}
```

**Reference:** fbeline/design-patterns-JS — `state_es6.js` (OrderStatus with next() transitions).

---

#### Decorator — RPC Client Cross-Cutting Concerns

**Where:** `client/public/lib/rpc.js`

**Current problem:** `cmd()` mixes transport, auth, encoding, retry, and timeout in one function.

**Target:** Composable decorators wrapping a base fetch call:

```js
// Base transport
const baseTransport = (url, opts) => fetch(url, opts);

// Decorators
const withAuth = (transport, getToken) => async (url, opts) => {
  const token = getToken();
  return transport(url, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}` } });
};
const withRetry = (transport, maxRetries) => async (url, opts) => {
  for (let i = 0; i <= maxRetries; i++) { try { return await transport(url, opts); } catch (e) { if (i === maxRetries) throw e; await sleep(2 ** i * 100); } }
};
const withEncoding = (transport, encode, decode) => async (url, opts) => {
  const encoded = encode(opts.body);
  const res = await transport(url, { ...opts, body: encoded, headers: { ...opts.headers, ...encode.headers } });
  return decode(res);
};

// Compose: withRetry(withAuth(withEncoding(baseTransport, transitEncode, transitDecode), getToken), 3)
```

**Reference:** fbeline/design-patterns-JS — `decorator_es6.js` (SauceDecorator, CheeseDecorator wrapping Pasta).

---

### Already Well-Applied (No Change Needed)

| Pattern | Where | How It's Used |
|---|---|---|
| **Command** | RPC dispatcher | `register(name, { auth, handler })` — each method is a command object |
| **Factory Method** | RPC dispatcher errors | `errors.notFound()`, `errors.validation()` — structured error factories |
| **Observer** | `store.js` signals, `msgbus.js` pub/sub | Event-driven state management |
| **Facade** | `db/sqlite.js` pool object | Hides raw SQL behind `get`, `insertReturning`, `softDelete` helpers |
| **Template Method** | `media/index.js` `withTempFiles()` | RAII-style cleanup with `try/finally` |
| **Singleton** | `config/index.js`, `db/sqlite.js` | Module-level singletons (appropriate for single-process Node.js) |

---

## 2. sqlean SQLite Extensions

### How to Load

```js
import Database from 'better-sqlite3';

const db = new Database('penpot.sqlite');
db.pragma('journal_mode = WAL');

// Enable extension loading (must be called before loadExtension)
db.pragma('enable_load_extension = 1');

// Load individual extensions
db.loadExtension('./node_modules/sqlean-uuid/uuid');
db.loadExtension('./node_modules/sqlean-crypto/crypto');
db.loadExtension('./node_modules/sqlean-time/time');

// Or load the full bundle
db.loadExtension('./node_modules/sqlean/sqlean');
```

### Extension Usage Map

| Extension | Current Code | sqlean Replacement | Migration Steps |
|---|---|---|---|
| **sqlean-uuid** | `import { v4 as uuidv4 } from 'uuid'` (60+ uses), `crypto.randomUUID()` (12 uses) | `uuid4()`, `uuid7()` in SQL | 1. Add `uuid` column DEFAULT `uuid7()` to migration. 2. Keep JS-side `uuidv4` as fallback for IDs generated before DB insertion. 3. Use `uuid7_timestamp_ms(uuid_col)` to extract sortable timestamps for range queries. |
| **sqlean-crypto** | `crypto.createHash('sha256').update(data).digest('hex')` in `storage/fs.js`, `storage/s3.js`, `media/index.js` | `crypto_sha256()`, `crypto_encode()` in SQL | 1. Replace JS-side `calculateHash()` with SQL expression in `putStorageObject()`: `SET hash = crypto_encode(crypto_sha256(data), 'hex')`. 2. Enables dedup queries purely in SQL. |
| **sqlean-time** | `new Date().toISOString()` in 100+ places, always passed to SQL | `time_now()`, `time_format()` as SQL DEFAULT values | 1. Add `DEFAULT time_now()` to `created_at`, `modified_at` columns in new tables. 2. Replace JS-side `const now = new Date().toISOString(); pool.run('INSERT ...', [now, ...])` with `pool.run('INSERT ...', [...])` where SQL fills timestamps. 3. Use `time_diff(time_now(), created_at)` for age-based queries instead of JS date math. |
| **sqlean-regexp** | `SUBSTR(email, INSTR(email, '@') + 1)` in `telemetry.js`, FTS5 `LIKE` in `search.js` | `regexp_like()`, `regexp_substr()`, `regexp_capture()` | 1. Replace `LIKE '%@%'` with `regexp_like(email, '^.+@.+$')`. 2. Use `regexp_substr()` for extracting domain from email. 3. Enhance FTS5 search with regex filtering. |
| **sqlean-text** | No current usage (i18n gap) | `text_lower()`, `text_normalize()`, `text_split()` | 1. Replace `LOWER(name)` with `text_lower(name)` for Unicode-aware case folding. 2. Use `text_normalize(name, 'nfkc')` for accent-insensitive search. 3. Critical for multilingual design names (Cyrillic, CJK, Arabic). |
| **sqlean-fuzzy** | `search.js` only has FTS5 exact match | `fuzzy_levenshtein()`, `fuzzy_soundex()`, `fuzzy_metaphone()` | 1. Add `fuzzy_levenshteen(query, name) < 2` as a fallback when FTS5 returns no results. 2. "Did you mean?" suggestions in file search. |

### UUIDv7 Primary Key Strategy

The biggest win is migrating from UUIDv4 to UUIDv7:

**Benefits:**
- Time-sortable (monotonically increasing) → B-tree friendly inserts
- Eliminates index fragmentation on `created_at` columns
- Enables `SELECT ... ORDER BY id LIMIT 50` as a replacement for `ORDER BY created_at`
- Reduces dependency on `uuid` npm package

**Migration approach:**
1. Load `sqlean-uuid` at startup
2. New tables use `uuid7()` as column DEFAULT
3. Existing tables continue using JS-side `uuidv4()` until a data migration
4. ID display format remains unchanged (standard UUID text)

### Content Hashing in SQL

The second biggest win is pushing SHA-256 hashing into SQL:

**Current (JS-side):**
```js
const hash = crypto.createHash('sha256').update(data).digest('hex');
pool.run('INSERT INTO storage_object (..., hash, ...) VALUES (?, ?, ...)', [id, hash, ...]);
```

**Target (SQL-side):**
```js
pool.run(`INSERT INTO storage_object (id, bucket, content_type, size, metadata, hash, ...)
          VALUES (?, ?, ?, ?, ?, crypto_encode(crypto_sha256(?), 'hex'), ...)`,
         [id, 'fs', contentType, size, JSON.stringify(metadata), data]);
```

This eliminates the JS round-trip for hash computation and enables dedup queries:
```sql
SELECT id FROM storage_object WHERE hash = crypto_encode(crypto_sha256(?), 'hex');
```

---

## 3. Code Style — `'use strict'` in ESM Files

The server module uses `"type": "module"` in its `package.json`, which means all `.js` files are ESM. ESM is **always strict mode** by specification. The `'use strict';` directives added to the top of 66 server source files are redundant and should be removed to avoid confusion.

**Rule:** Do not add `'use strict';` to ESM files. It is only needed in CommonJS files (`require()`/`module.exports`).

---

## 4. Reference Implementation Patterns

The following patterns from fbeline/design-patterns-JS map directly to refactoring targets:

| GoF Pattern | Reference File | Penpot Target |
|---|---|---|
| **Strategy** | `strategy_es6.js` — `ShoppingCart(discount)` with pluggable `guestStrategy`, `regularStrategy`, `premiumStrategy` | Storage backend selection, OIDC provider dispatch, media command dispatch |
| **Abstract Factory** | `abstract-factory_es6.js` — `droidProducer(kind)` selects `battleDroidFactory` or `pilotDroidFactory` | `createStorageBackend(config)` selecting `FsStorage` or `S3Storage` |
| **Chain of Responsibility** | `chain-of-resp_es6.js` — `NumberDiscount.setNext(PriceDiscount).setNext(NoneDiscount)` | RPC middleware pipeline: AuthHandler → BodyParser → RpcExecutor |
| **Command** | `command_es6.js` — `OnCommand(turbine).execute()` | OT change types: `AddObjCommand.execute()` / `.undo()`, `ModObjCommand.execute()` / `.undo()` |
| **State** | `state_es6.js` — `WaitingForPayment → Shipping → Delivered` | WebSocket lifecycle: `WSDisconnected → WSConnecting → WSConnected` |
| **Decorator** | `decorator_es6.js` — `SauceDecorator(pasta).getPrice()`, `CheeseDecorator(pasta).getPrice()` | RPC client: `withRetry(withAuth(withEncoding(transport)))` |
| **Memento** | `memento_es6.js` — `originator.store(val)` / `originator.restore(memento)` | OT undo-reapply: snapshot pages before applying remote changes |
| **Mediator** | `mediator_es6.js` — `TrafficTower` coordinates `Airplane` positions | Conflict resolution: `ConflictMediator.resolve(localChange, remoteChange)` |
| **Facade** | (already used) | `db/sqlite.js` pool object hiding raw SQL behind `get`, `insertReturning`, `softDelete` |
| **Singleton** | (already used) | `db/sqlite.js` module-level `_db`, `config/index.js` frozen config |