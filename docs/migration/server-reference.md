# server — Node.js Port Agent Guide

Node.js (ESM) port of the Penpot backend, using Fastify + SQLite (better-sqlite3).

## Architecture

```
src/
├── index.js              # Entry point: Fastify server, route registration, startup
├── config/
│   ├── index.js          # PENPOT_* env vars, feature flags, frozen config object
│   └── features.js       # Feature flag constants (default, no-migration, etc.)
├── db/
│   ├── sqlite.js          # Database pool, CRUD helpers, migrations runner
│   └── migrate.js         # Standalone migration runner CLI
├── auth/
│   ├── index.js           # Argon2id password hashing, profile lookup
│   ├── tokens.js          # JWE token creation/verification
│   ├── password.js        # Password derivation (Argon2id)
│   └── oidc.js            # OpenID Connect / SSO login flow
├── rpc/
│   ├── dispatcher.js      # RPC method registry & dispatch
│   ├── auth.js             # Authentication RPC commands
│   ├── files.js            # File management (create, get, rename, delete, libraries)
│   ├── files_update.js     # Collaborative file editing engine
│   ├── binfile.js          # Binary file import/export (ZIP archives)
│   ├── projects.js         # Project CRUD
│   ├── teams.js            # Team management
│   ├── teams_invitations.js# Team invitations
│   ├── profile.js          # User profile commands
│   ├── comments.js         # Comment threads & read tracking
│   ├── media.js            # Media upload/processing
│   ├── fonts.js            # Font upload/management
│   ├── webhooks.js         # Webhook registration & delivery
│   ├── feedback.js         # User feedback
│   ├── audit.js            # Audit log & telemetry events
│   ├── management.js        # Management API
│   ├── nitrate.js           # Enterprise/nitrate stubs
│   ├── ldap.js              # LDAP auth stubs
│   ├── viewer.js            # Read-only file viewer
│   ├── demo.js              # Demo mode
│   ├── search.js            # Search
│   ├── access_token.js      # API access tokens
│   ├── files_share.js      # File sharing
│   ├── files_snapshots.js  # File snapshots
│   ├── files_thumbnails.js # File thumbnails
│   ├── export.js             # Export proxy (forwards to exporter service)
│   └── verify_token.js      # Token verification
├── middleware/
│   ├── auth.js             # JWE auth extraction, CSRF, session renewal
│   ├── errors.js           # Structured error handling (RpcError → HTTP status)
│   ├── rate-limit.js       # Per-IP and per-profile concurrency limiting
│   ├── permissions.js      # Team/file role checks
│   ├── quotes.js           # Resource quota checking
│   ├── retry.js            # Conflict retry middleware
│   ├── cond.js             # ETag/conditional execution
│   └── security.js         # HTTP security headers (CSP, HSTS, CORS, X-Frame-Options)
├── http/
│   ├── assets.js           # Static asset serving (FS + S3 presigned redirects)
│   ├── sse.js              # Server-Sent Events endpoint
│   └── client.js           # Outbound HTTP client (webhooks, SSRF protection)
├── ws/
│   ├── notifications.js    # WebSocket pub/sub (in-process EventBus)
│   └── msgbus.js           # Topic-based pub/sub message bus (pure Node.js, no Redis)
├── email/
│   └── index.js            # SMTP email sending, blacklist/whitelist domain filtering
├── files/
│   ├── blob.js             # Binary file data encoding/decoding (LZ4 + JSON)
│   └── changes.js          # Change processing (shape mutations)
├── storage/
│   ├── fs.js               # Filesystem object storage
│   └── s3.js               # S3/MinIO object storage (lazy SDK loading)
├── tasks/
│   ├── scheduler.js        # Periodic task scheduler (session-gc, file-gc, etc.)
│   ├── worker.js           # Background task handlers (offload, webhooks, etc.)
│   ├── storage_gc.js       # Storage object garbage collection (deleted + orphaned)
│   └── telemetry.js        # Instance stats collection & upload
├── transit/
│   └── index.js            # Transit+JSON codec
├── loggers/
│   ├── index.js            # Structured logging (text + JSON formats)
│   └── audit.js            # Audit event logging, archival, GC
├── metrics/
│   └── index.js            # Prometheus /metrics endpoint
├── media/
│   └── index.js            # Image processing (sharp/libvips)
└── setup/
    └── index.js             # Instance bootstrapping, admin user, welcome file
exporter/                         # Standalone Playwright-based export service
├── src/
│   ├── core.js              # HTTP server startup, request routing, progress broadcast
│   ├── config.js             # PENPOT_EXPORTER_* and PENPOT_BROWSER_* env vars
│   ├── browser.js            # Playwright Chromium browser pool (acquire/release/evict)
│   ├── redis.js              # Redis pub/sub for export progress notifications
│   ├── handlers.js            # Request validation, command dispatch, auth checking
│   ├── handlers/
│   │   ├── export_shapes.js  # export-shapes command (PNG/JPEG/WebP/SVG)
│   │   └── export_frames.js  # export-frames command (PDF multi-frame)
│   ├── renderer/
│   │   ├── index.js           # Renderer dispatch (type → bitmap/svg/pdf)
│   │   ├── bitmap.js          # PNG/JPEG/WebP via Playwright screenshots + ImageMagick
│   │   ├── svg.js             # SVG via DOM extraction + foreignObject rasterization
│   │   ├── pdf.js             # PDF via Playwright page.pdf() + pdfunite merge
│   │   └── resources.js       # Temp files, zip archives, upload to server
│   └── util.js                # Logger, temp files, sanitization, sleep
└── test/
    └── exporter.test.js       # 22 unit tests
```

