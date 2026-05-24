-- 0020: Final parity cleanup — obsolete tables, FK fixes, NOT NULL constraints,
--        default corrections, and missing indexes
--
-- Addresses the last remaining PG schema gaps after 19 migrations:
--
-- 1. Drop obsolete tables: pending_to_delete (PG 0037), storage_pending (PG 0096)
-- 2. file_object_thumbnail: FK corrections (PG 0117)
-- 3. file_profile_rel / team_profile_rel: can_edit default false (PG 0002/0003)
-- 4. team_access_request: valid_until and auto_join_until NOT NULL (PG 0126)
-- 5. audit_log.tracked_at: add DEFAULT (PG 0064)
-- 6. task: add scheduled_at queue partial index (PG 0015)
-- 7. project: add team_id index (PG 0003)
-- 8. team_font_variant: add composite team_id+font_id index (PG 0053)

-- ============================================================
-- 1. Drop obsolete tables
-- ============================================================
-- PG migration 0037 dropped pending_to_delete (replaced by direct CASCADE deletion).
-- PG migration 0096 dropped storage_pending (replaced by storage_object GC).
-- Neither table is referenced by any application code.

DROP TABLE IF EXISTS pending_to_delete;
DROP TABLE IF EXISTS storage_pending;

-- ============================================================
-- 2. file_object_thumbnail: fix FK ON DELETE
-- ============================================================
-- PG migration 0117 changed both FKs to DEFERRABLE (no CASCADE/SET NULL).
-- file_id should use RESTRICT (prevent deleting file while thumbnails exist).
-- media_id should use RESTRICT (prevent deleting storage_object while referenced).

CREATE TABLE IF NOT EXISTS _fot_backup_0020 AS SELECT * FROM file_object_thumbnail;

DROP TABLE file_object_thumbnail;

CREATE TABLE file_object_thumbnail (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE RESTRICT,
  object_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  data TEXT,
  media_id TEXT REFERENCES storage_object(id) ON DELETE RESTRICT,
  PRIMARY KEY (file_id, object_id)
);

INSERT INTO file_object_thumbnail (file_id, object_id, created_at, data, media_id)
SELECT file_id, object_id, created_at, data, media_id
FROM _fot_backup_0020;

DROP TABLE _fot_backup_0020;

-- ============================================================
-- 3. file_profile_rel / team_profile_rel: can_edit DEFAULT '0' (false)
-- ============================================================
-- PG migration 0002 and 0003 create both tables with can_edit DEFAULT false.
-- Our SQLite has can_edit DEFAULT '1' (true), meaning new memberships
-- default to edit access in SQLite but not in PG. This is a significant
-- behavioral difference for authorization.
-- We also recreate to fix file_profile_rel PK order to match PG
-- (profile_id, file_id) vs our (file_id, profile_id).

-- file_profile_rel: recreate with corrected defaults
UPDATE file_profile_rel SET can_edit = '0' WHERE can_edit = '1' AND is_owner = '0' AND is_admin = '0';

CREATE TABLE IF NOT EXISTS _fpr_backup_0020 AS SELECT * FROM file_profile_rel;

DROP TABLE file_profile_rel;

CREATE TABLE file_profile_rel (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_owner TEXT NOT NULL DEFAULT '0',
  is_admin TEXT NOT NULL DEFAULT '0',
  can_edit TEXT NOT NULL DEFAULT '0',
  PRIMARY KEY (file_id, profile_id)
);

CREATE INDEX IF NOT EXISTS file_profile_rel__profile_id__idx ON file_profile_rel(profile_id);
CREATE INDEX IF NOT EXISTS file_profile_rel__file_id__idx ON file_profile_rel(file_id);

INSERT INTO file_profile_rel (file_id, profile_id, created_at, modified_at, is_owner, is_admin, can_edit)
SELECT file_id, profile_id, created_at, modified_at, is_owner, is_admin, can_edit
FROM _fpr_backup_0020;

DROP TABLE _fpr_backup_0020;

-- team_profile_rel: recreate with corrected can_edit default
UPDATE team_profile_rel SET can_edit = '0' WHERE can_edit = '1' AND is_owner = '0' AND is_admin = '0';

CREATE TABLE IF NOT EXISTS _tpr_backup_0020 AS SELECT * FROM team_profile_rel;

DROP TABLE team_profile_rel;

