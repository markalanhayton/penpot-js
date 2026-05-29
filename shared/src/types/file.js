import { next, zero } from '../uuid.js';
import { now as timeNow } from '../time.js';
import { withoutNils, nilv, getIn, updateWhen, updateVals, seek, indexOf, notEmpty } from '../data.js';
import { makeEmptyPage } from './page.js';
import { addPage, getPage, pagesSeq, updatePage } from './pages_list.js';
import { getComponent as getComponentById, componentsSeq, deleteComponent as deleteComponentFromList, updateComponent as updateComponentInList, markComponentDeleted, markComponentUndeleted, addComponent, usedComponentsChangedSince } from './components_list.js';
import { makeContainer, unmakeContainer, pageQ, getParentHeads, getParentCopyHeads, getComponentShape as getComponentShapeFromContainer, getHeadShape, shapesSeq } from './container.js';
import { getShape as getShapeFromTree, setShape as setShapeInTree, deleteShape as deleteShapeFromTree } from './shape_tree.js';
import { instanceOfQ, mainInstanceQ, getSwapSlot, swapSlotQ, isVariantQ } from './component.js';
import { getColors, addColor, usedColorsChangedSince } from './library.js';
import { usesLibraryColorQ } from './shape_type.js';
import { usesLibraryTypography, remapTypographies, transformNodes, removeTypographyFromNode } from './typography.js';
import { typographiesSeq, addTypography, usedTypographiesChangedSince } from './typographies_list.js';
import { point } from '../geom/point.js';
import { move as shapeMove } from '../geom/shapes/shapes.js';
import { getChildrenIdsWithSelf, collectUsedMedia } from '../files/helpers.js';
import { generateShapeGrid } from './shape_tree.js';

export const BASE_FONT_SIZE = '16px';

export const EMPTY_FILE_DATA = {
  pages: [],
  'pages-index': {},
};

export function makeFileData(fileId, pageId) {
  if (pageId === undefined) pageId = next();
  const page = pageId ? makeEmptyPage({ id: pageId, name: 'Page 1' }) : undefined;

  let result = { ...EMPTY_FILE_DATA, id: fileId };
  if (page) result = addPage(result, page);
  result = {
    ...result,
    options: {
      ...(result.options ?? {}),
      'components-v2': true,
      'base-font-size': BASE_FONT_SIZE,
    },
  };
  return result;
}

export function makeFile(params) {
  const {
    id, 'project-id': projectId, name, revn, 'is-shared': isShared,
    features, migrations, metadata, backend, 'ignore-sync-until': ignoreSyncUntil,
    'created-at': createdAt, 'modified-at': modifiedAt, 'deleted-at': deletedAt,
    version = 1,
  } = params ?? {};

  const now = timeNow();
  const theId = id ?? next();
  const theCreatedAt = createdAt ?? now;
  const theModifiedAt = modifiedAt ?? theCreatedAt;
  const theFeatures = nilv(features, new Set());

  const data = makeFileData(theId);

  return withoutNils({
    id: theId,
    'project-id': projectId,
    name,
    revn: nilv(revn, 0),
    vern: 0,
    'is-shared': nilv(isShared, false),
    version,
    data,
    features: theFeatures,
    migrations,
    metadata,
    backend,
    'ignore-sync-until': ignoreSyncUntil,
    'created-at': theCreatedAt,
    'modified-at': theModifiedAt,
    'deleted-at': deletedAt,
  });
}

export function fileData(file) {
  return file?.data;
}

export function updateFileData(file, f) {
  if (!file) return undefined;
  return { ...file, data: f(file.data) };
}

export function containersSeqFromFile(fileData) {
  const pages = pagesSeq(fileData).map((p) => makeContainer(p, 'page'));
  const comps = componentsSeq(fileData).map((c) => makeContainer(c, 'component'));
  return [...pages, ...comps];
}

export function objectContainersSeqFromFile(fileData) {
  const pages = pagesSeq(fileData).map((p) => makeContainer(p, 'page'));
  const deleted = componentsSeq(fileData).filter((c) => c.deleted).map((c) => makeContainer(c, 'component'));
  return [...pages, ...deleted];
}

