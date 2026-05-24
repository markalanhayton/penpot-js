import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCSP } from '../src/middleware/security.js';

describe('buildCSP', () => {
  it('returns default CSP with all directives', () => {
    const csp = buildCSP();
    assert.ok(csp.includes("default-src 'none'"));
    assert.ok(csp.includes("script-src 'self'"));
    assert.ok(csp.includes("style-src 'self' 'unsafe-inline'"));
    assert.ok(csp.includes("img-src 'self' data: blob:"));
    assert.ok(csp.includes("font-src 'self'"));
    assert.ok(csp.includes("connect-src 'self'"));
    assert.ok(csp.includes("frame-src 'none'"));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(csp.includes("form-action 'self'"));
    assert.ok(csp.includes("base-uri 'self'"));
  });

  it('includes extra script sources', () => {
    const csp = buildCSP({ extraScriptSrc: ['cdn.example.com', 'analytics.example.com'] });
    assert.ok(csp.includes('cdn.example.com'));
    assert.ok(csp.includes('analytics.example.com'));
    assert.ok(csp.includes("script-src 'self'"));
  });

  it('includes extra connect sources', () => {
    const csp = buildCSP({ extraConnectSrc: ['ws://localhost:8080'] });
    assert.ok(csp.includes('ws://localhost:8080'));
    assert.ok(csp.includes("connect-src 'self'"));
  });

  it('includes extra image sources', () => {
    const csp = buildCSP({ extraImgSrc: ['https://img.example.com'] });
    assert.ok(csp.includes('https://img.example.com'));
  });

  it('includes extra style sources', () => {
    const csp = buildCSP({ extraStyleSrc: ['https://fonts.googleapis.com'] });
    assert.ok(csp.includes('https://fonts.googleapis.com'));
  });

  it('includes extra font sources', () => {
    const csp = buildCSP({ extraFontSrc: ['https://fonts.gstatic.com'] });
    assert.ok(csp.includes('https://fonts.gstatic.com'));
  });

  it('uses semicolons as directive separator', () => {
    const csp = buildCSP();
    const parts = csp.split('; ');
    assert.ok(parts.length >= 10);
  });

  it('works with empty options', () => {
    const csp = buildCSP({});
    assert.ok(typeof csp === 'string');
    assert.ok(csp.length > 0);
  });
});

describe('registerSecurityHeaders', () => {
  it('registers an onSend hook', async () => {
    const { registerSecurityHeaders } = await import('../src/middleware/security.js');
    const hooks = [];
    const fakeFastify = {
      addHook(event, handler) { hooks.push({ event, handler }); },
    };
    registerSecurityHeaders(fakeFastify);
    assert.equal(hooks.length, 1);
    assert.equal(hooks[0].event, 'onSend');
  });

  it('adds security headers in onSend callback', async () => {
    const { registerSecurityHeaders } = await import('../src/middleware/security.js');
    const headers = {};
    const fakeFastify = {
      addHook(event, handler) { this._handler = handler; },
    };
    registerSecurityHeaders(fakeFastify, { enableHsts: false });
    const reply = {
      header(k, v) { headers[k] = v; return reply; },
      sent: false,
      hasHeader() { return false; },
    };
    await fakeFastify._handler({}, reply, 'body');
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['X-Frame-Options'], 'DENY');
    assert.equal(headers['X-XSS-Protection'], '0');
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
    assert.equal(headers['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()');
    assert.ok(headers['Content-Security-Policy']);
    assert.equal(headers['Cache-Control'], 'no-store');
  });

  it('skips CSP when disabled', async () => {
    const { registerSecurityHeaders } = await import('../src/middleware/security.js');
    const headers = {};
    const fakeFastify = {
      addHook(event, handler) { this._handler = handler; },
    };
    registerSecurityHeaders(fakeFastify, { enableCsp: false, enableHsts: false });
    const reply = {
      header(k, v) { headers[k] = v; return reply; },
      sent: false,
      hasHeader() { return false; },
    };
    await fakeFastify._handler({}, reply, 'body');
    assert.ok(!headers['Content-Security-Policy']);
  });

  it('does not overwrite existing Cache-Control', async () => {
    const { registerSecurityHeaders } = await import('../src/middleware/security.js');
    const headers = {};
    const fakeFastify = {
      addHook(event, handler) { this._handler = handler; },
    };
    registerSecurityHeaders(fakeFastify, { enableCsp: false, enableHsts: false });
    const reply = {
      header(k, v) { headers[k] = v; return reply; },
      sent: false,
      hasHeader(k) { return k === 'Cache-Control'; },
    };
    await fakeFastify._handler({}, reply, 'body');
    assert.ok(!('Cache-Control' in headers));
  });
});

describe('registerCorsHeaders', () => {
  it('registers an onRequest hook', async () => {
    const { registerCorsHeaders } = await import('../src/middleware/security.js');
    const hooks = [];
    const fakeFastify = {
      addHook(event, handler) { hooks.push({ event, handler }); },
    };
    registerCorsHeaders(fakeFastify);
    assert.equal(hooks.length, 1);
    assert.equal(hooks[0].event, 'onRequest');
  });

  it('sets CORS headers on regular requests', async () => {
    const { registerCorsHeaders } = await import('../src/middleware/security.js');
    const headers = {};
    const fakeFastify = {
      addHook(event, handler) { this._handler = handler; },
    };
    registerCorsHeaders(fakeFastify);
    const reply = {
      header(k, v) { headers[k] = v; return reply; },
      code() { return reply; },
      send() {},
    };
    await fakeFastify._handler({ method: 'GET' }, reply);
    assert.equal(headers['Access-Control-Allow-Origin'], '*');
    assert.ok(headers['Access-Control-Allow-Methods']);
    assert.ok(headers['Access-Control-Allow-Headers']);
    assert.equal(headers['Access-Control-Allow-Credentials'], 'true');
    assert.ok(headers['Access-Control-Max-Age']);
  });

  it('responds 204 to OPTIONS preflight', async () => {
    const { registerCorsHeaders } = await import('../src/middleware/security.js');
    let sentCode;
    const fakeFastify = {
      addHook(event, handler) { this._handler = handler; },
    };
    registerCorsHeaders(fakeFastify);
    const reply = {
      header() { return reply; },
      code(c) { sentCode = c; return reply; },
      send() {},
    };
    await fakeFastify._handler({ method: 'OPTIONS' }, reply);
    assert.equal(sentCode, 204);
  });

  it('uses custom origin', async () => {
    const { registerCorsHeaders } = await import('../src/middleware/security.js');
    const headers = {};
    const fakeFastify = {
      addHook(event, handler) { this._handler = handler; },
    };
    registerCorsHeaders(fakeFastify, { origin: 'https://penpot.app' });
    const reply = {
      header(k, v) { headers[k] = v; return reply; },
      code() { return reply; },
      send() {},
    };
    await fakeFastify._handler({ method: 'GET' }, reply);
    assert.equal(headers['Access-Control-Allow-Origin'], 'https://penpot.app');
  });
});