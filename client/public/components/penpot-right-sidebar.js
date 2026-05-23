import { PenpotElement } from './base.js';
import './penpot-gradient-editor.js';
import './penpot-shadow-editor.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-right-sidebar { display: flex; flex-direction: column; width: var(--penpot-sidebar-width, 260px); background: var(--penpot-surface, #2a2a2a); border-left: 1px solid var(--penpot-border, #444); flex-shrink: 0; overflow: hidden; }
    .penpot-rside__sidebar-tabs { display: flex; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-rside__sidebar-tab { flex: 1; padding: var(--penpot-spacing-s, 8px) 0; font-size: var(--penpot-font-size-xs, 10px); text-align: center; cursor: pointer; color: var(--penpot-text-dim, #999); border: none; border-bottom: 2px solid transparent; background: none; font-family: inherit; }
    .penpot-rside__sidebar-tab:hover { color: var(--penpot-text, #e6e6e6); background: var(--penpot-surface-high, #333); }
    .penpot-rside__sidebar-tab.penpot-rside__active { color: var(--penpot-primary, #31efb8); border-bottom-color: var(--penpot-primary, #31efb8); }
    .penpot-rside__sidebar-content { flex: 1; overflow-y: auto; }
    .penpot-rside__properties-section { padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); border-bottom: 1px solid var(--penpot-border, #444); }
    .penpot-rside__properties-section h4 { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); text-transform: uppercase; margin: 0 0 var(--penpot-spacing-s, 8px); font-weight: 500; letter-spacing: 0.5px; }
    .penpot-rside__prop-row { display: flex; align-items: center; gap: var(--penpot-spacing-s, 8px); margin-bottom: var(--penpot-spacing-xs, 4px); font-size: var(--penpot-font-size-s, 11px); }
    .penpot-rside__prop-label { width: 20px; color: var(--penpot-text-dim, #999); text-align: right; flex-shrink: 0; font-size: var(--penpot-font-size-xs, 10px); }
    .penpot-rside__prop-input { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); font-size: var(--penpot-font-size-s, 11px); outline: none; }
    .penpot-rside__prop-input:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-rside__prop-input:disabled { opacity: 0.5; }
    .penpot-rside__prop-color-swatch { width: 16px; height: 16px; border-radius: var(--penpot-radius-xs, 2px); border: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-rside__prop-color-input { width: 24px; height: 24px; border: none; background: none; cursor: pointer; padding: 0; flex-shrink: 0; }
    .penpot-rside__empty-state { color: var(--penpot-text-dim, #999); text-align: center; padding: var(--penpot-spacing-xl, 24px); font-size: var(--penpot-font-size-s, 11px); }
    .penpot-rside__shape-type-badge { display: inline-block; background: var(--penpot-surface-highest, #3c3c3c); color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-xs, 10px); padding: 1px 6px; border-radius: var(--penpot-radius-s, 4px); margin-bottom: var(--penpot-spacing-s, 8px); }
    .penpot-rside__bool-ops { display: grid; grid-template-columns: 1fr 1fr; gap: var(--penpot-spacing-xs, 4px); }
    .penpot-rside__bool-btn { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); color: var(--penpot-text, #e6e6e6); font-size: var(--penpot-font-size-xs, 10px); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; }
    .penpot-rside__bool-btn:hover { background: var(--penpot-primary, #31efb8); color: #000; }
    .penpot-rside__bool-type-selector { display: flex; flex-wrap: wrap; gap: var(--penpot-spacing-xs, 4px); margin-bottom: var(--penpot-spacing-s, 8px); }
    .penpot-rside__bool-type-btn { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-xs, 10px); padding: 2px 6px; border-radius: var(--penpot-radius-s, 4px); cursor: pointer; }
    .penpot-rside__bool-type-btn.penpot-rside__active { background: rgba(49,239,184,0.2); color: var(--penpot-primary, #31efb8); border-color: var(--penpot-primary, #31efb8); }
    .penpot-rside__bool-type-btn:hover { background: var(--penpot-surface-highest, #3c3c3c); }
    .penpot-rside__bool-flatten-btn { background: none; border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-xs, 10px); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; width: 100%; margin-top: var(--penpot-spacing-xs, 4px); }
    .penpot-rside__bool-flatten-btn:hover { color: var(--penpot-text, #e6e6e6); border-color: var(--penpot-text-dim, #999); }
    .penpot-rside__inspect-value { color: var(--penpot-text, #e6e6e6); font-family: var(--penpot-font-family, monospace); font-size: var(--penpot-font-size-xs, 10px); }
    .penpot-rside__inspect-code { background: var(--penpot-bg, #1c1c1c); color: var(--penpot-primary, #31efb8); font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 10px; line-height: 1.4; padding: var(--penpot-spacing-s, 8px); border-radius: var(--penpot-radius-s, 4px); margin: var(--penpot-spacing-xs, 4px) 0; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
  
  </style>
  <div class="penpot-rside__sidebar-tabs">
    <button class="penpot-rside__sidebar-tab penpot-rside__active" data-tab="design">Design</button>
    <button class="penpot-rside__sidebar-tab" data-tab="inspect">Inspect</button>
  </div>
  <div class="penpot-rside__sidebar-content" id="content">
    <div class="penpot-rside__empty-state">Select a shape to see its properties.</div>
  </div>`;

export class PenpotRightSidebar extends PenpotElement {
  #selectedShape = null;
  #selectedIds = [];
  #activeTab = 'design';

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelectorAll('.penpot-rside__sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.#activeTab = tab.dataset.tab;
        this.querySelectorAll('.penpot-rside__sidebar-tab').forEach(t => t.classList.toggle('penpot-rside__active', t.dataset.tab === this.#activeTab));
        this.render();
      });
    });
  }

  set selectedShape(shape) {
    this.#selectedShape = shape;
    this.render();
  }

  get selectedShape() { return this.#selectedShape; }

  set selectedIds(ids) {
    this.#selectedIds = ids ? [...ids] : [];
    this.render();
  }

  render() {
    const content = this.querySelector('#content');
    if (!content) return;

    const s = this.#selectedShape;

    if (this.#activeTab === 'inspect') {
      content.innerHTML = this.#renderInspect(s);
      this.#bindInspectEvents(content, s);
      return;
    }

    if (!s) {
      content.innerHTML = '<div class="penpot-rside__empty-state">Select a shape to see its properties.</div>';
      return;
    }

    let html = '';

    // Boolean operations for multiple selection
    if (this.#selectedIds.length >= 2) {
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Boolean Operations</h4>`;
      html += `<div class="penpot-rside__bool-ops">`;
      html += `<button class="penpot-rside__bool-btn" data-bool="union" title="Union (Alt+U)">&#8746; Union</button>`;
      html += `<button class="penpot-rside__bool-btn" data-bool="difference" title="Difference (Alt+D)">&#8726; Diff</button>`;
      html += `<button class="penpot-rside__bool-btn" data-bool="intersection" title="Intersection (Alt+I)">&#8898; Intersect</button>`;
      html += `<button class="penpot-rside__bool-btn" data-bool="exclude" title="Exclude (Alt+E)">&#8891; Exclude</button>`;
      html += `</div></div>`;
    }

    // Bool type selector when a boolean shape is selected
    if (s.type === 'bool') {
      const boolType = s.boolType || 'union';
      const types = ['union', 'difference', 'intersection', 'exclude'];
      const labels = { union: '\u222A Union', difference: '\u2216 Difference', intersection: '\u2229 Intersection', exclude: '\u2291 Exclude' };
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Boolean Type</h4>`;
      html += `<div class="penpot-rside__bool-type-selector">`;
      for (const t of types) {
        html += `<button class="penpot-rside__bool-type-btn ${t === boolType ? 'penpot-rside__active' : ''}" data-bool-type="${t}">${labels[t]}</button>`;
      }
      html += `</div>`;
      html += `<button class="penpot-rside__bool-flatten-btn" data-action="flatten">Flatten to Group</button>`;
      html += `</div>`;
    }

    html += `<div class="penpot-rside__properties-section">`;
    html += `<span class="penpot-rside__shape-type-badge">${this.escHtml(s.type || 'shape')}${s.boolType ? ' (' + this.escHtml(s.boolType) + ')' : ''}</span>`;
    html += `<h4>Position</h4>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">X</span><input class="penpot-rside__prop-input" value="${Math.round(s.x || 0)}" type="number" data-prop="x"></div>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">Y</span><input class="penpot-rside__prop-input" value="${Math.round(s.y || 0)}" type="number" data-prop="y"></div>`;
    html += `</div>`;

    html += `<div class="penpot-rside__properties-section">`;
    html += `<h4>Size</h4>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">W</span><input class="penpot-rside__prop-input" value="${Math.round(s.width || 0)}" type="number" data-prop="w"></div>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">H</span><input class="penpot-rside__prop-input" value="${Math.round(s.height || 0)}" type="number" data-prop="h"></div>`;
    html += `</div>`;

    html += `<div class="penpot-rside__properties-section">`;
    html += `<h4>Rotation</h4>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">\u00B0</span><input class="penpot-rside__prop-input" value="${Math.round((s.rotation || 0) * 180 / Math.PI)}" type="number" data-prop="rotation"></div>`;
    html += `</div>`;

    html += `<div class="penpot-rside__properties-section">`;
    html += `<h4>Opacity</h4>`;
    html += `<div class="penpot-rside__prop-row"><input class="penpot-rside__prop-input" value="${s.opacity ?? 1}" type="number" step="0.1" min="0" max="1" data-prop="opacity"></div>`;
    html += `</div>`;

    const fills = s.fills || [];
    html += `<div class="penpot-rside__properties-section">`;
    html += `<h4>Fills</h4>`;
    if (fills.length > 0) {
      for (const fill of fills) {
        const fillType = fill.fillType || fill.type || 'solid';
        if (fillType === 'solid') {
          const color = fill.color || fill.fillColor || '#ccc';
          html += `<div class="penpot-rside__prop-row">`;
          html += `<input type="color" value="${color}" data-fill-index="${fills.indexOf(fill)}" data-fill-prop="color" class="penpot-rside__prop-color-input" style="width:24px;height:24px;border:none;background:none;cursor:pointer;padding:0;">`;
          html += `<span>Solid</span>`;
          html += `</div>`;
        } else if (fillType === 'linear-gradient' || fillType === 'radial-gradient') {
          const gradientPreview = (fill.stops || []).map(st => `${st.color || '#ccc'} ${(st.offset * 100).toFixed(0)}%`).join(', ');
          html += `<div class="penpot-rside__prop-row">`;
          html += `<div class="penpot-rside__prop-color-swatch" style="background:${fillType === 'radial-gradient' ? `radial-gradient(circle, ${gradientPreview})` : `linear-gradient(90deg, ${gradientPreview})`}"></div>`;
          html += `<span>${fillType === 'radial-gradient' ? 'Radial' : 'Linear'}</span>`;
          html += `</div>`;
        }
      }
    }
    html += `<button class="penpot-rside__bool-btn" id="add-fill-solid" style="margin-top:4px;">+ Solid</button>`;
    html += `<button class="penpot-rside__bool-btn" id="add-fill-gradient" style="margin-top:4px;">+ Gradient</button>`;
    html += `</div>`;

    if (fills.some(f => (f.fillType || f.type) === 'linear-gradient' || (f.fillType || f.type) === 'radial-gradient')) {
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Gradient</h4>`;
      html += `<penpot-gradient-editor id="gradient-editor"></penpot-gradient-editor>`;
      html += `</div>`;
    }

    const shadows = s.shadows || [];
    html += `<div class="penpot-rside__properties-section">`;
    html += `<h4>Shadows</h4>`;
    if (shadows.length > 0) {
      for (const shadow of shadows) {
        const color = shadow.color || '#000';
        html += `<div class="penpot-rside__prop-row">`;
        html += `<div class="penpot-rside__prop-color-swatch" style="background:${color}"></div>`;
        html += `<span>${shadow.style === 'inner-shadow' ? 'Inner' : 'Drop'} ${shadow.offsetX || 0},${shadow.offsetY || 0} ${shadow.blur || 0}px</span>`;
        html += `</div>`;
      }
    }
    html += `<penpot-shadow-editor id="shadow-editor"></penpot-shadow-editor>`;
    html += `</div>`;

    const strokes = s.strokes || [];
    if (strokes.length > 0) {
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Strokes</h4>`;
      for (const stroke of strokes) {
        const color = stroke.color || stroke.strokeColor || '#000';
        html += `<div class="penpot-rside__prop-row">`;
        html += `<div class="penpot-rside__prop-color-swatch" style="background:${color}"></div>`;
        html += `<span>${stroke.width || stroke.strokeWidth || 1}px</span>`;
        html += `</div>`;
      }
      html += `</div>`;
    }

    content.innerHTML = html;

    content.querySelectorAll('.penpot-rside__prop-input').forEach(input => {
      input.addEventListener('change', () => {
        this.emit('penpot-property-change', { prop: input.dataset.prop, value: input.value, shapeId: s.id });
      });
    });

    content.querySelectorAll('.penpot-rside__bool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-bool-op', { boolType: btn.dataset.bool });
      });
    });

    content.querySelectorAll('.penpot-rside__bool-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-bool-type-change', { shapeId: s.id, boolType: btn.dataset.boolType });
      });
    });

    const flattenBtn = content.querySelector('.penpot-rside__bool-flatten-btn');
    if (flattenBtn) {
      flattenBtn.addEventListener('click', () => {
        this.emit('penpot-bool-flatten', { shapeId: s.id });
      });
    }

    const addSolidBtn = content.querySelector('#add-fill-solid');
    if (addSolidBtn) {
      addSolidBtn.addEventListener('click', () => {
        const newFills = [...(s.fills || []), { fillType: 'solid', color: '#4a90d9' }];
        this.emit('penpot-property-change', { prop: 'fills', value: newFills, shapeId: s.id });
      });
    }

    const addGradientBtn = content.querySelector('#add-fill-gradient');
    if (addGradientBtn) {
      addGradientBtn.addEventListener('click', () => {
        const newFills = [...(s.fills || []), { fillType: 'linear-gradient', stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }], angle: 0 }];
        this.emit('penpot-property-change', { prop: 'fills', value: newFills, shapeId: s.id });
      });
    }

    const gradientEditor = content.querySelector('#gradient-editor');
    if (gradientEditor) {
      const gradientFill = s.fills?.find(f => (f.fillType || f.type) === 'linear-gradient' || (f.fillType || f.type) === 'radial-gradient');
      if (gradientFill) {
        gradientEditor.fill = gradientFill;
      }
      gradientEditor.addEventListener('gradient-change', (e) => {
        const gradFill = e.detail.fill;
        const newFills = (s.fills || []).map(f => {
          if ((f.fillType || f.type) === 'linear-gradient' || (f.fillType || f.type) === 'radial-gradient') {
            return { ...gradFill };
          }
          return f;
        });
        this.emit('penpot-property-change', { prop: 'fills', value: newFills, shapeId: s.id });
      });
    }

    const shadowEditor = content.querySelector('#shadow-editor');
    if (shadowEditor) {
      shadowEditor.shadows = s.shadows || [];
      shadowEditor.addEventListener('shadow-change', (e) => {
        this.emit('penpot-property-change', { prop: 'shadows', value: e.detail.shadows, shapeId: s.id });
      });
    }

    content.querySelectorAll('.penpot-rside__prop-color-input').forEach(input => {
      input.addEventListener('input', () => {
        const fillIndex = parseInt(input.dataset.fillIndex, 10);
        const newFills = [...(s.fills || [])];
        if (newFills[fillIndex]) {
          newFills[fillIndex] = { ...newFills[fillIndex], color: input.value };
          this.emit('penpot-property-change', { prop: 'fills', value: newFills, shapeId: s.id });
        }
      });
    });
  }

  #renderInspect(s) {
    if (!s) return '<div class="penpot-rside__empty-state">Select a shape to inspect.</div>';

    const x = Math.round(s.x || 0);
    const y = Math.round(s.y || 0);
    const w = Math.round(s.width || 0);
    const h = Math.round(s.height || 0);
    const opacity = s.opacity ?? 1;
    const rotation = Math.round((s.rotation || 0) * 180 / Math.PI);

    let html = '';

    html += `<div class="penpot-rside__properties-section">`;
    html += `<span class="penpot-rside__shape-type-badge">${this.escHtml(s.type || 'shape')}</span>`;
    html += `<h4>Position & Size</h4>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:50px">X</span><span class="penpot-rside__inspect-value">${x}</span></div>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:50px">Y</span><span class="penpot-rside__inspect-value">${y}</span></div>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:50px">W</span><span class="penpot-rside__inspect-value">${w}</span></div>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:50px">H</span><span class="penpot-rside__inspect-value">${h}</span></div>`;
    if (rotation !== 0) {
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:50px">Rot</span><span class="penpot-rside__inspect-value">${rotation}&deg;</span></div>`;
    }
    html += `</div>`;

    if (opacity < 1) {
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Opacity</h4>`;
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__inspect-value">${(opacity * 100).toFixed(0)}%</span></div>`;
      html += `</div>`;
    }

    const fills = s.fills || [];
    if (fills.length > 0) {
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Fills</h4>`;
      for (const fill of fills) {
        const fillType = fill.fillType || fill.type || 'solid';
        if (fillType === 'solid') {
          html += `<div class="penpot-rside__prop-row"><div class="penpot-rside__prop-color-swatch" style="background:${fill.color || '#ccc'}"></div><span class="penpot-rside__inspect-value">Solid ${fill.color || '#ccc'}</span></div>`;
        } else if (fillType === 'linear-gradient') {
          html += `<div class="penpot-rside__prop-row"><div class="penpot-rside__prop-color-swatch" style="background:linear-gradient(90deg, ${(fill.stops || []).map(st => `${st.color || '#ccc'} ${(st.offset * 100).toFixed(0)}%`).join(', ')})"></div><span class="penpot-rside__inspect-value">Linear Gradient</span></div>`;
        } else if (fillType === 'radial-gradient') {
          html += `<div class="penpot-rside__prop-row"><div class="penpot-rside__prop-color-swatch" style="background:radial-gradient(circle, ${(fill.stops || []).map(st => `${st.color || '#ccc'} ${(st.offset * 100).toFixed(0)}%`).join(', ')})"></div><span class="penpot-rside__inspect-value">Radial Gradient</span></div>`;
        }
      }
      html += `</div>`;
    }

    const shadows = s.shadows || [];
    if (shadows.length > 0) {
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Shadows</h4>`;
      for (const shadow of shadows) {
        const style = shadow.style === 'inner-shadow' ? 'inset' : '';
        html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__inspect-value">${shadow.style === 'inner-shadow' ? 'Inner ' : 'Drop '}${shadow.offsetX || 0}px ${shadow.offsetY || 0}px ${shadow.blur || 0}px ${shadow.color || '#000'}</span></div>`;
      }
      html += `</div>`;
    }

    const strokes = s.strokes || [];
    if (strokes.length > 0) {
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Strokes</h4>`;
      for (const stroke of strokes) {
        html += `<div class="penpot-rside__prop-row"><div class="penpot-rside__prop-color-swatch" style="background:${stroke.color || stroke.strokeColor || '#000'}"></div><span class="penpot-rside__inspect-value">${stroke.width || stroke.strokeWidth || 1}px</span></div>`;
      }
      html += `</div>`;
    }

    if (s.type === 'text') {
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Text</h4>`;
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__inspect-value" style="word-break:break-all">${this.escHtml(s.content || '')}</span></div>`;
      if (s.fontSize) html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:50px">Size</span><span class="penpot-rside__inspect-value">${s.fontSize}px</span></div>`;
      if (s.fontFamily) html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:50px">Font</span><span class="penpot-rside__inspect-value">${this.escHtml(s.fontFamily)}</span></div>`;
      html += `</div>`;
    }

    html += `<div class="penpot-rside__properties-section">`;
    html += `<h4>CSS</h4>`;
    html += `<pre class="penpot-rside__inspect-code">${this.#generateCSS(s)}</pre>`;
    html += `<button class="penpot-rside__bool-btn" id="copy-css-btn" style="width:100%;margin-top:4px;">Copy CSS</button>`;
    html += `</div>`;

    html += `<div class="penpot-rside__properties-section">`;
    html += `<h4>SVG</h4>`;
    html += `<pre class="penpot-rside__inspect-code">${this.escHtml(this.#generateSVG(s))}</pre>`;
    html += `<button class="penpot-rside__bool-btn" id="copy-svg-btn" style="width:100%;margin-top:4px;">Copy SVG</button>`;
    html += `</div>`;

    return html;
  }

  #bindInspectEvents(content, s) {
    if (!s) return;
    const copyCssBtn = content.querySelector('#copy-css-btn');
    if (copyCssBtn) {
      copyCssBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(this.#generateCSS(s)).catch(() => {});
      });
    }
    const copySvgBtn = content.querySelector('#copy-svg-btn');
    if (copySvgBtn) {
      copySvgBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(this.#generateSVG(s)).catch(() => {});
      });
    }
  }

  #generateCSS(s) {
    const lines = [];
    lines.push(`position: absolute;`);
    lines.push(`left: ${Math.round(s.x || 0)}px;`);
    lines.push(`top: ${Math.round(s.y || 0)}px;`);
    lines.push(`width: ${Math.round(s.width || 0)}px;`);
    lines.push(`height: ${Math.round(s.height || 0)}px;`);
    if (s.rotation) lines.push(`transform: rotate(${Math.round((s.rotation || 0) * 180 / Math.PI)}deg);`);
    if (s.opacity != null && s.opacity < 1) lines.push(`opacity: ${s.opacity};`);
    const fills = s.fills || [];
    if (fills.length > 0) {
      for (const fill of fills) {
        const fillType = fill.fillType || fill.type || 'solid';
        if (fillType === 'solid') {
          lines.push(`background-color: ${fill.color || '#ccc'};`);
        } else if (fillType === 'linear-gradient') {
          const stops = (fill.stops || []).map(st => `${st.color || '#ccc'} ${(st.offset * 100).toFixed(0)}%`).join(', ');
          lines.push(`background: linear-gradient(${fill.angle || 0}deg, ${stops});`);
        } else if (fillType === 'radial-gradient') {
          const stops = (fill.stops || []).map(st => `${st.color || '#ccc'} ${(st.offset * 100).toFixed(0)}%`).join(', ');
          lines.push(`background: radial-gradient(circle, ${stops});`);
        }
      }
    }
    const shadows = s.shadows || [];
    if (shadows.length > 0) {
      const shadowStrs = shadows.map(sh => {
        const inset = sh.style === 'inner-shadow' ? 'inset ' : '';
        return `${inset}${sh.offsetX || 0}px ${sh.offsetY || 0}px ${sh.blur || 0}px ${sh.color || '#000'}`;
      });
      lines.push(`box-shadow: ${shadowStrs.join(', ')};`);
    }
    const strokes = s.strokes || [];
    if (strokes.length > 0) {
      const stroke = strokes[0];
      lines.push(`border: ${stroke.width || stroke.strokeWidth || 1}px solid ${stroke.color || stroke.strokeColor || '#000'};`);
    }
    if (s.type === 'text') {
      if (s.fontSize) lines.push(`font-size: ${s.fontSize}px;`);
      if (s.fontFamily) lines.push(`font-family: ${s.fontFamily};`);
      if (s.content) lines.push(`color: ${(s.fills && s.fills[0] && s.fills[0].color) || '#e6e6e6'};`);
    }
    if (s.type === 'rect' || s.type === 'frame') {
      if (s.rx) lines.push(`border-radius: ${s.rx}px;`);
    }
    return lines.join('\n');
  }

  #generateSVG(s) {
    const attrs = [];
    attrs.push(`id="${s.id}"`);
    if (s.x) attrs.push(`x="${Math.round(s.x)}"`);
    if (s.y) attrs.push(`y="${Math.round(s.y)}"`);
    if (s.width) attrs.push(`width="${Math.round(s.width)}"`);
    if (s.height) attrs.push(`height="${Math.round(s.height)}"`);
    if (s.rotation) attrs.push(`transform="rotate(${Math.round((s.rotation || 0) * 180 / Math.PI)} ${Math.round(s.x + s.width / 2)} ${Math.round(s.y + s.height / 2)})"`);
    if (s.opacity != null && s.opacity < 1) attrs.push(`opacity="${s.opacity}"`);

    const fills = s.fills || [];
    if (fills.length > 0 && (fills[0].fillType || fills[0].type) === 'solid') {
      attrs.push(`fill="${fills[0].color || '#ccc'}"`);
    } else {
      attrs.push('fill="#ccc"');
    }

    const strokes = s.strokes || [];
    if (strokes.length > 0) {
      attrs.push(`stroke="${strokes[0].color || strokes[0].strokeColor || '#000'}"`);
      attrs.push(`stroke-width="${strokes[0].width || strokes[0].strokeWidth || 1}"`);
    }

    const tag = s.type === 'circle' || s.type === 'ellipse' ? 'ellipse' : s.type === 'text' ? 'text' : s.type === 'path' ? 'path' : 'rect';
    if (tag === 'ellipse') {
      attrs.push(`cx="${Math.round(s.x + s.width / 2)}"`);
      attrs.push(`cy="${Math.round(s.y + s.height / 2)}"`);
      attrs.push(`rx="${Math.round(s.width / 2)}"`);
      attrs.push(`ry="${Math.round(s.height / 2)}"`);
    }
    if (tag === 'text') {
      if (s.fontSize) attrs.push(`font-size="${s.fontSize}"`);
      attrs.push(`x="${Math.round(s.x)}"`);
      attrs.push(`y="${Math.round(s.y + (s.fontSize || 14))}"`);
    }

    return `<${tag} ${attrs.join(' ')} />`;
  }

  escHtml(str) { const el = document.createElement('span'); el.textContent = str || ''; return el.innerHTML; }
}

customElements.define('penpot-right-sidebar', PenpotRightSidebar);