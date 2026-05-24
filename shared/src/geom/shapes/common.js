import * as d from '../../data.js';
import * as gmt from '../matrix.js';
import * as gpt from '../point.js';
import * as grc from '../rect.js';
import * as mth from '../../math.js';

export function shapesToRect(shapes) {
  const rects = [];
  for (const shape of shapes) {
    const r = grc.pointsToRect(shape.points);
    if (r != null) rects.push(r);
  }
  return grc.joinRects(rects);
}

export function pointsToCenter(points) {
  const ptx = points.map((p) => p.x);
  const pty = points.map((p) => p.y);
  const minx = Math.min(...ptx);
  const miny = Math.min(...pty);
  const maxx = Math.max(...ptx);
  const maxy = Math.max(...pty);
  return gpt.point((minx + maxx) / 2.0, (miny + maxy) / 2.0);
}

export function shapeToCenter(shape) {
  return grc.rectToCenter(shape.selrect);
}

export function transformPoints(points, centerOrMatrix, matrix) {
  if (arguments.length === 2) {
    const mtx = centerOrMatrix;
    if (!gmt.isMatrix(mtx) || !points || points.length === 0) return points;
    return points.map((p) => gpt.transform(p, mtx));
  }

  if (arguments.length === 3) {
    const center = centerOrMatrix;
    if (!gmt.isMatrix(matrix) || !points || points.length === 0) return points;
    if (center == null) {
      return points.map((p) => gpt.transform(p, matrix));
    }
    const prev = gmt.translateMatrix(center);
    const post = gmt.translateMatrixNeg(center);
    const mtx = gmt.multiply(gmt.multiply(prev, matrix), post);
    return points.map((p) => gpt.transform(p, mtx));
  }

  return points;
}

export function transformSelrect(selrect, matrix) {
  const x1 = selrect.x1;
  const y1 = selrect.y1;
  const x2 = selrect.x2;
  const y2 = selrect.y2;
  const p1 = gpt.transform(gpt.point(x1, y1), matrix);
  const p2 = gpt.transform(gpt.point(x2, y2), matrix);
  return grc.cornersToRect(p1, p2);
}

export function invalidGeometryQ(shape) {
  const { points, selrect } = shape;
  if (mth.nan(selrect?.x) || mth.nan(selrect?.y) ||
      mth.nan(selrect?.width) || mth.nan(selrect?.height)) {
    return true;
  }
  if (points) {
    for (const p of points) {
      if (mth.nan(p?.x) || mth.nan(p?.y)) return true;
    }
  }
  return false;
}

export function shapeToPoints(shape) {
  const { transform, points } = shape;
  if (gmt.isUnit(transform) || transform == null) {
    const p0 = points[0];
    const p2 = points[2];
    const p1 = gpt.point(p2.x, p0.y);
    const p3 = gpt.point(p0.x, p2.y);
    return [p0, p1, p2, p3];
  }
  return points;
}