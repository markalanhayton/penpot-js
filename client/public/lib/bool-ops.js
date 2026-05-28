'use strict';

import { BOOL_TYPES } from './types.js';

const EPS = 1e-10;

function signedArea(ring) {
  let s = 0;
  for (let i = 0, len = ring.length; i < len; i++) {
    const j = (i + 1) % len;
    s += ring[i].x * ring[j].y - ring[j].x * ring[i].y;
  }
  return s / 2;
}

function isCcw(ring) {
  return signedArea(ring) > 0;
}

function ensureCcw(ring) {
  return isCcw(ring) ? [...ring] : [...ring].reverse();
}

function ensureCw(ring) {
  return isCcw(ring) ? [...ring].reverse() : [...ring];
}

function pointInPolygon(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x, yi = ring[i].y, xj = ring[j].x, yj = ring[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function ringsContain(outer, inner) {
  return inner.every(p => pointInPolygon(p.x, p.y, outer));
}

function polygonArea(pts) {
  if (!pts || pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function removeDuplicatePoints(points) {
  if (points.length <= 1) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    if (Math.abs(points[i].x - prev.x) > EPS || Math.abs(points[i].y - prev.y) > EPS) {
      result.push(points[i]);
    }
  }
  while (result.length > 1 &&
    Math.abs(result[0].x - result[result.length - 1].x) < EPS &&
    Math.abs(result[0].y - result[result.length - 1].y) < EPS) {
    result.pop();
  }
  return result;
}

function shIsInside(point, cp1, cp2) {
  return (cp2.x - cp1.x) * (point.y - cp1.y) - (cp2.y - cp1.y) * (point.x - cp1.x) >= 0;
}

function shIntersect(p1, p2, p3, p4) {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < EPS) return null;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  if (t < -EPS || t > 1 + EPS) return null;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

function shClip(subject, clip) {
  const clipCcw = ensureCcw(clip);
  let output = [...subject];
  for (let i = 0; i < clipCcw.length; i++) {
    if (output.length < 3) return [];
    const cp1 = clipCcw[i];
    const cp2 = clipCcw[(i + 1) % clipCcw.length];
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const curr = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const currInside = shIsInside(curr, cp1, cp2);
      const prevInside = shIsInside(prev, cp1, cp2);
      if (currInside) {
        if (!prevInside) {
          const inter = shIntersect(prev, curr, cp1, cp2);
          if (inter) output.push(inter);
        }
        output.push(curr);
      } else if (prevInside) {
        const inter = shIntersect(prev, curr, cp1, cp2);
        if (inter) output.push(inter);
      }
    }
  }
  return output;
}

function convexHull(points) {
  if (points.length < 3) return [...points];
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function decomposeToConvex(ring) {
  if (ring.length <= 3) return [ring];
  if (isConvex(ring)) return [ring];

  const ccw = ensureCcw(ring);
  const convexParts = [];
  const remaining = [...ccw];

  while (remaining.length > 3) {
    let found = false;
    for (let i = 0; i < remaining.length; i++) {
      const prev = remaining[(i - 1 + remaining.length) % remaining.length];
      const curr = remaining[i];
      const next = remaining[(i + 1) % remaining.length];

      const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
      if (cross > 0) {
        const triangle = [prev, curr, next];
        let triangleContainsOtherVertices = false;
        for (let j = 0; j < remaining.length; j++) {
          const p = remaining[j];
          if (p === prev || p === curr || p === next) continue;
          if (pointInPolygon(p.x, p.y, triangle)) {
            triangleContainsOtherVertices = true;
            break;
          }
        }
        if (!triangleContainsOtherVertices) {
          convexParts.push(triangle);
          remaining.splice(i, 1);
          found = true;
          break;
        }
      }
    }
    if (!found) break;
  }

  if (remaining.length >= 3) {
    convexParts.push(remaining);
  }

  return convexParts;
}

function isConvex(ring) {
  const ccw = ensureCcw(ring);
  let sign = 0;
  for (let i = 0; i < ccw.length; i++) {
    const a = ccw[i];
    const b = ccw[(i + 1) % ccw.length];
    const c = ccw[(i + 2) % ccw.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > EPS) {
      if (sign === 0) sign = cross > 0 ? 1 : -1;
      else if ((cross > 0 ? 1 : -1) !== sign) return false;
    }
  }
  return true;
}

function concaveIntersection(subject, clip) {
  if (isConvex(clip)) return shClip(subject, clip);
  if (isConvex(subject)) return shClip(clip, subject);

  const subjectParts = decomposeToConvex(subject);
  const clipParts = decomposeToConvex(clip);
  const resultParts = [];

  for (const sp of subjectParts) {
    for (const cp of clipParts) {
      const clipped = shClip(sp, cp);
      if (clipped.length >= 3) {
        resultParts.push(clipped);
      }
    }
  }

  if (resultParts.length === 0) return [];
  if (resultParts.length === 1) return removeDuplicatePoints(resultParts[0]);

  let merged = removeDuplicatePoints(resultParts[0]);
  for (let i = 1; i < resultParts.length; i++) {
    const hull = convexHull([...merged, ...removeDuplicatePoints(resultParts[i])]);
    merged = hull.length >= 3 ? hull : merged;
  }
  return merged;
}

export function shapeToPathContent(shape) {
  const { x, y, width, height } = shape;
  if (shape.type === 'circle' || shape.type === 'ellipse') {
    const mx = x + width / 2;
    const my = y + height / 2;
    const ex = x + width;
    const ey = y + height;
    const c = 0.551915024494;
    const c1x = x + (width / 2) * (1 - c);
    const c2x = x + (width / 2) * (1 + c);
    const c1y = y + (height / 2) * (1 - c);
    const c2y = y + (height / 2) * (1 + c);
    return [
      { command: 'move-to', params: { x: mx, y } },
      { command: 'curve-to', params: { x: ex, y: my, c1x: c2x, c1y: y, c2x: ex, c2y: c1y } },
      { command: 'curve-to', params: { x: mx, y: ey, c1x: ex, c1y: c2y, c2x: c2x, c2y: ey } },
      { command: 'curve-to', params: { x, y: my, c1x: c1x, c1y: ey, c2x: x, c2y: c2y } },
      { command: 'curve-to', params: { x: mx, y, c1x: x, c1y: c1y, c2x: c1x, c2y: y } },
    ];
  }
  if (shape.type === 'path' && shape.content) {
    return Array.isArray(shape.content) ? shape.content : Array.from(shape.content);
  }
  if (width <= 0 || height <= 0) return [];
  return [
    { command: 'move-to', params: { x, y } },
    { command: 'line-to', params: { x: x + width, y } },
    { command: 'line-to', params: { x: x + width, y: y + height } },
    { command: 'line-to', params: { x, y: y + height } },
  ];
}

export function pathContentToPoints(content) {
  if (!content || content.length === 0) return [];
  const points = [];
  let currentPos = null;
  for (const cmd of content) {
    if (cmd.command === 'move-to') {
      currentPos = { x: cmd.params.x, y: cmd.params.y };
      points.push(currentPos);
    } else if (cmd.command === 'line-to') {
      currentPos = { x: cmd.params.x, y: cmd.params.y };
      points.push(currentPos);
    } else if (cmd.command === 'curve-to') {
      currentPos = { x: cmd.params.x, y: cmd.params.y };
      points.push(currentPos);
    } else if (cmd.command === 'close-path') {
      if (points.length > 0 && currentPos) {
        if (Math.abs(currentPos.x - points[0].x) > 0.01 ||
            Math.abs(currentPos.y - points[0].y) > 0.01) {
          points.push({ x: points[0].x, y: points[0].y });
        }
      }
    }
  }
  return removeDuplicatePoints(points);
}

function shapeToRing(shape) {
  if (shape.type === 'path' && shape.content) {
    return pathContentToPoints(shape.content);
  }
  const { x, y, width, height } = shape;
  if (shape.type === 'circle' || shape.type === 'ellipse') {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const rx = width / 2;
    const ry = height / 2;
    const n = 24;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n;
      pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
    }
    return pts;
  }
  if (width <= 0 || height <= 0) return null;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

export function computeBoolOperation(boolType, shapeA, shapeB) {
  if (!BOOL_TYPES.includes(boolType)) {
    throw new Error(`Invalid boolean operation type: ${boolType}`);
  }

  const ringA = shapeToRing(shapeA);
  const ringB = shapeToRing(shapeB);
  if (!ringA || ringA.length < 3 || !ringB || ringB.length < 3) {
    return [];
  }

  const aCcw = ensureCcw(ringA);
  const bCcw = ensureCcw(ringB);

  switch (boolType) {
    case 'intersection': return intersectionResult(aCcw, bCcw);
    case 'union': return unionResult(aCcw, bCcw);
    case 'difference': return differenceResult(aCcw, bCcw);
    case 'exclude': return exclusionResult(aCcw, bCcw);
    default: return [];
  }
}

function intersectionResult(a, b) {
  const aInB = ringsContain(b, a);
  if (aInB) return pathFromRings([a]);
  const bInA = ringsContain(a, b);
  if (bInA) return pathFromRings([b]);

  const result = concaveIntersection(a, b);
  if (result.length < 3) return [];
  return pathFromRings([result]);
}

function unionResult(a, b) {
  const aInB = ringsContain(b, a);
  const bInA = ringsContain(a, b);
  if (aInB) return pathFromRings([b]);
  if (bInA) return pathFromRings([a]);

  const intersection = concaveIntersection(a, b);
  if (intersection.length < 3) return pathFromRings([a, b]);

  const hull = convexHull(removeDuplicatePoints([...a, ...b]));
  if (hull.length >= 3) return pathFromRings([hull]);
  return pathFromRings([a, b]);
}

function differenceResult(a, b) {
  const aInB = ringsContain(b, a);
  if (aInB) return [];
  const bInA = ringsContain(a, b);
  if (bInA) return pathFromRings([a, ensureCw(b)]);

  const intersection = concaveIntersection(a, b);
  if (intersection.length < 3) return pathFromRings([a]);

  return pathFromRings([a, ensureCw(b)]);
}

function exclusionResult(a, b) {
  const diffAB = differenceResult(a, b);
  const diffBA = differenceResult(b, a);
  const aRings = extractRings(diffAB);
  const bRings = extractRings(diffBA);
  return pathFromRings([...aRings, ...bRings]);
}

function extractRings(content) {
  if (!content || content.length === 0) return [];
  const rings = [];
  let currentRing = [];
  for (const cmd of content) {
    if (cmd.command === 'move-to' && currentRing.length > 0) {
      rings.push(currentRing);
      currentRing = [];
    }
    if (cmd.command === 'move-to' || cmd.command === 'line-to') {
      currentRing.push({ x: cmd.params.x, y: cmd.params.y });
    }
  }
  if (currentRing.length > 0) rings.push(currentRing);
  return rings;
}

function pathFromRings(rings) {
  if (rings.length === 0) return [];
  const result = [];
  for (const ring of rings) {
    const clean = removeDuplicatePoints(ring);
    if (clean.length < 3) continue;
    result.push({ command: 'move-to', params: { x: clean[0].x, y: clean[0].y } });
    for (let i = 1; i < clean.length; i++) {
      result.push({ command: 'line-to', params: { x: clean[i].x, y: clean[i].y } });
    }
    result.push({ command: 'line-to', params: { x: clean[0].x, y: clean[0].y } });
  }
  return result;
}
