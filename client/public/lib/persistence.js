/**
 * @module persistence
 * @description Batches local shape changes and persists them to the server
 * via the `update-file` RPC command. Debounces writes and handles revision conflicts
 * with lagged-change fetch for conflict resolution.
 *
 * Exposes pending changes for the undo/reapply pattern in collaboration.js.
 *
 * Port of app.main.data.persistence (ClojureScript) to pure ES JS.
 */

import { cmd } from './rpc.js';
import { appStore } from './store.js';
import { getRevision, setRevision, incrementRevision, initRevision } from './revision.js';

const DEBOUNCE_MS = 2000;
const MAX_RETRIES = 3;

let pendingChanges = [];
let fileId = null;
let saveTimer = null;
let saving = false;
let lastSavedRevn = 0;

let _resolveConflict = null;
let _fetchLaggedChanges = null;
let _broadcastChange = null;
let _broadcastChanges = null;
let _getPendingChanges = null;

export function setCollaborationHandlers({ resolveConflict, fetchLaggedChanges, broadcastChange, broadcastChanges, getPendingChanges }) {
  _resolveConflict = resolveConflict;
  _fetchLaggedChanges = fetchLaggedChanges;
  _broadcastChange = broadcastChange;
  _broadcastChanges = broadcastChanges;
  _getPendingChanges = getPendingChanges;
}

export function initPersistence(id, revn, vern) {
  fileId = id;
  initRevision(revn, vern);
  lastSavedRevn = getRevision();
  pendingChanges = [];
  saving = false;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  appStore.set('_persistenceState', {
    fileId: id,
    pendingChanges,
    saving: false,
  });
}

export { getRevision };
export function getLastSavedRevision() { return lastSavedRevn; }

export function getPendingChanges() {
  return pendingChanges;
}

export function setPendingChanges(changes) {
  pendingChanges = changes;
  const state = appStore.get('_persistenceState');
  if (state) {
    state.pendingChanges = pendingChanges;
  }
}

export function enqueueChange(change) {
  change.revn = getRevision();
  change.created_at = new Date().toISOString();
  pendingChanges.push(change);
  if (_broadcastChange) _broadcastChange(change);
  scheduleSave();
  updatePersistenceState();
}

export function enqueueChanges(changes) {
  for (const change of changes) {
    change.revn = getRevision();
    change.created_at = new Date().toISOString();
    pendingChanges.push(change);
  }
  if (_broadcastChanges) _broadcastChanges(changes);
  scheduleSave();
  updatePersistenceState();
}

export function makeCreateChange(pageId, shape, parentId = null) {
  const change = {
    type: 'add-obj',
    pageId,
    id: shape.id,
    obj: shapeToTransit(shape),
  };
  if (parentId) {
    change.parentId = parentId;
  }
  return change;
}

export function makeModifyChange(pageId, shapeId, kvs) {
  const ops = [];
  for (const [attr, value] of Object.entries(kvs)) {
    ops.push({ type: 'set', attr: camelToShapeKey(attr), val: valueToTransit(value) });
  }
  return {
    type: 'mod-obj',
    pageId,
    id: shapeId,
    operations: ops,
  };
}

export function makeDeleteChange(pageId, shapeId) {
  return {
    type: 'del-obj',
    pageId,
    id: shapeId,
  };
}

export function makeMoveChange(pageId, shapeId, fromIdx, toIdx, parentId = null) {
  const change = {
    type: 'mov-objects',
    pageId,
    shapes: [shapeId],
  };
  if (parentId) {
    change.parentId = parentId;
  }
  if (toIdx !== null && toIdx !== undefined) {
    change.index = toIdx;
  }
  return change;
}

export function makeAddPageChange(pageId, name, parentId = null) {
  return {
    type: 'add-page',
    id: pageId,
    name,
    ...(parentId ? { parentId } : {}),
  };
}

export function makeModPageChange(pageId, kvs) {
  return {
    type: 'mod-page',
    id: pageId,
    operations: Object.entries(kvs).map(([attr, val]) => ({ type: 'set', attr, val })),
  };
}

export function makeDeletePageChange(pageId) {
  return {
    type: 'del-page',
    id: pageId,
  };
}

export function makeAddColorChange(color) {
  return { type: 'add-color', color };
}

export function makeModColorChange(color) {
  return { type: 'mod-color', color };
}

export function makeDelColorChange(colorId) {
  return { type: 'del-color', id: colorId };
}

export function makeAddTypographyChange(typography) {
  return { type: 'add-typography', typography };
}

export function makeModTypographyChange(typography) {
  return { type: 'mod-typography', typography };
}

export function makeDelTypographyChange(typographyId) {
  return { type: 'del-typography', id: typographyId };
}

function shapeToTransit(shape) {
  const obj = {};
  for (const [key, value] of Object.entries(shape)) {
    if (key === '$$typeof') continue;
    const transitKey = camelToShapeKey(key);
    obj[transitKey] = valueToTransit(value);
  }
  return obj;
}

function valueToTransit(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(valueToTransit);
  if (value instanceof Set) return [...value];
  if (typeof value === 'object') return shapeToTransit(value);
  return value;
}

