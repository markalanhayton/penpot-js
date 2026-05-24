import * as d from '../../data.js';
import * as gmt from '../matrix.js';
import * as gpt from '../point.js';
import * as grc from '../rect.js';
import * as gco from './common.js';
import * as mth from '../../math.js';

const CLOCKWISE = 'clockwise';
const COUNTER_CLOCKWISE = 'counter-clockwise';
const COPLANAR = 'coplanar';

export function orientation(p1, p2, p3) {
  const { x: x1, y: y1 } = p1;
  const { x: x2, y: y2 } = p2;
  const { x: x3, y: y3 } = p3;
  const v = (y2 - y1) * (x3 - x2) - (y3 - y2) * (x2 - x1);
  if (v > 0) return CLOCKWISE;
  if (v < 0) return COUNTER_CLOCKWISE;
  return COPLANAR;
}

export function onSegmentQ({ x: qx, y: qy }, { x: px, y: py }, { x: rx, y: ry }) {
  return qx <= Math.max(px, rx) && qx >= Math.min(px, rx) &&
         qy <= Math.max(py, ry) && qy >= Math.min(py, ry);
}

export function intersectSegmentsQ([p1, q1], [p2, q2]) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  return (
    (o1 !== o2 && o3 !== o4) ||
    (o1 === COPLANAR && onSegmentQ(p2, p1, q1)) ||
    (o2 === COPLANAR && onSegmentQ(q2, p1, q1)) ||
    (o3 === COPLANAR && onSegmentQ(p1, p2, q2)) ||
    (o4 === COPLANAR && onSegmentQ(q1, p2, q2))
  );
}

export function pointsToLines(points, closed = true) {
  const rest = points.slice(1);
  const tail = closed ? [points[0]] : [];
  const result = [];
  for (let i = 0; i < rest.length; i++) {
    result.push([points[i], rest[i]]);
  }
  if (tail.length > 0 && rest.length > 0) {
    result.push([rest[rest.length - 1], tail[0]]);
  } else if (closed && points.length > 0) {
    result.push([points[points.length - 1], points[0]]);
  }
  return result;
}

export function intersectsLinesQ(linesA, linesB) {
  for (const curLine of linesA) {
    for (const otherLine of linesB) {
      if (intersectSegmentsQ(curLine, otherLine)) return true;
    }
  }
  return false;
}

export function intersectRayQ({ x: px, y: py }, [{ x: x1, y: y1 }, { x: x2, y: y2 }]) {
  if ((y1 <= py && y2 > py) || (y1 > py && y2 <= py)) {
    const vt = (py - y1) / (y2 - y1);
    const ix = x1 + vt * (x2 - x1);
    return px < ix;
  }
  return false;
}

export function isPointInsideEvenoddQ(p, lines) {
  let count = 0;
  for (const line of lines) {
    if (intersectRayQ(p, line)) count++;
  }
  return count % 2 !== 0;
}

function nextWindup(wn, { x: px, y: py }, [{ x: x1, y: y1 }, { x: x2, y: y2 }]) {
  const lineSide = (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1);
  if (y1 <= py) {
    if (y2 > py && lineSide > 0) return wn + 1;
  } else {
    if (y2 <= py && lineSide < 0) return wn - 1;
  }
  return wn;
}

export function isPointInsideNonzeroQ(p, lines) {
  let wn = 0;
  for (const line of lines) {
    wn = nextWindup(wn, p, line);
  }
  return wn !== 0;
}

export function overlapsRectPointsQ(rect, points) {
  const rectPoints = grc.rectToPoints(rect);
  const rectLines = pointsToLines(rectPoints);
  const pointsLines = pointsToLines(points);

  return (
    isPointInsideEvenoddQ(rectPoints[0], pointsLines) ||
    isPointInsideEvenoddQ(points[0], rectLines) ||
    intersectsLinesQ(rectLines, pointsLines)
  );
}

