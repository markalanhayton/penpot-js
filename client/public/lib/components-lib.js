/**
 * @module components-lib
 * @description Component instance management — mirrors app.common.logic.libraries
 * and app.main.data.workspace from ClojureScript.
 * Handles create-component, detach-instance, sync-instance (nested + cross-page),
 * instance creation, variant support, and component data loading.
 * Uses shared SYNC_ATTRS for full sync group coverage.
 */

import { cmd } from './rpc.js';

const SYNC_ATTRS = {
  name: 'name-group',
  fills: 'fill-group',
  'hide-fill-on-export': 'fill-group',
  content: { path: 'geometry-group', text: 'content-group' },
  'position-data': 'content-group',
  hidden: 'visibility-group',
  blocked: 'modifiable-group',
  'grow-type': 'text-font-group',
  'font-family': 'text-font-group',
  'font-size': 'text-font-group',
  'font-style': 'text-font-group',
  'font-weight': 'text-font-group',
  'letter-spacing': 'text-display-group',
  'line-height': 'text-display-group',
  'text-align': 'text-display-group',
  strokes: 'stroke-group',
  'stroke-width': 'stroke-group',
  'fill-color': 'fill-group',
  'fill-opacity': 'fill-group',
  r1: 'radius-group',
  r2: 'radius-group',
  r3: 'radius-group',
  r4: 'radius-group',
  type: 'geometry-group',
  selrect: 'geometry-group',
  points: 'geometry-group',
  locked: 'geometry-group',
  proportion: 'geometry-group',
  'proportion-lock': 'geometry-group',
  x: 'geometry-group',
  y: 'geometry-group',
  width: 'geometry-group',
  height: 'geometry-group',
  rotation: 'geometry-group',
  transform: 'geometry-group',
  'transform-inverse': 'geometry-group',
  opacity: 'layer-effects-group',
  'blend-mode': 'layer-effects-group',
  shadow: 'shadow-group',
  blur: 'blur-group',
  'masked-group': 'mask-group',
  'constraints-h': 'constraints-group',
  'constraints-v': 'constraints-group',
  'fixed-scroll': 'constraints-group',
  'bool-type': 'content-group',
  'bool-content': 'content-group',
  exports: 'exports-group',
  grids: 'grids-group',
  'show-content': 'show-content',
  layout: 'layout-container',
  'layout-align-content': 'layout-align-content',
  'layout-align-items': 'layout-align-items',
  'layout-flex-dir': 'layout-flex-dir',
  'layout-gap': 'layout-gap',
  'layout-gap-type': 'layout-gap',
  'layout-justify-content': 'layout-justify-content',
  'layout-justify-items': 'layout-justify-items',
  'layout-wrap-type': 'layout-wrap-type',
  'layout-padding-type': 'layout-padding',
  'layout-padding': 'layout-padding',
  'layout-grid-dir': 'layout-grid-dir',
  'layout-grid-rows': 'layout-grid-rows',
  'layout-grid-columns': 'layout-grid-columns',
  'layout-grid-cells': 'layout-grid-cells',
  'layout-item-margin': 'layout-item-margin',
  'layout-item-margin-type': 'layout-item-margin',
  'layout-item-h-sizing': 'layout-item-h-sizing',
  'layout-item-v-sizing': 'layout-item-v-sizing',
  'layout-item-max-h': 'layout-item-max-h',
  'layout-item-min-h': 'layout-item-min-h',
  'layout-item-max-w': 'layout-item-max-w',
  'layout-item-min-w': 'layout-item-min-w',
  'layout-item-absolute': 'layout-item-absolute',
  'layout-item-z-index': 'layout-item-z-index',
  'layout-item-align-self': 'layout-item-align-self',
};

function resolveSyncGroup(type, attr) {
  const group = SYNC_ATTRS[attr];
  if (group == null) return null;
  if (typeof group === 'object') return group[type] ?? null;
  return group;
}

function instanceRootQ(shape) {
  return shape['component-root'] === true;
}

function instanceHeadQ(shape) {
  return shape['component-id'] != null;
}

function subinstanceHeadQ(shape) {
  return shape['component-id'] != null && shape['component-root'] == null;
}

function mainInstanceQ(shape) {
  return shape['main-instance'] === true;
}

function inComponentCopyQ(shape) {
  return shape['shape-ref'] != null;
}

function touchedGroupQ(shape, group) {
  const touched = shape.touched ?? new Set();
  return touched.has(group);
}

function swapSlotQ(group) {
  return typeof group === 'string' && group.startsWith('swap-slot-');
}

function getSwapSlot(shape) {
  const touched = shape.touched ?? new Set();
  const group = [...touched].find(swapSlotQ);
  if (!group) return null;
  return typeof group === 'string' && group.startsWith('swap-slot-') ? group.slice(10) || null : null;
}

