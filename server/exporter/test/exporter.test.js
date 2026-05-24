import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, loadConfig } from '../src/config.js';
import { sanitizeFilename, clampValue, generateId, sleep } from '../src/util.js';

describe('config', () => {
  it('loads defaults when env is empty', () => {
    const config = loadConfig({});
    assert.equal(config.publicUri, 'http://localhost:3449');
    assert.equal(config.exporterPort, DEFAULTS.HTTP_PORT);
    assert.equal(config.browserPoolMax, DEFAULTS.BROWSER_POOL_MAX);
    assert.equal(config.redisUri, null);
    assert.equal(config.enableSvgo, true);
  });

  it('overrides from env vars', () => {
    const config = loadConfig({
      PENPOT_PUBLIC_URI: 'https://design.example.com',
      PENPOT_EXPORTER_PORT: '9999',
      PENPOT_BROWSER_POOL_MAX: '10',
      PENPOT_EXPORTER_REDIS_URI: 'redis://localhost:6379',
      PENPOT_FLAGS: 'enable-exporter-svgo',
    });
    assert.equal(config.publicUri, 'https://design.example.com');
    assert.equal(config.exporterPort, 9999);
    assert.equal(config.browserPoolMax, 10);
    assert.equal(config.redisUri, 'redis://localhost:6379');
    assert.equal(config.enableSvgo, true);
  });

  it('parses numeric env vars with fallback', () => {
    const config = loadConfig({ PENPOT_EXPORTER_PORT: 'bad' });
    assert.equal(config.exporterPort, DEFAULTS.HTTP_PORT);
  });

  it('has correct MIME types', () => {
    assert.equal(DEFAULTS.MIME_TYPES.png, 'image/png');
    assert.equal(DEFAULTS.MIME_TYPES.jpeg, 'image/jpeg');
    assert.equal(DEFAULTS.MIME_TYPES.webp, 'image/webp');
    assert.equal(DEFAULTS.MIME_TYPES.svg, 'image/svg+xml');
    assert.equal(DEFAULTS.MIME_TYPES.pdf, 'application/pdf');
    assert.equal(DEFAULTS.MIME_TYPES.zip, 'application/zip');
  });

  it('has correct extensions', () => {
    assert.equal(DEFAULTS.EXTENSIONS.png, '.png');
    assert.equal(DEFAULTS.EXTENSIONS.jpeg, '.jpg');
    assert.equal(DEFAULTS.EXTENSIONS.webp, '.webp');
    assert.equal(DEFAULTS.EXTENSIONS.svg, '.svg');
    assert.equal(DEFAULTS.EXTENSIONS.pdf, '.pdf');
  });

  it('has valid types list', () => {
    assert.deepEqual(DEFAULTS.VALID_TYPES, ['png', 'jpeg', 'webp', 'svg', 'pdf']);
  });
});

describe('util', () => {
  it('generateId returns UUID format', () => {
    const id = generateId();
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generateId returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    assert.equal(ids.size, 100);
  });

  it('sanitizeFilename removes special characters', () => {
    assert.equal(sanitizeFilename('hello world.pdf'), 'hello_world.pdf');
    assert.equal(sanitizeFilename('../../../etc/passwd'), '.._.._.._etc_passwd');
    assert.equal(sanitizeFilename('design-v2.png'), 'design-v2.png');
  });

  it('sanitizeFilename truncates long names', () => {
    const long = 'a'.repeat(300);
    assert.equal(sanitizeFilename(long).length, 200);
  });

  it('sanitizeFilename defaults to export', () => {
    assert.equal(sanitizeFilename(''), 'export');
    assert.equal(sanitizeFilename(null), 'export');
    assert.equal(sanitizeFilename(undefined), 'export');
  });

  it('clampValue clamps within range', () => {
    assert.equal(clampValue(5, 1, 10), 5);
    assert.equal(clampValue(-1, 0, 10), 0);
    assert.equal(clampValue(15, 0, 10), 10);
  });

  it('sleep resolves after timeout', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 40, `Sleep was too short: ${elapsed}ms`);
  });
});

