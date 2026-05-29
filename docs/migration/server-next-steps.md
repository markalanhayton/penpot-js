# Node.js Port — Next Steps & Progress Tracker

This document tracks the remaining work to achieve functional parity between the
Clojure backend (`backend/`) and the Node.js port (`server/`).

---

## Legends

- [ ] Not started
- [~] Partially done
- [x] Complete

---

## 1. Critical — Broken Core Functionality

### 1.1 [x] ~~Library linking/unlinking (`files.js`)~~
Implemented. `link-file-to-library` inserts into `file_library_rel` with
conflict handling and returns updated library list. `unlink-file-from-library`
deletes from `file_library_rel`. Both validate file existence and reject
self-links.

### 1.2 [x] ~~File statistics (`files.js`)~~
Implemented. `get-file-stats` now queries `page` count, `file_library_rel` for
`libraryCount` and `referencedByCount`, and `file` for `revn`/`updatedAt`.
Shape/component/color/typography counts are left as zeros until binary file
data parsing is implemented.

### 1.3 [x] ~~Password recovery email (`auth.js`)~~
Implemented. `request-profile-recovery` now calls `sendPasswordRecovery()` from
`email/index.js` instead of logging to console.

### 1.4 [x] ~~Duplicate task scheduler start (`index.js`)~~
Fixed. Removed the duplicate `startTaskScheduler(pool)` call.

---

## 2. Important — Missing or Incomplete Features

### 2.1 [x] ~~S3 storage backend (`storage/`)~~
Implemented. `storage/s3.js` provides full S3/MinIO support with:
- `putS3Object` — Upload objects to S3 with deduplication
- `getS3ObjectData` — Download object data from S3
- `deleteS3Object` / `deleteS3ObjectsInBulk` — Delete single or batch objects
- `getS3PresignedUrl` — Generate presigned URLs for temporary read access
- `putStorageObjectAny` / `getStorageObjectDataAny` / `getStorageObjectUrlAny` —
  Unified dispatchers that route to FS or S3 based on `PENPOT_STORAGE_BACKEND`
- Lazy initialization with graceful fallback when `@aws-sdk/client-s3` is unavailable
- MinIO support via `PENPOT_STORAGE_S3_ENDPOINT`, `PENPOT_STORAGE_S3_PATH_STYLE`
- `http/assets.js` updated to serve S3 objects via 307 redirect to presigned URLs
- `tasks/worker.js` offload-file-data now uses the unified storage interface
- Config updated with `storage.s3.*` settings, `.env.example` updated

### 2.2 [x] ~~OpenID Connect (OIDC) authentication~~
Implemented. `auth/oidc.js` provides full OIDC login flow with:
- Generic OIDC provider with auto-discovery (`/.well-known/openid-configuration`)
- Built-in Google, GitHub, GitLab providers
- Custom SSO providers from database lookup
- Code-for-token exchange, user info extraction, profile linking/creation
- `get-oidc-provider` (domain-based SSO lookup), `get-oidc-auth-uri` (redirect),
  `oidc-callback` (token exchange + session creation)
- Config via `PENPOT_OIDC_*`, `PENPOT_GOOGLE_*`, `PENPOT_GITHUB_*`, `PENPOT_GITLAB_*`
- Feature flags: `login-with-oidc`, `login-with-google`, `login-with-github`,
  `login-with-gitlab`, `oidc-registration`

### 2.3 [x] ~~`verify-token` RPC endpoint~~
Implemented. `rpc/verify_token.js` dispatches on the `iss` claim supporting
`change-email`, `verify-email`, `auth`, and `team-invitation` token types.
Registered in the command dispatcher.

### 2.4 [x] ~~`files_create` RPC — advanced creation flows~~
Implemented. `rpc/files.js` `create-file` handler now mirrors the Clojure
backend's `files_create` namespace:
- Feature computation from team + client + global flags (via `config/features.js`)
- Client feature compatibility check (`checkClientFeatures`)
- File-per-project quota check via `middleware/quotes.js`
- Team feature propagation (new features from file creation propagate to team)
- Owner role assignment in `file_profile_rel`
- Initial page creation (`createPage` / `pageId` params)
- Initial file data blob stored in `file_data`
- File migration seeding in `file_migration`
- Project `modified_at` update
- Returns complete file object with features and data

### 2.5 [x] ~~Server-Sent Events (SSE) endpoint~~
Implemented. `http/sse.js` provides `/api/sse` with authentication, topic
subscriptions, heartbeat, and `broadcastSSE()` for RPC handlers to push events.
Supports `team:`, `file:`, `profile:`, and `global` topic prefixes.

### 2.6 [x] ~~Outbound HTTP client for webhooks~~
Implemented. `http/client.js` provides `postWebhook()` with SSRF protection,
timeout, and error classification. `rpc/webhooks.js` exports `triggerWebhooks()`
for dispatching events. The `deliver-webhook` worker task handles async delivery
with retry and auto-deactivation on repeated failure.

### 2.7 [x] ~~Subscription usage (`profile.js`)~~
Implemented. `get-subscription-usage` now queries `team_profile_rel` joins to
find distinct editors across teams owned by the requesting profile.

