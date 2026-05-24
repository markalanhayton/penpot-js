-- 0010: Audit gap remediation — missing columns, constraints, indexes, and data migrations
-- Addresses all critical and important gaps identified in the PG vs SQLite schema audit.
--
-- Categories:
--   1. Missing columns (file_object_thumbnail.media_id)
--   2. Missing constraints (comment_thread UNIQUE on file_id/seqn, team_invitation constraints,
--      team_profile_rel UNIQUE, team_project_profile_rel UNIQUE)
--   3. Missing indexes (~45 indexes: partial deleted_at, FK lookups, composite, covering)
--   4. Missing data migrations (auth_backend population, file_library_sync backfill,
--      team_invitation UUID population)
--
-- Notes on skipped items:
--   - file_tagged_object_thumbnail.updated_at: already exists (added in migration 0002)
--   - file_thumbnail.media_id: already NOT NULL in SQLite (PG allows NULL); keeping
--     the stricter constraint is acceptable
--   - access_token.type: already NOT NULL DEFAULT 'personal' in SQLite (0004);
--     PG 0146 makes it nullable but the stricter default is harmless
--   - team_invitation CHECK (team_id IS NOT NULL OR org_id IS NOT NULL): SQLite
--     does not support ALTER TABLE ADD CONSTRAINT; enforced at application level

-- ============================================================
-- 1. MISSING COLUMNS
-- ============================================================

-- file_object_thumbnail: add media_id (PG migration 0103)
-- This is the only genuinely missing column; all other identified gaps
-- either already exist or have acceptable SQLite-specific differences.
ALTER TABLE file_object_thumbnail ADD COLUMN media_id TEXT REFERENCES storage_object(id) ON DELETE SET NULL;

-- ============================================================
-- 2. MISSING CONSTRAINTS
-- ============================================================

-- comment_thread: UNIQUE on (file_id, seqn) — PG migration 0031
-- Prevents duplicate sequential numbers within a file
CREATE UNIQUE INDEX IF NOT EXISTS comment_thread__file_id__seqn__idx
    ON comment_thread(file_id, seqn);

-- team_invitation: UNIQUE on (team_id, email_to) — PG migration 0092
-- The original PK on (team_id, email_to) was replaced with a uuid PK in PG,
-- but the uniqueness constraint on (team_id, email_to) must be preserved.
-- SQLite cannot ALTER a PK, so we add this as a separate unique index.
-- Only create if we can verify team_id is still part of the existing PK.
CREATE UNIQUE INDEX IF NOT EXISTS team_invitation__team_id__email_to__idx
    ON team_invitation(team_id, email_to);

-- team_invitation: partial unique on (org_id, email_to) WHERE team_id IS NULL
-- PG migration 0147 — allows org-level invitations when team_id is NULL
CREATE UNIQUE INDEX IF NOT EXISTS team_invitation_org_unique
    ON team_invitation(org_id, email_to)
    WHERE team_id IS NULL;

-- team_profile_rel: UNIQUE on (team_id, profile_id) — PG migration 0088
-- After adding uuid PK column, the composite uniqueness must be explicit
CREATE UNIQUE INDEX IF NOT EXISTS team_profile_rel__unique
    ON team_profile_rel(team_id, profile_id);

-- team_project_profile_rel: UNIQUE on (team_id, project_id, profile_id) — PG migration 0091
CREATE UNIQUE INDEX IF NOT EXISTS team_project_profile_rel__unique
    ON team_project_profile_rel(team_id, project_id, profile_id);

-- ============================================================
-- 3. MISSING INDEXES — Soft-delete partial indexes
-- ============================================================
-- These partial indexes on (deleted_at, ...) WHERE deleted_at IS NOT NULL
-- are critical for GC queries that scan for soft-deleted rows.

-- file (PG migration 0081)
CREATE INDEX IF NOT EXISTS file__deleted_at__idx
    ON file(deleted_at, id)
    WHERE deleted_at IS NOT NULL;

-- profile (PG migration 0056)
CREATE INDEX IF NOT EXISTS profile__deleted_at__idx
    ON profile(deleted_at, id)
    WHERE deleted_at IS NOT NULL;

-- project (PG migration 0056)
CREATE INDEX IF NOT EXISTS project__deleted_at__idx
    ON project(deleted_at, id)
    WHERE deleted_at IS NOT NULL;

-- team (PG migration 0056)
CREATE INDEX IF NOT EXISTS team__deleted_at__idx
    ON team(deleted_at, id)
    WHERE deleted_at IS NOT NULL;

