-- 0009: FTS5 full-text search index for files
-- Creates a virtual table for fast full-text search of file names,
-- replacing slow LIKE '%term%' queries with indexed FTS5 token matching.
--
-- Architecture:
--   - Content-sync FTS5 table stores file_id + name
--   - Triggers on the file table automatically keep the FTS5 index in sync
--   - The search RPC queries file_search with MATCH, then joins back to file
--   - Periodic rebuild via app code catches any drift after bulk operations
--
-- FTS5 MATCH syntax supports: prefix queries ("design*"), phrase queries
-- ("\"my file\""), boolean operators (AND, OR, NOT), and NEAR queries.

CREATE VIRTUAL TABLE IF NOT EXISTS file_search USING fts5(
  file_id UNINDEXED,
  name,
  tokenize='unicode61'
);

-- Populate from existing file records (only non-deleted files)
INSERT INTO file_search (file_id, name)
SELECT id, name FROM file WHERE deleted_at IS NULL;

-- ============================================================
-- Triggers to keep FTS5 index in sync with the file table
-- ============================================================

-- After INSERT on file: add to search index
CREATE TRIGGER IF NOT EXISTS file_search_ai AFTER INSERT ON file
BEGIN
  INSERT INTO file_search (file_id, name)
  VALUES (NEW.id, NEW.name);
END;

-- After UPDATE of name on file: delete old entry, insert new
CREATE TRIGGER IF NOT EXISTS file_search_au AFTER UPDATE OF name ON file
BEGIN
  DELETE FROM file_search WHERE file_id = OLD.id;
  INSERT INTO file_search (file_id, name)
  VALUES (NEW.id, NEW.name);
END;

-- After DELETE on file: remove from search index
-- (Also covers soft-delete via deleted_at — the app-level rebuild
--  handles soft-deletes, but hard deletes are caught here)
CREATE TRIGGER IF NOT EXISTS file_search_ad AFTER DELETE ON file
BEGIN
  DELETE FROM file_search WHERE file_id = OLD.id;
END;