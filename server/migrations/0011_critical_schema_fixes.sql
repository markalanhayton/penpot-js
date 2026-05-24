-- 0011: Critical schema fixes — team_invitation restructure and team_profile_rel FK correction
--
-- Fixes two critical gaps:
--   1. team_invitation: team_id NOT NULL prevents org-level invitations (PG 0147);
--      composite PK prevents proper UUID-based PK (PG 0092)
--   2. team_profile_rel: profile_id ON DELETE CASCADE silently removes team memberships
--      when a profile is deleted; PG uses RESTRICT (PG 0002)
--
-- Both require table recreation because SQLite cannot ALTER composite PKs or
-- change NOT NULL constraints or ON DELETE actions directly.

-- ============================================================
-- 1. RESTRUCTURE team_invitation
-- ============================================================
-- PG migration 0092: Replace composite PK (team_id, email_to) with uuid PK,
--   add UNIQUE(team_id, email_to) constraint separately.
-- PG migration 0092: Add created_by column.
-- PG migration 0147: Make team_id nullable, add org_id column, add
--   UNIQUE(org_id, email_to) WHERE team_id IS NULL, add CHECK constraint.
--
-- Current SQLite state:
--   PRIMARY KEY (team_id, email_to)  — cannot insert org-only invitations
--   team_id NOT NULL                 — cannot create org-level invitations
--   id TEXT NULL                     — not the PK
--   created_by TEXT NULL             — already added
--   org_id TEXT NULL                 — already added
--
-- Target state:
--   id TEXT PRIMARY KEY              — UUID PK (like PG)
--   team_id TEXT REFERENCES team(id) — nullable for org invitations
--   email_to TEXT NOT NULL
--   role TEXT NOT NULL DEFAULT 'viewer'
--   valid_until TEXT
--   created_at TEXT NOT NULL DEFAULT (datetime('now'))
--   updated_at TEXT NOT NULL DEFAULT (datetime('now'))
--   created_by TEXT REFERENCES profile(id) ON DELETE SET NULL
--   org_id TEXT REFERENCES team(id)   — for org-level invitations
--   CHECK (team_id IS NOT NULL OR org_id IS NOT NULL)

-- Save existing data
CREATE TABLE IF NOT EXISTS _ti_backup AS SELECT * FROM team_invitation;

-- Drop the old table (indexes are dropped automatically)
DROP TABLE team_invitation;

-- Create with the correct schema
CREATE TABLE team_invitation (
  id TEXT PRIMARY KEY,
  team_id TEXT REFERENCES team(id) ON DELETE CASCADE,
  email_to TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT REFERENCES profile(id) ON DELETE SET NULL,
  org_id TEXT REFERENCES team(id) ON DELETE CASCADE,
  CHECK (team_id IS NOT NULL OR org_id IS NOT NULL)
);

-- Recreate the UNIQUE constraints from 0010 (table recreation drops them)
CREATE UNIQUE INDEX team_invitation__team_id__email_to__idx
    ON team_invitation(team_id, email_to);

CREATE UNIQUE INDEX team_invitation_org_unique
    ON team_invitation(org_id, email_to)
    WHERE team_id IS NULL;

-- Migrate data from backup:
-- - Generate UUIDs for rows that lack an id
-- - Preserve all existing columns
INSERT INTO team_invitation (id, team_id, email_to, role, valid_until, created_at, updated_at, created_by, org_id)
SELECT
  CASE WHEN id IS NOT NULL THEN id
       ELSE lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6)))
  END,
  team_id, email_to, role, valid_until, created_at, updated_at, created_by, org_id
FROM _ti_backup;

-- Drop the backup table
DROP TABLE _ti_backup;

-- ============================================================
-- 2. FIX team_profile_rel FK ACTION
-- ============================================================
-- PG migration 0002: profile_id REFERENCES profile(id) ON DELETE RESTRICT
-- SQLite migration 0001: profile_id REFERENCES profile(id) ON DELETE CASCADE
--
-- ON DELETE CASCADE silently removes team memberships when a profile is
-- deleted, potentially leaving teams without admins. The PG behavior
-- (RESTRICT) prevents deleting a profile that belongs to a team unless
-- the memberships are explicitly removed first.
--
-- This also restructures the PK to use `id TEXT PRIMARY KEY` matching PG
-- migration 0088, which adds a UUID PK and a UNIQUE(team_id, profile_id).
--
-- While restructuring, also ensure all columns match the PG schema:
--   - id TEXT PRIMARY KEY (was nullable, now the PK)
--   - profile_id REFERENCES profile(id) ON DELETE RESTRICT (was CASCADE)

