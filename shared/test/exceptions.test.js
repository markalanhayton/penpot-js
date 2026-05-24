import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PenpotError, error, raise, isError, isException,
  ignoring, tryExpr, instanceOf, getHint, firstLine,
  formatThrowable, printThrowable,
} from '../src/exceptions.js';

describe('exceptions', () => {
  it('error() creates a PenpotError', () => {
    const err = error('not-found', { hint: 'Resource not found' });
    assert.ok(err instanceof PenpotError);
    assert.ok(err instanceof Error);
    assert.equal(err.data.type, 'not-found');
  });

  it('raise() throws a PenpotError', () => {
    assert.throws(() => {
      raise('forbidden', { hint: 'Access denied' });
    }, (err) => {
      assert.ok(err instanceof PenpotError);
      assert.equal(err.data.type, 'forbidden');
      return true;
    });
  });

  it('isError() checks for PenpotError', () => {
    assert.ok(isError(new PenpotError('test')));
    assert.ok(!isError(new Error('plain')));
  });

  it('isException() checks for any Error', () => {
    assert.ok(isException(new Error('any')));
    assert.ok(isException(new PenpotError('any')));
    assert.ok(!isException('string'));
  });

  it('ignoring() swallows exceptions', () => {
    let result = ignoring(() => { throw new Error('boom'); });
    assert.equal(result, undefined);
  });

  it('tryExpr() returns result on success', () => {
    const result = tryExpr(() => 42);
    assert.equal(result, 42);
  });

  it('tryExpr() rethrows on failure by default', () => {
    assert.throws(() => {
      tryExpr(() => { throw new Error('boom'); });
    });
  });

  it('tryExpr() calls onException on failure', () => {
    const result = tryExpr(() => { throw new Error('boom'); }, {
      onException: (ex) => ex.message,
    });
    assert.equal(result, 'boom');
  });

  it('instanceOf() walks cause chain', () => {
    const root = new Error('root');
    const middle = new PenpotError('middle', {}, root);
    const top = new PenpotError('top', {}, middle);

    assert.ok(instanceOf(PenpotError, top) === top);
    assert.ok(instanceOf(PenpotError, middle) === middle);
    assert.equal(instanceOf(PenpotError, root), null);
  });

  it('getHint() extracts hint from PenpotError', () => {
    const err = new PenpotError('test message', { type: 'test', hint: 'Something went wrong' });
    assert.equal(getHint(err), 'Something went wrong');
  });

  it('getHint() falls back to message', () => {
    const err = new Error('fallback message');
    assert.equal(getHint(err), 'fallback message');
  });

  it('firstLine() returns text before newline', () => {
    assert.equal(firstLine('line1\nline2'), 'line1');
    assert.equal(firstLine('no newline'), 'no newline');
  });

  it('formatThrowable() produces a string', () => {
    const err = new PenpotError('test', { type: 'test' });
    const formatted = formatThrowable(err);
    assert.ok(typeof formatted === 'string');
    assert.ok(formatted.includes('===================='));
  });
});