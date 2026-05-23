import { PenpotElement } from './base.js';
import { renderPage, renderEmptyCanvas } from '../lib/shapes.js';
import './penpot-rulers.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-canvas { display: flex; flex: 1; position: relative; overflow: hidden; background: #e8e8e8; }
    .penpot-canvas__canvas-container { width: 100%; height: 100%; position: relative; overflow: hidden; }
    .penpot-canvas__canvas-container svg, .penpot-canvas__canvas-container canvas { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
    .penpot-canvas__canvas-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    .penpot-canvas__rulers { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
    .penpot-canvas__canvas-message { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; }
    .penpot-canvas__canvas-message.penpot-canvas__loading { color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-m, 13px); }
    .penpot-canvas__canvas-message.penpot-canvas__empty { color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-m, 13px); }
    .penpot-canvas__canvas-message.penpot-canvas__error { color: var(--penpot-danger, #f44); font-size: var(--penpot-font-size-m, 13px); max-width: 400px; word-break: break-word; }
    .penpot-canvas__zoom-indicator { position: absolute; bottom: var(--penpot-spacing-s, 8px); right: var(--penpot-spacing-s, 8px); background: rgba(0,0,0,0.6); color: var(--penpot-text, #e6e6e6); font-size: var(--penpot-font-size-xs, 10px); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); border-radius: var(--penpot-radius-s, 4px); pointer-events: none; }
  
  </style>
  <div class="penpot-canvas__canvas-container" id="container">
    <div class="penpot-canvas__canvas-message penpot-canvas__loading" id="message">Loading...</div>
  </div>
  <div class="penpot-canvas__rulers"><penpot-rulers id="rulers"></penpot-rulers></div>
  <div class="penpot-canvas__zoom-indicator" id="zoom-indicator">100%</div>`;

export class PenpotCanvas extends PenpotElement {
  #zoom = 1;
  #panX = 0;
  #panY = 0;
  #isPanning = false;
  #lastPointer = null;
  #svgEl = null;
  #boundHandlers = {};

  static get observedAttributes() { return ['zoom']; }

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    super.connectedCallback();
    const container = this.querySelector('#container');
    this.#boundHandlers.wheel = (e) => this.#handleWheel(e);
    this.#boundHandlers.pointerdown = (e) => this.#handlePointerDown(e);
    this.#boundHandlers.pointermove = (e) => this.#handlePointerMove(e);
    this.#boundHandlers.pointerup = (e) => this.#handlePointerUp(e);
    container.addEventListener('wheel', this.#boundHandlers.wheel, { passive: false });
    container.addEventListener('pointerdown', this.#boundHandlers.pointerdown);
    container.addEventListener('pointermove', this.#boundHandlers.pointermove);
    container.addEventListener('pointerup', this.#boundHandlers.pointerup);
  }

  disconnectedCallback() {
    const container = this.querySelector('#container');
    if (container) {
      container.removeEventListener('wheel', this.#boundHandlers.wheel);
      container.removeEventListener('pointerdown', this.#boundHandlers.pointerdown);
      container.removeEventListener('pointermove', this.#boundHandlers.pointermove);
      container.removeEventListener('pointerup', this.#boundHandlers.pointerup);
    }
    this.#boundHandlers = {};
    super.disconnectedCallback && super.disconnectedCallback();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'zoom' && oldVal !== newVal) {
      this.#zoom = parseFloat(newVal) || 1;
      this.#applyTransform();
    }
  }

  get zoom() { return this.#zoom; }
  set zoom(z) {
    this.#zoom = Math.max(0.05, Math.min(64, z));
    this.#applyTransform();
    this.emit('penpot-zoom-change', { zoom: this.#zoom });
    const indicator = this.querySelector('#zoom-indicator');
    if (indicator) indicator.textContent = Math.round(this.#zoom * 100) + '%';
  }

  get panX() { return this.#panX; }
  get panY() { return this.#panY; }

  screenToCanvas(clientX, clientY) {
    const container = this.querySelector('#container');
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const canvasX = (screenX / this.#zoom) - this.#panX;
    const canvasY = (screenY / this.#zoom) - this.#panY;
    return { x: canvasX, y: canvasY };
  }

  showLoading(msg = 'Loading...') {
    this.clear();
    const el = this.querySelector('#message');
    el.className = 'penpot-canvas__canvas-message penpot-canvas__loading';
    el.textContent = msg;
    el.style.display = '';
  }

  showError(msg) {
    this.clear();
    const el = this.querySelector('#message');
    el.className = 'penpot-canvas__canvas-message penpot-canvas__error';
    el.textContent = msg;
    el.style.display = '';
  }

  showEmpty(msg = 'No shapes on this page') {
    this.clear();
    const el = this.querySelector('#message');
    el.className = 'penpot-canvas__canvas-message penpot-canvas__empty';
    el.textContent = msg;
    el.style.display = '';
  }

  clear() {
    const container = this.querySelector('#container');
    if (this.#svgEl) {
      this.#svgEl.remove();
      this.#svgEl = null;
    }
    const msg = this.querySelector('#message');
    if (msg) msg.style.display = 'none';
  }

  renderPage(page) {
    this.clear();
    const container = this.querySelector('#container');
    if (!page) { this.showEmpty(); return; }

    const objects = page.objects || page.children || {};
    const shapes = Array.isArray(objects) ? objects : Object.values(objects);

    if (shapes.length === 0) {
      this.showEmpty(`"${page.name || 'Page 1'}" is empty`);
      return;
    }

    this.#svgEl = renderPage(page);
    this.#applyTransform();
    container.appendChild(this.#svgEl);
    const msg = this.querySelector('#message');
    if (msg) msg.style.display = 'none';
  }

  showSelection(selectedIds) {
    if (!this.#svgEl) return;
    this.#svgEl.querySelectorAll('.penpot-canvas__penpot-selection-handle').forEach(el => el.remove());
    if (!selectedIds || selectedIds.size === 0) return;
    const NS = 'http://www.w3.org/2000/svg';
    const ids = Array.isArray(selectedIds) ? selectedIds : [...selectedIds];
    for (const id of ids) {
      const shapeEl = this.#svgEl.querySelector(`#shape-${id}`);
      if (!shapeEl) continue;
      try {
        const bbox = shapeEl.getBBox();
        const selRect = document.createElementNS(NS, 'rect');
        selRect.classList.add('penpot-canvas__penpot-selection-handle');
        selRect.setAttribute('x', String(bbox.x - 1));
        selRect.setAttribute('y', String(bbox.y - 1));
        selRect.setAttribute('width', String(bbox.width + 2));
        selRect.setAttribute('height', String(bbox.height + 2));
        selRect.setAttribute('fill', 'none');
        selRect.setAttribute('stroke', '#31efb8');
        selRect.setAttribute('stroke-width', '2');
        selRect.setAttribute('pointer-events', 'none');
        this.#svgEl.appendChild(selRect);
      } catch {}
    }
  }

  panBy(dx, dy) {
    this.#panX += dx;
    this.#panY += dy;
    this.#applyTransform();
  }

  #applyTransform() {
    if (!this.#svgEl) return;
    this.#svgEl.style.transform = `scale(${this.#zoom}) translate(${this.#panX}px, ${this.#panY}px)`;
    this.#svgEl.style.transformOrigin = '0 0';
    this.#updateRulers();
  }

  #updateRulers() {
    const rulers = this.querySelector('#rulers');
    if (!rulers) return;
    const container = this.querySelector('#container');
    if (!container) return;
    rulers.viewport = {
      zoom: this.#zoom,
      panX: this.#panX,
      panY: this.#panY,
      width: container.clientWidth - 20,
      height: container.clientHeight - 20,
    };
  }

  #handleWheel(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom = this.#zoom * delta;
    } else {
      e.preventDefault();
      this.#panX -= e.deltaX;
      this.#panY -= e.deltaY;
      this.#applyTransform();
    }
  }

  #handlePointerDown(e) {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      this.#isPanning = true;
      this.#lastPointer = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      e.stopPropagation();
    }
  }

  #handlePointerMove(e) {
    if (!this.#isPanning || !this.#lastPointer) return;
    const dx = e.clientX - this.#lastPointer.x;
    const dy = e.clientY - this.#lastPointer.y;
    this.#panX += dx / this.#zoom;
    this.#panY += dy / this.#zoom;
    this.#lastPointer = { x: e.clientX, y: e.clientY };
    this.#applyTransform();
  }

  #handlePointerUp(e) {
    this.#isPanning = false;
    this.#lastPointer = null;
  }

  render() {}
}

customElements.define('penpot-canvas', PenpotCanvas);