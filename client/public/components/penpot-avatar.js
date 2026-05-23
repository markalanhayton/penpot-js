import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-avatar { display: inline-flex; }
    .penpot-avatar__avatar { display: inline-flex; align-items: center; justify-content: center; border-radius: var(--penpot-radius-full, 9999px); background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); color: var(--penpot-primary, #31efb8); font-weight: 600; overflow: hidden; border: 2px solid var(--penpot-border, #444); }
    .penpot-avatar__avatar img { width: 100%; height: 100%; object-fit: cover; }
    penpot-avatar[size="s"] .penpot-avatar__avatar { width: 24px; height: 24px; font-size: var(--penpot-font-size-xxs, 9px); }
    penpot-avatar[size="m"] .penpot-avatar__avatar, .penpot-avatar__avatar { width: 32px; height: 32px; font-size: var(--penpot-font-size-xs, 10px); }
    penpot-avatar[size="l"] .penpot-avatar__avatar { width: 40px; height: 40px; font-size: var(--penpot-font-size-s, 11px); }
    penpot-avatar[size="xl"] .penpot-avatar__avatar { width: 48px; height: 48px; font-size: var(--penpot-font-size-m, 13px); }
  
  </style>
  <div class="penpot-avatar__avatar" id="avatar"><span id="initials"></span></div>`;

export class PenpotAvatar extends PenpotElement {
  static get observedAttributes() { return ['name', 'src', 'size']; }

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() { this.#update(); }
  attributeChangedCallback() { this.#update(); }

  #update() {
    const avatar = this.querySelector('#avatar');
    const initials = this.querySelector('#initials');
    if (!avatar || !initials) return;

    const name = this.getAttribute('name') || '';
    const src = this.getAttribute('src');

    const existingImg = avatar.querySelector('img');
    if (existingImg) existingImg.remove();

    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = name;
      img.onerror = () => { img.remove(); initials.textContent = this.#getInitials(name); };
      avatar.insertBefore(img, initials);
      initials.textContent = '';
    } else {
      initials.textContent = this.#getInitials(name);
    }
  }

  #getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  render() {}
}

customElements.define('penpot-avatar', PenpotAvatar);