import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('WebSocket notifications exports', async () => {
  const mod = await import('../src/ws/notifications.js');

  it('exports broadcast function', () => {
    assert.equal(typeof mod.broadcast, 'function');
  });

  it('exports setupWebSocket function', () => {
    assert.equal(typeof mod.setupWebSocket, 'function');
  });
});

describe('Message bus', async () => {
  const { createMsgBus } = await import('../src/ws/msgbus.js');

  it('createMsgBus returns publish, subscribe, unsubscribe, close', () => {
    const bus = createMsgBus();
    assert.equal(typeof bus.publish, 'function');
    assert.equal(typeof bus.subscribe, 'function');
    assert.equal(typeof bus.unsubscribe, 'function');
    assert.equal(typeof bus.close, 'function');
  });

  it('publishes messages to subscribers', () => {
    const bus = createMsgBus();
    const received = [];
    bus.subscribe('test-topic', (msg) => received.push(msg));
    bus.publish('test-topic', { value: 42 });
    assert.deepEqual(received, [{ value: 42 }]);
  });

  it('unsubscribe removes a subscriber', () => {
    const bus = createMsgBus();
    const received = [];
    const unsub = bus.subscribe('test-topic', (msg) => received.push(msg));
    unsub();
    bus.publish('test-topic', { value: 99 });
    assert.deepEqual(received, []);
  });

  it('unsubscribe(topic, callback) removes a specific subscriber', () => {
    const bus = createMsgBus();
    const received = [];
    const cb = (msg) => received.push(msg);
    bus.subscribe('test-topic', cb);
    bus.unsubscribe('test-topic', cb);
    bus.publish('test-topic', { value: 1 });
    assert.deepEqual(received, []);
  });

  it('multiple subscribers receive messages', () => {
    const bus = createMsgBus();
    const a = [], b = [];
    bus.subscribe('multi', (msg) => a.push(msg));
    bus.subscribe('multi', (msg) => b.push(msg));
    bus.publish('multi', { x: 1 });
    assert.deepEqual(a, [{ x: 1 }]);
    assert.deepEqual(b, [{ x: 1 }]);
  });

  it('close clears all subscriptions', () => {
    const bus = createMsgBus();
    const received = [];
    bus.subscribe('close-test', (msg) => received.push(msg));
    bus.close();
    bus.publish('close-test', { value: 0 });
    assert.deepEqual(received, []);
  });
});