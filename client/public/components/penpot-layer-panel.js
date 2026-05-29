'use strict';
import { PenpotElement } from './base.js';
import { isFrame, isGroup, isBool } from '../lib/types.js';
import { isComponentInstance, isComponentMain, isVariantContainer } from '../lib/components-lib.js';

const INDENT = 16;
const DROP_ZONE_THRESHOLD = 6;
const VISIBILITY_ON = '\u{1F441}';
const VISIBILITY_OFF = '\u{25CE}';
const LOCK_ON = '\u{1F512}';
const LOCK_OFF = '';
const COLLAPSE_ARROW = '\u25B6';
const EXPAND_ARROW = '\u25BC';

const SHAPE_ICONS = {
  frame: '\u25A1', group: '\u2299', rect: '\u25AD', circle: '\u25CB', ellipse: '\u25CB',
  path: '\u270E', text: 'T', image: '\u25B3', 'svg-raw': '\u2605', bool: '\u2229',
  'masked-group': '\u25D3',
};

function buildBadgeHtml(shape, escHtmlFn) {
  const parts = [];
  if (isVariantContainer(shape)) {
    parts.push('<span class="penpot-layer__variant-badge">\u25C6</span>');
  } else if (isComponentInstance(shape)) {
    parts.push('<span class="penpot-layer__instance-badge">\u25C6</span>');
  } else if (isComponentMain(shape)) {
    parts.push('<span class="penpot-layer__instance-badge">\u2605</span>');
  }
  const vProps = shape['variant-properties'] || shape.variantProperties;
  if (vProps && vProps.length > 0) {
    const displayName = vProps.map(p => p.value || '').filter(v => v).join(' / ');
    if (displayName) {
      parts.push(`<span class="penpot-layer__variant-name">${escHtmlFn(displayName)}</span>`);
    }
  }
  return parts.join('');
}

