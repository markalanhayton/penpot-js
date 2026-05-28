'use strict';

export class PenpotPathToolbar extends HTMLElement {
  #shadow = null;
  #editMode = 'move';
  #selectedCount = 0;
  #snapToggled = false;

  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
    this.#bindEvents();
  }

  disconnectedCallback() {}

  set state({ editMode, selectedCount, snapToggled }) {
    this.#editMode = editMode || 'move';
    this.#selectedCount = selectedCount || 0;
    this.#snapToggled = snapToggled || false;
    this.render();
  }

  render() {
    this.innerHTML = `
      <style>
        :host { display: block; }
        .penpot-path-toolbar {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 4px 8px;
          background: var(--penpot-bg, #2d2d2d);
          border: 1px solid var(--penpot-border, #444);
          border-radius: 6px;
          position: absolute;
          top: 44px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .penpot-path-toolbar__btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: var(--penpot-text, #ccc);
          cursor: pointer;
          font-size: 12px;
          padding: 0;
        }
        .penpot-path-toolbar__btn:hover { background: var(--penpot-hover, #3d3d3d); }
        .penpot-path-toolbar__btn.active { background: var(--penpot-primary, #31efb8); color: #000; }
        .penpot-path-toolbar__btn:disabled { opacity: 0.3; cursor: default; }
        .penpot-path-toolbar__sep {
          width: 1px;
          height: 20px;
          background: var(--penpot-border, #444);
          margin: 0 4px;
        }
        .penpot-path-toolbar__btn[title]::after { content: none; }
      </style>
      <div class="penpot-path-toolbar">
        <button class="penpot-path-toolbar__btn ${this.#editMode === 'move' ? 'active' : ''}"
                data-action="move" title="Move mode (M)">&#x270B;</button>
        <button class="penpot-path-toolbar__btn ${this.#editMode === 'draw' ? 'active' : ''}"
                data-action="draw" title="Draw mode (P)">&#x270E;</button>
        <div class="penpot-path-toolbar__sep"></div>
        <button class="penpot-path-toolbar__btn" data-action="add-node"
                title="Add node (Shift+)" ${this.#selectedCount > 0 ? '' : 'disabled'}>+</button>
        <button class="penpot-path-toolbar__btn" data-action="remove-node"
                title="Remove node (Del)" ${this.#selectedCount > 0 ? '' : 'disabled'}>&#x2212;</button>
        <div class="penpot-path-toolbar__sep"></div>
        <button class="penpot-path-toolbar__btn" data-action="make-corner"
                title="Make corner (X)" ${this.#selectedCount > 0 ? '' : 'disabled'}>&#x25CB;</button>
        <button class="penpot-path-toolbar__btn" data-action="make-curve"
                title="Make curve (C)" ${this.#selectedCount > 0 ? '' : 'disabled'}>&#x25CF;</button>
        <div class="penpot-path-toolbar__sep"></div>
        <button class="penpot-path-toolbar__btn" data-action="merge-nodes"
                title="Merge nodes (Shift+J)" ${this.#selectedCount >= 2 ? '' : 'disabled'}>&#x229E;</button>
        <button class="penpot-path-toolbar__btn" data-action="join-nodes"
                title="Join nodes (J)" ${this.#selectedCount >= 2 ? '' : 'disabled'}>&#x2194;</button>
        <button class="penpot-path-toolbar__btn" data-action="separate-nodes"
                title="Separate nodes (K)" ${this.#selectedCount > 0 ? '' : 'disabled'}>&#x2195;</button>
        <div class="penpot-path-toolbar__sep"></div>
        <button class="penpot-path-toolbar__btn ${this.#snapToggled ? 'active' : ''}"
                data-action="toggle-snap" title="Toggle snap (S)">&#x2913;</button>
      </div>
    `;
  }

  #bindEvents() {
    this.addEventListener('click', (e) => {
      const btn = e.target.closest('.penpot-path-toolbar__btn');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action) {
        this.dispatchEvent(new CustomEvent('penpot-path-action', {
          detail: { action },
          bubbles: true,
          composed: true,
        }));
      }
    });
  }
}

customElements.define('penpot-path-toolbar', PenpotPathToolbar);