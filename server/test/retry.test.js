import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isRetryable, withRetry } from '../src/middleware/retry.js';
import { RpcError } from '../src/rpc/dispatcher.js';

describe('isRetryable', () => {
  it('returns true for SQLITE_CONSTRAINT_UNIQUE', () => {
    const err = new Error('unique violation');
    err.code = 'SQLITE_CONSTRAINT_UNIQUE';
    assert.equal(isRetryable(err), true);
  });

  it('returns true for errno 2067', () => {
    const err = new Error('constraint');
    err.errno = 2067;
    assert.equal(isRetryable(err), true);
  });

  it('returns true for RpcError with conflict-error code', () => {
    const err = new RpcError('conflict', 'conflict-error', 'Conflict');
    assert.equal(isRetryable(err), true);
  });

  it('returns false for generic Error', () => {
    assert.equal(isRetryable(new Error('generic')), false);
  });

  it('returns false for null', () => {
    assert.equal(isRetryable(null), false);
  });

  it('returns false for RpcError with other code', () => {
    const err = new RpcError('validation', 'validation-error', 'Bad');
    assert.equal(isRetryable(err), false);
  });
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const handler = async () => 42;
    const wrapped = withRetry(handler);
    const result = await wrapped({}, {});
    assert.equal(result, 42);
  });

  it('retries on retryable error and succeeds', async () => {
    let calls = 0;
    const handler = async () => {
      calls++;
      if (calls === 1) {
        const err = new Error('conflict');
        err.code = 'SQLITE_CONSTRAINT_UNIQUE';
        throw err;
      }
      return 'ok';
    };
    const wrapped = withRetry(handler, { maxRetries: 2 });
    const result = await wrapped({}, {});
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  });

  it('throws after max retries exhausted', async () => {
    const handler = async () => {
      const err = new Error('conflict');
      err.code = 'SQLITE_CONSTRAINT_UNIQUE';
      throw err;
    };
    const wrapped = withRetry(handler, { maxRetries: 2 });
    await assert.rejects(() => wrapped({}, {}), /conflict/);
  });

  it('does not retry non-retryable errors', async () => {
    let calls = 0;
    const handler = async () => {
      calls++;
      throw new Error('not retryable');
    };
    const wrapped = withRetry(handler, { maxRetries: 3 });
    await assert.rejects(() => wrapped({}, {}), /not retryable/);
    assert.equal(calls, 1);
  });

  it('supports custom when function', async () => {
    let calls = 0;
    const handler = async () => {
      calls++;
      if (calls < 3) throw new Error('retry-me');
      return 'done';
    };
    const wrapped = withRetry(handler, { maxRetries: 5, when: (err) => err.message === 'retry-me' });
    const result = await wrapped({}, {});
    assert.equal(result, 'done');
    assert.equal(calls, 3);
  });
});