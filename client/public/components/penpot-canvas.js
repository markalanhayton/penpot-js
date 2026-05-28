'use strict';
import { PenpotElement } from './base.js';
import { renderPage, renderEmptyCanvas, computeShapesBounds } from '../lib/shapes.js';
import { Canvas2DRenderer } from '../lib/canvas2d-renderer.js';
import './penpot-rulers.js';
import './penpot-guide-overlay.js';
import './penpot-scrollbars.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-canvas { display: flex; flex: 1; position: relative; overflow: hidden; background: #e8e8e8; }
    .penpot-canvas__canvas-container { width: 100%; height: 100%; position: relative; overflow: hidden; }
    .penpot-canvas__canvas-container svg, .penpot-canvas__canvas-container canvas { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
    .penpot-canvas__canvas-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    .penpot-canvas__rulers { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
    .penpot-canvas__guides { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 6; }
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
  <div class="penpot-canvas__guides"><penpot-guide-overlay id="guides"></penpot-guide-overlay></div>
  <penpot-scrollbars id="scrollbars"></penpot-scrollbars>
  <div class="penpot-canvas__zoom-indicator" id="zoom-indicator">100%</div>`;

export class PenpotCanvas extends PenpotElement {
  _template = template;
  #zoom = 1;
  #panX = 0;
  #panY = 0;
  #isPanning = false;
  #lastPointer = null;
  #svgEl = null;
  #canvas2d = null;
  #renderMode = 'svg';
  #boundHandlers = {};
  #guides = [];

  static get observedAttributes() { return ['zoom']; }

  constructor() {
    super();
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
    this.#boundHandlers.click = (e) => this.#handleClick(e);
    container.addEventListener('click', this.#boundHandlers.click);
  }

  disconnectedCallback() {
    const container = this.querySelector('#container');
    if (container) {
      container.removeEventListener('wheel', this.#boundHandlers.wheel);
      container.removeEventListener('pointerdown', this.#boundHandlers.pointerdown);
      container.removeEventListener('pointermove', this.#boundHandlers.pointermove);
      container.removeEventListener('pointerup', this.#boundHandlers.pointerup);
      container.removeEventListener('click', this.#boundHandlers.click);
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
  set panX(x) { this.#panX = x; this.#applyTransform(); }
  set panY(y) { this.#panY = y; this.#applyTransform(); }

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

  renderPage(page, selectedIds = []) {
    this.clear();
    const container = this.querySelector('#container');
    if (!page) { this.showEmpty(); return; }

    const objects = page.objects || page.children || {};
    const shapes = Array.isArray(objects) ? objects : Object.values(objects);

    if (shapes.length === 0) {
      this.showEmpty(`"${page.name || 'Page 1'}" is empty`);
      return;
    }

    if (this.#renderMode === 'canvas2d' && shapes.length > 100) {
      let canvasEl = container.querySelector('canvas');
      if (!canvasEl) {
        canvasEl = document.createElement('canvas');
        canvasEl.style.width = '100%';
        canvasEl.style.height = '100%';
        canvasEl.style.position = 'absolute';
        canvasEl.style.top = '0';
        canvasEl.style.left = '0';
        container.appendChild(canvasEl);
      }
      if (!this.#canvas2d) {
        this.#canvas2d = new Canvas2DRenderer(canvasEl);
      }
      this.#canvas2d.setZoom(this.#zoom);
      this.#canvas2d.setPan(this.#panX, this.#panY);
      this.#canvas2d.renderPage(page, selectedIds);
      const msg = this.querySelector('#message');
      if (msg) msg.style.display = 'none';
    } else {
      this.#svgEl = renderPage(page, undefined, selectedIds);
      this.#applyTransform();
      container.appendChild(this.#svgEl);
      const msg = this.querySelector('#message');
      if (msg) msg.style.display = 'none';
    }
  }

  setRenderMode(mode) {
    this.#renderMode = mode;
    if (mode !== 'canvas2d' && this.#canvas2d) {
      this.#canvas2d.destroy();
      this.#canvas2d = null;
    }
  }

  showSelection(selectedIds, shapes) {
    if (!this.#svgEl) return;
    this.#svgEl.querySelectorAll('.penpot-canvas__penpot-selection-handle').forEach(el => el.remove());
    this.#svgEl.querySelectorAll('.penpot-canvas__gradient-handle').forEach(el => el.remove());
    if (!selectedIds || selectedIds.size === 0) return;
    const NS = 'http://www.w3.org/2000/svg';
    const ids = Array.isArray(selectedIds) ? selectedIds : [...selectedIds];

    const isMulti = ids.length > 1;

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
        selRect.setAttribute('stroke', isMulti ? '#7b61ff' : '#31efb8');
        selRect.setAttribute('stroke-width', '2');
        selRect.setAttribute('pointer-events', 'none');
        this.#svgEl.appendChild(selRect);
      } catch (err) {
        console.warn('[canvas] Failed to render selection highlight:', err?.message || err);
      }
    }

    if (isMulti && shapes) {
      const selectedShapes = shapes.filter(s => ids.includes(s.id));
      if (selectedShapes.length > 0) {
        const bounds = computeShapesBounds(selectedShapes);
        const pad = 2;
        const groupRect = document.createElementNS(NS, 'rect');
        groupRect.classList.add('penpot-canvas__penpot-selection-handle');
        groupRect.setAttribute('x', String(bounds.x - pad));
        groupRect.setAttribute('y', String(bounds.y - pad));
        groupRect.setAttribute('width', String(bounds.width + pad * 2));
        groupRect.setAttribute('height', String(bounds.height + pad * 2));
        groupRect.setAttribute('fill', 'none');
        groupRect.setAttribute('stroke', '#31efb8');
        groupRect.setAttribute('stroke-width', '2');
        groupRect.setAttribute('stroke-dasharray', '6 3');
        groupRect.setAttribute('pointer-events', 'none');
        this.#svgEl.appendChild(groupRect);
      }
    }
  }

  showGradientHandles(shapes, selectedIds) {
    if (!this.#svgEl) return;
    this.#svgEl.querySelectorAll('.penpot-canvas__gradient-handle').forEach(el => el.remove());
    if (!selectedIds || selectedIds.size !== 1) return;
    const NS = 'http://www.w3.org/2000/svg';
    const id = Array.isArray(selectedIds) ? selectedIds[0] : [...selectedIds][0];
    const shape = shapes.find(s => s.id === id);
    if (!shape || !shape.fills || shape.fills.length === 0) return;
    const fill = shape.fills[0];
    const gradType = fill.fillType || fill.type;
    if (gradType !== 'linear-gradient' && gradType !== 'radial-gradient') return;

    const sx = fill.startX ?? (shape.x || 0);
    const sy = fill.startY ?? (shape.y || 0);
    const ex = fill.endX ?? ((shape.x || 0) + (shape.width || 100));
    const ey = fill.endY ?? (shape.y || 0);

    const line = document.createElementNS(NS, 'line');
    line.classList.add('penpot-canvas__gradient-handle');
    line.setAttribute('x1', String(sx));
    line.setAttribute('y1', String(sy));
    line.setAttribute('x2', String(ex));
    line.setAttribute('y2', String(ey));
    line.setAttribute('stroke', '#ffffff');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '4,4');
    line.setAttribute('pointer-events', 'none');
    this.#svgEl.appendChild(line);

    const startCircle = document.createElementNS(NS, 'circle');
    startCircle.classList.add('penpot-canvas__gradient-handle');
    startCircle.setAttribute('cx', String(sx));
    startCircle.setAttribute('cy', String(sy));
    startCircle.setAttribute('r', '5');
    startCircle.setAttribute('fill', '#ffffff');
    startCircle.setAttribute('stroke', '#31efb8');
    startCircle.setAttribute('stroke-width', '2');
    startCircle.setAttribute('data-gradient-handle', 'start');
    startCircle.setAttribute('data-shape-id', id);
    startCircle.style.cursor = 'grab';
    this.#svgEl.appendChild(startCircle);

    const endCircle = document.createElementNS(NS, 'circle');
    endCircle.classList.add('penpot-canvas__gradient-handle');
    endCircle.setAttribute('cx', String(ex));
    endCircle.setAttribute('cy', String(ey));
    endCircle.setAttribute('r', '5');
    endCircle.setAttribute('fill', '#ffffff');
    endCircle.setAttribute('stroke', '#31efb8');
    endCircle.setAttribute('stroke-width', '2');
    endCircle.setAttribute('data-gradient-handle', 'end');
    endCircle.setAttribute('data-shape-id', id);
    endCircle.style.cursor = 'grab';
    this.#svgEl.appendChild(endCircle);
  }

  showMeasurements(shapes, selectedIds) {
    if (!this.#svgEl) return;
    this.#svgEl.querySelectorAll('.penpot-canvas__measurement').forEach(el => el.remove());
    if (!selectedIds || selectedIds.size === 0) return;
    const NS = 'http://www.w3.org/2000/svg';
    const ids = Array.isArray(selectedIds) ? selectedIds : [...selectedIds];
    if (ids.length !== 1) return;
    const shape = shapes.find(s => s.id === ids[0]);
    if (!shape) return;

    const x = shape.x || 0;
    const y = shape.y || 0;
    const w = shape.width || 0;
    const h = shape.height || 0;
    const labelColor = '#31efb8';
    const dimOffset = 12;

    const wLine = document.createElementNS(NS, 'line');
    wLine.classList.add('penpot-canvas__measurement');
    wLine.setAttribute('x1', String(x));
    wLine.setAttribute('y1', String(y - dimOffset));
    wLine.setAttribute('x2', String(x + w));
    wLine.setAttribute('y2', String(y - dimOffset));
    wLine.setAttribute('stroke', labelColor);
    wLine.setAttribute('stroke-width', '1');
    wLine.setAttribute('stroke-dasharray', '2,2');
    wLine.setAttribute('pointer-events', 'none');
    this.#svgEl.appendChild(wLine);

    const wLabel = document.createElementNS(NS, 'text');
    wLabel.classList.add('penpot-canvas__measurement');
    wLabel.setAttribute('x', String(x + w / 2));
    wLabel.setAttribute('y', String(y - dimOffset - 4));
    wLabel.setAttribute('fill', labelColor);
    wLabel.setAttribute('font-size', '10');
    wLabel.setAttribute('text-anchor', 'middle');
    wLabel.setAttribute('pointer-events', 'none');
    wLabel.textContent = `W: ${Math.round(w)}`;
    this.#svgEl.appendChild(wLabel);

    const hLine = document.createElementNS(NS, 'line');
    hLine.classList.add('penpot-canvas__measurement');
    hLine.setAttribute('x1', String(x + w + dimOffset));
    hLine.setAttribute('y1', String(y));
    hLine.setAttribute('x2', String(x + w + dimOffset));
    hLine.setAttribute('y2', String(y + h));
    hLine.setAttribute('stroke', labelColor);
    hLine.setAttribute('stroke-width', '1');
    hLine.setAttribute('stroke-dasharray', '2,2');
    hLine.setAttribute('pointer-events', 'none');
    this.#svgEl.appendChild(hLine);

    const hLabel = document.createElementNS(NS, 'text');
    hLabel.classList.add('penpot-canvas__measurement');
    hLabel.setAttribute('x', String(x + w + dimOffset + 4));
    hLabel.setAttribute('y', String(y + h / 2 + 4));
    hLabel.setAttribute('fill', labelColor);
    hLabel.setAttribute('font-size', '10');
    hLabel.setAttribute('pointer-events', 'none');
    hLabel.textContent = `H: ${Math.round(h)}`;
    this.#svgEl.appendChild(hLabel);

    const posLabel = document.createElementNS(NS, 'text');
    posLabel.classList.add('penpot-canvas__measurement');
    posLabel.setAttribute('x', String(x));
    posLabel.setAttribute('y', String(y - dimOffset - 16));
    posLabel.setAttribute('fill', '#999');
    posLabel.setAttribute('font-size', '9');
    posLabel.setAttribute('pointer-events', 'none');
    posLabel.textContent = `X:${Math.round(x)} Y:${Math.round(y)}`;
    this.#svgEl.appendChild(posLabel);
  }

  showInteractions(objects, frames) {
    if (!this.#svgEl) return;
    this.#svgEl.querySelectorAll('.penpot-canvas__interaction').forEach(el => el.remove());
    if (!objects) return;
    const NS = 'http://www.w3.org/2000/svg';
    const actionColors = {
      'navigate': '#31efb8',
      'open-overlay': '#4dabf7',
      'toggle-overlay': '#4dabf7',
      'close-overlay': '#ff6b6b',
      'prev-screen': '#ffd43b',
      'open-url': '#adb5bd'
    };
    const actionIcons = {
      'navigate': '→',
      'open-overlay': '⬜',
      'toggle-overlay': '⬜',
      'close-overlay': '✕',
      'prev-screen': '↩',
      'open-url': '🔗'
    };

    for (const shape of Object.values(objects)) {
      if (!shape.interactions || shape.interactions.length === 0) continue;
      if (shape.type === 'frame' && shape.id === '00000000-0000-0000-0000-000000000000') continue;

      const fromX = (shape.x || 0) + (shape.width || 0) / 2;
      const fromY = (shape.y || 0) + (shape.height || 0) / 2;

      for (const interaction of shape.interactions) {
        const destId = interaction.destination;
        if (!destId) continue;
        const destShape = objects[destId];
        if (!destShape) continue;

        const toX = (destShape.x || 0) + (destShape.width || 0) / 2;
        const toY = (destShape.y || 0) + (destShape.height || 0) / 2;
        const color = actionColors[interaction['action-type']] || '#31efb8';

        const groupId = `interaction-${shape.id}-${destId}`;
        const g = document.createElementNS(NS, 'g');
        g.classList.add('penpot-canvas__interaction');
        g.setAttribute('id', groupId);
        g.setAttribute('pointer-events', 'none');

        const path = document.createElementNS(NS, 'path');
        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const curveOffset = Math.min(dist * 0.3, 40);
        const perpX = dist > 0 ? -dy / dist * curveOffset : 0;
        const perpY = dist > 0 ? dx / dist * curveOffset : 0;
        const cx1 = fromX + dx * 0.25 + perpX;
        const cy1 = fromY + dy * 0.25 + perpY;
        const cx2 = fromX + dx * 0.75 + perpX;
        const cy2 = fromY + dy * 0.75 + perpY;
        path.setAttribute('d', `M${fromX},${fromY} C${cx1},${cy1} ${cx2},${cy2} ${toX},${toY}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('stroke-dasharray', '6,3');
        path.setAttribute('opacity', '0.7');
        g.appendChild(path);

        const arrowSize = 8;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const ax1 = toX - arrowSize * Math.cos(angle - 0.4);
        const ay1 = toY - arrowSize * Math.sin(angle - 0.4);
        const ax2 = toX - arrowSize * Math.cos(angle + 0.4);
        const ay2 = toY - arrowSize * Math.sin(angle + 0.4);
        const arrow = document.createElementNS(NS, 'polygon');
        arrow.setAttribute('points', `${toX},${toY} ${ax1},${ay1} ${ax2},${ay2}`);
        arrow.setAttribute('fill', color);
        arrow.setAttribute('opacity', '0.7');
        g.appendChild(arrow);

        const destDot = document.createElementNS(NS, 'circle');
        destDot.setAttribute('cx', String(toX));
        destDot.setAttribute('cy', String(toY));
        destDot.setAttribute('r', '4');
        destDot.setAttribute('fill', color);
        destDot.setAttribute('opacity', '0.5');
        g.appendChild(destDot);

        const sourceDot = document.createElementNS(NS, 'circle');
        sourceDot.setAttribute('cx', String(fromX));
        sourceDot.setAttribute('cy', String(fromY));
        sourceDot.setAttribute('r', '3');
        sourceDot.setAttribute('fill', color);
        sourceDot.setAttribute('opacity', '0.5');
        g.appendChild(sourceDot);

        const icon = actionIcons[interaction['action-type']] || '→';
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;
        const label = document.createElementNS(NS, 'text');
        label.setAttribute('x', String(midX));
        label.setAttribute('y', String(midY - 6));
        label.setAttribute('fill', color);
        label.setAttribute('font-size', '9');
        label.setAttribute('font-weight', '600');
        label.setAttribute('pointer-events', 'none');
        label.setAttribute('text-anchor', 'middle');
        label.textContent = icon;
        g.appendChild(label);

        this.#svgEl.appendChild(g);
      }
    }

    if (frames) {
      for (const frame of frames) {
        const flows = frame.flows || {};
        for (const flow of Object.values(flows)) {
          const startFrame = objects[flow['starting-frame']];
          if (!startFrame) continue;
          const fx = (startFrame.x || 0);
          const fy = (startFrame.y || 0);
          const fw = (startFrame.width || 100);
          const fh = (startFrame.height || 100);

          const playCircle = document.createElementNS(NS, 'circle');
          playCircle.classList.add('penpot-canvas__interaction');
          playCircle.setAttribute('cx', String(fx + fw - 10));
          playCircle.setAttribute('cy', String(fy + 10));
          playCircle.setAttribute('r', '8');
          playCircle.setAttribute('fill', '#31efb8');
          playCircle.setAttribute('opacity', '0.6');
          playCircle.setAttribute('stroke', '#31efb8');
          playCircle.setAttribute('stroke-width', '1.5');
          playCircle.setAttribute('pointer-events', 'stroke');
          playCircle.style.cursor = 'pointer';
          playCircle.dataset.flowId = flow.id;
          playCircle.dataset.frameId = startFrame.id;

          const playText = document.createElementNS(NS, 'text');
          playText.classList.add('penpot-canvas__interaction');
          playText.setAttribute('x', String(fx + fw - 10));
          playText.setAttribute('y', String(fy + 13.5));
          playText.setAttribute('fill', '#fff');
          playText.setAttribute('font-size', '9');
          playText.setAttribute('font-weight', 'bold');
          playText.setAttribute('text-anchor', 'middle');
          playText.setAttribute('pointer-events', 'none');
          playText.textContent = '▸';

          this.#svgEl.appendChild(playCircle);
          this.#svgEl.appendChild(playText);
        }
      }
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

  fitToContent(shapes) {
    if (!shapes || shapes.length === 0) { this.zoom = 1; this.#panX = 0; this.#panY = 0; return; }
    const container = this.querySelector('#container');
    if (!container) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of shapes) {
      const sx = s.x || 0, sy = s.y || 0, sw = s.width || 0, sh = s.height || 0;
      if (sw > 0 && sh > 0) {
        minX = Math.min(minX, sx);
        minY = Math.min(minY, sy);
        maxX = Math.max(maxX, sx + sw);
        maxY = Math.max(maxY, sy + sh);
      }
    }
    if (minX === Infinity) { this.zoom = 1; this.#panX = 0; this.#panY = 0; return; }
    const padding = 40;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const viewW = container.clientWidth - padding * 2;
    const viewH = container.clientHeight - padding * 2;
    if (contentW <= 0 || contentH <= 0) { this.zoom = 1; this.#panX = 0; this.#panY = 0; return; }
    const scale = Math.min(viewW / contentW, viewH / contentH, 4);
    this.#zoom = Math.max(0.05, Math.min(64, scale));
    this.#panX = -(minX * this.#zoom) + (container.clientWidth - contentW * this.#zoom) / 2;
    this.#panY = -(minY * this.#zoom) + (container.clientHeight - contentH * this.#zoom) / 2;
    this.#applyTransform();
    this.emit('penpot-zoom-change', { zoom: this.#zoom });
    const indicator = this.querySelector('#zoom-indicator');
    if (indicator) indicator.textContent = Math.round(this.#zoom * 100) + '%';
  }

  zoomToSelection(selectedShapes) {
    if (!selectedShapes || selectedShapes.length === 0) return;
    this.fitToContent(selectedShapes);
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
    this.#updateGuideOverlay();
  }

  #updateGuideOverlay() {
    const guides = this.querySelector('#guides');
    if (!guides) return;
    const container = this.querySelector('#container');
    if (!container) return;
    guides.viewport = {
      zoom: this.#zoom,
      panX: this.#panX,
      panY: this.#panY,
      width: container.clientWidth - 20,
      height: container.clientHeight - 20,
    };
  }

  setGuides(guides) {
    this.#guides = guides || [];
    const overlay = this.querySelector('#guides');
    const rulers = this.querySelector('#rulers');
    if (overlay) overlay.guides = this.#guides;
    if (rulers) rulers.guides = this.#guides;
  }

  set onGuideCreate(fn) {
    const overlay = this.querySelector('#guides');
    const rulers = this.querySelector('#rulers');
    if (overlay) overlay.onGuideChange = fn;
    if (rulers) rulers.onGuideCreate = fn;
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

  #handleClick(e) {
    if (this.#isPanning) return;
    const pos = this.screenToCanvas(e.clientX, e.clientY);
    this.emit('penpot-canvas-click', { x: pos.x, y: pos.y });
  }

  render() {}
}

customElements.define('penpot-canvas', PenpotCanvas);