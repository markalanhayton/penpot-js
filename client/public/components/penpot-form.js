import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-form { display: block; }
    .penpot-form__form-group { display: flex; flex-direction: column; gap: var(--penpot-spacing-xs, 4px); margin-bottom: var(--penpot-spacing-m, 12px); }
    .penpot-form__form-row { display: flex; gap: var(--penpot-spacing-s, 8px); }
    .penpot-form__form-row > * { flex: 1; }
    .penpot-form__form-error { color: var(--penpot-danger, #f44336); font-size: var(--penpot-font-size-xs, 10px); margin-top: var(--penpot-spacing-xxs, 2px); display: none; }
    .penpot-form__form-error.penpot-form__visible { display: block; }
    .penpot-form__form-hint { color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-xs, 10px); margin-top: var(--penpot-spacing-xxs, 2px); }
    penpot-form[error] .penpot-form__form-error { display: block; }
  
  </style>
  <div class="penpot-form__form-group" id="group">
    <slot></slot>
    <div class="penpot-form__form-error" id="error"></div>
    <div class="penpot-form__form-hint" id="hint"></div>
  </div>`;

export class PenpotForm extends PenpotElement {
  _template = template;
  static get observedAttributes() { return ['error', 'hint']; }

  constructor() {
    super();
  }

  connectedCallback() { super.connectedCallback(); this.#update(); }
  attributeChangedCallback() { this.#update(); }

  #update() {
    const errorEl = this.querySelector('#error');
    const hintEl = this.querySelector('#hint');
    if (!errorEl) return;

    const error = this.getAttribute('error');
    const hint = this.getAttribute('hint');

    errorEl.textContent = error || '';
    errorEl.className = 'penpot-form__form-error' + (error ? ' penpot-form__visible' : '');
    hintEl.textContent = hint || '';
    hintEl.style.display = hint ? '' : 'none';
  }

  validate() {
    let valid = true;
    const inputs = this.querySelectorAll('penpot-input, input, textarea, select');
    inputs.forEach(input => {
      const required = input.hasAttribute('required') || input.required;
      const value = input.value !== undefined ? input.value : '';
      if (required && !value.trim()) {
        valid = false;
        this.setAttribute('error', `${input.getAttribute('label') || input.getAttribute('name') || 'Field'} is required`);
      }
    });
    if (valid) this.removeAttribute('error');
    return valid;
  }

  getData() {
    const data = {};
    this.querySelectorAll('penpot-input, input, textarea, select').forEach(input => {
      const name = input.getAttribute('name');
      if (name) data[name] = input.value;
    });
    return data;
  }

  render() {}
}

customElements.define('penpot-form', PenpotForm);