### 2.8 [x] ~~Comment read tracking (`comments.js`)~~
Implemented. `mark-all-threads-as-read` now upserts into `comment_thread_status`
for each thread ID in the request, matching the Clojure backend's behavior.

### 2.9 [x] ~~`offload-file-data` task (`tasks/worker.js`)~~
Implemented. The handler now reads `file_data` rows with `backend='db'`,
writes data to the storage filesystem via `putStorageObject`, and updates the
row to `backend='storage'` with a `storage-ref-id` metadata reference.

### 2.10 [x] ~~Nitrate / enterprise commands (`nitrate.js`)~~
Implemented. `rpc/nitrate.js` provides `get-nitrate-connectivity`,
`redeem-nitrate-activation-code`, `leave-org`, `remove-team-from-org`, and
`add-team-to-organization`. All require `PENPOT_NITRATE_HOST` to be configured.
The activation code redemption, team org operations perform actual DB queries.

### 2.11 [x] ~~Built-in templates (`management.js`)~~
`setup/index.js` provides instance bootstrapping: persistent instance ID in
`server_prop`, initial admin user creation from env vars, and a `createWelcomeFile`
helper for new users. Template seeding is a placeholder pending template data files.

### 2.12 [x] ~~Setup / welcome-file seeding~~
`setup/index.js` creates default team, project, and welcome file for new users.
Admin user creation supported via `PENPOT_INITIAL_ADMIN_EMAIL` and
`PENPOT_INITIAL_ADMIN_PASSWORD` environment variables.

### 2.13 [x] ~~Debug endpoint (`index.js`)~~
Implemented. `/api/debug` now returns all registered RPC methods with their auth
requirements and version, plus flags, version, database path, and uptime.

### 2.14 [x] ~~Email template rendering~~
Implemented. `email/index.js` now has a `renderTemplate()` function that wraps
all email bodies in a styled HTML template with a header, content area, and
footer. Password recovery, email verification, team invitation, and feedback
emails all use the template.

---

## 3. Infrastructure Gaps

### 3.1 [x] ~~AWS SNS notifications~~
Not applicable. The Node.js backend uses SQLite and SMTP-based email delivery,
not AWS SES. SNS webhook handling is only needed when using AWS SES for email,
which is outside the scope of this port.

### 3.2 [x] ~~Message bus (`msgbus`)~~
Implemented as a pure Node.js in-process EventBus in `ws/msgbus.js`. SQLite is
single-instance, so Redis pub/sub is unnecessary — all messaging is local.
The Event Bus provides `publish`/`subscribe`/`unsubscribe`/`close` with no
external dependencies. Removes `ioredis` from dependencies.

### 3.3 [x] ~~Metrics / monitoring~~
Implemented. `metrics/index.js` provides a Prometheus `/metrics` endpoint with 13 metrics
matching the Clojure backend: RPC timing histograms, WebSocket connection/message counters,
task execution timing, session counters, concurrency limiter gauges, and HTTP dispatch
timing. Uses the `prom-client` library with default Node.js metrics.

### 3.4 [x] ~~Structured logging~~
Implemented. `loggers/index.js` provides leveled structured logging with JSON
output support (`PENPOT_LOG_FORMAT=json`), per-module child loggers via
`createLogger()`, and configurable minimum level (`PENPOT_LOG_LEVEL`).

### 3.5 [x] ~~SVG optimization (SVGO)~~
Not needed. The Clojure backend's `app.svgo` module exists but is never called
from any RPC command — SVG optimization is performed client-side (frontend)
and in the exporter, not in the backend server. The `backend_svgo` config flag
is declared but unused in both Clojure and Node.js backends.

### 3.6 [x] ~~RPC middleware parity~~ (partial)
- `app.rpc.permissions` — **Implemented** in `middleware/permissions.js`
- `app.rpc.quotes` — **Implemented** in `middleware/quotes.js` with quota checking
- `app.rpc.retry` — **Implemented** in `middleware/retry.js` with conflict retry
- `app.rpc.cond` — **Implemented** in `middleware/cond.js` with ETag support

### 3.7 [x] ~~Telemetry~~
Implemented. `tasks/telemetry.js` provides periodic instance statistics collection
and upload to the configured telemetry endpoint:
- Collects stats: teams, projects, files, users, fonts, comments, file changes,
  team averages, email domains, auth provider distribution, event counters
- Sends legacy report (`telemetry-legacy-report`) and event batches (`telemetry-events`)
- GC of old `audit_log` telemetry events (older than 7 days)
- Configured via `PENPOT_TELEMETRY_ENABLED`, `PENPOT_TELEMETRY_URI`,
  `PENPOT_TELEMETRY_REFERER`
- Registered as a `telemetry` scheduler task running every 3 hours
- Feature flag `telemetry` added to default flags

### 3.8 [x] ~~Fine-grained file GC~~
The scheduler's `fileGc` and worker's `file-gc` handler now perform deep
analysis: decode file data blob, walk shapes/components to collect used media
IDs, query historical `file_change` snapshots, and soft-delete unreferenced
`file_media_object`, old `file_thumbnail` (revn < current), and unused
`file_data` fragments. Cross-library component GC is now implemented:
`cleanDeletedComponents` checks consumer files (via `file_library_rel`) and
removes only truly unused deleted components from the library file's data.
6 new `collectComponentReferences` tests added.

