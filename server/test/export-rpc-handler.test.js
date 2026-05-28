import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import registerExportCommands from '../src/rpc/export.js';
import { RpcError } from '../src/rpc/dispatcher.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

function makeCtx(overrides = {}) {
  return {
    profileId: '00000000-0000-0000-0000-000000000001',
    sessionId: 'test-session-id',
    requestId: 'test-request-id',
    ...overrides,
  };
}

describe('Export RPC — export', () => {
  let dispatcher;

  beforeEach(() => {
    process.env.PENPOT_EXPORTER_URI = 'http://localhost:9999';
    dispatcher = createDispatcher();
    registerExportCommands(dispatcher.register);
  });

  afterEach(() => {
    delete process.env.PENPOT_EXPORTER_URI;
  });

  it('throws when cmd parameter is absent', async () => {
    const handler = dispatcher.methods.get('export').handler;
    await assert.rejects(
      () => handler({}, makeCtx()),
      (err) => {
        assert.ok(err instanceof TypeError || err instanceof RpcError, `Expected TypeError or RpcError, got ${err.constructor.name}`);
        return true;
      }
    );
  });

  it('validates that cmd is required even when other params are present', async () => {
    const handler = dispatcher.methods.get('export').handler;
    await assert.rejects(
      () => handler({ fileIds: ['f1'], scale: 2, format: 'png' }, makeCtx()),
      (err) => {
        assert.ok(err instanceof TypeError || err instanceof RpcError);
        return true;
      }
    );
  });

  it('rejects when exporter service is unreachable', async () => {
    const handler = dispatcher.methods.get('export').handler;
    await assert.rejects(
      () => handler({ cmd: 'export-shapes', fileIds: ['f1'], objects: ['s1'] }, makeCtx()),
      { name: 'TypeError' }
    );
  });
});

describe('Export RPC — export-shapes', () => {
  let dispatcher;

  beforeEach(() => {
    process.env.PENPOT_EXPORTER_URI = 'http://localhost:9999';
    dispatcher = createDispatcher();
    registerExportCommands(dispatcher.register);
  });

  afterEach(() => {
    delete process.env.PENPOT_EXPORTER_URI;
  });

  it('rejects when exporter service is unreachable', async () => {
    const handler = dispatcher.methods.get('export-shapes').handler;
    await assert.rejects(
      () => handler({ fileIds: ['f1'], objects: ['obj1'] }, makeCtx()),
      { name: 'TypeError' }
    );
  });

  it('always sends cmd=export-shapes regardless of input params', async () => {
    const handler = dispatcher.methods.get('export-shapes').handler;
    const ctx = makeCtx();
    const originalFetch = globalThis.fetch;
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({}) };
    };

    try {
      await handler({ fileIds: ['f1'], objects: ['obj1'] }, ctx);
      assert.equal(capturedBody.cmd, 'export-shapes');
      assert.equal(capturedBody['profile-id'], ctx.profileId);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Export RPC — export-frames', () => {
  let dispatcher;

  beforeEach(() => {
    process.env.PENPOT_EXPORTER_URI = 'http://localhost:9999';
    dispatcher = createDispatcher();
    registerExportCommands(dispatcher.register);
  });

  afterEach(() => {
    delete process.env.PENPOT_EXPORTER_URI;
  });

  it('rejects when exporter service is unreachable', async () => {
    const handler = dispatcher.methods.get('export-frames').handler;
    await assert.rejects(
      () => handler({ fileIds: ['f1'] }, makeCtx()),
      { name: 'TypeError' }
    );
  });

  it('always sends cmd=export-frames and forwards profile-id', async () => {
    const handler = dispatcher.methods.get('export-frames').handler;
    const ctx = makeCtx();
    const originalFetch = globalThis.fetch;
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({}) };
    };

    try {
      await handler({ fileIds: ['f1'] }, ctx);
      assert.equal(capturedBody.cmd, 'export-frames');
      assert.equal(capturedBody['profile-id'], ctx.profileId);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('uses sessionId as token when available', async () => {
    const handler = dispatcher.methods.get('export-frames').handler;
    const ctx = makeCtx({ sessionId: 'my-session-123' });
    const originalFetch = globalThis.fetch;
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({}) };
    };

    try {
      await handler({ fileIds: ['f1'] }, ctx);
      assert.equal(capturedBody.token, 'my-session-123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('falls back to requestId as token when sessionId is absent', async () => {
    const handler = dispatcher.methods.get('export-frames').handler;
    const ctx = makeCtx({ sessionId: null, requestId: 'req-456' });
    const originalFetch = globalThis.fetch;
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({}) };
    };

    try {
      await handler({ fileIds: ['f1'] }, ctx);
      assert.equal(capturedBody.token, 'req-456');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('sends cookie header with auth-token when sessionId is present', async () => {
    const handler = dispatcher.methods.get('export-frames').handler;
    const ctx = makeCtx({ sessionId: 'sess-abc' });
    const originalFetch = globalThis.fetch;
    let capturedHeaders = null;

    globalThis.fetch = async (url, options) => {
      capturedHeaders = options.headers;
      return { ok: true, json: async () => ({}) };
    };

    try {
      await handler({ fileIds: ['f1'] }, ctx);
      assert.equal(capturedHeaders.Cookie, 'auth-token=sess-abc');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});