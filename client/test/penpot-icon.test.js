'use strict';
/**
 * @module test/penpot-icon.test
 * Unit tests for penpot-icon's CSS variable size normalization.
 *
 * Bug: penpot-icon#update() did `style.setProperty('--penpot-icon-size', size)`
 * with the raw attribute value. If the consumer passed `size="14"` (a bare
 * number), the CSS var resolved to `14` — an invalid length — and the icon
 * fell back to its `1em` default (12px from the button font-size), making
 * it look chunkier than intended against the `stroke-width: 2` path.
 *
 * Fix: normalize bare-number sizes to `${n}px` before assigning the var.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function normalizeSize(size) {
  return /^\d+(\.\d+)?$/.test(size) ? `${size}px` : size;
}

describe('penpot-icon size normalization', () => {
  it('appends px to bare integer sizes', () => {
    assert.equal(normalizeSize('14'), '14px');
    assert.equal(normalizeSize('16'), '16px');
    assert.equal(normalizeSize('1'), '1px');
  });

  it('appends px to bare decimal sizes', () => {
    assert.equal(normalizeSize('1.5'), '1.5px');
    assert.equal(normalizeSize('0.5'), '0.5px');
  });

  it('leaves em values as-is', () => {
    assert.equal(normalizeSize('1em'), '1em');
    assert.equal(normalizeSize('1.25em'), '1.25em');
  });

  it('leaves rem values as-is', () => {
    assert.equal(normalizeSize('1rem'), '1rem');
  });

  it('leaves px values as-is (no double px)', () => {
    assert.equal(normalizeSize('14px'), '14px');
    assert.equal(normalizeSize('24px'), '24px');
  });

  it('leaves unitless zero as 0px (no double px)', () => {
    assert.equal(normalizeSize('0'), '0px');
  });
});
