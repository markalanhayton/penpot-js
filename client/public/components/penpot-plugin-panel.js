'use strict';
import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-plugin-panel { display: flex; flex-direction: column; height: 100%; background: var(--penpot-surface, #2a2a2a); color: var(--penpot-text, #e6e6e6); font-family: inherit; }
    .penpot-plugin__panel-header { padding: 12px 16px; border-bottom: 1px solid var(--penpot-border, #444); display: flex; align-items: center; justify-content: space-between; }
    .penpot-plugin__panel-title { font-size: 13px; font-weight: 600; }
    .penpot-plugin__panel-close { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 18px; padding: 2px 6px; }
    .penpot-plugin__panel-close:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-plugin__panel-body { flex: 1; overflow-y: auto; padding: 16px; }
    .penpot-plugin__plugin-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin-bottom: 6px; border: 1px solid var(--penpot-border, #444); border-radius: 4px; }
    .penpot-plugin__plugin-icon { width: 32px; height: 32px; border-radius: 4px; background: var(--penpot-surface-high, #333); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
    .penpot-plugin__plugin-info { flex: 1; min-width: 0; }
    .penpot-plugin__plugin-name { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-plugin__plugin-desc { font-size: 10px; color: var(--penpot-text-dim, #999); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-plugin__plugin-actions { display: flex; gap: 4px; }
    .penpot-plugin__plugin-btn { background: none; border: 1px solid var(--penpot-border, #444); border-radius: 4px; color: var(--penpot-text-dim, #999); padding: 4px 8px; font-size: 10px; cursor: pointer; }
    .penpot-plugin__plugin-btn:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
    .penpot-plugin__plugin-btn.penpot-plugin__danger:hover { background: rgba(244,67,54,0.08); color: var(--penpot-danger, #f44); }
    .penpot-plugin__plugin-btn.penpot-plugin__primary { background: var(--penpot-primary, #31efb8); color: #111; border-color: var(--penpot-primary, #31efb8); }
    .penpot-plugin__add-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--penpot-border, #444); }
    .penpot-plugin__add-input-row { display: flex; gap: 8px; margin-bottom: 8px; }
    .penpot-plugin__add-input { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: 4px; color: var(--penpot-text, #e6e6e6); padding: 6px 10px; font-size: 12px; outline: none; }
    .penpot-plugin__add-input:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-plugin__add-btn { background: var(--penpot-primary, #31efb8); color: #111; border: none; border-radius: 4px; padding: 6px 12px; font-size: 11px; cursor: pointer; font-weight: 600; }
    .penpot-plugin__add-btn:hover { background: var(--penpot-primary-hover, #28d4a3); }
    .penpot-plugin__empty-state { color: var(--penpot-text-dim, #999); text-align: center; padding: 24px 12px; font-size: 12px; }
  
  </style>
  <div class="penpot-plugin__panel-header">
    <span class="penpot-plugin__panel-title">Plugins</span>
    <button class="penpot-plugin__panel-close" id="close-btn">&times;</button>
  </div>
  <div class="penpot-plugin__panel-body" id="plugin-list">
    <div class="penpot-plugin__empty-state">No plugins loaded. Enter a manifest URL below to load a plugin.</div>
  </div>
  <div style="padding: 12px 16px; border-top: 1px solid var(--penpot-border, #444);">
    <div class="penpot-plugin__add-input-row">
      <input class="penpot-plugin__add-input" id="manifest-url" placeholder="https://example.com/manifest.json">
      <button class="penpot-plugin__add-btn" id="load-btn">Load</button>
    </div>
  </div>`;

export class PenpotPluginPanel extends PenpotElement {
  _template = template;
  #pluginManager = null;
  #plugins = [];

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#close-btn').addEventListener('click', () => {
      this.emit('penpot-plugin-close', {});
    });
    this.querySelector('#load-btn').addEventListener('click', () => this.#loadFromInput());
    this.querySelector('#manifest-url').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.#loadFromInput();
    });
  }

  set pluginManager(manager) {
    this.#pluginManager = manager;
    this.render();
  }

  get pluginManager() { return this.#pluginManager; }

  async #loadFromInput() {
    const input = this.querySelector('#manifest-url');
    const url = input.value.trim();
    if (!url || !this.#pluginManager) return;

    try {
      input.disabled = true;
      this.querySelector('#load-btn').disabled = true;
      const { pluginId, api } = await this.#pluginManager.loadPlugin(url);
      await this.#pluginManager.openPlugin(pluginId);
      input.value = '';
      this.render();
      this.emit('penpot-plugin-loaded', { pluginId, name: this.#pluginManager.getPlugin(pluginId)?.name });
    } catch (err) {
      this.emit('penpot-plugin-error', { error: err.message });
    } finally {
      input.disabled = false;
      this.querySelector('#load-btn').disabled = false;
    }
  }

  render() {
    const list = this.querySelector('#plugin-list');
    if (!list) return;

    const plugins = this.#pluginManager ? this.#pluginManager.getLoadedPlugins() : [];
    if (plugins.length === 0) {
      list.innerHTML = '<div class="penpot-plugin__empty-state">No plugins loaded. Enter a manifest URL below to load a plugin.</div>';
      return;
    }

    let html = '';
    for (const p of plugins) {
      const icon = p.icon || '\u25A1';
      html += `<div class="penpot-plugin__plugin-item" data-plugin-id="${this.escAttr(p.id)}">
        <div class="penpot-plugin__plugin-icon">${icon}</div>
        <div class="penpot-plugin__plugin-info">
          <div class="penpot-plugin__plugin-name">${this.escHtml(p.name)}</div>
          <div class="penpot-plugin__plugin-desc">${this.escHtml(p.description || 'No description')}</div>
        </div>
        <div class="penpot-plugin__plugin-actions">
          <button class="penpot-plugin__plugin-btn penpot-plugin__primary" data-action="open" data-id="${this.escAttr(p.id)}">Open</button>
          <button class="penpot-plugin__plugin-btn penpot-plugin__danger" data-action="unload" data-id="${this.escAttr(p.id)}">Remove</button>
        </div>
      </div>`;
    }
    list.innerHTML = html;

    list.querySelectorAll('[data-action="open"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (this.#pluginManager) this.#pluginManager.openPlugin(id);
      });
    });
    list.querySelectorAll('[data-action="unload"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (this.#pluginManager) {
          this.#pluginManager.unloadPlugin(id);
          this.render();
          this.emit('penpot-plugin-unloaded', { pluginId: id });
        }
      });
    });
  }

  escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
}

customElements.define('penpot-plugin-panel', PenpotPluginPanel);