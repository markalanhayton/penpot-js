'use strict';
import { PenpotElement } from './base.js';

const TOKENS_STYLES = `
  .penpot-tokens__section { padding: 8px 12px; border-bottom: 1px solid var(--penpot-border, #444); }
  .penpot-tokens__section h4 { font-size: 10px; color: var(--penpot-text-dim, #999); text-transform: uppercase; margin: 0 0 8px; font-weight: 500; letter-spacing: 0.5px; display: inline; }
  .penpot-tokens__add-btn { background: none; border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); font-size: 11px; padding: 4px 8px; border-radius: 4px; cursor: pointer; width: 100%; margin-top: 4px; }
  .penpot-tokens__add-btn:hover { color: var(--penpot-text, #e6e6e6); border-color: var(--penpot-text-dim, #999); }
  .penpot-tokens__row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .penpot-tokens__swatch { width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--penpot-border, #444); flex-shrink: 0; cursor: pointer; }
  .penpot-tokens__swatch:hover { border-color: var(--penpot-primary, #31efb8); }
  .penpot-tokens__name { flex: 1; font-size: 11px; color: var(--penpot-text, #e6e6e6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .penpot-tokens__name-input { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: 4px; color: var(--penpot-text, #e6e6e6); padding: 2px 6px; font-size: 11px; outline: none; }
  .penpot-tokens__name-input:focus { border-color: var(--penpot-primary, #31efb8); }
  .penpot-tokens__del-btn { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 12px; padding: 2px 4px; }
  .penpot-tokens__del-btn:hover { color: #f44; }
  .penpot-tokens__color-input { width: 28px; height: 22px; border: none; background: none; cursor: pointer; padding: 0; flex-shrink: 0; }
  .penpot-tokens__tab-row { display: flex; gap: 2px; margin-bottom: 8px; }
  .penpot-tokens__tab { flex: 1; background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); font-size: 10px; padding: 4px 8px; border-radius: 4px 4px 0 0; cursor: pointer; text-align: center; }
  .penpot-tokens__tab.active { background: rgba(49,239,184,0.15); color: var(--penpot-primary, #31efb8); border-bottom-color: transparent; }
  .penpot-tokens__tab:hover { color: var(--penpot-text, #e6e6e6); }
  .penpot-tokens__set-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; padding: 4px; border-radius: 4px; cursor: pointer; }
  .penpot-tokens__set-row:hover { background: var(--penpot-surface-high, #333); }
  .penpot-tokens__set-row.active { background: rgba(49,239,184,0.1); }
  .penpot-tokens__theme-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .penpot-tokens__theme-select { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: 4px; color: var(--penpot-text, #e6e6e6); padding: 2px 4px; font-size: 11px; }
  .penpot-tokens__typo-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding: 4px; border-radius: 4px; cursor: pointer; }
  .penpot-tokens__typo-row:hover { background: var(--penpot-surface-high, #333); }
  .penpot-tokens__typo-preview { font-size: 13px; color: var(--penpot-text, #e6e6e6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

const template = document.createElement('template');
template.innerHTML = `<style>${TOKENS_STYLES}</style>
<div class="penpot-tokens__tab-row">
  <button class="penpot-tokens__tab active" data-token-tab="colors">Colors</button>
  <button class="penpot-tokens__tab" data-token-tab="typographies">Type</button>
  <button class="penpot-tokens__tab" data-token-tab="sets">Sets</button>
  <button class="penpot-tokens__tab" data-token-tab="themes">Themes</button>
