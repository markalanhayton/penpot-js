const { createShape } = require('../../lib/types.js');

function ensureArray(shapes) {
  if (Array.isArray(shapes)) return shapes;
  if (typeof shapes === 'object' && shapes !== null) return Object.values(shapes);
  return [];
}

function parsePathCommands(d) {
  if (!d) return [];
  const commands = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])\s*([\d.e+\-,\s]*)/gi;
  let match;
  while ((match = re.exec(d)) !== null) {
    const cmd = match[1];
    const args = match[2].trim().split(/[\s,]+/).filter(s => s !== '').map(Number);
    commands.push({ cmd, args });
  }
  return commands;
}

function pathToAbsoluteSegments(d) {
  const cmds = parsePathCommands(d);
  const segments = [];
  let cx = 0, cy = 0;
  let startX = 0, startY = 0;

  for (const { cmd, args } of cmds) {
    switch (cmd) {
      case 'M':
        for (let i = 0; i < args.length; i += 2) {
          cx = args[i]; cy = args[i + 1];
          startX = cx; startY = cy;
        }
        break;
      case 'm':
        for (let i = 0; i < args.length; i += 2) {
          cx += args[i]; cy += args[i + 1];
          startX = cx; startY = cy;
        }
        break;
      case 'L':
        for (let i = 0; i < args.length; i += 2) {
          segments.push({ type: 'line', x1: cx, y1: cy, x2: args[i], y2: args[i + 1] });
          cx = args[i]; cy = args[i + 1];
        }
        break;
      case 'l':
        for (let i = 0; i < args.length; i += 2) {
          segments.push({ type: 'line', x1: cx, y1: cy, x2: cx + args[i], y2: cy + args[i + 1] });
          cx += args[i]; cy += args[i + 1];
        }
        break;
      case 'H':
        segments.push({ type: 'line', x1: cx, y1: cy, x2: args[0], y2: cy });
        cx = args[0];
        break;
      case 'h':
        segments.push({ type: 'line', x1: cx, y1: cy, x2: cx + args[0], y2: cy });
        cx += args[0];
        break;
      case 'V':
        segments.push({ type: 'line', x1: cx, y1: cy, x2: cx, y2: args[0] });
        cy = args[0];
        break;
      case 'v':
        segments.push({ type: 'line', x1: cx, y1: cy, x2: cx, y2: cy + args[0] });
        cy += args[0];
        break;
      case 'C':
        for (let i = 0; i < args.length; i += 6) {
          segments.push({ type: 'cubic', x1: cx, y1: cy, cx1: args[i], cy1: args[i+1], cx2: args[i+2], cy2: args[i+3], x2: args[i+4], y2: args[i+5] });
          cx = args[i+4]; cy = args[i+5];
        }
        break;
      case 'c':
        for (let i = 0; i < args.length; i += 6) {
          segments.push({ type: 'cubic', x1: cx, y1: cy, cx1: cx+args[i], cy1: cy+args[i+1], cx2: cx+args[i+2], cy2: cy+args[i+3], x2: cx+args[i+4], y2: cy+args[i+5] });
          cx += args[i+4]; cy += args[i+5];
        }
        break;
      case 'Q':
        for (let i = 0; i < args.length; i += 4) {
          segments.push({ type: 'quad', x1: cx, y1: cy, cpx: args[i], cpy: args[i+1], x2: args[i+2], y2: args[i+3] });
          cx = args[i+2]; cy = args[i+3];
        }
        break;
      case 'q':
        for (let i = 0; i < args.length; i += 4) {
          segments.push({ type: 'quad', x1: cx, y1: cy, cpx: cx+args[i], cpy: cy+args[i+1], x2: cx+args[i+2], y2: cy+args[i+3] });
          cx += args[i+2]; cy += args[i+3];
        }
        break;
      case 'Z':
      case 'z':
        segments.push({ type: 'line', x1: cx, y1: cy, x2: startX, y2: startY });
        cx = startX; cy = startY;
        break;
    }
  }
  return segments;
}

function segmentsToPath(segments) {
  if (segments.length === 0) return 'M 0 0';
  let d = '';
  for (const seg of segments) {
    if (!d) d = `M ${seg.x1} ${seg.y1}`;
    switch (seg.type) {
      case 'line':
        d += ` L ${seg.x2} ${seg.y2}`;
        break;
      case 'cubic':
        d += ` C ${seg.cx1} ${seg.cy1} ${seg.cx2} ${seg.cy2} ${seg.x2} ${seg.y2}`;
        break;
      case 'quad':
        d += ` Q ${seg.cpx} ${seg.cpy} ${seg.x2} ${seg.y2}`;
        break;
    }
  }
  return d;
}

function flattenSegmentToLines(seg, tolerance = 1) {
  switch (seg.type) {
    case 'line':
      return [{ x: seg.x2, y: seg.y2 }];
    case 'cubic': {
      const points = [];
      const steps = Math.max(4, Math.ceil(Math.max(
        Math.abs(seg.cx1 - seg.x1) + Math.abs(seg.cx2 - seg.x1),
        Math.abs(seg.cy1 - seg.y1) + Math.abs(seg.cy2 - seg.y1)
      ) / tolerance));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const x = mt3 * seg.x1 + 3 * mt2 * t * seg.cx1 + 3 * mt * t2 * seg.cx2 + t3 * seg.x2;
        const y = mt3 * seg.y1 + 3 * mt2 * t * seg.cy1 + 3 * mt * t2 * seg.cy2 + t3 * seg.y2;
        points.push({ x, y });
      }
      return points;
    }
    case 'quad': {
      const points = [];
      const steps = Math.max(4, Math.ceil(Math.sqrt(Math.pow(seg.cpx - (seg.x1 + seg.x2) / 2, 2) + Math.pow(seg.cpy - (seg.y1 + seg.y2) / 2, 2)) / tolerance));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const x = mt * mt * seg.x1 + 2 * mt * t * seg.cpx + t * t * seg.x2;
        const y = mt * mt * seg.y1 + 2 * mt * t * seg.cpy + t * t * seg.y2;
        points.push({ x, y });
      }
      return points;
    }
    default:
      return [{ x: seg.x2, y: seg.y2 }];
  }
}

