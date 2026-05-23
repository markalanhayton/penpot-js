const template = document.createElement('template');
template.innerHTML = `
  <div class="penpot-app__toolbar">
    <button id="back">&larr; Dashboard</button>
    <span style="font-size:13px;color:var(--dim)">File viewer</span>
  </div>
  <div class="penpot-app__canvas">View-only render of the design file</div>
  <style>
    .penpot-app__toolbar { display:flex; align-items:center; height:48px; padding:0 var(--s); background:var(--surface); border-bottom:1px solid var(--border); }
    .penpot-app__toolbar button { background:none; border:1px solid var(--border); border-radius:var(--radius-s); color:var(--text); padding:var(--xs) var(--s); cursor:pointer; font-size:12px; margin-right:var(--s); }
    .penpot-app__canvas { flex:1; display:flex; align-items:center; justify-content:center; color:var(--dim); font-size:14px; }
  </style>
`;

export class PenpotViewer extends HTMLElement {
  #rendered = false;

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.#rendered) return;
    this.#rendered = true;
    this.appendChild(template.content.cloneNode(true));
    this.querySelector('#back').addEventListener('click', () => window.__penpot.navigate('dashboard'));
  }
}

customElements.define('penpot-viewer', PenpotViewer);