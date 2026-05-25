import { PenpotElement } from './base.js';

const RULER_SIZE = 20;
const TICK_MAJOR = 100;
const TICK_MINOR = 10;
const TICK_MICRO = 50;
const GUIDE_CREATE_MARGIN_H = 8;
const GUIDE_CREATE_MARGIN_TOP = 28;
const GUIDE_CREATE_WIDTH = 16;
const GUIDE_CREATE_HEIGHT = 24;
const GUIDE_COLOR = '#ff0000';
const GUIDE_OPACITY = 0.7;

const template = document.createElement('template');
template.innerHTML = `<style>
  penpot-rulers { display: block; pointer-events: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
  .penpot-ruler__ruler-h { position: absolute; top: 0; left: ${RULER_SIZE}px; right: 0; height: ${RULER_SIZE}px; background: var(--penpot-surface-high, #333); border-bottom: 1px solid var(--penpot-border, #444); overflow: hidden; }
  .penpot-ruler__ruler-v { position: absolute; top: ${RULER_SIZE}px; left: 0; bottom: 0; width: ${RULER_SIZE}px; background: var(--penpot-surface-high, #333); border-right: 1px solid var(--penpot-border, #444); overflow: hidden; }
  .penpot-ruler__ruler-corner { position: absolute; top: 0; left: 0; width: ${RULER_SIZE}px; height: ${RULER_SIZE}px; background: var(--penpot-surface-high, #333); border-right: 1px solid var(--penpot-border, #444); border-bottom: 1px solid var(--penpot-border, #444); }
  .penpot-ruler__ruler-corner svg { width: 100%; height: 100%; }
  .penpot-ruler__ruler-h canvas, .penpot-ruler__ruler-v canvas { position: absolute; top: 0; left: 0; }
  .penpot-ruler__guide-create-h { position: absolute; top: 0; left: ${RULER_SIZE}px; right: 0; height: ${GUIDE_CREATE_HEIGHT}px; cursor: ew-resize; pointer-events: all; opacity: 0; }
  .penpot-ruler__guide-create-h:hover { opacity: 0.08; background: ${GUIDE_COLOR}; }
  .penpot-ruler__guide-create-v { position: absolute; top: ${RULER_SIZE}px; left: 0; width: ${GUIDE_CREATE_WIDTH}px; bottom: 0; cursor: ns-resize; pointer-events: all; opacity: 0; }
  .penpot-ruler__guide-create-v:hover { opacity: 0.08; background: ${GUIDE_COLOR}; }
  .penpot-ruler__guide-marker-h { position: absolute; top: 0; height: 2px; background: ${GUIDE_COLOR}; pointer-events: none; opacity: ${GUIDE_OPACITY}; }
  .penpot-ruler__guide-marker-v { position: absolute; left: 0; width: 2px; background: ${GUIDE_COLOR}; pointer-events: none; opacity: ${GUIDE_OPACITY}; }
</style>
<div class="penpot-ruler__ruler-corner"></div>
<div class="penpot-ruler__ruler-h"><canvas id="h-canvas"></canvas></div>
<div class="penpot-ruler__ruler-v"><canvas id="v-canvas"></canvas></div>
<div class="penpot-ruler__guide-create-h" id="guide-create-h"></div>
<div class="penpot-ruler__guide-create-v" id="guide-create-v"></div>`;

export class PenpotRulers extends PenpotElement {
  _template = template;
  #zoom = 1;
  #panX = 0;
  #panY = 0;
  #hCanvas = null;
  #vCanvas = null;
  #hCtx = null;
  #vCtx = null;
  #renderPending = false;
  #guides = [];
  #onGuideCreate = null;
  #dragging = null;

  connectedCallback() {
    super.connectedCallback();
    this.#hCanvas = this.querySelector('#h-canvas');
    this.#vCanvas = this.querySelector('#v-canvas');
    this.#hCtx = this.#hCanvas.getContext('2d');
    this.#vCtx = this.#vCanvas.getContext('2d');
    this.#bindGuideCreate();
  }

  set viewport({ zoom, panX, panY, width, height }) {
    this.#zoom = zoom || 1;
    this.#panX = panX || 0;
    this.#panY = panY || 0;
    this.#scheduleRender(width || this.clientWidth - RULER_SIZE, height || this.clientHeight - RULER_SIZE);
  }

  set guides(val) {
    this.#guides = val || [];
    this.#scheduleRender(this.clientWidth - RULER_SIZE, this.clientHeight - RULER_SIZE);
  }

  set onGuideCreate(fn) {
    this.#onGuideCreate = fn;
  }

  #scheduleRender(width, height) {
    if (this.#renderPending) return;
    this.#renderPending = true;
    requestAnimationFrame(() => {
      this.#renderPending = false;
      this.#drawRulers(width, height);
    });
  }

