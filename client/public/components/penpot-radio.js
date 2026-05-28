'use strict';
import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-radio { display: block; }
    .penpot-radio__radio-group { display: flex; flex-direction: column; gap: var(--penpot-spacing-s, 8px); }
    .penpot-radio__radio-option { display: inline-flex; align-items: center; gap: var(--penpot-spacing-s, 8px); cursor: pointer; user-select: none; }
    .penpot-radio__radio-circle { width: 16px; height: 16px; border: 2px solid var(--penpot-border, #444); border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--penpot-input-bg, #333); transition: border-color var(--penpot-transition-fast, 0.1s ease); flex-shrink: 0; }
    .penpot-radio__radio-circle:hover { border-color: var(--penpot-border-hover, #666); }
    .penpot-radio__radio-circle.penpot-radio__selected { border-color: var(--penpot-primary, #31efb8); }
    .penpot-radio__radio-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--penpot-primary, #31efb8); display: none; }
    .penpot-radio__radio-circle.penpot-radio__selected .penpot-radio__radio-dot { display: block; }
    .penpot-radio__radio-circle.penpot-radio__disabled { opacity: 0.5; cursor: not-allowed; }
    .penpot-radio__radio-label { font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); }
    .penpot-radio__radio-label.penpot-radio__disabled { color: var(--penpot-text-disabled, #666); }
  
  </style>
  <div class="penpot-radio__radio-group" id="group"><slot></slot></div>`;

export class PenpotRadio extends PenpotElement {
  _template = template;
  static get observedAttributes() { return ['value', 'disabled']; }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('penpot-radio-select', (e) => {
      if (this.disabled) return;
      this.value = e.detail.value;
      this.emit('penpot-change', { value: this.value });
    });
  }

  attributeChangedCallback() { this.#update(); }

  get value() { return this.getAttribute('value') || ''; }
  set value(v) { this.setAttribute('value', v); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  #update() {
    const options = this.querySelectorAll('penpot-radio-option');
    options.forEach(opt => {
      opt.selected = opt.getAttribute('value') === this.value;
      opt.disabled = this.disabled;
    });
  }

  render() {}
}

export class PenpotRadioOption extends HTMLElement {
  static get observedAttributes() { return ['value', 'label', 'selected', 'disabled']; }

  constructor() { super(); }

  connectedCallback() {
    this.innerHTML = '';
    this.style.display = 'inline-flex';
    this.style.alignItems = 'center';
    this.style.gap = 'var(--penpot-spacing-s, 8px)';
    this.style.cursor = this.disabled ? 'not-allowed' : 'pointer';
    this.style.userSelect = 'none';

    this._circle = document.createElement('span');
    this._circle.style.cssText = 'width:16px;height:16px;border:2px solid var(--penpot-border,#444);border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--penpot-input-bg,#333);flex-shrink:0;transition:border-color 0.1s ease;';

    this._dot = document.createElement('span');
    this._dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:var(--penpot-primary,#31efb8);display:none;';
    this._circle.appendChild(this._dot);

    this._label = document.createElement('span');
    this._label.style.cssText = 'font-size:var(--penpot-font-size-m,13px);color:var(--penpot-text,#e6e6e6);';
    this._label.textContent = this.getAttribute('label') || this.getAttribute('value') || '';

    this.appendChild(this._circle);
    this.appendChild(this._label);

    this.addEventListener('click', () => {
      if (this.disabled) return;
      const radio = this.closest('penpot-radio');
      if (radio) radio.dispatchEvent(new CustomEvent('penpot-radio-select', { detail: { value: this.getAttribute('value') }, bubbles: true }));
    });

    this.#update();
  }

  attributeChangedCallback() { this.#update(); }

  get selected() { return this.hasAttribute('selected'); }
  set selected(v) { v ? this.setAttribute('selected', '') : this.removeAttribute('selected'); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  #update() {
    if (!this._circle) return;
    this._circle.style.borderColor = this.selected ? 'var(--penpot-primary,#31efb8)' : 'var(--penpot-border,#444)';
    this._dot.style.display = this.selected ? 'block' : 'none';
    this.style.opacity = this.disabled ? '0.5' : '1';
    this.style.cursor = this.disabled ? 'not-allowed' : 'pointer';
    this._label.textContent = this.getAttribute('label') || this.getAttribute('value') || '';
  }
}

customElements.define('penpot-radio', PenpotRadio);
customElements.define('penpot-radio-option', PenpotRadioOption);