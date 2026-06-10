'use strict';
/**
 * @module penpot-uploads-dashboard
 * @description WU-T4: Uploads dashboard — shows all tracked uploads
 * (in-flight, completed, failed) with status, progress, and per-row actions.
 *
 * Emits `penpot-uploads-dashboard-close` when the user closes the view.
 */

import { PenpotElement } from './base.js';
import {
  getAllUploads,
  subscribeUploads,
  dismissUpload,
  cancelUpload,
  clearCompleted,
  retryUpload,
  getMaxRetries,
  getFailedCount,
  getInFlightCount,
} from '../lib/uploads.js';

const TYPE_LABEL = {
  media: 'Media',
  font: 'Font',
  file: 'File',
  binfile: 'Migration',
};

const template = document.createElement('template');
template.innerHTML = `<style>
  penpot-uploads-dashboard { display: block; padding: var(--penpot-spacing-l, 16px); }
  .penpot-ud__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--penpot-spacing-m, 12px); }
  .penpot-ud__title { font-size: var(--penpot-font-size-xl, 18px); font-weight: 600; color: var(--penpot-text, #e6e6e6); }
  .penpot-ud__subtitle { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin-top: 4px; }
  .penpot-ud__actions { display: flex; gap: var(--penpot-spacing-s, 8px); }
  .penpot-ud__btn { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); color: var(--penpot-text, #e6e6e6); border-radius: var(--penpot-radius-s, 4px); padding: 4px 10px; cursor: pointer; font-size: var(--penpot-font-size-s, 11px); font-family: inherit; }
  .penpot-ud__btn:hover { border-color: var(--penpot-primary, #31efb8); color: var(--penpot-primary, #31efb8); }
  .penpot-ud__btn--primary { background: var(--penpot-primary, #31efb8); color: #000; border-color: var(--penpot-primary, #31efb8); font-weight: 600; }
  .penpot-ud__btn--primary:hover { color: #000; }
  .penpot-ud__btn--danger { color: var(--penpot-danger, #f44); border-color: var(--penpot-danger, #f44); }
  .penpot-ud__btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .penpot-ud__table { width: 100%; border-collapse: collapse; background: var(--penpot-bg, #1c1c1c); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); overflow: hidden; }
  .penpot-ud__th { text-align: left; font-size: var(--penpot-font-size-xs, 10px); text-transform: uppercase; letter-spacing: 0.5px; color: var(--penpot-text-dim, #999); padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); border-bottom: 1px solid var(--penpot-border, #444); }
  .penpot-ud__td { padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); border-bottom: 1px solid var(--penpot-border, #444); font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text, #e6e6e6); vertical-align: middle; }
  .penpot-ud__tr:last-child .penpot-ud__td { border-bottom: none; }
  .penpot-ud__name { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'SFMono-Regular', Consolas, monospace; }
  .penpot-ud__type { display: inline-block; padding: 2px 6px; border-radius: 8px; font-size: 9px; text-transform: uppercase; background: rgba(99,179,237,0.15); color: #63b3ed; }
  .penpot-ud__type--media { background: rgba(49,239,184,0.15); color: var(--penpot-primary, #31efb8); }
  .penpot-ud__type--font { background: rgba(168,85,247,0.15); color: #a855f7; }
  .penpot-ud__type--file { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .penpot-ud__type--binfile { background: rgba(236,72,153,0.15); color: #ec4899; }
  .penpot-ud__status { display: inline-block; padding: 2px 6px; border-radius: 8px; font-size: 10px; }
  .penpot-ud__status--pending { background: var(--penpot-surface-high, #333); color: var(--penpot-text-dim, #999); }
  .penpot-ud__status--in-progress { background: rgba(99,179,237,0.15); color: #63b3ed; }
  .penpot-ud__status--completed { background: rgba(34,197,94,0.15); color: #22c55e; }
  .penpot-ud__status--failed { background: rgba(244,67,54,0.15); color: var(--penpot-danger, #f44); }
  .penpot-ud__status--cancelled, .penpot-ud__status--gave-up { background: var(--penpot-surface-high, #333); color: var(--penpot-text-dim, #999); }
  .penpot-ud__progress { background: var(--penpot-surface-high, #333); border-radius: 4px; height: 4px; overflow: hidden; min-width: 80px; }
  .penpot-ud__progress-bar { background: var(--penpot-primary, #31efb8); height: 100%; transition: width 0.2s; }
  .penpot-ud__progress-text { font-size: 10px; color: var(--penpot-text-dim, #999); margin-top: 2px; font-family: 'SFMono-Regular', Consolas, monospace; }
  .penpot-ud__error { font-size: 10px; color: var(--penpot-danger, #f44); margin-top: 2px; max-width: 200px; word-break: break-word; }
  .penpot-ud__row-actions { display: flex; gap: 4px; flex-wrap: wrap; }
  .penpot-ud__empty { text-align: center; color: var(--penpot-text-dim, #999); padding: 48px var(--penpot-spacing-l, 16px); font-size: var(--penpot-font-size-s, 11px); }
  .penpot-ud__empty-emoji { font-size: 32px; margin-bottom: var(--penpot-spacing-s, 8px); }
  .penpot-ud__badge { display: inline-block; background: var(--penpot-danger, #f44); color: #fff; font-size: 9px; font-weight: 600; padding: 1px 5px; border-radius: 8px; margin-left: 4px; vertical-align: middle; }
  .penpot-ud__badge--in-flight { background: var(--penpot-primary, #31efb8); color: #000; }
</style>
<div class="penpot-ud__header">
  <div>
    <div class="penpot-ud__title">
      Uploads
      <span class="penpot-ud__badge" id="failed-badge" style="display:none;">0</span>
      <span class="penpot-ud__badge penpot-ud__badge--in-flight" id="inflight-badge" style="display:none;">0</span>
    </div>
    <div class="penpot-ud__subtitle">Centralized tracker for all media, font, file, and migration uploads.</div>
  </div>
  <div class="penpot-ud__actions">
    <button class="penpot-ud__btn" id="clear-completed-btn">Clear completed</button>
  </div>
</div>
<div id="content"></div>`;

