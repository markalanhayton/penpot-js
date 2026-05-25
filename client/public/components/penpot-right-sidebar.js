import { PenpotElement } from './base.js';
import './penpot-gradient-editor.js';
import './penpot-shadow-editor.js';
import './penpot-layout-panel.js';
import './penpot-tokens-panel.js';
import './penpot-interaction-panel.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-right-sidebar { display: flex; flex-direction: column; width: var(--penpot-sidebar-width, 260px); background: var(--penpot-surface, #2a2a2a); border-left: 1px solid var(--penpot-border, #444); flex-shrink: 0; overflow: hidden; }
    .penpot-rside__sidebar-tabs { display: flex; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-rside__sidebar-tab { flex: 1; padding: var(--penpot-spacing-s, 8px) 0; font-size: var(--penpot-font-size-xs, 10px); text-align: center; cursor: pointer; color: var(--penpot-text-dim, #999); border: none; border-bottom: 2px solid transparent; background: none; font-family: inherit; }
    .penpot-rside__sidebar-tab:hover { color: var(--penpot-text, #e6e6e6); background: var(--penpot-surface-high, #333); }
    .penpot-rside__sidebar-tab.penpot-rside__active { color: var(--penpot-primary, #31efb8); border-bottom-color: var(--penpot-primary, #31efb8); }
    .penpot-rside__sidebar-content { flex: 1; overflow-y: auto; }
    .penpot-rside__properties-section { padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); border-bottom: 1px solid var(--penpot-border, #444); }
    .penpot-rside__properties-section h4 { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); text-transform: uppercase; margin: 0 0 var(--penpot-spacing-s, 8px); font-weight: 500; letter-spacing: 0.5px; display: inline; }
    .penpot-rside__override-dot { color: var(--penpot-primary, #31efb8); margin-left: 4px; font-size: 10px; }
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
    <button class="penpot-rside__sidebar-tab" data-tab="prototype">Prototype</button>
    <button class="penpot-rside__sidebar-tab" data-tab="inspect">Inspect</button>
  </div>
  <div class="penpot-rside__sidebar-content" id="content">
    <div class="penpot-rside__empty-state">Select a shape to see its properties.</div>
  </div>`;

export class PenpotRightSidebar extends PenpotElement {
  _template = template;
  #selectedShape = null;
  #selectedIds = [];
  #activeTab = 'design';
  #teamFonts = [];
  #fileData = null;

  set fileData(val) { this.#fileData = val; }
  #toolManager = null;

  set toolManager(val) { this.#toolManager = val; }

  constructor() {
    super();
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

  set teamFonts(val) {
    this.#teamFonts = val || [];
    if (this.#activeTab === 'design' && this.#selectedShape) this.render();
  }

  get teamFonts() { return this.#teamFonts; }

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

    if (this.#activeTab === 'prototype') {
      content.innerHTML = this.#renderPrototype(s);
      this.#bindPrototypeEvents(content, s);
      return;
    }

    if (!s) {
      const toolManager = this.#toolManager;
      const sn = toolManager ? toolManager.smallNudge : 1;
      const bn = toolManager ? toolManager.bigNudge : 10;
      content.innerHTML = `<div class="penpot-rside__empty-state">Select a shape to see its properties.</div>
      <div class="penpot-rside__properties-section" style="margin-top:12px;">
        <h4>Nudge Settings</h4>
        <div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:auto">Small</span><input class="penpot-rside__prop-input" type="number" min="1" value="${sn}" id="nudge-small" style="width:50px;"></div>
        <div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:auto">Big</span><input class="penpot-rside__prop-input" type="number" min="1" value="${bn}" id="nudge-big" style="width:50px;"></div>
      </div>`;
      const smallInput = content.querySelector('#nudge-small');
      const bigInput = content.querySelector('#nudge-big');
      if (smallInput && toolManager) {
        smallInput.addEventListener('change', () => { toolManager.smallNudge = parseInt(smallInput.value, 10) || 1; });
      }
      if (bigInput && toolManager) {
        bigInput.addEventListener('change', () => { toolManager.bigNudge = parseInt(bigInput.value, 10) || 10; });
      }
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
    html += `<h4>Position${this.#overrideDot('geometry-group')}</h4>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">X</span><input class="penpot-rside__prop-input" value="${Math.round(s.x || 0)}" type="number" data-prop="x"></div>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">Y</span><input class="penpot-rside__prop-input" value="${Math.round(s.y || 0)}" type="number" data-prop="y"></div>`;
    html += `</div>`;

    html += `<div class="penpot-rside__properties-section">`;
    html += `<h4>Size${this.#overrideDot('geometry-group')}</h4>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">W</span><input class="penpot-rside__prop-input" value="${Math.round(s.width || 0)}" type="number" data-prop="w" id="prop-w"></div>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">H</span><input class="penpot-rside__prop-input" value="${Math.round(s.height || 0)}" type="number" data-prop="h" id="prop-h"></div>`;
    html += `<div class="penpot-rside__prop-row" style="gap:4px;margin-top:4px;">`;
    html += `<button class="penpot-rside__bool-btn" data-action="flip-h" title="Flip Horizontal" style="flex:1;">\u2194 Flip H</button>`;
    html += `<button class="penpot-rside__bool-btn" data-action="flip-v" title="Flip Vertical" style="flex:1;">\u2195 Flip V</button>`;
    html += `</div>`;
    html += `</div>`;

    html += `<div class="penpot-rside__properties-section">`;
    html += `<h4>Rotation${this.#overrideDot('geometry-group')}</h4>`;
    html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">\u00B0</span><input class="penpot-rside__prop-input" value="${Math.round((s.rotation || 0) * 180 / Math.PI)}" type="number" data-prop="rotation"></div>`;
    html += `</div>`;

    html += `<div class="penpot-rside__properties-section">`;
    html += `<h4>Opacity</h4>`;
    html += `<div class="penpot-rside__prop-row"><input class="penpot-rside__prop-input" value="${s.opacity ?? 1}" type="number" step="0.1" min="0" max="1" data-prop="opacity"></div>`;
    html += `</div>`;

    if (s.type === 'text') {
      const systemFontFamilies = [
        { value: 'sans-serif', label: 'Sans-serif' },
        { value: 'serif', label: 'Serif' },
        { value: 'monospace', label: 'Monospace' },
        { value: 'Inter, sans-serif', label: 'Inter' },
        { value: 'Roboto, sans-serif', label: 'Roboto' },
        { value: 'Open Sans, sans-serif', label: 'Open Sans' },
        { value: 'Lato, sans-serif', label: 'Lato' },
        { value: 'Montserrat, sans-serif', label: 'Montserrat' },
        { value: 'Playfair Display, serif', label: 'Playfair Display' },
        { value: 'Source Code Pro, monospace', label: 'Source Code Pro' },
      ];
      const teamFontEntries = this.#teamFonts.map(f => ({
        value: f.fontFamily,
        label: `★ ${f.fontFamily}`,
      }));
      const fontFamilies = [...systemFontFamilies, ...teamFontEntries];
      const currentFont = s.fontFamily || 'sans-serif';
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">Font</span><select class="penpot-rside__prop-input" data-text-prop="fontFamily" style="width:140px;">`;
      for (const ff of fontFamilies) {
        html += `<option value="${ff.value}" ${ff.value === currentFont ? 'selected' : ''}>${ff.label}</option>`;
      }
      html += `</select></div>`;
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">Size</span><input class="penpot-rside__prop-input" value="${s.fontSize || 14}" type="number" min="1" data-text-prop="fontSize" style="width:60px;">`;
      html += `<span class="penpot-rside__prop-label" style="margin-left:8px;">Line</span><input class="penpot-rside__prop-input" value="${s.lineHeight || 1.4}" type="number" step="0.1" data-text-prop="lineHeight" style="width:50px;"></div>`;
      const fontWeights = ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
      const currentWeight = s.fontWeight || 'normal';
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">Weight</span><select class="penpot-rside__prop-input" data-text-prop="fontWeight" style="width:70px;">`;
      for (const w of fontWeights) {
        html += `<option value="${w}" ${w === currentWeight ? 'selected' : ''}>${w}</option>`;
      }
      html += `</select>`;
      html += `<span class="penpot-rside__prop-label" style="margin-left:8px;">Spacing</span><input class="penpot-rside__prop-input" value="${s.letterSpacing || 0}" type="number" step="0.5" data-text-prop="letterSpacing" style="width:50px;"></div>`;
      const alignButtons = [
        { value: 'left', label: '\u2261\u2190', title: 'Left' },
        { value: 'center', label: '\u2261\u2194', title: 'Center' },
        { value: 'right', label: '\u2261\u2192', title: 'Right' },
        { value: 'justify', label: '\u2261\u2551', title: 'Justify' },
      ];
      const currentAlign = s.textAlign || 'left';
      html += `<div class="penpot-rside__prop-row" style="gap:4px;">`;
      for (const ab of alignButtons) {
        html += `<button class="penpot-rside__bool-btn ${ab.value === currentAlign ? 'penpot-rside__active' : ''}" data-text-prop="textAlign" data-align="${ab.value}" title="${ab.title}">${ab.label}</button>`;
      }
      html += `</div>`;

      const isSub = s.verticalAlign === 'sub' || s.subscript;
      const isSup = s.verticalAlign === 'super' || s.superscript;
      html += `<div class="penpot-rside__prop-row" style="gap:6px;"><span class="penpot-rside__prop-label">Style</span>`;
      html += `<button class="penpot-rside__bool-btn ${isSub ? 'penpot-rside__active' : ''}" data-text-prop="subscript" title="Subscript">X<sub>2</sub></button>`;
      html += `<button class="penpot-rside__bool-btn ${isSup ? 'penpot-rside__active' : ''}" data-text-prop="superscript" title="Superscript">X<sup>2</sup></button>`;
      html += `</div>`;

      const growType = s.growType || s['grow-type'] || 'fixed';
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label">Resize</span><select id="text-grow-type" class="penpot-rside__prop-input" style="width:100px;">
        <option value="fixed" ${growType === 'fixed' ? 'selected' : ''}>Fixed</option>
        <option value="auto-width" ${growType === 'auto-width' ? 'selected' : ''}>Auto Width</option>
        <option value="auto-height" ${growType === 'auto-height' ? 'selected' : ''}>Auto Height</option>
      </select></div>`;
      html += `</div>`;
    }

     const fills = s.fills || [];
     const hasFillOverride = s.componentId && s.touched && (s.touched instanceof Set ? s.touched.has('fill-group') : Array.isArray(s.touched) ? s.touched.includes('fill-group') : !!(s.touched['fill-group']));
     html += `<div class="penpot-rside__properties-section">`;
      html += `<div class="penpot-rside__prop-row"><h4>Fills${this.#overrideDot('fill-group')}</h4>`;
     if (hasFillOverride) html += `<button class="penpot-rside__bool-btn" id="reset-fills-btn" style="margin-left:auto;font-size:9px;padding:1px 6px;">Reset</button>`;
     html += `</div>`;
    if (fills.length > 0) {
      for (const fill of fills) {
        const fillType = fill.fillType || fill.type || 'solid';
        if (fillType === 'solid') {
          const color = fill.color || fill.fillColor || '#ccc';
          const opacity = fill.opacity ?? 1;
          const hidden = fill.hidden === true;
          html += `<div class="penpot-rside__prop-row" ${hidden ? 'style="opacity:0.5;"' : ''}>`;
          html += `<button class="penpot-rside__bool-btn" data-fill-index="${fills.indexOf(fill)}" data-fill-action="toggle-vis" title="${hidden ? 'Show fill' : 'Hide fill'}" style="padding:2px 4px;font-size:10px;">${hidden ? '\u{1F441}\u200D\u{1F5AB}' : '\u{1F441}'}</button>`;
          html += `<input type="color" value="${color}" data-fill-index="${fills.indexOf(fill)}" data-fill-prop="color" class="penpot-rside__prop-color-input" style="width:24px;height:24px;border:none;background:none;cursor:pointer;padding:0;">`;
          html += `<span>Solid</span>`;
          html += `<input class="penpot-rside__prop-input" value="${Math.round(opacity * 100)}" type="number" min="0" max="100" step="1" data-fill-index="${fills.indexOf(fill)}" data-fill-prop="opacity" style="width:40px;" title="Fill opacity %">`;
          html += `<button class="penpot-rside__bool-btn" data-fill-index="${fills.indexOf(fill)}" data-fill-action="remove" style="padding:2px 6px;font-size:10px;">\u2715</button>`;
          html += `</div>`;
        } else if (fillType === 'linear-gradient' || fillType === 'radial-gradient') {
          const gradientPreview = (fill.stops || []).map(st => `${st.color || '#ccc'} ${(st.offset * 100).toFixed(0)}%`).join(', ');
          const opacity = fill.opacity ?? 1;
          html += `<div class="penpot-rside__prop-row">`;
          html += `<div class="penpot-rside__prop-color-swatch" style="background:${fillType === 'radial-gradient' ? `radial-gradient(circle, ${gradientPreview})` : `linear-gradient(90deg, ${gradientPreview})`}"></div>`;
          html += `<span>${fillType === 'radial-gradient' ? 'Radial' : 'Linear'}</span>`;
          html += `<input class="penpot-rside__prop-input" value="${Math.round(opacity * 100)}" type="number" min="0" max="100" step="1" data-fill-index="${fills.indexOf(fill)}" data-fill-prop="opacity" style="width:40px;" title="Fill opacity %">`;
          html += `<button class="penpot-rside__bool-btn" data-fill-index="${fills.indexOf(fill)}" data-fill-action="remove-fill" style="padding:2px 6px;font-size:10px;">✕</button>`;
          html += `</div>`;
        }
      }
    }
    html += `<button class="penpot-rside__bool-btn" id="add-fill-solid" style="margin-top:4px;">+ Solid</button>`;
    html += `<button class="penpot-rside__bool-btn" id="add-fill-gradient" style="margin-top:4px;">+ Gradient</button>`;
    // Add per-fill remove buttons (rendered above in the loop, but we also add event binding below)
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
     const hasStrokeOverride = s.componentId && s.touched && (s.touched instanceof Set ? s.touched.has('stroke-group') : Array.isArray(s.touched) ? s.touched.includes('stroke-group') : !!(s.touched['stroke-group']));
     html += `<div class="penpot-rside__properties-section">`;
      html += `<div class="penpot-rside__prop-row"><h4>Strokes${this.#overrideDot('stroke-group')}</h4>`;
     if (hasStrokeOverride) html += `<button class="penpot-rside__bool-btn" id="reset-strokes-btn" style="margin-left:auto;font-size:9px;padding:1px 6px;">Reset</button>`;
     html += `</div>`;
    for (let i = 0; i < strokes.length; i++) {
      const stroke = strokes[i];
      const color = stroke.color || stroke.strokeColor || '#000';
      const width = stroke.width || stroke.strokeWidth || 1;
      const style = stroke.style || 'solid';
      const cap = stroke.cap || 'round';
      const align = stroke.alignment || 'center';
      html += `<div class="penpot-rside__prop-row" style="flex-wrap:wrap;gap:4px;">`;
      html += `<input type="color" value="${color}" data-stroke-index="${i}" data-stroke-prop="color" class="penpot-rside__prop-color-input" style="width:20px;height:20px;border:none;background:none;cursor:pointer;padding:0;">`;
      html += `<input class="penpot-rside__prop-input" value="${width}" type="number" min="0" step="1" data-stroke-index="${i}" data-stroke-prop="width" style="width:40px;">`;
      html += `<select class="penpot-rside__prop-input" data-stroke-index="${i}" data-stroke-prop="style" style="width:65px;"><option value="solid" ${style === 'solid' ? 'selected' : ''}>Solid</option><option value="dashed" ${style === 'dashed' ? 'selected' : ''}>Dashed</option><option value="dotted" ${style === 'dotted' ? 'selected' : ''}>Dotted</option></select>`;
      html += `<select class="penpot-rside__prop-input" data-stroke-index="${i}" data-stroke-prop="cap" style="width:58px;"><option value="round" ${cap === 'round' ? 'selected' : ''}>Round</option><option value="butt" ${cap === 'butt' ? 'selected' : ''}>Butt</option><option value="square" ${cap === 'square' ? 'selected' : ''}>Square</option></select>`;
      html += `<select class="penpot-rside__prop-input" data-stroke-index="${i}" data-stroke-prop="alignment" style="width:55px;"><option value="center" ${align === 'center' ? 'selected' : ''}>Center</option><option value="inner" ${align === 'inner' ? 'selected' : ''}>Inner</option><option value="outer" ${align === 'outer' ? 'selected' : ''}>Outer</option></select>`;
      html += `<button class="penpot-rside__bool-btn" data-stroke-index="${i}" data-stroke-action="remove" title="Remove stroke" style="padding:2px 6px;font-size:10px;">✕</button>`;
      html += `</div>`;
    }
    html += `<button class="penpot-rside__bool-btn" id="add-stroke" style="margin-top:4px;">+ Stroke</button>`;
    html += `</div>`;

    if ((s.type === 'rect' || s.type === 'frame') && (s.rx !== undefined || s.borderRadius !== undefined || true)) {
      const r1 = s.r1 ?? s.rx ?? s.borderRadius ?? 0;
      const r2 = s.r2 ?? s.rx ?? s.borderRadius ?? 0;
      const r3 = s.r3 ?? s.rx ?? s.borderRadius ?? 0;
      const r4 = s.r4 ?? s.rx ?? s.borderRadius ?? 0;
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Border Radius${this.#overrideDot('radius-group')}</h4>`;
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:12px;font-size:9px;">TL</span><input class="penpot-rside__prop-input" value="${r1}" type="number" min="0" data-prop="r1"></div>`;
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:12px;font-size:9px;">TR</span><input class="penpot-rside__prop-input" value="${r2}" type="number" min="0" data-prop="r2"></div>`;
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:12px;font-size:9px;">BR</span><input class="penpot-rside__prop-input" value="${r3}" type="number" min="0" data-prop="r3"></div>`;
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:12px;font-size:9px;">BL</span><input class="penpot-rside__prop-input" value="${r4}" type="number" min="0" data-prop="r4"></div>`;
      html += `</div>`;
    }

    html += `<div class="penpot-rside__properties-section">`;
    html += `<h4>Alignment</h4>`;
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">`;
    html += `<button class="penpot-rside__bool-btn" data-align="left" title="Align Left">\u21e0 Left</button>`;
    html += `<button class="penpot-rside__bool-btn" data-align="center-h" title="Align Center">\u2194 Center</button>`;
    html += `<button class="penpot-rside__bool-btn" data-align="right" title="Align Right">\u21e2 Right</button>`;
    html += `<button class="penpot-rside__bool-btn" data-align="top" title="Align Top">\u21e1 Top</button>`;
    html += `<button class="penpot-rside__bool-btn" data-align="center-v" title="Align Middle">\u2195 Middle</button>`;
    html += `<button class="penpot-rside__bool-btn" data-align="bottom" title="Align Bottom">\u21e3 Bottom</button>`;
    html += `</div>`;
    if (this.#selectedIds.length >= 3) {
      html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px;">`;
      html += `<button class="penpot-rside__bool-btn" data-distribute="horizontal" title="Distribute Horizontally">\u21d0\u21d2 H</button>`;
      html += `<button class="penpot-rside__bool-btn" data-distribute="vertical" title="Distribute Vertically">\u21d1\u21d3 V</button>`;
      html += `</div>`;
    }
    html += `</div>`;

    if (s.blur !== undefined || s.type !== 'text') {
      const blur = s.blur ?? 0;
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Blur${this.#overrideDot('blur-group')}</h4>`;
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:16px">px</span><input class="penpot-rside__prop-input" value="${blur}" type="number" min="0" step="1" data-prop="blur"></div>`;
      html += `</div>`;
    }

    const filters = s.filters || [];
    html += `<div class="penpot-rside__properties-section">`;
    html += `<h4>Filters</h4>`;
    for (let fi = 0; fi < filters.length; fi++) {
      const f = filters[fi];
      const ft = f.filterType || f['filter-type'] || 'drop-shadow';
      html += `<div class="penpot-rside__prop-row" style="gap:4px;flex-wrap:wrap;">`;
      html += `<select class="penpot-rside__prop-select" data-filter-type="${fi}" style="flex:1;min-width:80px;">`;
      html += `<option value="drop-shadow"${ft === 'drop-shadow' ? ' selected' : ''}>Drop Shadow</option>`;
      html += `<option value="color-matrix"${ft === 'color-matrix' ? ' selected' : ''}>Color Matrix</option>`;
      html += `<option value="turbulence"${ft === 'turbulence' ? ' selected' : ''}>Turbulence</option>`;
      html += `<option value="flood"${ft === 'flood' ? ' selected' : ''}>Flood Fill</option>`;
      html += `</select>`;
      html += `<button class="penpot-rside__icon-btn" data-filter-remove="${fi}" title="Remove filter" style="width:20px;height:20px;font-size:12px;padding:0;border:1px solid var(--penpot-border,#444);border-radius:3px;background:none;color:var(--penpot-text-dim,#999);cursor:pointer;">✕</button>`;
      html += `</div>`;
      if (ft === 'drop-shadow') {
        const dx = f.offsetX ?? f['offset-x'] ?? 2;
        const dy = f.offsetY ?? f['offset-y'] ?? 2;
        const dev = f.stdDeviation ?? f.deviation ?? 3;
        const color = f.color ?? '#000000';
        const opacity = f.opacity ?? 0.5;
        html += `<div class="penpot-rside__prop-row" style="gap:2px;flex-wrap:wrap;">`;
        html += `<span class="penpot-rside__prop-label" style="width:20px">X</span><input class="penpot-rside__prop-input" type="number" value="${dx}" data-filter-prop="${fi}:offsetX" style="width:42px">`;
        html += `<span class="penpot-rside__prop-label" style="width:20px">Y</span><input class="penpot-rside__prop-input" type="number" value="${dy}" data-filter-prop="${fi}:offsetY" style="width:42px">`;
        html += `<span class="penpot-rside__prop-label" style="width:20px">σ</span><input class="penpot-rside__prop-input" type="number" value="${dev}" data-filter-prop="${fi}:stdDeviation" style="width:42px">`;
        html += `</div>`;
        html += `<div class="penpot-rside__prop-row" style="gap:4px;">`;
        html += `<input type="color" value="${color}" data-filter-prop="${fi}:color" style="width:24px;height:20px;padding:0;border:1px solid var(--penpot-border,#444);">`;
        html += `<span class="penpot-rside__prop-label" style="width:16px">α</span><input class="penpot-rside__prop-input" type="number" value="${opacity}" min="0" max="1" step="0.1" data-filter-prop="${fi}:opacity" style="width:42px">`;
        html += `</div>`;
      } else if (ft === 'color-matrix') {
        const matrixType = f.matrixType ?? f['matrix-type'] ?? 'saturate';
        const values = f.values ?? '0';
        html += `<div class="penpot-rside__prop-row" style="gap:4px;">`;
        html += `<select class="penpot-rside__prop-select" data-filter-prop="${fi}:matrixType" style="flex:1;">`;
        html += `<option value="saturate"${matrixType === 'saturate' ? ' selected' : ''}>Saturate</option>`;
        html += `<option value="hue-rotate"${matrixType === 'hue-rotate' ? ' selected' : ''}>Hue Rotate</option>`;
        html += `<option value="luminance-to-alpha"${matrixType === 'luminance-to-alpha' ? ' selected' : ''}>Luminance→Alpha</option>`;
        html += `</select>`;
        html += `<input class="penpot-rside__prop-input" type="text" value="${values}" data-filter-prop="${fi}:values" style="width:60px;" placeholder="0">`;
        html += `</div>`;
      } else if (ft === 'turbulence') {
        const baseFreq = f.baseFrequency ?? f['base-frequency'] ?? '0.05';
        const numOctaves = f.numOctaves ?? f['num-octaves'] ?? 2;
        const scale = f.scale ?? 10;
        html += `<div class="penpot-rside__prop-row" style="gap:2px;flex-wrap:wrap;">`;
        html += `<span class="penpot-rside__prop-label" style="width:24px">Freq</span><input class="penpot-rside__prop-input" type="text" value="${baseFreq}" data-filter-prop="${fi}:baseFrequency" style="width:52px">`;
        html += `<span class="penpot-rside__prop-label" style="width:24px">Oct</span><input class="penpot-rside__prop-input" type="number" value="${numOctaves}" data-filter-prop="${fi}:numOctaves" style="width:36px" min="1" max="10">`;
        html += `<span class="penpot-rside__prop-label" style="width:24px">Sc</span><input class="penpot-rside__prop-input" type="number" value="${scale}" data-filter-prop="${fi}:scale" style="width:42px">`;
        html += `</div>`;
      } else if (ft === 'flood') {
        const floodColor = f.color ?? '#000000';
        const floodOpacity = f.opacity ?? 0.5;
        html += `<div class="penpot-rside__prop-row" style="gap:4px;">`;
        html += `<input type="color" value="${floodColor}" data-filter-prop="${fi}:color" style="width:24px;height:20px;padding:0;border:1px solid var(--penpot-border,#444);">`;
        html += `<span class="penpot-rside__prop-label" style="width:16px">α</span><input class="penpot-rside__prop-input" type="number" value="${floodOpacity}" min="0" max="1" step="0.1" data-filter-prop="${fi}:opacity" style="width:42px">`;
        html += `</div>`;
      }
    }
    html += `<button class="penpot-rside__bool-btn" data-action="add-filter" style="width:100%;margin-top:4px;">+ Add Filter</button>`;
    html += `</div>`;

    if ((s.type === 'frame' || (s.type === 'rect' && !s.componentRoot && !s.componentId)) && s.width && s.height) {
      const PRESETS = [
        { label: 'Phone', w: 375, h: 667 },
        { label: 'Phone L', w: 667, h: 375 },
        { label: 'Tablet', w: 768, h: 1024 },
        { label: 'Tablet L', w: 1024, h: 768 },
        { label: 'Desktop', w: 1440, h: 900 },
        { label: 'Laptop', w: 1280, h: 800 },
        { label: 'A4', w: 595, h: 842 },
        { label: 'A4 L', w: 842, h: 595 },
      ];
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Frame Presets</h4>`;
      html += `<div class="penpot-rside__bool-ops">`;
      for (const p of PRESETS) {
        html += `<button class="penpot-rside__bool-btn" data-preset-w="${p.w}" data-preset-h="${p.h}" title="${p.w}\u00D7${p.h}">${p.label}</button>`;
      }
      html += `</div></div>`;
    }

    if (s.type === 'frame') {
      html += `<div class="penpot-rside__properties-section">`;
      html += `<penpot-layout-panel id="layout-panel"></penpot-layout-panel>`;
      html += `</div>`;
    }

    if (s.constraintsH || s.constraintsV || s.type === 'rect' || s.type === 'circle' || s.type === 'ellipse' || s.type === 'text' || s.type === 'image' || s.type === 'path') {
      const ch = s.constraintsH || 'scale';
      const cv = s.constraintsV || 'scale';
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Constraints</h4>`;
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:12px;font-size:9px;">H</span><select class="penpot-rside__prop-input" data-prop="constraintsH" style="width:80px;"><option value="left" ${ch === 'left' ? 'selected' : ''}>Left</option><option value="right" ${ch === 'right' ? 'selected' : ''}>Right</option><option value="center" ${ch === 'center' ? 'selected' : ''}>Center</option><option value="scale" ${ch === 'scale' ? 'selected' : ''}>Scale</option></select></div>`;
      html += `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:12px;font-size:9px;">V</span><select class="penpot-rside__prop-input" data-prop="constraintsV" style="width:80px;"><option value="top" ${cv === 'top' ? 'selected' : ''}>Top</option><option value="bottom" ${cv === 'bottom' ? 'selected' : ''}>Bottom</option><option value="center" ${cv === 'center' ? 'selected' : ''}>Center</option><option value="scale" ${cv === 'scale' ? 'selected' : ''}>Scale</option></select></div>`;
      html += `</div>`;
    }

    if (s.componentRoot) {
      const overrideCount = s.touched ? (Array.isArray(s.touched) ? s.touched.length : (s.touched instanceof Set ? s.touched.size : Object.keys(s.touched).length)) : 0;
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Component</h4>`;
      html += `<div class="penpot-rside__prop-row"><span style="color:var(--penpot-primary,#31efb8);font-size:var(--penpot-font-size-xs,10px)">Main Instance</span>`;
      if (overrideCount > 0) {
        html += `<span style="color:var(--penpot-text-dim,#999);font-size:var(--penpot-font-size-xs,10px);margin-left:auto;">${overrideCount} override${overrideCount > 1 ? 's' : ''}</span>`;
      }
      html += `</div>`;
      html += `<button class="penpot-rside__bool-btn" id="reset-overrides-btn" style="width:100%;margin-top:4px;">Reset Overrides</button>`;
      html += `</div>`;
    } else if (s.componentId) {
      const instanceOverrideCount = s.touched ? (Array.isArray(s.touched) ? s.touched.length : (s.touched instanceof Set ? s.touched.size : Object.keys(s.touched).length)) : 0;
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Component Instance</h4>`;
      html += `<div class="penpot-rside__prop-row"><span style="color:var(--penpot-primary,#31efb8);font-size:var(--penpot-font-size-xs,10px)">Instance</span>`;
      if (instanceOverrideCount > 0) {
        html += `<span style="color:var(--penpot-text-dim,#999);font-size:var(--penpot-font-size-xs,10px);margin-left:auto;">${instanceOverrideCount} override${instanceOverrideCount > 1 ? 's' : ''}</span>`;
      }
      html += `</div>`;
      html += `<div style="display:flex;gap:4px;margin-top:4px;">`;
      html += `<button class="penpot-rside__bool-btn" id="sync-instance-btn" style="flex:1;">Sync</button>`;
      html += `<button class="penpot-rside__bool-btn penpot-rside__danger" id="detach-instance-btn" style="flex:1;">Detach</button>`;
      html += `</div>`;
      if (this.#fileData && this.#fileData.data && this.#fileData.data.components) {
        const components = Object.entries(this.#fileData.data.components);
        if (components.length > 1) {
          html += `<div style="margin-top:6px;">`;
          html += `<label style="font-size:var(--penpot-font-size-xs,10px);color:var(--penpot-text-dim,#999);display:block;margin-bottom:2px;">Swap Component</label>`;
          html += `<select id="swap-instance-select" style="width:100%;background:var(--penpot-input-bg,#333);border:1px solid var(--penpot-input-border,#555);border-radius:var(--penpot-radius-s,4px);color:var(--penpot-text,#e6e6e6);padding:4px 6px;font-size:11px;font-family:inherit;">`;
          html += `<option value="">${this.escHtml(s.name || 'Current')}</option>`;
          for (const [compId, comp] of components) {
            if (compId !== s.componentId) {
              html += `<option value="${this.escAttr(compId)}">${this.escHtml(comp.name || comp.path || 'Component')}</option>`;
            }
          }
          html += `</select></div>`;
        }
      }
      html += `</div>`;
    } else if (this.#selectedIds.length >= 1) {
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Actions</h4>`;
      html += `<button class="penpot-rside__bool-btn" id="create-component-btn" style="width:100%;margin-top:4px;">Create Component</button>`;
      html += `</div>`;
    }

    if (s.type === 'frame' || s.type === 'group' || s.type === 'rect' || s.type === 'ellipse' || s.type === 'text' || s.type === 'bool' || s.type === 'path') {
      const exports = s.exports || [];
      html += `<div class="penpot-rside__properties-section">`;
      html += `<h4>Export</h4>`;
      if (exports.length > 0) {
        for (let i = 0; i < exports.length; i++) {
          const exp = exports[i];
          html += `<div class="penpot-rside__prop-row" style="gap:4px;" data-export-row="${i}">`;
          html += `<select class="penpot-rside__prop-input" data-export-format="${i}" style="width:60px;">`;
          for (const fmt of ['svg', 'png', 'jpeg', 'webp', 'pdf']) {
            html += `<option value="${fmt}" ${exp.format === fmt ? 'selected' : ''}>${fmt.toUpperCase()}</option>`;
          }
          html += `</select>`;
          html += `<select class="penpot-rside__prop-input" data-export-scale="${i}" style="width:45px;">`;
          for (const sc of [1, 2, 3, 4]) {
            html += `<option value="${sc}" ${exp.scale === sc ? 'selected' : ''}>${sc}x</option>`;
          }
          html += `</select>`;
          html += `<input class="penpot-rside__prop-input" value="${this.escHtml(exp.suffix || '')}" placeholder="suffix" data-export-suffix="${i}" style="flex:1;min-width:40px;">`;
          html += `<button class="penpot-rside__bool-btn" data-export-remove="${i}" title="Remove" style="padding:2px 6px;">\u00D7</button>`;
          html += `</div>`;
        }
      }
      html += `<div class="penpot-rside__prop-row" style="gap:4px;">`;
      html += `<button class="penpot-rside__bool-btn" id="add-export-preset" style="flex:1;">+ Export</button>`;
      html += `<button class="penpot-rside__bool-btn" id="export-shape-btn" style="flex:1;">Export</button>`;
      html += `</div>`;
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

    const layoutPanel = content.querySelector('#layout-panel');
    if (layoutPanel) {
      layoutPanel.selectedShape = s;
      layoutPanel.toolManager = this.#toolManager;
      layoutPanel.addEventListener('penpot-layout-change', (e) => {
        this.emit('penpot-layout-change', e.detail);
      });
    }

    const addSolidBtn = content.querySelector('#add-fill-solid');
    if (addSolidBtn) {
      addSolidBtn.addEventListener('click', () => {
        const newFills = [...(s.fills || []), { fillType: 'solid', color: '#4a90d9' }];
        this.emit('penpot-property-change', { prop: 'fills', value: newFills, shapeId: s.id });
      });
    }

    const resetFillsBtn = content.querySelector('#reset-fills-btn');
    if (resetFillsBtn) {
      resetFillsBtn.addEventListener('click', () => {
        this.emit('penpot-reset-overrides', { shapeId: s.id, group: 'fill-group' });
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

    content.querySelectorAll('.penpot-rside__prop-color-input[data-fill-index]').forEach(input => {
      input.addEventListener('input', () => {
        const fillIndex = parseInt(input.dataset.fillIndex, 10);
        const fillProp = input.dataset.fillProp;
        const newFills = [...(s.fills || [])];
        if (newFills[fillIndex]) {
          if (fillProp === 'color') {
            newFills[fillIndex] = { ...newFills[fillIndex], color: input.value };
          }
          this.emit('penpot-property-change', { prop: 'fills', value: newFills, shapeId: s.id });
        }
      });
    });

    content.querySelectorAll('[data-fill-prop="opacity"]').forEach(input => {
      input.addEventListener('change', () => {
        const fillIndex = parseInt(input.dataset.fillIndex, 10);
        const newFills = [...(s.fills || [])];
        if (newFills[fillIndex]) {
          newFills[fillIndex] = { ...newFills[fillIndex], opacity: (Number(input.value) || 100) / 100 };
          this.emit('penpot-property-change', { prop: 'fills', value: newFills, shapeId: s.id });
        }
      });
    });

    content.querySelectorAll('[data-fill-action="remove-fill"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fillIndex = parseInt(btn.dataset.fillIndex, 10);
        const newFills = [...(s.fills || [])];
        newFills.splice(fillIndex, 1);
        this.emit('penpot-property-change', { prop: 'fills', value: newFills, shapeId: s.id });
      });
    });

    content.querySelectorAll('[data-fill-action="toggle-vis"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fillIndex = parseInt(btn.dataset.fillIndex, 10);
        const newFills = [...(s.fills || [])];
        if (newFills[fillIndex]) {
          newFills[fillIndex] = { ...newFills[fillIndex], hidden: !newFills[fillIndex].hidden };
          this.emit('penpot-property-change', { prop: 'fills', value: newFills, shapeId: s.id });
        }
      });
    });

    content.querySelectorAll('[data-text-prop]').forEach(input => {
      const eventType = input.tagName === 'SELECT' ? 'change' : 'change';
      input.addEventListener(eventType, () => {
        const prop = input.dataset.textProp;
        const value = input.tagName === 'SELECT' ? input.value : (input.type === 'number' ? Number(input.value) : input.value);
        this.emit('penpot-property-change', { prop, value, shapeId: s.id });
      });
    });

    content.querySelectorAll('[data-align][data-text-prop="textAlign"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-property-change', { prop: 'textAlign', value: btn.dataset.align, shapeId: s.id });
      });
    });

    content.querySelectorAll('[data-text-prop="subscript"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-property-change', { prop: 'subscript', value: !btn.classList.contains('penpot-rside__active'), shapeId: s.id });
      });
    });

    content.querySelectorAll('[data-text-prop="superscript"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-property-change', { prop: 'superscript', value: !btn.classList.contains('penpot-rside__active'), shapeId: s.id });
      });
    });

    const growTypeSelect = content.querySelector('#text-grow-type');
    if (growTypeSelect) {
      growTypeSelect.addEventListener('change', () => {
        this.emit('penpot-property-change', { prop: 'growType', value: growTypeSelect.value, shapeId: s.id });
      });
    }

    content.querySelectorAll('[data-action="flip-h"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-flip', { direction: 'horizontal', shapeId: s.id });
      });
    });
    content.querySelectorAll('[data-action="flip-v"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-flip', { direction: 'vertical', shapeId: s.id });
      });
    });

    content.querySelectorAll('[data-stroke-prop]').forEach(input => {
      const eventType = input.tagName === 'SELECT' ? 'change' : (input.type === 'color' ? 'input' : 'change');
      input.addEventListener(eventType, () => {
        const strokeIndex = parseInt(input.dataset.strokeIndex, 10);
        const strokeProp = input.dataset.strokeProp;
        const newStrokes = [...(s.strokes || [])];
        if (newStrokes[strokeIndex]) {
          newStrokes[strokeIndex] = { ...newStrokes[strokeIndex] };
        if (strokeProp === 'color') newStrokes[strokeIndex].color = input.value;
        else if (strokeProp === 'width') newStrokes[strokeIndex].width = Number(input.value) || 1;
        else if (strokeProp === 'style') newStrokes[strokeIndex].style = input.value;
        else if (strokeProp === 'cap') newStrokes[strokeIndex].cap = input.value;
        else if (strokeProp === 'alignment') newStrokes[strokeIndex].alignment = input.value;
          this.emit('penpot-property-change', { prop: 'strokes', value: newStrokes, shapeId: s.id });
        }
      });
    });

    content.querySelectorAll('[data-stroke-action="remove"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const strokeIndex = parseInt(btn.dataset.strokeIndex, 10);
        const newStrokes = [...(s.strokes || [])];
        newStrokes.splice(strokeIndex, 1);
        this.emit('penpot-property-change', { prop: 'strokes', value: newStrokes, shapeId: s.id });
      });
    });

    const addStrokeBtn = content.querySelector('#add-stroke');
    if (addStrokeBtn) {
      addStrokeBtn.addEventListener('click', () => {
        const newStrokes = [...(s.strokes || []), { color: '#000000', width: 1, style: 'solid', cap: 'round', alignment: 'center' }];
        this.emit('penpot-property-change', { prop: 'strokes', value: newStrokes, shapeId: s.id });
      });
    }

    const resetStrokesBtn = content.querySelector('#reset-strokes-btn');
    if (resetStrokesBtn) {
      resetStrokesBtn.addEventListener('click', () => {
        this.emit('penpot-reset-overrides', { shapeId: s.id, group: 'stroke-group' });
      });
    }

    content.querySelectorAll('[data-action="add-filter"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const newFilters = [...(s.filters || []), { filterType: 'drop-shadow', offsetX: 2, offsetY: 2, stdDeviation: 3, color: '#000000', opacity: 0.5 }];
        this.emit('penpot-property-change', { prop: 'filters', value: newFilters, shapeId: s.id });
      });
    });

    content.querySelectorAll('[data-filter-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.filterRemove, 10);
        const newFilters = [...(s.filters || [])];
        newFilters.splice(idx, 1);
        this.emit('penpot-property-change', { prop: 'filters', value: newFilters, shapeId: s.id });
      });
    });

    content.querySelectorAll('[data-filter-type]').forEach(select => {
      select.addEventListener('change', () => {
        const idx = parseInt(select.dataset.filterType, 10);
        const newFilters = [...(s.filters || [])];
        const defaults = {
          'drop-shadow': { filterType: 'drop-shadow', offsetX: 2, offsetY: 2, stdDeviation: 3, color: '#000000', opacity: 0.5 },
          'color-matrix': { filterType: 'color-matrix', matrixType: 'saturate', values: '0' },
          'turbulence': { filterType: 'turbulence', baseFrequency: '0.05', numOctaves: 2, scale: 10 },
          'flood': { filterType: 'flood', color: '#000000', opacity: 0.5 },
        };
        newFilters[idx] = { ...(defaults[select.value] || defaults['drop-shadow']) };
        this.emit('penpot-property-change', { prop: 'filters', value: newFilters, shapeId: s.id });
      });
    });

    content.querySelectorAll('[data-filter-prop]').forEach(input => {
      const eventType = input.tagName === 'SELECT' ? 'change' : (input.type === 'color' ? 'input' : 'change');
      input.addEventListener(eventType, () => {
        const [idxStr, prop] = input.dataset.filterProp.split(':');
        const idx = parseInt(idxStr, 10);
        const newFilters = [...(s.filters || [])];
        if (!newFilters[idx]) return;
        newFilters[idx] = { ...newFilters[idx] };
        if (input.type === 'number') {
          newFilters[idx][prop] = Number(input.value) || 0;
        } else {
          newFilters[idx][prop] = input.value;
        }
        this.emit('penpot-property-change', { prop: 'filters', value: newFilters, shapeId: s.id });
      });
    });

    content.querySelectorAll('[data-align]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-align', { alignment: btn.dataset.align });
      });
    });

    content.querySelectorAll('[data-preset-w]').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = Number(btn.dataset.presetW);
        const h = Number(btn.dataset.presetH);
        if (s && w && h) {
          this.emit('penpot-property-change', { prop: 'w', value: String(w), shapeId: s.id });
          this.emit('penpot-property-change', { prop: 'h', value: String(h), shapeId: s.id });
          this.emit('penpot-property-change', { prop: 'width', value: String(w), shapeId: s.id });
          this.emit('penpot-property-change', { prop: 'height', value: String(h), shapeId: s.id });
        }
      });
    });

    content.querySelectorAll('[data-distribute]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-distribute', { direction: btn.dataset.distribute });
      });
    });

    const createCompBtn = content.querySelector('#create-component-btn');
    if (createCompBtn) {
      createCompBtn.addEventListener('click', () => {
        this.emit('penpot-create-component', {});
      });
    }
    const syncInstanceBtn = content.querySelector('#sync-instance-btn');
    if (syncInstanceBtn) {
      syncInstanceBtn.addEventListener('click', () => {
        this.emit('penpot-sync-instance', { shapeId: s.id });
      });
    }
    const detachInstanceBtn = content.querySelector('#detach-instance-btn');
    if (detachInstanceBtn) {
      detachInstanceBtn.addEventListener('click', () => {
        this.emit('penpot-detach-instance', { shapeId: s.id });
      });
    }
    const swapSelect = content.querySelector('#swap-instance-select');
    if (swapSelect) {
      swapSelect.addEventListener('change', () => {
        const newComponentId = swapSelect.value;
        if (newComponentId) {
          this.emit('penpot-swap-instance', { shapeId: s.id, componentId: newComponentId });
        }
      });
    }
    const resetOverridesBtn = content.querySelector('#reset-overrides-btn');
    if (resetOverridesBtn) {
      resetOverridesBtn.addEventListener('click', () => {
        this.emit('penpot-reset-overrides', { shapeId: s.id });
      });
    }

    const addExportPresetBtn = content.querySelector('#add-export-preset');
    if (addExportPresetBtn) {
      addExportPresetBtn.addEventListener('click', () => {
        const newScale = (s.exports || []).length === 0 ? 1 : Math.max(...(s.exports || []).map(e => e.scale || 1)) + 1;
        const newSuffix = `@${newScale}x`;
        const exports = [...(s.exports || []), { format: 'png', scale: newScale, suffix: newSuffix }];
        this.emit('penpot-property-change', { prop: 'exports', value: exports, shapeId: s.id });
      });
    }

    const exportShapeBtn = content.querySelector('#export-shape-btn');
    if (exportShapeBtn) {
      exportShapeBtn.addEventListener('click', () => {
        if (s.exports && s.exports.length > 0) {
          this.emit('penpot-export-shape', { shapeId: s.id, exports: s.exports });
        } else {
          this.emit('penpot-export-shape', { shapeId: s.id, exports: [{ format: 'png', scale: 1, suffix: '' }] });
        }
      });
    }

    content.querySelectorAll('[data-export-row]').forEach(row => {
      const idx = parseInt(row.dataset.exportRow, 10);
      const formatSelect = row.querySelector(`[data-export-format="${idx}"]`);
      const scaleSelect = row.querySelector(`[data-export-scale="${idx}"]`);
      const suffixInput = row.querySelector(`[data-export-suffix="${idx}"]`);
      const removeBtn = row.querySelector(`[data-export-remove="${idx}"]`);

      const updateExport = () => {
        const exports = [...(s.exports || [])];
        if (exports[idx]) {
          const oldScale = exports[idx].scale || 1;
          const newScale = Number(scaleSelect?.value) || 1;
          let newSuffix = suffixInput?.value || '';
          if (/^@\d+x$/.test(newSuffix) || newSuffix === '') {
            newSuffix = `@${newScale}x`;
          }
          exports[idx] = {
            ...exports[idx],
            format: formatSelect?.value || 'png',
            scale: newScale,
            suffix: newSuffix,
          };
          this.emit('penpot-property-change', { prop: 'exports', value: exports, shapeId: s.id });
        }
      };

      if (formatSelect) formatSelect.addEventListener('change', updateExport);
      if (scaleSelect) scaleSelect.addEventListener('change', updateExport);
      if (suffixInput) suffixInput.addEventListener('change', updateExport);
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          const exports = [...(s.exports || [])];
          exports.splice(idx, 1);
          this.emit('penpot-property-change', { prop: 'exports', value: exports, shapeId: s.id });
        });
      }
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
    html += `<h4>Opacity${this.#overrideDot('layer-effects-group')}</h4>`;
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
    html += `<h4>Shadows${this.#overrideDot('shadow-group')}</h4>`;
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

  #overrideDot(group) {
    const s = this.#selectedShape;
    if (!s || !s.componentId || !s.touched) return '';
    const touched = s.touched instanceof Set ? s.touched : Array.isArray(s.touched) ? new Set(s.touched) : new Set(Object.keys(s.touched));
    return touched.has(group) ? '<span class="penpot-rside__override-dot" title="Override">●</span>' : '';
  }

  #renderPrototype(s) {
    if (!s) return '<div class="penpot-rside__empty-state">Select a shape to add prototype interactions</div>';
    return `<penpot-interaction-panel id="interaction-panel"></penpot-interaction-panel>`;
  }

  #bindPrototypeEvents(content, s) {
    const panel = content.querySelector('#interaction-panel');
    if (panel) {
      panel.selectedShape = s;
      panel.objects = this.#fileData?.objects || {};
      const state = this.#toolManager?.workspace?.store?.getState?.();
      const pages = state?.pages || [];
      const currentPage = pages.find(p => p.id === state?.currentPageId);
      const frames = currentPage ? Object.values(currentPage.objects || {}).filter(obj => obj.type === 'frame' && obj.id !== '00000000-0000-0000-0000-000000000000') : [];
      panel.frames = frames;
      panel.addEventListener('penpot-interaction-change', (e) => {
        const { shapeId, interactions } = e.detail;
        this.dispatchEvent(new CustomEvent('penpot-property-change', {
          detail: { shapeId, prop: 'interactions', value: interactions },
          bubbles: true,
          composed: true
        }));
      });
    }
  }
}

customElements.define('penpot-right-sidebar', PenpotRightSidebar);