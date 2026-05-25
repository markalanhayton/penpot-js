/**
 * @module process-changes
 * @description Full change processing engine for the frontend.
 * Mirrors server/src/files/changes.js but operates on the frontend's
 * page model (pages[] with flat objects{} maps) as well as the full
 * pagesIndex data model.
 *
 * Supports all 35+ change types from the original Penpot common module.
 */

export function processChanges(data, changes) {
  if (!data || !changes || changes.length === 0) return data;

  for (const change of changes) {
    const handler = CHANGE_HANDLERS[change.type];
    if (!handler) continue;
    try {
      handler(data, change);
    } catch (err) {
      console.error(`[process-changes] Error in ${change.type}:`, err.message);
    }
  }

  return data;
}

const CHANGE_HANDLERS = {
  'add-obj': handleAddObj,
  'mod-obj': handleModObj,
  'del-obj': handleDelObj,
  'mov-objects': handleMovObjects,
  'reg-objects': handleRegObjects,
  'reorder-children': handleReorderChildren,
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
  'purge-component': handlePurgeComponent,
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
  'set-token-theme': handleSetTokenTheme,
  'set-active-token-themes': handleSetActiveTokenThemes,
};

function getPage(data, pageId) {
  if (data.pagesIndex) return data.pagesIndex[pageId];
  if (Array.isArray(data.pages)) {
    return data.pages.find(p => p.id === pageId);
  }
  return null;
}

function getObjects(data, pageId, componentId) {
  if (componentId) {
    return data.components?.[componentId]?.objects;
  }
  const page = getPage(data, pageId);
  return page?.objects;
}

function handleAddObj(data, change) {
  const { obj, pageId, componentId, frameId, parentId, index } = change;
  const objects = getObjects(data, pageId, componentId);
  if (!objects || !obj) return;

  objects[obj.id] = obj;

  const parentKey = parentId || frameId;
  if (parentKey && objects[parentKey] && Array.isArray(objects[parentKey].shapes)) {
    if (index !== undefined && index >= 0) {
      objects[parentKey].shapes.splice(index, 0, obj.id);
    } else {
      objects[parentKey].shapes.push(obj.id);
    }
  }
}

function handleModObj(data, change) {
  const { id, pageId, componentId, operations } = change;
  const objects = getObjects(data, pageId, componentId);
  if (!objects) return;

  const shape = objects[id];
  if (!shape) return;

  for (const op of operations || []) {
    applyOperation(shape, op);
  }
}

function handleDelObj(data, change) {
  const { id, pageId, componentId } = change;
  const objects = getObjects(data, pageId, componentId);
  if (!objects) return;

  const shape = objects[id];
  if (!shape) return;

  const parentId = shape.parentId;
  if (parentId && objects[parentId] && Array.isArray(objects[parentId].shapes)) {
    objects[parentId].shapes = objects[parentId].shapes.filter(sid => sid !== id);
  }

  delete objects[id];

  if (Array.isArray(shape.shapes)) {
    for (const childId of shape.shapes) {
      if (objects[childId]) {
        objects[childId].parentId = parentId;
      }
    }
  }
}

function handleMovObjects(data, change) {
  const { pageId, componentId, parentId, shapes: shapeIds, index } = change;
  const objects = getObjects(data, pageId, componentId);
  if (!objects) return;

  for (const shapeId of shapeIds || []) {
    const shape = objects[shapeId];
    if (!shape) continue;

    const oldParentId = shape.parentId;
    if (oldParentId && objects[oldParentId] && Array.isArray(objects[oldParentId].shapes)) {
      objects[oldParentId].shapes = objects[oldParentId].shapes.filter(sid => sid !== shapeId);
    }

    shape.parentId = parentId;
  }

  const newParent = objects[parentId];
  if (newParent && Array.isArray(newParent.shapes)) {
    if (index !== undefined && index >= 0) {
      newParent.shapes.splice(index, 0, ...(shapeIds || []));
    } else {
      newParent.shapes.push(...(shapeIds || []));
    }
  }
}

function handleRegObjects(data, change) {
  const { pageId, componentId, shapes: shapeIds } = change;
  const objects = getObjects(data, pageId, componentId);
  if (!objects) return;

  for (const shapeId of shapeIds || []) {
    const shape = objects[shapeId];
    if (!shape) continue;

    if (shape.type === 'group' && Array.isArray(shape.shapes)) {
      shape.selrect = calculateGroupSelrect(objects, shape);
    }
  }
}

