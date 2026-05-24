import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkSecFetchSite, checkClientHeader, validateSharedKey } from '../src/middleware/auth.js';

describe('checkSecFetchSite', () => {
  it('allows same-origin requests', () => {
    const req = { headers: { 'sec-fetch-site': 'same-origin' }, method: 'POST' };
    assert.equal(checkSecFetchSite(req, {}), true);
  });

  it('allows same-site requests', () => {
    const req = { headers: { 'sec-fetch-site': 'same-site' }, method: 'POST' };
    assert.equal(checkSecFetchSite(req, {}), true);
  });

  it('allows none (non-browser)', () => {
    const req = { headers: { 'sec-fetch-site': 'none' }, method: 'POST' };
    assert.equal(checkSecFetchSite(req, {}), true);
  });

  it('allows cross-site GET', () => {
    const req = { headers: { 'sec-fetch-site': 'cross-site' }, method: 'GET' };
    assert.equal(checkSecFetchSite(req, {}), true);
  });

  it('blocks cross-site POST', () => {
    const req = { headers: { 'sec-fetch-site': 'cross-site' }, method: 'POST' };
    assert.equal(checkSecFetchSite(req, {}), false);
  });

  it('allows when header is absent', () => {
    const req = { headers: {}, method: 'POST' };
    assert.equal(checkSecFetchSite(req, {}), true);
  });
});

describe('checkClientHeader', () => {
  it('allows safe methods without header', () => {
    assert.equal(checkClientHeader({ method: 'GET', headers: {} }), true);
    assert.equal(checkClientHeader({ method: 'HEAD', headers: {} }), true);
    assert.equal(checkClientHeader({ method: 'OPTIONS', headers: {} }), true);
  });

  it('allows POST with X-Client header', () => {
    assert.equal(checkClientHeader({ method: 'POST', headers: { 'x-client': 'frontend' } }), true);
  });

  it('blocks POST without X-Client when api-doc is enabled', () => {
    assert.equal(checkClientHeader({ method: 'POST', headers: {} }), false);
  });
});

describe('validateSharedKey', () => {
  it('allows when no expected key is set', () => {
    const prev = process.env.PENPOT_MANAGEMENT_SHARED_KEY;
    delete process.env.PENPOT_MANAGEMENT_SHARED_KEY;
    const result = validateSharedKey({ headers: {} });
    if (prev) process.env.PENPOT_MANAGEMENT_SHARED_KEY = prev;
    assert.equal(result, true);
  });

  it('rejects when expected key does not match', () => {
    const prev = process.env.PENPOT_MANAGEMENT_SHARED_KEY;
    process.env.PENPOT_MANAGEMENT_SHARED_KEY = 'my-secret';
    const result = validateSharedKey({ headers: { 'x-shared-key': 'wrong' } });
    if (prev !== undefined) process.env.PENPOT_MANAGEMENT_SHARED_KEY = prev;
    else delete process.env.PENPOT_MANAGEMENT_SHARED_KEY;
    assert.equal(result, false);
  });

  it('allows when expected key matches', () => {
    const prev = process.env.PENPOT_MANAGEMENT_SHARED_KEY;
    process.env.PENPOT_MANAGEMENT_SHARED_KEY = 'my-secret';
    const result = validateSharedKey({ headers: { 'x-shared-key': 'my-secret' } });
    if (prev !== undefined) process.env.PENPOT_MANAGEMENT_SHARED_KEY = prev;
    else delete process.env.PENPOT_MANAGEMENT_SHARED_KEY;
    assert.equal(result, true);
  });
});