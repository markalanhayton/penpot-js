# Client Migration Plan: ClojureScript → ES JS + Web Components

**Date**: 2026-05-23 
**Status**: P0–P2 core complete, significant functional gaps remain (see tracking.md §Phase 2b Gap Analysis)
**Constraint**: No third-party frameworks. No TypeScript. No React. Pure Modern ES JS (ES2022+), HTML5, CSS3, Web Components, Node.js ESM.

---

## 1. Executive Summary

Migrate the Penpot front-end from ClojureScript + React + SCSS to **pure Modern ES JavaScript with Web Components and CSS custom properties**. The ClojureScript front-end comprises **544 `.cljs` files** and **575 `.scss` files** (~129K lines). A parallel ES JS front-end prototype exists at `client/` with 4 Web Components and a working auth flow.

### Why This Works Without React

The canvas is rendered by WASM/Skia to a single `<canvas>` element. React's virtual DOM provides zero benefit — there are no 10K-element lists to diff. The UI chrome is ~130 DOM elements (toolbar, sidebar, panels). Web Components with direct DOM manipulation and a signal-based store are sufficient and faster.

### Current State

| Component | Files | Lines | Status |
|-----------|-------|-------|--------|
| `client/public/` | 103 | ~24,600 | Working auth + dashboard + workspace with drawing tools, snap guides, rulers, SVG import, Inspect panel, OT collaboration, flex/grid layout, design tokens, bool ops. **6 P0 items completed, all P1 items done, most P2 items done** — see `tracking.md` Phase 2b for details. |
| `frontend/src/app/main/` (ClojureScript) | 544 | ~129K | Production frontend, fully functional |

### Target

| Component | Technology | Status |
|-----------|------------|--------|
| `client/public/` | ES JS + Web Components | Incremental migration target |
| Rendering | WASM/Skia → `<canvas>` | No change (Rust) |
| State | Potok → Custom signal store | Ported |
| RPC | Transit+JSON commands | Ported (`lib/rpc.js`, `lib/transit.js`) |

---

## 2. ClojureScript Front-End Architecture

### 2.1 Module Map

```
frontend/src/app/
├── main/                        # App entry, store, router, refs, streams
│   ├── main.cljs                 # Bootstrap, mount root component
│   ├── store.cljs                # Potok state atom + emit! function
│   ├── refs.cljs                 # 70+ Okulary derived refs (~671 lines)
│   ├── streams.cljs              # RxJS behavior subjects (mouse, keyboard, viewport)
│   ├── router.cljs               # Reitit routing + history
│   ├── repo.cljs                 # HTTP RPC client (cmd! function, 289 lines)
│   ├── render.cljs               # SVG rendering pipeline
│   ├── data/                     # Potok event handlers (~30 + submodules)
│   │   ├── auth.cljs             # Login/register/recovery events
│   │   ├── dashboard.cljs        # Dashboard CRUD events
│   │   ├── workspace.cljs        # Workspace/file editing events
│   │   ├── users.cljs            # User/profile events
│   │   ├── comments.cljs         # Comment events
│   │   ├── media.cljs            # Media upload events
│   │   ├── fonts.cljs            # Font management events
│   │   ├── workspace/            # Workspace sub-events
│   │   │   ├── drawing.cljs      # Drawing tool events
│   │   │   ├── selection.cljs    # Selection events
│   │   │   ├── transforms.cljs   # Move/resize/rotate events
│   │   │   ├── text.cljs         # Text editing events
│   │   │   └── ...               # ~15 more sub-modules
│   │   └── ...                   # ~20 more event modules
│   └── ui/                       # React UI components (~200+ files)
│       ├── ui.cljs               # Root component
│       ├── auth/                 # Login, register, recovery (5 files + 5 SCSS)
│       ├── dashboard/            # Projects, files, teams, search (~19 files + 19 SCSS)
│       ├── workspace/            # Full design editor (~45+ files + 45+ SCSS)
│       │   ├── viewport.cljs     # Main canvas area
│       │   ├── viewport_wasm.cljs # WASM rendering integration
│       │   ├── top_toolbar.cljs  # Top toolbar
│       │   ├── sidebar.cljs      # Left sidebar (layers, assets, sitemap)
│       │   ├── colorpicker/      # Color picker with sub-components
│       │   └── ...               # Selection, gradients, guides, rulers, etc.
│       ├── viewer/               # Read-only file viewer (~8 files + 8 SCSS)
│       ├── settings/             # User profile, password, notifications (~10 files)
│       ├── inspect/              # Design inspect panel (~15 files)
│       ├── components/           # Reusable UI components (~20 files)
│       ├── ds/                   # Design system tokens (~5 files)
│       ├── exports/              # File/asset export
│       ├── notifications/        # Inline & context notifications
│       ├── onboarding/           # Team choice, questions, templates
│       └── releases/             # v1.4 → v2.14 changelog display
├── render_wasm/                  # WASM renderer bridge (16 CLJS + 2 CLJC + 1 JS)
│   ├── wasm.cljs                 # Module loading & initialization
│   ├── api.cljs                  # API surface
│   ├── api/shapes.cljs           # Shape rendering via WASM
│   ├── api/texts.cljs            # Text rendering via WASM
│   ├── api/fonts.cljs            # Font rendering via WASM
│   ├── api/webgl.cljs            # WebGL integration
│   ├── api/shared.js             # JS-native shared WASM bindings
│   ├── serializers/color.cljs    # Shape → WASM data serialization
│   ├── deserializers.cljs        # WASM → shape data deserialization
│   ├── mem/heap32.cljs           # WASM memory management (heap32)
│   ├── path.cljs                 # Path operations
│   ├── shape.cljs                # Shape operations
│   ├── shapes.cljs               # Shape rendering helpers
│   ├── svg_fills.cljs            # SVG fill operations
│   ├── svg_filters.cljs          # SVG filter operations
│   ├── gesture.cljs              # Gesture handling
│   └── text_editor.cljs          # Text editor integration
└── util/                         # Utility modules (~53 files)
    ├── http.cljs                 # Fetch-based HTTP client
    ├── sse.cljs                  # Server-Sent Events client
    ├── websocket.cljs            # WebSocket client
    ├── dom/normalize_wheel.js    # Mouse wheel normalization (JS)
    ├── path/arc_to_curve.js      # Arc-to-Bezier conversion (JS)
    ├── path/path_impl_simplify.js# Path simplification (JS)
    ├── quadtree.js               # Quadtree spatial index (JS)
    ├── kdtree_impl.js            # KD-tree (JS)
    ├── lru_impl.js               # LRU cache (JS)
    ├── intervaltree_impl.js      # Interval tree (JS)
    ├── heap_impl.js              # Binary heap (JS)
    ├── range_tree.js             # Range tree (JS)
    ├── text_position_data.js     # Text positioning (JS)
    ├── globals.js                # Browser globals (JS)
    ├── clipboard.js              # Clipboard API (JS)
    └── browser_history.js        # History API (JS)
```

