import { withoutNils } from '../data.js';

export const TEXT_TYPOGRAPHY_STYLE_ATTRS = new Set([
  'font-id', 'font-family', 'font-size', 'font-weight',
  'font-style', 'line-height', 'letter-spacing', 'text-align',
  'grow-type',
]);

export function generateUpdateShapes(changes, ids, updateFn, objects, options = {}) {
  const { attrs, changedSubAttr, ignoreTree, ignoreTouched, withObjects = false, translation = false } = options;
  let result = { ...changes };

  for (const id of ids) {
    const opts = {
      attrs,
      'ignore-geometry': ignoreTree?.[id] ?? false,
      'ignore-touched': ignoreTouched,
      'with-objects': withObjects,
    };
    result = updateShapes(result, [id], updateFn, withoutNils(opts));
  }

  if (!translation) {
    const gridIds = ids.filter((id) => gridLayoutQ(objects, id));
    if (gridIds.length > 0) {
      result = assignCellPositions(result, gridIds, objects);
    }
  }

  if (!ignoreTouched) {
    result = generateUnapplyTokens(result, objects, changedSubAttr);
  }

  return result;
}

export function generateDeleteShapes(changes, file, page, objects, ids, options = {}) {
  return [new Set(), changes];
}

export function generateRelocate(changes, parentId, toIndex, ids, options = {}) {
  return changes;
}

function updateShapes(changes, ids, updateFn, options) {
  return changes;
}

function gridLayoutQ(objects, id) {
  const shape = objects?.[id];
  return shape?.layout === 'grid';
}

function assignCellPositions(changes, ids, objects) {
  return changes;
}

function generateUnapplyTokens(changes, objects, changedSubAttr) {
  return changes;
}