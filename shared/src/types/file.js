import { next, zero } from '../uuid.js';
import { now as timeNow } from '../time.js';
import { withoutNils, nilv, getIn, updateWhen, updateVals } from '../data.js';
import { makeEmptyPage } from './page.js';
import { addPage, getPage, pagesSeq, updatePage } from './pages_list.js';
import { getComponent as getComponentById, componentsSeq } from './components_list.js';
import { makeContainer, unmakeContainer, pageQ } from './container.js';

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
  const pagesIndex = fileData?.['pages-index'] ?? {};
  const newPagesIndex = {};
  for (const [pageId, page] of Object.entries(pagesIndex)) {
    const objects = page?.objects ?? {};
    const newObjects = {};
    let changed = false;
    for (const [shapeId, shape] of Object.entries(objects)) {
      const result = f(shape);
      if (result?.result === 'update') {
        newObjects[shapeId] = result['updated-shape'];
        changed = true;
      } else {
        newObjects[shapeId] = shape;
      }
    }
    if (changed) {
      newPagesIndex[pageId] = { ...page, objects: newObjects };
    } else {
      newPagesIndex[pageId] = page;
    }
  }
  return { ...fileData, 'pages-index': newPagesIndex };
}