'use strict';
import { PenpotElement } from './base.js';

const GUIDE_COLOR = '#ff0000';
const GUIDE_OPACITY = 0.7;
const GUIDE_OPACITY_HOVER = 1;
const GUIDE_HIT_AREA = 6;
const GUIDE_PILL_WIDTH = 34;
const GUIDE_PILL_HEIGHT = 18;
const GUIDE_DELETE_MARGIN = 30;

const template = document.createElement('template');
template.innerHTML = `<style>
  :host { display: block; pointer-events: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
  .guide-line { stroke: ${GUIDE_COLOR}; stroke-width: 1; pointer-events: stroke; cursor: ns-resize; }
  .guide-line.horizontal { cursor: ew-resize; }
  .guide-line.vertical { cursor: ns-resize; }
  .guide-hit { fill: transparent; pointer-events: stroke; cursor: inherit; }
  .guide-pill { fill: var(--penpot-surface-high, #333); stroke: ${GUIDE_COLOR}; stroke-width: 1; rx: 3; ry: 3; pointer-events: all; cursor: inherit; }
  .guide-pill-text { fill: var(--penpot-text, #e6e6e6); font-size: 9px; font-family: sans-serif; pointer-events: none; dominant-baseline: central; text-anchor: middle; }
  .guide-new-zone-h { position: absolute; top: 0; left: 20px; right: 0; height: 24px; pointer-events: all; cursor: ew-resize; }
  .guide-new-zone-v { position: absolute; top: 20px; left: 0; bottom: 0; width: 16px; pointer-events: all; cursor: ns-resize; }
  .guide-new-zone-h:hover, .guide-new-zone-v:hover { background: rgba(255, 0, 0, 0.08); }
</style><svg id="guide-svg" width="100%" height="100%" style="position:absolute;top:0;left:0;pointer-events:none;">
  <defs><pattern id="guide-dash" patternUnits="userSpaceOnUse" width="6" height="6"><line x1="0" y1="0" x2="6" y2="0" stroke="${GUIDE_COLOR}" stroke-width="1" stroke-dasharray="4 2"/></pattern></defs>
</svg>
<div class="guide-new-zone-h" id="new-zone-h"></div>
<div class="guide-new-zone-v" id="new-zone-v"></div>`;

export class PenpotGuideOverlay extends PenpotElement {
  _template = template;
  #zoom = 1;
  #panX = 0;
  #panY = 0;
  #guides = [];
  #dragging = null;
  #creating = null;
  #creatingCleanup = null;
  #draggingCleanup = null;
  #hoveredId = null;
  #onGuideChange = null;
  #onGuideRemove = null;
  #viewportWidth = 0;
  #viewportHeight = 0;

  connectedCallback() {
    super.connectedCallback();
    this.#bindZoneEvents();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#unbindAllPointerEvents();
  }

  set viewport({ zoom, panX, panY, width, height }) {
    this.#zoom = zoom || 1;
    this.#panX = panX || 0;
    this.#panY = panY || 0;
    this.#viewportWidth = width || this.clientWidth;
    this.#viewportHeight = height || this.clientHeight;
    this.scheduleRender();
  }

  set guides(val) {
    this.#guides = val || [];
    this.scheduleRender();
  }

  set onGuideChange(fn) {
    this.#onGuideChange = fn;
  }

  set onGuideRemove(fn) {
    this.#onGuideRemove = fn;
  }

