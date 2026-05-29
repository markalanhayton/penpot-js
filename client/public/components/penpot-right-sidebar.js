'use strict';
import { PenpotElement } from './base.js';
import './penpot-gradient-editor.js';
import './penpot-shadow-editor.js';
import './penpot-layout-panel.js';
import './penpot-variant-panel.js';
import './penpot-tokens-panel.js';
import './penpot-interaction-panel.js';
import { SYSTEM_FONTS } from '@penpot/shared/constants';

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
    .penpot-rside__inspect-subtabs { display: flex; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; background: var(--penpot-surface, #2a2a2a); }
    .penpot-rside__inspect-subtab { flex: 1; padding: 4px 0; font-size: 9px; text-align: center; cursor: pointer; color: var(--penpot-text-dim, #999); border: none; border-bottom: 2px solid transparent; background: none; font-family: inherit; }
    .penpot-rside__inspect-subtab:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-rside__inspect-subtab.penpot-rside__active { color: var(--penpot-primary, #31efb8); border-bottom-color: var(--penpot-primary, #31efb8); }
    .penpot-rside__inspect-collapsible-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; }
    .penpot-rside__inspect-collapsible-header h4 { display: inline; }
    .penpot-rside__inspect-collapse-arrow { font-size: 8px; color: var(--penpot-text-dim, #999); transition: transform 0.15s ease; display: inline-block; margin-left: 4px; }
    .penpot-rside__inspect-collapsible-header[data-collapsed="true"] .penpot-rside__inspect-collapse-arrow { transform: rotate(-90deg); }
    .penpot-rside__inspect-collapsible-body { overflow: hidden; }
    .penpot-rside__inspect-collapsible-body[data-hidden="true"] { display: none; }
    .penpot-rside__copy-prop-btn { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 10px; padding: 0 2px; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
    .penpot-rside__prop-row:hover .penpot-rside__copy-prop-btn { opacity: 1; }
    .penpot-rside__copy-prop-btn:hover { color: var(--penpot-primary, #31efb8); }
    .penpot-rside__inspect-token-badge { display: inline-block; background: rgba(49,239,184,0.15); color: var(--penpot-primary, #31efb8); font-size: 8px; padding: 0 4px; border-radius: 2px; margin-left: 4px; vertical-align: middle; }
    .penpot-rside__inspect-export-row { display: flex; align-items: center; gap: var(--penpot-spacing-xs, 4px); margin-bottom: var(--penpot-spacing-xs, 4px); font-size: var(--penpot-font-size-s, 11px); }
    .penpot-rside__inspect-export-row select, .penpot-rside__inspect-export-row input { background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: 2px 4px; font-size: 10px; outline: none; }
    .penpot-rside__inspect-export-row input:focus, .penpot-rside__inspect-export-row select:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-rside__copy-code-btn { background: none; border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); font-size: 9px; padding: 2px 6px; border-radius: var(--penpot-radius-s, 4px); cursor: pointer; }
    .penpot-rside__copy-code-btn:hover { color: var(--penpot-primary, #31efb8); border-color: var(--penpot-primary, #31efb8); }
    .penpot-rside__missing-font-warning { background: rgba(255, 152, 0, 0.15); border: 1px solid rgba(255, 152, 0, 0.4); border-radius: var(--penpot-radius-s, 4px); padding: var(--penpot-spacing-s, 8px); margin-bottom: var(--penpot-spacing-s, 8px); font-size: var(--penpot-font-size-s, 11px); color: #ff9800; line-height: 1.4; }
    .penpot-rside__missing-font-warning strong { color: #ffb74d; }
    .penpot-rside__missing-font-list { margin-top: 4px; font-size: var(--penpot-font-size-xs, 10px); color: #ffcc80; }
  
  </style>
  <div class="penpot-rside__sidebar-tabs" role="tablist" aria-label="Right sidebar">
    <button class="penpot-rside__sidebar-tab penpot-rside__active" data-tab="design" role="tab" aria-selected="true" id="tab-design">Design</button>
    <button class="penpot-rside__sidebar-tab" data-tab="prototype" role="tab" aria-selected="false" id="tab-prototype">Prototype</button>
    <button class="penpot-rside__sidebar-tab" data-tab="inspect" role="tab" aria-selected="false" id="tab-inspect">Inspect</button>
  </div>
  <div class="penpot-rside__sidebar-content" id="content" role="tabpanel" aria-labelledby="tab-design">
    <div class="penpot-rside__empty-state">Select a shape to see its properties.</div>
  </div>`;

export class PenpotRightSidebar extends PenpotElement {
  _template = template;
  #selectedShape = null;
  #selectedIds = [];
  #activeTab = 'design';
  #teamFonts = [];
  #fileData = null;
  #missingFonts = [];

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
        this.querySelectorAll('.penpot-rside__sidebar-tab').forEach(t => {
          const isActive = t.dataset.tab === this.#activeTab;
          t.classList.toggle('penpot-rside__active', isActive);
          t.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        const content = this.querySelector('#content');
        if (content) content.setAttribute('aria-labelledby', tab.id);
        this.render();
      });
    });
  }

  set teamFonts(val) {
    this.#teamFonts = val || [];
    if (this.#activeTab === 'design' && this.#selectedShape) this.render();
  }

  get teamFonts() { return this.#teamFonts; }

  set missingFonts(val) {
    this.#missingFonts = val || [];
    if (this.#activeTab === 'design' && this.#selectedShape) this.render();
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
      const systemFontEntries = SYSTEM_FONTS.map(f => ({
        value: f.family,
        label: f.label,
      }));
      const teamFontEntries = this.#teamFonts.map(f => ({
        value: f.fontFamily,
        label: `★ ${f.fontFamily}`,
      }));
      const fontFamilies = [...systemFontEntries, ...teamFontEntries];
      const currentFont = s.fontFamily || 'sans-serif';

      if (this.#missingFonts.length > 0) {
        const uniqueNames = [...new Set(this.#missingFonts.map(f => f.fontFamily))];
        html += `<div class="penpot-rside__missing-font-warning">`;
        html += `<strong>⚠ Missing font${uniqueNames.length > 1 ? 's' : ''}</strong><br>`;
        html += `Font${uniqueNames.length > 1 ? 's' : ''} not found: ${this.escHtml(uniqueNames.join(', '))}. A substitute will be used.`;
        html += `<div class="penpot-rside__missing-font-list">${uniqueNames.map(n => this.escHtml(n)).join('<br>')}</div>`;
        html += `</div>`;
      }

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
      html += `<penpot-variant-panel></penpot-variant-panel>`;
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
      html += `<penpot-variant-panel></penpot-variant-panel>`;
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

    const variantPanel = content.querySelector('penpot-variant-panel');
    if (variantPanel) {
      variantPanel.fileData = this.#fileData;
      variantPanel.selectedShape = s;
      variantPanel.pages = this.#pages;
      variantPanel.currentPageIndex = this.#currentPageIndex;

      variantPanel.addEventListener('penpot-variant-add-property', (e) => {
        this.emit('penpot-variant-add-property', e.detail);
      });
      variantPanel.addEventListener('penpot-variant-add-variant', (e) => {
        this.emit('penpot-variant-add-variant', e.detail);
      });
      variantPanel.addEventListener('penpot-variant-update-property-name', (e) => {
        this.emit('penpot-variant-update-property-name', e.detail);
      });
      variantPanel.addEventListener('penpot-variant-remove-property', (e) => {
        this.emit('penpot-variant-remove-property', e.detail);
      });
      variantPanel.addEventListener('penpot-variant-select', (e) => {
        this.emit('penpot-variant-select', e.detail);
      });
      variantPanel.addEventListener('penpot-variant-switch', (e) => {
        this.emit('penpot-variant-switch', e.detail);
      });
      variantPanel.addEventListener('penpot-combine-as-variants', (e) => {
        this.emit('penpot-combine-as-variants', e.detail);
      });
      variantPanel.addEventListener('penpot-select-shape', (e) => {
        this.emit('penpot-shape-select', e.detail);
      });
      variantPanel.addEventListener('penpot-detach-instance', (e) => {
        this.emit('penpot-detach-instance', e.detail);
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

  #inspectColorFormat = 'hex';
  #inspectSubTab = 'styles';
  #collapsedSections = new Set();

  #renderInspect(s) {
    if (!s) return '<div class="penpot-rside__empty-state">Select a shape to inspect.</div>';

    let html = '';

    html += `<div class="penpot-rside__properties-section">`;
    html += `<span class="penpot-rside__shape-type-badge">${this.escHtml(s.type || 'shape')}</span>`;
    html += `</div>`;

    html += `<div class="penpot-rside__inspect-subtabs">`;
    html += `<button class="penpot-rside__inspect-subtab${this.#inspectSubTab === 'styles' ? ' penpot-rside__active' : ''}" data-inspect-tab="styles">Styles</button>`;
    html += `<button class="penpot-rside__inspect-subtab${this.#inspectSubTab === 'code' ? ' penpot-rside__active' : ''}" data-inspect-tab="code">Code</button>`;
    html += `<button class="penpot-rside__inspect-subtab${this.#inspectSubTab === 'exports' ? ' penpot-rside__active' : ''}" data-inspect-tab="exports">Exports</button>`;
    html += `</div>`;

    if (this.#inspectSubTab === 'styles') {
      html += this.#renderInspectStyles(s);
    } else if (this.#inspectSubTab === 'code') {
      html += this.#renderInspectCode(s);
    } else if (this.#inspectSubTab === 'exports') {
      html += this.#renderInspectExports(s);
    }

    return html;
  }

  #renderInspectStyles(s) {
    const x = Math.round(s.x || 0);
    const y = Math.round(s.y || 0);
    const w = Math.round(s.width || 0);
    const h = Math.round(s.height || 0);
    const opacity = s.opacity ?? 1;
    const rotation = Math.round((s.rotation || 0) * 180 / Math.PI);
    const fmt = this.#inspectColorFormat;

    let html = '';

    html += `<div class="penpot-rside__properties-section" style="padding-bottom:4px;">`;
    html += `<div style="display:flex;justify-content:flex-end;align-items:center;gap:4px;">`;
    html += `<span style="font-size:9px;color:var(--penpot-text-dim,#999);">Color:</span>`;
    html += `<select id="inspect-color-fmt" class="penpot-rside__tb-select" style="width:auto;font-size:10px;padding:1px 4px">`;
    html += `<option value="hex"${fmt === 'hex' ? ' selected' : ''}>HEX</option>`;
    html += `<option value="rgba"${fmt === 'rgba' ? ' selected' : ''}>RGBA</option>`;
    html += `<option value="hsla"${fmt === 'hsla' ? ' selected' : ''}>HSLA</option>`;
    html += `</select>`;
    html += `</div></div>`;

    html += this.#inspectCollapsibleSection('geometry', 'Geometry', [
      this.#propRow('X', `${x}px`, `left: ${x}px;`),
      this.#propRow('Y', `${y}px`, `top: ${y}px;`),
      this.#propRow('W', `${w}px`, `width: ${w}px;`),
      this.#propRow('H', `${h}px`, `height: ${h}px;`),
      ...(rotation !== 0 ? [this.#propRow('Rotation', `${rotation}\u00B0`, `transform: rotate(${rotation}deg);`)] : []),
      ...this.#inspectBorderRadius(s),
    ]);

    if (opacity < 1) {
      html += this.#inspectCollapsibleSection('opacity', 'Opacity', [
        this.#propRow('Opacity', `${(opacity * 100).toFixed(0)}%`, `opacity: ${opacity};`),
      ]);
    }

    if (s.blendMode && s.blendMode !== 'normal') {
      html += this.#inspectCollapsibleSection('blendmode', 'Blend Mode', [
        this.#propRow('Mode', s.blendMode, `mix-blend-mode: ${s.blendMode};`),
      ]);
    }

    if (s.layout && (s.layout === 'flex' || s.layout === 'grid')) {
      html += this.#inspectCollapsibleSection('layout', 'Layout', this.#inspectLayoutSection(s));
    }

    const fills = s.fills || [];
    if (fills.length > 0) {
      const rows = fills.map((fill, i) => this.#inspectFillRow(fill, i, fmt));
      html += this.#inspectCollapsibleSection('fills', 'Fills', rows);
    }

    const strokes = s.strokes || [];
    if (strokes.length > 0) {
      const rows = strokes.map((stroke, i) => this.#inspectStrokeRow(stroke, i, fmt));
      html += this.#inspectCollapsibleSection('strokes', 'Strokes', rows);
    }

    const shadows = s.shadows || [];
    if (shadows.length > 0) {
      const rows = shadows.map((shadow, i) => this.#inspectShadowRow(shadow, i, fmt));
      html += this.#inspectCollapsibleSection('shadows', 'Shadows', rows);
    }

    if (s.blur && s.blur.value) {
      html += this.#inspectCollapsibleSection('blur', 'Blur', [
        this.#propRow('Blur', `${s.blur.value}px`, `filter: blur(${s.blur.value}px);`),
      ]);
    }

    if (s.type === 'text') {
      html += this.#inspectTextSection(s, fmt);
    }

    const tokenRefs = this.#extractTokenRefs(s);
    if (tokenRefs.length > 0) {
      html += this.#inspectCollapsibleSection('tokens', 'Design Tokens', tokenRefs);
    }

    return html;
  }

  #renderInspectCode(s) {
    const fmt = this.#inspectColorFormat;
    let html = '';

    html += `<div class="penpot-rside__properties-section" style="padding-bottom:4px;">`;
    html += `<div style="display:flex;justify-content:flex-end;align-items:center;gap:4px;">`;
    html += `<span style="font-size:9px;color:var(--penpot-text-dim,#999);">Color:</span>`;
    html += `<select id="inspect-color-fmt" class="penpot-rside__tb-select" style="width:auto;font-size:10px;padding:1px 4px">`;
    html += `<option value="hex"${fmt === 'hex' ? ' selected' : ''}>HEX</option>`;
    html += `<option value="rgba"${fmt === 'rgba' ? ' selected' : ''}>RGBA</option>`;
    html += `<option value="hsla"${fmt === 'hsla' ? ' selected' : ''}>HSLA</option>`;
    html += `</select>`;
    html += `</div></div>`;

    html += this.#inspectCollapsibleSection('css-code', 'CSS', [
      `<pre class="penpot-rside__inspect-code" id="inspect-css-code">${this.escHtml(this.#generateCSS(s))}</pre>`,
      `<button class="penpot-rside__bool-btn" id="copy-css-btn" style="width:100%;margin-top:4px;">Copy CSS</button>`,
    ]);

    html += this.#inspectCollapsibleSection('svg-code', 'SVG', [
      `<pre class="penpot-rside__inspect-code" id="inspect-svg-code">${this.escHtml(this.#generateSVG(s))}</pre>`,
      `<button class="penpot-rside__bool-btn" id="copy-svg-btn" style="width:100%;margin-top:4px;">Copy SVG</button>`,
    ]);

    html += this.#inspectCollapsibleSection('svg-markup', 'SVG Markup', [
      `<pre class="penpot-rside__inspect-code" id="inspect-svg-markup-code">${this.escHtml(this.#generateSVGMarkup(s))}</pre>`,
      `<button class="penpot-rside__bool-btn" id="copy-svg-markup-btn" style="width:100%;margin-top:4px;">Copy Markup</button>`,
    ]);

    return html;
  }

  #renderInspectExports(s) {
    let html = '';

    html += `<div class="penpot-rside__properties-section">`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">`;
    html += `<h4>Export Presets</h4>`;
    html += `<button class="penpot-rside__copy-code-btn" id="inspect-add-export">+ Add</button>`;
    html += `</div>`;

    const exports = s.exports || [];
    if (exports.length === 0) {
      html += `<div style="color:var(--penpot-text-dim,#999);font-size:10px;padding:4px 0;">No export presets. Click "+ Add" to create one.</div>`;
    } else {
      exports.forEach((exp, i) => {
        html += `<div class="penpot-rside__inspect-export-row">`;
        html += `<select data-export-fmt="${i}" style="width:55px;">`;
        html += `<option${exp.format === 'png' ? ' selected' : ''}>png</option>`;
        html += `<option${exp.format === 'jpeg' ? ' selected' : ''}>jpeg</option>`;
        html += `<option${exp.format === 'webp' ? ' selected' : ''}>webp</option>`;
        html += `<option${exp.format === 'svg' ? ' selected' : ''}>svg</option>`;
        html += `<option${exp.format === 'pdf' ? ' selected' : ''}>pdf</option>`;
        html += `</select>`;
        html += `<span style="font-size:10px;color:var(--penpot-text-dim,#999);">@</span>`;
        html += `<select data-export-scale="${i}" style="width:40px;">`;
        [1, 2, 3, 4].forEach(sc => {
          html += `<option${(exp.scale || 1) === sc ? ' selected' : ''}>${sc}x</option>`;
        });
        html += `</select>`;
        html += `<input data-export-suffix="${i}" value="${this.escHtml(exp.suffix || '')}" placeholder="suffix" style="width:50px;" />`;
        html += `<button class="penpot-rside__copy-code-btn" data-export-remove="${i}" title="Remove">\u00D7</button>`;
        html += `</div>`;
      });
    }

    html += `</div>`;

    html += `<div class="penpot-rside__properties-section">`;
    html += `<button class="penpot-rside__bool-btn" id="inspect-export-btn" style="width:100%;">Export Shape</button>`;
    html += `</div>`;

    return html;
  }

  #inspectCollapsibleSection(key, title, rows) {
    if (!rows || rows.length === 0) return '';
    const collapsed = this.#collapsedSections.has(key);
    return `<div class="penpot-rside__properties-section">` +
      `<div class="penpot-rside__inspect-collapsible-header" data-section="${key}" data-collapsed="${collapsed}">` +
      `<h4>${title}</h4>` +
      `<span class="penpot-rside__inspect-collapse-arrow">\u25BC</span>` +
      `</div>` +
      `<div class="penpot-rside__inspect-collapsible-body" data-hidden="${collapsed}">${rows.join('')}</div>` +
      `</div>`;
  }

  #inspectSection(title, rows) {
    if (!rows || rows.length === 0) return '';
    return this.#inspectCollapsibleSection(title.toLowerCase(), title, rows);
  }

  #propRow(label, value, copyValue) {
    const cv = this.escHtml(copyValue || value);
    return `<div class="penpot-rside__prop-row"><span class="penpot-rside__prop-label" style="width:60px">${label}</span><span class="penpot-rside__inspect-value">${this.escHtml(value)}</span><button class="penpot-rside__copy-prop-btn" data-copy="${cv}" title="Copy value">\u2398</button></div>`;
  }

  #inspectBorderRadius(s) {
    const r1 = s.r1 ?? s.rx ?? 0;
    const r2 = s.r2 ?? s.rx ?? 0;
    const r3 = s.r3 ?? s.rx ?? 0;
    const r4 = s.r4 ?? s.rx ?? 0;
    if (!r1 && !r2 && !r3 && !r4) return [];
    if (r1 === r2 && r2 === r3 && r3 === r4) {
      return [this.#propRow('Radius', `${r1}px`, `border-radius: ${r1}px;`)];
    }
    return [
      this.#propRow('TL', `${r1}px`, `border-top-left-radius: ${r1}px;`),
      this.#propRow('TR', `${r2}px`, `border-top-right-radius: ${r2}px;`),
      this.#propRow('BR', `${r3}px`, `border-bottom-right-radius: ${r3}px;`),
      this.#propRow('BL', `${r4}px`, `border-bottom-left-radius: ${r4}px;`),
    ];
  }

  #inspectFillRow(fill, index, fmt) {
    const fillType = fill.fillType || fill.type || 'solid';
    const tokenRef = fill.fillColorRefId ? ` <span class="penpot-rside__inspect-token-badge">token</span>` : '';
    if (fillType === 'solid') {
      const color = fill.color || '#000000';
      const formatted = this.#formatColorForInspect(color, fill.opacity, fmt);
      return `<div class="penpot-rside__prop-row"><div class="penpot-rside__prop-color-swatch" style="background:${color}"></div><span class="penpot-rside__inspect-value">Solid ${formatted}${tokenRef}</span><button class="penpot-rside__copy-prop-btn" data-copy="background-color: ${formatted};" title="Copy value">\u2398</button></div>`;
    }
    if (fillType === 'linear-gradient') {
      const stops = (fill.stops || []).map(st => `${st.color || '#ccc'} ${(st.offset * 100).toFixed(0)}%`).join(', ');
      const css = `linear-gradient(${fill.angle || 0}deg, ${stops})`;
      return `<div class="penpot-rside__prop-row"><div class="penpot-rside__prop-color-swatch" style="background:${css}"></div><span class="penpot-rside__inspect-value">Linear ${Math.round(fill.angle || 0)}\u00B0${tokenRef}</span><button class="penpot-rside__copy-prop-btn" data-copy="background: ${css};" title="Copy value">\u2398</button></div>`;
    }
    if (fillType === 'radial-gradient') {
      const stops = (fill.stops || []).map(st => `${st.color || '#ccc'} ${(st.offset * 100).toFixed(0)}%`).join(', ');
      const css = `radial-gradient(circle, ${stops})`;
      return `<div class="penpot-rside__prop-row"><div class="penpot-rside__prop-color-swatch" style="background:${css}"></div><span class="penpot-rside__inspect-value">Radial${tokenRef}</span><button class="penpot-rside__copy-prop-btn" data-copy="background: ${css};" title="Copy value">\u2398</button></div>`;
    }
    return '';
  }

  #inspectStrokeRow(stroke, index, fmt) {
    const color = stroke.color || stroke.strokeColor || '#000000';
    const width = stroke.width || stroke.strokeWidth || 1;
    const style = stroke.style || stroke.strokeStyle || 'solid';
    const alignment = stroke.alignment || stroke.strokeAlignment || 'center';
    const formatted = this.#formatColorForInspect(color, 1, fmt);
    const tokenRef = stroke.strokeColorRefId ? ` <span class="penpot-rside__inspect-token-badge">token</span>` : '';
    return `<div class="penpot-rside__prop-row"><div class="penpot-rside__prop-color-swatch" style="background:${color}"></div><span class="penpot-rside__inspect-value">${width}px ${style} ${alignment}${tokenRef}</span><button class="penpot-rside__copy-prop-btn" data-copy="border: ${width}px ${style} ${formatted};" title="Copy value">\u2398</button></div>`;
  }

  #inspectShadowRow(shadow, index, fmt) {
    const isInner = shadow.style === 'inner-shadow';
    const color = shadow.color || '#000000';
    const formatted = this.#formatColorForInspect(color, 1, fmt);
    const label = isInner ? 'Inner' : 'Drop';
    const ox = shadow.offsetX || 0;
    const oy = shadow.offsetY || 0;
    const blur = shadow.blur || 0;
    const spread = shadow.spread || 0;
    const inset = isInner ? 'inset ' : '';
    const cssVal = `${inset}${ox}px ${oy}px ${blur}px ${spread}px ${formatted}`;
    return `<div class="penpot-rside__prop-row"><div class="penpot-rside__prop-color-swatch" style="background:${color}"></div><span class="penpot-rside__inspect-value">${label} ${ox}/${oy}/${blur}</span><button class="penpot-rside__copy-prop-btn" data-copy="box-shadow: ${cssVal};" title="Copy value">\u2398</button></div>`;
  }

  #inspectTextSection(s, fmt) {
    const content = s.content;
    let textContent = '';
    if (content && typeof content === 'object' && content.type === 'root') {
      const paragraphs = [];
      function walk(node) {
        if (node.type === 'paragraph') {
          const t = (node.children || []).map(c => c.text || '').join('');
          paragraphs.push(t);
        } else if (node.text !== undefined) {
          paragraphs.push(node.text);
        }
        if (node.children) node.children.forEach(walk);
      }
      walk(content);
      textContent = paragraphs.join('\n');
    } else {
      textContent = content || '';
    }

    const rows = [];
    const preview = textContent.length > 100 ? textContent.slice(0, 100) + '\u2026' : textContent;
    rows.push(`<div class="penpot-rside__prop-row"><span class="penpot-rside__inspect-value" style="word-break:break-all">${this.escHtml(preview)}</span></div>`);

    if (s.fontFamily) rows.push(this.#propRow('Font', s.fontFamily, `font-family: ${s.fontFamily};`));
    if (s.fontSize) rows.push(this.#propRow('Size', `${s.fontSize}px`, `font-size: ${s.fontSize}px;`));
    if (s.fontWeight) rows.push(this.#propRow('Weight', String(s.fontWeight), `font-weight: ${s.fontWeight};`));
    if (s.fontStyle && s.fontStyle !== 'normal') rows.push(this.#propRow('Style', s.fontStyle, `font-style: ${s.fontStyle};`));
    if (s.lineHeight) rows.push(this.#propRow('Line H', String(s.lineHeight), `line-height: ${s.lineHeight};`));
    if (s.letterSpacing) rows.push(this.#propRow('Letter', `${s.letterSpacing}px`, `letter-spacing: ${s.letterSpacing}px;`));
    if (s.textAlign) rows.push(this.#propRow('Align', s.textAlign, `text-align: ${s.textAlign};`));
    if (s.textDecoration && s.textDecoration !== 'none') rows.push(this.#propRow('Decor', s.textDecoration, `text-decoration: ${s.textDecoration};`));
    if (s.textTransform && s.textTransform !== 'none') rows.push(this.#propRow('Transform', s.textTransform, `text-transform: ${s.textTransform};`));

    const fills = s.fills || [];
    if (fills.length > 0 && (fills[0].fillType || fills[0].type) === 'solid') {
      const color = fills[0].color || '#000000';
      const formatted = this.#formatColorForInspect(color, fills[0].opacity, fmt);
      rows.push(this.#propRow('Color', formatted, `color: ${formatted};`));
    }

    return this.#inspectCollapsibleSection('typography', 'Typography', rows);
  }

  #inspectLayoutSection(s) {
    const rows = [];
    const layout = s.layout || 'flex';
    rows.push(this.#propRow('Type', layout, `display: ${layout === 'flex' ? 'flex' : 'grid'};`));
    if (s.layoutDir) {
      const dirMap = { row: 'row', 'row-reverse': 'row-reverse', col: 'column', 'col-reverse': 'column-reverse' };
      rows.push(this.#propRow('Dir', dirMap[s.layoutDir] || s.layoutDir, `flex-direction: ${dirMap[s.layoutDir] || s.layoutDir};`));
    }
    if (s.gap) rows.push(this.#propRow('Gap', `${s.gap}px`, `gap: ${s.gap}px;`));
    if (s.paddingTop != null) rows.push(this.#propRow('Pad T', `${s.paddingTop}px`, `padding-top: ${s.paddingTop}px;`));
    if (s.paddingRight != null) rows.push(this.#propRow('Pad R', `${s.paddingRight}px`, `padding-right: ${s.paddingRight}px;`));
    if (s.paddingBottom != null) rows.push(this.#propRow('Pad B', `${s.paddingBottom}px`, `padding-bottom: ${s.paddingBottom}px;`));
    if (s.paddingLeft != null) rows.push(this.#propRow('Pad L', `${s.paddingLeft}px`, `padding-left: ${s.paddingLeft}px;`));
    return rows;
  }

  #extractTokenRefs(s) {
    const rows = [];
    const seen = new Set();
    const fileData = this.#fileData;

    const addToken = (refId, refFile, type, value) => {
      if (!refId || seen.has(refId)) return;
      seen.add(refId);
      let tokenName = refId;
      if (fileData) {
        const tokensLib = fileData.data?.tokensLib || fileData.tokensLib;
        if (tokensLib) {
          const sets = tokensLib.setsRefs || tokensLib.sets || {};
          for (const setName of Object.keys(sets)) {
            const set = sets[setName];
            const token = set?.[refId] || set?.values?.[refId];
            if (token) {
              tokenName = token.name || tokenName;
              break;
            }
          }
        }
      }
      rows.push(this.#propRow(type, `${tokenName}`, value));
    };

    (s.fills || []).forEach(fill => {
      if (fill.fillColorRefId) {
        const formatted = this.#formatColorForInspect(fill.color || '#000000', fill.opacity, this.#inspectColorFormat);
        addToken(fill.fillColorRefId, fill.fillColorRefFile, 'Fill', `background-color: ${formatted};`);
      }
    });

    (s.strokes || []).forEach(stroke => {
      if (stroke.strokeColorRefId) {
        const color = stroke.color || stroke.strokeColor || '#000000';
        const formatted = this.#formatColorForInspect(color, 1, this.#inspectColorFormat);
        addToken(stroke.strokeColorRefId, stroke.strokeColorRefFile, 'Stroke', `border-color: ${formatted};`);
      }
    });

    if (s.typographyRefId) {
      addToken(s.typographyRefId, s.typographyRefFile, 'Typo', `font: ${s.fontFamily || 'inherit'};`);
    }

    return rows;
  }

  #generateSVGMarkup(s) {
    let html = `<svg xmlns="http://www.w3.org/2000/svg"`;
    html += ` width="${Math.round(s.width || 0)}" height="${Math.round(s.height || 0)}"`;
    html += ` viewBox="0 0 ${Math.round(s.width || 0)} ${Math.round(s.height || 0)}"`;
    html += `>\n`;

    const inner = this.#generateSVG(s);
    if (inner.includes('<defs>')) {
      html += `  ${inner}\n`;
    } else {
      const tag = s.type === 'circle' || s.type === 'ellipse' ? 'ellipse' : s.type === 'text' ? 'text' : s.type === 'path' ? 'path' : s.type === 'image' ? 'image' : 'rect';
      html += `  ${inner}\n`;
    }

    html += `</svg>`;
    return html;
  }

  #formatColorForInspect(color, opacity, fmt) {
    if (fmt === 'hex') {
      return color;
    }
    const rgb = this.#parseColorToRGB(color);
    if (!rgb) return color;
    if (fmt === 'rgba') {
      const a = opacity != null && opacity < 1 ? ` / ${opacity}` : '';
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}${a})`;
    }
    if (fmt === 'hsla') {
      const hsl = this.#rgbToHSL(rgb.r, rgb.g, rgb.b);
      const a = opacity != null && opacity < 1 ? ` / ${opacity}` : '';
      return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%${a})`;
    }
    return color;
  }

  #parseColorToRGB(color) {
    if (!color || typeof color !== 'string') return null;
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16) };
      }
      if (hex.length === 6) {
        return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
      }
    }
    const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (rgbMatch) return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
    return null;
  }

  #rgbToHSL(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  #bindInspectEvents(content, s) {
    if (!s) return;

    content.querySelectorAll('.penpot-rside__inspect-subtab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.#inspectSubTab = tab.dataset.inspectTab;
        this.render();
      });
    });

    content.querySelectorAll('.penpot-rside__inspect-collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const key = header.dataset.section;
        const collapsed = header.dataset.collapsed === 'true';
        if (collapsed) {
          this.#collapsedSections.delete(key);
        } else {
          this.#collapsedSections.add(key);
        }
        this.render();
      });
    });

    const fmtSelect = content.querySelector('#inspect-color-fmt');
    if (fmtSelect) {
      fmtSelect.addEventListener('change', () => {
        this.#inspectColorFormat = fmtSelect.value;
        this.render();
      });
    }

    content.querySelectorAll('.penpot-rside__copy-prop-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = btn.getAttribute('data-copy');
        if (val) {
          navigator.clipboard.writeText(val).catch(err => {
            console.warn('[inspect] Failed to copy property:', err?.message || err);
          });
        }
      });
    });

    const copyCssBtn = content.querySelector('#copy-css-btn');
    if (copyCssBtn) {
      copyCssBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(this.#generateCSS(s)).catch(err => {
          console.warn('[inspect] Failed to copy CSS:', err?.message || err);
        });
      });
    }
    const copySvgBtn = content.querySelector('#copy-svg-btn');
    if (copySvgBtn) {
      copySvgBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(this.#generateSVG(s)).catch(err => {
          console.warn('[inspect] Failed to copy SVG:', err?.message || err);
        });
      });
    }
    const copySvgMarkupBtn = content.querySelector('#copy-svg-markup-btn');
    if (copySvgMarkupBtn) {
      copySvgMarkupBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(this.#generateSVGMarkup(s)).catch(err => {
          console.warn('[inspect] Failed to copy SVG markup:', err?.message || err);
        });
      });
    }

    const addExportBtn = content.querySelector('#inspect-add-export');
    if (addExportBtn) {
      addExportBtn.addEventListener('click', () => {
        if (!s.exports) s.exports = [];
        s.exports.push({ format: 'png', scale: 1, suffix: '' });
        this.render();
        this.dispatchEvent(new CustomEvent('penpot-property-change', {
          detail: { shapeId: s.id, prop: 'exports', value: s.exports },
          bubbles: true, composed: true
        }));
      });
    }

    content.querySelectorAll('[data-export-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.exportRemove);
        if (s.exports) {
          s.exports.splice(idx, 1);
          this.render();
          this.dispatchEvent(new CustomEvent('penpot-property-change', {
            detail: { shapeId: s.id, prop: 'exports', value: s.exports },
            bubbles: true, composed: true
          }));
        }
      });
    });

    content.querySelectorAll('[data-export-fmt]').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.dataset.exportFmt);
        if (s.exports && s.exports[idx]) {
          s.exports[idx].format = sel.value;
          this.dispatchEvent(new CustomEvent('penpot-property-change', {
            detail: { shapeId: s.id, prop: 'exports', value: s.exports },
            bubbles: true, composed: true
          }));
        }
      });
    });

    content.querySelectorAll('[data-export-scale]').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.dataset.exportScale);
        if (s.exports && s.exports[idx]) {
          s.exports[idx].scale = parseInt(sel.value);
          this.dispatchEvent(new CustomEvent('penpot-property-change', {
            detail: { shapeId: s.id, prop: 'exports', value: s.exports },
            bubbles: true, composed: true
          }));
        }
      });
    });

    content.querySelectorAll('[data-export-suffix]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.dataset.exportSuffix);
        if (s.exports && s.exports[idx]) {
          s.exports[idx].suffix = input.value;
          this.dispatchEvent(new CustomEvent('penpot-property-change', {
            detail: { shapeId: s.id, prop: 'exports', value: s.exports },
            bubbles: true, composed: true
          }));
        }
      });
    });

    const exportBtn = content.querySelector('#inspect-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('penpot-export', {
          detail: { shapeId: s.id },
          bubbles: true, composed: true
        }));
      });
    }
  }

  #generateCSS(s) {
    const lines = [];
    lines.push('position: absolute;');
    lines.push(`left: ${Math.round(s.x || 0)}px;`);
    lines.push(`top: ${Math.round(s.y || 0)}px;`);
    lines.push(`width: ${Math.round(s.width || 0)}px;`);
    lines.push(`height: ${Math.round(s.height || 0)}px;`);
    if (s.rotation) lines.push(`transform: rotate(${Math.round((s.rotation || 0) * 180 / Math.PI)}deg);`);
    if (s.opacity != null && s.opacity < 1) lines.push(`opacity: ${s.opacity};`);
    if (s.blendMode && s.blendMode !== 'normal') lines.push(`mix-blend-mode: ${s.blendMode};`);

    const r1 = s.r1 ?? s.rx ?? 0;
    const r2 = s.r2 ?? s.rx ?? 0;
    const r3 = s.r3 ?? s.rx ?? 0;
    const r4 = s.r4 ?? s.rx ?? 0;
    if (r1 || r2 || r3 || r4) {
      if (r1 === r2 && r2 === r3 && r3 === r4) {
        lines.push(`border-radius: ${r1}px;`);
      } else {
        lines.push(`border-radius: ${r1}px ${r2}px ${r3}px ${r4}px;`);
      }
    }

    const fills = s.fills || [];
    if (fills.length > 0) {
      for (const fill of fills) {
        const fillType = fill.fillType || fill.type || 'solid';
        if (fillType === 'solid') {
          const color = fill.color || '#ccc';
          const formatted = this.#formatColorForInspect(color, fill.opacity, this.#inspectColorFormat);
          lines.push(`background-color: ${formatted};`);
        } else if (fillType === 'linear-gradient') {
          const stops = (fill.stops || []).map(st => {
            const c = this.#formatColorForInspect(st.color || '#ccc', st.opacity, this.#inspectColorFormat);
            return `${c} ${(st.offset * 100).toFixed(0)}%`;
          }).join(', ');
          lines.push(`background: linear-gradient(${fill.angle || 0}deg, ${stops});`);
        } else if (fillType === 'radial-gradient') {
          const stops = (fill.stops || []).map(st => {
            const c = this.#formatColorForInspect(st.color || '#ccc', st.opacity, this.#inspectColorFormat);
            return `${c} ${(st.offset * 100).toFixed(0)}%`;
          }).join(', ');
          lines.push(`background: radial-gradient(circle, ${stops});`);
        }
      }
    }

    const shadows = s.shadows || [];
    if (shadows.length > 0) {
      const shadowStrs = shadows.map(sh => {
        const inset = sh.style === 'inner-shadow' ? 'inset ' : '';
        const color = this.#formatColorForInspect(sh.color || '#000', 1, this.#inspectColorFormat);
        const spread = sh.spread || 0;
        return `${inset}${sh.offsetX || 0}px ${sh.offsetY || 0}px ${sh.blur || 0}px ${spread}px ${color}`;
      });
      lines.push(`box-shadow: ${shadowStrs.join(',\n           ')};`);
    }

    const strokes = s.strokes || [];
    if (strokes.length > 0) {
      for (const stroke of strokes) {
        const color = this.#formatColorForInspect(stroke.color || stroke.strokeColor || '#000', 1, this.#inspectColorFormat);
        const width = stroke.width || stroke.strokeWidth || 1;
        const style = stroke.style || stroke.strokeStyle || 'solid';
        const alignment = stroke.alignment || stroke.strokeAlignment || 'center';
        lines.push(`border: ${width}px ${style} ${color};`);
        if (alignment === 'inner') {
          lines.push(`box-sizing: border-box;`);
          lines.push(`/* stroke-alignment: inner */`);
        } else if (alignment === 'outer') {
          lines.push(`/* stroke-alignment: outer — add ${width}px to dimensions */`);
        }
      }
    }

    if (s.blur && s.blur.value) {
      lines.push(`filter: blur(${s.blur.value}px);`);
    }

    if (s.type === 'text') {
      if (s.fontFamily) lines.push(`font-family: ${s.fontFamily};`);
      if (s.fontSize) lines.push(`font-size: ${s.fontSize}px;`);
      if (s.fontWeight) lines.push(`font-weight: ${s.fontWeight};`);
      if (s.fontStyle && s.fontStyle !== 'normal') lines.push(`font-style: ${s.fontStyle};`);
      if (s.lineHeight) lines.push(`line-height: ${s.lineHeight};`);
      if (s.letterSpacing) lines.push(`letter-spacing: ${s.letterSpacing}px;`);
      if (s.textAlign) lines.push(`text-align: ${s.textAlign};`);
      if (s.textDecoration && s.textDecoration !== 'none') lines.push(`text-decoration: ${s.textDecoration};`);
      if (s.textTransform && s.textTransform !== 'none') lines.push(`text-transform: ${s.textTransform};`);
      if (s.fills && s.fills.length > 0 && (s.fills[0].fillType || s.fills[0].type) === 'solid') {
        const color = this.#formatColorForInspect(s.fills[0].color || '#000', s.fills[0].opacity, this.#inspectColorFormat);
        lines.push(`color: ${color};`);
      }
    }

    if (s.type === 'frame' || s.type === 'group') {
      if (s.shapes && s.shapes.length > 0) {
        lines.push(`/* contains ${s.shapes.length} child shape(s) */`);
      }
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
    if (s.rotation) attrs.push(`transform="rotate(${Math.round((s.rotation || 0) * 180 / Math.PI)} ${Math.round((s.x || 0) + (s.width || 0) / 2)} ${Math.round((s.y || 0) + (s.height || 0) / 2)})"`);
    if (s.opacity != null && s.opacity < 1) attrs.push(`opacity="${s.opacity}"`);

    const fills = s.fills || [];
    const strokes = s.strokes || [];
    let defs = '';
    let fillAttr = 'fill="none"';

    if (fills.length > 0) {
      const fill = fills[0];
      const fillType = fill.fillType || fill.type || 'solid';
      if (fillType === 'solid') {
        fillAttr = `fill="${fill.color || '#ccc'}"`;
      } else if (fillType === 'linear-gradient' && fill.stops && fill.stops.length > 0) {
        const gid = `grad-${s.id}`;
        const stops = fill.stops.map(st => `  <stop offset="${(st.offset * 100).toFixed(1)}%" stop-color="${st.color || '#ccc'}" />`).join('\n');
        defs = `<defs>\n  <linearGradient id="${gid}" gradientTransform="rotate(${fill.angle || 0})">\n${stops}\n  </linearGradient>\n</defs>\n`;
        fillAttr = `fill="url(#${gid})"`;
      } else if (fillType === 'radial-gradient' && fill.stops && fill.stops.length > 0) {
        const gid = `grad-${s.id}`;
        const stops = fill.stops.map(st => `  <stop offset="${(st.offset * 100).toFixed(1)}%" stop-color="${st.color || '#ccc'}" />`).join('\n');
        defs = `<defs>\n  <radialGradient id="${gid}">\n${stops}\n  </radialGradient>\n</defs>\n`;
        fillAttr = `fill="url(#${gid})"`;
      }
    }
    attrs.push(fillAttr);

    if (strokes.length > 0) {
      const stroke = strokes[0];
      attrs.push(`stroke="${stroke.color || stroke.strokeColor || '#000'}"`);
      attrs.push(`stroke-width="${stroke.width || stroke.strokeWidth || 1}"`);
      if (stroke.style === 'dashed' || stroke.strokeStyle === 'dashed') attrs.push('stroke-dasharray="8 4"');
      if (stroke.style === 'dotted' || stroke.strokeStyle === 'dotted') attrs.push('stroke-dasharray="2 4"');
    }

    const r1 = s.r1 ?? s.rx ?? 0;
    if (r1 && (s.type === 'rect' || s.type === 'frame')) attrs.push(`rx="${Math.round(r1)}"`);

    const tag = s.type === 'circle' || s.type === 'ellipse' ? 'ellipse' : s.type === 'text' ? 'text' : s.type === 'path' ? 'path' : s.type === 'image' ? 'image' : s.type === 'group' || s.type === 'frame' || s.type === 'bool' ? 'g' : 'rect';

    if (tag === 'ellipse') {
      attrs.push(`cx="${Math.round((s.x || 0) + (s.width || 0) / 2)}"`);
      attrs.push(`cy="${Math.round((s.y || 0) + (s.height || 0) / 2)}"`);
      attrs.push(`rx="${Math.round((s.width || 0) / 2)}"`);
      attrs.push(`ry="${Math.round((s.height || 0) / 2)}"`);
      const xIdx = attrs.findIndex(a => a.startsWith('x='));
      const yIdx = attrs.findIndex(a => a.startsWith('y='));
      if (xIdx >= 0) attrs.splice(xIdx, 1);
      if (yIdx >= 0) attrs.splice(yIdx > xIdx ? yIdx - 1 : yIdx, 1);
    }

    if (tag === 'text') {
      if (s.fontSize) attrs.push(`font-size="${s.fontSize}"`);
      if (s.fontFamily) attrs.push(`font-family="${s.fontFamily}"`);
      if (s.fontWeight) attrs.push(`font-weight="${s.fontWeight}"`);
      if (s.fontStyle && s.fontStyle !== 'normal') attrs.push(`font-style="${s.fontStyle}"`);
      attrs.push(`x="${Math.round(s.x || 0)}"`);
      attrs.push(`y="${Math.round((s.y || 0) + (s.fontSize || 14))}"`);
      let textContent = '';
      const content = s.content;
      if (content && typeof content === 'object' && content.type === 'root') {
        const paragraphs = [];
        function walk(node) {
          if (node.type === 'paragraph') {
            const t = (node.children || []).map(c => c.text || '').join('');
            paragraphs.push(t);
          } else if (node.text !== undefined) {
            paragraphs.push(node.text);
          }
          if (node.children) node.children.forEach(walk);
        }
        walk(content);
        textContent = paragraphs.join('\n');
      } else {
        textContent = content || '';
      }
      return `${defs}<${tag} ${attrs.join(' ')}>${this.escHtml(textContent)}</${tag}>`;
    }

    if (tag === 'path') {
      if (s.d || s.pathData) attrs.push(`d="${s.d || s.pathData}"`);
      return `${defs}<${tag} ${attrs.join(' ')} />`;
    }

    if (tag === 'image') {
      if (s.href || s.url || s.src) attrs.push(`href="${s.href || s.url || s.src}"`);
      return `${defs}<${tag} ${attrs.join(' ')} />`;
    }

    if (tag === 'g') {
      const children = s.shapes || s.children || [];
      if (children.length === 0) {
        return `${defs}<${tag} ${attrs.join(' ')} />`;
      }
      return `${defs}<${tag} ${attrs.join(' ')}>\n  <!-- ${children.length} child shape(s) -->\n</${tag}>`;
    }

    return `${defs}<${tag} ${attrs.join(' ')} />`;
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