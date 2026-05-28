'use strict';
import { PenpotElement } from './base.js';
import { cmd } from '../lib/rpc.js';

const WEBHOOK_STYLES = `
  .penpot-webhooks__list { margin-top: 12px; }
  .penpot-webhooks__item { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--penpot-border, #444); }
  .penpot-webhooks__info { flex: 1; min-width: 0; }
  .penpot-webhooks__uri { font-size: 13px; color: var(--penpot-text, #e6e6e6); word-break: break-all; }
  .penpot-webhooks__meta { font-size: 10px; color: var(--penpot-text-dim, #999); margin-top: 2px; }
  .penpot-webhooks__status { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
  .penpot-webhooks__status--active { background: var(--penpot-primary, #31efb8); }
  .penpot-webhooks__status--inactive { background: var(--penpot-text-dim, #999); }
  .penpot-webhooks__status--error { background: var(--penpot-danger, #f44); }
  .penpot-webhooks__toggle { background: none; border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer; cursor: pointer; }
  .penpot-webhooks__toggle:hover { color: var(--penpot-text, #e6e6e6); border-color: #666; }
  .penpot-webhooks__delete { background: none; border: 1px solid var(--penpot-danger, #f44); color: var(--penpot-danger, #f44); font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer; }
  .penpot-webhooks__delete:hover { background: rgba(244,68,68,0.1); }
  .penpot-webhooks__empty { text-align: center; padding: 24px 12px; color: var(--penpot-text-dim, #999); font-size: 11px; }
  .penpot-webhooks__create-row { display: flex; gap: 8px; margin-top: 12px; align-items: flex-start; }
  .penpot-webhooks__create-row input { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: 4px; color: var(--penpot-text, #e6e6e6); padding: 6px 10px; font-size: 12px; font-family: inherit; outline: none; }
  .penpot-webhooks__create-row input:focus { border-color: var(--penpot-primary, #31efb8); }
  .penpot-webhooks__create-row select { background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: 4px; color: var(--penpot-text, #e6e6e6); padding: 6px 8px; font-size: 11px; outline: none; }
  .penpot-webhooks__create-btn { background: var(--penpot-primary, #31efb8); color: #000; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; font-family: inherit; white-space: nowrap; }
  .penpot-webhooks__create-btn:hover { background: var(--penpot-primary-hover, #28d4a3); }
  .penpot-webhooks__create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .penpot-webhooks__error { color: var(--penpot-danger, #f44); font-size: 11px; padding: 8px 0; }
`;

const template = document.createElement('template');
template.innerHTML = `<style>${WEBHOOK_STYLES}</style><div id="content"></div>`;

export class PenpotWebhookList extends PenpotElement {
  _template = template;
  #webhooks = [];
  #teamId = null;
  #loading = false;
  #error = null;

  set teamId(val) {
    this.#teamId = val;
    this.#loadWebhooks();
  }

  connectedCallback() {
    super.connectedCallback();
  }

  async #loadWebhooks() {
    if (!this.#teamId) {
      this.render();
      return;
    }
    this.#loading = true;
    this.#error = null;
    this.render();
    try {
      this.#webhooks = await cmd('get-webhooks', { teamId: this.#teamId });
    } catch (err) {
      console.warn('[webhook-list] Failed to load webhooks:', err?.message || err);
      this.#webhooks = [];
    }
    this.#loading = false;
    this.render();
  }

  render() {
    const content = this.$('#content');
    if (!content) return;
    if (this.#loading) {
      content.innerHTML = '<div class="penpot-webhooks__empty">Loading webhooks...</div>';
      return;
    }
    if (this.#error) {
      content.innerHTML = `<div class="penpot-webhooks__error">${this.escHtml(this.#error)}</div>`;
      return;
    }
    let html = `
      <div class="penpot-webhooks__create-row">
        <input type="url" id="webhook-uri" placeholder="https://example.com/webhook" />
        <select id="webhook-mtype">
          <option value="application/json">JSON</option>
          <option value="application/transit+json">Transit+JSON</option>
        </select>
        <button class="penpot-webhooks__create-btn" id="create-webhook">Add</button>
      </div>`;

    if (this.#webhooks.length === 0) {
      html += '<div class="penpot-webhooks__empty">No webhooks configured. Add a webhook URL to receive event notifications.</div>';
    } else {
      html += '<div class="penpot-webhooks__list">';
      for (const wh of this.#webhooks) {
        const statusClass = wh.errorCode ? 'penpot-webhooks__status--error' : (wh.isActive ? 'penpot-webhooks__status--active' : 'penpot-webhooks__status--inactive');
        const toggleLabel = wh.isActive ? 'Pause' : 'Enable';
        html += `<div class="penpot-webhooks__item" data-webhook-id="${this.escAttr(wh.id)}">
          <div class="penpot-webhooks__info">
            <div class="penpot-webhooks__uri">${this.escHtml(wh.uri)}</div>
            <div class="penpot-webhooks__meta">
              <span class="penpot-webhooks__status ${statusClass}"></span>
              ${wh.mtype || 'application/json'}${wh.errorCount ? ` &middot; ${wh.errorCount} error${wh.errorCount > 1 ? 's' : ''}` : ''}
            </div>
          </div>
          <button class="penpot-webhooks__toggle" data-toggle-id="${this.escAttr(wh.id)}" data-active="${wh.isActive ? '1' : '0'}">${toggleLabel}</button>
          <button class="penpot-webhooks__delete" data-delete-id="${this.escAttr(wh.id)}">Delete</button>
        </div>`;
      }
      html += '</div>';
    }
    content.innerHTML = html;
    this.#bindEvents(content);
  }

  #bindEvents(content) {
    content.querySelector('#create-webhook')?.addEventListener('click', () => this.#createWebhook(content));
    content.querySelector('#webhook-uri')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.#createWebhook(content);
    });
    content.querySelectorAll('[data-toggle-id]').forEach(btn => {
      btn.addEventListener('click', () => this.#toggleWebhook(btn.dataset.toggleId, btn.dataset.active === '1'));
    });
    content.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', () => this.#deleteWebhook(btn.dataset.deleteId));
    });
  }

  async #createWebhook(content) {
    const uri = content.querySelector('#webhook-uri')?.value?.trim();
    const mtype = content.querySelector('#webhook-mtype')?.value || 'application/json';
    if (!uri) {
      this.#error = 'Please enter a webhook URL.';
      this.render();
      return;
    }
    if (!this.#teamId) {
      this.#error = 'No team selected.';
      this.render();
      return;
    }
    try {
      await cmd('create-webhook', { teamId: this.#teamId, uri, mtype });
      content.querySelector('#webhook-uri').value = '';
      await this.#loadWebhooks();
    } catch (err) {
      this.#error = err.hint || err.message || 'Failed to create webhook.';
      this.render();
    }
  }

  async #toggleWebhook(id, currentlyActive) {
    try {
      await cmd('update-webhook', { id, isActive: !currentlyActive });
      await this.#loadWebhooks();
    } catch (err) {
      this.#error = err.hint || err.message || 'Failed to update webhook.';
      this.render();
    }
  }

  async #deleteWebhook(id) {
    const confirmed = confirm('Are you sure you want to delete this webhook?');
    if (!confirmed) return;
    try {
      await cmd('delete-webhook', { id });
      await this.#loadWebhooks();
    } catch (err) {
      this.#error = err.hint || err.message || 'Failed to delete webhook.';
      this.render();
    }
  }
}

customElements.define('penpot-webhook-list', PenpotWebhookList);