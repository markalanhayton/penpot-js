'use strict';
import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-dropdown { display: inline-block; position: relative; }
    .penpot-dd__dropdown-trigger { display: inline-flex; align-items: center; gap: var(--penpot-spacing-xs, 4px); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); font-size: var(--penpot-font-size-m, 13px); font-family: inherit; cursor: pointer; user-select: none; transition: background var(--penpot-transition-fast, 0.1s ease); }
    .penpot-dd__dropdown-trigger:hover { background: var(--penpot-surface-high, #333); border-color: var(--penpot-border-hover, #666); }
    .penpot-dd__dropdown-trigger.penpot-dd__open { border-color: var(--penpot-primary, #31efb8); }
    .penpot-dd__dropdown-trigger:disabled { opacity: 0.5; cursor: not-allowed; }
    .penpot-dd__dropdown-arrow { font-size: 10px; opacity: 0.6; }
    .penpot-dd__dropdown-overlay { position: fixed; z-index: var(--penpot-z-dropdown, 50); top: 0; left: 0; right: 0; bottom: 0; display: none; }
    .penpot-dd__dropdown-overlay.penpot-dd__open { display: block; }
    .penpot-dd__dropdown-menu { position: absolute; z-index: var(--penpot-z-dropdown, 50); top: 100%; left: 0; min-width: 160px; max-height: 240px; overflow-y: auto; margin-top: 4px; background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); box-shadow: var(--penpot-shadow-m, 0 4px 12px rgba(0,0,0,0.4)); padding: var(--penpot-spacing-xs, 4px) 0; display: none; }
    .penpot-dd__dropdown-menu.penpot-dd__open { display: block; }
    .penpot-dd__dropdown-item { padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-m, 12px); font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); cursor: pointer; white-space: nowrap; }
    .penpot-dd__dropdown-item:hover { background: var(--penpot-primary-bg, rgba(49,239,184,0.08)); color: var(--penpot-primary, #31efb8); }
    .penpot-dd__dropdown-item.penpot-dd__selected { background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); color: var(--penpot-primary, #31efb8); }
    .penpot-dd__dropdown-item.penpot-dd__disabled { opacity: 0.4; cursor: not-allowed; }
    .penpot-dd__dropdown-separator { height: 1px; background: var(--penpot-border, #444); margin: var(--penpot-spacing-xs, 4px) 0; }
  
  </style>
  <button class="penpot-dd__dropdown-trigger" id="trigger" aria-haspopup="listbox" aria-expanded="false">
    <span id="label">Select...</span>
    <span class="penpot-dd__dropdown-arrow">\u25BE</span>
  </button>
  <div class="penpot-dd__dropdown-overlay" id="overlay"></div>
  <div class="penpot-dd__dropdown-menu" id="menu" role="listbox"><slot></slot></div>`;

export class PenpotDropdown extends PenpotElement {
  _template = template;
  static get observedAttributes() { return ['value', 'label', 'placeholder', 'disabled']; }

  #open = false;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    const trigger = this.querySelector('#trigger');
    const overlay = this.querySelector('#overlay');

    trigger.addEventListener('click', () => {
      if (this.disabled) return;
      this.#open ? this.close() : this.open();
    });

    overlay.addEventListener('click', () => this.close());

    this.addEventListener('penpot-dropdown-item-select', (e) => {
      this.value = e.detail.value;
      this.emit('penpot-input', { value: e.detail.value, label: e.detail.label });
      this.close();
    });

    this.#update();
  }

  attributeChangedCallback() { this.#update(); }

  get value() { return this.getAttribute('value') || ''; }
  set value(v) { this.setAttribute('value', v); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  open() {
    this.#open = true;
    const trigger = this.querySelector('#trigger');
    const menu = this.querySelector('#menu');
    const overlay = this.querySelector('#overlay');
    trigger.classList.add('penpot-dd__open');
    trigger.setAttribute('aria-expanded', 'true');
    menu.classList.add('penpot-dd__open');
    overlay.classList.add('penpot-dd__open');
  }

  close() {
    this.#open = false;
    const trigger = this.querySelector('#trigger');
    const menu = this.querySelector('#menu');
    const overlay = this.querySelector('#overlay');
    trigger.classList.remove('penpot-dd__open');
    trigger.setAttribute('aria-expanded', 'false');
    menu.classList.remove('penpot-dd__open');
    overlay.classList.remove('penpot-dd__open');
  }

  #update() {
    const labelEl = this.querySelector('#label');
    const trigger = this.querySelector('#trigger');
    if (!labelEl) return;

    const placeholder = this.getAttribute('placeholder') || 'Select...';
    const val = this.getAttribute('value');
    let labelText = placeholder;

    if (val) {
      const items = this.querySelectorAll('penpot-dropdown-item');
      for (const item of items) {
        if (item.getAttribute('value') === val) {
          labelText = item.getAttribute('label') || item.textContent.trim() || val;
          break;
        }
      }
      if (labelText === placeholder) labelText = val;
    }

    labelEl.textContent = labelText;
    trigger.disabled = this.disabled;
  }

  render() {}
}

export class PenpotDropdownItem extends HTMLElement {
  static get observedAttributes() { return ['value', 'label', 'disabled']; }

  constructor() { super(); }

  connectedCallback() {
    this.style.cssText = 'padding:var(--penpot-spacing-xs,4px) var(--penpot-spacing-m,12px);font-size:var(--penpot-font-size-m,13px);color:var(--penpot-text,#e6e6e6);cursor:pointer;white-space:nowrap;';
    this.addEventListener('click', () => {
      if (this.hasAttribute('disabled')) return;
      this.closest('penpot-dropdown')?.dispatchEvent(new CustomEvent('penpot-dropdown-item-select', { detail: { value: this.getAttribute('value'), label: this.getAttribute('label') || this.textContent.trim() }, bubbles: true }));
    });
    this.addEventListener('mouseenter', () => {
      if (!this.hasAttribute('disabled')) this.style.background = 'var(--penpot-primary-bg,rgba(49,239,184,0.08))';
    });
    this.addEventListener('mouseleave', () => {
      this.style.background = '';
    });
  }
}

customElements.define('penpot-dropdown', PenpotDropdown);
customElements.define('penpot-dropdown-item', PenpotDropdownItem);