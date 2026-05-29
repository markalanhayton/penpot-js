/* global console */
import { updateAllShapes, updateComponents, findRefShape, findNearMatch } from '../types/file.js';
import { subcopyHeadQ, getSwapSlot, setSwapSlot } from '../types/component.js';

export function removeUnneededObjectsInComponents(fileData) {
  return updateComponents(fileData, (component) => {
    if (component.deleted) {
      if (component.objects == null) {
        console.warn('Adding empty objects to deleted component', component.id, component.name);
        return { ...component, objects: {} };
      }
      return component;
    }
    if ('objects' in component) {
      console.warn('Removing objects from non-deleted component', component.id, component.name);
      const { objects, ...rest } = component;
      return rest;
    }
    return component;
  });
}

export function fixMissingSwapSlots(fileData, libraries) {
  return updateAllShapes(fileData, (shape) => {
    if (!subcopyHeadQ(shape)) return { result: 'keep' };

    const container = shape.metadata?.container;
    const file = { id: fileData.id, data: fileData };
    const nearMatch = findNearMatch(file, container, libraries, shape);

    if (
      nearMatch != null &&
      shape['shape-ref'] !== nearMatch.id &&
      getSwapSlot(shape) == null
    ) {
      const updatedShape = setSwapSlot(shape, nearMatch.id);
      console.warn(
        'Adding missing swap slot to shape',
        shape.id, shape.name, nearMatch.id
      );
      return { result: 'update', 'updated-shape': updatedShape };
    }
    return { result: 'keep' };
  });
}

export function syncComponentIdWithRefShape(fileData, libraries) {
  let currentData = fileData;
  let iteration = 0;

  while (iteration < 20) {
    const nextData = syncOneIteration(currentData, libraries);
    if (nextData === currentData) break;
    currentData = nextData;
    iteration++;
  }
  return currentData;
}

function syncOneIteration(fileData, libraries) {
  return updateAllShapes(fileData, (shape) => {
    if (!subcopyHeadQ(shape) || getSwapSlot(shape) != null) {
      return { result: 'keep' };
    }

    const container = shape.metadata?.container;
    const file = { id: fileData.id, data: fileData };
    const refShape = findRefShape(file, container, libraries, shape);

    if (refShape == null) return { result: 'keep' };

    const needsUpdate =
      shape['component-id'] !== refShape['component-id'] ||
      shape['component-file'] !== refShape['component-file'];

    if (!needsUpdate) return { result: 'keep' };

    const updated = { ...shape };
    if (refShape['component-id'] != null) {
      updated['component-id'] = refShape['component-id'];
    } else {
      delete updated['component-id'];
    }
    if (refShape['component-file'] != null) {
      updated['component-file'] = refShape['component-file'];
    } else {
      delete updated['component-file'];
    }

    console.warn(
      'Syncing component id and file with ref shape',
      shape.id, shape.name,
      updated['component-id'], updated['component-file'],
      refShape.id
    );
    return { result: 'update', 'updated-shape': updated };
  });
}