import { PenpotElement } from './base.js';

const STOP_COLORS = [
  '#ff0000', '#ff6600', '#ffcc00', '#33cc33', '#0099ff',
  '#6633cc', '#cc0066', '#ffffff', '#000000', '#999999',
  '#ff99cc', '#99ffcc', '#99ccff', '#ffcc99', '#cc99ff',
];

const GRADIENT_TYPES = ['linear-gradient', 'radial-gradient'];

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-gradient-editor { display: block; }
    .penpot-grad__gradient-editor { padding: var(--penpot-spacing-s, 8px); }
    .penpot-grad__gradient-preview { height: 24px; border-radius: var(--penpot-radius-s, 4px); border: 1px solid var(--penpot-border, #444); margin-bottom: var(--penpot-spacing-s, 8px); cursor: pointer; }
    .penpot-grad__stops-row { display: flex; align-items: center; gap: 4px; margin-bottom: var(--penpot-spacing-s, 8px); overflow-x: auto; padding: 2px 0; }
    .penpot-grad__gradient-stop { min-width: 28px; height: 28px; border-radius: var(--penpot-radius-xs, 2px); border: 2px solid var(--penpot-border, #444); cursor: pointer; position: relative; flex-shrink: 0; }
    .penpot-grad__gradient-stop.penpot-grad__selected { border-color: var(--penpot-primary, #31efb8); }
    .penpot-grad__gradient-stop .penpot-grad__stop-pos { font-size: 8px; color: var(--penpot-text-dim, #999); text-align: center; line-height: 1; }
    .penpot-grad__gradient-controls { display: flex; flex-direction: column; gap: var(--penpot-spacing-xs, 4px); }
    .penpot-grad__stop-color-row { display: flex; align-items: center; gap: var(--penpot-spacing-xs, 4px); }
    .penpot-grad__stop-color-input { width: 32px; height: 24px; border: none; background: none; cursor: pointer; padding: 0; }
    .penpot-grad__stop-opacity-slider { flex: 1; }
    .penpot-grad__stop-opacity-label { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); min-width: 30px; }
    .penpot-grad__type-row { display: flex; gap: var(--penpot-spacing-xs, 4px); margin-bottom: var(--penpot-spacing-s, 8px); }
    .penpot-grad__type-btn { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-xs, 10px); padding: 2px 6px; border-radius: var(--penpot-radius-s, 4px); cursor: pointer; }
    .penpot-grad__type-btn.penpot-grad__active { background: rgba(49,239,184,0.2); color: var(--penpot-primary, #31efb8); border-color: var(--penpot-primary, #31efb8); }
    .penpot-grad__add-btn { background: none; border: 1px dashed var(--penpot-border, #444); color: var(--penpot-text-dim, #999); padding: var(--penpot-spacing-xs, 4px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-xs, 10px); width: 100%; margin-top: var(--penpot-spacing-xs, 4px); }
    .penpot-grad__add-btn:hover { border-color: var(--penpot-text-dim, #999); color: var(--penpot-text, #e6e6e6); }
    .penpot-grad__del-btn { background: none; border: none; color: var(--penpot-danger, #f44); cursor: pointer; font-size: var(--penpot-font-size-xs, 10px); padding: 2px; }
    .penpot-grad__del-btn:hover { color: #ff6666; }
  
  </style>
  <div class="penpot-grad__gradient-editor">
    <div class="penpot-grad__type-row">
      <button class="penpot-grad__type-btn penpot-grad__active" data-type="linear-gradient">Linear</button>
      <button class="penpot-grad__type-btn" data-type="radial-gradient">Radial</button>
    </div>
    <div class="penpot-grad__gradient-preview" id="preview"></div>
    <div class="penpot-grad__stops-row" id="stops-row"></div>
    <div class="penpot-grad__gradient-controls" id="stop-controls"></div>
    <button class="penpot-grad__add-btn" id="add-stop">+ Add stop</button>
  </div>`;

export class PenpotGradientEditor extends PenpotElement {
  _template = template;
  #fill = null;
  #onChange = null;
  #selectedIndex = -1;

  connectedCallback() {
    super.connectedCallback();
    this.querySelectorAll('.penpot-grad__type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#fill = this.#fill || { fillType: 'linear-gradient', stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }], angle: 0 };
        this.#fill.fillType = btn.dataset.type;
        this.querySelectorAll('.penpot-grad__type-btn').forEach(b => b.classList.toggle('penpot-grad__active', b.dataset.type === this.#fill.fillType));
        this.#renderPreview();
        this.#emitChange();
      });
    });

    this.querySelector('#add-stop').addEventListener('click', () => {
      if (!this.#fill) {
        this.#fill = { fillType: 'linear-gradient', stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }], angle: 0 };
      }
      const newOffset = this.#fill.stops.length > 0 ? Math.round((this.#fill.stops[this.#fill.stops.length - 1].offset + 0.2) * 100) / 100 : 0.5;
      this.#fill.stops.push({ offset: Math.min(1, newOffset), color: '#999999' });
      this.#selectedIndex = this.#fill.stops.length - 1;
      this.#render();
      this.#emitChange();
    });
  }

  set fill(f) {
    this.#fill = f ? { ...f, stops: f.stops ? f.stops.map(s => ({ ...s })) : [] } : null;
    this.#selectedIndex = this.#fill && this.#fill.stops.length > 0 ? 0 : -1;
    this.#render();
  }

  get fill() { return this.#fill; }

  set onChange(fn) { this.#onChange = fn; }

  #emitChange() {
    if (this.#onChange) this.#onChange(this.#fill);
    this.emit('gradient-change', { fill: this.#fill });
  }

  #render() {
    this.#renderTypeButtons();
    this.#renderPreview();
    this.#renderStops();
    this.#renderStopControls();
  }

  #renderTypeButtons() {
    const fillType = this.#fill?.fillType || 'linear-gradient';
    this.querySelectorAll('.penpot-grad__type-btn').forEach(btn => {
      btn.classList.toggle('penpot-grad__active', btn.dataset.type === fillType);
    });
  }

  #renderPreview() {
    const preview = this.querySelector('#preview');
    if (!this.#fill || !this.#fill.stops || this.#fill.stops.length === 0) {
      preview.style.background = 'var(--penpot-surface-high, #333)';
      return;
    }
    const stops = this.#fill.stops.map(s => `${s.color} ${(s.offset * 100).toFixed(0)}%`).join(', ');
    if (this.#fill.fillType === 'radial-gradient') {
      preview.style.background = `radial-gradient(circle, ${stops})`;
    } else {
      const angle = this.#fill.angle || 0;
      preview.style.background = `linear-gradient(${angle}deg, ${stops})`;
    }
  }

  #renderStops() {
    const row = this.querySelector('#stops-row');
    row.innerHTML = '';
    if (!this.#fill || !this.#fill.stops) return;

    for (let i = 0; i < this.#fill.stops.length; i++) {
      const stop = this.#fill.stops[i];
      const el = document.createElement('div');
      el.className = `penpot-grad__gradient-stop ${i === this.#selectedIndex ? 'penpot-grad__selected' : ''}`;
      el.style.background = stop.color;
      el.title = `${stop.color} at ${(stop.offset * 100).toFixed(0)}%`;
      el.addEventListener('click', () => {
        this.#selectedIndex = i;
        this.#render();
      });
      const posLabel = document.createElement('div');
      posLabel.className = 'penpot-grad__stop-pos';
      posLabel.textContent = `${(stop.offset * 100).toFixed(0)}%`;
      el.appendChild(posLabel);
      row.appendChild(el);
    }
  }

  #renderStopControls() {
    const controls = this.querySelector('#stop-controls');
    controls.innerHTML = '';
    if (this.#selectedIndex < 0 || !this.#fill || this.#selectedIndex >= this.#fill.stops.length) return;

    const stop = this.#fill.stops[this.#selectedIndex];
    const row = document.createElement('div');
    row.className = 'penpot-grad__stop-color-row';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'penpot-grad__stop-color-input';
    colorInput.value = stop.color;
    colorInput.addEventListener('input', () => {
      stop.color = colorInput.value;
      this.#renderPreview();
      this.#renderStops();
      this.#emitChange();
    });

    const opacityLabel = document.createElement('label');
    opacityLabel.className = 'penpot-grad__stop-opacity-label';
    opacityLabel.textContent = `${Math.round((stop.opacity ?? 1) * 100)}%`;

    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.min = '0';
    opacitySlider.max = '100';
    opacitySlider.value = String(Math.round((stop.opacity ?? 1) * 100));
    opacitySlider.className = 'penpot-grad__stop-opacity-slider';
    opacitySlider.addEventListener('input', () => {
      stop.opacity = Number(opacitySlider.value) / 100;
      opacityLabel.textContent = `${opacitySlider.value}%`;
      this.#emitChange();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'penpot-grad__del-btn';
    delBtn.textContent = '\u2715';
    delBtn.title = 'Remove stop';
    delBtn.disabled = this.#fill.stops.length <= 2;
    delBtn.addEventListener('click', () => {
      this.#fill.stops.splice(this.#selectedIndex, 1);
      this.#selectedIndex = Math.min(this.#selectedIndex, this.#fill.stops.length - 1);
      this.#render();
      this.#emitChange();
    });

    row.appendChild(colorInput);
    row.appendChild(opacitySlider);
    row.appendChild(opacityLabel);
    row.appendChild(delBtn);
    controls.appendChild(row);
  }

  render() {}
}

customElements.define('penpot-gradient-editor', PenpotGradientEditor);