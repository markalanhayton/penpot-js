import { point } from './point.js';
import { pointsToRect, rectToCenter } from './rect.js';

export function rectToSnapPoints(rect) {
  if (rect == null) return null;
  const { x, y, width: w, height: h } = rect;
  return new Set([
    point(x, y),
    point(x + w, y),
    point(x + w, y + h),
    point(x, y + h),
    rectToCenter(rect),
  ]);
}

function frameToSnapPoints(frame) {
  const points = frame.points ?? [];
  const rect = pointsToRect(points);
  const { x, y, width: w, height: h } = rect;
  return new Set([
    ...rectToSnapPoints(rect),
    point(x + w / 2, y),
    point(x + w, y + h / 2),
    point(x + w / 2, y + h),
    point(x, y + h / 2),
  ]);
}

export function shapeToSnapPoints(shape) {
  if (shape.type === 'frame') {
    return frameToSnapPoints(shape);
  }
  const points = shape.points ?? [];
  const center = shapeToCenter(shape);
  return new Set([...points, center]);
}

function shapeToCenter(shape) {
  const rect = shape.selrect ?? shape;
  return point(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

export function guideToSnapPoints(guide, frame) {
  if (frame && !frame.rotated && !isDirectChildOfRoot(frame)) {
    return new Set();
  }
  if (guide.axis === 'x') {
    return new Set([point(guide.position, 0)]);
  }
  return new Set([point(0, guide.position)]);
}

function isDirectChildOfRoot(frame) {
  return frame?.['parent-id'] === '00000000-0000-0000-0000-000000000000';
}