-- 0004: Full PostgreSQL schema parity
-- Adds all missing tables and columns to match the Clojure backend's PostgreSQL schema.
-- Type mapping: uuid->TEXT, boolean->TEXT('0'/'1'), jsonb->TEXT, bytea->BLOB, text[]->TEXT, timestamptz->TEXT, smallint/int/bigint->INTEGER, point->TEXT

-- ============================================================
-- MISSING COLUMNS ON EXISTING TABLES
-- ============================================================

-- profile: add missing columns from PG migrations 0034, 0036, 0046, 0079, 0100
ALTER TABLE profile ADD COLUMN auth_backend TEXT;
ALTER TABLE profile ADD COLUMN props TEXT DEFAULT '{}';
ALTER TABLE profile ADD COLUMN photo_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL;
ALTER TABLE profile ADD COLUMN default_project_id TEXT REFERENCES project(id) ON DELETE SET NULL;
ALTER TABLE profile ADD COLUMN default_team_id TEXT REFERENCES team(id) ON DELETE SET NULL;
ALTER TABLE profile ADD COLUMN is_muted TEXT NOT NULL DEFAULT '0';

-- team: add photo_id (PG migration 0036, replaces photo column dropped 0043)
ALTER TABLE team ADD COLUMN photo_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL;

-- team_profile_rel: add uuid PK (PG migration 0088)
-- SQLite doesn't support adding a PK to existing table, so we add the column
ALTER TABLE team_profile_rel ADD COLUMN id TEXT;

-- file: add missing columns from PG migrations
ALTER TABLE file ADD COLUMN comment_thread_seqn INTEGER NOT NULL DEFAULT 0;
ALTER TABLE file ADD COLUMN ignore_sync_until TEXT;
ALTER TABLE file ADD COLUMN data_backend TEXT;
ALTER TABLE file ADD COLUMN data_ref_id TEXT;
ALTER TABLE file ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE file ADD COLUMN vern INTEGER NOT NULL DEFAULT 0;

-- page: add missing columns
ALTER TABLE page ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE page ADD COLUMN share_token TEXT;

-- file_change: add missing columns from PG migrations
ALTER TABLE file_change ADD COLUMN features TEXT;
ALTER TABLE file_change ADD COLUMN data_backend TEXT;
ALTER TABLE file_change ADD COLUMN data_ref_id TEXT;
ALTER TABLE file_change ADD COLUMN created_by TEXT;
ALTER TABLE file_change ADD COLUMN deleted_at TEXT;
ALTER TABLE file_change ADD COLUMN locked_by TEXT;
ALTER TABLE file_change ADD COLUMN migrations TEXT;

-- http_session: add updated_at (PG migration 0049)
ALTER TABLE http_session ADD COLUMN updated_at TEXT;

-- task: add missing columns
ALTER TABLE task ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3;
ALTER TABLE task ADD COLUMN label TEXT;

-- comment_thread: add missing columns
ALTER TABLE comment_thread ADD COLUMN page_name TEXT;
ALTER TABLE comment_thread ADD COLUMN frame_id TEXT;
ALTER TABLE comment_thread ADD COLUMN mentions TEXT;

-- comment: add mentions column
ALTER TABLE comment ADD COLUMN mentions TEXT;

-- team_invitation: add missing columns (id as PK, created_by, org_id)
-- We need to recreate this table to add the PK column properly
-- First save data, then recreate
ALTER TABLE team_invitation ADD COLUMN id TEXT;
ALTER TABLE team_invitation ADD COLUMN created_by TEXT;
ALTER TABLE team_invitation ADD COLUMN org_id TEXT;

-- share_link: add missing columns to match PG schema
ALTER TABLE share_link ADD COLUMN owner_id TEXT REFERENCES profile(id) ON DELETE SET NULL;
ALTER TABLE share_link ADD COLUMN pages TEXT;
ALTER TABLE share_link ADD COLUMN flags TEXT;
ALTER TABLE share_link ADD COLUMN who_comment TEXT;
ALTER TABLE share_link ADD COLUMN who_inspect TEXT;

-- access_token: add missing columns
ALTER TABLE access_token ADD COLUMN expires_at TEXT;
ALTER TABLE access_token ADD COLUMN type TEXT NOT NULL DEFAULT 'personal';

