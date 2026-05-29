---
name: sqlean-extensions
description: Integrate and use sqlean SQLite extensions (uuid, crypto, regexp, text, time, fuzzy) in the Penpot JS port server. Use when adding sqlean extension loading, replacing JS-side UUID/hashing/timestamps with SQL-level functions, or optimizing queries with sqlean capabilities.
---

# Skill: sqlean SQLite Extensions

Guide for integrating [sqlean](https://github.com/nalgeon/sqlean) SQLite extensions into the Penpot JS port server.

## When to Use

- Adding `db.loadExtension()` calls to load sqlean extensions at startup
- Replacing JS-side `uuidv4()` with SQL-level `uuid7()` for time-sortable primary keys
- Replacing `crypto.createHash('sha256')` with SQL `crypto_sha256()` for content deduplication
- Replacing `new Date().toISOString()` SQL parameters with `time_now()` defaults
- Adding regex, Unicode text, or fuzzy search capabilities to SQLite queries
- Optimizing storage object dedup, audit log queries, or file search

## Available Extensions

| Extension | npm Package | Key Functions | Primary Use Case |
|-----------|-----------|---------------|-----------------|
| **sqlean-uuid** | `sqlean-uuid` | `uuid4()`, `uuid7()`, `uuid7_timestamp_ms()`, `uuid_str()`, `uuid_blob()` | Replace `uuidv4` npm package; UUIDv7 is time-sortable for better B-tree index locality |
| **sqlean-crypto** | `sqlean-crypto` | `crypto_sha256()`, `crypto_md5()`, `crypto_sha1()`, `crypto_blake3()`, `crypto_xxh64()`, `crypto_encode()`, `crypto_decode()` | Content hashing for storage dedup in SQL; eliminates JS roundtrips |
| **sqlean-regexp** | `sqlean-regexp` | `regexp_like()`, `regexp_substr()`, `regexp_capture()`, `regexp_replace()` | PCRE2 regex in queries; replace `LIKE` and `SUBSTR/INSTR` hacks |
| **sqlean-text** | `sqlean-text` | `text_lower()`, `text_upper()`, `text_normalize()`, `text_split()`, `text_join()`, `text_reverse()` | Unicode-aware case folding for multilingual design names |
| **sqlean-time** | `sqlean-time` | `time_now()`, `time_format()`, `time_diff()`, `time_round()`, `time_iso()` | High-precision timestamps; SQL DEFAULT values; eliminate 100+ JS `new Date().toISOString()` roundtrips |
| **sqlean-fuzzy** | `sqlean-fuzzy` | `fuzzy_levenshtein()`, `fuzzy_soundex()`, `fuzzy_metaphone()`, `fuzzy_porter_stem()` | "Did you mean?" suggestions; autocomplete in file search |

## Loading Extensions

Extensions load at database connection time via `better-sqlite3`'s `loadExtension()`:

```js
// server/src/db/sqlite.js — in createPool() or initExtensions()
import path from 'node:path';

const EXTENSIONS_DIR = path.join(__dirname, '..', '..', 'node_modules');

const EXTENSIONS = [
  { name: 'uuid', file: path.join(EXTENSIONS_DIR, 'sqlean-uuid', 'uuid0') },
  { name: 'crypto', file: path.join(EXTENSIONS_DIR, 'sqlean-crypto', 'crypto0') },
  { name: 'time', file: path.join(EXTENSIONS_DIR, 'sqlean-time', 'time0') },
  { name: 'regexp', file: path.join(EXTENSIONS_DIR, 'sqlean-regexp', 'regexp0') },
  { name: 'text', file: path.join(EXTENSIONS_DIR, 'sqlean-text', 'text0') },
];

export function loadExtensions(db) {
  db.pragma('enable_load_extension = 1');
  for (const ext of EXTENSIONS) {
    try {
      db.loadExtension(ext.file);
    } catch (err) {
      console.warn(`[db] Failed to load extension ${ext.name}: ${err.message}`);
    }
  }
  db.pragma('enable_load_extension = 0');
}
```

**Platform suffix:** Windows uses `0` suffix (e.g., `uuid0.dll`), macOS uses `0.so`, Linux uses `0.so`. The `sqlean-*` npm packages ship prebuilt binaries for all platforms.

## UUIDv7 Migration Strategy

UUIDv7 is time-sortable (first 48 bits = millisecond timestamp), which gives B-tree-friendly insert ordering. This is the single highest-impact extension.

1. **Phase 1 (low risk):** Load `sqlean-uuid`, keep using JS `uuidv4()` for IDs in INSERT statements. Use `uuid7_timestamp_ms(id)` in SELECT queries for time-range queries instead of joining on `created_at`.

2. **Phase 2 (DDL defaults):** Add `DEFAULT uuid7()` to `id` columns in new migrations. For example:
   ```sql
   CREATE TABLE audit_log_v2 (
     id TEXT PRIMARY KEY DEFAULT uuid7(),
     -- ...
   );
   ```

3. **Phase 3 (optional):** Replace `import { v4 as uuidv4 } from 'uuid'` with SQL-generated IDs in hot paths. Remove the `uuid` npm dependency.

**Key insight:** UUIDv7 IDs are naturally sortable by creation time, so `SELECT * FROM file ORDER BY id` gives chronological order — no need for a `created_at` index for time-range queries.

## Content Hashing in SQL

Replace JS-side `crypto.createHash('sha256')` with SQL-level hashing for storage dedup:

```js
// Before (JS-side):
const hash = crypto.createHash('sha256').update(data).digest('hex');
pool.run('INSERT INTO storage_object (id, hash, ...) VALUES (?, ?, ...)', [id, hash, ...]);

// After (SQL-side):
pool.run(`INSERT INTO storage_object (id, hash, ...)
          VALUES (?, crypto_encode(crypto_sha256(?), 'hex'), ...)`, [id, data]);
```

This eliminates the JS roundtrip and makes dedup queries pure SQL:
```sql
SELECT id FROM storage_object WHERE hash = crypto_encode(crypto_sha256(?), 'hex');
```

## Timestamp Defaults

Replace the 100+ `const now = new Date().toISOString()` + parameter pattern:

```js
// Before:
const now = new Date().toISOString();
pool.run('INSERT INTO file (id, name, created_at, modified_at) VALUES (?, ?, ?, ?)', [id, name, now, now]);

// After (with sqlean-time):
pool.run("INSERT INTO file (id, name, created_at, modified_at) VALUES (?, ?, time_now(), time_now())", [id, name]);
```

Or keep JS-side timestamps for now and use `time_diff()` for age queries:
```sql
SELECT * FROM file WHERE time_diff(time_now(), created_at) > 86400; -- older than 1 day
```

## RegExp and Text Search

```sql
-- Before: LIKE with SUBSTR hack
SELECT DISTINCT SUBSTR(email, INSTR(email, '@') + 1) AS domain FROM profile
WHERE deleted_at IS NULL AND email LIKE '%@%';

-- After: regexp_substr
SELECT DISTINCT regexp_substr(email, '@(.+)$', 1) AS domain FROM profile
WHERE deleted_at IS NULL AND regexp_like(email, '^[^@]+@[^@]+$');

-- Unicode-aware case-insensitive search (accent-insensitive):
SELECT * FROM file WHERE text_lower(name) = text_lower('Café');
-- vs. SQLite built-in LOWER() which doesn't handle Unicode
```

## Installation

```bash
cd server && pnpm add sqlean-uuid sqlean-crypto sqlean-time sqlean-regexp sqlean-text
```

Or for the bundle (all extensions in one file):
```bash
cd server && pnpm add sqlean
```

## Testing Extensions

Extensions are optional — if they fail to load (e.g., in CI without the binary), the server should still start. Use the `try/catch` pattern shown in `loadExtensions()` above and log a warning.

For test environments using `:memory:` databases, load extensions after the in-memory DB is created:
```js
import { createPool, runMigrations, closeDb } from '../src/db/sqlite.js';
import { loadExtensions } from '../src/db/sqlite.js';

const pool = createPool(':memory:');
runMigrations(pool.db);
loadExtensions(pool.db); // Load after migrations
```

## Reference

- Full architecture guide: `docs/migration/architecture-guide.md`
- Server next steps: `docs/migration/server-next-steps.md` §7
- sqlean docs: https://github.com/nalgeon/sqlean