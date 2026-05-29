'use strict';
import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>
  :host { display: flex; align-items: center; gap: 0; }
  .penpot-menu__bar { display: flex; align-items: center; gap: 0; }
  .penpot-menu__trigger { background: none; border: none; color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-s, 12px); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); cursor: pointer; border-radius: var(--penpot-radius-xs, 2px); position: relative; white-space: nowrap; font-family: inherit; line-height: 1; }
  .penpot-menu__trigger:hover, .penpot-menu__trigger:focus { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
  .penpot-menu__trigger[aria-expanded="true"] { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
  .penpot-menu__trigger .penpot-menu__underlined { text-decoration: underline; text-decoration-color: var(--penpot-text-dim, #999); }
  .penpot-menu__panel { display: none; position: absolute; top: 100%; left: 0; min-width: 200px; background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); box-shadow: var(--penpot-shadow-m, 0 4px 12px rgba(0,0,0,0.4)); padding: var(--penpot-spacing-xs, 4px) 0; z-index: var(--penpot-z-dropdown, 400); }
  .penpot-menu__item { display: flex; align-items: center; gap: var(--penpot-spacing-s, 8px); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-m, 12px); font-size: var(--penpot-font-size-s, 12px); color: var(--penpot-text, #e6e6e6); cursor: pointer; white-space: nowrap; position: relative; }
  .penpot-menu__item:hover, .penpot-menu__item:focus { background: var(--penpot-primary-bg, rgba(49,239,184,0.08)); color: var(--penpot-primary, #31efb8); }
  .penpot-menu__item[data-danger] { color: var(--penpot-danger, #f44336); }
  .penpot-menu__item[data-danger]:hover { background: var(--penpot-danger-bg, rgba(244,67,54,0.08)); }
  .penpot-menu__item[data-disabled] { opacity: 0.4; cursor: not-allowed; }
  .penpot-menu__item[data-disabled]:hover { background: none; color: var(--penpot-text, #e6e6e6); }
  .penpot-menu__item .penpot-menu__item-icon { width: 16px; text-align: center; font-size: 11px; flex-shrink: 0; color: var(--penpot-text-dim, #999); }
  .penpot-menu__item .penpot-menu__item-label { flex: 1; }
  .penpot-menu__item .penpot-menu__item-shortcut { margin-left: auto; font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-disabled, #666); }
  .penpot-menu__item .penpot-menu__item-arrow { margin-left: var(--penpot-spacing-xs, 4px); font-size: 10px; color: var(--penpot-text-disabled, #666); }
  .penpot-menu__separator { height: 1px; background: var(--penpot-border, #444); margin: var(--penpot-spacing-xs, 4px) 0; }
  .penpot-menu__submenu { display: none; position: absolute; left: 100%; top: 0; min-width: 180px; background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); box-shadow: var(--penpot-shadow-m, 0 4px 12px rgba(0,0,0,0.4)); padding: var(--penpot-spacing-xs, 4px) 0; }
  .penpot-menu__item:hover > .penpot-menu__submenu { display: block; }
</style>
<nav class="penpot-menu__bar" id="bar" role="menubar" aria-label="Main menu"></nav>`;

const MENU_DEFS = [
  {
    id: 'file',
    label: 'File',
    mnemonic: 'F',
    items: [
      { label: 'New File', shortcut: '', icon: '', action: 'new-file' },
      { type: 'separator' },
      { label: 'Save', shortcut: 'Ctrl+S', icon: '\uD83D\uDCBE', action: 'save' },
      { label: 'Save as\u2026', shortcut: '', icon: '', action: 'save-as' },
      { type: 'separator' },
      { label: 'Import\u2026', shortcut: 'Ctrl+Shift+I', icon: '\uD83D\uDCC2', action: 'import' },
      { label: 'Export\u2026', shortcut: 'Ctrl+E', icon: '\uD83D\uDCE4', action: 'export' },
      { type: 'separator' },
      { label: 'Back to Dashboard', shortcut: '', icon: '\u2190', action: 'back-to-dashboard' },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    mnemonic: 'E',
    items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', icon: '\u21B6', action: 'undo' },
      { label: 'Redo', shortcut: 'Ctrl+Y', icon: '\u21B7', action: 'redo' },
      { type: 'separator' },
      { label: 'Copy', shortcut: 'Ctrl+C', icon: '', action: 'copy' },
      { label: 'Cut', shortcut: 'Ctrl+X', icon: '', action: 'cut' },
      { label: 'Paste', shortcut: 'Ctrl+V', icon: '', action: 'paste' },
      { label: 'Duplicate', shortcut: 'Ctrl+D', icon: '', action: 'duplicate' },
      { label: 'Delete', shortcut: 'Del', icon: '', danger: true, action: 'delete' },
      { type: 'separator' },
      { label: 'Select All', shortcut: 'Ctrl+A', icon: '', action: 'select-all' },
      { label: 'Deselect', shortcut: 'Esc', icon: '', action: 'deselect' },
      { type: 'separator' },
      { label: 'Group', shortcut: 'Ctrl+G', icon: '', action: 'group' },
      { label: 'Ungroup', shortcut: 'Ctrl+Shift+G', icon: '', action: 'ungroup' },
    ],
  },
  {
    id: 'view',
    label: 'View',
    mnemonic: 'V',
    items: [
      { label: 'Zoom In', shortcut: 'Ctrl++', icon: '\uD83D\uDD0D+', action: 'zoom-in' },
      { label: 'Zoom Out', shortcut: 'Ctrl+\u2212', icon: '\uD83D\uDD0D\u2212', action: 'zoom-out' },
      { label: 'Zoom to Fit', shortcut: 'Ctrl+0', icon: '\uD83D\uDD0D', action: 'zoom-fit' },
      { label: 'Zoom 100%', shortcut: 'Ctrl+1', icon: '', action: 'zoom-100' },
      { label: 'Zoom 200%', shortcut: 'Ctrl+2', icon: '', action: 'zoom-200' },
      { label: 'Zoom to Selection', shortcut: 'Ctrl+Shift+2', icon: '', action: 'zoom-selection' },
      { type: 'separator' },
      { label: 'Show Rulers', shortcut: '', icon: '', action: 'toggle-rulers', checked: false },
      { label: 'Show Grid', shortcut: '', icon: '', action: 'toggle-grid', checked: false },
      { label: 'Show Snap Guides', shortcut: '', icon: '', action: 'toggle-snap', checked: true },
      { type: 'separator' },
      { label: 'Comments', shortcut: 'C', icon: '\uD83D\uDCAC', action: 'toggle-comments' },
      { label: 'Version History', shortcut: '', icon: '\uD83D\uDD50', action: 'toggle-version-history' },
      { type: 'separator' },
      { label: 'Keyboard Shortcuts', shortcut: 'Ctrl+/', icon: '', action: 'show-shortcuts' },
    ],
  },
];

export class PenpotMainMenu extends PenpotElement {
  _template = template;
  #openMenuId = null;
  #checkedState = { 'toggle-rulers': false, 'toggle-grid': false, 'toggle-snap': true };
  #onDocClick = (e) => {
    if (!this.contains(e.target)) {
      this.#closeAllMenus();
    }
  };
  #onDocKeyDown = (e) => {
    if (e.key === 'Escape') this.#closeAllMenus();
    if (e.altKey && ['f', 'F', 'e', 'E', 'v', 'V'].includes(e.key)) {
      e.preventDefault();
      const key = e.key.toUpperCase();
      const menu = MENU_DEFS.find(m => m.mnemonic === key);
      if (menu) {
        if (this.#openMenuId === menu.id) {
          this.#closeAllMenus();
        } else {
          this.#openMenu(menu.id);
        }
      }
    }
  };

  static get observedAttributes() { return []; }

  connectedCallback() {
    super.connectedCallback();
    this.#renderMenuBar();
    document.addEventListener('click', this.#onDocClick);
    document.addEventListener('keydown', this.#onDocKeyDown);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.#onDocClick);
    document.removeEventListener('keydown', this.#onDocKeyDown);
    super.disconnectedCallback();
  }

  #renderMenuBar() {
    const bar = this.querySelector('#bar');
    if (!bar) return;
    bar.innerHTML = '';
    for (const menu of MENU_DEFS) {
      const trigger = document.createElement('button');
      trigger.className = 'penpot-menu__trigger';
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('role', 'menuitem');
      trigger.dataset.menuId = menu.id;
      const mIdx = menu.label.indexOf(menu.mnemonic);
      const before = mIdx >= 0 ? menu.label.slice(0, mIdx) : '';
      const after = mIdx >= 0 ? menu.label.slice(mIdx + 1) : menu.label;
      trigger.innerHTML = `${before}<span class="penpot-menu__underlined">${menu.mnemonic}</span>${after}`;
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.#openMenuId === menu.id) {
          this.#closeAllMenus();
        } else {
          this.#openMenu(menu.id);
        }
      });
      trigger.addEventListener('mouseenter', () => {
        if (this.#openMenuId && this.#openMenuId !== menu.id) {
          this.#openMenu(menu.id);
        }
      });
      bar.appendChild(trigger);
    }
  }

  #openMenu(menuId) {
    this.#closeAllMenus();
    const menu = MENU_DEFS.find(m => m.id === menuId);
    if (!menu) return;
    const trigger = this.querySelector(`[data-menu-id="${menuId}"]`);
    if (!trigger) return;
    trigger.setAttribute('aria-expanded', 'true');
      const panel = document.createElement('div');
      panel.className = 'penpot-menu__panel';
      panel.dataset.panelId = menuId;
      panel.setAttribute('role', 'menu');
      panel.setAttribute('aria-label', menu.label);
    this.#renderItems(menu.items, panel);
    trigger.style.position = 'relative';
    trigger.appendChild(panel);
    this.#openMenuId = menuId;
    requestAnimationFrame(() => {
      const rect = panel.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        panel.style.left = 'auto';
        panel.style.right = '0';
      }
      if (rect.bottom > window.innerHeight) {
        panel.style.top = 'auto';
        panel.style.bottom = '100%';
      }
      panel.style.display = 'block';
    });
  }

  #closeAllMenus() {
    for (const panel of this.querySelectorAll('.penpot-menu__panel')) {
      panel.remove();
    }
    for (const trigger of this.querySelectorAll('.penpot-menu__trigger')) {
      trigger.setAttribute('aria-expanded', 'false');
    }
    this.#openMenuId = null;
  }

  #renderItems(items, container) {
    for (const item of items) {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'penpot-menu__separator';
        container.appendChild(sep);
        continue;
      }
      const el = document.createElement('div');
      el.className = 'penpot-menu__item';
      el.tabIndex = -1;
      el.setAttribute('role', item.type === 'separator' ? 'separator' : 'menuitem');
      if (item.danger) el.dataset.danger = '';
      if (item.disabled) el.dataset.disabled = '';
      const hasSubmenu = item.submenu && item.submenu.length > 0;
      const isChecked = item.action && this.#checkedState[item.action] !== undefined;
      const checkMark = isChecked ? (this.#checkedState[item.action] ? '\u2713 ' : '\u25CB ') : '';
      el.innerHTML = `${item.icon ? `<span class="penpot-menu__item-icon">${item.icon}</span>` : '<span class="penpot-menu__item-icon"></span>'}<span class="penpot-menu__item-label">${checkMark}${item.label || ''}</span>${item.shortcut ? `<span class="penpot-menu__item-shortcut">${item.shortcut}</span>` : ''}${hasSubmenu ? '<span class="penpot-menu__item-arrow">\u25B6</span>' : ''}`;
      if (hasSubmenu) {
        const submenu = document.createElement('div');
        submenu.className = 'penpot-menu__submenu';
        this.#renderItems(item.submenu, submenu);
        el.appendChild(submenu);
      }
      if (!item.disabled && !hasSubmenu) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.action) {
            if (isChecked) {
              this.#checkedState[item.action] = !this.#checkedState[item.action];
              this.emit('penpot-menu-action', { action: item.action, checked: this.#checkedState[item.action] });
            } else {
              this.emit('penpot-menu-action', { action: item.action });
            }
          }
          this.#closeAllMenus();
        });
      }
      el.addEventListener('mouseenter', () => el.focus());
      container.appendChild(el);
    }
  }

  set checkedState(state) {
    this.#checkedState = { ...this.#checkedState, ...state };
    if (this.#openMenuId) {
      const currentId = this.#openMenuId;
      this.#closeAllMenus();
      this.#openMenu(currentId);
    }
  }

  get checkedState() { return { ...this.#checkedState }; }
}

customElements.define('penpot-main-menu', PenpotMainMenu);