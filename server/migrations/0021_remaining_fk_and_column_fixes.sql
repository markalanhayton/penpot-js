-- 0021: Remaining FK and obsolete column corrections
--
-- Addresses the last remaining PG schema gaps after migration 0020:
--
-- 1. file_library_rel.library_file_id FK: RESTRICT -> CASCADE
--    (PG 0039 changed to CASCADE, PG 0051 confirmed CASCADE DEFERRABLE)
-- 2. page.version: obsolete column dropped in PG 0007
-- 3. page.share_token: SQLite-only column not in PG schema, unused by app
-- 4. file_tagged_object_thumbnail__deleted_at__idx: add covering columns
--    (PG 0109: (deleted_at, file_id, object_id, media_id) WHERE deleted_at IS NOT NULL)

-- ============================================================
-- 1. file_library_rel.library_file_id FK: CASCADE
-- ============================================================
-- PG migration 0039 changed this from RESTRICT to CASCADE.
-- PG migration 0051 confirmed it as CASCADE DEFERRABLE.
-- When a library file is deleted, its library relations should also be deleted.

CREATE TABLE IF NOT EXISTS _flr_backup_0021 AS SELECT * FROM file_library_rel;

DROP TABLE file_library_rel;

CREATE TABLE file_library_rel (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  library_file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  PRIMARY KEY (file_id, library_file_id)
);

CREATE INDEX IF NOT EXISTS idx_flr_library_file_id ON file_library_rel(library_file_id);
CREATE INDEX IF NOT EXISTS file_library_rel__file_id__idx ON file_library_rel(file_id);
CREATE INDEX IF NOT EXISTS file_library_rel__library_file_id__idx ON file_library_rel(library_file_id);

INSERT INTO file_library_rel (file_id, library_file_id, created_at, synced_at)
SELECT file_id, library_file_id, created_at, synced_at
FROM _flr_backup_0021;

DROP TABLE _flr_backup_0021;

-- ============================================================
-- 2. page: drop obsolete columns version and share_token
-- ============================================================
-- PG migration 0007 dropped page.version.
-- page.share_token was never in PG (SQLite-only addition from migration 0001).
-- Neither column is referenced by any application code.

ALTER TABLE page DROP COLUMN version;
ALTER TABLE page DROP COLUMN share_token;

-- ============================================================
-- 3. file_tagged_object_thumbnail__deleted_at__idx: covering columns
-- ============================================================
-- PG migration 0109 creates this index with covering columns for
-- index-only scans. Recreate with the full column list.

DROP INDEX IF EXISTS file_tagged_object_thumbnail__deleted_at__idx;

CREATE INDEX file_tagged_object_thumbnail__deleted_at__idx
    ON file_tagged_object_thumbnail(deleted_at, file_id, object_id, media_id)
    WHERE deleted_at IS NOT NULL;