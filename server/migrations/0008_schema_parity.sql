-- 0008: Schema parity — add missing tables, columns, and constraints
-- Adds tables/columns present in the PostgreSQL backend that are absent from SQLite.

-- ============================================================
-- MISSING TABLES
-- ============================================================

-- project_profile_rel: Junction table for project-profile permissions
-- (PG migration 0003, modified 0089 to add uuid PK)
CREATE TABLE IF NOT EXISTS project_profile_rel (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_owner TEXT NOT NULL DEFAULT '0',
  is_admin TEXT NOT NULL DEFAULT '0',
  can_edit TEXT NOT NULL DEFAULT '0',
  UNIQUE (project_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_ppr_profile_id ON project_profile_rel(profile_id);
CREATE INDEX IF NOT EXISTS idx_ppr_project_id ON project_profile_rel(project_id);

-- file_object_thumbnail: Per-object thumbnails (PG migration 0071)
CREATE TABLE IF NOT EXISTS file_object_thumbnail (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  object_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  data TEXT,
  PRIMARY KEY (file_id, object_id)
);

-- file_tagged_object_thumbnail: Tagged object thumbnails (PG migration 0106)
CREATE TABLE IF NOT EXISTS file_tagged_object_thumbnail (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  tag TEXT NOT NULL DEFAULT 'frame',
  object_id TEXT NOT NULL,
  media_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  PRIMARY KEY (file_id, tag, object_id)
);
CREATE INDEX IF NOT EXISTS idx_ftot_media_id ON file_tagged_object_thumbnail(media_id);
CREATE INDEX IF NOT EXISTS idx_ftot_deleted ON file_tagged_object_thumbnail(deleted_at, file_id, object_id, media_id);

-- sso_provider: SSO/OIDC provider configuration (PG migration 0142)
CREATE TABLE IF NOT EXISTS sso_provider (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_enabled TEXT NOT NULL DEFAULT '1',
  type TEXT NOT NULL DEFAULT 'oidc',
  domain TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  base_uri TEXT NOT NULL,
  token_uri TEXT,
  auth_uri TEXT,
  user_uri TEXT,
  jwks_uri TEXT,
  logout_uri TEXT,
  roles_attr TEXT,
  email_attr TEXT,
  name_attr TEXT,
  user_info_source TEXT NOT NULL DEFAULT 'auto',
  scopes TEXT,
  roles TEXT,
  CHECK (type IN ('oidc')),
  CHECK (user_info_source IN ('token', 'userinfo', 'auto'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sso_domain ON sso_provider(domain);

-- ============================================================
-- MISSING COLUMNS
-- ============================================================

-- audit_log: add ip_addr (PG migration 0059)
ALTER TABLE audit_log ADD COLUMN ip_addr TEXT;

-- file_change: add updated_at (PG migration 0134)
ALTER TABLE file_change ADD COLUMN updated_at TEXT;

-- file_media_object: add modified_at (PG column)
ALTER TABLE file_media_object ADD COLUMN modified_at TEXT NOT NULL DEFAULT (datetime('now'));

-- team_invitation: add CHECK constraint (PG has CHECK team_id NOT NULL OR org_id NOT NULL)
-- SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we rely on application-level validation

-- file_data: make type NOT NULL to match PG
-- Can't easily ALTER to NOT NULL with defaults on existing rows; leave nullable for now

-- ============================================================
-- DROP OBSOLETE COLUMNS (SQLite doesn't support DROP COLUMN before 3.35.0)
-- These columns were dropped in PG but we keep them in SQLite for backward compat.
-- profile.photo — dropped in PG migration 0043 (replaced by photo_id)
-- team.photo — dropped in PG migration 0043 (replaced by photo_id)
-- storage_data table — dropped in PG migration 0095
-- We retain these for now since SQLite < 3.35 doesn't support DROP COLUMN
-- and the columns don't cause functional issues.
-- ============================================================

-- ============================================================
-- DROP OBSOLETE TABLE IF DESIRED (storage_data was dropped in PG 0095)
-- ============================================================
-- DROP TABLE IF EXISTS storage_data;
-- Uncomment above line if you want to remove the storage_data table entirely.