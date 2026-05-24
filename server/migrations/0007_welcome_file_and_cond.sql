-- 0007: Add welcome_file_id column and conditional execution flag support

-- Add welcome_file_id to profile for setup/welcome-file feature
ALTER TABLE profile ADD COLUMN welcome_file_id TEXT REFERENCES file(id) ON DELETE SET NULL;

-- Add __etag support column for conditional reads (populated by middleware)
-- This column is informational only; ETags are computed at runtime by the cond middleware