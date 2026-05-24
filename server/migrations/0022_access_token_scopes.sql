-- 0022: Add scopes column to access_token table for API access tokens.
--
-- Mirrors PG migration 0150. The scopes column stores a JSON array of
-- permission scopes for API access tokens. Personal access tokens have [].
-- API access tokens have specific scopes like ["api:read", "api:write"].

ALTER TABLE access_token ADD COLUMN scopes TEXT NOT NULL DEFAULT '[]';