import { PenpotElement } from './base.js';
import './penpot-layer-panel.js';
import './penpot-asset-panel.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-left-sidebar { display: flex; flex-direction: column; width: var(--penpot-sidebar-width, 260px); background: var(--penpot-surface, #2a2a2a); border-right: 1px solid var(--penpot-border, #444); flex-shrink: 0; overflow: hidden; }
    .penpot-lside__sidebar-tabs { display: flex; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-lside__sidebar-tab { flex: 1; padding: 6px 0; font-size: 10px; text-align: center; cursor: pointer; color: var(--penpot-text-dim, #999); border: none; border-bottom: 2px solid transparent; background: none; font-family: inherit; }
    .penpot-lside__sidebar-tab:hover { color: var(--penpot-text, #e6e6e6); background: var(--penpot-surface-high, #333); }
    .penpot-lside__sidebar-tab.penpot-lside__active { color: var(--penpot-primary, #31efb8); border-bottom-color: var(--penpot-primary, #31efb8); }
    .penpot-lside__sidebar-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
    .penpot-lside__page-section { border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-lside__page-section-header { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; }
    .penpot-lside__page-section-title { font-size: 10px; color: var(--penpot-text-dim, #999); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .penpot-lside__page-section-toggle { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 10px; padding: 2px; }
    .penpot-lside__page-section-toggle:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-lside__page-section-actions { display: flex; gap: 4px; }
    .penpot-lside__page-add-btn { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 14px; padding: 0; line-height: 1; }
    .penpot-lside__page-add-btn:hover { color: var(--penpot-primary, #31efb8); }
    .penpot-lside__page-list { max-height: 140px; overflow-y: auto; }
    .penpot-lside__page-item { display: flex; align-items: center; gap: 4px; padding: 4px 12px; font-size: 11px; color: var(--penpot-text, #e6e6e6); cursor: pointer; }
    .penpot-lside__page-item:hover { background: var(--penpot-surface-high, #333); }
    .penpot-lside__page-item.penpot-lside__active { background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); color: var(--penpot-primary, #31efb8); }
    .penpot-lside__page-item .penpot-lside__page-icon { font-size: 14px; flex-shrink: 0; }
    .penpot-lside__page-item .penpot-lside__page-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-lside__page-item .penpot-lside__page-menu-btn { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 10px; padding: 0 2px; opacity: 0; }
    .penpot-lside__page-item:hover .penpot-lside__page-menu-btn { opacity: 1; }
    .penpot-lside__page-item .penpot-lside__page-menu-btn:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-lside__page-rename-input { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-primary, #31efb8); color: var(--penpot-text, #e6e6e6); font-size: 11px; padding: 0 4px; font-family: inherit; outline: none; }
    .penpot-lside__panel-container { flex: 1; overflow: hidden; }
    .penpot-lside__panel-container[hidden] { display: none; }
  
  </style>
  <div class="penpot-lside__sidebar-tabs">
    <button class="penpot-lside__sidebar-tab penpot-lside__active" data-tab="layers">Layers</button>
    <button class="penpot-lside__sidebar-tab" data-tab="assets">Assets</button>
    <button class="penpot-lside__sidebar-tab" data-tab="pages">Pages</button>
  </div>
  <div class="penpot-lside__sidebar-content">
    <div class="penpot-lside__page-section" id="pages-section">
      <div class="penpot-lside__page-section-header">
        <span class="penpot-lside__page-section-title">Pages</span>
        <div class="penpot-lside__page-section-actions">
          <button class="penpot-lside__page-add-btn" id="page-add-btn" title="Add page">+</button>
          <button class="penpot-lside__page-section-toggle" id="pages-toggle" title="Toggle pages">\u25BC</button>
        </div>
      </div>
      <div class="penpot-lside__page-list" id="page-list"></div>
    </div>
    <div class="penpot-lside__panel-container" id="layers-panel">
      <penpot-layer-panel id="layer-panel"></penpot-layer-panel>
    </div>
    <div class="penpot-lside__panel-container" id="assets-panel" hidden>
      <penpot-asset-panel id="asset-panel"></penpot-asset-panel>
    </div>
  </div>`;

export class PenpotLeftSidebar extends PenpotElement {
  #pages = [];
  #currentPageIndex = 0;
  #selectedIds = new Set();
  #activeTab = 'layers';
  #pagesCollapsed = false;

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelectorAll('.penpot-lside__sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.#activeTab = tab.dataset.tab;
        this.querySelectorAll('.penpot-lside__sidebar-tab').forEach(t => t.classList.toggle('penpot-lside__active', t.dataset.tab === this.#activeTab));
        this.#updatePanelVisibility();
      });
    });

    const toggle = this.querySelector('#pages-toggle');
    toggle.addEventListener('click', () => {
      this.#pagesCollapsed = !this.#pagesCollapsed;
      this.querySelector('#page-list').style.display = this.#pagesCollapsed ? 'none' : '';
      toggle.textContent = this.#pagesCollapsed ? '\u25B6' : '\u25BC';
    });

    this.querySelector('#page-add-btn').addEventListener('click', () => {
      this.emit('penpot-page-add', {});
    });

    const layerPanel = this.querySelector('#layer-panel');
    layerPanel.addEventListener('penpot-shape-select', (e) => {
      this.#selectedIds = new Set([e.detail.shapeId]);
      this.emit('penpot-shape-select', e.detail);
    });

    layerPanel.addEventListener('penpot-toggle-visibility', (e) => {
      this.emit('penpot-toggle-visibility', e.detail);
    });

    layerPanel.addEventListener('penpot-toggle-lock', (e) => {
      this.emit('penpot-toggle-lock', e.detail);
    });

    layerPanel.addEventListener('penpot-shape-reorder', (e) => {
      this.emit('penpot-shape-reorder', e.detail);
    });

    layerPanel.addEventListener('penpot-shape-rename', (e) => {
      this.emit('penpot-shape-rename', e.detail);
    });

    layerPanel.addEventListener('penpot-shape-context', (e) => {
      this.emit('penpot-shape-context', e.detail);
    });

    const assetPanel = this.querySelector('#asset-panel');
    assetPanel.addEventListener('penpot-asset-use', (e) => {
      this.emit('penpot-asset-use', e.detail);
    });

    assetPanel.addEventListener('penpot-font-upload', () => {
      this.emit('penpot-font-upload', {});
    });

    assetPanel.addEventListener('penpot-font-remove', (e) => {
      this.emit('penpot-font-remove', e.detail);
    });

    assetPanel.addEventListener('penpot-media-upload', (e) => {
      this.emit('penpot-media-upload', e.detail);
    });
  }

  set pages(val) {
    this.#pages = val || [];
    this.#renderPages();
  }

  get pages() { return this.#pages; }

  set currentPageIndex(val) {
    this.#currentPageIndex = val;
    this.#renderPages();
    this.#updateLayerPanel();
  }

  get currentPageIndex() { return this.#currentPageIndex; }

  set selectedIds(val) {
    this.#selectedIds = val || new Set();
    this.#updateLayerPanel();
    const layerPanel = this.querySelector('#layer-panel');
    if (layerPanel) layerPanel.selectedIds = this.#selectedIds;
  }

  get selectedIds() { return this.#selectedIds; }

  #updatePanelVisibility() {
    const layersPanel = this.querySelector('#layers-panel');
    const assetsPanel = this.querySelector('#assets-panel');
    const pagesSection = this.querySelector('#pages-section');

    layersPanel.hidden = this.#activeTab !== 'layers';
    assetsPanel.hidden = this.#activeTab !== 'assets';

    if (this.#activeTab === 'pages') {
      pagesSection.style.display = '';
      layersPanel.hidden = true;
    } else {
      pagesSection.style.display = '';
    }

    if (this.#activeTab === 'layers') {
      this.#updateLayerPanel();
    }
  }

  #updateLayerPanel() {
    const layerPanel = this.querySelector('#layer-panel');
    if (!layerPanel) return;
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const objects = page.objects || page.children || {};
    const shapes = Array.isArray(objects) ? objects : Object.values(objects);
    layerPanel.shapes = shapes;
    layerPanel.page = page;
  }

  #renderPages() {
    const list = this.querySelector('#page-list');
    if (!list) return;

    if (this.#pages.length === 0) {
      list.innerHTML = '<div style="color:var(--penpot-text-dim,#999);text-align:center;padding:12px;font-size:11px;">No pages.</div>';
      return;
    }

    let html = '';
    for (let i = 0; i < this.#pages.length; i++) {
      const page = this.#pages[i];
      const isActive = i === this.#currentPageIndex;
      html += `<div class="penpot-lside__page-item ${isActive ? 'penpot-lside__active' : ''}" data-page-index="${i}">
        <span class="penpot-lside__page-icon">\u{1F4C4}</span>
        <span class="penpot-lside__page-name">${this.escHtml(page.name || 'Page')}</span>
        <button class="penpot-lside__page-menu-btn" data-page-index="${i}" title="Page options">\u22EF</button>
      </div>`;
    }
    list.innerHTML = html;

    list.querySelectorAll('.penpot-lside__page-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('page-menu-btn')) return;
        const idx = parseInt(el.dataset.pageIndex, 10);
        this.#currentPageIndex = idx;
        this.emit('penpot-page-select', { pageIndex: idx, page: this.#pages[idx] });
        this.#renderPages();
        this.#updateLayerPanel();
      });
    });

    list.querySelectorAll('.penpot-lside__page-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.pageIndex, 10);
        const page = this.#pages[idx];
        this.#showPageContextMenu(btn, idx, page);
      });
    });
  }

  render() {
    this.#renderPages();
    this.#updateLayerPanel();
  }

  #showPageContextMenu(btn, pageIndex, page) {
    const existingMenu = this.querySelector('.penpot-lside__page-context-menu');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'penpot-lside__page-context-menu';
    menu.style.cssText = 'position:absolute;background:var(--penpot-surface-high,#333);border:1px solid var(--penpot-border,#444);border-radius:4px;padding:4px 0;z-index:100;min-width:120px;';
    const rect = btn.getBoundingClientRect();
    const hostRect = this.getBoundingClientRect();
    menu.style.left = (rect.left - hostRect.left + 20) + 'px';
    menu.style.top = (rect.top - hostRect.top) + 'px';

    const actions = [
      { label: 'Rename', action: () => this.#startRenamePage(pageIndex) },
    ];
    if (this.#pages.length > 1) {
      actions.push({ label: 'Duplicate', action: () => this.emit('penpot-page-duplicate', { pageIndex, page }) });
      actions.push({ label: 'Delete', action: () => this.emit('penpot-page-delete', { pageIndex, page }), danger: true });
    }

    for (const { label, action, danger } of actions) {
      const item = document.createElement('button');
      item.textContent = label;
      item.style.cssText = `display:block;width:100%;text-align:left;padding:6px 12px;border:none;background:none;color:${danger ? 'var(--penpot-danger,#f44)' : 'var(--penpot-text,#e6e6e6)'};font-size:11px;cursor:pointer;font-family:inherit;`;
      item.addEventListener('mouseenter', () => item.style.background = 'var(--penpot-surface-highest,#3c3c3c)');
      item.addEventListener('mouseleave', () => item.style.background = 'none');
      item.addEventListener('click', () => { menu.remove(); action(); });
      menu.appendChild(item);
    }

    this.appendChild(menu);
    const closeMenu = (e) => {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  #startRenamePage(pageIndex) {
    const list = this.querySelector('#page-list');
    const items = list.querySelectorAll('.penpot-lside__page-item');
    const item = items[pageIndex];
    if (!item) return;

    const nameSpan = item.querySelector('.penpot-lside__page-name');
    if (!nameSpan) return;
    const oldName = nameSpan.textContent;

    const input = document.createElement('input');
    input.className = 'penpot-lside__page-rename-input';
    input.value = oldName;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const newName = input.value.trim() || oldName;
      this.#pages[pageIndex].name = newName;
      input.replaceWith(nameSpan);
      nameSpan.textContent = newName;
      this.emit('penpot-page-rename', { pageIndex, newName });
    };

    input.addEventListener('blur', commit, { once: true });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = oldName; input.blur(); }
    });
  }

  escHtml(str) { const el = document.createElement('span'); el.textContent = str || ''; return el.innerHTML; }
}

customElements.define('penpot-left-sidebar', PenpotLeftSidebar);