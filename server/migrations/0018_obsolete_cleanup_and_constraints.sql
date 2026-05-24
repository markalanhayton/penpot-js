-- 0018: Obsolete column cleanup, NOT NULL constraints, missing table & index
--
-- Addresses remaining PG parity gaps identified after migration 0017:
--
-- 1. file_data_fragment.content: obsolete column (PG migration 0121 dropped it after copying to `data`)
-- 2. share_link.who_comment / who_inspect: should be NOT NULL DEFAULT 'team' (PG migration 0075)
-- 3. storage_pending table: missing table for inflight upload tracking (PG migration 0035)
-- 4. http_session__updated_at__idx: missing partial index (PG migration 0049)
--
-- Note: http_session.is_active and http_session.modified_at are retained as
-- intentional SQLite additions (heavily used by application code). PG never
-- had is_active and dropped modified_at in migration 0021, but the Node.js
-- backend depends on both columns for session management.

-- ============================================================
-- 1. file_data_fragment: drop obsolete `content` column
-- ============================================================
-- PG migration 0121 added `data` column, copied `content → data`, then
-- dropped `content`. Our SQLite migration 0004 copied the data but never
-- dropped the column. No application code references `.content` on this table.

ALTER TABLE file_data_fragment DROP COLUMN content;

-- ============================================================
-- 2. share_link.who_comment / who_inspect: NOT NULL DEFAULT 'team'
-- ============================================================
-- PG migration 0075 added these as NOT NULL DEFAULT('team'). Our SQLite
-- migrations 0004 added them as nullable. Since SQLite cannot modify
-- constraints via ALTER TABLE, we recreate the table.
-- Note: share_link also has `token`, `permissions`, `modified_at` columns
-- that are SQLite-specific additions not in PG — these are retained.

UPDATE share_link SET who_comment = 'team' WHERE who_comment IS NULL;
UPDATE share_link SET who_inspect = 'team' WHERE who_inspect IS NULL;

CREATE TABLE IF NOT EXISTS _sl_backup_0018 AS SELECT * FROM share_link;

DROP TABLE share_link;

CREATE TABLE share_link (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  token TEXT NOT NULL UNIQUE,
  permissions TEXT DEFAULT '[]',
  owner_id TEXT REFERENCES profile(id) ON DELETE SET NULL,
  pages TEXT,
  flags TEXT,
  who_comment TEXT NOT NULL DEFAULT 'team',
  who_inspect TEXT NOT NULL DEFAULT 'team'
);

CREATE INDEX IF NOT EXISTS share_link_file_id_idx ON share_link(file_id);
CREATE INDEX IF NOT EXISTS share_link_owner_id_idx ON share_link(owner_id);

INSERT INTO share_link (id, file_id, created_at, modified_at, token, permissions, owner_id, pages, flags, who_comment, who_inspect)
SELECT id, file_id, created_at, modified_at, token, permissions, owner_id, pages, flags,
  COALESCE(who_comment, 'team'),
  COALESCE(who_inspect, 'team')
FROM _sl_backup_0018;

DROP TABLE _sl_backup_0018;

-- ============================================================
-- 3. storage_pending: create missing table for inflight upload tracking
-- ============================================================
-- PG migration 0035 created this table to track inflight uploads for GC.
-- Used by storage GC to detect orphaned files on physical storage that
-- were uploaded but never committed to storage_object.
-- PK is (created_at, id) matching PG's (created_at, id) composite key.

CREATE TABLE IF NOT EXISTS storage_pending (
  id TEXT NOT NULL,
  backend TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (created_at, id)
);

-- ============================================================
-- 4. http_session__updated_at__idx: missing partial index
-- ============================================================
-- PG migration 0049 added `updated_at` column and this partial index.
-- Our SQLite has the column (added in 0004) but never created the index.

CREATE INDEX IF NOT EXISTS http_session__updated_at__idx
    ON http_session(updated_at)
    WHERE updated_at IS NOT NULL;