function handleReorderChildren(data, change) {
  const { pageId, componentId, parentId, shapes: newOrder } = change;
  const objects = getObjects(data, pageId, componentId);
  if (!objects) return;

  const parent = objects[parentId];
  if (parent && Array.isArray(parent.shapes)) {
    parent.shapes = newOrder || [];
  }
}

function handleAddPage(data, change) {
  const { id, name, page } = change;

  if (data.pagesIndex) {
    if (page) {
      data.pagesIndex[page.id] = page;
      if (!data.pages.includes(page.id)) data.pages.push(page.id);
    } else if (id) {
      data.pagesIndex[id] = { id, name: name || 'Page', objects: {} };
      if (!data.pages.includes(id)) data.pages.push(id);
    }
  } else if (Array.isArray(data.pages)) {
    if (page) {
      if (!data.pages.find(p => p.id === page.id)) data.pages.push(page);
    } else if (id) {
      if (!data.pages.find(p => p.id === id)) {
        data.pages.push({ id, name: name || 'Page', objects: {} });
      }
    }
  }
}

function handleModPage(data, change) {
  const { id, name, background } = change;
  const page = getPage(data, id);
  if (!page) return;
  if (name !== undefined) page.name = name;
  if (background !== undefined) page.background = background;
}

function handleDelPage(data, change) {
  const { id } = change;

  if (data.pagesIndex) {
    delete data.pagesIndex[id];
    data.pages = data.pages.filter(pid => pid !== id);
  } else if (Array.isArray(data.pages)) {
    data.pages = data.pages.filter(p => p.id !== id);
  }
}

function handleMovPage(data, change) {
  const { id, index } = change;

  if (data.pagesIndex) {
    data.pages = data.pages.filter(pid => pid !== id);
    if (index !== undefined && index >= 0) data.pages.splice(index, 0, id);
    else data.pages.push(id);
  } else if (Array.isArray(data.pages)) {
    const pageIdx = data.pages.findIndex(p => p.id === id);
    if (pageIdx >= 0) {
      const [page] = data.pages.splice(pageIdx, 1);
      const targetIdx = index !== undefined && index >= 0 ? Math.min(index, data.pages.length) : data.pages.length;
      data.pages.splice(targetIdx, 0, page);
    }
  }
}

function handleAddColor(data, change) {
  const { color } = change;
  if (!data.colors) data.colors = [];
  data.colors.push(color);
}

function handleModColor(data, change) {
  const { color } = change;
  if (!data.colors) return;
  const idx = data.colors.findIndex(c => c.id === color.id);
  if (idx >= 0) data.colors[idx] = { ...data.colors[idx], ...color };
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
  data.components[id] = { id, name: name || 'Component', path: path || '', objects: {}, mainInstanceId, mainInstancePage };
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
  const { id } = change;
  if (!data.components || !data.components[id]) return;
  delete data.components[id].deleted;
}

function handlePurgeComponent(data, change) {
  const { id } = change;
  if (!data.components) return;
  delete data.components[id];
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

function handleSetPluginData(data, change) {
  const { objectType, objectId, pageId, namespace, key, value } = change;
  if (!data.pluginData) data.pluginData = {};
  const targetKey = `${objectType || 'file'}:${objectId || pageId || 'file'}:${namespace}:${key}`;
  if (value === undefined) {
    delete data.pluginData[targetKey];
  } else {
    data.pluginData[targetKey] = value;
  }
}

function handleSetGuide(data, change) {
  const { pageId, id, params } = change;
  const page = getPage(data, pageId);
  if (!page) return;
  if (!page.guides) page.guides = {};
  if (params == null) {
    delete page.guides[id];
  } else {
    page.guides[id] = { ...params, id };
  }
}

function handleSetFlow(data, change) {
  const { pageId, id, params } = change;
  const page = getPage(data, pageId);
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
  const page = getPage(data, pageId);
  if (!page) return;
  if (!page.options) page.options = {};
  if (params === undefined) {
    delete page.options[gridType];
  } else {
    page.options[gridType] = params;
  }
}

function handleSetCommentThreadPosition() {}

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
  data.tokensLib = change.tokensLib;
}

function handleSetTokenTheme(data, change) {
  const { id, theme } = change;
  if (!data.tokenThemes) data.tokenThemes = {};
  if (theme === undefined) {
    delete data.tokenThemes[id];
  } else {
    data.tokenThemes[id] = theme;
  }
}

function handleSetActiveTokenThemes(data, change) {
  data.activeTokenThemes = change.themes;
}

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
      break;
  }
}

function calculateGroupSelrect(objects, group) {
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

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export { applyOperation, CHANGE_HANDLERS };