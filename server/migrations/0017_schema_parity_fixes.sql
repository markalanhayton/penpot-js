-- 0017: Schema parity fixes — NOT NULL constraints, index gaps, FK corrections
--
-- Addresses remaining PG parity gaps identified after migration 0016:
--
-- 1. file_data.backend should be NULL (PG has text NULL, not NOT NULL DEFAULT 'db')
-- 2. file_change.created_by should be NOT NULL DEFAULT 'system' (PG migration 0132)
-- 3. generic_token.content should be NOT NULL (PG migration 0016 changed to jsonb NOT NULL)
-- 4. webhook.mtype should be NOT NULL (PG schema has text NOT NULL)
-- 5. comment_thread.page_id should be NOT NULL (PG schema is uuid NOT NULL)
-- 6. Missing indexes: file_profile_rel(profile_id), file_library_rel(file_id), task(label, name, queue) WHERE status='new'
-- 7. file_library_rel.library_file_id FK should use ON DELETE RESTRICT (PG uses RESTRICT)
-- 8. scheduled_task_history composite PK (id, created_at) matching PG migration 0019

-- ============================================================
-- 1. file_data.backend: change NOT NULL DEFAULT 'db' to NULL
-- ============================================================
-- PG migration 0141 creates backend as `text NULL`. Our migration
-- 0016 made it NOT NULL DEFAULT 'db' which is incorrect. Now that
-- we recreate the table, we make it nullable to match PG.
-- NULL backend means "no backend assigned" (file data not yet stored).

UPDATE file_data SET backend = NULL WHERE backend = 'db' AND data IS NULL;

CREATE TABLE IF NOT EXISTS _fd_backup_0017 AS SELECT * FROM file_data;

DROP TABLE file_data;