  render() {
    const svg = this.querySelector('#guide-svg');
    if (!svg) return;

    const existingLines = svg.querySelectorAll('.guide-line, .guide-hit, .guide-pill, .guide-pill-text');
    for (const el of existingLines) el.remove();

    const NS = 'http://www.w3.org/2000/svg';
    const vw = this.#viewportWidth;
    const vh = this.#viewportHeight;
    const zoom = this.#zoom;
    const panX = this.#panX;
    const panY = this.#panY;
    const RULER = 20;

    for (const guide of this.#guides) {
      const isX = guide.axis === 'x';
      const pos = guide.position * zoom + (isX ? panX * zoom : panY * zoom);
      const isHovered = this.#hoveredId === guide.id;
      const opacity = isHovered ? GUIDE_OPACITY_HOVER : GUIDE_OPACITY;

      const line = document.createElementNS(NS, 'line');
      line.classList.add('guide-line');
      if (isX) {
        line.classList.add('vertical');
        line.setAttribute('x1', String(pos));
        line.setAttribute('y1', String(RULER));
        line.setAttribute('x2', String(pos));
        line.setAttribute('y2', String(vh));
      } else {
        line.classList.add('horizontal');
        line.setAttribute('x1', String(RULER));
        line.setAttribute('y1', String(pos));
        line.setAttribute('x2', String(vw));
        line.setAttribute('y2', String(pos));
      }
      line.setAttribute('stroke', guide.color || GUIDE_COLOR);
      line.setAttribute('stroke-width', '1');
      line.setAttribute('opacity', String(opacity));
      line.dataset.guideId = guide.id;
      line.style.pointerEvents = 'stroke';
      line.style.cursor = isX ? 'ew-resize' : 'ns-resize';
      svg.appendChild(line);

      const hit = document.createElementNS(NS, 'line');
      hit.classList.add('guide-hit');
      hit.setAttribute('x1', line.getAttribute('x1'));
      hit.setAttribute('y1', line.getAttribute('y1'));
      hit.setAttribute('x2', line.getAttribute('x2'));
      hit.setAttribute('y2', line.getAttribute('y2'));
      hit.setAttribute('stroke', 'transparent');
      hit.setAttribute('stroke-width', String(GUIDE_HIT_AREA * 2));
      hit.dataset.guideId = guide.id;
      hit.style.pointerEvents = 'stroke';
      hit.style.cursor = isX ? 'ew-resize' : 'ns-resize';
      svg.appendChild(hit);

      if (isHovered) {
        const pillG = document.createElementNS(NS, 'g');
        const pillX = isX ? pos + 4 : RULER + 4;
        const pillY = isX ? RULER + 4 : pos + 4;
        const pillW = GUIDE_PILL_WIDTH;
        const pillH = GUIDE_PILL_HEIGHT;
        const rect = document.createElementNS(NS, 'rect');
        rect.classList.add('guide-pill');
        rect.setAttribute('x', String(pillX));
        rect.setAttribute('y', String(pillY));
        rect.setAttribute('width', String(pillW));
        rect.setAttribute('height', String(pillH));
        rect.dataset.guideId = guide.id;
        rect.style.cursor = isX ? 'ew-resize' : 'ns-resize';
        rect.style.pointerEvents = 'all';

        const text = document.createElementNS(NS, 'text');
        text.classList.add('guide-pill-text');
        text.setAttribute('x', String(pillX + pillW / 2));
        text.setAttribute('y', String(pillY + pillH / 2));
        text.textContent = String(Math.round(guide.position));
        text.style.pointerEvents = 'none';

        pillG.appendChild(rect);
        pillG.appendChild(text);
        svg.appendChild(pillG);
      }
    }

    this.querySelector('#new-zone-h').style.height = RULER + 'px';
    this.querySelector('#new-zone-v').style.width = RULER + 'px';
  }

  #bindZoneEvents() {
    const zoneH = this.querySelector('#new-zone-h');
    const zoneV = this.querySelector('#new-zone-v');
    if (zoneH) {
      zoneH.addEventListener('pointerdown', (e) => this.#startCreate(e, 'x'));
      zoneH.addEventListener('pointerenter', () => { zoneH.style.cursor = 'ew-resize'; });
    }
    if (zoneV) {
      zoneV.addEventListener('pointerdown', (e) => this.#startCreate(e, 'y'));
      zoneV.addEventListener('pointerenter', () => { zoneV.style.cursor = 'ns-resize'; });
    }
  }

  #startCreate(e, axis) {
    e.preventDefault();
    e.stopPropagation();
    const pos = axis === 'x'
      ? (e.clientX - this.getBoundingClientRect().left - 20 * this.#zoom - this.#panX * this.#zoom) / this.#zoom
      : (e.clientY - this.getBoundingClientRect().top - 20 * this.#zoom - this.#panY * this.#zoom) / this.#zoom;
    this.#creating = { axis, startPosition: pos, currentPosition: pos };
    const onMove = (ev) => this.#moveCreate(ev);
    const onUp = (ev) => this.#endCreate(ev);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
    this.#creatingCleanup = () => {
      document.removeEventListener('pointermove', onMove);
    };
  }

  #moveCreate(e) {
    if (!this.#creating) return;
    const axis = this.#creating.axis;
    const pos = axis === 'x'
      ? (e.clientX - this.getBoundingClientRect().left - 20 * this.#zoom - this.#panX * this.#zoom) / this.#zoom
      : (e.clientY - this.getBoundingClientRect().top - 20 * this.#zoom - this.#panY * this.#zoom) / this.#zoom;
    this.#creating.currentPosition = pos;
    const id = '__creating__';
    const guide = { id, axis, position: pos };
    this.#guides = this.#guides.filter(g => g.id !== id).concat([guide]);
    this.scheduleRender();
  }

  #endCreate(e) {
    if (!this.#creating) return;
    this.#creatingCleanup?.();
    this.#creatingCleanup = null;

    this.#guides = this.#guides.filter(g => g.id !== '__creating__');

    const axis = this.#creating.axis;
    const pos = axis === 'x'
      ? (e.clientX - this.getBoundingClientRect().left - 20 * this.#zoom - this.#panX * this.#zoom) / this.#zoom
      : (e.clientY - this.getBoundingClientRect().top - 20 * this.#zoom - this.#panY * this.#zoom) / this.#zoom;

    if (pos < -1000 || pos > 100000) {
      this.#creating = null;
      this.scheduleRender();
      return;
    }

    const roundedPos = Math.round(pos);
    if (this.#onGuideChange) {
      this.#onGuideChange({ axis, position: roundedPos });
    }
    this.#creating = null;
    this.scheduleRender();
  }

  #unbindAllPointerEvents() {
    this.#creatingCleanup?.();
    this.#creatingCleanup = null;
    this.#draggingCleanup?.();
    this.#draggingCleanup = null;
  }
}

customElements.define('penpot-guide-overlay', PenpotGuideOverlay);