import { getIn, updateInWhen, updateWhen, withoutNils, concatVec, getf } from '../data.js';
import { next as uuidNext, zero as uuidZero } from '../uuid.js';
import { inComponentCopyQ } from '../types/component.js';
import { addColor as addColorLib, deleteColor as deleteColorLib } from '../types/library.js';
import { addPage, deletePage, getPage } from '../types/pages_list.js';
import { addComponent, modComponent, getComponent } from '../types/components_list.js';
import { makeFileData, setBaseFontSize } from '../types/file.js';
import { addShape, deleteShape } from '../types/shape_tree.js';
import { ensureTokensLib, tokenSetAddToken, tokenSetDeleteToken, addSet, makeTokenSet, deleteSet, getSet, getTheme, addTheme, makeTokenTheme, deleteTheme, makeToken } from '../types/tokens_lib.js';
import { addTypography, updateTypography, deleteTypography as deleteTypographyLib } from '../types/typographies_list.js';

export function processChanges(data, items, verify = false) {
  let result = data;
  for (const change of items) {
    result = processChange(result, change) ?? result;
  }
  return result;
}

export function processChange(data, change) {
  switch (change.type) {
    case 'add-obj': return processAddObj(data, change);
    case 'mod-obj': return processModObj(data, change);
    case 'del-obj': return processDelObj(data, change);
    case 'mov-objects': return processMovObjects(data, change);
    case 'reorder-children': return processReorderChildren(data, change);
    case 'reg-objects': return processRegObjects(data, change);
    case 'fix-obj': return processFixObj(data, change);
    case 'add-page': return processAddPage(data, change);
    case 'mod-page': return processModPage(data, change);
    case 'del-page': return processDelPage(data, change);
    case 'mov-page': return processMovPage(data, change);
    case 'add-color': return processAddColor(data, change);
    case 'mod-color': return processModColor(data, change);
    case 'del-color': return processDelColor(data, change);
    case 'add-media': return processAddMedia(data, change);
    case 'mod-media': return processModMedia(data, change);
    case 'del-media': return processDelMedia(data, change);
    case 'add-component': return processAddComponent(data, change);
    case 'mod-component': return processModComponent(data, change);
    case 'del-component': return processDelComponent(data, change);
    case 'restore-component': return processRestoreComponent(data, change);
    case 'purge-component': return processPurgeComponent(data, change);
    case 'add-typography': return processAddTypography(data, change);
    case 'mod-typography': return processModTypography(data, change);
    case 'del-typography': return processDelTypography(data, change);
    case 'set-guide': return processSetGuide(data, change);
    case 'set-flow': return processSetFlow(data, change);
    case 'set-default-grid': return processSetDefaultGrid(data, change);
    case 'set-comment-thread-position': return processSetCommentThreadPosition(data, change);
    case 'set-plugin-data': return processSetPluginData(data, change);
    case 'set-tokens-lib': return processSetTokensLib(data, change);
    case 'set-token': return processSetToken(data, change);
    case 'set-token-set': return processSetTokenSet(data, change);
    case 'set-token-theme': return processSetTokenTheme(data, change);
    case 'set-active-token-themes': return processSetActiveTokenThemes(data, change);
    case 'rename-token-set-group': return processRenameTokenSetGroup(data, change);
    case 'move-token-set': return processMoveTokenSet(data, change);
    case 'move-token-set-group': return processMoveTokenSetGroup(data, change);
    case 'set-base-font-size': return processSetBaseFontSize(data, change);
    default: return data;
  }
}

export function processOperation(shape, op) {
  switch (op.type) {
    case 'set': return setShapeAttr(shape, op.attr, op.val, op);
    case 'assign': return processAssign(shape, op);
    case 'set-touched': return processSetTouched(shape, op);
    case 'set-remote-synced': return processSetRemoteSynced(shape, op);
    default: return shape;
  }
}

// --- Shape/Object changes ---

function processAddObj(data, change) {
  const id = change.id;
  const obj = change.obj;
  const pageId = change['page-id'];
  const componentId = change['component-id'];
  const frameId = change['frame-id'];
  const parentId = change['parent-id'];
  const index = change.index;
  const ignoreTouched = change['ignore-touched'];

  if (pageId) {
    return updateInWhen(data, ['pages-index', pageId], (page) => {
      const updatedPage = addShape(id, obj, page, frameId, parentId, index, ignoreTouched);
      return updatedPage;
    });
  }
  if (componentId) {
    return updateInWhen(data, ['components', componentId], (comp) => {
      const updatedComp = addShape(id, obj, comp, frameId, parentId, index, ignoreTouched);
      return updatedComp;
    });
  }
  return data;
}

