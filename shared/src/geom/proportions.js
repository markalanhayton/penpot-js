import { notEmpty } from '../data.js';

export function assignProportions(shape) {
  const { width, height } = shape.selrect ?? shape;
  return { ...shape, proportion: width / height };
}

export function setupProportionsImage(shape) {
  const { width, height } = shape.metadata ?? {};
  return {
    ...shape,
    proportion: width / height,
    'proportion-lock': true,
  };
}

export function setupProportionsSize(shape) {
  const { width, height } = shape.selrect ?? shape;
  return {
    ...shape,
    proportion: width / height,
    'proportion-lock': true,
  };
}

export function setupProportionsConst(shape) {
  return {
    ...shape,
    proportion: 1.0,
    'proportion-lock': false,
  };
}

export function setupProportions(shape) {
  const imageFillQ = notEmpty(shape.fills) && shape.fills?.every((f) => f?.['fill-image'] != null);
  switch (shape.type) {
    case 'svg-raw': return setupProportionsSize(shape);
    case 'image': return setupProportionsImage(shape);
    case 'text': return shape;
    default:
      if (imageFillQ) return setupProportionsSize(shape);
      return setupProportionsConst(shape);
  }
}