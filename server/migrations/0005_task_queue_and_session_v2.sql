-- 0005 task queue enhancements and session v2
-- Adds columns to the existing task and http_session_v2 tables.
-- Indexes on newly-added columns are in 0006 for SQLite schema visibility.

-- Add missing columns to task table (max_retries and label already added in 0004)
ALTER TABLE task ADD COLUMN type TEXT;
ALTER TABLE task ADD COLUMN state TEXT NOT NULL DEFAULT 'new';
ALTER TABLE task ADD COLUMN params TEXT;

-- Add missing columns to http_session_v2 table (created in 0004 without these)
ALTER TABLE http_session_v2 ADD COLUMN expires_at TEXT NOT NULL DEFAULT '2099-12-31T00:00:00Z';
ALTER TABLE http_session_v2 ADD COLUMN prev_session_id TEXT REFERENCES http_session_v2(id) ON DELETE SET NULL;