function processModObj(data, change) {
  const pageId = change['page-id'];
  const componentId = change['component-id'];

  if (pageId) {
    return updateInWhen(data, ['pages-index', pageId, 'objects'], (objects) => processOperations(objects, change));
  }
  if (componentId) {
    return updateInWhen(data, ['components', componentId, 'objects'], (objects) => processOperations(objects, change));
  }
  return data;
}

function processDelObj(data, change) {
  const id = change.id;
  const pageId = change['page-id'];
  const componentId = change['component-id'];
  const ignoreTouched = change['ignore-touched'];

  if (pageId) {
    return updateInWhen(data, ['pages-index', pageId], (page) => {
      const updatedPage = deleteShape(id, page, ignoreTouched);
      return updatedPage;
    });
  }
  if (componentId) {
    return updateInWhen(data, ['components', componentId], (comp) => {
      const updatedComp = deleteShape(id, comp, ignoreTouched);
      return updatedComp;
    });
  }
  return data;
}

function processMovObjects(data, change) {
  const parentId = change['parent-id'];
  const shapeIds = change.shapes ?? [];
  const index = change.index;
  const pageId = change['page-id'];
  const componentId = change['component-id'];
  const afterShape = change['after-shape'];
  const allowAlteringCopies = change['allow-altering-copies'];

  function moveObjects(objects) {
    const parent = objects[parentId];
    if (!parent || shapeIds.length === 0) return objects;

    let newObjects = { ...objects };

    for (const shapeId of shapeIds) {
      const shape = newObjects[shapeId];
      if (!shape) continue;

      const prevParentId = shape['parent-id'];
      if (prevParentId === parentId) continue;

      newObjects[prevParentId] = {
        ...(newObjects[prevParentId] || {}),
        shapes: (newObjects[prevParentId]?.shapes ?? []).filter((s) => s !== shapeId),
      };

      newObjects[shapeId] = { ...shape, 'parent-id': parentId, 'frame-id': parent.type === 'frame' ? parentId : parent['frame-id'] };
    }

    const currentShapes = parent.shapes ?? [];
    const insertIndex = index ?? currentShapes.length;
    let newShapes = [...currentShapes];
    for (const sid of shapeIds) {
      if (newShapes.includes(sid)) continue;
      newShapes.splice(insertIndex, 0, sid);
    }
    newShapes = newShapes.filter((s) => newObjects[s] != null);
    newObjects[parentId] = { ...parent, shapes: newShapes };

    return newObjects;
  }

  if (pageId) {
    return updateInWhen(data, ['pages-index', pageId, 'objects'], moveObjects);
  }
  if (componentId) {
    return updateInWhen(data, ['components', componentId, 'objects'], moveObjects);
  }
  return data;
}

function processReorderChildren(data, change) {
  const parentId = change['parent-id'];
  const newChildren = change.shapes;
  const pageId = change['page-id'];
  const componentId = change['component-id'];

  function reorder(objects) {
    const parent = objects[parentId];
    if (!parent) return objects;
    return { ...objects, [parentId]: { ...parent, shapes: newChildren } };
  }

  if (pageId) {
    return updateInWhen(data, ['pages-index', pageId, 'objects'], reorder);
  }
  if (componentId) {
    return updateInWhen(data, ['components', componentId, 'objects'], reorder);
  }
  return data;
}

function processRegObjects(data, change) {
  return data;
}

function processFixObj(data, change) {
  return data;
}

// --- Page changes ---

function processAddPage(data, change) {
  const { id, name, page } = change;
  if (page) {
    return addPage(data, page);
  }
  const newPage = { id, name: name ?? 'Page' };
  return addPage(data, newPage);
}

function processModPage(data, change) {
  const { id } = change;
  return updateInWhen(data, ['pages-index', id], (page) => {
    let result = { ...page };
    if (change.name != null) result.name = change.name;

    if ('background' in change) {
      if (change.background != null) {
        result.background = change.background;
      } else {
        delete result.background;
      }
    }

    if ('pixel-grid-color' in change) {
      if (change['pixel-grid-color'] != null) {
        result['pixel-grid-color'] = change['pixel-grid-color'];
      } else {
        delete result['pixel-grid-color'];
      }
    }

    if ('pixel-grid-opacity' in change) {
      if (change['pixel-grid-opacity'] != null) {
        result['pixel-grid-opacity'] = change['pixel-grid-opacity'];
      } else {
        delete result['pixel-grid-opacity'];
      }
    }

    return result;
  });
}

