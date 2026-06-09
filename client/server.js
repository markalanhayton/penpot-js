import http from 'node:http';
import { readFile, stat, watch } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, 'public');
const SHARED_ROOT = join(__dirname, '..', 'shared', 'src');
const PORT = Number(process.env.PORT) || 3449;
const BACKEND = 'http://localhost:6060';

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.map':  'application/json',
};

const RELOAD_CLIENT_SCRIPT = `<script>
(function() {
  if (window.__penpotReloadWs) return;
  var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var url = proto + '//' + location.host + '/__reload';
  function connect() {
    var ws = new WebSocket(url);
    window.__penpotReloadWs = ws;
    ws.addEventListener('message', function(ev) {
      try {
        var msg = JSON.parse(ev.data);
        if (msg && msg.type === 'reload') {
          window.location.reload();
        }
      } catch {}
    });
    ws.addEventListener('close', function() {
      window.__penpotReloadWs = null;
      setTimeout(connect, 500);
    });
    ws.addEventListener('error', function() {
      try { ws.close(); } catch {}
    });
  }
  connect();
})();
</script>`;

const reloadClients = new Set();
let reloadDebounce = null;

async function broadcastReload(reason) {
  for (const ws of reloadClients) {
    try {
      ws.send(JSON.stringify({ type: 'reload', reason, at: Date.now() }));
    } catch {}
  }
}

function triggerReload(reason) {
  if (reloadDebounce) clearTimeout(reloadDebounce);
  reloadDebounce = setTimeout(() => {
    reloadDebounce = null;
    console.log(`[reload] ${reason}`);
    broadcastReload(reason);
  }, 150);
}

async function startWatcher() {
  for (const dir of [ROOT, SHARED_ROOT]) {
    try {
      const watcher = watch(dir, { recursive: true, persistent: true });
      (async () => {
        for await (const evt of watcher) {
          if (!evt.filename) continue;
          const name = String(evt.filename);
          if (name.includes('node_modules') || name.includes('.git') || name.startsWith('test') || name.includes('__tests__')) continue;
          const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
          if (!['js', 'mjs', 'css', 'html', 'svg', 'json'].includes(ext)) continue;
          triggerReload(`${dir.endsWith('public') ? 'client' : 'shared'}/${name}`);
        }
      })();
    } catch (err) {
      console.warn(`[watch] could not watch ${dir}: ${err.message}`);
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/__reload.js') {
    res.writeHead(200, {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    return res.end(RELOAD_CLIENT_SCRIPT.replace(/^<script>|<\/script>$/g, ''));
  }

  if (pathname.startsWith('/api/') || pathname.startsWith('/ws/') || pathname.startsWith('/internal/') || pathname.startsWith('/assets/')) {
    return proxy(req, res, url);
  }

  if (pathname.startsWith('/shared/')) {
    const sharedPath = join(SHARED_ROOT, pathname.slice('/shared/'.length));
    try {
      const s = await stat(sharedPath);
      if (s.isFile()) {
        const data = await readFile(sharedPath);
        res.writeHead(200, { 'Content-Type': MIME[extname(sharedPath)] || 'application/octet-stream', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
        return res.end(data);
      }
    } catch {}
  }

  let filePath = join(ROOT, pathname === '/' ? 'index.html' : pathname);

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, 'index.html');
    const data = await readFile(filePath);
    const isHtml = extname(filePath) === '.html';
    const headers = {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };
    res.writeHead(200, headers);
    if (isHtml) {
      let html = data.toString('utf8');
      const injection = RELOAD_CLIENT_SCRIPT;
      if (html.includes('</body>')) {
        html = html.replace('</body>', injection + '</body>');
      } else if (html.includes('</html>')) {
        html = html.replace('</html>', injection + '</html>');
      } else {
        html += injection;
      }
      return res.end(html);
    }
    return res.end(data);
  } catch {
    const ext = extname(pathname);
    if (ext && ext !== '.html') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    try {
      const data = await readFile(join(ROOT, 'index.html'));
      const html = data.toString('utf8');
      const injected = html.includes('</body>')
        ? html.replace('</body>', RELOAD_CLIENT_SCRIPT + '</body>')
        : html + RELOAD_CLIENT_SCRIPT;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(injected);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});

function proxy(req, res, url) {
  const target = new URL(url.pathname + url.search, BACKEND);
  const options = {
    hostname: target.hostname,
    port: target.port,
    path: target.pathname + target.search,
    method: req.method,
    headers: { ...req.headers, host: target.host },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[proxy] ${req.method} ${url.pathname} -> ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Backend unavailable');
  });

  req.pipe(proxyReq);
}

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/__reload') {
    return;
  }
  if (!req.url || !req.url.startsWith('/ws/')) {
    socket.destroy();
    return;
  }

  const proxyReq = http.request({
    port: 6060,
    host: 'localhost',
    path: req.url,
    method: 'GET',
    headers: {
      ...req.headers,
      host: 'localhost:6060',
      connection: 'upgrade',
      upgrade: 'websocket',
    },
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    proxySocket.on('error', () => { try { socket.destroy(); } catch {} });
    socket.on('error', () => { try { proxySocket.destroy(); } catch {} });

    let responseHeaders = `HTTP/1.1 101 Switching Protocols\r\n`;
    for (let i = 0; i < proxyRes.rawHeaders.length; i += 2) {
      responseHeaders += `${proxyRes.rawHeaders[i]}: ${proxyRes.rawHeaders[i + 1]}\r\n`;
    }
    responseHeaders += '\r\n';
    socket.write(responseHeaders);

    if (proxyHead && proxyHead.length) socket.write(proxyHead);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on('error', (err) => {
    console.error(`[ws-proxy] error: ${err.message}`);
    try { socket.destroy(); } catch {}
  });

  if (head && head.length) proxyReq.write(head);
  proxyReq.end();
});

const wss = new WebSocketServer({ noServer: true });
wss.on('connection', (ws) => {
  reloadClients.add(ws);
  try { ws.send(JSON.stringify({ type: 'hello', at: Date.now() })); } catch {}
  ws.on('close', () => reloadClients.delete(ws));
  ws.on('error', () => reloadClients.delete(ws));
});

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/__reload') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    return;
  }
});

server.listen(PORT, () => {
  console.log(`[penpot-client] http://localhost:${PORT}`);
  console.log(`[penpot-client] Proxying /api/* -> ${BACKEND}`);
  console.log(`[penpot-client] Hot reload: WebSocket on ws://localhost:${PORT}/__reload`);
  startWatcher().catch((err) => console.warn(`[watch] error: ${err.message}`));
});