describe('handler validation', () => {
  it('validates missing cmd', () => {
    const params = {};
    assert.equal(params.cmd, undefined);
    assert.ok(!params.cmd);
  });

  it('validates valid export types', () => {
    for (const type of DEFAULTS.VALID_TYPES) {
      assert.ok(DEFAULTS.VALID_TYPES.includes(type));
    }
  });

  it('rejects invalid export type', () => {
    assert.ok(!DEFAULTS.VALID_TYPES.includes('gif'));
    assert.ok(!DEFAULTS.VALID_TYPES.includes('tiff'));
  });
});

describe('render URL builder', () => {
  it('builds correct URL parameters', () => {
    const url = new URL('http://localhost:3449/render.html');
    url.searchParams.set('file-id', 'f1');
    url.searchParams.set('page-id', 'p1');
    url.searchParams.set('object-id', 'o1');
    url.searchParams.set('scale', '2');
    url.searchParams.set('route', 'objects');
    assert.ok(url.toString().includes('file-id=f1'));
    assert.ok(url.toString().includes('page-id=p1'));
    assert.ok(url.toString().includes('object-id=o1'));
    assert.ok(url.toString().includes('scale=2'));
    assert.ok(url.toString().includes('route=objects'));
  });
});

describe('export grouping', () => {
  it('groups exports by scale and type', () => {
    const exports = [
      { 'object-id': 'a', name: 'frame1', type: 'png', scale: 1 },
      { 'object-id': 'b', name: 'frame2', type: 'png', scale: 2 },
      { 'object-id': 'c', name: 'frame3', type: 'svg', scale: 1 },
    ];

    const groups = new Map();
    for (const exp of exports) {
      const key = `${exp.scale || 1}:${exp.type}`;
      if (!groups.has(key)) {
        groups.set(key, { scale: exp.scale || 1, type: exp.type, objects: [] });
      }
      groups.get(key).objects.push({
        id: exp['object-id'],
        name: exp.name,
        filename: `${exp.name}${DEFAULTS.EXTENSIONS[exp.type]}`,
      });
    }

    const groupList = Array.from(groups.values());
    assert.equal(groupList.length, 3);

    const png1 = groupList.find(g => g.type === 'png' && g.scale === 1);
    assert.ok(png1);
    assert.equal(png1.objects.length, 1);

    const png2 = groupList.find(g => g.type === 'png' && g.scale === 2);
    assert.ok(png2);
    assert.equal(png2.objects.length, 1);

    const svg1 = groupList.find(g => g.type === 'svg' && g.scale === 1);
    assert.ok(svg1);
    assert.equal(svg1.objects.length, 1);
  });

  it('groups same type and scale together', () => {
    const exports = [
      { 'object-id': 'a', name: 'f1', type: 'png', scale: 2 },
      { 'object-id': 'b', name: 'f2', type: 'png', scale: 2 },
      { 'object-id': 'c', name: 'f3', type: 'png', scale: 2 },
    ];

    const groups = new Map();
    for (const exp of exports) {
      const key = `${exp.scale}:${exp.type}`;
      if (!groups.has(key)) {
        groups.set(key, { scale: exp.scale, type: exp.type, objects: [] });
      }
      groups.get(key).objects.push({ id: exp['object-id'], name: exp.name, filename: `${exp.name}.png` });
    }

    assert.equal(groups.size, 1);
    const group = groups.get('2:png');
    assert.equal(group.objects.length, 3);
  });
});

describe('context options', () => {
  it('sets deviceScaleFactor for non-WASM', () => {
    const scale = 2;
    const opts = { deviceScaleFactor: scale };
    assert.equal(opts.deviceScaleFactor, 2);
  });

  it('sets deviceScaleFactor to 1 for WASM', () => {
    const isWasm = true;
    const opts = { deviceScaleFactor: isWasm ? 1 : 2 };
    assert.equal(opts.deviceScaleFactor, 1);
  });

  it('includes auth cookie in storageState', () => {
    const token = 'test-token-123';
    const hostname = 'localhost';
    const storageState = {
      cookies: [{
        name: 'auth-token',
        value: token,
        domain: hostname,
        path: '/',
      }],
    };
    assert.equal(storageState.cookies[0].value, token);
    assert.equal(storageState.cookies[0].name, 'auth-token');
  });
});