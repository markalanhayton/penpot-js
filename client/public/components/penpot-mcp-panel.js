'use strict';
/**
 * @module components/penpot-mcp-panel
 * @description MCP (Model Context Protocol) integration panel for Penpot workspace.
 *
 * Provides a UI for connecting to an MCP server, discovering available tools,
 * invoking them, and viewing results. Connects via Streamable HTTP transport
 * (POST to /mcp endpoint) matching the architecture of the MCP server.
 *
 * Usage: <penpot-mcp-panel></penpot-mcp-panel>
 *
 * Events emitted:
 * - `penpot-mcp-close` — User requested panel close
 * - `penpot-mcp-error` — Connection or invocation error
 */

import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>
  penpot-mcp-panel { display: flex; flex-direction: column; height: 100%; background: var(--penpot-surface, #2a2a2a); color: var(--penpot-text, #e6e6e6); font-family: inherit; }

  .mcp__header { padding: 12px 16px; border-bottom: 1px solid var(--penpot-border, #444); display: flex; align-items: center; justify-content: space-between; }
  .mcp__header-title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .mcp__header-title::before { content: '\\2318'; font-size: 14px; }
  .mcp__close-btn { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 18px; padding: 2px 6px; }
  .mcp__close-btn:hover { color: var(--penpot-text, #e6e6e6); }

  .mcp__connection { padding: 12px 16px; border-bottom: 1px solid var(--penpot-border, #444); }
  .mcp__connection-label { font-size: 10px; color: var(--penpot-text-dim, #999); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .mcp__connection-row { display: flex; gap: 8px; }
  .mcp__url-input { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: 4px; color: var(--penpot-text, #e6e6e6); padding: 6px 10px; font-size: 11px; outline: none; }
  .mcp__url-input:focus { border-color: var(--penpot-primary, #31efb8); }
  .mcp__connect-btn { background: var(--penpot-primary, #31efb8); color: #111; border: none; border-radius: 4px; padding: 6px 12px; font-size: 11px; cursor: pointer; font-weight: 600; }
  .mcp__connect-btn:hover { background: var(--penpot-primary-hover, #28d4a3); }
  .mcp__connect-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .mcp__connect-btn.disconnect { background: var(--penpot-danger, #f44); color: #fff; }

  .mcp__status { font-size: 10px; margin-top: 6px; }
  .mcp__status--connected { color: var(--penpot-primary, #31efb8); }
  .mcp__status--error { color: var(--penpot-danger, #f44); }
  .mcp__status--connecting { color: var(--penpot-text-dim, #999); }

  .mcp__body { flex: 1; overflow-y: auto; }

  .mcp__section { border-bottom: 1px solid var(--penpot-border, #444); }
  .mcp__section-header { padding: 8px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--penpot-text-dim, #999); background: var(--penpot-surface-low, #252525); }

  .mcp__tool-list { list-style: none; padding: 0; margin: 0; }
  .mcp__tool-item { padding: 8px 16px; border-bottom: 1px solid var(--penpot-border, #444); cursor: pointer; }
  .mcp__tool-item:hover { background: var(--penpot-surface-high, #333); }
  .mcp__tool-item:last-child { border-bottom: none; }
  .mcp__tool-name { font-size: 12px; font-weight: 600; }
  .mcp__tool-desc { font-size: 10px; color: var(--penpot-text-dim, #999); margin-top: 2px; }

  .mcp__invocation { padding: 16px; }
  .mcp__invocation-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  .mcp__invocation-desc { font-size: 11px; color: var(--penpot-text-dim, #999); margin-bottom: 12px; }
  .mcp__field { margin-bottom: 10px; }
  .mcp__field-label { font-size: 10px; color: var(--penpot-text-dim, #999); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  .mcp__field-input { width: 100%; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: 4px; color: var(--penpot-text, #e6e6e6); padding: 6px 10px; font-size: 11px; outline: none; box-sizing: border-box; }
  .mcp__field-input:focus { border-color: var(--penpot-primary, #31efb8); }
  .mcp__field-input.mcp__field-textarea { min-height: 80px; resize: vertical; font-family: monospace; }
  .mcp__invocation-actions { display: flex; gap: 8px; margin-top: 12px; }
  .mcp__run-btn { background: var(--penpot-primary, #31efb8); color: #111; border: none; border-radius: 4px; padding: 8px 16px; font-size: 11px; cursor: pointer; font-weight: 600; }
  .mcp__run-btn:hover { background: var(--penpot-primary-hover, #28d4a3); }
  .mcp__run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .mcp__back-btn { background: none; border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); border-radius: 4px; padding: 8px 16px; font-size: 11px; cursor: pointer; }
  .mcp__back-btn:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }

  .mcp__result { padding: 16px; }
  .mcp__result-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  .mcp__result-content { background: var(--penpot-surface-low, #1e1e1e); border: 1px solid var(--penpot-border, #444); border-radius: 4px; padding: 12px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow-y: auto; line-height: 1.5; }
  .mcp__result-actions { display: flex; gap: 8px; margin-top: 12px; }
  .mcp__error-content { color: var(--penpot-danger, #f44); background: rgba(244,67,54,0.08); border-color: rgba(244,67,54,0.3); }

  .mcp__empty { text-align: center; padding: 32px 16px; color: var(--penpot-text-dim, #999); font-size: 11px; }
  .mcp__empty-icon { font-size: 24px; margin-bottom: 8px; }
  .mcp__empty-hint { font-size: 10px; margin-top: 8px; line-height: 1.4; }

  .mcp__spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--penpot-primary, #31efb8); border-top-color: transparent; border-radius: 50%; animation: mcp-spin 0.6s linear infinite; margin-right: 4px; vertical-align: middle; }
  @keyframes mcp-spin { to { transform: rotate(360deg); } }
</style>
<div class="mcp__header">
  <span class="mcp__header-title">MCP</span>
  <button class="mcp__close-btn" id="close-btn">&times;</button>
</div>
<div class="mcp__connection">
  <div class="mcp__connection-label">MCP Server</div>
  <div class="mcp__connection-row">
    <input class="mcp__url-input" id="mcp-url" placeholder="http://localhost:4401/mcp" value="">
    <button class="mcp__connect-btn" id="connect-btn">Connect</button>
  </div>
  <div class="mcp__status" id="connection-status"></div>
</div>
<div class="mcp__body" id="panel-body">
  <div class="mcp__empty">
    <div class="mcp__empty-icon">\\u{1F916}</div>
    <div>Connect to an MCP server to browse and invoke tools</div>
    <div class="mcp__empty-hint">Enter the MCP server URL (e.g. http://localhost:4401/mcp) and click Connect</div>
  </div>
</div>`;

const DEFAULT_MCP_URL = 'http://localhost:4401/mcp';

export class PenpotMcpPanel extends PenpotElement {
  _template = template;
  #mcpUrl = '';
  #connected = false;
  #connecting = false;
  #tools = [];
  #resources = [];
  #prompts = [];
  #selectedTool = null;
  #result = null;
  #error = null;
  #running = false;

  connectedCallback() {
    super.connectedCallback();
    this.$('#close-btn').addEventListener('click', () => this.emit('penpot-mcp-close', {}));
    this.$('#connect-btn').addEventListener('click', () => this.#toggleConnection());
    this.$('#mcp-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.#toggleConnection(); });
    this.$('#mcp-url').value = localStorage.getItem('penpot-mcp-url') || DEFAULT_MCP_URL;
    this.render();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  #setStatus(text, type = '') {
    const el = this.$('#connection-status');
    if (!el) return;
    el.textContent = text;
    el.className = `mcp__status ${type ? 'mcp__status--' + type : ''}`;
  }

  async #toggleConnection() {
    if (this.#connected) {
      this.#disconnect();
      return;
    }

    const url = this.$('#mcp-url').value.trim();
    if (!url) return;

    this.#mcpUrl = url;
    localStorage.setItem('penpot-mcp-url', url);
    this.#connecting = true;
    this.#setStatus('Connecting...', 'connecting');
    this.$('#connect-btn').disabled = true;
    this.render();

    try {
      const result = await this.#sendRequest('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'penpot-mcp-panel', version: '1.0.0' }
      });

      this.#connected = true;
      this.#connecting = false;
      this.$('#connect-btn').disabled = false;
      this.#setStatus(`Connected to ${this.#escHtml(url)}`, 'connected');
      this.$('#connect-btn').textContent = 'Disconnect';
      this.$('#connect-btn').classList.add('disconnect');

      await this.#sendRequest('notifications/initialized', {});

      await this.#loadCapabilities();
      this.render();
    } catch (err) {
      this.#connected = false;
      this.#connecting = false;
      this.$('#connect-btn').disabled = false;
      this.#setStatus(`Error: ${err.message}`, 'error');
      this.emit('penpot-mcp-error', { error: err.message });
      this.render();
    }
  }

  #disconnect() {
    this.#connected = false;
    this.#tools = [];
    this.#resources = [];
    this.#prompts = [];
    this.#selectedTool = null;
    this.#result = null;
    this.#error = null;
    this.#setStatus('', '');
    this.$('#connect-btn').textContent = 'Connect';
    this.$('#connect-btn').classList.remove('disconnect');
    this.render();
  }

  async #loadCapabilities() {
    try {
      const toolsResult = await this.#sendRequest('tools/list', {});
      this.#tools = toolsResult?.tools || [];
    } catch (err) { console.warn('[mcp] Failed to load tools:', err?.message || err); this.#tools = []; }

    try {
      const resourcesResult = await this.#sendRequest('resources/list', {});
      this.#resources = resourcesResult?.resources || [];
    } catch (err) { console.warn('[mcp] Failed to load resources:', err?.message || err); this.#resources = []; }

    try {
      const promptsResult = await this.#sendRequest('prompts/list', {});
      this.#prompts = promptsResult?.prompts || [];
    } catch (err) { console.warn('[mcp] Failed to load prompts:', err?.message || err); this.#prompts = []; }
  }

  async #sendRequest(method, params) {
    const response = await fetch(this.#mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method,
        params: params || {}
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      return await this.#parseSSE(response);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }
    return data.result;
  }

  async #parseSSE(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.result) return json.result;
            if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
          } catch (e) {
            if (e.message && !e.message.startsWith('Unexpected')) throw e;
          }
        }
      }
    }
    return null;
  }

  async #invokeTool(toolName, args) {
    this.#running = true;
    this.#result = null;
    this.#error = null;
    this.render();

    try {
      const result = await this.#sendRequest('tools/call', {
        name: toolName,
        arguments: args
      });

      this.#result = result;
      this.#error = null;
    } catch (err) {
      this.#result = null;
      this.#error = err.message;
      this.emit('penpot-mcp-error', { error: err.message, tool: toolName });
    } finally {
      this.#running = false;
      this.render();
    }
  }

  async #readResource(uri) {
    this.#running = true;
    this.#result = null;
    this.#error = null;
    this.render();

    try {
      const result = await this.#sendRequest('resources/read', { uri });
      this.#result = result;
      this.#error = null;
    } catch (err) {
      this.#result = null;
      this.#error = err.message;
      this.emit('penpot-mcp-error', { error: err.message, resource: uri });
    } finally {
      this.#running = false;
      this.render();
    }
  }

  async #executePrompt(promptName, args) {
    this.#running = true;
    this.#result = null;
    this.#error = null;
    this.render();

    try {
      const result = await this.#sendRequest('prompts/get', {
        name: promptName,
        arguments: args
      });
      this.#result = result;
      this.#error = null;
    } catch (err) {
      this.#result = null;
      this.#error = err.message;
      this.emit('penpot-mcp-error', { error: err.message, prompt: promptName });
    } finally {
      this.#running = false;
      this.render();
    }
  }

  #escHtml(str) {
    const el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
  }

  #escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  render() {
    const body = this.$('#panel-body');
    if (!body) return;

    if (this.#running) {
      body.innerHTML = `<div class="mcp__result">
        <div class="mcp__result-title">Running...</div>
        <div class="mcp__result-content"><span class="mcp__spinner"></span> Executing, please wait</div>
      </div>`;
      return;
    }

    if (this.#error && !this.#selectedTool) {
      body.innerHTML = `<div class="mcp__result">
        <div class="mcp__result-title">Error</div>
        <div class="mcp__result-content mcp__error-content">${this.#escHtml(this.#error)}</div>
        <div class="mcp__result-actions">
          <button class="mcp__back-btn" id="back-btn">Back</button>
        </div>
      </div>`;
      this.$('#back-btn').addEventListener('click', () => { this.#error = null; this.render(); });
      return;
    }

    if (this.#result) {
      const content = this.#formatResult(this.#result);
      const isError = this.#result?.isError;
      body.innerHTML = `<div class="mcp__result">
        <div class="mcp__result-title">${isError ? 'Error' : 'Result'}</div>
        <div class="mcp__result-content ${isError ? 'mcp__error-content' : ''}">${this.#escHtml(content)}</div>
        <div class="mcp__result-actions">
          <button class="mcp__back-btn" id="back-btn">Back to tools</button>
        </div>
      </div>`;
      this.$('#back-btn').addEventListener('click', () => { this.#result = null; this.#selectedTool = null; this.render(); });
      return;
    }

    if (this.#selectedTool) {
      this.#renderToolForm(body);
      return;
    }

    if (!this.#connected) {
      body.innerHTML = `<div class="mcp__empty">
        <div class="mcp__empty-icon">\\u{1F916}</div>
        <div>Connect to an MCP server to browse and invoke tools</div>
        <div class="mcp__empty-hint">Enter the MCP server URL and click Connect</div>
      </div>`;
      return;
    }

    this.#renderCapabilities(body);
  }

  #renderCapabilities(body) {
    let html = '';

    if (this.#tools.length > 0) {
      html += `<div class="mcp__section"><div class="mcp__section-header">Tools (${this.#tools.length})</div><ul class="mcp__tool-list">`;
      for (const tool of this.#tools) {
        html += `<li class="mcp__tool-item" data-tool="${this.#escAttr(tool.name)}">
          <div class="mcp__tool-name">${this.#escHtml(tool.name)}</div>
          <div class="mcp__tool-desc">${this.#escHtml(tool.description || 'No description')}</div>
        </li>`;
      }
      html += '</ul></div>';
    }

    if (this.#resources.length > 0) {
      html += `<div class="mcp__section"><div class="mcp__section-header">Resources (${this.#resources.length})</div><ul class="mcp__tool-list">`;
      for (const res of this.#resources) {
        html += `<li class="mcp__tool-item" data-resource="${this.#escAttr(res.uri)}">
          <div class="mcp__tool-name">${this.#escHtml(res.name || res.uri)}</div>
          <div class="mcp__tool-desc">${this.#escHtml(res.description || res.uri)}</div>
        </li>`;
      }
      html += '</ul></div>';
    }

    if (this.#prompts.length > 0) {
      html += `<div class="mcp__section"><div class="mcp__section-header">Prompts (${this.#prompts.length})</div><ul class="mcp__tool-list">`;
      for (const prompt of this.#prompts) {
        html += `<li class="mcp__tool-item" data-prompt="${this.#escAttr(prompt.name)}">
          <div class="mcp__tool-name">${this.#escHtml(prompt.name)}</div>
          <div class="mcp__tool-desc">${this.#escHtml(prompt.description || 'No description')}</div>
        </li>`;
      }
      html += '</ul></div>';
    }

    if (!this.#tools.length && !this.#resources.length && !this.#prompts.length) {
      html = '<div class="mcp__empty"><div>No tools, resources, or prompts available</div></div>';
    }

    body.innerHTML = html;

    body.querySelectorAll('[data-tool]').forEach(el => {
      el.addEventListener('click', () => {
        this.#selectedTool = this.#tools.find(t => t.name === el.dataset.tool);
        this.#result = null;
        this.#error = null;
        this.render();
      });
    });

    body.querySelectorAll('[data-resource]').forEach(el => {
      el.addEventListener('click', () => {
        this.#readResource(el.dataset.resource);
      });
    });

    body.querySelectorAll('[data-prompt]').forEach(el => {
      el.addEventListener('click', () => {
        const prompt = this.#prompts.find(p => p.name === el.dataset.prompt);
        this.#selectedTool = { name: prompt.name, description: prompt.description, inputSchema: { properties: (prompt.arguments || []).reduce((acc, arg) => { acc[arg.name] = { type: 'string', description: arg.description }; return acc; }, {}) } };
        this.render();
      });
    });
  }

  #renderToolForm(body) {
    const tool = this.#selectedTool;
    const schema = tool.inputSchema || {};
    const properties = schema.properties || {};
    const required = schema.required || [];

    let fieldsHtml = '';
    for (const [key, prop] of Object.entries(properties)) {
      const isRequired = required.includes(key);
      const fieldType = prop.type === 'number' ? 'number' : (prop.type === 'boolean' ? 'checkbox' : 'text');
      const isMultiline = prop.type === 'string' && (key.toLowerCase().includes('code') || key.toLowerCase().includes('script') || key.toLowerCase().includes('content'));

      if (isMultiline) {
        fieldsHtml += `<div class="mcp__field">
          <div class="mcp__field-label">${this.#escHtml(key)}${isRequired ? ' *' : ''}</div>
          <textarea class="mcp__field-input mcp__field-textarea" id="arg-${this.#escAttr(key)}" placeholder="${this.#escAttr(prop.description || '')}" ${isRequired ? 'required' : ''}></textarea>
        </div>`;
      } else {
        fieldsHtml += `<div class="mcp__field">
          <div class="mcp__field-label">${this.#escHtml(key)}${isRequired ? ' *' : ''}</div>
          <input class="mcp__field-input" id="arg-${this.#escAttr(key)}" type="${fieldType}" placeholder="${this.#escAttr(prop.description || '')}" ${isRequired ? 'required' : ''}>
        </div>`;
      }
    }

    body.innerHTML = `<div class="mcp__invocation">
      <div class="mcp__invocation-title">${this.#escHtml(tool.name)}</div>
      <div class="mcp__invocation-desc">${this.#escHtml(tool.description || '')}</div>
      ${fieldsHtml}
      <div class="mcp__invocation-actions">
        <button class="mcp__back-btn" id="back-btn">Back</button>
        <button class="mcp__run-btn" id="run-btn">Run</button>
      </div>
    </div>`;

    this.$('#back-btn').addEventListener('click', () => {
      this.#selectedTool = null;
      this.render();
    });

    this.$('#run-btn').addEventListener('click', () => {
      const args = {};
      for (const key of Object.keys(properties)) {
        const el = this.$(`#arg-${key}`);
        if (!el) continue;
        const prop = properties[key];
        let value = el.value;
        if (prop.type === 'number') value = Number(value);
        else if (prop.type === 'boolean') value = el.checked;
        else if (prop.type === 'object' || prop.type === 'array') {
          try { value = JSON.parse(value); } catch { /* keep as string */ }
        }
        if (value !== '' || required.includes(key)) args[key] = value;
      }
      this.#invokeTool(tool.name, args);
    });
  }

  #formatResult(result) {
    if (!result) return 'No result';
    if (result.content) {
      if (Array.isArray(result.content)) {
        return result.content.map(c => {
          if (c.type === 'text') return c.text;
          if (c.type === 'image') return `[Image: ${c.mimeType || 'unknown'}]`;
          if (c.type === 'resource') return `[Resource: ${c.resource?.uri || 'unknown'}]`;
          return JSON.stringify(c, null, 2);
        }).join('\n');
      }
      return JSON.stringify(result.content, null, 2);
    }
    return JSON.stringify(result, null, 2);
  }
}

customElements.define('penpot-mcp-panel', PenpotMcpPanel);