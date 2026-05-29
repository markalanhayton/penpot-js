'use strict';
import { cmd, cmdUpload } from '../lib/rpc.js';
import { appStore } from '../lib/store.js';
import { ToolManager } from '../lib/tool-manager.js';
import { connectWS, disconnectWS, subscribeFile, unsubscribeFile, onWSMessage, sendPointerUpdate, sendSelectionUpdate, getCursorPositions } from '../lib/ws.js';
import { initPersistence, enqueueChange, enqueueChanges, makeCreateChange, makeModifyChange, makeDeleteChange, makeMoveChange, makeAddPageChange, makeModPageChange, makeDeletePageChange, makeAddMediaChange, destroyPersistence, flushSave } from '../lib/persistence.js';
import { wireShortcuts, destroyShortcuts } from '../lib/shortcuts.js';
import { parseSVG } from '../lib/svg-import.js';
import { createShape } from '../lib/types.js';
import { PenpotElement } from './base.js';
import { createComponentFromShape, detachInstanceFromShape, extractComponentsFromFile, syncInstanceToMain, createInstanceFromComponent, findMainInstanceForComponent, syncWithCrossPageLookup } from '../lib/components-lib.js';
import { PenpotContextMenu } from './penpot-context-menu.js';
import { initCollaboration, resolveConflict, handleRemoteFileChange, broadcastChange, getPendingChanges, destroyCollaboration } from '../lib/collaboration.js';
import { importFileToProject } from '../lib/file-import.js';
import { createRichTextEditor, destroyActiveEditor, createFloatingToolbar } from '../lib/rich-text.js';
import { contentTreeToHTML, htmlToContentTree } from '../lib/content-tree.js';
import * as textTypes from '@penpot/shared/types/text.js';
import { initWasmRenderer, destroyWasmRenderer, isWasmAvailable, getRenderMode, requestRender } from '../lib/wasm-bridge.js';
import { loadTeamFontsIntoDocument, uploadFontVariant, groupFontsByFamily, deleteFontVariant, fetchTeamFonts } from '../lib/fonts.js';
import { fixDeletedFontsForPage, fixDeletedFontsForLibrary, findMissingFonts, buildFontRegistry } from '../lib/fix-deleted-fonts.js';
import { generateAndUploadThumbnail } from '../lib/thumbnail.js';
import { nextPropertyNumber, propertiesToName, distance } from '@penpot/shared/types/variant.js';
import { generateAddNewProperty, generateUpdatePropertyName, generateRemoveProperty, generateUpdatePropertyValue } from '@penpot/shared/logic/variant_properties.js';
import { propagateFrameResize } from '../lib/constraint-propagation.js';
import { reflowLayout, reflowLayoutWithResize } from '../lib/layout-reflow.js';
import { PluginManager } from '../lib/plugin-api.js';
import { PathEditor } from '../lib/path-editor.js';
import { convertToPath } from '../../shared/src/types/path.js';
import './penpot-cursor-overlay.js';
import './penpot-presence-bar.js';
import './penpot-export-dialog.js';
import './penpot-share-dialog.js';
import './penpot-comment-panel.js';
import './penpot-onboarding.js';
import './penpot-text-toolbar.js';
import './penpot-import-dialog.js';
import './penpot-version-panel.js';
import './penpot-shortcuts-reference.js';
import './penpot-mcp-panel.js';
import './penpot-plugin-manager.js';
import './penpot-path-toolbar.js';

