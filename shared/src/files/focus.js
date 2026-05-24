import * as d from '../data.js';
import * as cfh from './helpers.js';
import * as ctt from '../types/shape_tree.js';
import * as uuid from '../uuid.js';

export function focusObjects(objects, focus) {
  if (!d.notEmpty(focus)) return objects;

  const idsWithChildren = new Set([uuid.zero, ...focus]);
  for (const id of focus) {
    for (const cid of cfh.getChildrenIds(objects, id)) {
      idsWithChildren.add(cid);
    }
  }

  const result = {};
  for (const id of idsWithChildren) {
    if (objects[id]) result[id] = objects[id];
  }

  if (result[uuid.zero]) {
    result[uuid.zero] = {
      ...result[uuid.zero],
      shapes: ctt.sortZIndex(objects, focus),
    };
  }

  return result;
}

export function filterNotFocus(objects, focus, ids) {
  if (!d.notEmpty(focus)) return ids;

  const focusedIds = new Set(focus);
  for (const id of focus) {
    for (const cid of cfh.getChildrenIds(objects, id)) {
      focusedIds.add(cid);
    }
  }

  return ids.filter(id => focusedIds.has(id));
}

export function isInFocusQ(objects, focus, id) {
  const allIds = [id, ...cfh.getParentIds(objects, id)];
  return allIds.some(fid => focus.has(fid));
}