  #drawRulers(width, height) {
    this.#drawHorizontalRuler(width);
    this.#drawVerticalRuler(height);
    this.#drawGuideMarkers(width, height);
  }

  #drawGuideMarkers(width, height) {
    this.querySelectorAll('.penpot-ruler__guide-marker-h, .penpot-ruler__guide-marker-v').forEach(el => el.remove());

    const zoom = this.#zoom;
    const panX = this.#panX;
    const panY = this.#panY;

    for (const guide of this.#guides) {
      if (guide.axis === 'x') {
        const marker = document.createElement('div');
        marker.className = 'penpot-ruler__guide-marker-h';
        const pos = guide.position * zoom + panX * zoom + RULER_SIZE;
        marker.style.left = pos + 'px';
        marker.style.width = '2px';
        this.appendChild(marker);
      } else {
        const marker = document.createElement('div');
        marker.className = 'penpot-ruler__guide-marker-v';
        const pos = guide.position * zoom + panY * zoom + RULER_SIZE;
        marker.style.top = pos + 'px';
        marker.style.height = '2px';
        this.appendChild(marker);
      }
    }
  }

  #drawHorizontalRuler(width) {
    const canvas = this.#hCanvas;
    const ctx = this.#hCtx;
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = RULER_SIZE * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${RULER_SIZE}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = 'var(--penpot-surface-high, #333)';
    ctx.fillRect(0, 0, width, RULER_SIZE);

    const zoom = this.#zoom;
    const panX = this.#panX;
    const startVal = -panX;
    const endVal = startVal + width / zoom;

    ctx.strokeStyle = 'var(--penpot-text-dim, #999)';
    ctx.fillStyle = 'var(--penpot-text-dim, #999)';
    ctx.font = '9px sans-serif';

    ctx.beginPath();
    for (let val = Math.floor(startVal / TICK_MINOR) * TICK_MINOR; val <= endVal + TICK_MINOR; val += TICK_MINOR) {
      const x = (val + panX) * zoom;
      const isMajor = val % TICK_MAJOR === 0;
      const tickH = isMajor ? RULER_SIZE - 4 : (val % TICK_MICRO === 0 ? 6 : 3);
      ctx.moveTo(x, RULER_SIZE);
      ctx.lineTo(x, RULER_SIZE - tickH);
      if (isMajor) {
        ctx.fillText(String(Math.round(val)), x + 2, 10);
      }
    }
    ctx.stroke();
  }

  #drawVerticalRuler(height) {
    const canvas = this.#vCanvas;
    const ctx = this.#vCtx;
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = RULER_SIZE * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${RULER_SIZE}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = 'var(--penpot-surface-high, #333)';
    ctx.fillRect(0, 0, RULER_SIZE, height);

    const zoom = this.#zoom;
    const panY = this.#panY;
    const startVal = -panY;
    const endVal = startVal + height / zoom;

    ctx.strokeStyle = 'var(--penpot-text-dim, #999)';
    ctx.fillStyle = 'var(--penpot-text-dim, #999)';
    ctx.font = '9px sans-serif';

    ctx.beginPath();
    for (let val = Math.floor(startVal / TICK_MINOR) * TICK_MINOR; val <= endVal + TICK_MINOR; val += TICK_MINOR) {
      const y = (val + panY) * zoom;
      const isMajor = val % TICK_MAJOR === 0;
      const tickW = isMajor ? RULER_SIZE - 4 : (val % TICK_MICRO === 0 ? 6 : 3);
      ctx.moveTo(RULER_SIZE, y);
      ctx.lineTo(RULER_SIZE - tickW, y);
      if (isMajor) {
        ctx.save();
        ctx.translate(10, y - 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(Math.round(val)), 0, 0);
        ctx.restore();
      }
    }
    ctx.stroke();
  }

  #bindGuideCreate() {
    const zoneH = this.querySelector('#guide-create-h');
    const zoneV = this.querySelector('#guide-create-v');

    if (zoneH) {
      zoneH.addEventListener('pointerdown', (e) => this.#startGuideDrag(e, 'x'));
    }
    if (zoneV) {
      zoneV.addEventListener('pointerdown', (e) => this.#startGuideDrag(e, 'y'));
    }
  }

  #startGuideDrag(e, axis) {
    e.preventDefault();
    e.stopPropagation();

    const rect = this.getBoundingClientRect();
    const startPos = axis === 'x'
      ? (e.clientX - rect.left - RULER_SIZE - this.#panX * this.#zoom) / this.#zoom
      : (e.clientY - rect.top - RULER_SIZE - this.#panY * this.#zoom) / this.#zoom;

    this.#dragging = { axis, startPosition: startPos, currentPosition: startPos };

    const onMove = (ev) => {
      if (!this.#dragging) return;
      const pos = this.#dragging.axis === 'x'
        ? (ev.clientX - rect.left - RULER_SIZE - this.#panX * this.#zoom) / this.#zoom
        : (ev.clientY - rect.top - RULER_SIZE - this.#panY * this.#zoom) / this.#zoom;
      this.#dragging.currentPosition = pos;

      this.#guides = this.#guides.filter(g => g.id !== '__dragging__');
      this.#guides.push({ id: '__dragging__', axis: this.#dragging.axis, position: pos });
      this.#scheduleRender(this.clientWidth - RULER_SIZE, this.clientHeight - RULER_SIZE);
    };

    const onUp = (ev) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (!this.#dragging) return;

      this.#guides = this.#guides.filter(g => g.id !== '__dragging__');

      const finalPos = this.#dragging.axis === 'x'
        ? (ev.clientX - rect.left - RULER_SIZE - this.#panX * this.#zoom) / this.#zoom
        : (ev.clientY - rect.top - RULER_SIZE - this.#panY * this.#zoom) / this.#zoom;

      if (this.#onGuideCreate && finalPos > -1000 && finalPos < 100000) {
        this.#onGuideCreate({ axis: this.#dragging.axis, position: Math.round(finalPos) });
      }

      this.#dragging = null;
      this.#scheduleRender(this.clientWidth - RULER_SIZE, this.clientHeight - RULER_SIZE);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
  }

  render() {}
}

customElements.define('penpot-rulers', PenpotRulers);