CREATE TABLE file_data (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
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
FROM _fd_backup_0017;

DROP TABLE _fd_backup_0017;

-- ============================================================
-- 2. file_change.created_by: NOT NULL DEFAULT 'system'
-- ============================================================
-- PG migration 0132 added this column as NOT NULL DEFAULT 'system'.
-- Our migration 0004 added it as nullable TEXT.

UPDATE file_change SET created_by = 'system' WHERE created_by IS NULL;

-- SQLite doesn't support ALTER TABLE ... SET NOT NULL, so we recreate.
CREATE TABLE IF NOT EXISTS _fc_backup_0017 AS SELECT * FROM file_change;

DROP TABLE file_change;

CREATE TABLE file_change (
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

-- Recreate all indexes from migrations 0001, 0004, 0010
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
SELECT id, file_id, page_id, profile_id, created_at, modified_at, revn, label, data, changes, session_id, version, operations, features, data_backend, data_ref_id, COALESCE(created_by, 'system'), deleted_at, locked_by, migrations, updated_at
FROM _fc_backup_0017;

DROP TABLE _fc_backup_0017;

-- ============================================================
-- 3. generic_token.content: NOT NULL constraint
-- ============================================================
-- PG migration 0016 changed content from bytea to jsonb NOT NULL.
-- PG migration 0025 later DROPPED the entire table. However, since
-- our SQLite backend still uses generic_token for password reset
-- tokens etc., we keep the table but add the NOT NULL constraint.

UPDATE generic_token SET content = '{}' WHERE content IS NULL;

-- Table recreation needed for NOT NULL constraint
CREATE TABLE IF NOT EXISTS _gt_backup_0017 AS SELECT * FROM generic_token;

DROP TABLE generic_token;

CREATE TABLE generic_token (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  valid_until TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '{}'
);

INSERT INTO generic_token (token, created_at, valid_until, content)
SELECT token, created_at, valid_until, COALESCE(content, '{}')
FROM _gt_backup_0017;

DROP TABLE _gt_backup_0017;

-- ============================================================
-- 4. webhook.mtype: NOT NULL (PG has text NOT NULL)
-- ============================================================
-- The PG schema defines mtype as NOT NULL. It was created with
-- DEFAULT 'application/json' in SQLite which makes it safe to
-- add NOT NULL since existing rows already have the default.

-- First update any NULL values to the default
UPDATE webhook SET mtype = 'application/json' WHERE mtype IS NULL;

-- We need to recreate the table to add NOT NULL and make is_active nullable
CREATE TABLE IF NOT EXISTS _wh_backup_0017 AS SELECT * FROM webhook;

DROP TABLE webhook;

CREATE TABLE webhook (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  uri TEXT NOT NULL,
  mtype TEXT NOT NULL DEFAULT 'application/json',
  error_code TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  is_active TEXT DEFAULT '1',
  secret_key TEXT,
  profile_id TEXT REFERENCES profile(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS webhook__team_id__idx ON webhook(team_id);
CREATE INDEX IF NOT EXISTS webhook__profile_id__idx
    ON webhook(profile_id)
    WHERE profile_id IS NOT NULL;

INSERT INTO webhook (id, team_id, created_at, updated_at, uri, mtype, error_code, error_count, is_active, secret_key, profile_id)
SELECT id, team_id, created_at, updated_at, uri, COALESCE(mtype, 'application/json'), error_code, COALESCE(error_count, 0), COALESCE(is_active, '1'), secret_key, profile_id
FROM _wh_backup_0017;

DROP TABLE _wh_backup_0017;

-- ============================================================
-- 5. comment_thread.page_id: NOT NULL
-- ============================================================
-- PG migration 0031 creates comment_thread with page_id uuid NOT NULL.
-- Our SQLite has it as nullable. We add NOT NULL constraint.
-- First set any NULL page_id values to a zero UUID (shouldn't happen
-- in practice but prevents constraint violation).

UPDATE comment_thread SET page_id = '00000000-0000-0000-0000-000000000000' WHERE page_id IS NULL;

CREATE TABLE IF NOT EXISTS _ct_backup_0017 AS SELECT * FROM comment_thread;

DROP TABLE comment_thread;

CREATE TABLE comment_thread (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  page_id TEXT NOT NULL,
  participants TEXT DEFAULT '[]',
  seqn INTEGER NOT NULL DEFAULT 0,
  is_resolved TEXT NOT NULL DEFAULT '0',
  position TEXT,
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
SELECT id, file_id, owner_id, created_at, modified_at, COALESCE(page_id, '00000000-0000-0000-0000-000000000000'), participants, seqn, is_resolved, position, page_name, COALESCE(frame_id, '00000000-0000-0000-0000-000000000000'), COALESCE(mentions, '[]')
FROM _ct_backup_0017;

DROP TABLE _ct_backup_0017;

-- ============================================================
-- 6. Missing indexes for query performance
-- ============================================================
-- file_profile_rel: PG has indexes on both columns (migration 0003)
CREATE INDEX IF NOT EXISTS file_profile_rel__profile_id__idx
    ON file_profile_rel(profile_id);
CREATE INDEX IF NOT EXISTS file_profile_rel__file_id__idx
    ON file_profile_rel(file_id);

-- file_library_rel: PG has index on file_id (migration 0017)
CREATE INDEX IF NOT EXISTS file_library_rel__file_id__idx
    ON file_library_rel(file_id);

-- task: PG has partial index on label (migration 0087)
CREATE INDEX IF NOT EXISTS task__label__idx
    ON task(label, name, queue)
    WHERE status = 'new';

-- ============================================================
-- 7. file_library_rel FK: ON DELETE RESTRICT for library_file_id
-- ============================================================
-- PG migration 0017 uses ON DELETE RESTRICT for the library_file_id FK.
-- Prevents deleting a library file while it's still linked as a library.
-- Requires table recreation since SQLite can't alter FK constraints.

CREATE TABLE IF NOT EXISTS _flr_backup_0017 AS SELECT * FROM file_library_rel;

DROP TABLE file_library_rel;

CREATE TABLE file_library_rel (
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  library_file_id TEXT NOT NULL REFERENCES file(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  PRIMARY KEY (file_id, library_file_id)
);

CREATE INDEX IF NOT EXISTS idx_flr_library_file_id ON file_library_rel(library_file_id);
CREATE INDEX IF NOT EXISTS file_library_rel__file_id__idx ON file_library_rel(file_id);
CREATE INDEX IF NOT EXISTS file_library_rel__library_file_id__idx ON file_library_rel(library_file_id);

INSERT INTO file_library_rel (file_id, library_file_id, created_at, synced_at)
SELECT file_id, library_file_id, created_at, synced_at
FROM _flr_backup_0017;

DROP TABLE _flr_backup_0017;

-- ============================================================
-- 8. scheduled_task_history: composite PK (id, created_at)
-- ============================================================
-- PG migration 0019 creates this table with PRIMARY KEY (id, created_at).
-- Our SQLite has PRIMARY KEY (id) only. Recreate to match.

CREATE TABLE IF NOT EXISTS _sth_backup_0017 AS SELECT * FROM scheduled_task_history;

DROP TABLE scheduled_task_history;

CREATE TABLE scheduled_task_history (
  id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES scheduled_task(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_error TEXT NOT NULL DEFAULT '0',
  reason TEXT,
  PRIMARY KEY (id, created_at)
);

CREATE INDEX IF NOT EXISTS scheduled_task_history__task_id__idx
    ON scheduled_task_history(task_id);

INSERT INTO scheduled_task_history (id, task_id, created_at, is_error, reason)
SELECT id, task_id, created_at, is_error, reason
FROM _sth_backup_0017;

DROP TABLE _sth_backup_0017;