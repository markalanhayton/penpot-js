import { PenpotElement } from './base.js';
import { exportAndDownload } from '../lib/export.js';

const FORMATS = [
  { id: 'png', label: 'PNG', desc: 'Raster image with transparency' },
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
    .penpot-export__format-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px; }
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
        <div class="penpot-export__preview-area" id="preview">
          <span class="penpot-export__preview-placeholder">Preview will appear here</span>
        </div>
      </div>
      <div class="penpot-export__dialog-footer">
        <button class="penpot-export__btn" id="cancel-btn">Cancel</button>
        <button class="penpot-export__btn penpot-export__btn-primary" id="export-btn">Export</button>
      </div>
    </div>
  </div>`;

export class PenpotExportDialog extends PenpotElement {
  #format = 'png';
  #scale = 2;
  #width = 1200;
  #background = '#ffffff';
  #page = null;
  #exporting = false;

  static get observedAttributes() { return ['open']; }

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
    this.style.display = 'none';
  }

  connectedCallback() {
    super.connectedCallback();
    const formatGrid = this.querySelector('#format-grid');
    FORMATS.forEach(f => {
      const div = document.createElement('div');
      div.className = `penpot-export__format-option ${f.id === this.#format ? 'penpot-export__selected' : ''}`;
      div.dataset.format = f.id;
      div.innerHTML = `<div class="penpot-export__format-label">${f.label}</div><div class="penpot-export__format-desc">${f.desc}</div>`;
      div.addEventListener('click', () => {
        this.#format = f.id;
        formatGrid.querySelectorAll('.penpot-export__format-option').forEach(el => el.classList.toggle('penpot-export__selected', el.dataset.format === f.id));
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
    this.querySelector('#width-input').addEventListener('change', (e) => {
      this.#width = parseInt(e.target.value, 10) || 1200;
    });
    this.querySelector('#bg-input').addEventListener('change', (e) => {
      this.#background = e.target.value;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.style.display !== 'none') {
        this.close();
      }
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

  open(page) {
    if (page) this.#page = page;
    this.style.display = '';
    this.setAttribute('open', '');
  }

  close() {
    this.style.display = 'none';
    this.removeAttribute('open');
    this.emit('penpot-export-close', {});
  }

  async #doExport() {
    if (this.#exporting || !this.#page) return;
    this.#exporting = true;
    const btn = this.querySelector('#export-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="penpot-export__loading-spinner"></span>Exporting...';

    try {
      const filename = `penpot-export.${this.#format}`;
      await exportAndDownload(this.#page, this.#format, {
        scale: this.#scale,
        width: this.#width,
        background: this.#background,
        filename,
      });
      this.emit('penpot-export-success', { format: this.#format, filename });
    } catch (err) {
      console.error('[export] Export failed:', err);
      this.emit('penpot-export-error', { error: err.message });
    } finally {
      this.#exporting = false;
      btn.disabled = false;
      btn.textContent = 'Export';
    }
  }

  render() {}
}

customElements.define('penpot-export-dialog', PenpotExportDialog);