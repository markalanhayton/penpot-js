import { getIn, updateInWhen, dissocIn, updateWhen } from '../data.js';
import { diffComponents, usesLibraryComponentsQ } from './component.js';

function touch(component, nowFn) {
  return { ...component, 'modified-at': (nowFn ?? Date.now)() };
}

export function components(fileData, options) {
  const comps = fileData.components ?? {};
  if (options?.includeDeleted) return comps;
  const result = {};
  for (const [k, v] of Object.entries(comps)) {
    if (!v.deleted) result[k] = v;
  }
  return result;
}

export function componentsSeq(fileData) {
  return Object.values(fileData.components ?? {}).filter((c) => !c.deleted);
}

export function deletedComponentsSeq(fileData) {
  return Object.values(fileData.components ?? {}).filter((c) => c.deleted);
}

export function addComponent(fData, { id, name, path, 'main-instance-id': mainInstanceId, 'main-instance-page': mainInstancePage, annotation, 'variant-id': variantId, 'variant-properties': variantProperties }) {
  const now = Date.now();
  let comps = { ...(fData.components ?? {}) };
  comps[id] = touch({
    id,
    name,
    path,
    'main-instance-id': mainInstanceId,
    'main-instance-page': mainInstancePage,
  }, () => now);

  if (annotation != null) comps[id].annotation = annotation;
  if (variantId != null) comps[id]['variant-id'] = variantId;
  if (variantProperties != null) comps[id]['variant-properties'] = variantProperties;

  return { ...fData, components: comps };
}

export function modComponent(fileData, { id, name, path, 'main-instance-id': mainInstanceId, 'main-instance-page': mainInstancePage, objects, annotation, 'variant-id': variantId, 'variant-properties': variantProperties, 'modified-at': modifiedAt }) {
  const comps = fileData.components ?? {};
  const component = comps[id];
  if (!component) return fileData;

  let newComp = { ...component };
  if (name != null) newComp.name = name;
  if (path != null) newComp.path = path;
  if (mainInstanceId != null) newComp['main-instance-id'] = mainInstanceId;
  if (mainInstancePage != null) newComp['main-instance-page'] = mainInstancePage;
  if (objects != null) newComp.objects = objects;
  if (objects === null) delete newComp.objects;
  if (modifiedAt != null) newComp['modified-at'] = modifiedAt;
  if (annotation != null) newComp.annotation = annotation;
  if (annotation === null) delete newComp.annotation;
  if (variantId != null) newComp['variant-id'] = variantId;
  if (variantId === null) delete newComp['variant-id'];
  if (variantProperties != null) newComp['variant-properties'] = variantProperties;
  if (variantProperties === null) delete newComp['variant-properties'];

  const diff = diffComponents(component, newComp);
  const nonTouchKeys = new Set(['annotation', 'modified-at', 'variant-id', 'variant-properties']);
  let shouldTouch = false;
  for (const key of diff) {
    if (!nonTouchKeys.has(key)) { shouldTouch = true; break; }
  }

  if (shouldTouch) newComp = touch(newComp);

  return {
    ...fileData,
    components: { ...comps, [id]: newComp },
  };
}

export function getComponent(fileData, componentId, includeDeleted) {
  const component = (fileData.components ?? {})[componentId];
  if (!component) return undefined;
  if (includeDeleted || !component.deleted) return component;
  return undefined;
}

export function getDeletedComponent(fileData, componentId) {
  const component = (fileData.components ?? {})[componentId];
  if (component?.deleted) return component;
  return undefined;
}

export function updateComponent(fileData, componentId, f, ...args) {
  const comps = fileData.components ?? {};
  const component = comps[componentId];
  if (!component) return fileData;
  const updated = touch(f(component, ...args));
  return {
    ...fileData,
    components: { ...comps, [componentId]: updated },
  };
}

export function setComponentModified(fileData, componentId) {
  return updateComponent(fileData, componentId, (c) => c);
}

export function deleteComponent(fileData, componentId) {
  const { [componentId]: _, ...rest } = fileData.components ?? {};
  return { ...fileData, components: rest };
}

export function markComponentDeleted(fileData, componentId) {
  const comps = fileData.components ?? {};
  const component = comps[componentId];
  if (!component) return fileData;
  return {
    ...fileData,
    components: { ...comps, [componentId]: { ...component, deleted: true } },
  };
}

export function markComponentUndeleted(fileData, componentId) {
  const comps = fileData.components ?? {};
  const component = comps[componentId];
  if (!component) return fileData;
  const result = { ...component };
  delete result.deleted;
  return {
    ...fileData,
    components: { ...comps, [componentId]: result },
  };
}

export function usedComponentsChangedSince(shape, library, sinceDate) {
  if (!usesLibraryComponentsQ(shape, library.id)) return [];
  const component = getComponent(library.data, shape['component-id']);
  if (!component) return [];
  const modifiedAt = component['modified-at'];
  if (modifiedAt == null || modifiedAt < sinceDate) return [];
  return [{ 'shape-id': shape.id, 'asset-id': shape['component-id'], 'asset-type': 'component' }];
}

export function getComponentAnnotation(shape, libraries) {
  const libraryData = libraries?.[shape['component-file']]?.data;
  if (!libraryData) return undefined;
  const component = getComponent(libraryData, shape['component-id'], true);
  return component?.annotation;
}