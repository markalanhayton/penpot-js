import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('task worker exports', async () => {
  const mod = await import('../src/tasks/worker.js');

  it('exports registerHandler', () => {
    assert.equal(typeof mod.registerHandler, 'function');
  });

  it('exports submitTask', () => {
    assert.equal(typeof mod.submitTask, 'function');
  });

  it('exports startWorker', () => {
    assert.equal(typeof mod.startWorker, 'function');
  });

  it('exports stopWorker', () => {
    assert.equal(typeof mod.stopWorker, 'function');
  });
});