// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

export const MAX_UNDO_SIZE = 100;

export function makeStack() {
  return { index: -1, items: [] };
}

export function peek(stack) {
  if (stack.index >= 0 && stack.index < stack.items.length) {
    return stack.items[stack.index];
  }
  return null;
}

export function append(stack, value) {
  if (stack && value === peek(stack)) return stack;

  let items = [...stack.items];
  let index = stack.index;

  if (index >= 0 && index < items.length - 1) {
    items = items.slice(0, index + 1);
  }

  items.push(value);

  if (items.length > MAX_UNDO_SIZE) {
    items = items.slice(1);
    index = Math.min(MAX_UNDO_SIZE - 1, index);
  } else {
    index = Math.min(MAX_UNDO_SIZE - 1, index + 1);
  }

  return { index, items };
}

export function fixup(stack, value) {
  const items = [...stack.items];
  items[stack.index] = value;
  return { ...stack, items };
}

export function undo(stack) {
  return { ...stack, index: Math.max(0, stack.index - 1) };
}

export function redo(stack) {
  if (stack.index < stack.items.length - 1) {
    return { ...stack, index: stack.index + 1 };
  }
  return stack;
}

export function size(stack) {
  return stack.index + 1;
}