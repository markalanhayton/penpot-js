import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-badge { display: inline-flex; align-items: center; }
    .penpot-badge__badge { display: inline-flex; align-items: center; justify-content: center; padding: 1px 6px; font-size: var(--penpot-font-size-xs, 10px); font-weight: 600; line-height: 1.4; border-radius: var(--penpot-radius-full, 9999px); white-space: nowrap; }
    .penpot-badge__badge--default { background: var(--penpot-surface-high, #333); color: var(--penpot-text-dim, #999); }
    .penpot-badge__badge--primary { background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); color: var(--penpot-primary, #31efb8); }
    .penpot-badge__badge--danger { background: var(--penpot-danger-bg, rgba(244,67,54,0.08)); color: var(--penpot-danger, #f44336); }
    .penpot-badge__badge--warning { background: var(--penpot-warning-bg, rgba(255,152,0,0.08)); color: var(--penpot-warning, #ff9800); }
    .penpot-badge__badge--success { background: var(--penpot-success-bg, rgba(76,175,80,0.08)); color: var(--penpot-success, #4caf50); }
    .penpot-badge__badge--info { background: var(--penpot-info-bg, rgba(33,150,243,0.08)); color: var(--penpot-info, #2196f3); }
  
  </style>
  <span class="penpot-badge__badge penpot-badge__badge--default" id="badge"><slot></slot></span>`;

export class PenpotBadge extends PenpotElement {
  static get observedAttributes() { return ['variant']; }

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() { this.#update(); }
  attributeChangedCallback() { this.#update(); }

  #update() {
    const badge = this.querySelector('#badge');
    if (!badge) return;
    const variant = this.getAttribute('variant') || 'default';
    badge.className = `penpot-badge__badge badge--${variant}`;
  }

  render() {}
}

customElements.define('penpot-badge', PenpotBadge);