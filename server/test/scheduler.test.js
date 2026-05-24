import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registerTask, stopTaskScheduler } from '../src/tasks/scheduler.js';

describe('registerTask', () => {
  it('registers a task with handler and interval', () => {
    const called = [];
    registerTask('unit-test-task', () => called.push(1), 999999);
    assert.ok(called.length === 0);
  });
});

describe('stopTaskScheduler', () => {
  it('does not throw when no scheduler is running', () => {
    stopTaskScheduler();
  });
});