export function updateContainer(fileData, container, f) {
  if (pageQ(container)) {
    return updatePage(fileData, container.id, f);
  }
  const comps = fileData.components ?? {};
  const comp = comps[container.id];
  if (!comp) return fileData;
  return { ...fileData, components: { ...comps, [container.id]: f(comp) } };
}

export function updatePages(fileData, f) {
  const pagesIndex = fileData['pages-index'] ?? {};
  const newPagesIndex = {};
  for (const [id, page] of Object.entries(pagesIndex)) {
    const container = makeContainer(page, 'page');
    const result = f(container);
    const { type, ...rest } = result;
    newPagesIndex[id] = rest;
  }
  return { ...fileData, 'pages-index': newPagesIndex };
}

export function updateComponents(fileData, f) {
  const comps = fileData.components;
  if (!comps) return fileData;
  const newComps = {};
  for (const [id, comp] of Object.entries(comps)) {
    const container = makeContainer(comp, 'component');
    const result = f(container);
    const { type, ...rest } = result;
    newComps[id] = rest;
  }
  return { ...fileData, components: newComps };
}

export function updateContainers(fileData, f) {
  return updateComponents(updatePages(fileData, f), f);
}

export function findComponentFile(file, libraries, componentFile) {
  if (file && componentFile === file.id) return file;
  return libraries?.[componentFile];
}

export function getComponentFromLibraries(libraries, libraryId, componentId, includeDeleted = false) {
  const libData = libraries?.[libraryId]?.data;
  if (!libData) return undefined;
  return getComponentById(libData, componentId, includeDeleted);
}

export function resolveComponent(shape, file, libraries, includeDeleted = false) {
  if (shape['component-file'] === file?.id) {
    return getComponentById(file.data ?? file, shape['component-id'], includeDeleted);
  }
  return getComponentFromLibraries(libraries, shape['component-file'], shape['component-id'], includeDeleted);
}

export function getComponentLibrary(libraries, instanceRoot) {
  return libraries?.[instanceRoot?.['component-file']];
}

export function getComponentPage(fileData, component) {
  return getPage(fileData, component?.['main-instance-page']);
}

export function getComponentRoot(fileData, component) {
  if (!component.deleted) {
    const page = getComponentPage(fileData, component);
    return page?.objects?.[component['main-instance-id']];
  }
  const mainId = component['main-instance-id'];
  if (mainId) return component.objects?.[mainId];
  return component.objects?.[component.id];
}

export function getBaseFontSize(fileData) {
  return fileData?.options?.['base-font-size'] ?? BASE_FONT_SIZE;
}

export function setBaseFontSize(fileData, fontSize) {
  return {
    ...fileData,
    options: { ...(fileData.options ?? {}), 'base-font-size': fontSize },
  };
}

export function updateAllShapes(fileData, f) {
  if (!fileData) return fileData;
  return updateContainers(fileData, (container) => updateObjectsTree(container, f));
}

export function updateObjectsTree(container, f) {
  const objects = container.objects ?? {};
  if (Object.keys(objects).length === 0) return container;

  const rootId = pageQ(container) ? zero : container['main-instance-id'];

  function updateShapeRecursive(currentContainer, shapeId) {
    const shape = currentContainer.objects?.[shapeId];
    if (!shape) {
      throw new Error(`Shape not found: ${shapeId}`);
    }
    const { result, 'updated-shape': updatedShape } = f(shape);

    let currentResult;
    if (result === 'keep') {
      currentResult = currentContainer;
    } else if (result === 'update') {
      currentResult = setShapeInTree(currentContainer, updatedShape);
    } else if (result === 'remove') {
      currentResult = deleteShapeFromTree(currentContainer, shapeId, true);
    } else {
      throw new Error(`Invalid result from update function: ${result}`);
    }

    if (result === 'remove') return currentResult;

    const childIds = shape.shapes ?? [];
    let c = currentResult;
    for (const childId of childIds) {
      c = updateShapeRecursive(c, childId);
    }
    return c;
  }

  return updateShapeRecursive(container, rootId);
}