-- webhook: add profile_id
ALTER TABLE webhook ADD COLUMN profile_id TEXT REFERENCES profile(id) ON DELETE SET NULL;

-- audit_log: add missing columns
ALTER TABLE audit_log ADD COLUMN name TEXT;
ALTER TABLE audit_log ADD COLUMN archived_at TEXT;
ALTER TABLE audit_log ADD COLUMN props TEXT DEFAULT '{}';
ALTER TABLE audit_log ADD COLUMN source TEXT;
ALTER TABLE audit_log ADD COLUMN tracked_at TEXT;

-- server_prop: add preload column
ALTER TABLE server_prop ADD COLUMN is_preloaded TEXT NOT NULL DEFAULT '0';

-- file_data_fragment: add missing columns and rename content -> data
-- SQLite doesn't support DROP COLUMN, so we add the new columns
ALTER TABLE file_data_fragment ADD COLUMN data BLOB;
ALTER TABLE file_data_fragment ADD COLUMN data_backend TEXT;
ALTER TABLE file_data_fragment ADD COLUMN data_ref_id TEXT;
ALTER TABLE file_data_fragment ADD COLUMN deleted_at TEXT;
ALTER TABLE file_data_fragment ADD COLUMN modified_at TEXT;

-- Populate data from content column into data column for existing rows
UPDATE file_data_fragment SET data = content WHERE data IS NULL AND content IS NOT NULL;

-- ============================================================
-- MISSING TABLES
-- ============================================================

-- file_profile_rel: Junction table for file-profile permissions
CREATE TABLE IF NOT EXISTS file_profile_rel (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_owner TEXT NOT NULL DEFAULT '0',
  is_admin TEXT NOT NULL DEFAULT '0',
  can_edit TEXT NOT NULL DEFAULT '1',
  PRIMARY KEY (file_id, profile_id)
);

-- file_library_rel: Junction table linking files to their libraries
CREATE TABLE IF NOT EXISTS file_library_rel (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  library_file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  PRIMARY KEY (file_id, library_file_id)
);
CREATE INDEX IF NOT EXISTS idx_flr_library_file_id ON file_library_rel(library_file_id);

-- file_library_sync: Tracks library sync timestamps (PG migration 0149)
CREATE TABLE IF NOT EXISTS file_library_sync (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  library_file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (file_id, library_file_id)
);

-- file_data: Main file data storage (PG migration 0141)
CREATE TABLE IF NOT EXISTS file_data (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  type TEXT,
  backend TEXT NOT NULL DEFAULT 'db',
  metadata TEXT DEFAULT '{}',
  data BLOB,
  PRIMARY KEY (file_id, id)
);
CREATE INDEX IF NOT EXISTS idx_fd_data_file_id ON file_data(file_id);

-- file_migration: Track file data migrations (PG migration 0137)
CREATE TABLE IF NOT EXISTS file_migration (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (file_id, name)
);

