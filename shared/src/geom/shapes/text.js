import * as grc from '../rect.js';
import * as gco from './common.js';

export function positionDataToRect({ x, y, width, height }) {
  return grc.makeRect(x, y - height, width, height);
}

export function shapeToRect(shape) {
  const points = shape.positionData
    ?.flatMap((pd) => grc.rectToPoints(positionDataToRect(pd)));
  if (points && points.length > 0) {
    return grc.pointsToRect(points);
  }
  return shape.selrect;
}

export function shapeToBounds(shape, transformMatrixFn) {
  const points = shape.positionData
    ?.flatMap((pd) => grc.rectToPoints(positionDataToRect(pd)));
  if (!points || points.length === 0) return shape.selrect;
  const tm = typeof transformMatrixFn === 'function' ? transformMatrixFn(shape) : null;
  const transformed = tm != null ? gco.transformPoints(points, tm) : points;
  return grc.pointsToRect(transformed);
}

export function overlapsPositionDataQ(shape, positionData) {
  const boundingBox = grc.pointsToRect(shape.points);
  if (!boundingBox) return false;
  for (const pd of positionData) {
    const rect = { ...pd, y: pd.y - pd.height };
    if (grc.overlapsRects(boundingBox, rect)) return true;
  }
  return false;
}