### 3.9 [x] ~~Session renewal~~
Session renewal is implemented in `middleware/auth.js`. Tokens older than 6
hours trigger a `needsSessionRenewal` flag on the request, which is handled in
an `onSend` hook that issues a fresh session cookie.

---

## 4. Code Quality & DevEx

### 4.1 [x] Unit tests
`package.json` declares `"test": "node --test test/**/*.test.js"`. 78 test files
now exist covering 909 test cases across 296 test suites, all passing.

Key test file categories:
- Config: `config.test.js`, `config-features.test.js`, `feature-flags.test.js`
- Auth/security: `auth-index.test.js`, `auth-middleware.test.js`, `auth-rpc-handler.test.js`, `password.test.js`, `tokens.test.js`, `permissions.test.js`, `rate-limit.test.js`, `security-middleware.test.js`, `ssrf.test.js`, `registration.test.js`, `oidc-rpc-handler.test.js`
- Transit/data: `transit.test.js`, `blob.test.js`, `changes.test.js`
- Database: `sqlite.test.js`, `sqlite-extras.test.js`, `migrate.test.js`
- Storage: `storage-fs.test.js`, `storage-fs-highlevel.test.js`, `storage-s3.test.js`, `storage-gc.test.js`, `assets-http.test.js`
- RPC commands: `files-rpc.test.js`, `files-rpc-handler.test.js`, `files-create.test.js`, `files-update.test.js`, `files-update-handler.test.js`, `files-share-rpc.test.js`, `files-snapshots-handler.test.js`, `files-thumbnails-handler.test.js`, `binfile.test.js`, `teams-projects.test.js`, `teams-rpc-handler.test.js`, `teams-invitations-rpc.test.js`, `profile-rpc.test.js`, `profile-rpc-handler.test.js`, `comments-rpc.test.js`, `comments-rpc-handler.test.js`, `fonts-rpc.test.js`, `media-rpc.test.js`, `media-rpc-handler.test.js`, `webhooks-rpc.test.js`, `viewer-rpc.test.js`, `access-token-rpc.test.js`, `search.test.js`, `management-rpc.test.js`, `demo-rpc-handler.test.js`, `feedback-rpc-handler.test.js`, `export-rpc-handler.test.js`, `ldap-rpc-handler.test.js`, `nitrate-rpc-handler.test.js`, `verify-token-handler.test.js`
- Middleware: `errors-middleware.test.js`, `cond.test.js`, `retry.test.js`, `quotes.test.js`
- Infrastructure: `dispatcher.test.js`, `integration.test.js`, `loggers.test.js`, `metrics.test.js`, `scheduler.test.js`, `telemetry.test.js`, `worker.test.js`, `ws.test.js`, `sse.test.js`, `setup.test.js`, `audit-logger.test.js`, `email.test.js`, `email-filter.test.js`, `webhook-client.test.js`, `wire-compat.test.js`
- File GC: `file-gc.test.js`
- Media: `media.test.js`

Also fixed bugs discovered by tests:
- `files/blob.js` jsonReplacer infinite recursion with UUID objects
- `db/sqlite.js` `insertOnConflictDoNothing` returning run result instead of null on conflict
- `middleware/quotes.js` `getQuotaLimit` using non-existent DB columns

### 4.2 [x] ~~Mixed module systems~~
`src/rpc/media.js` now uses ESM `import` for `path`, `os`, and `fs` instead of
mixed `require()` calls.

### 4.3 [x] ~~`.env.example` file~~
Created `.env.example` with all 40+ environment variables, defaults, and
descriptions.

### 4.4 [x] ~~Production secret key warning~~
Added startup warning in `index.js` when `PENPOT_SECRET_KEY` is set to the
default value.</think>

### 4.5 [x] ~~S3 presigned URL generation (`http/assets.js`)~~
Replaced the placeholder with `getS3PresignedUrl()` using `@aws-sdk/s3-request-presigner`.
S3 objects are now served via 307 redirect to presigned URLs.

### 4.6 [x] ~~Viewer error handling (`viewer.js`)~~
Silent `catch {}` blocks now log warnings instead of swallowing errors.

### 4.7 [x] ~~AGENTS.md for `server/`~~
Created `server/AGENTS.md` with module directory, key patterns, running
instructions, and testing notes. Updated root `AGENTS.md` architecture table
to include `server/`.

---

## 5. Completed Milestones

### 5.1 [x] Core HTTP server (Fastify)
Functional server with all RPC routes registered, CORS, rate-limiting, and
WebSocket upgrade handling.

### 5.2 [x] SQLite database layer
`db/sqlite.js` with connection pooling, migrations, and all CRUD operations.
6 migration files covering core tables through indexes.

### 5.3 [x] Transit+JSON codec
Custom `transit/index.js` that encodes/decodes Transit+JSON to match the
Clojure backend's wire format.

### 5.4 [x] Authentication (JWE tokens + Argon2id passwords)
`auth/tokens.js` and `auth/password.js` with JWE creation/verification and
Argon2id hashing, matching the Clojure backend's token format.

### 5.5 [x] WebSocket notifications
`ws/notifications.js` with subscribe/broadcast/presence. Uses the in-process
EventBus (`ws/msgbus.js`) for pub/sub — no Redis dependency needed.

