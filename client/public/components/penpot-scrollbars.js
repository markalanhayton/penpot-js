'use strict';
import { PenpotElement } from './base.js';

const TRACK_SIZE = 14;
const THUMB_THICKNESS = 7;
const THUMB_MIN_LENGTH = 40;
const THUMB_RADIUS = 3;
const THUMB_COLOR = 'rgba(255,255,255,0.4)';
const THUMB_STROKE = 'rgba(255,255,255,0.15)';
const THUMB_HOVER_COLOR = 'rgba(255,255,255,0.6)';

const template = document.createElement('template');
template.innerHTML = `<style>
  :host { display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 4; }
  .penpot-scrollbars__track { position: absolute; pointer-events: auto; }
  .penpot-scrollbars__track--vertical { right: 0; top: 0; width: ${TRACK_SIZE}px; height: 100%; }
  .penpot-scrollbars__track--horizontal { bottom: 0; left: 0; height: ${TRACK_SIZE}px; width: 100%; }
  .penpot-scrollbars__thumb { position: absolute; border-radius: ${THUMB_RADIUS}px; background: ${THUMB_COLOR}; transition: background 0.15s; cursor: pointer; pointer-events: auto; }
  .penpot-scrollbars__thumb:hover, .penpot-scrollbars__thumb.penpot-scrollbars__dragging { background: ${THUMB_HOVER_COLOR}; }
  .penpot-scrollbars__track--vertical .penpot-scrollbars__thumb { left: ${(TRACK_SIZE - THUMB_THICKNESS) / 2}px; width: ${THUMB_THICKNESS}px; min-height: ${THUMB_MIN_LENGTH}px; }
  .penpot-scrollbars__track--horizontal .penpot-scrollbars__thumb { top: ${(TRACK_SIZE - THUMB_THICKNESS) / 2}px; height: ${THUMB_THICKNESS}px; min-width: ${THUMB_MIN_LENGTH}px; }
  .penpot-scrollbars__corner { position: absolute; right: 0; bottom: 0; width: ${TRACK_SIZE}px; height: ${TRACK_SIZE}px; pointer-events: none; }
</style>
<div class="penpot-scrollbars__track penpot-scrollbars__track--vertical" id="v-track"><div class="penpot-scrollbars__thumb" id="v-thumb"></div></div>
<div class="penpot-scrollbars__track penpot-scrollbars__track--horizontal" id="h-track"><div class="penpot-scrollbars__thumb" id="h-thumb"></div></div>
<div class="penpot-scrollbars__corner" id="corner"></div>`;

export class PenpotScrollbars extends PenpotElement {
  _template = template;
  #zoom = 1;
  #panX = 0;
  #panY = 0;
  #contentWidth = 0;
  #contentHeight = 0;
  #viewportWidth = 0;
  #viewportHeight = 0;
  #vDragging = false;
  #hDragging = false;
  #dragStart = null;
  #dragThumbStart = null;

  static get observedAttributes() { return []; }

  connectedCallback() {
    super.connectedCallback();
    this.#bindThumbEvents();
  }

  disconnectedCallback() {
    this.#unbindThumbEvents();
    super.disconnectedCallback();
  }

  #bindThumbEvents() {
    const vThumb = this.querySelector('#v-thumb');
    const hThumb = this.querySelector('#h-thumb');
    if (vThumb) {
      vThumb.addEventListener('pointerdown', (e) => this.#onVThumbDown(e));
    }
    if (hThumb) {
      hThumb.addEventListener('pointerdown', (e) => this.#onHThumbDown(e));
    }
    this._onPointerMove = (e) => this.#onPointerMove(e);
    this._onPointerUp = (e) => this.#onPointerUp(e);
  }

  #unbindThumbEvents() {
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
  }