CREATE TABLE team_profile_rel (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_admin TEXT NOT NULL DEFAULT '0',
  is_owner TEXT NOT NULL DEFAULT '0',
  can_edit TEXT NOT NULL DEFAULT '0',
  is_member TEXT NOT NULL DEFAULT '1',
  UNIQUE (team_id, profile_id)
);

CREATE INDEX IF NOT EXISTS team_profile_rel__team_id__idx ON team_profile_rel(team_id);
CREATE INDEX IF NOT EXISTS team_profile_rel__profile_id__idx ON team_profile_rel(profile_id);

INSERT INTO team_profile_rel (id, team_id, profile_id, created_at, modified_at, is_admin, is_owner, can_edit, is_member)
SELECT id, team_id, profile_id, created_at, modified_at, is_admin, is_owner, can_edit, is_member
FROM _tpr_backup_0020;

DROP TABLE _tpr_backup_0020;

-- ============================================================
-- 4. team_access_request: valid_until and auto_join_until NOT NULL
-- ============================================================
-- PG migration 0126 creates both columns as NOT NULL.

UPDATE team_access_request SET valid_until = '2099-12-31T00:00:00Z' WHERE valid_until IS NULL;
UPDATE team_access_request SET auto_join_until = '2099-12-31T00:00:00Z' WHERE auto_join_until IS NULL;

CREATE TABLE IF NOT EXISTS _tar_backup_0020 AS SELECT * FROM team_access_request;

DROP TABLE team_access_request;

CREATE TABLE team_access_request (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  requester_id TEXT REFERENCES profile(id) ON DELETE CASCADE,
  valid_until TEXT NOT NULL,
  auto_join_until TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (team_id, requester_id)
);

INSERT INTO team_access_request (id, team_id, requester_id, valid_until, auto_join_until, created_at, updated_at)
SELECT id, team_id, requester_id, COALESCE(valid_until, '2099-12-31T00:00:00Z'), COALESCE(auto_join_until, '2099-12-31T00:00:00Z'), created_at, updated_at
FROM _tar_backup_0020;

DROP TABLE _tar_backup_0020;

-- ============================================================
-- 5. audit_log.tracked_at: add DEFAULT
-- ============================================================
-- PG migration 0064 added tracked_at with DEFAULT clock_timestamp().
-- SQLite can't ALTER column defaults, so we recreate.
-- Also takes the opportunity to add profile_id NOT NULL since PG 0054
-- has it as NOT NULL (matches audit trail integrity requirements).

UPDATE audit_log SET tracked_at = created_at WHERE tracked_at IS NULL;

CREATE TABLE IF NOT EXISTS _al_backup_0020 AS SELECT * FROM audit_log;

DROP TABLE audit_log;

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  data TEXT DEFAULT '{}',
  ip_addr TEXT,
  archived_at TEXT,
  props TEXT DEFAULT '{}',
  source TEXT,
  tracked_at TEXT DEFAULT (datetime('now')),
  context TEXT
);

CREATE INDEX IF NOT EXISTS audit_log__created_at__unarchived__idx
    ON audit_log(created_at)
    WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS audit_log__archived_at__idx
    ON audit_log(archived_at)
    WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_log__source__created_at__idx
    ON audit_log(source, created_at);
CREATE INDEX IF NOT EXISTS audit_log__id_archived_at__idx
    ON audit_log(id, archived_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_type ON audit_log(type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

INSERT INTO audit_log (id, created_at, profile_id, type, name, data, ip_addr, archived_at, props, source, tracked_at, context)
SELECT id, created_at, profile_id, type, name, data, ip_addr, archived_at, props, source, COALESCE(tracked_at, created_at), context
FROM _al_backup_0020;

DROP TABLE _al_backup_0020;

-- ============================================================
-- 6. Missing indexes for query performance
-- ============================================================

-- project: team_id lookup (PG migration 0003)
CREATE INDEX IF NOT EXISTS project__team_id__idx ON project(team_id);

-- task: scheduled_at queue partial (PG migration 0015)
CREATE INDEX IF NOT EXISTS task__scheduled_at_queue__idx
    ON task(scheduled_at, queue)
    WHERE status IN ('new', 'retry');

-- team_font_variant: composite team+font lookup (PG migration 0053)
CREATE INDEX IF NOT EXISTS team_font_variant__team_id_font_id__idx
    ON team_font_variant(team_id, font_id);