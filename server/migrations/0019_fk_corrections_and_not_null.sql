-- 0019: Foreign key corrections and NOT NULL tightening
--
-- Addresses FK ON DELETE behavior mismatches between PG and SQLite:
--
-- 1. file_media_object: storage_object FKs should use RESTRICT not SET NULL
--    (PG migration 0078: ON DELETE NO ACTION DEFERRABLE; prevents orphaned storage)
-- 2. file_thumbnail: storage_object and file FKs should use RESTRICT not CASCADE
--    (PG migration 0108: file_id DEFERRABLE, media_id DEFERRABLE)
-- 3. file_tagged_object_thumbnail: same pattern as file_thumbnail
--    (PG migration 0109: DEFERRABLE FKs)
-- 4. team_font_variant: storage_object FKs should use RESTRICT not SET NULL
--    (PG migration 0113: all storage_object FKs changed to DEFERRABLE)
-- 5. file_change.file_id: should use RESTRICT not CASCADE
--    (PG migration 0139: removed CASCADE, made DEFERRABLE)
-- 6. file_data.file_id: should use RESTRICT not CASCADE
--    (PG migration 0141: DEFERRABLE, no CASCADE)
-- 7. http_session_v2.sso_provider_id: should use CASCADE not SET NULL
--    (PG migration 0143: ON DELETE CASCADE)
-- 8. comment_thread: position and participants NOT NULL (PG migration 0031)
-- 9. file_media_object: drop obsolete is_local column (not in PG schema)

-- ============================================================
-- 1. file_media_object: fix FK ON DELETE + drop is_local
-- ============================================================
-- PG migration 0078 changed storage_object FKs to ON DELETE NO ACTION DEFERRABLE.
-- ON DELETE SET NULL on a NOT NULL column is contradictory — SQLite aborts
-- the DELETE instead of setting NULL, which happens to be the correct
-- behavior (equivalent to RESTRICT). However, making it explicit with
-- RESTRICT is clearer. Also drops the `is_local` column (not in PG).
-- The `modified_at` column is retained as a useful SQLite addition.

CREATE TABLE IF NOT EXISTS _fmo_backup_0019 AS SELECT * FROM file_media_object;

DROP TABLE file_media_object;