function pathToPoints(d, tolerance = 1) {
  const segments = pathToAbsoluteSegments(d);
  if (segments.length === 0) return [];
  const points = [{ x: segments[0].x1, y: segments[0].y1 }];
  for (const seg of segments) {
    const segPoints = flattenSegmentToLines(seg, tolerance);
    points.push(...segPoints);
  }
  return points;
}

function polygonArea(points) {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

function isClockwise(points) {
  return polygonArea(points) > 0;
}

function ensureClockwise(points) {
  if (!isClockwise(points)) return points.reverse();
  return points;
}

function ensureCounterClockwise(points) {
  if (isClockwise(points)) return points.reverse();
  return points;
}

function sutherlandHodgman(subject, clip) {
  if (subject.length === 0 || clip.length === 0) return [];
  let output = [...subject];
  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) return [];
    const input = [...output];
    output = [];
    const edgeStart = clip[i];
    const edgeEnd = clip[(i + 1) % clip.length];
    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const previous = input[(j + input.length - 1) % input.length];
      const currentInside = isInside(current, edgeStart, edgeEnd);
      const previousInside = isInside(previous, edgeStart, edgeEnd);
      if (currentInside) {
        if (!previousInside) {
          const inter = lineIntersection(previous, current, edgeStart, edgeEnd);
          if (inter) output.push(inter);
        }
        output.push(current);
      } else if (previousInside) {
        const inter = lineIntersection(previous, current, edgeStart, edgeEnd);
        if (inter) output.push(inter);
      }
    }
  }
  return output;
}

function isInside(point, edgeStart, edgeEnd) {
  return (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) - (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x) >= 0;
}

function lineIntersection(p1, p2, p3, p4) {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

function unionPoints(shapesArray) {
  if (shapesArray.length < 2) return shapesArray[0] ? pathToPoints(shapesArray[0].d || `M ${shapesArray[0].x} ${shapesArray[0].y} L ${shapesArray[0].x + shapesArray[0].width} ${shapesArray[0].y} L ${shapesArray[0].x + shapesArray[0].width} ${shapesArray[0].y + shapesArray[0].height} L ${shapesArray[0].x} ${shapesArray[0].y + shapesArray[0].height} Z`) : [];
  let result = shapeToPoints(shapesArray[0]);
  for (let i = 1; i < shapesArray.length; i++) {
    const next = shapeToPoints(shapesArray[i]);
    result = unionTwoPolygons(result, next);
  }
  return result;
}

function shapeToPoints(shape) {
  if (shape.d) return pathToPoints(shape.d, 0.5);
  const x = shape.x || 0;
  const y = shape.y || 0;
  const w = shape.width || 0;
  const h = shape.height || 0;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ];
}

function unionTwoPolygons(a, b) {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const merged = [...a, ...b];
  return convexHull(merged);
}

function differencePoints(shapesArray) {
  if (shapesArray.length < 2) return [];
  const a = shapeToPoints(shapesArray[0]);
  const b = shapeToPoints(shapesArray[1]);
  return sutherlandHodgman(ensureCounterClockwise(a), ensureClockwise(b));
}

function intersectionPoints(shapesArray) {
  if (shapesArray.length < 2) return [];
  const a = shapeToPoints(shapesArray[0]);
  const b = shapeToPoints(shapesArray[1]);
  return sutherlandHodgman(a, b);
}

function exclusionPoints(shapesArray) {
  if (shapesArray.length < 2) return [];
  const a = shapeToPoints(shapesArray[0]);
  const b = shapeToPoints(shapesArray[1]);
  const aMinusB = sutherlandHodgman(ensureCounterClockwise(a), ensureClockwise(b));
  const bMinusA = sutherlandHodgman(ensureCounterClockwise(b), ensureClockwise(a));
  return [...aMinusB, ...bMinusA];
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

export function computeBoolOperation(boolType, shapes) {
  const shapeArray = ensureArray(shapes);
  if (shapeArray.length < 2) return null;

  let points;
  switch (boolType) {
    case 'union':
      points = unionPoints(shapeArray);
      break;
    case 'difference':
      points = differencePoints(shapeArray);
      break;
    case 'intersection':
      points = intersectionPoints(shapeArray);
      break;
    case 'exclude':
      points = exclusionPoints(shapeArray);
      break;
    default:
      points = unionPoints(shapeArray);
  }

  if (points.length < 3) return null;

  const d = `M ${points[0].x} ${points[0].y} ` +
    points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + ' Z';

  const minX = Math.min(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxX = Math.max(...points.map(p => p.x));
  const maxY = Math.max(...points.map(p => p.y));

  const headShape = shapeArray[0];
  return createShape('bool', {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX) || 1,
    height: Math.round(maxY - minY) || 1,
    boolType,
    fills: headShape.fills ? [...headShape.fills] : [],
    strokes: headShape.strokes ? [...headShape.strokes] : [],
    shapes: shapeArray.map(s => s.id),
    d,
  });
}

export { pathToPoints, segmentsToPath, pathToAbsoluteSegments, convexHull };