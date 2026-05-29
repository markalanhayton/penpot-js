'use strict';
import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-switch { display: inline-flex; align-items: center; gap: var(--penpot-spacing-s, 8px); cursor: pointer; user-select: none; }
    penpot-switch[disabled] { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .penpot-switch__switch-track { position: relative; width: 30px; height: 18px; background: var(--penpot-text-dim, #8f9da3); border-radius: 12px; transition: background var(--penpot-transition-fast, 0.1s ease); flex-shrink: 0; }
    .penpot-switch__switch-thumb { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: var(--penpot-accent-off, #f3f4f6); border-radius: 50%; transition: transform var(--penpot-transition-fast, 0.1s ease); }
    penpot-switch[checked] .penpot-switch__switch-track { background: var(--penpot-accent-tertiary, #00d1b8); }
    penpot-switch[checked] .penpot-switch__switch-thumb { transform: translateX(12px); }
    penpot-switch:hover .penpot-switch__switch-thumb { background: var(--penpot-text, #fff); }
    penpot-switch:focus-within .penpot-switch__switch-track { outline: var(--penpot-focus-outline, 2px solid var(--penpot-accent, #7efff5)); outline-offset: var(--penpot-focus-outline-offset, -3px); }
    .penpot-switch__switch-label { font-size: var(--penpot-font-size-s, 12px); color: var(--penpot-text, #fff); line-height: 1; }
    input[type="checkbox"] { position: absolute; opacity: 0; width: 0; height: 0; }
  
  </style>
  <label class="penpot-switch__switch-track" id="track" role="switch" aria-checked="false">
    <span class="penpot-switch__switch-thumb" id="thumb"></span>
    <input type="checkbox" id="input" aria-hidden="true" tabindex="-1">
  </label>
  <span class="penpot-switch__switch-label" id="label"><slot></slot></span>`;

export class PenpotSwitch extends PenpotElement {
  _template = template;
  static get observedAttributes() { return ['checked', 'disabled', 'label']; }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.#update();
    const input = this.querySelector('#input');
    input.addEventListener('change', () => {
      if (this.disabled) return;
      this.checked = input.checked;
      this.emit('penpot-change', { checked: this.checked });
    });
  }

  attributeChangedCallback() { this.#update(); }

  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { v ? this.setAttribute('checked', '') : this.removeAttribute('checked'); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  #update() {
    const input = this.querySelector('#input');
    const track = this.querySelector('#track');
    if (input) {
      input.checked = this.checked;
      input.disabled = this.disabled;
    }
    if (track) {
      track.setAttribute('aria-checked', this.checked ? 'true' : 'false');
    }
  }

  render() {}
}

customElements.define('penpot-switch', PenpotSwitch);