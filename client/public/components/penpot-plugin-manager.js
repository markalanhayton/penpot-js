import { PenpotElement } from './base.js';
import { cmd } from '../lib/rpc.js';

const template = document.createElement('template');
template.innerHTML = `<style>
  penpot-plugin-manager { display: flex; flex-direction: column; height: 100%; overflow-y: auto; }
  .penpot-plugins__header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--penpot-border, #444); }
  .penpot-plugins__search { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: 3px 8px; font-size: 11px; outline: none; }
  .penpot-plugins__search:focus { border-color: var(--penpot-primary, #31efb8); }
  .penpot-plugins__search::placeholder { color: var(--penpot-text-disabled, #666); }
  .penpot-plugins__install-btn { background: none; border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); border-radius: var(--penpot-radius-s, 4px); padding: 2px 8px; font-size: 11px; cursor: pointer; }
  .penpot-plugins__install-btn:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
  .penpot-plugins__empty { text-align: center; padding: 32px 12px; color: var(--penpot-text-dim, #999); font-size: 11px; }
  .penpot-plugins__empty-icon { font-size: 24px; margin-bottom: 8px; }
  .penpot-plugins__discover { color: var(--penpot-primary, #31efb8); cursor: pointer; text-decoration: underline; margin-top: 8px; display: inline-block; }
  .penpot-plugins__list { padding: 4px 0; }
  .penpot-plugins__item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; }
  .penpot-plugins__item:hover { background: var(--penpot-surface-high, #333); }
  .penpot-plugins__icon { width: 32px; height: 32px; border-radius: var(--penpot-radius-s, 4px); background: var(--penpot-surface, #2a2a2a); flex-shrink: 0; }
  .penpot-plugins__icon img { width: 100%; height: 100%; object-fit: contain; border-radius: 4px; }
  .penpot-plugins__info { flex: 1; min-width: 0; }
  .penpot-plugins__name { font-size: 12px; color: var(--penpot-text, #e6e6e6); font-weight: 600; }
  .penpot-plugins__desc { font-size: 10px; color: var(--penpot-text-dim, #999); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .penpot-plugins__action { background: none; border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); border-radius: var(--penpot-radius-s, 4px); padding: 2px 8px; font-size: 10px; cursor: pointer; margin-left: 4px; }
  .penpot-plugins__action:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
  .penpot-plugins__action.danger:hover { color: var(--penpot-danger, #f44); }
  .penpot-plugins__perms-dialog { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); }
  .penpot-plugins__perms-box { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: 16px; min-width: 300px; max-width: 400px; }
  .penpot-plugins__perms-title { font-size: 14px; font-weight: 600; color: var(--penpot-text, #e6e6e6); margin-bottom: 12px; text-transform: uppercase; }
  .penpot-plugins__perm-item { font-size: 11px; color: var(--penpot-text-dim, #999); padding: 3px 0; }
  .penpot-plugins__perms-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
  .penpot-plugins__error { color: var(--penpot-danger, #f44); font-size: 11px; padding: 8px 12px; }
</style>
<div id="content"></div>`;

const PERMISSION_LABELS = {
  'content:read': 'Read page content',
  'content:write': 'Edit page content',
  'library:read': 'Read shared libraries',
  'library:write': 'Edit shared libraries',
  'user:read': 'Read user profile',
  'comment:read': 'Read comments',
  'comment:write': 'Write comments',
  'allow:downloads': 'Download files',
  'allow:localstorage': 'Use local storage',
  'clipboard:read': 'Read clipboard',
  'clipboard:write': 'Write to clipboard',
};

export class PenpotPluginManager extends PenpotElement {
  _template = template;
  #plugins = [];
  #error = null;

  connectedCallback() {
    super.connectedCallback();
  }

  set plugins(val) {
    this.#plugins = val || [];
    this.render();
  }

