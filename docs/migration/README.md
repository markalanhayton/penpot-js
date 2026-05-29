# Migration Documentation

Penpot JS port migration from Clojure/ClojureScript to modern ES2022+ JavaScript.

## Documents

| Document | Description |
|----------|-------------|
| [`tracking.md`](tracking.md) | Master migration tracker — file counts, test status, per-module completion |
| [`migration-plan.md`](migration-plan.md) | Full 14-20 month migration plan — technology choices, phases, estimates |
| [`client.md`](client.md) | Front-end migration — Web Components, P0-P6 phases, component inventory |
| [`server-reference.md`](server-reference.md) | Server (Fastify + SQLite) — architecture, patterns, running, testing |
| [`server-next-steps.md`](server-next-steps.md) | Server next steps — pending features, schema parity gaps, known issues |
| [`exporter.md`](exporter.md) | Exporter service — Playwright renderer, HTTP API, configuration |
| [`shared-status.md`](shared-status.md) | Shared modules status — 152 JS files, 1,596 tests, Phase 1 complete |
| [`root-agents.md`](root-agents.md) | Root agent guide — architecture, modules, dependency graph |

## Module Directory Mapping

| Original | JS Port | Directory | Status |
|----------|---------|-----------|--------|
| `common/` | `shared/` | `shared/src/` | ✅ Phase 1 complete |
| `backend/` | `server/` | `server/src/` | ✅ ~95% complete |
| `frontend/` | `client/` | `client/public/` | ✅ ~99.5% functional parity |
| `exporter/` | `server/exporter/` | `server/exporter/src/` | ✅ Complete |