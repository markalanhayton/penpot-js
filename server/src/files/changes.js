/**
 * @module files/changes
 * @description File change processing engine — mirrors `app.common.files.changes`
 * from the Clojure backend.
 *
 * Processes design changes (add/mod/del shapes, pages, colors, components, etc.)
 * by mutating the file data object in-place. Each change type has a dedicated
 * handler function.
 *
 * * ### Change types supported (35+)
 *
 * - Shape operations: `add-obj`, `mod-obj`, `del-obj`, `mov-objects`, `reg-objects`
 * - Page operations: `add-page`, `mod-page`, `del-page`, `mov-page`
 * - Library operations: `add-color`, `mod-color`, `del-color`, `add-media`, `mod-media`, `del-media`
 * - Component operations: `add-component`, `mod-component`, `del-component`, `restore-component`
 * - Typography operations: `add-typography`, `mod-typography`, `del-typography`
 * - Token operations: `set-token`, `set-token-set`, `set-tokens-lib`
 * - Metadata operations: `set-plugin-data`, `set-guide`, `set-flow`, `set-default-grid`, `set-comment-thread-position`
 *
 * @example
 * import { processChanges } from './changes.js';
 * const updatedData = processChanges(fileData, changes);
 */

/**
 * Process a list of changes against file data.
 * Mirrors `app.common.files.changes/process-changes`.
 *
 * @param {object} data - The file data object (pages, components, media, etc.).
 * @param {Array<object>} changes - Array of change objects with `type` field.
 * @returns {object} The mutated file data.
 */
export function processChanges(data, changes) {
  if (!data || !changes || changes.length === 0) return data;

  // Process each change sequentially
  for (const change of changes) {
    const handler = CHANGE_HANDLERS[change.type];
    if (!handler) {
      console.warn(`[changes] Unknown change type: ${change.type}`);
      continue;
    }
    try {
      handler(data, change);
    } catch (err) {
      console.error(`[changes] Error processing ${change.type}:`, err.message);
      throw err;
    }
  }

  return data;
}

/**
 * Dispatch map for change handlers.
 * Each handler mutates `data` in-place based on the `change` object.
 */
const CHANGE_HANDLERS = {
  'add-obj': handleAddObj,
  'mod-obj': handleModObj,
  'del-obj': handleDelObj,
  'mov-objects': handleMovObjects,
  'reg-objects': handleRegObjects,
  'add-page': handleAddPage,
  'mod-page': handleModPage,
  'del-page': handleDelPage,
  'mov-page': handleMovPage,
  'add-color': handleAddColor,
  'mod-color': handleModColor,
  'del-color': handleDelColor,
  'add-media': handleAddMedia,
  'mod-media': handleModMedia,
  'del-media': handleDelMedia,
  'add-component': handleAddComponent,
  'mod-component': handleModComponent,
  'del-component': handleDelComponent,
  'restore-component': handleRestoreComponent,
  'add-typography': handleAddTypography,
  'mod-typography': handleModTypography,
  'del-typography': handleDelTypography,
  'set-plugin-data': handleSetPluginData,
  'set-guide': handleSetGuide,
  'set-flow': handleSetFlow,
  'set-default-grid': handleSetDefaultGrid,
  'set-comment-thread-position': handleSetCommentThreadPosition,
  'set-token': handleSetToken,
  'set-token-set': handleSetTokenSet,
  'set-tokens-lib': handleSetTokensLib,
};

// --- Shape Operations ---

function handleAddObj(data, change) {
  const { obj, pageId, componentId, frameId, parentId, index } = change;
  const target = componentId ? getComponent(data, componentId) : getPage(data, pageId);
  if (!target || !target.objects) return;

  // Add the shape to the objects map
  target.objects[obj.id] = obj;

  // Add to parent's shapes array
  const parent = target.objects[parentId || frameId || target.id];
  if (parent && Array.isArray(parent.shapes)) {
    if (index !== undefined && index >= 0) {
      parent.shapes.splice(index, 0, obj.id);
    } else {
      parent.shapes.push(obj.id);
    }
  }
}

function handleModObj(data, change) {
  const { id, pageId, componentId, operations } = change;
  const target = componentId ? getComponent(data, componentId) : getPage(data, pageId);
  if (!target || !target.objects) return;

  const shape = target.objects[id];
  if (!shape) return;

  // Apply each operation sequentially
  for (const op of operations || []) {
    applyOperation(shape, op);
  }
}

function handleDelObj(data, change) {
  const { id, pageId, componentId } = change;
  const target = componentId ? getComponent(data, componentId) : getPage(data, pageId);
  if (!target || !target.objects) return;

  const shape = target.objects[id];
  if (!shape) return;

  // Remove from parent's shapes array
  const parentId = shape.parentId;
  const parent = target.objects[parentId];
  if (parent && Array.isArray(parent.shapes)) {
    parent.shapes = parent.shapes.filter(sid => sid !== id);
  }

  // Delete the shape
  delete target.objects[id];
}

