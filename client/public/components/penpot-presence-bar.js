'use strict';
import { PenpotElement } from './base.js';
import { appStore } from '../lib/store.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-presence-bar { display: flex; align-items: center; gap: 4px; }
    .penpot-pres__presence-bar { display: flex; align-items: center; gap: 4px; }
    .penpot-pres__presence-avatar { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--penpot-surface, #2a2a2a); font-size: 10px; color: #fff; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: default; position: relative; }
    .penpot-pres__presence-avatar:hover { z-index: 10; }
    .penpot-pres__presence-more { font-size: 10px; color: var(--penpot-text-dim, #999); padding: 0 4px; }
    .penpot-pres__presence-status { width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; flex-shrink: 0; }
    .penpot-pres__presence-status.penpot-pres__connected { background: var(--penpot-primary, #31efb8); }
    .penpot-pres__presence-status.penpot-pres__disconnected { background: var(--penpot-danger, #f44); }
    .penpot-pres__presence-status.penpot-pres__connecting { background: var(--penpot-warning, #ffc107); }
  
  </style>
  <div class="penpot-pres__presence-bar" id="bar">
    <div class="penpot-pres__presence-status penpot-pres__disconnected" id="status"></div>
    <div id="avatars"></div>
    <span class="penpot-pres__presence-more" id="more" hidden></span>
  </div>`;

const MAX_VISIBLE = 5;

export class PenpotPresenceBar extends PenpotElement {
  _template = template;
  #users = [];
  #wsConnected = false;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.watch(appStore.signal('onlineUsers'), (users) => {
      this.#users = users || [];
      this.render();
    });
    this.watch(appStore.signal('wsConnected'), (connected) => {
      this.#wsConnected = !!connected;
      this.render();
    });
  }

  render() {
    const bar = this.querySelector('#bar');
    const avatars = this.querySelector('#avatars');
    const more = this.querySelector('#more');
    const status = this.querySelector('#status');
    if (!bar || !avatars || !more || !status) return;

    status.className = `penpot-pres__presence-status ${this.#wsConnected ? 'penpot-pres__connected' : 'penpot-pres__disconnected'}`;

    const visible = this.#users.slice(0, MAX_VISIBLE);
    const rest = this.#users.length - MAX_VISIBLE;

    let html = '';
    for (const user of visible) {
      const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const color = user.color || '#31efb8';
      html += `<div class="penpot-pres__presence-avatar" style="background:${color}" title="${this.escHtml(user.name || 'User')}">${initials}</div>`;
    }

    avatars.innerHTML = html;

    if (rest > 0) {
      more.textContent = `+${rest}`;
      more.hidden = false;
    } else {
      more.hidden = true;
    }
  }
}

customElements.define('penpot-presence-bar', PenpotPresenceBar);