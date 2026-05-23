import { PenpotElement } from './base.js';

let modalCounter = 0;

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: var(--penpot-z-modal, 100); display: none; }
    penpot-modal.penpot-modal__open { display: flex; }
    .penpot-modal__backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); }
    .penpot-modal__modal { position: relative; z-index: 1; display: flex; flex-direction: column; background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-l, 12px); box-shadow: var(--penpot-shadow-xl, 0 16px 48px rgba(0,0,0,0.6)); max-height: 80vh; margin: auto; overflow: hidden; }
    .penpot-modal__modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--penpot-spacing-m, 12px) var(--penpot-spacing-l, 16px); border-bottom: 1px solid var(--penpot-border, #444); }
    .penpot-modal__modal-title { font-size: var(--penpot-font-size-l, 16px); font-weight: 600; color: var(--penpot-text, #e6e6e6); margin: 0; }
    .penpot-modal__modal-close { background: none; border: none; color: var(--penpot-text-dim, #999); font-size: 20px; line-height: 1; cursor: pointer; padding: 4px 8px; border-radius: var(--penpot-radius-s, 4px); }
    .penpot-modal__modal-close:hover { color: var(--penpot-text, #e6e6e6); background: var(--penpot-surface-high, #333); }
    .penpot-modal__modal-body { flex: 1; overflow-y: auto; padding: var(--penpot-spacing-l, 16px); }
    .penpot-modal__modal-footer { display: flex; justify-content: flex-end; gap: var(--penpot-spacing-s, 8px); padding: var(--penpot-spacing-m, 12px) var(--penpot-spacing-l, 16px); border-top: 1px solid var(--penpot-border, #444); }
    penpot-modal[size="small"] .penpot-modal__modal { width: 320px; }
    penpot-modal[size="medium"] .penpot-modal__modal, .penpot-modal__modal { width: 480px; }
    penpot-modal[size="large"] .penpot-modal__modal { width: 640px; }
  
  </style>
  <div class="penpot-modal__backdrop" id="backdrop"></div>
  <div class="penpot-modal__modal">
    <div class="penpot-modal__modal-header">
      <h3 class="penpot-modal__modal-title" id="title"></h3>
      <button class="penpot-modal__modal-close" id="close" title="Close">&times;</button>
    </div>
    <div class="penpot-modal__modal-body"><slot></slot></div>
    <div class="penpot-modal__modal-footer" id="footer"><slot name="footer"></slot></div>
  </div>`;

export class PenpotModal extends PenpotElement {
  static get observedAttributes() { return ['title', 'size']; }

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.querySelector('#backdrop').addEventListener('click', () => this.close());
    this.querySelector('#close').addEventListener('click', () => this.close());
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
    this.#update();
  }

  attributeChangedCallback() { this.#update(); }

  #update() {
    const title = this.querySelector('#title');
    if (title) title.textContent = this.getAttribute('title') || '';
  }

  open() {
    this.classList.add('penpot-modal__open');
    this.emit('penpot-modal-open', {});
  }

  close() {
    this.classList.remove('penpot-modal__open');
    this.emit('penpot-modal-close', {});
  }

  get isOpen() { return this.classList.contains('open'); }

  render() {}
}

customElements.define('penpot-modal', PenpotModal);