export function getComponentContainer(fileData, component) {
  if (!component.deleted) {
    const componentPage = getComponentPage(fileData, component);
    return makeContainer(componentPage, 'page');
  }
  return makeContainer(component, 'component');
}

export function getComponentContainerFromHead(instanceHead, libraries, options) {
  const { includeDeleted = true } = options ?? {};
  const libraryData = getComponentLibrary(libraries, instanceHead)?.data;
  if (!libraryData) return undefined;
  const component = getComponentById(libraryData, instanceHead['component-id'], includeDeleted);
  if (!component) return undefined;
  return getComponentContainer(libraryData, component);
}

export function getComponentShape(fileData, component, shapeId, options) {
  const { withContext = false } = options ?? {};
  if (!component.deleted) {
    const componentPage = getComponentPage(fileData, component);
    if (!componentPage) return undefined;
    const objects = componentPage.objects ?? {};
    const child = getChild(objects, component['main-instance-id'], shapeId);
    if (!child) return undefined;
    if (withContext) {
      return { ...child, _fileCtx: { id: fileData.id, data: fileData }, _containerCtx: makeContainer(componentPage, 'page') };
    }
    return child;
  }
  const shape = component.objects?.[shapeId];
  if (!shape) return undefined;
  if (withContext) {
    return { ...shape, _fileCtx: { id: fileData.id, data: fileData }, _containerCtx: makeContainer(component, 'component') };
  }
  return shape;
}

function getChild(objects, rootId, targetId) {
  if (rootId === targetId) return objects[targetId];
  const root = objects[rootId];
  if (!root?.shapes) return undefined;
  for (const childId of root.shapes) {
    const found = getChild(objects, childId, targetId);
    if (found) return found;
  }
  return undefined;
}

export function getRefShape(fileData, component, shape, options) {
  const { withContext = false } = options ?? {};
  if (!shape['shape-ref']) return undefined;
  return getComponentShape(fileData, component, shape['shape-ref'], { withContext });
}

export function getShapeInCopy(fileData, mainShape, rootCopy) {
  let objects;
  if (fileData?.['pages-index']) {
    objects = {};
    for (const page of Object.values(fileData['pages-index'])) {
      Object.assign(objects, page.objects ?? {});
    }
  } else {
    objects = fileData?.objects ?? {};
  }
  const children = getChildrenIdsWithSelf(objects, rootCopy.id)
    .map((id) => objects[id])
    .filter(Boolean);
  return seek((s) => s['shape-ref'] === mainShape.id, children);
}

export function findRefShape(file, container, libraries, shape, options) {
  const { includeDeleted = false, withContext = false } = options ?? {};
  const parentHeads = getParentHeads(container.objects, shape);

  for (const headShape of parentHeads) {
    const componentFile = findComponentFile(file, libraries, headShape['component-file']);
    const component = componentFile
      ? getComponentById(componentFile.data, headShape['component-id'], includeDeleted)
      : undefined;
    if (component) {
      const refShape = getRefShape(componentFile.data, component, shape, { withContext });
      if (refShape) return refShape;
    }
  }
  return undefined;
}

export function findNearMatch(file, container, libraries, shape, options) {
  const { includeDeleted = false, withContext = false } = options ?? {};
  const parentShape = getShapeFromTree(container, shape['parent-id']);
  if (!parentShape) return undefined;

  const parentRefShape = findRefShape(file, container, libraries, parentShape, {
    includeDeleted,
    withContext: true,
  });

  let refContainer;
  if (parentRefShape?._containerCtx) {
    refContainer = parentRefShape._containerCtx;
  }

  const shapeIndex = indexOf(parentShape.shapes ?? [], shape.id);
  if (shapeIndex === -1) return undefined;

  const nearMatchId = parentRefShape?.shapes?.[shapeIndex];
  if (!nearMatchId) return undefined;

  const nearMatch = refContainer ? getShapeFromTree(refContainer, nearMatchId) : undefined;
  if (!nearMatch) return undefined;

  if (withContext && parentRefShape?._fileCtx) {
    return { ...nearMatch, _fileCtx: parentRefShape._fileCtx, _containerCtx: parentRefShape._containerCtx };
  }
  return nearMatch;
}

