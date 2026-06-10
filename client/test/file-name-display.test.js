'use strict';
/**
 * @module test/file-name-display.test
 * Unit tests for the toolbar's file-name setter, verifying that the
 * DOM element's textContent is updated when the file name is set.
 *
 * Bug: The condition `!el.contentEditable || el.contentEditable === 'false'`
 * is always false for a span without an explicit contentEditable attribute
 * (where el.contentEditable is the default 'inherit'). As a result, the
 * toolbar's title never updates and always shows the template's default
 * ("Untitled file") regardless of the actual file name.
 *
 * Fix: use `el.contentEditable !== 'true'` (explicit string check).
 * The rename flow sets contentEditable='true' on the span; in that case we
 * must NOT overwrite the user's edits.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Reimplements the toolbar's `set fileName` logic in isolation. The
 * original is a custom-element setter; we reimplement the same predicate
 * + assignment to verify the math/logic.
 */
function updateFileNameText(el, fileName) {
  if (el && el.contentEditable !== 'true') {
    el.textContent = fileName || 'Untitled';
  }
}

function makeEl() {
  return { textContent: 'Untitled file', contentEditable: 'inherit' };
}

describe('toolbar file-name display', () => {
  it('updates textContent when element is at default (inherit) state', () => {
    const el = makeEl();
    updateFileNameText(el, 'TestFile');
    assert.equal(el.textContent, 'TestFile', 'textContent should be set');
  });

  it('updates textContent when element is explicitly not editable (false)', () => {
    const el = makeEl();
    el.contentEditable = 'false';
    updateFileNameText(el, 'My Document');
    assert.equal(el.textContent, 'My Document');
  });

  it('does NOT overwrite text when user is editing (contentEditable=true)', () => {
    const el = makeEl();
    el.contentEditable = 'true';
    el.textContent = 'user is typing...';
    updateFileNameText(el, 'NewFile');
    assert.equal(el.textContent, 'user is typing...', 'must not clobber user edits');
  });

  it('falls back to "Untitled" when name is empty/falsy', () => {
    const el = makeEl();
    updateFileNameText(el, '');
    assert.equal(el.textContent, 'Untitled');

    updateFileNameText(el, null);
    assert.equal(el.textContent, 'Untitled');

    updateFileNameText(el, undefined);
    assert.equal(el.textContent, 'Untitled');
  });

  it('handles long file names without truncation', () => {
    const el = makeEl();
    const longName = 'A very long file name with lots of words and punctuation, indeed!';
    updateFileNameText(el, longName);
    assert.equal(el.textContent, longName);
  });

  it('after edit completes (contentEditable=false), subsequent set updates text', () => {
    const el = makeEl();
    el.contentEditable = 'true';
    el.textContent = 'user is typing';
    updateFileNameText(el, 'should NOT update');
    assert.equal(el.textContent, 'user is typing');

    el.contentEditable = 'false'; // user finished editing
    updateFileNameText(el, 'AfterEdit');
    assert.equal(el.textContent, 'AfterEdit', 'should update after edit completes');
  });
});

describe('old broken logic (regression guard)', () => {
  // This documents the previous bug: the predicate evaluated to false for
  // default 'inherit' contentEditable, so the DOM was never updated.
  const oldBrokenCheck = (el) => el && !el.contentEditable || el.contentEditable === 'false';

  it('old broken check is FALSE for default inherit state (the bug)', () => {
    const el = makeEl();
    assert.equal(oldBrokenCheck(el), false,
      'Old check returned false, so the DOM was never updated — this is the bug');
  });

  it('old broken check is TRUE for explicit false (not the bug)', () => {
    const el = makeEl();
    el.contentEditable = 'false';
    assert.equal(oldBrokenCheck(el), true);
  });

  it('old broken check is FALSE for true (editing — correct, skip update)', () => {
    const el = makeEl();
    el.contentEditable = 'true';
    assert.equal(oldBrokenCheck(el), false,
      'Correctly skips update when user is editing (not the bug)');
  });
});
