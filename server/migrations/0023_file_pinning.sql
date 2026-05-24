-- 0023: Add is_pinned column to file_project_profile_rel for per-user file pinning.
--
-- Mirrors the PG upstream's file pinning feature. Each user can pin/unpin files
-- within a project. Pinned files appear at the top of the file list.

CREATE TABLE IF NOT EXISTS file_project_profile_rel (
  file_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  is_pinned TEXT NOT NULL DEFAULT '0',
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (file_id, project_id, profile_id),
  FOREIGN KEY (file_id) REFERENCES file(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profile(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_project_profile_rel_profile ON file_project_profile_rel(profile_id);
CREATE INDEX IF NOT EXISTS idx_file_project_profile_rel_project ON file_project_profile_rel(project_id, profile_id);