function removeSwapSlot(shape) {
  const touched = shape.touched ?? new Set();
  const newTouched = new Set();
  for (const g of touched) {
    if (!swapSlotQ(g)) newTouched.add(g);
  }
  return { ...shape, touched: newTouched };
}

function detachShape(shape) {
  const result = { ...shape };
  delete result['component-id'];
  delete result['component-file'];
  delete result['component-root'];
  delete result['main-instance'];
  delete result['remote-synced'];
  delete result['shape-ref'];
  delete result['touched'];
  return result;
}

function swapInstanceComponent(instanceShape, newComponentId, newComponentFile) {
  const swapped = { ...instanceShape };
  swapped['component-id'] = newComponentId;
  if (newComponentFile) swapped['component-file'] = newComponentFile;
  const touched = new Set(instanceShape.touched || []);
  touched.add(`swap-slot-${newComponentId}`);
  swapped.touched = touched;
  return swapped;
}

export { extractComponentsFromFile, findComponentInstances, isComponentMain, isComponentInstance, swapInstanceComponent };

function extractComponentsFromFile(fileData) {
  const components = fileData?.data?.components || fileData?.components || {};
  return Object.entries(components).map(([id, comp]) => ({
    id,
    name: comp.name || comp.path || 'Component',
    path: comp.path || '',
    componentData: comp,
  }));
}

function findComponentInstances(objects) {
  if (!objects) return [];
  const instances = [];
  for (const shape of Object.values(objects)) {
    if (shape.componentId && !shape.mainInstance) {
      instances.push(shape);
    }
  }
  return instances;
}

function isComponentMain(shape) {
  return !!(shape?.mainInstance);
}

function isComponentInstance(shape) {
  return !!(shape?.componentId && !shape?.mainInstance);
}

/**
 * Create a component from a shape (or group of shapes).
 * Recursively marks all children with shapeRef pointing to original shape IDs.
 */
export function createComponentFromShape(shape, allObjects = {}) {
  const componentId = crypto.randomUUID();

  function markTree(s, depth = 0) {
    const updated = {
      ...s,
      componentId,
      componentRoot: depth === 0 ? true : undefined,
      mainInstance: depth === 0 ? true : undefined,
      shapeRef: depth > 0 ? s.id : undefined,
      touched: undefined,
    };

    const childIds = s.children || s.shapes || [];
    if (childIds.length > 0) {
      const updatedChildren = [];
      const updatedObjects = { ...allObjects };

      for (const childId of childIds) {
        const child = allObjects[childId];
        if (child) {
          const marked = markTree(child, depth + 1);
          updatedChildren.push(marked.id);
          updatedObjects[marked.id] = marked;
        } else {
          updatedChildren.push(childId);
        }
      }

      updated.children = updatedChildren;
    }

    return updated;
  }

  const updatedShape = markTree(shape, 0);
  return { componentId, shape: updatedShape };
}

/**
 * Detach a component instance, removing all component-related fields
 * from the instance and all its children.
 */
export function detachInstanceFromShape(shape, allObjects = {}) {
  if (!shape) return shape;

  function detachTree(s) {
    const detached = { ...s };
    delete detached.componentId;
    delete detached.componentFile;
    delete detached.componentRoot;
    delete detached.mainInstance;
    delete detached.remoteSynced;
    delete detached.shapeRef;
    delete detached.touched;

    const childIds = s.children || s.shapes || [];
    if (childIds.length > 0 && allObjects) {
      const updatedChildren = [];
      for (const childId of childIds) {
        const child = allObjects[childId];
        if (child && (child.componentId || child.shapeRef)) {
          const detachedChild = detachTree(child);
          updatedObjects[detachedChild.id] = detachedChild;
          updatedChildren.push(detachedChild.id);
        } else {
          updatedChildren.push(childId);
        }
      }
      detached.children = updatedChildren;
    }

    return detached;
  }

  const updatedObjects = { ...allObjects };
  const detached = detachTree(shape);
  updatedObjects[detached.id] = detached;

  return { shape: detached, objects: updatedObjects };
}

/**
 * Sync an instance shape to its main component shape.
 * Supports nested component trees: recursively syncs children
 * by matching shapeRef to main tree shape IDs.
 *
 * @param {Object} instanceShape - The instance shape to sync
 * @param {Object} mainShape - The main component shape to sync from
 * @param {Object} allObjects - All shape objects on the page (for nested sync)
 * @param {Object} [mainObjects] - Objects from the main component's page (for cross-page)
 * @returns {Object} The synced instance shape
 */
