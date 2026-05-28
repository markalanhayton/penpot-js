'use strict';
import { PenpotElement } from './base.js';
import { analyzeFile, uploadAndImport } from '../lib/file-import.js';
import { cmd } from '../lib/rpc.js';
import { appStore } from '../lib/store.js';

const template = document.createElement('template');
template.innerHTML = `<style>
  penpot-import-dialog { display: block; }
  .penpot-import__overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .penpot-import__dialog { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: 8px; min-width: 440px; max-width: 560px; color: var(--penpot-text, #e6e6e6); box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
  .penpot-import__header { padding: 16px 20px; border-bottom: 1px solid var(--penpot-border, #444); display: flex; align-items: center; justify-content: space-between; }
  .penpot-import__title { font-size: 15px; font-weight: 600; }
  .penpot-import__close { background: none; border: none; color: var(--penpot-text-dim, #999); font-size: 20px; cursor: pointer; padding: 4px; line-height: 1; }
  .penpot-import__close:hover { color: var(--penpot-text, #e6e6e6); }
  .penpot-import__body { padding: 20px; }
  .penpot-import__drop-zone { border: 2px dashed var(--penpot-border, #444); border-radius: 8px; padding: 40px 20px; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; margin-bottom: 16px; }
  .penpot-import__drop-zone:hover, .penpot-import__drop-zone.penpot-import__dragover { border-color: var(--penpot-primary, #31efb8); background: rgba(49,239,184,0.05); }
  .penpot-import__drop-icon { font-size: 32px; margin-bottom: 8px; color: var(--penpot-text-dim, #999); }
  .penpot-import__drop-text { font-size: 13px; color: var(--penpot-text-dim, #999); }
  .penpot-import__drop-hint { font-size: 10px; color: var(--penpot-text-disabled, #666); margin-top: 4px; }
  .penpot-import__file-info { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: 6px; padding: 12px; margin-bottom: 12px; display: none; }
  .penpot-import__file-info.penpot-import__visible { display: block; }
  .penpot-import__file-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .penpot-import__file-size { font-size: 11px; color: var(--penpot-text-dim, #999); }
  .penpot-import__file-type { font-size: 11px; color: var(--penpot-primary, #31efb8); margin-top: 2px; }
  .penpot-import__select-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .penpot-import__select-label { font-size: 12px; color: var(--penpot-text-dim, #999); white-space: nowrap; }
  .penpot-import__select { flex: 1; background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: 4px; color: var(--penpot-text, #e6e6e6); padding: 6px 8px; font-size: 12px; outline: none; }
  .penpot-import__select:focus { border-color: var(--penpot-primary, #31efb8); }
  .penpot-import__progress { width: 100%; height: 4px; background: var(--penpot-surface-high, #333); border-radius: 2px; margin-bottom: 12px; overflow: hidden; display: none; }
  .penpot-import__progress.penpot-import__visible { display: block; }
  .penpot-import__progress-bar { height: 100%; background: var(--penpot-primary, #31efb8); border-radius: 2px; transition: width 0.3s; width: 0%; }
  .penpot-import__error { color: var(--penpot-danger, #f44336); font-size: 11px; padding: 8px 0; display: none; }
  .penpot-import__error.penpot-import__visible { display: block; }
  .penpot-import__footer { padding: 12px 20px; border-top: 1px solid var(--penpot-border, #444); display: flex; gap: 8px; justify-content: flex-end; }
  .penpot-import__btn { padding: 8px 16px; border-radius: 4px; font-size: 12px; cursor: pointer; border: 1px solid var(--penpot-border, #444); background: none; color: var(--penpot-text, #e6e6e6); }
  .penpot-import__btn:hover { background: var(--penpot-surface-high, #333); }
  .penpot-import__btn-primary { background: var(--penpot-primary, #31efb8); color: #111; border-color: var(--penpot-primary, #31efb8); font-weight: 600; }
  .penpot-import__btn-primary:hover { background: #28d4a3; }
  .penpot-import__btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .penpot-import__spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #111; border-top-color: transparent; border-radius: 50%; animation: import-spin 0.6s linear infinite; margin-right: 6px; vertical-align: middle; }
  @keyframes import-spin { to { transform: rotate(360deg); } }
</style>
<div class="penpot-import__overlay" id="overlay">
  <div class="penpot-import__dialog">
    <div class="penpot-import__header">
      <span class="penpot-import__title">Import File</span>
      <button class="penpot-import__close" id="close">&times;</button>
    </div>
    <div class="penpot-import__body">
      <div class="penpot-import__drop-zone" id="drop-zone">
        <div class="penpot-import__drop-icon">&#128194;</div>
        <div class="penpot-import__drop-text">Drop .penpot or .zip file here</div>
        <div class="penpot-import__drop-hint">or click to browse</div>
      </div>
      <input type="file" id="file-input" accept=".penpot,.zip" style="display:none">
      <div class="penpot-import__file-info" id="file-info">
        <div class="penpot-import__file-name" id="file-name"></div>
        <div class="penpot-import__file-size" id="file-size"></div>
        <div class="penpot-import__file-type" id="file-type"></div>
      </div>
      <div class="penpot-import__select-row">
        <span class="penpot-import__select-label">Project:</span>
        <select class="penpot-import__select" id="project-select"></select>
      </div>
      <div class="penpot-import__progress" id="progress">
        <div class="penpot-import__progress-bar" id="progress-bar"></div>
      </div>
      <div class="penpot-import__error" id="error"></div>
    </div>
    <div class="penpot-import__footer">
      <button class="penpot-import__btn" id="cancel-btn">Cancel</button>
      <button class="penpot-import__btn penpot-import__btn-primary" id="import-btn" disabled>Import</button>
    </div>
  </div>
</div>`;

