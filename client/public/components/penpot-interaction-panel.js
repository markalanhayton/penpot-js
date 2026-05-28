'use strict';
import { eventTypes, actionTypes, overlayPositioningTypes, easingTypes, directionTypes, wayTypes, animationTypes, defaultInteraction, makeInteraction, makeDissolveAnimation, makeSlideAnimation, makePushAnimation, setEventType, setActionType, setDestination, setOverlayPosType, setAnimation, removeAnimation, removeDestination, hasOverlayPositionQ, hasDestinationQ, hasUrlQ, hasDelayQ, isValidInteractionQ } from '../../lib/types/shape/interactions.js';

const CSS = `
penpot-interaction-panel { display: flex; flex-direction: column; gap: var(--penpot-spacing-s, 8px); padding: var(--penpot-spacing-s, 8px) 0; font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text, #e6e6e6); }

.interaction-panel__section { display: flex; flex-direction: column; gap: 4px; }

.interaction-panel__label { font-size: 10px; color: var(--penpot-text-dim, #999); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

.interaction-panel__row { display: flex; align-items: center; gap: 4px; }

.interaction-panel__row--wide { display: flex; align-items: center; gap: 6px; }

.interaction-panel__icon-btn { width: 22px; height: 22px; border: none; background: transparent; color: var(--penpot-text-dim, #999); cursor: pointer; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 14px; padding: 0; }
.interaction-panel__icon-btn:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }

.interaction-panel__remove-btn { width: 16px; height: 16px; border: none; background: transparent; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 12px; padding: 0; line-height: 1; border-radius: 2px; flex-shrink: 0; }
.interaction-panel__remove-btn:hover { background: var(--penpot-danger, #f44); color: #fff; }

.interaction-panel__select { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-xs, 2px); color: var(--penpot-text, #e6e6e6); font-size: var(--penpot-font-size-s, 11px); padding: 3px 6px; min-width: 0; }
.interaction-panel__select:focus { border-color: var(--penpot-primary, #31efb8); outline: none; }

.interaction-panel__input { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-xs, 2px); color: var(--penpot-text, #e6e6e6); font-size: var(--penpot-font-size-s, 11px); padding: 3px 6px; min-width: 0; }
.interaction-panel__input:focus { border-color: var(--penpot-primary, #31efb8); outline: none; }

.interaction-panel__checkbox-row { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--penpot-font-size-s, 11px); }
.interaction-panel__checkbox { width: 14px; height: 14px; accent-color: var(--penpot-primary, #31efb8); }

.interaction-panel__pill { display: inline-flex; align-items: center; gap: 4px; background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); color: var(--penpot-primary, #31efb8); border: 1px solid rgba(49,239,184,0.3); border-radius: 10px; padding: 2px 8px; font-size: 10px; font-weight: 500; white-space: nowrap; }

.interaction-panel__add-btn { display: flex; align-items: center; justify-content: center; gap: 4px; background: transparent; border: 1px dashed var(--penpot-border, #444); border-radius: var(--penpot-radius-xs, 2px); color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-s, 11px); padding: 6px 8px; cursor: pointer; width: 100%; }
.interaction-panel__add-btn:hover { border-color: var(--penpot-primary, #31efb8); color: var(--penpot-primary, #31efb8); background: rgba(49,239,184,0.05); }

.interaction-panel__empty { color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-s, 11px); text-align: center; padding: 12px 4px; }

.interaction-panel__overlay-pos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; width: fit-content; }
.interaction-panel__overlay-pos-btn { width: 24px; height: 20px; border: 1px solid var(--penpot-border, #444); background: var(--penpot-input-bg, #333); color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 8px; display: flex; align-items: center; justify-content: center; border-radius: 2px; padding: 0; }
.interaction-panel__overlay-pos-btn:hover { border-color: var(--penpot-primary, #31efb8); color: var(--penpot-text, #e6e6e6); }
.interaction-panel__overlay-pos-btn--active { background: rgba(49,239,184,0.2); border-color: var(--penpot-primary, #31efb8); color: var(--penpot-primary, #31efb8); }

.interaction-panel__animation-section { background: var(--penpot-input-bg, #333); border-radius: 4px; padding: 6px 8px; display: flex; flex-direction: column; gap: 4px; }
`;

const TEMPLATE = `
<style>${CSS}</style>
<div class="interaction-panel" id="container"></div>
`;