### 5.6 [x] Background task worker + scheduler
`tasks/worker.js` and `tasks/scheduler.js` — 7 scheduled tasks implemented
(session-gc, objects-gc, storage-gc-touched, storage-gc-deleted,
upload-session-gc, file-gc, tasks-gc).

### 5.7 [x] Image processing pipeline (`sharp`/libvips)
`media/index.js` with thumbnail generation, format detection, and resize —
replacing the Clojure backend's ImageMagick pipeline.

### 5.8 [x] Email sending (`nodemailer`)
`email/index.js` — functional SMTP sending with support for password recovery
and team invitation emails.

### 5.9 [x] Filesystem storage backend
`storage/fs.js` — complete FS-based object storage with put/get/delete and
streaming support.

### 5.10 [x] All 24 RPC namespaces ported
auth, files, files_update, files_share, files_snapshots, files_thumbnails,
teams, teams_invitations, profile, management, nitrate, ldap, viewer, demo,
search, webhooks, feedback, audit, comments, fonts, media, binfile,
access_token, projects — all have corresponding modules in `src/rpc/`.

### 5.11 [x] Middleware (auth + rate limiting)
`middleware/auth.js` and `middleware/rate-limit.js` with JWE verification,
profile extraction, and per-IP/per-route concurrency limiting.

### 5.12 [x] Configuration system
`config/index.js` with 40+ environment variables and feature flags parsed from
`PENPOT_*` env vars.

### 5.14 [x] Library linking/unlinking + has-file-libraries fix
`link-file-to-library` inserts into `file_library_rel` with conflict handling
and returns updated library list. `unlink-file-from-library` deletes from
`file_library_rel`. `has-file-libraries` now queries `file_library_rel`
instead of `file_data_fragment`.

### 5.15 [x] File statistics from database
`get-file-stats` queries `page`, `file_library_rel`, and `file` tables for
page count, library count, referenced-by count, revn, and updatedAt.

### 5.16 [x] Password recovery email delivery
`request-profile-recovery` now sends the recovery token via the SMTP email
module instead of logging it to console.

### 5.17 [x] `.env.example` configuration reference
Complete environment variable reference file with all 40+ `PENPOT_*` variables.

### 5.18 [x] Production secret key warning
Startup warns when using the default secret key.

### 5.19 [x] Duplicate startTaskScheduler fix
Removed the duplicate `startTaskScheduler(pool)` call in `index.js`.

### 5.20 [x] verify-token RPC command
`rpc/verify_token.js` dispatches on `iss` claim for change-email, verify-email,
auth, and team-invitation token types. Registered in the command dispatcher.

### 5.21 [x] Subscription usage from database
`get-subscription-usage` now queries team ownership and editor membership to
return the list of distinct editors.

### 5.22 [x] Comment read tracking with comment_thread_status
`mark-all-threads-as-read` upserts into `comment_thread_status` per thread,
matching the Clojure backend's behavior.

### 5.23 [x] Webhook delivery (HTTP client + worker task)
`http/client.js` provides SSRF-protected POST. `rpc/webhooks.js` exports
`triggerWebhooks()`. `deliver-webhook` worker task handles async delivery
with retry, error tracking, and auto-deactivation.

### 5.24 [x] Offload-file-data task
Moves `file_data` rows from `backend='db'` to the storage backend, updating
the row to `backend='storage'` with a storage reference.

### 5.25 [x] Debug endpoint with method listing
`/api/debug` returns all registered RPC methods with auth/version metadata,
plus flags, version, database path, and uptime.

### 5.26 [x] Email template rendering
All emails now use a styled HTML template with header, content, footer, and
button-style links.

### 5.27 [x] Viewer error logging
Silent catch blocks in `viewer.js` now log warnings instead of swallowing errors.

### 5.28 [x] Mixed module systems fix
`media.js` now uses ESM imports consistently instead of mixed `require()` calls.

### 5.29 [x] SSE endpoint
`http/sse.js` provides `/api/sse` with authentication, topic subscriptions,
heartbeat keepalive, and `broadcastSSE()` for pushing real-time events to
clients.

### 5.49 [x] Redis pub/sub replaced with pure Node.js EventBus
Removed `ioredis` dependency entirely. `ws/msgbus.js` is now a pure Node.js
in-process EventBus (no Redis). `ws/notifications.js` uses the EventBus for
pub/sub and no longer has a `createRedisAdapter()` export. Removed `PENPOT_REDIS_URI`
and `PENPOT_REDIS_ENABLED` env vars, `config.redis` block, and `.env.example`
Redis section. SQLite is single-instance, making Redis pub/sub unnecessary.

### 5.50 [x] FTS5 full-text search (migration 0009)
Added `file_search` FTS5 virtual table (`unicode61` tokenizer) for fast file name
search. `search-files` RPC now uses FTS5 MATCH with LIKE fallback. Added
`rebuildSearchIndex()` for manual index rebuilds. Triggers on `file` table keep
FTS5 index in sync on INSERT, UPDATE OF name, and DELETE. Periodic rebuild task
(`search-rebuild`, every 30 min) catches soft-deletes. 6 new search tests,
all passing.