export function advanceShapeRef(file, container, libraries, shape, levels, options) {
  const { includeDeleted = false } = options ?? {};
  const refShape = findRefShape(file, container, libraries, shape, {
    includeDeleted,
    withContext: true,
  });

  if (!refShape?.['shape-ref'] || levels <= 0) {
    return refShape?.id;
  }

  const refContainer = refShape._containerCtx;
  return advanceShapeRef(refShape._fileCtx, refContainer, libraries, refShape, levels - 1, {
    includeDeleted,
  });
}

export function findRefComponent(file, page, libraries, shape, options) {
  const { includeDeleted = false } = options ?? {};
  const parentCopyHeads = getParentCopyHeads(page.objects ?? {}, shape);

  for (const headShape of parentCopyHeads) {
    const componentFile = findComponentFile(file, libraries, headShape['component-file']);
    const component = componentFile
      ? getComponentById(componentFile.data, headShape['component-id'], includeDeleted)
      : undefined;
    if (component) {
      const refShape = getRefShape(componentFile.data, component, shape);
      if (refShape) return component;
    }
  }
  return undefined;
}

export function findRemoteShape(container, libraries, shape, options) {
  const { withContext = false } = options ?? {};
  const objects = container.objects ?? {};
  const topInstance = getComponentShapeFromContainer(objects, shape);
  if (!topInstance) return undefined;

  const componentFileData = libraries?.[topInstance['component-file']]?.data;
  if (!componentFileData) return undefined;

  const component = getComponentById(componentFileData, topInstance['component-id'], true);
  if (!component) return undefined;

  let remoteShape = getRefShape(componentFileData, component, shape);
  let componentContainer = getComponentContainer(componentFileData, component);
  let currentFileData = componentFileData;

  if (!remoteShape) {
    const headInstance = getHeadShape(objects, shape);
    const headFileData = libraries?.[headInstance['component-file']]?.data;
    if (!headFileData) return undefined;

    const headComponent = getComponentById(headFileData, headInstance['component-id'], true);
    if (!headComponent) return undefined;

    remoteShape = getRefShape(headFileData, headComponent, shape);
    componentContainer = getComponentContainer(headFileData, headComponent);
    currentFileData = headFileData;
  }

  if (!remoteShape) return undefined;

  if (!remoteShape['shape-ref']) {
    if (withContext) {
      return { ...remoteShape, _fileCtx: { id: currentFileData.id, data: currentFileData }, _containerCtx: componentContainer };
    }
    return remoteShape;
  }

  return findRemoteShape(componentContainer, libraries, remoteShape, { withContext });
}

export function directCopyQ(shape, component, page, file, libraries) {
  const refComponent = findRefComponent(file, page, libraries, shape, { includeDeleted: true });
  return component.id === refComponent?.id;
}

export function findSwapSlot(shape, container, file, libraries, viewedIds) {
  if (!viewedIds) viewedIds = new Set();
  if (viewedIds.has(shape.id)) return undefined;

  const swapSlot = getSwapSlot(shape);
  if (swapSlot) return swapSlot;

  const refShape = findRefShape(file, container, libraries, shape, {
    includeDeleted: true,
    withContext: true,
  });

  if (!refShape) return undefined;

  const refSwapSlot = getSwapSlot(refShape);
  if (refSwapSlot) return refSwapSlot;

  if (mainInstanceQ(refShape)) return shape.id;

  const refFile = refShape._fileCtx;
  const refContainer = refShape._containerCtx;
  return findSwapSlot(refShape, refContainer, refFile, libraries, new Set([...viewedIds, shape.id]));
}

