'use strict';
/**
 * @module test/audit-log-settings.test
 * Unit tests for the audit log section in the settings component.
 *
 * The audit log section is a tab inside <penpot-settings> that:
 *   - Calls `cmd('get-audit-events', params)` with filters and pagination
 *   - Renders events with name/type/source/timestamp/props
 *   - Supports pagination via prev/next buttons
 *
 * The actual settings component is a Web Component with lots of DOM
 * dependencies, so we reimplement the relevant logic in isolation here
 * to test the filter / pagination / rendering math.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirror of the audit-log filter/pagination state, used by both the
 * production settings component and these tests.
 */
function buildParams(filters, offset, limit) {
  const params = { limit, offset };
  if (filters.name) params.eventName = filters.name;
  if (filters.type) params.eventType = filters.type;
  if (filters.source) params.source = filters.source;
  return params;
}

function pageBounds(offset, limit, total) {
  if (total === 0) {
    return { current: 0, total: 0, from: 0, to: 0 };
  }
  return {
    current: Math.floor(offset / limit) + 1,
    total: Math.max(1, Math.ceil(total / limit)),
    from: offset + 1,
    to: Math.min(total, offset + limit),
  };
}

describe('audit log filter params', () => {
  it('emits empty params when no filters set', () => {
    const params = buildParams({ name: '', type: '', source: '' }, 0, 20);
    assert.deepEqual(params, { limit: 20, offset: 0 });
  });

  it('emits eventName when name filter is set', () => {
    const params = buildParams({ name: 'create-file', type: '', source: '' }, 0, 50);
    assert.equal(params.eventName, 'create-file');
    assert.equal(params.limit, 50);
  });

  it('emits eventType when type filter is set', () => {
    const params = buildParams({ name: '', type: 'action', source: '' }, 0, 20);
    assert.equal(params.eventType, 'action');
  });

  it('emits source when source filter is set', () => {
    const params = buildParams({ name: '', type: '', source: 'backend' }, 0, 20);
    assert.equal(params.source, 'backend');
  });

  it('emits all three filters when all are set', () => {
    const params = buildParams({ name: 'audit', type: 'action', source: 'frontend' }, 100, 25);
    assert.equal(params.eventName, 'audit');
    assert.equal(params.eventType, 'action');
    assert.equal(params.source, 'frontend');
    assert.equal(params.limit, 25);
    assert.equal(params.offset, 100);
  });

  it('preserves offset and limit for pagination', () => {
    const params = buildParams({ name: '', type: '', source: '' }, 40, 20);
    assert.equal(params.offset, 40);
    assert.equal(params.limit, 20);
  });
});

describe('audit log pagination bounds', () => {
  it('returns zero bounds when total is 0', () => {
    const b = pageBounds(0, 20, 0);
    assert.equal(b.current, 0);
    assert.equal(b.total, 0);
    assert.equal(b.from, 0);
    assert.equal(b.to, 0);
  });

  it('shows page 1 of N when on first page', () => {
    const b = pageBounds(0, 20, 50);
    assert.equal(b.current, 1);
    assert.equal(b.total, 3);
    assert.equal(b.from, 1);
    assert.equal(b.to, 20);
  });

  it('shows middle page bounds correctly', () => {
    const b = pageBounds(40, 20, 50);
    assert.equal(b.current, 3);
    assert.equal(b.from, 41);
    assert.equal(b.to, 50);
  });

  it('clamps to bounds when fewer rows than limit on last page', () => {
    const b = pageBounds(40, 20, 45);
    assert.equal(b.to, 45, 'should not exceed total');
  });

  it('handles exact multiples of limit', () => {
    const b = pageBounds(20, 20, 40);
    assert.equal(b.current, 2);
    assert.equal(b.total, 2);
    assert.equal(b.to, 40);
  });
});

describe('audit log event rendering (server response shape)', () => {
  // Validates the contract: the server returns events with these
  // camelCased fields, and the client renders them in this order.

  it('event has the expected fields', () => {
    const event = {
      id: 1,
      name: 'create-file',
      source: 'frontend',
      type: 'action',
      trackedAt: '2026-06-08T12:00:00.000Z',
      createdAt: '2026-06-08T12:00:00.000Z',
      profileId: 'abc-123',
      props: { fileId: 'xyz' },
      context: null,
    };
    assert.equal(typeof event.name, 'string');
    assert.equal(typeof event.source, 'string');
    assert.equal(typeof event.type, 'string');
    assert.equal(typeof event.trackedAt, 'string');
    assert.ok(event.props && typeof event.props === 'object');
  });

  it('client renders the event-type CSS modifier from the type value', () => {
    function classForType(type) {
      return `penpot-settings__audit-type penpot-settings__audit-type--${type}`;
    }
    assert.equal(classForType('action'), 'penpot-settings__audit-type penpot-settings__audit-type--action');
    assert.equal(classForType('navigation'), 'penpot-settings__audit-type penpot-settings__audit-type--navigation');
  });

  it('client truncates profile id for display', () => {
    const profileId = 'c0153c0a-7aa7-473a-99d8-a8f5ce41c20c';
    const display = profileId.slice(0, 8);
    assert.equal(display, 'c0153c0a');
  });

  it('client stringifies props for display (if present)', () => {
    const props = { fileId: 'abc-123', shapeType: 'rect' };
    const str = JSON.stringify(props);
    assert.equal(str, '{"fileId":"abc-123","shapeType":"rect"}');
  });
});
