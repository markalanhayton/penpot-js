'use strict';

import { setObjectsModifiers } from '@penpot/shared/geom/modifiers.js';
import { applyObjectsModifiers } from '@penpot/shared/geom/shapes/transforms.js';
import { point } from '@penpot/shared/geom/point.js';
import { empty, moveParent, resizeParent, isEmpty } from '@penpot/shared/modifiers.js';

/**
 * Propagate constraints when a parent frame is resized.
 *
 * @param {Object} shapesMap  - Page shapes as { id: shape } map.
 *   Each shape must have: id, points (4 Point array), selrect,
 *   constraintsH, constraintsV, shapes (child ids), parentId/parent-id,
 *   transform/transform-inverse, type, x, y, width, height.
 * @param {string} frameId    - The id of the frame being resized.
 * @param {Object} oldFrame  - The frame shape before resize (used for origin/dimensions).
 * @param {Object} newDims   - { x, y, width, height } of the frame after resize.
 * @param {Object} [opts]    - Options: ignoreConstraints (bool, default false).
 * @returns {Array<{id: string, x: number, y: number, width: number, height: number}>}
 *   Array of shape property updates for all affected children.
 */
export function propagateFrameResize(shapesMap, frameId, oldFrame, newDims, opts) {
  const { ignoreConstraints = false } = opts || {};

  const scaleX = newDims.width / (oldFrame.width || 1);
  const scaleY = newDims.height / (oldFrame.height || 1);

  const dx = (newDims.x != null ? newDims.x : oldFrame.x) - oldFrame.x;
  const dy = (newDims.y != null ? newDims.y : oldFrame.y) - oldFrame.y;

  const children = oldFrame.shapes || [];

  if (children.length === 0) return [];

  let mod = empty();

  if (dx !== 0 || dy !== 0) {
    mod = moveParent(mod, point(dx, dy));
  }

  const originPt = point(oldFrame.x, oldFrame.y);
  mod = resizeParent(mod, point(scaleX, scaleY), originPt, oldFrame.transform, oldFrame['transform-inverse']);

  if (isEmpty(mod)) return [];

  let modifTree = { [frameId]: { modifiers: mod } };

  modifTree = setObjectsModifiers(modifTree, shapesMap, { ignoreConstraints });

  const updated = applyObjectsModifiers(shapesMap, modifTree);

  const result = [];
  for (const id of Object.keys(modifTree)) {
    if (id === frameId) continue;
    const shape = updated[id];
    if (!shape) continue;

    const changes = {};
    if (shape.x !== undefined) changes.x = shape.x;
    if (shape.y !== undefined) changes.y = shape.y;
    if (shape.width !== undefined) changes.width = shape.width;
    if (shape.height !== undefined) changes.height = shape.height;
    if (shape.selrect) {
      changes.selrect = shape.selrect;
    }
    if (shape.points) {
      changes.points = shape.points;
    }

    result.push({ id, ...changes });
  }

  return result;
}

/**
 * Build a modifier tree for a frame resize (without applying it).
 *
 * Useful when you want to integrate with the client's own modifier application
 * pipeline rather than getting resolved property values.
 *
 * @param {Object} shapesMap  - Page shapes as { id: shape } map.
 * @param {string} frameId    - The id of the frame being resized.
 * @param {Object} oldFrame  - The frame shape before resize.
 * @param {Object} newDims   - { x, y, width, height } after resize.
 * @param {Object} [opts]    - Options: ignoreConstraints (bool, default false).
 * @returns {Object} The propagated modifier tree { id: { modifiers } }.
 */
export function buildFrameResizeModifiers(shapesMap, frameId, oldFrame, newDims, opts) {
  const { ignoreConstraints = false } = opts || {};

  const scaleX = newDims.width / (oldFrame.width || 1);
  const scaleY = newDims.height / (oldFrame.height || 1);

  const dx = (newDims.x != null ? newDims.x : oldFrame.x) - oldFrame.x;
  const dy = (newDims.y != null ? newDims.y : oldFrame.y) - oldFrame.y;

  let mod = empty();

  if (dx !== 0 || dy !== 0) {
    mod = moveParent(mod, point(dx, dy));
  }

  const originPt = point(oldFrame.x, oldFrame.y);
  mod = resizeParent(mod, point(scaleX, scaleY), originPt, oldFrame.transform, oldFrame['transform-inverse']);

  if (isEmpty(mod)) return {};

  let modifTree = { [frameId]: { modifiers: mod } };

  modifTree = setObjectsModifiers(modifTree, shapesMap, { ignoreConstraints });

  return modifTree;
}

/**
 * Extract simple (x, y, width, height) updates from an applied-objects map.
 *
 * @param {Object} originalShapes - Original shapes map.
 * @param {Object} updatedShapes   - Shapes map after modifiers applied.
 * @param {string[]} [ids]         - Specific ids to extract; defaults to all changed.
 * @returns {Array<{id: string, x: number, y: number, width: number, height: number}>}
 */
export function extractShapeUpdates(originalShapes, updatedShapes, ids) {
  const targetIds = ids || Object.keys(updatedShapes);
  const result = [];

  for (const id of targetIds) {
    const orig = originalShapes[id];
    const updated = updatedShapes[id];
    if (!orig || !updated) continue;

    const changes = { id };
    let changed = false;

    if (updated.x !== undefined && updated.x !== orig.x) { changes.x = updated.x; changed = true; }
    if (updated.y !== undefined && updated.y !== orig.y) { changes.y = updated.y; changed = true; }
    if (updated.width !== undefined && updated.width !== orig.width) { changes.width = updated.width; changed = true; }
    if (updated.height !== undefined && updated.height !== orig.height) { changes.height = updated.height; changed = true; }

    if (changed) result.push(changes);
  }

  return result;
}