import * as gpt from './point.js';
import * as mth from '../math.js';

export class Rect {
  constructor(x, y, width, height, x1, y1, x2, y2) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }
}

export function isRect(o) {
  return o instanceof Rect;
}

export function makeRect(x, y, width, height) {
  if (x === undefined) return makeRect(0, 0, 0.01, 0.01);

  if (arguments.length === 1) {
    if (isRect(x)) return x;
    const r = x;
    return makeRect(
      r.x ?? 0,
      r.y ?? 0,
      r.width ?? 0.01,
      r.height ?? 0.01
    );
  }

  if (arguments.length === 2) {
    const p1 = x;
    const p2 = y;
    const xp1 = p1.x, yp1 = p1.y;
    const xp2 = p2.x, yp2 = p2.y;
    const rx1 = Math.min(xp1, xp2);
    const ry1 = Math.min(yp1, yp2);
    const rx2 = Math.max(xp1, xp2);
    const ry2 = Math.max(yp1, yp2);
    return makeRect(rx1, ry1, rx2 - rx1, ry2 - ry1);
  }

  if (typeof x !== 'number' || typeof y !== 'number' ||
      typeof width !== 'number' || typeof height !== 'number') {
    return makeRect();
  }

  const w = Math.max(width, 0.01);
  const h = Math.max(height, 0.01);
  return new Rect(x, y, w, h, x, y, x + w, y + h);
}

export const EMPTY_RECT = makeRect(0, 0, 0.01, 0.01);

export function updateRect(rect, type) {
  if (type === 'size' || type === 'position') {
    const x = rect.x, y = rect.y, w = rect.width, h = rect.height;
    return new Rect(x, y, w, h, x, y, x + w, y + h);
  }
  if (type === 'corners') {
    const x1 = rect.x1, y1 = rect.y1, x2 = rect.x2, y2 = rect.y2;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    return new Rect(x, y, Math.abs(x2 - x1), Math.abs(y2 - y1), x1, y1, x2, y2);
  }
  return rect;
}

export function closeRect(rect1, rect2) {
  return mth.close(rect1.x, rect2.x) &&
         mth.close(rect1.y, rect2.y) &&
         mth.close(rect1.width, rect2.width) &&
         mth.close(rect1.height, rect2.height);
}

export function rectToPoints(rect) {
  const x = rect.x, y = rect.y;
  let w = rect.width, h = rect.height;
  w = Math.max(w, 0.01);
  h = Math.max(h, 0.01);
  return [
    gpt.point(x, y),
    gpt.point(x + w, y),
    gpt.point(x + w, y + h),
    gpt.point(x, y + h)
  ];
}

export function rectToPoint(rect) {
  return gpt.point(rect.x, rect.y);
}

export function rectToCenter(rect) {
  const x = rect.x, y = rect.y, w = rect.width, h = rect.height;
  if (typeof x !== 'number' || typeof y !== 'number' ||
      typeof w !== 'number' || typeof h !== 'number') return undefined;
  return gpt.point(x + w / 2.0, y + h / 2.0);
}

export function rectToLines(rect) {
  const x = rect.x, y = rect.y;
  let w = rect.width, h = rect.height;
  w = Math.max(w, 0.01);
  h = Math.max(h, 0.01);
  return [
    [gpt.point(x, y), gpt.point(x + w, y)],
    [gpt.point(x + w, y), gpt.point(x + w, y + h)],
    [gpt.point(x + w, y + h), gpt.point(x, y + h)],
    [gpt.point(x, y + h), gpt.point(x, y)]
  ];
}

export function pointsToRect(points) {
  if (!points || points.length === 0) return undefined;
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const pt of points) {
    minx = Math.min(minx, pt.x);
    miny = Math.min(miny, pt.y);
    maxx = Math.max(maxx, pt.x);
    maxy = Math.max(maxy, pt.y);
  }
  if (typeof minx !== 'number' || typeof miny !== 'number') return undefined;
  return makeRect(minx, miny, maxx - minx, maxy - miny);
}

export function boundsToRect([pa, pb, pc, pd]) {
  const minx = Math.min(pa.x, pb.x, pc.x, pd.x);
  const miny = Math.min(pa.y, pb.y, pc.y, pd.y);
  const maxx = Math.max(pa.x, pb.x, pc.x, pd.x);
  const maxy = Math.max(pa.y, pb.y, pc.y, pd.y);
  if (typeof minx !== 'number' || typeof miny !== 'number') return undefined;
  return makeRect(minx, miny, maxx - minx, maxy - miny);
}

