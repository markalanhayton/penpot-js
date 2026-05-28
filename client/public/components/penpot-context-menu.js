'use strict';
import { PenpotElement } from './base.js';

let nextId = 0;

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-context-menu { position: fixed; z-index: var(--penpot-z-context-menu, 130); }
    .penpot-ctx__context-menu { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); box-shadow: var(--penpot-shadow-m, 0 4px 12px rgba(0,0,0,0.4)); min-width: 160px; padding: var(--penpot-spacing-xs, 4px) 0; }
    .penpot-ctx__context-item { display: flex; align-items: center; gap: var(--penpot-spacing-s, 8px); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-m, 12px); font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); cursor: pointer; white-space: nowrap; position: relative; }
    .penpot-ctx__context-item:hover { background: var(--penpot-primary-bg, rgba(49,239,184,0.08)); color: var(--penpot-primary, #31efb8); }
    .penpot-ctx__context-item.penpot-ctx__danger { color: var(--penpot-danger, #f44336); }
    .penpot-ctx__context-item.penpot-ctx__danger:hover { background: var(--penpot-danger-bg, rgba(244,67,54,0.08)); }
    .penpot-ctx__context-item.penpot-ctx__disabled { opacity: 0.4; cursor: not-allowed; }
    .penpot-ctx__context-item .penpot-ctx__icon { width: 16px; text-align: center; font-size: 12px; flex-shrink: 0; color: var(--penpot-text-dim, #999); }
    .penpot-ctx__context-item .penpot-ctx__label { flex: 1; }
    .penpot-ctx__context-item .penpot-ctx__shortcut { margin-left: auto; font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-disabled, #666); }
    .penpot-ctx__context-item .penpot-ctx__arrow { margin-left: var(--penpot-spacing-xs, 4px); font-size: 10px; color: var(--penpot-text-disabled, #666); }
    .penpot-ctx__context-separator { height: 1px; background: var(--penpot-border, #444); margin: var(--penpot-spacing-xs, 4px) 0; }
    .penpot-ctx__submenu { position: absolute; left: 100%; top: 0; background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); box-shadow: var(--penpot-shadow-m, 0 4px 12px rgba(0,0,0,0.4)); min-width: 160px; padding: var(--penpot-spacing-xs, 4px) 0; display: none; }
    .penpot-ctx__context-item:hover > .penpot-ctx__submenu { display: block; }
  
  </style>
  <div class="penpot-ctx__context-menu" id="menu"></div>`;

export class PenpotContextMenu extends PenpotElement {
  _template = template;
  #visible = false;
  #items = [];

  static get observedAttributes() { return []; }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'none';

    document.addEventListener('click', (e) => {
      if (this.#visible && !this.contains(e.target) && !e.composedPath().includes(this)) {
        this.hide();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.#visible) this.hide();
    });
  }

  set items(items) {
    this.#items = items;
    this.#render();
  }

  get items() { return this.#items; }

  #renderItems(items, container) {
    for (const item of items) {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'penpot-ctx__context-separator';
        container.appendChild(sep);
        continue;
      }
      const el = document.createElement('div');
      el.className = 'penpot-ctx__context-item' + (item.danger ? ' penpot-ctx__danger' : '') + (item.disabled ? ' penpot-ctx__disabled' : '');
      const hasSubmenu = item.submenu && item.submenu.length > 0;
      el.innerHTML = `${item.icon ? `<span class="penpot-ctx__icon">${item.icon}</span>` : '<span class="penpot-ctx__icon"></span>'}<span class="penpot-ctx__label">${item.label || ''}</span>${item.shortcut ? `<span class="penpot-ctx__shortcut">${item.shortcut}</span>` : ''}${hasSubmenu ? '<span class="penpot-ctx__arrow">\u25B6</span>' : ''}`;
      if (hasSubmenu) {
        const submenu = document.createElement('div');
        submenu.className = 'penpot-ctx__submenu';
        this.#renderItems(item.submenu, submenu);
        el.appendChild(submenu);
      }
      if (!item.disabled && !hasSubmenu) {
        el.addEventListener('click', () => {
          if (item.action) item.action();
          this.hide();
        });
      }
      container.appendChild(el);
    }
  }

  #render() {
    const menu = this.querySelector('#menu');
    if (!menu) return;
    menu.innerHTML = '';
    this.#renderItems(this.#items, menu);
  }

  show(x, y) {
    this.style.display = '';
    this.style.left = `${x}px`;
    this.style.top = `${y}px`;
    this.#visible = true;

    requestAnimationFrame(() => {
      const rect = this.getBoundingClientRect();
      if (rect.right > window.innerWidth) this.style.left = `${x - rect.width}px`;
      if (rect.bottom > window.innerHeight) this.style.top = `${y - rect.height}px`;
      this.querySelectorAll('.penpot-ctx__submenu').forEach(sub => {
        const subRect = sub.getBoundingClientRect();
        if (subRect.right > window.innerWidth) {
          sub.style.left = 'auto';
          sub.style.right = '100%';
        }
        if (subRect.bottom > window.innerHeight) {
          sub.style.top = 'auto';
          sub.style.bottom = '0';
        }
      });
    });
  }

  showAtEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    this.show(e.clientX, e.clientY);
  }

  hide() {
    this.style.display = 'none';
    this.#visible = false;
    this.dispatchEvent(new CustomEvent('penpot-context-close', { bubbles: true }));
  }

  get isVisible() { return this.#visible; }
}

customElements.define('penpot-context-menu', PenpotContextMenu);