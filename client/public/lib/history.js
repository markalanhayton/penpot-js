'use strict';
/**
 * @module history
 * @description Undo/redo history stack for workspace editing operations.
 * Provides a Store-like interface that tracks state changes and supports
 * undo/redo with optional command labels.
 */

export class History {
  #stack = [];
  #index = -1;
  #maxSize = 100;
  #onChange = null;

  constructor(maxSize = 100, onChange = null) {
    this.#maxSize = maxSize;
    this.#onChange = onChange;
  }

  push(entry) {
    this.#stack = this.#stack.slice(0, this.#index + 1);
    this.#stack.push(entry);
    if (this.#stack.length > this.#maxSize) {
      this.#stack.shift();
    }
    this.#index = this.#stack.length - 1;
    if (this.#onChange) this.#onChange();
  }

  undo() {
    if (!this.canUndo) return null;
    this.#index--;
    if (this.#onChange) this.#onChange();
    return this.#stack[this.#index + 1];
  }

  redo() {
    if (!this.canRedo) return null;
    this.#index++;
    if (this.#onChange) this.#onChange();
    return this.#stack[this.#index];
  }

  get canUndo() { return this.#index >= 0; }
  get canRedo() { return this.#index < this.#stack.length - 1; }
  get length() { return this.#stack.length; }
  get currentIndex() { return this.#index; }

  peek() {
    if (this.#index < 0) return null;
    return this.#stack[this.#index];
  }

  reset() {
    this.#stack = [];
    this.#index = -1;
  }
}