export function matchSwapSlotQ(shapeMain, shapeInst, containerInst, containerMain, file, libraries) {
  const slotMain = findSwapSlot(shapeMain, containerMain, file, libraries);
  const slotInst = findSwapSlot(shapeInst, containerInst, file, libraries);
  if (slotInst == null) return false;
  return slotMain === slotInst || shapeMain.id === slotInst;
}

export function findRefIdForSwapped(shape, container, libraries) {
  const swapSlotId = getSwapSlot(shape);
  const objects = container.objects ?? {};
  const parent = objects[shape['parent-id']];
  if (!parent) return undefined;

  const parentHead = getHeadShape(objects, parent);
  const parentRef = findRefShape(null, container, libraries, parentHead);
  if (!swapSlotId || !parentRef) return undefined;

  return findNextRelatedSwapShapeId(parentRef, swapSlotId, libraries);
}

function findNextRelatedSwapShapeId(parent, swapSlotId, libraries) {
  const container = getComponentContainerFromHead(parent, libraries);
  const objects = container.objects ?? {};

  const children = (parent.shapes ?? []).map((id) => objects[id]).filter(Boolean);
  const originalShapeId = children.find((s) => s.id === swapSlotId)?.id;

  if (originalShapeId) return originalShapeId;

  const referencedShape = findRefShape(null, container, libraries, parent);
  if (!referencedShape) return undefined;

  const nextShapeId = findNextRelatedSwapShapeId(referencedShape, swapSlotId, libraries);
  if (!nextShapeId) return undefined;

  const match = children.find((s) => s['shape-ref'] === nextShapeId);
  return match?.id;
}

export function getComponentShapes(fileData, component) {
  if (!component.deleted) {
    const instancePage = getComponentPage(fileData, component);
    return getChildrenIdsWithSelf(instancePage.objects ?? {}, component['main-instance-id'])
      .map((id) => instancePage.objects[id])
      .filter(Boolean);
  }
  return Object.values(component.objects ?? {});
}

export function isMainOfKnownComponentQ(shape, libraries) {
  if (!mainInstanceQ(shape)) return false;
  const componentId = shape['component-id'];
  const fileId = shape['component-file'];
  const component = getComponentById(libraries?.[fileId]?.data, componentId, true);
  return component != null;
}

export function loadComponentObjects(fileData, component, delta) {
  if (!component || Object.keys(component.objects ?? {}).length > 0) {
    return component;
  }
  delta = delta ?? point(0, 0);

  const componentPage = getComponentPage(fileData, component);
  if (!componentPage) return component;

  const pageObjects = componentPage.objects ?? {};
  const shapeIds = [
    component['main-instance-id'],
    ...getChildrenIdsWithSelf(pageObjects, component['main-instance-id']),
  ];
  const objects = {};
  for (const id of shapeIds) {
    const shape = pageObjects[id];
    if (shape) {
      const moved = shapeMove(shape, delta);
      objects[moved.id] = moved;
    }
  }
  return { ...component, objects };
}

export function deleteComponentData(fileData, componentId, skipUndelete, delta) {
  delta = delta ?? point(0, 0);
  if (skipUndelete) {
    return deleteComponentFromList(fileData, componentId);
  }
  const loaded = loadComponentObjects(fileData, getComponentById(fileData, componentId, true), delta);
  let result = updateComponentInList(fileData, componentId, () => loaded);
  result = markComponentDeleted(result, componentId);
  return result;
}

export function restoreComponent(fileData, componentId, pageId) {
  const updatePageQ = pageId != null;
  const component = getComponentById(fileData, componentId, true);
  if (!component) return fileData;

  let result = updateComponentInList(fileData, componentId, (c) => {
    const { objects, ...rest } = c;
    return rest;
  });
  result = markComponentUndeleted(result, componentId);

  if (updatePageQ) {
    result = updateComponentInList(result, componentId, (c) => ({
      ...c,
      'main-instance-page': pageId,
    }));
  }

  if (isVariantQ(component)) {
    const mainInstanceId = component['main-instance-id'];
    const mainInstance = fileData['pages-index']?.[component['main-instance-page']]?.objects?.[mainInstanceId];
    if (mainInstance) {
      result = updateComponentInList(result, componentId, (c) => ({
        ...c,
        'variant-id': mainInstance['variant-id'],
      }));
    }
  }
  return result;
}