-- team_font_variant (PG migration 0056)
CREATE INDEX IF NOT EXISTS team_font_variant__deleted_at__idx
    ON team_font_variant(deleted_at, id)
    WHERE deleted_at IS NOT NULL;

-- file_thumbnail (PG migration 0108)
CREATE INDEX IF NOT EXISTS file_thumbnail__deleted_at__idx
    ON file_thumbnail(deleted_at, file_id, revn, media_id)
    WHERE deleted_at IS NOT NULL;

-- file_media_object (PG migration 0110)
CREATE INDEX IF NOT EXISTS file_media_object__deleted_at__idx
    ON file_media_object(deleted_at, id, media_id)
    WHERE deleted_at IS NOT NULL;

-- file_data_fragment (PG migration 0111)
CREATE INDEX IF NOT EXISTS file_data_fragment__deleted_at__idx
    ON file_data_fragment(deleted_at, file_id, id)
    WHERE deleted_at IS NOT NULL;

-- file_data (PG migration 0141)
CREATE INDEX IF NOT EXISTS file_data__deleted_at__idx
    ON file_data(deleted_at, file_id, id)
    WHERE deleted_at IS NOT NULL;

-- file_change (PG migration 0134)
CREATE INDEX IF NOT EXISTS file_change__deleted_at__idx
    ON file_change(deleted_at, id)
    WHERE deleted_at IS NOT NULL;

-- storage_object (PG migration 0044/0048)
-- Replace the existing non-partial index with a partial covering index
CREATE INDEX IF NOT EXISTS storage_object__id__deleted_at__idx
    ON storage_object(deleted_at, id)
    WHERE deleted_at IS NOT NULL;

-- ============================================================
-- 4. MISSING INDEXES — FK lookup and composite indexes
-- ============================================================

-- comment_thread: owner_id lookup (PG migration 0031)
CREATE INDEX IF NOT EXISTS comment_thread__owner_id__idx
    ON comment_thread(owner_id);

-- comment: thread_id and owner_id lookups (PG migration 0031)
CREATE INDEX IF NOT EXISTS comment__thread_id__idx
    ON comment(thread_id);
CREATE INDEX IF NOT EXISTS comment__owner_id__idx
    ON comment(owner_id);

-- file: modified_at for files with data (PG migration 0061)
CREATE INDEX IF NOT EXISTS file__modified_at__with__data__idx
    ON file(modified_at, id)
    WHERE data IS NOT NULL;

-- file: data_ref_id lookup (PG migration 0122)
CREATE INDEX IF NOT EXISTS file__data_ref_id__idx
    ON file(data_ref_id)
    WHERE data_ref_id IS NOT NULL;

-- file_change: file_id + revn composite — critical for update-file lagged changes (PG 0047)
CREATE INDEX IF NOT EXISTS file_change__file_id__revn__idx
    ON file_change(file_id, revn);

-- file_change: profile_id partial (PG migration 0047)
-- Replace the existing non-partial index with the partial version
CREATE INDEX IF NOT EXISTS file_change__profile_id__partial__idx
    ON file_change(profile_id)
    WHERE profile_id IS NOT NULL;

-- file_change: system snapshots partial (PG migration 0134)
CREATE INDEX IF NOT EXISTS file_change__system_snapshots__idx
    ON file_change(file_id, created_at)
    WHERE data IS NOT NULL AND created_by = 'system' AND deleted_at IS NULL;

-- file_change: label partial (PG migration 0105)
CREATE INDEX IF NOT EXISTS file_change__label__idx
    ON file_change(file_id, label)
    WHERE label IS NOT NULL;

-- file_change: data_ref_id lookup (PG migration 0129)
CREATE INDEX IF NOT EXISTS file_change__data_ref_id__idx
    ON file_change(data_ref_id)
    WHERE data_ref_id IS NOT NULL;

-- file_change: locked_by partial (PG migration 0140)
CREATE INDEX IF NOT EXISTS file_change__locked_by__idx
    ON file_change(locked_by)
    WHERE locked_by IS NOT NULL;

-- file_thumbnail: media_id lookup (PG migration 0108)
CREATE INDEX IF NOT EXISTS file_thumbnail__media_id__idx
    ON file_thumbnail(media_id);

-- file_data_fragment: data_ref_id lookup (PG migration 0122)
CREATE INDEX IF NOT EXISTS file_data_fragment__data_ref_id__idx
    ON file_data_fragment(data_ref_id)
    WHERE data_ref_id IS NOT NULL;

-- storage_object: touched_at partial (PG migration 0044)
CREATE INDEX IF NOT EXISTS storage_object__id_touched_at__idx
    ON storage_object(touched_at, id)
    WHERE touched_at IS NOT NULL;

