/**
 * @module components/penpot-button
 * @description Reusable button Web Component.
 * Attributes: variant (primary|secondary|danger|ghost), size (s|m|l), disabled, loading
 */

import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-button { display: inline-flex; }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--penpot-spacing-xs);
      padding: var(--penpot-spacing-xs) var(--penpot-spacing-m);
      font-family: var(--penpot-font-family);
      font-size: var(--penpot-font-size-m);
      font-weight: 600;
      line-height: 1;
      border: 1px solid var(--penpot-border);
      border-radius: var(--penpot-radius-s);
      background: var(--penpot-surface);
      color: var(--penpot-text);
      cursor: pointer;
      transition: background var(--penpot-transition-fast), border-color var(--penpot-transition-fast), opacity var(--penpot-transition-fast);
      white-space: nowrap;
      user-select: none;
    }
    button:hover:not(:disabled) {
      background: var(--penpot-surface-high);
      border-color: var(--penpot-border-hover);
    }
    button:active:not(:disabled) {
      background: var(--penpot-surface-highest);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button:focus-visible {
      outline: var(--penpot-focus-outline);
      outline-offset: var(--penpot-focus-outline-offset);
    }
    /* Variants */
    penpot-button[variant="primary"] button {
      background: var(--penpot-primary);
      color: var(--penpot-text-inverse);
      border-color: var(--penpot-primary);
    }
    penpot-button[variant="primary"] button:hover:not(:disabled) {
      background: var(--penpot-primary-hover);
    }
    penpot-button[variant="danger"] button {
      background: var(--penpot-danger);
      color: white;
      border-color: var(--penpot-danger);
    }
    penpot-button[variant="danger"] button:hover:not(:disabled) {
      background: var(--penpot-danger-hover);
    }
    penpot-button[variant="ghost"] button {
      background: transparent;
      border-color: transparent;
    }
    penpot-button[variant="ghost"] button:hover:not(:disabled) {
      background: var(--penpot-surface-high);
    }
    /* Sizes */
    penpot-button[size="s"] button {
      padding: var(--penpot-spacing-xs) var(--penpot-spacing-s);
      font-size: var(--penpot-font-size-s);
    }
    penpot-button[size="l"] button {
      padding: var(--penpot-spacing-s) var(--penpot-spacing-l);
      font-size: var(--penpot-font-size-l);
    }
    /* Loading */
    .penpot-btn__spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    button.penpot-btn__loading .penpot-btn__spinner { display: inline-flex; }
    button:not(.penpot-btn__loading) .penpot-btn__spinner { display: none; }
  
  </style>
  <button><span class="penpot-btn__spinner"></span><slot></slot></button>`;

export class PenpotButton extends PenpotElement {
  static get observedAttributes() { return ['disabled', 'loading', 'variant', 'size']; }

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('button').addEventListener('click', () => {
      if (!this.loading) this.emit('penpot-button-click', {});
    });
  }

  get loading() { return this.hasAttribute('loading'); }
  set loading(v) { v ? this.setAttribute('loading', '') : this.removeAttribute('loading'); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  attributeChangedCallback(name, oldVal, newVal) {
    const btn = this.querySelector('button');
    if (!btn) return;

    if (name === 'loading') {
      btn.classList.toggle('penpot-btn__loading', newVal !== null);
      btn.disabled = this.disabled || newVal !== null;
    }
    if (name === 'disabled') {
      btn.disabled = newVal !== null || this.loading;
    }
  }

  render() {}
}

customElements.define('penpot-button', PenpotButton);