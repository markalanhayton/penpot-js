import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-project-card { display: block; }
    .penpot-project__project-card { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-l, 16px); cursor: pointer; transition: border-color var(--penpot-transition-fast, 0.1s ease); }
    .penpot-project__project-card:hover { border-color: var(--penpot-primary, #31efb8); }
    .penpot-project__project-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--penpot-spacing-s, 8px); }
    .penpot-project__project-name { font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .penpot-project__project-menu { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; padding: 2px 4px; font-size: 16px; line-height: 1; }
    .penpot-project__project-menu:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-project__project-meta { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); }
    .penpot-project__project-actions { display: flex; gap: var(--penpot-spacing-xs, 4px); margin-top: var(--penpot-spacing-s, 8px); }
    .penpot-project__project-actions button { font-size: var(--penpot-font-size-xs, 10px); background: none; border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text-dim, #999); padding: 2px 8px; cursor: pointer; }
    .penpot-project__project-actions button:hover { border-color: var(--penpot-primary, #31efb8); color: var(--penpot-primary, #31efb8); }
  
  </style>
  <div class="penpot-project__project-card" id="card">
    <div class="penpot-project__project-header">
      <span class="penpot-project__project-name" id="name"></span>
      <button class="penpot-project__project-menu" id="menu-btn" title="More">⋮</button>
    </div>
    <div class="penpot-project__project-meta" id="meta"></div>
    <div class="penpot-project__project-actions">
      <button id="rename-btn">Rename</button>
      <button id="delete-btn">Delete</button>
    </div>
  </div>`;

export class PenpotProjectCard extends PenpotElement {
  #project = null;

  static get observedAttributes() { return ['project-id', 'project-name', 'file-count']; }

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#card').addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      this.emit('penpot-project-open', { project: this.#project });
    });
    this.querySelector('#rename-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.emit('penpot-project-rename', { project: this.#project });
    });
    this.querySelector('#delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.emit('penpot-project-delete', { project: this.#project });
    });
  }

  set project(proj) {
    this.#project = proj;
    this.#update();
  }

  get project() { return this.#project; }

  attributeChangedCallback() { this.#update(); }

  #update() {
    const nameEl = this.querySelector('#name');
    const metaEl = this.querySelector('#meta');
    if (!nameEl) return;

    const name = this.getAttribute('project-name') || this.#project?.name || 'Project';
    const fileCount = this.getAttribute('file-count') ?? this.#project?.fileCount ?? 0;
    nameEl.textContent = name;
    metaEl.textContent = `${fileCount} file${fileCount !== 1 ? 's' : ''}`;
  }

  render() {}
}

customElements.define('penpot-project-card', PenpotProjectCard);