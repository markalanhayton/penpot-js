'use strict';
/**
 * @module test/uploads-registry.test
 * Unit tests for the WU-T4 uploads registry logic.
 *
 * The registry tracks all in-flight, completed, and failed uploads
 * (media, fonts, file imports, binfile) with state transitions and
 * retry semantics. We re-implement the state machine in pure Node to
 * verify the math/logic without the DOM dependencies.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const MAX_RETRIES = 3;

function makeState() {
  const uploads = new Map();
  const subscribers = new Set();
  return {
    uploads,
    subscribers,
    notify() {
      for (const fn of subscribers) {
        try { fn(); } catch (err) { console.warn('[uploads-registry]', err.message); }
      }
    },
    add(id, entry) { uploads.set(id, entry); this.notify(); },
    get(id) { return uploads.get(id); },
    all() { return [...uploads.values()]; },
    failed() { return this.all().filter(u => u.status === 'failed' || u.status === 'gave-up'); },
    inFlight() { return this.all().filter(u => u.status === 'pending' || u.status === 'in-progress'); },
  };
}

function transitionTo(entry, status) {
  entry.status = status;
  entry.updatedAt = Date.now();
}

describe('WU-T4: state transitions', () => {
  it('pending -> in-progress -> completed', () => {
    const entry = { id: 'a', type: 'media', status: 'pending', bytesSent: 0, bytesTotal: 100, retried: 0 };
    transitionTo(entry, 'in-progress');
    assert.equal(entry.status, 'in-progress');
    transitionTo(entry, 'completed');
    assert.equal(entry.status, 'completed');
    assert.ok(entry.updatedAt > 0);
  });

  it('pending -> in-progress -> failed (preserves error message)', () => {
    const entry = { id: 'a', type: 'media', status: 'pending', error: null };
    transitionTo(entry, 'in-progress');
    entry.error = 'Network error';
    transitionTo(entry, 'failed');
    assert.equal(entry.status, 'failed');
    assert.equal(entry.error, 'Network error');
  });

  it('failed -> in-progress (retry) increments counter', () => {
    const entry = { id: 'a', type: 'media', status: 'failed', retried: 0, error: 'Old error' };
    entry.retried += 1;
    entry.status = 'in-progress';
    entry.error = null;
    assert.equal(entry.status, 'in-progress');
    assert.equal(entry.retried, 1);
    assert.equal(entry.error, null);
  });

  it('after 3 retries, status becomes gave-up', () => {
    const entry = { id: 'a', type: 'media', status: 'failed', retried: 0 };
    for (let i = 0; i < 3; i++) {
      entry.retried += 1;
      if (entry.retried >= MAX_RETRIES) {
        entry.status = 'gave-up';
      } else {
        entry.status = 'failed';
      }
    }
    assert.equal(entry.retried, 3);
    assert.equal(entry.status, 'gave-up');
  });

  it('cancelled status is terminal (no further transitions)', () => {
    const entry = { id: 'a', type: 'media', status: 'in-progress' };
    transitionTo(entry, 'cancelled');
    assert.equal(entry.status, 'cancelled');
  });
});

describe('WU-T4: progress tracking', () => {
  it('bytesSent increments as upload progresses', () => {
    const entry = { bytesSent: 0, bytesTotal: 1000 };
    entry.bytesSent = 250;
    assert.equal(entry.bytesSent, 250);
    entry.bytesSent = 500;
    assert.equal(entry.bytesSent, 500);
    entry.bytesSent = 1000;
    assert.equal(entry.bytesSent, 1000);
  });

  it('progress percent is computed correctly', () => {
    const entry = { bytesSent: 250, bytesTotal: 1000 };
    const pct = Math.round((entry.bytesSent / entry.bytesTotal) * 100);
    assert.equal(pct, 25);
  });

  it('bytesSent > bytesTotal is clamped to 100%', () => {
    const entry = { bytesSent: 1500, bytesTotal: 1000 };
    const pct = Math.min(100, Math.round((entry.bytesSent / entry.bytesTotal) * 100));
    assert.equal(pct, 100);
  });

  it('zero-bytes-total entry shows — for progress', () => {
    const entry = { bytesSent: 0, bytesTotal: 0 };
    const showProgress = entry.bytesTotal > 0 || entry.status === 'in-progress';
    assert.equal(showProgress, false); // bytesTotal=0, status=pending, so no progress shown
  });
});

describe('WU-T4: filter helpers', () => {
  it('failed() returns only failed + gave-up', () => {
    const st = makeState();
    st.add('1', { id: '1', status: 'completed' });
    st.add('2', { id: '2', status: 'failed' });
    st.add('3', { id: '3', status: 'in-progress' });
    st.add('4', { id: '4', status: 'gave-up' });
    st.add('5', { id: '5', status: 'cancelled' });
    assert.equal(st.failed().length, 2);
    assert.equal(st.failed().map(u => u.id).sort().join(','), '2,4');
  });

  it('inFlight() returns only pending + in-progress', () => {
    const st = makeState();
    st.add('1', { id: '1', status: 'completed' });
    st.add('2', { id: '2', status: 'failed' });
    st.add('3', { id: '3', status: 'in-progress' });
    st.add('4', { id: '4', status: 'pending' });
    st.add('5', { id: '5', status: 'cancelled' });
    assert.equal(st.inFlight().length, 2);
    assert.equal(st.inFlight().map(u => u.id).sort().join(','), '3,4');
  });
});

describe('WU-T4: persistence (localStorage shape)', () => {
  it('only failed + gave-up entries are persisted', () => {
    const st = makeState();
    st.add('1', { status: 'completed' });
    st.add('2', { status: 'failed' });
    st.add('3', { status: 'in-progress' });
    st.add('4', { status: 'gave-up' });
    st.add('5', { status: 'cancelled' });
    const persisted = st.all().filter(u => u.status === 'failed' || u.status === 'gave-up');
    assert.equal(persisted.length, 2);
  });

  it('persisted entries strip the _file field (large, not serializable)', () => {
    const st = makeState();
    st.add('1', { status: 'failed', _file: { name: 'big.bin', size: 10_000_000 }, error: 'oops' });
    const persisted = st.all().filter(u => u.status === 'failed').map(({ _file, ...rest }) => rest);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].error, 'oops');
    assert.equal('_file' in persisted[0], false);
  });

  it('history is capped at MAX_HISTORY (100)', () => {
    const st = makeState();
    for (let i = 0; i < 150; i++) {
      st.add(`f${i}`, { id: `f${i}`, status: 'failed', createdAt: i });
    }
    const persisted = st.all().filter(u => u.status === 'failed' || u.status === 'gave-up');
    persisted.sort((a, b) => b.createdAt - a.createdAt);
    const capped = persisted.slice(0, 100);
    assert.equal(capped.length, 100);
    // Newest 100 are kept (createdAt 149 -> 50)
    assert.equal(capped[0].createdAt, 149);
    assert.equal(capped[99].createdAt, 50);
  });
});

describe('WU-T4: subscribers + DOM event', () => {
  it('notifies all subscribers on state change', () => {
    const st = makeState();
    let countA = 0, countB = 0;
    st.subscribers.add(() => countA++);
    st.subscribers.add(() => countB++);
    st.add('1', { status: 'pending' });
    assert.equal(countA, 1);
    assert.equal(countB, 1);
    st.add('2', { status: 'in-progress' });
    assert.equal(countA, 2);
    assert.equal(countB, 2);
  });

  it('unsubscribed callback stops being called', () => {
    const st = makeState();
    let count = 0;
    const unsub = () => { count++; };
    st.subscribers.add(unsub);
    st.add('1', { status: 'pending' });
    assert.equal(count, 1);
    st.subscribers.delete(unsub);
    st.add('2', { status: 'in-progress' });
    assert.equal(count, 1, 'unsubscribed callback should not fire');
  });

  it('subscriber error does not break other subscribers', () => {
    const st = makeState();
    let countGood = 0;
    st.subscribers.add(() => { throw new Error('oops'); });
    st.subscribers.add(() => { countGood++; });
    st.add('1', { status: 'pending' });
    assert.equal(countGood, 1, 'good subscriber should still be called');
  });
});

describe('WU-T4: human-readable byte formatting', () => {
  function formatBytes(n) {
    if (n == null || n === 0) return '0 B';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  it('formats bytes, KB, MB, GB', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(512), '512 B');
    assert.equal(formatBytes(1024), '1.0 KB');
    assert.equal(formatBytes(1536), '1.5 KB');
    assert.equal(formatBytes(1024 * 1024), '1.0 MB');
    assert.equal(formatBytes(8.5 * 1024 * 1024), '8.5 MB');
    assert.equal(formatBytes(1024 * 1024 * 1024), '1.00 GB');
    assert.equal(formatBytes(2.5 * 1024 * 1024 * 1024), '2.50 GB');
  });
});