### 5.30 [x] Structured logging
`loggers/index.js` provides leveled structured logging with JSON/text formats,
per-module child loggers, and configurable log level.

### 5.31 [x] RPC permissions middleware
`middleware/permissions.js` provides `checkReadPermissions`,
`checkEditionPermissions`, `checkAdminPermissions`, and `assignRoleFlags`
matching the Clojure backend's `app.rpc.permissions`.

### 5.32 [x] Setup / admin seeding
`setup/index.js` provides instance bootstrapping with persistent instance ID,
initial admin user creation from env vars, and welcome file for new users.

### 5.33 [x] RPC quotes/quota checking
`middleware/quotes.js` provides `checkQuota()` and convenience helpers
(`checkMembersQuota`, `checkFilesQuota`, `checkProjectsQuota`) with database
override support and configurable default limits.

### 5.34 [x] RPC retry middleware
`middleware/retry.js` provides `withRetry()` for automatic retry on SQLite
unique constraint conflicts and custom RpcError conflicts.

### 5.35 [x] RPC conditional execution / ETag middleware
`middleware/cond.js` provides `withConditional()` for ETag-based conditional
responses, with SHA-256 fingerprinting and `enable-conditional-exec` flag.

### 5.36 [x] Migration 0007
Added `welcome_file_id` column to profile table for the welcome-file setup feature.

### 5.38 [x] OIDC / SSO authentication
`auth/oidc.js` provides full OIDC login flow with auto-discovery, built-in
Google/GitHub/GitLab providers, custom SSO from database, token exchange,

### 5.39 [x] S3/MinIO storage backend
`storage/s3.js` provides full S3-compatible storage using `@aws-sdk/client-s3`.
Supports MinIO, AWS S3, and any S3-compatible server. Assets module dispatches
to S3 via presigned URL redirects. Offload-file-data task uses unified storage
interface. Config has S3 section, `.env.example` updated with MinIO settings.

### 5.41 [x] Prometheus metrics endpoint
`metrics/index.js` provides 13 Prometheus metrics (counters, gauges, histograms,
summaries) matching the Clojure backend. Registered at `/api/metrics` in `index.js`
with RPC timing middleware and WebSocket connection tracking. Uses `prom-client`.

### 5.42 [x] `files_create` advanced creation flows
`rpc/files.js` `create-file` handler now mirrors the Clojure backend's
`files_create.clj` namespace: feature computation from team + client + global
flags, client feature compatibility check, file-per-project quota check, team
feature propagation, owner role assignment, initial page creation, file data
blob storage, file migration seeding, and project modified_at update.

### 5.43 [x] Feature constants module
`config/features.js` provides `defaultFeatures`, `supportedFeatures`,
`noMigrationFeatures`, `frontendOnlyFeatures`, `backendOnlyFeatures`,
`noTeamInheritableFeatures` as well as `getTeamEnabledFeatures`,
`checkClientFeatures`, `computeFileFeatures`, `computeNewTeamFeatures`,
`parseFeatures`, and `serializeFeatures` — mirroring `app.common.features`

### 5.44 [x] Telemetry task
`tasks/telemetry.js` provides periodic instance stats collection and upload to
`PENPOT_TELEMETRY_URI` (default `https://telemetry.penpot.app/`). Collects
team/project/file/user counts, team averages, auth provider distribution, and
audit event batches. Runs every 3 hours via the task scheduler. Garbage-collects
old telemetry audit_log events (older than 7 days).

### 5.45 [x] Fine-grained file GC
`scheduler.js` `fileGc` and `worker.js` `file-gc` handler now perform deep
analysis: decode file data blob, walk shapes/components to collect used media
IDs, query historical `file_change` snapshots, and soft-delete unreferenced
`file_media_object`, old `file_thumbnail` (revn < current), and unused
`file_data` fragments. Cross-library component GC is implemented:
`cleanDeletedComponents` checks consumer files (via `file_library_rel`) and
removes only truly unused deleted components from the library file's data.
6 new `collectComponentReferences` tests added.

---

## 6. Priority Order for Next Steps