export function purgeComponent(fileData, componentId) {
  return deleteComponentFromList(fileData, componentId);
}

export function usesAssetQ(assetType, shape, libraryId, asset) {
  switch (assetType) {
    case 'component':
      return instanceOfQ(shape, libraryId, asset.id);
    case 'color':
      return usesLibraryColorQ(shape, libraryId, asset.id);
    case 'typography':
      return usesLibraryTypography(shape, libraryId, asset.id);
    default:
      return false;
  }
}

export function findAssetTypeUsages(fileData, libraryData, assetType) {
  let assets;
  switch (assetType) {
    case 'component':
      assets = componentsSeq(libraryData);
      break;
    case 'color':
      assets = Object.values(getColors(libraryData) ?? {});
      break;
    case 'typography':
      assets = typographiesSeq(libraryData);
      break;
    default:
      return [];
  }

  const containers = containersSeqFromFile(fileData);
  const result = [];
  for (const asset of assets) {
    const instances = [];
    for (const container of containers) {
      const shapes = shapesSeq(container).filter((s) =>
        usesAssetQ(assetType, s, libraryData.id, asset)
      );
      if (shapes.length > 0) {
        instances.push([container, shapes]);
      }
    }
    if (instances.length > 0) {
      result.push([asset, instances]);
    }
  }
  return result;
}

export function usedInQ(fileData, libraryId, asset, assetType) {
  for (const container of containersSeqFromFile(fileData)) {
    for (const shape of shapesSeq(container)) {
      if (usesAssetQ(assetType, shape, libraryId, asset)) return true;
    }
  }
  return false;
}

export function usedAssetsChangedSince(fileData, library, sinceDate) {
  const results = [];
  for (const container of containersSeqFromFile(fileData)) {
    for (const shape of shapesSeq(container)) {
      results.push(...usedComponentsChangedSince(shape, library, sinceDate));
      results.push(...usedColorsChangedSince(shape, library, sinceDate));
      results.push(...usedTypographiesChangedSince(shape, library, sinceDate));
    }
  }
  return results;
}

export function getOrAddLibraryPage(fileData, gridGap) {
  const pages = pagesSeq(fileData);
  const libraryPage = seek((p) => p.name === 'Main components', pages);

  if (libraryPage) {
    let position = point(0, 0);
    for (const shape of Object.values(libraryPage.objects ?? {})) {
      const bounds = shape.selrect;
      if (bounds) {
        position = point(
          Math.min(position.x, bounds.x ?? 0),
          Math.max(position.y, (bounds.y ?? 0) + (bounds.height ?? 0) + gridGap)
        );
      }
    }
    return [fileData, libraryPage.id, position];
  }

  const newPage = makeEmptyPage({ id: next(), name: 'Main components' });
  const updatedData = addPage(fileData, newPage);
  return [updatedData, newPage.id, point(0, 0)];
}

export function absorbAssets(fileData, libraryData) {
  const usedComponents = findAssetTypeUsages(fileData, libraryData, 'component');
  if (notEmpty(usedComponents)) {
    fileData = absorbComponents(fileData, usedComponents, libraryData);
  }

  const usedColors = findAssetTypeUsages(fileData, libraryData, 'color');
  if (notEmpty(usedColors)) {
    fileData = absorbColorsHelper(fileData, usedColors);
  }

  const usedTypographies = findAssetTypeUsages(fileData, libraryData, 'typography');
  if (notEmpty(usedTypographies)) {
    fileData = absorbTypographiesHelper(fileData, usedTypographies);
  }

  fileData = absorbMedia(fileData, libraryData);
  return fileData;
}

