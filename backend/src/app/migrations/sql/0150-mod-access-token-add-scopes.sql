-- 0150: Add scopes column to access_token table for API access tokens.
--
-- The scopes column stores a JSON array of permission scopes for API access tokens.
-- Personal access tokens have an empty scopes array [].
-- API access tokens have specific scopes like ["api:read", "api:write"].

ALTER TABLE access_token ADD COLUMN scopes text[] DEFAULT '{}';

UPDATE access_token SET scopes = '{}' WHERE scopes IS NULL;