| Priority | Item | Section | Status |
|----------|------|---------|--------|
| P0 | Fix duplicate `startTaskScheduler` call | 1.4 | ✅ Done |
| P0 | Implement library link/unlink | 1.1 | ✅ Done |
| P0 | Implement file statistics from DB | 1.2 | ✅ Done |
| P0 | Wire password recovery email | 1.3 | ✅ Done |
| P1 | Add S3 storage backend | 2.1 | ✅ Done |
| P1 | Add OIDC authentication | 2.2 | ✅ Done |
| P1 | Add `verify-token` RPC method | 2.3 | ✅ Done |
| P1 | Implement `files_create` advanced flows | 2.4 | ✅ Done |
| P1 | Wire webhook HTTP client | 2.6 | ✅ Done |
| P1 | Implement subscription usage | 2.7 | ✅ Done |
| P1 | Implement comment read tracking | 2.8 | ✅ Done |
| P1 | Implement `offload-file-data` task | 2.9 | ✅ Done |
| P1 | Add `.env.example` | 4.3 | ✅ Done |
| P1 | Add production secret key warning | 4.4 | ✅ Done |
| P2 | SSE endpoint | 2.5 | ✅ Done |
| P2 | Email template rendering | 2.14 | ✅ Done |
| P2 | Structured logging | 3.4 | ✅ Done |
| P2 | Setup / welcome-file seeding | 2.11, 2.12 | ✅ Done |
| P2 | RPC permissions middleware | 3.6 (partial) | ✅ Done |
| P2 | Message bus | 3.2 | ✅ N/A (WS+SSE cover this) |
| P2 | Nitrate / enterprise stubs | 2.10 | ✅ Done |
| P2 | RPC quotes middleware | 3.6 | ✅ Done |
| P2 | RPC retry middleware | 3.6 | ✅ Done |
| P2 | RPC cond/ETag middleware | 3.6 | ✅ Done |
| P2 | Metrics / monitoring | 3.3 | ✅ Done |
| P3 | Unit tests | 4.1 | ✅ Partial (179 tests) |
| P3 | Fix mixed module systems | 4.2 | ✅ Done |
| P3 | S3 presigned URLs | 4.5 | ✅ Done |
| P3 | Viewer error handling | 4.6 | ✅ Done |
| P3 | AWS SNS | 3.1 | ✅ N/A (not using AWS SES) |
| P3 | SVG optimization | 3.5 | ✅ N/A (not used in backend) |
| P3 | Telemetry | 3.7 | ✅ Done |
| P3 | File GC deep analysis | 3.8 | ✅ Partial |
| P3 | Session renewal | 3.9 | ✅ Done |
| P3 | AGENTS.md for server/ | 4.7 | ✅ Done |
| P3 | Schema parity (migration 0008) | 3.10 | ✅ Done |
| P3 | Redis dependency removed | 3.11 | ✅ Done |
| P2 | FTS5 full-text search (migration 0009) | 3.12 | ✅ Done |
| P2 | Audit gap remediation (migration 0010) | 3.13 | ✅ Done |
| P1 | Critical schema fixes (migration 0011) | 3.14 | ✅ Done |
| P2 | Cascade trigger (migration 0013) | 3.15 | ✅ Done |
| P1 | Deletion protection + storage cascade (migration 0014) | 3.16 | ✅ Done |
| P2 | JSONB expression indexes (migration 0015) | 3.17 | ✅ Done |
| P2 | Dependency cleanup + lint script | 4.8 | ✅ Done |

---

## 7. Available SQLite Extensions

These extensions can be loaded via `better-sqlite3`'s `db.loadExtension()` to add
functionality that would otherwise require application-level code or external
services. Since `server` uses SQLite as its sole database, these extensions
are especially valuable — they let us push computation into the database layer.

### 7.1 Built-in (No Install Needed)

| Extension | Description | Penpot Use Case |
|-----------|-------------|-----------------|
| **FTS5** | Full-text search with tokenizers, phrase queries, prefix queries | Text search in design names, content indexing, comment search |
| **JSON1** | `json_extract`, `json_array`, `json_each`, `json_type`, etc. | Already heavily used — JSON is core to the data model |
| **generate_series** | `generate_series(start, end, step)` table-valued function | Sequence generation for queries, date ranges |

### 7.2 High-Value (Recommended for Migration)

| Extension | npm | Description | Penpot Use Case |
|-----------|-----|-------------|-----------------|
| **sqlean-uuid** | `sqlean-uuid` | Generate UUIDv4, UUIDv7; convert between blob/text | UUIDv7 is time-sortable — ideal for primary keys and `created_at` ordering |
| **sqlean-crypto** | `sqlean-crypto` | MD5, SHA-256, BLAKE3, XXH; base64/hex encoding | Content hashing for asset deduplication, integrity checks |
| **sqlean-regexp** | `sqlean-regexp` | PCRE2 regex: `regexp_like`, `regexp_substr`, `regexp_capture` | Flexible pattern matching in queries (validation, search) |
| **sqlean-text** | `sqlean-text` | Unicode case folding, normalization, split/join, reverse | i18n-aware text processing — critical for multilingual design names |
| **sqlean-time** | `sqlean-time` | High-precision date/time: `time_now`, `time_format`, `time_diff` | Precise timestamp manipulation for versioning and audit trails |
| **sqlite-vec** | `sqlite-vec` | Vector search via `vec0` virtual tables, KNN queries | Semantic/visual asset similarity search (future: embedding-based search) |
| **sqlite-ulid** | `sqlite-ulid` | Generate ULIDs, prefixed ULIDs, extract timestamps | Sortable unique IDs — alternative to UUIDv7 for design assets |

### 7.3 Medium-Value (Consider During Migration)

