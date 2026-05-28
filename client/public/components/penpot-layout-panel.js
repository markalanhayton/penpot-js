'use strict';
import { PenpotElement } from './base.js';

const LAYOUT_STYLES = `
  .penpot-layout__section { padding: 8px 12px; border-bottom: 1px solid var(--penpot-border, #444); }
  .penpot-layout__section h4 { font-size: 10px; color: var(--penpot-text-dim, #999); text-transform: uppercase; margin: 0 0 6px; font-weight: 500; letter-spacing: 0.5px; }
  .penpot-layout__row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; font-size: 11px; }
  .penpot-layout__label { width: 24px; color: var(--penpot-text-dim, #999); font-size: 10px; text-align: right; flex-shrink: 0; }
  .penpot-layout__input { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: 4px; color: var(--penpot-text, #e6e6e6); padding: 2px 6px; font-size: 11px; outline: none; min-width: 0; }
  .penpot-layout__input:focus { border-color: var(--penpot-primary, #31efb8); }
  .penpot-layout__select { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: 4px; color: var(--penpot-text, #e6e6e6); padding: 2px 4px; font-size: 11px; outline: none; cursor: pointer; }
  .penpot-layout__select:focus { border-color: var(--penpot-primary, #31efb8); }
  .penpot-layout__toggle-row { display: flex; gap: 2px; margin-bottom: 4px; }
  .penpot-layout__toggle-btn { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); font-size: 10px; padding: 3px 6px; border-radius: 4px; cursor: pointer; flex: 1; text-align: center; }
  .penpot-layout__toggle-btn:hover { background: var(--penpot-surface-highest, #3c3c3c); }
  .penpot-layout__toggle-btn.active { background: rgba(49,239,184,0.2); color: var(--penpot-primary, #31efb8); border-color: var(--penpot-primary, #31efb8); }
  .penpot-layout__icon-btn { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); padding: 2px 4px; border-radius: 4px; cursor: pointer; font-size: 11px; line-height: 1; }
  .penpot-layout__icon-btn:hover { background: var(--penpot-surface-highest, #3c3c3c); color: var(--penpot-text, #e6e6e6); }
  .penpot-layout__icon-btn.active { background: rgba(49,239,184,0.2); color: var(--penpot-primary, #31efb8); border-color: var(--penpot-primary, #31efb8); }
  .penpot-layout__toggle { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .penpot-layout__toggle label { font-size: 11px; color: var(--penpot-text-dim, #999); cursor: pointer; }
  .penpot-layout__sub-row { display: flex; gap: 4px; margin-bottom: 4px; }
`;

const template = document.createElement('template');
template.innerHTML = `<style>${LAYOUT_STYLES}</style><div id="layout-content"><div class="penpot-layout__section"><div class="penpot-rside__empty-state">Select a frame to edit layout.</div></div></div>`;

export class PenpotLayoutPanel extends PenpotElement {
  _template = template;
  #selectedShape = null;
  #selectedIds = [];
  #toolManager = null;

