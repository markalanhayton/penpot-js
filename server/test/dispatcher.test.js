import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RpcError, errors, registerMethod, getRegisteredMethods } from '../src/rpc/dispatcher.js';

describe('RpcError', () => {
  it('constructs with type, code, hint', () => {
    const err = new RpcError('not-found', 'object-not-found', 'File not found');
    assert.equal(err.type, 'not-found');
    assert.equal(err.code, 'object-not-found');
    assert.equal(err.hint, 'File not found');
    assert.ok(err instanceof Error);
  });

  it('includes extra properties', () => {
    const err = new RpcError('validation', 'bad-input', 'Invalid', { field: 'name' });
    assert.deepEqual(err.toJSON(), {
      type: 'validation',
      code: 'bad-input',
      hint: 'Invalid',
      field: 'name',
    });
  });

  it('toJSON produces a plain object', () => {
    const err = new RpcError('conflict', 'revn-conflict', 'Conflict');
    const json = err.toJSON();
    assert.equal(typeof json, 'object');
    assert.equal(json.type, 'conflict');
  });
});

describe('errors factory', () => {
  it('creates notFound error', () => {
    const err = errors.notFound('gone');
    assert.equal(err.type, 'not-found');
    assert.equal(err.hint, 'gone');
  });

  it('creates validation error', () => {
    const err = errors.validation('bad data');
    assert.equal(err.type, 'validation');
  });

  it('creates authorization error', () => {
    const err = errors.authorization('denied');
    assert.equal(err.type, 'authorization');
  });

  it('creates conflict error', () => {
    const err = errors.conflict('already exists');
    assert.equal(err.type, 'conflict');
  });

  it('creates internal error', () => {
    const err = errors.internal('oops');
    assert.equal(err.type, 'internal');
  });

  it('creates authentication error', () => {
    const err = errors.authentication('login required');
    assert.equal(err.type, 'authentication');
  });
});

describe('registerMethod / getRegisteredMethods', () => {
  it('registers a method and retrieves it', () => {
    registerMethod('test-method-for-unit-test', {
      auth: true,
      added: '2.0',
      handler: async () => 'ok',
    });

    const methods = new Map(getRegisteredMethods());
    assert.ok(methods.has('test-method-for-unit-test'));

    const def = methods.get('test-method-for-unit-test');
    assert.equal(def.auth, true);
    assert.equal(def.added, '2.0');
  });

  it('defaults auth to true', () => {
    registerMethod('test-method-default-auth', {
      handler: async () => null,
    });
    const methods = new Map(getRegisteredMethods());
    assert.equal(methods.get('test-method-default-auth').auth, true);
  });

  it('allows auth: false', () => {
    registerMethod('test-method-no-auth', {
      auth: false,
      handler: async () => null,
    });
    const methods = new Map(getRegisteredMethods());
    assert.equal(methods.get('test-method-no-auth').auth, false);
  });
});