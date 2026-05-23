import { cmd } from './rpc.js';
import { appStore } from './store.js';

const PERMISSIONS = [
  'content:read',
  'content:write',
  'library:read',
  'library:write',
  'user:read',
  'comment:read',
  'comment:write',
  'allow:downloads',
  'allow:localstorage',
  'clipboard:read',
  'clipboard:write',
];

export class PluginAPI {
  #context = null;
  #iframe = null;
  #messageChannel = null;
  #listeners = new Map();
  #pluginId = null;
  #manifest = null;
  #permissions = [];

  constructor(pluginId, manifest) {
    this.#pluginId = pluginId;
    this.#manifest = manifest;
    this.#permissions = manifest.permissions || [];
  }

  get pluginId() { return this.#pluginId; }
  get manifest() { return this.#manifest; }
  get permissions() { return this.#permissions; }

  hasPermission(perm) {
    return this.#permissions.includes(perm);
  }

  attach(iframe) {
    this.#iframe = iframe;
    this.#messageChannel = new MessageChannel();
    this.#messageChannel.port1.onmessage = (event) => this.#handleMessage(event);
    iframe.contentWindow.postMessage({ type: 'penpot-plugin-init', port: this.#messageChannel.port2 }, '*', [this.#messageChannel.port2]);
  }

  detach() {
    if (this.#messageChannel) {
      this.#messageChannel.port1.close();
      this.#messageChannel = null;
    }
    this.#iframe = null;
    this.#listeners.clear();
  }

  sendMessage(message) {
    if (!this.#messageChannel) return;
    this.#messageChannel.port1.postMessage({ type: 'penpot-plugin-message', data: message });
  }

  addListener(type, callback) {
    if (!this.#listeners.has(type)) {
      this.#listeners.set(type, new Set());
    }
    this.#listeners.get(type).add(callback);
    return () => this.#listeners.get(type)?.delete(callback);
  }

  removeListener(type, callback) {
    this.#listeners.get(type)?.delete(callback);
  }

  #handleMessage(event) {
    const data = event.data;
    if (!data || !data.type) return;

    switch (data.type) {
      case 'penpot-plugin-message':
        this.#dispatchToListeners('message', data.data);
        break;
      case 'penpot-api-call':
        this.#handleAPICall(data);
        break;
    }
  }

  #dispatchToListeners(type, data) {
    const handlers = this.#listeners.get(type);
    if (handlers) {
      for (const cb of handlers) {
        try { cb(data); } catch (e) { console.error('[plugin-api] Listener error:', e); }
      }
    }
  }

  async #handleAPICall(data) {
    const { callId, method, params } = data;
    try {
      const result = await this.#executeMethod(method, params);
      this.#sendResponse(callId, result);
    } catch (err) {
      this.#sendError(callId, err.message);
    }
  }

  #sendResponse(callId, result) {
    if (!this.#messageChannel) return;
    this.#messageChannel.port1.postMessage({ type: 'penpot-api-response', callId, result });
  }

  #sendError(callId, error) {
    if (!this.#messageChannel) return;
    this.#messageChannel.port1.postMessage({ type: 'penpot-api-error', callId, error });
  }

  async #executeMethod(method, params) {
    switch (method) {
      case 'get-current-page':
        return this.#getCurrentPage();
      case 'get-selected-shapes':
        return this.#getSelectedShapes();
      case 'get-page-shapes':
        return this.#getPageShapes(params?.pageId);
      case 'create-shape':
        this.#requirePermission('content:write');
        return this.#createShape(params);
      case 'update-shape':
        this.#requirePermission('content:write');
        return this.#updateShape(params);
      case 'delete-shape':
        this.#requirePermission('content:write');
        return this.#deleteShape(params);
      case 'get-file':
        this.#requirePermission('content:read');
        return this.#getFile();
      case 'get-theme':
        return this.#getTheme();
      case 'ui.open':
        return this.#openUI(params);
      case 'ui.close':
        return this.#closeUI();
      case 'ui.resize':
        return this.#resizeUI(params);
      case 'ui.sendMessage':
        return this.#sendUIMessage(params);
      default:
        throw new Error(`Unknown API method: ${method}`);
    }
  }

  #requirePermission(perm) {
    if (!this.hasPermission(perm)) {
      throw new Error(`Plugin lacks permission: ${perm}`);
    }
  }

  #getCurrentPage() {
    const currentIndex = appStore.get('currentFile')?.pages?.length
      ? 0 : 0;
    return { index: currentIndex };
  }

