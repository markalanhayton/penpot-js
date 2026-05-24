/**
 * @module components/penpot-input
 * @description Reusable input Web Component.
 * Attributes: label, type, placeholder, value, disabled, error
 */

import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-input { display: block; margin-bottom: var(--penpot-spacing-m); }
    label {
      display: block;
      font-size: var(--penpot-font-size-s);
      color: var(--penpot-text-dim);
      margin-bottom: var(--penpot-spacing-xs);
    }
    input, textarea, select {
      width: 100%;
      padding: var(--penpot-spacing-s) var(--penpot-spacing-m);
      background: var(--penpot-input-bg);
      border: 1px solid var(--penpot-input-border);
      border-radius: var(--penpot-radius-s);
      color: var(--penpot-text);
      font-family: var(--penpot-font-family);
      font-size: var(--penpot-font-size-m);
      outline: none;
      transition: border-color var(--penpot-transition-fast);
    }
    input:focus, textarea:focus, select:focus {
      border-color: var(--penpot-input-border-focused);
    }
    input:disabled, textarea:disabled, select:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .penpot-input__error {
      color: var(--penpot-danger);
      font-size: var(--penpot-font-size-xs);
      margin-top: var(--penpot-spacing-xs);
      display: none;
    }
    .penpot-input__error.penpot-input__visible { display: block; }
    penpot-input[error] input,
    penpot-input[error] textarea,
    penpot-input[error] select {
      border-color: var(--penpot-danger);
    }
  
  </style>
  <label id="label"></label>
  <input id="input">
  <div class="penpot-input__error" id="error"></div>`;

export class PenpotInput extends PenpotElement {
  _template = template;
  static get observedAttributes() { return ['label', 'type', 'placeholder', 'value', 'disabled', 'error']; }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    const input = this.querySelector('#input');
    input.addEventListener('input', () => {
      this.emit('penpot-input', { value: input.value, name: this.getAttribute('name') });
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.emit('penpot-input-enter', { value: input.value });
    });
    input.addEventListener('focus', () => this.emit('penpot-input-focus', {}));
    input.addEventListener('blur', () => this.emit('penpot-input-blur', {}));
    this._applyAttributes();
  }

  get value() { return this.querySelector('#input')?.value || ''; }
  set value(v) {
    const input = this.querySelector('#input');
    if (input) input.value = v;
  }

  attributeChangedCallback(name, oldVal, newVal) {
    this._applyAttributes();
  }

  _applyAttributes() {
    const input = this.querySelector('#input');
    const label = this.querySelector('#label');
    const error = this.querySelector('#error');
    if (!input) return;

    const type = this.getAttribute('type') || 'text';
    if (input.tagName === 'INPUT') {
      input.type = type;
    }

    input.placeholder = this.getAttribute('placeholder') || '';
    input.disabled = this.hasAttribute('disabled');

    const labelText = this.getAttribute('label');
    if (labelText) {
      label.textContent = labelText;
      label.style.display = '';
    } else {
      label.style.display = 'none';
    }

    const errorText = this.getAttribute('error');
    if (errorText) {
      error.textContent = errorText;
      error.classList.add('penpot-input__visible');
    } else {
      error.classList.remove('penpot-input__visible');
    }
  }

  render() {}
}

customElements.define('penpot-input', PenpotInput);