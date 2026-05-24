import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withConditional } from '../src/middleware/cond.js';

describe('withConditional', () => {
  it('passes through when no keyFn provided', async () => {
    const handler = async () => ({ id: 'abc', revn: 5 });
    const wrapped = withConditional(handler);
    const result = await wrapped({}, {});
    assert.equal(result.id, 'abc');
  });

  it('returns result when conditional-exec is disabled (default)', async () => {
    const handler = async () => ({ id: 'abc', revn: 5 });
    const wrapped = withConditional(handler, {
      keyFn: (r) => `${r.revn}`,
    });
    const result = await wrapped({}, {});
    assert.equal(result.id, 'abc');
    assert.equal(result.revn, 5);
  });

  it('returns handler result unchanged (flag off)', async () => {
    const handler = async () => ({ name: 'test' });
    const wrapped = withConditional(handler, { keyFn: (r) => r.name });
    const result = await wrapped({}, {});
    assert.equal(result.name, 'test');
  });

  it('returns result when keyFn throws', async () => {
    const handler = async () => ({ data: 'hello' });
    const wrapped = withConditional(handler, {
      keyFn: () => { throw new Error('key fail'); },
    });
    const result = await wrapped({}, {});
    assert.equal(result.data, 'hello');
  });
});