## Key Patterns

- **Database**: `better-sqlite3` synchronous SQLite. Use `pool.transaction(fn)` for
  transactional writes. All CRUD helpers auto-convert camelCase ↔ snake_case.
- **RPC**: Register commands with `register(name, { auth, added, handler })`.
  Handlers receive `(params, ctx)` where `ctx.profileId` is the authenticated user.
- **Errors**: Throw `RpcError(type, code, hint, extra)` for structured error responses.
  The `errorHandler` middleware maps error types to HTTP status codes automatically.
- **Feature flags**: `flagEnabled('name')` reads from `PENPOT_FLAGS` env var.
  Feature constants live in `config/features.js`.
- **File data**: Encoded as LZ4-compressed JSON blobs via `files/blob.js`.
  Version 5 format: `[2-byte version][4-byte magic][compressed payload]`.
- **Storage**: Dual backend — filesystem (`storage/fs.js`) or S3 (`storage/s3.js`),
  selected via `PENPOT_STORAGE_BACKEND` env var.
- **Migrations**: Numbered SQL files in `migrations/`. Auto-run on startup.
  21 migrations (0001–0021) achieve full PG schema parity:
  - 0001–0009: Core tables, media, snapshots, email, full parity, tasks, indexes, welcome file, FTS5
  - 0010: Audit gap remediation (40+ indexes, 5 constraints, 1 column, 3 data migrations)
  - 0011: Critical schema fixes (`team_invitation` restructure, `team_profile_rel` RESTRICT FK, `sso_provider` CHECKs)
  - 0013: Page→file→project `modified_at` cascade trigger
  - 0014: Deletion protection triggers (6 tables) + storage object cascade triggers
  - 0015: JSONB expression indexes for storage dedup and newsletter queries
  - 0016: Data integrity (file_data.type NOT NULL, audit_log TEXT PK + context col, drop obsolete columns)
  - 0017: Schema parity fixes (file_data.backend nullable, file_change.created_by NOT NULL, NOT NULL constraints, missing indexes, FK RESTRICT on file_library_rel, composite PK on scheduled_task_history)
  - 0018: Obsolete column cleanup (file_data_fragment.content), share_link NOT NULL constraints, storage_pending table, http_session updated_at index
  - 0019: FK corrections (storage_object refs RESTRICT, file refs RESTRICT, sso_provider CASCADE), NOT NULL tightening (comment_thread), file_media_object.is_local dropped
  - 0020: Final parity cleanup — obsolete tables dropped (pending_to_delete, storage_pending), file_object_thumbnail FK fix, can_edit DEFAULT false, team_access_request NOT NULL, audit_log.profile_id NOT NULL + tracked_at DEFAULT, missing indexes (project/team_id, task/scheduled_at+queue, team_font_variant/team+font)
  - 0021: Remaining FK fix (file_library_rel.library_file_id CASCADE), page obsolete columns dropped (version, share_token), covering index for file_tagged_object_thumbnail deleted_at
