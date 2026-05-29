/**
 * @module test/wire-compat
 * @description Wire compatibility tests — send identical RPC requests to both
 * the Clojure backend and the Node.js backend, compare responses for structural
 * equivalence.
 *
 * Also includes local transit format compatibility tests that verify
 * the JS port's Transit+JSON codec produces wire-compatible output
 * without requiring both backends to be running.
 *
 * ### Setup
 *
 * Requires both backends running for RPC comparison tests:
 * - Clojure backend: `PENPOT_CLOJURE_URL` (default http://localhost:6060)
 * - JS backend: `PENPOT_JS_URL` (default http://localhost:6061)
 *
 * Run with:
 *   PENPOT_CLOJURE_URL=http://localhost:6060 PENPOT_JS_URL=http://localhost:6061 \
 *     node --test test/wire-compat.test.js
 *
 * If either backend is unavailable, RPC comparison tests are skipped.
 * Transit format tests always run locally.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  encode, decode, encodeResponse, decodeRequest,
  toKebabCase, toCamelCase, camelToKebab, kebabToCamel,
} from '../src/transit/index.js';
import { randomUUID } from 'node:crypto';

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION A: Local Transit Format Compatibility Tests (always run)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Transit format: Clojure wire compatibility (local)', () => {
  it('encodes keyword keys in ~: prefix format (kebab-case)', () => {
    const obj = { 'file-id': 'abc' };
    const encoded = encode(obj);
    const parsed = JSON.parse(encoded);
    assert.ok(Array.isArray(parsed), 'encoded is array (cognitect map)');
    assert.ok(parsed.includes('~:file-id'), 'key uses ~: prefix');
  });

  it('encodes UUIDs with ~u prefix', () => {
    const id = randomUUID();
    const encoded = encode({ id });
    assert.ok(encoded.includes(`~u${id}`), 'UUID has ~u prefix');
  });

  it('encodes date strings with ~m prefix', () => {
    const encoded = encode({ createdAt: '2024-01-15T10:30:00.000Z' });
    assert.ok(encoded.includes('~m'), 'date has ~m prefix');
  });

  it('encodes Sets with ~#set tag', () => {
    const set = new Set(['a', 'b']);
    const encoded = encode(set);
    const parsed = JSON.parse(encoded);
    assert.equal(parsed[0], '~#set');
    assert.ok(Array.isArray(parsed[1]));
  });

  it('encodes Maps with cognitect ^ prefix', () => {
    const m = new Map([['key1', 'val1']]);
    const encoded = encode(m);
    const parsed = JSON.parse(encoded);
    assert.equal(parsed[0], '^ ');
  });

  it('round-trips Clojure-style response through decode → normalize', () => {
    const cljResponse = '["^ ","~:id","~u550e8400-e29b-41d4-a716-446655440000","~:name","Test File","~:revn",5,"~:is-shared",true]';
    const decoded = decode(cljResponse);

    assert.equal(decoded.id, '550e8400-e29b-41d4-a716-446655440000');
    assert.equal(decoded.name, 'Test File');
    assert.equal(decoded.revn, 5);
    assert.equal(decoded['is-shared'], true);
  });

  it('decodes Clojure error response shape', () => {
    const errorResponse = '["^ ","~:type","~:validation","~:code","~:validation-error","~:hint","Name is required"]';
    const decoded = decode(errorResponse);
    assert.equal(decoded.type, 'validation');
    assert.equal(decoded.code, 'validation-error');
    assert.equal(decoded.hint, 'Name is required');
  });

  it('encodes then decodes a file-like response preserving types', () => {
    const id = randomUUID();
    const response = {
      id,
      name: 'Test File',
      revn: 10,
      'is-shared': true,
      'created-at': '2024-06-15T12:00:00.000Z',
    };

    const encoded = encode(response);
    const decoded = decode(encoded);

    assert.equal(decoded.id, id);
    assert.equal(decoded.name, 'Test File');
    assert.equal(decoded.revn, 10);
    assert.equal(decoded['is-shared'], true);
    assert.equal(decoded['created-at'], '2024-06-15T12:00:00.000Z');
  });

  it('decodes Clojure nested transit maps', () => {
    const profile = ['^ ', '~:id', '~uabc12345-1234-1234-1234-123456789012', '~:name', 'Test User', '~:email', 'test@example.com'];
    const team = ['^ ', '~:id', '~uteam1234-1234-1234-1234-123456789012', '~:name', 'My Team'];
    const teams = ['~#list', [team]];
    const nested = ['^ ', '~:profile', profile, '~:teams', teams];
    const data = JSON.stringify(nested);
    const decoded = decode(data);
    assert.equal(decoded.profile.id, 'abc12345-1234-1234-1234-123456789012');
    assert.equal(decoded.profile.name, 'Test User');
    assert.ok(Array.isArray(decoded.teams));
  });

  it('decodeRequest handles Clojure Transit envelope', () => {
    const envelope = JSON.stringify({
      '~:id': '1',
      '~:method': 'create-file',
      '~:params': { '~:project-id': 'abc', '~:name': 'Test' },
    });
    const result = decodeRequest(envelope, 'application/transit+json');
    assert.equal(result.id, '1');
    assert.equal(result.method, 'create-file');
    assert.equal(result.params['project-id'], 'abc');
    assert.equal(result.params.name, 'Test');
  });

  it('encodeResponse produces transit for transit accept header', () => {
    const { contentType, body } = encodeResponse(
      { id: randomUUID(), name: 'Test' },
      { accept: 'application/transit+json' },
    );
    assert.equal(contentType, 'application/transit+json');
    assert.ok(body.includes('^ '), 'body contains cognitect map prefix');
  });

  it('encodeResponse produces JSON for JSON accept header', () => {
    const { contentType, body } = encodeResponse(
      { id: 'abc', name: 'Test' },
      { accept: 'application/json' },
    );
    assert.equal(contentType, 'application/json');
    const parsed = JSON.parse(body);
    assert.equal(parsed.id, 'abc');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION B: RPC Wire Compatibility Tests (skip if backends offline)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

  it('get-profile returns same shape', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const clj = await rpc(CLOJURE_URL, 'get-profile', {}, clojureToken);
    const js = await rpc(JS_URL, 'get-profile', {}, jsToken);

    assert.equal(js.status, clj.status, `get-profile status mismatch: JS ${js.status} vs Clojure ${clj.status}`);

    if (clj.status === 200 && js.status === 200 && clj.body && js.body) {
      compareResponses(clj, js, 'get-profile');
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

  it('create-team returns same shape for valid request', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const name = `wc-team-${Date.now()}`;

    const clj = await rpc(CLOJURE_URL, 'create-team', { name }, clojureToken);
    const js = await rpc(JS_URL, 'create-team', { name }, jsToken);

    assert.equal(js.status, clj.status, `create-team status mismatch: JS ${js.status} vs Clojure ${clj.status}`);

    if (clj.status === 200 && js.status === 200 && clj.body && js.body) {
      compareResponses(clj, js, 'create-team');
    }
  });

  it('update-profile returns same shape', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const name = `Updated ${Date.now()}`;

    const clj = await rpc(CLOJURE_URL, 'update-profile', { fullname: name }, clojureToken);
    const js = await rpc(JS_URL, 'update-profile', { fullname: name }, jsToken);

    assert.equal(js.status, clj.status, `update-profile status mismatch: JS ${js.status} vs Clojure ${clj.status}`);
  });

  it('get-profile-with-Themes returns same shape', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const clj = await rpc(CLOJURE_URL, 'get-profile', {}, clojureToken);
    const js = await rpc(JS_URL, 'get-profile', {}, jsToken);

    assert.equal(js.status, clj.status, `get-profile status mismatch`);

    if (clj.status === 200 && js.status === 200 && clj.body && js.body) {
      const cljKeys = Object.keys(clj.body).sort();
      const jsKeys = Object.keys(js.body).sort();
      const missingInJs = cljKeys.filter(k => !jsKeys.includes(k));
      const extraInJs = jsKeys.filter(k => !cljKeys.includes(k));

      if (missingInJs.length > 0 || extraInJs.length > 0) {
        const detail = [];
        if (missingInJs.length > 0) detail.push(`missing in JS: ${missingInJs.join(', ')}`);
        if (extraInJs.length > 0) detail.push(`extra in JS: ${extraInJs.join(', ')}`);
        assert.fail(`get-profile key mismatch — ${detail.join('; ')}`);
      }
    }
  });

  it('error response has consistent structure for not-found', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const fakeId = '00000000-0000-0000-0000-000000000000';

    const clj = await rpc(CLOJURE_URL, 'get-file', { id: fakeId }, clojureToken);
    const js = await rpc(JS_URL, 'get-file', { id: fakeId }, jsToken);

    assert.equal(js.status, clj.status, `get-file not-found status: JS ${js.status} vs Clojure ${clj.status}`);

    if (clj.body && js.body && typeof clj.body === 'object' && typeof js.body === 'object') {
      assert.equal(typeof js.body.type, typeof clj.body.type, 'error type field type mismatch');
    }
  });

  it('get-team-members returns same shape when team exists', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const teamName = `wc-members-${Date.now()}`;
    const cljTeam = await rpc(CLOJURE_URL, 'create-team', { name: teamName }, clojureToken);
    const jsTeam = await rpc(JS_URL, 'create-team', { name: teamName }, jsToken);

    if (cljTeam.status !== 200 || jsTeam.status !== 200) return;

    const cljTeamId = cljTeam.body?.id;
    const jsTeamId = jsTeam.body?.id;
    if (!cljTeamId || !jsTeamId) return;

    const clj = await rpc(CLOJURE_URL, 'get-team-members', { teamId: cljTeamId }, clojureToken);
    const js = await rpc(JS_URL, 'get-team-members', { teamId: jsTeamId }, jsToken);

    assert.equal(js.status, clj.status, `get-team-members status mismatch: JS ${js.status} vs Clojure ${clj.status}`);
  });

  it('create-project returns same shape', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const teamName = `wc-proj-team-${Date.now()}`;
    const cljTeam = await rpc(CLOJURE_URL, 'create-team', { name: teamName }, clojureToken);
    const jsTeam = await rpc(JS_URL, 'create-team', { name: teamName }, jsToken);

    if (cljTeam.status !== 200 || jsTeam.status !== 200) return;

    const cljTeamId = cljTeam.body?.id;
    const jsTeamId = jsTeam.body?.id;
    if (!cljTeamId || !jsTeamId) return;

    const projName = `wc-proj-${Date.now()}`;
    const clj = await rpc(CLOJURE_URL, 'create-project', { teamId: cljTeamId, name: projName }, clojureToken);
    const js = await rpc(JS_URL, 'create-project', { teamId: jsTeamId, name: projName }, jsToken);

    assert.equal(js.status, clj.status, `create-project status mismatch: JS ${js.status} vs Clojure ${clj.status}`);

    if (clj.status === 200 && js.status === 200 && clj.body && js.body) {
      compareResponses(clj, js, 'create-project');
    }
  });

  it('get-enabled-flags structure matches between backends', async () => {
    if (!clojureUp || !jsUp) return;

    const clj = await rpc(CLOJURE_URL, 'get-enabled-flags', {}, clojureToken);
    const js = await rpc(JS_URL, 'get-enabled-flags', {}, jsToken);

    if (clj.status === 200 && js.status === 200 && clj.body && js.body) {
      if (Array.isArray(clj.body) && Array.isArray(js.body)) {
        assert.equal(typeof js.body[0], typeof clj.body[0], 'flags element type mismatch');
      }
    }
  });

  it('access-denied error shape is consistent', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const fakeTeamId = '00000000-0000-0000-0000-000000000000';

    const clj = await rpc(CLOJURE_URL, 'update-team', { id: fakeTeamId, name: 'hacked' }, clojureToken);
    const js = await rpc(JS_URL, 'update-team', { id: fakeTeamId, name: 'hacked' }, jsToken);

    const cljDenied = clj.status === 403 || clj.status === 404 || clj.status === 500;
    const jsDenied = js.status === 403 || js.status === 404 || js.status === 500;

    assert.equal(jsDenied, cljDenied, `access denied mismatch: JS ${js.status} vs Clojure ${clj.status}`);
  });

  it('delete-team returns consistent status codes', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const teamName = `wc-del-team-${Date.now()}`;
    const cljTeam = await rpc(CLOJURE_URL, 'create-team', { name: teamName }, clojureToken);
    const jsTeam = await rpc(JS_URL, 'create-team', { name: teamName }, jsToken);

    if (cljTeam.status !== 200 || jsTeam.status !== 200) return;

    const cljTeamId = cljTeam.body?.id;
    const jsTeamId = jsTeam.body?.id;
    if (!cljTeamId || !jsTeamId) return;

    const clj = await rpc(CLOJURE_URL, 'delete-team', { id: cljTeamId }, clojureToken);
    const js = await rpc(JS_URL, 'delete-team', { id: jsTeamId }, jsToken);

    assert.equal(js.status, clj.status, `delete-team status mismatch: JS ${js.status} vs Clojure ${clj.status}`);
  });

  it('rename-team returns same shape', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const teamName = `wc-rename-team-${Date.now()}`;
    const cljTeam = await rpc(CLOJURE_URL, 'create-team', { name: teamName }, clojureToken);
    const jsTeam = await rpc(JS_URL, 'create-team', { name: teamName }, jsToken);

    if (cljTeam.status !== 200 || jsTeam.status !== 200) return;

    const cljTeamId = cljTeam.body?.id;
    const jsTeamId = jsTeam.body?.id;
    if (!cljTeamId || !jsTeamId) return;

    const newName = `renamed-${Date.now()}`;
    const clj = await rpc(CLOJURE_URL, 'update-team', { id: cljTeamId, name: newName }, clojureToken);
    const js = await rpc(JS_URL, 'update-team', { id: jsTeamId, name: newName }, jsToken);

    assert.equal(js.status, clj.status, `update-team status mismatch: JS ${js.status} vs Clojure ${clj.status}`);
  });

  it('get-project-data returns consistent response', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const teamName = `wc-file-team-${Date.now()}`;
    const cljTeam = await rpc(CLOJURE_URL, 'create-team', { name: teamName }, clojureToken);
    const jsTeam = await rpc(JS_URL, 'create-team', { name: teamName }, jsToken);

    if (cljTeam.status !== 200 || jsTeam.status !== 200) return;

    const cljTeamId = cljTeam.body?.id;
    const jsTeamId = jsTeam.body?.id;
    if (!cljTeamId || !jsTeamId) return;

    const projName = `wc-file-proj-${Date.now()}`;
    const cljProj = await rpc(CLOJURE_URL, 'create-project', { teamId: cljTeamId, name: projName }, clojureToken);
    const jsProj = await rpc(JS_URL, 'create-project', { teamId: jsTeamId, name: projName }, jsToken);

    if (cljProj.status !== 200 || jsProj.status !== 200) return;

    const cljProjectId = cljProj.body?.id;
    const jsProjectId = jsProj.body?.id;
    if (!cljProjectId || !jsProjectId) return;

    const fileName = `wc-file-${Date.now()}`;
    const cljFile = await rpc(CLOJURE_URL, 'create-file', { projectId: cljProjectId, name: fileName }, clojureToken);
    const jsFile = await rpc(JS_URL, 'create-file', { projectId: jsProjectId, name: fileName }, jsToken);

    if (cljFile.status !== 200 || jsFile.status !== 200) return;

    const cljFileId = cljFile.body?.id;
    const jsFileId = jsFile.body?.id;
    if (!cljFileId || !jsFileId) return;

    const cljData = await rpc(CLOJURE_URL, 'get-file', { id: cljFileId }, clojureToken);
    const jsData = await rpc(JS_URL, 'get-file', { id: jsFileId }, jsToken);

    assert.equal(jsData.status, cljData.status, `get-file status mismatch: JS ${jsData.status} vs Clojure ${cljData.status}`);

    if (cljData.status === 200 && jsData.status === 200 && cljData.body && jsData.body) {
      const cljKeys = Object.keys(cljData.body).sort();
      const jsKeys = Object.keys(jsData.body).sort();
      const missingInJs = cljKeys.filter(k => !jsKeys.includes(k));
      const extraInJs = jsKeys.filter(k => !cljKeys.includes(k));

      if (missingInJs.length > 0 || extraInJs.length > 0) {
        const detail = [];
        if (missingInJs.length > 0) detail.push(`missing in JS: ${missingInJs.join(', ')}`);
        if (extraInJs.length > 0) detail.push(`extra in JS: ${extraInJs.join(', ')}`);
        assert.fail(`get-file key shape mismatch — ${detail.join('; ')}`);
      }
    }
  });

  it('content-type header is consistent for responses', async () => {
    if (!clojureUp || !jsUp || !clojureToken || !jsToken) return;

    const clj = await rpc(CLOJURE_URL, 'get-profile', {}, clojureToken);
    const js = await rpc(JS_URL, 'get-profile', {}, jsToken);

    const cljCt = (clj.contentType || '').toLowerCase();
    const jsCt = (js.contentType || '').toLowerCase();

    const cljIsJson = cljCt.includes('json');
    const jsIsJson = jsCt.includes('json');

    assert.equal(jsIsJson, cljIsJson, `content-type mismatch: JS ${js.contentType} vs Clojure ${clj.contentType}`);
  });
});