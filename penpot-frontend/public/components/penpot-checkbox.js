import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-checkbox { display: inline-flex; align-items: center; cursor: pointer; }
    .penpot-cb__checkbox-wrapper { display: inline-flex; align-items: center; gap: var(--penpot-spacing-s, 8px); cursor: pointer; user-select: none; }
    .penpot-cb__checkbox-box { width: 16px; height: 16px; border: 2px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-xs, 2px); display: flex; align-items: center; justify-content: center; background: var(--penpot-input-bg, #333); transition: background var(--penpot-transition-fast, 0.1s ease), border-color var(--penpot-transition-fast, 0.1s ease); flex-shrink: 0; }
    .penpot-cb__checkbox-box:hover { border-color: var(--penpot-border-hover, #666); }
    .penpot-cb__checkbox-box.penpot-cb__checked { background: var(--penpot-primary, #31efb8); border-color: var(--penpot-primary, #31efb8); }
    .penpot-cb__checkbox-box.penpot-cb__checked .penpot-cb__check { display: block; }
    .penpot-cb__checkbox-box .penpot-cb__check { display: none; color: var(--penpot-text-inverse, #111); font-size: 12px; line-height: 1; }
    .penpot-cb__checkbox-box.penpot-cb__disabled { opacity: 0.5; cursor: not-allowed; }
    .penpot-cb__checkbox-label { font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); }
    .penpot-cb__checkbox-label.penpot-cb__disabled { color: var(--penpot-text-disabled, #666); }
    penpot-checkbox:focus-within .penpot-cb__checkbox-box { outline: var(--penpot-focus-outline, 2px solid var(--penpot-primary, #31efb8)); outline-offset: var(--penpot-focus-outline-offset, 2px); }
  
  </style>
  <label class="penpot-cb__checkbox-wrapper">
    <span class="penpot-cb__checkbox-box" id="box"><span class="penpot-cb__check">\u2713</span></span>
    <span class="penpot-cb__checkbox-label" id="label"><slot></slot></span>
    <input type="checkbox" id="input" style="position:absolute;opacity:0;width:0;height:0;" />
  </label>`;

export class PenpotCheckbox extends PenpotElement {
  static get observedAttributes() { return ['checked', 'disabled', 'label']; }

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.#update();
    const input = this.querySelector('#input');
    input.addEventListener('change', () => {
      if (!this.disabled) {
        this.checked = input.checked;
        this.emit('penpot-change', { checked: this.checked });
      }
    });
  }

  attributeChangedCallback() { this.#update(); }

  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { v ? this.setAttribute('checked', '') : this.removeAttribute('checked'); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  #update() {
    const box = this.querySelector('#box');
    const label = this.querySelector('#label');
    const input = this.querySelector('#input');
    if (!box) return;

    box.classList.toggle('penpot-cb__checked', this.checked);
    box.classList.toggle('penpot-cb__disabled', this.disabled);
    label.classList.toggle('penpot-cb__disabled', this.disabled);
    input.checked = this.checked;
    input.disabled = this.disabled;
  }

  render() {}
}

customElements.define('penpot-checkbox', PenpotCheckbox);