function absorbComponents(fileData, usedComponents, libraryData) {
  const gridGap = 50;
  const [fileDataWithPage, pageId, startPos] = getOrAddLibraryPage(fileData, gridGap);

  const roots = usedComponents.map(([component]) => getComponentRoot(libraryData, component));
  const positionSeq = generateShapeGrid(roots, startPos, gridGap);

  let currentData = fileDataWithPage;
  const sortedComponents = [...usedComponents].sort((a, b) => a[0].name.localeCompare(b[0].name));

  let posIdx = 0;
  for (const [component, instances] of sortedComponents) {
    const position = positionSeq[posIdx++];
    const page = getPage(currentData, pageId);
    const mainInstanceId = component['main-instance-id'];
    const mainRoot = page?.objects?.[mainInstanceId];

    if (!mainRoot) continue;

    currentData = addComponent(currentData, {
      id: component.id,
      name: component.name,
      path: component.path,
      'main-instance-id': mainRoot.id,
      'main-instance-page': pageId,
    });

    for (const [container, shapes] of instances) {
      currentData = updateContainer(currentData, container, (c) => {
        let updated = c;
        for (const shape of shapes) {
          updated = {
            ...updated,
            objects: {
              ...(updated.objects ?? {}),
              [shape.id]: {
                ...(updated.objects?.[shape.id] ?? {}),
                'component-file': currentData.id,
              },
            },
          };
        }
        return updated;
      });
    }
  }
  return currentData;
}

function absorbColorsHelper(fileData, usedColors) {
  let result = fileData;
  for (const [color, usages] of usedColors) {
    result = addColor(result, color);
    for (const [container, shapes] of usages) {
      result = updateContainer(result, container, (c) => {
        let updated = c;
        for (const shape of shapes) {
          updated = {
            ...updated,
            objects: {
              ...(updated.objects ?? {}),
              [shape.id]: {
                ...(updated.objects?.[shape.id] ?? {}),
                'fill-color-ref-file': result.id,
              },
            },
          };
        }
        return updated;
      });
    }
  }
  return result;
}

function absorbTypographiesHelper(fileData, usedTypographies) {
  let result = fileData;
  for (const [typography, usages] of usedTypographies) {
    result = addTypography(result, typography);
    for (const [container, shapes] of usages) {
      result = updateContainer(result, container, (c) => {
        let updated = c;
        for (const shape of shapes) {
          updated = {
            ...updated,
            objects: {
              ...(updated.objects ?? {}),
              [shape.id]: remapTypographies(updated.objects?.[shape.id] ?? {}, result.id, typography),
            },
          };
        }
        return updated;
      });
    }
  }
  return result;
}

function absorbMedia(fileData, libraryData) {
  const usedMediaIds = collectUsedMedia(fileData);
  const libMedia = libraryData.media ?? {};
  const mediaToAdd = {};
  for (const [id, media] of Object.entries(libMedia)) {
    if (usedMediaIds.has(id)) {
      mediaToAdd[id] = media;
    }
  }
  if (Object.keys(mediaToAdd).length > 0) {
    return { ...fileData, media: { ...(fileData.media ?? {}), ...mediaToAdd } };
  }
  return fileData;
}

