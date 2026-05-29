'use strict';
import { isVariantContainer, getVariantProperties, buildVariantDisplayName, groupVariantFamilies, syncVariantProperties } from '../lib/components-lib.js';
import { propertiesToName, addNewProp, removePrefix, sameVariantQ, distance, variantNameToName, findBooleanPair, validPropertiesFormulaQ, PROPERTY_MAX_LENGTH, nextPropertyNumber } from '@penpot/shared/types/variant.js';
import { generateUpdatePropertyName, generateRemoveProperty, generateUpdatePropertyValue, generateAddNewProperty } from '@penpot/shared/logic/variant_properties.js';

const html = String.raw;

export class PenpotVariantPanel extends HTMLElement {
  #fileData = null;
  #selectedShape = null;
  #pages = null;
  #currentPageIndex = 0;

  static get observedAttributes() {
    return ['selected-shape'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set fileData(data) {
    this.#fileData = data;
    this.render();
  }

  set selectedShape(shape) {
    this.#selectedShape = shape;
    this.render();
  }

  set pages(pages) {
    this.#pages = pages;
  }

  set currentPageIndex(index) {
    this.#currentPageIndex = index;
  }

  #findShape(shapeId) {
    if (!this.#pages || this.#pages.length === 0) return null;
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return null;
    const objects = page.objects || page.children;
    if (!objects) return null;
    const shapes = Array.isArray(objects) ? objects : Object.values(objects);
    return shapes.find(s => s.id === shapeId) || null;
  }

  #findShapeRecursive(shapes, id) {
    if (!shapes) return null;
    for (const shape of shapes) {
      if (shape.id === id) return shape;
      const children = shape.children || [];
      const found = this.#findShapeRecursive(children, id);
      if (found) return found;
    }
    return null;
  }

  #findAllVariants(variantId) {
    if (!this.#fileData?.data?.components) return [];
    return Object.entries(this.#fileData.data.components)
      .filter(([, c]) => c['variant-id'] === variantId)
      .map(([id, c]) => ({ id, ...c }));
  }

  #getComponentForShape(shape) {
    if (!shape?.componentId || !this.#fileData?.data?.components) return null;
    return this.#fileData.data.components[shape.componentId] || null;
  }

  render() {
    const shape = this.#selectedShape;
    if (!shape) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    const component = this.#getComponentForShape(shape);
    const isMainInstance = shape['component-root'] || shape.componentRoot;
    const isVariantInstance = component && component['variant-id'];

    if (isMainInstance && shape['is-variant-container']) {
      this.#renderVariantContainer(shape, component);
    } else if (isVariantInstance) {
      this.#renderVariantInstance(shape, component);
    } else if (isMainInstance) {
      this.#renderComponentInstance(shape, component);
    } else {
      this.shadowRoot.innerHTML = '';
    }
  }

  #renderVariantContainer(shape, component) {
    const variantId = component?.['variant-id'] || shape['variant-id'] || shape.variantId;
    if (!variantId) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    const variants = this.#findAllVariants(variantId);
    const properties = getVariantProperties(component) || variantId ? this.#extractProperties(variants) : [];
    const displayName = buildVariantDisplayName(properties) || 'Variant';

    const propsRows = properties.map((prop, i) => this.#renderPropertyRow(prop, i, variants)).join('');

    const variantRows = variants.map(v => {
      const vProps = v['variant-properties'] || v.variantProperties || [];
      const vName = v['variant-name'] || v.variantName || propertiesToName(vProps) || v.name || 'Variant';
      const vShape = this.#findMainShapeForComponent(v.id);
      const isSelected = vShape && vShape.id === shape.id;
      return html`
        <div class="variant-row ${isSelected ? 'selected' : ''}" data-component-id="${this.escAttr(v.id)}">
          <span class="variant-name">${this.escHtml(vName)}</span>
          <span class="variant-label">${vShape ? this.escHtml(vShape.type || 'shape') : 'instance'}</span>
        </div>`;
    }).join('');

    const variantGridItems = variants.map(v => {
      const vProps = v['variant-properties'] || v.variantProperties || [];
      const vName = v['variant-name'] || v.variantName || propertiesToName(vProps) || v.name || 'Variant';
      return html`
        <div class="variant-grid-item" data-component-id="${this.escAttr(v.id)}" title="${this.escAttr(vName)}">
          <div class="variant-grid-thumb">${this.escHtml(v.icon || '\u25C6')}</div>
          <div class="variant-grid-label">${this.escHtml(vName)}</div>
        </div>`;
    }).join('');

    this.shadowRoot.innerHTML = html`
      <style>${this.#styles()}</style>
      <div class="variant-panel">
        <h4 class="panel-title">Variant Container</h4>
        <div class="section">
          <div class="section-header">
            <span>Properties</span>
            <button class="btn-icon" id="add-property-btn" title="Add property">+</button>
          </div>
          <div class="properties-list">${propsRows}</div>
        </div>
        <div class="section">
          <div class="section-header">
            <span>Variants (${variants.length})</span>
            <button class="btn-icon" id="add-variant-btn" title="Add variant">+</button>
          </div>
          <div class="variants-list">${variantRows}</div>
        </div>
        <div class="section">
          <div class="section-header"><span>State Grid</span></div>
          <div class="variant-grid">${variantGridItems}</div>
        </div>
      </div>`;

    this.#bindEvents(shape, component, variantId, properties, variants);

    this.shadowRoot.querySelectorAll('.variant-grid-item').forEach(item => {
      item.addEventListener('click', () => {
        const compId = item.dataset.componentId;
        if (compId) {
          this.emit('penpot-variant-select', { componentId: compId });
        }
      });
    });
  }

  #renderVariantInstance(shape, component) {
    const variantId = component['variant-id'];
    const variants = this.#findAllVariants(variantId);
    const vProps = component['variant-properties'] || component.variantProperties || [];
    const vName = component['variant-name'] || component.variantName || propertiesToName(vProps) || 'Variant';
    const containerShape = this.#findVariantContainer(variantId);

    const properties = this.#extractProperties(variants);
    const propValues = vProps.map(p => p.value || p.name || '');

    const switcherRows = properties.map((prop, i) => {
      const uniqueValues = [...new Set(variants.map(v => {
        const vp = v['variant-properties'] || v.variantProperties || [];
        return vp[i]?.value || '';
      }))].filter(Boolean);

      const currentValue = vProps[i]?.value || '';
      const options = uniqueValues.map(val =>
        html`<option value="${this.escAttr(val)}" ${val === currentValue ? 'selected' : ''}>${this.escHtml(val)}</option>`
      ).join('');

      return html`
        <div class="switcher-row">
          <label class="property-label">${this.escHtml(prop.name)}</label>
          <select class="property-switcher" data-prop-index="${i}" data-variant-id="${this.escAttr(variantId)}">
            ${options}
          </select>
        </div>`;
    }).join('');

    this.shadowRoot.innerHTML = html`
      <style>${this.#styles()}</style>
      <div class="variant-panel">
        <h4 class="panel-title">Variant: ${this.escHtml(vName)}</h4>
        ${containerShape ? html`<button class="btn-secondary" id="go-to-container-btn">Go to container</button>` : ''}
        <div class="switcher-section">
          ${switcherRows}
        </div>
        <div class="actions">
          <button class="btn-secondary" id="detach-variant-btn">Detach Instance</button>
        </div>
      </div>`;

    this.#bindSwitcherEvents(shape, component, variantId, variants, properties);
  }

  #renderComponentInstance(shape, component) {
    this.shadowRoot.innerHTML = html`
      <style>${this.#styles()}</style>
      <div class="variant-panel">
        <h4 class="panel-title">Component</h4>
        <button class="btn-primary" id="combine-as-variants-btn">Combine as Variants</button>
        <p class="hint">Select multiple component instances to combine them into a variant set.</p>
      </div>`;

    const btn = this.shadowRoot.getElementById('combine-as-variants-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.emit('penpot-combine-as-variants', {});
      });
    }
  }

  #renderPropertyRow(prop, index, variants) {
    const uniqueValues = [...new Set(variants.map(v => {
      const vp = v['variant-properties'] || v.variantProperties || [];
      return vp[index]?.value || '';
    }))].filter(Boolean);

    return html`
      <div class="property-row" data-prop-index="${index}">
        <input type="text" class="property-name-input" value="${this.escAttr(prop.name)}" data-prop-index="${index}" maxlength="${PROPERTY_MAX_LENGTH}" />
        <span class="property-values">${this.escHtml(uniqueValues.length > 3 ? uniqueValues.slice(0, 3).join(', ') + `...` : uniqueValues.join(', '))}</span>
        <button class="btn-icon btn-danger property-remove" data-prop-index="${index}" title="Remove property">×</button>
      </div>`;
  }

  #bindEvents(shape, component, variantId, properties, variants) {
    const addPropBtn = this.shadowRoot.getElementById('add-property-btn');
    if (addPropBtn) {
      addPropBtn.addEventListener('click', () => {
        this.emit('penpot-variant-add-property', { shapeId: shape.id, variantId });
      });
    }

    const addVariantBtn = this.shadowRoot.getElementById('add-variant-btn');
    if (addVariantBtn) {
      addVariantBtn.addEventListener('click', () => {
        this.emit('penpot-variant-add-variant', { shapeId: shape.id, variantId });
      });
    }

    this.shadowRoot.querySelectorAll('.property-name-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.propIndex, 10);
        this.emit('penpot-variant-update-property-name', {
          shapeId: shape.id,
          variantId,
          pos: idx,
          newName: e.target.value,
        });
      });
    });

    this.shadowRoot.querySelectorAll('.property-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.propIndex, 10);
        this.emit('penpot-variant-remove-property', {
          shapeId: shape.id,
          variantId,
          pos: idx,
        });
      });
    });

    this.shadowRoot.querySelectorAll('.variant-row').forEach(row => {
      row.addEventListener('click', () => {
        const compId = row.dataset.componentId;
        if (compId) {
          this.emit('penpot-variant-select', { componentId: compId });
        }
      });
    });
  }

  #bindSwitcherEvents(shape, component, variantId, variants, properties) {
    this.shadowRoot.querySelectorAll('.property-switcher').forEach(select => {
      select.addEventListener('change', (e) => {
        const propIndex = parseInt(e.target.dataset.propIndex, 10);
        const newValue = e.target.value;
        this.emit('penpot-variant-switch', {
          shapeId: shape.id,
          variantId,
          propIndex,
          newValue,
        });
      });
    });

    const goToContainerBtn = this.shadowRoot.getElementById('go-to-container-btn');
    if (goToContainerBtn) {
      goToContainerBtn.addEventListener('click', () => {
        const container = this.#findVariantContainer(variantId);
        if (container) {
          this.emit('penpot-select-shape', { shapeId: container.id });
        }
      });
    }

    const detachBtn = this.shadowRoot.getElementById('detach-variant-btn');
    if (detachBtn) {
      detachBtn.addEventListener('click', () => {
        this.emit('penpot-detach-instance', { shapeId: shape.id });
      });
    }
  }

  #extractProperties(variants) {
    if (!variants || variants.length === 0) return [];
    const firstProps = variants[0]?.['variant-properties'] || variants[0]?.variantProperties || [];
    return firstProps.map((p, i) => ({
      name: p.name || `Property ${i + 1}`,
      value: p.value || '',
    }));
  }

  #findMainShapeForComponent(componentId) {
    if (!this.#pages) return null;
    for (const page of this.#pages) {
      const objects = page?.objects || page?.children;
      if (!objects) continue;
      const shapes = Array.isArray(objects) ? objects : Object.values(objects);
      for (const s of shapes) {
        if (s.componentId === componentId) return s;
        if (s.children) {
          const found = this.#findShapeRecursive(s.children, s.id);
          if (found?.componentId === componentId) return found;
        }
      }
    }
    return null;
  }

  #findVariantContainer(variantId) {
    if (!this.#pages) return null;
    for (const page of this.#pages) {
      const objects = page?.objects || page?.children;
      if (!objects) continue;
      const shapes = Array.isArray(objects) ? objects : Object.values(objects);
      const found = this.#findShapeByVariantContainer(shapes, variantId);
      if (found) return found;
    }
    return null;
  }

  #findShapeByVariantContainer(shapes, variantId) {
    if (!shapes) return null;
    for (const s of shapes) {
      if (s['is-variant-container'] || s.isVariantContainer) {
        const comp = this.#fileData?.data?.components?.[s.componentId];
        if (comp && comp['variant-id'] === variantId) return s;
      }
      if (s.children) {
        const found = this.#findShapeByVariantContainer(s.children, variantId);
        if (found) return found;
      }
    }
    return null;
  }

  #styles() {
    return html`
      .variant-panel { padding: 8px; }
      .panel-title { font-size: 11px; font-weight: 600; color: var(--penpot-text, #333); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
      .section { margin-bottom: 12px; }
      .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
      .section-header span { font-size: 10px; color: var(--penpot-text-dim, #999); text-transform: uppercase; letter-spacing: 0.3px; }
      .btn-icon { background: none; border: 1px solid var(--penpot-border, #ddd); border-radius: 3px; width: 20px; height: 20px; font-size: 12px; cursor: pointer; color: var(--penpot-text, #333); display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }
      .btn-icon:hover { background: var(--penpot-bg-hover, #f0f0f0); }
      .btn-icon.btn-danger { color: var(--penpot-danger, #e74c3c); }
      .btn-icon.btn-danger:hover { background: var(--penpot-danger-light, #fee); }
      .property-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
      .property-name-input { flex: 1; min-width: 0; font-size: 11px; padding: 2px 4px; border: 1px solid var(--penpot-border, #ddd); border-radius: 3px; background: var(--penpot-bg, #fff); color: var(--penpot-text, #333); }
      .property-name-input:focus { outline: none; border-color: var(--penpot-primary, #7b6ff2); }
      .property-values { font-size: 9px; color: var(--penpot-text-dim, #999); max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .variant-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; border-radius: 3px; cursor: pointer; font-size: 11px; color: var(--penpot-text, #333); }
      .variant-row:hover { background: var(--penpot-bg-hover, #f0f0f0); }
      .variant-row.selected { background: var(--penpot-primary-light, #e8e5ff); }
      .variant-name { font-weight: 500; }
      .variant-label { font-size: 9px; color: var(--penpot-text-dim, #999); }
      .switcher-section { display: flex; flex-direction: column; gap: 6px; }
      .switcher-row { display: flex; align-items: center; gap: 6px; }
      .property-label { font-size: 10px; color: var(--penpot-text-dim, #999); min-width: 60px; }
      .property-switcher { flex: 1; font-size: 11px; padding: 2px 4px; border: 1px solid var(--penpot-border, #ddd); border-radius: 3px; background: var(--penpot-bg, #fff); color: var(--penpot-text, #333); }
      .property-switcher:focus { outline: none; border-color: var(--penpot-primary, #7b6ff2); }
      .btn-primary { background: var(--penpot-primary, #7b6ff2); color: #fff; border: none; border-radius: 4px; padding: 6px 12px; font-size: 11px; cursor: pointer; width: 100%; }
      .btn-primary:hover { opacity: 0.9; }
      .btn-secondary { background: var(--penpot-bg, #fff); color: var(--penpot-text, #333); border: 1px solid var(--penpot-border, #ddd); border-radius: 4px; padding: 4px 8px; font-size: 10px; cursor: pointer; }
      .btn-secondary:hover { background: var(--penpot-bg-hover, #f0f0f0); }
      .actions { margin-top: 8px; display: flex; gap: 4px; }
      .hint { font-size: 9px; color: var(--penpot-text-dim, #999); margin: 4px 0; }
      .variant-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 4px; }
      .variant-grid-item { background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: 3px; cursor: pointer; overflow: hidden; transition: border-color 0.15s; }
      .variant-grid-item:hover { border-color: var(--penpot-primary, #7b6ff2); }
      .variant-grid-thumb { width: 100%; aspect-ratio: 1; background: var(--penpot-surface, #2a2a2a); display: flex; align-items: center; justify-content: center; font-size: 16px; color: var(--penpot-text-dim, #999); }
      .variant-grid-label { font-size: 8px; color: var(--penpot-text-dim, #999); padding: 2px 4px 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
    `;
  }

  escAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
}

customElements.define('penpot-variant-panel', PenpotVariantPanel);