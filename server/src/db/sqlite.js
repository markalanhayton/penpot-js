'use strict';
/**
 * @module db/sqlite
 * @description Database access layer — mirrors `app.db` from the Clojure backend.
 *
 * Uses `better-sqlite3` for synchronous, blocking SQLite access which is ideal for
 * a single-process Node.js server. Provides a connection pool facade, high-level
 * CRUD helpers (snake_case ↔ camelCase mapping), transaction support, and a
 * migration runner.
 *
 * ### SQLite vs PostgreSQL type mapping
 *
 * | PostgreSQL   | SQLite       | JS representation |
 * |-------------|-------------|-------------------|
 * | `uuid`      | `TEXT`       | `string`          |
 * | `jsonb`     | `TEXT`       | `JSON.parse/stringify` |
 * | `boolean`   | `TEXT '0'/'1'` | `string`       |
 * | `timestamptz` | `TEXT` ISO 8601 | `string`      |
 * | `bytea`     | `BLOB`       | `Buffer`          |
 * | `inet`      | `TEXT`       | `string`          |
 * | `text[]`    | `TEXT` (JSON) | `Array`          |
 *
 * @example
 * import { createPool, runMigrations, closeDb } from './db/sqlite.js';
 *
 * const pool = createPool('./penpot.sqlite');
 * runMigrations(pool.db);
 * const profile = pool.getOne('profile', { id: 'abc-123' });
 * const inserted = pool.insertReturning('team', { id: uuid(), name: 'My Team' });
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Normalize SQL parameters for better-sqlite3.
 *
 * better-sqlite3 requires named binds (`@key`) when passing an object,
 * but many call sites use `?` with objects. This function converts
 * `WHERE col = ?` to `WHERE col = @param_N` when an object is passed,
 * mapping values positionally.
 */
function normalizeParams(sql, params) {
  if (Array.isArray(params) || !params || typeof params !== 'object') {
    return { sql, params };
  }
  if (!sql.includes('?')) {
    return { sql, params };
  }

  const keys = Object.keys(params);
  const values = [];
  let idx = 0;
  const newSql = sql.replace(/\?/g, () => {
    const key = keys[idx];
    values.push(params[key]);
    idx++;
    return `@_p${idx - 1}`;
  });

  const namedParams = {};
  for (let i = 0; i < keys.length; i++) {
    namedParams[`_p${i}`] = params[keys[i]];
  }
  return { sql: newSql, params: namedParams };
}

// --- Snake_case <-> camelCase conversion ---

/**
 * Convert a camelCase string to snake_case.
 *
 * @param {string} str - camelCase identifier (e.g. `'profileId'`).
 * @returns {string} snake_case identifier (e.g. `'profile_id'`).
 *
 * @example
 * camelToSnake('profileId'); // 'profile_id'
 * camelToSnake('isDefault'); // 'is_default'
 */
export function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert a snake_case string to camelCase.
 *
 * @param {string} str - snake_case identifier (e.g. `'profile_id'`).
 * @returns {string} camelCase identifier (e.g. `'profileId'`).
 *
 * @example
 * snakeToCamel('profile_id'); // 'profileId'
 * snakeToCamel('is_default'); // 'isDefault'
 */
export function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Convert a single database row from snake_case keys to camelCase keys.
 *
 * @param {Record<string, *>|null} row - A row object from `better-sqlite3`.
 * @returns {Record<string, *>|null} The row with camelCase keys, or `null` if input is null.
 */
export function rowToCamel(row) {
  if (!row) return null;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamel(key)] = value;
  }
  return result;
}

/**
 * Convert an array of database rows from snake_case keys to camelCase keys.
 *
 * @param {Array<Record<string, *>>|null} rows - Rows from `better-sqlite3`.
 * @returns {Array<Record<string, *>>} Array of rows with camelCase keys; empty array if input is null.
 */
export function rowsToCamel(rows) {
  return rows ? rows.map(rowToCamel) : [];
}

