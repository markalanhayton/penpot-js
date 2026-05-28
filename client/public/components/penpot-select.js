'use strict';
import { PenpotElement } from './base.js';

const ICONS = { plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', cross: 'M6 6l12 12M18 6L6 18', chevron_down: 'M6 9l6 6 6-6' };

let nextId = 0;

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-select { display: inline-block; position: relative; }
    .penpot-select__select-trigger { display: inline-flex; align-items: center; justify-content: space-between; min-width: 120px; padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); font-size: var(--penpot-font-size-m, 13px); font-family: inherit; cursor: pointer; user-select: none; transition: border-color var(--penpot-transition-fast, 0.1s ease); }
    .penpot-select__select-trigger:hover { border-color: var(--penpot-border-hover, #666); }
    .penpot-select__select-trigger:focus, .penpot-select__select-trigger.penpot-select__open { border-color: var(--penpot-input-border-focused, var(--penpot-primary, #31efb8)); outline: none; }
    .penpot-select__select-trigger:disabled { opacity: 0.5; cursor: not-allowed; }
    .penpot-select__select-arrow { font-size: 10px; opacity: 0.6; margin-left: var(--penpot-spacing-xs, 4px); }
    .penpot-select__select-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: var(--penpot-z-dropdown, 50); display: none; }
    .penpot-select__select-overlay.penpot-select__open { display: block; }
    .penpot-select__select-menu { position: absolute; z-index: var(--penpot-z-dropdown, 50); top: 100%; left: 0; min-width: 100%; max-height: 200px; overflow-y: auto; margin-top: 4px; background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); box-shadow: var(--penpot-shadow-m, 0 4px 12px rgba(0,0,0,0.4)); padding: var(--penpot-spacing-xs, 4px) 0; display: none; }
    .penpot-select__select-menu.penpot-select__open { display: block; }
    .penpot-select__select-option { padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-m, 12px); font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); cursor: pointer; white-space: nowrap; }
    .penpot-select__select-option:hover { background: var(--penpot-primary-bg, rgba(49,239,184,0.08)); }
    .penpot-select__select-option.penpot-select__selected { background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); color: var(--penpot-primary, #31efb8); }
    .penpot-select__select-option.penpot-select__disabled { opacity: 0.4; cursor: not-allowed; }
  
  </style>
  <button class="penpot-select__select-trigger" id="trigger">
    <span id="label">Select...</span>
    <span class="penpot-select__select-arrow">\u25BE</span>
  </button>
  <div class="penpot-select__select-overlay" id="overlay"></div>
  <div class="penpot-select__select-menu" id="menu"></div>`;

export class PenpotSelect extends PenpotElement {
  _template = template;
  static get observedAttributes() { return ['value', 'placeholder', 'disabled']; }

  #open = false;
  #options = [];

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    const trigger = this.querySelector('#trigger');
    const overlay = this.querySelector('#overlay');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.disabled) return;
      this.#open ? this.close() : this.open();
    });

    overlay.addEventListener('click', () => this.close());

    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    this.#readOptions();
    this.#update();
  }

  attributeChangedCallback() { this.#update(); }

  get value() { return this.getAttribute('value') || ''; }
  set value(v) { this.setAttribute('value', v); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  #readOptions() {
    this.#options = [];
    for (const child of this.children) {
      if (child.tagName === 'OPTION') {
        this.#options.push({ value: child.getAttribute('value') || child.textContent, label: child.textContent.trim() });
      }
    }
  }

  open() {
    this.#open = true;
    this.querySelector('#trigger').classList.add('penpot-select__open');
    this.querySelector('#menu').classList.add('penpot-select__open');
    this.querySelector('#overlay').classList.add('penpot-select__open');
  }

  close() {
    this.#open = false;
    this.querySelector('#trigger').classList.remove('penpot-select__open');
    this.querySelector('#menu').classList.remove('penpot-select__open');
    this.querySelector('#overlay').classList.remove('penpot-select__open');
  }

  #update() {
    this.#readOptions();
    const labelEl = this.querySelector('#label');
    const menu = this.querySelector('#menu');
    const trigger = this.querySelector('#trigger');
    if (!labelEl) return;

    const placeholder = this.getAttribute('placeholder') || 'Select...';
    let labelText = placeholder;
    const val = this.getAttribute('value');

    menu.innerHTML = '';
    for (const opt of this.#options) {
      const el = document.createElement('div');
      el.className = 'penpot-select__select-option' + (opt.value === val ? ' penpot-select__selected' : '');
      el.textContent = opt.label;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.value = opt.value;
        this.close();
        this.emit('penpot-input', { value: opt.value, name: this.getAttribute('name') });
      });
      menu.appendChild(el);

      if (opt.value === val) labelText = opt.label;
    }

    labelEl.textContent = labelText;
    trigger.disabled = this.disabled;
  }

  render() {}
}

customElements.define('penpot-select', PenpotSelect);