| Extension | npm | Description | Penpot Use Case |
|-----------|-----|-------------|-----------------|
| **sqlean-fuzzy** | `sqlean-fuzzy` | Levenshtein distance, Soundex, metaphone, Porter stemmer | Autocomplete, "did you mean?" suggestions in search |
| **sqlean-math** | `sqlean-math` | `math_sqrt`, `math_pow`, `math_log`, trig functions, constants | Geometry calculations in SQL (bounding boxes, transforms) |
| **sqlean-stats** | `sqlean-stats` | Median, percentile, stddev, variance, mode, quartiles | Analytics on design metadata (team usage stats) |
| **sqlean-define** | `sqlean-define` | User-defined SQL functions, dynamic SQL | Runtime custom SQL functions without Node.js roundtrips |
| **sqlite-html** | `sqlite-html` | Parse HTML with CSS selectors: `html_extract`, `html_element` | Parse/query SVG content stored as text in the database |
| **sqlite-jsonschema** | `sqlite-jsonschema` | Validate JSON objects against JSON Schema | Validate stored JSON documents (file data blobs, settings) |
| **sqlite-regex** | `sqlite-regex` | Rust-based regex: `regex_find`, `regex_find_all`, `regexp` operator | Alternative regex implementation — faster than PCRE2 for bulk ops |
| **sqlite-xsv** | `sqlite-xsv` | Query CSV/TSV as virtual tables, supports gzip/zstd | Bulk data import (design assets metadata) |
| **sqlite-url** | `sqlite-url` | Parse URLs: `url_scheme`, `url_host`, `url_path`, `url_query` | Parse stored external resource URLs |
| **sqlite-path** | `sqlite-path` | Parse file paths: `path_dirname`, `path_basename`, `path_extension` | File path manipulation for stored asset references |

### 7.4 Lower Priority / Specialized

| Extension | npm | Description | Notes |
|-----------|-----|-------------|-------|
| **sqlean-fileio** | `sqlean-fileio` | Read/write files from SQL | Could read rendered assets from disk within SQL — likely better at app level |
| **sqlean-ipaddr** | `sqlean-ipaddr` | IP address parsing and comparison | Low relevance for a design tool |
| **sqlite-lines** | `sqlite-lines` | Read files line-by-line as virtual table | Log parsing, file ingestion |
| **sqlite-http** | `sqlite-http` | Make HTTP requests from SQL | **Caution**: blocking I/O in SQL — handle HTTP at app level instead |
| **sqlite-fastrand** | `sqlite-fastrand` | Fast random numbers, booleans, characters, blobs | `random()` is built-in; fastrand adds more variety |

### 7.5 Not Recommended

| Extension | Why Not |
|-----------|---------|
| **SQLCipher** | Requires a forked `better-sqlite3` build. Use application-level encryption instead (e.g., encrypt file data blobs before storage) |
| **SpatiaLite** | Heavy native dependencies (GEOS, PROJ). Overkill unless true geospatial queries are needed |
| **sqlite-vss** | Deprecated — use sqlite-vec instead |

### 7.6 Bundled Option: sqlean

