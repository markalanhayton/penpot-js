import { PenpotElement } from './base.js';
import { getCursorPositions } from '../lib/ws.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-cursor-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden; }
    .penpot-cursor__cursor-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    .penpot-cursor__selection { position: absolute; border: 2px dashed; border-radius: 2px; pointer-events: none; opacity: 0.7; }
    .penpot-cursor__selection-label { position: absolute; font-size: 10px; padding: 1px 4px; border-radius: 2px; white-space: nowrap; font-family: -apple-system, BlinkMacSystemFont, sans-serif; pointer-events: none; z-index: 1001; opacity: 0.9; }
  
  </style>
  <div class="penpot-cursor__cursor-container" id="cursors"></div>`;

const STALE_CURSOR_MS = 30000;

export class PenpotCursorOverlay extends PenpotElement {
  _template = template;
  #cursors = [];
  #cursorEls = new Map();
  #cleanupInterval = null;
  #lastPositions = [];
  #remoteSelections = [];
  #selectionEls = [];

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.#cleanupInterval = setInterval(() => this.#removeStaleCursors(), 5000);
  }

  disconnectedCallback() {
    if (this.#cleanupInterval) {
      clearInterval(this.#cleanupInterval);
      this.#cleanupInterval = null;
    }
    this.#clearAllCursors();
  }

  set cursors(positions) {
    this.#cursors = positions || [];
    this.#renderCursors();
  }

  get cursors() { return this.#cursors; }

  set remoteSelections(selections) {
    this.#remoteSelections = selections || [];
    this.#renderSelections();
  }

  get remoteSelections() { return this.#remoteSelections; }

  #renderCursors() {
    const container = this.querySelector('#cursors');
    if (!container) return;

    const activeIds = new Set(this.#cursors.map(c => c.id));

    for (const [id, el] of this.#cursorEls) {
      if (!activeIds.has(id)) {
        el.remove();
        this.#cursorEls.delete(id);
      }
    }

    for (const cursor of this.#cursors) {
      let el = this.#cursorEls.get(cursor.id);
      if (!el) {
        el = this.#createCursorElement(cursor);
        container.appendChild(el);
        this.#cursorEls.set(cursor.id, el);
      }
      this.#updateCursorPosition(el, cursor);
    }
  }

  #renderSelections() {
    const container = this.querySelector('#cursors');
    if (!container) return;

    for (const el of this.#selectionEls) {
      el.remove();
    }
    this.#selectionEls = [];

    for (const sel of this.#remoteSelections) {
      if (!sel.shapes || sel.shapes.length === 0) continue;
      const color = sel.color || '#31efb8';
      const name = sel.name || 'User';
      let firstShape = true;
      for (const shape of sel.shapes) {
        const el = document.createElement('div');
        el.className = 'penpot-cursor__selection';
        el.style.borderColor = color;
        el.style.left = `${shape.x || 0}px`;
        el.style.top = `${shape.y || 0}px`;
        el.style.width = `${shape.width || 0}px`;
        el.style.height = `${shape.height || 0}px`;
        container.appendChild(el);
        this.#selectionEls.push(el);

        if (firstShape) {
          const label = document.createElement('div');
          label.className = 'penpot-cursor__selection-label';
          label.style.left = `${(shape.x || 0)}px`;
          label.style.top = `${(shape.y || 0) - 16}px`;
          label.style.background = color;
          label.style.color = '#111';
          label.textContent = name;
          container.appendChild(label);
          this.#selectionEls.push(label);
          firstShape = false;
        }
      }
    }
  }

  #createCursorElement(cursor) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;pointer-events:none;transition:left 0.08s ease-out,top 0.08s ease-out;z-index:1000;`;
    el.innerHTML = `
      <svg width="16" height="20" viewBox="0 0 16 20" style="filter:drop-shadow(1px 1px 1px rgba(0,0,0,0.4))">
        <path d="M0 0L16 12L7 12L4 20L0 0Z" fill="${cursor.color || '#31efb8'}"/>
        <path d="M0 0L16 12L7 12L4 20L0 0Z" fill="none" stroke="white" stroke-width="0.5"/>
      </svg>
      <span style="position:absolute;left:14px;top:12px;background:${cursor.color || '#31efb8'};color:#111;font-size:10px;padding:1px 4px;border-radius:2px;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,0.3);">${this.escHtml(cursor.name || 'User')}</span>
    `;
    return el;
  }

  #updateCursorPosition(el, cursor) {
    el.style.left = `${cursor.x}px`;
    el.style.top = `${cursor.y}px`;
  }

  #removeStaleCursors() {
    const now = Date.now();
    const container = this.querySelector('#cursors');
    if (!container) return;

    for (const cursor of this.#cursors) {
      if (cursor.timestamp && (now - cursor.timestamp) > STALE_CURSOR_MS) {
        const el = this.#cursorEls.get(cursor.id);
        if (el) {
          el.style.opacity = '0.3';
        }
      }
    }
  }

  #clearAllCursors() {
    const container = this.querySelector('#cursors');
    if (container) container.innerHTML = '';
    this.#cursorEls.clear();
    this.#selectionEls = [];
  }

  render() {}
}

customElements.define('penpot-cursor-overlay', PenpotCursorOverlay);