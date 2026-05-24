-- 0006 indexes for columns added in 0004 and 0005
-- These indexes reference columns that were added via ALTER TABLE in prior
-- migrations and must be in a separate file for SQLite schema visibility.

-- Access token indexes (expires_at and type added in 0004)
CREATE INDEX IF NOT EXISTS idx_at_profile_id ON access_token(profile_id);
CREATE INDEX IF NOT EXISTS idx_at_expires ON access_token(expires_at);

-- Task queue indexes (state, type added in 0005)
CREATE INDEX IF NOT EXISTS idx_task_state ON task (state, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_task_type ON task (type);
CREATE INDEX IF NOT EXISTS idx_task_created ON task (created_at);

-- HTTP session v2 indexes (table created in 0005)
CREATE INDEX IF NOT EXISTS idx_hs2_profile_v2 ON http_session_v2 (profile_id);
CREATE INDEX IF NOT EXISTS idx_hs2_expires ON http_session_v2 (expires_at);

-- Comment thread index
CREATE INDEX IF NOT EXISTS idx_ct_page_id ON comment_thread(page_id);