export function detachExternalReferences(file, fileId) {
  function detachText(content, targetFileId) {
    if (!content) return content;
    return transformNodes(content, (node) => {
      return (node['fill-color-ref-file'] && node['fill-color-ref-file'] !== targetFileId) ||
             (node['typography-ref-file'] && node['typography-ref-file'] !== targetFileId);
    }, (node) => {
      let result = node;
      if (result['fill-color-ref-file'] && result['fill-color-ref-file'] !== targetFileId) {
        const { 'fill-color-ref-id': _, 'fill-color-ref-file': __, ...rest } = result;
        result = rest;
      }
      if (result['typography-ref-file'] && result['typography-ref-file'] !== targetFileId) {
        const { 'typography-ref-id': _, 'typography-ref-file': __, ...rest } = result;
        result = rest;
      }
      return result;
    });
  }

  function detachShape(objects, shape) {
    let result = shape;

    if (shape['fill-color-ref-file'] && shape['fill-color-ref-file'] !== fileId) {
      const { 'fill-color-ref-id': _, 'fill-color-ref-file': __, ...rest } = result;
      result = rest;
    }

    if (shape['stroke-color-ref-file'] && shape['stroke-color-ref-file'] !== fileId) {
      const { 'stroke-color-ref-id': _, 'stroke-color-ref-file': __, ...rest } = result;
      result = rest;
    }

    if (shape['typography-ref-file'] && shape['typography-ref-file'] !== fileId) {
      const { 'typography-ref-id': _, 'typography-ref-file': __, ...rest } = result;
      result = rest;
    }

    if (shape['component-file'] && getComponentRefFile(objects, shape) !== fileId) {
      const { 'component-id': _, 'component-file': __, 'shape-ref': ___, 'component-root': ____, ...rest } = result;
      result = rest;
    }

    if (shape.type === 'text') {
      result = { ...result, content: detachText(result.content, fileId) };
    }

    return result;
  }

  function getComponentRefFile(objects, shape) {
    if ('component-file' in shape) return shape['component-file'];
    if ('shape-ref' in shape) return getComponentRefFile(objects, objects[shape['parent-id']]);
    return undefined;
  }

  function detachObjects(objects) {
    const result = {};
    for (const [id, shape] of Object.entries(objects)) {
      result[id] = detachShape(objects, shape);
    }
    return result;
  }

  function detachPages(pagesIndex) {
    const result = {};
    for (const [id, page] of Object.entries(pagesIndex)) {
      result[id] = { ...page, objects: detachObjects(page.objects ?? {}) };
    }
    return result;
  }

  const data = file.data;
  if (!data) return file;
  return { ...file, data: { ...data, 'pages-index': detachPages(data['pages-index'] ?? {}) } };
}

export function getRefChainUntilTargetRef(container, libraries, shape, targetRef) {
  const chain = [shape];
  let current = shape;
  while (current && current !== targetRef) {
    const ref = findRefShape(null, container, libraries, current, { withContext: true });
    if (!ref) break;
    chain.push(ref);
    current = ref;
  }
  return chain;
}

export function getTouchedFromRefChainUntilTargetRef(container, libraries, shape, targetRefId) {
  const chain = getRefChainUntilTargetRef(container, libraries, shape, targetRefId);
  const touchedSet = new Set();
  for (const s of chain) {
    if (s.touched) {
      for (const t of s.touched) {
        if (!swapSlotQ(t)) touchedSet.add(t);
      }
    }
  }
  if (shape.touched) {
    for (const t of shape.touched) {
      touchedSet.add(t);
    }
  }
  return touchedSet;
}

export function dumpShape(shapeId, level, objects, file, libraries, flags) {
  const shape = objects[shapeId];
  if (!shape) return '';
  const lines = [];
  const prefix = '  '.repeat(level);
  const mainMarker = shape['main-instance'] ? '{' : '';
  const mainClose = shape['main-instance'] ? '}' : '';
  const touchedMarker = shape.touched && Object.keys(shape.touched).length > 0 ? '*' : '';
  const idStr = flags?.showIds ? ` ${shape.id}` : '';
  lines.push(`${prefix}${mainMarker}${shape.name ?? '?'}${mainClose}${touchedMarker}${idStr}`);
  if (shape.shapes) {
    for (const childId of shape.shapes) {
      lines.push(dumpShape(childId, level + 1, objects, file, libraries, flags));
    }
  }
  return lines.join('\n');
}

export function dumpComponent(component, file, libraries, flags) {
  const lines = [];
  const deleted = component.deleted ? 'DELETED ' : '';
  const idStr = flags?.showIds ? ` ${component.id}` : '';
  const modifiedStr = flags?.showModified ? ` ${component['modified-at'] ?? ''}` : '';
  lines.push(`[${deleted}Component: ${component.name}]${idStr}${modifiedStr}`);
  return lines.join('\n');
}