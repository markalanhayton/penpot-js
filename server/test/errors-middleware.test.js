import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RpcError } from '../src/rpc/dispatcher.js';
import { errorTypeToStatus, sendError, errorHandler, requestContextMiddleware } from '../src/middleware/errors.js';

describe('errorTypeToStatus', () => {
  it('maps authentication to 401', () => {
    assert.equal(errorTypeToStatus('authentication'), 401);
  });

  it('maps authorization to 403', () => {
    assert.equal(errorTypeToStatus('authorization'), 403);
  });

  it('maps not-found to 404', () => {
    assert.equal(errorTypeToStatus('not-found'), 404);
  });

  it('maps restriction with method-not-allowed to 405', () => {
    assert.equal(errorTypeToStatus('restriction', 'method-not-allowed'), 405);
  });

  it('maps restriction without code to 400', () => {
    assert.equal(errorTypeToStatus('restriction'), 400);
  });

  it('maps rate-limit to 429', () => {
    assert.equal(errorTypeToStatus('rate-limit'), 429);
  });

  it('maps concurrency-limit to 429', () => {
    assert.equal(errorTypeToStatus('concurrency-limit'), 429);
  });

  it('maps validation with no code to 400', () => {
    assert.equal(errorTypeToStatus('validation'), 400);
  });

  it('maps validation with vern-conflict to 409', () => {
    assert.equal(errorTypeToStatus('validation', 'vern-conflict'), 409);
  });

  it('maps validation with request-body-too-large to 413', () => {
    assert.equal(errorTypeToStatus('validation', 'request-body-too-large'), 413);
  });

  it('maps assertion to 500', () => {
    assert.equal(errorTypeToStatus('assertion'), 500);
  });

  it('maps internal to 500', () => {
    assert.equal(errorTypeToStatus('internal'), 500);
  });

  it('maps conflict to 409', () => {
    assert.equal(errorTypeToStatus('conflict'), 409);
  });

  it('maps unknown type to 500', () => {
    assert.equal(errorTypeToStatus('unknown-type'), 500);
  });
});

describe('errorHandler', () => {
  it('handles RpcError with correct status and body', () => {
    const err = new RpcError('authentication', 'auth-required', 'Authentication required');
    let sentCode;
    let sentBody;
    const reply = {
      code(status) { sentCode = status; return reply; },
      send(body) { sentBody = body; return reply; },
    };
    errorHandler(err, {}, reply);
    assert.equal(sentCode, 401);
    assert.equal(sentBody.type, 'authentication');
    assert.equal(sentBody.code, 'auth-required');
    assert.equal(sentBody.hint, 'Authentication required');
  });

  it('handles RpcError with extra fields', () => {
    const err = new RpcError('validation', 'invalid-input', 'Bad input', { field: 'email' });
    let sentBody;
    const reply = {
      code() { return reply; },
      send(body) { sentBody = body; return reply; },
    };
    errorHandler(err, {}, reply);
    assert.equal(sentBody.field, 'email');
  });

  it('handles Fastify 413 body-too-large error', () => {
    const err = new Error('too big');
    err.statusCode = 413;
    let sentCode;
    let sentBody;
    const reply = {
      code(status) { sentCode = status; return reply; },
      send(body) { sentBody = body; return reply; },
    };
    errorHandler(err, {}, reply);
    assert.equal(sentCode, 413);
    assert.equal(sentBody.type, 'validation');
    assert.equal(sentBody.code, 'request-body-too-large');
  });

  it('handles Fastify 404 route-not-found error', () => {
    const err = new Error('not found');
    err.statusCode = 404;
    let sentCode;
    let sentBody;
    const reply = {
      code(status) { sentCode = status; return reply; },
      send(body) { sentBody = body; return reply; },
    };
    errorHandler(err, {}, reply);
    assert.equal(sentCode, 404);
    assert.equal(sentBody.type, 'not-found');
    assert.equal(sentBody.code, 'route-not-found');
  });

  it('handles restriction rate-limit-exceeded error', () => {
    const err = new Error('slow down');
    err.type = 'restriction';
    err.code = 'rate-limit-exceeded';
    err.hint = 'Too many requests';
    let sentCode;
    let sentBody;
    const reply = {
      code(status) { sentCode = status; return reply; },
      send(body) { sentBody = body; return reply; },
    };
    errorHandler(err, {}, reply);
    assert.equal(sentCode, 429);
    assert.equal(sentBody.code, 'rate-limit-exceeded');
  });

  it('handles unhandled errors as 500', () => {
    const err = new Error('something broke');
    let sentCode;
    let sentBody;
    const reply = {
      code(status) { sentCode = status; return reply; },
      send(body) { sentBody = body; return reply; },
    };
    errorHandler(err, {}, reply);
    assert.equal(sentCode, 500);
    assert.equal(sentBody.type, 'server-error');
    assert.equal(sentBody.hint, 'something broke');
  });
});

describe('sendError', () => {
  it('sends structured error response', () => {
    let sentCode;
    let sentBody;
    const reply = {
      code(status) { sentCode = status; return reply; },
      send(body) { sentBody = body; return reply; },
    };
    sendError(reply, 'not-found', 'object-not-found', 'File not found');
    assert.equal(sentCode, 404);
    assert.equal(sentBody.type, 'not-found');
    assert.equal(sentBody.code, 'object-not-found');
    assert.equal(sentBody.hint, 'File not found');
  });

  it('includes extra properties', () => {
    let sentBody;
    const reply = {
      code() { return reply; },
      send(body) { sentBody = body; return reply; },
    };
    sendError(reply, 'validation', 'invalid', 'Bad', { fileId: 'abc' });
    assert.equal(sentBody.fileId, 'abc');
  });
});

describe('requestContextMiddleware', () => {
  it('attaches errorContext to request', () => {
    const req = { method: 'GET', url: '/api/rpc', ip: '10.0.0.1', headers: { 'user-agent': 'TestBot' }, auth: { profileId: 'p1' } };
    let doneCalled = false;
    requestContextMiddleware(req, {}, () => { doneCalled = true; });
    assert.ok(req.errorContext);
    assert.equal(req.errorContext.method, 'GET');
    assert.equal(req.errorContext.path, '/api/rpc');
    assert.equal(req.errorContext.profileId, 'p1');
    assert.ok(doneCalled);
  });
});