function handleMovObjects(data, change) {
  const { pageId, componentId, parentId, shapes, index } = change;
  const target = componentId ? getComponent(data, componentId) : getPage(data, pageId);
  if (!target || !target.objects) return;

  // Remove shapes from their current parents
  for (const shapeId of shapes || []) {
    const shape = target.objects[shapeId];
    if (!shape) continue;
    const oldParent = target.objects[shape.parentId];
    if (oldParent && Array.isArray(oldParent.shapes)) {
      oldParent.shapes = oldParent.shapes.filter(sid => sid !== shapeId);
    }
    shape.parentId = parentId;
  }

  // Add to new parent
  const newParent = target.objects[parentId];
  if (newParent && Array.isArray(newParent.shapes)) {
    if (index !== undefined) {
      newParent.shapes.splice(index, 0, ...shapes);
    } else {
      newParent.shapes.push(...shapes);
    }
  }
}

function handleRegObjects(data, change) {
  const { pageId, componentId, shapes } = change;
  const target = componentId ? getComponent(data, componentId) : getPage(data, pageId);
  if (!target || !target.objects) return;

  // Recalculate geometry for the specified shapes
  // This is a simplified version - full implementation would recalculate selrects, bounds, etc.
  for (const shapeId of shapes || []) {
    const shape = target.objects[shapeId];
    if (shape && shape.type === 'group') {
      // Recalculate group selrect from children (simplified)
      // Full implementation would use geometry helpers
      shape.selrect = calculateGroupSelrect(target.objects, shape);
    }
  }
}

// --- Page Operations ---

function handleAddPage(data, change) {
  const { id, name, page } = change;
  if (page) {
    data.pagesIndex[page.id] = page;
    if (!data.pages.includes(page.id)) {
      data.pages.push(page.id);
    }
  } else if (id) {
    const newPage = {
      id,
      name: name || 'Page',
      objects: {},
    };
    data.pagesIndex[id] = newPage;
    if (!data.pages.includes(id)) {
      data.pages.push(id);
    }
  }
}

function handleModPage(data, change) {
  const { id } = change;
  const page = data.pagesIndex[id];
  if (!page) return;
  if (change.operations) {
    for (const op of change.operations) {
      if (op.type === 'set') {
        page[op.attr] = op.val;
      }
    }
  } else {
    if (change.name !== undefined) page.name = change.name;
    if (change.background !== undefined) page.background = change.background;
  }
}

function handleDelPage(data, change) {
  const { id } = change;
  delete data.pagesIndex[id];
  data.pages = data.pages.filter(pid => pid !== id);
}

function handleMovPage(data, change) {
  const { id, index } = change;
  data.pages = data.pages.filter(pid => pid !== id);
  if (index !== undefined && index >= 0) {
    data.pages.splice(index, 0, id);
  } else {
    data.pages.push(id);
  }
}

// --- Library Operations (Colors, Media, Components, Typography) ---

function handleAddColor(data, change) {
  const { color } = change;
  if (!data.colors) data.colors = [];
  data.colors.push(color);
}

function handleModColor(data, change) {
  const { color } = change;
  if (!data.colors) return;
  const idx = data.colors.findIndex(c => c.id === color.id);
  if (idx >= 0) {
    data.colors[idx] = { ...data.colors[idx], ...color };
  }
}

function handleDelColor(data, change) {
  const { id } = change;
  if (!data.colors) return;
  data.colors = data.colors.filter(c => c.id !== id);
}

function handleAddMedia(data, change) {
  const { object } = change;
  if (!data.media) data.media = {};
  data.media[object.id] = object;
}

function handleModMedia(data, change) {
  const { object } = change;
  if (!data.media || !data.media[object.id]) return;
  data.media[object.id] = { ...data.media[object.id], ...object };
}

function handleDelMedia(data, change) {
  const { id } = change;
  if (!data.media) return;
  delete data.media[id];
}

function handleAddComponent(data, change) {
  const { id, name, path, mainInstanceId, mainInstancePage } = change;
  if (!data.components) data.components = {};
  data.components[id] = {
    id,
    name: name || 'Component',
    path: path || '',
    objects: {},
    mainInstanceId,
    mainInstancePage,
  };
}

function handleModComponent(data, change) {
  const { id, name, path } = change;
  const component = data.components?.[id];
  if (!component) return;
  if (name !== undefined) component.name = name;
  if (path !== undefined) component.path = path;
}

function handleDelComponent(data, change) {
  const { id } = change;
  if (!data.components) return;
  delete data.components[id];
}