export function squaredPoints(points) {
  if (!points || points.length === 0) return undefined;
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const pt of points) {
    minx = Math.min(minx, pt.x);
    miny = Math.min(miny, pt.y);
    maxx = Math.max(maxx, pt.x2 ?? pt.x);
    maxy = Math.max(maxy, pt.y2 ?? pt.y);
  }
  if (typeof minx !== 'number' || typeof miny !== 'number') return undefined;
  return [
    gpt.point(minx, miny),
    gpt.point(maxx, miny),
    gpt.point(maxx, maxy),
    gpt.point(minx, maxy)
  ];
}

export function joinRects(rects) {
  if (!rects || rects.length === 0) return undefined;
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const r of rects) {
    minx = Math.min(minx, r.x);
    miny = Math.min(miny, r.y);
    maxx = Math.max(maxx, r.x2);
    maxy = Math.max(maxy, r.y2);
  }
  if (typeof minx !== 'number' || typeof miny !== 'number') return undefined;
  return makeRect(minx, miny, maxx - minx, maxy - miny);
}

export function centerToRect(point, w, h) {
  if (h === undefined) h = w;
  if (point == null) return undefined;
  const x = point.x, y = point.y;
  if (typeof x !== 'number' || typeof y !== 'number') return undefined;
  return makeRect(x - w / 2, y - h / 2, w, h);
}

function sEq(a, b) {
  return mth.almostZero(a - b);
}

export function overlapsRects(rectA, rectB) {
  const x1a = rectA.x, y1a = rectA.y;
  const x2a = x1a + rectA.width, y2a = y1a + rectA.height;
  const x1b = rectB.x, y1b = rectB.y;
  const x2b = x1b + rectB.width, y2b = y1b + rectB.height;
  return (x2a > x1b || sEq(x2a, x1b)) &&
         (x2b >= x1a || sEq(x2b, x1a)) &&
         (y1b <= y2a || sEq(y1b, y2a)) &&
         (y1a <= y2b || sEq(y1a, y2b));
}

export function containsPoint(rect, pt) {
  const x1 = rect.x, y1 = rect.y;
  const x2 = rect.x + rect.width, y2 = rect.y + rect.height;
  const px = pt.x, py = pt.y;
  return (px > x1 || sEq(px, x1)) &&
         (px < x2 || sEq(px, x2)) &&
         (py > y1 || sEq(py, y1)) &&
         (py < y2 || sEq(py, y2));
}

export function containsRect(sra, srb) {
  return srb.x1 >= sra.x1 &&
         srb.x2 <= sra.x2 &&
         srb.y1 >= sra.y1 &&
         srb.y2 <= sra.y2;
}

export function cornersToRect(p1, p2, p3, p4) {
  if (typeof p1 === 'number' && typeof p2 === 'number' && typeof p3 === 'number' && typeof p4 === 'number') {
    const xp1 = p1, yp1 = p2, xp2 = p3, yp2 = p4;
    return makeRect(
      Math.min(xp1, xp2), Math.min(yp1, yp2),
      mth.abs(xp1 - xp2), mth.abs(yp1 - yp2)
    );
  }
  return makeRect(
    Math.min(p1.x, p2.x), Math.min(p1.y, p2.y),
    mth.abs(p1.x - p2.x), mth.abs(p1.y - p2.y)
  );
}

export function clipRect(selrect, bounds) {
  return cornersToRect(
    Math.max(bounds.x1, selrect.x1),
    Math.max(bounds.y1, selrect.y1),
    Math.min(bounds.x2, selrect.x2),
    Math.min(bounds.y2, selrect.y2)
  );
}

export function fixAspectRatio(bounds, aspectRatio) {
  if (aspectRatio == null) return bounds;
  const width = bounds.width, height = bounds.height;
  const targetHeight = width * aspectRatio;
  const targetWidth = height / aspectRatio;
  let result = { ...bounds };
  if (targetHeight > height) {
    result.height = targetHeight;
    result.y = result.y - (targetHeight - height) / 2;
  } else if (targetHeight < height) {
    result.width = targetWidth;
    result.x = result.x - (targetWidth - width) / 2;
  }
  return makeRect(result);
}

export function rectToJSON(o) {
  if (!isRect(o)) return o;
  return { x: o.x, y: o.y, width: o.width, height: o.height, x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2 };
}

export function decodeRect(o) {
  if (o instanceof Rect) return o;
  if (typeof o === 'object' && o !== null) {
    return makeRect(o.x ?? 0, o.y ?? 0, o.width ?? 0.01, o.height ?? 0.01);
  }
  return o;
}