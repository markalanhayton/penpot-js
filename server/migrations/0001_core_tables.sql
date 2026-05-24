-- 0001: Core tables - SQLite compatible
-- Replaces PostgreSQL migrations 0001-0031 with SQLite equivalents

CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  fullname TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  photo TEXT,
  password TEXT,
  lang TEXT NOT NULL DEFAULT 'en',
  theme TEXT NOT NULL DEFAULT 'default',
  is_active TEXT NOT NULL DEFAULT '1',
  is_demo TEXT NOT NULL DEFAULT '0',
  is_blocked TEXT NOT NULL DEFAULT '0',
  auth_source TEXT,
  last_activity_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_email ON profile(email) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS team (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  name TEXT NOT NULL DEFAULT '',
  photo TEXT,
  is_default TEXT NOT NULL DEFAULT '0',
  allow_comments TEXT NOT NULL DEFAULT '1',
  allow_multifactor TEXT NOT NULL DEFAULT '0',
  invite_link TEXT,
  features TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS team_profile_rel (
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_admin TEXT NOT NULL DEFAULT '0',
  is_owner TEXT NOT NULL DEFAULT '0',
  can_edit TEXT NOT NULL DEFAULT '1',
  is_member TEXT NOT NULL DEFAULT '1',
  PRIMARY KEY (team_id, profile_id)
);

CREATE TABLE IF NOT EXISTS project (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  name TEXT NOT NULL DEFAULT '',
  is_default TEXT NOT NULL DEFAULT '0',
  project_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS file (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  name TEXT NOT NULL DEFAULT '',
  is_shared TEXT NOT NULL DEFAULT '0',
  revn INTEGER NOT NULL DEFAULT 0,
  features TEXT DEFAULT '{}',
  fonts TEXT DEFAULT '[]',
  data TEXT
);
CREATE INDEX IF NOT EXISTS idx_file_project_id ON file(project_id);

CREATE TABLE IF NOT EXISTS page (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  name TEXT NOT NULL DEFAULT '',
  revn INTEGER NOT NULL DEFAULT 0,
  ordering INTEGER NOT NULL DEFAULT 0,
  data TEXT,
  sha TEXT
);
CREATE INDEX IF NOT EXISTS idx_page_file_id ON page(file_id);

CREATE TABLE IF NOT EXISTS file_change (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
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
  operations TEXT
);
CREATE INDEX IF NOT EXISTS idx_file_change_file_id ON file_change(file_id);

CREATE TABLE IF NOT EXISTS http_session (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  user_agent TEXT,
  is_active TEXT NOT NULL DEFAULT '1'
);
CREATE INDEX IF NOT EXISTS idx_http_session_profile ON http_session(profile_id);

CREATE TABLE IF NOT EXISTS generic_token (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  valid_until TEXT,
  content TEXT
);

CREATE TABLE IF NOT EXISTS file_image (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  name TEXT NOT NULL DEFAULT '',
  path TEXT,
  width INTEGER,
  height INTEGER,
  mtype TEXT,
  thumb_path TEXT,
  thumb_width INTEGER,
  thumb_height INTEGER,
  thumb_quality INTEGER,
  thumb_mtype TEXT
);
CREATE INDEX IF NOT EXISTS idx_file_image_file_id ON file_image(file_id);

CREATE TABLE IF NOT EXISTS storage_object (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  backend TEXT NOT NULL DEFAULT 'fs',
  metadata TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_storage_object_deleted ON storage_object(deleted_at);

CREATE TABLE IF NOT EXISTS storage_data (
  id TEXT PRIMARY KEY REFERENCES storage_object(id) ON DELETE CASCADE,
  data BLOB
);

CREATE TABLE IF NOT EXISTS task (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  scheduled_at TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  queue TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL DEFAULT '',
  props TEXT,
  error TEXT,
  retry_num INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS idx_task_status ON task(status);

CREATE TABLE IF NOT EXISTS comment_thread (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  page_id TEXT,
  participants TEXT DEFAULT '[]',
  seqn INTEGER NOT NULL DEFAULT 0,
  is_resolved TEXT NOT NULL DEFAULT '0',
  position TEXT
);
CREATE INDEX IF NOT EXISTS idx_comment_thread_file ON comment_thread(file_id);

CREATE TABLE IF NOT EXISTS comment (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES comment_thread(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  content TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS team_invitation (
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  email_to TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (team_id, email_to)
);

CREATE TABLE IF NOT EXISTS share_link (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  token TEXT NOT NULL UNIQUE,
  permissions TEXT DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_share_link_token ON share_link(token);

CREATE TABLE IF NOT EXISTS access_token (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE,
  perms TEXT DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_access_token_token ON access_token(token);

CREATE TABLE IF NOT EXISTS webhook (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  uri TEXT NOT NULL,
  mtype TEXT DEFAULT 'application/json',
  error_code TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  is_active TEXT NOT NULL DEFAULT '1',
  secret_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_webhook_team ON webhook(team_id);

CREATE TABLE IF NOT EXISTS presence (
  file_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (file_id, session_id, profile_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  profile_id TEXT REFERENCES profile(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  data TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_audit_log_type ON audit_log(type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS server_prop (
  id TEXT PRIMARY KEY,
  content TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS sso_provider (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_enabled TEXT NOT NULL DEFAULT '0',
  type TEXT NOT NULL DEFAULT 'oidc',
  domain TEXT UNIQUE,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  base_uri TEXT,
  token_uri TEXT,
  auth_uri TEXT,
  user_uri TEXT,
  jwks_uri TEXT,
  logout_uri TEXT,
  roles_attr TEXT,
  email_attr TEXT,
  name_attr TEXT,
  user_info_source TEXT DEFAULT 'token',
  scopes TEXT DEFAULT '[]',
  roles TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS file_data_fragment (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}',
  content BLOB,
  PRIMARY KEY (file_id, id)
);

CREATE TABLE IF NOT EXISTS font_variant (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES profile(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  font_id TEXT,
  font_family TEXT,
  font_weight INTEGER,
  font_style TEXT,
  otf_file_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL,
  ttf_file_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL,
  woff1_file_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL,
  woff2_file_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_font_variant_team ON font_variant(team_id);

CREATE TABLE IF NOT EXISTS upload_session (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  total_chunks INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS team_access_request (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  valid_until TEXT,
  auto_join_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_id, requester_id)
);