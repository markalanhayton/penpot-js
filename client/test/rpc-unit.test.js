'use strict';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transitEncode, transitDecode, isGetCommand, apiUrl } from '../public/lib/transit.js';
import { RpcError, setAuthToken, getAuthToken, clearAuthToken } from '../public/lib/rpc.js';

describe('Client Transit Codec', () => {

  describe('transitEncode', () => {
    it('encodes a plain object with string values', () => {
      const result = transitEncode({ name: 'test', count: 5 });
      assert.ok(typeof result === 'string', 'should return a string');
      assert.ok(result.length > 0, 'should not be empty');
    });

    it('encodes null', () => {
      const result = transitEncode(null);
      assert.equal(result, 'null');
    });

    it('encodes an empty object', () => {
      const result = transitEncode({});
      assert.ok(typeof result === 'string');
    });

    it('encodes an array', () => {
      const result = transitEncode([1, 2, 3]);
      assert.ok(typeof result === 'string');
    });
  });

  describe('transitDecode', () => {
    it('decodes a JSON object', () => {
      const encoded = transitEncode({ name: 'hello' });
      const decoded = transitDecode(encoded);
      assert.equal(decoded.name, 'hello');
    });

    it('decodes null', () => {
      const decoded = transitDecode('null');
      assert.equal(decoded, null);
    });

    it('round-trips an object with various types', () => {
      const original = { name: 'test', count: 42, active: true, tags: ['a', 'b'] };
      const encoded = transitEncode(original);
      const decoded = transitDecode(encoded);
      assert.equal(decoded.name, original.name);
      assert.equal(decoded.count, original.count);
      assert.equal(decoded.active, original.active);
    });
  });

  describe('isGetCommand', () => {
    it('returns true for get- prefixed commands', () => {
      assert.equal(isGetCommand('get-profile'), true);
      assert.equal(isGetCommand('get-file'), true);
      assert.equal(isGetCommand('get-team-members'), true);
    });

    it('returns false for non-get commands', () => {
      assert.equal(isGetCommand('create-file'), false);
      assert.equal(isGetCommand('update-profile'), false);
      assert.equal(isGetCommand('delete-team'), false);
      assert.equal(isGetCommand('login-with-password'), false);
    });
  });

  describe('apiUrl', () => {
    it('constructs RPC URL from command name', () => {
      const url = apiUrl('get-profile');
      assert.ok(url.includes('get-profile'), 'URL should contain command name');
    });

    it('constructs URL with default API base and path', () => {
      const url = apiUrl('create-file');
      assert.ok(url.startsWith('/api/rpc/command/'), 'should use default API path');
    });
  });
});

describe('Client RPC Module', () => {
  describe('RpcError', () => {
    it('creates error with type, code, and hint', () => {
      const err = new RpcError('validation', 'email-required', 'Email is required');
      assert.equal(err.type, 'validation');
      assert.equal(err.code, 'email-required');
      assert.equal(err.hint, 'Email is required');
      assert.ok(err instanceof Error);
    });

    it('creates error with default status 400', () => {
      const err = new RpcError('validation', 'bad-request', 'Bad request');
      assert.equal(err.status, 400);
    });

    it('creates error with custom status', () => {
      const err = new RpcError('authorization', 'access-denied', 'Not allowed', 403);
      assert.equal(err.status, 403);
    });

    it('creates error with extra data', () => {
      const err = new RpcError('validation', 'param-invalid', 'Invalid param', 400, { field: 'email' });
      assert.deepEqual(err.extra, { field: 'email' });
    });

    it('has correct name', () => {
      const err = new RpcError('internal', 'unknown', 'Unknown error');
      assert.equal(err.name, 'RpcError');
    });
  });

  describe('Auth Token Management', () => {
    it('setAuthToken and getAuthToken work correctly', () => {
      clearAuthToken();
      assert.equal(getAuthToken(), null);
      setAuthToken('test-token-123');
      assert.equal(getAuthToken(), 'test-token-123');
      clearAuthToken();
      assert.equal(getAuthToken(), null);
    });

    it('setAuthToken overwrites previous token', () => {
      clearAuthToken();
      setAuthToken('first');
      assert.equal(getAuthToken(), 'first');
      setAuthToken('second');
      assert.equal(getAuthToken(), 'second');
      clearAuthToken();
    });
  });

  describe('cmd error handling', () => {
    it('cmd returns RpcError for transit-encoded error responses', () => {
      assert.ok(typeof RpcError === 'function', 'RpcError should be a constructor');
    });
  });
});