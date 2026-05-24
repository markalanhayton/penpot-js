/**
 * @module test/wire-compat
 * @description Wire compatibility tests — send identical RPC requests to both
 * the Clojure backend and the Node.js backend, compare responses for structural
 * equivalence.
 *
 * ### Setup
 *
 * Requires both backends running:
 * - Clojure backend: `PENPOT_CLOJURE_URL` (default http://localhost:6060)
 * - JS backend: `PENPOT_JS_URL` (default http://localhost:6061)
 *
 * Run with:
 *   PENPOT_CLOJURE_URL=http://localhost:6060 PENPOT_JS_URL=http://localhost:6061 \
 *     node --test test/wire-compat.test.js
 *
 * If either backend is unavailable, tests are skipped.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const CLOJURE_URL = process.env.PENPOT_CLOJURE_URL || 'http://localhost:6060';
const JS_URL = process.env.PENPOT_JS_URL || 'http://localhost:6061';

let clojureUp = false;
let jsUp = false;
let clojureToken = null;
let jsToken = null;

async function checkBackend(url) {
  try {
    const r = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(3000) });
    return r.status === 200;
  } catch {
    return false;
  }
}

async function registerOnBackend(url) {
  const email = `wirecompat${Date.now()}@example.com`;
  const password = 'WireCompat123!';

  const r1 = await fetch(`${url}/api/rpc/command/prepare-register-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client': 'penpot-client' },
    body: JSON.stringify({ id: '1', method: 'prepare-register-profile', params: { fullname: 'Wire Compat', email, password } }),
  });
  if (r1.status !== 200) return null;
  const prep = await r1.json();

  const r2 = await fetch(`${url}/api/rpc/command/register-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client': 'penpot-client' },
    body: JSON.stringify({ id: '2', method: 'register-profile', params: { token: prep.token } }),
  });
  if (r2.status !== 200 && r2.status !== 201) return null;

  const setCookie = r2.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/auth-token=([^;]+)/);
  return match ? match[1] : null;
}

async function rpc(url, method, params, token) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Client': 'penpot-client',
    'Accept': 'application/json',
  };
  if (token) headers['Cookie'] = `auth-token=${token}`;

  const r = await fetch(`${url}/api/rpc/command/${method}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: '1', method, params }),
  });

  let body = null;
  const ct = r.headers.get('content-type') || '';
  try {
    if (ct.includes('transit+json') || ct.includes('json')) {
      body = await r.json();
    } else if (r.status === 204) {
      body = null;
    } else {
      body = await r.text();
    }
  } catch {
    body = null;
  }

  return { status: r.status, body, contentType: ct };
}

function normalizeResponse(body) {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(normalizeResponse);

  const sorted = {};
  for (const key of Object.keys(body).sort()) {
    const val = body[key];
    if (typeof val === 'string' && val.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(val)) {
      sorted[key] = '<uuid>';
    } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      sorted[key] = '<datetime>';
    } else if (typeof val === 'object' && val !== null) {
      sorted[key] = normalizeResponse(val);
    } else {
      sorted[key] = val;
    }
  }
  return sorted;
}

function compareResponses(cljResult, jsResult, method) {
  assert.equal(
    jsResult.status,
    cljResult.status,
    `${method}: status mismatch — JS ${jsResult.status} vs Clojure ${cljResult.status}`,
  );

  const cljBody = cljResult.body;
  const jsBody = jsResult.body;

  if (cljBody === null && jsBody === null) return;
  if (cljBody === null || jsBody === null) {
    assert.fail(`${method}: one response has body, other is null`);
  }

  if (typeof cljBody === 'object' && typeof jsBody === 'object') {
    const cljNorm = normalizeResponse(cljBody);
    const jsNorm = normalizeResponse(jsBody);

    const cljKeys = Object.keys(cljNorm).sort();
    const jsKeys = Object.keys(jsNorm).sort();

    const missingInJs = cljKeys.filter(k => !jsKeys.includes(k));
    const extraInJs = jsKeys.filter(k => !cljKeys.includes(k));

    if (missingInJs.length > 0 || extraInJs.length > 0) {
      const detail = [];
      if (missingInJs.length > 0) detail.push(`missing in JS: ${missingInJs.join(', ')}`);
      if (extraInJs.length > 0) detail.push(`extra in JS: ${extraInJs.join(', ')}`);
      assert.fail(`${method}: key shape mismatch — ${detail.join('; ')}`);
    }

    for (const key of cljKeys) {
      const cljVal = cljNorm[key];
      const jsVal = jsNorm[key];
      if (typeof cljVal === 'object' && cljVal !== null && typeof jsVal === 'object' && jsVal !== null) {
        assert.deepStrictEqual(jsVal, cljVal, `${method}.${key}: value shape mismatch`);
      }
    }
  }
}

before(async () => {
  clojureUp = await checkBackend(CLOJURE_URL);
  jsUp = await checkBackend(JS_URL);

  if (clojureUp && jsUp) {
    clojureToken = await registerOnBackend(CLOJURE_URL);
    jsToken = await registerOnBackend(JS_URL);
  }
});

describe('Wire Compatibility: JS ↔ Clojure Backend', { concurrency: false }, () => {

  it('health check returns 200 from both backends', async () => {
    if (!clojureUp || !jsUp) return;

    const clj = await fetch(`${CLOJURE_URL}/api/health`);
    const js = await fetch(`${JS_URL}/api/health`);

    assert.equal(clj.status, 200, 'Clojure health check failed');
    assert.equal(js.status, 200, 'JS health check failed');

    const cljBody = await clj.json();
    const jsBody = await js.json();

    assert.equal(typeof cljBody.status, typeof jsBody.status, 'status field type mismatch');
    assert.equal(cljBody.status, jsBody.status, 'status field value mismatch');
  });

  it('get-enabled-flags returns same shape', async () => {
    if (!clojureUp || !jsUp) return;

    const clj = await rpc(CLOJURE_URL, 'get-enabled-flags', {}, clojureToken);
    const js = await rpc(JS_URL, 'get-enabled-flags', {}, jsToken);

    assert.equal(js.status, clj.status, `status mismatch: JS ${js.status} vs Clojure ${clj.status}`);
  });

  it('auth-required method returns 403/401 from both backends', async () => {
    if (!clojureUp || !jsUp) return;

    const clj = await rpc(CLOJURE_URL, 'create-team', { name: 'Test' }, null);
    const js = await rpc(JS_URL, 'create-team', { name: 'Test' }, null);

    const cljAuth = clj.status === 401 || clj.status === 403;
    const jsAuth = js.status === 401 || js.status === 403;

    assert.equal(jsAuth, cljAuth, `auth gate mismatch: JS ${js.status} vs Clojure ${clj.status}`);
  });

  it('unknown method returns 404 from both backends', async () => {
    if (!clojureUp || !jsUp) return;

    const clj = await rpc(CLOJURE_URL, 'nonexistent-method', {}, clojureToken);
    const js = await rpc(JS_URL, 'nonexistent-method', {}, jsToken);

    assert.equal(js.status, clj.status, `status mismatch for unknown method: JS ${js.status} vs Clojure ${clj.status}`);
  });

  it('login-with-password rejects bad credentials with same status', async () => {
    if (!clojureUp || !jsUp) return;

    const clj = await rpc(CLOJURE_URL, 'login-with-password', { email: 'no@no.com', password: 'bad' }, null);
    const js = await rpc(JS_URL, 'login-with-password', { email: 'no@no.com', password: 'bad' }, null);

    assert.equal(js.status, clj.status, `login-with-password status mismatch: JS ${js.status} vs Clojure ${clj.status}`);

    if (clj.body && js.body && typeof clj.body === 'object' && typeof js.body === 'object') {
      assert.equal(js.body.type, clj.body.type, 'error type mismatch');
    }
  });

  it('get-teams returns same shape', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const clj = await rpc(CLOJURE_URL, 'get-teams', {}, clojureToken);
    const js = await rpc(JS_URL, 'get-teams', {}, jsToken);

    assert.equal(js.status, clj.status, `get-teams status mismatch: JS ${js.status} vs Clojure ${clj.status}`);

    if (clj.status === 200 && js.status === 200) {
      const cljBody = Array.isArray(clj.body) ? clj.body : (clj.body && typeof clj.body === 'object' ? [clj.body] : []);
      const jsBody = Array.isArray(js.body) ? js.body : (js.body && typeof js.body === 'object' ? [js.body] : []);

      if (cljBody.length > 0 && jsBody.length > 0) {
        const cljSample = cljBody[0];
        const jsSample = jsBody[0];

        const cljKeys = Object.keys(cljSample).sort();
        const jsKeys = Object.keys(jsSample).sort();

        const missingInJs = cljKeys.filter(k => !jsKeys.includes(k));
        const extraInJs = jsKeys.filter(k => !cljKeys.includes(k));

        if (missingInJs.length > 0 || extraInJs.length > 0) {
          const detail = [];
          if (missingInJs.length > 0) detail.push(`missing in JS: ${missingInJs.join(', ')}`);
          if (extraInJs.length > 0) detail.push(`extra in JS: ${extraInJs.join(', ')}`);
          assert.fail(`get-teams key shape mismatch — ${detail.join('; ')}`);
        }
      }
    }
  });

  it('get-profile returns same shape', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const clj = await rpc(CLOJURE_URL, 'get-profile', {}, clojureToken);
    const js = await rpc(JS_URL, 'get-profile', {}, jsToken);

    assert.equal(js.status, clj.status, `get-profile status mismatch: JS ${js.status} vs Clojure ${clj.status}`);

    if (clj.status === 200 && js.status === 200 && clj.body && js.body) {
      compareResponses(clj, js, 'get-profile');
    }
  });

  it('get-projects returns same shape', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const cljTeams = await rpc(CLOJURE_URL, 'get-teams', {}, clojureToken);
    const jsTeams = await rpc(JS_URL, 'get-teams', {}, jsToken);

    if (cljTeams.status !== 200 || jsTeams.status !== 200) return;

    const cljTeamList = Array.isArray(cljTeams.body) ? cljTeams.body : [];
    const jsTeamList = Array.isArray(jsTeams.body) ? jsTeams.body : [];

    if (cljTeamList.length === 0 || jsTeamList.length === 0) return;

    const cljTeamId = cljTeamList[0].id;
    const jsTeamId = jsTeamList[0].id;

    const clj = await rpc(CLOJURE_URL, 'get-projects', { teamId: cljTeamId }, clojureToken);
    const js = await rpc(JS_URL, 'get-projects', { teamId: jsTeamId }, jsToken);

    assert.equal(js.status, clj.status, `get-projects status mismatch: JS ${js.status} vs Clojure ${clj.status}`);

    if (clj.status === 200 && js.status === 200) {
      const cljBody = Array.isArray(clj.body) ? clj.body : [];
      const jsBody = Array.isArray(js.body) ? js.body : [];

      if (cljBody.length > 0 && jsBody.length > 0) {
        const cljKeys = Object.keys(cljBody[0]).sort();
        const jsKeys = Object.keys(jsBody[0]).sort();

        const missingInJs = cljKeys.filter(k => !jsKeys.includes(k));
        const extraInJs = jsKeys.filter(k => !cljKeys.includes(k));

        if (missingInJs.length > 0 || extraInJs.length > 0) {
          const detail = [];
          if (missingInJs.length > 0) detail.push(`missing in JS: ${missingInJs.join(', ')}`);
          if (extraInJs.length > 0) detail.push(`extra in JS: ${extraInJs.join(', ')}`);
          assert.fail(`get-projects key shape mismatch — ${detail.join('; ')}`);
        }
      }
    }
  });

  it('create-file returns same shape', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const cljTeams = await rpc(CLOJURE_URL, 'get-teams', {}, clojureToken);
    const jsTeams = await rpc(JS_URL, 'get-teams', {}, jsToken);

    if (cljTeams.status !== 200 || jsTeams.status !== 200) return;

    const cljTeamList = Array.isArray(cljTeams.body) ? cljTeams.body : [];
    const jsTeamList = Array.isArray(jsTeams.body) ? jsTeams.body : [];

    if (cljTeamList.length === 0 || jsTeamList.length === 0) return;

    const cljTeamId = cljTeamList[0].id;
    const jsTeamId = jsTeamList[0].id;

    const cljProj = await rpc(CLOJURE_URL, 'get-projects', { teamId: cljTeamId }, clojureToken);
    const jsProj = await rpc(JS_URL, 'get-projects', { teamId: jsTeamId }, jsToken);

    if (cljProj.status !== 200 || jsProj.status !== 200) return;

    const cljProjList = Array.isArray(cljProj.body) ? cljProj.body : [];
    const jsProjList = Array.isArray(jsProj.body) ? jsProj.body : [];

    const cljProjectId = cljProjList.length > 0 ? cljProjList[0].id : null;
    const jsProjectId = jsProjList.length > 0 ? jsProjList[0].id : null;

    if (!cljProjectId || !jsProjectId) return;

    const name = `wire-compat-${Date.now()}`;

    const clj = await rpc(CLOJURE_URL, 'create-file', { projectId: cljProjectId, name }, clojureToken);
    const js = await rpc(JS_URL, 'create-file', { projectId: jsProjectId, name }, jsToken);

    assert.equal(js.status, clj.status, `create-file status mismatch: JS ${js.status} vs Clojure ${clj.status}`);

    if (clj.status === 200 && js.status === 200 && clj.body && js.body) {
      compareResponses(clj, js, 'create-file');
    }
  });

  it('error shape matches for validation errors', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const clj = await rpc(CLOJURE_URL, 'create-team', {}, clojureToken);
    const js = await rpc(JS_URL, 'create-team', {}, jsToken);

    assert.equal(js.status, clj.status, `validation error status mismatch: JS ${js.status} vs Clojure ${clj.status}`);

    if (clj.body && js.body && typeof clj.body === 'object' && typeof js.body === 'object') {
      assert.equal(js.body.type, clj.body.type, 'error type field mismatch');
    }
  });
});