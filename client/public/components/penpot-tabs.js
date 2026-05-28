'use strict';
import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-tabs { display: block; }
    .penpot-tabs__tabs { display: flex; border-bottom: 1px solid var(--penpot-border, #444); }
    .penpot-tabs__tab { flex: 1; padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); font-size: var(--penpot-font-size-s, 11px); text-align: center; color: var(--penpot-text-dim, #999); border: none; border-bottom: 2px solid transparent; background: none; cursor: pointer; font-family: inherit; transition: color var(--penpot-transition-fast, 0.1s ease); }
    .penpot-tabs__tab:hover { color: var(--penpot-text, #e6e6e6); background: var(--penpot-surface-high, #333); }
    .penpot-tabs__tab.penpot-tabs__active { color: var(--penpot-primary, #31efb8); border-bottom-color: var(--penpot-primary, #31efb8); }
    .penpot-tabs__tab:disabled { opacity: 0.4; cursor: not-allowed; }
    .penpot-tabs__tab:focus-visible { outline: var(--penpot-focus-outline); outline-offset: var(--penpot-focus-outline-offset); }
    .penpot-tabs__tab-content { display: none; }
    .penpot-tabs__tab-content.penpot-tabs__active { display: block; }
  
  </style>
  <div class="penpot-tabs__tabs" id="tabs"></div>
  <div id="panels"><slot></slot></div>`;

export class PenpotTabs extends PenpotElement {
  _template = template;
  static get observedAttributes() { return ['selected']; }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.#renderTabs();
    this.#showPanel(this.selected);
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'selected' && oldVal !== newVal) {
      this.#showPanel(newVal);
    }
  }

  get selected() { return this.getAttribute('selected') || '0'; }
  set selected(v) { this.setAttribute('selected', String(v)); }

  #renderTabs() {
    const tabs = this.querySelector('#tabs');
    const panels = this.querySelectorAll('penpot-tab-panel');
    tabs.innerHTML = '';

    panels.forEach((panel, i) => {
      const btn = document.createElement('button');
      btn.className = 'penpot-tabs__tab';
      btn.textContent = panel.getAttribute('label') || `Tab ${i + 1}`;
      btn.dataset.index = String(i);
      if (this.selected === String(i)) btn.classList.add('penpot-tabs__active');
      if (panel.hasAttribute('disabled')) btn.disabled = true;
      btn.addEventListener('click', () => {
        this.selected = String(i);
        this.emit('penpot-tab-select', { index: i, label: panel.getAttribute('label') });
      });
      tabs.appendChild(btn);
    });
  }

  #showPanel(index) {
    const panels = this.querySelectorAll('penpot-tab-panel');
    const tabs = this.querySelector('#tabs');

    panels.forEach((panel, i) => {
      panel.classList.toggle('penpot-tabs__active', String(i) === String(index));
      panel.style.display = String(i) === String(index) ? 'block' : 'none';
    });

    if (tabs) {
      tabs.querySelectorAll('.penpot-tabs__tab').forEach((tab, i) => {
        tab.classList.toggle('penpot-tabs__active', String(i) === String(index));
      });
    }
  }

  render() {}
}

export class PenpotTabPanel extends HTMLElement {
  static get observedAttributes() { return ['label', 'disabled']; }

  constructor() { super(); }

  connectedCallback() {
    if (!this.classList.contains('penpot-tabs__tab-content')) this.classList.add('penpot-tabs__tab-content');
  }

  attributeChangedCallback() {}
}

customElements.define('penpot-tabs', PenpotTabs);
customElements.define('penpot-tab-panel', PenpotTabPanel);