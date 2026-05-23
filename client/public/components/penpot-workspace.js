import { cmd } from '../lib/rpc.js';
import { appStore } from '../lib/store.js';
import { ToolManager } from '../lib/tool-manager.js';
import { connectWS, disconnectWS, subscribeFile, unsubscribeFile, onWSMessage, sendPointerUpdate, getCursorPositions } from '../lib/ws.js';
import { initPersistence, enqueueChange, makeCreateChange, makeModifyChange, makeDeleteChange, makeAddPageChange, makeModPageChange, makeDeletePageChange, destroyPersistence, flushSave } from '../lib/persistence.js';
import { wireShortcuts, destroyShortcuts } from '../lib/shortcuts.js';
import { parseSVG } from '../lib/svg-import.js';
import { createShape } from '../lib/types.js';
import { PenpotElement } from './base.js';
import { createComponentFromShape, detachInstanceFromShape, extractComponentsFromFile, syncInstanceToMain, createInstanceFromComponent, findMainInstanceForComponent, syncWithCrossPageLookup } from '../lib/components-lib.js';
import { initCollaboration, resolveConflict, handleRemoteFileChange, broadcastChange, getPendingChanges, destroyCollaboration } from '../lib/collaboration.js';
import { importFileToProject } from '../lib/file-import.js';
import { createRichTextEditor, destroyActiveEditor, createFloatingToolbar } from '../lib/rich-text.js';
import { initWasmRenderer, destroyWasmRenderer, isWasmAvailable, getRenderMode, requestRender } from '../lib/wasm-bridge.js';
import './penpot-cursor-overlay.js';
import './penpot-presence-bar.js';
import './penpot-export-dialog.js';
import './penpot-share-dialog.js';
import './penpot-comment-panel.js';
import './penpot-text-toolbar.js';
import './penpot-import-dialog.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    penpot-workspace { display:flex; flex-direction:column; width:100%; height:100%; background:var(--penpot-bg,#1c1c1c); color:var(--penpot-text,#e6e6e6); font-family:var(--penpot-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif); }
    .workspace { display:flex; flex-direction:column; height:100%; }
    .canvas-area { flex:1; display:flex; overflow:hidden; }
    .penpot-app__comment-panel { width:280px; border-left:1px solid var(--penpot-border,#444); background:var(--penpot-surface,#2a2a2a); display:none; flex-direction:column; }
    .penpot-app__comment-panel.penpot-app__open { display:flex; }
  </style>
  <div class="penpot-app__workspace">
    <penpot-toolbar id="toolbar"></penpot-toolbar>
    <penpot-tools-bar id="tools"></penpot-tools-bar>
    <div class="penpot-app__canvas-area">
      <penpot-left-sidebar id="left-sidebar"></penpot-left-sidebar>
      <div style="position:relative;flex:1;display:flex;">
        <penpot-canvas id="canvas"></penpot-canvas>
        <penpot-cursor-overlay id="cursors"></penpot-cursor-overlay>
        <penpot-text-toolbar id="text-toolbar"></penpot-text-toolbar>
      </div>
      <penpot-right-sidebar id="right-sidebar"></penpot-right-sidebar>
      <div class="penpot-app__comment-panel" id="comment-panel">
        <penpot-comment-panel id="comments"></penpot-comment-panel>
      </div>
    </div>
  </div>
  <penpot-export-dialog id="export-dialog"></penpot-export-dialog>
  <penpot-share-dialog id="share-dialog"></penpot-share-dialog>
  <penpot-import-dialog id="import-dialog"></penpot-import-dialog>
`;

export class PenpotWorkspace extends PenpotElement {
  #rendered = false;
  #fileData = null;
  #pages = [];
  #currentPageIndex = 0;
  #selectedIds = new Set();
  #toolManager = null;
  #wsUnsubs = [];
  #pointerThrottle = null;
  #lastPointerSent = 0;
  #commentPanelOpen = false;

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.#rendered) return;
    this.#rendered = true;
    this.appendChild(template.content.cloneNode(true));

    this.querySelector('#toolbar').addEventListener('penpot-back-to-dashboard', () => {
      window.__penpot.navigate('dashboard');
    });
    this.querySelector('#toolbar').addEventListener('penpot-save', (e) => this.saveFile(e.detail.name));
    this.querySelector('#toolbar').addEventListener('penpot-file-rename', (e) => this.renameFile(e.detail.name));
    this.querySelector('#toolbar').addEventListener('penpot-share', () => {
      const shareDialog = this.querySelector('#share-dialog');
      if (shareDialog) shareDialog.open(this.#fileData?.id);
    });
    this.querySelector('#toolbar').addEventListener('penpot-export', () => {
      const exportDialog = this.querySelector('#export-dialog');
      if (exportDialog) {
        const page = this.#pages[this.#currentPageIndex];
        exportDialog.page = page;
        exportDialog.open();
      }
    });
    this.querySelector('#toolbar').addEventListener('penpot-comment-toggle', () => {
      this.#toggleCommentPanel();
    });
    this.querySelector('#toolbar').addEventListener('penpot-undo', () => {
      if (this.#toolManager) this.#toolManager.undo();
    });
    this.querySelector('#toolbar').addEventListener('penpot-redo', () => {
      if (this.#toolManager) this.#toolManager.redo();
    });

    this.querySelector('#tools').addEventListener('penpot-tool-select', (e) => {
      appStore.set('tool', e.detail.tool);
      if (this.#toolManager) {
        this.#toolManager.switchTool(e.detail.tool);
      }
    });
    this.querySelector('#tools').addEventListener('penpot-zoom', (e) => {
      const canvas = this.querySelector('#canvas');
      if (!canvas) return;
      if (e.detail.action === 'in') canvas.zoom = canvas.zoom * 1.25;
      else if (e.detail.action === 'out') canvas.zoom = canvas.zoom / 1.25;
      else if (e.detail.action === 'fit') canvas.zoom = 1;
      this.querySelector('#tools').zoom = canvas.zoom;
    });

    this.querySelector('#canvas').addEventListener('penpot-zoom-change', (e) => {
      this.querySelector('#tools').zoom = e.detail.zoom;
    });

    this.querySelector('#left-sidebar').addEventListener('penpot-page-select', (e) => {
      this.#currentPageIndex = e.detail.pageIndex;
      if (this.#toolManager) this.#toolManager.setPageIndex(this.#currentPageIndex);
      this.renderCurrentPage();
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-toggle-visibility', (e) => {
      this.#toggleVisibility(e.detail.shapeId);
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-toggle-lock', (e) => {
      this.#toggleLock(e.detail.shapeId);
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-shape-reorder', (e) => {
      this.#reorderShape(e.detail.sourceId, e.detail.targetId);
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-shape-rename', (e) => {
      this.#renameShape(e.detail.shapeId, e.detail.name);
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-page-add', () => {
      this.#addPage();
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-page-rename', (e) => {
      this.#renamePage(e.detail.pageIndex, e.detail.newName);
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-page-delete', (e) => {
      this.#deletePage(e.detail.pageIndex);
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-page-duplicate', (e) => {
      this.#duplicatePage(e.detail.pageIndex);
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-component-place-instance', (e) => {
      this.placeComponentInstance(e.detail.componentId);
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-component-detach', (e) => {
      this.detachSelectedInstance();
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-component-delete', (e) => {
      this.deleteComponent(e.detail.componentId);
    });
    this.querySelector('#right-sidebar').addEventListener('penpot-property-change', (e) => {
      this.#handlePropertyChange(e.detail);
    });

    this.addEventListener('penpot-shape-create', (e) => {
      this.#handleShapeCreate(e.detail.shape);
    });
    this.addEventListener('penpot-shape-select', (e) => {
      this.#updateSelectionFromTool(e.detail.shapeId);
    });
    this.addEventListener('penpot-shape-move', (e) => {
      this.#handleShapeMove(e.detail);
    });
    this.addEventListener('penpot-page-change', () => {
      this.renderCurrentPage();
    });
    this.addEventListener('penpot-bool-op', (e) => {
      this.#handleBoolOp(e.detail.boolType);
    });
    this.addEventListener('penpot-bool-type-change', (e) => {
      this.#handleBoolTypeChange(e.detail.shapeId, e.detail.boolType);
    });
    this.addEventListener('penpot-bool-flatten', (e) => {
      this.#handleBoolFlatten(e.detail.shapeId);
    });
    this.addEventListener('penpot-shape-resize', (e) => {
      this.#handleShapeResize(e.detail);
    });
    this.addEventListener('penpot-shape-rotate', (e) => {
      this.#handleShapeRotate(e.detail);
    });
    this.addEventListener('penpot-edit-text', (e) => {
      this.#handleEditText(e.detail);
    });
    this.addEventListener('penpot-gradient-change', (e) => {
      if (e.detail && e.detail.shapeId) {
        this.#handlePropertyChange(e.detail);
      } else if (e.detail && e.detail.fills) {
        const page = this.#pages[this.#currentPageIndex];
        if (page && this.#toolManager) {
          const shapeId = [...this.#selectedIds][0];
          if (shapeId) this.#toolManager.updateShapeProp(shapeId, 'fills', e.detail.fills);
        }
      }
    });
    this.addEventListener('penpot-shadow-change', (e) => {
      if (e.detail && e.detail.shapeId) {
        this.#handlePropertyChange(e.detail);
      } else if (e.detail && e.detail.shadows) {
        const page = this.#pages[this.#currentPageIndex];
        if (page && this.#toolManager) {
          const shapeId = [...this.#selectedIds][0];
          if (shapeId) this.#toolManager.updateShapeProp(shapeId, 'shadows', e.detail.shadows);
        }
      }
    });

    this.#wsUnsubs.push(onWSMessage('pointer-update', (data) => {
      this.#handleRemotePointer(data);
    }));
    this.#wsUnsubs.push(onWSMessage('file-change', (data) => {
      this.#handleRemoteFileChange(data);
    }));

    const cursorOverlay = this.querySelector('#cursors');
    this.watch(appStore.signal('cursorPositions'), (positions) => {
      if (cursorOverlay) cursorOverlay.cursors = positions || [];
    });

    this.#setupDragDrop();

    this.loadFile();
  }

  disconnectedCallback() {
    destroyPersistence();
    destroyShortcuts();
    destroyCollaboration();
    if (this.#toolManager) {
      this.#toolManager.destroy();
      this.#toolManager = null;
    }
    for (const unsub of this.#wsUnsubs) { if (typeof unsub === 'function') unsub(); }
    this.#wsUnsubs = [];
    if (this.#fileData) {
      unsubscribeFile(this.#fileData.id);
    }
    if (this.#pointerThrottle) { clearInterval(this.#pointerThrottle); }
    super.disconnectedCallback();
  }

  #initToolManager() {
    const canvas = this.querySelector('#canvas');
    if (!canvas) return;
    this.#toolManager = new ToolManager(canvas, this);
    this.#toolManager.setPages(this.#pages);
    this.#toolManager.setPageIndex(this.#currentPageIndex);
    this.#toolManager.switchTool('select');
    wireShortcuts(this.#toolManager, this);
  }

  #handleShapeCreate(shape) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const objects = this.#toolManager.getCurrentPageShapes();
    const parentId = this.#findParentFrame(shape, objects);
    if (parentId) shape.parentId = parentId;
    this.#toolManager.addShape(shape);
    this.#updateSelectionFromTool(shape.id);
    enqueueChange(makeCreateChange(page.id, shape, parentId));
  }

  #findParentFrame(shape, objects) {
    if (!objects) return null;
    const shapeX = shape.x || 0;
    const shapeY = shape.y || 0;
    for (const s of Object.values(objects)) {
      if ((s.type === 'frame' || s.type === 'group') && !s.mainInstance) {
        if (shapeX >= (s.x || 0) && shapeX < (s.x || 0) + (s.width || 0) &&
            shapeY >= (s.y || 0) && shapeY < (s.y || 0) + (s.height || 0)) {
          return s.id;
        }
      }
    }
    return null;
  }

  #setupDragDrop() {
    this.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    this.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      for (const file of files) {
        if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
          const text = await file.text();
          try {
            const svgShapes = parseSVG(text);
            const offset = 50;
            for (const rawShape of svgShapes) {
              const shape = createShape(rawShape.type, {
                ...rawShape,
                x: Math.round(rawShape.x) + offset,
                y: Math.round(rawShape.y) + offset,
              });
              if (shape.width > 0 && shape.height > 0) {
                this.#handleShapeCreate(shape);
              }
            }
          } catch (err) {
            console.error('[workspace] SVG import error:', err);
          }
          return;
        }

        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            const maxDim = 300;
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > maxDim || h > maxDim) {
              const scale = Math.min(maxDim / w, maxDim / h);
              w *= scale;
              h *= scale;
            }
            const shape = createShape('image', { x: 100, y: 100, width: Math.round(w), height: Math.round(h), href: url });
            this.#handleShapeCreate(shape);
          };
          img.src = url;
          return;
        }
      }
    });
  }

  #updateSelectionFromTool(shapeId) {
    if (shapeId) {
      if (!this.#selectedIds.has(shapeId)) {
        this.#selectedIds = new Set([shapeId]);
      }
    } else {
      this.#selectedIds.clear();
    }

    const rightSidebar = this.querySelector('#right-sidebar');
    const leftSidebar = this.querySelector('#left-sidebar');
    const canvas = this.querySelector('#canvas');

    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;

    const objects = page.objects || page.children || {};
    const shapes = Array.isArray(objects) ? objects : Object.values(objects);

    if (this.#selectedIds.size === 1) {
      const id = [...this.#selectedIds][0];
      const selected = shapes.find(s => s.id === id);
      if (rightSidebar) rightSidebar.selectedShape = selected || null;
    } else {
      if (rightSidebar) rightSidebar.selectedShape = null;
    }
    if (rightSidebar) rightSidebar.selectedIds = this.#selectedIds;
    if (leftSidebar) leftSidebar.selectedIds = this.#selectedIds;
    if (canvas) canvas.showSelection(this.#selectedIds);
  }

  #handleShapeMove({ shapeId, dx, dy }) {
    if (!this.#toolManager) return;
    this.#toolManager.moveShape(shapeId, dx, dy);
    const page = this.#pages[this.#currentPageIndex];
    if (page) {
      const shape = this.#findShape(page, shapeId);
      if (shape) {
        enqueueChange(makeModifyChange(page.id, shapeId, { x: shape.x, y: shape.y }));
      }
    }
  }

  #handlePropertyChange({ prop, value, shapeId }) {
    if (!this.#toolManager) return;
    this.#toolManager.updateShapeProp(shapeId, prop, value);
    const page = this.#pages[this.#currentPageIndex];
    if (page) {
      const propMap = { x: 'x', y: 'y', w: 'width', h: 'height', rotation: 'rotation', opacity: 'opacity' };
      const mappedProp = propMap[prop] || prop;
      enqueueChange(makeModifyChange(page.id, shapeId, { [mappedProp]: Number(value) || value }));
    }
  }

  #handleBoolOp(boolType) {
    if (!this.#toolManager) return;
    this.#toolManager.createBoolOp(boolType);
    this.renderCurrentPage();
  }

  #handleBoolTypeChange(shapeId, boolType) {
    if (!this.#toolManager) return;
    this.#toolManager.changeBoolType(shapeId, boolType);
    this.renderCurrentPage();
  }

  #handleBoolFlatten(shapeId) {
    if (!this.#toolManager) return;
    this.#toolManager.boolToGroup(shapeId);
    this.renderCurrentPage();
  }

  #handleShapeResize({ shapeId, x, y, width, height }) {
    if (!this.#toolManager) return;
    this.#toolManager.resizeShape(shapeId, x, y, width, height);
    this.renderCurrentPage();
  }

  #handleShapeRotate({ shapeId, rotation }) {
    if (!this.#toolManager) return;
    this.#toolManager.updateShapeProp(shapeId, 'rotation', rotation * 180 / Math.PI);
    this.renderCurrentPage();
  }

  #toggleVisibility(shapeId) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;
    shape.visible = shape.visible === false ? true : false;
    this.renderCurrentPage();
  }

  #toggleLock(shapeId) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;
    shape.locked = shape.locked === true ? false : true;
    this.renderCurrentPage();
  }

  #reorderShape(sourceId, targetId) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const objects = page.objects || page.children;
    if (!objects) return;
    const list = Array.isArray(objects) ? objects : null;
    if (!list) return;
    const srcIdx = list.findIndex(s => s.id === sourceId);
    const tgtIdx = list.findIndex(s => s.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const [moved] = list.splice(srcIdx, 1);
    list.splice(tgtIdx, 0, moved);
    this.renderCurrentPage();
  }

  #renameShape(shapeId, name) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;
    shape.name = name;
    this.renderCurrentPage();
  }

  #findShape(page, shapeId) {
    const objects = page.objects || page.children || {};
    if (Array.isArray(objects)) {
      const flat = (items) => {
        for (const s of items) {
          if (s.id === shapeId) return s;
          if (s.objects || s.children) {
            const children = Array.isArray(s.objects || s.children) ? (s.objects || s.children) : Object.values(s.objects || s.children || {});
            const found = flat(children);
            if (found) return found;
          }
        }
        return null;
      };
      return flat(objects);
    }
    return objects[shapeId] || null;
  }

  #initCollaboration() {
    if (!this.#fileData) return;
    const fileId = this.#fileData.id;
    const profileId = appStore.get('profileId');
    subscribeFile(fileId);
    initCollaboration(fileId, profileId);
    this.#startPointerBroadcast();
  }

  #startPointerBroadcast() {
    if (this.#pointerThrottle) clearInterval(this.#pointerThrottle);
    this.#pointerThrottle = setInterval(() => {
      this.#broadcastPointer();
    }, 100);
  }

  #broadcastPointer() {
    if (!this.#fileData) return;
    const canvas = this.querySelector('#canvas');
    if (!canvas) return;
  }

  #handleRemotePointer(data) {
    const cursorOverlay = this.querySelector('#cursors');
    if (!cursorOverlay) return;
    const positions = getCursorPositions();
    cursorOverlay.cursors = positions;
  }

  #handleRemoteFileChange(data) {
    const fileId = data?.fileId || data?.data?.fileId;
    if (!fileId || !this.#fileData) return;
    if (fileId !== this.#fileData.id) return;

    const remoteRevn = data?.data?.revn || data?.revn;
    if (remoteRevn) {
      appStore.set('currentFileRev', remoteRevn);
    }

    const changes = data?.data?.changes || data?.changes || [];
    if (changes.length > 0) {
      handleRemoteFileChange({
        fileId,
        'file-id': fileId,
        changes,
        revn: remoteRevn,
        profileId: data?.data?.profileId || data?.profileId,
        sessionId: data?.data?.sessionId || data?.sessionId,
      });
      const updatedPages = appStore.get('pages');
      if (updatedPages) {
        this.#pages = updatedPages;
      }
      this.renderCurrentPage();
    } else {
      this.loadFile();
    }
  }

  #toggleCommentPanel() {
    const panel = this.querySelector('#comment-panel');
    if (!panel) return;
    this.#commentPanelOpen = !this.#commentPanelOpen;
    panel.classList.toggle('penpot-app__open', this.#commentPanelOpen);
    const comments = this.querySelector('#comments');
    if (comments && this.#fileData) {
      comments.fileId = this.#fileData.id;
    }
  }

  async loadFile() {
    const canvas = this.querySelector('#canvas');
    if (!canvas) return;
    canvas.showLoading('Loading file...');

    const fileId = appStore.get('currentFileId');
    if (!fileId) {
      canvas.showEmpty('No file selected. Go back to the dashboard.');
      return;
    }

    try {
      const file = await cmd('get-file', { id: fileId });
      this.#fileData = file;
      appStore.set('currentFile', file);

      this.querySelector('#toolbar').fileName = file.name || 'Untitled';

      if (file.data && file.data.pagesIndex) {
        const pagesIndex = file.data.pagesIndex;
        const pageOrder = Object.keys(pagesIndex).sort((a, b) => (pagesIndex[a].ordering ?? 0) - (pagesIndex[b].ordering ?? 0));
        this.#pages = pageOrder.map(pageId => {
          const pageData = pagesIndex[pageId];
          return {
            id: pageId,
            name: pageData.name || 'Untitled',
            objects: pageData.objects || {},
            shapes: pageData.shapes || Object.keys(pageData.objects || {}),
            ...(pageData.width ? { width: pageData.width } : {}),
            ...(pageData.height ? { height: pageData.height } : {}),
          };
        });
      } else if (file.data && file.data.pages) {
        this.#pages = file.data.pages.map(page => ({
          id: page.id,
          name: page.name || 'Untitled',
          objects: page.objects || {},
          shapes: page.shapes || Object.keys(page.objects || {}),
        }));
      } else if (file.pages && file.pages.length > 0) {
        this.#pages = file.pages;
      } else {
        try {
          const pages = await cmd('get-page', { fileId });
          this.#pages = Array.isArray(pages) ? pages : pages ? [pages] : [];
          for (const page of this.#pages) {
            if (!page.objects) page.objects = {};
            if (!page.shapes && page.objects) page.shapes = Object.keys(page.objects);
          }
        } catch {
          this.#pages = [];
        }
      }

      const fileComponents = file.data?.components || file.components || {};
      if (Object.keys(fileComponents).length > 0) {
        appStore.set('currentFileComponents', fileComponents);
      }

      const leftSidebar = this.querySelector('#left-sidebar');
      if (leftSidebar) {
        leftSidebar.pages = this.#pages;
        leftSidebar.currentPageIndex = 0;
      }

      if (this.#pages.length > 0) {
        this.renderCurrentPage();
      } else {
        canvas.showEmpty('This file has no pages.');
      }

      this.#initToolManager();
      this.#initCollaboration();
      initPersistence(file.id, file.revn || 0, file.vern || 0);
    } catch (err) {
      console.error('[workspace] load error:', err);
      canvas.showError(`Error loading file: ${err.hint || err.message || err}`);
    }
  }

  renderCurrentPage() {
    const canvas = this.querySelector('#canvas');
    const leftSidebar = this.querySelector('#left-sidebar');
    if (!canvas) return;

    const page = this.#pages[this.#currentPageIndex];
    if (!page) { canvas.showEmpty('No page selected.'); return; }

    canvas.renderPage(page);

    if (this.#toolManager && this.#toolManager.selectedIds.size > 0) {
      canvas.showSelection(this.#toolManager.selectedIds);
    }

    if (leftSidebar) {
      leftSidebar.currentPageIndex = this.#currentPageIndex;
    }
  }

  #updateTextToolbar() {
    const textToolbar = this.querySelector('#text-toolbar');
    if (!textToolbar) return;
    const canvas = this.querySelector('#canvas');

    if (!this.#selectedIds || this.#selectedIds.size !== 1) {
      textToolbar.hide();
      return;
    }

    const page = this.#pages[this.#currentPageIndex];
    if (!page) { textToolbar.hide(); return; }

    const objects = page.objects || page.children || {};
    const shapes = Array.isArray(objects) ? objects : Object.values(objects);
    const selected = shapes.find(s => this.#selectedIds.has(s.id));

    if (selected && selected.type === 'text') {
      textToolbar.shape = selected;
      const canvasEl = canvas;
      if (canvasEl) {
        const canvasRect = canvasEl.getBoundingClientRect();
        const zoom = canvasEl.zoom || 1;
        const panX = canvasEl.panX || 0;
        const panY = canvasEl.panY || 0;
        const screenX = (selected.x + selected.width / 2) * zoom + canvasRect.left + panX * zoom;
        const screenY = (selected.y) * zoom + canvasRect.top + panY * zoom - 40;
        textToolbar.show(screenX - 150, screenY);
      }
    } else {
      textToolbar.hide();
    }
  }

  updateSelection() {
    const leftSidebar = this.querySelector('#left-sidebar');
    const rightSidebar = this.querySelector('#right-sidebar');
    const canvas = this.querySelector('#canvas');
    if (!this.#selectedIds || this.#selectedIds.size === 0) {
      if (rightSidebar) { rightSidebar.selectedShape = null; rightSidebar.selectedIds = []; }
      if (canvas) canvas.showSelection([]);
      return;
    }

    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;

    const objects = page.objects || page.children || {};
    const shapes = Array.isArray(objects) ? objects : Object.values(objects);
    const selected = shapes.find(s => this.#selectedIds.has(s.id));

    if (rightSidebar) {
      rightSidebar.selectedShape = selected || null;
      rightSidebar.selectedIds = this.#selectedIds;
    }
    if (leftSidebar) leftSidebar.selectedIds = this.#selectedIds;
    if (canvas) canvas.showSelection(this.#selectedIds);
    this.#updateTextToolbar();
  }

  async saveFile(name) {
    if (!this.#fileData) return;
    const fileName = name || this.querySelector('#toolbar')?.fileName || 'Untitled';
    try {
      await flushSave();
      await cmd('rename-file', { id: this.#fileData.id, name: fileName });
    } catch (err) {
      console.error('[workspace] save error:', err);
    }
  }

  async renameFile(name) {
    if (!this.#fileData || !name) return;
    try {
      await cmd('rename-file', { id: this.#fileData.id, name });
    } catch (err) {
      console.error('[workspace] rename error:', err);
    }
  }

  #addPage() {
    const pageNum = this.#pages.length + 1;
    const page = { id: crypto.randomUUID(), name: `Page ${pageNum}`, objects: {}, shapes: [] };
    this.#pages.push(page);
    this.#currentPageIndex = this.#pages.length - 1;
    if (this.#toolManager) {
      this.#toolManager.setPages(this.#pages);
      this.#toolManager.setPageIndex(this.#currentPageIndex);
    }
    this.renderCurrentPage();
    this.emit('penpot-page-change', {});
    enqueueChange(makeAddPageChange(page.id, page.name));
  }

  #renamePage(pageIndex, newName) {
    if (pageIndex < 0 || pageIndex >= this.#pages.length) return;
    this.#pages[pageIndex].name = newName;
    this.renderCurrentPage();
    enqueueChange(makeModPageChange(this.#pages[pageIndex].id, { name: newName }));
  }

  #deletePage(pageIndex) {
    if (this.#pages.length <= 1) return;
    if (pageIndex < 0 || pageIndex >= this.#pages.length) return;
    const pageId = this.#pages[pageIndex].id;
    this.#pages.splice(pageIndex, 1);
    if (this.#currentPageIndex >= this.#pages.length) {
      this.#currentPageIndex = this.#pages.length - 1;
    }
    if (this.#toolManager) {
      this.#toolManager.setPages(this.#pages);
      this.#toolManager.setPageIndex(this.#currentPageIndex);
    }
    this.renderCurrentPage();
    enqueueChange(makeDeletePageChange(pageId));
  }

  #duplicatePage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.#pages.length) return;
    const src = this.#pages[pageIndex];
    const objects = src.objects || src.children || {};
    const srcShapeIds = src.shapes || Object.keys(objects);
    const idMap = new Map();
    const newObjects = {};
    for (const [oldId, shape] of Object.entries(objects)) {
      const newId = crypto.randomUUID();
      idMap.set(oldId, newId);
      newObjects[newId] = { ...shape, id: newId, shapes: shape.shapes ? shape.shapes.map(cid => idMap.get(cid) || cid) : [] };
    }
    const newShapes = srcShapeIds.map(id => idMap.get(id) || id);
    const newPage = { id: crypto.randomUUID(), name: `${src.name} copy`, objects: newObjects, shapes: newShapes };
    this.#pages.splice(pageIndex + 1, 0, newPage);
    this.#currentPageIndex = pageIndex + 1;
    if (this.#toolManager) {
      this.#toolManager.setPages(this.#pages);
      this.#toolManager.setPageIndex(this.#currentPageIndex);
    }
    this.renderCurrentPage();
    enqueueChange(makeAddPageChange(newPage.id, newPage.name));
    for (const shape of Object.values(newObjects)) {
      enqueueChange(makeCreateChange(newPage.id, shape, shape.parentId ? idMap.get(shape.parentId) || shape.parentId : newPage.id));
    }
  }

  escHtml(str) { const el = document.createElement('span'); el.textContent = str || ''; return el.innerHTML; }

  #handleEditText({ shapeId, shape }) {
    const canvas = this.querySelector('#canvas');
    if (!canvas) return;

    const existing = canvas.querySelector('#text-editor');
    if (existing) existing.remove();

    const container = canvas.querySelector('#container');
    if (!container) return;

    const canvasRect = canvas.getBoundingClientRect();
    const zoom = canvas.zoom || 1;
    const panX = canvas.panX || 0;
    const panY = canvas.panY || 0;

    const screenX = (shape.x + panX) * zoom + canvasRect.left;
    const screenY = (shape.y + panY) * zoom + canvasRect.top;
    const screenW = shape.width * zoom;
    const screenH = shape.height * zoom;

    const editor = document.createElement('div');
    editor.id = 'text-editor';
    editor.contentEditable = 'true';
    editor.textContent = shape.content || '';
    editor.style.cssText = `position:absolute;left:${screenX - canvasRect.left}px;top:${screenY - canvasRect.top}px;width:${screenW}px;min-height:${screenH}px;background:var(--penpot-input-bg,#333);border:2px solid var(--penpot-primary,#31efb8);color:var(--penpot-text,#e6e6e6);font-size:${(shape.fontSize || 14) * zoom}px;font-family:var(--penpot-font-family,sans-serif);padding:2px 4px;outline:none;z-index:100;overflow-wrap:break-word;white-space:pre-wrap;line-height:1.4;`;

    const commitEdit = () => {
      const newText = editor.textContent?.trim() || '';
      editor.remove();
      if (!shapeId || newText === (shape.content || '')) return;
      if (this.#toolManager) {
        this.#toolManager.updateShapeProp(shapeId, 'content', newText);
        this.renderCurrentPage();
      }
      const page = this.#pages[this.#currentPageIndex];
      if (page) {
        enqueueChange(makeModifyChange(page.id, shapeId, { content: newText }));
      }
    };

    editor.addEventListener('blur', commitEdit);
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        editor.blur();
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        editor.blur();
      }
    });

    container.appendChild(editor);
    editor.focus();

    const range = document.createRange();
    range.selectNodeContents(editor);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  createComponentFromSelection() {
    if (!this.#toolManager || this.#toolManager.selectedIds.size === 0) return;
    const shapes = this.#toolManager.getCurrentPageShapes();
    if (!shapes) return;

    const selectedShapes = [];
    for (const id of this.#toolManager.selectedIds) {
      if (shapes[id]) selectedShapes.push(shapes[id]);
    }

    if (selectedShapes.length === 0) return;

    const firstShape = selectedShapes[0];
    const { componentId, shape: updatedShape } = createComponentFromShape(firstShape);

    const objects = { ...shapes };
    objects[firstShape.id] = updatedShape;

    if (selectedShapes.length > 1) {
      const children = selectedShapes.slice(1).map(s => s.id);
      objects[firstShape.id] = { ...updatedShape, children };
    }

    this.#toolManager.updatePageObjects(objects);
    enqueueChange(makeModifyChange(firstShape.id, { componentId, componentRoot: true, mainInstance: true }));

    const assetPanel = this.querySelector('#asset-panel');
    if (assetPanel) {
      const components = extractComponentsFromFile(this.#fileData || {});
      assetPanel.components = [...components, { id: componentId, name: firstShape.name || 'Component', type: firstShape.type }];
    }

    this.emit('penpot-notification', { type: 'success', message: 'Component created' });
  }

  detachSelectedInstance() {
    if (!this.#toolManager || this.#toolManager.selectedIds.size === 0) return;
    const shapes = this.#toolManager.getCurrentPageShapes();
    if (!shapes) return;

    let objects = { ...shapes };
    const changes = [];

    for (const id of this.#toolManager.selectedIds) {
      const shape = objects[id];
      if (shape?.componentId && !shape?.mainInstance) {
        const { shape: detached, objects: updatedObjects } = detachInstanceFromShape(shape, objects);
        objects = { ...objects, ...updatedObjects };
        changes.push(makeModifyChange(id, { componentId: null, componentRoot: null, shapeRef: null, touched: null }));
      }
    }

    if (changes.length > 0) {
      this.#toolManager.updatePageObjects(objects);
      for (const change of changes) enqueueChange(change);
      this.emit('penpot-notification', { type: 'success', message: `Detached ${changes.length} instance${changes.length > 1 ? 's' : ''}` });
    }
  }

  syncSelectedInstance() {
    if (!this.#toolManager || this.#toolManager.selectedIds.size === 0) return;
    const shapes = this.#toolManager.getCurrentPageShapes();
    if (!shapes) return;

    const selectedId = [...this.#toolManager.selectedIds][0];
    const instanceShape = shapes[selectedId];
    if (!instanceShape?.componentId || !instanceShape?.shapeRef) return;

    const mainShape = shapes[instanceShape.shapeRef];
    if (!mainShape) {
      this.emit('penpot-notification', { type: 'warning', message: 'Main component not found on current page' });
      return;
    }

    const synced = syncInstanceToMain(instanceShape, mainShape);
    const objects = { ...shapes, [selectedId]: synced };
    this.#toolManager.updatePageObjects(objects);

    const overrideKeys = Object.keys(synced).filter(k => !['id', 'parentId', 'componentId', 'componentRoot', 'shapeRef'].includes(k));
    const changes = {};
    for (const k of overrideKeys) {
      if (synced[k] !== instanceShape[k]) changes[k] = synced[k];
    }
    if (Object.keys(changes).length > 0) {
      enqueueChange(makeModifyChange(selectedId, changes));
    }

    this.emit('penpot-notification', { type: 'success', message: 'Instance synced to main' });
  }

  placeComponentInstance(componentId) {
    if (!componentId || !this.#toolManager) return;
    const shapes = this.#toolManager.getCurrentPageShapes();
    if (!shapes) return;

    const mainShape = findMainInstanceForComponent(shapes, componentId);
    if (!mainShape) {
      this.emit('penpot-notification', { type: 'warning', message: 'Component main instance not found' });
      return;
    }

    const { shapes: newShapes, rootId } = createInstanceFromComponent(mainShape, shapes, 20, 20);

    const objects = { ...shapes, ...newShapes };
    this.#toolManager.updatePageObjects(objects);

    const page = this.#pages[this.#currentPageIndex];
    for (const [id, shape] of Object.entries(newShapes)) {
      const parentId = this.#findParentFrame(shape, objects);
      if (parentId) shape.parentId = parentId;
      enqueueChange(makeCreateChange(page.id, shape, parentId));
    }

    this.#toolManager.selectedIds = new Set([rootId]);
    this.#toolManager.activateTool('select');
    this.emit('penpot-notification', { type: 'success', message: 'Instance placed' });
  }

  deleteComponent(componentId) {
    if (!componentId) return;
    const shapes = this.#toolManager.getCurrentPageShapes();
    if (!shapes) return;

    const updatedComponents = { ...(this.#fileData?.data?.components || {}) };
    delete updatedComponents[componentId];

    const mainShape = findMainInstanceForComponent(shapes, componentId);
    if (mainShape) {
      const { shape: detached, objects: updatedObjects } = detachInstanceFromShape(mainShape, shapes);
      const objects = { ...shapes, ...updatedObjects };
      this.#toolManager.updatePageObjects(objects);
      enqueueChange(makeModifyChange(mainShape.id, { componentId: null, componentRoot: null, mainInstance: null }));
    }

    this.#fileData = { ...this.#fileData, data: { ...this.#fileData.data, components: updatedComponents } };
    this.emit('penpot-notification', { type: 'success', message: 'Component deleted' });
  }

  async importPenpotFile() {
    const importDialog = this.querySelector('#import-dialog');
    if (importDialog) {
      importDialog.open();
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.penpot,.zip';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const projectId = appStore.get('currentProjectId');
          if (!projectId) {
            this.emit('penpot-notification', { type: 'danger', message: 'No project selected for import' });
            return;
          }
          this.emit('penpot-notification', { type: 'info', message: 'Importing file...' });
          const results = await importFileToProject(projectId, file);
          if (results && results.length > 0) {
            this.emit('penpot-notification', { type: 'success', message: `Imported ${results.length} file(s)` });
            this.emit('penpot-file-imported', { results });
          }
        } catch (err) {
          console.error('[workspace] import error:', err);
          this.emit('penpot-notification', { type: 'danger', message: `Import failed: ${err.message || err}` });
        }
      });
      input.click();
    }
  }

  startRichTextEdit(shape, canvasEl) {
    const canvasRect = canvasEl?.getBoundingClientRect();
    const zoom = appStore.get('zoom') || 1;
    const screenX = (shape.x || 0) * zoom;
    const screenY = (shape.y || 0) * zoom;
    const screenW = (shape.width || 100) * zoom;
    const screenH = (shape.height || 40) * zoom;

    destroyActiveEditor();
    const container = this.querySelector('.canvas-area') || this;
    const editor = createRichTextEditor(container, {
      ...shape,
      x: canvasRect ? canvasRect.left + screenX : screenX,
      y: canvasRect ? canvasRect.top + screenY : screenY,
      width: screenW,
      height: screenH,
    }, (result) => {
      if (shape.id) {
        enqueueChange(makeModifyChange(shape.id, {
          content: result.content,
          html: result.html,
          fontFamily: result.fontFamily,
          fontSize: result.fontSize,
          fontWeight: result.fontWeight,
          fontStyle: result.fontStyle,
          textDecoration: result.textDecoration,
          textAlign: result.textAlign,
          lineHeight: result.lineHeight,
          letterSpacing: result.letterSpacing,
        }));
      }
    });

    if (canvasRect) {
      const toolbarX = Math.min(canvasRect.left + screenX, window.innerWidth - 500);
      const toolbarY = canvasRect.top + screenY - 44;
      createFloatingToolbar(container, editor, { x: Math.max(10, toolbarX), y: Math.max(10, toolbarY) });
    }

    return editor;
  }

  async initWasm(canvasEl) {
    const initialized = await initWasmRenderer(canvasEl, {
      devicePixelRatio: window.devicePixelRatio,
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    if (initialized) {
      this.emit('penpot-notification', { type: 'info', message: 'WASM renderer active' });
    }
    return initialized;
  }

  getRenderMode() {
    return getRenderMode();
  }
}

customElements.define('penpot-workspace', PenpotWorkspace);