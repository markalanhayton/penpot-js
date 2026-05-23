import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-tools-bar { display: flex; align-items: center; padding: 0 var(--penpot-spacing-s, 8px); border-bottom: 1px solid var(--penpot-border, #444); background: var(--penpot-surface, #2a2a2a); height: var(--penpot-toolsbar-height, 36px); flex-shrink: 0; gap: 2px; }
    .penpot-tools__tool-btn { background: none; border: none; color: var(--penpot-text-dim, #999); padding: var(--penpot-spacing-xs, 4px); cursor: pointer; border-radius: var(--penpot-radius-s, 4px); font-size: 16px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
    .penpot-tools__tool-btn:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
    .penpot-tools__tool-btn.penpot-tools__active { background: rgba(49,239,184,0.2); color: var(--penpot-primary, #31efb8); }
    .penpot-tools__tool-sep { width: 1px; height: 20px; background: var(--penpot-border, #444); margin: 0 var(--penpot-spacing-xs, 4px); }
    .penpot-tools__spacer { flex: 1; }
    .penpot-tools__zoom-controls { display: flex; align-items: center; gap: var(--penpot-spacing-xs, 4px); margin-left: auto; }
    .penpot-tools__zoom-controls span { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); min-width: 40px; text-align: center; }
    .penpot-tools__zoom-controls button { background: none; border: 1px solid var(--penpot-border, #444); color: var(--penpot-text, #e6e6e6); border-radius: var(--penpot-radius-s, 4px); padding: 0 var(--penpot-spacing-xs, 4px); cursor: pointer; font-size: 12px; height: 20px; }
    .penpot-tools__zoom-controls button:hover { background: var(--penpot-surface-high, #333); }
    .penpot-tools__zoom-fit { font-size: var(--penpot-font-size-xs, 10px); }
  
  </style>
  <button class="penpot-tools__tool-btn penpot-tools__active" data-tool="select" title="Select (V)">&#9655;</button>
  <button class="penpot-tools__tool-btn" data-tool="hand" title="Hand (H)">&#9995;</button>
  <div class="penpot-tools__tool-sep"></div>
  <button class="penpot-tools__tool-btn" data-tool="frame" title="Frame (F)">&#9633;</button>
  <button class="penpot-tools__tool-btn" data-tool="rect" title="Rectangle (R)">&#9644;</button>
  <button class="penpot-tools__tool-btn" data-tool="circle" title="Ellipse (E)">&#9675;</button>
  <button class="penpot-tools__tool-btn" data-tool="text" title="Text (T)">T</button>
  <button class="penpot-tools__tool-btn" data-tool="path" title="Pen (P)">&#9998;</button>
  <button class="penpot-tools__tool-btn" data-tool="image" title="Image">&#128247;</button>
  <div class="penpot-tools__tool-sep"></div>
  <div class="penpot-tools__spacer"></div>
  <div class="penpot-tools__zoom-controls">
    <button id="zoom-fit" class="penpot-tools__zoom-fit" title="Fit to screen">Fit</button>
    <button id="zoom-out" title="Zoom out">&#8722;</button>
    <span id="zoom-level">100%</span>
    <button id="zoom-in" title="Zoom in">+</button>
  </div>`;

const TOOL_SHORTCUTS = {
  v: 'select', h: 'hand', f: 'frame', r: 'rect', e: 'circle', t: 'text', p: 'path', i: 'image',
};

export class PenpotToolsBar extends PenpotElement {
  #currentTool = 'select';
  #zoom = 1;

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => this.selectTool(btn.dataset.tool));
    });
    this.querySelector('#zoom-in').addEventListener('click', () => this.emit('penpot-zoom', { action: 'in' }));
    this.querySelector('#zoom-out').addEventListener('click', () => this.emit('penpot-zoom', { action: 'out' }));
    this.querySelector('#zoom-fit').addEventListener('click', () => this.emit('penpot-zoom', { action: 'fit' }));

    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        this.selectTool(tool);
      }
    });
  }

  selectTool(tool) {
    this.#currentTool = tool;
    this.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('penpot-tools__active', btn.dataset.tool === tool);
    });
    this.emit('penpot-tool-select', { tool });
  }

  set zoom(z) {
    this.#zoom = z;
    const el = this.querySelector('#zoom-level');
    if (el) el.textContent = Math.round(z * 100) + '%';
  }

  get zoom() { return this.#zoom; }

  get currentTool() { return this.#currentTool; }

  render() {}
}

customElements.define('penpot-tools-bar', PenpotToolsBar);