  #getSelectedShapes() {
    return appStore.get('selectedIds') || [];
  }

  #getPageShapes(pageId) {
    const file = appStore.get('currentFile');
    if (!file || !file.pages) return [];
    const pages = file.pages;
    const page = pageId
      ? pages.find(p => p.id === pageId)
      : pages[0];
    if (!page) return [];
    const objects = page.objects || page.children || {};
    return Array.isArray(objects) ? objects : Object.values(objects);
  }

  #createShape(params) {
    if (!params || !params.type) throw new Error('Shape type required');
    const workspace = document.querySelector('penpot-workspace');
    if (workspace) {
      workspace.dispatchEvent(new CustomEvent('penpot-shape-create', {
        detail: { shape: params },
        bubbles: true,
        composed: true,
      }));
    }
    return { success: true };
  }

  #updateShape(params) {
    if (!params || !params.id) throw new Error('Shape ID required');
    const workspace = document.querySelector('penpot-workspace');
    if (workspace) {
      for (const [key, value] of Object.entries(params)) {
        if (key === 'id' || key === 'type') continue;
        workspace.dispatchEvent(new CustomEvent('penpot-property-change', {
          detail: { shapeId: params.id, prop: key, value },
          bubbles: true,
          composed: true,
        }));
      }
    }
    return { success: true };
  }

  #deleteShape(params) {
    if (!params || !params.id) throw new Error('Shape ID required');
    return { success: true, deleted: params.id };
  }

  #getFile() {
    return appStore.get('currentFile') || null;
  }

  #getTheme() {
    return { theme: 'dark', colors: { primary: '#31efb8', surface: '#2a2a2a', text: '#e6e6e6' } };
  }

  #openUI(params) {
    this.#dispatchToListeners('ui:open', params);
    return { success: true };
  }

  #closeUI() {
    this.#dispatchToListeners('ui:close', {});
    return { success: true };
  }

  #resizeUI(params) {
    this.#dispatchToListeners('ui:resize', params);
    return { success: true };
  }

  #sendUIMessage(params) {
    this.#dispatchToListeners('ui:message', params);
    return { success: true };
  }
}

export class PluginManager {
  #plugins = new Map();
  #container = null;

  constructor(container) {
    this.#container = container;
  }

  async loadPlugin(manifestUrl) {
    try {
      const manifest = await this.#fetchManifest(manifestUrl);
      const pluginId = manifest.pluginId || crypto.randomUUID();

      if (this.#plugins.has(pluginId)) {
        throw new Error(`Plugin ${pluginId} is already loaded`);
      }

      const api = new PluginAPI(pluginId, manifest);
      this.#plugins.set(pluginId, { api, manifest, iframe: null });

      appStore.set('activePlugins', [...this.#plugins.keys()]);

      return { pluginId, api };
    } catch (err) {
      console.error('[plugin-manager] Failed to load plugin:', err);
      throw err;
    }
  }

  async #fetchManifest(url) {
    const resp = await fetch(url);
    const data = await resp.json();

    if (!data.pluginId || !data.name || !data.host) {
      throw new Error('Invalid plugin manifest: missing required fields');
    }

    return data;
  }

  async openPlugin(pluginId) {
    const entry = this.#plugins.get(pluginId);
    if (!entry) throw new Error(`Plugin ${pluginId} not loaded`);

    if (entry.iframe) {
      this.closePlugin(pluginId);
    }

    const iframe = document.createElement('iframe');
    iframe.src = entry.manifest.host;
    iframe.style.cssText = 'width:100%;height:100%;border:none;';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');

    if (this.#container) {
      this.#container.appendChild(iframe);
    }

    entry.iframe = iframe;

    iframe.addEventListener('load', () => {
      entry.api.attach(iframe);
    });

    return iframe;
  }

  closePlugin(pluginId) {
    const entry = this.#plugins.get(pluginId);
    if (!entry) return;

    entry.api.detach();

    if (entry.iframe) {
      entry.iframe.remove();
      entry.iframe = null;
    }
  }

  unloadPlugin(pluginId) {
    this.closePlugin(pluginId);
    this.#plugins.delete(pluginId);
    appStore.set('activePlugins', [...this.#plugins.keys()]);
  }

  getPlugin(pluginId) {
    return this.#plugins.get(pluginId);
  }

  getLoadedPlugins() {
    return [...this.#plugins.entries()].map(([id, entry]) => ({
      id,
      name: entry.manifest.name,
      description: entry.manifest.description,
      icon: entry.manifest.icon,
      permissions: entry.manifest.permissions,
    }));
  }

  destroy() {
    for (const pluginId of this.#plugins.keys()) {
      this.unloadPlugin(pluginId);
    }
    this.#plugins.clear();
    appStore.set('activePlugins', []);
  }
}

export { PERMISSIONS };