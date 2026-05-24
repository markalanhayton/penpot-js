import * as d from '../data.js';
import * as cfh from './helpers.js';
import * as uuid from '../uuid.js';

function generateIndex(index, objects, shapeId, parents) {
  const shape = objects[shapeId];
  index = { ...index, [shapeId]: parents };
  const newParents = [shapeId, ...parents];
  for (const childId of (shape?.shapes || [])) {
    index = generateIndex(index, objects, childId, newParents);
  }
  return index;
}

export function generateChildAllParentsIndex(objects, shapes) {
  if (shapes) {
    const result = {};
    for (const shape of shapes) {
      result[shape.id] = cfh.getParentIds(objects, shape.id);
    }
    return result;
  }
  return generateIndex({}, objects, uuid.zero, []);
}

export function createClipIndex(objects, parentsIndex) {
  function getClipParents(shape) {
    const shapeId = shape.id;
    const result = [];

    if ((cfh.frameShapeQ(shape) && !shape['show-content'] && shapeId !== uuid.zero) ||
        cfh.boolShapeQ(shape)) {
      result.push(shape);
    }

    if (shape['masked-group'] ?? shape.maskedGroup) {
      const firstChildId = shape.shapes?.[0];
      if (firstChildId && objects[firstChildId]) {
        result.push(objects[firstChildId]);
      }
    }

    return result;
  }

  function populateWithClips(parents) {
    const result = [];
    for (const parentId of parents) {
      const shape = objects[parentId];
      if (shape) {
        result.push(...getClipParents(shape));
      }
    }
    return result;
  }

  const result = {};
  for (const [shapeId, parents] of Object.entries(parentsIndex)) {
    result[shapeId] = populateWithClips(parents);
  }
  return result;
}