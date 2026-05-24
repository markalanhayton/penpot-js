import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('metrics exports', async () => {
  const mod = await import('../src/metrics/index.js');

  it('exports register function', () => {
    assert.equal(typeof mod.registerMetricsEndpoint, 'function');
  });

  it('exports startRpcTimer function', () => {
    assert.equal(typeof mod.startRpcTimer, 'function');
  });

  it('exports startTaskTimer function', () => {
    assert.equal(typeof mod.startTaskTimer, 'function');
  });

  it('exports timing histograms', () => {
    assert.ok(mod.rpcMainTiming);
    assert.ok(mod.rpcManagementTiming);
    assert.ok(mod.tasksTiming);
    assert.ok(mod.httpDispatchTiming);
  });

  it('exports WebSocket counters', () => {
    assert.ok(mod.wsConnections);
    assert.ok(mod.wsMessages);
    assert.ok(mod.wsSessionTiming);
  });

  it('exports session and queue gauges', () => {
    assert.ok(mod.sessionUpdateTotal);
    assert.ok(mod.rpcClimitQueue);
    assert.ok(mod.rpcClimitPermits);
    assert.ok(mod.rpcClimitTiming);
  });

  it('exports file operation counters', () => {
    assert.ok(mod.updateFileChanges);
    assert.ok(mod.updateFileBytesProcessed);
  });

  it('startRpcTimer returns a timer function', () => {
    const endTimer = mod.startRpcTimer('get-file');
    assert.equal(typeof endTimer, 'function');
    endTimer();
  });

  it('startTaskTimer returns a timer function', () => {
    const endTimer = mod.startTaskTimer('session-gc');
    assert.equal(typeof endTimer, 'function');
    endTimer();
  });
});