- **Message bus**: `ws/msgbus.js` provides topic-based pub/sub via a pure Node.js
  EventBus. Since SQLite is single-instance, no Redis is needed — all messaging
  is in-process. The `broadcast` function in `notifications.js` publishes to
  both WebSocket subscribers and the EventBus.
- **Security headers**: `middleware/security.js` adds CSP, HSTS, X-Frame-Options,
  X-Content-Type-Options, and CORS headers to all responses.
- **SQLite extensions**: `better-sqlite3` supports `db.loadExtension()` for runtime
  extensions. See [`server-next-steps.md`](server-next-steps.md) §7 for the full catalog. Key ones: `sqlean-uuid`
  (UUIDv7), `sqlean-crypto` (hashing), `sqlean-regexp` (PCRE2), `sqlean-text`
  (Unicode), `sqlean-time` (high-precision timestamps), `sqlite-vec` (vector search).
- **Migration tracking**: See [`docs/migration/tracking.md`](../../docs/migration/tracking.md)
  for the master migration document tracking progress across all phases (shared,
  server, client, server/exporter). Includes file counts, test status, and per-module
  completion details.

## Running

```bash
# Start the server
node src/index.js

# Run migrations only
node src/db/migrate.js

# Run linter (syntax check all source files)
npm run lint
```

## Testing

```bash
# Node.js built-in test runner
node --test test/**/*.test.js

# Lint all source files
npm run lint
```

Tests run with `node --test test/**/*.test.js` (57 test files, 529 tests, 0 fail). Exporter tests run with `node --test test/exporter.test.js` (22 tests, 0 fail). When adding tests, use the built-in `node:test` and `node:assert` modules.

## Environment

All config is via `PENPOT_*` environment variables. See `.env.example` for the
full reference. Key variables:

- `PENPOT_DATABASE_PATH` — SQLite file path (default: `penpot.sqlite`)
- `PENPOT_HTTP_PORT` — Server port (default: `6060`)
- `PENPOT_SECRET_KEY` — JWE signing key (REQUIRED)
- `PENPOT_FLAGS` — Feature flags (e.g. `enable-telemetry enable-quotes`)
- `PENPOT_STORAGE_BACKEND` — `fs` or `s3`
- `PENPOT_CORS_ORIGIN` — CORS allowed origin (default: `*`)
- `PENPOT_EMAIL_WHITELIST` — Comma-separated allowed email domains (optional)
- `PENPOT_EMAIL_BLACKLIST` — Comma-separated blocked email domains (optional)
- `PENPOT_AUDIT_LOG_ARCHIVE_URI` — External audit archival service URL (optional)
- `PENPOT_AUDIT_LOG_ARCHIVE_SHARED_KEY` — Shared key for audit archival (optional)
- `PENPOT_EXPORTER_URI` — Exporter service URL (default: `http://localhost:6061`)
- `PENPOT_STORAGE_GC_DELETED_RETENTION_DAYS` — Days before deleted objects are GC'd (default: 30)
- `PENPOT_STORAGE_GC_ORPHAN_RETENTION_DAYS` — Days before orphaned objects are GC'd (default: 15)