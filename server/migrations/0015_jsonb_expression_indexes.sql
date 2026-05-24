-- 0015: JSONB expression indexes and GC code fixes
--
-- Adds SQLite expression indexes using json_extract() that mirror PG's
-- jsonb expression indexes, adapted for Node.js JSON key naming conventions.
--
-- PG uses Clojure namespaced keys (e.g., '~:hash'), while the Node.js code
-- uses plain keys (e.g., 'hash'). The indexes below use the Node.js convention.
--
-- Also adds the profile newsletter partial indexes for email marketing queries.

-- ============================================================
-- 1. STORAGE OBJECT DEDUP INDEX (PG migration 0068)
-- ============================================================
-- PG: CREATE INDEX storage_object__hash_backend_bucket__idx
--     ON storage_object ((metadata->>'~:hash'), (metadata->>'~:bucket'), backend)
--     WHERE deleted_at IS NULL;
--
-- Node.js stores metadata as JSON with plain keys: {"hash": "...", "bucket": "..."}
-- SQLite uses json_extract() with '$.key' path syntax.

CREATE INDEX IF NOT EXISTS storage_object__hash_backend_bucket__idx
    ON storage_object(json_extract(metadata, '$.hash'), json_extract(metadata, '$.bucket'), backend)
    WHERE deleted_at IS NULL;

-- ============================================================
-- 2. PROFILE NEWSLETTER INDEXES (PG migration 0124)
-- ============================================================
-- PG: CREATE INDEX profile__props__newsletter1__idx ON profile (email)
--         WHERE props->>'~:newsletter-news' = 'true';
-- PG: CREATE INDEX profile__props__newsletter2__idx ON profile (email)
--         WHERE props->>'~:newsletter-updates' = 'true';
--
-- Node.js stores props as JSON with plain keys (newsletter-news, newsletter-updates)

CREATE INDEX IF NOT EXISTS profile__props__newsletter_news__idx
    ON profile(email)
    WHERE json_extract(props, '$.newsletter-news') = 'true';

CREATE INDEX IF NOT EXISTS profile__props__newsletter_updates__idx
    ON profile(email)
    WHERE json_extract(props, '$.newsletter-updates') = 'true';