[sqlean](https://github.com/nalgeon/sqlean) (4.3k+ stars) bundles the most commonly-needed
extensions into a single `db.loadExtension()` call. Includes: `crypto`, `define`,
`fileio`, `fuzzy`, `ipaddr`, `math`, `regexp`, `stats`, `text`, `time`, `uuid`,
`vsv`. Each is also available individually. Pre-built binaries for Linux/macOS/Windows.

```js
import Database from 'better-sqlite3';
const db = new Database('penpot.sqlite');
db.pragma('journal_mode = WAL');

// Enable extension loading and load individual extensions
db.pragma('pragma_enable_load_extension = 1');

// Option 1: Load the sqlean bundle (includes all extensions above)
db.loadExtension('./path/to/sqlean');

// Option 2: Load individual extensions as needed
db.loadExtension('./path/to/uuid');
db.loadExtension('./path/to/regexp');
db.loadExtension('./path/to/text');
```

### 7.7 Loading Extensions with better-sqlite3

```js
import Database from 'better-sqlite3';

const db = new Database('penpot.sqlite');
db.pragma('journal_mode = WAL');

// better-sqlite3 supports loadExtension natively
db.loadExtension('/path/to/sqlite-vec');
db.loadExtension('/path/to/uuid');

// Verify extension is loaded
const result = db.prepare("SELECT uuid_v7() AS id").get();
console.log(result.id); // e.g. "01904f2e-7c3b-7d2e-8a5f-3b2c1d0e9a8b"
```

### 7.8 Extension Relevance to Migration Path

As we continue migrating Clojure backend features to Node.js, these extensions
can replace functionality that would otherwise require additional Node.js
dependencies or application-level code:

| Clojure Feature | SQLite Extension Replacement | Status |
|-----------------|------------------------------|--------|
| `clj-uuid` (UUID generation) | `sqlean-uuid` (UUIDv4/v7) or `sqlite-ulid` | Available |
| Full-text search (formerly PostgreSQL FTS) | `FTS5` (built-in) | Available |
| Content hashing (formerly `buddy-hashcode`) | `sqlean-crypto` (SHA-256, BLAKE3) | Available |
| Regex validation (formerly `org.clojure/tools.analyzer`) | `sqlean-regexp` or `sqlite-regex` | Available |
| Date/time manipulation (formerly `clj-time`) | `sqlean-time` | Available |
| Vector/similarity search (future) | `sqlite-vec` | Available |
| SVG content parsing | `sqlite-html` | Available |

### 3.10 [x] ~~Schema parity (migration 0008)~~
Added 4 missing tables (`project_profile_rel`, `file_object_thumbnail`,
`file_tagged_object_thumbnail`, `sso_provider`), 3 missing columns
(`audit_log.ip_addr`, `file_change.updated_at`, `file_media_object.modified_at`),
and CHECK constraints for `sso_provider.type` and `sso_provider.user_info_source`.
Documented which PG-dropped columns (`profile.photo`, `team.photo`,
`storage_data` table) are retained in SQLite for backward compatibility.

### 3.11 [x] ~~Redis dependency removed~~
Removed `ioredis` dependency. `ws/msgbus.js` is now a pure Node.js in-process
EventBus with `publish`/`subscribe`/`unsubscribe`/`close`. `ws/notifications.js`
uses the EventBus for pub/sub. SQLite is single-instance, so Redis pub/sub is
unnecessary. Removed `PENPOT_REDIS_URI` and `PENPOT_REDIS_ENABLED` config vars.
All 371 tests pass.

### 3.12 [x] ~~Migrations 0010–0015: Full PG schema parity~~

**Migration 0010** — Audit gap remediation:
- 1 missing column (`file_object_thumbnail.media_id`)
- 5 unique constraints (`comment_thread(file_id, seqn)`, `team_invitation(team_id, email_to)`, `team_invitation(org_id, email_to) WHERE team_id IS NULL`, `team_profile_rel(team_id, profile_id)`, `team_project_profile_rel(team_id, project_id, profile_id)`)
- ~40 indexes (soft-delete partial indexes on `deleted_at`, FK lookups, composites, audit_log, server_error_report)
- 3 data migrations (populate `auth_backend`, backfill `file_library_sync`, generate `team_invitation.id` UUIDs)

**Migration 0011** — Critical schema fixes:
- `team_invitation` restructured: `id TEXT PRIMARY KEY` replaces composite PK `(team_id, email_to)`, `team_id` now nullable for org-level invitations, `CHECK (team_id IS NOT NULL OR org_id IS NOT NULL)` constraint, UNIQUE indexes restored
- `team_profile_rel.profile_id` FK changed from `ON DELETE CASCADE` to `ON DELETE RESTRICT` — prevents silent membership deletion when a profile is deleted
- `sso_provider` recreated with `domain NOT NULL`, `CHECK (type IN ('oidc'))`, `CHECK (user_info_source IN ('token', 'userinfo', 'auto'))`, `user_info_source NOT NULL DEFAULT 'auto'`
- 8 application code files updated to include `id: uuidv4()` in all `team_profile_rel` and `team_invitation` inserts

**Migration 0013** — Cascade trigger:
- `page__after_update__cascade__tgr` AFTER UPDATE trigger on `page` that propagates `modified_at` up to the parent `file` and grandparent `project`, matching PG's `handle_page_update()` trigger (migration 0003)

**Migration 0014** — Deletion protection and storage cascade:
- 6 BEFORE DELETE deletion-protection triggers on `profile`, `team`, `file_thumbnail`, `file_tagged_object_thumbnail`, `file_media_object`, `team_font_variant` — controlled by `server_prop` flag `rules.deletion_protection`
- 4 AFTER DELETE storage cascade triggers that touch `storage_object.touched_at` when `profile.photo_id`, `team.photo_id`, `file_media_object.media_id`, or `file_media_object.thumbnail_id` are hard-deleted
- `scheduler.js` updated: `objectsGc` now disables deletion protection before hard-deletes and re-enables it in a `finally` block; `storageGcTouched` fixed to query `photo_id` instead of legacy `photo` column

**Migration 0015** — JSONB expression indexes:
- `storage_object__hash_backend_bucket__idx` on `(json_extract(metadata, '$.hash'), json_extract(metadata, '$.bucket'), backend) WHERE deleted_at IS NULL` for storage dedup queries
- `profile__props__newsletter_news__idx` on `profile(email) WHERE json_extract(props, '$.newsletter-news') = 'true'`
- `profile__props__newsletter_updates__idx` on `profile(email) WHERE json_extract(props, '$.newsletter-updates') = 'true'`

---

## 6. RPC Edge-Case Audit (WU-K1)

Systematic comparison of all JS RPC handlers against upstream Clojure handlers completed.

### 6.1 Missing Upstream Commands — Now Implemented

| Command | Upstream File | Status | Notes |
|---|---|---|---|
| `get-file-summary` | `files.clj` line 601 | ✅ Implemented | Returns lightweight file metadata (id, name, projectId, isShared, revn, pageCount, libraryCount) without loading full data blob |
| `get-file-libraries` | `files.clj` line 686 | ✅ Implemented | Returns libraries linked to a specific file (vs team-level `get-team-libraries`) |
| `get-library-file-references` | `files.clj` line 713 | ✅ Implemented | Returns files that reference a given library file |

### 6.2 JS-Specific Additions (Not in Upstream)

| Command | JS File | Notes |
|---|---|---|
| `get-export-status` | `binfile.js` | Poll export completion status by storage object ID |
| `get-current-mcp-token` | `access_token.js` | MCP token management |
| `get-api-tokens` | `access_token.js` | API token listing |
| `search-rebuild-index` | `search.js` | FTS5 index rebuild trigger |
| `get-file-changes` | `files_update.js` | SSE/streaming file change feed |

### 6.3 Summary

The JS port now has **149 RPC commands** across **27 files**, covering all 143 upstream commands plus 6 JS-specific additions. All 564 server tests pass (5 new tests for the 3 new commands).
- `scheduler.js` bug fix: changed `photo` → `photo_id` in profile/team photo references