</div>
<div id="tokens-content"></div>`;

export class PenpotTokensPanel extends PenpotElement {
  _template = template;
  #activeTab = 'colors';
  #fileData = null;
  #editingToken = null;

  set fileData(val) {
    this.#fileData = val;
    this.render();
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelectorAll('[data-token-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        this.#activeTab = tab.dataset.tokenTab;
        this.querySelectorAll('[data-token-tab]').forEach(t => t.classList.toggle('active', t.dataset.tokenTab === this.#activeTab));
        this.render();
      });
    });
  }

  render() {
    const content = this.querySelector('#tokens-content');
    if (!content) return;

    switch (this.#activeTab) {
      case 'colors': this.#renderColors(content); break;
      case 'typographies': this.#renderTypographies(content); break;
      case 'sets': this.#renderSets(content); break;
      case 'themes': this.#renderThemes(content); break;
    }
  }

  #renderColors(content) {
    const colors = this.#fileData?.data?.colors || [];
    const editing = this.#editingToken;

    content.innerHTML = `
      <div class="penpot-tokens__section">
        ${colors.map((color, i) => editing === `color-${i}` ? `
          <div class="penpot-tokens__row">
            <input type="color" class="penpot-tokens__color-input" value="${color.color || '#000000'}" data-color-index="${i}">
            <input type="text" class="penpot-tokens__name-input" value="${color.name || `Color ${i+1}`}" data-color-name="${i}" placeholder="Color name">
            <button class="penpot-tokens__del-btn" data-color-delete="${i}" title="Delete">\u2715</button>
          </div>
        ` : `
          <div class="penpot-tokens__row" data-color-row="${i}">
            <div class="penpot-tokens__swatch" style="background:${color.color || '#000'}" data-apply-color="${i}" title="${color.name || `Color ${i+1}`}"></div>
            <span class="penpot-tokens__name" data-color-edit="${i}">${color.name || `Color ${i+1}`}</span>
            <button class="penpot-tokens__del-btn" data-color-delete="${i}" title="Delete">\u2715</button>
          </div>
        `).join('')}
        <button class="penpot-tokens__add-btn" id="add-color-token">+ Add Color</button>
      </div>
    `;
    this.#bindColorEvents(content);
  }

  #renderTypographies(content) {
    const typos = this.#fileData?.data?.typographies || [];

    content.innerHTML = `
      <div class="penpot-tokens__section">
        ${typos.map((typo, i) => `
          <div class="penpot-tokens__typo-row" data-apply-typo="${i}">
            <div class="penpot-tokens__typo-preview" style="font-family:${typo.fontFamily || 'sans-serif'};font-size:${typo.fontSize || 14}px;font-weight:${typo.fontWeight || 'normal'};font-style:${typo.fontStyle || 'normal'}">
              ${typo.name || `Typography ${i+1}`}
            </div>
            <button class="penpot-tokens__del-btn" data-typo-delete="${i}" title="Delete">\u2715</button>
          </div>
        `).join('')}
        <button class="penpot-tokens__add-btn" id="add-typo-token">+ Add Typography</button>
      </div>
    `;
    this.#bindTypoEvents(content);
  }

  #renderSets(content) {
    const sets = this.#fileData?.data?.tokenSets || [];
    const activeSetIndex = this.#fileData?.data?.activeTokenSetIndex ?? 0;

    content.innerHTML = `
      <div class="penpot-tokens__section">
        <h4>Token Sets</h4>
        ${sets.map((set, i) => `
          <div class="penpot-tokens__set-row ${i === activeSetIndex ? 'active' : ''}" data-set-activate="${i}">
            <span class="penpot-tokens__name">${set.name || `Set ${i+1}`}</span>
            <button class="penpot-tokens__del-btn" data-set-delete="${i}" title="Delete">\u2715</button>
          </div>
        `).join('')}
        <button class="penpot-tokens__add-btn" id="add-token-set">+ Add Set</button>
      </div>
    `;
    this.#bindSetEvents(content);
  }

  #renderThemes(content) {
    const themes = this.#fileData?.data?.themes || [];
    const activeTheme = this.#fileData?.data?.activeTheme || 'default';

    content.innerHTML = `
      <div class="penpot-tokens__section">
        <h4>Themes</h4>
        <div class="penpot-tokens__theme-row">
          <select class="penpot-tokens__theme-select" id="theme-selector">
            ${themes.map((theme, i) => `<option value="${theme.name || `Theme ${i+1}`}" ${theme.name === activeTheme ? 'selected' : ''}>${theme.name || `Theme ${i+1}`}</option>`).join('')}
          </select>
        </div>
        ${themes.length === 0 ? '<div class="penpot-tokens__empty-state" style="color:var(--penpot-text-dim,#999);font-size:11px;padding:4px 0;">No themes. Default theme is active.</div>' : ''}
        <button class="penpot-tokens__add-btn" id="add-theme">+ Add Theme</button>
      </div>
    `;
    this.#bindThemeEvents(content);
  }

  #bindColorEvents(content) {
    content.querySelectorAll('[data-apply-color]').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const idx = parseInt(swatch.dataset.applyColor);
        const colors = this.#fileData?.data?.colors || [];
        if (colors[idx]) {
          this.emit('penpot-apply-color-token', { token: colors[idx], index: idx });
        }
      });
    });

    content.querySelectorAll('[data-color-edit]').forEach(name => {
      name.addEventListener('dblclick', () => {
        this.#editingToken = name.dataset.colorEdit;
        this.render();
      });
    });

    content.querySelectorAll('[data-color-name]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.dataset.colorName);
        this.emit('penpot-token-update', { type: 'color', index: idx, prop: 'name', value: input.value });
      });
      input.addEventListener('blur', () => {
        this.#editingToken = null;
      });
    });

    content.querySelectorAll('[data-color-index]').forEach(input => {
      input.addEventListener('input', () => {
        const idx = parseInt(input.dataset.colorIndex);
        this.emit('penpot-token-update', { type: 'color', index: idx, prop: 'color', value: input.value });
      });
    });

    content.querySelectorAll('[data-color-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.colorDelete);
        this.emit('penpot-token-delete', { type: 'color', index: idx });
      });
    });

    const addBtn = content.querySelector('#add-color-token');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.emit('penpot-token-add', { type: 'color' });
      });
    }
  }

  #bindTypoEvents(content) {
    content.querySelectorAll('[data-apply-typo]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.dataset.typoDelete) return;
        const idx = parseInt(row.dataset.applyTypo);
        const typos = this.#fileData?.data?.typographies || [];
        if (typos[idx]) {
          this.emit('penpot-apply-typo-token', { token: typos[idx], index: idx });
        }
      });
    });

    content.querySelectorAll('[data-typo-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.typoDelete);
        this.emit('penpot-token-delete', { type: 'typography', index: idx });
      });
    });

    const addBtn = content.querySelector('#add-typo-token');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.emit('penpot-token-add', { type: 'typography' });
      });
    }
  }

  #bindSetEvents(content) {
    content.querySelectorAll('[data-set-activate]').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.dataset.setActivate);
        this.emit('penpot-token-set-activate', { index: idx });
      });
    });

    content.querySelectorAll('[data-set-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.setDelete);
        this.emit('penpot-token-set-delete', { index: idx });
      });
    });

    const addBtn = content.querySelector('#add-token-set');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.emit('penpot-token-add', { type: 'token-set' });
      });
    }
  }

  #bindThemeEvents(content) {
    const selector = content.querySelector('#theme-selector');
    if (selector) {
      selector.addEventListener('change', () => {
        this.emit('penpot-token-theme-change', { theme: selector.value });
      });
    }

    const addBtn = content.querySelector('#add-theme');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.emit('penpot-token-add', { type: 'theme' });
      });
    }
  }
}

customElements.define('penpot-tokens-panel', PenpotTokensPanel);