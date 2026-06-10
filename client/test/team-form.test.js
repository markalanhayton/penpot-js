'use strict';
/**
 * @module test/team-form.test
 * Unit tests for the WU-T3 team form logic.
 *
 * The team form captures: name, description (≤500 chars), color (3- or
 * 6-digit hex), and optional logo. Server-side validation lives in
 * `create-team` and `update-team` RPCs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function validateColor(color) {
  return typeof color === 'string' && HEX_RE.test(color);
}

function clampDescription(desc) {
  if (typeof desc !== 'string') {
    throw new TypeError('description must be a string');
  }
  return desc.slice(0, 500);
}

function buildFeatures({ description, color }) {
  const features = {};
  if (description != null) {
    if (typeof description !== 'string') {
      throw new TypeError('description must be a string');
    }
    features.description = description.slice(0, 500);
  }
  if (color != null) {
    if (!validateColor(color)) {
      throw new TypeError('color must be a valid hex color');
    }
    features.color = color;
  }
  return features;
}

describe('WU-T3: color validation', () => {
  it('accepts 3-digit hex (#RGB)', () => {
    assert.equal(validateColor('#f00'), true);
    assert.equal(validateColor('#0a3'), true);
    assert.equal(validateColor('#ABC'), true);
  });

  it('accepts 6-digit hex (#RRGGBB)', () => {
    assert.equal(validateColor('#3b82f6'), true);
    assert.equal(validateColor('#FFFFFF'), true);
    assert.equal(validateColor('#abcdef'), true);
  });

  it('rejects non-hex strings', () => {
    assert.equal(validateColor('red'), false);
    assert.equal(validateColor('#zzz'), false);
    assert.equal(validateColor('rgb(0,0,0)'), false);
  });

  it('rejects empty or null', () => {
    assert.equal(validateColor(''), false);
    assert.equal(validateColor(null), false);
    assert.equal(validateColor(undefined), false);
    assert.equal(validateColor(12345), false);
  });

  it('requires # prefix', () => {
    assert.equal(validateColor('3b82f6'), false, 'must start with #');
    assert.equal(validateColor(' #3b82f6 '), false, 'rejects whitespace around');
  });

  it('rejects 4- or 5-digit hex', () => {
    assert.equal(validateColor('#fff0'), false);
    assert.equal(validateColor('#fff00'), false);
  });
});

describe('WU-T3: description clamping', () => {
  it('keeps short descriptions unchanged', () => {
    assert.equal(clampDescription('A team for testing'), 'A team for testing');
  });

  it('keeps exactly 500 chars unchanged', () => {
    const s = 'x'.repeat(500);
    assert.equal(clampDescription(s).length, 500);
  });

  it('clamps descriptions longer than 500 chars', () => {
    const s = 'x'.repeat(800);
    assert.equal(clampDescription(s).length, 500);
  });

  it('handles empty string', () => {
    assert.equal(clampDescription(''), '');
  });

  it('rejects non-string types', () => {
    assert.throws(() => clampDescription(123), TypeError);
    assert.throws(() => clampDescription(null), TypeError);
    assert.throws(() => clampDescription(undefined), TypeError);
    assert.throws(() => clampDescription({}), TypeError);
  });
});

describe('WU-T3: buildFeatures', () => {
  it('returns empty object when both fields omitted', () => {
    assert.deepEqual(buildFeatures({}), {});
  });

  it('includes only description when color omitted', () => {
    assert.deepEqual(buildFeatures({ description: 'A team' }), { description: 'A team' });
  });

  it('includes only color when description omitted', () => {
    assert.deepEqual(buildFeatures({ color: '#3b82f6' }), { color: '#3b82f6' });
  });

  it('includes both when both provided', () => {
    const result = buildFeatures({ description: 'A team', color: '#3b82f6' });
    assert.equal(result.description, 'A team');
    assert.equal(result.color, '#3b82f6');
  });

  it('clamps long description', () => {
    const result = buildFeatures({ description: 'x'.repeat(800) });
    assert.equal(result.description.length, 500);
  });

  it('throws on invalid color', () => {
    assert.throws(() => buildFeatures({ color: 'red' }), TypeError);
  });
});

describe('WU-T3: create-team RPC argument building', () => {
  function buildCreateArgs({ name, description, color, isDefault }) {
    const args = { name };
    if (description || color) {
      args.features = buildFeatures({ description, color });
    }
    if (isDefault) args.isDefault = true;
    return args;
  }

  it('minimal create: just name', () => {
    assert.deepEqual(buildCreateArgs({ name: 'My Team' }), { name: 'My Team' });
  });

  it('create with description and color', () => {
    const args = buildCreateArgs({ name: 'X', description: 'Cool', color: '#3b82f6' });
    assert.equal(args.name, 'X');
    assert.equal(args.features.description, 'Cool');
    assert.equal(args.features.color, '#3b82f6');
  });

  it('create as default team', () => {
    const args = buildCreateArgs({ name: 'Default', isDefault: true });
    assert.equal(args.isDefault, true);
  });

  it('create with all options', () => {
    const args = buildCreateArgs({
      name: 'Full',
      description: 'A team for testing',
      color: '#abcdef',
      isDefault: false,
    });
    assert.equal(args.name, 'Full');
    assert.equal(args.features.description, 'A team for testing');
    assert.equal(args.features.color, '#abcdef');
    assert.equal(args.isDefault, undefined, 'isDefault:false should not be included');
  });
});
