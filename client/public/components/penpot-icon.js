import { PenpotElement } from './base.js';

const ICON_PATHS = {
  cursor: 'M5 3l14 9-7 2-3 7z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12l5 5L19 7',
  cross: 'M6 6l12 12M18 6L6 18',
  arrow_left: 'M19 12H5M12 19l-7-7 7-7',
  arrow_right: 'M5 12h14M12 5l7 7-7 7',
  arrow_up: 'M12 5v14M5 12l7-7 7 7',
  arrow_down: 'M12 19V5M5 12l7 7 7-7',
  chevron_down: 'M6 9l6 6 6-6',
  chevron_right: 'M9 6l6 6-6 6',
  chevron_left: 'M15 6l-6 6 6 6',
  chevron_up: 'M6 15l6-6 6 6',
  search: 'M11 3a8 8 0 100 16 8 8 0 000-16zM21 21l-4.35-4.35',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008.43 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 8.43a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  more: 'M12 8a2 2 0 100-4 2 2 0 000 4zM12 14a2 2 0 100-4 2 2 0 000 4zM12 20a2 2 0 100-4 2 2 0 000 4z',
  share: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  trash: 'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  copy: 'M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z',
  eye_off: 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22',
  lock: 'M5 11h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2zM7 11V7a5 5 0 0110 0v4',
  unlock: 'M7 11h14a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2v-8a2 2 0 012-2zM7 11V7a5 5 0 019.9-1',
  image: 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 13a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21',
  file: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',
  folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  zoom_in: 'M11 8v6M8 11h6M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
  zoom_out: 'M8 11h6M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z',
  move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
  hand: 'M18 11V6a2 2 0 00-4 0M14 10V4a2 2 0 00-4 0v6M10 10.5V6a2 2 0 00-4 0v8M18 8a2 2 0 014 0v6a8 8 0 01-8 8h-2c-2.76 0-5-2.24-5-5v-3',
  frame: 'M6 3v18M18 3v18M3 6h18M3 18h18',
  square: 'M3 3h18v18H3z',
  circle: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z',
  text: 'M4 7V4h16v3M9 20h6M12 4v16',
  pen: 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586',
  bezier: 'M3 17C3 12 7 7 12 7s9 5 9 10c0 3-2 5-4 5s-4-2-4-5c0-3 2-5 4-5M12 7l0-5',
};

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-icon { display: inline-flex; align-items: center; justify-content: center; width: var(--penpot-icon-size, 1em); height: var(--penpot-icon-size, 1em); }
    svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  
  </style>
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path id="path"/></svg>`;

export class PenpotIcon extends PenpotElement {
  _template = template;
  static get observedAttributes() { return ['name', 'size', 'color']; }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.#update();
  }

  attributeChangedCallback() { this.#update(); }

  #update() {
    const name = this.getAttribute('name') || 'square';
    const size = this.getAttribute('size') || '1em';
    const color = this.getAttribute('color');
    const pathData = ICON_PATHS[name] || ICON_PATHS.square;

    this.style.setProperty('--penpot-icon-size', size);
    if (color) this.style.color = color;

    const path = this.querySelector('#path');
    if (path) path.setAttribute('d', pathData);
  }

  render() {}
}

export { ICON_PATHS };
customElements.define('penpot-icon', PenpotIcon);