export function overlapsPathQ(shape, rect, includeContentQ) {
  if (!d.notEmpty(shape.content)) return false;

  const simpleQ = shape.content.length > 100;
  const rectPoints = grc.rectToPoints(rect);
  const rectLines = pointsToLines(rectPoints);

  const pathLines = simpleQ
    ? pointsToLines(shape.points)
    : pathSegmentToLines(shape);

  const startPoint = shape.content[0]?.params
    ? gpt.point(shape.content[0].params)
    : shape.points?.[0];

  return (
    intersectsLinesQ(rectLines, pathLines) ||
    (includeContentQ && (
      isPointInsideNonzeroQ(rectPoints[0], pathLines) ||
      isPointInsideNonzeroQ(startPoint, rectLines)
    ))
  );
}

function pathSegmentToLines(shape) {
  if (!shape.content || shape.content.length === 0) {
    return pointsToLines(shape.points || []);
  }
  const lines = [];
  let prev = null;
  for (const cmd of shape.content) {
    if (cmd.type === 'M' || cmd.type === 'L') {
      const pt = gpt.point(cmd.params);
      if (prev != null) lines.push([prev, pt]);
      prev = pt;
    } else if (cmd.type === 'C') {
      if (prev != null) {
        const [cp1x, cp1y, cp2x, cp2y, x, y] = cmd.params;
        lines.push([prev, gpt.point(x, y)]);
      }
      prev = cmd.params.length >= 6
        ? gpt.point(cmd.params[4], cmd.params[5])
        : prev;
    } else if (cmd.type === 'Z') {
      if (prev != null && shape.points?.[0]) {
        lines.push([prev, shape.points[0]]);
      }
      prev = shape.points?.[0] ?? prev;
    }
  }
  return lines;
}

export function isPointInsideEllipseQ(point, { cx, cy, rx, ry, transform: tx }) {
  const center = gpt.point(cx, cy);
  const transform = tx != null ? gmt.transformIn(center, tx) : null;
  let { x: px, y: py } = point;
  if (transform != null) {
    const tp = gpt.transform(point, transform);
    px = tp.x;
    py = tp.y;
  }
  const v = (mth.sq(px - cx) / mth.sq(rx)) + (mth.sq(py - cy) / mth.sq(ry));
  return v <= 1;
}