const EVENT_TYPE_LABELS = {
  'click': 'On Click',
  'mouse-press': 'On Mouse Press',
  'mouse-over': 'On Mouse Over',
  'mouse-enter': 'On Mouse Enter',
  'mouse-leave': 'On Mouse Leave',
  'after-delay': 'After Delay'
};

const ACTION_TYPE_LABELS = {
  'navigate': 'Navigate',
  'open-overlay': 'Open Overlay',
  'toggle-overlay': 'Toggle Overlay',
  'close-overlay': 'Close Overlay',
  'prev-screen': 'Previous Screen',
  'open-url': 'Open URL'
};

const OVERLAY_POS_ICONS = {
  'manual': 'M',
  'center': 'C',
  'top-left': '↖',
  'top-center': '↑',
  'top-right': '↗',
  'bottom-left': '↙',
  'bottom-center': '↓',
  'bottom-right': '↘'
};

const EASING_LABELS = { 'linear': 'Linear', 'ease': 'Ease', 'ease-in': 'Ease In', 'ease-out': 'Ease Out', 'ease-in-out': 'Ease In Out' };
const DIRECTION_LABELS = { 'right': 'Right', 'left': 'Left', 'up': 'Up', 'down': 'Down' };
const WAY_LABELS = { 'in': 'In', 'out': 'Out' };
const ANIMATION_TYPE_LABELS = { 'dissolve': 'Dissolve', 'slide': 'Slide', 'push': 'Push' };

export class PenpotInteractionPanel extends HTMLElement {
  #shadow;
  #selectedShape = null;
  #objects = {};
  #frames = [];

