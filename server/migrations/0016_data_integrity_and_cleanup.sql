-- 0016: Data integrity and cleanup — NOT NULL constraints, obsolete column removal
--
-- Addresses remaining data integrity gaps from the PG parity audit:
--
-- 1. file_data.type should be NOT NULL DEFAULT 'main' (PG migration 0141)
--    NULL values break queries like WHERE type = 'main'
-- 2. audit_log.id should be TEXT not INTEGER AUTOINCREMENT (PG uses UUID)
--    Also adds missing 'context' column (PG migration 0064) and makes
--    name/type NOT NULL with defaults (matching PG schema)
-- 3. Drop obsolete columns: profile.photo and team.photo (replaced by photo_id
--    in PG migration 0043; both Node.js and Clojure backends now use photo_id)
-- 4. Drop obsolete storage_data table (PG migration 0095)
-- 5. Populate auth_backend for any remaining NULL profiles

-- ============================================================
-- 1. file_data.type NOT NULL with DEFAULT
-- ============================================================
-- PG migration 0141 creates this column as NOT NULL. The SQLite
-- migration 0004 added it as nullable, noting that ALTER TABLE
-- couldn't add NOT NULL to existing rows. Now that all file_data
-- rows created by the application set type='main', we can safely
-- make it NOT NULL with a default.
--
-- SQLite 3.37+ supports ALTER TABLE ... SET NOT NULL, but for
-- compatibility we use a table recreation approach since there
-- may be no rows yet.

-- First, set any existing NULL values to 'main'
UPDATE file_data SET type = 'main' WHERE type IS NULL;

-- Now recreate the table with the NOT NULL constraint
CREATE TABLE IF NOT EXISTS _fd_backup AS SELECT * FROM file_data;

DROP TABLE file_data;

CREATE TABLE file_data (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  type TEXT NOT NULL DEFAULT 'main',
  backend TEXT NOT NULL DEFAULT 'db',
  metadata TEXT DEFAULT '{}',
  data BLOB,
  PRIMARY KEY (file_id, id)
);

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_fd_data_file_id ON file_data(file_id);
CREATE INDEX IF NOT EXISTS file_data__deleted_at__idx
    ON file_data(deleted_at, file_id, id)
    WHERE deleted_at IS NOT NULL;

-- Migrate data
INSERT INTO file_data (file_id, id, created_at, modified_at, deleted_at, type, backend, metadata, data)
SELECT file_id, id, created_at, modified_at, deleted_at,
  COALESCE(type, 'main'),
  COALESCE(backend, 'db'),
  metadata, data
FROM _fd_backup;

DROP TABLE _fd_backup;

-- ============================================================
-- 2. audit_log: TEXT PRIMARY KEY, context column, NOT NULL constraints
-- ============================================================
-- PG uses UUID for audit_log.id. The Clojure backend generates UUIDs
-- for audit entries. SQLite's INTEGER AUTOINCREMENT creates sequential
-- integers which are incompatible with the UUID-based RPC layer.
-- Also adds the 'context' column (PG migration 0064) and makes
-- name/type NOT NULL with defaults to match PG schema.

CREATE TABLE IF NOT EXISTS _al_backup AS SELECT * FROM audit_log;

DROP TABLE audit_log;

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  profile_id TEXT REFERENCES profile(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  data TEXT DEFAULT '{}',
  ip_addr TEXT,
  archived_at TEXT,
  props TEXT DEFAULT '{}',
  source TEXT,
  tracked_at TEXT,
  context TEXT
);

-- Recreate all audit_log indexes from migration 0010
CREATE INDEX IF NOT EXISTS audit_log__created_at__unarchived__idx
    ON audit_log(created_at)
    WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS audit_log__archived_at__idx
    ON audit_log(archived_at)
    WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_log__source__created_at__idx
    ON audit_log(source, created_at);
CREATE INDEX IF NOT EXISTS audit_log__id_archived_at__idx
    ON audit_log(id, archived_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_type ON audit_log(type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- Migrate existing rows (convert integer id to text, set defaults for NOT NULL columns)
INSERT INTO audit_log (id, created_at, profile_id, type, name, data, ip_addr, archived_at, props, source, tracked_at)
SELECT CAST(id AS TEXT), created_at, profile_id,
  COALESCE(type, ''),
  COALESCE(name, ''),
  data, ip_addr, archived_at, props, source, tracked_at
FROM _al_backup;

DROP TABLE _al_backup;

-- ============================================================
-- 3. Drop obsolete columns: profile.photo and team.photo
-- ============================================================
-- PG migration 0043 dropped profile.photo and team.photo, replaced by photo_id.
-- The Node.js codebase now uses photo_id exclusively (updated in scheduler.js).
-- These columns have been retained for backward compatibility but are no longer
-- referenced by any application code.

ALTER TABLE profile DROP COLUMN photo;
ALTER TABLE team DROP COLUMN photo;

-- ============================================================
-- 4. Drop obsolete table: storage_data
-- ============================================================
-- PG migration 0095 dropped the storage_data table. It was replaced by
-- the storage_object + filesystem/S3 backend in earlier migrations.
-- No application code references this table.

DROP TABLE IF EXISTS storage_data;

-- ============================================================
-- 5. Populate auth_backend for any remaining NULL profiles
-- ============================================================
-- Re-run the auth_backend population from migration 0010 in case
-- new profiles were created without it being set.

UPDATE profile
   SET auth_backend = 'penpot'
 WHERE auth_backend IS NULL
   AND password IS NOT NULL;

UPDATE profile
   SET auth_backend = 'oidc'
 WHERE auth_backend IS NULL
   AND password IS NULL;

-- Set auth_backend to 'penpot' for any profile with a password
-- that still has a NULL auth_backend (edge case: password set after migration)
UPDATE profile
   SET auth_backend = 'penpot'
 WHERE auth_backend IS NULL;