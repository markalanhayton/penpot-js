# AI Agent Guide

This document provides the core context and operating guidelines for AI agents
working in this repository.

## Before You Start

Before responding to any user request, you must:

1. Read this file completely.
2. Identify which modules are affected by the task.
3. Load the `AGENTS.md` file **only** for each affected module (see the
   architecture table below). Not all modules have an `AGENTS.md` — verify the
   file exists before attempting to read it.
4. Do **not** load `AGENTS.md` files for unrelated modules.

## Role: Senior Software Engineer

You are a high-autonomy Senior Full-Stack Software Engineer. You have full
permission to navigate the codebase, modify files, and execute commands to
fulfill your tasks. Your goal is to solve complex technical tasks with high
precision while maintaining a strong focus on maintainability and performance.

### Operational Guidelines

1. Before writing code, describe your plan. If the task is complex, break it
   down into atomic steps.
2. Be concise and autonomous.
3. Do **not** touch unrelated modules unless the task explicitly requires it.
4. Commit only when explicitly asked. Follow the commit format rules in
   `CONTRIBUTING.md`.
5. When searching code, prefer `ripgrep` (`rg`) over `grep` — it respects
   `.gitignore` by default.

### Real Code Rules

Production code (`src/`, `public/`, `shared/src/`) must follow these rules:

1. **No mocks, fakes, or simulations.** Every function must do real work. No
   stub handlers returning `{ status: 'ok' }`. No hardcoded data arrays posing
   as real results. If a feature isn't ready, don't ship a placeholder.

2. **No silent errors.** Every `catch` must log or rethrow. Empty `catch {}`
   blocks are forbidden. Use `console.warn('[module]', err.message)` for
   recoverable errors and `throw` for unrecoverable ones.

3. **No fallbacks that hide failures.** `const x = data.x || default` masks
   bugs. If `data.x` is required, throw. If it's optional, log that the
   fallback was used. Config defaults belong in `config/index.js`.

4. **No hardcoded values.** Magic numbers, string literals used as enums, and
   inline URLs belong in constants, config, or enum objects. Use
   `TEAM_ROLE.OWNER` not `'owner'`. Use `config.exporterUri` not
   `'http://localhost:6061'`.

5. **Throw all real errors.** RpcError calls must include type, code, and hint:
   `throw new RpcError('validation', 'email-domain-not-allowed', 'Email
   domain is not allowed')`. Error messages must include `[module]` prefix.

6. **No fake data in production.** Templates come from resource files, not
   inline arrays. Auth responses come from real token validation, not mock
   objects. When a dependency is unavailable (SMTP disabled, exporter offline),
   log a warning and return a clear "not available" response — don't fake
   success.

See `.kilo/skills/real-code-rules/SKILL.md` for full details and examples.

## Changelogs

The project has two changelogs:

- **Main project changelog**: `CHANGES.md` (root of the repository). Tracks changes for the core Penpot application (backend, frontend, common, render-wasm, exporter, mcp).
- **Plugins changelog**: `plugins/CHANGELOG.md`. Tracks changes for the plugins subproject only.

When making changes, add a changelog entry to the appropriate file under the
`## <version> (Unreleased)` section in the correct category
(`:sparkles: New features & Enhancements` or `:bug: Bugs fixed`).

## GitHub Operations

To obtain the list of repository members/collaborators:

```bash
gh api repos/:owner/:repo/collaborators --paginate --jq '.[].login'
```

To obtain the list of open PRs authored by members:

```bash
MEMBERS=$(gh api repos/:owner/:repo/collaborators --paginate --jq '.[].login' | tr '\n' '|' | sed 's/|$//')
gh pr list --state open --limit 200 --json author,title,number | jq -r --arg members "$MEMBERS" '
  ($members | split("|")) as $m |
  .[] | select(.author.login as $a | $m | index($a)) |
  "\(.number)\t\(.author.login)\t\(.title)"
'
```

To obtain the list of open PRs from external contributors (non-members):

```bash
MEMBERS=$(gh api repos/:owner/:repo/collaborators --paginate --jq '.[].login' | tr '\n' '|' | sed 's/|$//')
gh pr list --state open --limit 200 --json author,title,number | jq -r --arg members "$MEMBERS" '
  ($members | split("|")) as $m |
  .[] | select(.author.login as $a | $m | index($a) | not) |
  "\(.number)\t\(.author.login)\t\(.title)"
'
```

## Architecture Overview

Penpot is an open-source design tool composed of several modules:

| Directory | Language | Purpose | Has `AGENTS.md` |
|-----------|----------|---------|:----------------:|
| `frontend/` | ClojureScript + SCSS | Single-page React app (design editor) — upstream | Yes |
| `backend/` | Clojure (JVM) | HTTP/RPC server, PostgreSQL, Redis — upstream | Yes |
| `client/` | JavaScript (ES2022+) + CSS | SPA design editor (Web Components) — JS port | Yes |
| `server/` | JavaScript (Node.js ESM) | HTTP/RPC server, Fastify + SQLite — JS port | Yes |
| `common/` | Cljc (shared Clojure/ClojureScript) | Data types, geometry, schemas, utilities — upstream | Yes |
| `shared/` | JavaScript (ES2022+, dual-env) | Data types, geometry, schemas, utilities — JS port | Yes |
| `render-wasm/` | Rust -> WebAssembly | High-performance canvas renderer (Skia) — upstream only, not ported | Yes |
| `exporter/` (upstream only) | ClojureScript (Node.js) | Headless Playwright-based export (SVG/PDF) — upstream | No |
| `server/exporter/` | JavaScript (Node.js ESM) | Headless Playwright export (PNG/JPEG/WebP/SVG/PDF) — JS port | Yes |
| `mcp/` | TypeScript | Model Context Protocol integration | No |
| `plugins/` | TypeScript | Plugin runtime and example plugins | No |

Some submodules use `pnpm` workspaces. The root `package.json` and
`pnpm-lock.yaml` manage shared dependencies. Helper scripts live in `scripts/`.

### Module Dependency Graph

```
client ──> shared
server  (standalone, mirrors backend)
server/exporter ──> server (HTTP proxy)
frontend ──> common
backend  ──> common
exporter ──> common (upstream)
frontend ──> render-wasm  (upstream only, not ported)
```

`shared` is a local dependency consumed by both `client` and `server`.
Changes to `shared` can affect multiple modules — test across consumers
when modifying shared code.

**Key pattern when porting Clojure to JS:** The upstream uses `with-meta`/`meta` to attach context to shapes (e.g., ref-shape file/container references). In the JS port, use `_fileCtx`/`_containerCtx` properties. Always use spread syntax (`{ ...shape, _fileCtx, _containerCtx }`) rather than `Object.assign(shape, {...})` — the latter mutates shared shape objects and causes data corruption.

## Migration Documentation

The JS port migration is tracked in [`docs/migration/`](docs/migration/):

- [`tracking.md`](docs/migration/tracking.md) — Master progress tracker
- [`migration-plan.md`](docs/migration/migration-plan.md) — Full migration plan
- [`client.md`](docs/migration/client.md) — Front-end migration details
- [`server-reference.md`](docs/migration/server-reference.md) — Server architecture
- [`server-next-steps.md`](docs/migration/server-next-steps.md) — Server next steps
- [`exporter.md`](docs/migration/exporter.md) — Exporter architecture
- [`shared-status.md`](docs/migration/shared-status.md) — Shared modules status
