/**
 * @module components/base
 * @description Base class for all Penpot Web Components.
 * Provides store subscription lifecycle, debounced rendering, and event helpers.
 */

export class PenpotElement extends HTMLElement {
  #rendered = false;
  #templateAppended = false;
  #renderPending = false;
  #unsubscribers = [];

  connectedCallback() {
    if (!this.#rendered) {
      this.#rendered = true;
      if (this._template && !this.#templateAppended) {
        this.#templateAppended = true;
        this.appendChild(this._template.content.cloneNode(true));
      }
      this.render();
    }
    if (!this._listenersBound) {
      this._listenersBound = true;
      this.bindListeners?.();
    }
  }

  disconnectedCallback() {
    this.#rendered = false;
    this._listenersBound = false;
    for (const unsub of this.#unsubscribers) unsub();
    this.#unsubscribers = [];
  }

  /**
   * Subscribe to a store ref or signal. Auto-unsubscribes on disconnect.
   * @param {{ subscribe: (cb: Function) => Function }} ref
   * @param {Function} callback
   */
  watch(ref, callback) {
    const unsub = ref.subscribe(callback);
    this.#unsubscribers.push(unsub);
  }

  /**
   * Schedule a render on next microtask (debounced).
   */
  scheduleRender() {
    if (this.#renderPending) return;
    this.#renderPending = true;
    queueMicrotask(() => {
      this.#renderPending = false;
      if (this.#rendered) this.render();
    });
  }

  /**
   * Override in subclass. Called on connectedCallback and after scheduleRender().
   */
  render() {}

  /**
   * Shorthand for querySelector.
   * @param {string} sel
   * @returns {HTMLElement|null}
   */
  $(sel) { return this.querySelector(sel); }

  /**
   * Shorthand for querySelectorAll.
   * @param {string} sel
   * @returns {NodeListOf<HTMLElement>}
   */
  $$(sel) { return this.querySelectorAll(sel); }

  /**
   * Dispatch a custom event that bubbles and crosses shadow DOM.
   * @param {string} name
   * @param {*} detail
   */
  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  /**
   * Escape HTML to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  escHtml(str) {
    const el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
  }
}