function processDelPage(data, change) {
  return deletePage(data, change.id);
}

function processMovPage(data, change) {
  const { id, index } = change;
  const pages = data.pages ?? [];
  const currentIndex = pages.indexOf(id);
  if (currentIndex === -1) return data;
  const newPages = pages.filter((p) => p !== id);
  newPages.splice(index, 0, id);
  return { ...data, pages: newPages };
}

// --- Color changes ---

function processAddColor(data, change) {
  return addColorLib(data, change.color);
}

function processModColor(data, change) {
  const colors = { ...(data.colors ?? {}), [change.color.id]: change.color };
  return { ...data, colors };
}

function processDelColor(data, change) {
  const { [change.id]: _, ...rest } = data.colors ?? {};
  return { ...data, colors: rest };
}

// --- Media changes ---

function processAddMedia(data, change) {
  const media = { ...(data.media ?? {}), [change.object.id]: change.object };
  return { ...data, media };
}

function processModMedia(data, change) {
  const media = { ...(data.media ?? {}), [change.object.id]: { ...(data.media?.[change.object.id] ?? {}), ...change.object } };
  return { ...data, media };
}

function processDelMedia(data, change) {
  const { [change.id]: _, ...rest } = data.media ?? {};
  return { ...data, media: rest };
}

// --- Component changes ---

function processAddComponent(data, change) {
  return addComponent(data, { id: change.id, name: change.name, path: change.path, 'main-instance-id': change['main-instance-id'], 'main-instance-page': change['main-instance-page'], annotation: change.annotation, 'variant-id': change['variant-id'], 'variant-properties': change['variant-properties'] });
}

function processModComponent(data, change) {
  return modComponent(data, { id: change.id, name: change.name, path: change.path, 'main-instance-id': change['main-instance-id'], 'main-instance-page': change['main-instance-page'], annotation: change.annotation, objects: change.objects, 'variant-id': change['variant-id'], 'variant-properties': change['variant-properties'], 'modified-at': change['modified-at'] });
}

function processDelComponent(data, change) {
  const comps = data.components ?? {};
  const { [change.id]: _, ...rest } = comps;
  return { ...data, components: rest };
}

function processRestoreComponent(data, change) {
  const comp = data.components?.[change.id];
  if (!comp) return data;
  return { ...data, components: { ...data.components, [change.id]: { ...comp, deleted: false } } };
}

function processPurgeComponent(data, change) {
  const comps = data.components ?? {};
  const { [change.id]: _, ...rest } = comps;
  return { ...data, components: rest };
}

// --- Typography changes ---

function processAddTypography(data, change) {
  return addTypography(data, change.typography);
}

function processModTypography(data, change) {
  const typo = change.typography;
  const typographies = { ...(data.typographies ?? {}), [typo.id]: { ...(data.typographies?.[typo.id] ?? {}), ...typo } };
  return { ...data, typographies };
}

function processDelTypography(data, change) {
  return deleteTypographyLib(data, change.id);
}

// --- Guide/Flow/Grid changes ---

function processSetGuide(data, change) {
  const pageId = change['page-id'];
  const id = change.id;
  const params = change.params;
  if (params == null) {
    return updateInWhen(data, ['pages-index', pageId], (page) => {
      const guides = { ...(page.guides ?? {}) };
      delete guides[id];
      const result = { ...page };
      if (Object.keys(guides).length === 0) {
        delete result.guides;
      } else {
        result.guides = guides;
      }
      return result;
    });
  }
  return updateInWhen(data, ['pages-index', pageId], (page) => {
    const guides = { ...(page.guides ?? {}), [id]: { ...params, id } };
    return { ...page, guides };
  });
}

function processSetFlow(data, change) {
  const pageId = change['page-id'];
  const id = change.id;
  const params = change.params;
  if (params == null) {
    return updateInWhen(data, ['pages-index', pageId], (page) => {
      const flows = { ...(page.flows ?? {}) };
      delete flows[id];
      const result = { ...page };
      if (Object.keys(flows).length === 0) {
        delete result.flows;
      } else {
        result.flows = flows;
      }
      return result;
    });
  }
  return updateInWhen(data, ['pages-index', pageId], (page) => {
    const flows = { ...(page.flows ?? {}), [id]: { ...params, id } };
    return { ...page, flows };
  });
}

