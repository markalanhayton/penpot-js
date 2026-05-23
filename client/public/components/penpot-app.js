import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-app { display: flex; width: 100%; height: 100%; }
    .penpot-app__app-loader { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
    .penpot-app__app-spinner { width: 32px; height: 32px; border: 3px solid var(--penpot-border); border-top-color: var(--penpot-primary); border-radius: 50%; animation: penpot-spin 0.6s linear infinite; }
    @keyframes penpot-spin { to { transform: rotate(360deg); } }
  
  </style>
  <div id="outlet"></div>`;

const COMPONENT_MAP = {
  login: 'penpot-auth-screen',
  register: 'penpot-auth-screen',
  'recovery-request': 'penpot-auth-screen',
  recovery: 'penpot-auth-screen',
  dashboard: 'penpot-dashboard',
  'dashboard-search': 'penpot-dashboard',
  'dashboard-fonts': 'penpot-dashboard',
  'dashboard-libraries': 'penpot-dashboard',
  workspace: 'penpot-workspace',
  viewer: 'penpot-viewer',
  'settings-profile': 'penpot-dashboard',
  'settings-password': 'penpot-dashboard',
  'settings-feedback': 'penpot-dashboard',
};

export class PenpotApp extends PenpotElement {
  #currentEl = null;
  #currentRoute = null;

  static get observedAttributes() { return ['route']; }

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    super.connectedCallback();
    const route = this.getAttribute('route') || 'login';
    this.#renderRoute(route);
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'route' && oldVal !== newVal && newVal) {
      this.#renderRoute(newVal);
    }
  }

  #renderRoute(routeName) {
    const outlet = this.querySelector('#outlet');
    if (!outlet) return;

    if (this.#currentEl) {
      this.#currentEl.remove();
      this.#currentEl = null;
    }

    this.#currentRoute = routeName;
    const tagName = COMPONENT_MAP[routeName] || 'penpot-dashboard';
    const el = document.createElement(tagName);

    if (tagName === 'penpot-auth-screen') {
      el.setAttribute('route', routeName);
    }

    if (tagName === 'penpot-workspace') {
      const route = window.__penpot?.store?.get('routeParams') || {};
      if (route.projectId) el.setAttribute('project-id', route.projectId);
      if (route.fileId) el.setAttribute('file-id', route.fileId);
    }

    outlet.appendChild(el);
    this.#currentEl = el;
  }

  render() {}
}

customElements.define('penpot-app', PenpotApp);