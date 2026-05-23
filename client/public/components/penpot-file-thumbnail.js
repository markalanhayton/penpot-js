import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-file-thumbnail { display: inline-block; }
    .penpot-fthumb__thumbnail { position: relative; width: 100%; aspect-ratio: 16/10; background: var(--penpot-bg, #1c1c1c); border-radius: var(--penpot-radius-s, 4px); overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid var(--penpot-border, #444); }
    .penpot-fthumb__thumbnail img { width: 100%; height: 100%; object-fit: cover; }
    .penpot-fthumb__thumbnail .penpot-fthumb__icon { font-size: 28px; color: var(--penpot-primary, #31efb8); }
    .penpot-fthumb__thumbnail .penpot-fthumb__overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity var(--penpot-transition-fast, 0.1s ease); }
    .penpot-fthumb__thumbnail:hover .penpot-fthumb__overlay { opacity: 1; }
    .penpot-fthumb__thumbnail .penpot-fthumb__placeholder { color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-s, 11px); text-align: center; }
  
  </style>
  <div class="penpot-fthumb__thumbnail" id="thumb">
    <span class="penpot-fthumb__icon" id="icon">\u270E</span>
    <div class="penpot-fthumb__overlay" id="overlay"></div>
  </div>`;

export class PenpotFileThumbnail extends PenpotElement {
  static get observedAttributes() { return ['src', 'name', 'type']; }

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() { this.#update(); }
  attributeChangedCallback() { this.#update(); }

  #update() {
    const thumb = this.querySelector('#thumb');
    const icon = this.querySelector('#icon');
    const overlay = this.querySelector('#overlay');
    if (!thumb || !icon) return;

    const src = this.getAttribute('src');
    const name = this.getAttribute('name') || '';
    const type = this.getAttribute('type') || 'file';

    const existingImg = thumb.querySelector('img');
    if (existingImg) existingImg.remove();

    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = name;
      img.loading = 'lazy';
      img.onerror = () => { img.remove(); icon.style.display = ''; };
      icon.style.display = 'none';
      thumb.insertBefore(img, overlay);
    } else {
      const fileIcons = { file: '\u270E', project: '\u{1F4C1}', font: '\u{1F524}', image: '\u{1F5BC}', component: '\u25A1' };
      icon.textContent = fileIcons[type] || fileIcons.file;
    }
  }

  render() {}
}

customElements.define('penpot-file-thumbnail', PenpotFileThumbnail);