function handleRestoreComponent(data, change) {
  const { id, pageId } = change;
  // Component restoration logic - simplified
  if (!data.components || !data.components[id]) return;
  // Mark component as not deleted
  delete data.components[id].deleted;
}

function handleAddTypography(data, change) {
  const { typography } = change;
  if (!data.typographies) data.typographies = {};
  data.typographies[typography.id] = typography;
}

function handleModTypography(data, change) {
  const { typography } = change;
  if (!data.typographies || !data.typographies[typography.id]) return;
  data.typographies[typography.id] = { ...data.typographies[typography.id], ...typography };
}

function handleDelTypography(data, change) {
  const { id } = change;
  if (!data.typographies) return;
  delete data.typographies[id];
}

// --- Metadata Operations ---

function handleSetPluginData(data, change) {
  const { objectType, objectId, pageId, namespace, key, value } = change;
  // Plugin data storage - simplified
  if (!data.pluginData) data.pluginData = {};
  const targetKey = `${objectType}:${objectId || pageId || 'file'}:${namespace}:${key}`;
  if (value === undefined) {
    delete data.pluginData[targetKey];
  } else {
    data.pluginData[targetKey] = value;
  }
}

function handleSetGuide(data, change) {
  const { pageId, id, gridType, params } = change;
  const page = data.pagesIndex?.[pageId];
  if (!page) return;
  if (!page.guides) page.guides = {};
  if (params === undefined) {
    delete page.guides[id];
  } else {
    page.guides[id] = { id, type: gridType, ...params };
  }
}

function handleSetFlow(data, change) {
  const { pageId, id, params } = change;
  const page = data.pagesIndex?.[pageId];
  if (!page) return;
  if (!page.flows) page.flows = [];
  const idx = page.flows.findIndex(f => f.id === id);
  if (params === undefined) {
    if (idx >= 0) page.flows.splice(idx, 1);
  } else {
    if (idx >= 0) {
      page.flows[idx] = { ...page.flows[idx], ...params };
    } else {
      page.flows.push({ id, ...params });
    }
  }
}

function handleSetDefaultGrid(data, change) {
  const { pageId, gridType, params } = change;
  const page = data.pagesIndex?.[pageId];
  if (!page) return;
  if (!page.options) page.options = {};
  if (params === undefined) {
    delete page.options[gridType];
  } else {
    page.options[gridType] = params;
  }
}

function handleSetCommentThreadPosition(data, change) {
  // Comment thread positions are stored separately, not in file data
  // This is a no-op for file data processing
}

function handleSetToken(data, change) {
  const { setId, tokenId, attrs } = change;
  if (!data.tokens) data.tokens = {};
  if (!data.tokens[setId]) data.tokens[setId] = {};
  if (attrs === undefined) {
    delete data.tokens[setId][tokenId];
  } else {
    data.tokens[setId][tokenId] = attrs;
  }
}

function handleSetTokenSet(data, change) {
  const { id, attrs } = change;
  if (!data.tokenSets) data.tokenSets = {};
  if (attrs === undefined) {
    delete data.tokenSets[id];
  } else {
    data.tokenSets[id] = attrs;
  }
}

function handleSetTokensLib(data, change) {
  const { tokensLib } = change;
  data.tokensLib = tokensLib;
}

// --- Operation Handlers (for mod-obj) ---

function applyOperation(shape, operation) {
  switch (operation.type) {
    case 'set':
      if (operation.attr && operation.val !== undefined) {
        shape[operation.attr] = operation.val;
      }
      break;
    case 'assign':
      if (operation.value && typeof operation.value === 'object') {
        Object.assign(shape, operation.value);
      }
      break;
    case 'set-touched':
      shape.touched = operation.touched;
      break;
    case 'set-remote-synced':
      shape.remoteSynced = operation.remoteSynced;
      break;
    default:
      console.warn(`[changes] Unknown operation type: ${operation.type}`);
  }
}

// --- Helper Functions ---

function getPage(data, pageId) {
  return data.pagesIndex?.[pageId];
}

function getComponent(data, componentId) {
  return data.components?.[componentId];
}

function calculateGroupSelrect(objects, group) {
  // Simplified group bounds calculation
  // Full implementation would traverse children and compute bounding box
  const childIds = group.shapes || [];
  if (childIds.length === 0) return group.selrect;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const childId of childIds) {
    const child = objects[childId];
    if (!child || !child.selrect) continue;
    minX = Math.min(minX, child.selrect.x);
    minY = Math.min(minY, child.selrect.y);
    maxX = Math.max(maxX, child.selrect.x + child.selrect.width);
    maxY = Math.max(maxY, child.selrect.y + child.selrect.height);
  }

  if (minX === Infinity) return group.selrect;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
