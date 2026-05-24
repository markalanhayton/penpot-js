import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-slider { display: block; }
    .penpot-slider__slider-wrapper { display: flex; align-items: center; gap: var(--penpot-spacing-s, 8px); }
    .penpot-slider__slider-track { position: relative; flex: 1; height: 4px; background: var(--penpot-surface-high, #333); border-radius: 2px; cursor: pointer; }
    .penpot-slider__slider-fill { position: absolute; top: 0; left: 0; height: 100%; background: var(--penpot-primary, #31efb8); border-radius: 2px; pointer-events: none; }
    .penpot-slider__slider-thumb { position: absolute; top: 50%; width: 14px; height: 14px; background: var(--penpot-primary, #31efb8); border: 2px solid var(--penpot-bg, #1c1c1c); border-radius: 50%; transform: translate(-50%, -50%); cursor: grab; transition: box-shadow var(--penpot-transition-fast, 0.1s ease); }
    .penpot-slider__slider-thumb:hover, .penpot-slider__slider-thumb:active { box-shadow: 0 0 0 4px var(--penpot-primary-bg, rgba(49,239,184,0.15)); }
    .penpot-slider__slider-value { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); min-width: 32px; text-align: right; }
    penpot-slider:focus-within .penpot-slider__slider-thumb { outline: var(--penpot-focus-outline, 2px solid var(--penpot-primary, #31efb8)); outline-offset: var(--penpot-focus-outline-offset, 2px); }
  
  </style>
  <div class="penpot-slider__slider-wrapper">
    <div class="penpot-slider__slider-track" id="track">
      <div class="penpot-slider__slider-fill" id="fill"></div>
      <div class="penpot-slider__slider-thumb" id="thumb" tabindex="0"></div>
    </div>
    <span class="penpot-slider__slider-value" id="value"></span>
  </div>`;

export class PenpotSlider extends PenpotElement {
  _template = template;
  #min = 0;
  #max = 100;
  #value = 50;
  #step = 1;
  #dragging = false;

  static get observedAttributes() { return ['min', 'max', 'value', 'step']; }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.#min = parseFloat(this.getAttribute('min')) || 0;
    this.#max = parseFloat(this.getAttribute('max')) || 100;
    this.#step = parseFloat(this.getAttribute('step')) || 1;
    this.#value = parseFloat(this.getAttribute('value')) ?? this.#min;
    this.#updateVisual();

    const track = this.querySelector('#track');
    const thumb = this.querySelector('#thumb');

    track.addEventListener('click', (e) => {
      if (e.target === thumb) return;
      this.#setValueFromPosition(e.clientX);
    });

    thumb.addEventListener('pointerdown', (e) => {
      this.#dragging = true;
      thumb.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    thumb.addEventListener('pointermove', (e) => {
      if (!this.#dragging) return;
      this.#setValueFromPosition(e.clientX);
    });

    thumb.addEventListener('pointerup', () => {
      this.#dragging = false;
    });

    thumb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { this.value = Math.min(this.#max, this.#value + this.#step); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { this.value = Math.max(this.#min, this.#value - this.#step); e.preventDefault(); }
    });
  }

  attributeChangedCallback(name) {
    if (name === 'value') this.#value = parseFloat(this.getAttribute('value')) ?? this.#min;
    if (name === 'min') this.#min = parseFloat(this.getAttribute('min')) || 0;
    if (name === 'max') this.#max = parseFloat(this.getAttribute('max')) || 100;
    if (name === 'step') this.#step = parseFloat(this.getAttribute('step')) || 1;
    this.#updateVisual();
  }

  get value() { return this.#value; }
  set value(v) {
    const clamped = Math.round(Math.max(this.#min, Math.min(this.#max, v)) / this.#step) * this.#step;
    if (clamped !== this.#value) {
      this.#value = clamped;
      this.setAttribute('value', clamped);
      this.#updateVisual();
      this.emit('penpot-input', { value: clamped });
    }
  }

  #setValueFromPosition(clientX) {
    const track = this.querySelector('#track');
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    this.value = this.#min + ratio * (this.#max - this.#min);
  }

  #updateVisual() {
    const fill = this.querySelector('#fill');
    const thumb = this.querySelector('#thumb');
    const valueEl = this.querySelector('#value');
    if (!fill || !thumb) return;

    const ratio = (this.#max - this.#min) > 0 ? (this.#value - this.#min) / (this.#max - this.#min) : 0;
    fill.style.width = `${ratio * 100}%`;
    thumb.style.left = `${ratio * 100}%`;
    valueEl.textContent = parseFloat(this.#value.toFixed(2));
  }

  render() {}
}

customElements.define('penpot-slider', PenpotSlider);