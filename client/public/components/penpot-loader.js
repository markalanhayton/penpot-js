import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-loader { display: inline-flex; align-items: center; justify-content: center; }
    .penpot-loader__spinner { width: var(--penpot-loader-size, 18px); height: var(--penpot-loader-size, 18px); border: calc(var(--penpot-loader-size, 18px) / 6) solid var(--penpot-loader-track, var(--penpot-border, #444)); border-top-color: var(--penpot-loader-color, var(--penpot-primary, #31efb8)); border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .penpot-loader__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
  
  </style>
  <div class="penpot-loader__spinner" role="status"><span class="penpot-loader__sr-only">Loading...</span></div>`;

export class PenpotLoader extends PenpotElement {
  _template = template;
  static get observedAttributes() { return ['size', 'color']; }

  constructor() {
    super();
  }

  connectedCallback() { super.connectedCallback(); this.#update(); }
  attributeChangedCallback() { this.#update(); }

  #update() {
    const size = this.getAttribute('size') || '18px';
    const color = this.getAttribute('color');
    this.style.setProperty('--penpot-loader-size', size);
    if (color) this.style.setProperty('--penpot-loader-color', color);
  }

  render() {}
}

customElements.define('penpot-loader', PenpotLoader);