### 2.2 State Management Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Potok Store                       │
│  ┌───────────────────────────────────────────────┐ │
│  │  st/state (single atom)                       │ │
│  │  {                                            │ │
│  │    profile, dashboard, workspace,             │ │
│  │    current-file-id, selected-ids,             │ │
│  │    tool, zoom, viewport, fonts...             │ │
│  │  }                                            │ │
│  └───────────────────────────────────────────────┘ │
│         │ emit! (dispatch event)                     │
│         ▼                                           │
│  ┌────────────────┐  ┌──────────────────────┐       │
│  │ UpdateEvent    │  │ WatchEvent            │       │
│  │ Pure state     │  │ Returns Observable     │       │
│  │ transition     │  │ (side effects: RPC,   │       │
│  │                │  │  WebSocket, etc.)     │       │
│  └────────────────┘  └──────────────────────┘       │
│         │                                           │
│         ▼                                           │
│  ┌───────────────────────────────────────────────┐ │
│  │ Okulary Refs (70+ derived state selectors)   │ │
│  │ profile-ref, file-ref, selected-ids-ref...   │ │
│  └───────────────────────────────────────────────┘ │
│         │ subscribe (reactive)                       │
│         ▼                                           │
│  ┌───────────────────────────────────────────────┐ │
│  │ RxJS Streams (high-frequency events)          │ │
│  │ mouse-stream, keyboard-stream, viewport...    │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

Key files to port:
- `store.cljs` → `store/store.js` (central state atom, event dispatch)
- `refs.cljs` → `store/refs.js` (70+ derived selectors)
- `streams.cljs` → `store/streams.js` (mouse, keyboard, viewport streams)
- `data/*.cljs` → `store/events/*.js` (event handlers)

### 2.3 Routing Map (from `routes.cljs`)

| Route | View | Auth Required |
|-------|------|:-------------:|
| `/auth/login` | Login | No |
| `/auth/register` | Register | No |
| `/auth/recovery/request` | Recovery request | No |
| `/auth/recovery` | Reset password | No |
| `/dashboard` | Dashboard (default) | Yes |
| `/dashboard/files` | Files list | Yes |
| `/dashboard/search` | Search | Yes |
| `/dashboard/fonts` | Font management | Yes |
| `/dashboard/libraries` | Shared libraries | Yes |
| `/dashboard/deleted` | Deleted files | Yes |
| `/workspace/:project-id/:file-id` | Design editor | Yes |
| `/view/:file-id` | Read-only viewer | No (share link) |
| `/settings/profile` | Profile settings | Yes |
| `/settings/password` | Password settings | Yes |
| `/settings/feedback` | Feedback | Yes |
| `/settings/options` | Options | Yes |

### 2.4 RPC Command Summary (from `repo.cljs`)

The front-end calls ~141 RPC commands. Key groups:

| Group | Commands | Priority |
|-------|----------|:--------:|
| Auth | `login-with-password`, `prepare-register-profile`, `register-profile`, `logout`, `request-profile-recovery`, `recover-profile`, `get-profile`, `update-profile` | P0 |
| Files | `create-file`, `get-file`, `rename-file`, `delete-file`, `duplicate-file`, `set-file-shared`, `get-project-files` | P0 |
| Projects | `create-project`, `get-projects`, `get-project`, `rename-project`, `delete-project` | P0 |
| Teams | `create-team`, `get-teams`, `get-team`, `get-team-members`, `update-team`, `delete-team` | P0 |
| Workspace | `update-file` (the big collaborative editing command) | P1 |
| Media | `create-file-media-object`, `upload-file-media-object`, `clone-file-media-object` | P1 |
| Comments | `create-comment-thread`, `create-comment`, `get-comment-threads`, `get-comments` | P2 |
| Fonts | `create-font-variant`, `download-font`, `get-font-variants` | P2 |
| Webhooks | `create-webhook`, `get-webhooks`, `update-webhook`, `delete-webhook` | P2 |
| Export | `export-binfile`, `export-file`, `download-binfile` | P2 |

### 2.5 Existing JS Files to Reuse Directly

These 14 files are **already in JavaScript** and can be copied/adapted directly:

| File | Purpose | Lines |
|------|---------|-------|
| `util/dom/normalize_wheel.js` | Mouse wheel event normalization | ~60 |
| `util/path/arc_to_curve.js` | Arc → Bézier curve conversion | ~50 |
| `util/path/path_impl_simplify.js` | Path simplification (Douglas-Peucker) | ~120 |
| `util/text_position_data.js` | Text position data calculation | ~200 |
| `util/range_tree.js` | Range tree data structure | ~150 |
| `util/quadtree.js` | Quadtree spatial index | ~200 |
| `util/lru_impl.js` | LRU cache implementation | ~80 |
| `util/kdtree_impl.js` | KD-tree implementation | ~150 |
| `util/intervaltree_impl.js` | Interval tree implementation | ~120 |
| `util/heap_impl.js` | Binary heap implementation | ~80 |
| `util/globals.js` | Browser globals abstraction | ~30 |
| `util/clipboard.js` | Clipboard API wrapper | ~60 |
| `util/browser_history.js` | History API wrapper | ~50 |
| `render_wasm/api/shared.js` | WASM shared bindings | ~100 |

**Total reusable**: ~1,450 lines of production JS code.

---

## 3. Existing ES JS Front-End

The `client/` directory contains a fully functional front-end with 111 source files and ~34,500 lines of JS:

```
client/
├── package.json                  # @penpot/client v0.1.0
├── server.js                     # Dev server (proxies /api/* → localhost:6060)
├── playwright.config.js           # Playwright E2E test config
├── e2e/                          # 32 Playwright E2E spec files (490+ tests, all passing)
│   ├── auth.spec.js              # Auth flow (6 tests)
│   ├── p0-flow.spec.js           # P0: Full login→dashboard→workspace flow (11 tests)
│   ├── p1-workspace.spec.js      # P1: Workspace shell (14 tests)
│   ├── p2-components.spec.js     # P2: Design system components (18 tests)
│   ├── p3-tools.spec.js          # P3: Drawing & editing tools (21 tests)
│   ├── p3-extended.spec.js       # P3: Boolean ops, z-order, rotation (10 tests)
│   ├── p3-enhanced.spec.js       # P3: Undo/redo, text toolbar, snap (9 tests)
│   ├── snap-text-editing.spec.js # P3: Snap guides & text editing (6 tests)
│   ├── page-management.spec.js    # Pages: add/rename/delete/duplicate (5 tests)
│   ├── settings.spec.js           # Settings: profile/password/feedback (8 tests)
│   └── ...
├── public/
│   ├── index.html                # SPA shell (CSS custom properties, dark theme)
│   ├── app.js                    # Bootstrap: auth check → route → render component
│   ├── styles/tokens.css         # Design token CSS custom properties
│   ├── lib/                      # 38 files (~12,100 lines)
│   ├── store.js              # Potok-like store: events, effects, signals, subscriptions
    │   ├── router.js             # 12 routes, auth guards, param extraction, history API
    │   ├── rpc.js                # Transit+JSON, GET/POST, retry, SSE streaming, file upload
    │   ├── transit.js             # Full Transit codec: keywords, UUIDs, dates, sets, Penpot types
    │   ├── ws.js                 # WebSocket client, file/team subscription, cursor broadcast
    │   ├── shapes.js             # SVG rendering for all shape types including bool, rotation
    │   ├── types.js               # Shape factory, type predicates, createBoolShape
    │   ├── history.js             # Undo/redo stack
    │   ├── tool-manager.js       # Tool registry, switching, keyboard shortcuts, bool ops, z-order
    │   ├── persistence.js         # update-file RPC batching, debounced save, retry; exposes pending changes for OT
    │   ├── collaboration.js       # Real-time change broadcast, OT-based undo/reapply for remote changes
    │   ├── ot.js                  # Attribute-level operational transform for mod-obj + invertChanges + applyWithUndoReapply
    │   ├── process-changes.js     # Full change processing engine (35+ change types: shapes, pages, libraries, tokens)
    │   ├── revision.js           # File revision tracking (revn/vern)
    │   ├── snap.js                # Shape-to-shape and canvas-edge snap guides
    │   ├── shortcuts.js           # Keyboard shortcut registry wired to tool-manager actions
    │   ├── svg-import.js          # SVG file parser (rect, circle, path, text, group, etc.)
    │   └── ...
    └── components/              # 69 files (~21,300 lines)
        ├── penpot-workspace.js   # Full workspace: toolbar, tools, sidebars, canvas, persistence, shortcuts, drag-drop
        ├── penpot-canvas.js      # SVG rendering, zoom, pan, selection highlight, rulers
        ├── penpot-rulers.js      # Horizontal + vertical canvas rulers with zoom
        ├── penpot-dashboard.js   # Dashboard with team/project/search/fonts/libraries
        ├── penpot-right-sidebar.js # Design/Inspect tabs, properties, fills, shadows, bool, CSS/SVG export
        ├── penpot-text-toolbar.js # Font family/size, bold/italic/underline/align
        ├── penpot-gradient-editor.js # Gradient preview, stop editing, linear/radial
        ├── penpot-shadow-editor.js  # Shadow preview, color/offset/blur/opacity
        ├── tools/base.js        # PenpotTool, DrawingTool, SelectTool (snap, dblclick), HandTool, TextTool, PathTool, ImageTool
        └── ...
```