const FILTER_TYPES = [
  { id: 'all', label: 'All', types: null },
  { id: 'frame', label: 'Frames', types: ['frame'] },
  { id: 'group', label: 'Groups', types: ['group'] },
  { id: 'text', label: 'Text', types: ['text'] },
  { id: 'image', label: 'Images', types: ['image'] },
  { id: 'shape', label: 'Shapes', types: ['rect', 'circle', 'path', 'bool', 'svg-raw'] },
];

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-layer-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .penpot-layer__layer-toolbar { display: flex; align-items: center; gap: 2px; padding: 4px 8px; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-layer__layer-toolbar-btn { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; padding: 2px 6px; border-radius: var(--penpot-radius-s, 4px); font-size: 12px; line-height: 1; }
    .penpot-layer__layer-toolbar-btn:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
    .penpot-layer__search-bar { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-layer__search-input { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: 3px 6px; font-size: 11px; outline: none; }
    .penpot-layer__search-input:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-layer__search-input::placeholder { color: var(--penpot-text-dim, #999); }
    .penpot-layer__search-clear { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 12px; padding: 0 2px; line-height: 1; }
    .penpot-layer__search-clear:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-layer__filter-bar { display: flex; flex-wrap: wrap; gap: 2px; padding: 4px 8px; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-layer__filter-btn { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text-dim, #999); font-size: 9px; padding: 1px 5px; cursor: pointer; }
    .penpot-layer__filter-btn:hover { color: var(--penpot-text, #e6e6e6); border-color: #666; }
    .penpot-layer__filter-btn.penpot-layer__active { background: rgba(49,239,184,0.15); color: var(--penpot-primary, #31efb8); border-color: var(--penpot-primary, #31efb8); }
    .penpot-layer__layer-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; }
    .penpot-layer__layer-item { display: flex; align-items: center; gap: 4px; padding: 3px 8px 3px 0; font-size: 11px; color: var(--penpot-text, #e6e6e6); cursor: pointer; user-select: none; min-height: 24px; border-radius: 0; transition: background 0.1s; }
    .penpot-layer__layer-item:hover { background: var(--penpot-surface-high, #333); }
    .penpot-layer__layer-item.penpot-layer__selected { background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); color: var(--penpot-primary, #31efb8); }
    .penpot-layer__layer-item.penpot-layer__locked { opacity: 0.5; }
    .penpot-layer__layer-item.penpot-layer__hidden-shape { opacity: 0.4; text-decoration: line-through; }
    .penpot-layer__layer-item.penpot-layer__match-highlight { background: rgba(49,239,184,0.06); }
    .penpot-layer__layer-toggle { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; padding: 0 2px; font-size: 10px; min-width: 16px; text-align: center; flex-shrink: 0; }
    .penpot-layer__layer-toggle:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-layer__layer-toggle.penpot-layer__off { color: var(--penpot-text-disabled, #555); }
    .penpot-layer__layer-collapse { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; padding: 0; font-size: 8px; width: 16px; text-align: center; flex-shrink: 0; }
    .penpot-layer__layer-collapse:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-layer__layer-icon { font-size: 10px; width: 16px; text-align: center; flex-shrink: 0; }
    .penpot-layer__instance-badge { color: var(--penpot-primary, #31efb8); font-size: 9px; margin-left: 1px; }
    .penpot-layer__variant-badge { color: var(--penpot-accent, #c084fc); font-size: 9px; margin-left: 1px; }
    .penpot-layer__variant-name { color: var(--penpot-text-dim, #999); font-size: 8px; margin-left: 2px; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80px; }
    .penpot-layer__layer-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .penpot-layer__layer-name mark { background: rgba(49,239,184,0.3); color: var(--penpot-primary, #31efb8); border-radius: 1px; padding: 0 1px; }
    .penpot-layer__layer-name-input { background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-primary, #31efb8); color: var(--penpot-text, #e6e6e6); font-size: 11px; padding: 0 2px; outline: none; width: 100%; }
    .penpot-layer__empty-state { color: var(--penpot-text-dim, #999); text-align: center; padding: 24px 12px; font-size: 11px; }
    .penpot-layer__drag-indicator { height: 2px; background: var(--penpot-primary, #31efb8); margin: -1px 0; pointer-events: none; }
    .penpot-layer__drop-into { outline: 2px solid var(--penpot-primary, #31efb8); outline-offset: -2px; background: rgba(49,239,184,0.08) !important; }
    .penpot-layer__search-count { font-size: 9px; color: var(--penpot-text-dim, #999); flex-shrink: 0; }
  
  </style>
  <div class="penpot-layer__layer-toolbar">
    <button class="penpot-layer__layer-toolbar-btn" id="btn-collapse-all" title="Collapse all">\u25B2 Collapse</button>
    <button class="penpot-layer__layer-toolbar-btn" id="btn-expand-all" title="Expand all">\u25BC Expand</button>
  </div>
  <div class="penpot-layer__search-bar">
    <input class="penpot-layer__search-input" id="search-input" type="text" placeholder="Search layers\u2026">
    <span class="penpot-layer__search-count" id="search-count"></span>
    <button class="penpot-layer__search-clear" id="search-clear" title="Clear search" style="display:none;">\u00D7</button>
  </div>
  <div class="penpot-layer__filter-bar" id="filter-bar"></div>
  <div class="penpot-layer__layer-scroll" id="layer-list"></div>`;

export class PenpotLayerPanel extends PenpotElement {
  _template = template;
  #shapes = [];
  #selectedIds = new Set();
  #collapsedIds = new Set();
  #page = null;
  #dragState = null;
  #searchText = '';
  #activeFilter = 'all';

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#btn-collapse-all').addEventListener('click', () => this.#collapseAll());
    this.querySelector('#btn-expand-all').addEventListener('click', () => this.#expandAll());

    const searchInput = this.querySelector('#search-input');
    searchInput.addEventListener('input', () => {
      this.#searchText = searchInput.value.trim();
      this.querySelector('#search-clear').style.display = this.#searchText ? '' : 'none';
      this.render();
    });
    this.querySelector('#search-clear').addEventListener('click', () => {
      this.#searchText = '';
      searchInput.value = '';
      this.querySelector('#search-clear').style.display = 'none';
      this.render();
    });

    const filterBar = this.querySelector('#filter-bar');
    FILTER_TYPES.forEach(f => {
      const btn = document.createElement('button');
      btn.className = `penpot-layer__filter-btn ${f.id === 'all' ? 'penpot-layer__active' : ''}`;
      btn.dataset.filter = f.id;
      btn.textContent = f.label;
      btn.addEventListener('click', () => {
        this.#activeFilter = f.id;
        filterBar.querySelectorAll('.penpot-layer__filter-btn').forEach(b => b.classList.toggle('penpot-layer__active', b.dataset.filter === f.id));
        this.render();
      });
      filterBar.appendChild(btn);
    });
  }

  set shapes(val) {
    this.#shapes = val || [];
    this.render();
  }

  get shapes() { return this.#shapes; }

  set selectedIds(val) {
    this.#selectedIds = val || new Set();
    this.#highlightSelected();
  }

  set page(val) {
    this.#page = val;
  }

  #flattenShapes(shapes, depth, parentId, result) {
    const objectsMap = this.#page ? (this.#page.objects || this.#page.children) : null;
    const isFlatMap = objectsMap && !Array.isArray(objectsMap);

    for (const shape of shapes) {
      if (!shape) continue;
      result.push({ shape, depth, parentId: parentId || null });
      if (isFrame(shape) || isGroup(shape) || isBool(shape)) {
        let children = [];
        if (shape.shapes && shape.shapes.length > 0 && isFlatMap) {
          children = shape.shapes.map(id => objectsMap[id]).filter(Boolean);
        } else if (shape.objects || shape.children || shape.shapes) {
          const raw = shape.objects || shape.children || shape.shapes;
          children = Array.isArray(raw) ? raw : Object.values(raw || {});
        }
        if (children.length > 0 && !this.#collapsedIds.has(shape.id)) {
          this.#flattenShapes(children, depth + 1, shape.id, result);
        }
      }
    }
  }

  #collectAllShapes(shapes, result) {
    const objectsMap = this.#page ? (this.#page.objects || this.#page.children) : null;
    const isFlatMap = objectsMap && !Array.isArray(objectsMap);

    for (const shape of shapes) {
      if (!shape) continue;
      result.push(shape);
      if (isFrame(shape) || isGroup(shape) || isBool(shape)) {
        let children = [];
        if (shape.shapes && shape.shapes.length > 0 && isFlatMap) {
          children = shape.shapes.map(id => objectsMap[id]).filter(Boolean);
        } else if (shape.objects || shape.children || shape.shapes) {
          const raw = shape.objects || shape.children || shape.shapes;
          children = Array.isArray(raw) ? raw : Object.values(raw || {});
        }
        if (children.length > 0) {
          this.#collectAllShapes(children, result);
        }
      }
    }
  }

  #matchesFilter(shape) {
    const filter = FILTER_TYPES.find(f => f.id === this.#activeFilter);
    if (!filter || !filter.types) return true;
    return filter.types.includes(shape.type);
  }

  #matchesSearch(shape) {
    if (!this.#searchText) return true;
    const q = this.#searchText.toLowerCase();
    const name = (shape.name || shape.type || '').toLowerCase();
    return name.includes(q) || shape.type.toLowerCase().includes(q);
  }

  #highlightName(name) {
    if (!this.#searchText) return this.escHtml(name);
    const q = this.#searchText;
    const idx = name.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return this.escHtml(name);
    const before = name.slice(0, idx);
    const match = name.slice(idx, idx + q.length);
    const after = name.slice(idx + q.length);
    return this.escHtml(before) + '<mark>' + this.escHtml(match) + '</mark>' + this.escHtml(after);
  }

  #collapseAll() {
    this.#collapsedIds = new Set(this.#shapes.filter(s => isFrame(s) || isGroup(s) || isBool(s)).map(s => s.id));
    this.render();
  }

  #expandAll() {
    this.#collapsedIds.clear();
    this.render();
  }

  render() {
    const list = this.querySelector('#layer-list');
    const countEl = this.querySelector('#search-count');
    if (!list) return;

    const isFiltering = this.#searchText || this.#activeFilter !== 'all';

    if (this.#shapes.length === 0) {
      list.innerHTML = '<div class="penpot-layer__empty-state">No layers on this page.</div>';
      if (countEl) countEl.textContent = '';
      return;
    }

    if (isFiltering) {
      const allShapes = [];
      this.#collectAllShapes(this.#shapes, allShapes);
      const filtered = allShapes.filter(s => this.#matchesSearch(s) && this.#matchesFilter(s));
      if (countEl) countEl.textContent = `${filtered.length}`;
      if (filtered.length === 0) {
        list.innerHTML = '<div class="penpot-layer__empty-state">No matching layers.</div>';
        return;
      }
      let html = '';
      for (const shape of filtered) {
        const isHidden = shape.visible === false;
        const isLocked = shape.locked === true;
        const icon = SHAPE_ICONS[shape.type] || '\u25A1';
        const isSelected = this.#selectedIds.has(shape.id);
        const badgeHtml = buildBadgeHtml(shape, this.escHtml.bind(this));
        const classes = [
          'penpot-layer__layer-item',
          isSelected ? 'penpot-layer__selected' : '',
          isLocked ? 'penpot-layer__locked' : '',
          isHidden ? 'penpot-layer__hidden-shape' : '',
          'penpot-layer__match-highlight',
        ].filter(Boolean).join(' ');

        html += `<div class="${classes}" data-shape-id="${this.escAttr(shape.id)}" draggable="true">`;
        html += `<span class="penpot-layer__layer-icon">${icon}</span>`;
        html += `${badgeHtml}<span class="penpot-layer__layer-name" data-name-id="${this.escAttr(shape.id)}">${this.#highlightName(shape.name || shape.type)}</span>`;
        html += `<button class="penpot-layer__layer-toggle ${isLocked ? '' : 'penpot-layer__off'}" data-lock-id="${this.escAttr(shape.id)}" title="${isLocked ? 'Unlock' : 'Lock'}">${isLocked ? LOCK_ON : ''}</button>`;
        html += `<button class="penpot-layer__layer-toggle ${isHidden ? 'penpot-layer__off' : ''}" data-vis-id="${this.escAttr(shape.id)}" title="${isHidden ? 'Show' : 'Hide'}">${isHidden ? VISIBILITY_OFF : VISIBILITY_ON}</button>`;
        html += `</div>`;
      }
      list.innerHTML = html;
      this.#bindFilteredEvents(list);
    } else {
      if (countEl) countEl.textContent = '';
      const flat = [];
      this.#flattenShapes(this.#shapes, 0, null, flat);

      let html = '';
      for (const { shape, depth, parentId } of flat) {
        const isContainer = isFrame(shape) || isGroup(shape) || isBool(shape);
        const hasChildren = isContainer && (() => {
          if (Array.isArray(shape.shapes) && shape.shapes.length > 0) return true;
          const raw = shape.objects || shape.children;
          if (Array.isArray(raw) && raw.length > 0) return true;
          if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) return true;
          return false;
        })();
        const isCollapsed = this.#collapsedIds.has(shape.id);
        const isSelected = this.#selectedIds.has(shape.id);
        const isHidden = shape.visible === false;
        const isLocked = shape.locked === true;
        const badgeHtml = buildBadgeHtml(shape, this.escHtml.bind(this));
        const indent = `padding-left: ${8 + depth * INDENT}px;`;

        const classes = [
          'penpot-layer__layer-item',
          isSelected ? 'penpot-layer__selected' : '',
          isLocked ? 'penpot-layer__locked' : '',
          isHidden ? 'penpot-layer__hidden-shape' : '',
          isContainer ? 'penpot-layer__container' : '',
        ].filter(Boolean).join(' ');

        html += `<div class="${classes}" data-shape-id="${this.escAttr(shape.id)}" data-parent-id="${this.escAttr(parentId || '')}" data-depth="${depth}" style="${indent}" draggable="true">`;

        if (hasChildren) {
          html += `<button class="penpot-layer__layer-collapse" data-collapse-id="${this.escAttr(shape.id)}">${isCollapsed ? COLLAPSE_ARROW : EXPAND_ARROW}</button>`;
        } else {
          html += `<span class="penpot-layer__layer-collapse"></span>`;
        }

        html += `<span class="penpot-layer__layer-icon">${icon}</span>`;
        html += `${badgeHtml}<span class="penpot-layer__layer-name" data-name-id="${this.escAttr(shape.id)}">${this.escHtml(shape.name || shape.type)}</span>`;

        html += `<button class="penpot-layer__layer-toggle ${isLocked ? '' : 'penpot-layer__off'}" data-lock-id="${this.escAttr(shape.id)}" title="${isLocked ? 'Unlock' : 'Lock'}">${isLocked ? LOCK_ON : ''}</button>`;
        html += `<button class="penpot-layer__layer-toggle ${isHidden ? 'penpot-layer__off' : ''}" data-vis-id="${this.escAttr(shape.id)}" title="${isHidden ? 'Show' : 'Hide'}">${isHidden ? VISIBILITY_OFF : VISIBILITY_ON}</button>`;

        html += `</div>`;
      }

      list.innerHTML = html;
      this.#bindEvents(list);
    }
  }

  #bindFilteredEvents(list) {
    list.querySelectorAll('.penpot-layer__layer-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.penpot-layer__layer-toggle')) return;
        const shapeId = el.dataset.shapeId;
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          const newSet = new Set(this.#selectedIds);
          if (newSet.has(shapeId)) newSet.delete(shapeId); else newSet.add(shapeId);
          this.#selectedIds = newSet;
          this.#highlightSelected();
          this.emit('penpot-shape-select', { shapeId: null, selectedIds: [...this.#selectedIds] });
        } else {
          this.#selectedIds = new Set([shapeId]);
          this.#highlightSelected();
          this.emit('penpot-shape-select', { shapeId });
        }
      });

      el.addEventListener('dblclick', (e) => {
        if (e.target.closest('.penpot-layer__layer-toggle')) return;
        this.#startRename(el.dataset.shapeId, el);
      });

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.emit('penpot-shape-context', { shapeId: el.dataset.shapeId, clientX: e.clientX, clientY: e.clientY });
      });
    });

    list.querySelectorAll('[data-vis-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.emit('penpot-toggle-visibility', { shapeId: btn.dataset.visId });
      });
    });

    list.querySelectorAll('[data-lock-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.emit('penpot-toggle-lock', { shapeId: btn.dataset.lockId });
      });
    });
  }

  #bindEvents(list) {
      list.querySelectorAll('.penpot-layer__layer-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.penpot-layer__layer-toggle') || e.target.closest('.penpot-layer__layer-collapse')) return;
        const shapeId = el.dataset.shapeId;
        if (e.shiftKey) {
          const newSet = new Set(this.#selectedIds);
          if (newSet.has(shapeId)) {
            newSet.delete(shapeId);
          } else {
            newSet.add(shapeId);
          }
          this.#selectedIds = newSet;
          this.#highlightSelected();
          this.emit('penpot-shape-select', { shapeId: null, selectedIds: [...this.#selectedIds] });
        } else if (e.ctrlKey || e.metaKey) {
          const newSet = new Set(this.#selectedIds);
          if (newSet.has(shapeId)) {
            newSet.delete(shapeId);
          } else {
            newSet.add(shapeId);
          }
          this.#selectedIds = newSet;
          this.#highlightSelected();
          this.emit('penpot-shape-select', { shapeId: null, selectedIds: [...this.#selectedIds] });
        } else {
          this.#selectedIds = new Set([shapeId]);
          this.#highlightSelected();
          this.emit('penpot-shape-select', { shapeId });
        }
      });

      el.addEventListener('dblclick', (e) => {
        if (e.target.closest('.penpot-layer__layer-toggle') || e.target.closest('.penpot-layer__layer-collapse')) return;
        const shapeId = el.dataset.shapeId;
        this.#startRename(shapeId, el);
      });

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const shapeId = el.dataset.shapeId;
        this.emit('penpot-shape-context', { shapeId, clientX: e.clientX, clientY: e.clientY });
      });

      el.addEventListener('dragstart', (e) => {
        this.#dragState = { shapeId: el.dataset.shapeId, el, parentId: el.dataset.parentId || null, depth: parseInt(el.dataset.depth, 10) || 0 };
        e.dataTransfer.effectAllowed = 'move';
        el.style.opacity = '0.5';
      });

      el.addEventListener('dragend', () => {
        if (this.#dragState) {
          this.#dragState.el.style.opacity = '';
          this.#dragState = null;
        }
        this.#clearDropIndicators(list);
      });

      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.#showDropIndicator(el, e, list);
      });

      el.addEventListener('dragleave', () => {
        this.#clearDropIndicators(list);
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        this.#clearDropIndicators(list);
        if (!this.#dragState) return;
        const targetId = el.dataset.shapeId;
        const targetParentId = el.dataset.parentId || null;
        const sourceId = this.#dragState.shapeId;
        if (sourceId === targetId) {
          this.#dragState = null;
          return;
        }
        const dropPosition = this.#computeDropPosition(el, e);
        this.#dragState = null;
        this.emit('penpot-shape-reorder', { sourceId, targetId, targetParentId, position: dropPosition });
      });
    });

    list.querySelectorAll('[data-collapse-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const shapeId = btn.dataset.collapseId;
        if (this.#collapsedIds.has(shapeId)) {
          this.#collapsedIds.delete(shapeId);
        } else {
          this.#collapsedIds.add(shapeId);
        }
        this.render();
      });
    });

    list.querySelectorAll('[data-vis-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const shapeId = btn.dataset.visId;
        this.emit('penpot-toggle-visibility', { shapeId });
      });
    });

    list.querySelectorAll('[data-lock-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const shapeId = btn.dataset.lockId;
        this.emit('penpot-toggle-lock', { shapeId });
      });
    });
  }

  #clearDropIndicators(list) {
    list.querySelectorAll('.penpot-layer__drag-indicator').forEach(d => d.remove());
    list.querySelectorAll('.penpot-layer__drop-into').forEach(d => d.classList.remove('penpot-layer__drop-into'));
  }

  #isContainerShape(shapeId) {
    const shape = this.#findShape(shapeId);
    return shape && (isFrame(shape) || isGroup(shape) || isBool(shape));
  }

  #computeDropPosition(el, event) {
    const rect = el.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const height = rect.height;
    const isContainer = el.classList.contains('penpot-layer__container');
    const sourceId = this.#dragState?.shapeId;

    if (isContainer) {
      if (y < DROP_ZONE_THRESHOLD) return 'before';
      if (y > height - DROP_ZONE_THRESHOLD) return 'after';
      return 'into';
    }

    if (y < height / 2) return 'before';
    return 'after';
  }

  #showDropIndicator(targetEl, event, list) {
    this.#clearDropIndicators(list);

    if (!this.#dragState) return;

    const sourceId = this.#dragState.shapeId;
    const targetId = targetEl.dataset.shapeId;
    const dropPosition = this.#computeDropPosition(targetEl, event);

    if (sourceId === targetId) return;

    if (this.#isAncestorOf(sourceId, targetId)) return;

    if (dropPosition === 'into') {
      targetEl.classList.add('penpot-layer__drop-into');
    } else {
      targetEl.classList.remove('penpot-layer__drop-into');
      const indicator = document.createElement('div');
      indicator.className = 'penpot-layer__drag-indicator';
      const depth = parseInt(targetEl.dataset.depth, 10) || 0;
      indicator.style.marginLeft = `${8 + depth * INDENT}px`;
      if (dropPosition === 'before') {
        targetEl.parentNode.insertBefore(indicator, targetEl);
      } else {
        const nextSibling = targetEl.nextSibling;
        targetEl.parentNode.insertBefore(indicator, nextSibling);
      }
    }
  }

  #startRename(shapeId, el) {
    const nameSpan = el.querySelector('.penpot-layer__layer-name');
    if (!nameSpan) return;
    const shape = this.#findShape(shapeId);
    if (!shape) return;

    const input = document.createElement('input');
    input.className = 'penpot-layer__layer-name-input';
    input.value = shape.name || shape.type;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const newName = input.value.trim() || shape.type;
      input.replaceWith(nameSpan);
      nameSpan.textContent = newName;
      this.emit('penpot-shape-rename', { shapeId, name: newName });
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { input.replaceWith(nameSpan); }
    });
    input.addEventListener('blur', commit);
  }

  #highlightSelected() {
    const list = this.querySelector('#layer-list');
    if (!list) return;
    list.querySelectorAll('.penpot-layer__layer-item').forEach(el => {
      el.classList.toggle('penpot-layer__selected', this.#selectedIds.has(el.dataset.shapeId));
    });
  }

  #findShape(id) {
    const objectsMap = this.#page ? (this.#page.objects || this.#page.children) : null;
    if (objectsMap && !Array.isArray(objectsMap) && objectsMap[id]) {
      return objectsMap[id];
    }
    const find = (shapes) => {
      for (const s of shapes) {
        if (s.id === id) return s;
        if ((isFrame(s) || isGroup(s) || isBool(s)) && (s.objects || s.children || s.shapes)) {
          const raw = s.objects || s.children || s.shapes;
          const children = Array.isArray(raw) ? raw : Object.values(raw || {});
          const found = find(children);
          if (found) return found;
        }
      }
      return null;
    };
    return find(this.#shapes);
  }

  #isAncestorOf(ancestorId, descendantId) {
    if (ancestorId === descendantId) return true;
    const objectsMap = this.#page ? (this.#page.objects || this.#page.children) : null;
    const isFlatMap = objectsMap && !Array.isArray(objectsMap);

    if (isFlatMap) {
      const visited = new Set();
      let currentId = descendantId;
      while (currentId) {
        if (currentId === ancestorId) return true;
        if (visited.has(currentId)) return false;
        visited.add(currentId);
        const shape = objectsMap[currentId];
        currentId = shape ? (shape.parentId || shape['parent-id']) : null;
      }
      return false;
    }

    const ancestor = this.#findShape(ancestorId);
    if (!ancestor) return false;
    const check = (s) => {
      if (s.id === descendantId) return true;
      if (isFrame(s) || isGroup(s) || isBool(s)) {
        let children = [];
        if (s.shapes && s.shapes.length > 0 && isFlatMap) {
          children = s.shapes.map(id => objectsMap[id]).filter(Boolean);
        } else if (s.objects || s.children || s.shapes) {
          const raw = s.objects || s.children || s.shapes;
          children = Array.isArray(raw) ? raw : Object.values(raw || {});
        }
        for (const child of children) {
          if (check(child)) return true;
        }
      }
      return false;
    };
    return check(ancestor);
  }

  escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
}

customElements.define('penpot-layer-panel', PenpotLayerPanel);