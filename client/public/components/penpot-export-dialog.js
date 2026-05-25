import { PenpotElement } from './base.js';
import { exportAndDownload } from '../lib/export.js';

const FORMATS = [
  { id: 'png', label: 'PNG', desc: 'Raster image with transparency' },
  { id: 'jpeg', label: 'JPEG', desc: 'Compressed raster, smaller file' },
  { id: 'webp', label: 'WebP', desc: 'Modern raster, great compression' },
  { id: 'svg', label: 'SVG', desc: 'Vector image, scalable' },
  { id: 'pdf', label: 'PDF', desc: 'Print-ready document' },
];

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-export-dialog { --export-bg: #2a2a2a; --export-border: #444; --export-primary: #31efb8; --export-danger: #f44336; }
    .penpot-export__overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .penpot-export__dialog { background: var(--export-bg); border: 1px solid var(--export-border); border-radius: 8px; min-width: 420px; max-width: 520px; color: #e6e6e6; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
    .penpot-export__dialog-header { padding: 16px 20px; border-bottom: 1px solid var(--export-border); display: flex; align-items: center; justify-content: space-between; }
    .penpot-export__dialog-title { font-size: 15px; font-weight: 600; }
    .penpot-export__dialog-close { background: none; border: none; color: #999; font-size: 20px; cursor: pointer; padding: 4px; line-height: 1; }
    .penpot-export__dialog-close:hover { color: #e6e6e6; }
    .penpot-export__dialog-body { padding: 20px; }
    .penpot-export__format-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 16px; }
    .penpot-export__format-option { padding: 12px; border: 2px solid var(--export-border); border-radius: 6px; cursor: pointer; text-align: center; transition: border-color 0.15s, background 0.15s; }
    .penpot-export__format-option:hover { border-color: #666; background: #333; }
    .penpot-export__format-option.penpot-export__selected { border-color: var(--export-primary); background: rgba(49,239,184,0.08); }
    .penpot-export__format-label { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .penpot-export__format-desc { font-size: 10px; color: #999; }
    .penpot-export__option-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .penpot-export__option-label { font-size: 12px; color: #999; }
    .penpot-export__option-input { background: #333; border: 1px solid #555; border-radius: 4px; color: #e6e6e6; padding: 4px 8px; font-size: 12px; width: 80px; outline: none; }
    .penpot-export__option-input:focus { border-color: var(--export-primary); }
    .penpot-export__scale-options { display: flex; gap: 6px; }
    .penpot-export__scale-btn { background: none; border: 1px solid var(--export-border); border-radius: 4px; color: #999; padding: 4px 10px; font-size: 11px; cursor: pointer; }
    .penpot-export__scale-btn:hover { background: #333; color: #e6e6e6; }
    .penpot-export__scale-btn.penpot-export__active { background: rgba(49,239,184,0.15); border-color: var(--export-primary); color: var(--export-primary); }
    .penpot-export__preview-area { width: 100%; aspect-ratio: 16/10; background: #1c1c1c; border: 1px solid var(--export-border); border-radius: 4px; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .penpot-export__preview-area img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .penpot-export__preview-placeholder { color: #666; font-size: 12px; }
    .penpot-export__page-select { background: #333; border: 1px solid #555; border-radius: 4px; color: #e6e6e6; padding: 4px 8px; font-size: 12px; outline: none; width: 100%; box-sizing: border-box; margin-bottom: 12px; }
    .penpot-export__page-select:focus { border-color: var(--export-primary); }
    .penpot-export__export-all { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; font-size: 11px; color: #999; }
    .penpot-export__export-all input[type="checkbox"] { accent-color: var(--export-primary); }
    .penpot-export__preset-item { display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 12px; color: #e6e6e6; }
    .penpot-export__preset-format { font-weight: 600; min-width: 40px; }
    .penpot-export__preset-scale { color: #999; min-width: 30px; }
    .penpot-export__preset-suffix { color: #31efb8; }
    .penpot-export__preset-file { color: #999; }
    .penpot-export__dialog-footer { padding: 12px 20px; border-top: 1px solid var(--export-border); display: flex; gap: 8px; justify-content: flex-end; }
    .penpot-export__btn { padding: 8px 16px; border-radius: 4px; font-size: 12px; cursor: pointer; border: 1px solid var(--export-border); background: none; color: #e6e6e6; }
    .penpot-export__btn:hover { background: #333; }
    .penpot-export__btn-primary { background: var(--export-primary); color: #111; border-color: var(--export-primary); font-weight: 600; }
    .penpot-export__btn-primary:hover { background: #28d4a3; }
    .penpot-export__btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .penpot-export__loading-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #111; border-top-color: transparent; border-radius: 50%; animation: export-spin 0.6s linear infinite; margin-right: 6px; }
    @keyframes export-spin { to { transform: rotate(360deg); } }
  
  </style>
  <div class="penpot-export__overlay" id="overlay">
    <div class="penpot-export__dialog">
      <div class="penpot-export__dialog-header">
        <span class="penpot-export__dialog-title">Export</span>
        <button class="penpot-export__dialog-close" id="close">&times;</button>
      </div>
      <div class="penpot-export__dialog-body">
        <select class="penpot-export__page-select" id="page-select"></select>
        <label class="penpot-export__export-all"><input type="checkbox" id="export-all" checked> Export all pages</label>
        <div class="penpot-export__format-grid" id="format-grid"></div>
        <div class="penpot-export__option-row">
          <span class="penpot-export__option-label">Scale</span>
          <div class="penpot-export__scale-options" id="scale-options">
            <button class="penpot-export__scale-btn" data-scale="1">1x</button>
            <button class="penpot-export__scale-btn penpot-export__active" data-scale="2">2x</button>
            <button class="penpot-export__scale-btn" data-scale="3">3x</button>
            <button class="penpot-export__scale-btn" data-scale="4">4x</button>
          </div>
        </div>
        <div class="penpot-export__option-row">
          <span class="penpot-export__option-label">Width (px)</span>
          <input class="penpot-export__option-input" id="width-input" type="number" value="1200" min="1">
        </div>
        <div class="penpot-export__option-row">
          <span class="penpot-export__option-label">Background</span>
          <input class="penpot-export__option-input" id="bg-input" type="color" value="#ffffff">
        </div>
        <div class="penpot-export__option-row" id="quality-row" style="display:none;">
          <span class="penpot-export__option-label">Quality <span id="quality-value">92</span>%</span>
          <input class="penpot-export__option-input" id="quality-input" type="range" min="10" max="100" value="92" style="width:120px;">
        </div>
        <div class="penpot-export__preview-area" id="preview">
          <span class="penpot-export__preview-placeholder">Preview will appear here</span>
        </div>
        <div id="shape-preset-list" style="display:none;">
          <h4 style="font-size:12px;color:#999;margin:0 0 8px;">Per-preset export</h4>
          <div id="shape-presets"></div>
        </div>
      </div>
      <div class="penpot-export__dialog-footer">
        <button class="penpot-export__btn" id="cancel-btn">Cancel</button>
        <button class="penpot-export__btn penpot-export__btn-primary" id="export-btn">Export</button>
      </div>
    </div>
  </div>`;

export class PenpotExportDialog extends PenpotElement {
  _template = template;
  #format = 'png';
  #scale = 2;
  #width = 1200;
  #background = '#ffffff';
  #quality = 0.92;
  #page = null;
  #pages = [];
  #selectedShape = null;
  #shapeExports = null;
  #exporting = false;

  static get observedAttributes() { return ['open']; }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'none';
    const formatGrid = this.querySelector('#format-grid');
    FORMATS.forEach(f => {
      const div = document.createElement('div');
      div.className = `penpot-export__format-option ${f.id === this.#format ? 'penpot-export__selected' : ''}`;
      div.dataset.format = f.id;
      div.innerHTML = `<div class="penpot-export__format-label">${f.label}</div><div class="penpot-export__format-desc">${f.desc}</div>`;
      div.addEventListener('click', () => {
        this.#format = f.id;
        formatGrid.querySelectorAll('.penpot-export__format-option').forEach(el => el.classList.toggle('penpot-export__selected', el.dataset.format === f.id));
        const isRaster = ['png', 'jpeg', 'webp'].includes(f.id);
        this.querySelector('#quality-row').style.display = isRaster ? '' : 'none';
        const bgRow = this.querySelector('#bg-input').closest('.penpot-export__option-row');
        if (bgRow) bgRow.style.display = f.id === 'svg' ? 'none' : '';
      });
      formatGrid.appendChild(div);
    });

    this.querySelector('#scale-options').querySelectorAll('.penpot-export__scale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#scale = parseInt(btn.dataset.scale, 10);
        this.querySelector('#scale-options').querySelectorAll('.penpot-export__scale-btn').forEach(b => b.classList.toggle('penpot-export__active', b === btn));
      });
    });

    this.querySelector('#close').addEventListener('click', () => this.close());
    this.querySelector('#cancel-btn').addEventListener('click', () => this.close());
    this.querySelector('#overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close();
    });
    this.querySelector('#export-btn').addEventListener('click', () => this.#doExport());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.style.display !== 'none') {
        this.close();
      }
    });

    this.querySelector('#width-input').addEventListener('change', (e) => {
      this.#width = parseInt(e.target.value, 10) || 1200;
    });
    this.querySelector('#bg-input').addEventListener('change', (e) => {
      this.#background = e.target.value;
    });

    const qualityInput = this.querySelector('#quality-input');
    const qualityValue = this.querySelector('#quality-value');
    qualityInput.addEventListener('input', () => {
      this.#quality = parseInt(qualityInput.value, 10) / 100;
      qualityValue.textContent = qualityInput.value;
    });
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'open') {
      this.style.display = newVal !== null ? '' : 'none';
    }
  }

  set page(val) {
    this.#page = val;
  }

  set pages(val) {
    this.#pages = val || [];
    this.#updatePageSelect();
  }

  set selectedShape(val) {
    this.#selectedShape = val;
  }

  set shapeExports(val) {
    this.#shapeExports = val;
  }

  get pages() { return this.#pages; }

  #updatePageSelect() {
    const select = this.querySelector('#page-select');
    if (!select) return;
    select.innerHTML = '';
    if (this.#pages.length <= 1) {
      select.style.display = 'none';
      const exportAll = this.querySelector('#export-all');
      if (exportAll) exportAll.parentElement.style.display = 'none';
      return;
    }
    select.style.display = '';
    const exportAll = this.querySelector('#export-all');
    if (exportAll) exportAll.parentElement.style.display = '';
    const allOpt = document.createElement('option');
    allOpt.value = '__all__';
    allOpt.textContent = `All Pages (${this.#pages.length})`;
    select.appendChild(allOpt);
    for (const page of this.#pages) {
      const opt = document.createElement('option');
      opt.value = page.id;
      opt.textContent = page.name || 'Untitled Page';
      select.appendChild(opt);
    }
    select.value = '__all__';
  }

  open(page) {
    if (page) this.#page = page;
    if (this.#pages.length > 0) this.#updatePageSelect();

    const isShapeMode = this.#selectedShape && this.#shapeExports && this.#shapeExports.length > 0;
    const exportAllLabel = this.querySelector('#export-all')?.closest('.penpot-export__export-all');
    if (isShapeMode) {
      if (this.querySelector('#page-select')) this.querySelector('#page-select').style.display = 'none';
      if (exportAllLabel) exportAllLabel.style.display = 'none';
      this.querySelector('.penpot-export__dialog-title').textContent = `Export: ${this.#selectedShape.name || 'Shape'}`;
      const presetList = this.querySelector('#shape-preset-list');
      if (presetList) presetList.style.display = '';
    } else {
      if (this.querySelector('#page-select')) this.querySelector('#page-select').style.display = '';
      if (exportAllLabel) exportAllLabel.style.display = '';
      this.querySelector('.penpot-export__dialog-title').textContent = 'Export';
      const presetList = this.querySelector('#shape-preset-list');
      if (presetList) presetList.style.display = 'none';
    }

    this.style.display = '';
    this.setAttribute('open', '');
  }

  close() {
    this.style.display = 'none';
    this.removeAttribute('open');
    this.emit('penpot-export-close', {});
  }

  async #doExport() {
    if (this.#exporting) return;
    this.#exporting = true;
    const btn = this.querySelector('#export-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="penpot-export__loading-spinner"></span>Exporting...';

    try {
      if (this.#selectedShape && this.#shapeExports && this.#shapeExports.length > 0) {
        await this.#doShapeExport();
      } else {
        await this.#doPageExport();
      }
    } catch (err) {
      console.error('[export] Export failed:', err);
      this.emit('penpot-export-error', { error: err.message });
    } finally {
      this.#exporting = false;
      btn.disabled = false;
      btn.textContent = 'Export';
    }
  }

  async #doShapeExport() {
    const shape = this.#selectedShape;
    const presets = this.#shapeExports;
    if (!shape || !presets || presets.length === 0) return;

    const page = this.#page || this.#pages?.[0];
    if (!page) return;

    this.#renderShapePresets(shape, presets);

    const shapeName = (shape.name || 'shape').replace(/[^a-zA-Z0-9_-]/g, '_');

    for (const preset of presets) {
      const format = preset.format || 'png';
      const scale = preset.scale || 1;
      const suffix = preset.suffix || `@${scale}x`;
      const filename = `${shapeName}${suffix}.${format}`;

      await exportAndDownload(page, format, {
        scale,
        width: Math.round((shape.width || 100) * scale),
        height: Math.round((shape.height || 100) * scale),
        background: this.#background,
        quality: this.#quality,
        filename,
        shapeFilter: shape.id,
      });
    }
    this.emit('penpot-export-success', { format: 'multi', pageCount: presets.length });
  }

  #renderShapePresets(shape, presets) {
    const container = this.querySelector('#shape-presets');
    if (!container) return;
    const shapeName = (shape.name || 'shape').replace(/[^a-zA-Z0-9_-]/g, '_');
    let html = '';
    for (const preset of presets) {
      const format = preset.format || 'png';
      const scale = preset.scale || 1;
      const suffix = preset.suffix || `@${scale}x`;
      const filename = `${shapeName}${suffix}.${format}`;
      html += `<div class="penpot-export__preset-item">
        <span class="penpot-export__preset-format">${format.toUpperCase()}</span>
        <span class="penpot-export__preset-scale">${scale}x</span>
        <span class="penpot-export__preset-suffix">${this.escHtml(suffix)}</span>
        <span class="penpot-export__preset-file">${this.escHtml(filename)}</span>
      </div>`;
    }
    container.innerHTML = html;
  }

  escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  async #doPageExport() {
    const exportAll = this.querySelector('#export-all')?.checked ?? true;
    const pageSelect = this.querySelector('#page-select');
    const selectedPageId = pageSelect ? pageSelect.value : '__all__';

    let pagesToExport = [];
    if (this.#pages.length > 1 && selectedPageId === '__all__' && exportAll) {
      pagesToExport = this.#pages;
    } else if (this.#pages.length > 1 && selectedPageId !== '__all__') {
      const found = this.#pages.find(p => p.id === selectedPageId);
      pagesToExport = found ? [found] : (this.#page ? [this.#page] : []);
    } else {
      pagesToExport = this.#page ? [this.#page] : [];
    }

    if (pagesToExport.length === 0) {
      this.emit('penpot-export-error', { error: 'No page to export' });
      return;
    }

    for (const page of pagesToExport) {
      const filename = pagesToExport.length > 1
        ? `${(page.name || 'page').replace(/[^a-zA-Z0-9_-]/g, '_')}.${this.#format}`
        : `penpot-export.${this.#format}`;
      await exportAndDownload(page, this.#format, {
        scale: this.#scale,
        width: this.#width,
        background: this.#background,
        quality: this.#quality,
        filename,
      });
    }
    this.emit('penpot-export-success', { format: this.#format, pageCount: pagesToExport.length });
  }

  render() {}
}

customElements.define('penpot-export-dialog', PenpotExportDialog);