/**
 * Convert a plain object's keys from camelCase to snake_case.
 *
 * Used when passing JS objects as named parameters to SQL statements
 * (`@profileId` → `@profile_id`).
 *
 * @param {Record<string, *>} obj - Object with camelCase keys.
 * @returns {Record<string, *>} New object with snake_case keys.
 */
export function objectToSnake(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value;
  }
  return result;
}

/**
 * Convert a plain object's keys from snake_case to camelCase.
 *
 * @param {Record<string, *>} obj - Object with snake_case keys.
 * @returns {Record<string, *>} New object with camelCase keys.
 */
function objectToCamel(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = value;
  }
  return result;
}

// --- Connection Pool (mirrors app.db/create-pool) ---

/** @type {import('better-sqlite3').Database|null} */
let _db = null;

/**
 * Get the current database connection (or `null` if not yet opened).
 *
 * @returns {import('better-sqlite3').Database|null}
 */
export function getDb() {
  return _db;
}

/**
 * Open a SQLite database connection and configure WAL mode, foreign keys,
 * busy timeout, and synchronous mode.
 *
 * If a connection already exists it is returned without re-opening.
 *
 * @param {string|null} [dbPath=null] - Path to the SQLite file. Pass `':memory:'`
 *   for an in-memory database. Defaults to `penpot.sqlite` in the current directory.
 * @returns {import('better-sqlite3').Database} The opened database handle.
 */
