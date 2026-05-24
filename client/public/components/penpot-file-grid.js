import { cmd } from '../lib/rpc.js';
import { appStore } from '../lib/store.js';
import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-file-grid { display: block; }
    .penpot-fgrid__file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--penpot-spacing-m, 12px); }
    .penpot-fgrid__file-card { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); overflow: hidden; cursor: pointer; transition: border-color var(--penpot-transition-fast, 0.1s ease), background var(--penpot-transition-fast, 0.1s ease); }
    .penpot-fgrid__file-card:hover { border-color: var(--penpot-primary, #31efb8); background: var(--penpot-primary-bg-hover, rgba(49,239,184,0.05)); }
    .penpot-fgrid__file-thumb { width: 100%; aspect-ratio: 16/10; background: var(--penpot-bg, #1c1c1c); display: flex; align-items: center; justify-content: center; color: var(--penpot-text-disabled, #666); font-size: 28px; position: relative; overflow: hidden; }
    .penpot-fgrid__file-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .penpot-fgrid__file-thumb .penpot-fgrid__file-icon { font-size: 32px; color: var(--penpot-primary, #31efb8); }
    .penpot-fgrid__file-info { padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); }
    .penpot-fgrid__file-name { font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-fgrid__file-meta { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); margin-top: 2px; }
    .penpot-fgrid__file-new { border-style: dashed; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 140px; }
    .penpot-fgrid__file-new:hover { border-color: var(--penpot-primary, #31efb8); }
    .penpot-fgrid__file-new-icon { font-size: 28px; color: var(--penpot-primary, #31efb8); margin-bottom: var(--penpot-spacing-xs, 4px); }
    .penpot-fgrid__file-new-label { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); }
    .penpot-fgrid__empty-state { padding: var(--penpot-spacing-xxl, 32px); text-align: center; color: var(--penpot-text-dim, #999); }
    .penpot-fgrid__loading-state { padding: var(--penpot-spacing-xl, 24px); text-align: center; color: var(--penpot-text-dim, #999); }
  
  </style>
  <div id="container"></div>`;

export class PenpotFileGrid extends PenpotElement {
  _template = template;
  #files = [];
  #projectId = null;
  #loading = false;

  static get observedAttributes() { return ['project-id']; }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.#projectId = this.getAttribute('project-id');
    if (this.#projectId) this.loadFiles();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'project-id' && oldVal !== newVal) {
      this.#projectId = newVal;
      if (newVal) this.loadFiles();
    }
  }

  async loadFiles() {
    const container = this.querySelector('#container');
    this.#loading = true;
    container.innerHTML = '<div class="penpot-fgrid__loading-state">Loading files...</div>';

    try {
      const files = await cmd('get-project-files', { projectId: this.#projectId });
      this.#files = Array.isArray(files) ? files : [];
      this.renderFiles();
    } catch (err) {
      container.innerHTML = `<div class="penpot-fgrid__empty-state">Error loading files.</div>`;
      this.emit('penpot-error', { source: 'files', error: err });
    } finally {
      this.#loading = false;
    }
  }

  renderFiles() {
    const container = this.querySelector('#container');

    if (this.#files.length === 0 && !this.#loading) {
      container.innerHTML = `<div class="penpot-fgrid__file-grid">
        <div class="penpot-fgrid__file-card penpot-fgrid__file-new" id="new-file-card">
          <div class="penpot-fgrid__file-new-icon">+</div>
          <div class="penpot-fgrid__file-new-label">New file</div>
        </div>
      </div>`;
      this.querySelector('#new-file-card').addEventListener('click', () => {
        this.emit('penpot-create-file', { projectId: this.#projectId });
      });
      return;
    }

    let html = '<div class="penpot-fgrid__file-grid">';
    html += `<div class="penpot-fgrid__file-card penpot-fgrid__file-new" id="new-file-card">
      <div class="penpot-fgrid__file-thumb"><span class="penpot-fgrid__file-icon">+</span></div>
      <div class="penpot-fgrid__file-info"><div class="penpot-fgrid__file-name">New file</div><div class="penpot-fgrid__file-meta">Create new</div></div>
    </div>`;

    for (const file of this.#files) {
      const modified = file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : '';
      const thumbSrc = file.thumbnailUrl || file.thumbnail || '';
      html += `<div class="penpot-fgrid__file-card" data-file-id="${this.escAttr(file.id)}">
        <div class="penpot-fgrid__file-thumb">
          ${thumbSrc ? `<img src="${this.escAttr(thumbSrc)}" alt="" loading="lazy">` : '<span class="penpot-fgrid__file-icon">\u270E</span>'}
        </div>
        <div class="penpot-fgrid__file-info">
          <div class="penpot-fgrid__file-name">${this.escHtml(file.name || 'Untitled')}</div>
          <div class="penpot-fgrid__file-meta">${modified}</div>
        </div>
      </div>`;
    }

    html += '</div>';
    container.innerHTML = html;

    this.querySelector('#new-file-card').addEventListener('click', () => {
      this.emit('penpot-create-file', { projectId: this.#projectId });
    });

    this.querySelectorAll('.penpot-fgrid__file-card[data-file-id]').forEach(el => {
      el.addEventListener('click', () => {
        const fileId = el.dataset.fileId;
        this.emit('penpot-open-file', { fileId });
      });
    });
  }

  escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  render() {}
}

customElements.define('penpot-file-grid', PenpotFileGrid);