export function syncInstanceToMain(instanceShape, mainShape, allObjects = {}, mainObjects = null) {
  const synced = { ...instanceShape };
  const touched = new Set(instanceShape.touched || []);

  const skipKeys = new Set([
    'id', 'parentId', 'componentId', 'componentFile',
    'componentRoot', 'mainInstance', 'shapeRef', 'touched',
    'children', 'shapes',
  ]);

  for (const [key, mainValue] of Object.entries(mainShape)) {
    if (skipKeys.has(key)) continue;

    const group = resolveSyncGroup(mainShape.type, key);
    if (group != null && !touched.has(group)) {
      synced[key] = mainValue;
    }
  }

  if (mainShape.children && instanceShape.children) {
    const mainChildren = mainShape.children || [];
    const instChildren = instanceShape.children || [];

    const matched = matchChildren(mainChildren, instChildren, allObjects, mainObjects);
    synced.children = matched.map(child => child.id);
  }

  return synced;
}

/**
 * Match children from main tree to instance children using shapeRef.
 * Recursively syncs nested instances.
 */
function matchChildren(mainChildren, instChildren, allObjects, mainObjects) {
  const result = [];

  for (const instChildId of instChildren) {
    const instChild = allObjects[instChildId];
    if (!instChild) continue;

    if (instChild.shapeRef) {
      const mainSourceObjects = mainObjects || allObjects;
      const mainChild = mainSourceObjects[instChild.shapeRef];
      if (mainChild) {
        const synced = syncInstanceToMain(instChild, mainChild, allObjects, mainObjects);
        result.push(synced);
        continue;
      }
    }

    result.push(instChild);
  }

  return result;
}

/**
 * Resolve the sync group for an attribute using the shared SYNC_ATTRS table.
 * Falls back to a group name based on the attribute if not in the table.
 */
function getSyncGroup(type, attr) {
  const group = resolveSyncGroup(type, attr);
  if (group != null) return group;

  if (attr.startsWith('layout-')) return 'layout-group';
  if (attr.startsWith('fill') || attr.startsWith('stroke')) return 'fill-group';
  if (attr.startsWith('text-') || attr.startsWith('font-')) return 'text-font-group';
  return null;
}

/**
 * Create a new instance of a component by deep-cloning the main component's shape tree.
 * Assigns new IDs and shapeRef pointers.
 *
 * @param {Object} mainShape - The main instance root shape
 * @param {Object} allObjects - All objects on the page
 * @param {number} x - X offset for the new instance
 * @param {number} y - Y offset for the new instance
 * @returns {{ shapes: Object, rootId: string }} New shapes map and root ID
 */
export function createInstanceFromComponent(mainShape, allObjects, x = 0, y = 0) {
  const newShapes = {};
  const idMap = new Map();

  function cloneTree(shape, parentId = null, depth = 0) {
    const newId = crypto.randomUUID();
    idMap.set(shape.id, newId);

    const cloned = { ...shape };
    cloned.id = newId;
    cloned.componentId = mainShape.componentId;
    cloned.componentFile = mainShape.componentFile;
    cloned.shapeRef = shape.id;
    cloned.x = (shape.x || 0) + (depth === 0 ? x : 0);
    cloned.y = (shape.y || 0) + (depth === 0 ? y : 0);

    if (depth === 0) {
      delete cloned.mainInstance;
      delete cloned.componentRoot;
    } else {
      delete cloned.mainInstance;
    }
    delete cloned.touched;

    if (parentId) {
      cloned.parentId = parentId;
    }

    newShapes[newId] = cloned;

    const children = shape.children || shape.shapes || [];
    if (children.length > 0) {
      const clonedChildren = [];
      for (const childId of children) {
        const child = allObjects[childId];
        if (child) {
          const clonedChild = cloneTree(child, newId, depth + 1);
          clonedChildren.push(clonedChild.id);
        } else {
          clonedChildren.push(childId);
        }
      }
      cloned.children = clonedChildren;
    }

    return cloned;
  }

  const root = cloneTree(mainShape, null, 0);
  return { shapes: newShapes, rootId: root.id };
}

/**
 * Fetch component data from a different page for cross-page sync.
 *
 * @param {string} fileId - The file ID
 * @param {string} pageId - The page ID containing the main instance
 * @param {string} componentId - The component ID to look up
 * @returns {Promise<{mainShape: Object, objects: Object}>}
 */
export async function fetchMainFromPage(fileId, pageId, componentId) {
  try {
    const fileData = await cmd('get-file', { id: fileId });
    const pages = fileData?.data?.pages || [];
    const targetPage = pages.find(p => p.id === pageId);
    if (!targetPage) return null;

    const objects = targetPage.objects || {};
    const mainShape = Object.values(objects).find(
      s => s.componentId === componentId && s.mainInstance
    );

    return mainShape ? { mainShape, objects } : null;
  } catch (err) {
    console.error('[components-lib] fetchMainFromPage failed:', err);
    return null;
  }
}