export class PenpotImportDialog extends PenpotElement {
  _template = template;
  #selectedFile = null;
  #analysis = null;
  #importing = false;
  #projects = [];

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'none';
    this.querySelector('#close').addEventListener('click', () => this.close());
    this.querySelector('#cancel-btn').addEventListener('click', () => this.close());
    this.querySelector('#overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close();
    });
    this.querySelector('#import-btn').addEventListener('click', () => this.#doImport());

    const dropZone = this.querySelector('#drop-zone');
    const fileInput = this.querySelector('#file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('penpot-import__dragover');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('penpot-import__dragover');
    });
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('penpot-import__dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) await this.#selectFile(file);
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (file) await this.#selectFile(file);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.style.display !== 'none') this.close();
    });
  }

  open() {
    this.style.display = '';
    this.#loadProjects();
  }

  close() {
    this.style.display = 'none';
    this.#selectedFile = null;
    this.#analysis = null;
    this.querySelector('#import-btn').disabled = true;
    this.querySelector('#file-info').classList.remove('penpot-import__visible');
    this.querySelector('#progress').classList.remove('penpot-import__visible');
    this.querySelector('#error').classList.remove('penpot-import__visible');
    this.querySelector('#file-input').value = '';
  }

  async #loadProjects() {
    const select = this.querySelector('#project-select');
    select.innerHTML = '<option value="">Loading...</option>';
    try {
      const teamId = appStore.get('currentTeamId');
      if (teamId) {
        const projects = await cmd('get-projects', { teamId });
        this.#projects = Array.isArray(projects) ? projects : [];
      }
    } catch (err) {
      console.warn('[import] Failed to load projects:', err?.message || err);
      this.#projects = [];
    }

    const currentProjectId = appStore.get('currentProjectId');
    select.innerHTML = this.#projects.length === 0
      ? '<option value="">No projects available</option>'
      : this.#projects.map(p =>
          `<option value="${this.escAttr(p.id)}" ${p.id === currentProjectId ? 'selected' : ''}>${this.escHtml(p.name)}</option>`
        ).join('');
  }

  async #selectFile(file) {
    this.#selectedFile = file;
    this.querySelector('#error').classList.remove('penpot-import__visible');

    this.querySelector('#file-name').textContent = file.name;
    this.querySelector('#file-size').textContent = formatFileSize(file.size);

    this.querySelector('#import-btn').disabled = true;
    this.querySelector('#file-info').classList.add('penpot-import__visible');

    try {
      this.#analysis = await analyzeFile(file);
      const typeLabel = this.#analysis.type === 'penpot-v3' ? 'Penpot v3 (multi-file)'
        : this.#analysis.type === 'penpot-v1' ? 'Penpot v1 (binary)'
        : 'Unknown format';
      this.querySelector('#file-type').textContent = typeLabel;

      if (this.#analysis.type === 'unknown') {
        this.#showError('Unsupported file format. Please use .penpot or .zip files.');
        return;
      }

      this.querySelector('#import-btn').disabled = false;
    } catch (err) {
      this.#showError(`Failed to analyze file: ${err.message}`);
    }
  }

  async #doImport() {
    if (this.#importing || !this.#selectedFile || !this.#analysis) return;

    const projectId = this.querySelector('#project-select').value;
    if (!projectId) {
      this.#showError('Please select a project.');
      return;
    }

    this.#importing = true;
    const btn = this.querySelector('#import-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="penpot-import__spinner"></span>Importing...';

    this.querySelector('#progress').classList.add('penpot-import__visible');
    this.querySelector('#progress-bar').style.width = '30%';
    this.querySelector('#error').classList.remove('penpot-import__visible');

    try {
      const results = [];

      if (this.#analysis.type === 'penpot-v3' && this.#analysis.files.length > 0) {
        this.querySelector('#progress-bar').style.width = '50%';
        for (let i = 0; i < this.#analysis.files.length; i++) {
          const entry = this.#analysis.files[i];
          const result = await uploadAndImport(projectId, this.#selectedFile, {
            name: entry.name,
          });
          results.push(result);
          this.querySelector('#progress-bar').style.width = `${50 + (50 * (i + 1) / this.#analysis.files.length)}%`;
        }
      } else {
        this.querySelector('#progress-bar').style.width = '60%';
        const result = await uploadAndImport(projectId, this.#selectedFile, {
          name: this.#analysis.name,
        });
        results.push(result);
      }

      this.querySelector('#progress-bar').style.width = '100%';
      this.emit('penpot-import-success', { results, projectId });
      this.close();
    } catch (err) {
      console.error('[import] Import failed:', err);
      this.#showError(`Import failed: ${err.message || err}`);
      this.querySelector('#progress-bar').style.width = '0%';
    } finally {
      this.#importing = false;
      btn.disabled = false;
      btn.textContent = 'Import';
    }
  }

  #showError(msg) {
    const el = this.querySelector('#error');
    el.textContent = msg;
    el.classList.add('penpot-import__visible');
  }

  render() {}
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

customElements.define('penpot-import-dialog', PenpotImportDialog);