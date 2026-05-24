import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, 'public');
const PORT = 3449;
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/') || pathname.startsWith('/ws/') || pathname.startsWith('/internal/')) {
    return proxy(req, res, url);
  }

  let filePath = join(ROOT, pathname === '/' ? 'index.html' : pathname);

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, 'index.html');
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    return res.end(data);
  } catch {
    try {
      const data = await readFile(join(ROOT, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
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

server.listen(PORT, () => {
  console.log(`[penpot-client] http://localhost:${PORT}`);
  console.log(`[penpot-client] Proxying /api/* -> ${BACKEND}`);
});