**What works**:
- Full auth flow: login, register, password recovery via backend RPC
- Dashboard: team sidebar, project grid, file grid, search, fonts, libraries, deleted files
- Workspace: full design editor with all drawing tools
- Drawing: rect, ellipse, frame, text, path, Bezier pen, image, select (with snap guides)
- Selection: click, shift+click multi-select, marquee, resize handles, rotation
- Persistence: `update-file` RPC with debounced batching, retry, conflict resolution
- Undo/redo: local history stack + toolbar buttons + Ctrl+Z/Ctrl+Shift+Z
- Properties: position, size, rotation, opacity, fills, shadows, strokes, booleans
- Inspect panel: CSS/SVG code output with copy-to-clipboard
- Canvas: zoom, pan, rulers, selection highlights, snap guide lines, Canvas2D fallback for 100+ shapes
- SVG import: drag-drop + file picker, parses rect/circle/ellipse/path/text/group + gradient/mask/clip
- .penpot import: file import with v1/v3 format detection, data normalization, media extraction, library linking
- Keyboard shortcuts: 30+ shortcuts wired to tool-manager actions
- Font management: team font loading, font family grouping, upload with chunked pipeline
- Component system: create/detach/sync, instance placement from asset panel, swap component, **drag-to-apply from asset panel**
- Interaction prototyping: Prototype tab in right sidebar, canvas visualization (curved arrows), viewer playback (navigate/overlay/prev-screen)
- Version history: create/restore/rename/lock/delete snapshots
- Thumbnail generation: client-side canvas rendering + upload via RPC
- Collaboration: OT-based real-time change broadcast, cursor overlay, selection-update
- Flex/Grid layout editor: direction, gap, wrap, padding, justify, align, grid rows/columns
- Design tokens: colors, typography, sets, themes tabs
- Boolean path operations: union, difference, intersection, exclusion
- E2E coverage: 170+ tests across 13 spec files, all passing

---

## 4. Migration Strategy

### 4.1 Guiding Principles

1. **Ship continuously** — Every phase must result in a working app.
2. **Backend compatibility** — The new front-end speaks the same Transit+JSON protocol. No backend changes required.
3. **Incremental routing** — Start with auth + dashboard, add workspace view-only, then add editing tools.
4. **No dual build systems** — Pure ES modules in development. Vite for production bundling only.
5. **Web Components + custom properties** — All UI is `<penpot-*>` custom elements in light DOM with BEM-style class scoping.
6. **Port from the ClojureScript** — Don't redesign. The CLJS code is the spec.

### 4.2 Phase Overview

| Phase | Scope | Duration | Result |
|-------|-------|----------|--------|
| **P0** | Foundation + Auth + Dashboard | 3-4 weeks | Working auth flow, real dashboard |
| **P1** | Workspace Shell + View-only | 4-6 weeks | Open files, view pages, navigate |
| **P2** | Design System Components | 6-8 weeks | 20+ reusable UI components |
| **P3** | Drawing & Editing Tools | 8-12 weeks | Create/edit shapes, text, paths |
| **P4** | Layer Panel + Asset Library | 4-6 weeks | Full sidebar functionality |
| **P5** | Collaboration (WebSocket) | 4-6 weeks | Real-time multi-user editing |
| **P6** | Export + Advanced Features | 4-6 weeks | PNG/SVG/PDF export, comments, plugins |

**Total estimated**: 9-14 months with 3-5 engineers.

---

## 5. Phase P0: Foundation + Auth + Dashboard

**Goal**: Replace the ClojureScript auth and dashboard views with ES JS Web Components that talk to the existing backend.

### 5.1 Foundation Libraries

These are already partially implemented in `client/public/lib/`. Extend them:

#### `lib/store.js` — Potok-like State Store

Current: 171 lines with Signal-based store, event dispatch, effects, selectors.

Needs:

- Event dispatch protocol (like Potok's `UpdateEvent` / `WatchEvent`)
- Async side-effect handling (`WatchEvent` → RPC calls)
- Selector subscriptions (like Okulary lenses)

```javascript
// Target API (Port of app.main.store)
export function createStore(initialState) {
  let state = Object.freeze(initialState);
  const subscribers = new Set();
  const eventHandlers = new Map();

  function getState() { return state; }
  function dispatch(eventType, payload) { ... }
  function subscribe(selector, callback) { ... }
  function registerEvent(type, handler) { ... }

  return { getState, dispatch, subscribe, registerEvent };
}
```

**Estimated**: 200-300 lines. Current: 171 lines.

#### `lib/router.js` — Client-side Router

Current: 108 lines with path-based routing, auth guards, param extraction. Needs:
- Path-based routing (`/dashboard`, `/workspace/:projectId/:fileId`)
- Route params extraction
- History integration (`pushState`, `popState`)
- Auth guards (redirect to login when not authenticated)

**Estimated**: 150-200 lines. Current: 108 lines.

#### `lib/rpc.js` — RPC Client

Current: 191 lines. Mostly complete. Needs:
- GET request support for `get-*` commands (already implemented)
- SSE streaming for `update-file` ( collaborative editing)
- Retry logic with exponential backoff
- Error categorization (auth, validation, not-found, etc.)

**Estimated**: 200-250 lines. Current: 191 lines.

#### `lib/transit.js` — Transit Encoding

Current: 299 lines. Handles full Transit+JSON. Needs:
- UUID encoding/decoding
- Set encoding/decoding
- Date encoding/decoding
- Cognitect map encoding (`["^ ", "k1", "v1", ...]`)

**Estimated**: 150-200 lines total (already ported — see `server/src/transit/index.js` at ~561 lines and `client/public/lib/transit.js` at 299 lines).

### 5.2 Auth Components

Already working in `penpot-auth-screen.js` (147 lines). Polish needed:

| Component | Status | Work Needed |
|-----------|--------|-------------|
| Login form | ✅ Working | Add loading states, error display, password toggle |
| Register form | ✅ Working | Two-step flow (prepare → register) working |
| Recovery form | ✅ Working | Add "sent" confirmation state |
| Auth token management | ✅ Working | Cookie-based, auto-refresh |
| SSO (OIDC, Google, GitHub) | ❌ Not started | P2 — needs backend OIDC endpoints |

### 5.3 Dashboard Components

Current `penpot-dashboard.js` loads real data but is basic. Needed:

| Component | Status | Work Needed |
|-----------|--------|-------------|
| Team list sidebar | ✅ Basic | Show team members, team settings |
| Project grid | ✅ Basic | File count, project renaming |
| File grid | ✅ Basic | Thumbnails, modified date, sharing |
| Create file | ✅ Working | Opens workspace |
| Create project | ❌ | Need `create-project` RPC call |
| Search | ❌ | Need `search-files` RPC |
| Fonts page | ❌ | Need font upload/management |
| Libraries page | ❌ | Need library linking |

**Estimated new/modified code**: ~800 lines.

### 5.4 Directory Structure After P0

```
client/public/
├── index.html
├── app.js                        # Enhanced bootstrap
├── styles/
│   └── global.css                # Design tokens, reset, global styles
├── lib/
│   ├── store.js                   # ~250 lines (Potok port)
│   ├── router.js                  # ~180 lines (full routing)
│   ├── rpc.js                     # ~230 lines (RPC + SSE + retry)
│   ├── transit.js                 # ~200 lines (full Transit codec)
│   ├── flags.js                   # ~40 lines (unchanged)
│   ├── ws.js                      # ~100 lines (WebSocket client)
│   └── i18n.js                    # ~80 lines (internationalization stub)
└── components/
    ├── penpot-app.js              # Root component with route switching
    ├── penpot-auth-screen.js      # ~200 lines (polished)
    ├── penpot-dashboard.js        # ~600 lines (with real data)
    ├── penpot-team-sidebar.js     # ~200 lines
    ├── penpot-file-grid.js       # ~200 lines
    ├── penpot-project-card.js    # ~100 lines
    ├── penpot-workspace.js        # ~300 lines (view-only shell)
    └── penpot-viewer.js           # ~150 lines (view-only)
```

---

## 6. Phase P1: Workspace Shell + View-Only

**Goal**: Open a file, display its pages and shapes, navigate between pages. No editing yet.

### 6.1 Workspace Layout

The workspace has this structure (mirroring the ClojureScript `workspace.cljs`):

```
┌──────────────────────────────────────────────────────────┐
│ Top Toolbar (file name, save, share, export, zoom)       │
├──────┬──────────────────────────────────────────┬────────┤
│      │                                          │        │
│ Left│          Canvas Area                       │ Right  │
│ Side│     (<canvas> for WASM rendering)         │ Side   │
│ bar │     or SVG for view-only fallback          │ bar    │
│      │                                          │        │
│ Pages│                                         │ Props  │
│ Layers│                                        │ Design │
│Assets│                                         │        │
├──────┴──────────────────────────────────────────┴────────┤
│ Bottom Bar (zoom, viewport coordinates)                   │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Workspace Sub-Components

| Component | Lines (est.) | Description |
|-----------|-------------|-------------|
| `penpot-workspace.js` | 300 | Shell layout + state binding |
| `penpot-toolbar.js` | 200 | Top toolbar (file name, actions, share, export) |
| `penpot-left-sidebar.js` | 150 | Page list + layers/assets tabs |
| `penpot-right-sidebar.js` | 290 | Design/Inspect tabs + properties + fills/shadows/bool + CSS/SVG code export |
| `penpot-canvas.js` | 400 | SVG/Canvas rendering container |
| `penpot-zoom-bar.js` | 80 | Zoom controls + viewport info |
| `penpot-page-list.js` | 120 | Page thumbnails + navigation |
| `penpot-layer-panel.js` | 200 | Layer tree with nested drag-drop into frames/groups, search/filter, visibility, lock, rename |

### 6.3 File Data Loading

The ClojureScript workspace loads file data via `get-file` RPC command. The response is a large Transit+JSON object containing:

- File metadata (name, project, features, fonts)
- Pages (each page has: name, object tree)
- Objects (shapes, frames, groups, text, images, paths)
- Component definitions
- Shared libraries

For view-only, we need:

```javascript
// Load file data on workspace mount
const fileData = await cmd('get-file', { id: fileId });

// fileData.pages → array of page objects
// Each page.objects → tree of shapes
// Render shapes as SVG (fallback when WASM not available)
```

### 6.4 SVG Fallback Rendering (when WASM unavailable)

When the WASM renderer isn't loaded, render shapes as SVG elements:

```javascript
// penpot-canvas.js — SVG fallback renderer
function renderShape(shape) {
  switch (shape.type) {
    case 'frame': return renderFrame(shape);
    case 'rect': return renderRect(shape);
    case 'circle': return renderCircle(shape);
    case 'path': return renderPath(shape);
    case 'text': return renderText(shape);
    case 'image': return renderImage(shape);
    case 'group': return renderGroup(shape);
    default: return renderRect(shape); // fallback
  }
}
```

This enables **view-only mode** without WASM — essential for quick iteration and testing.

---

## 7. Phase P2: Design System Components

**Goal**: Build 20+ reusable UI components that the workspace needs.

### 7.1 Component Inventory

These are the most-used components from the ClojureScript front-end. Each becomes a `<penpot-*>` Web Component using light DOM with BEM-style class scoping.

| Component | ClojureScript Source | Est. Lines | Priority |
|-----------|---------------------|-----------|:--------:|
| `penpot-button` | `ui/components/button.cljs` | 60 | P0 |
| `penpot-input` | `ui/components/input.cljs` | 80 | P0 |
| `penpot-dropdown` | `ui/components/dropdown.cljs` | 120 | P1 |
| `penpot-modal` | `ui/components/modal.cljs` | 100 | P1 |
| `penpot-tooltip` | `ui/components/tooltip.cljs` | 80 | P1 |
| `penpot-tabs` | `ui/components/tabs.cljs` | 100 | P1 |
| `penpot-color-picker` | `ui/workspace/colorpicker.cljs` | 500 | P2 |
| `penpot-slider` | `ui/components/slider.cljs` | 80 | P2 |
| `penpot-checkbox` | `ui/components/checkbox.cljs` | 60 | P1 |
| `penpot-radio` | `ui/components/radio.cljs` | 60 | P1 |
| `penpot-select` | `ui/components/select.cljs` | 150 | P2 |
| `penpot-modal-menu` | `ui/components/modal_menu.cljs` | 100 | P2 |
| `penpot-context-menu` | `ui/workspace/context_menu.cljs` | 200 | P2 |
| `penpot-icon` | `ui/components/icon.cljs` | 40 | P0 |
| `penpot-loader` | `ui/components/loader.cljs` | 40 | P0 |
| `penpot-notification` | `ui/notifications.cljs` | 120 | P1 |
| `penpot-form` | `ui/components/form.cljs` | 100 | P1 |
| `penpot-file-thumbnail` | `ui/dashboard/files.cljs` (thumb) | 80 | P1 |
| `penpot-avatar` | `ui/components/avatar.cljs` | 60 | P1 |
| `penpot-badge` | `ui/components/badge.cljs` | 40 | P1 |

**Total estimated**: ~2,130 lines for 20 components.

### 7.2 Design Token System

Port the SCSS variables from `ui/ds.cljs` + SCSS to CSS custom properties:

```css
/* styles/tokens.css */
:root {
  /* Colors */
  --penpot-primary: #31efb8;
  --penpot-primary-hover: #28d4a3;
  --penpot-danger: #f44;
  --penpot-bg: #1c1c1c;
  --penpot-surface: #2a2a2a;
  --penpot-surface-high: #333;
  --penpot-border: #444;
  --penpot-border-focused: #666;
  --penpot-text: #e6e6e6;
  --penpot-text-dim: #999;
  --penpot-text-disabled: #666;

  /* Spacing */
  --penpot-spacing-xxs: 2px;
  --penpot-spacing-xs: 4px;
  --penpot-spacing-s: 8px;
  --penpot-spacing-m: 12px;
  --penpot-spacing-l: 16px;
  --penpot-spacing-xl: 24px;
  --penpot-spacing-xxl: 32px;

  /* Typography */
  --penpot-font-size-xs: 10px;
  --penpot-font-size-s: 11px;
  --penpot-font-size-m: 13px;
  --penpot-font-size-l: 16px;
  --penpot-font-size-xl: 20px;
  --penpot-font-size-xxl: 28px;

  /* Borders */
  --penpot-radius-s: 4px;
  --penpot-radius-m: 8px;
  --penpot-radius-l: 12px;
  --penpot-radius-full: 9999px;

  /* Shadows */
  --penpot-shadow-s: 0 1px 3px rgba(0,0,0,0.3);
  --penpot-shadow-m: 0 4px 12px rgba(0,0,0,0.4);
  --penpot-shadow-l: 0 8px 24px rgba(0,0,0,0.5);

  /* Transitions */
  --penpot-transition-fast: 0.1s ease;
  --penpot-transition-normal: 0.2s ease;

  /* Z-index layers */
  --penpot-z-sidebar: 10;
  --penpot-z-toolbar: 20;
  --penpot-z-canvas-overlay: 30;
  --penpot-z-modal: 100;
  --penpot-z-tooltip: 110;
  --penpot-z-notification: 120;
  --penpot-z-context-menu: 130;
}
```

---

## 8. Phase P3: Drawing & Editing Tools

**Goal**: Create, select, move, resize, and edit shapes on the canvas.

### 8.1 Tool Architecture

The ClojureScript workspace has ~15 drawing/editing tools. Each tool is a state machine that handles mouse/keyboard events and modifies shapes in the store.

```javascript
// components/penpot-tool-base.js
export class PenpotTool {
  #active = false;

  activate(canvas) { this.#active = true; this.onActivate(canvas); }
  deactivate(canvas) { this.#active = false; this.onDeactivate(canvas); }
  isActive() { return this.#active; }

  // Override in subclasses
  onActivate(canvas) {}
  onDeactivate(canvas) {}
  onMouseDown(event, canvas) {}
  onMouseMove(event, canvas) {}
  onMouseUp(event, canvas) {}
  onKeyDown(event, canvas) {}
  onKeyUp(event, canvas) {}
}
```

### 8.2 Tool Implementation Plan

| Tool | CLJS Source | Est. Lines | Priority |
|------|-------------|-----------|:--------:|
| Select tool | `data/workspace/selection.cljs` | 300 | P3a |
| Frame tool | `data/workspace/drawing.cljs` (frame) | 150 | P3a |
| Rectangle tool | `data/workspace/drawing.cljs` (rect) | 200 | P3a |
| Circle/Ellipse tool | `data/workspace/drawing.cljs` (circle) | 150 | P3a |
| Path tool | `data/workspace/drawing.cljs` (path) | 600 | P3b |
| Text tool | `data/workspace/drawing.cljs` (text) | 500 | P3b |
| Move/Resize | `data/workspace/transforms.cljs` | 400 | P3a |
| Boolean operations | `data/workspace/bool.cljs` | 300 | P3c |
| Image tool | `data/workspace/media.cljs` | 200 | P3c |

### 8.3 Canvas Rendering Strategy

#### SVG Fallback (Phase P1-P2)

Shapes render as SVG elements. Simple, debuggable, no WASM dependency.

```javascript
// canvas/svg-renderer.js
export function shapeToSVG(shape) {
  const attrs = [];
  attrs.push(`id="${shape.id}"`);
  attrs.push(`transform="translate(${shape.x},${shape.y}) rotate(${shape.rotation || 0})"`);
  attrs.push(`opacity="${shape.opacity ?? 1}"`);

  switch (shape.type) {
    case 'rect':
      return `<rect ${attrs.join(' ')} width="${shape.width}" height="${shape.height}" rx="${shape.rx || 0}" fill="${shapeFills(shape)}" stroke="${shapeStrokes(shape)}" />`;
    case 'circle':
      return `<ellipse ${attrs.join(' ')} cx="${shape.width/2}" cy="${shape.height/2}" rx="${shape.width/2}" ry="${shape.height/2}" fill="${shapeFills(shape)}" />`;
    case 'text':
      return `<text ${attrs.join(' ')} font-size="${shape.fontSize}" fill="${shapeFills(shape)}">${escapeHtml(shape.content)}</text>`;
    // ... etc
  }
}
```

#### WASM Bridge (Phase P3+)

When WASM is available, the Skia renderer draws directly to `<canvas>`:

```javascript
// canvas/wasm-bridge.js
let wasmModule = null;

export async function initWasm(canvas) {
  const module = await import('../../render-wasm/penpot_renderer.js');
  wasmModule = await module.default({ canvas });
}

export function renderFrame(timestamp) {
  if (!wasmModule) return;
  wasmModule._render(timestamp);
}

export function updateViewport(x, y, zoom) {
  if (!wasmModule) return;
  wasmModule._set_viewport(x, y, zoom);
}
```

### 8.4 Shape Data Model

Port from `common/src/app/common/types/shape.cljs`. Key shape properties:

```javascript
// common/types/shape.js
export const SHAPE_TYPES = [
  'frame', 'group', 'rect', 'circle', 'path', 'text', 'image', 'svg-raw', 'bool'
];

export function createShape(type, overrides = {}) {
  return Object.freeze({
    id: crypto.randomUUID(),
    type,
    name: defaultName(type),
    x: 0, y: 0,
    width: 0, height: 0,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [],
    strokes: [],
    shadows: [],
    filters: [],
    // Type-specific defaults...
    ...overrides,
  });
}

function defaultName(type) {
  const names = { frame: 'Frame', rect: 'Rectangle', circle: 'Ellipse',
                  path: 'Path', text: 'Text', image: 'Image', group: 'Group' };
  return names[type] || 'Shape';
}
```

---

## 9. Phase P4: Layer Panel + Asset Library

### 9.1 Layer Panel

The layer panel shows the hierarchical shape tree for the current page:

```javascript
// components/penpot-layer-panel.js
export class PenpotLayerPanel extends HTMLElement {
  // Tree view of shapes on current page
  // Drag-to-reorder (later)
  // Visibility toggle
  // Lock toggle
  // Selection sync
  // Collapse/expand groups and frames
}
```

**Estimated**: 400-500 lines.

### 9.2 Asset Panel

Shows fonts, components, and media shared across the file:

```javascript
// components/penpot-asset-panel.js
export class PenpotAssetPanel extends HTMLElement {
  // Three tabs: Components, Fonts, Media
  // Component thumbnails
  // Font list with preview
  // Media grid with thumbnails
}
```

**Estimated**: 300-400 lines.

---

## 10. Phase P5: Collaboration (WebSocket)

### 10.1 Architecture

The current ClojureScript uses WebSocket for real-time collaborative editing. The backend (`server`) already has `ws/notifications.js` and `ws/msgbus.js` for in-process pub/sub. We need:

1. **WebSocket client** in the front-end that connects to `ws://host/ws/notifications`
2. **Change protocol** — receive and send file modification deltas
3. **Cursor presence** — see other users' cursor positions
4. **Conflict resolution** — attribute-level OT for `mod-obj` operations + undo/reapply of pending commits (matching original Penpot ClojureScript `apply-changes-localy` pattern)

### 10.2 Implementation

```javascript
// lib/ws.js — WebSocket client
let ws = null;
let reconnectTimer = null;

export function connectWS(url, authToken) {
  ws = new WebSocket(url, ['penpot', authToken]);

  ws.onopen = () => {
    console.log('[ws] Connected');
    clearTimeout(reconnectTimer);
  };

  ws.onmessage = (event) => {
    const data = transitDecode(event.data);
    handleWSMessage(data);
  };

  ws.onclose = () => {
    console.log('[ws] Disconnected, reconnecting...');
    reconnectTimer = setTimeout(() => connectWS(url, authToken), 3000);
  };

  ws.onerror = (err) => {
    console.error('[ws] Error:', err);
  };
}

export function sendWSMessage(type, payload) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(transitEncode({ type, ...payload }));
  }
}
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

Use Node.js built-in test runner (same as `server`):

```javascript
// test/store.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../public/lib/store.js';

describe('Store', () => {
  it('dispatches events and updates state', () => {
    const store = createStore({ count: 0 });
    store.registerEvent('increment', (state, payload) => {
      return { ...state, count: state.count + payload };
    });
    store.dispatch('increment', 1);
    assert.equal(store.getState().count, 1);
  });
});
```

### 11.2 E2E Tests

Playwright tests in `client/e2e/` — **170+ tests passing across 13 spec files**:

| Phase | Spec File | Tests | Status |
|-------|-----------|-------|--------|
| P0 | `auth.spec.js` | 6 | ✅ All pass — auth flow |
| P0 | `p0-flow.spec.js` | 11 | ✅ All pass — login, dashboard, file create, workspace, auth edge cases |
| P1 | `p1-workspace.spec.js` | 14 | ✅ All pass — workspace shell, toolbar, tools, sidebars, canvas, zoom |
| P2 | `p2-components.spec.js` | 18 | ✅ All pass — buttons, checkbox, switch, slider, tabs, dropdown, select, etc. |
| P3 | `p3-tools.spec.js` | 21 | ✅ All pass — tool switching, drawing, selection, cursors, zoom, pan |
| P3 | `p3-extended.spec.js` | 10 | ✅ All pass — boolean ops, z-order, rotation, group/ungroup |
| P3 | `p3-enhanced.spec.js` | 9 | ✅ All pass — undo/redo, text toolbar, snap guides, fills |
| P3 | `snap-text-editing.spec.js` | 6 | ✅ All pass — snap guides, text creation, inline editing, commit on blur |
| P4 | `p4-layer-asset.spec.js` | 24 | ✅ All pass — layer panel, asset panel, font management, component instances |
| P5 | `p5-collaboration.spec.js` | 11 | ✅ All pass — WebSocket, presence, cursor |
| P6 | `p6-export.spec.js` | 17 | ✅ All pass — PNG/SVG/PDF export, share |
| Other | `page-management.spec.js` | 5 | ✅ All pass — Page add/rename/delete/duplicate |
| Other | `settings.spec.js` | 8 | ✅ All pass — Profile/password/feedback settings |

### 11.3 Visual Regression

For the canvas rendering, use screenshot comparison:

```javascript
// e2e/canvas.spec.js
test('renders rectangle shape', async ({ page }) => {
  // Create a file, add a rectangle, screenshot it
  await expect(page.locator('#canvas')).toHaveScreenshot('rectangle.png');
});
```

---

## 12. Build & Dev Setup

### 12.1 Development

No build step required. The dev server (`server.js`) already serves ES modules directly:

```bash
# Terminal 1: Backend
cd server && node src/index.js

# Terminal 2: Frontend dev server
cd client && node server.js

# Open browser
open http://localhost:3449
```

### 12.2 Production

Use Vite for bundling, tree-shaking, and CSS processing:

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public',
  build: {
    outDir: '../dist',
    target: 'es2022',
    modulePreload: { polyfill: false },
  },
  server: {
    port: 3449,
    proxy: {
      '/api': 'http://localhost:6060',
      '/ws': { target: 'ws://localhost:6060', ws: true },
    },
  },
});
```

### 12.3 Linting

```bash
# Syntax check all JS files
node --check public/components/*.js public/lib/*.js
```

---

## 13. Appendix: ClojureScript → ES JS Pattern Mapping

### 13.1 Component Patterns

| ClojureScript (Rumext/mf) | ES JS (Web Components) |
|---------------------------|----------------------|
| `mf/defc MyComponent [my-prop] ...` | `class MyComponent extends HTMLElement { ... }` |
| `mf/use-state` | `this.#state = new Signal(initial)` |
| `mf/use-effect` | `connectedCallback()` / `disconnectedCallback()` |
| `mf/use-memo` | Cache in instance variable |
| `mf/deref my-ref` | `myRef.deref()` (from store/refs.js) |
| `rum/defc` | `customElements.define('penpot-xxx', PenpotXxx)` |
| Hiccup `[:div {:class "foo"} "bar"]` | Template `<template>` + `cloneNode()` |
| CSS Modules `stl/css` | Light DOM `<style>` + BEM class names + CSS custom properties |

### 13.2 State Patterns

| ClojureScript (Potok/Okulary) | ES JS |
|-------------------------------|-------|
| `st/emit! (event-type payload)` | `store.dispatch('event-type', payload)` |
| `ptk/UpdateEvent` | `store.registerEvent('type', (state, payload) => newState)` |
| `ptk/WatchEvent` (returns Observable) | `store.registerEffect('type', async (payload, dispatch) => { ... })` |
| `okl lens` / `ref` | `createRef(selector)` with `.deref()` and `.subscribe()` |
| `beicon/subject` (RxJS) | `createStream(initial)` with `.next()`, `.subscribe()` |

### 13.3 Event Flow (Example: Creating a File)

```
ClojureScript:
  UI button click
    → (st/emit! :create-file {:project-id project-id :name "New file"})
    → WatchEvent handler
      → (rp/cmd! :create-file params)
      → HTTP POST /api/rpc/command/create-file
      → UpdateEvent handler (receives file data)
      → State updated → UI re-renders

ES JS:
  UI button click
    → store.dispatch('create-file', { projectId, name: 'New file' })
    → Effect handler (registered with store.registerEffect)
      → cmd('create-file', params)
      → HTTP POST /api/rpc/command/create-file
      → store.dispatch('create-file-success', fileData)
      → State updated → subscribed components re-render
```

### 13.4 Data Patterns

| ClojureScript | ES JS |
|--------------|-------|
| `{::shape/id (uuid)}` | `{ id: crypto.randomUUID() }` |
| `(:shape/id shape)` | `shape.id` |
| `(assoc shape :shape/x 100)` | `{ ...shape, x: 100 }` |
| `(update shape :shape/fills conj fill)` | `{ ...shape, fills: [...shape.fills, fill] }` |
| `#js [1 2 3]` | `[1, 2, 3]` |
| `(into [] (map f coll))` | `coll.map(f)` |
| `(reduce f init coll)` | `coll.reduce(f, init)` |
| `(get-in shape [:shape :selection])` | `shape.selection` (flat access, no nested maps) |
| `#{"set" "items"}` | `new Set(["set", "items"])` |
| `(keyword? x)` | `typeof x === 'symbol'` or use string keys |

---

## 14. Milestone Checklist

### P0 — Foundation + Auth + Dashboard (3-4 weeks) ✅

- [x] Complete `lib/store.js` (Potok port, event dispatch, selectors)
- [x] Complete `lib/router.js` (path-based routing, auth guards)
- [x] Enhance `lib/rpc.js` (GET requests, retry, error handling)
- [x] Enhance `lib/transit.js` (full Transit codec)
- [x] Add `lib/ws.js` (WebSocket client)
- [x] Add `lib/i18n.js` (internationalization stub)
- [x] Add `styles/tokens.css` (design token CSS custom properties)
- [x] Polish `penpot-auth-screen.js` (loading states, error display)
- [x] Complete `penpot-dashboard.js` (team sidebar, project grid, file grid)
- [x] Add `penpot-team-sidebar.js` (team list + members)
- [x] Add `penpot-file-grid.js` (file cards with thumbnails)
- [x] Basic `penpot-workspace.js` (toolbar + empty canvas)
- [x] E2E test: login → dashboard → create file → workspace (6+11 tests pass) (P0: 17 tests pass)

### P1 — Workspace Shell + View-Only (4-6 weeks)

- [x] `penpot-canvas.js` (SVG fallback renderer)
- [x] Shape data model (`lib/types.js` + `lib/shapes.js`)
- [x] `penpot-toolbar.js` (file name, actions)
- [x] `penpot-left-sidebar.js` (page list + tabs)
- [x] `penpot-right-sidebar.js` (design + inspect tabs)
- [x] `penpot-page-list.js` (page navigation — inside left-sidebar)
- [x] `penpot-layer-panel.js` (layer tree with visibility/lock/reorder)
- [x] Zoom controls (integrated into tools-bar)
- [x] Load file data via `get-file` RPC
- [x] Render shapes as SVG
- [x] E2E test: open file → see shapes → navigate pages (P1: 17 tests pass)

### P2 — Design System Components (6-8 weeks) ✅

- [x] `penpot-button.js`
- [x] `penpot-input.js`
- [x] `penpot-dropdown.js`
- [x] `penpot-modal.js`
- [x] `penpot-tooltip.js`
- [x] `penpot-tabs.js`
- [x] `penpot-checkbox.js`
- [x] `penpot-radio.js`
- [x] `penpot-color-picker.js`
- [x] `penpot-slider.js`
- [x] `penpot-select.js`
- [x] `penpot-context-menu.js`
- [x] `penpot-icon.js`
- [x] `penpot-loader.js`
- [x] `penpot-notification.js`
- [x] `penpot-avatar.js`
- [x] `penpot-badge.js`
- [x] `penpot-file-thumbnail.js`
- [x] `penpot-form.js`
- [x] `penpot-switch.js`
- [x] Design tokens CSS (complete token set)
- [x] Component preview page (`preview/`)
- [x] E2E tests: 18 tests pass (P2 components spec)

### P3 — Drawing & Editing Tools (8-12 weeks) — ✅ Complete

- [x] Tool base class (`PenpotTool`)
- [x] Select tool (click, single selection, drag-to-move)
- [x] Frame tool (draw frame rectangles)
- [x] Rectangle tool (draw rectangles)
- [x] Circle/Ellipse tool
- [x] Move (integrated into select tool)
- [x] Multi-select (marquee, shift+click, group bounding box, resize handles, rotation handle)
- [x] Resize handles (bounding box)
- [x] Text tool (basic click-to-place)
- [x] Path tool (pen/bezier freehand drawing — full Bezier curve tool with control points)
- [x] Image tool (place images + SVG import)
- [x] Boolean operations (union, difference, intersection, exclusion — convex decomposition + SH clipping)
- [x] Properties panel (position, size, opacity)
- [x] `update-file` RPC integration (persist edits to server)
- [x] Undo/redo (local history stack via `lib/history.js` + server persistence)
- [x] Keyboard shortcuts (wired to tool-manager actions via `lib/shortcuts.js`)
- [x] Snap/alignment guides (shape-to-shape and canvas-edge snapping)
- [x] Gradient editor (linear/radial, stop editing)
- [x] Shadow editor (drop/inner, color/offset/blur/opacity)
- [x] Z-order controls (][/Shift+][/Shift+[)
- [x] Rotation handle on canvas
- [x] Double-click text editing (inline contentEditable)
- [x] Text toolbar (font family/size, bold/italic/underline/align)
- [x] Inspect panel (CSS/SVG code output, copy-to-clipboard)
- [x] Canvas rulers (horizontal + vertical with zoom)
- [x] SVG import (drag-drop + file picker, `lib/svg-import.js`)
- [x] Dashboard sub-pages (search, fonts, libraries)
- [x] E2E tests: 156 tests pass across 13 spec files (all listed above)
- [x] Alignment & distribution tools (align-left/center/right/top/middle/bottom, distribute-h/v)
- [x] Stroke property editing (add/remove/edit, color, width, style solid/dashed/dotted, cap round/butt/square)
- [x] Blur editing (layer blur with SVG feGaussianBlur filter)
- [x] Border radius per corner (TL/TR/BR/BL independent, SVG path arc for non-uniform)
- [x] Canvas right-click context menu (copy/paste/duplicate/group/ungroup/z-order/create-component/delete)
- [x] Create Component UI button (toolbar ★ button + sidebar button + context menu)
- [x] Deleted files view (dashboard "Deleted" tab with restore/permanent delete)
- [x] Share dialog server persistence (`update-file-share` RPC on permission change)
- [x] Real-time cursor broadcast (pointer position via `sendPointerUpdate`, throttled)
- [x] Configurable nudge (small=1px, big=10px, Shift+arrow)

### P4 — Layer Panel + Asset Library (4-6 weeks) — ✅ Complete

- [x] Layer panel (visibility, lock, reorder, rename, search/filter, nested drag-drop)
- [x] Visibility/lock toggles
- [x] Selection highlight on canvas
- [x] Nested drag-drop into frames/groups (three drop zones: before/after for sibling reorder, into for reparenting; ancestor cycle prevention; `mov-objects` change persistence; visual feedback with green outline and indented line indicators)
- [x] Asset panel (components, fonts, media tabs — real RPC data)
- [x] Font upload + management (process blobs, chunked upload, rename, delete, download, search)
- [x] Component creation button (Ctrl+Alt+K, toolbar ★ icon, sidebar button, context menu)
- [x] Component instances (create via Ctrl+Alt+K, detach via Ctrl+Alt+Shift+D, sync via Ctrl+Alt+Shift+K, place from asset panel)
- [x] Component instance detach/sync UI buttons in right sidebar
- [ ] Component override tracking UI (per-property override indicators, reset overrides)
- [ ] Component search with real file data (currently hard-coded samples)
- [x] Library connect/disconnect (dashboard Libraries tab with connect/disconnect buttons, RPC calls)
- [x] Multi-select in layers panel (Shift/Ctrl click)

### P5 — Collaboration (4-6 weeks) — ✅ Framework complete, cursor broadcast working

- [x] WebSocket connection and authentication
- [x] Real-time cursor presence (pointer position broadcast via `sendPointerUpdate`, throttled at 100ms)
- [x] Change broadcast (local edit → server → other clients via `lib/collaboration.js`)
- [x] Conflict resolution (OT — attribute-level transform for mod-obj + undo/reapply of pending commits via `lib/ot.js`; full change processing via `lib/process-changes.js`)
- [ ] User avatars on canvas (presence bar renders placeholders but no real avatar URLs)
- [x] Comment panel (basic UI — no canvas pin, no threaded replies, no resolution)

### P6 — Export + Advanced Features (4-6 weeks) — 🟡 Basic export works, advanced features incomplete

- [x] PNG/SVG/PDF export (`lib/export.js`)
- [ ] JPEG/WebP export formats
- [ ] Per-shape export presets (multiple format/scale combinations per shape)
- [ ] Multi-page export (select which pages/frames to export)
- [x] File import (`.penpot` format — import-binfile UI dialog + RPC via `lib/file-import.js` + `penpot-import-dialog.js`)
- [ ] Advanced SVG import (gradients, masks, clip-paths, text styling, stroke attributes, nested groups)
- [x] Comment panel (basic — no canvas pin, no threading)
- [x] Share dialog (URL sharing UI + server persistence via `update-file-share` RPC)
- [x] Font loading (`loadTeamFontsIntoDocument()` loads team fonts via FontFace API)
- [ ] Font picker integration (text toolbar still uses `SYSTEM_FONTS`, needs dynamic font list)
- [x] Deleted files view (dashboard "Deleted" tab with restore/permanent delete)
- [x] Plugin API bridge (`lib/plugin-api.js` — API + manager classes)
- [x] Keyboard shortcuts system (`lib/shortcuts.js`)
- [x] Access tokens — backend CRUD RPC exists (`access_token.js`) — **not exposed in settings UI**
- [x] Dashboard context menus — right-click on file/project cards with rename/duplicate/delete
- [x] File inline rename — right-click "Rename" on file cards triggers inline edit
- [x] Multi-select in layers panel — Shift+click and Ctrl+click to add/remove shapes from selection

### Remaining — 🟡 Partial implementations and critical gaps

- [x] WASM renderer bridge (skipped for migration — SVG-only rendering sufficient; bridge code retained for future use)
- [x] Rich text editing (full contentEditable with font family/size selection, bold/italic/underline/strikethrough, alignment, lists, color, floating toolbar via `lib/rich-text.js`)
- [ ] Rich text — headings, paragraph spacing, text direction (RTL), subscript/superscript
- [x] Gradient editor
- [x] Shadow editor
- [x] Snap/alignment guides (shape-to-shape and canvas-edge snapping during drag/resize)
- [x] Page management UI (add/rename/delete pages)
- [x] Canvas rulers (horizontal + vertical with zoom, in `penpot-rulers.js`)
- [x] SVG import (drag-drop + file picker in ImageTool; `lib/svg-import.js` parser)
- [ ] SVG import — advanced (gradients, masks, clip-paths, text styling, stroke attributes, nested groups)
- [x] Group/ungroup (keyboard shortcuts Ctrl+G/Ctrl+Shift+G)
- [x] Z-order controls (bring forward/send backward/bring to front/send to back)
- [x] Rotation handle on canvas
- [x] Inspect panel (CSS/SVG code inspection, property display, copy-to-clipboard)
- [x] Dashboard font/libraries/search pages
- [x] Settings pages (profile, password, feedback)
- [x] i18n locale loading (async fetch + register + browser detect + 5 locales: en, es, fr, de, ja)
- [x] Plugin manager workspace UI (install via URL, open, remove, permissions dialog)
- [x] Undo/redo (Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y keyboard shortcuts + toolbar buttons + server persistence)
- [x] Document persistence (`update-file` RPC via `lib/persistence.js`)
- [x] Text toolbar (font family/size, bold/italic/underline/align)
- [x] File import dialog (`.penpot` / `.zip` drag-drop + file picker + project select + progress)
- [x] Conflict resolution (attribute-level OT for mod-obj via `lib/ot.js` + undo/reapply of pending commits + full `lib/process-changes.js` engine + `get-file-changes` RPC)
- [x] Change broadcast (local edits broadcast via WS, remote changes applied with undo/reapply + OT transform)
- [x] View-only viewer (SVG rendering, page navigation, zoom in `penpot-viewer.js`)

#### Critical gaps requiring implementation (see `tracking.md` §Phase 2b for full list)

- [ ] **C1** Flex/Grid layout editing (layouts on frames)
- [ ] **C2** Pen/pencil freehand drawing (Bezier curve editing)
- [ ] **C3** Design tokens system (color tokens, typography tokens, token sets, themes)
- [ ] **C4** Canvas2D or WASM renderer (SVG-only is too slow for large files)
- [ ] **C8** Boolean path geometry (actual geometric computation)
- [x] **H4** Constraint editing (horizontal/vertical pinning within frames)
- [x] **H8** Per-shape export presets (add/remove/format/scale/suffix per shape in right sidebar)
- [x] **H9** Component override tracking UI (override count badge + Reset Overrides clears touched set; per-property indicators still missing)
- [ ] **H10** Threaded/resolvable comments (x/y pin on canvas, threaded replies, resolve status)
- [x] **H11** Remote selection highlighting (colored outlines for remote users' selected shapes via cursor overlay)
- [ ] **H13** Libraries view — actual content (connect/disconnect buttons, publish/unpublish)
- [x] **H16** Nested drag-drop into frames (drag shape INTO a frame/group to change parent)
- [x] **H17** Font upload — binary data (chunked upload of actual font files)
- [x] **H18** Color palette management (Colors tab in asset panel with add/delete/apply; gradient swatches and rename still missing)
- [x] **H19** Typography palette management (Typography tab in asset panel with add/delete/apply; rename and edit dialog still missing)
- [x] **H20** Multi-page / per-shape export (select pages or individual shapes to export)
- [x] **H21** Access tokens UI (expose `access_token.js` CRUD in settings)
- [ ] **H22** Viewer mode (interactive page nav, zoom, inspect in viewer)