import { PenpotElement } from './base.js';
import { isFrame, isGroup } from '../lib/types.js';

const INDENT = 16;
const VISIBILITY_ON = '\u{1F441}';
const VISIBILITY_OFF = '\u{25CE}';
const LOCK_ON = '\u{1F512}';
const LOCK_OFF = '';
const COLLAPSE_ARROW = '\u25B6';
const EXPAND_ARROW = '\u25BC';

const SHAPE_ICONS = {
  frame: '\u25A1', group: '\u2299', rect: '\u25AD', circle: '\u25CB', ellipse: '\u25CB',
  path: '\u270E', text: 'T', image: '\u25B3', 'svg-raw': '\u2605', bool: '\u2229',
};

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-layer-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .penpot-layer__layer-toolbar { display: flex; align-items: center; gap: 2px; padding: 4px 8px; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-layer__layer-toolbar-btn { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; padding: 2px 6px; border-radius: var(--penpot-radius-s, 4px); font-size: 12px; line-height: 1; }
    .penpot-layer__layer-toolbar-btn:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
    .penpot-layer__layer-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; }
    .penpot-layer__layer-item { display: flex; align-items: center; gap: 4px; padding: 3px 8px 3px 0; font-size: 11px; color: var(--penpot-text, #e6e6e6); cursor: pointer; user-select: none; min-height: 24px; border-radius: 0; transition: background 0.1s; }
    .penpot-layer__layer-item:hover { background: var(--penpot-surface-high, #333); }
    .penpot-layer__layer-item.penpot-layer__selected { background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); color: var(--penpot-primary, #31efb8); }
    .penpot-layer__layer-item.penpot-layer__locked { opacity: 0.5; }
    .penpot-layer__layer-item.penpot-layer__hidden-shape { opacity: 0.4; text-decoration: line-through; }
    .penpot-layer__layer-toggle { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; padding: 0 2px; font-size: 10px; min-width: 16px; text-align: center; flex-shrink: 0; }
    .penpot-layer__layer-toggle:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-layer__layer-toggle.penpot-layer__off { color: var(--penpot-text-disabled, #555); }
    .penpot-layer__layer-collapse { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; padding: 0; font-size: 8px; width: 16px; text-align: center; flex-shrink: 0; }
    .penpot-layer__layer-collapse:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-layer__layer-icon { font-size: 10px; width: 16px; text-align: center; flex-shrink: 0; }
    .penpot-layer__layer-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .penpot-layer__layer-name-input { background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-primary, #31efb8); color: var(--penpot-text, #e6e6e6); font-size: 11px; padding: 0 2px; outline: none; width: 100%; }
    .penpot-layer__empty-state { color: var(--penpot-text-dim, #999); text-align: center; padding: 24px 12px; font-size: 11px; }
    .penpot-layer__drag-indicator { height: 2px; background: var(--penpot-primary, #31efb8); margin: -1px 0; pointer-events: none; }
  
  </style>
  <div class="penpot-layer__layer-toolbar">
    <button class="penpot-layer__layer-toolbar-btn" id="btn-collapse-all" title="Collapse all">\u25B2 Collapse</button>
    <button class="penpot-layer__layer-toolbar-btn" id="btn-expand-all" title="Expand all">\u25BC Expand</button>
  </div>
  <div class="penpot-layer__layer-scroll" id="layer-list"></div>`;

export class PenpotLayerPanel extends PenpotElement {
  #shapes = [];
  #selectedIds = new Set();
  #collapsedIds = new Set();
  #page = null;
  #dragState = null;

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#btn-collapse-all').addEventListener('click', () => this.#collapseAll());
    this.querySelector('#btn-expand-all').addEventListener('click', () => this.#expandAll());
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

  #flattenShapes(shapes, depth, result) {
    for (const shape of shapes) {
      if (!shape) continue;
      result.push({ shape, depth });
      if ((isFrame(shape) || isGroup(shape)) && (shape.objects || shape.children)) {
        const children = Array.isArray(shape.objects || shape.children)
          ? (shape.objects || shape.children)
          : Object.values(shape.objects || shape.children);
        if (children.length > 0 && !this.#collapsedIds.has(shape.id)) {
          this.#flattenShapes(children, depth + 1, result);
        }
      }
    }
  }

  #collapseAll() {
    this.#collapsedIds = new Set(this.#shapes.filter(s => isFrame(s) || isGroup(s)).map(s => s.id));
    this.render();
  }

  #expandAll() {
    this.#collapsedIds.clear();
    this.render();
  }

  render() {
    const list = this.querySelector('#layer-list');
    if (!list) return;

    if (this.#shapes.length === 0) {
      list.innerHTML = '<div class="penpot-layer__empty-state">No layers on this page.</div>';
      return;
    }

    const flat = [];
    this.#flattenShapes(this.#shapes, 0, flat);

    let html = '';
    for (const { shape, depth } of flat) {
      const hasChildren = (isFrame(shape) || isGroup(shape)) && (shape.objects || shape.children);
      const childCount = hasChildren
        ? (Array.isArray(shape.objects || shape.children) ? (shape.objects || shape.children).length : Object.keys(shape.objects || shape.children || {}).length)
        : 0;
      const isCollapsed = this.#collapsedIds.has(shape.id);
      const isSelected = this.#selectedIds.has(shape.id);
      const isHidden = shape.visible === false;
      const isLocked = shape.locked === true;
      const icon = SHAPE_ICONS[shape.type] || '\u25A1';
      const indent = `padding-left: ${8 + depth * INDENT}px;`;

      const classes = [
        'layer-item',
        isSelected ? 'selected' : '',
        isLocked ? 'locked' : '',
        isHidden ? 'hidden-shape' : '',
      ].filter(Boolean).join(' ');

      html += `<div class="${classes}" data-shape-id="${this.escAttr(shape.id)}" style="${indent}" draggable="true">`;

      if (hasChildren) {
        html += `<button class="penpot-layer__layer-collapse" data-collapse-id="${this.escAttr(shape.id)}">${isCollapsed ? COLLAPSE_ARROW : EXPAND_ARROW}</button>`;
      } else {
        html += `<span class="penpot-layer__layer-collapse"></span>`;
      }

      html += `<span class="penpot-layer__layer-icon">${icon}</span>`;
      html += `<span class="penpot-layer__layer-name" data-name-id="${this.escAttr(shape.id)}">${this.escHtml(shape.name || shape.type)}</span>`;

      html += `<button class="penpot-layer__layer-toggle ${isLocked ? '' : 'penpot-layer__off'}" data-lock-id="${this.escAttr(shape.id)}" title="${isLocked ? 'Unlock' : 'Lock'}">${isLocked ? LOCK_ON : ''}</button>`;
      html += `<button class="penpot-layer__layer-toggle ${isHidden ? 'penpot-layer__off' : ''}" data-vis-id="${this.escAttr(shape.id)}" title="${isHidden ? 'Show' : 'Hide'}">${isHidden ? VISIBILITY_OFF : VISIBILITY_ON}</button>`;

      html += `</div>`;
    }

    list.innerHTML = html;
    this.#bindEvents(list);
  }

  #bindEvents(list) {
    list.querySelectorAll('.penpot-layer__layer-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.layer-toggle') || e.target.closest('.layer-collapse')) return;
        const shapeId = el.dataset.shapeId;
        this.#selectedIds = new Set([shapeId]);
        this.#highlightSelected();
        this.emit('penpot-shape-select', { shapeId });
      });

      el.addEventListener('dblclick', (e) => {
        if (e.target.closest('.layer-toggle') || e.target.closest('.layer-collapse')) return;
        const shapeId = el.dataset.shapeId;
        this.#startRename(shapeId, el);
      });

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const shapeId = el.dataset.shapeId;
        this.emit('penpot-shape-context', { shapeId, clientX: e.clientX, clientY: e.clientY });
      });

      el.addEventListener('dragstart', (e) => {
        this.#dragState = { shapeId: el.dataset.shapeId, el };
        e.dataTransfer.effectAllowed = 'move';
        el.style.opacity = '0.5';
      });

      el.addEventListener('dragend', () => {
        if (this.#dragState) {
          this.#dragState.el.style.opacity = '';
          this.#dragState = null;
        }
        list.querySelectorAll('.penpot-layer__drag-indicator').forEach(d => d.remove());
      });

      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.#showDropIndicator(el, e);
      });

      el.addEventListener('dragleave', () => {
        list.querySelectorAll('.penpot-layer__drag-indicator').forEach(d => d.remove());
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        list.querySelectorAll('.penpot-layer__drag-indicator').forEach(d => d.remove());
        if (!this.#dragState) return;
        const targetId = el.dataset.shapeId;
        const sourceId = this.#dragState.shapeId;
        if (sourceId !== targetId) {
          this.emit('penpot-shape-reorder', { sourceId, targetId });
        }
        this.#dragState = null;
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

  #showDropIndicator(targetEl, event) {
    const list = this.querySelector('#layer-list');
    list.querySelectorAll('.penpot-layer__drag-indicator').forEach(d => d.remove());
    const indicator = document.createElement('div');
    indicator.className = 'penpot-layer__drag-indicator';
    const rect = targetEl.getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) {
      targetEl.parentNode.insertBefore(indicator, targetEl);
    } else {
      targetEl.parentNode.insertBefore(indicator, targetEl.nextSibling);
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
    const find = (shapes) => {
      for (const s of shapes) {
        if (s.id === id) return s;
        if ((isFrame(s) || isGroup(s)) && (s.objects || s.children)) {
          const children = Array.isArray(s.objects || s.children) ? (s.objects || s.children) : Object.values(s.objects || s.children || {});
          const found = find(children);
          if (found) return found;
        }
      }
      return null;
    };
    return find(this.#shapes);
  }

  escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
}

customElements.define('penpot-layer-panel', PenpotLayerPanel);