export function openDb(dbPath = null) {
  if (_db) return _db;
  const resolvedPath = dbPath || path.join(process.cwd(), 'penpot.sqlite');
  _db = new Database(resolvedPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');
  _db.pragma('synchronous = NORMAL');
  return _db;
}

/**
 * Close the current database connection and release resources.
 *
 * After calling this, `getDb()` returns `null` until `openDb()` is called again.
 */
export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * @typedef {object} DatabasePool
 * @property {import('better-sqlite3').Database} db - The raw `better-sqlite3` handle.
 *
 * @property {function(string, Record<string, ?>): Array<Record<string, *>>} query
 *   Execute a SELECT-style SQL statement with named parameters and return all rows.
 *   Parameters use `@camelCase` named binds; keys are auto-converted to `@snake_case`
 *   unless already in snake_case.
 *
 * @property {function(string, Record<string, ?>): Record<string, *>|undefined} get
 *   Execute a SQL statement and return the first row, or `undefined`.
 *
 * @property {function(string, Record<string, ?>): import('better-sqlite3').RunResult} run
 *   Execute a SQL statement (INSERT/UPDATE/DELETE) and return the run result.
 *
 * @property {function(string, Record<string, *>): Record<string, *>} insert
 *   Insert a row into `table`. Returns the original data with an `id` field added
 *   (from `lastInsertRowid`).
 *
 * @property {function(string, Record<string, *>): Record<string, *>|undefined} insertReturning
 *   Insert a row and return the inserted row using `RETURNING *`. CamelCase keys
 *   in `data` are auto-converted to snake_case column names.
 *
 * @property {function(string, Record<string, *>, Array<string>?): import('better-sqlite3').RunResult|null} insertOnConflictDoNothing
 *   Insert a row with `ON CONFLICT DO NOTHING`. Returns `null` if a unique
 *   constraint was violated.
 *
 * @property {function(string, Array<string>, Array<Array<*>>): void} insertMany
 *   Bulk-insert rows in a single transaction.
 *
 * @property {function(string, Record<string, *>, object?): Record<string, *>|undefined} getOne
 *   Select a single row from `table` matching `where` conditions. Returns `undefined`
 *   if no match.
 *
 * @property {function(string, Record<string, *>, Record<string, *>): Record<string, *>|undefined} updateReturning
 *   Update rows in `table` setting `data` where `where` matches and return the
 *   updated row using `RETURNING *`. CamelCase keys are auto-converted.
 *
 * @property {function(string, Record<string, *>, Record<string, *>, object?): import('better-sqlite3').RunResult|Record<string, *>} update
 *   Update rows in `table` setting `data` where `where` conditions match.
 *   If `opts.returnKeys` is provided, uses `RETURNING` to return selected columns.
 *
 * @property {function(string, Record<string, *>, object?): import('better-sqlite3').RunResult|Record<string, *>} deleteFrom
 *   Delete rows from `table` matching `where` conditions.
 *   If `opts.returnKeys` is provided, uses `RETURNING` to return selected columns.
 *
 * @property {function(string, Record<string, *>): import('better-sqlite3').RunResult} softDelete
 *   Soft-delete rows by setting `deleted_at = datetime('now')` where `where` matches.
 *
 * @property {function(function): *} transaction
 *   Run `fn` inside a database transaction. Commits on success, rolls back on throw.
 *
 * @property {function(function): *} runWith
 *   Execute `fn` with `{ db, conn }` — mirrors `app.db/run!`.
 *
 * @property {function(*): *|null} jsonRead
 *   Deserialize a JSON TEXT column value. Returns `null` for null input,
 *   parsed object/array for strings, or the value itself if already an object.
 *
 * @property {function(*): string|null} jsonWrite
 *   Serialize a value for JSON TEXT column storage. Returns `null` for null input,
 *   stringifies objects/arrays, passes through strings.
 *
 * @property {function: string} uuid
 *   Generate a random UUID v4 string (SQLite has no native UUID type).
 *
 * @property {function(Error): boolean} isDuplicateKeyError
 *   Check whether a `better-sqlite3` error is a unique/primary-key constraint violation.
 *   Mirrors `app.db/duplicate-key-error?`.
 *
 * @property {function(string?): string} notDeleted
 *   Generate a `deleted_at IS NULL` filter expression, optionally table-qualified.
 */

/**
 * Create a database pool wrapper around a `better-sqlite3` connection.
 *
 * The pool provides high-level CRUD operations that automatically convert between
 * camelCase (JS) and snake_case (SQL) column names, mirroring the `app.db` API
 * from the Clojure backend.
 *
 * @param {string|null} [dbPath=null] - Path to the SQLite file. `':memory:'` for in-memory.
 * @returns {DatabasePool} The pool object with query helpers.
 */
export function createPool(dbPath = null) {
  const db = openDb(dbPath);

  const pool = {
    db,

    // --- Core query methods (mirrors app.db namespace) ---

    /**
     * Execute a SQL statement with named parameters and return all rows.
     *
     * @param {string} sql - SQL statement with `@param` named binds.
     * @param {Record<string, *>} [params={}] - Named bind parameters.
     * @returns {Array<Record<string, *>>} Matching rows.
     */
    query(sql, params = {}) {
      const stmt = db.prepare(sql);
      if (Object.keys(params).length === 0) return stmt.all();
      return stmt.all(params);
    },

    /**
     * Execute a SQL statement and return the first matching row.
     *
     * @param {string} sql - SQL statement with `@param` or `?` binds.
     * @param {Record<string, *>|Array} [params={}] - Bind parameters.
     * @returns {Record<string, *>|undefined} The first row, or `undefined`.
     */
    get(sql, params = {}) {
      const p = normalizeParams(sql, params);
      return db.prepare(p.sql).get(p.params);
    },

    /**
     * Execute a SQL statement (INSERT/UPDATE/DELETE) and return the run result.
     *
     * @param {string} sql - SQL statement.
     * @param {Record<string, *>|Array} [params={}] - Bind parameters.
     * @returns {import('better-sqlite3').RunResult} The statement run result.
     */
    run(sql, params = {}) {
      return db.prepare(sql).run(params);
    },

    // --- High-level CRUD (mirrors app.db insert!, get, update!, delete!) ---

    /**
     * Insert a row into `table`. CamelCase keys in `data` are auto-converted
     * to snake_case column names. Returns the data with an `id` field.
     *
     * @param {string} table - Table name (snake_case).
     * @param {Record<string, *>} data - Row data (camelCase keys accepted).
     * @returns {Record<string, *>} The inserted data with `id` populated.
     */
    insert(table, data) {
      const snaked = objectToSnake(data);
      const keys = Object.keys(snaked);
      const cols = keys.join(', ');
      const vals = keys.map(k => `@${k}`).join(', ');
      const sql = `INSERT INTO ${table} (${cols}) VALUES (${vals})`;
      const result = db.prepare(sql).run(snaked);
      return { ...data, id: result.lastInsertRowid };
    },

    /**
     * Insert a row and return the full inserted row using `RETURNING *`.
     *
     * @param {string} table - Table name.
     * @param {Record<string, *>} data - Row data (camelCase keys auto-converted).
     * @returns {Record<string, *>|undefined} The inserted row (snake_case columns).
     */
    insertReturning(table, data) {
      const snaked = objectToSnake(data);
      const keys = Object.keys(snaked);
      const cols = keys.join(', ');
      const vals = keys.map(k => `@${k}`).join(', ');
      const sql = `INSERT INTO ${table} (${cols}) VALUES (${vals}) RETURNING *`;
      return db.prepare(sql).get(snaked);
    },

    /**
     * Insert a row with `ON CONFLICT DO NOTHING`. Returns `null` if a
     * unique constraint was violated (mirrors `app.db.sql/insert :on-conflict-do-nothing`).
     *
     * @param {string} table - Table name.
     * @param {Record<string, *>} data - Row data.
     * @param {Array<string>} [conflictCols=[]] - Columns in the conflict target.
     *   If empty, uses `ON CONFLICT DO NOTHING` without specifying columns.
     * @returns {import('better-sqlite3').RunResult|null} The run result, or `null` on conflict.
     */
    insertOnConflictDoNothing(table, data, conflictCols = []) {
      const snaked = objectToSnake(data);
      const keys = Object.keys(snaked);
      const cols = keys.join(', ');
      const vals = keys.map(k => `@${k}`).join(', ');
      const suffix = conflictCols.length > 0
        ? `ON CONFLICT (${conflictCols.join(', ')}) DO NOTHING`
        : 'ON CONFLICT DO NOTHING';
      const sql = `INSERT INTO ${table} (${cols}) VALUES (${vals}) ${suffix}`;
      try {
        const result = db.prepare(sql).run(snaked);
        return result.changes === 0 ? null : result;
      } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return null;
        throw e;
      }
    },

    /**
     * Bulk-insert rows in a single transaction.
     *
     * @param {string} table - Table name.
     * @param {Array<string>} cols - Column names (camelCase auto-converted).
     * @param {Array<Array<*>>} rows - Array of row value arrays matching `cols` order.
     */
    insertMany(table, cols, rows) {
      const colList = cols.map(camelToSnake).join(', ');
      const valPlaceholders = cols.map(() => '?').join(', ');
      const sql = `INSERT INTO ${table} (${colList}) VALUES (${valPlaceholders})`;
      const stmt = db.prepare(sql);
      const insertMany = db.transaction((rows) => {
        for (const row of rows) {
          stmt.run(row);
        }
      });
      insertMany(rows);
    },

    /**
     * Select a single row from `table` by `where` conditions.
     *
     * @param {string} table - Table name.
     * @param {Record<string, *>} where - Match conditions (camelCase keys auto-converted).
     * @param {object} [opts={}] - Options. `forUpdate` and `forShare` are no-ops in SQLite.
     * @returns {Record<string, *>|undefined} The matching row, or `undefined`.
     */
    getOne(table, where, opts = {}) {
      const whereSnake = objectToSnake(where);
      const whereClauses = Object.keys(whereSnake).map(k => `${k} = @${k}`).join(' AND ');
      let suffix = '';
      if (opts.forUpdate) suffix = '';  // SQLite has no FOR UPDATE
      if (opts.forShare) suffix = '';    // SQLite has no FOR SHARE
      const sql = `SELECT * FROM ${table} WHERE ${whereClauses}${suffix}`;
      return db.prepare(sql).get(whereSnake);
    },

    /**
     * Update rows in `table` setting `data` where `where` matches.
     *
     * If `opts.returnKeys` is provided (array of column names), uses `RETURNING`
     * to return the specified columns from the updated row.
     *
     * @param {string} table - Table name.
     * @param {Record<string, *>} data - Columns to update (camelCase keys auto-converted).
     * @param {Record<string, *>} where - Match conditions (camelCase keys auto-converted).
     * @param {object} [opts={}] - Options.
     * @param {Array<string>} [opts.returnKeys] - Column names to return via `RETURNING`.
     * @returns {import('better-sqlite3').RunResult|Record<string, *>} Run result or returned row.
     */
    updateReturning(table, data, where) {
      const setData = objectToSnake(data);
      const whereData = objectToSnake(where);
      const setClauses = Object.keys(setData).map(k => `${k} = @set_${k}`).join(', ');
      const whereClauses = Object.keys(whereData).map(k => `${k} = @where_${k}`).join(' AND ');
      const params = {};
      for (const [k, v] of Object.entries(setData)) params[`set_${k}`] = v;
      for (const [k, v] of Object.entries(whereData)) params[`where_${k}`] = v;
      const sql = `UPDATE ${table} SET ${setClauses} WHERE ${whereClauses} RETURNING *`;
      return db.prepare(sql).get(params);
    },

    update(table, data, where, opts = {}) {
      const setData = objectToSnake(data);
      const whereData = objectToSnake(where);
      const setClauses = Object.keys(setData).map(k => `${k} = @set_${k}`).join(', ');
      const whereClauses = Object.keys(whereData).map(k => `${k} = @where_${k}`).join(' AND ');
      const params = {};
      for (const [k, v] of Object.entries(setData)) params[`set_${k}`] = v;
      for (const [k, v] of Object.entries(whereData)) params[`where_${k}`] = v;

      if (opts.returnKeys && opts.returnKeys.length > 0) {
        const returning = opts.returnKeys.map(camelToSnake).join(', ');
        const sql = `UPDATE ${table} SET ${setClauses} WHERE ${whereClauses} RETURNING ${returning}`;
        return db.prepare(sql).get(params);
      }

      const sql = `UPDATE ${table} SET ${setClauses} WHERE ${whereClauses}`;
      return db.prepare(sql).run(params);
    },

    /**
     * Delete rows from `table` matching `where`. Optionally return specific columns
     * using `RETURNING`.
     *
     * @param {string} table - Table name.
     * @param {Record<string, *>} where - Match conditions (camelCase keys auto-converted).
     * @param {object} [opts={}] - Options.
     * @param {Array<string>} [opts.returnKeys] - Column names to return via `RETURNING`.
     * @returns {import('better-sqlite3').RunResult|Record<string, *>} Run result or returned row.
     */
    deleteFrom(table, where, opts = {}) {
      const whereSnake = objectToSnake(where);
      const whereClauses = Object.keys(whereSnake).map(k => `${k} = @${k}`).join(' AND ');

      if (opts.returnKeys && opts.returnKeys.length > 0) {
        const returning = opts.returnKeys.map(camelToSnake).join(', ');
        const sql = `DELETE FROM ${table} WHERE ${whereClauses} RETURNING ${returning}`;
        return db.prepare(sql).get(whereSnake);
      }

      const sql = `DELETE FROM ${table} WHERE ${whereClauses}`;
      return db.prepare(sql).run(whereSnake);
    },

    /**
     * Soft-delete rows by setting `deleted_at = datetime('now')` where `where` matches.
     *
     * @param {string} table - Table name.
     * @param {Record<string, *>} where - Match conditions (camelCase keys auto-converted).
     * @returns {import('better-sqlite3').RunResult}
     */
    softDelete(table, where) {
      const whereSnake = objectToSnake(where);
      const whereClauses = Object.keys(whereSnake).map(k => `${k} = @${k}`).join(' AND ');
      const sql = `UPDATE ${table} SET deleted_at = datetime('now') WHERE ${whereClauses}`;
      return db.prepare(sql).run(whereSnake);
    },

    /**
     * Run `fn` inside a database transaction. Commits on success, rolls back on throw.
     *
     * @param {function} fn - Function to execute transactionally.
     * @returns {*} Return value of `fn`.
     */
    transaction(fn) {
      return db.transaction(fn)();
    },

    /**
     * Execute `fn` with `{ db, conn }` — mirrors `app.db/run!`.
     *
     * @param {function({db: Database, conn: Database}): *} fn - Function receiving the connection.
     * @returns {*} Return value of `fn`.
     */
    runWith(fn) {
      return fn({ db, conn: db });
    },

    // --- SQLite-specific utilities ---

    /**
     * Deserialize a JSON TEXT column. Returns parsed object/array for string input,
     * the value itself for non-string input, or `null` for null/undefined.
     *
     * @param {*} value - Stored value (typically string from SQLite).
     * @returns {*} Parsed value.
     */
    jsonRead(value) {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string') {
        try { return JSON.parse(value); } catch { return value; }
      }
      return value;
    },

    /**
     * Serialize a value for JSON TEXT column storage. Stringifies objects/arrays,
     * passes through strings, returns `null` for null/undefined.
     *
     * @param {*} value - Value to store.
     * @returns {string|null} JSON string or `null`.
     */
    jsonWrite(value) {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string') return value;
      return JSON.stringify(value);
    },

    /**
     * Generate a random UUID v4 string.
     * SQLite has no native UUID type; identifiers are stored as TEXT.
     *
     * @returns {string} A UUID v4 string (e.g. `'550e8400-e29b-41d4-a716-446655440000'`).
     */
    uuid() {
      return crypto.randomUUID();
    },

    /**
     * Check whether a database error is a unique/primary-key constraint violation.
     * Mirrors `app.db/duplicate-key-error?`.
     *
     * @param {Error} error - A `better-sqlite3` error object.
     * @returns {boolean} `true` if the error is a constraint violation.
     */
    isDuplicateKeyError(error) {
      return error.code === 'SQLITE_CONSTRAINT_UNIQUE'
        || error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
    },

    /**
     * Generate a `deleted_at IS NULL` filter expression, optionally table-qualified.
     *
     * @param {string|null} [tableName=null] - Optional table name prefix (e.g. `'f'`).
     * @returns {string} Filter expression like `'deleted_at IS NULL'` or `'f.deleted_at IS NULL'`.
     */
    notDeleted(tableName = null) {
      return tableName ? `${tableName}.deleted_at IS NULL` : 'deleted_at IS NULL';
    }
  };

  return pool;
}