/**
 * Format byte count as human-readable (e.g. "2.3 MB").
 */
function formatBytes(n) {
  if (n == null || n === 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export class PenpotUploadsDashboard extends PenpotElement {
  _template = template;
  #unsubscribe = null;

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#clear-completed-btn')?.addEventListener('click', () => {
      clearCompleted();
    });
    this.#unsubscribe = subscribeUploads(() => this.render());
    // Also listen for the DOM event (in case subscribers miss it)
    document.addEventListener('penpot-uploads-changed', () => this.render());
    this.render();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#unsubscribe) this.#unsubscribe();
  }

  render() {
    const content = this.querySelector('#content');
    if (!content) return;

    const uploads = getAllUploads();

    // Update header badges
    const failed = getFailedCount();
    const inFlight = getInFlightCount();
    const failedBadge = this.querySelector('#failed-badge');
    const inflightBadge = this.querySelector('#inflight-badge');
    if (failedBadge) {
      failedBadge.textContent = String(failed);
      failedBadge.style.display = failed > 0 ? 'inline-block' : 'none';
    }
    if (inflightBadge) {
      inflightBadge.textContent = String(inFlight);
      inflightBadge.style.display = inFlight > 0 ? 'inline-block' : 'none';
    }

    const clearBtn = this.querySelector('#clear-completed-btn');
    if (clearBtn) {
      const hasCompletedOrCancelled = uploads.some(u => u.status === 'completed' || u.status === 'cancelled');
      clearBtn.disabled = !hasCompletedOrCancelled;
    }

    if (uploads.length === 0) {
      content.innerHTML = `<div class="penpot-ud__empty">
        <div class="penpot-ud__empty-emoji">📂</div>
        <div>No uploads yet.</div>
        <div style="margin-top:4px;font-size:10px;">Drop a media file, font, or import a .penpot archive and it will appear here.</div>
      </div>`;
      return;
    }

    let html = `<table class="penpot-ud__table">
      <thead><tr>
        <th class="penpot-ud__th">File</th>
        <th class="penpot-ud__th">Type</th>
        <th class="penpot-ud__th">Status</th>
        <th class="penpot-ud__th">Progress</th>
        <th class="penpot-ud__th">Actions</th>
      </tr></thead><tbody>`;

    for (const u of uploads) {
      const progress = u.bytesTotal > 0
        ? Math.min(100, Math.round((u.bytesSent / u.bytesTotal) * 100))
        : (u.status === 'completed' ? 100 : 0);

      html += `<tr class="penpot-ud__tr" data-id="${this.escAttr(u.id)}">
        <td class="penpot-ud__td" title="${this.escAttr(u.label || u.fileName)}">
          <div class="penpot-ud__name">${this.escHtml(u.fileName || u.label || '(unnamed)')}</div>
          ${u.label && u.label !== u.fileName ? `<div style="font-size:9px;color:var(--penpot-text-dim,#999);">${this.escHtml(u.label)}</div>` : ''}
        </td>
        <td class="penpot-ud__td"><span class="penpot-ud__type penpot-ud__type--${this.escHtml(u.type)}">${this.escHtml(TYPE_LABEL[u.type] || u.type)}</span></td>
        <td class="penpot-ud__td"><span class="penpot-ud__status penpot-ud__status--${this.escHtml(u.status)}">${this.escHtml(u.status)}</span></td>
        <td class="penpot-ud__td">
          ${u.bytesTotal > 0 || u.status === 'in-progress'
            ? `<div class="penpot-ud__progress"><div class="penpot-ud__progress-bar" style="width:${progress}%"></div></div>
               <div class="penpot-ud__progress-text">${formatBytes(u.bytesSent)} / ${formatBytes(u.bytesTotal || 0)}</div>`
            : '<span style="color:var(--penpot-text-dim,#999);">—</span>'}
          ${u.error ? `<div class="penpot-ud__error">${this.escHtml(u.error)}</div>` : ''}
        </td>
        <td class="penpot-ud__td">
          <div class="penpot-ud__row-actions">
            ${this.#renderActions(u)}
          </div>
        </td>
      </tr>`;
    }

    html += '</tbody></table>';
    content.innerHTML = html;

    // Wire up action buttons
    content.querySelectorAll('[data-retry]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.retry;
        const u = uploads.find(x => x.id === id);
        if (!u) return;
        if (!u._file) {
          alert('Cannot retry: the original file is no longer in memory. Please re-select it.');
          return;
        }
        const type = u.type;
        // Dispatch a custom event so the integration layer can handle retry
        this.emit('penpot-uploads-retry-requested', { upload: u });
        document.dispatchEvent(new CustomEvent('penpot-uploads-retry-requested', { detail: { upload: u } }));
      });
    });

    content.querySelectorAll('[data-cancel]').forEach(btn => {
      btn.addEventListener('click', () => cancelUpload(btn.dataset.cancel));
    });

    content.querySelectorAll('[data-dismiss]').forEach(btn => {
      btn.addEventListener('click', () => dismissUpload(btn.dataset.dismiss));
    });
  }

  #renderActions(u) {
    const parts = [];
    const maxRetries = getMaxRetries();
    if (u.status === 'pending' || u.status === 'in-progress') {
      parts.push(`<button class="penpot-ud__btn penpot-ud__btn--danger" data-cancel="${this.escAttr(u.id)}">Cancel</button>`);
    } else if (u.status === 'failed') {
      if (u.retried < maxRetries) {
        parts.push(`<button class="penpot-ud__btn penpot-ud__btn--primary" data-retry="${this.escAttr(u.id)}">Retry (${u.retried}/${maxRetries})</button>`);
      }
      parts.push(`<button class="penpot-ud__btn" data-dismiss="${this.escAttr(u.id)}">Dismiss</button>`);
    } else if (u.status === 'completed' || u.status === 'cancelled') {
      parts.push(`<button class="penpot-ud__btn" data-dismiss="${this.escAttr(u.id)}">Dismiss</button>`);
    } else if (u.status === 'gave-up') {
      parts.push(`<span style="font-size:10px;color:var(--penpot-text-dim,#999);">Gave up</span>`);
    }
    return parts.join('');
  }

  escAttr(s) { return (s || '').replace(/"/g, '&quot;'); }
  escHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}

customElements.define('penpot-uploads-dashboard', PenpotUploadsDashboard);
