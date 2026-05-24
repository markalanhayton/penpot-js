import { PenpotElement } from './base.js';

let tooltipCounter = 0;

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-tooltip { position: relative; display: inline-flex; }
    .penpot-tip__tooltip-trigger { display: inline-flex; }
    .penpot-tip__tooltip-overlay { position: fixed; z-index: var(--penpot-z-tooltip, 110); pointer-events: none; opacity: 0; transition: opacity var(--penpot-transition-fast, 0.1s ease); }
    .penpot-tip__tooltip-overlay.penpot-tip__visible { opacity: 1; }
    .penpot-tip__tooltip-content { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); font-size: var(--penpot-font-size-s, 11px); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); border-radius: var(--penpot-radius-s, 4px); box-shadow: var(--penpot-shadow-m, 0 4px 12px rgba(0,0,0,0.4)); white-space: nowrap; max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
    .penpot-tip__tooltip-arrow { position: absolute; width: 0; height: 0; border: 4px solid transparent; }
    .penpot-tip__tooltip-arrow.penpot-tip__bottom { top: -8px; border-bottom-color: var(--penpot-surface-high, #333); }
    .penpot-tip__tooltip-arrow.penpot-tip__top { bottom: -8px; border-top-color: var(--penpot-surface-high, #333); }
    .penpot-tip__tooltip-arrow.penpot-tip__left { right: -8px; border-left-color: var(--penpot-surface-high, #333); }
    .penpot-tip__tooltip-arrow.penpot-tip__right { left: -8px; border-right-color: var(--penpot-surface-high, #333); }
  
  </style>
  <div class="penpot-tip__tooltip-trigger" id="trigger"><slot></slot></div>
  <div class="penpot-tip__tooltip-overlay" id="overlay">
    <div class="penpot-tip__tooltip-content" id="content"></div>
    <div class="penpot-tip__tooltip-arrow penpot-tip__bottom" id="arrow"></div>
  </div>`;

export class PenpotTooltip extends PenpotElement {
  _template = template;
  static get observedAttributes() { return ['text', 'position']; }

  constructor() {
    super();
    this.#id = `tooltip-${++tooltipCounter}`;
  }

  #id;
  #visible = false;

  connectedCallback() {
    super.connectedCallback();
    this.#update();
    const trigger = this.querySelector('#trigger');
    trigger.addEventListener('mouseenter', () => this.show());
    trigger.addEventListener('mouseleave', () => this.hide());
    trigger.addEventListener('focus', () => this.show());
    trigger.addEventListener('blur', () => this.hide());
  }

  attributeChangedCallback() { this.#update(); }

  show() {
    if (this.#visible) return;
    this.#visible = true;
    const overlay = this.querySelector('#overlay');
    overlay.classList.add('penpot-tip__visible');
    this.#position();
  }

  hide() {
    this.#visible = false;
    const overlay = this.querySelector('#overlay');
    overlay.classList.remove('penpot-tip__visible');
  }

  #position() {
    const overlay = this.querySelector('#overlay');
    const content = this.querySelector('#content');
    const arrow = this.querySelector('#arrow');
    const trigger = this.querySelector('#trigger');
    if (!overlay || !content || !trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const position = this.getAttribute('position') || 'bottom';
    const offset = 8;

    arrow.className = 'penpot-tip__tooltip-arrow';
    
    switch (position) {
      case 'top':
        overlay.style.left = `${triggerRect.left + triggerRect.width / 2 - contentRect.width / 2}px`;
        overlay.style.top = `${triggerRect.top - contentRect.height - offset}px`;
        arrow.classList.add('penpot-tip__top');
        break;
      case 'left':
        overlay.style.left = `${triggerRect.left - contentRect.width - offset}px`;
        overlay.style.top = `${triggerRect.top + triggerRect.height / 2 - contentRect.height / 2}px`;
        arrow.classList.add('penpot-tip__left');
        break;
      case 'right':
        overlay.style.left = `${triggerRect.right + offset}px`;
        overlay.style.top = `${triggerRect.top + triggerRect.height / 2 - contentRect.height / 2}px`;
        arrow.classList.add('penpot-tip__right');
        break;
      default: // bottom
        overlay.style.left = `${triggerRect.left + triggerRect.width / 2 - contentRect.width / 2}px`;
        overlay.style.top = `${triggerRect.bottom + offset}px`;
        arrow.classList.add('penpot-tip__bottom');
    }
  }

  #update() {
    const text = this.getAttribute('text') || '';
    const content = this.querySelector('#content');
    if (content) content.textContent = text;
  }

  render() {}
}

customElements.define('penpot-tooltip', PenpotTooltip);