-- http_session_v2: SSO-aware sessions (PG migration 0143)
CREATE TABLE IF NOT EXISTS http_session_v2 (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  profile_id TEXT REFERENCES profile(id) ON DELETE CASCADE,
  user_agent TEXT,
  sso_provider_id TEXT REFERENCES sso_provider(id) ON DELETE SET NULL,
  sso_session_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_hs2_profile ON http_session_v2(profile_id);

-- team_project_profile_rel: Junction for team-project-profile (PG migration 0028)
CREATE TABLE IF NOT EXISTS team_project_profile_rel (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_pinned TEXT NOT NULL DEFAULT '0',
  is_owner TEXT NOT NULL DEFAULT '0',
  is_admin TEXT NOT NULL DEFAULT '0',
  can_edit TEXT NOT NULL DEFAULT '1'
);
CREATE INDEX IF NOT EXISTS idx_tpr_team ON team_project_profile_rel(team_id);
CREATE INDEX IF NOT EXISTS idx_tpr_profile ON team_project_profile_rel(profile_id);
CREATE INDEX IF NOT EXISTS idx_tpr_project ON team_project_profile_rel(project_id);

-- comment_thread_status: Tracks which profiles have read which threads (PG migration 0031)
CREATE TABLE IF NOT EXISTS comment_thread_status (
  thread_id TEXT NOT NULL REFERENCES comment_thread(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (thread_id, profile_id)
);

-- usage_quote: Per-profile/team/file usage quotas (PG migration 0098)
CREATE TABLE IF NOT EXISTS usage_quote (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  quote INTEGER NOT NULL DEFAULT 0,
  profile_id TEXT REFERENCES profile(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES project(id) ON DELETE SET NULL,
  team_id TEXT REFERENCES team(id) ON DELETE SET NULL,
  file_id TEXT REFERENCES file(id) ON DELETE SET NULL
);

-- webhook_delivery: Webhook delivery log (PG migration 0086)
CREATE TABLE IF NOT EXISTS webhook_delivery (
  webhook_id TEXT NOT NULL REFERENCES webhook(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  error_code TEXT,
  req_data TEXT,
  rsp_data TEXT,
  PRIMARY KEY (webhook_id, created_at)
);

-- server_error_report: Track server errors (PG migration 0040)
CREATE TABLE IF NOT EXISTS server_error_report (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  content TEXT DEFAULT '{}',
  version INTEGER
);

-- scheduled_task: Background task scheduling (PG migrations 0004 + 0019)
CREATE TABLE IF NOT EXISTS scheduled_task (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  cron_expr TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_task_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES scheduled_task(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_error TEXT NOT NULL DEFAULT '0',
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_sth_task_id ON scheduled_task_history(task_id);

-- pending_to_delete: Queue for cascade deletion (PG migration 0001)
CREATE TABLE IF NOT EXISTS pending_to_delete (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL,
  data TEXT DEFAULT '{}'
);

-- profile_complaint_report: Profile complaint tracking (PG migration 0046)
CREATE TABLE IF NOT EXISTS profile_complaint_report (
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL,
  content TEXT DEFAULT '{}',
  PRIMARY KEY (profile_id, created_at)
);

-- global_complaint_report: Global email complaint tracking (PG migration 0046)
CREATE TABLE IF NOT EXISTS global_complaint_report (
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL,
  content TEXT DEFAULT '{}',
  PRIMARY KEY (email, created_at)
);

-- ============================================================
-- INDEXES for new and existing tables
-- ============================================================

-- Additional indexes for file table
CREATE INDEX IF NOT EXISTS idx_file_data_backend ON file(data_backend) WHERE data_backend IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_version ON file(version);

-- Additional indexes for file_change
CREATE INDEX IF NOT EXISTS idx_fc_file_id ON file_change(file_id);
CREATE INDEX IF NOT EXISTS idx_fc_session_id ON file_change(session_id);
CREATE INDEX IF NOT EXISTS idx_fc_profile_id ON file_change(profile_id);

-- Additional indexes for profile
CREATE INDEX IF NOT EXISTS idx_profile_photo_id ON profile(photo_id) WHERE photo_id IS NOT NULL;

-- Additional indexes for team
CREATE INDEX IF NOT EXISTS idx_team_photo_id ON team(photo_id) WHERE photo_id IS NOT NULL;

-- Additional indexes for share_link
CREATE INDEX IF NOT EXISTS idx_sl_file_id ON share_link(file_id);
CREATE INDEX IF NOT EXISTS idx_sl_token ON share_link(token);

-- Additional indexes for comment_thread
CREATE INDEX IF NOT EXISTS idx_ct_file_id ON comment_thread(file_id);
CREATE INDEX IF NOT EXISTS idx_ct_page_id ON comment_thread(page_id);

-- (Indexes for access_token, comment_thread, and other tables with added columns
--  are in migration 0006 to avoid SQLite schema visibility issues.)

-- ============================================================
-- DATA MIGRATIONS
-- ============================================================

-- Generate UUIDs for team_invitation rows that lack them
UPDATE team_invitation SET id = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))) WHERE id IS NULL;

-- Migrate profile.photo (file path) to photo_id (storage object reference)
-- The photo column currently stores file paths, but PG uses photo_id referencing storage_object
-- This is a no-op migration as the data model has diverged; the photo column
-- remains for backward compatibility with existing Node.js data.