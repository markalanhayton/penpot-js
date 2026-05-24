-- 0002: Add media, thumbnail, and font-related tables
-- Mirrors PostgreSQL migrations for file_media_object, file_thumbnail,
-- file_tagged_object_thumbnail, and team_font_variant

-- The existing file_image table is replaced by file_media_object which uses
-- storage_object references instead of inline paths
CREATE TABLE IF NOT EXISTS file_media_object (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  name TEXT NOT NULL DEFAULT '',
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  mtype TEXT NOT NULL DEFAULT '',
  is_local TEXT NOT NULL DEFAULT '0',
  media_id TEXT NOT NULL REFERENCES storage_object(id) ON DELETE SET NULL,
  thumbnail_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_fmo_file_id ON file_media_object(file_id);
CREATE INDEX IF NOT EXISTS idx_fmo_media_id ON file_media_object(media_id);
CREATE INDEX IF NOT EXISTS idx_fmo_thumbnail_id ON file_media_object(thumbnail_id);
CREATE INDEX IF NOT EXISTS idx_fmo_deleted_at ON file_media_object(deleted_at);

CREATE TABLE IF NOT EXISTS file_thumbnail (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  revn INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  data TEXT,
  props TEXT DEFAULT '{}',
  media_id TEXT NOT NULL REFERENCES storage_object(id) ON DELETE CASCADE,
  PRIMARY KEY (file_id, revn)
);

CREATE TABLE IF NOT EXISTS file_tagged_object_thumbnail (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  tag TEXT NOT NULL DEFAULT 'frame',
  object_id TEXT NOT NULL,
  media_id TEXT NOT NULL REFERENCES storage_object(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  PRIMARY KEY (file_id, tag, object_id)
);
CREATE INDEX IF NOT EXISTS idx_ftot_file_id ON file_tagged_object_thumbnail(file_id);
CREATE INDEX IF NOT EXISTS idx_ftot_media_id ON file_tagged_object_thumbnail(media_id);

-- Rename font_variant to team_font_variant (matches Clojure backend schema)
-- Drop the old table if it exists with the wrong name
DROP TABLE IF EXISTS font_variant;

CREATE TABLE IF NOT EXISTS team_font_variant (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES profile(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  font_id TEXT NOT NULL,
  font_family TEXT NOT NULL DEFAULT '',
  font_weight INTEGER NOT NULL DEFAULT 400,
  font_style TEXT NOT NULL DEFAULT 'normal',
  variant_name TEXT,
  otf_file_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL,
  ttf_file_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL,
  woff1_file_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL,
  woff2_file_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tfv_team_id ON team_font_variant(team_id);
CREATE INDEX IF NOT EXISTS idx_tfv_font_id ON team_font_variant(font_id);
CREATE INDEX IF NOT EXISTS idx_tfv_otf ON team_font_variant(otf_file_id);
CREATE INDEX IF NOT EXISTS idx_tfv_ttf ON team_font_variant(ttf_file_id);
CREATE INDEX IF NOT EXISTS idx_tfv_woff1 ON team_font_variant(woff1_file_id);
CREATE INDEX IF NOT EXISTS idx_tfv_woff2 ON team_font_variant(woff2_file_id);

-- Add touched_at column to storage_object for GC support
ALTER TABLE storage_object ADD COLUMN touched_at TEXT;
ALTER TABLE storage_object ADD COLUMN content_type TEXT;
ALTER TABLE storage_object ADD COLUMN bucket TEXT;

-- Drop the old file_image table (superseded by file_media_object)
DROP TABLE IF EXISTS file_image;

-- Add has_media_trimmed column to file table (used by file media GC)
ALTER TABLE file ADD COLUMN has_media_trimmed TEXT NOT NULL DEFAULT '0';