  set toolManager(val) { this.#toolManager = val; }

  set selectedShape(shape) {
    this.#selectedShape = shape;
    this.render();
  }

  set selectedIds(ids) {
    this.#selectedIds = ids ? [...ids] : [];
    this.render();
  }

  render() {
    const content = this.querySelector('#layout-content');
    if (!content) return;

    const shape = this.#selectedShape;

    if (!shape || (shape.type !== 'frame')) {
      content.innerHTML = `<div class="penpot-layout__section"><div class="penpot-rside__empty-state">Select a frame to edit layout.</div></div>`;
      return;
    }

    const layout = shape.layout || 'none';
    const isFlex = layout === 'flex';
    const isGrid = layout === 'grid';
    const dir = shape['layout-flex-dir'] || 'row';
    const gapType = shape['layout-gap-type'] || 'simple';
    const rowGap = shape['layout-gap']?.['row-gap'] ?? shape['layout-gap'] ?? 0;
    const colGap = shape['layout-gap']?.['column-gap'] ?? shape['layout-gap'] ?? 0;
    const wrap = shape['layout-wrap-type'] || 'nowrap';
    const padType = shape['layout-padding-type'] || 'simple';
    const pad = shape['layout-padding'] || { p1: 0, p2: 0, p3: 0, p4: 0 };
    const justify = shape['layout-justify-content'] || 'start';
    const align = shape['layout-align-items'] || 'stretch';
    const alignContent = shape['layout-align-content'] || 'stretch';
    const gridDir = shape['layout-grid-dir'] || 'row';
    const gridRows = shape['layout-grid-rows'] || [];
    const gridCols = shape['layout-grid-columns'] || [];

    content.innerHTML = `
      <div class="penpot-layout__section">
        <h4>Layout</h4>
        <div class="penpot-layout__toggle-row">
          <button class="penpot-layout__toggle-btn ${layout === 'none' ? 'active' : ''}" data-layout="none">None</button>
          <button class="penpot-layout__toggle-btn ${isFlex ? 'active' : ''}" data-layout="flex">Flex</button>
          <button class="penpot-layout__toggle-btn ${isGrid ? 'active' : ''}" data-layout="grid">Grid</button>
        </div>
      </div>

      ${isFlex ? `
      <div class="penpot-layout__section">
        <h4>Direction</h4>
        <div class="penpot-layout__toggle-row">
          <button class="penpot-layout__icon-btn ${dir === 'row' ? 'active' : ''}" data-dir="row" title="Row">\u2192</button>
          <button class="penpot-layout__icon-btn ${dir === 'row-reverse' ? 'active' : ''}" data-dir="row-reverse" title="Row Reverse">\u2190</button>
          <button class="penpot-layout__icon-btn ${dir === 'column' ? 'active' : ''}" data-dir="column" title="Column">\u2193</button>
          <button class="penpot-layout__icon-btn ${dir === 'column-reverse' ? 'active' : ''}" data-dir="column-reverse" title="Column Reverse">\u2191</button>
        </div>
      </div>

      <div class="penpot-layout__section">
        <h4>Gap</h4>
        <div class="penpot-layout__row">
          <span class="penpot-layout__label">R</span>
          <input type="number" class="penpot-layout__input" id="layout-row-gap" value="${rowGap}" min="0" step="1" data-prop="layout-gap-row">
          <span class="penpot-layout__label">C</span>
          <input type="number" class="penpot-layout__input" id="layout-col-gap" value="${colGap}" min="0" step="1" data-prop="layout-gap-col">
        </div>
      </div>

      <div class="penpot-layout__section">
        <h4>Wrap</h4>
        <div class="penpot-layout__toggle-row">
          <button class="penpot-layout__toggle-btn ${wrap === 'nowrap' ? 'active' : ''}" data-wrap="nowrap">No Wrap</button>
          <button class="penpot-layout__toggle-btn ${wrap === 'wrap' ? 'active' : ''}" data-wrap="wrap">Wrap</button>
        </div>
      </div>

      <div class="penpot-layout__section">
        <h4>Padding</h4>
        <div class="penpot-layout__row">
          <span class="penpot-layout__label">T</span>
          <input type="number" class="penpot-layout__input" id="layout-pt" value="${pad.p1 || 0}" min="0" step="1" data-prop="layout-pt">
          <span class="penpot-layout__label">R</span>
          <input type="number" class="penpot-layout__input" id="layout-pr" value="${pad.p2 || 0}" min="0" step="1" data-prop="layout-pr">
        </div>
        <div class="penpot-layout__row">
          <span class="penpot-layout__label">B</span>
          <input type="number" class="penpot-layout__input" id="layout-pb" value="${pad.p3 || 0}" min="0" step="1" data-prop="layout-pb">
          <span class="penpot-layout__label">L</span>
          <input type="number" class="penpot-layout__input" id="layout-pl" value="${pad.p4 || 0}" min="0" step="1" data-prop="layout-pl">
        </div>
      </div>

      <div class="penpot-layout__section">
        <h4>Justify Content</h4>
        <div class="penpot-layout__toggle-row">
          <button class="penpot-layout__icon-btn ${justify === 'start' ? 'active' : ''}" data-justify="start" title="Start">\u2190+</button>
          <button class="penpot-layout__icon-btn ${justify === 'center' ? 'active' : ''}" data-justify="center" title="Center">\u2194</button>
          <button class="penpot-layout__icon-btn ${justify === 'end' ? 'active' : ''}" data-justify="end" title="End">+\u2192</button>
          <button class="penpot-layout__icon-btn ${justify === 'space-between' ? 'active' : ''}" data-justify="space-between" title="Space Between">\u2194\u2194</button>
          <button class="penpot-layout__icon-btn ${justify === 'space-around' ? 'active' : ''}" data-justify="space-around" title="Space Around">\u2234</button>
          <button class="penpot-layout__icon-btn ${justify === 'space-evenly' ? 'active' : ''}" data-justify="space-evenly" title="Space Evenly">\u2235</button>
        </div>
      </div>

      <div class="penpot-layout__section">
        <h4>Align Items</h4>
        <div class="penpot-layout__toggle-row">
          <button class="penpot-layout__icon-btn ${align === 'start' ? 'active' : ''}" data-align="start" title="Start">\u2191+</button>
          <button class="penpot-layout__icon-btn ${align === 'center' ? 'active' : ''}" data-align="center" title="Center">\u2195</button>
          <button class="penpot-layout__icon-btn ${align === 'end' ? 'active' : ''}" data-align="end" title="End">+\u2193</button>
          <button class="penpot-layout__icon-btn ${align === 'stretch' ? 'active' : ''}" data-align="stretch" title="Stretch">\u2922</button>
        </div>
      </div>

      <div class="penpot-layout__section">
        <h4>Align Content</h4>
        <div class="penpot-layout__toggle-row">
          <button class="penpot-layout__icon-btn ${alignContent === 'start' ? 'active' : ''}" data-align-content="start" title="Start">\u2191</button>
          <button class="penpot-layout__icon-btn ${alignContent === 'center' ? 'active' : ''}" data-align-content="center" title="Center">\u2261</button>
          <button class="penpot-layout__icon-btn ${alignContent === 'end' ? 'active' : ''}" data-align-content="end" title="End">\u2193</button>
          <button class="penpot-layout__icon-btn ${alignContent === 'stretch' ? 'active' : ''}" data-align-content="stretch" title="Stretch">\u2928</button>
          <button class="penpot-layout__icon-btn ${alignContent === 'space-between' ? 'active' : ''}" data-align-content="space-between" title="Space Between">\u2922\u2195\u2922</button>
          <button class="penpot-layout__icon-btn ${alignContent === 'space-around' ? 'active' : ''}" data-align-content="space-around" title="Space Around">\u2922\u2234\u2922</button>
        </div>
      </div>
      ` : ''}

      ${isGrid ? `
      <div class="penpot-layout__section">
        <h4>Grid Direction</h4>
        <div class="penpot-layout__toggle-row">
          <button class="penpot-layout__toggle-btn ${gridDir === 'row' ? 'active' : ''}" data-grid-dir="row">Row</button>
          <button class="penpot-layout__toggle-btn ${gridDir === 'column' ? 'active' : ''}" data-grid-dir="column">Column</button>
        </div>
      </div>

      <div class="penpot-layout__section">
        <h4>Gap</h4>
        <div class="penpot-layout__row">
          <span class="penpot-layout__label">R</span>
          <input type="number" class="penpot-layout__input" id="layout-row-gap" value="${rowGap}" min="0" step="1" data-prop="layout-gap-row">
          <span class="penpot-layout__label">C</span>
          <input type="number" class="penpot-layout__input" id="layout-col-gap" value="${colGap}" min="0" step="1" data-prop="layout-gap-col">
        </div>
      </div>

      <div class="penpot-layout__section">
        <h4>Padding</h4>
        <div class="penpot-layout__row">
          <span class="penpot-layout__label">T</span>
          <input type="number" class="penpot-layout__input" id="layout-pt" value="${pad.p1 || 0}" min="0" step="1" data-prop="layout-pt">
          <span class="penpot-layout__label">R</span>
          <input type="number" class="penpot-layout__input" id="layout-pr" value="${pad.p2 || 0}" min="0" step="1" data-prop="layout-pr">
        </div>
        <div class="penpot-layout__row">
          <span class="penpot-layout__label">B</span>
          <input type="number" class="penpot-layout__input" id="layout-pb" value="${pad.p3 || 0}" min="0" step="1" data-prop="layout-pb">
          <span class="penpot-layout__label">L</span>
          <input type="number" class="penpot-layout__input" id="layout-pl" value="${pad.p4 || 0}" min="0" step="1" data-prop="layout-pl">
        </div>
      </div>

      <div class="penpot-layout__section">
        <h4>Columns (${gridCols.length})</h4>
        <div id="grid-cols-list">
          ${gridCols.map((col, i) => `<div class="penpot-layout__row">
            <span class="penpot-layout__label">C${i+1}</span>
            <select class="penpot-layout__select" data-grid-col-type="${i}">
              <option value="auto" ${col.type === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="fixed" ${col.type === 'fixed' ? 'selected' : ''}>Fixed</option>
              <option value="percent" ${col.type === 'percent' ? 'selected' : ''}>Percent</option>
              <option value="flex" ${col.type === 'flex' ? 'selected' : ''}>1fr</option>
            </select>
            <input type="number" class="penpot-layout__input" value="${col.value || 0}" min="0" step="1" data-grid-col-value="${i}" ${col.type === 'flex' || col.type === 'auto' ? 'disabled' : ''}>
            <button class="penpot-layout__icon-btn" data-grid-col-remove="${i}" title="Remove">\u2715</button>
          </div>`).join('')}
        </div>
        <button class="penpot-layout__toggle-btn" id="add-grid-col" style="width:100%;margin-top:4px;">+ Column</button>
      </div>

      <div class="penpot-layout__section">
        <h4>Rows (${gridRows.length})</h4>
        <div id="grid-rows-list">
          ${gridRows.map((row, i) => `<div class="penpot-layout__row">
            <span class="penpot-layout__label">R${i+1}</span>
            <select class="penpot-layout__select" data-grid-row-type="${i}">
              <option value="auto" ${row.type === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="fixed" ${row.type === 'fixed' ? 'selected' : ''}>Fixed</option>
              <option value="percent" ${row.type === 'percent' ? 'selected' : ''}>Percent</option>
              <option value="flex" ${row.type === 'flex' ? 'selected' : ''}>1fr</option>
            </select>
            <input type="number" class="penpot-layout__input" value="${row.value || 0}" min="0" step="1" data-grid-row-value="${i}" ${row.type === 'flex' || row.type === 'auto' ? 'disabled' : ''}>
            <button class="penpot-layout__icon-btn" data-grid-row-remove="${i}" title="Remove">\u2715</button>
          </div>`).join('')}
        </div>
        <button class="penpot-layout__toggle-btn" id="add-grid-row" style="width:100%;margin-top:4px;">+ Row</button>
      </div>
      ` : ''}

      <div class="penpot-layout__section">
        <h4>Child Layout Item</h4>
        <div class="penpot-layout__empty-state" id="child-layout-hint">Select a child inside this frame to edit its layout item properties.</div>
      </div>
    `;

    this.#bindEvents(content, shape);
  }

  #bindEvents(content, shape) {
    content.querySelectorAll('[data-layout]').forEach(btn => {
      btn.addEventListener('click', () => {
        const layout = btn.dataset.layout;
        this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout', value: layout });
      });
    });

    content.querySelectorAll('[data-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-flex-dir', value: btn.dataset.dir });
      });
    });

    content.querySelectorAll('[data-wrap]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-wrap-type', value: btn.dataset.wrap });
      });
    });

    content.querySelectorAll('[data-justify]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-justify-content', value: btn.dataset.justify });
      });
    });

    content.querySelectorAll('[data-align]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-align-items', value: btn.dataset.align });
      });
    });

    content.querySelectorAll('[data-align-content]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-align-content', value: btn.dataset.alignContent });
      });
    });

    content.querySelectorAll('[data-grid-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-grid-dir', value: btn.dataset.gridDir });
      });
    });

    content.querySelectorAll('input[data-prop]').forEach(input => {
      input.addEventListener('change', () => {
        const prop = input.dataset.prop;
        const value = parseFloat(input.value) || 0;
        if (prop === 'layout-gap-row' || prop === 'layout-gap-col') {
          const currentGap = shape['layout-gap'] || {};
          const gapType = shape['layout-gap-type'] || 'simple';
          if (prop === 'layout-gap-row') {
            if (gapType === 'simple') {
              this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-gap', value: { 'row-gap': value, 'column-gap': value } });
            } else {
              this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-gap', value: { ...currentGap, 'row-gap': value } });
            }
          } else {
            if (gapType === 'simple') {
              this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-gap', value: { 'row-gap': value, 'column-gap': value } });
            } else {
              this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-gap', value: { ...currentGap, 'column-gap': value } });
            }
          }
        } else if (prop === 'layout-pt' || prop === 'layout-pr' || prop === 'layout-pb' || prop === 'layout-pl') {
          const pad = { ...shape['layout-padding'] } || { p1: 0, p2: 0, p3: 0, p4: 0 };
          if (prop === 'layout-pt') pad.p1 = value;
          if (prop === 'layout-pr') pad.p2 = value;
          if (prop === 'layout-pb') pad.p3 = value;
          if (prop === 'layout-pl') pad.p4 = value;
          this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-padding', value: pad });
        }
      });
    });

    content.querySelectorAll('[data-grid-col-type]').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.dataset.gridColType);
        const cols = [...(shape['layout-grid-columns'] || [])];
        if (cols[idx]) {
          cols[idx] = { ...cols[idx], type: sel.value };
          this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-grid-columns', value: cols });
        }
      });
    });

    content.querySelectorAll('[data-grid-col-value]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.dataset.gridColValue);
        const cols = [...(shape['layout-grid-columns'] || [])];
        if (cols[idx]) {
          cols[idx] = { ...cols[idx], value: parseFloat(input.value) || 0 };
          this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-grid-columns', value: cols });
        }
      });
    });

    content.querySelectorAll('[data-grid-col-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.gridColRemove);
        const cols = [...(shape['layout-grid-columns'] || [])];
        cols.splice(idx, 1);
        this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-grid-columns', value: cols });
      });
    });

    content.querySelectorAll('[data-grid-row-type]').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.dataset.gridRowType);
        const rows = [...(shape['layout-grid-rows'] || [])];
        if (rows[idx]) {
          rows[idx] = { ...rows[idx], type: sel.value };
          this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-grid-rows', value: rows });
        }
      });
    });

    content.querySelectorAll('[data-grid-row-value]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.dataset.gridRowValue);
        const rows = [...(shape['layout-grid-rows'] || [])];
        if (rows[idx]) {
          rows[idx] = { ...rows[idx], value: parseFloat(input.value) || 0 };
          this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-grid-rows', value: rows });
        }
      });
    });

    content.querySelectorAll('[data-grid-row-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.gridRowRemove);
        const rows = [...(shape['layout-grid-rows'] || [])];
        rows.splice(idx, 1);
        this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-grid-rows', value: rows });
      });
    });

    const addColBtn = content.querySelector('#add-grid-col');
    if (addColBtn) {
      addColBtn.addEventListener('click', () => {
        const cols = [...(shape['layout-grid-columns'] || [])];
        cols.push({ type: 'flex', value: 1 });
        this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-grid-columns', value: cols });
      });
    }

    const addRowBtn = content.querySelector('#add-grid-row');
    if (addRowBtn) {
      addRowBtn.addEventListener('click', () => {
        const rows = [...(shape['layout-grid-rows'] || [])];
        rows.push({ type: 'flex', value: 1 });
        this.emit('penpot-layout-change', { shapeId: shape.id, prop: 'layout-grid-rows', value: rows });
      });
    }
  }
}

customElements.define('penpot-layout-panel', PenpotLayoutPanel);