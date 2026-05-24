import * as d from '../../data.js';
import * as gpt from '../point.js';
import * as mth from '../../math.js';
import * as gsi from './intersect.js';

export function origin(points) {
  return points[0];
}

export function hv([p0, p1]) {
  return gpt.toVec(p0, p1);
}

export function vv([p0, , , p3]) {
  return gpt.toVec(p0, p3);
}

export function startHv([p0, p1], val) {
  return gpt.scale(gpt.unit(gpt.toVec(p0, p1)), val);
}

export function endHv([p0, p1], val) {
  return gpt.scale(gpt.unit(gpt.toVec(p1, p0)), val);
}

export function startVv([p0, , , p3], val) {
  return gpt.scale(gpt.unit(gpt.toVec(p0, p3)), val);
}

export function endVv([p0, , , p3], val) {
  return gpt.scale(gpt.unit(gpt.toVec(p3, p0)), val);
}

export function widthPoints([p0, p1]) {
  if (p0 != null && p1 != null) {
    return Math.max(0.01, gpt.length(gpt.toVec(p0, p1)));
  }
  return undefined;
}

export function heightPoints([p0, , , p3]) {
  if (p0 != null && p3 != null) {
    return Math.max(0.01, gpt.length(gpt.toVec(p0, p3)));
  }
  return undefined;
}

export function padPoints(pts, padTop, padRight, padBottom, padLeft) {
  if (pts == null) return undefined;
  const [p0, p1, p2, p3] = pts;
  const topV = startHv(pts, padTop);
  const rightV = endHv(pts, padRight);
  const bottomV = endVv(pts, padBottom);
  const leftV = startHv(pts, padLeft);

  return [
    gpt.add(gpt.add(p0, leftV), topV),
    gpt.add(gpt.add(p1, rightV), topV),
    gpt.add(gpt.add(p2, rightV), bottomV),
    gpt.add(gpt.add(p3, leftV), bottomV),
  ];
}

export function projectT(point, [start, end], otherAxisVec) {
  const lineVec = gpt.toVec(start, end);
  const prPoint = gsi.lineLineIntersect(
    point, gpt.add(point, otherAxisVec), start, end
  );
  if (!mth.almostZero(lineVec.x)) {
    return (prPoint.x - start.x) / lineVec.x;
  }
  if (!mth.almostZero(lineVec.y)) {
    return (prPoint.y - start.y) / lineVec.y;
  }
  return 0;
}

export function projectPoint([p0, p1, , p3], axis, point) {
  if (axis === 'h') {
    const otherVec = gpt.toVec(p0, p3);
    return gsi.lineLineIntersect(point, gpt.add(point, otherVec), p0, p1);
  }
  const otherVec = gpt.toVec(p0, p1);
  return gsi.lineLineIntersect(point, gpt.add(point, otherVec), p0, p3);
}

export function axisAlignedQ([p1, p2, , p4]) {
  if (arguments[0].length !== 4) return false;
  const hVec = gpt.toVec(p1, p2);
  const vVec = gpt.toVec(p1, p4);
  return mth.almostZero(hVec.y) && mth.almostZero(vVec.x) &&
         hVec.x > 0 && vVec.y > 0;
}

export function parentCoordsBounds(childBounds, parentBounds) {
  if (!childBounds || childBounds.length === 0) return parentBounds;

  const [p1, p2, , p4] = parentBounds;

  if (axisAlignedQ(childBounds) && axisAlignedQ(parentBounds)) {
    return childBounds;
  }

  const rh = [p1, p2];
  const rv = [p1, p4];
  const hv = gpt.toVec(p1, p2);
  const vv = gpt.toVec(p1, p4);

  const ph = (t) => gpt.add(p1, gpt.scale(hv, t));
  const pv = (t) => gpt.add(p1, gpt.scale(vv, t));

  function findBoundaryTs([thMin, thMax, tvMin, tvMax], currentPoint) {
    const cth = projectT(currentPoint, rh, vv);
    const ctv = projectT(currentPoint, rv, hv);
    return [
      Math.min(thMin, cth),
      Math.max(thMax, cth),
      Math.min(tvMin, ctv),
      Math.max(tvMax, ctv),
    ];
  }

  const validPoints = childBounds.filter(
    (p) => typeof p?.x === 'number' && typeof p?.y === 'number'
  );

  const [thMin, thMax, tvMin, tvMax] = validPoints.reduce(
    findBoundaryTs, [Infinity, -Infinity, Infinity, -Infinity]
  );

  const minvStart = pv(tvMin);
  const minvEnd = gpt.add(minvStart, hv);
  const minhStart = ph(thMin);
  const minhEnd = gpt.add(minhStart, vv);
  const maxvStart = pv(tvMax);
  const maxvEnd = gpt.add(maxvStart, hv);
  const maxhStart = ph(thMax);
  const maxhEnd = gpt.add(maxhStart, vv);

  const i1 = gsi.lineLineIntersect(minvStart, minvEnd, minhStart, minhEnd);
  const i2 = gsi.lineLineIntersect(minvStart, minvEnd, maxhStart, maxhEnd);
  const i3 = gsi.lineLineIntersect(maxvStart, maxvEnd, maxhStart, maxhEnd);
  const i4 = gsi.lineLineIntersect(maxvStart, maxvEnd, minhStart, minhEnd);

  return [i1, i2, i3, i4];
}

export function mergeParentCoordsBounds(bounds, parentBounds) {
  return parentCoordsBounds(bounds.flat(), parentBounds);
}

export function movePoints(bounds, vector) {
  return bounds.map((p) => gpt.add(p, vector));
}

export function centerBounds(bounds) {
  const w = widthPoints(bounds);
  const h = heightPoints(bounds);
  const halfH = startHv(bounds, w / 2);
  const halfV = startVv(bounds, h / 2);
  return gpt.add(gpt.add(origin(bounds), halfH), halfV);
}