export function intersectsLineEllipseQ([{ x: x1, y: y1 }, { x: x2, y: y2 }], { cx, cy, rx, ry }) {
  const a = mth.sq(x2 - x1) / mth.sq(rx) + mth.sq(y2 - y1) / mth.sq(ry);
  const b = (2 * x1 * (x2 - x1) - 2 * cx * (x2 - x1)) / mth.sq(rx) +
            (2 * y1 * (y2 - y1) - 2 * cy * (y2 - y1)) / mth.sq(ry);
  const c = (mth.sq(x1) + mth.sq(cx) - 2 * x1 * cx) / mth.sq(rx) +
            (mth.sq(y1) + mth.sq(cy) - 2 * y1 * cy) / mth.sq(ry) - 1;
  const determ = mth.sq(b) - 4 * a * c;

  if (mth.almostZero(a)) {
    if (mth.almostZero(b)) return false;
    const t = -c / b;
    return t >= 0 && t <= 1;
  }

  if (determ < 0) return false;
  const t1 = (-b + mth.sqrt(determ)) / (2 * a);
  const t2 = (-b - mth.sqrt(determ)) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

export function intersectsLinesEllipseQ(rectLines, ellipseData) {
  const { cx, cy, transform: tx, rx, ry } = ellipseData;
  const center = gpt.point(cx, cy);
  const transform = tx != null ? gmt.transformIn(center, tx) : null;
  for (const [p1, p2] of rectLines) {
    const tp1 = transform != null ? gpt.transform(p1, transform) : p1;
    const tp2 = transform != null ? gpt.transform(p2, transform) : p2;
    if (intersectsLineEllipseQ([tp1, tp2], { cx, cy, rx, ry })) {
      return true;
    }
  }
  return false;
}

export function overlapsEllipseQ(shape, rect) {
  const rectPoints = grc.rectToPoints(rect);
  const rectLines = pointsToLines(rectPoints);
  const { x, y, width, height } = shape;
  const center = gpt.point(x + width / 2, y + height / 2);
  const ellipseData = {
    cx: center.x,
    cy: center.y,
    rx: width / 2,
    ry: height / 2,
    transform: shape['transform-inverse'],
  };
  return (
    isPointInsideEvenoddQ(center, rectLines) ||
    isPointInsideEllipseQ(rectPoints[0], ellipseData) ||
    intersectsLinesEllipseQ(rectLines, ellipseData)
  );
}

export function overlapsTextQ(shape, rect) {
  if (shape['position-data'] && d.notEmpty(shape['position-data'])) {
    const center = gco.shapeToCenter(shape);
    const transformRect = shape.transform != null
      ? (rectPoints) => gco.transformPoints(rectPoints, center, shape.transform)
      : (rectPoints) => rectPoints;

    for (const pd of shape['position-data']) {
      const pdRect = { x: pd.x, y: pd.y - pd.height, width: pd.width, height: pd.height };
      const pdPoints = grc.rectToPoints(pdRect);
      if (!pdPoints) continue;
      const transformed = transformRect(pdPoints);
      if (overlapsRectPointsQ(rect, transformed)) return true;
    }
    return false;
  }
  return overlapsRectPointsQ(rect, shape.points);
}

export function overlapsQ(shape, rect) {
  if (!shape) return true;

  const swidth = (shape['stroke-width'] ?? 0) / 2;
  const adjusted = {
    ...rect,
    x: rect.x - swidth,
    y: rect.y - swidth,
    width: rect.width + 2 * swidth,
    height: rect.height + 2 * swidth,
  };

  const type = shape.type;
  if (type === 'path' || type === 'bool') {
    return overlapsRectPointsQ(adjusted, shape.points) && overlapsPathQ(shape, adjusted, true);
  }
  if (type === 'circle') {
    return overlapsRectPointsQ(adjusted, shape.points) && overlapsEllipseQ(shape, adjusted);
  }
  if (type === 'text') {
    return overlapsTextQSimple(shape, adjusted);
  }
  return overlapsRectPointsQ(adjusted, shape.points);
}

function overlapsTextQSimple(shape, rect) {
  if (shape['position-data'] && d.notEmpty(shape['position-data'])) {
    const center = gco.shapeToCenter(shape);
    for (const pd of shape['position-data']) {
      const pdRect = { x: pd.x, y: pd.y - pd.height, width: pd.width, height: pd.height };
      if (grc.overlapsRects(rect, pdRect)) return true;
    }
    return false;
  }
  return overlapsRectPointsQ(rect, shape.points);
}

export function hasPointRectQ(rect, point) {
  const lines = grc.rectToLines(rect);
  return isPointInsideEvenoddQ(point, lines);
}

export function slowHasPointQ(shape, point) {
  const lines = pointsToLines(shape.points);
  return isPointInsideEvenoddQ(point, lines);
}

export function fastHasPointQ(shape, point) {
  const x1 = shape.x;
  const y1 = shape.y;
  const x2 = x1 + shape.width;
  const y2 = y1 + shape.height;
  return point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2;
}

export function hasPointQ(shape, point) {
  const type = shape.type;
  if (type === 'path' || type === 'bool' || type === 'circle') {
    return slowHasPointQ(shape, point);
  }
  return fastHasPointQ(shape, point);
}

export function rectContainsShapeQ(rect, shape) {
  return shape.points?.every((p) => hasPointRectQ(rect, p)) ?? false;
}

export function lineLineIntersect(a, b, c, d) {
  const a1 = b.y - a.y;
  const b1 = a.x - b.x;
  const c1 = a1 * a.x + b1 * a.y;

  const a2 = d.y - c.y;
  const b2 = c.x - d.x;
  const c2 = a2 * c.x + b2 * c.y;

  let det = a1 * b2 - a2 * b1;
  if (mth.almostZero(det)) det = 0.001;

  const x = (b2 * c1 - b1 * c2) / det;
  const y = (c2 * a1 - c1 * a2) / det;

  return gpt.point(x, y);
}