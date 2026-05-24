import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('telemetry exports', async () => {
  const mod = await import('../src/tasks/telemetry.js');

  it('exports runTelemetryTask', () => {
    assert.equal(typeof mod.runTelemetryTask, 'function');
  });
});