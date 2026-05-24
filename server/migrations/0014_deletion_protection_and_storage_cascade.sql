-- 0014: Deletion protection triggers and storage object cascade triggers
--
-- This migration addresses two PG parity gaps:
--
-- 1. DELETION PROTECTION (PG migrations 0107-0114)
--    PG uses BEFORE DELETE triggers on 6 protected tables that raise an exception
--    unless the session variable rules.deletion_protection is set to 'off'.
--    SQLite doesn't have session variables, so we use a server_prop entry as
--    a global flag. The triggers check this flag before blocking DELETEs.
--
--    Protected tables: profile, team, file_thumbnail, file_tagged_object_thumbnail,
--                       file_media_object, team_font_variant
--
--    The Node.js GC code must disable protection before hard-deleting:
--      UPDATE server_prop SET content = '{"enabled": false}' WHERE id = 'rules.deletion_protection';
--      -- perform DELETEs --
--      UPDATE server_prop SET content = '{"enabled": true}' WHERE id = 'rules.deletion_protection';
--
-- 2. STORAGE OBJECT CASCADE ON DELETE (PG migrations 0038, 0044)
--    When profile, team, or file_media_object rows are hard-deleted (during GC),
--    these AFTER DELETE triggers mark referenced storage_objects as touched
--    (setting touched_at) so the storage GC can verify whether they're still
--    referenced before actually deleting them.

-- ============================================================
-- 1. DELETION PROTECTION — server_prop flag
-- ============================================================
-- Insert a deletion_protection flag in server_prop. Default is enabled.
INSERT OR IGNORE INTO server_prop (id, content, is_preloaded)
VALUES ('rules.deletion_protection', '{"enabled": true}', '1');

-- ============================================================
-- 2. DELETION PROTECTION — BEFORE DELETE triggers
-- ============================================================
-- These triggers prevent accidental hard-deletes on tables that should only
-- be soft-deleted (via UPDATE deleted_at). When deletion_protection is enabled
-- (the default), DELETE statements on these tables will raise an error.
--
-- The WHEN clause reads the server_prop flag. When JSON_EXTRACT returns
-- a non-zero/non-null value (true), the trigger fires and blocks the DELETE.
-- When set to false (0), the WHEN clause evaluates to false and the trigger
-- is skipped, allowing the DELETE to proceed.

-- profile: prevent hard-delete (soft-delete with deleted_at instead)
CREATE TRIGGER IF NOT EXISTS profile__deletion_protection__tgr
BEFORE DELETE ON profile
FOR EACH ROW
WHEN (
  SELECT json_extract(content, '$.enabled')
    FROM server_prop
   WHERE id = 'rules.deletion_protection'
) IS NOT 0
BEGIN
  SELECT RAISE(ABORT, 'deletion_protection: cannot DELETE from profile, use UPDATE deleted_at instead');
END;

-- team: prevent hard-delete
CREATE TRIGGER IF NOT EXISTS team__deletion_protection__tgr
BEFORE DELETE ON team
FOR EACH ROW
WHEN (
  SELECT json_extract(content, '$.enabled')
    FROM server_prop
   WHERE id = 'rules.deletion_protection'
) IS NOT 0
BEGIN
  SELECT RAISE(ABORT, 'deletion_protection: cannot DELETE from team, use UPDATE deleted_at instead');
END;

-- file_thumbnail: prevent hard-delete
CREATE TRIGGER IF NOT EXISTS file_thumbnail__deletion_protection__tgr
BEFORE DELETE ON file_thumbnail
FOR EACH ROW
WHEN (
  SELECT json_extract(content, '$.enabled')
    FROM server_prop
   WHERE id = 'rules.deletion_protection'
) IS NOT 0
BEGIN
  SELECT RAISE(ABORT, 'deletion_protection: cannot DELETE from file_thumbnail, use UPDATE deleted_at instead');
END;

-- file_tagged_object_thumbnail: prevent hard-delete
CREATE TRIGGER IF NOT EXISTS file_tagged_object_thumbnail__deletion_protection__tgr
BEFORE DELETE ON file_tagged_object_thumbnail
FOR EACH ROW
WHEN (
  SELECT json_extract(content, '$.enabled')
    FROM server_prop
   WHERE id = 'rules.deletion_protection'
) IS NOT 0
BEGIN
  SELECT RAISE(ABORT, 'deletion_protection: cannot DELETE from file_tagged_object_thumbnail, use UPDATE deleted_at instead');
END;

-- file_media_object: prevent hard-delete
CREATE TRIGGER IF NOT EXISTS file_media_object__deletion_protection__tgr
BEFORE DELETE ON file_media_object
FOR EACH ROW
WHEN (
  SELECT json_extract(content, '$.enabled')
    FROM server_prop
   WHERE id = 'rules.deletion_protection'
) IS NOT 0
BEGIN
  SELECT RAISE(ABORT, 'deletion_protection: cannot DELETE from file_media_object, use UPDATE deleted_at instead');
END;

-- team_font_variant: prevent hard-delete
CREATE TRIGGER IF NOT EXISTS team_font_variant__deletion_protection__tgr
BEFORE DELETE ON team_font_variant
FOR EACH ROW
WHEN (
  SELECT json_extract(content, '$.enabled')
    FROM server_prop
   WHERE id = 'rules.deletion_protection'
) IS NOT 0
BEGIN
  SELECT RAISE(ABORT, 'deletion_protection: cannot DELETE from team_font_variant, use UPDATE deleted_at instead');
END;

-- ============================================================
-- 3. STORAGE OBJECT CASCADE — AFTER DELETE triggers
-- ============================================================
-- When profile/team/file_media_object rows are hard-deleted (after GC disables
-- deletion protection), these triggers touch the referenced storage_objects so
-- the storage GC can later verify whether they're still referenced.

-- profile: touch storage_object referenced by photo_id
CREATE TRIGGER IF NOT EXISTS profile__after_delete__storage__tgr
AFTER DELETE ON profile
FOR EACH ROW
WHEN OLD.photo_id IS NOT NULL
BEGIN
  UPDATE storage_object
     SET touched_at = datetime('now')
   WHERE id = OLD.photo_id;
END;

-- team: touch storage_object referenced by photo_id
CREATE TRIGGER IF NOT EXISTS team__after_delete__storage__tgr
AFTER DELETE ON team
FOR EACH ROW
WHEN OLD.photo_id IS NOT NULL
BEGIN
  UPDATE storage_object
     SET touched_at = datetime('now')
   WHERE id = OLD.photo_id;
END;

-- file_media_object: touch storage_objects referenced by media_id
-- (thumbnail_id is handled separately when it exists)
CREATE TRIGGER IF NOT EXISTS file_media_object__after_delete__storage__tgr
AFTER DELETE ON file_media_object
FOR EACH ROW
WHEN OLD.media_id IS NOT NULL
BEGIN
  UPDATE storage_object
     SET touched_at = datetime('now')
   WHERE id = OLD.media_id;
END;

-- file_media_object: touch storage_object referenced by thumbnail_id
-- (separate trigger because SQLite WHEN clauses cannot combine column checks)
CREATE TRIGGER IF NOT EXISTS file_media_object__after_delete__thumb__tgr
AFTER DELETE ON file_media_object
FOR EACH ROW
WHEN OLD.thumbnail_id IS NOT NULL
BEGIN
  UPDATE storage_object
     SET touched_at = datetime('now')
   WHERE id = OLD.thumbnail_id;
END;