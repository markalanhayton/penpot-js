'use strict';
import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-color-picker { display: inline-block; }
    .penpot-color__color-picker { display: flex; flex-direction: column; gap: var(--penpot-spacing-s, 8px); min-width: 200px; }
    .penpot-color__color-preview { display: flex; align-items: center; gap: var(--penpot-spacing-s, 8px); }
    .penpot-color__color-swatch { width: 32px; height: 32px; border-radius: var(--penpot-radius-s, 4px); border: 2px solid var(--penpot-border, #444); cursor: pointer; position: relative; overflow: hidden; }
    .penpot-color__color-swatch input[type="color"] { position: absolute; top: -4px; left: -4px; width: calc(100% + 8px); height: calc(100% + 8px); opacity: 0; cursor: pointer; }
    .penpot-color__color-hex-input { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); font-size: var(--penpot-font-size-m, 13px); font-family: var(--penpot-font-mono, monospace); outline: none; }
    .penpot-color__color-hex-input:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-color__swatches { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--penpot-spacing-xxs, 2px); }
    .penpot-color__swatch { width: 20px; height: 20px; border-radius: var(--penpot-radius-xs, 2px); cursor: pointer; border: 1px solid transparent; transition: transform var(--penpot-transition-fast, 0.1s ease), border-color var(--penpot-transition-fast, 0.1s ease); }
    .penpot-color__swatch:hover { transform: scale(1.2); border-color: var(--penpot-text, #e6e6e6); }
    .penpot-color__swatch.penpot-color__selected { border-color: var(--penpot-primary, #31efb8); transform: scale(1.1); }
    .penpot-color__opacity-row { display: flex; align-items: center; gap: var(--penpot-spacing-s, 8px); }
    .penpot-color__opacity-label { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); width: 40px; }
    .penpot-color__opacity-slider { flex: 1; -webkit-appearance: none; appearance: none; height: 4px; background: var(--penpot-surface-high, #333); border-radius: 2px; outline: none; }
    .penpot-color__opacity-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--penpot-primary, #31efb8); border: 2px solid var(--penpot-bg, #1c1c1c); cursor: pointer; }
    .penpot-color__opacity-value { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); min-width: 28px; text-align: right; }
  
  </style>
  <div class="penpot-color__color-picker">
    <div class="penpot-color__color-preview">
      <div class="penpot-color__color-swatch" id="swatch">
        <input type="color" id="native-picker" value="#ffffff">
      </div>
      <input class="penpot-color__color-hex-input" id="hex" type="text" maxlength="7" placeholder="#ffffff">
    </div>
    <div class="penpot-color__swatches" id="swatches"></div>
    <div class="penpot-color__opacity-row">
      <span class="penpot-color__opacity-label">Opacity</span>
      <input class="penpot-color__opacity-slider" id="opacity" type="range" min="0" max="1" step="0.01" value="1">
      <span class="penpot-color__opacity-value" id="opacity-value">100%</span>
    </div>
  </div>`;

const PALETTE = [
  '#ffffff', '#cccccc', '#999999', '#666666', '#333333', '#000000',
  '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
  '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39',
  '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#607d8b',
  '#31efb8', '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff',
];

export class PenpotColorPicker extends PenpotElement {
  _template = template;
  static get observedAttributes() { return ['value', 'opacity']; }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    const hex = this.querySelector('#hex');
    const nativePicker = this.querySelector('#native-picker');
    const opacity = this.querySelector('#opacity');
    const opacityVal = this.querySelector('#opacity-value');
    const swatch = this.querySelector('#swatch');

    this.#renderPalette();

    nativePicker.addEventListener('input', (e) => {
      hex.value = e.target.value;
      this.value = e.target.value;
      this.emit('penpot-input', { value: this.value, opacity: parseFloat(opacity.value) });
    });

    hex.addEventListener('change', () => {
      let v = hex.value.trim();
      if (!v.startsWith('#')) v = '#' + v;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        nativePicker.value = v;
        this.value = v;
        this.emit('penpot-input', { value: this.value, opacity: parseFloat(opacity.value) });
      }
    });

    opacity.addEventListener('input', () => {
      opacityVal.textContent = Math.round(parseFloat(opacity.value) * 100) + '%';
      this.emit('penpot-input', { value: this.value, opacity: parseFloat(opacity.value) });
    });

    this.#update();
  }

  attributeChangedCallback() { this.#update(); }

  get value() { return this.getAttribute('value') || '#ffffff'; }
  set value(v) { this.setAttribute('value', v); }

  #renderPalette() {
    const container = this.querySelector('#swatches');
    for (const color of PALETTE) {
      const swatch = document.createElement('div');
      swatch.className = 'penpot-color__swatch';
      swatch.style.background = color;
      swatch.dataset.color = color;
      swatch.addEventListener('click', () => {
        this.value = color;
        this.querySelector('#hex').value = color;
        this.querySelector('#native-picker').value = color;
        this.emit('penpot-input', { value: color, opacity: parseFloat(this.querySelector('#opacity').value) });
      });
      container.appendChild(swatch);
    }
  }

  #update() {
    const hex = this.querySelector('#hex');
    const nativePicker = this.querySelector('#native-picker');
    const swatch = this.querySelector('#swatch');
    if (!hex || !nativePicker || !swatch) return;

    const val = this.value;
    hex.value = val;
    nativePicker.value = val;
    swatch.style.background = val;
  }

  render() {}
}

customElements.define('penpot-color-picker', PenpotColorPicker);