  static get observedAttributes() { return []; }

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.innerHTML = TEMPLATE;
    this.#bindEvents();
  }

  set selectedShape(shape) {
    this.#selectedShape = shape;
    this.render();
  }

  get selectedShape() { return this.#selectedShape; }

  set objects(obj) { this.#objects = obj || {}; this.render(); }
  get objects() { return this.#objects; }

  set frames(f) { this.#frames = f || []; }
  get frames() { return this.#frames; }

  #bindEvents() {
    this.#shadow.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const idx = target.dataset.idx != null ? parseInt(target.dataset.idx) : null;

      switch (action) {
        case 'add-interaction': this.#addInteraction(); break;
        case 'remove-interaction': this.#removeInteraction(idx); break;
        case 'expand-interaction': this.#toggleExpand(idx); break;
      }
    });

    this.#shadow.addEventListener('change', (e) => {
      const target = e.target;
      const idx = target.dataset.idx != null ? parseInt(target.dataset.idx) : null;
      if (idx == null) return;

      const prop = target.dataset.prop;
      const value = target.value;

      switch (prop) {
        case 'event-type': this.#updateInteraction(idx, setEventType(this.#getInteraction(idx), value, this.#selectedShape)); break;
        case 'action-type': this.#updateInteraction(idx, setActionType(this.#getInteraction(idx), value)); break;
        case 'destination': this.#updateInteraction(idx, setDestination(this.#getInteraction(idx), value || null)); break;
        case 'overlay-pos-type': this.#updateInteraction(idx, setOverlayPosType(this.#getInteraction(idx), value)); break;
        case 'close-click-outside': this.#updateInteraction(idx, this.#setBoolProp(idx, 'close-click-outside', target.checked)); break;
        case 'background-overlay': this.#updateInteraction(idx, this.#setBoolProp(idx, 'background-overlay', target.checked)); break;
        case 'preserve-scroll': this.#updateInteraction(idx, this.#setBoolProp(idx, 'preserve-scroll', target.checked)); break;
        case 'url': this.#updateInteraction(idx, this.#setStrProp(idx, 'url', value)); break;
        case 'delay': this.#updateInteraction(idx, this.#setNumProp(idx, 'delay', value)); break;
        case 'animation-type': this.#updateAnimation(idx, value); break;
        case 'animation-duration': this.#updateAnimField(idx, 'duration', value); break;
        case 'animation-easing': this.#updateAnimField(idx, 'easing', value); break;
        case 'animation-direction': this.#updateAnimField(idx, 'direction', value); break;
        case 'animation-way': this.#updateAnimField(idx, 'way', value); break;
        case 'animation-offset-effect': this.#updateAnimField(idx, 'offset-effect', target.checked); break;
      }
    });
  }

  #getInteraction(idx) {
    if (!this.#selectedShape || !this.#selectedShape.interactions) return null;
    return this.#selectedShape.interactions[idx];
  }

  #addInteraction() {
    if (!this.#selectedShape) return;
    const shape = this.#selectedShape;
    const interactions = [...(shape.interactions || []), makeInteraction()];
    this.#emitChange(shape.id, interactions);
  }

  #removeInteraction(idx) {
    if (!this.#selectedShape) return;
    const shape = this.#selectedShape;
    const interactions = (shape.interactions || []).filter((_, i) => i !== idx);
    this.#emitChange(shape.id, interactions);
  }

  #updateInteraction(idx, newInteraction) {
    if (!this.#selectedShape || !newInteraction) return;
    const shape = this.#selectedShape;
    const interactions = [...(shape.interactions || [])];
    interactions[idx] = newInteraction;
    this.#emitChange(shape.id, interactions);
  }

  #setBoolProp(idx, prop, value) {
    const interaction = this.#getInteraction(idx);
    if (!interaction) return interaction;
    return { ...interaction, [prop]: value };
  }

  #setStrProp(idx, prop, value) {
    const interaction = this.#getInteraction(idx);
    if (!interaction) return interaction;
    return { ...interaction, [prop]: value };
  }

  #setNumProp(idx, prop, value) {
    const interaction = this.#getInteraction(idx);
    if (!interaction) return interaction;
    return { ...interaction, [prop]: parseFloat(value) || 0 };
  }

  #updateAnimation(idx, type) {
    const interaction = this.#getInteraction(idx);
    if (!interaction) return;
    let animation;
    switch (type) {
      case 'dissolve': animation = makeDissolveAnimation(); break;
      case 'slide': animation = makeSlideAnimation(); break;
      case 'push': animation = makePushAnimation(); break;
      default: animation = null;
    }
    this.#updateInteraction(idx, animation ? setAnimation(interaction, animation) : removeAnimation(interaction));
  }

  #updateAnimField(idx, field, value) {
    const interaction = this.#getInteraction(idx);
    if (!interaction || !interaction.animation) return;
    const newAnim = { ...interaction.animation, [field]: field === 'duration' ? (parseFloat(value) || 0) : value };
    this.#updateInteraction(idx, setAnimation(interaction, newAnim));
  }

  #emitChange(shapeId, interactions) {
    this.dispatchEvent(new CustomEvent('penpot-interaction-change', {
      detail: { shapeId, interactions },
      bubbles: true,
      composed: true
    }));
  }

  #toggleExpand(idx) {
    const el = this.#shadow.querySelector(`[data-expand-idx="${idx}"]`);
    if (el) {
      el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    }
  }

  #getFrameName(frameId) {
    if (!frameId) return 'Select destination...';
    const frame = this.#objects[frameId];
    return frame ? (frame.name || frame.id) : 'Unknown frame';
  }

  render() {
    const container = this.#shadow.getElementById('container');
    if (!container) return;

    const shape = this.#selectedShape;
    if (!shape) {
      container.innerHTML = '<div class="interaction-panel__empty">Select a shape to add interactions</div>';
      return;
    }

    const interactions = shape.interactions || [];
    const isFrame = shape.type === 'frame';
    const html = [];

    if (isFrame) {
      html.push(`<div class="interaction-panel__section">`);
      html.push(`<div class="interaction-panel__label">Prototype Flows</div>`);
      const flows = this.#getPageFlows();
      const hasFlow = flows.some(f => f['starting-frame'] === shape.id);
      if (hasFlow) {
        const flow = flows.find(f => f['starting-frame'] === shape.id);
        html.push(`<div class="interaction-panel__row"><span class="interaction-panel__pill">▸ Flow: ${this.#escapeHtml(flow.name || 'Flow 1')}</span></div>`);
      } else {
        html.push(`<button class="interaction-panel__add-btn" data-action="set-as-start">Set as Start Screen</button>`);
      }
      html.push(`</div>`);
    }

    html.push(`<div class="interaction-panel__section">`);
    html.push(`<div class="interaction-panel__label">Interactions${interactions.length > 0 ? ' (' + interactions.length + ')' : ''}</div>`);

    interactions.forEach((interaction, idx) => {
      html.push(this.#renderInteractionItem(interaction, idx));
    });

    html.push(`<button class="interaction-panel__add-btn" data-action="add-interaction">+ Add Interaction</button>`);
    html.push(`</div>`);

    container.innerHTML = html.join('');

    container.querySelectorAll('[data-action="set-as-start"]').forEach(btn => {
      btn.addEventListener('click', () => this.#setAsStartScreen());
    });
  }

  #renderInteractionItem(interaction, idx) {
    const eventType = interaction['event-type'] || 'click';
    const actionType = interaction['action-type'] || 'navigate';
    const expanded = true;

    let html = `<div style="border:1px solid var(--penpot-border,#444);border-radius:4px;padding:6px 8px;margin-bottom:4px;">`;
    html += `<div class="interaction-panel__row" style="margin-bottom:4px;">`;
    html += `<span class="interaction-panel__pill">${EVENT_TYPE_LABELS[eventType] || eventType} → ${ACTION_TYPE_LABELS[actionType] || actionType}</span>`;
    html += `<button class="interaction-panel__icon-btn" data-action="expand-interaction" data-idx="${idx}" title="Expand/collapse">▾</button>`;
    html += `<span style="flex:1"></span>`;
    html += `<button class="interaction-panel__remove-btn" data-action="remove-interaction" data-idx="${idx}" title="Remove interaction">✕</button>`;
    html += `</div>`;

    html += `<div data-expand-idx="${idx}" style="display:flex;flex-direction:column;gap:4px;">`;
    html += this.#renderInteractionFields(interaction, idx);
    html += `</div>`;

    html += `</div>`;
    return html;
  }

  #renderInteractionFields(interaction, idx) {
    const eventType = interaction['event-type'] || 'click';
    const actionType = interaction['action-type'] || 'navigate';
    const html = [];

    html.push(`<div class="interaction-panel__row">`);
    html.push(`<span class="interaction-panel__label" style="min-width:50px;">Event</span>`);
    html.push(this.#renderSelect(idx, 'event-type', eventTypes, eventType, EVENT_TYPE_LABELS));
    html.push(`</div>`);

    if (hasDelayQ(interaction)) {
      html.push(`<div class="interaction-panel__row">`);
      html.push(`<span class="interaction-panel__label" style="min-width:50px;">Delay</span>`);
      html.push(`<input type="number" class="interaction-panel__input" data-idx="${idx}" data-prop="delay" value="${interaction.delay || 600}" min="0" step="100" style="width:60px;">ms`);
      html.push(`</div>`);
    }

    html.push(`<div class="interaction-panel__row">`);
    html.push(`<span class="interaction-panel__label" style="min-width:50px;">Action</span>`);
    html.push(this.#renderSelect(idx, 'action-type', actionTypes, actionType, ACTION_TYPE_LABELS));
    html.push(`</div>`);

    if (hasDestinationQ(interaction)) {
      html.push(`<div class="interaction-panel__row">`);
      html.push(`<span class="interaction-panel__label" style="min-width:50px;">Target</span>`);
      html.push(`<select class="interaction-panel__select" data-idx="${idx}" data-prop="destination">`);
      html.push(`<option value="">Select frame...</option>`);
      for (const frame of this.#frames) {
        const selected = interaction.destination === frame.id ? ' selected' : '';
        html.push(`<option value="${frame.id}"${selected}>${this.#escapeHtml(frame.name || frame.id)}</option>`);
      }
      html.push(`</select>`);
      html.push(`</div>`);
    }

    if (hasOverlayPositionQ(interaction)) {
      html.push(`<div class="interaction-panel__label">Overlay Position</div>`);
      html.push(`<div class="interaction-panel__overlay-pos-grid">`);
      for (const posType of overlayPositioningTypes) {
        const active = (interaction['overlay-pos-type'] || 'center') === posType ? ' interaction-panel__overlay-pos-btn--active' : '';
        html.push(`<button class="interaction-panel__overlay-pos-btn${active}" data-idx="${idx}" data-prop="overlay-pos-type" value="${posType}">${OVERLAY_POS_ICONS[posType]}</button>`);
      }
      html.push(`</div>`);

      if (interaction['overlay-pos-type'] === 'manual' && interaction['position-relative-to']) {
        const refFrame = this.#objects[interaction['position-relative-to']];
        html.push(`<div class="interaction-panel__row"><span style="font-size:10px;color:var(--penpot-text-dim,#999);">Relative to: ${this.#escapeHtml(refFrame ? refFrame.name : 'frame')}</span></div>`);
      }

      html.push(`<label class="interaction-panel__checkbox-row"><input type="checkbox" class="interaction-panel__checkbox" data-idx="${idx}" data-prop="close-click-outside" ${interaction['close-click-outside'] ? 'checked' : ''}>Close on click outside</label>`);
      html.push(`<label class="interaction-panel__checkbox-row"><input type="checkbox" class="interaction-panel__checkbox" data-idx="${idx}" data-prop="background-overlay" ${interaction['background-overlay'] ? 'checked' : ''}>Background overlay</label>`);
    }

    if (hasUrlQ(interaction)) {
      html.push(`<div class="interaction-panel__row">`);
      html.push(`<span class="interaction-panel__label" style="min-width:50px;">URL</span>`);
      html.push(`<input type="url" class="interaction-panel__input" data-idx="${idx}" data-prop="url" value="${this.#escapeHtml(interaction.url || '')}" placeholder="https://...">`);
      html.push(`</div>`);
    }

    if (hasDestinationQ(interaction) || hasOverlayPositionQ(interaction)) {
      const animType = interaction.animation?.['animation-type'] || 'none';
      html.push(`<div class="interaction-panel__animation-section">`);
      html.push(`<div class="interaction-panel__row">`);
      html.push(`<span class="interaction-panel__label" style="min-width:60px;">Animation</span>`);
      html.push(`<select class="interaction-panel__select" data-idx="${idx}" data-prop="animation-type">`);
      html.push(`<option value="none"${animType === 'none' ? ' selected' : ''}>None</option>`);
      for (const t of animationTypes) {
        html.push(`<option value="${t}"${animType === t ? ' selected' : ''}>${ANIMATION_TYPE_LABELS[t]}</option>`);
      }
      html.push(`</select>`);
      html.push(`</div>`);

      if (interaction.animation) {
        const anim = interaction.animation;
        html.push(`<div class="interaction-panel__row">`);
        html.push(`<span class="interaction-panel__label" style="min-width:60px;">Duration</span>`);
        html.push(`<input type="number" class="interaction-panel__input" data-idx="${idx}" data-prop="animation-duration" value="${anim.duration || 300}" min="0" step="50" style="width:60px;">ms`);
        html.push(`</div>`);

        html.push(`<div class="interaction-panel__row">`);
        html.push(`<span class="interaction-panel__label" style="min-width:60px;">Easing</span>`);
        html.push(this.#renderSelect(idx, 'animation-easing', easingTypes, anim.easing || 'ease', EASING_LABELS));
        html.push(`</div>`);

        if (anim['animation-type'] === 'slide' || anim['animation-type'] === 'push') {
          html.push(`<div class="interaction-panel__row">`);
          html.push(`<span class="interaction-panel__label" style="min-width:60px;">Direction</span>`);
          html.push(this.#renderSelect(idx, 'animation-direction', directionTypes, anim.direction || 'right', DIRECTION_LABELS));
          html.push(`</div>`);

          if (anim['animation-type'] === 'slide') {
            html.push(`<div class="interaction-panel__row">`);
            html.push(`<span class="interaction-panel__label" style="min-width:60px;">Way</span>`);
            html.push(this.#renderSelect(idx, 'animation-way', wayTypes, anim.way || 'in', WAY_LABELS));
            html.push(`</div>`);
          }
        }
      }
      html.push(`</div>`);
    }

    return html.join('');
  }

  #renderSelect(idx, prop, values, currentValue, labels) {
    let html = `<select class="interaction-panel__select" data-idx="${idx}" data-prop="${prop}">`;
    for (const v of values) {
      const selected = v === currentValue ? ' selected' : '';
      html += `<option value="${v}"${selected}>${labels[v] || v}</option>`;
    }
    html += `</select>`;
    return html;
  }

  #escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  #getPageFlows() {
    const workspace = document.querySelector('penpot-workspace');
    if (!workspace) return [];
    const store = workspace.store;
    if (!store) return [];
    const state = store.getState();
    const currentPageId = state?.currentPageId;
    if (!currentPageId) return [];
    const page = state?.pages?.find(p => p.id === currentPageId);
    if (!page) return [];
    return page.flows ? Object.values(page.flows) : [];
  }

  #setAsStartScreen() {
    if (!this.#selectedShape || this.#selectedShape.type !== 'frame') return;
    const workspace = document.querySelector('penpot-workspace');
    if (!workspace) return;
    workspace.emit('penpot-add-flow', {
      frameId: this.#selectedShape.id,
      name: 'Flow 1'
    });
  }
}

customElements.define('penpot-interaction-panel', PenpotInteractionPanel);