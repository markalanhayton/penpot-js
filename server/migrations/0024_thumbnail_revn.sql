-- Migration 0024: Add revn to file_object_thumbnail and file_tagged_object_thumbnail
--
-- The file-gc task uses the revn column on thumbnail tables to mark stale
-- thumbnails (those generated before the current file revision) as deleted.
-- These tables were missing the column in the initial schema. Add it now
-- and backfill from the file's current revn.
--
-- Backfill strategy: set revn = 0 on all existing rows (so they are all
-- considered "stale" relative to any file with revn >= 1). Files that have
-- never been edited will have revn = 0 anyway, so this is a safe default.
-- The first GC pass will mark all pre-existing thumbnails as deleted; the
-- next time a thumbnail is generated, it will get the file's current revn.

ALTER TABLE file_object_thumbnail ADD COLUMN revn INTEGER NOT NULL DEFAULT 0;
ALTER TABLE file_tagged_object_thumbnail ADD COLUMN revn INTEGER NOT NULL DEFAULT 0;

-- Index for the GC query "WHERE file_id = ? AND revn < ?"
CREATE INDEX IF NOT EXISTS idx_file_object_thumbnail_file_revn
  ON file_object_thumbnail (file_id, revn);
CREATE INDEX IF NOT EXISTS idx_file_tagged_object_thumbnail_file_revn
  ON file_tagged_object_thumbnail (file_id, revn);
