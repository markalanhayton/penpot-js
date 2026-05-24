# Exporter Module (server/exporter)

Node.js ESM service that renders Penpot designs to PNG, JPEG, WebP, SVG, and PDF using Playwright.

## Architecture

- **Standalone service** on port 6061 (configurable via `PENPOT_EXPORTER_PORT`)
- Receives export requests via HTTP POST with JSON body
- Uses a pool of Playwright Chromium browsers for rendering
- Uploads results to the main server via `/api/management/methods/upload-tempfile`
- Reports progress via Redis pub/sub (optional)

## Key Files

| File | Purpose |
|------|---------|
| `src/core.js` | HTTP server startup, request routing |
| `src/config.js` | Environment variable configuration |
| `src/browser.js` | Playwright Chromium browser pool management |
| `src/redis.js` | Redis pub/sub for progress notifications |
| `src/handlers.js` | Request validation and command dispatch |
| `src/handlers/export_shapes.js` | `export-shapes` command (PNG/JPEG/WebP/SVG) |
| `src/handlers/export_frames.js` | `export-frames` command (PDF multi-frame) |
| `src/renderer/index.js` | Renderer dispatch (type → renderer) |
| `src/renderer/bitmap.js` | PNG/JPEG/WebP rendering via Playwright screenshots |
| `src/renderer/svg.js` | SVG rendering via DOM extraction + foreignObject rasterization |
| `src/renderer/pdf.js` | PDF rendering via Playwright `page.pdf()` + pdfunite merge |
| `src/renderer/resources.js` | Temp file and zip archive management |
| `src/util.js` | Shared utilities (logger, temp files, sanitization) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PENPOT_PUBLIC_URI` | `http://localhost:3449` | Penpot server public URI |
| `PENPOT_EXPORTER_PORT` | `6061` | Exporter HTTP port |
| `PENPOT_EXPORTER_HOST` | `0.0.0.0` | Exporter bind address |
| `PENPOT_EXPORTER_REDIS_URI` | null | Redis connection URI (optional) |
| `PENPOT_EXPORTER_SECRET_KEY` | null | Auth token for requests |
| `PENPOT_EXPORTER_MANAGEMENT_KEY` | null | Shared key for server upload auth |
| `PENPOT_BROWSER_POOL_MAX` | `5` | Max browsers in pool |
| `PENPOT_BROWSER_POOL_MIN` | `0` | Min browsers in pool |
| `PENPOT_RENDER_TIMEOUT` | `30000` | Render timeout (ms) |

## Testing

```bash
node --test test/exporter.test.js
```

## API

### POST `/`

Request body (JSON):

```json
{
  "cmd": "export-shapes",
  "exports": [{"page-id": "...", "file-id": "...", "object-id": "...", "type": "png", "scale": 2, "name": "frame1"}],
  "wait": true,
  "profile-id": "...",
  "token": "auth-token"
}
```

### GET `/health`

Returns `{ "status": "ok" }`.