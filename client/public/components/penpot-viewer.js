import { PenpotElement } from './base.js';
import { cmd } from '../lib/rpc.js';
import { appStore } from '../lib/store.js';
import { renderPage } from '../lib/shapes.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    penpot-viewer { display: flex; flex-direction: column; width: 100%; height: 100%; background: var(--penpot-bg, #1c1c1c); color: var(--penpot-text, #e6e6e6); font-family: var(--penpot-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif); }
    .penpot-viewer__toolbar { display: flex; align-items: center; height: 44px; padding: 0 var(--penpot-spacing-m, 12px); background: var(--penpot-surface, #2a2a2a); border-bottom: 1px solid var(--penpot-border, #444); gap: var(--penpot-spacing-s, 8px); flex-shrink: 0; }
    .penpot-viewer__toolbar-title { font-size: var(--penpot-font-size-l, 16px); font-weight: 600; color: var(--penpot-text, #e6e6e6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-viewer__spacer { flex: 1; }
    .penpot-viewer__btn { background: none; border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); cursor: pointer; font-size: var(--penpot-font-size-s, 11px); white-space: nowrap; }
    .penpot-viewer__btn:hover { background: var(--penpot-surface-high, #333); border-color: var(--penpot-border-hover, #666); }
    .penpot-viewer__btn:disabled { opacity: 0.4; cursor: default; }
    .penpot-viewer__zoom { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); min-width: 48px; text-align: center; }
    .penpot-viewer__body { flex: 1; display: flex; overflow: hidden; }
    .penpot-viewer__sidebar { width: 200px; background: var(--penpot-surface, #2a2a2a); border-right: 1px solid var(--penpot-border, #444); overflow-y: auto; flex-shrink: 0; }
    .penpot-viewer__page-list { list-style: none; margin: 0; padding: var(--penpot-spacing-xs, 4px) 0; }
    .penpot-viewer__page-item { padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-m, 12px); font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-viewer__page-item:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
    .penpot-viewer__page-item.penpot-viewer__page-active { color: var(--penpot-primary, #31efb8); background: var(--penpot-primary-bg, rgba(49,239,184,0.08)); }
    .penpot-viewer__canvas-wrap { flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; background: var(--penpot-bg, #1c1c1c); position: relative; }
    .penpot-viewer__canvas-inner { transform-origin: center center; }
    .penpot-viewer__inspect { width: 220px; background: var(--penpot-surface, #2a2a2a); border-left: 1px solid var(--penpot-border, #444); overflow-y: auto; flex-shrink: 0; }
    .penpot-viewer__inspect-title { font-size: var(--penpot-font-size-s, 11px); font-weight: 600; color: var(--penpot-text, #e6e6e6); padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); border-bottom: 1px solid var(--penpot-border, #444); text-transform: uppercase; letter-spacing: 0.5px; }
    .penpot-viewer__inspect-row { display: flex; align-items: center; gap: var(--penpot-spacing-xs, 4px); padding: 3px var(--penpot-spacing-m, 12px); font-size: var(--penpot-font-size-xs, 10px); }
    .penpot-viewer__inspect-label { color: var(--penpot-text-dim, #999); min-width: 40px; }
    .penpot-viewer__inspect-value { color: var(--penpot-text, #e6e6e6); }
    .penpot-viewer__inspect-swatch { width: 14px; height: 14px; border-radius: 2px; border: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-viewer__inspect-empty { color: var(--penpot-text-dim, #999); padding: var(--penpot-spacing-l, 16px) var(--penpot-spacing-m, 12px); font-size: var(--penpot-font-size-xs, 10px); text-align: center; }
    .penpot-viewer__svg-shape { cursor: pointer; }
    .penpot-viewer__svg-shape:hover { filter: brightness(1.15); }
    .penpot-viewer__svg-interactive { cursor: pointer !important; }
    .penpot-viewer__svg-interactive:hover { filter: brightness(1.25) drop-shadow(0 0 4px rgba(49,239,184,0.5)); }
    .penpot-viewer__overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 50; display: none; }
    .penpot-viewer__empty { color: var(--penpot-text-dim, #999); text-align: center; padding: var(--penpot-spacing-xxl, 32px); font-size: var(--penpot-font-size-m, 13px); }
  </style>
  <div class="penpot-viewer__toolbar">
    <button class="penpot-viewer__btn" id="back-btn">&larr; Dashboard</button>
    <span class="penpot-viewer__toolbar-title" id="title">Viewer</span>
    <span class="penpot-viewer__spacer"></span>
    <button class="penpot-viewer__btn" id="zoom-out-btn" title="Zoom Out">-</button>
    <span class="penpot-viewer__zoom" id="zoom-label">100%</span>
    <button class="penpot-viewer__btn" id="zoom-in-btn" title="Zoom In">+</button>
    <button class="penpot-viewer__btn" id="zoom-fit-btn" title="Fit to View">Fit</button>
    <button class="penpot-viewer__btn" id="prev-page-btn" title="Previous Page">&larr; Prev</button>
    <button class="penpot-viewer__btn" id="next-page-btn" title="Next Page">Next &rarr;</button>
  </div>
  <div class="penpot-viewer__body">
    <div class="penpot-viewer__sidebar">
      <ul class="penpot-viewer__page-list" id="page-list"></ul>
    </div>
    <div class="penpot-viewer__canvas-wrap" id="canvas-wrap">
      <div class="penpot-viewer__canvas-inner" id="canvas-inner">
        <div class="penpot-viewer__empty" id="empty-msg">Loading file...</div>
      </div>
      <div class="penpot-viewer__overlay"></div>
    </div>
    <div class="penpot-viewer__inspect" id="inspect-panel">
      <div class="penpot-viewer__inspect-title">Inspect</div>
      <div class="penpot-viewer__inspect-empty" id="inspect-empty">Click a shape to inspect</div>
    </div>
  </div>
`;

export class PenpotViewer extends PenpotElement {
  _template = template;
  #fileData = null;
  #pages = [];
  #currentPageIndex = 0;
  #zoom = 1;
  #selectedShape = null;
  #pageHistory = [];

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#back-btn').addEventListener('click', () => window.__penpot.navigate('dashboard'));
    this.querySelector('#prev-page-btn').addEventListener('click', () => this.goToPage(this.#currentPageIndex - 1));
    this.querySelector('#next-page-btn').addEventListener('click', () => this.goToPage(this.#currentPageIndex + 1));
    this.querySelector('#zoom-in-btn').addEventListener('click', () => this.setZoom(this.#zoom + 0.25));
    this.querySelector('#zoom-out-btn').addEventListener('click', () => this.setZoom(this.#zoom - 0.25));
    this.querySelector('#zoom-fit-btn').addEventListener('click', () => this.fitToView());
    this.loadFile();
  }

  async loadFile() {
    const fileId = appStore.get('currentFileId');
    if (!fileId) {
      const emptyMsg = this.querySelector('#empty-msg');
      if (emptyMsg) emptyMsg.textContent = 'No file selected. Go back to the dashboard.';
      return;
    }

    try {
      const file = await cmd('get-file', { id: fileId });
      this.#fileData = file;
      this.querySelector('#title').textContent = file.name || 'Untitled';
      this.#pages = this.#extractPages(file);
      this.#currentPageIndex = 0;
      this.#pageHistory = [0];
      this.#zoom = 1;
      this.renderPageList();
      this.renderCurrentPage();
    } catch (err) {
      console.error('[viewer] load file error:', err);
      const emptyMsg = this.querySelector('#empty-msg');
      if (emptyMsg) emptyMsg.textContent = 'Error loading file.';
    }
  }

  #extractPages(file) {
    if (file.data && file.data.pagesIndex) {
      const pagesIndex = file.data.pagesIndex;
      const pageOrder = Object.keys(pagesIndex).sort((a, b) => (pagesIndex[a].ordering ?? 0) - (pagesIndex[b].ordering ?? 0));
      return pageOrder.map(pageId => {
        const pageData = pagesIndex[pageId];
        return {
          id: pageId,
          name: pageData.name || 'Untitled',
          objects: pageData.objects || {},
          shapes: pageData.shapes || Object.keys(pageData.objects || {}),
          width: pageData.width,
          height: pageData.height,
        };
      });
    } else if (file.data && file.data.pages) {
      return file.data.pages.map(page => ({
        id: page.id,
        name: page.name || 'Untitled',
        objects: page.objects || {},
        shapes: page.shapes || Object.keys(page.objects || {}),
        width: page.width,
        height: page.height,
      }));
    } else if (file.pages && file.pages.length > 0) {
      return file.pages;
    }
    return [];
  }

  renderPageList() {
    const listEl = this.querySelector('#page-list');
    if (!listEl) return;
    if (this.#pages.length === 0) {
      listEl.innerHTML = '<li class="penpot-viewer__empty" style="padding:12px;">No pages</li>';
      return;
    }
    let html = '';
    for (let i = 0; i < this.#pages.length; i++) {
      const p = this.#pages[i];
      const active = i === this.#currentPageIndex ? ' penpot-viewer__page-active' : '';
      html += `<li class="penpot-viewer__page-item${active}" data-page-index="${i}">${this.escHtml(p.name || 'Untitled')}</li>`;
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll('.penpot-viewer__page-item').forEach(item => {
      item.addEventListener('click', () => {
        this.goToPage(parseInt(item.dataset.pageIndex, 10));
      });
    });
    this.updatePageButtons();
  }

  renderCurrentPage() {
    const innerEl = this.querySelector('#canvas-inner');
    if (!innerEl) return;

    if (this.#pages.length === 0) {
      innerEl.innerHTML = '<div class="penpot-viewer__empty">No pages in this file.</div>';
      return;
    }

    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;

    const vpWidth = page.width || 1200;
    const vpHeight = page.height || 800;
    const viewport = { x: 0, y: 0, width: vpWidth, height: vpHeight };

    const svg = renderPage(page, viewport, []);
    svg.style.maxWidth = 'none';
    svg.style.maxHeight = 'none';

    innerEl.innerHTML = '';
    innerEl.appendChild(svg);

    svg.querySelectorAll('[id^="shape-"]').forEach(el => {
      const shapeId = el.id.replace('shape-', '');
      el.setAttribute('data-shape-id', shapeId);
      el.classList.add('penpot-viewer__svg-shape');
      const shape = (page.objects || {})[shapeId];
      if (shape && shape.interactions && shape.interactions.length > 0) {
        el.classList.add('penpot-viewer__svg-interactive');
      }
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const page = this.#pages[this.#currentPageIndex];
        if (!page) return;
        const objects = page.objects || {};
        const shape = objects[shapeId];
        if (shape) {
          if (shape.interactions && shape.interactions.length > 0) {
            this.#handleInteraction(shape.interactions[0], objects);
          } else {
            this.#selectedShape = shape;
            this.renderInspectPanel();
          }
        }
      });
    });

    svg.addEventListener('click', () => {
      this.#selectedShape = null;
      this.renderInspectPanel();
    });

    this.applyZoom();
    this.renderPageList();
  }

  goToPage(index, addToHistory = true) {
    if (index < 0 || index >= this.#pages.length) return;
    if (addToHistory) {
      this.#pageHistory.push(index);
    }
    this.#currentPageIndex = index;
    this.#zoom = 1;
    this.renderCurrentPage();
  }

  setZoom(z) {
    this.#zoom = Math.max(0.1, Math.min(5, z));
    this.applyZoom();
  }

  applyZoom() {
    const innerEl = this.querySelector('#canvas-inner');
    if (!innerEl) return;
    innerEl.style.transform = `scale(${this.#zoom})`;
    const zoomLabel = this.querySelector('#zoom-label');
    if (zoomLabel) zoomLabel.textContent = `${Math.round(this.#zoom * 100)}%`;
  }

  fitToView() {
    const wrapEl = this.querySelector('#canvas-wrap');
    const innerEl = this.querySelector('#canvas-inner');
    if (!wrapEl || !innerEl || this.#pages.length === 0) return;

    const page = this.#pages[this.#currentPageIndex];
    const pageW = page.width || 1200;
    const pageH = page.height || 800;
    const wrapW = wrapEl.clientWidth - 40;
    const wrapH = wrapEl.clientHeight - 40;

    if (wrapW <= 0 || wrapH <= 0) return;
    this.#zoom = Math.min(wrapW / pageW, wrapH / pageH, 2);
    this.#zoom = Math.max(0.1, Math.round(this.#zoom / 0.05) * 0.05);
    this.applyZoom();
  }

  #handleInteraction(interaction, objects) {
    const actionType = interaction['action-type'];
    const destination = interaction.destination;

    if (actionType === 'navigate' && destination) {
      const destPage = this.#findPageWithFrame(destination);
      if (destPage != null) {
        this.#currentPageIndex = destPage;
        this.#zoom = 1;
        this.renderCurrentPage();
        setTimeout(() => this.#scrollToFrame(destination), 100);
      }
    } else if ((actionType === 'open-overlay' || actionType === 'toggle-overlay') && destination) {
      this.#showOverlay(destination, objects);
    } else if (actionType === 'close-overlay') {
      this.#hideOverlay();
    } else if (actionType === 'prev-screen') {
      if (this.#pageHistory.length > 1) {
        this.#pageHistory.pop();
        this.#currentPageIndex = this.#pageHistory[this.#pageHistory.length - 1];
        this.renderCurrentPage();
      }
    } else if (actionType === 'open-url' && interaction.url) {
      window.open(interaction.url, '_blank', 'noopener');
    }
  }

  #findPageWithFrame(frameId) {
    for (let i = 0; i < this.#pages.length; i++) {
      const objects = this.#pages[i].objects || {};
      if (objects[frameId]) return i;
    }
    return null;
  }

  #scrollToFrame(frameId) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const objects = page.objects || {};
    const frame = objects[frameId];
    if (!frame) return;
    const wrapEl = this.querySelector('#canvas-wrap');
    if (!wrapEl) return;
    const innerEl = this.querySelector('#canvas-inner');
    if (!innerEl) return;
    const fx = (frame.x || 0) * this.#zoom;
    const fy = (frame.y || 0) * this.#zoom;
    wrapEl.scrollTo({ left: fx - 40, top: fy - 40, behavior: 'smooth' });
  }

  #showOverlay(frameId, allObjects) {
    const overlayEl = this.querySelector('.penpot-viewer__overlay');
    if (!overlayEl) return;
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const objects = page.objects || {};
    const frame = objects[frameId];
    if (!frame) return;

    const existingOverlay = overlayEl.querySelector('.penpot-viewer__overlay-frame');
    if (existingOverlay) existingOverlay.remove();

    const viewport = { x: 0, y: 0, width: page.width || 1200, height: page.height || 800 };
    const overlaySvg = renderPage({ ...page, objects: { [frameId]: frame } }, viewport, []);
    overlaySvg.style.position = 'absolute';
    overlaySvg.style.left = `${(frame.x || 0) * this.#zoom}px`;
    overlaySvg.style.top = `${(frame.y || 0) * this.#zoom}px`;
    overlaySvg.style.transform = `scale(${this.#zoom})`;
    overlaySvg.style.transformOrigin = 'top left';
    overlaySvg.classList.add('penpot-viewer__overlay-frame');

    overlayEl.appendChild(overlaySvg);
    overlayEl.style.display = 'block';

    overlayEl.onclick = () => this.#hideOverlay();
  }

  #hideOverlay() {
    const overlayEl = this.querySelector('.penpot-viewer__overlay');
    if (overlayEl) {
      overlayEl.style.display = 'none';
      const frame = overlayEl.querySelector('.penpot-viewer__overlay-frame');
      if (frame) frame.remove();
    }
  }

  updatePageButtons() {
    const prevBtn = this.querySelector('#prev-page-btn');
    const nextBtn = this.querySelector('#next-page-btn');
    if (prevBtn) prevBtn.disabled = this.#currentPageIndex <= 0;
    if (nextBtn) nextBtn.disabled = this.#currentPageIndex >= this.#pages.length - 1;
  }

  renderInspectPanel() {
    const panel = this.querySelector('#inspect-panel');
    if (!panel) return;

    if (!this.#selectedShape) {
      panel.innerHTML = `
        <div class="penpot-viewer__inspect-title">Inspect</div>
        <div class="penpot-viewer__inspect-empty">Click a shape to inspect</div>`;
      return;
    }

    const s = this.#selectedShape;
    const typeLabel = { rect: 'Rectangle', circle: 'Circle', ellipse: 'Ellipse', frame: 'Frame', group: 'Group', text: 'Text', path: 'Path', image: 'Image', bool: 'Boolean' }[s.type] || s.type;
    let html = `<div class="penpot-viewer__inspect-title">Inspect</div>`;
    html += `<div class="penpot-viewer__inspect-row"><span class="penpot-viewer__inspect-label">Name</span><span class="penpot-viewer__inspect-value">${this.escHtml(s.name || typeLabel)}</span></div>`;
    html += `<div class="penpot-viewer__inspect-row"><span class="penpot-viewer__inspect-label">Type</span><span class="penpot-viewer__inspect-value">${typeLabel}</span></div>`;
    html += `<div class="penpot-viewer__inspect-row"><span class="penpot-viewer__inspect-label">X</span><span class="penpot-viewer__inspect-value">${Math.round(s.x || 0)}</span></div>`;
    html += `<div class="penpot-viewer__inspect-row"><span class="penpot-viewer__inspect-label">Y</span><span class="penpot-viewer__inspect-value">${Math.round(s.y || 0)}</span></div>`;
    html += `<div class="penpot-viewer__inspect-row"><span class="penpot-viewer__inspect-label">W</span><span class="penpot-viewer__inspect-value">${Math.round(s.width || 0)}</span></div>`;
    html += `<div class="penpot-viewer__inspect-row"><span class="penpot-viewer__inspect-label">H</span><span class="penpot-viewer__inspect-value">${Math.round(s.height || 0)}</span></div>`;
    if (s.rotation) html += `<div class="penpot-viewer__inspect-row"><span class="penpot-viewer__inspect-label">Rot</span><span class="penpot-viewer__inspect-value">${Math.round(s.rotation)}°</span></div>`;
    if (s.opacity != null && s.opacity < 1) html += `<div class="penpot-viewer__inspect-row"><span class="penpot-viewer__inspect-label">Opacity</span><span class="penpot-viewer__inspect-value">${Math.round(s.opacity * 100)}%</span></div>`;
    if (s.fills && s.fills.length > 0) {
      html += `<div class="penpot-viewer__inspect-row" style="margin-top:4px;"><span class="penpot-viewer__inspect-label" style="font-weight:600;">Fills</span></div>`;
      for (const fill of s.fills) {
        const color = fill['fill-color'] || '#000';
        const opacity = fill['fill-opacity'] != null ? fill['fill-opacity'] : 1;
        html += `<div class="penpot-viewer__inspect-row"><div class="penpot-viewer__inspect-swatch" style="background:${color};opacity:${opacity};"></div><span class="penpot-viewer__inspect-value">${color}${opacity < 1 ? ` ${Math.round(opacity * 100)}%` : ''}</span></div>`;
      }
    }
    if (s.strokes && s.strokes.length > 0) {
      html += `<div class="penpot-viewer__inspect-row" style="margin-top:4px;"><span class="penpot-viewer__inspect-label" style="font-weight:600;">Strokes</span></div>`;
      for (const stroke of s.strokes) {
        const color = stroke['stroke-color'] || stroke.color || '#000';
        const width = stroke['stroke-width'] || stroke.width || 1;
        html += `<div class="penpot-viewer__inspect-row"><div class="penpot-viewer__inspect-swatch" style="background:${color};"></div><span class="penpot-viewer__inspect-value">${color} ${width}px</span></div>`;
      }
    }
    if (s.interactions && s.interactions.length > 0) {
      const EVENT_LABELS = { 'click': 'Click', 'mouse-press': 'Press', 'mouse-over': 'Hover', 'mouse-enter': 'Enter', 'mouse-leave': 'Leave', 'after-delay': 'Delay' };
      const ACTION_LABELS = { 'navigate': 'Navigate', 'open-overlay': 'Open Overlay', 'toggle-overlay': 'Toggle Overlay', 'close-overlay': 'Close Overlay', 'prev-screen': 'Previous', 'open-url': 'Open URL' };
      html += `<div class="penpot-viewer__inspect-row" style="margin-top:4px;"><span class="penpot-viewer__inspect-label" style="font-weight:600;">Interactions</span></div>`;
      for (const inter of s.interactions) {
        const evt = EVENT_LABELS[inter['event-type']] || inter['event-type'] || '?';
        const act = ACTION_LABELS[inter['action-type']] || inter['action-type'] || '?';
        const dest = inter.destination ? ` → ${inter.destination.substring(0, 8)}…` : '';
        html += `<div class="penpot-viewer__inspect-row"><span class="penpot-viewer__inspect-value" style="color:var(--penpot-primary,#31efb8);">${evt} → ${act}${dest}</span></div>`;
      }
    }
    panel.innerHTML = html;
  }
}

customElements.define('penpot-viewer', PenpotViewer);