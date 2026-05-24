import { PenpotElement } from './base.js';

const SYSTEM_FONTS = [
  { label: 'Sans Serif', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'monospace' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-text-toolbar { display: none; position: absolute; z-index: 50; background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); gap: var(--penpot-spacing-xs, 4px); flex-wrap: wrap; align-items: center; box-shadow: var(--penpot-shadow-m, 0 4px 12px rgba(0,0,0,0.4)); }
    penpot-text-toolbar.penpot-ttoolbar__visible { display: flex; }
    .penpot-ttoolbar__tb-btn { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); border-radius: var(--penpot-radius-xs, 2px); font-size: var(--penpot-font-size-m, 13px); display: flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; }
    .penpot-ttoolbar__tb-btn:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
    .penpot-ttoolbar__tb-btn.penpot-ttoolbar__active { background: rgba(49,239,184,0.2); color: var(--penpot-primary, #31efb8); }
    .penpot-ttoolbar__tb-select { background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: var(--penpot-spacing-xs, 4px); font-size: var(--penpot-font-size-s, 11px); outline: none; height: 28px; }
    .penpot-ttoolbar__tb-select:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-ttoolbar__tb-sep { width: 1px; height: 20px; background: var(--penpot-border, #444); margin: 0 var(--penpot-spacing-xs, 4px); }
  
  </style>
  <select class="penpot-ttoolbar__tb-select" id="font-family" title="Font family"></select>
  <select class="penpot-ttoolbar__tb-select" id="font-size" title="Font size"></select>
  <div class="penpot-ttoolbar__tb-sep"></div>
  <button class="penpot-ttoolbar__tb-btn" id="bold-btn" title="Bold (Ctrl+B)"><strong>B</strong></button>
  <button class="penpot-ttoolbar__tb-btn" id="italic-btn" title="Italic (Ctrl+I)"><em>I</em></button>
  <button class="penpot-ttoolbar__tb-btn" id="underline-btn" title="Underline (Ctrl+U)"><u>U</u></button>
  <div class="penpot-ttoolbar__tb-sep"></div>
  <button class="penpot-ttoolbar__tb-btn" id="align-left-btn" title="Align left">&#8676;</button>
  <button class="penpot-ttoolbar__tb-btn" id="align-center-btn" title="Align center">&#8677;</button>
  <button class="penpot-ttoolbar__tb-btn" id="align-right-btn" title="Align right">&#8678;</button>`;

export class PenpotTextToolbar extends PenpotElement {
  _template = template;
  #shape = null;
  #visible = false;
  #teamFonts = [];

  set teamFonts(val) {
    this.#teamFonts = val || [];
    this.#rebuildFontSelect();
  }

  get teamFonts() { return this.#teamFonts; }

  #buildFontList() {
    const teamFontEntries = this.#teamFonts.map(f => ({
      value: f.fontFamily,
      label: `★ ${f.fontFamily}`,
    }));
    return [...SYSTEM_FONTS, ...teamFontEntries];
  }

  #rebuildFontSelect() {
    const fontSelect = this.querySelector('#font-family');
    if (!fontSelect) return;
    const currentVal = fontSelect.value;
    fontSelect.innerHTML = '';
    for (const f of this.#buildFontList()) {
      const opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.label;
      opt.style.fontFamily = f.value;
      fontSelect.appendChild(opt);
    }
    if (currentVal) fontSelect.value = currentVal;
  }

  connectedCallback() {
    super.connectedCallback();

    const fontSelect = this.querySelector('#font-family');
    for (const f of SYSTEM_FONTS) {
      const opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.label;
      opt.style.fontFamily = f.value;
      fontSelect.appendChild(opt);
    }

    const sizeSelect = this.querySelector('#font-size');
    for (const s of FONT_SIZES) {
      const opt = document.createElement('option');
      opt.value = String(s);
      opt.textContent = String(s);
      sizeSelect.appendChild(opt);
    }

    fontSelect.addEventListener('change', () => this.#emitPropChange('fontFamily', fontSelect.value));
    sizeSelect.addEventListener('change', () => this.#emitPropChange('fontSize', Number(sizeSelect.value)));

    this.querySelector('#bold-btn').addEventListener('click', () => this.#emitPropChange('fontWeight', 'bold'));
    this.querySelector('#italic-btn').addEventListener('click', () => this.#emitPropChange('fontStyle', 'italic'));
    this.querySelector('#underline-btn').addEventListener('click', () => this.#emitPropChange('textDecoration', 'underline'));
    this.querySelector('#align-left-btn').addEventListener('click', () => this.#emitPropChange('textAlign', 'left'));
    this.querySelector('#align-center-btn').addEventListener('click', () => this.#emitPropChange('textAlign', 'center'));
    this.querySelector('#align-right-btn').addEventListener('click', () => this.#emitPropChange('textAlign', 'right'));
  }

  set shape(s) {
    this.#shape = s;
    if (!s || s.type !== 'text') {
      this.hide();
      return;
    }
    this.#updateFromShape();
  }

  show(x, y) {
    this.#visible = true;
    this.style.display = 'flex';
    this.style.left = `${x}px`;
    this.style.top = `${y}px`;
    this.classList.add('penpot-ttoolbar__visible');
  }

  hide() {
    this.#visible = false;
    this.style.display = 'none';
    this.classList.remove('penpot-ttoolbar__visible');
  }

  get isVisible() { return this.#visible; }

  #updateFromShape() {
    if (!this.#shape) return;
    const s = this.#shape;
    this.querySelector('#font-family').value = s.fontFamily || 'sans-serif';
    const sizeVal = s.fontSize || 14;
    const sizeSelect = this.querySelector('#font-size');
    sizeSelect.value = FONT_SIZES.includes(sizeVal) ? String(sizeVal) : String(FONT_SIZES.find(s => s >= sizeVal) || 14);
    const isBold = (s.fontWeight || 'normal') === 'bold' || Number(s.fontWeight) >= 700;
    const isItalic = (s.fontStyle || 'normal') === 'italic';
    const isUnderline = (s.textDecoration || 'none') === 'underline';
    this.querySelector('#bold-btn').classList.toggle('penpot-ttoolbar__active', isBold);
    this.querySelector('#italic-btn').classList.toggle('penpot-ttoolbar__active', isItalic);
    this.querySelector('#underline-btn').classList.toggle('penpot-ttoolbar__active', isUnderline);
    const align = s.textAlign || 'left';
    this.querySelector('#align-left-btn').classList.toggle('penpot-ttoolbar__active', align === 'left');
    this.querySelector('#align-center-btn').classList.toggle('penpot-ttoolbar__active', align === 'center');
    this.querySelector('#align-right-btn').classList.toggle('penpot-ttoolbar__active', align === 'right');
  }

  #emitPropChange(prop, value) {
    if (!this.#shape) return;
    if (prop === 'fontWeight') {
      const current = this.#shape.fontWeight || 'normal';
      value = current === 'bold' || Number(current) >= 700 ? 'normal' : 'bold';
    }
    if (prop === 'fontStyle') {
      value = (this.#shape.fontStyle || 'normal') === 'italic' ? 'normal' : 'italic';
    }
    if (prop === 'textDecoration') {
      value = (this.#shape.textDecoration || 'none') === 'underline' ? 'none' : 'underline';
    }
    this.emit('penpot-property-change', { prop, value: String(value), shapeId: this.#shape.id });
    Object.assign(this.#shape, { [prop]: value });
    this.#updateFromShape();
  }
}

customElements.define('penpot-text-toolbar', PenpotTextToolbar);