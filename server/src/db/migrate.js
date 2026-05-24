/**
 * @module db/migrate
 * @description Standalone migration runner — an alternative entry point to
 * `db/sqlite.js`'s `runMigrations()` for CLI usage.
 *
 * Reads `.sql` files from the `migrations/` directory, applies them in
 * alphabetical order, and tracks applied migrations in the `_migrations` table.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {string} Absolute path to the SQL migrations directory. */
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

/**
 * Ensure the `_migrations` table exists and return already-applied
 * migration step names.
 *
 * @param {import('better-sqlite3').Database} db - The database handle.
 * @returns {Array<string>} Applied migration step names.
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
 * Read all `.sql` migration files from {@link MIGRATIONS_DIR}, sorted by filename.
 *
 * @returns {Array<{name: string, path: string, sql: string}>} Migration definitions
 *   with `name` (filename without extension), `path` (absolute path), and `sql` content.
 */
export function getMigrationFiles() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  return files.map(f => ({
    name: f.replace('.sql', ''),
    path: path.join(MIGRATIONS_DIR, f),
    sql: readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8')
  }));
}

/**
 * Apply all pending database migrations in alphabetical order.
 *
 * Each migration is executed inside a single `db.exec()` call. On failure, the
 * error is logged and re-thrown. Already-applied migrations (tracked by step
 * name in `_migrations`) are skipped.
 *
 * @param {import('better-sqlite3').Database} db - The database handle.
 * @returns {number} Number of newly applied migrations.
 */
export function runMigrations(db) {
  const applied = new Set(getAppliedMigrations(db));
  const files = getMigrationFiles();

  const insertStmt = db.prepare(
    'INSERT INTO _migrations (module, step) VALUES (?, ?)'
  );

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