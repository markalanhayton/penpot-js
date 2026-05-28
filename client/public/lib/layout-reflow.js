'use strict';

import { setObjectsModifiers } from '@penpot/shared/geom/modifiers.js';
import { applyObjectsModifiers } from '@penpot/shared/geom/shapes/transforms.js';
import { point } from '@penpot/shared/geom/point.js';
import { empty, moveParent, resizeParent, isEmpty, reflow } from '@penpot/shared/modifiers.js';

/**
 * Compute layout reflow for a frame with flex or grid layout.
 *
 * When layout properties change (direction, gap, padding, alignment, etc.),
 * this recalculates child positions and sizes using the shared modifier pipeline.
 *
 * @param {Object} shapesMap - Page shapes as { id: shape } map.
 * @param {string} frameId  - The id of the layout frame.
 * @param {Object} [opts]   - Options: ignoreConstraints (bool, default false).
 * @returns {Array<{id: string, x: number, y: number, width?: number, height?: number}>}
 *   Array of shape property updates for all layout children.
 */
export function reflowLayout(shapesMap, frameId, opts) {
  const { ignoreConstraints = false } = opts || {};

  const frame = shapesMap[frameId];
  if (!frame) return [];

  const hasLayout = frame.layout === 'flex' || frame.layout === 'grid';
  if (!hasLayout) return [];

  const childIds = frame.shapes || [];
  if (childIds.length === 0) return [];

  let mod = empty();
  mod = reflow(mod);

  let modifTree = { [frameId]: { modifiers: mod } };

  modifTree = setObjectsModifiers(modifTree, shapesMap, { ignoreConstraints });

  const updated = applyObjectsModifiers(shapesMap, modifTree);

  const result = [];
  for (const id of Object.keys(modifTree)) {
    if (id === frameId) continue;
    const shape = updated[id];
    if (!shape) continue;

    const orig = shapesMap[id];
    if (!orig) continue;

    const changes = { id };
    if (shape.x !== undefined && Math.abs(shape.x - orig.x) > 0.5) changes.x = shape.x;
    if (shape.y !== undefined && Math.abs(shape.y - orig.y) > 0.5) changes.y = shape.y;
    if (shape.width !== undefined && Math.abs(shape.width - orig.width) > 0.5) changes.width = shape.width;
    if (shape.height !== undefined && Math.abs(shape.height - orig.height) > 0.5) changes.height = shape.height;

    if (changes.x !== undefined || changes.y !== undefined || changes.width !== undefined || changes.height !== undefined) {
      if (shape.selrect) changes.selrect = shape.selrect;
      if (shape.points) changes.points = shape.points;
      result.push(changes);
    }
  }

  return result;
}

/**
 * Compute layout reflow with an explicit frame resize (layout change + size change).
 *
 * Use this when a frame's layout properties AND size change at the same time.
 *
 * @param {Object} shapesMap - Page shapes as { id: shape } map.
 * @param {string} frameId  - The id of the layout frame.
 * @param {Object} oldFrame - The frame shape before resize/layout change.
 * @param {Object} newDims  - { x, y, width, height } of the frame after changes.
 * @param {Object} [opts]   - Options: ignoreConstraints (bool, default false).
 * @returns {Array<{id: string, x: number, y: number, width?: number, height?: number}>}
 */
export function reflowLayoutWithResize(shapesMap, frameId, oldFrame, newDims, opts) {
  const { ignoreConstraints = false } = opts || {};

  const frame = shapesMap[frameId];
  if (!frame) return [];

  const hasLayout = frame.layout === 'flex' || frame.layout === 'grid';

  const childIds = frame.shapes || [];
  if (childIds.length === 0 && !hasLayout) return [];

  let mod = empty();

  if (newDims && (newDims.x !== undefined || newDims.y !== undefined || newDims.width !== undefined || newDims.height !== undefined)) {
    const scaleX = (newDims.width || oldFrame.width) / (oldFrame.width || 1);
    const scaleY = (newDims.height || oldFrame.height) / (oldFrame.height || 1);
    const dx = (newDims.x != null ? newDims.x : oldFrame.x) - oldFrame.x;
    const dy = (newDims.y != null ? newDims.y : oldFrame.y) - oldFrame.y;

    if (dx !== 0 || dy !== 0) {
      mod = moveParent(mod, point(dx, dy));
    }
    mod = resizeParent(mod, point(scaleX, scaleY), point(oldFrame.x, oldFrame.y), oldFrame.transform, oldFrame['transform-inverse']);
  }

  mod = reflow(mod);

  if (isEmpty(mod)) return [];

  let modifTree = { [frameId]: { modifiers: mod } };

  modifTree = setObjectsModifiers(modifTree, shapesMap, { ignoreConstraints });

  const updated = applyObjectsModifiers(shapesMap, modifTree);

  const result = [];
  for (const id of Object.keys(modifTree)) {
    if (id === frameId) continue;
    const shape = updated[id];
    if (!shape) continue;

    const orig = shapesMap[id];
    if (!orig) continue;

    const changes = { id };
    if (shape.x !== undefined && Math.abs(shape.x - orig.x) > 0.5) changes.x = shape.x;
    if (shape.y !== undefined && Math.abs(shape.y - orig.y) > 0.5) changes.y = shape.y;
    if (shape.width !== undefined && Math.abs(shape.width - orig.width) > 0.5) changes.width = shape.width;
    if (shape.height !== undefined && Math.abs(shape.height - orig.height) > 0.5) changes.height = shape.height;

    if (changes.x !== undefined || changes.y !== undefined || changes.width !== undefined || changes.height !== undefined) {
      if (shape.selrect) changes.selrect = shape.selrect;
      if (shape.points) changes.points = shape.points;
      result.push(changes);
    }
  }

  return result;
}