  render() {
    const content = this.$('#content');
    if (!content) return;

    let html = `<div class="penpot-plugins__header">
      <input class="penpot-plugins__search" id="plugin-url" placeholder="Enter plugin URL..." value="">
      <button class="penpot-plugins__install-btn" id="install-btn">Install</button>
    </div>`;

    if (this.#error) {
      html += `<div class="penpot-plugins__error">${this.escHtml(this.#error)}</div>`;
    }

    if (this.#plugins.length === 0) {
      html += `<div class="penpot-plugins__empty">
        <div class="penpot-plugins__empty-icon">\u{1F9E9}</div>
        <div>No plugins installed</div>
        <a class="penpot-plugins__discover" href="https://penpot.app/plugins" target="_blank">Discover plugins</a>
      </div>`;
    } else {
      html += '<div class="penpot-plugins__list">';
      for (const plugin of this.#plugins) {
        const iconHtml = plugin.icon
          ? `<div class="penpot-plugins__icon"><img src="${this.escAttr(plugin.icon)}" alt=""></div>`
          : `<div class="penpot-plugins__icon" style="display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--penpot-text-dim,#999)">${(plugin.name || 'P').charAt(0).toUpperCase()}</div>`;
        html += `<div class="penpot-plugins__item" data-plugin-id="${this.escAttr(plugin.id)}">
          ${iconHtml}
          <div class="penpot-plugins__info">
            <div class="penpot-plugins__name">${this.escHtml(plugin.name)}</div>
            <div class="penpot-plugins__desc">${this.escHtml(plugin.description || '')}</div>
          </div>
          <button class="penpot-plugins__action" data-open-plugin="${this.escAttr(plugin.id)}">Open</button>
          <button class="penpot-plugins__action danger" data-remove-plugin="${this.escAttr(plugin.id)}">\u00D7</button>
        </div>`;
      }
      html += '</div>';
    }

    content.innerHTML = html;
    this.#bindEvents(content);
  }

  #bindEvents(content) {
    content.querySelector('#install-btn')?.addEventListener('click', () => this.#installPlugin());
    content.querySelector('#plugin-url')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.#installPlugin();
    });

    content.querySelectorAll('[data-open-plugin]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pluginId = btn.dataset.openPlugin;
        const plugin = this.#plugins.find(p => p.id === pluginId);
        if (plugin) this.emit('penpot-plugin-open', { plugin });
      });
    });

    content.querySelectorAll('[data-remove-plugin]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pluginId = btn.dataset.removePlugin;
        this.emit('penpot-plugin-remove', { pluginId });
        this.#plugins = this.#plugins.filter(p => p.id !== pluginId);
        this.render();
      });
    });
  }

  async #installPlugin() {
    const input = this.$('#plugin-url');
    const url = input?.value?.trim();
    if (!url) return;

    this.#error = null;
    this.render();

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch manifest (${response.status})`);
      const manifest = await response.json();

      if (!manifest.name) throw new Error('Invalid plugin manifest: missing name');
      if (!manifest.host) throw new Error('Invalid plugin manifest: missing host');

      const permissions = manifest.permissions || [];
      if (permissions.length > 0) {
        const allowed = await this.#showPermissionsDialog(manifest, permissions);
        if (!allowed) return;
      }

      const plugin = {
        id: manifest.id || crypto.randomUUID(),
        name: manifest.name,
        description: manifest.description || '',
        icon: manifest.icon,
        host: manifest.host,
        permissions,
        url,
      };

      this.#plugins.push(plugin);
      this.emit('penpot-plugin-install', { plugin });
      this.render();
    } catch (err) {
      this.#error = err.message || 'Failed to install plugin';
      this.render();
    }
  }

  async #showPermissionsDialog(manifest, permissions) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'penpot-plugins__perms-dialog';

      let permHtml = '<div style="margin-bottom:8px">';
      for (const perm of permissions) {
        const label = PERMISSION_LABELS[perm] || perm;
        permHtml += `<div class="penpot-plugins__perm-item">\u2022 ${this.escHtml(label)}</div>`;
      }
      permHtml += '</div>';

      dialog.innerHTML = `<div class="penpot-plugins__perms-box">
        <div class="penpot-plugins__perms-title">${this.escHtml(manifest.name)}</div>
        <div style="font-size:11px;color:var(--penpot-text-dim,#999);margin-bottom:8px">This plugin requests the following permissions:</div>
        ${permHtml}
        <div class="penpot-plugins__perms-actions">
          <button class="penpot-plugins__action" id="perms-cancel">Cancel</button>
          <button class="penpot-plugins__action" id="perms-allow" style="border-color:var(--penpot-primary,#31efb8);color:var(--penpot-primary,#31efb8)">Allow</button>
        </div>
      </div>`;

      document.body.appendChild(dialog);

      dialog.querySelector('#perms-cancel').addEventListener('click', () => {
        document.body.removeChild(dialog);
        resolve(false);
      });

      dialog.querySelector('#perms-allow').addEventListener('click', () => {
        document.body.removeChild(dialog);
        resolve(true);
      });
    });
  }
}

customElements.define('penpot-plugin-manager', PenpotPluginManager);