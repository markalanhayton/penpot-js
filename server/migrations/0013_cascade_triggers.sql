-- 0013: Cascade trigger — page → file → project modified_at propagation
--
-- Adds an SQLite AFTER UPDATE trigger on `page` that cascades modified_at
-- changes to the parent `file` and grandparent `project`, matching PG's
-- `handle_page_update()` trigger (migration 0003, still active).
--
-- In PG, the `page__on_update__tgr` BEFORE UPDATE trigger:
--   1. Sets NEW.modified_at = clock_timestamp() on the page row
--   2. Cascades: UPDATE file SET modified_at = clock_timestamp() WHERE id = OLD.file_id
--   3. Cascades: UPDATE project SET modified_at = clock_timestamp() WHERE id = proj_id
--
-- In SQLite:
--   - BEFORE UPDATE triggers cannot modify NEW values (the app handles modified_at)
--   - We use AFTER UPDATE for the cascade, propagating the page's new modified_at
--     to the parent file and grandparent project
--
-- Note: PG migration 0037 dropped ALL generic update_modified_at() triggers.
-- The Clojure/Node.js backends handle modified_at in application code for
-- all other tables. PG migration 0061 dropped the file → project cascade
-- (file_on_update_tgr) because "file modified_at updates are performed by
-- the application code." This page trigger is the ONLY remaining active
-- cascade trigger in PG.

CREATE TRIGGER IF NOT EXISTS page__after_update__cascade__tgr
AFTER UPDATE ON page
FOR EACH ROW
BEGIN
  UPDATE file
     SET modified_at = NEW.modified_at
   WHERE id = NEW.file_id;

  UPDATE project
     SET modified_at = NEW.modified_at
   WHERE id = (SELECT project_id FROM file WHERE id = NEW.file_id);
END;