  #onVThumbDown(e) {
    e.preventDefault();
    e.stopPropagation();
    this.#vDragging = true;
    this.#dragStart = { x: e.clientY, y: e.clientY };
    const vThumb = this.querySelector('#v-thumb');
    this.#dragThumbStart = { top: parseFloat(vThumb.style.top) || 0 };
    vThumb.classList.add('penpot-scrollbars__dragging');
    document.addEventListener('pointermove', this._onPointerMove);
    document.addEventListener('pointerup', this._onPointerUp);
  }

  #onHThumbDown(e) {
    e.preventDefault();
    e.stopPropagation();
    this.#hDragging = true;
    this.#dragStart = { x: e.clientX, y: e.clientY };
    const hThumb = this.querySelector('#h-thumb');
    this.#dragThumbStart = { left: parseFloat(hThumb.style.left) || 0 };
    hThumb.classList.add('penpot-scrollbars__dragging');
    document.addEventListener('pointermove', this._onPointerMove);
    document.addEventListener('pointerup', this._onPointerUp);
  }

  #onPointerMove(e) {
    if (this.#vDragging && this.#dragStart) {
      const dy = e.clientY - this.#dragStart.y;
      const trackHeight = this.#viewportHeight - TRACK_SIZE;
      const contentH = this.#contentHeight;
      if (contentH <= 0 || trackHeight <= 0) return;
      const panPerPx = contentH / trackHeight;
      this.#panY -= dy * panPerPx;
      this.#dragStart.y = e.clientY;
      this.#applyPan();
    }
    if (this.#hDragging && this.#dragStart) {
      const dx = e.clientX - this.#dragStart.x;
      const trackWidth = this.#viewportWidth - TRACK_SIZE;
      const contentW = this.#contentWidth;
      if (contentW <= 0 || trackWidth <= 0) return;
      const panPerPx = contentW / trackWidth;
      this.#panX -= dx * panPerPx;
      this.#dragStart.x = e.clientX;
      this.#applyPan();
    }
  }

  #onPointerUp(e) {
    if (this.#vDragging) {
      const vThumb = this.querySelector('#v-thumb');
      if (vThumb) vThumb.classList.remove('penpot-scrollbars__dragging');
    }
    if (this.#hDragging) {
      const hThumb = this.querySelector('#h-thumb');
      if (hThumb) hThumb.classList.remove('penpot-scrollbars__dragging');
    }
    this.#vDragging = false;
    this.#hDragging = false;
    this.#dragStart = null;
    this.#dragThumbStart = null;
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
  }

  #applyPan() {
    this.emit('penpot-scrollbar-pan', { panX: this.#panX, panY: this.#panY });
  }

  set viewport(v) {
    if (!v) return;
    this.#zoom = v.zoom ?? this.#zoom;
    this.#viewportWidth = (v.width ?? this.#viewportWidth);
    this.#viewportHeight = (v.height ?? this.#viewportHeight);
    if (v.panX !== undefined) this.#panX = v.panX;
    if (v.panY !== undefined) this.#panY = v.panY;
    this.render();
  }

  set contentBounds(bounds) {
    if (!bounds) return;
    this.#contentWidth = bounds.width || 0;
    this.#contentHeight = bounds.height || 0;
    this.render();
  }

  set panX(x) { this.#panX = x; this.render(); }
  set panY(y) { this.#panY = y; this.render(); }

  render() {
    const invZoom = 1 / this.#zoom;
    const contentW = this.#contentWidth;
    const contentH = this.#contentHeight;
    const viewW = this.#viewportWidth / this.#zoom;
    const viewH = this.#viewportHeight / this.#zoom;
    const panXCanvas = -this.#panX / this.#zoom;
    const panYCanvas = -this.#panY / this.#zoom;

    const vTrack = this.querySelector('#v-track');
    const hTrack = this.querySelector('#h-track');
    const vThumb = this.querySelector('#v-thumb');
    const hThumb = this.querySelector('#h-thumb');

    const showV = contentH > 0 && (panYCanvas < 0 || (panYCanvas + viewH) < contentH);
    const showH = contentW > 0 && (panXCanvas < 0 || (panXCanvas + viewW) < contentW);

    if (vTrack) vTrack.style.display = showV ? '' : 'none';
    if (hTrack) hTrack.style.display = showH ? '' : 'none';
    if (vThumb) vThumb.style.display = showV ? '' : 'none';
    if (hThumb) hThumb.style.display = showH ? '' : 'none';

    if (showV && vThumb) {
      const topOffset = Math.max(0, panYCanvas);
      const bottomOffset = Math.max(0, contentH - (panYCanvas + viewH));
      const trackHeight = this.#viewportHeight - (showH ? TRACK_SIZE : 0);
      const thumbHeight = Math.max(THUMB_MIN_LENGTH, trackHeight * (viewH / contentH) - (topOffset + bottomOffset) * (trackHeight / contentH));
      const thumbTop = (panYCanvas < 0 ? -panYCanvas / contentH * trackHeight : 0);
      vThumb.style.top = `${thumbTop}px`;
      vThumb.style.height = `${Math.max(THUMB_MIN_LENGTH, trackHeight * (viewH / contentH))}px`;
    }

    if (showH && hThumb) {
      const leftOffset = Math.max(0, panXCanvas);
      const rightOffset = Math.max(0, contentW - (panXCanvas + viewW));
      const trackWidth = this.#viewportWidth - (showV ? TRACK_SIZE : 0);
      const thumbWidth = Math.max(THUMB_MIN_LENGTH, trackWidth * (viewW / contentW));
      const thumbLeft = (panXCanvas < 0 ? -panXCanvas / contentW * trackWidth : 0);
      hThumb.style.left = `${thumbLeft}px`;
      hThumb.style.width = `${thumbWidth}px`;
    }

    this.style.display = (showV || showH) ? '' : 'none';
  }
}

customElements.define('penpot-scrollbars', PenpotScrollbars);