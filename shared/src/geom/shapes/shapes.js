import * as d from '../../data.js';
import * as gpt from '../point.js';
import * as grc from '../rect.js';
import * as gco from './common.js';
import * as gtr from './transforms.js';
import * as gsc from './corners.js';
import * as mth from '../../math.js';

export function translateToFrame(shape, frame) {
  return gtr.move(shape, gpt.point(-frame.x, -frame.y));
}

export function translateFromFrame(shape, frame) {
  return gtr.move(shape, gpt.point(frame.x, frame.y));
}

export function shapeToRect(shape) {
  const { x, y, width, height } = shape;
  if (typeof x === 'number' && typeof y === 'number' &&
      typeof width === 'number' && typeof height === 'number') {
    return grc.makeRect(x, y, width, height);
  }
  return undefined;
}

export function boundingBox(shape) {
  return grc.pointsToRect(shape.points);
}

export function leftBound(shape) {
  return shape.x ?? shape.selrect?.x;
}

export function topBound(shape) {
  return shape.y ?? shape.selrect?.y;
}

export function fullyContainedQ(rect, other) {
  return rect.x1 <= other.x1 && rect.x2 >= other.x2 &&
         rect.y1 <= other.y1 && rect.y2 >= other.y2;
}

export function padSelrec(selrect, size = 1) {
  const inc = (v) => v + size;
  const dec = (v) => v - size;
  return {
    ...selrect,
    x: dec(selrect.x),
    y: dec(selrect.y),
    x1: dec(selrect.x1),
    y1: dec(selrect.y1),
    x2: inc(selrect.x2),
    y2: inc(selrect.y2),
    width: inc(inc(selrect.width)),
    height: inc(inc(selrect.height)),
  };
}

export function getAreas(bounds, selrect) {
  return {
    left: grc.cornersToRect(bounds.x1, selrect.y1, selrect.x1, selrect.y2),
    top: grc.cornersToRect(selrect.x1, bounds.y1, selrect.x2, selrect.y1),
    right: grc.cornersToRect(selrect.x2, selrect.y1, bounds.x2, selrect.y2),
    bottom: grc.cornersToRect(selrect.x1, selrect.y2, selrect.x2, bounds.y2),
  };
}

export function distanceSelrect(selrect, other) {
  const x1 = other.x1;
  const y1 = other.y1;
  const x2 = selrect.x2;
  const y2 = selrect.y2;
  return gpt.point(x1 - x2, y1 - y2);
}

export function distanceShapes(shape, other) {
  return distanceSelrect(shape.selrect, other.selrect);
}

export function closeAttrsQ(attr, val1, val2, precision) {
  if (precision === undefined) precision = mth.FLOAT_EQUAL_PRECISION;

  function closeValQ(num1, num2) {
    if (typeof num1 === 'number' && typeof num2 === 'number') {
      return mth.abs(num1 - num2) < precision;
    }
    return false;
  }

  if (typeof val1 === 'number' && typeof val2 === 'number') {
    return closeValQ(val1, val2);
  }

  if (attr === 'selrect') {
    const keys = ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height'];
    return keys.every((k) => closeValQ(val1[k], val2[k]));
  }

  if (attr === 'points' || attr === 'position-data') {
    const zipped = d.zip(val1, val2);
    return zipped.every(([, [a, b]]) =>
      closeValQ(a?.x, b?.x) && closeValQ(a?.y, b?.y)
    );
  }

  return val1 === val2;
}

export const shapeToCenter = gco.shapeToCenter;
export const shapesToRect = gco.shapesToRect;
export const pointsToCenter = gco.pointsToCenter;
export const transformPoints = gco.transformPoints;
export const shapeToPoints = gco.shapeToPoints;

export const move = gtr.move;
export const absoluteMove = gtr.absoluteMove;
export const transformMatrix = gtr.transformMatrix;
export const transformStr = gtr.transformStr;
export const inverseTransformMatrix = gtr.inverseTransformMatrix;
export const transformRect = gtr.transformRect;
export const calculateGeometry = gtr.calculateGeometry;
export const calculateSelrect = gtr.calculateSelrect;
export const updateGroupSelrect = gtr.updateGroupSelrect;
export const updateMaskSelrect = gtr.updateMaskSelrect;
export const applyTransform = gtr.applyTransform;
export const transformShape = gtr.transformShape;
export const transformSelrect = gtr.transformSelrect;
export const transformSelrectMatrix = gtr.transformSelrectMatrix;
export const transformBounds = gtr.transformBounds;
export const movePositionData = gtr.movePositionData;
export const applyObjectsModifiers = gtr.applyObjectsModifiers;
export const applyChildrenModifiers = gtr.applyChildrenModifiers;
export const updateShapesGeometry = gtr.updateShapesGeometry;

export const shapeCorners1 = gsc.shapeCorners1;
export const shapeCorners4 = gsc.shapeCorners4;

export const rectToPoints = grc.rectToPoints;
export const centerToRect = grc.centerToRect;