function imageToDataURL(img, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

const template = document.createElement('template');
template.innerHTML = `
  <style>
    penpot-workspace { display:flex; flex-direction:column; width:100%; height:100%; background:var(--penpot-bg,#1c1c1c); color:var(--penpot-text,#e6e6e6); font-family:var(--penpot-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif); }
    .penpot-app__workspace { display:flex; flex-direction:column; height:100%; }
    .penpot-app__canvas-area { flex:1; display:flex; overflow:hidden; }
    .penpot-app__comment-panel { width:280px; border-left:1px solid var(--penpot-border,#444); background:var(--penpot-surface,#2a2a2a); display:none; flex-direction:column; }
    .penpot-app__comment-panel.penpot-app__open { display:flex; }
    .penpot-app__mcp-overlay { position:fixed; inset:0; z-index:300; display:none; }
    .penpot-app__mcp-overlay.penpot-app__open { display:flex; }
    .penpot-app__mcp-backdrop { position:absolute; inset:0; background:rgba(0,0,0,0.4); }
    .penpot-app__mcp-panel-container { position:absolute; right:270px; top:0; bottom:0; width:340px; z-index:1; }
    .penpot-app__plugin-overlay { position:fixed; inset:0; z-index:300; display:none; }
    .penpot-app__plugin-overlay.penpot-app__open { display:flex; }
    .penpot-app__plugin-backdrop { position:absolute; inset:0; background:rgba(0,0,0,0.4); }
    .penpot-app__plugin-panel-container { position:absolute; right:270px; top:0; bottom:0; width:340px; z-index:1; background:var(--penpot-surface,#2a2a2a); display:flex; flex-direction:column; }
    penpot-workspace.penpot-workspace__drag-over .penpot-app__canvas-area { outline:2px solid var(--penpot-primary,#31efb8); outline-offset:-2px; }
    penpot-workspace.penpot-workspace__drag-over .penpot-app__canvas-area penpot-canvas { opacity:0.85; }
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
      <penpot-onboarding id="onboarding"></penpot-onboarding>
    </div>
  </div>
  <penpot-export-dialog id="export-dialog"></penpot-export-dialog>
  <penpot-share-dialog id="share-dialog"></penpot-share-dialog>
  <penpot-import-dialog id="import-dialog"></penpot-import-dialog>
  <penpot-version-panel id="version-panel" style="display:none;"></penpot-version-panel>
  <penpot-shortcuts-reference id="shortcuts-ref" style="display:none;"></penpot-shortcuts-reference>
  <penpot-context-menu id="context-menu"></penpot-context-menu>
  <div class="penpot-app__mcp-overlay" id="mcp-overlay">
    <div class="penpot-app__mcp-backdrop" id="mcp-backdrop"></div>
    <div class="penpot-app__mcp-panel-container">
      <penpot-mcp-panel id="mcp-panel"></penpot-mcp-panel>
    </div>
  </div>
  <div class="penpot-app__plugin-overlay" id="plugin-overlay">
    <div class="penpot-app__plugin-backdrop" id="plugin-backdrop"></div>
    <div class="penpot-app__plugin-panel-container">
      <penpot-plugin-manager id="plugin-manager-ui"></penpot-plugin-manager>
    </div>
  </div>
  <div id="plugin-container" style="display:none;"></div>
`;

export class PenpotWorkspace extends PenpotElement {
  _template = template;
  #fileData = null;
  #pages = [];
  #currentPageIndex = 0;
  #selectedIds = new Set();
  #toolManager = null;
  #wsUnsubs = [];
  #pointerThrottle = null;
  #lastPointerSent = 0;
  #lastPointerX = 0;
  #lastPointerY = 0;
  #lastPointerPageId = null;
  #boundPointerMove = null;
  #commentPanelOpen = false;
  #recentColors = [];
  #pluginManager = null;
  #activePluginId = null;
  #pathEditor = null;
  #pathToolbarEl = null;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();

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
        exportDialog.pages = this.#pages;
        exportDialog.open();
      }
    });
    this.querySelector('#toolbar').addEventListener('penpot-version-toggle', () => {
      const versionPanel = this.querySelector('#version-panel');
      if (versionPanel) {
        const isVisible = versionPanel.style.display !== 'none';
        versionPanel.style.display = isVisible ? 'none' : '';
        if (!isVisible) {
          versionPanel.fileId = this.#fileData?.id;
        }
      }
    });
    const versionPanel = this.querySelector('#version-panel');
    if (versionPanel) {
      versionPanel.addEventListener('penpot-version-close', () => {
        versionPanel.style.display = 'none';
      });
      versionPanel.addEventListener('penpot-snapshot-restored', () => {
        this.loadFile();
      });
    }

    this.querySelector('#mcp-backdrop').addEventListener('click', () => this.#toggleMcpPanel(false));
    this.querySelector('#mcp-panel').addEventListener('penpot-mcp-close', () => this.#toggleMcpPanel(false));
    this.querySelector('#mcp-panel').addEventListener('penpot-mcp-error', (e) => {
      this.emit('penpot-notification', { type: 'warning', message: `MCP: ${e.detail.error}` });
    });

    this.#pluginManager = new PluginManager(this.querySelector('#plugin-container'));

    this.querySelector('#plugin-backdrop').addEventListener('click', () => this.#togglePluginPanel(false));
    this.querySelector('#plugin-manager-ui').addEventListener('penpot-plugin-install', (e) => {
      this.#handlePluginInstall(e.detail);
    });
    this.querySelector('#plugin-manager-ui').addEventListener('penpot-plugin-open', (e) => {
      this.#handlePluginOpen(e.detail);
    });
    this.querySelector('#plugin-manager-ui').addEventListener('penpot-plugin-remove', (e) => {
      this.#handlePluginRemove(e.detail);
    });

    this.querySelector('#toolbar').addEventListener('penpot-comment-toggle', () => {
      this.#toggleCommentPanel();
    });
    this.querySelector('#toolbar').addEventListener('penpot-mcp-toggle', () => {
      this.#toggleMcpPanel();
    });
    this.querySelector('#toolbar').addEventListener('penpot-plugin-toggle', () => {
      this.#togglePluginPanel();
    });
    this.querySelector('#toolbar').addEventListener('penpot-undo', () => {
      if (this.#toolManager) this.#toolManager.undo();
    });
    this.querySelector('#toolbar').addEventListener('penpot-redo', () => {
      if (this.#toolManager) this.#toolManager.redo();
    });
    this.addEventListener('penpot-undo-redo-state', (e) => {
      const toolbar = this.querySelector('#toolbar');
      if (toolbar) {
        const undoBtn = toolbar.querySelector('#undo-btn');
        const redoBtn = toolbar.querySelector('#redo-btn');
        if (undoBtn) undoBtn.disabled = !e.detail.canUndo;
        if (redoBtn) redoBtn.disabled = !e.detail.canRedo;
      }
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
      else if (e.detail.action === 'fit') {
        const page = this.#pages[this.#currentPageIndex];
        if (page) {
          const objects = page.objects || page.children || {};
          const shapes = Array.isArray(objects) ? objects : Object.values(objects);
          canvas.fitToContent(shapes);
        } else {
          canvas.zoom = 1;
        }
      }
      else if (e.detail.action === 'selection') {
        if (this.#toolManager) {
          const selectedIds = this.#toolManager.getSelectedIds();
          const page = this.#pages[this.#currentPageIndex];
          if (selectedIds.length > 0 && page) {
            const objects = page.objects || page.children || {};
            const allShapes = Array.isArray(objects) ? objects : Object.values(objects);
            const selected = allShapes.filter(s => selectedIds.includes(s.id));
            canvas.zoomToSelection(selected);
          }
        }
      }
      this.querySelector('#tools').zoom = canvas.zoom;
    });

    this.querySelector('#canvas').addEventListener('penpot-zoom-change', (e) => {
      this.querySelector('#tools').zoom = e.detail.zoom;
      this.#updateScrollbars();
    });

    this.querySelector('#scrollbars').addEventListener('penpot-scrollbar-pan', (e) => {
      const canvas = this.querySelector('#canvas');
      if (canvas) {
        canvas.panX = e.detail.panX;
        canvas.panY = e.detail.panY;
        this.#updateScrollbars();
      }
    });

    this.querySelector('#canvas').addEventListener('penpot-canvas-click', (e) => {
      if (!this.#commentPanelOpen) return;
      const comments = this.querySelector('#comments');
      if (comments) {
        comments.pendingPosition = { x: e.detail?.x ?? 0, y: e.detail?.y ?? 0 };
        comments.pageId = this.#pages[this.#currentPageIndex]?.id;
        const input = comments.querySelector('#comment-input');
        if (input) input.focus();
      }
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
      const { sourceId, targetId, targetParentId, position } = e.detail;
      this.#moveShape(sourceId, targetId, targetParentId, position);
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
    this.querySelector('#left-sidebar').addEventListener('penpot-asset-use', (e) => {
      const { type, id } = e.detail || {};
      if (type === 'component' && id) {
        this.placeComponentInstance(id);
      } else if (type === 'media' && id) {
        const media = this.#fileData?.data?.media?.[id];
        if (media) {
          const shape = createShape('image', {
            x: 100,
            y: 100,
            width: media.width || 100,
            height: media.height || 100,
            href: id,
          });
          this.#handleShapeCreate(shape);
        }
      } else if (type === 'font' && id) {
        const fonts = appStore.get('currentFileFonts') || [];
        const font = fonts.find(f => f.id === id);
        if (font) {
          this.emit('penpot-font-use', { font });
        }
      }
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-component-detach', (e) => {
      this.detachSelectedInstance();
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-component-delete', (e) => {
      this.deleteComponent(e.detail.componentId);
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-font-upload', async (e) => {
      const { groups } = e.detail || {};
      if (!groups || groups.length === 0) return;
      const teamId = appStore.get('currentTeamId');
      if (!teamId) return;
      try {
        for (const group of groups) {
          await uploadFontVariant(teamId, group);
        }
        await loadTeamFontsIntoDocument(teamId);
        const families = await fetchTeamFonts(teamId);
        const rightSidebar = this.querySelector('#right-sidebar');
        const textToolbar = this.querySelector('#text-toolbar');
        if (rightSidebar) rightSidebar.teamFonts = families;
        if (textToolbar) textToolbar.teamFonts = families;
      } catch (err) {
        console.error('[workspace] font upload error:', err);
        alert('Font upload failed: ' + (err.hint || err.message || err));
      }
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-font-remove', async (e) => {
      const teamId = appStore.get('currentTeamId');
      const variantId = e.detail?.id;
      if (!teamId || !variantId) return;
      try {
        await deleteFontVariant(teamId, variantId);
        const families = await fetchTeamFonts(teamId);
        const rightSidebar = this.querySelector('#right-sidebar');
        const textToolbar = this.querySelector('#text-toolbar');
        if (rightSidebar) rightSidebar.teamFonts = families;
        if (textToolbar) textToolbar.teamFonts = families;
      } catch (err) {
        console.error('[workspace] font remove error:', err);
      }
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-media-upload', async (e) => {
      const { file } = e.detail || {};
      if (!file || !this.#fileData?.id) return;
      try {
        const result = await cmdUpload('upload-file-media-object', file, {
          fileId: this.#fileData.id,
          name: file.name || 'image',
          isLocal: 'true',
        });
        if (result) {
          const mediaEntry = {
            id: result.id,
            name: result.name || file.name || 'image',
            mtype: result.mtype || file.type,
            width: result.width || 0,
            height: result.height || 0,
            mediaId: result.mediaId,
            thumbnailId: result.thumbnailId || null,
          };
          if (!this.#fileData.data) this.#fileData.data = {};
          if (!this.#fileData.data.media) this.#fileData.data.media = {};
          this.#fileData.data.media[mediaEntry.id] = mediaEntry;
          enqueueChange(makeAddMediaChange(mediaEntry));
          const assetPanel = this.querySelector('#asset-panel');
          if (assetPanel) {
            assetPanel.media = Object.values(this.#fileData.data.media);
          }
          const canvas = this.querySelector('#canvas');
          if (canvas) {
            const canvasRect = canvas.getBoundingClientRect();
            const zoom = canvas.zoom || 1;
            const panX = canvas.panX || 0;
            const panY = canvas.panY || 0;
            const x = (canvasRect.width / 2 - panX * zoom) / zoom;
            const y = (canvasRect.height / 2 - panY * zoom) / zoom;
            const shape = createShape('image', {
              x: Math.round(x - (result.width || 100) / 2),
              y: Math.round(y - (result.height || 100) / 2),
              width: result.width || 100,
              height: result.height || 100,
              href: mediaEntry.id,
            });
            this.#handleShapeCreate(shape);
          }
        }
      } catch (err) {
        console.error('[workspace] media upload error:', err);
        alert('Image upload failed: ' + (err.hint || err.message || err));
      }
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-color-add', (e) => {
      const { color, name, gradient } = e.detail || {};
      if (!color && !gradient) return;
      const page = this.#pages[this.#currentPageIndex];
      if (!page || !this.#fileData) return;
      const colorObj = {
        id: crypto.randomUUID(),
        name: name || color || 'Gradient',
        color: color || gradient?.stops?.[0]?.color || '#000',
        opacity: 1,
        ...(gradient ? { gradient } : {}),
      };
      enqueueChange({ type: 'add-color', color: colorObj });
      this.#fileData.data = this.#fileData.data || {};
      this.#fileData.data.colors = this.#fileData.data.colors || {};
      this.#fileData.data.colors[colorObj.id] = colorObj;
      this.#updateAssetPanelColors();
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-color-delete', (e) => {
      const colorId = e.detail?.id;
      if (!colorId || !this.#fileData) return;
      enqueueChange({ type: 'del-color', id: colorId });
      if (this.#fileData.data?.colors) {
        delete this.#fileData.data.colors[colorId];
        this.#updateAssetPanelColors();
      }
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-color-rename', (e) => {
      const { id, name } = e.detail || {};
      if (!id || !this.#fileData) return;
      const colorObj = this.#fileData.data?.colors?.[id];
      if (!colorObj) return;
      const updated = { ...colorObj, name };
      enqueueChange({ type: 'mod-color', color: updated });
      this.#fileData.data.colors[id] = updated;
      this.#updateAssetPanelColors();
    });

    this.querySelector('#left-sidebar').addEventListener('penpot-sync-library-colors', () => {
      if (!this.#fileData) return;
      const libs = this.#fileData.data?.libraries || [];
      for (const lib of libs) {
        const libColors = lib.data?.colors || {};
        for (const [id, c] of Object.entries(libColors)) {
          if (!this.#fileData.data.colors[id]) {
            this.#fileData.data.colors[id] = { ...c, 'ref-id': id, 'ref-file': lib.id };
          }
        }
      }
      this.#updateAssetPanelColors();
      this.renderCurrentPage();
    });

    this.querySelector('#left-sidebar').addEventListener('penpot-sync-library-typographies', () => {
      if (!this.#fileData) return;
      const libs = this.#fileData.data?.libraries || [];
      for (const lib of libs) {
        const libTypos = lib.data?.typographies || {};
        for (const [id, t] of Object.entries(libTypos)) {
          if (!this.#fileData.data.typographies[id]) {
            this.#fileData.data.typographies[id] = { ...t, 'typography-ref-id': id, 'typography-ref-file': lib.id };
          }
        }
      }
      this.#updateAssetPanelTypographies();
      this.renderCurrentPage();
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-color-use', (e) => {
      const colorId = e.detail?.id;
      if (!colorId || !this.#fileData) return;
      const colorObj = this.#fileData.data?.colors?.[colorId];
      if (!colorObj) return;
      this.#recentColors = this.#recentColors.filter(c => c.id !== colorId);
      this.#recentColors.unshift(colorObj);
      if (this.#recentColors.length > 10) this.#recentColors = this.#recentColors.slice(0, 10);
      this.#updateAssetPanelColors();
      if (this.#selectedIds.size === 1) {
        const shapeId = [...this.#selectedIds][0];
        const page = this.#pages[this.#currentPageIndex];
        const shape = page ? this.#findShape(page, shapeId) : null;
        if (shape) {
          const fills = shape.fills ? [...shape.fills] : [];
          fills.push({
            'fill-type': 'solid',
            'fill-color': colorObj.color,
            'fill-opacity': colorObj.opacity ?? 1,
            'fill-color-ref-id': colorObj.id,
            'fill-color-ref-file': this.#fileData.id,
          });
          if (this.#toolManager) this.#toolManager.updateShapeProp(shapeId, 'fills', fills);
          enqueueChange(makeModifyChange(page.id, shapeId, { fills }));
        }
      }
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-typography-add', () => {
      if (!this.#fileData) return;
      const typo = {
        id: crypto.randomUUID(),
        name: 'New Typography',
        'font-family': 'Inter, sans-serif',
        'font-size': '14',
        'font-weight': '400',
        'font-style': 'normal',
        'line-height': '1.5',
        'letter-spacing': '0',
        'text-transform': 'none',
      };
      enqueueChange({ type: 'add-typography', typography: typo });
      this.#fileData.data = this.#fileData.data || {};
      this.#fileData.data.typographies = this.#fileData.data.typographies || {};
      this.#fileData.data.typographies[typo.id] = typo;
      this.#updateAssetPanelTypographies();
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-typography-delete', (e) => {
      const typoId = e.detail?.id;
      if (!typoId || !this.#fileData) return;
      enqueueChange({ type: 'del-typography', id: typoId });
      if (this.#fileData.data?.typographies) {
        delete this.#fileData.data.typographies[typoId];
        this.#updateAssetPanelTypographies();
      }
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-typography-rename', (e) => {
      const { id, name } = e.detail || {};
      if (!id || !this.#fileData) return;
      const typo = this.#fileData.data?.typographies?.[id];
      if (!typo) return;
      const updated = { ...typo, name };
      enqueueChange({ type: 'mod-typography', typography: updated });
      this.#fileData.data.typographies[id] = updated;
      this.#updateAssetPanelTypographies();
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-typography-edit', (e) => {
      const typo = e.detail;
      if (!typo?.id || !this.#fileData) return;
      const existing = this.#fileData.data?.typographies?.[typo.id];
      if (!existing) return;
      const updated = { ...existing, ...typo };
      enqueueChange({ type: 'mod-typography', typography: updated });
      this.#fileData.data.typographies[typo.id] = updated;
      this.#updateAssetPanelTypographies();
    });
    this.querySelector('#left-sidebar').addEventListener('penpot-typography-use', (e) => {
      const typoId = e.detail?.id;
      if (!typoId || !this.#fileData) return;
      const typo = this.#fileData.data?.typographies?.[typoId];
      if (!typo) return;
      if (this.#selectedIds.size === 1) {
        const shapeId = [...this.#selectedIds][0];
        const page = this.#pages[this.#currentPageIndex];
        const shape = page ? this.#findShape(page, shapeId) : null;
        if (shape && shape.type === 'text') {
          const props = {};
          if (typo['font-family']) props.fontFamily = typo['font-family'];
          if (typo['font-size']) props.fontSize = Number(typo['font-size']);
          if (typo['font-weight']) props.fontWeight = typo['font-weight'];
          if (typo['font-style']) props.fontStyle = typo['font-style'];
          if (typo['line-height']) props.lineHeight = typo['line-height'];
          if (typo['letter-spacing']) props.letterSpacing = typo['letter-spacing'];
          if (typo['text-transform']) props.textTransform = typo['text-transform'];
          if (this.#toolManager) {
            for (const [k, v] of Object.entries(props)) {
              this.#toolManager.updateShapeProp(shapeId, k, v);
            }
          }
          enqueueChange(makeModifyChange(page.id, shapeId, props));
        }
      }
    });
    this.querySelector('#right-sidebar').addEventListener('penpot-export-shape', (e) => {
      const { shapeId, exports } = e.detail || {};
      if (!shapeId) return;
      const page = this.#pages[this.#currentPageIndex];
      if (!page) return;
      const shape = this.#findShape(page, shapeId);
      if (!shape) return;
      const exportDialog = this.querySelector('#export-dialog');
      if (exportDialog) {
        exportDialog.page = page;
        exportDialog.pages = this.#pages;
        exportDialog.selectedShape = shape;
        exportDialog.shapeExports = exports;
        exportDialog.open();
      }
    });
    this.querySelector('#right-sidebar').addEventListener('penpot-property-change', (e) => {
      this.#handlePropertyChange(e.detail);
    });

    this.addEventListener('penpot-shape-create', (e) => {
      this.#handleShapeCreate(e.detail.shape);
    });
    this.addEventListener('penpot-shape-delete', (e) => {
      this.#handleShapeDelete(e.detail.shapeId);
    });
    this.addEventListener('penpot-shape-update', (e) => {
      this.#handleShapeUpdate(e.detail);
    });
    this.addEventListener('penpot-shape-select', (e) => {
      this.#updateSelectionFromTool(e.detail.shapeId);
    });
    this.addEventListener('penpot-shape-move', (e) => {
      this.#handleShapeMove(e.detail);
    });
    this.addEventListener('penpot-edit-path', (e) => {
      this.#startPathEdit(e.detail.shapeId, e.detail.shape);
    });
    this.addEventListener('penpot-path-edit-start', (e) => {
      this.#onPathEditStart(e.detail);
    });
    this.addEventListener('penpot-path-edit-stop', (e) => {
      this.#onPathEditStop(e.detail);
    });
    this.addEventListener('penpot-path-edit-mode', (e) => {
      this.#onPathEditMode(e.detail);
    });
    this.addEventListener('penpot-path-content-change', (e) => {
      this.#handlePathContentChange(e.detail);
    });
    this.addEventListener('penpot-path-preview', (e) => {
      this.#handlePathPreview(e.detail);
    });
    this.addEventListener('penpot-path-action', (e) => {
      this.#handlePathAction(e.detail.action);
    });
    this.addEventListener('penpot-page-change', () => {
      this.renderCurrentPage();
    });
    this.querySelector('#toolbar').addEventListener('penpot-align', (e) => {
      if (this.#toolManager) this.#toolManager.alignSelectedShapes(e.detail.alignment);
    });
    this.querySelector('#toolbar').addEventListener('penpot-create-component', () => {
      this.createComponentFromSelection();
    });
    this.querySelector('#main-menu').addEventListener('penpot-menu-action', (e) => {
      this.#handleMenuAction(e.detail);
    });

    this.querySelector('#right-sidebar').addEventListener('penpot-align', (e) => {
      if (this.#toolManager) this.#toolManager.alignSelectedShapes(e.detail.alignment);
    });
    this.querySelector('#right-sidebar').addEventListener('penpot-distribute', (e) => {
      if (this.#toolManager) this.#toolManager.distributeSelectedShapes(e.detail.direction);
    });
    this.querySelector('#right-sidebar').addEventListener('penpot-create-component', () => {
      this.createComponentFromSelection();
    });
    this.querySelector('#right-sidebar').addEventListener('penpot-sync-instance', (e) => {
      this.syncSelectedInstance();
    });
    this.querySelector('#right-sidebar').addEventListener('penpot-reset-overrides', (e) => {
      const shapeId = e.detail?.shapeId;
      const group = e.detail?.group;
      if (!shapeId || !this.#toolManager) return;
      const shape = this.#findShape(this.#pages[this.#currentPageIndex], shapeId);
      if (!shape) return;
      const touched = shape.touched ? new Set(shape.touched instanceof Set ? shape.touched : Array.isArray(shape.touched) ? shape.touched : Object.keys(shape.touched)) : new Set();
      if (group) {
        touched.delete(group);
      } else {
        touched.clear();
      }
      this.#toolManager.updateShapeProp(shapeId, 'touched', touched);
      const page = this.#pages[this.#currentPageIndex];
      if (page) enqueueChange(makeModifyChange(page.id, shapeId, { touched: [...touched] }));
    });
    this.querySelector('#right-sidebar').addEventListener('penpot-detach-instance', () => {
      this.detachSelectedInstance();
    });
    this.querySelector('#right-sidebar').addEventListener('penpot-swap-instance', (e) => {
      const { shapeId, componentId } = e.detail;
      const page = this.#pages[this.#currentPageIndex];
      if (!page || !this.#toolManager) return;
      const shapes = Array.isArray(page.objects || page.children) ? (page.objects || page.children) : Object.values(page.objects || page.children || {});
      const shape = shapes.find(s => s.id === shapeId);
      if (!shape) return;
      shape.componentId = componentId;
      delete shape['component-root'];
      delete shape['main-instance'];
      const touched = new Set(shape.touched || []);
      touched.add(`swap-slot-${componentId}`);
      shape.touched = touched;
      enqueueChange(makeModifyChange(page.id, shapeId, { 'component-id': componentId, touched: [...touched] }));
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
    this.addEventListener('penpot-variant-add-property', (e) => {
      this.#handleVariantAddProperty(e.detail);
    });
    this.addEventListener('penpot-variant-add-variant', (e) => {
      this.#handleVariantAddVariant(e.detail);
    });
    this.addEventListener('penpot-variant-update-property-name', (e) => {
      this.#handleVariantUpdatePropertyName(e.detail);
    });
    this.addEventListener('penpot-variant-remove-property', (e) => {
      this.#handleVariantRemoveProperty(e.detail);
    });
    this.addEventListener('penpot-variant-switch', (e) => {
      this.#handleVariantSwitch(e.detail);
    });
    this.addEventListener('penpot-variant-select', (e) => {
      this.#handleVariantSelect(e.detail);
    });
    this.addEventListener('penpot-combine-as-variants', (e) => {
      this.#handleCombineAsVariants(e.detail);
    });
    this.addEventListener('penpot-layout-change', (e) => {
      this.#handleLayoutChange(e.detail);
    });
    this.addEventListener('penpot-apply-color-token', (e) => {
      this.#handleApplyColorToken(e.detail);
    });
    this.addEventListener('penpot-apply-typo-token', (e) => {
      this.#handleApplyTypoToken(e.detail);
    });
    this.addEventListener('penpot-token-add', (e) => {
      this.#handleTokenAdd(e.detail);
    });
    this.addEventListener('penpot-token-delete', (e) => {
      this.#handleTokenDelete(e.detail);
    });
    this.addEventListener('penpot-token-update', (e) => {
      this.#handleTokenUpdate(e.detail);
    });
    this.addEventListener('penpot-token-set-activate', (e) => {
      this.#handleTokenSetActivate(e.detail);
    });
    this.addEventListener('penpot-token-set-delete', (e) => {
      this.#handleTokenSetDelete(e.detail);
    });
    this.addEventListener('penpot-token-theme-change', (e) => {
      this.#handleTokenThemeChange(e.detail);
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

    this.querySelector('#right-sidebar').addEventListener('penpot-flip', (e) => {
      const { direction } = e.detail;
      const shapeId = [...this.#selectedIds][0];
      if (!shapeId) return;
      const page = this.#pages[this.#currentPageIndex];
      if (!page) return;
      const shape = this.#findShape(page, shapeId);
      if (!shape) return;
      if (direction === 'horizontal') {
        const newTransform = shape.transform ? { ...shape.transform } : {};
        newTransform.scaleX = (newTransform.scaleX || 1) * -1;
        this.#toolManager.updateShapeProp(shapeId, 'transform', newTransform);
      } else if (direction === 'vertical') {
        const newTransform = shape.transform ? { ...shape.transform } : {};
        newTransform.scaleY = (newTransform.scaleY || 1) * -1;
        this.#toolManager.updateShapeProp(shapeId, 'transform', newTransform);
      }
      this.renderCurrentPage();
    });

    this.addEventListener('penpot-shape-context-menu', (e) => {
      const { x, y, selectedIds } = e.detail;
      const contextMenu = this.querySelector('#context-menu') || document.querySelector('penpot-context-menu');
      if (!contextMenu) return;
      const page = this.#pages[this.#currentPageIndex];
      if (!page) return;
      const objects = page.objects || page.children || {};
      const shapes = Array.isArray(objects) ? objects : Object.values(objects);
      const selected = selectedIds.map(id => shapes.find(s => s.id === id)).filter(Boolean);
      const singleShape = selected.length === 1 ? selected[0] : null;
      const items = [];
      items.push({ label: 'Select All', icon: '☐', shortcut: 'Ctrl+A', action: () => { this.#toolManager.selectAll(); this.renderCurrentPage(); if (this.#fileData) sendSelectionUpdate(this.#fileData.id, this.#pages[this.#currentPageIndex]?.id, this.#selectedIds); } });
      items.push({ type: 'separator' });
      if (singleShape) {
        items.push({ label: 'Copy', icon: '📋', shortcut: 'Ctrl+C', action: () => this.#toolManager.copySelected() });
        items.push({ label: 'Paste', icon: '📄', shortcut: 'Ctrl+V', action: () => this.#toolManager.pasteClipboard() });
        items.push({ label: 'Paste Here', icon: '📄', action: () => this.#toolManager.pasteAt(x, y) });
        items.push({ label: 'Duplicate', icon: '📎', shortcut: 'Ctrl+D', action: () => this.#toolManager.duplicateSelected() });
        items.push({ type: 'separator' });
        items.push({ label: 'Bring Forward', icon: '⬆', shortcut: ']', action: () => { this.#toolManager.bringForward(singleShape.id); this.renderCurrentPage(); } });
        items.push({ label: 'Send Backward', icon: '⬇', shortcut: '[', action: () => { this.#toolManager.sendBackward(singleShape.id); this.renderCurrentPage(); } });
        items.push({ label: 'Bring to Front', icon: '⬆⬆', shortcut: 'Shift+]', action: () => { this.#toolManager.bringToFront(singleShape.id); this.renderCurrentPage(); } });
        items.push({ label: 'Send to Back', icon: '⬇⬇', shortcut: 'Shift+[', action: () => { this.#toolManager.sendToBack(singleShape.id); this.renderCurrentPage(); } });
        items.push({ type: 'separator' });
        if (singleShape.type === 'group') {
          items.push({ label: 'Ungroup', icon: '↩', shortcut: 'Ctrl+Shift+G', action: () => { this.#toolManager.ungroupSelected(); this.renderCurrentPage(); } });
          if (singleShape['masked-group'] || singleShape.maskedGroup) {
            items.push({ label: 'Unmask', icon: '🔲', action: () => { this.#toolManager.updateShapeProp(singleShape.id, 'masked-group', false); this.#toolManager.updateShapeProp(singleShape.id, 'maskedGroup', false); const page = this.#pages[this.#currentPageIndex]; if (page) enqueueChange(makeModifyChange(page.id, singleShape.id, { 'masked-group': false, maskedGroup: false })); this.renderCurrentPage(); } });
          }
        } else if (selectedIds.length >= 1) {
          items.push({ label: 'Group', icon: '⊞', shortcut: 'Ctrl+G', action: () => { this.#toolManager.groupSelected(); this.renderCurrentPage(); } });
        }
        if (!singleShape['masked-group'] && !singleShape.maskedGroup && selectedIds.length >= 2) {
          items.push({ label: 'Mask', icon: '🖱', action: () => { this.#maskSelected(); this.renderCurrentPage(); } });
        }
        if (singleShape.type === 'bool') {
          items.push({ label: 'Flatten', icon: '⬜', action: () => { this.#handleBoolFlatten(singleShape.id); } });
        }
        if ((singleShape.type === 'path') && singleShape.strokes && singleShape.strokes.length > 0) {
          items.push({ label: 'Flatten Stroke to Fill', icon: '⬜', action: () => { this.#toolManager.flattenPath(singleShape.id); this.renderCurrentPage(); const page = this.#pages[this.#currentPageIndex]; if (page) enqueueChange(makeModifyChange(page.id, singleShape.id, { fills: singleShape.fills, strokes: [] })); } });
        }
        if (singleShape.type === 'path' && (singleShape.content || singleShape.d)) {
          items.push({ label: 'Edit Path', icon: '✏', shortcut: 'Enter', action: () => { this.#startPathEdit(singleShape.id, singleShape); } });
        }
        if (singleShape.type !== 'path' && singleShape.type !== 'bool' && singleShape.type !== 'image' && singleShape.type !== 'text') {
          items.push({ label: 'Convert to Path', icon: '⬜', action: () => { this.#convertToPath(singleShape.id); } });
        }
        if (singleShape.type === 'path' && singleShape.d) {
          items.push({ label: 'Put Text on Path', icon: 'T⃣', action: () => {
            const shapes = Array.isArray(page.objects || page.children) ? (page.objects || page.children) : Object.values(page.objects || page.children || {});
            const textShape = shapes.find(s => s.type === 'text' && this.#selectedIds.has(s.id)) || shapes.find(s => s.type === 'text');
            if (textShape) {
              this.#toolManager.updateShapeProp(textShape.id, 'pathRef', singleShape.id);
              this.#toolManager.updateShapeProp(textShape.id, 'pathData', singleShape.d || singleShape.pathData || singleShape.content);
              this.renderCurrentPage();
            } else {
              alert('No text shape found. Select a text shape first, then right-click the path.');
            }
          }});
        }
        items.push({ label: 'Create Component', icon: '★', shortcut: 'Ctrl+Alt+K', action: () => { this.createComponentFromSelection(); } });
        if (singleShape.visible !== false) {
          items.push({ label: 'Hide', icon: '👁', action: () => { this.#toggleVisibility(singleShape.id); this.renderCurrentPage(); } });
        } else {
          items.push({ label: 'Show', icon: '👁', action: () => { this.#toggleVisibility(singleShape.id); this.renderCurrentPage(); } });
        }
        if (singleShape.locked) {
          items.push({ label: 'Unlock', icon: '🔓', action: () => { this.#toggleLock(singleShape.id); this.renderCurrentPage(); } });
        } else {
          items.push({ label: 'Lock', icon: '🔒', action: () => { this.#toggleLock(singleShape.id); this.renderCurrentPage(); } });
        }
        items.push({ type: 'separator' });
        items.push({ label: 'Delete', icon: '🗑', shortcut: 'Del', danger: true, action: () => { this.#toolManager.deleteSelected(); this.renderCurrentPage(); } });
      } else if (selectedIds.length > 1) {
        items.push({ label: 'Group', icon: '⊞', shortcut: 'Ctrl+G', action: () => { this.#toolManager.groupSelected(); this.renderCurrentPage(); } });
        items.push({ label: 'Create Component', icon: '★', shortcut: 'Ctrl+Alt+K', action: () => { this.createComponentFromSelection(); } });
        items.push({ type: 'separator' });
        items.push({ label: 'Align', icon: '⫷', submenu: [
          { label: 'Align Left', icon: '⫷', action: () => { this.#toolManager.alignSelectedShapes('left'); } },
          { label: 'Align Center H', icon: '⫿', action: () => { this.#toolManager.alignSelectedShapes('center-h'); } },
          { label: 'Align Right', icon: '⫸', action: () => { this.#toolManager.alignSelectedShapes('right'); } },
          { type: 'separator' },
          { label: 'Align Top', icon: '⫶', action: () => { this.#toolManager.alignSelectedShapes('top'); } },
          { label: 'Align Middle V', icon: '⫬', action: () => { this.#toolManager.alignSelectedShapes('center-v'); } },
          { label: 'Align Bottom', icon: '⫴', action: () => { this.#toolManager.alignSelectedShapes('bottom'); } },
          ...(selectedIds.length >= 3 ? [
            { type: 'separator' },
            { label: 'Distribute Horizontally', icon: '↔', action: () => { this.#toolManager.distributeSelectedShapes('horizontal'); } },
            { label: 'Distribute Vertically', icon: '↕', action: () => { this.#toolManager.distributeSelectedShapes('vertical'); } },
          ] : []),
        ] });
        items.push({ type: 'separator' });
        items.push({ label: 'Delete All', icon: '🗑', danger: true, action: () => { this.#toolManager.deleteSelected(); this.renderCurrentPage(); } });
      }
      if (selectedIds.length === 0) {
        items.push({ label: 'Paste', icon: '📄', shortcut: 'Ctrl+V', action: () => this.#toolManager.pasteClipboard() });
        items.push({ label: 'Paste Here', icon: '📄', action: () => this.#toolManager.pasteAt(x, y) });
      }
      if (items.length > 0) {
        contextMenu.items = items;
        contextMenu.show(x, y);
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
    this.#setupClipboardEvents();

    this.loadFile();
  }

  disconnectedCallback() {
    destroyPersistence();
    destroyShortcuts();
    destroyCollaboration();
    document.removeEventListener('copy', this._onCopy);
    document.removeEventListener('cut', this._onCut);
    document.removeEventListener('paste', this._onPaste);
    if (this.#toolManager) {
      this.#toolManager.destroy();
      this.#toolManager = null;
    }
    if (this.#boundPointerMove) {
      const canvas = this.querySelector('#canvas');
      if (canvas) canvas.removeEventListener('pointermove', this.#boundPointerMove);
      this.#boundPointerMove = null;
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
    const rSidebar = this.querySelector('#right-sidebar');
    if (rSidebar) rSidebar.toolManager = this.#toolManager;
    wireShortcuts(this.#toolManager, this);
  }

  #fixDeletedFonts(file, teamFonts) {
    if (!file || !file.data) return;
    const libChanges = fixDeletedFontsForLibrary(file.data, teamFonts);
    if (libChanges.length > 0) {
      enqueueChanges(libChanges);
      for (const change of libChanges) {
        if (change.type === 'mod-typography' && change.typography) {
          const typo = change.typography;
          const typoId = typo.id;
          if (typoId && this.#fileData.data.typographies) {
            const existing = this.#fileData.data.typographies[typoId] ||
              this.#fileData.data.typographies.find(t => t.id === typoId);
            if (existing && typeof existing === 'object') {
              Object.assign(existing, typo);
            }
          }
        }
      }
    }
  }

  #fixDeletedFontsForPage(page, teamFonts) {
    if (!page || !page.objects) return;
    const { changes, missingFonts } = fixDeletedFontsForPage(this.#fileData, page, teamFonts);
    if (changes.length > 0) {
      enqueueChanges(changes);
      for (const change of changes) {
        if (change.type === 'mod-obj' && change.pageId === page.id && change.id) {
          const shape = page.objects[change.id];
          if (shape && change.operations) {
            for (const op of change.operations) {
              if (op.type === 'set' && op.attr === 'content') {
                shape.content = op.val;
              } else if (op.type === 'set' && op.attr === 'position-data') {
                shape['position-data'] = op.val;
              }
            }
          }
        }
      }
      this.renderCurrentPage();
    }
    if (missingFonts.length > 0) {
      const rightSidebar = this.querySelector('#right-sidebar');
      if (rightSidebar) rightSidebar.missingFonts = missingFonts;
    }
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

  #handleShapeDelete(shapeId) {
    if (!shapeId) return;
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const shapes = this.#toolManager.getCurrentPageShapes();
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) return;
    this.#toolManager.deleteSelected();
    enqueueChange(makeDeleteChange(page.id, shapeId));
  }

  #handleShapeUpdate({ shapeId, updates }) {
    if (!shapeId || !updates) return;
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const props = { ...updates };
    delete props.id;
    delete props.type;
    for (const [key, val] of Object.entries(props)) {
      this.#toolManager.updateShapeProp(shapeId, key, val);
    }
    enqueueChange(makeModifyChange(page.id, shapeId, props));
    this.renderCurrentPage();
    this.#pushSelectedShapeToRightSidebar();
  }

  #startPathEdit(shapeId, shape) {
    const canvasEl = this.querySelector('#canvas');
    if (!canvasEl) return;
    const svgEl = canvasEl.querySelector('svg') || canvasEl.querySelector('#container svg');
    if (!svgEl) return;
    if (!this.#pathEditor) {
      this.#pathEditor = new PathEditor(svgEl, this);
      this.#pathEditor.setGetShapeFn((id) => this.#findShapeById(id));
      if (this.#toolManager) this.#toolManager.pathEditor = this.#pathEditor;
    }
    this.#pathEditor.startEdit(shapeId, shape);
  }

  #onPathEditStart({ shapeId, editMode }) {
    if (!this.#pathToolbarEl) {
      this.#pathToolbarEl = document.createElement('penpot-path-toolbar');
      const canvasArea = this.querySelector('.penpot-app__canvas-area');
      if (canvasArea) canvasArea.appendChild(this.#pathToolbarEl);
    }
    this.#pathToolbarEl.state = { editMode, selectedCount: 0, snapToggled: false };
    this.#pathToolbarEl.style.display = '';
    this.#selectedIds.clear();
    this.#selectedIds.add(shapeId);
    this.#pushSelectedShapeToRightSidebar();
  }

  #onPathEditStop({ shapeId }) {
    if (this.#pathToolbarEl) {
      this.#pathToolbarEl.style.display = 'none';
    }
    if (this.#pathEditor) {
      this.#pathEditor.stopEdit();
    }
    this.renderCurrentPage();
  }

  #onPathEditMode({ editMode }) {
    if (this.#pathToolbarEl && this.#pathEditor) {
      this.#pathToolbarEl.state = {
        editMode,
        selectedCount: this.#pathEditor.selectedPoints.size,
        snapToggled: this.#pathEditor.snapToggled,
      };
    }
  }

  #handlePathContentChange({ shapeId, content, shape }) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const shapes = this.#toolManager.getCurrentPageShapes();
    let target = shapes[shapeId] || shapes.find(s => s.id === shapeId);
    if (!target) return;
    const newShape = shape || { ...target, content };
    this.#toolManager.updateShapeProp(shapeId, 'content', content);
    if (newShape.x !== undefined) this.#toolManager.updateShapeProp(shapeId, 'x', newShape.x);
    if (newShape.y !== undefined) this.#toolManager.updateShapeProp(shapeId, 'y', newShape.y);
    if (newShape.width !== undefined) this.#toolManager.updateShapeProp(shapeId, 'width', newShape.width);
    if (newShape.height !== undefined) this.#toolManager.updateShapeProp(shapeId, 'height', newShape.height);
    enqueueChange(makeModifyChange(page.id, shapeId, {
      content,
      x: newShape.x,
      y: newShape.y,
      width: newShape.width,
      height: newShape.height,
    }));
    this.renderCurrentPage();
    if (this.#pathEditor) this.#pathEditor.render(newShape);
  }

  #handlePathPreview({ shapeId, shape }) {
    const shapes = this.#toolManager.getCurrentPageShapes();
    const target = shapes[shapeId] || shapes.find(s => s.id === shapeId);
    if (!target) return;
    Object.assign(target, shape);
    this.renderCurrentPage();
  }

  #handlePathAction(action) {
    if (!this.#pathEditor) return;
    switch (action) {
      case 'move': this.#pathEditor.setEditMode('move'); break;
      case 'draw': this.#pathEditor.setEditMode('draw'); break;
      case 'add-node': this.#pathEditor.addNode(); break;
      case 'remove-node': this.#pathEditor.removeNodes(); break;
      case 'make-corner': this.#pathEditor.makeCorner(); break;
      case 'make-curve': this.#pathEditor.makeCurve(); break;
      case 'merge-nodes': this.#pathEditor.mergeNodes(); break;
      case 'join-nodes': this.#pathEditor.joinNodes(); break;
      case 'separate-nodes': this.#pathEditor.separateNodes(); break;
      case 'toggle-snap': this.#pathEditor.toggleSnap(); break;
    }
    if (this.#pathToolbarEl) {
      this.#pathToolbarEl.state = {
        editMode: this.#pathEditor.editMode,
        selectedCount: this.#pathEditor.selectedPoints.size,
        snapToggled: this.#pathEditor.snapToggled,
      };
    }
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

  #setupClipboardEvents() {
    this._onCopy = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      if (!this.#toolManager || this.#selectedIds.size === 0) return;
      e.preventDefault();
      this.#toolManager.copySelected();
    };
    this._onCut = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      if (!this.#toolManager || this.#selectedIds.size === 0) return;
      e.preventDefault();
      this.#toolManager.cutSelected();
      this.renderCurrentPage();
    };
    this._onPaste = async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      e.preventDefault();
      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const hasPenpotData = Array.from(clipboardData.types).some(t => t === 'application/json+penpot' || (t === 'text/plain' && clipboardData.getData('text/plain')?.startsWith('{"type":"penpot-shapes"')));
      const hasImage = Array.from(clipboardData.types).some(t => t.startsWith('image/'));
      const hasSVG = clipboardData.getData('text/plain')?.trim().startsWith('<svg') || clipboardData.getData('text/html')?.trim().startsWith('<svg');

      if (hasPenpotData) {
        const text = clipboardData.getData('text/plain');
        try {
          const parsed = JSON.parse(text);
          if (parsed.type === 'penpot-shapes' && Array.isArray(parsed.shapes)) {
            const { assignNewIds } = await import('../lib/clipboard.js');
            const shapes = assignNewIds(parsed.shapes);
            const canvas = this.querySelector('#canvas');
            const offset = 20;
            const newIds = [];
            for (const shape of shapes) {
              const newShape = { ...shape, x: (shape.x || 0) + offset, y: (shape.y || 0) + offset };
              this.#handleShapeCreate(newShape);
              newIds.push(newShape.id);
            }
            if (this.#toolManager) {
              this.#toolManager.clearSelection();
              for (const id of newIds) this.#toolManager.selectShape(id);
            }
            this.renderCurrentPage();
            return;
          }
        } catch {}
      }

      if (hasSVG) {
        const svgText = clipboardData.getData('text/plain') || clipboardData.getData('text/html');
        if (svgText && svgText.trim().startsWith('<svg')) {
          try {
            const { parseSVG } = await import('../lib/svg-import.js');
            const svgShapes = parseSVG(svgText);
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
            this.renderCurrentPage();
            return;
          } catch (err) {
            console.warn('[workspace] SVG paste error:', err);
          }
        }
      }

      if (hasImage) {
        const imageFile = Array.from(clipboardData.files).find(f => f.type.startsWith('image/'));
        if (imageFile && this.#fileData?.id) {
          try {
            const { cmdUpload } = await import('../lib/rpc.js');
            const result = await cmdUpload('upload-file-media-object', imageFile, {
              fileId: this.#fileData.id,
              name: imageFile.name || 'pasted-image',
              isLocal: 'true',
            });
            if (result) {
              const { makeAddMediaChange } = await import('../lib/persistence.js');
              const mediaEntry = {
                id: result.id,
                name: result.name || imageFile.name || 'pasted-image',
                mtype: result.mtype || imageFile.type,
                width: result.width || 100,
                height: result.height || 100,
                mediaId: result.mediaId,
                thumbnailId: result.thumbnailId || null,
              };
              if (!this.#fileData.data) this.#fileData.data = {};
              if (!this.#fileData.data.media) this.#fileData.data.media = {};
              this.#fileData.data.media[mediaEntry.id] = mediaEntry;
              enqueueChange(makeAddMediaChange(mediaEntry));
              const shape = createShape('image', {
                x: 100,
                y: 100,
                width: result.width || 100,
                height: result.height || 100,
                href: mediaEntry.id,
              });
              this.#handleShapeCreate(shape);
            }
          } catch (err) {
            console.warn('[workspace] Image paste error:', err);
          }
          return;
        }
      }

      const textData = clipboardData.getData('text/plain');
      if (textData && textData.trim() && !textData.startsWith('{')) {
        const canvas = this.querySelector('#canvas');
        if (canvas && this.#toolManager) {
          const zoom = canvas.zoom || 1;
          const panX = canvas.panX || 0;
          const panY = canvas.panY || 0;
          const rect = canvas.getBoundingClientRect();
          const cx = (rect.width / 2 - panX * zoom) / zoom;
          const cy = (rect.height / 2 - panY * zoom) / zoom;
          const shape = createShape('text', {
            x: cx - 50,
            y: cy - 10,
            width: 200,
            height: 30,
            content: textData.trim(),
            flexGrow: 0,
          });
          this.#handleShapeCreate(shape);
          return;
        }
      }
    };

    document.addEventListener('copy', this._onCopy);
    document.addEventListener('cut', this._onCut);
    document.addEventListener('paste', this._onPaste);
  }

  #setupDragDrop() {
    const assetTypes = ['application/penpot-component', 'application/penpot-color', 'application/penpot-typography'];
    const isAssetDrag = (types) => types?.some(t => assetTypes.includes(t));
    let dragCounter = 0;

    this.addEventListener('dragover', (e) => {
      const types = e.dataTransfer?.types;
      if (types?.includes('Files') || isAssetDrag(types)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    this.addEventListener('dragenter', (e) => {
      const types = e.dataTransfer?.types;
      if (isAssetDrag(types)) {
        e.preventDefault();
        dragCounter++;
        this.classList.add('penpot-workspace__drag-over');
      }
    });

    this.addEventListener('dragleave', (e) => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        this.classList.remove('penpot-workspace__drag-over');
      }
    });

    this.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      this.classList.remove('penpot-workspace__drag-over');

      const dt = e.dataTransfer;
      if (!dt) return;

      const canvasEl = this.querySelector('#canvas');
      const containerRect = (canvasEl?.querySelector('.penpot-canvas__container') || canvasEl)?.getBoundingClientRect();
      const zoom = canvasEl?.zoom || 1;
      const panX = canvasEl?.panX || 0;
      const panY = canvasEl?.panY || 0;
      const canvasX = containerRect ? (e.clientX - containerRect.left - panX * zoom) / zoom : e.clientX;
      const canvasY = containerRect ? (e.clientY - containerRect.top - panY * zoom) / zoom : e.clientY;

      const componentId = dt.getData('application/penpot-component');
      if (componentId) {
        this.#placeComponentAt(componentId, canvasX, canvasY);
        return;
      }

      const colorId = dt.getData('application/penpot-color');
      if (colorId) {
        this.#applyColorAt(colorId, canvasX, canvasY);
        return;
      }

      const typoId = dt.getData('application/penpot-typography');
      if (typoId) {
        this.#applyTypographyAt(typoId, canvasX, canvasY);
        return;
      }

      const files = dt.files;
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
          const fileId = this.#fileData?.id;
          if (fileId) {
            try {
              const result = await cmdUpload('upload-file-media-object', file, {
                fileId,
                name: file.name || 'image',
                isLocal: 'true',
              });
              if (result) {
                const mediaEntry = {
                  id: result.id,
                  name: result.name || file.name || 'image',
                  mtype: result.mtype || file.type,
                  width: result.width || 100,
                  height: result.height || 100,
                  mediaId: result.mediaId,
                  thumbnailId: result.thumbnailId || null,
                };
                if (!this.#fileData.data) this.#fileData.data = {};
                if (!this.#fileData.data.media) this.#fileData.data.media = {};
                this.#fileData.data.media[mediaEntry.id] = mediaEntry;
                enqueueChange(makeAddMediaChange(mediaEntry));
                const assetPanel = this.querySelector('#asset-panel');
                if (assetPanel) {
                  assetPanel.media = Object.values(this.#fileData.data.media);
                }
                const shape = createShape('image', {
                  x: Math.round(canvasX - (result.width || 100) / 2),
                  y: Math.round(canvasY - (result.height || 100) / 2),
                  width: result.width || 100,
                  height: result.height || 100,
                  href: mediaEntry.id,
                });
                this.#handleShapeCreate(shape);
                return;
              }
            } catch (err) {
              console.error('[workspace] image upload error, falling back to data URL:', err);
            }
          }
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
            const dataUrl = imageToDataURL(img, w, h);
            const shape = createShape('image', { x: canvasX, y: canvasY, width: Math.round(w), height: Math.round(h), href: dataUrl });
            this.#handleShapeCreate(shape);
            URL.revokeObjectURL(url);
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
    this.renderCurrentPage();

    if (this.#fileData) {
      const page = this.#pages[this.#currentPageIndex];
      sendSelectionUpdate(this.#fileData.id, page?.id, this.#selectedIds);
    }
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
    if (prop === 'fills' || prop === 'strokes' || prop === 'shadows' || prop === 'exports') {
      this.#toolManager.updateShapeProp(shapeId, prop, value);
      const page = this.#pages[this.#currentPageIndex];
      if (page) enqueueChange(makeModifyChange(page.id, shapeId, { [prop]: value }));
      return;
    }
    if (prop === 'blur') {
      this.#toolManager.updateShapeProp(shapeId, 'blur', Number(value) || 0);
      const page = this.#pages[this.#currentPageIndex];
      if (page) enqueueChange(makeModifyChange(page.id, shapeId, { blur: Number(value) || 0 }));
      return;
    }
    if (['r1', 'r2', 'r3', 'r4'].includes(prop)) {
      const page = this.#pages[this.#currentPageIndex];
      const shape = page ? this.#findShape(page, shapeId) : null;
      if (shape) {
        const newVal = Number(value) || 0;
        const r1 = prop === 'r1' ? newVal : (shape.r1 ?? shape.rx ?? 0);
        const r2 = prop === 'r2' ? newVal : (shape.r2 ?? shape.rx ?? 0);
        const r3 = prop === 'r3' ? newVal : (shape.r3 ?? shape.rx ?? 0);
        const r4 = prop === 'r4' ? newVal : (shape.r4 ?? shape.rx ?? 0);
        this.#toolManager.updateShapeProp(shapeId, 'r1', r1);
        this.#toolManager.updateShapeProp(shapeId, 'r2', r2);
        this.#toolManager.updateShapeProp(shapeId, 'r3', r3);
        this.#toolManager.updateShapeProp(shapeId, 'r4', r4);
        if (page) enqueueChange(makeModifyChange(page.id, shapeId, { r1, r2, r3, r4 }));
      }
      return;
    }

    const textContentProps = new Set([
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
      'lineHeight', 'letterSpacing', 'textDecoration', 'textTransform',
      'textAlign', 'textDirection',
    ]);

    if (textContentProps.has(prop)) {
      this.#toolManager.updateShapeProp(shapeId, prop, value);
      const page = this.#pages[this.#currentPageIndex];
      if (page) {
        const shape = this.#findShape(page, shapeId);
        if (shape && shape.type === 'text' && textTypes.isContentTree(shape.content)) {
          const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          const contentPropMap = {
            fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight',
            fontStyle: 'font-style', lineHeight: 'line-height', letterSpacing: 'letter-spacing',
            textDecoration: 'text-decoration', textTransform: 'text-transform',
            textAlign: 'text-align', textDirection: 'text-direction',
          };
          const contentKey = contentPropMap[prop] || kebabProp;
          let newContent;
          if (prop === 'textAlign' || prop === 'textDirection') {
            newContent = textTypes.updateParagraphAttrs(shape.content, { [contentKey]: String(value) });
          } else {
            newContent = textTypes.updateTextAttrs(shape.content, { [contentKey]: String(value) });
          }
          this.#toolManager.updateShapeProp(shapeId, 'content', newContent);
          const numericProps = new Set(['fontSize', 'lineHeight', 'letterSpacing']);
          const finalValue = numericProps.has(prop) ? (Number(value) || value) : String(value);
          enqueueChange(makeModifyChange(page.id, shapeId, { [prop]: finalValue, content: newContent }));
        } else {
          const numericProps = new Set(['fontSize', 'lineHeight', 'letterSpacing']);
          const finalValue = numericProps.has(prop) ? (Number(value) || value) : value;
          enqueueChange(makeModifyChange(page.id, shapeId, { [prop]: finalValue }));
        }
      }
      return;
    }

    this.#toolManager.updateShapeProp(shapeId, prop, value);
    const page = this.#pages[this.#currentPageIndex];
    if (page) {
      const propMap = { x: 'x', y: 'y', w: 'width', h: 'height', rotation: 'rotation', opacity: 'opacity' };
      const mappedProp = propMap[prop] || prop;
      const numericProps = new Set(['x', 'y', 'width', 'height', 'rotation', 'opacity', 'fontSize', 'lineHeight', 'letterSpacing', 'blur']);
      const finalValue = numericProps.has(mappedProp) ? (Number(value) || value) : value;
      enqueueChange(makeModifyChange(page.id, shapeId, { [mappedProp]: finalValue }));
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

  #handleVariantAddProperty({ shapeId, variantId }) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;

    const componentData = this.#fileData?.data?.components;
    if (!componentData) return;

    const component = shape.componentId ? componentData[shape.componentId] : Object.values(componentData).find(c => c['variant-id'] === variantId);
    if (!component) return;

    const existingProps = component['variant-properties'] || component.variantProperties || [];
    const newProp = { name: `Property ${nextPropertyNumber(existingProps)}`, value: 'Value 1' };
    const updatedProps = [...existingProps, newProp];

    const variantComponents = Object.entries(componentData)
      .filter(([, c]) => c['variant-id'] === variantId);

    for (const [compId, comp] of variantComponents) {
      const compProps = comp['variant-properties'] || comp.variantProperties || [];
      compProps[existingProps.length] = { name: newProp.name, value: '' };
      comp['variant-properties'] = [...compProps];
      const mainShape = this.#findMainShapeForComponent(compId);
      if (mainShape) {
        enqueueChange(makeModifyChange(page.id, mainShape.id, { 'variant-name': propertiesToName(compProps) }));
      }
    }

    this.renderCurrentPage();
  }

  #handleVariantAddVariant({ shapeId, variantId }) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page || !this.#toolManager) return;

    const componentData = this.#fileData?.data?.components;
    if (!componentData) return;

    const variants = Object.entries(componentData)
      .filter(([, c]) => c['variant-id'] === variantId);

    if (variants.length === 0) return;

    const sourceComp = variants[0][1];
    const sourceShape = this.#findMainShapeForComponent(variants[0][0]);
    if (!sourceShape) return;

    const newId = crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
    const newShapeId = crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

    const newShape = {
      ...sourceShape,
      id: newShapeId,
      componentId: variants[0][0],
      x: (sourceShape.x || 0) + (sourceShape.width || 100) + 20,
      'component-root': false,
      componentRoot: false,
    };

    const objects = page.objects || page.children;
    if (Array.isArray(objects)) {
      objects.push(newShape);
    } else if (objects) {
      objects[newShapeId] = newShape;
    }

    enqueueChange(makeCreateChange(page.id, newShapeId, newShape));
    this.renderCurrentPage();
  }

  #handleVariantUpdatePropertyName({ shapeId, variantId, pos, newName }) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;

    const componentData = this.#fileData?.data?.components;
    if (!componentData) return;

    const variants = Object.entries(componentData)
      .filter(([, c]) => c['variant-id'] === variantId);

    for (const [compId, comp] of variants) {
      const props = comp['variant-properties'] || comp.variantProperties || [];
      if (pos < props.length) {
        props[pos] = { ...props[pos], name: newName };
        comp['variant-properties'] = [...props];
        const mainShape = this.#findMainShapeForComponent(compId);
        if (mainShape) {
          enqueueChange(makeModifyChange(page.id, mainShape.id, { 'variant-name': propertiesToName(props) }));
        }
      }
    }

    this.renderCurrentPage();
  }

  #handleVariantRemoveProperty({ shapeId, variantId, pos }) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;

    const componentData = this.#fileData?.data?.components;
    if (!componentData) return;

    const variants = Object.entries(componentData)
      .filter(([, c]) => c['variant-id'] === variantId);

    for (const [compId, comp] of variants) {
      const props = comp['variant-properties'] || comp.variantProperties || [];
      props.splice(pos, 1);
      comp['variant-properties'] = [...props];
      const mainShape = this.#findMainShapeForComponent(compId);
      if (mainShape) {
        enqueueChange(makeModifyChange(page.id, mainShape.id, { 'variant-name': propertiesToName(props) }));
      }
    }

    this.renderCurrentPage();
  }

  #handleVariantSwitch({ shapeId, variantId, propIndex, newValue }) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;

    const shape = this.#findShape(page, shapeId);
    if (!shape) return;

    const componentData = this.#fileData?.data?.components;
    if (!componentData) return;

    const currentComp = shape.componentId ? componentData[shape.componentId] : null;
    if (!currentComp) return;

    const currentProps = currentComp['variant-properties'] || currentComp.variantProperties || [];
    const allVariants = Object.entries(componentData)
      .filter(([, c]) => c['variant-id'] === variantId);

    const currentValues = currentProps.map(p => p.value || '');
    currentValues[propIndex] = newValue;

    let bestVariant = null;
    let bestDist = Infinity;
    for (const [compId, comp] of allVariants) {
      const vProps = comp['variant-properties'] || comp.variantProperties || [];
      const vValues = vProps.map(p => p.value || '');
      let dist = 0;
      for (let i = 0; i < Math.max(currentValues.length, vValues.length); i++) {
        if ((currentValues[i] || '') !== (vValues[i] || '')) dist += Math.pow(2, Math.max(currentValues.length, vValues.length) - i);
      }
      if (dist < bestDist) {
        bestDist = dist;
        bestVariant = compId;
      }
    }

    if (bestVariant) {
      shape.componentId = bestVariant;
      const touched = new Set(shape.touched || []);
      touched.add(`swap-slot-${bestVariant}`);
      shape.touched = touched;
      shape['component-root'] = false;
      shape.componentRoot = false;
      enqueueChange(makeModifyChange(page.id, shapeId, { 'component-id': bestVariant, 'component-root': false, touched: [...touched] }));
      this.renderCurrentPage();
    }
  }

  #handleVariantSelect({ componentId }) {
    const mainShapeId = this.#findMainShapeIdForComponent(componentId);
    if (mainShapeId) {
      this.emit('penpot-shape-select', { selectedIds: [mainShapeId] });
    }
  }

  #handleCombineAsVariants() {
    const selectedIds = this.#toolManager?.getSelectedIds?.() || [];
    if (selectedIds.length < 2) return;

    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;

    const shapes = this.#toolManager.getCurrentPageShapes();
    const selectedShapes = selectedIds.map(id => this.#findShape(page, id)).filter(Boolean);
    if (selectedShapes.length < 2) return;

    const variantId = crypto.randomUUID ? crypto.randomUUID() : 'var-' + Date.now() + '-' + Math.random().toString(36).slice(2);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of selectedShapes) {
      if (s.x != null && s.y != null) {
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + (s.width || 0));
        maxY = Math.max(maxY, s.y + (s.height || 0));
      }
    }
    if (minX === Infinity) return;

    const padding = 20;
    const frameX = minX - padding;
    const frameY = minY - padding;
    const frameW = (maxX - minX) + padding * 2;
    const frameH = (maxY - minY) + padding * 2;

    const frameId = 'frame-' + Date.now() + '-' + Math.random().toString(36).slice(2);

    const frameShape = {
      id: frameId,
      type: 'frame',
      name: 'Variant Container',
      x: frameX,
      y: frameY,
      width: frameW,
      height: frameH,
      fills: [],
      strokes: [{ style: 'dashed', width: 1, color: { color: '#7b6ff2', opacity: 1 } }],
      layout: 'flex',
      'layout-content-h': null,
      'layout-content-v': null,
      'gap': 20,
      'layout-gap': { row: 20, column: 20 },
      'layout-padding-type': 'simple',
      'layout-padding': { top: 20, right: 20, bottom: 20, left: 20 },
      'layout-align-items': 'stretch',
      'layout-justify-content': 'flex-start',
      'is-variant-container': true,
      isVariantContainer: true,
      'variant-id': variantId,
      shapes: selectedShapes.map(s => s.id),
      visible: true,
      locked: false,
    };

    const changes = [];
    changes.push(makeCreateChange(page.id, frameShape));

    for (const shape of selectedShapes) {
      const propName = shape.name || shape.type || 'Variant';
      const variantProps = [{ name: 'State', value: propName }];

      const relativeX = (shape.x || 0) - minX + padding;
      const relativeY = (shape.y || 0) - minY + padding;

      changes.push(makeModifyChange(page.id, shape.id, {
        x: relativeX,
        y: relativeY,
        'parent-id': frameId,
        parentId: frameId,
        'variant-id': variantId,
      }));

      if (shape.componentId) {
        const comp = this.#fileData?.data?.components?.[shape.componentId];
        if (comp) {
          comp['variant-id'] = variantId;
          comp['variant-properties'] = variantProps;
          comp['variant-name'] = propertiesToName(variantProps);
          changes.push(makeModifyChange(page.id, shape.id, {
            'variant-name': propertiesToName(variantProps),
          }));
        }
      }
    }

    for (const change of changes) {
      enqueueChange(change);
    }

    this.renderCurrentPage();
  }

  #findMainShapeIdForComponent(componentId) {
    if (!this.#pages) return null;
    for (const page of this.#pages) {
      const objects = page?.objects || page?.children;
      if (!objects) continue;
      const shapes = Array.isArray(objects) ? objects : Object.values(objects);
      for (const s of shapes) {
        if (s.componentId === componentId) return s.id;
      }
    }
    return null;
  }

  #convertToPath(shapeId) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page || !this.#toolManager) return;
    const shapes = this.#toolManager.getCurrentPageShapes();
    const shape = shapes[shapeId] || shapes.find(s => s.id === shapeId);
    if (!shape) return;
    try {
      const pathShape = convertToPath(shape, shapes);
      if (!pathShape || !pathShape.content) return;
      const newShape = { ...shape, type: 'path', content: pathShape.content };
      this.#toolManager.updateShapeProp(shapeId, 'type', 'path');
      this.#toolManager.updateShapeProp(shapeId, 'content', pathShape.content);
      enqueueChange(makeModifyChange(page.id, shapeId, { type: 'path', content: pathShape.content }));
      this.renderCurrentPage();
    } catch (err) {
      console.warn('[workspace] Convert to path failed:', err?.message || err);
    }
  }

  #handleLayoutChange({ shapeId, prop, value }) {
    if (!this.#toolManager) return;
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;

    const isLayoutContainer = shape.layout === 'flex' || shape.layout === 'grid' || value === 'flex' || value === 'grid';
    const wasLayoutContainer = shape.layout === 'flex' || shape.layout === 'grid';

    if (prop === 'layout') {
      if (value === 'none') {
        delete shape.layout;
        delete shape['layout-flex-dir'];
        delete shape['layout-gap'];
        delete shape['layout-gap-type'];
        delete shape['layout-wrap-type'];
        delete shape['layout-padding'];
        delete shape['layout-padding-type'];
        delete shape['layout-justify-content'];
        delete shape['layout-align-items'];
        delete shape['layout-align-content'];
        delete shape['layout-grid-dir'];
        delete shape['layout-grid-rows'];
        delete shape['layout-grid-columns'];
      } else {
        shape.layout = value;
        if (value === 'flex' && !shape['layout-flex-dir']) {
          shape['layout-flex-dir'] = 'row';
          shape['layout-gap'] = { 'row-gap': 0, 'column-gap': 0 };
          shape['layout-gap-type'] = 'simple';
          shape['layout-wrap-type'] = 'nowrap';
          shape['layout-padding'] = { p1: 0, p2: 0, p3: 0, p4: 0 };
          shape['layout-padding-type'] = 'simple';
          shape['layout-justify-content'] = 'start';
          shape['layout-align-items'] = 'stretch';
          shape['layout-align-content'] = 'stretch';
        }
        if (value === 'grid' && !shape['layout-grid-dir']) {
          shape['layout-grid-dir'] = 'row';
          shape['layout-grid-rows'] = [{ type: 'flex', value: 1 }];
          shape['layout-grid-columns'] = [{ type: 'flex', value: 1 }];
          shape['layout-gap'] = { 'row-gap': 0, 'column-gap': 0 };
          shape['layout-padding'] = { p1: 0, p2: 0, p3: 0, p4: 0 };
          shape['layout-justify-items'] = 'stretch';
          shape['layout-align-items'] = 'stretch';
        }
      }
    } else if (prop === 'layout-padding') {
      shape['layout-padding'] = value;
      if (!shape['layout-padding-type']) shape['layout-padding-type'] = 'multiple';
      else if (value.p1 === value.p2 && value.p2 === value.p3 && value.p3 === value.p4) {
        shape['layout-padding-type'] = 'simple';
      } else {
        shape['layout-padding-type'] = 'multiple';
      }
    } else if (prop === 'layout-gap') {
      shape['layout-gap'] = value;
      shape['layout-gap-type'] = (value['row-gap'] === value['column-gap']) ? 'simple' : 'multiple';
    } else if (prop.startsWith('layout-grid-')) {
      shape[prop] = value;
    } else {
      shape[prop] = value;
    }

    const layoutProps = {};
    for (const k of Object.keys(shape)) {
      if (k.startsWith('layout') || k === 'layout') {
        layoutProps[k] = shape[k];
      }
    }
    if (prop === 'layout' && value === 'none') {
      for (const k of ['layout', 'layout-flex-dir', 'layout-gap', 'layout-gap-type', 'layout-wrap-type', 'layout-padding', 'layout-padding-type', 'layout-justify-content', 'layout-align-items', 'layout-align-content', 'layout-grid-dir', 'layout-grid-rows', 'layout-grid-columns', 'layout-justify-items']) {
        if (shape[k] === undefined) layoutProps[k] = null;
      }
    }

    this.#toolManager.updateShapeProp(shapeId, prop, shape[prop] || value);
    enqueueChange(makeModifyChange(page.id, shapeId, layoutProps));

    if (isLayoutContainer) {
      try {
        const objects = this.#getPageObjects(page);
        const childUpdates = reflowLayout(objects, shapeId);
        for (const update of childUpdates) {
          if (this.#toolManager) {
            if (update.x !== undefined) this.#toolManager.updateShapeProp(update.id, 'x', update.x);
            if (update.y !== undefined) this.#toolManager.updateShapeProp(update.id, 'y', update.y);
            if (update.width !== undefined) this.#toolManager.updateShapeProp(update.id, 'width', update.width);
            if (update.height !== undefined) this.#toolManager.updateShapeProp(update.id, 'height', update.height);
          }
          const pageObj = this.#pages[this.#currentPageIndex];
          if (pageObj) {
            const childProps = {};
            if (update.x !== undefined) childProps.x = update.x;
            if (update.y !== undefined) childProps.y = update.y;
            if (update.width !== undefined) childProps.width = update.width;
            if (update.height !== undefined) childProps.height = update.height;
            if (Object.keys(childProps).length > 0) {
              enqueueChange(makeModifyChange(pageObj.id, update.id, childProps));
            }
          }
        }
      } catch (err) {
        console.warn('[workspace] Layout reflow failed:', err?.message || err);
      }
    }

    this.renderCurrentPage();
    this.#pushSelectedShapeToRightSidebar();
  }

  #handleApplyColorToken({ token, index }) {
    const page = this.#pages[this.#currentPageIndex];
    const shapeId = [...this.#selectedIds][0];
    if (!shapeId || !page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;
    const fills = [...(shape.fills || [])];
    const newFill = {
      type: 'solid',
      color: token.color,
      opacity: 1,
      'fill-color-ref-id': token.id,
      'fill-color-ref-file': this.#fileData?.id
    };
    if (fills.length === 0) { fills.push(newFill); } else { fills[0] = newFill; }
    this.#toolManager.updateShapeProp(shapeId, 'fills', fills);
    const pageObj = this.#pages[this.#currentPageIndex];
    if (pageObj) enqueueChange(makeModifyChange(pageObj.id, shapeId, { fills }));
    this.renderCurrentPage();
    this.#pushSelectedShapeToRightSidebar();
  }

  #handleApplyTypoToken({ token, index }) {
    const page = this.#pages[this.#currentPageIndex];
    const shapeId = [...this.#selectedIds][0];
    if (!shapeId || !page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape || shape.type !== 'text') return;
    const updates = {};
    if (token.fontFamily) updates.fontFamily = token.fontFamily;
    if (token.fontSize) updates.fontSize = token.fontSize;
    if (token.fontWeight) updates.fontWeight = token.fontWeight;
    if (token.fontStyle) updates.fontStyle = token.fontStyle;
    if (token.lineHeight) updates.lineHeight = token.lineHeight;
    if (token.letterSpacing) updates.letterSpacing = token.letterSpacing;
    updates['typography-ref-id'] = token.id;
    updates['typography-ref-file'] = this.#fileData?.id;
    for (const [key, val] of Object.entries(updates)) {
      this.#toolManager.updateShapeProp(shapeId, key, val);
    }
    if (page) enqueueChange(makeModifyChange(page.id, shapeId, updates));
    this.renderCurrentPage();
    this.#pushSelectedShapeToRightSidebar();
  }

  #handleTokenAdd({ type }) {
    if (!this.#fileData) this.#fileData = { data: {} };
    if (!this.#fileData.data) this.#fileData.data = {};
    switch (type) {
      case 'color': {
        if (!this.#fileData.data.colors) this.#fileData.data.colors = [];
        const colorId = crypto.randomUUID ? crypto.randomUUID() : `color-${Date.now()}`;
        const colorObj = { id: colorId, name: `Color ${this.#fileData.data.colors.length + 1}`, color: '#000000' };
        this.#fileData.data.colors.push(colorObj);
        enqueueChange({ type: 'add-color', color: colorObj });
        break;
      }
      case 'typography': {
        if (!this.#fileData.data.typographies) this.#fileData.data.typographies = [];
        const typoId = crypto.randomUUID ? crypto.randomUUID() : `typo-${Date.now()}`;
        const typo = { id: typoId, name: `Typography ${this.#fileData.data.typographies.length + 1}`, fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'normal', fontStyle: 'normal' };
        this.#fileData.data.typographies.push(typo);
        enqueueChange({ type: 'add-typography', typography: typo });
        break;
      }
      case 'token-set': {
        if (!this.#fileData.data.tokenSets) this.#fileData.data.tokenSets = [];
        const setId = crypto.randomUUID ? crypto.randomUUID() : `set-${Date.now()}`;
        this.#fileData.data.tokenSets.push({ id: setId, name: `Set ${this.#fileData.data.tokenSets.length + 1}`, colors: [], typographies: [] });
        enqueueChange({ type: 'set-token-set', id: setId, attrs: { name: `Set ${this.#fileData.data.tokenSets.length}` } });
        break;
      }
      case 'theme': {
        if (!this.#fileData.data.themes) this.#fileData.data.themes = [];
        const themeId = crypto.randomUUID ? crypto.randomUUID() : `theme-${Date.now()}`;
        this.#fileData.data.themes.push({ id: themeId, name: `Theme ${this.#fileData.data.themes.length + 1}`, groups: [] });
        enqueueChange({ type: 'set-token-theme', id: themeId, theme: this.#fileData.data.themes[this.#fileData.data.themes.length - 1] });
        break;
      }
    }
    const tokensPanel = this.querySelector('penpot-tokens-panel');
    if (tokensPanel) tokensPanel.fileData = this.#fileData;
  }

  #handleTokenDelete({ type, index }) {
    if (!this.#fileData?.data) return;
    switch (type) {
      case 'color': {
        if (this.#fileData.data.colors) {
          const color = this.#fileData.data.colors[index];
          this.#fileData.data.colors.splice(index, 1);
          if (color) enqueueChange({ type: 'del-color', id: color.id });
        }
        break;
      }
      case 'typography': {
        if (this.#fileData.data.typographies) {
          const typo = this.#fileData.data.typographies[index];
          this.#fileData.data.typographies.splice(index, 1);
          if (typo) enqueueChange({ type: 'del-typography', id: typo.id });
        }
        break;
      }
    }
    const tokensPanel = this.querySelector('penpot-tokens-panel');
    if (tokensPanel) tokensPanel.fileData = this.#fileData;
  }

  #handleTokenUpdate({ type, index, prop, value }) {
    if (!this.#fileData?.data) return;
    switch (type) {
      case 'color': {
        const colors = this.#fileData.data.colors;
        if (colors && colors[index]) {
          colors[index][prop] = value;
          enqueueChange({ type: 'mod-color', color: { ...colors[index] } });
        }
        break;
      }
      case 'typography': {
        const typos = this.#fileData.data.typographies;
        if (typos && typos[index]) {
          typos[index][prop] = value;
          enqueueChange({ type: 'mod-typography', typography: { ...typos[index] } });
        }
        break;
      }
    }
    const tokensPanel = this.querySelector('penpot-tokens-panel');
    if (tokensPanel) tokensPanel.fileData = this.#fileData;
  }

  #handleTokenSetActivate({ index }) {
    if (!this.#fileData?.data) return;
    this.#fileData.data.activeTokenSetIndex = index;
    enqueueChange({ type: 'set-active-token-themes', themes: this.#fileData.data.activeTokenThemes || [this.#fileData.data.activeTheme || 'default'] });
    const tokensPanel = this.querySelector('penpot-tokens-panel');
    if (tokensPanel) tokensPanel.fileData = this.#fileData;
  }

  #handleTokenSetDelete({ index }) {
    if (!this.#fileData?.data) return;
    const sets = this.#fileData.data.tokenSets;
    if (!sets || index < 0 || index >= sets.length) return;
    const setId = sets[index].id || `set-${index}`;
    sets.splice(index, 1);
    if (this.#fileData.data.activeTokenSetIndex >= sets.length) {
      this.#fileData.data.activeTokenSetIndex = Math.max(0, sets.length - 1);
    }
    enqueueChange({ type: 'set-token-set', id: setId });
    const tokensPanel = this.querySelector('penpot-tokens-panel');
    if (tokensPanel) tokensPanel.fileData = this.#fileData;
  }

  #handleTokenThemeChange({ theme }) {
    if (!this.#fileData?.data) return;
    this.#fileData.data.activeTheme = theme;
    const activeSetIndex = this.#fileData.data.activeTokenSetIndex ?? 0;
    const sets = this.#fileData.data.tokenSets || [];
    const setId = sets[activeSetIndex]?.id || `set-${activeSetIndex}`;
    const themeObj = (this.#fileData.data.themes || []).find(t => t.name === theme);
    if (themeObj && themeObj.groups && themeObj.groups[activeSetIndex]) {
      const group = themeObj.groups[activeSetIndex];
      if (group.colors) this.#fileData.data.colors = [...group.colors];
      if (group.typographies) this.#fileData.data.typographies = [...group.typographies];
    }
    enqueueChange({ type: 'set-active-token-themes', themes: [theme] });
    const tokensPanel = this.querySelector('penpot-tokens-panel');
    if (tokensPanel) tokensPanel.fileData = this.#fileData;
  }

  async #handlePluginInstall({ plugin }) {
    if (!this.#pluginManager) return;
    try {
      const { pluginId, api } = await this.#pluginManager.loadPlugin(plugin.url || plugin.host);
      this.emit('penpot-notification', { type: 'success', message: `Plugin "${plugin.name}" installed` });
    } catch (err) {
      this.emit('penpot-notification', { type: 'danger', message: `Failed to install plugin: ${err.message}` });
    }
  }

  async #handlePluginOpen({ plugin }) {
    if (!this.#pluginManager) return;
    try {
      await this.#pluginManager.openPlugin(plugin.id);
      this.#activePluginId = plugin.id;
    } catch (err) {
      this.emit('penpot-notification', { type: 'danger', message: `Failed to open plugin: ${err.message}` });
    }
  }

  #handlePluginRemove({ pluginId }) {
    if (!this.#pluginManager) return;
    this.#pluginManager.unloadPlugin(pluginId);
    this.#activePluginId = null;
    this.emit('penpot-notification', { type: 'info', message: `Plugin removed` });
  }

  #handleShapeResize({ shapeId, x, y, width, height }) {
    if (!this.#toolManager) return;
    const page = this.#pages[this.#currentPageIndex];
    const oldShape = page ? this.#findShape(page, shapeId) : null;
    this.#toolManager.resizeShape(shapeId, x, y, width, height);

    if (oldShape && (oldShape.type === 'frame' || oldShape.type === 'group') && oldShape.shapes && oldShape.shapes.length > 0) {
      try {
        const objects = this.#getPageObjects(page);
        const isLayout = oldShape.layout === 'flex' || oldShape.layout === 'grid';
        if (isLayout) {
          const childUpdates = reflowLayoutWithResize(objects, shapeId, oldShape, { x, y, width, height });
          for (const update of childUpdates) {
            if (this.#toolManager) {
              if (update.x !== undefined) this.#toolManager.updateShapeProp(update.id, 'x', update.x);
              if (update.y !== undefined) this.#toolManager.updateShapeProp(update.id, 'y', update.y);
              if (update.width !== undefined) this.#toolManager.updateShapeProp(update.id, 'width', update.width);
              if (update.height !== undefined) this.#toolManager.updateShapeProp(update.id, 'height', update.height);
            }
            const pageObj = this.#pages[this.#currentPageIndex];
            if (pageObj) {
              const childProps = {};
              if (update.x !== undefined) childProps.x = update.x;
              if (update.y !== undefined) childProps.y = update.y;
              if (update.width !== undefined) childProps.width = update.width;
              if (update.height !== undefined) childProps.height = update.height;
              if (Object.keys(childProps).length > 0) enqueueChange(makeModifyChange(pageObj.id, update.id, childProps));
            }
          }
        } else {
          const childUpdates = propagateFrameResize(objects, shapeId, oldShape, { x, y, width, height });
          for (const update of childUpdates) {
            if (this.#toolManager) {
              this.#toolManager.updateShapeProp(update.id, 'x', update.x);
              this.#toolManager.updateShapeProp(update.id, 'y', update.y);
              if (update.width !== undefined) this.#toolManager.updateShapeProp(update.id, 'width', update.width);
              if (update.height !== undefined) this.#toolManager.updateShapeProp(update.id, 'height', update.height);
            }
            const pageObj = this.#pages[this.#currentPageIndex];
            if (pageObj) enqueueChange(makeModifyChange(pageObj.id, update.id, { x: update.x, y: update.y, ...(update.width !== undefined ? { width: update.width } : {}), ...(update.height !== undefined ? { height: update.height } : {}) }));
          }
        }
      } catch (err) {
        console.warn('[workspace] Constraint/layout propagation failed:', err?.message || err);
      }
    }

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

  #maskSelected() {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    if (this.#selectedIds.size < 2) return;
    const objects = page.objects || page.children;
    if (!objects) return;
    const shapes = Array.isArray(objects) ? objects : Object.values(objects);
    const selectedShapes = [...this.#selectedIds].map(id => shapes.find(s => s.id === id)).filter(Boolean);
    if (selectedShapes.length < 2) return;

    const maskGroup = {
      id: crypto.randomUUID(),
      type: 'group',
      name: 'Mask Group',
      'masked-group': true,
      maskedGroup: true,
      x: Math.min(...selectedShapes.map(s => s.x || 0)),
      y: Math.min(...selectedShapes.map(s => s.y || 0)),
      width: Math.max(...selectedShapes.map(s => (s.x || 0) + (s.width || 0))) - Math.min(...selectedShapes.map(s => s.x || 0)),
      height: Math.max(...selectedShapes.map(s => (s.y || 0) + (s.height || 0))) - Math.min(...selectedShapes.map(s => s.y || 0)),
      fills: [],
      strokes: [],
      objects: selectedShapes.map(s => ({ ...s })),
      visible: true,
      locked: false,
    };

    const idsToRemove = new Set(selectedShapes.map(s => s.id));
    const newObjects = shapes.filter(s => !idsToRemove.has(s.id));
    newObjects.push(maskGroup);
    if (Array.isArray(objects)) {
      page.objects = newObjects;
    } else {
      page.children = newObjects;
    }

    enqueueChange(makeCreateChange(page.id, maskGroup, maskGroup.parentId));

    this.#selectedIds = new Set([maskGroup.id]);
    const leftSidebar = this.querySelector('#left-sidebar');
    if (leftSidebar) leftSidebar.selectedIds = this.#selectedIds;
    this.renderCurrentPage();
  }

  #moveShape(sourceId, targetId, targetParentId, position) {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const objects = page.objects || page.children;
    if (!objects) return;

    const sourceShape = this.#findShape(page, sourceId);
    if (!sourceShape) return;
    const targetShape = this.#findShape(page, targetId);
    if (!targetShape) return;

    if (position === 'into') {
      this.#reparentShapeInto(sourceId, targetId, page);
    } else {
      this.#reorderShapeRelative(sourceId, targetId, targetParentId, position, page);
    }
  }

  #reparentShapeInto(sourceId, parentId, page) {
    const objects = page.objects || page.children;
    if (!objects) return;

    const isMap = !Array.isArray(objects);
    const objMap = isMap ? objects : this.#buildObjectMap(page);
    const sourceShape = objMap[sourceId];
    const parentShape = objMap[parentId];
    if (!sourceShape || !parentShape) return;

    const oldParentId = sourceShape.parentId || sourceShape['parent-id'];
    if (oldParentId) {
      const oldParent = objMap[oldParentId];
      if (oldParent && Array.isArray(oldParent.shapes)) {
        oldParent.shapes = oldParent.shapes.filter(id => id !== sourceId);
      } else if (oldParent) {
        const childList = oldParent.objects || oldParent.children;
        if (Array.isArray(childList)) {
          const idx = childList.findIndex(s => s.id === sourceId);
          if (idx >= 0) childList.splice(idx, 1);
        }
      }
    } else {
      if (isMap) {
        page.shapes = (page.shapes || Object.keys(objects)).filter(id => id !== sourceId);
      } else {
        const idx = objects.findIndex(s => s.id === sourceId);
        if (idx >= 0) objects.splice(idx, 1);
      }
    }

    if (isMap) {
      sourceShape.parentId = parentId;
      if (sourceShape['parent-id'] !== undefined) sourceShape['parent-id'] = parentId;
      if (sourceShape.frameId !== undefined) sourceShape.frameId = parentId;
      if (sourceShape['frame-id'] !== undefined) sourceShape['frame-id'] = parentId;
      if (!parentShape.shapes) parentShape.shapes = [];
      parentShape.shapes.push(sourceId);
    } else {
      if (!parentShape.objects) parentShape.objects = [];
      parentShape.objects.push(sourceShape);
      if (!parentShape.shapes) parentShape.shapes = [];
      parentShape.shapes.push(sourceId);
      sourceShape.parentId = parentId;
    }

    enqueueChange(makeMoveChange(page.id, sourceId, null, null, parentId));
    this.renderCurrentPage();
  }

  #reorderShapeRelative(sourceId, targetId, targetParentId, position, page) {
    const objects = page.objects || page.children;
    if (!objects) return;

    const isMap = !Array.isArray(objects);

    if (isMap) {
      this.#reorderInObjectMap(sourceId, targetId, targetParentId, position, page, objects);
    } else {
      this.#reorderInArrayList(sourceId, targetId, targetParentId, position, page, objects);
    }

    this.renderCurrentPage();
  }

  #reorderInObjectMap(sourceId, targetId, targetParentId, position, page, objects) {
    const sourceShape = objects[sourceId];
    if (!sourceShape) return;
    const targetShape = objects[targetId];
    if (!targetShape) return;

    const oldParentId = sourceShape.parentId || sourceShape['parent-id'];
    if (oldParentId) {
      const oldParent = objects[oldParentId];
      if (oldParent && Array.isArray(oldParent.shapes)) {
        oldParent.shapes = oldParent.shapes.filter(id => id !== sourceId);
      }
    } else {
      page.shapes = (page.shapes || []).filter(id => id !== sourceId);
    }

    const newParentId = position === 'before' || position === 'after'
      ? (targetShape.parentId || targetShape['parent-id'] || null)
      : targetParentId;

    if (newParentId) {
      const newParent = objects[newParentId];
      if (newParent && Array.isArray(newParent.shapes)) {
        const targetIndex = newParent.shapes.indexOf(targetId);
        if (targetIndex >= 0) {
          const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
          newParent.shapes.splice(insertIndex, 0, sourceId);
        } else {
          newParent.shapes.push(sourceId);
        }
      }
      sourceShape.parentId = newParentId;
      if (sourceShape['parent-id'] !== undefined) sourceShape['parent-id'] = newParentId;
      if (sourceShape.frameId !== undefined) sourceShape.frameId = newParentId;
      if (sourceShape['frame-id'] !== undefined) sourceShape['frame-id'] = newParentId;
    } else {
      if (!page.shapes) page.shapes = [];
      const targetIndex = page.shapes.indexOf(targetId);
      const insertIndex = position === 'before' ? Math.max(0, targetIndex) : targetIndex + 1;
      page.shapes.splice(insertIndex, 0, sourceId);
      sourceShape.parentId = undefined;
      if (sourceShape['parent-id'] !== undefined) delete sourceShape['parent-id'];
    }

    const changeParentId = newParentId || page.id;
    enqueueChange(makeMoveChange(page.id, sourceId, null, null, changeParentId));
  }

  #reorderInArrayList(sourceId, targetId, targetParentId, position, page, objects) {
    const sourceShape = this.#findShape(page, sourceId);
    const targetShape = this.#findShape(page, targetId);
    if (!sourceShape || !targetShape) return;

    const findAndRemove = (list) => {
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (s.id === sourceId) {
          list.splice(i, 1);
          return true;
        }
        const childList = s.objects || s.children || s.shapes;
        if (Array.isArray(childList)) {
          if (findAndRemove(childList)) return true;
        }
      }
      return false;
    };
    findAndRemove(objects);

    const findListContaining = (list, id) => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return { list, index: i };
        const childList = list[i].objects || list[i].children || list[i].shapes;
        if (Array.isArray(childList)) {
          const result = findListContaining(childList, id);
          if (result) return result;
        }
      }
      return null;
    };

    const targetLoc = findListContaining(objects, targetId);
    if (!targetLoc) return;

    const insertIndex = position === 'before' ? targetLoc.index : targetLoc.index + 1;
    targetLoc.list.splice(insertIndex, 0, sourceShape);
  }

  #buildObjectMap(page) {
    const objects = page.objects || page.children || {};
    if (!Array.isArray(objects)) return objects;
    const map = {};
    const walk = (list, parentId) => {
      for (const s of list) {
        map[s.id] = s;
        if (parentId) {
          s.parentId = parentId;
        }
        const children = s.objects || s.children || s.shapes;
        if (Array.isArray(children)) {
          walk(children, s.id);
        }
      }
    };
    walk(objects, null);
    return map;
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
          if (s.objects || s.children || s.shapes) {
            const children = Array.isArray(s.objects || s.children || s.shapes) ? (s.objects || s.children || s.shapes) : Object.values(s.objects || s.children || {});
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

  #getPageObjects(page) {
    if (!page) return {};
    const objects = page.objects || page.children || {};
    if (Array.isArray(objects)) {
      const map = {};
      const flatten = (items) => {
        for (const s of items) {
          map[s.id] = s;
          if (s.objects || s.children || s.shapes) {
            const children = Array.isArray(s.objects || s.children || s.shapes) ? (s.objects || s.children || s.shapes) : Object.values(s.objects || s.children || {});
            flatten(children);
          }
        }
      };
      flatten(objects);
      return map;
    }
    return objects;
  }

  #findShapeAtPoint(x, y) {
    const shapes = this.#toolManager?.getCurrentPageShapes();
    if (!shapes) return null;
    const candidates = Object.values(shapes).filter(s => {
      if (s.type === 'frame' && s.id === '00000000-0000-0000-0000-000000000000') return false;
      if (s.visible === false || s.locked) return false;
      if (s.parentId && shapes[s.parentId]?.type !== 'frame') return false;
      const sx = s.x || 0, sy = s.y || 0;
      const sw = s.width || 0, sh = s.height || 0;
      return x >= sx && x <= sx + sw && y >= sy && y <= sy + sh;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const az = a['layout-item-z-index'] ?? 0;
      const bz = b['layout-item-z-index'] ?? 0;
      if (az !== bz) return bz - az;
      const aParent = a.parentId;
      const bParent = b.parentId;
      if (aParent && bParent && aParent === bParent) {
        const parent = shapes[aParent];
        const children = parent?.shapes || parent?.children || [];
        const aIdx = Array.isArray(children) ? children.indexOf(a.id) : -1;
        const bIdx = Array.isArray(children) ? children.indexOf(b.id) : -1;
        if (aIdx !== -1 && bIdx !== -1) return bIdx - aIdx;
      }
      return 0;
    });
    return candidates[0].id;
  }

  #getCurrentPageFrames() {
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return [];
    const objects = page.objects || page.children || {};
    if (Array.isArray(objects)) {
      return objects.filter(obj => obj.type === 'frame' && obj.id !== '00000000-0000-0000-0000-000000000000');
    }
    return Object.values(objects).filter(obj => obj.type === 'frame' && obj.id !== '00000000-0000-0000-0000-000000000000');
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
    const canvas = this.querySelector('#canvas');
    if (canvas) {
      this.#boundPointerMove = (e) => {
        const containerRect = (canvas.querySelector('.penpot-canvas__container') || canvas).getBoundingClientRect();
        const zoom = canvas.zoom || 1;
        const panX = canvas.panX || 0;
        const panY = canvas.panY || 0;
        this.#lastPointerX = (e.clientX - containerRect.left - panX * zoom) / zoom;
        this.#lastPointerY = (e.clientY - containerRect.top - panY * zoom) / zoom;
        const page = this.#pages[this.#currentPageIndex];
        if (page) this.#lastPointerPageId = page.id;
      };
      canvas.addEventListener('pointermove', this.#boundPointerMove, { passive: true });
    }
    this.#pointerThrottle = setInterval(() => {
      this.#broadcastPointer();
    }, 100);
  }

  #broadcastPointer() {
    if (!this.#fileData || !this.#lastPointerPageId) return;
    sendPointerUpdate(this.#fileData.id, this.#lastPointerX, this.#lastPointerY, this.#lastPointerPageId, this.#selectedIds ? [...this.#selectedIds] : []);
  }

  #handleRemotePointer(data) {
    const cursorOverlay = this.querySelector('#cursors');
    if (!cursorOverlay) return;
    const positions = getCursorPositions();
    const page = this.#pages[this.#currentPageIndex];
    const currentPageId = page ? page.id : null;
    const filteredPositions = currentPageId
      ? positions.filter(p => !p.page || p.page === currentPageId)
      : positions;
    cursorOverlay.cursors = filteredPositions;

    const remoteSelections = [];
    for (const pos of positions) {
      if (pos.page && currentPageId && pos.page !== currentPageId) continue;
      const selIds = pos.selectedIds || [];
      if (selIds.length > 0 && page) {
        const objects = page.objects || page.children || {};
        const shapes = Array.isArray(objects) ? objects : Object.values(objects);
        const selectedShapes = selIds.map(id => shapes.find(s => s.id === id)).filter(Boolean);
        if (selectedShapes.length > 0) {
          remoteSelections.push({ color: pos.color, name: pos.name || 'User', shapes: selectedShapes });
        }
      }
    }
    cursorOverlay.remoteSelections = remoteSelections;
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

  #handleMenuAction(detail) {
    const { action, checked } = detail || {};
    const canvas = this.querySelector('#canvas');
    const tools = this.querySelector('#tools');
    switch (action) {
      case 'new-file': {
        const name = prompt('New file name:', 'Untitled');
        if (name) window.__penpot.navigate('dashboard');
        break;
      }
      case 'save':
        this.saveFile();
        break;
      case 'save-as':
        break;
      case 'import': {
        const importDialog = this.querySelector('#import-dialog');
        if (importDialog) importDialog.open();
        break;
      }
      case 'export': {
        const exportDialog = this.querySelector('#export-dialog');
        if (exportDialog) {
          const page = this.#pages[this.#currentPageIndex];
          exportDialog.page = page;
          exportDialog.pages = this.#pages;
          exportDialog.open();
        }
        break;
      }
      case 'back-to-dashboard':
        window.__penpot.navigate('dashboard');
        break;
      case 'undo':
        if (this.#toolManager) this.#toolManager.undo();
        break;
      case 'redo':
        if (this.#toolManager) this.#toolManager.redo();
        break;
      case 'copy':
        if (this.#toolManager) this.#toolManager.copySelected();
        break;
      case 'cut':
        if (this.#toolManager) this.#toolManager.cutSelected();
        this.renderCurrentPage();
        break;
      case 'paste':
        if (this.#toolManager) this.#toolManager.pasteClipboard();
        break;
      case 'duplicate':
        if (this.#toolManager) this.#toolManager.duplicateSelected();
        break;
      case 'delete':
        if (this.#toolManager) this.#toolManager.deleteSelected();
        this.renderCurrentPage();
        break;
      case 'select-all':
        if (this.#toolManager) this.#toolManager.selectAll();
        this.renderCurrentPage();
        break;
      case 'deselect':
        if (this.#toolManager) this.#toolManager.clearSelection();
        break;
      case 'group':
        if (this.#toolManager) this.#toolManager.groupSelected();
        this.renderCurrentPage();
        break;
      case 'ungroup':
        if (this.#toolManager) this.#toolManager.ungroupSelected();
        this.renderCurrentPage();
        break;
      case 'zoom-in':
        if (canvas) { canvas.zoom = canvas.zoom * 1.25; }
        if (tools) tools.zoom = canvas?.zoom || 1;
        break;
      case 'zoom-out':
        if (canvas) { canvas.zoom = canvas.zoom / 1.25; }
        if (tools) tools.zoom = canvas?.zoom || 1;
        break;
      case 'zoom-fit':
        if (canvas) {
          const page = this.#pages[this.#currentPageIndex];
          if (page) {
            const objects = page.objects || page.children || {};
            const shapes = Array.isArray(objects) ? objects : Object.values(objects);
            canvas.fitToContent(shapes);
          } else {
            canvas.zoom = 1;
          }
        }
        if (tools) tools.zoom = canvas?.zoom || 1;
        break;
      case 'zoom-100':
        if (canvas) canvas.zoom = 1;
        if (tools) tools.zoom = 1;
        break;
      case 'zoom-200':
        if (canvas) canvas.zoom = 2;
        if (tools) tools.zoom = 2;
        break;
      case 'zoom-selection':
        if (canvas && this.#toolManager) {
          const selectedIds = this.#toolManager.getSelectedIds();
          const page = this.#pages[this.#currentPageIndex];
          if (selectedIds.length > 0 && page) {
            const objects = page.objects || page.children || {};
            const allShapes = Array.isArray(objects) ? objects : Object.values(objects);
            const selected = allShapes.filter(s => selectedIds.includes(s.id));
            canvas.zoomToSelection(selected);
            if (tools) tools.zoom = canvas.zoom;
          }
        }
        break;
      case 'toggle-rulers': {
        const canvasEl = this.querySelector('#canvas');
        if (canvasEl && typeof canvasEl.toggleRulers === 'function') {
          canvasEl.toggleRulers(checked);
        }
        break;
      }
      case 'toggle-grid': {
        const canvasEl = this.querySelector('#canvas');
        if (canvasEl && typeof canvasEl.toggleGrid === 'function') {
          canvasEl.toggleGrid(checked);
        }
        break;
      }
      case 'toggle-snap': {
        const canvasEl = this.querySelector('#canvas');
        if (canvasEl && typeof canvasEl.toggleSnap === 'function') {
          canvasEl.toggleSnap(checked);
        }
        break;
      }
      case 'toggle-comments':
        this.#toggleCommentPanel();
        break;
      case 'toggle-version-history': {
        const versionPanel = this.querySelector('#version-panel');
        if (versionPanel) {
          const isVisible = versionPanel.style.display !== 'none';
          versionPanel.style.display = isVisible ? 'none' : '';
          if (!isVisible) versionPanel.fileId = this.#fileData?.id;
        }
        break;
      }
      case 'show-shortcuts': {
        const ref = this.querySelector('#shortcuts-ref');
        if (ref) ref.open();
        break;
      }
    }
  }

  #updateScrollbars() {
    const canvas = this.querySelector('#canvas');
    const scrollbars = this.querySelector('#scrollbars');
    if (!canvas || !scrollbars) return;
    const page = this.#pages[this.#currentPageIndex];
    if (!page) { scrollbars.viewport = { zoom: canvas.zoom || 1, panX: -(canvas.panX || 0), panY: -(canvas.panY || 0), width: 0, height: 0 }; return; }
    const objects = page.objects || page.children || {};
    const shapes = Array.isArray(objects) ? objects : Object.values(objects);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of shapes) {
      const sx = s.x || 0, sy = s.y || 0, sw = s.width || 0, sh = s.height || 0;
      if (sw > 0 && sh > 0) {
        minX = Math.min(minX, sx);
        minY = Math.min(minY, sy);
        maxX = Math.max(maxX, sx + sw);
        maxY = Math.max(maxY, sy + sh);
      }
    }
    const container = canvas.querySelector('.penpot-canvas__canvas-container') || canvas;
    scrollbars.viewport = {
      zoom: canvas.zoom || 1,
      panX: canvas.panX || 0,
      panY: canvas.panY || 0,
      width: container.clientWidth,
      height: container.clientHeight,
    };
    if (minX < Infinity) {
      const padding = 200;
      scrollbars.contentBounds = { x: minX - padding, y: minY - padding, width: (maxX - minX) + padding * 2, height: (maxY - minY) + padding * 2 };
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

  #toggleMcpPanel(show) {
    const overlay = this.querySelector('#mcp-overlay');
    if (!overlay) return;
    if (show === undefined) {
      show = !overlay.classList.contains('penpot-app__open');
    }
    overlay.classList.toggle('penpot-app__open', show);
  }

  #togglePluginPanel(show) {
    const overlay = this.querySelector('#plugin-overlay');
    if (!overlay) return;
    if (show === undefined) {
      show = !overlay.classList.contains('penpot-app__open');
    }
    overlay.classList.toggle('penpot-app__open', show);
    const pluginUI = this.querySelector('#plugin-manager-ui');
    if (pluginUI) {
      const plugins = this.#pluginManager ? this.#pluginManager.getLoadedPlugins() : [];
      pluginUI.plugins = plugins;
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

      const rightSidebar = this.querySelector('#right-sidebar');
      if (rightSidebar) rightSidebar.fileData = file;

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
        } catch (err) {
          console.warn('[workspace] Failed to load page data:', err?.message || err);
          this.#pages = [];
        }
      }

      const fileComponents = file.data?.components || file.components || {};
      if (Object.keys(fileComponents).length > 0) {
        appStore.set('currentFileComponents', fileComponents);
      }

      const assetPanel = this.querySelector('#asset-panel');
      if (assetPanel) {
        const fileColors = file.data?.colors || {};
        assetPanel.colors = Object.values(fileColors);
        assetPanel.recentColors = this.#recentColors;
        const fileTypographies = file.data?.typographies || {};
        assetPanel.typographies = Object.values(fileTypographies);
        const fileComponents = file.data?.components || file.components || {};
        if (Object.keys(fileComponents).length > 0) {
          assetPanel.components = Object.entries(fileComponents).map(([id, comp]) => ({
            id,
            name: comp.name || comp.path || 'Component',
            path: comp.path || '',
            type: comp.type || 'frame',
          }));
        }
        const fileMedia = file.data?.media || {};
        if (Object.keys(fileMedia).length > 0) {
          assetPanel.media = Object.values(fileMedia).map(m => ({
            id: m.id || m.mediaId,
            name: m.name || 'Image',
            mtype: m.mtype,
            width: m.width,
            height: m.height,
            mediaId: m.mediaId || m.id,
            thumbnailId: m.thumbnailId,
          }));
        } else {
          this.#loadMediaAssets(file.id);
        }
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

      const teamId = appStore.get('currentTeamId');
      let teamFonts = [];
      if (teamId) {
        loadTeamFontsIntoDocument(teamId);
        try {
          teamFonts = await fetchTeamFonts(teamId);
          const rightSidebar = this.querySelector('#right-sidebar');
          const textToolbar = this.querySelector('#text-toolbar');
          if (rightSidebar) rightSidebar.teamFonts = teamFonts;
          if (textToolbar) textToolbar.teamFonts = teamFonts;
        } catch (e) {
          console.warn('[workspace] failed to load team fonts for UI:', e);
        }
      }

      this.#fixDeletedFonts(file, teamFonts);

      for (let i = 0; i < this.#pages.length; i++) {
        this.#fixDeletedFontsForPage(this.#pages[i], teamFonts);
      }
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

    const selectedIds = this.#toolManager ? [...this.#toolManager.selectedIds] : [];
    canvas.renderPage(page, selectedIds);
    this.#updateScrollbars();

    if (selectedIds.length === 1) {
      const objects = page.objects || page.children || {};
      const shapes = Array.isArray(objects) ? objects : Object.values(objects);
      canvas.showGradientHandles(shapes, selectedIds);
      canvas.showMeasurements(shapes, selectedIds);
      canvas.showInteractions(objects, this.#getCurrentPageFrames());
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
    if (!this.#selectedIds || this.#selectedIds.size === 0) {
      if (rightSidebar) { rightSidebar.selectedShape = null; rightSidebar.selectedIds = []; }
      this.renderCurrentPage();
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
    this.renderCurrentPage();
    this.#updateTextToolbar();
  }

  async saveFile(name) {
    if (!this.#fileData) return;
    const fileName = name || this.querySelector('#toolbar')?.fileName || 'Untitled';
    try {
      await flushSave();
      await cmd('rename-file', { id: this.#fileData.id, name: fileName });
      this.#generateThumbnail();
    } catch (err) {
      console.error('[workspace] save error:', err);
    }
  }

  #generateThumbnail() {
    if (!this.#fileData || !this.#fileData.id) return;
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const objects = page.objects || page.children || {};
    const topIds = page.shapes || Object.keys(objects);
    const topShapes = topIds.map(id => objects[id]).filter(Boolean);
    const thumbnailData = {
      ...page,
      objects: topShapes,
      width: 400,
      height: 250,
    };
    generateAndUploadThumbnail(this.#fileData.id, page.id, thumbnailData, { width: 400, height: 250 }).catch(err => {
      console.warn('[workspace] Thumbnail upload failed:', err?.message || err);
    });
  }

  async #loadMediaAssets(fileId) {
    try {
      const mediaList = await cmd('get-file-media-objects', { fileId });
      const assetPanel = this.querySelector('#asset-panel');
      if (assetPanel && Array.isArray(mediaList) && mediaList.length > 0) {
        assetPanel.media = mediaList.map(m => ({
          id: m.id,
          name: m.name || 'Image',
          mtype: m.mtype,
          width: m.width || 0,
          height: m.height || 0,
          mediaId: m.mediaId,
          thumbnailId: m.thumbnailId || null,
        }));
      }
    } catch (err) {
      console.error('[workspace] Failed to load media assets:', err);
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

    if (textTypes.isContentTree(shape.content)) {
      editor.innerHTML = contentTreeToHTML(shape.content);
    } else {
      editor.textContent = shape.content || shape.text || '';
    }

    editor.style.cssText = `position:absolute;left:${screenX - canvasRect.left}px;top:${screenY - canvasRect.top}px;width:${screenW}px;min-height:${screenH}px;background:var(--penpot-input-bg,#333);border:2px solid var(--penpot-primary,#31efb8);color:var(--penpot-text,#e6e6e6);font-size:${(shape.fontSize || 14) * zoom}px;font-family:var(--penpot-font-family,sans-serif);padding:2px 4px;outline:none;z-index:100;overflow-wrap:break-word;white-space:pre-wrap;line-height:1.4;`;

    const commitEdit = () => {
      const innerHTML = editor.innerHTML;
      const plainText = editor.textContent?.trim() || '';
      editor.remove();

      let newContent;
      let contentChanged = false;

      if (textTypes.isContentTree(shape.content)) {
        const baseAttrs = {
          'font-id': shape.fontId || 'sourcesanspro',
          'font-family': shape.fontFamily || 'sourcesanspro',
          'font-size': String(shape.fontSize || 14),
          'font-weight': String(shape.fontWeight || '400'),
          'font-style': shape.fontStyle || 'normal',
          'line-height': String(shape.lineHeight || '1.2'),
          'letter-spacing': String(shape.letterSpacing || '0'),
          'text-decoration': shape.textDecoration || 'none',
          'text-transform': shape.textTransform || 'none',
          'text-align': shape.textAlign || 'left',
          'text-direction': shape.textDirection || 'ltr',
          'vertical-align': shape.verticalAlign || 'top',
          fills: shape.fills && shape.fills.length > 0
            ? shape.fills.map(f => f['fill-color'] ? f : { 'fill-color': `#${Math.round((f.color?.r ?? 0)*255).toString(16).padStart(2,'0')}${Math.round((f.color?.g ?? 0)*255).toString(16).padStart(2,'0')}${Math.round((f.color?.b ?? 0)*255).toString(16).padStart(2,'0')}`, 'fill-opacity': f.opacity ?? 1 })
            : [{ 'fill-color': '#000000', 'fill-opacity': 1 }],
        };
        newContent = htmlToContentTree(innerHTML, baseAttrs);
        contentChanged = JSON.stringify(newContent) !== JSON.stringify(shape.content);
      } else {
        const oldPlainText = typeof shape.content === 'string' ? shape.content : (shape.content ? textTypes.contentToPlainText(shape.content) : '');
        newContent = plainText;
        contentChanged = plainText !== oldPlainText;
      }

      if (!shapeId || !contentChanged) return;

      if (this.#toolManager) {
        this.#toolManager.updateShapeProp(shapeId, 'content', newContent);
        this.renderCurrentPage();
      }
      const page = this.#pages[this.#currentPageIndex];
      if (page) {
        enqueueChange(makeModifyChange(page.id, shapeId, { content: newContent }));
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

  #placeComponentAt(componentId, x, y) {
    if (!componentId || !this.#toolManager) return;
    const shapes = this.#toolManager.getCurrentPageShapes();
    if (!shapes) return;

    const mainShape = findMainInstanceForComponent(shapes, componentId);
    if (!mainShape) {
      this.emit('penpot-notification', { type: 'warning', message: 'Component main instance not found' });
      return;
    }

    const offsetX = Math.round(x - (mainShape.width || 0) / 2);
    const offsetY = Math.round(y - (mainShape.height || 0) / 2);
    const { shapes: newShapes, rootId } = createInstanceFromComponent(mainShape, shapes, offsetX, offsetY);

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

  #applyColorAt(colorId, canvasX, canvasY) {
    if (!colorId || !this.#fileData) return;
    const colorObj = this.#fileData.data?.colors?.[colorId];
    if (!colorObj) return;

    this.#recentColors = this.#recentColors.filter(c => c.id !== colorId);
    this.#recentColors.unshift(colorObj);
    if (this.#recentColors.length > 10) this.#recentColors = this.#recentColors.slice(0, 10);
    this.#updateAssetPanelColors();

    const hitShapeId = this.#findShapeAtPoint(canvasX, canvasY);
    if (hitShapeId) {
      const page = this.#pages[this.#currentPageIndex];
      const shape = this.#findShape(page, hitShapeId);
      if (shape) {
        const fills = shape.fills ? [...shape.fills] : [];
        fills.push({
          'fill-type': 'solid',
          'fill-color': colorObj.color,
          'fill-opacity': colorObj.opacity ?? 1,
          'fill-color-ref-id': colorObj.id,
          'fill-color-ref-file': this.#fileData.id,
        });
        if (this.#toolManager) this.#toolManager.updateShapeProp(hitShapeId, 'fills', fills);
        enqueueChange(makeModifyChange(page.id, hitShapeId, { fills }));
        this.emit('penpot-notification', { type: 'success', message: `Applied color "${colorObj.name || colorObj.color}"` });
        return;
      }
    }

    if (this.#selectedIds.size === 1) {
      const shapeId = [...this.#selectedIds][0];
      const page = this.#pages[this.#currentPageIndex];
      const shape = page ? this.#findShape(page, shapeId) : null;
      if (shape) {
        const fills = shape.fills ? [...shape.fills] : [];
        fills.push({
          'fill-type': 'solid',
          'fill-color': colorObj.color,
          'fill-opacity': colorObj.opacity ?? 1,
          'fill-color-ref-id': colorObj.id,
          'fill-color-ref-file': this.#fileData.id,
        });
        if (this.#toolManager) this.#toolManager.updateShapeProp(shapeId, 'fills', fills);
        enqueueChange(makeModifyChange(page.id, shapeId, { fills }));
        this.emit('penpot-notification', { type: 'success', message: `Applied color "${colorObj.name || colorObj.color}"` });
        return;
      }
    }

    this.emit('penpot-notification', { type: 'info', message: 'Drop a color onto a shape to apply it as fill' });
  }

  #applyTypographyAt(typoId, canvasX, canvasY) {
    if (!typoId || !this.#fileData) return;
    const typo = this.#fileData.data?.typographies?.[typoId];
    if (!typo) return;

    const hitShapeId = this.#findShapeAtPoint(canvasX, canvasY);
    const targetId = hitShapeId || (this.#selectedIds.size === 1 ? [...this.#selectedIds][0] : null);
    if (!targetId) {
      this.emit('penpot-notification', { type: 'info', message: 'Drop a typography onto a text shape to apply it' });
      return;
    }

    const page = this.#pages[this.#currentPageIndex];
    const shape = page ? this.#findShape(page, targetId) : null;
    if (!shape) return;

    if (shape.type !== 'text') {
      this.emit('penpot-notification', { type: 'warning', message: 'Typographies can only be applied to text shapes' });
      return;
    }

    const props = {};
    if (typo['font-family']) props.fontFamily = typo['font-family'];
    if (typo['font-size']) props.fontSize = Number(typo['font-size']);
    if (typo['font-weight']) props.fontWeight = typo['font-weight'];
    if (typo['font-style']) props.fontStyle = typo['font-style'];
    if (typo['line-height']) props.lineHeight = typo['line-height'];
    if (typo['letter-spacing']) props.letterSpacing = typo['letter-spacing'];
    if (typo['text-transform']) props.textTransform = typo['text-transform'];
    if (this.#toolManager) {
      for (const [k, v] of Object.entries(props)) {
        this.#toolManager.updateShapeProp(targetId, k, v);
      }
    }
    enqueueChange(makeModifyChange(page.id, targetId, props));
    this.emit('penpot-notification', { type: 'success', message: `Applied typography "${typo.name}"` });
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

  #updateAssetPanelColors() {
    const assetPanel = this.querySelector('#asset-panel');
    if (!assetPanel || !this.#fileData) return;
    const colors = this.#fileData.data?.colors || {};
    assetPanel.colors = Object.values(colors);
    assetPanel.recentColors = this.#recentColors;
    const libs = this.#fileData.data?.libraries || [];
    const libColors = [];
    for (const lib of libs) {
      const lc = lib.data?.colors || {};
      for (const c of Object.values(lc)) {
        libColors.push({ ...c, libraryId: lib.id });
      }
    }
    assetPanel.libraryColors = libColors;
  }

  #updateAssetPanelTypographies() {
    const assetPanel = this.querySelector('#asset-panel');
    if (!assetPanel || !this.#fileData) return;
    const typographies = this.#fileData.data?.typographies || {};
    assetPanel.typographies = Object.values(typographies);
    const libs = this.#fileData.data?.libraries || [];
    const libTypos = [];
    for (const lib of libs) {
      const lt = lib.data?.typographies || {};
      for (const t of Object.values(lt)) {
        libTypos.push({ ...t, libraryId: lib.id });
      }
    }
    assetPanel.libraryTypographies = libTypos;
  }

  #updateTokensPanel() {
    const tokensPanel = this.querySelector('#tokens-panel');
    if (tokensPanel && this.#fileData) {
      tokensPanel.fileData = this.#fileData;
    }
  }

  #pushSelectedShapeToRightSidebar() {
    const rightSidebar = this.querySelector('#right-sidebar');
    if (!rightSidebar) return;
    const page = this.#pages[this.#currentPageIndex];
    if (!page) return;
    const selectedId = [...this.#selectedIds][0];
    if (!selectedId) {
      rightSidebar.selectedShape = null;
      rightSidebar.selectedIds = [];
      rightSidebar.missingFonts = [];
      return;
    }
    const shapes = Array.isArray(page.objects || page.children) ? (page.objects || page.children) : Object.values(page.objects || page.children || {});
    const shape = shapes.find(s => s.id === selectedId);
    rightSidebar.selectedShape = shape || null;
    rightSidebar.selectedIds = [...this.#selectedIds];

    if (shape && shape.type === 'text' && shape.content) {
      const teamFonts = rightSidebar.teamFonts || [];
      const fontRegistry = buildFontRegistry(teamFonts);
      const missing = findMissingFonts([shape], fontRegistry);
      rightSidebar.missingFonts = missing;
    } else {
      rightSidebar.missingFonts = [];
    }

    const layoutPanel = rightSidebar.querySelector('#layout-panel');
    if (layoutPanel) {
      layoutPanel.selectedShape = shape || null;
      layoutPanel.toolManager = this.#toolManager;
    }
  }

  #findShapeById(shapeId) {
    const page = this.#pages[this.#currentPageIndex];
    if (page) {
      const shape = this.#findShape(page, shapeId);
      if (shape) return shape;
    }
    for (const p of this.#pages) {
      const shape = this.#findShape(p, shapeId);
      if (shape) return shape;
    }
    return null;
  }
}

customElements.define('penpot-workspace', PenpotWorkspace);