// --- Migration runner (mirrors app.migrations) ---

/** @type {string} Absolute path to the SQL migrations directory. */
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

/**
 * Ensure the `_migrations` table exists and return the set of already-applied
 * migration step names.
 *
 * @param {import('better-sqlite3').Database} db - The database handle.
 * @returns {Array<{step: string}>} Applied migration step names.
 */
export function getAppliedMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      step TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  return db.prepare('SELECT step FROM _migrations').all().map(r => r.step);
}

/**
 * Read all `.sql` migration files from the migrations directory, sorted by name.
 *
 * @returns {Array<{name: string, path: string, sql: string}>} Migration definitions.
 */
export function getMigrationFiles() {
  const dir = MIGRATIONS_DIR;
  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    return files.map(f => ({
      name: f.replace('.sql', ''),
      path: path.join(dir, f),
      sql: readFileSync(path.join(dir, f), 'utf-8')
    }));
  } catch {
    return [];
  }
}

/**
 * Run all pending database migrations in order.
 *
 * Logs each migration being applied. On failure, logs the error and re-throws.
 * Already-applied migrations are skipped.
 *
 * @param {import('better-sqlite3').Database} db - The database handle.
 * @returns {number} The number of migrations that were applied.
 */
export function runMigrations(db) {
  const applied = new Set(getAppliedMigrations(db));
  const files = getMigrationFiles();
  const insertStmt = db.prepare('INSERT INTO _migrations (module, step) VALUES (?, ?)');
  let count = 0;

  for (const { name, sql } of files) {
    if (applied.has(name)) continue;
    console.log(`[migrations] Running: ${name}`);
    try {
      db.exec(sql);
    } catch (err) {
      console.error(`[migrations] FAILED: ${name}`);
      console.error(err.message);
      throw err;
    }
    insertStmt.run('backend', name);
    applied.add(name);
    count++;
  }

  if (count === 0) {
    console.log('[migrations] All migrations already applied');
  } else {
    console.log(`[migrations] Applied ${count} migration(s)`);
  }
  return count;
}