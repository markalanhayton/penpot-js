import { PenpotElement } from './base.js';
import './penpot-presence-bar.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-toolbar { display: flex; align-items: center; height: var(--penpot-topbar-height, 44px); padding: 0 var(--penpot-spacing-m, 12px); background: var(--penpot-surface, #2a2a2a); border-bottom: 1px solid var(--penpot-border, #444); gap: var(--penpot-spacing-s, 8px); flex-shrink: 0; }
    .penpot-toolbar__back-btn { background: none; border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: var(--penpot-spacing-xs, 4px); white-space: nowrap; }
    .penpot-toolbar__back-btn:hover { background: var(--penpot-surface-high, #333); }
    .penpot-toolbar__separator { width: 1px; height: 20px; background: var(--penpot-border, #444); }
    .penpot-toolbar__file-name { font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text-dim, #999); margin-left: var(--penpot-spacing-s, 8px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px; cursor: default; padding: 2px 4px; border-radius: var(--penpot-radius-xs, 2px); }
    .penpot-toolbar__file-name:hover { background: var(--penpot-surface-high, #333); }
    .penpot-toolbar__file-name[contenteditable="true"] { background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-primary, #31efb8); border-radius: var(--penpot-radius-s, 4px); outline: none; color: var(--penpot-text, #e6e6e6); }
    .penpot-toolbar__spacer { flex: 1; }
    .penpot-toolbar__toolbar-actions { display: flex; gap: var(--penpot-spacing-xs, 4px); align-items: center; }
    .penpot-toolbar__toolbar-btn { background: none; border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); cursor: pointer; font-size: 12px; white-space: nowrap; }
    .penpot-toolbar__toolbar-btn:hover { background: var(--penpot-surface-high, #333); border-color: var(--penpot-border-hover, #666); }
    .penpot-toolbar__toolbar-btn.penpot-toolbar__primary { background: var(--penpot-primary, #31efb8); color: var(--penpot-text-inverse, #111); border-color: var(--penpot-primary, #31efb8); }
    .penpot-toolbar__toolbar-btn.penpot-toolbar__primary:hover { background: var(--penpot-primary-hover, #28d4a3); }
    .penpot-toolbar__toolbar-btn.penpot-toolbar__danger { color: var(--penpot-danger, #f44); }
    .penpot-toolbar__toolbar-btn.penpot-toolbar__danger:hover { background: var(--penpot-danger-bg, rgba(244,67,54,0.08)); }
    .penpot-toolbar__toolbar-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  
  </style>
  <button class="penpot-toolbar__back-btn" id="back">&larr; Dashboard</button>
  <div class="penpot-toolbar__separator"></div>
  <span class="penpot-toolbar__file-name" id="file-name">Untitled file</span>
  <span class="penpot-toolbar__spacer"></span>
  <penpot-presence-bar id="presence"></penpot-presence-bar>
  <div class="penpot-toolbar__toolbar-actions">
    <button class="penpot-toolbar__toolbar-btn" id="comment-btn" title="Comments (C)">&#128172;</button>
    <button class="penpot-toolbar__toolbar-btn" id="undo-btn" title="Undo (Ctrl+Z)">&#8630;</button>
    <button class="penpot-toolbar__toolbar-btn" id="redo-btn" title="Redo (Ctrl+Y)">&#8631;</button>
    <button class="penpot-toolbar__toolbar-btn" id="component-btn" title="Create Component (Ctrl+Alt+K)">&#9733;</button>
    <button class="penpot-toolbar__toolbar-btn" id="align-left-btn" title="Align Left">&#8676;</button>
    <button class="penpot-toolbar__toolbar-btn" id="align-center-h-btn" title="Align Center Horizontal">&#8596;</button>
    <button class="penpot-toolbar__toolbar-btn" id="align-right-btn" title="Align Right">&#8677;</button>
    <button class="penpot-toolbar__toolbar-btn" id="align-top-btn" title="Align Top">&#8673;</button>
    <button class="penpot-toolbar__toolbar-btn" id="align-center-v-btn" title="Align Center Vertical">&#8597;</button>
    <button class="penpot-toolbar__toolbar-btn" id="align-bottom-btn" title="Align Bottom">&#8675;</button>
    <button class="penpot-toolbar__toolbar-btn" id="export-btn" title="Export (Ctrl+E)">Export</button>
    <button class="penpot-toolbar__toolbar-btn" id="version-btn" title="Version History">&#128337;</button>
    <button class="penpot-toolbar__toolbar-btn" id="mcp-btn" title="MCP Panel (Ctrl+Shift+M)">&#x1F916;</button>
    <button class="penpot-toolbar__toolbar-btn" id="share-btn" title="Share">Share</button>
    <button class="penpot-toolbar__toolbar-btn penpot-toolbar__primary" id="save-btn">Save</button>
  </div>`;

export class PenpotToolbar extends PenpotElement {
  _template = template;
  #fileName = 'Untitled file';

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#back').addEventListener('click', () => {
      this.emit('penpot-back-to-dashboard', {});
    });
    this.querySelector('#save-btn').addEventListener('click', () => {
      this.emit('penpot-save', { name: this.#fileName });
    });
    this.querySelector('#share-btn').addEventListener('click', () => {
      this.emit('penpot-share', {});
    });
    this.querySelector('#export-btn').addEventListener('click', () => {
      this.emit('penpot-export', {});
    });
    this.querySelector('#version-btn').addEventListener('click', () => {
      this.emit('penpot-version-toggle', {});
    });
    this.querySelector('#mcp-btn').addEventListener('click', () => {
      this.emit('penpot-mcp-toggle', {});
    });
    this.querySelector('#comment-btn').addEventListener('click', () => {
      this.emit('penpot-comment-toggle', {});
    });
    this.querySelector('#undo-btn').addEventListener('click', () => {
      this.emit('penpot-undo', {});
    });
    this.querySelector('#redo-btn').addEventListener('click', () => {
      this.emit('penpot-redo', {});
    });
    this.querySelector('#component-btn').addEventListener('click', () => {
      this.emit('penpot-create-component', {});
    });
    this.querySelector('#align-left-btn').addEventListener('click', () => {
      this.emit('penpot-align', { alignment: 'left' });
    });
    this.querySelector('#align-center-h-btn').addEventListener('click', () => {
      this.emit('penpot-align', { alignment: 'center-h' });
    });
    this.querySelector('#align-right-btn').addEventListener('click', () => {
      this.emit('penpot-align', { alignment: 'right' });
    });
    this.querySelector('#align-top-btn').addEventListener('click', () => {
      this.emit('penpot-align', { alignment: 'top' });
    });
    this.querySelector('#align-center-v-btn').addEventListener('click', () => {
      this.emit('penpot-align', { alignment: 'center-v' });
    });
    this.querySelector('#align-bottom-btn').addEventListener('click', () => {
      this.emit('penpot-align', { alignment: 'bottom' });
    });

    const nameEl = this.querySelector('#file-name');
    nameEl.addEventListener('dblclick', () => {
      nameEl.contentEditable = true;
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });
    nameEl.addEventListener('blur', () => {
      nameEl.contentEditable = false;
      this.#fileName = nameEl.textContent.trim() || 'Untitled';
      this.emit('penpot-file-rename', { name: this.#fileName });
    });
    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
      if (e.key === 'Escape') { nameEl.blur(); }
    });
  }

  set fileName(name) {
    this.#fileName = name || 'Untitled';
    const el = this.querySelector('#file-name');
    if (el && !el.contentEditable || el.contentEditable === 'false') {
      el.textContent = this.#fileName;
    }
  }

  get fileName() { return this.#fileName; }

  render() {}
}

customElements.define('penpot-toolbar', PenpotToolbar);