/**
 * Sync an instance to its main component, handling cross-page lookups.
 *
 * @param {Object} instanceShape - Instance shape to sync
 * @param {Object} allObjects - All objects on current page
 * @param {string} fileId - Current file ID
 * @returns {Promise<Object>} Synced instance shape
 */
export async function syncWithCrossPageLookup(instanceShape, allObjects, fileId) {
  const mainShapeId = instanceShape.shapeRef;
  let mainShape = allObjects[mainShapeId];
  let mainObjects = allObjects;

  if (!mainShape && instanceShape.componentFile) {
    const result = await fetchMainFromPage(
      instanceShape.componentFile || fileId,
      instanceShape.mainInstancePage || instanceShape.pageId,
      instanceShape.componentId
    );
    if (result) {
      mainShape = result.mainShape;
      mainObjects = result.objects;
    } else {
      throw new Error('Main component not found on any page');
    }
  }

  if (!mainShape) {
    throw new Error('Main component not found on current page');
  }

  return syncInstanceToMain(instanceShape, mainShape, allObjects, mainObjects);
}

/**
 * Build a component list from file data, enriched with instance info.
 */
export function buildComponentListFromFile(fileData) {
  const components = extractComponentsFromFile(fileData);
  const objects = fileData?.data?.pagesIndex || {};
  const allObjects = {};

  for (const page of Object.values(objects)) {
    if (page?.objects) Object.assign(allObjects, page.objects);
  }

  const instances = findComponentInstances(allObjects);
  return components.map(comp => {
    const isInstance = instances.some(i => i.componentId === comp.id);
    return { ...comp, isInstance };
  });
}

/**
 * Find the main instance shape for a given component ID across pages.
 */
export function findMainInstanceForComponent(objects, componentId) {
  for (const shape of Object.values(objects)) {
    if (shape.componentId === componentId && shape.mainInstance) {
      return shape;
    }
  }
  return null;
}

/**
 * Collect all shapes that belong to a component tree (main + all nested instances).
 */
export function collectComponentTree(mainShape, objects) {
  const result = [mainShape];
  const children = mainShape.children || mainShape.shapes || [];

  for (const childId of children) {
    const child = objects[childId];
    if (child) {
      result.push(child);
      if (child.children || child.shapes) {
        result.push(...collectComponentTree(child, objects));
      }
    }
  }

  return result;
}

/**
 * Get all instances of a component across the file.
 */
export function getComponentInstances(componentId, objects) {
  return Object.values(objects).filter(
    s => s.componentId === componentId && !s.mainInstance
  );
}

/**
 * Check if a shape is inside a component copy (has shapeRef).
 */
export function isInComponentCopy(shape) {
  return shape?.shapeRef != null;
}

/**
 * Check if a shape is the head of a sub-instance
 * (has componentId but not componentRoot).
 */
export function isSubinstanceHead(shape) {
  return shape?.componentId != null && shape?.componentRoot == null;
}

// Variant support

/**
 * Check if a shape is a variant container.
 */
export function isVariantContainer(shape) {
  return !!shape?.isVariantContainer;
}

/**
 * Get variant properties from a component definition.
 */
export function getVariantProperties(componentData) {
  return componentData?.variantProperties || componentData?.['variant-properties'] || [];
}

/**
 * Build a display name from variant properties.
 */
export function buildVariantDisplayName(variantProperties) {
  if (!variantProperties || variantProperties.length === 0) return '';
  return variantProperties
    .map(p => p.value || '')
    .filter(v => v)
    .join(' / ');
}

/**
 * Group components by their variant family (shared name prefix).
 */
export function groupVariantFamilies(components) {
  const families = new Map();

  for (const comp of components) {
    const props = getVariantProperties(comp.componentData || comp);
    const familyKey = comp.path || comp.name?.split('/')[0] || '__default__';

    if (!families.has(familyKey)) {
      families.set(familyKey, []);
    }
    families.get(familyKey).push({
      ...comp,
      variantProperties: props,
      displayName: buildVariantDisplayName(props) || comp.name,
    });
  }

  return families;
}

/**
 * Sync variant properties from main to instance.
 */
export function syncVariantProperties(instanceShape, mainShape, variantProperties) {
  const synced = { ...instanceShape };

  if (variantProperties && variantProperties.length > 0) {
    synced.variantProperties = variantProperties;
    const name = buildVariantDisplayName(variantProperties);
    if (name) synced.variantName = name;
  }

  return synced;
}