CREATE TABLE file_media_object (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  name TEXT NOT NULL DEFAULT '',
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  mtype TEXT NOT NULL DEFAULT '',
  media_id TEXT NOT NULL REFERENCES storage_object(id) ON DELETE RESTRICT,
  thumbnail_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL,
  modified_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fmo_file_id ON file_media_object(file_id);
CREATE INDEX IF NOT EXISTS idx_fmo_media_id ON file_media_object(media_id);
CREATE INDEX IF NOT EXISTS file_media_object__deleted_at__idx
    ON file_media_object(deleted_at, id)
    WHERE deleted_at IS NOT NULL;

INSERT INTO file_media_object (id, file_id, created_at, deleted_at, name, width, height, mtype, media_id, thumbnail_id, modified_at)
SELECT id, file_id, created_at, deleted_at, name, width, height, mtype, media_id, thumbnail_id, modified_at
FROM _fmo_backup_0019;

DROP TABLE _fmo_backup_0019;

-- ============================================================
-- 2. file_thumbnail: fix FK ON DELETE for storage_object and file refs
-- ============================================================
-- PG migration 0108: media_id FK changed to DEFERRABLE (no CASCADE).
-- PG migration 0108 also changed file_id FK to DEFERRABLE.
-- Storage objects must not be cascade-deleted; the deletion protection
-- triggers (0014) and storage GC handle cleanup.

CREATE TABLE IF NOT EXISTS _ft_backup_0019 AS SELECT * FROM file_thumbnail;

DROP TABLE file_thumbnail;

CREATE TABLE file_thumbnail (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  revn INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  data TEXT,
  props TEXT,
  media_id TEXT NOT NULL REFERENCES storage_object(id) ON DELETE RESTRICT,
  PRIMARY KEY (file_id, revn)
);

CREATE INDEX IF NOT EXISTS idx_ft_media_id ON file_thumbnail(media_id);
CREATE INDEX IF NOT EXISTS file_thumbnail__deleted_at__idx
    ON file_thumbnail(deleted_at, file_id, revn)
    WHERE deleted_at IS NOT NULL;

INSERT INTO file_thumbnail (file_id, revn, created_at, updated_at, deleted_at, data, props, media_id)
SELECT file_id, revn, created_at, updated_at, deleted_at, data, props, media_id
FROM _ft_backup_0019;

DROP TABLE _ft_backup_0019;

-- ============================================================
-- 3. file_tagged_object_thumbnail: fix FK ON DELETE
-- ============================================================
-- PG migration 0109: all FKs changed to DEFERRABLE (no CASCADE).
-- Same pattern as file_thumbnail.

CREATE TABLE IF NOT EXISTS _ftot_backup_0019 AS SELECT * FROM file_tagged_object_thumbnail;

DROP TABLE file_tagged_object_thumbnail;

CREATE TABLE file_tagged_object_thumbnail (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  object_id TEXT NOT NULL,
  media_id TEXT NOT NULL REFERENCES storage_object(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  PRIMARY KEY (file_id, tag, object_id)
);

CREATE INDEX IF NOT EXISTS idx_ftot_media_id ON file_tagged_object_thumbnail(media_id);
CREATE INDEX IF NOT EXISTS file_tagged_object_thumbnail__deleted_at__idx
    ON file_tagged_object_thumbnail(deleted_at)
    WHERE deleted_at IS NOT NULL;

INSERT INTO file_tagged_object_thumbnail (file_id, tag, object_id, media_id, created_at, updated_at, deleted_at)
SELECT file_id, tag, object_id, media_id, created_at, updated_at, deleted_at
FROM _ftot_backup_0019;

DROP TABLE _ftot_backup_0019;

-- ============================================================
-- 4. team_font_variant: fix storage_object FKs
-- ============================================================
-- PG migration 0113: all storage_object FKs changed to DEFERRABLE
-- (no SET NULL). This prevents orphaned font files when a storage_object
-- is deleted — the FK blocks the delete instead of silently nullifying
-- the reference.

CREATE TABLE IF NOT EXISTS _tfv_backup_0019 AS SELECT * FROM team_font_variant;

DROP TABLE team_font_variant;

CREATE TABLE team_font_variant (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES profile(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  font_id TEXT NOT NULL,
  font_family TEXT NOT NULL,
  font_weight INTEGER NOT NULL,
  font_style TEXT NOT NULL,
  variant_name TEXT,
  otf_file_id TEXT REFERENCES storage_object(id) ON DELETE RESTRICT,
  ttf_file_id TEXT REFERENCES storage_object(id) ON DELETE RESTRICT,
  woff1_file_id TEXT REFERENCES storage_object(id) ON DELETE RESTRICT,
  woff2_file_id TEXT REFERENCES storage_object(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_tfv_team_id ON team_font_variant(team_id);
CREATE INDEX IF NOT EXISTS team_font_variant__deleted_at__idx
    ON team_font_variant(deleted_at)
    WHERE deleted_at IS NOT NULL;

INSERT INTO team_font_variant (id, team_id, profile_id, created_at, modified_at, deleted_at, font_id, font_family, font_weight, font_style, variant_name, otf_file_id, ttf_file_id, woff1_file_id, woff2_file_id)
SELECT id, team_id, profile_id, created_at, modified_at, deleted_at, font_id, font_family, font_weight, font_style, variant_name, otf_file_id, ttf_file_id, woff1_file_id, woff2_file_id
FROM _tfv_backup_0019;

DROP TABLE _tfv_backup_0019;

-- ============================================================
-- 5. file_change: file_id FK RESTRICT (no CASCADE)
-- ============================================================
-- PG migration 0139: removed ON DELETE CASCADE from file_id FK.
-- Application handles file_change cleanup when deleting files.
-- The deletion protection triggers (0014) already prevent direct
-- file deletion, so this is a safety net.

CREATE TABLE IF NOT EXISTS _fc_backup_0019 AS SELECT * FROM file_change;

DROP TABLE file_change;

CREATE TABLE file_change (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE RESTRICT,
  page_id TEXT,
  profile_id TEXT REFERENCES profile(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  revn INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  data TEXT,
  changes TEXT,
  session_id TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  operations TEXT,
  features TEXT,
  data_backend TEXT,
  data_ref_id TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  deleted_at TEXT,
  locked_by TEXT,
  migrations TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_file_change_file_id ON file_change(file_id);
CREATE INDEX IF NOT EXISTS idx_fc_file_id ON file_change(file_id);
CREATE INDEX IF NOT EXISTS idx_fc_session_id ON file_change(session_id);
CREATE INDEX IF NOT EXISTS idx_fc_profile_id ON file_change(profile_id);
CREATE INDEX IF NOT EXISTS file_change__file_id__revn__idx
    ON file_change(file_id, revn);
CREATE INDEX IF NOT EXISTS file_change__deleted_at__idx
    ON file_change(deleted_at, id)
    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS file_change__system_snapshots__idx
    ON file_change(file_id, created_at)
    WHERE data IS NOT NULL AND created_by = 'system' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS file_change__profile_id__partial__idx
    ON file_change(profile_id)
    WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS file_change__label__idx
    ON file_change(file_id, label)
    WHERE label IS NOT NULL;
CREATE INDEX IF NOT EXISTS file_change__data_ref_id__idx
    ON file_change(data_ref_id)
    WHERE data_ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS file_change__locked_by__idx
    ON file_change(locked_by)
    WHERE locked_by IS NOT NULL;

INSERT INTO file_change (id, file_id, page_id, profile_id, created_at, modified_at, revn, label, data, changes, session_id, version, operations, features, data_backend, data_ref_id, created_by, deleted_at, locked_by, migrations, updated_at)
SELECT id, file_id, page_id, profile_id, created_at, modified_at, revn, label, data, changes, session_id, version, operations, features, data_backend, data_ref_id, created_by, deleted_at, locked_by, migrations, updated_at
FROM _fc_backup_0019;

DROP TABLE _fc_backup_0019;

-- ============================================================
-- 6. file_data: file_id FK RESTRICT (no CASCADE)
-- ============================================================
-- PG migration 0141: file_id FK is DEFERRABLE with no explicit ON DELETE.
-- Application handles file_data cleanup via storage GC.

CREATE TABLE IF NOT EXISTS _fd_backup_0019 AS SELECT * FROM file_data;

DROP TABLE file_data;

CREATE TABLE file_data (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  type TEXT NOT NULL DEFAULT 'main',
  backend TEXT,
  metadata TEXT DEFAULT '{}',
  data BLOB,
  PRIMARY KEY (file_id, id)
);

CREATE INDEX IF NOT EXISTS idx_fd_data_file_id ON file_data(file_id);
CREATE INDEX IF NOT EXISTS file_data__deleted_at__idx
    ON file_data(deleted_at, file_id, id)
    WHERE deleted_at IS NOT NULL;

INSERT INTO file_data (file_id, id, created_at, modified_at, deleted_at, type, backend, metadata, data)
SELECT file_id, id, created_at, modified_at, deleted_at, type, backend, metadata, data
FROM _fd_backup_0019;

DROP TABLE _fd_backup_0019;

-- ============================================================
-- 7. http_session_v2: sso_provider_id FK ON DELETE CASCADE
-- ============================================================
-- PG migration 0143: sso_provider_id FK is ON DELETE CASCADE.
-- When an SSO provider is deleted, its sessions should be cleaned up.

CREATE TABLE IF NOT EXISTS _hsv2_backup_0019 AS SELECT * FROM http_session_v2;

DROP TABLE http_session_v2;

CREATE TABLE http_session_v2 (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  profile_id TEXT REFERENCES profile(id) ON DELETE CASCADE,
  user_agent TEXT,
  sso_provider_id TEXT REFERENCES sso_provider(id) ON DELETE CASCADE,
  sso_session_id TEXT,
  expires_at TEXT NOT NULL DEFAULT '2099-12-31T00:00:00Z',
  prev_session_id TEXT REFERENCES http_session_v2(id) ON DELETE SET NULL
);

INSERT INTO http_session_v2 (id, created_at, modified_at, profile_id, user_agent, sso_provider_id, sso_session_id, expires_at, prev_session_id)
SELECT id, created_at, modified_at, profile_id, user_agent, sso_provider_id, sso_session_id, expires_at, prev_session_id
FROM _hsv2_backup_0019;

DROP TABLE _hsv2_backup_0019;

-- ============================================================
-- 8. comment_thread: position and participants NOT NULL
-- ============================================================
-- PG migration 0031: position point NOT NULL, participants jsonb NOT NULL.

UPDATE comment_thread SET position = '{}' WHERE position IS NULL;
UPDATE comment_thread SET participants = '[]' WHERE participants IS NULL;

CREATE TABLE IF NOT EXISTS _ct_backup_0019 AS SELECT * FROM comment_thread;

DROP TABLE comment_thread;

CREATE TABLE comment_thread (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  page_id TEXT NOT NULL,
  participants TEXT NOT NULL DEFAULT '[]',
  seqn INTEGER NOT NULL DEFAULT 0,
  is_resolved TEXT NOT NULL DEFAULT '0',
  position TEXT NOT NULL DEFAULT '{}',
  page_name TEXT,
  frame_id TEXT DEFAULT '00000000-0000-0000-0000-000000000000',
  mentions TEXT DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS comment_thread__file_id__idx ON comment_thread(file_id);
CREATE INDEX IF NOT EXISTS comment_thread__owner_id__idx ON comment_thread(owner_id);
CREATE INDEX IF NOT EXISTS comment_thread__is_resolved__idx
    ON comment_thread(is_resolved)
    WHERE is_resolved = '0';

INSERT INTO comment_thread (id, file_id, owner_id, created_at, modified_at, page_id, participants, seqn, is_resolved, position, page_name, frame_id, mentions)
SELECT id, file_id, owner_id, created_at, modified_at, page_id, COALESCE(participants, '[]'), seqn, is_resolved, COALESCE(position, '{}'), page_name, COALESCE(frame_id, '00000000-0000-0000-0000-000000000000'), COALESCE(mentions, '[]')
FROM _ct_backup_0019;

DROP TABLE _ct_backup_0019;