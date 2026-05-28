'use strict';
import { PenpotElement } from './base.js';
import { getShortcuts } from '../lib/shortcuts.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-shortcuts-reference { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }
    .penpot-sc__dialog { background: var(--penpot-bg, #1c1c1c); border: 1px solid var(--penpot-border, #444); border-radius: 8px; min-width: 480px; max-width: 600px; max-height: 80vh; color: var(--penpot-text, #e6e6e6); display: flex; flex-direction: column; }
    .penpot-sc__header { padding: 16px 20px; border-bottom: 1px solid var(--penpot-border, #444); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    .penpot-sc__title { font-size: 15px; font-weight: 600; color: var(--penpot-text, #e6e6e6); }
    .penpot-sc__close { background: none; border: none; color: #999; font-size: 20px; cursor: pointer; padding: 4px; line-height: 1; }
    .penpot-sc__close:hover { color: #e6e6e6; }
    .penpot-sc__search { padding: 8px 20px; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-sc__search input { width: 100%; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: 4px; color: var(--penpot-text, #e6e6e6); padding: 6px 10px; font-size: 12px; outline: none; }
    .penpot-sc__search input:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-sc__list { flex: 1; overflow-y: auto; padding: 8px 0; }
    .penpot-sc__category { padding: 8px 20px 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--penpot-primary, #31efb8); font-weight: 600; }
    .penpot-sc__row { display: flex; align-items: center; justify-content: space-between; padding: 4px 20px; font-size: 12px; }
    .penpot-sc__row:hover { background: var(--penpot-surface-high, #333); }
    .penpot-sc__desc { color: var(--penpot-text, #e6e6e6); }
    .penpot-sc__keys { display: flex; gap: 4px; }
    .penpot-sc__key { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: 3px; padding: 1px 6px; font-size: 11px; font-family: monospace; color: var(--penpot-text-dim, #999); min-width: 20px; text-align: center; }
    .penpot-sc__empty { text-align: center; padding: 24px; color: var(--penpot-text-dim, #999); font-size: 12px; }
  
  </style>
  <div class="penpot-sc__dialog">
    <div class="penpot-sc__header">
      <span class="penpot-sc__title">Keyboard Shortcuts</span>
      <button class="penpot-sc__close" id="close-btn">&times;</button>
    </div>
    <div class="penpot-sc__search"><input id="search" type="text" placeholder="Search shortcuts..."></div>
    <div class="penpot-sc__list" id="list"></div>
  </div>`;

const CATEGORIES = {
  'Tools': ['v', 'h', 'f', 'r', 'e', 't', 'p', 'i'],
  'Edit': ['z', 'y', 'd', 'c', 'v', 'a', 'g', 's'],
  'View': ['+', '-', '0', '1', '2'],
  'Boolean': ['u', 'd', 'i', 'e'],
  'Other': ['Escape'],
};

const SHORTCUT_LABELS = {
  'v': 'Select Tool',
  'h': 'Hand Tool',
  'f': 'Frame Tool',
  'r': 'Rectangle Tool',
  'e': 'Ellipse Tool',
  't': 'Text Tool',
  'p': 'Pen/Path Tool',
  'i': 'Image Tool',
  'z': 'Undo',
  'y': 'Redo',
  'd': 'Duplicate',
  'c': 'Copy',
  'v': 'Paste',
  'a': 'Select All',
  'g': 'Group',
  's': 'Save',
  '+': 'Zoom In',
  '-': 'Zoom Out',
  '0': 'Zoom to Fit',
  '1': 'Zoom 100%',
  '2': 'Zoom 200%',
  'u': 'Boolean Union',
  'd': 'Boolean Difference',
  'i': 'Boolean Intersection',
  'e': 'Boolean Exclude',
  'Escape': 'Deselect / Cancel',
};

function formatShortcut(combo) {
  const parts = combo.split('+');
  return parts.map(p => {
    if (p === 'mod') return 'Ctrl';
    if (p === 'shift') return 'Shift';
    if (p === 'alt') return 'Alt';
    if (p === ' ') return 'Space';
    return p.toUpperCase();
  });
}

export class PenpotShortcutsReference extends PenpotElement {
  _template = template;
  #shortcuts = [];

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'none';

    this.querySelector('#close-btn').addEventListener('click', () => this.close());

    this.querySelector('#overlay, .penpot-sc__dialog')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget && e.target.classList.contains('penpot-sc__overlay')) this.close();
    });

    this.querySelector('#search').addEventListener('input', () => {
      this.#renderList(this.querySelector('#search').value);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.style.display !== 'none') {
        this.close();
      }
    });
  }

  open() {
    this.#shortcuts = getShortcuts();
    this.style.display = '';
    this.setAttribute('open', '');
    this.#renderList('');
    const searchInput = this.querySelector('#search');
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
  }

  close() {
    this.style.display = 'none';
    this.removeAttribute('open');
    this.emit('shortcuts-close', {});
  }

  #renderList(filter) {
    const list = this.querySelector('#list');
    if (!list) return;

    const q = (filter || '').toLowerCase();
    let html = '';

    const allShortcuts = this.#shortcuts.length > 0 ? this.#shortcuts : Object.entries(SHORTCUT_LABELS).map(([key, desc]) => ({ combo: key, key, description: desc }));

    const filtered = q
      ? allShortcuts.filter(s => (s.description || '').toLowerCase().includes(q) || (s.combo || '').toLowerCase().includes(q) || (s.key || '').toLowerCase().includes(q))
      : allShortcuts;

    if (filtered.length === 0) {
      html = '<div class="penpot-sc__empty">No shortcuts found.</div>';
      list.innerHTML = html;
      return;
    }

    const grouped = {};
    for (const s of filtered) {
      const key = (s.key || '').toLowerCase();
      let category = 'Other';
      for (const [cat, keys] of Object.entries(CATEGORIES)) {
        if (keys.some(k => k.toLowerCase() === key)) {
          category = cat;
          break;
        }
      }
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(s);
    }

    for (const category of Object.keys(grouped).sort()) {
      html += `<div class="penpot-sc__category">${category}</div>`;
      for (const s of grouped[category]) {
        const keys = formatShortcut(s.combo || s.key || '');
        const desc = s.description || SHORTCUT_LABELS[(s.key || '').toLowerCase()] || '';
        html += `<div class="penpot-sc__row">`;
        html += `<span class="penpot-sc__desc">${desc}</span>`;
        html += `<span class="penpot-sc__keys">`;
        for (const k of keys) {
          html += `<span class="penpot-sc__key">${k}</span>`;
        }
        html += `</span></div>`;
      }
    }

    list.innerHTML = html;
  }

  render() {}
}

customElements.define('penpot-shortcuts-reference', PenpotShortcutsReference);