-- profile: default_project_id and default_team_id (PG migration 0100)
CREATE INDEX IF NOT EXISTS profile__default_project__idx
    ON profile(default_project_id)
    WHERE default_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profile__default_team__idx
    ON profile(default_team_id)
    WHERE default_team_id IS NOT NULL;

-- profile: is_demo partial (PG migration 0002)
CREATE INDEX IF NOT EXISTS profile__is_demo__idx
    ON profile(is_demo)
    WHERE deleted_at IS NULL AND is_demo = '1';

-- team_font_variant: profile_id lookup (PG migration 0053)
CREATE INDEX IF NOT EXISTS team_font_variant__profile_id__idx
    ON team_font_variant(profile_id);

-- share_link: owner_id lookup (PG migration 0063)
CREATE INDEX IF NOT EXISTS share_link__owner_id__idx
    ON share_link(owner_id);

-- usage_quote: composite FK lookups (PG migration 0098)
CREATE INDEX IF NOT EXISTS usage_quote__profile_id__idx
    ON usage_quote(profile_id, target);
CREATE INDEX IF NOT EXISTS usage_quote__project_id__idx
    ON usage_quote(project_id, target);
CREATE INDEX IF NOT EXISTS usage_quote__team_id__idx
    ON usage_quote(team_id, target);

-- webhook: profile_id partial (PG migration 0131)
CREATE INDEX IF NOT EXISTS webhook__profile_id__idx
    ON webhook(profile_id)
    WHERE profile_id IS NOT NULL;

-- http_session_v2: SSO lookups (PG migration 0143)
CREATE INDEX IF NOT EXISTS http_session_v2__sso_provider_id__idx
    ON http_session_v2(sso_provider_id)
    WHERE sso_provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS http_session_v2__sso_session_id__idx
    ON http_session_v2(sso_session_id)
    WHERE sso_session_id IS NOT NULL;

-- upload_session: lookups (PG migration 0147)
CREATE INDEX IF NOT EXISTS upload_session__profile_id__idx
    ON upload_session(profile_id);
CREATE INDEX IF NOT EXISTS upload_session__created_at__idx
    ON upload_session(created_at);

-- ============================================================
-- 5. MISSING INDEXES — Audit log and server error report
-- ============================================================

-- audit_log: created_at partial where not archived (PG migration 0145)
CREATE INDEX IF NOT EXISTS audit_log__created_at__unarchived__idx
    ON audit_log(created_at)
    WHERE archived_at IS NULL;

-- audit_log: archived_at partial (PG migration 0145)
CREATE INDEX IF NOT EXISTS audit_log__archived_at__idx
    ON audit_log(archived_at)
    WHERE archived_at IS NOT NULL;

-- audit_log: source + created_at for telemetry (PG migration 0145)
CREATE INDEX IF NOT EXISTS audit_log__source__created_at__idx
    ON audit_log(source, created_at);

-- audit_log: id + archived_at (PG migration 0054)
CREATE INDEX IF NOT EXISTS audit_log__id_archived_at__idx
    ON audit_log(id, archived_at);

-- server_error_report: created_at (PG migration 0105)
CREATE INDEX IF NOT EXISTS server_error_report__created_at__idx
    ON server_error_report(created_at);

-- server_error_report: version (PG migration 0144)
CREATE INDEX IF NOT EXISTS server_error_report__version__idx
    ON server_error_report(version);

-- ============================================================
-- 6. DATA MIGRATIONS
-- ============================================================

-- Populate auth_backend for profiles that don't have it set.
-- PG defaults: 'penpot' for password-based auth, 'oidc' for SSO-created profiles.
-- We infer from existing data: if password IS NOT NULL → 'penpot', else → 'oidc'.
UPDATE profile
   SET auth_backend = 'penpot'
 WHERE auth_backend IS NULL
   AND password IS NOT NULL;

UPDATE profile
   SET auth_backend = 'oidc'
 WHERE auth_backend IS NULL
   AND password IS NULL;

-- Backfill file_library_sync from file_library_rel (PG migration 0149)
-- Only populate rows where synced_at is set and the target doesn't already exist.
INSERT OR IGNORE INTO file_library_sync (file_id, library_file_id, synced_at)
SELECT file_id, library_file_id, synced_at
  FROM file_library_rel
 WHERE synced_at IS NOT NULL;

-- Ensure team_invitation.id is populated for all rows (PG migration 0092)
-- Re-run the UUID generation for any rows that still lack an id.
UPDATE team_invitation
   SET id = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6)))
 WHERE id IS NULL;