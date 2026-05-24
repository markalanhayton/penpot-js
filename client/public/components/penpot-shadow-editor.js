import { PenpotElement } from './base.js';

const SHADOW_TYPES = ['drop-shadow', 'inner-shadow'];

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-shadow-editor { display: block; }
    .penpot-shadow__shadow-editor { padding: var(--penpot-spacing-s, 8px); }
    .penpot-shadow__shadow-row { display: flex; align-items: center; gap: var(--penpot-spacing-xs, 4px); margin-bottom: var(--penpot-spacing-xs, 4px); }
    .penpot-shadow__shadow-preview { width: 32px; height: 32px; border-radius: var(--penpot-radius-xs, 2px); border: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-shadow__color-input { width: 28px; height: 22px; border: none; background: none; cursor: pointer; padding: 0; }
    .penpot-shadow__prop-input { width: 50px; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); font-size: var(--penpot-font-size-xs, 10px); padding: 2px 4px; outline: none; text-align: center; }
    .penpot-shadow__prop-input:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-shadow__prop-label { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); min-width: 12px; }
    .penpot-shadow__opacity-slider { flex: 1; min-width: 40px; }
    .penpot-shadow__type-btns { display: flex; gap: var(--penpot-spacing-xs, 4px); margin-bottom: var(--penpot-spacing-s, 8px); }
    .penpot-shadow__type-btn { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-xs, 10px); padding: 2px 6px; border-radius: var(--penpot-radius-s, 4px); cursor: pointer; }
    .penpot-shadow__type-btn.penpot-shadow__active { background: rgba(49,239,184,0.2); color: var(--penpot-primary, #31efb8); border-color: var(--penpot-primary, #31efb8); }
    .penpot-shadow__add-btn { background: none; border: 1px dashed var(--penpot-border, #444); color: var(--penpot-text-dim, #999); padding: var(--penpot-spacing-xs, 4px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-xs, 10px); width: 100%; margin-top: var(--penpot-spacing-xs, 4px); }
    .penpot-shadow__add-btn:hover { border-color: var(--penpot-text-dim, #999); color: var(--penpot-text, #e6e6e6); }
    .penpot-shadow__del-btn { background: none; border: none; color: var(--penpot-danger, #f44); cursor: pointer; font-size: var(--penpot-font-size-xs, 10px); padding: 2px; }
  
  </style>
  <div class="penpot-shadow__shadow-editor">
    <div id="shadow-list"></div>
    <button class="penpot-shadow__add-btn" id="add-shadow">+ Add shadow</button>
  </div>`;

export class PenpotShadowEditor extends PenpotElement {
  _template = template;
  #shadows = [];

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#add-shadow').addEventListener('click', () => {
      this.#shadows.push({ style: 'drop-shadow', color: '#000000', offsetX: 0, offsetY: 4, blur: 8, spread: 0, opacity: 0.3 });
      this.#render();
      this.#emitChange();
    });
  }

  set shadows(val) {
    this.#shadows = val ? val.map(s => ({ ...s })) : [];
    this.#render();
  }

  get shadows() { return this.#shadows; }

  #emitChange() {
    this.emit('shadow-change', { shadows: this.#shadows });
  }

  #render() {
    const list = this.querySelector('#shadow-list');
    list.innerHTML = '';

    for (let i = 0; i < this.#shadows.length; i++) {
      const shadow = this.#shadows[i];
      const item = document.createElement('div');
      item.className = 'penpot-shadow__shadow-item';
      item.style.cssText = 'border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); margin-bottom: var(--penpot-spacing-xs, 4px);';

      const typeBtns = document.createElement('div');
      typeBtns.className = 'penpot-shadow__type-btns';
      for (const type of SHADOW_TYPES) {
        const btn = document.createElement('button');
        btn.className = `penpot-shadow__type-btn ${shadow.style === type ? 'penpot-shadow__active' : ''}`;
        btn.textContent = type === 'drop-shadow' ? 'Drop' : 'Inner';
        btn.addEventListener('click', () => {
          shadow.style = type;
          this.#render();
          this.#emitChange();
        });
        typeBtns.appendChild(btn);
      }
      item.appendChild(typeBtns);

      const row1 = document.createElement('div');
      row1.className = 'penpot-shadow__shadow-row';

      const preview = document.createElement('div');
      preview.className = 'penpot-shadow__shadow-preview';
      preview.style.background = shadow.color;
      preview.style.opacity = shadow.opacity ?? 1;
      row1.appendChild(preview);

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'penpot-shadow__color-input';
      colorInput.value = shadow.color;
      colorInput.addEventListener('input', () => {
        shadow.color = colorInput.value;
        preview.style.background = shadow.color;
        this.#emitChange();
      });
      row1.appendChild(colorInput);

      row1.appendChild(this.#propLabel('X:'));
      row1.appendChild(this.#propInput(shadow, 'offsetX', i));
      row1.appendChild(this.#propLabel('Y:'));
      row1.appendChild(this.#propInput(shadow, 'offsetY', i));
      item.appendChild(row1);

      const row2 = document.createElement('div');
      row2.className = 'penpot-shadow__shadow-row';
      row2.appendChild(this.#propLabel('Blur:'));
      row2.appendChild(this.#propInput(shadow, 'blur', i));
      row2.appendChild(this.#propLabel('Spread:'));
      row2.appendChild(this.#propInput(shadow, 'spread', i));

      const opacitySlider = document.createElement('input');
      opacitySlider.type = 'range';
      opacitySlider.min = '0';
      opacitySlider.max = '100';
      opacitySlider.value = String(Math.round((shadow.opacity ?? 1) * 100));
      opacitySlider.className = 'penpot-shadow__opacity-slider';
      opacitySlider.addEventListener('input', () => {
        shadow.opacity = Number(opacitySlider.value) / 100;
        preview.style.opacity = shadow.opacity;
        this.#emitChange();
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'penpot-shadow__del-btn';
      delBtn.textContent = '\u2715';
      delBtn.title = 'Remove shadow';
      delBtn.addEventListener('click', () => {
        this.#shadows.splice(i, 1);
        this.#render();
        this.#emitChange();
      });

      row2.appendChild(opacitySlider);
      row2.appendChild(delBtn);
      item.appendChild(row2);

      list.appendChild(item);
    }
  }

  #propLabel(text) {
    const label = document.createElement('span');
    label.className = 'penpot-shadow__prop-label';
    label.textContent = text;
    return label;
  }

  #propInput(shadow, prop, index) {
    const input = document.createElement('input');
    input.className = 'penpot-shadow__prop-input';
    input.type = 'number';
    input.value = String(shadow[prop] ?? 0);
    input.addEventListener('change', () => {
      shadow[prop] = Number(input.value) || 0;
      this.#emitChange();
    });
    return input;
  }

  render() {}
}

customElements.define('penpot-shadow-editor', PenpotShadowEditor);