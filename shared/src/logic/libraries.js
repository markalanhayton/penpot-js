export function prettyFile(fileId, libraries, currentFileId) {
  if (fileId === currentFileId) return '<local>';
  const lib = libraries?.[fileId];
  return lib ? `<${lib.name}>` : '<unknown>';
}

export function prettyUuid(uuid) {
  const str = String(uuid);
  return str.slice(-6);
}

export function generateDuplicateComponent(changes, library, componentId, newComponentId, options = {}) {
  return [null, changes];
}

export function generateInstantiateComponent(changes, objects, fileId, componentId, position, page, libraries, oldId, parentId, frameId, params) {
  return [null, changes];
}

export function generateDetachInstance(changes, container, libraries, shapeId) {
  return changes;
}

export function generateSyncFile(changes, fileId, assetType, assetId, libraryId, libraries, currentFileId) {
  return changes;
}

export function generateSyncLibrary(changes, fileId, assetType, assetId, libraryId, libraries, currentFileId) {
  return changes;
}

export function generateSyncShapeDirect(changes, file, libraries, container, shapeId, reset) {
  return changes;
}

export function generateSyncShapeInverse(changes, file, libraries, container, shapeId) {
  return changes;
}

export function generateRenameComponent(changes, id, newName, libraryData) {
  const [path, name] = splitGroupName(newName);
  return changes;
}

export function updateAttrsOnSwitch(changes, relatedShapeInNew, origChildTouched, newShape, originalShape, origRefShape, container) {
  return changes;
}

function splitGroupName(newName) {
  const lastSlash = newName.lastIndexOf(' / ');
  if (lastSlash === -1) return ['', newName];
  return [newName.slice(0, lastSlash), newName.slice(lastSlash + 3)];
}

export function usesAssetsQ(assetType, assetId, shape, libraryId) {
  return false;
}