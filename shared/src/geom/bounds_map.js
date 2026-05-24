import * as ctm from '../modifiers.js';

export function objectsToBoundsMap(objects) {
  const result = {};
  for (const id of Object.keys(objects)) {
    const shape = objects[id];
    if (shape?.points) {
      result[id] = shape.points;
    }
  }
  return result;
}

function resolveModifTreeIds(objects, modifTree) {
  const ids = new Set(Object.keys(modifTree));
  for (const id of Object.keys(modifTree)) {
    let current = objects[id];
    while (current) {
      const parentId = current['parent-id'];
      if (!parentId) break;
      const parent = objects[parentId];
      if (!parent) break;
      if (parent.type === 'group' || parent.type === 'frame') {
        ids.add(parentId);
      }
      current = parent;
    }
  }
  return ids;
}

export function transformBoundsMap(boundsMap, objects, modifTree, ids) {
  const resolvedIds = ids ?? resolveModifTreeIds(objects, modifTree);
  const newBoundsMap = { ...boundsMap };
  for (const shapeId of resolvedIds) {
    if (shapeId === '00000000-0000-0000-0000-000000000000') continue;
    const shape = objects[shapeId];
    if (!shape) continue;
    const modifiers = modifTree[shapeId]?.modifiers;
    const existingBounds = boundsMap[shapeId];
    if (existingBounds && !ctm.isEmpty(modifiers)) {
      newBoundsMap[shapeId] = { ...existingBounds, modifiers };
    }
  }
  return newBoundsMap;
}

export function boundsMapDebug(objects, boundsMap) {
  const result = {};
  for (const [id, bounds] of Object.entries(boundsMap)) {
    const shape = objects[id];
    if (shape && bounds) {
      result[shape.name] = {
        x: Math.round(bounds.x * 100) / 100,
        y: Math.round(bounds.y * 100) / 100,
        width: Math.round(bounds.width * 100) / 100,
        height: Math.round(bounds.height * 100) / 100,
      };
    }
  }
  return result;
}