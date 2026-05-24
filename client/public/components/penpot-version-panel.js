import { PenpotElement } from './base.js';
import { cmd } from '../lib/rpc.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-version-panel { display: flex; flex-direction: column; width: var(--penpot-sidebar-width, 260px); background: var(--penpot-surface, #2a2a2a); border-right: 1px solid var(--penpot-border, #444); flex-shrink: 0; overflow: hidden; }
    .penpot-ver__header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-ver__header h3 { margin: 0; font-size: 12px; color: var(--penpot-text, #e6e6e6); font-weight: 600; }
    .penpot-ver__header-btn { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 14px; padding: 2px 4px; }
    .penpot-ver__header-btn:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-ver__toolbar { display: flex; gap: 4px; padding: 6px 12px; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-ver__toolbar-btn { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text-dim, #999); font-size: 10px; padding: 3px 8px; cursor: pointer; font-family: inherit; }
    .penpot-ver__toolbar-btn:hover { color: var(--penpot-text, #e6e6e6); background: var(--penpot-surface-highest, #3c3c3c); }
    .penpot-ver__toolbar-btn.penpot-ver__primary { background: rgba(49,239,184,0.15); color: var(--penpot-primary, #31efb8); border-color: var(--penpot-primary, #31efb8); }
    .penpot-ver__scroll { flex: 1; overflow-y: auto; }
    .penpot-ver__empty { color: var(--penpot-text-dim, #999); text-align: center; padding: 24px 12px; font-size: 11px; }
    .penpot-ver__snapshot { padding: 8px 12px; border-bottom: 1px solid var(--penpot-border, #444); cursor: pointer; transition: background 0.1s; }
    .penpot-ver__snapshot:hover { background: var(--penpot-surface-high, #333); }
    .penpot-ver__snapshot.penpot-ver__selected { background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); }
    .penpot-ver__snapshot-name { font-size: 12px; color: var(--penpot-text, #e6e6e6); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-ver__snapshot-meta { font-size: 10px; color: var(--penpot-text-dim, #999); margin-top: 2px; display: flex; gap: 8px; }
    .penpot-ver__snapshot-actions { display: flex; gap: 4px; margin-top: 6px; }
    .penpot-ver__snapshot-btn { background: none; border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); font-size: 9px; padding: 2px 6px; border-radius: 3px; cursor: pointer; }
    .penpot-ver__snapshot-btn:hover { color: var(--penpot-text, #e6e6e6); border-color: #666; }
    .penpot-ver__snapshot-btn.penpot-ver__danger { color: var(--penpot-danger, #f44); border-color: var(--penpot-danger, #f44); }
    .penpot-ver__snapshot-btn.penpot-ver__danger:hover { background: rgba(244,68,68,0.1); }
    .penpot-ver__snapshot-btn.penpot-ver__restore { color: var(--penpot-primary, #31efb8); border-color: var(--penpot-primary, #31efb8); }
    .penpot-ver__snapshot-btn.penpot-ver__restore:hover { background: rgba(49,239,184,0.1); }
    .penpot-ver__snapshot-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .penpot-ver__lock-icon { color: #e6a236; font-size: 10px; }
    .penpot-ver__rename-input { background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-primary, #31efb8); color: var(--penpot-text, #e6e6e6); font-size: 12px; padding: 1px 4px; outline: none; width: 100%; box-sizing: border-box; }

  </style>
  <div class="penpot-ver__header">
    <h3>Version History</h3>
    <button class="penpot-ver__header-btn" id="close-btn" title="Close">\u00D7</button>
  </div>
  <div class="penpot-ver__toolbar">
    <button class="penpot-ver__toolbar-btn penpot-ver__primary" id="create-btn">+ Save Version</button>
  </div>
  <div class="penpot-ver__scroll" id="snapshot-list">
    <div class="penpot-ver__empty">No versions yet.</div>
  </div>`;

export class PenpotVersionPanel extends PenpotElement {
  _template = template;
  #fileId = null;
  #snapshots = [];
  #selectedId = null;
  #loading = false;

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#close-btn').addEventListener('click', () => this.close());
    this.querySelector('#create-btn').addEventListener('click', () => this.#createSnapshot());
  }

  set fileId(val) {
    this.#fileId = val;
    this.#loadSnapshots();
  }

  get fileId() { return this.#fileId; }

  async #loadSnapshots() {
    if (!this.#fileId) return;
    this.#loading = true;
    this.#renderList();
    try {
      this.#snapshots = await cmd('get-file-snapshots', { fileId: this.#fileId });
      if (!Array.isArray(this.#snapshots)) this.#snapshots = [];
    } catch (err) {
      console.error('[version-panel] Failed to load snapshots:', err);
      this.#snapshots = [];
    }
    this.#loading = false;
    this.#renderList();
  }

  async #createSnapshot() {
    if (!this.#fileId) return;
    const label = `Version ${new Date().toLocaleString()}`;
    try {
      await cmd('create-file-snapshot', { fileId: this.#fileId, label });
      this.emit('penpot-snapshot-created', { label });
      await this.#loadSnapshots();
    } catch (err) {
      console.error('[version-panel] Failed to create snapshot:', err);
    }
  }

  async #restoreSnapshot(snapshotId) {
    if (!this.#fileId || !snapshotId) return;
    try {
      await cmd('restore-file-snapshot', { fileId: this.#fileId, snapshotId });
      this.emit('penpot-snapshot-restored', { snapshotId });
      this.close();
    } catch (err) {
      console.error('[version-panel] Failed to restore snapshot:', err);
    }
  }

  async #deleteSnapshot(snapshotId) {
    if (!this.#fileId || !snapshotId) return;
    try {
      await cmd('delete-file-snapshot', { fileId: this.#fileId, snapshotId });
      if (this.#selectedId === snapshotId) this.#selectedId = null;
      await this.#loadSnapshots();
    } catch (err) {
      console.error('[version-panel] Failed to delete snapshot:', err);
    }
  }

  async #renameSnapshot(snapshotId) {
    const snapshot = this.#snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return;
    const nameEl = this.querySelector(`[data-snap-id="${snapshotId}"] .penpot-ver__snapshot-name`);
    if (!nameEl) return;
    const oldLabel = snapshot.label || 'Untitled';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldLabel;
    input.className = 'penpot-ver__rename-input';
    input.style.cssText = 'background:var(--penpot-input-bg,#333);border:1px solid var(--penpot-primary,#31efb8);color:var(--penpot-text,#e6e6e6);font-size:12px;padding:1px 4px;outline:none;width:100%;box-sizing:border-box;';
    nameEl.innerHTML = '';
    nameEl.appendChild(input);
    input.focus();
    input.select();

    const commit = async () => {
      const newName = input.value.trim() || oldLabel;
      if (newName !== oldLabel) {
        try {
          await cmd('update-file-snapshot', { fileId: this.#fileId, snapshotId, label: newName });
          await this.#loadSnapshots();
        } catch (err) {
          console.error('[version-panel] Failed to rename snapshot:', err);
        }
      } else {
        this.#renderList();
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = oldLabel; input.blur(); }
    });
    input.addEventListener('blur', commit, { once: true });
  }

  async #toggleLock(snapshotId) {
    const snapshot = this.#snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return;
    try {
      if (snapshot.isLocked === '1' || snapshot.isLocked === true) {
        await cmd('unlock-file-snapshot', { fileId: this.#fileId, snapshotId });
      } else {
        await cmd('lock-file-snapshot', { fileId: this.#fileId, snapshotId });
      }
      await this.#loadSnapshots();
    } catch (err) {
      console.error('[version-panel] Failed to toggle lock:', err);
    }
  }

  #renderList() {
    const list = this.querySelector('#snapshot-list');
    if (!list) return;

    if (this.#loading) {
      list.innerHTML = '<div class="penpot-ver__empty">Loading...</div>';
      return;
    }

    if (this.#snapshots.length === 0) {
      list.innerHTML = '<div class="penpot-ver__empty">No versions saved yet.<br>Click "Save Version" to create one.</div>';
      return;
    }

    let html = '';
    for (const snap of this.#snapshots) {
      const isSelected = this.#selectedId === snap.id;
      const isLocked = snap.isLocked === '1' || snap.isLocked === true;
      const created = snap.createdAt ? new Date(snap.createdAt).toLocaleString() : '';
      const revn = snap.revn !== undefined ? `Rev ${snap.revn}` : '';

      html += `<div class="penpot-ver__snapshot ${isSelected ? 'penpot-ver__selected' : ''}" data-snap-id="${this.escAttr(snap.id)}">`;
      html += `<div class="penpot-ver__snapshot-name">${this.escHtml(snap.label || 'Untitled')} ${isLocked ? '<span class="penpot-ver__lock-icon">\u{1F512}</span>' : ''}</div>`;
      html += `<div class="penpot-ver__snapshot-meta">`;
      if (created) html += `<span>${created}</span>`;
      if (revn) html += `<span>${revn}</span>`;
      html += `</div>`;
      html += `<div class="penpot-ver__snapshot-actions">`;
      html += `<button class="penpot-ver__snapshot-btn penpot-ver__restore" data-restore-id="${this.escAttr(snap.id)}" ${isLocked ? 'disabled title="Locked"' : ''}>Restore</button>`;
      html += `<button class="penpot-ver__snapshot-btn" data-rename-id="${this.escAttr(snap.id)}">Rename</button>`;
      html += `<button class="penpot-ver__snapshot-btn" data-lock-id="${this.escAttr(snap.id)}">${isLocked ? 'Unlock' : 'Lock'}</button>`;
      html += `<button class="penpot-ver__snapshot-btn penpot-ver__danger" data-delete-id="${this.escAttr(snap.id)}" ${isLocked ? 'disabled title="Locked"' : ''}>Delete</button>`;
      html += `</div>`;
      html += `</div>`;
    }

    list.innerHTML = html;

    list.querySelectorAll('.penpot-ver__snapshot').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.penpot-ver__snapshot-btn')) return;
        this.#selectedId = el.dataset.snapId;
        list.querySelectorAll('.penpot-ver__snapshot').forEach(s => s.classList.toggle('penpot-ver__selected', s.dataset.snapId === this.#selectedId));
      });
    });

    list.querySelectorAll('[data-restore-id]').forEach(btn => {
      btn.addEventListener('click', () => this.#restoreSnapshot(btn.dataset.restoreId));
    });
    list.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', () => this.#deleteSnapshot(btn.dataset.deleteId));
    });
    list.querySelectorAll('[data-rename-id]').forEach(btn => {
      btn.addEventListener('click', () => this.#renameSnapshot(btn.dataset.renameId));
    });
    list.querySelectorAll('[data-lock-id]').forEach(btn => {
      btn.addEventListener('click', () => this.#toggleLock(btn.dataset.lockId));
    });
  }

  close() {
    this.emit('penpot-version-close', {});
  }

  refresh() {
    this.#loadSnapshots();
  }

  render() {}
}

customElements.define('penpot-version-panel', PenpotVersionPanel);