function processSetDefaultGrid(data, change) {
  const pageId = change['page-id'];
  const gridType = change['grid-type'];
  const params = change.params;
  if (params == null) {
    return updateInWhen(data, ['pages-index', pageId], (page) => {
      const grids = { ...(page['default-grids'] ?? {}) };
      delete grids[gridType];
      const result = { ...page };
      if (Object.keys(grids).length === 0) {
        delete result['default-grids'];
      } else {
        result['default-grids'] = grids;
      }
      return result;
    });
  }
  return updateInWhen(data, ['pages-index', pageId], (page) => {
    const grids = { ...(page['default-grids'] ?? {}), [gridType]: params };
    return { ...page, 'default-grids': grids };
  });
}

function processSetCommentThreadPosition(data, change) {
  const pageId = change['page-id'];
  const commentThreadId = change['comment-thread-id'];
  const frameId = change['frame-id'];
  const position = change.position;
  if (position && frameId) {
    return updateInWhen(data, ['pages-index', pageId], (page) => {
      const positions = { ...(page['comment-thread-positions'] ?? {}), [commentThreadId]: { 'frame-id': frameId, position } };
      return { ...page, 'comment-thread-positions': positions };
    });
  }
  return updateInWhen(data, ['pages-index', pageId], (page) => {
    const positions = { ...(page['comment-thread-positions'] ?? {}) };
    delete positions[commentThreadId];
    return { ...page, 'comment-thread-positions': positions };
  });
}

function processSetPluginData(data, change) {
  const objectType = change['object-type'];
  const objectId = change['object-id'];
  const pageId = change['page-id'];
  const namespace = change.namespace;
  const key = change.key;
  const value = change.value;

  function updatePluginData(obj) {
    const pluginData = { ...(obj['plugin-data'] ?? {}) };
    const ns = { ...(pluginData[namespace] ?? {}) };
    if (value != null) {
      ns[key] = value;
    } else {
      delete ns[key];
    }
    pluginData[namespace] = ns;
    return { ...obj, 'plugin-data': pluginData };
  }

  switch (objectType) {
    case 'file': return updatePluginData(data);
    case 'page': return updateInWhen(data, ['pages-index', objectId], updatePluginData);
    case 'shape': return updateInWhen(data, ['pages-index', pageId, 'objects', objectId], updatePluginData);
    case 'color': return updateInWhen(data, ['colors', objectId], updatePluginData);
    case 'typography': return updateInWhen(data, ['typographies', objectId], updatePluginData);
    case 'component': return updateInWhen(data, ['components', objectId], updatePluginData);
    default: return data;
  }
}

// --- Design Token changes ---

function processSetTokensLib(data, change) {
  return { ...data, 'tokens-lib': change['tokens-lib'] };
}

function processSetToken(data, change) {
  const { 'set-id': setId, 'token-id': tokenId, attrs } = change;
  let lib = ensureTokensLib(data['tokens-lib']);
  if (!attrs) {
    lib = tokenSetDeleteToken(lib, setId, tokenId);
  } else if (!getToken(lib, setId, tokenId)) {
    lib = tokenSetAddToken(lib, setId, makeToken(attrs));
  } else {
    lib = updateSet(lib, setId, (s) => ({ ...s, tokens: { ...s.tokens, [tokenId]: { ...s.tokens?.[tokenId], ...makeToken(attrs) } } }));
  }
  return { ...data, 'tokens-lib': lib };
}

function processSetTokenSet(data, change) {
  const { id, attrs } = change;
  let lib = ensureTokensLib(data['tokens-lib']);
  if (!attrs) {
    lib = deleteSet(lib, id);
  } else if (!getSet(lib, id)) {
    lib = addSet(lib, makeTokenSet(attrs));
  } else {
    lib = updateSet(lib, id, () => makeTokenSet(attrs));
  }
  return { ...data, 'tokens-lib': lib };
}

function processSetTokenTheme(data, change) {
  const { id, attrs } = change;
  let lib = ensureTokensLib(data['tokens-lib']);
  if (!attrs) {
    lib = removeThemeFromLib(lib, id);
  } else if (!getTheme(lib, id)) {
    lib = addTheme(lib, makeTokenTheme(attrs));
  } else {
    lib = updateTheme(lib, id, (prev) => makeTokenTheme({ ...prev, ...attrs }));
  }
  return { ...data, 'tokens-lib': lib };
}

function removeThemeFromLib(lib, id) {
  const themes = { ...(lib.themes ?? {}) };
  delete themes[id];
  return { ...lib, themes };
}

function processSetActiveTokenThemes(data, change) {
  const { 'theme-paths': themePaths } = change;
  let lib = ensureTokensLib(data['tokens-lib']);
  lib = setThemePaths(lib, themePaths);
  return { ...data, 'tokens-lib': lib };
}