-- Save existing data
CREATE TABLE IF NOT EXISTS _tpr_backup AS SELECT * FROM team_profile_rel;

-- Drop the old table
DROP TABLE team_profile_rel;

-- Create with corrected FK and PK
CREATE TABLE team_profile_rel (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profile(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_admin TEXT NOT NULL DEFAULT '0',
  is_owner TEXT NOT NULL DEFAULT '0',
  can_edit TEXT NOT NULL DEFAULT '1',
  is_member TEXT NOT NULL DEFAULT '1'
);

-- Recreate the UNIQUE constraint from 0010
CREATE UNIQUE INDEX team_profile_rel__unique
    ON team_profile_rel(team_id, profile_id);

-- Recreate indexes that were on the old table
CREATE INDEX IF NOT EXISTS idx_tpr_team ON team_profile_rel(team_id);
CREATE INDEX IF NOT EXISTS idx_tpr_profile ON team_profile_rel(profile_id);

-- Migrate data: generate UUIDs for rows lacking id
INSERT INTO team_profile_rel (id, team_id, profile_id, created_at, modified_at, is_admin, is_owner, can_edit, is_member)
SELECT
  CASE WHEN id IS NOT NULL THEN id
       ELSE lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6)))
  END,
  team_id, profile_id, created_at, modified_at, is_admin, is_owner, can_edit, is_member
FROM _tpr_backup;

-- Drop the backup table
DROP TABLE _tpr_backup;

-- ============================================================
-- 3. FIX sso_provider — recreate with CHECK constraints and NOT NULL columns
-- ============================================================
-- PG migration 0142: domain TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'oidc',
--   user_info_source TEXT NOT NULL DEFAULT 'auto',
--   CHECK (type IN ('oidc')), CHECK (user_info_source IN ('token', 'userinfo', 'auto'))
--
-- Current SQLite state: The table was created by migration 0001 with different
--   defaults (domain is nullable, user_info_source DEFAULT 'token'), and
--   migration 0008's CREATE TABLE IF NOT EXISTS was a no-op because the table
--   already existed. The CHECK constraints were never applied.

CREATE TABLE IF NOT EXISTS _sso_backup AS SELECT * FROM sso_provider;

DROP TABLE sso_provider;

-- Recreate with PG-matching schema including CHECK constraints
CREATE TABLE sso_provider (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_enabled TEXT NOT NULL DEFAULT '1',
  type TEXT NOT NULL DEFAULT 'oidc',
  domain TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  base_uri TEXT NOT NULL,
  token_uri TEXT,
  auth_uri TEXT,
  user_uri TEXT,
  jwks_uri TEXT,
  logout_uri TEXT,
  roles_attr TEXT,
  email_attr TEXT,
  name_attr TEXT,
  user_info_source TEXT NOT NULL DEFAULT 'auto',
  scopes TEXT,
  roles TEXT,
  CHECK (type IN ('oidc')),
  CHECK (user_info_source IN ('token', 'userinfo', 'auto'))
);

-- Recreate the unique index on domain
CREATE UNIQUE INDEX idx_sso_domain ON sso_provider(domain);

-- Migrate data
INSERT INTO sso_provider (id, created_at, modified_at, is_enabled, type, domain, client_id, client_secret, base_uri, token_uri, auth_uri, user_uri, jwks_uri, logout_uri, roles_attr, email_attr, name_attr, user_info_source, scopes, roles)
SELECT id, created_at, modified_at, is_enabled,
  COALESCE(type, 'oidc'),
  domain,
  client_id, client_secret, base_uri, token_uri, auth_uri, user_uri, jwks_uri, logout_uri, roles_attr, email_attr, name_attr,
  COALESCE(user_info_source, 'auto'),
  scopes, roles
FROM _sso_backup;

DROP TABLE IF EXISTS _sso_backup;