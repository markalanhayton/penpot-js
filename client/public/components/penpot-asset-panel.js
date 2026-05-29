'use strict';
import { PenpotElement } from './base.js';
import { processFontBlobs, uploadFontVariant, groupFontsByFamily } from '../lib/fonts.js';
import { SYSTEM_FONTS } from '@penpot/shared/constants';
import { groupVariantFamilies, buildVariantDisplayName } from '../lib/components-lib.js';
import './penpot-tokens-panel.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-asset-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .penpot-assets__asset-tabs { display: flex; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; flex-wrap: wrap; }
    .penpot-assets__asset-tab { flex: 1; min-width: 0; padding: 6px 0; font-size: 10px; text-align: center; cursor: pointer; color: var(--penpot-text-dim, #999); border: none; border-bottom: 2px solid transparent; background: none; font-family: inherit; white-space: nowrap; }
    .penpot-assets__asset-tab:hover { color: var(--penpot-text, #e6e6e6); background: var(--penpot-surface-high, #333); }
    .penpot-assets__asset-tab.penpot-assets__active { color: var(--penpot-primary, #31efb8); border-bottom-color: var(--penpot-primary, #31efb8); }
    .penpot-assets__asset-content { flex: 1; overflow-y: auto; }
    .penpot-assets__asset-toolbar { display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-bottom: 1px solid var(--penpot-border, #444); }
    .penpot-assets__asset-search { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: 3px 8px; font-size: 11px; outline: none; }
    .penpot-assets__asset-search:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-assets__asset-search::placeholder { color: var(--penpot-text-disabled, #666); }
    .penpot-assets__asset-btn { background: none; border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); border-radius: var(--penpot-radius-s, 4px); padding: 2px 8px; font-size: 11px; cursor: pointer; }
    .penpot-assets__asset-btn:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
    .penpot-assets__component-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 6px; padding: 8px; }
    .penpot-assets__component-card { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; overflow: hidden; transition: border-color 0.15s; }
    .penpot-assets__component-card:hover { border-color: var(--penpot-primary, #31efb8); }
    .penpot-assets__component-thumb { width: 100%; aspect-ratio: 1; background: var(--penpot-surface, #2a2a2a); display: flex; align-items: center; justify-content: center; font-size: 24px; color: var(--penpot-text-dim, #999); }
    .penpot-assets__component-label { font-size: 9px; color: var(--penpot-text-dim, #999); padding: 3px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .penpot-assets__font-list { padding: 4px 0; }
    .penpot-assets__font-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 11px; color: var(--penpot-text, #e6e6e6); cursor: default; }
    .penpot-assets__font-item:hover { background: var(--penpot-surface-high, #333); }
    .penpot-assets__font-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-assets__font-preview { font-size: 14px; color: var(--penpot-text-dim, #999); }
    .penpot-assets__font-remove { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; padding: 2px; font-size: 10px; }
    .penpot-assets__font-remove:hover { color: var(--penpot-danger, #f44); }
    .penpot-assets__media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 6px; padding: 8px; }
    .penpot-assets__media-card { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); overflow: hidden; cursor: pointer; }
    .penpot-assets__media-card:hover { border-color: var(--penpot-primary, #31efb8); }
    .penpot-assets__media-thumb { width: 100%; aspect-ratio: 4/3; background: var(--penpot-surface, #2a2a2a); display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--penpot-text-dim, #999); }
    .penpot-assets__media-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .penpot-assets__media-label { font-size: 9px; color: var(--penpot-text-dim, #999); padding: 3px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .penpot-assets__swatch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(32px, 1fr)); gap: 4px; padding: 8px; }
    .penpot-assets__swatch { width: 32px; height: 32px; border-radius: var(--penpot-radius-s, 4px); cursor: pointer; border: 2px solid transparent; position: relative; transition: border-color 0.1s; }
    .penpot-assets__swatch:hover { border-color: var(--penpot-text, #e6e6e6); }
    .penpot-assets__swatch.penpot-assets__swatch-selected { border-color: var(--penpot-primary, #31efb8); }
    .penpot-assets__swatch-delete { position: absolute; top: -4px; right: -4px; width: 14px; height: 14px; border-radius: 50%; background: var(--penpot-danger, #f44); color: #fff; font-size: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; line-height: 1; opacity: 0; transition: opacity 0.1s; }
    .penpot-assets__swatch:hover .penpot-assets__swatch-delete { opacity: 1; }
    .penpot-assets__swatch-label { font-size: 9px; color: var(--penpot-text-dim, #999); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
    .penpot-assets__color-item { display: flex; align-items: center; gap: 8px; padding: 4px 12px; cursor: pointer; }
    .penpot-assets__color-item:hover { background: var(--penpot-surface-high, #333); }
    .penpot-assets__color-swatch { width: 20px; height: 20px; border-radius: 3px; border: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-assets__color-name { flex: 1; font-size: 11px; color: var(--penpot-text, #e6e6e6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-assets__color-delete { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; padding: 2px; font-size: 10px; }
    .penpot-assets__color-delete:hover { color: var(--penpot-danger, #f44); }
    .penpot-assets__recent-label { font-size: 10px; color: var(--penpot-text-dim, #999); text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 12px 2px; }
    .penpot-assets__recent-row { display: flex; gap: 4px; padding: 4px 12px 8px; flex-wrap: wrap; }
    .penpot-assets__recent-swatch { width: 24px; height: 24px; border-radius: 3px; border: 1px solid var(--penpot-border, #444); cursor: pointer; transition: border-color 0.1s; flex-shrink: 0; }
    .penpot-assets__recent-swatch:hover { border-color: var(--penpot-text, #e6e6e6); }
    .penpot-assets__typo-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--penpot-border, #444); }
    .penpot-assets__typo-item:hover { background: var(--penpot-surface-high, #333); }
    .penpot-assets__typo-preview { flex: 1; }
    .penpot-assets__typo-name { font-size: 11px; color: var(--penpot-text, #e6e6e6); }
    .penpot-assets__typo-detail { font-size: 10px; color: var(--penpot-text-dim, #999); margin-top: 2px; }
    .penpot-assets__typo-delete { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; padding: 2px; font-size: 10px; flex-shrink: 0; }
    .penpot-assets__typo-delete:hover { color: var(--penpot-danger, #f44); }
    .penpot-assets__add-row { display: flex; align-items: center; gap: 4px; padding: 6px 12px; }
    .penpot-assets__add-input { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: 2px 6px; font-size: 11px; outline: none; min-width: 0; }
    .penpot-assets__add-input:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-assets__add-color-input { width: 28px; height: 24px; padding: 0; border: 1px solid var(--penpot-border, #444); border-radius: 3px; background: none; cursor: pointer; }
    .penpot-assets__empty-state { color: var(--penpot-text-dim, #999); text-align: center; padding: 24px 12px; font-size: 11px; }
    .penpot-assets__variant-family { margin-bottom: 8px; }
    .penpot-assets__variant-family-header { display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--penpot-surface, #2a2a2a); cursor: pointer; user-select: none; border-radius: var(--penpot-radius-s, 4px) var(--penpot-radius-s, 4px) 0 0; }
    .penpot-assets__variant-family-header:hover { background: var(--penpot-surface-high, #333); }
    .penpot-assets__variant-family-header .penpot-assets__collapse-arrow { font-size: 8px; transition: transform 0.15s; color: var(--penpot-text-dim, #999); flex-shrink: 0; }
    .penpot-assets__variant-family-header.collapsed .penpot-assets__collapse-arrow { transform: rotate(-90deg); }
    .penpot-assets__variant-family-name { font-size: 11px; font-weight: 600; color: var(--penpot-text, #e6e6e6); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-assets__variant-family-badge { font-size: 9px; background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); color: var(--penpot-primary, #31efb8); padding: 1px 5px; border-radius: 8px; flex-shrink: 0; }
    .penpot-assets__variant-children { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 4px; padding: 4px 8px 8px; background: rgba(49,239,184,0.03); border: 1px solid rgba(49,239,184,0.1); border-top: none; border-radius: 0 0 var(--penpot-radius-s, 4px) var(--penpot-radius-s, 4px); }
    .penpot-assets__variant-children.collapsed { display: none; }
    .penpot-assets__variant-item { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; overflow: hidden; transition: border-color 0.15s; }
    .penpot-assets__variant-item:hover { border-color: var(--penpot-primary, #31efb8); }
    .penpot-assets__variant-values { font-size: 8px; color: var(--penpot-text-dim, #999); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 2px 4px 3px; }
  
  </style>
  <div class="penpot-assets__asset-tabs">
    <button class="penpot-assets__asset-tab penpot-assets__active" data-tab="components">Components</button>
    <button class="penpot-assets__asset-tab" data-tab="colors">Colors</button>
    <button class="penpot-assets__asset-tab" data-tab="typography">Typography</button>
    <button class="penpot-assets__asset-tab" data-tab="fonts">Fonts</button>
    <button class="penpot-assets__asset-tab" data-tab="media">Media</button>
    <button class="penpot-assets__asset-tab" data-tab="tokens">Tokens</button>
  </div>
  <div class="penpot-assets__asset-content" id="content"></div>`;


const FONT_WEIGHT_NAMES = {
  100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular',
  500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black',
};

export class PenpotAssetPanel extends PenpotElement {
  _template = template;
  #activeTab = 'components';
  #searchQuery = '';
  #components = [];
  #fonts = [];
  #media = [];
  #colors = [];
  #recentColors = [];
  #libraryColors = [];
  #libraryTypographies = [];
  #typographies = [];
  #editingTypoId = null;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelectorAll('.penpot-assets__asset-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.#activeTab = tab.dataset.tab;
        this.querySelectorAll('.penpot-assets__asset-tab').forEach(t => t.classList.toggle('penpot-assets__active', t.dataset.tab === this.#activeTab));
        this.render();
      });
    });
  }

  set components(val) {
    this.#components = val || [];
    if (this.#activeTab === 'components') this.render();
  }

  set fonts(val) {
    this.#fonts = val || [];
    if (this.#activeTab === 'fonts') this.render();
  }

  set media(val) {
    this.#media = val || [];
    if (this.#activeTab === 'media') this.render();
  }

  set colors(val) {
    this.#colors = val || [];
    if (this.#activeTab === 'colors') this.render();
  }

  set recentColors(val) {
    this.#recentColors = val || [];
    if (this.#activeTab === 'colors') this.render();
  }

  set libraryColors(val) {
    this.#libraryColors = val || [];
    if (this.#activeTab === 'colors') this.render();
  }

  set libraryTypographies(val) {
    this.#libraryTypographies = val || [];
    if (this.#activeTab === 'typography') this.render();
  }

  set typographies(val) {
    this.#typographies = val || [];
    if (this.#activeTab === 'typography') this.render();
  }

  getAvailableComponents() {
    if (this.#searchQuery) {
      const q = this.#searchQuery.toLowerCase();
      return this.#components.filter(c => c.name.toLowerCase().includes(q));
    }
    return this.#components;
  }

  getAvailableFonts() {
    const fonts = this.#fonts.length > 0 ? this.#fonts : SYSTEM_FONTS;
    if (!this.#searchQuery) return fonts;
    const q = this.#searchQuery.toLowerCase();
    return fonts.filter(f => (f.label || f.name).toLowerCase().includes(q));
  }

  getAvailableColors() {
    const colors = this.#colors;
    if (!this.#searchQuery) return colors;
    const q = this.#searchQuery.toLowerCase();
    return colors.filter(c => (c.name || '').toLowerCase().includes(q));
  }

  getAvailableTypographies() {
    const typos = this.#typographies;
    if (!this.#searchQuery) return typos;
    const q = this.#searchQuery.toLowerCase();
    return typos.filter(t => (t.name || '').toLowerCase().includes(q));
  }

  render() {
    const content = this.querySelector('#content');
    if (!content) return;

    let html = `<div class="penpot-assets__asset-toolbar"><input class="penpot-assets__asset-search" placeholder="Search..." value="${this.escHtml(this.#searchQuery)}" id="asset-search"></div>`;

    if (this.#activeTab === 'components') {
      html += this.#renderComponents();
    } else if (this.#activeTab === 'colors') {
      html += this.#renderColors();
    } else if (this.#activeTab === 'typography') {
      html += this.#renderTypographies();
    } else if (this.#activeTab === 'fonts') {
      html += this.#renderFonts();
    } else if (this.#activeTab === 'tokens') {
      html += '<penpot-tokens-panel id="tokens-panel"></penpot-tokens-panel>';
    } else {
      html += this.#renderMedia();
    }

    content.innerHTML = html;
    this.#bindEvents(content);
  }

  #renderComponents() {
    const components = this.getAvailableComponents();
    if (components.length === 0) {
      if (this.#components.length === 0) {
        return '<div class="penpot-assets__empty-state">No components in this file yet. Select shapes and use "Create Component" to add one.</div>';
      }
      return '<div class="penpot-assets__empty-state">No components match your search.</div>';
    }

    const variantIds = new Set();
    const standalone = [];
    const families = new Map();

    for (const comp of components) {
      const vid = comp['variant-id'] || comp.variantId;
      if (vid) {
        variantIds.add(vid);
        if (!families.has(vid)) {
          families.set(vid, { name: comp.path || comp.name?.split('/')[0] || comp.name || 'Variant', items: [] });
        }
        const vProps = comp['variant-properties'] || comp.variantProperties || [];
        const displayName = buildVariantDisplayName(vProps) || comp.name || 'Variant';
        families.get(vid).items.push({ ...comp, _displayName: displayName, _variantProps: vProps });
      } else {
        standalone.push(comp);
      }
    }

    let html = '';
    if (standalone.length > 0) {
      html += '<div class="penpot-assets__component-grid">';
      for (const comp of standalone) {
        html += `<div class="penpot-assets__component-card" data-component-id="${this.escAttr(comp.id)}" title="${this.escHtml(comp.name)}">
          <div class="penpot-assets__component-thumb">${this.escHtml(comp.icon || '\u25A1')}</div>
          <div class="penpot-assets__component-label">${this.escHtml(comp.name)}</div>
        </div>`;
      }
      html += '</div>';
    }

    for (const [variantId, family] of families) {
      const variantCount = family.items.length;
      html += `<div class="penpot-assets__variant-family" data-variant-id="${this.escAttr(variantId)}">`;
      html += `<div class="penpot-assets__variant-family-header" data-toggle-variant="${this.escAttr(variantId)}">`;
      html += `<span class="penpot-assets__collapse-arrow">\u25BC</span>`;
      html += `<span class="penpot-assets__variant-family-name">${this.escHtml(family.name)}</span>`;
      html += `<span class="penpot-assets__variant-family-badge">${variantCount}</span>`;
      html += `</div>`;
      html += `<div class="penpot-assets__variant-children" data-variant-children="${this.escAttr(variantId)}">`;
      for (const item of family.items) {
        html += `<div class="penpot-assets__variant-item" data-component-id="${this.escAttr(item.id)}" title="${this.escHtml(item._displayName)}" draggable="true">
          <div class="penpot-assets__component-thumb">${this.escHtml(item.icon || '\u25C6')}</div>
          <div class="penpot-assets__variant-values">${this.escHtml(item._displayName)}</div>
        </div>`;
      }
      html += '</div></div>';
    }

    return html;
  }

  #renderColors() {
    const colors = this.getAvailableColors();
    let html = '<div style="padding:8px;display:flex;gap:4px;"><button class="penpot-assets__asset-btn" id="btn-add-color">+ Solid</button><button class="penpot-assets__asset-btn" id="btn-add-gradient">+ Gradient</button>';
    if (this.#libraryColors && this.#libraryColors.length > 0) {
      html += '<button class="penpot-assets__asset-btn" id="btn-sync-colors" title="Sync colors from connected libraries">&#x21bb; Sync Library</button>';
    }
    html += '</div>';
    if (this.#recentColors.length > 0) {
      html += '<div class="penpot-assets__recent-label">Recent</div>';
      html += '<div class="penpot-assets__recent-row">';
      for (const rc of this.#recentColors) {
        const bgStyle = rc.gradient
          ? `background:linear-gradient(135deg, ${rc.gradient.stops?.[0]?.color || '#000'} 0%, ${rc.gradient.stops?.[rc.gradient.stops.length - 1]?.color || '#fff'} 100%)`
          : `background:${rc.color || '#000'}`;
        const opacity = rc.opacity != null ? rc.opacity : 1;
        html += `<div class="penpot-assets__recent-swatch" style="${bgStyle};opacity:${opacity}" data-recent-color-id="${this.escAttr(rc.id)}" title="${this.escHtml(rc.name || rc.color || '')}"></div>`;
      }
      html += '</div>';
    }
    if (colors.length === 0 && !this.#searchQuery) {
      html += '<div class="penpot-assets__empty-state">No colors in this file yet. Add a color to reuse it across shapes.</div>';
    } else {
      html += '<div style="padding:0 4px;">';
      for (const c of colors) {
        const bgStyle = c.gradient
          ? `background:linear-gradient(135deg, ${c.gradient.stops?.[0]?.color || '#000'} 0%, ${c.gradient.stops?.[c.gradient.stops.length - 1]?.color || '#fff'} 100%)`
          : `background:${c.color || '#000'}`;
        const opacity = c.opacity != null ? c.opacity : 1;
        html += `<div class="penpot-assets__color-item" data-color-id="${this.escAttr(c.id)}">
          <div class="penpot-assets__color-swatch" style="${bgStyle};opacity:${opacity}" title="${this.escHtml(c.name || c.color || '')}"></div>
          <span class="penpot-assets__color-name" data-color-name="${this.escAttr(c.id)}">${this.escHtml(c.name || c.color || 'Unnamed')}</span>
          <button class="penpot-assets__color-delete" data-delete-color="${this.escAttr(c.id)}" title="Delete color">\u00D7</button>
        </div>`;
      }
      html += '</div>';
    }
    return html;
  }

  #renderTypographies() {
    const typos = this.getAvailableTypographies();
    let html = '<div style="padding:8px;"><button class="penpot-assets__asset-btn" id="btn-add-typography">+ Add Typography</button>';
    if (this.#libraryTypographies && this.#libraryTypographies.length > 0) {
      html += ' <button class="penpot-assets__asset-btn" id="btn-sync-typographies" title="Sync typographies from connected libraries">&#x21bb; Sync Library</button>';
    }
    html += '</div>';
    if (typos.length === 0 && !this.#searchQuery) {
      html += '<div class="penpot-assets__empty-state">No typography styles yet. Add a typography to reuse text styles across shapes.</div>';
    } else {
      html += '<div>';
      for (const t of typos) {
        const w = t.fontWeight || '400';
        const s = t.fontStyle === 'italic' ? 'italic' : 'normal';
        const ff = t.fontFamily || 'sans-serif';
        const fs = t.fontSize || '14';
        if (this.#editingTypoId === t.id) {
          const lh = t.lineHeight || '1.5';
          const ls = t.letterSpacing || '0';
          const tt = t.textTransform || 'none';
          html += `<div class="penpot-assets__typo-item" data-typo-id="${this.escAttr(t.id)}" style="flex-direction:column;align-items:stretch;gap:4px;">
            <div style="display:flex;gap:4px;align-items:center;">
              <input class="penpot-assets__add-input" data-typo-field="name" value="${this.escAttr(t.name || 'Unnamed')}" style="flex:1;font-size:11px;padding:2px 4px;">
              <button class="penpot-assets__asset-btn" data-typo-save="${this.escAttr(t.id)}" style="font-size:10px;padding:2px 6px;">Save</button>
              <button class="penpot-assets__typo-delete" data-typo-cancel="${this.escAttr(t.id)}" title="Cancel" style="font-size:12px;">\u2715</button>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;">
              <input class="penpot-assets__add-input" data-typo-field="fontFamily" value="${this.escAttr(ff)}" placeholder="Font" style="flex:1;min-width:80px;font-size:10px;padding:2px 4px;">
              <input class="penpot-assets__add-input" data-typo-field="fontSize" value="${this.escAttr(fs)}" placeholder="Size" style="width:40px;font-size:10px;padding:2px 4px;">
              <input class="penpot-assets__add-input" data-typo-field="fontWeight" value="${this.escAttr(w)}" placeholder="Weight" style="width:40px;font-size:10px;padding:2px 4px;">
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;">
              <input class="penpot-assets__add-input" data-typo-field="lineHeight" value="${this.escAttr(lh)}" placeholder="Line H" style="width:40px;font-size:10px;padding:2px 4px;">
              <input class="penpot-assets__add-input" data-typo-field="letterSpacing" value="${this.escAttr(ls)}" placeholder="Letter Sp" style="width:40px;font-size:10px;padding:2px 4px;">
              <select class="penpot-assets__add-input" data-typo-field="fontStyle" style="font-size:10px;padding:2px 4px;">
                <option value="normal"${s === 'normal' ? ' selected' : ''}>Normal</option>
                <option value="italic"${s === 'italic' ? ' selected' : ''}>Italic</option>
              </select>
            </div>
          </div>`;
        } else {
          const detail = `${ff} ${w} ${fs}px${t.lineHeight && t.lineHeight !== '1' ? '/' + t.lineHeight : ''}${s === 'italic' ? ' italic' : ''}`;
          html += `<div class="penpot-assets__typo-item" data-typo-id="${this.escAttr(t.id)}">
            <div class="penpot-assets__typo-preview">
              <div class="penpot-assets__typo-name" data-typo-name="${this.escAttr(t.id)}" style="font-family:${ff};font-weight:${w};font-style:${s};font-size:14px;line-height:1.4;">${this.escHtml(t.name || 'Unnamed')}</div>
              <div class="penpot-assets__typo-detail">${this.escHtml(detail)}</div>
            </div>
            <button class="penpot-assets__asset-btn" data-edit-typo="${this.escAttr(t.id)}" style="font-size:10px;padding:2px 6px;">Edit</button>
            <button class="penpot-assets__typo-delete" data-delete-typo="${this.escAttr(t.id)}" title="Delete typography">\u00D7</button>
          </div>`;
        }
      }
      html += '</div>';
    }
    return html;
  }

  #renderFonts() {
    const fonts = this.getAvailableFonts();
    if (fonts.length === 0) {
      return '<div class="penpot-assets__empty-state">No fonts found.</div>';
    }
    let html = '<div class="penpot-assets__font-list">';
    for (const font of fonts) {
      html += `<div class="penpot-assets__font-item" data-font-id="${this.escAttr(font.id)}">
        <span class="penpot-assets__font-preview" style="font-family: ${font.family}">Aa</span>
        <span class="penpot-assets__font-name">${this.escHtml(font.label || font.name)}</span>
        <button class="penpot-assets__font-remove" data-remove-font="${this.escAttr(font.id)}" title="Remove font">\u00D7</button>
      </div>`;
    }
    html += '</div>';
    html += '<div style="padding:8px;"><button class="penpot-assets__asset-btn" id="btn-upload-font">+ Upload Font</button></div>';
    return html;
  }

  #renderMedia() {
    if (this.#media.length === 0) {
      return '<div class="penpot-assets__empty-state">No media assets. Upload images to use them in your designs.</div>';
    }
    let html = '<div class="penpot-assets__media-grid">';
    for (const item of this.#media) {
      const thumbUrl = item.thumbnailId ? `/assets/by-id/${item.thumbnailId}` : item.mediaId ? `/assets/by-id/${item.mediaId}` : null;
      const thumbHtml = thumbUrl ? `<img src="${thumbUrl}" alt="${this.escAttr(item.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">` : (item.icon || '\u{1F5BC}');
      html += `<div class="penpot-assets__media-card" data-media-id="${this.escAttr(item.id)}" title="${this.escHtml(item.name)}">
        <div class="penpot-assets__media-thumb">${thumbHtml}</div>
        <div class="penpot-assets__media-label">${this.escHtml(item.name)}</div>
      </div>`;
    }
    html += '</div>';
    html += '<div style="padding:8px;"><button class="penpot-assets__asset-btn" id="btn-upload-media">+ Upload Image</button></div>';
    return html;
  }

  #bindEvents(content) {
    const searchInput = content.querySelector('#asset-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.#searchQuery = searchInput.value;
        this.render();
      });
      searchInput.focus();
    }

    content.querySelectorAll('.penpot-assets__component-card').forEach(card => {
      card.addEventListener('click', () => {
        this.emit('penpot-asset-use', { type: 'component', id: card.dataset.componentId });
      });
      card.setAttribute('draggable', 'true');
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/penpot-component', card.dataset.componentId);
        e.dataTransfer.effectAllowed = 'copy';
        try { e.dataTransfer.setDragImage(card, card.offsetWidth / 2, card.offsetHeight / 2); } catch (_) {}
      });
    });

    content.querySelectorAll('.penpot-assets__variant-family-header').forEach(header => {
      header.addEventListener('click', () => {
        const variantId = header.dataset.toggleVariant;
        const children = content.querySelector(`[data-variant-children="${CSS.escape(variantId || '')}"]`);
        if (children) {
          const isCollapsed = children.classList.toggle('collapsed');
          header.classList.toggle('collapsed', isCollapsed);
        }
      });
    });

    content.querySelectorAll('.penpot-assets__variant-item').forEach(item => {
      item.addEventListener('click', () => {
        this.emit('penpot-asset-use', { type: 'component', id: item.dataset.componentId });
      });
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/penpot-component', item.dataset.componentId);
        e.dataTransfer.effectAllowed = 'copy';
        try { e.dataTransfer.setDragImage(item, item.offsetWidth / 2, item.offsetHeight / 2); } catch (_) {}
      });
    });

    content.querySelectorAll('.penpot-assets__font-item').forEach(item => {
      item.addEventListener('click', () => {
        this.emit('penpot-asset-use', { type: 'font', id: item.dataset.fontId });
      });
    });

    content.querySelectorAll('[data-remove-font]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.emit('penpot-font-remove', { id: btn.dataset.removeFont });
      });
    });

    content.querySelectorAll('.penpot-assets__media-card').forEach(card => {
      card.addEventListener('click', () => {
        this.emit('penpot-asset-use', { type: 'media', id: card.dataset.mediaId });
      });
    });

    const addColorBtn = content.querySelector('#btn-add-color');
    if (addColorBtn) {
      addColorBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = '#31efb8';
        input.addEventListener('input', () => {
          const color = input.value;
          addColorBtn.style.backgroundColor = color;
        });
        input.addEventListener('change', () => {
          const hex = input.value;
          const name = hex;
          this.emit('penpot-color-add', { color: hex, name });
        });
        input.click();
      });
    }

    const addGradientBtn = content.querySelector('#btn-add-gradient');
    if (addGradientBtn) {
      addGradientBtn.addEventListener('click', () => {
        const startInput = document.createElement('input');
        startInput.type = 'color';
        startInput.value = '#31efb8';
        const endInput = document.createElement('input');
        endInput.type = 'color';
        endInput.value = '#0d47a1';
        const pickStart = () => new Promise(resolve => { startInput.addEventListener('change', resolve, { once: true }); startInput.click(); });
        const pickEnd = () => new Promise(resolve => { endInput.addEventListener('change', resolve, { once: true }); endInput.click(); });
        pickStart().then(() => pickEnd()).then(() => {
          const gradient = { type: 'linear-gradient', stops: [{ offset: 0, color: startInput.value }, { offset: 1, color: endInput.value }], angle: 0 };
          const name = `${startInput.value} → ${endInput.value}`;
          this.emit('penpot-color-add', { color: startInput.value, name, gradient });
        });
      });
    }

    const syncColorsBtn = content.querySelector('#btn-sync-colors');
    if (syncColorsBtn) {
      syncColorsBtn.addEventListener('click', () => {
        this.emit('penpot-sync-library-colors');
      });
    }

    content.querySelectorAll('[data-delete-color]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.emit('penpot-color-delete', { id: btn.dataset.deleteColor });
      });
    });

    content.querySelectorAll('[data-color-name]').forEach(nameEl => {
      nameEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const colorId = nameEl.dataset.colorName;
        const colorObj = this.#colors.find(c => c.id === colorId);
        if (!colorObj) return;
        const currentName = colorObj.name || colorObj.color || 'Unnamed';
        const input = document.createElement('input');
        input.className = 'penpot-assets__add-input';
        input.value = currentName;
        input.style.cssText = 'width:100%;font-size:11px;padding:1px 4px;';
        nameEl.replaceWith(input);
        input.focus();
        input.select();
        const commit = () => {
          const newName = input.value.trim();
          if (newName && newName !== currentName) {
            this.emit('penpot-color-rename', { id: colorId, name: newName });
          }
          this.render();
        };
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
          if (ke.key === 'Escape') { this.render(); }
        });
        input.addEventListener('blur', commit);
      });
    });

    content.querySelectorAll('.penpot-assets__color-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-delete-color]')) return;
        this.emit('penpot-color-use', { id: item.dataset.colorId });
      });
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/penpot-color', item.dataset.colorId);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });

    content.querySelectorAll('.penpot-assets__recent-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        this.emit('penpot-color-use', { id: swatch.dataset.recentColorId });
      });
      swatch.setAttribute('draggable', 'true');
      swatch.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/penpot-color', swatch.dataset.recentColorId);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });

    const addTypoBtn = content.querySelector('#btn-add-typography');
    if (addTypoBtn) {
      addTypoBtn.addEventListener('click', () => {
        this.emit('penpot-typography-add', {});
      });
    }

    const syncTyposBtn = content.querySelector('#btn-sync-typographies');
    if (syncTyposBtn) {
      syncTyposBtn.addEventListener('click', () => {
        this.emit('penpot-sync-library-typographies');
      });
    }

    content.querySelectorAll('[data-delete-typo]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.emit('penpot-typography-delete', { id: btn.dataset.deleteTypo });
      });
    });

    content.querySelectorAll('[data-typo-name]').forEach(nameEl => {
      nameEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const typoId = nameEl.dataset.typoName;
        const typoObj = this.#typographies.find(t => t.id === typoId);
        if (!typoObj) return;
        const currentName = typoObj.name || 'Unnamed';
        const input = document.createElement('input');
        input.className = 'penpot-assets__add-input';
        input.value = currentName;
        input.style.cssText = 'width:100%;font-size:11px;padding:1px 4px;';
        nameEl.replaceWith(input);
        input.focus();
        input.select();
        const commit = () => {
          const newName = input.value.trim();
          if (newName && newName !== currentName) {
            this.emit('penpot-typography-rename', { id: typoId, name: newName });
          }
          this.render();
        };
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
          if (ke.key === 'Escape') { this.render(); }
        });
        input.addEventListener('blur', commit);
      });
    });

    content.querySelectorAll('[data-edit-typo]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#editingTypoId = btn.dataset.editTypo;
        this.render();
      });
    });

    content.querySelectorAll('[data-typo-save]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const typoId = btn.dataset.typoSave;
        const typoObj = this.#typographies.find(t => t.id === typoId);
        if (!typoObj) return;
        const item = btn.closest('.penpot-assets__typo-item');
        const nameInput = item.querySelector('[data-typo-field="name"]');
        const ffInput = item.querySelector('[data-typo-field="fontFamily"]');
        const fsInput = item.querySelector('[data-typo-field="fontSize"]');
        const fwInput = item.querySelector('[data-typo-field="fontWeight"]');
        const lhInput = item.querySelector('[data-typo-field="lineHeight"]');
        const lsInput = item.querySelector('[data-typo-field="letterSpacing"]');
        const fsSelect = item.querySelector('[data-typo-field="fontStyle"]');
        const updated = {
          ...typoObj,
          name: nameInput?.value.trim() || typoObj.name,
          'font-family': ffInput?.value.trim() || typoObj['font-family'],
          'font-size': fsInput?.value.trim() || typoObj['font-size'],
          'font-weight': fwInput?.value.trim() || typoObj['font-weight'],
          'font-style': fsSelect?.value || typoObj['font-style'],
          'line-height': lhInput?.value.trim() || typoObj['line-height'],
          'letter-spacing': lsInput?.value.trim() || typoObj['letter-spacing'],
        };
        this.emit('penpot-typography-edit', updated);
        this.#editingTypoId = null;
        this.render();
      });
    });

    content.querySelectorAll('[data-typo-cancel]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#editingTypoId = null;
        this.render();
      });
    });

    content.querySelectorAll('.penpot-assets__typo-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-delete-typo]')) return;
        if (e.target.closest('[data-edit-typo]')) return;
        this.emit('penpot-typography-use', { id: item.dataset.typoId });
      });
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/penpot-typography', item.dataset.typoId);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });

    const uploadFontBtn = content.querySelector('#btn-upload-font');
    if (uploadFontBtn) {
      uploadFontBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ttf,.otf,.woff,.woff2';
        input.multiple = true;
        input.addEventListener('change', async () => {
          const files = input.files;
          if (!files || files.length === 0) return;
          try {
            uploadFontBtn.textContent = 'Uploading...';
            uploadFontBtn.disabled = true;
            const processed = await processFontBlobs(Array.from(files));
            const groups = groupFontsByFamily(processed);
            this.emit('penpot-font-upload', { groups });
          } catch (err) {
            console.error('[asset-panel] font processing error:', err);
            alert('Font upload failed: ' + (err.hint || err.message || err));
            uploadFontBtn.textContent = '+ Upload Font';
            uploadFontBtn.disabled = false;
          }
        });
        input.click();
      });
    }

    const uploadMediaBtn = content.querySelector('#btn-upload-media');
    if (uploadMediaBtn) {
      uploadMediaBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', () => {
          if (input.files && input.files[0]) {
            this.emit('penpot-media-upload', { file: input.files[0] });
          }
        });
        input.click();
      });
    }
  }

  escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
}

customElements.define('penpot-asset-panel', PenpotAssetPanel);