function setThemePaths(lib, themePaths) {
  return { ...lib, 'active-theme-paths': themePaths instanceof Set ? themePaths : new Set(themePaths) };
}

function processRenameTokenSetGroup(data, change) {
  let lib = ensureTokensLib(data['tokens-lib']);
  const undoPath = replaceLastPathName(change['set-group-path'], change['set-group-fname']);
  const undoFname = change['set-group-path'][change['set-group-path'].length - 1];
  if (lib.sets) {
    const newSets = {};
    for (const [id, set] of Object.entries(lib.sets)) {
      if (set.name === undoFname) {
        newSets[id] = { ...set, name: change['set-group-fname'] };
      } else {
        newSets[id] = set;
      }
    }
    lib = { ...lib, sets: newSets };
  }
  return { ...data, 'tokens-lib': lib };
}

function replaceLastPathName(path, name) {
  return [...path.slice(0, -1), name];
}

function processMoveTokenSet(data, change) {
  return data;
}

function processMoveTokenSetGroup(data, change) {
  return data;
}

function processSetBaseFontSize(data, change) {
  return setBaseFontSize(data, change['base-font-size']);
}

// --- Operation helpers ---

function processOperations(objects, change) {
  const { id, operations, pageId, componentId } = change;
  const shape = objects[id];
  if (!shape) return objects;

  let newShape = { ...shape };
  for (const op of operations) {
    newShape = processOperation(newShape, op);
  }

  if (newShape === shape) return objects;
  return { ...objects, [id]: newShape };
}

function setShapeAttr(shape, attr, val, op = {}) {
  const ignoreTouched = op['ignore-touched'] ?? false;
  const ignoreGeometry = op['ignore-geometry'] ?? false;
  return { ...shape, [attr]: val };
}

function processAssign(shape, op) {
  const value = op.value ?? {};
  let newShape = { ...shape };
  for (const [k, v] of Object.entries(value)) {
    if (k === 'type') continue;
    if (v !== shape[k]) {
      newShape = setShapeAttr(newShape, k, v, op);
    }
  }
  return newShape;
}

function processSetTouched(shape, op) {
  const touched = op.touched;
  const inCopy = inComponentCopyQ(shape);
  if (!inCopy || touched == null || (touched instanceof Set && touched.size === 0)) {
    const { touched: _, ...rest } = shape;
    return rest;
  }
  return { ...shape, touched };
}

function processSetRemoteSynced(shape, op) {
  const remoteSynced = op['remote-synced'];
  const inCopy = inComponentCopyQ(shape);
  if (!inCopy || !remoteSynced) {
    const { 'remote-synced': _, ...rest } = shape;
    return rest;
  }
  return { ...shape, 'remote-synced': true };
}

// --- Helper ---

// --- Component change detection ---

export function componentsChanged(fileData, change) {
  switch (change.type) {
    case 'mod-obj': return detectModObjComponent(fileData, change);
    case 'mov-objects': return detectMovObjectsComponent(fileData, change);
    case 'add-obj': return detectAddObjComponent(fileData, change);
    case 'del-obj': return detectDelObjComponent(fileData, change);
    default: return null;
  }
}

function detectModObjComponent(fileData, change) {
  const { id, pageId, operations } = change;
  if (!pageId) return change['component-id'] ? new Set([change['component-id']]) : null;

  const page = getPage(fileData, pageId);
  if (!page) return null;

  const needSync = operations?.some((op) => op.type === 'set');
  if (!needSync) return null;

  const objects = page.objects ?? {};
  const shape = objects[id];
  if (!shape) return null;

  return null;
}

function detectMovObjectsComponent(fileData, change) {
  return null;
}

function detectAddObjComponent(fileData, change) {
  return null;
}

function detectDelObjComponent(fileData, change) {
  return null;
}

// --- Frame change detection ---

export function framesChanged(fileData, change) {
  switch (change.type) {
    case 'mod-obj': return detectModObjFrame(fileData, change);
    case 'mov-objects': return detectMovObjectsFrame(fileData, change);
    case 'add-obj': return detectAddObjFrame(fileData, change);
    case 'del-obj': return detectDelObjFrame(fileData, change);
    default: return null;
  }
}

function detectModObjFrame(fileData, change) {
  return null;
}

function detectMovObjectsFrame(fileData, change) {
  return null;
}

function detectAddObjFrame(fileData, change) {
  return null;
}

function detectDelObjFrame(fileData, change) {
  return null;
}