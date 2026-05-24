-- 0003: Add file_snapshot table and email verification support

CREATE TABLE IF NOT EXISTS file_snapshot (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  label TEXT NOT NULL DEFAULT '',
  revn INTEGER NOT NULL DEFAULT 0,
  is_locked TEXT NOT NULL DEFAULT '0',
  data TEXT
);
CREATE INDEX IF NOT EXISTS idx_file_snapshot_file_id ON file_snapshot(file_id);

-- Add email verification columns to profile
ALTER TABLE profile ADD COLUMN is_email_verified TEXT NOT NULL DEFAULT '0';