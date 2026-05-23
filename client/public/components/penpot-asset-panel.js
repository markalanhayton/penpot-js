import { PenpotElement } from './base.js';
import { cmd } from '../lib/rpc.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-asset-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .penpot-assets__asset-tabs { display: flex; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-assets__asset-tab { flex: 1; padding: 6px 0; font-size: 10px; text-align: center; cursor: pointer; color: var(--penpot-text-dim, #999); border: none; border-bottom: 2px solid transparent; background: none; font-family: inherit; }
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
    .penpot-assets__empty-state { color: var(--penpot-text-dim, #999); text-align: center; padding: 24px 12px; font-size: 11px; }
  
  </style>
  <div class="penpot-assets__asset-tabs">
    <button class="penpot-assets__asset-tab penpot-assets__active" data-tab="components">Components</button>
    <button class="penpot-assets__asset-tab" data-tab="fonts">Fonts</button>
    <button class="penpot-assets__asset-tab" data-tab="media">Media</button>
  </div>
  <div class="penpot-assets__asset-content" id="content"></div>`;

const SAMPLE_COMPONENTS = [
  { id: 'comp-btn', name: 'Button', type: 'frame', icon: '\u25A1' },
  { id: 'comp-input', name: 'Input', type: 'rect', icon: '\u25AD' },
  { id: 'comp-card', name: 'Card', type: 'frame', icon: '\u25A1' },
  { id: 'comp-avatar', name: 'Avatar', type: 'circle', icon: '\u25CB' },
  { id: 'comp-badge', name: 'Badge', type: 'rect', icon: '\u25AD' },
  { id: 'comp-divider', name: 'Divider', type: 'rect', icon: '\u2500' },
];

const SYSTEM_FONTS = [
  { id: 'font-sans', name: 'Inter', family: 'Inter, sans-serif' },
  { id: 'font-serif', name: 'Merriweather', family: 'Merriweather, serif' },
  { id: 'font-mono', name: 'JetBrains Mono', family: 'JetBrains Mono, monospace' },
  { id: 'font-display', name: 'Poppins', family: 'Poppins, sans-serif' },
  { id: 'font-system', name: 'System UI', family: '-apple-system, BlinkMacSystemFont, sans-serif' },
];

const SAMPLE_MEDIA = [
  { id: 'media-placeholder', name: 'Placeholder', type: 'image', icon: '\u{1F5BC}' },
];

export class PenpotAssetPanel extends PenpotElement {
  #activeTab = 'components';
  #searchQuery = '';
  #components = [];
  #fonts = [];
  #media = [];

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
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

  getAvailableComponents() {
    const components = this.#components.length > 0 ? this.#components : SAMPLE_COMPONENTS;
    if (!this.#searchQuery) return components;
    const q = this.#searchQuery.toLowerCase();
    return components.filter(c => c.name.toLowerCase().includes(q));
  }

  getAvailableFonts() {
    const fonts = this.#fonts.length > 0 ? this.#fonts : SYSTEM_FONTS;
    if (!this.#searchQuery) return fonts;
    const q = this.#searchQuery.toLowerCase();
    return fonts.filter(f => f.name.toLowerCase().includes(q));
  }

  render() {
    const content = this.querySelector('#content');
    if (!content) return;

    let html = `<div class="penpot-assets__asset-toolbar"><input class="penpot-assets__asset-search" placeholder="Search..." value="${this.escHtml(this.#searchQuery)}" id="asset-search"></div>`;

    if (this.#activeTab === 'components') {
      html += this.#renderComponents();
    } else if (this.#activeTab === 'fonts') {
      html += this.#renderFonts();
    } else {
      html += this.#renderMedia();
    }

    content.innerHTML = html;
    this.#bindEvents(content);
  }

  #renderComponents() {
    const components = this.getAvailableComponents();
    if (components.length === 0) {
      return '<div class="penpot-assets__empty-state">No components found.</div>';
    }
    let html = '<div class="penpot-assets__component-grid">';
    for (const comp of components) {
      html += `<div class="penpot-assets__component-card" data-component-id="${this.escAttr(comp.id)}" title="${this.escHtml(comp.name)}">
        <div class="penpot-assets__component-thumb">${comp.icon || '\u25A1'}</div>
        <div class="penpot-assets__component-label">${this.escHtml(comp.name)}</div>
      </div>`;
    }
    html += '</div>';
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
        <span class="penpot-assets__font-name">${this.escHtml(font.name)}</span>
        <button class="penpot-assets__font-remove" data-remove-font="${this.escAttr(font.id)}" title="Remove font">\u00D7</button>
      </div>`;
    }
    html += '</div>';
    html += '<div style="padding:8px;"><button class="penpot-assets__asset-btn" id="btn-upload-font">+ Upload Font</button></div>';
    return html;
  }

  #renderMedia() {
    const media = this.#media.length > 0 ? this.#media : SAMPLE_MEDIA;
    if (media.length === 0) {
      return '<div class="penpot-assets__empty-state">No media assets.</div>';
    }
    let html = '<div class="penpot-assets__media-grid">';
    for (const item of media) {
      html += `<div class="penpot-assets__media-card" data-media-id="${this.escAttr(item.id)}" title="${this.escHtml(item.name)}">
        <div class="penpot-assets__media-thumb">${item.icon || '\u{1F5BC}'}</div>
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

    const uploadFontBtn = content.querySelector('#btn-upload-font');
    if (uploadFontBtn) {
      uploadFontBtn.addEventListener('click', () => {
        this.emit('penpot-font-upload', {});
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