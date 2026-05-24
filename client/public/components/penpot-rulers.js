import { PenpotElement } from './base.js';

const RULER_SIZE = 20;
const TICK_MAJOR = 100;
const TICK_MINOR = 10;
const TICK_MICRO = 50;

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-rulers { display: block; pointer-events: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    .penpot-ruler__ruler-h { position: absolute; top: 0; left: ${RULER_SIZE}px; right: 0; height: ${RULER_SIZE}px; background: var(--penpot-surface-high, #333); border-bottom: 1px solid var(--penpot-border, #444); overflow: hidden; }
    .penpot-ruler__ruler-v { position: absolute; top: ${RULER_SIZE}px; left: 0; bottom: 0; width: ${RULER_SIZE}px; background: var(--penpot-surface-high, #333); border-right: 1px solid var(--penpot-border, #444); overflow: hidden; }
    .penpot-ruler__ruler-corner { position: absolute; top: 0; left: 0; width: ${RULER_SIZE}px; height: ${RULER_SIZE}px; background: var(--penpot-surface-high, #333); border-right: 1px solid var(--penpot-border, #444); border-bottom: 1px solid var(--penpot-border, #444); }
    .penpot-ruler__ruler-corner svg { width: 100%; height: 100%; }
    .penpot-ruler__ruler-h canvas, .penpot-ruler__ruler-v canvas { position: absolute; top: 0; left: 0; }
  
  </style>
  <div class="penpot-ruler__ruler-corner"></div>
  <div class="penpot-ruler__ruler-h"><canvas id="h-canvas"></canvas></div>
  <div class="penpot-ruler__ruler-v"><canvas id="v-canvas"></canvas></div>`;

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

  connectedCallback() {
    super.connectedCallback();
    this.#hCanvas = this.querySelector('#h-canvas');
    this.#vCanvas = this.querySelector('#v-canvas');
    this.#hCtx = this.#hCanvas.getContext('2d');
    this.#vCtx = this.#vCanvas.getContext('2d');
  }

  set viewport({ zoom, panX, panY, width, height }) {
    this.#zoom = zoom || 1;
    this.#panX = panX || 0;
    this.#panY = panY || 0;
    this.#scheduleRender(width || this.clientWidth - RULER_SIZE, height || this.clientHeight - RULER_SIZE);
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

  render() {}
}

customElements.define('penpot-rulers', PenpotRulers);