const CAMEL_TO_SHAPE_KEY = {
  componentId: 'component-id',
  componentFile: 'component-file',
  componentRoot: 'component-root',
  mainInstance: 'main-instance',
  remoteSynced: 'remote-synced',
  shapeRef: 'shape-ref',
  variantId: 'variant-id',
  variantName: 'variant-name',
  variantProperties: 'variant-properties',
  isVariantContainer: 'is-variant-container',
  parentId: 'parent-id',
  constraintsH: 'constraints-h',
  constraintsV: 'constraints-v',
  fixedScroll: 'fixed-scroll',
  layout: 'layout',
  layoutAlignContent: 'layout-align-content',
  layoutAlignItems: 'layout-align-items',
  layoutFlexDir: 'layout-flex-dir',
  layoutGap: 'layout-gap',
  layoutGapType: 'layout-gap-type',
  layoutJustifyContent: 'layout-justify-content',
  layoutJustifyItems: 'layout-justify-items',
  layoutWrapType: 'layout-wrap-type',
  layoutPaddingType: 'layout-padding-type',
  layoutPadding: 'layout-padding',
  layoutGridDir: 'layout-grid-dir',
  layoutGridRows: 'layout-grid-rows',
  layoutGridColumns: 'layout-grid-columns',
  layoutGridCells: 'layout-grid-cells',
  layoutItemMargin: 'layout-item-margin',
  layoutItemMarginType: 'layout-item-margin-type',
  layoutItemHSizing: 'layout-item-h-sizing',
  layoutItemVSizing: 'layout-item-v-sizing',
  layoutItemMaxH: 'layout-item-max-h',
  layoutItemMinH: 'layout-item-min-h',
  layoutItemMaxW: 'layout-item-max-w',
  layoutItemMinW: 'layout-item-min-w',
  layoutItemAbsolute: 'layout-item-absolute',
  layoutItemZIndex: 'layout-item-z-index',
  layoutItemAlignSelf: 'layout-item-align-self',
  interactions: 'interactions',
  borderRadius: 'border-radius',
  fillType: 'fill-type',
  fillOpacity: 'fill-opacity',
  fillColor: 'fill-color',
  strokeColor: 'stroke-color',
  strokeWidth: 'stroke-width',
  strokeStyle: 'stroke-style',
  strokeAlignment: 'stroke-alignment',
  strokeCap: 'stroke-cap',
  strokeJoin: 'stroke-join',
  fontFamily: 'font-family',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  fontStyle: 'font-style',
  fontVariant: 'font-variant',
  lineHeight: 'line-height',
  letterSpacing: 'letter-spacing',
  textAlign: 'text-align',
  textDecoration: 'text-decoration',
  hideFillOnExport: 'hide-fill-on-export',
  showContent: 'show-content',
  boolType: 'bool-type',
  boolContent: 'bool-content',
  maskedGroup: 'masked-group',
  selrect: 'selrect',
  transform: 'transform',
  transformInverse: 'transform-inverse',
  proportion: 'proportion',
  proportionLock: 'proportion-lock',
  growType: 'grow-type',
  content: 'content',
  positionData: 'position-data',
  svgAttrs: 'svg-attrs',
  svgContent: 'svg-content',
  d: 'd',
  pathData: 'path-data',
  src: 'src',
  url: 'url',
  grid: 'grid',
  grids: 'grids',
  exports: 'exports',
  rx: 'rx',
  ry: 'ry',
  r1: 'r1',
  r2: 'r2',
  r3: 'r3',
  r4: 'r4',
  appliedTokens: 'applied-tokens',
  touched: 'touched',
  hideInViewer: 'hide-in-viewer',
  blendMode: 'blend-mode',
};

function camelToShapeKey(key) {
  return CAMEL_TO_SHAPE_KEY[key] || key;
}

function updatePersistenceState() {
  appStore.set('_persistenceState', {
    fileId,
    pendingChanges,
    saving,
  });
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => flushSave(), DEBOUNCE_MS);
}

export async function flushSave() {
  if (!fileId || pendingChanges.length === 0 || saving) return;

  saving = true;
  updatePersistenceState();

  const changes = pendingChanges.splice(0);
  pendingChanges = [];
  updatePersistenceState();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await cmd('update-file', {
        id: fileId,
        revn: getRevision(),
        session_id: crypto.randomUUID(),
        changes,
      });

      if (Array.isArray(result)) {
        for (const entry of result) {
          if (entry.revn != null && entry.revn > getRevision()) {
            setRevision(entry.revn);
            appStore.set('currentFileRev', entry.revn);
          }
        }
      } else if (result && result.revn != null) {
        setRevision(result.revn);
        appStore.set('currentFileRev', result.revn);
      }

      lastSavedRevn = getRevision();
      saving = false;
      updatePersistenceState();
      if (pendingChanges.length > 0) {
        scheduleSave();
      }
      return;
    } catch (err) {
      if (err.code === 'revn-conflict' || err.code === 'vern-conflict') {
        const gapRevn = getRevision();

        try {
          if (_fetchLaggedChanges) {
            const lagged = await _fetchLaggedChanges(fileId, gapRevn);
            if (lagged.length > 0) {
              const maxRevn = Math.max(...lagged.map(c => c.revn || 0), gapRevn);
              setRevision(maxRevn);
              appStore.set('currentFileRev', maxRevn);

              appStore.dispatch('conflict-resolved-lagged', {
                fileId,
                revn: maxRevn,
                gapRevs: maxRevn - gapRevn,
              });

              pendingChanges.unshift(...changes.map(c => ({ ...c, revn: maxRevn })));
              saving = false;
              updatePersistenceState();
              scheduleSave();
              return;
            }
          }
        } catch {}

        if (_resolveConflict) await _resolveConflict(fileId, gapRevn);

        incrementRevision();
        pendingChanges.unshift(...changes.map(c => ({ ...c, revn: getRevision() })));
        saving = false;
        updatePersistenceState();
        scheduleSave();
        return;
      }
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      console.error('[persistence] Failed to save after retries:', err);
      pendingChanges.unshift(...changes);
      saving = false;
      updatePersistenceState();
      return;
    }
  }

  saving = false;
  updatePersistenceState();
}

export function destroyPersistence() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  flushSave();
  pendingChanges = [];
  fileId = null;
  appStore.set('_persistenceState', null);
}