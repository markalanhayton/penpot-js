import * as mth from '../../math.js';
import * as gpt from '../../geom/point.js';
import * as gmt from '../../geom/matrix.js';
import * as grc from '../../geom/rect.js';

export const CURVE_CURVE_PRECISION = 0.1;
export const CURVE_RANGE_PRECISION = 2;
const NUM_SEGMENTS = 10;

export function sEq(a, b) {
  return mth.almostZero(a - b);
}

export function makeMoveTo(to) {
  return { command: 'move-to', params: { x: to.x, y: to.y } };
}

export function makeLineTo(to) {
  return { command: 'line-to', params: { x: to.x, y: to.y } };
}

export function makeCurveParams(point, handler, h2) {
  if (h2 === undefined) {
    if (handler === undefined) {
      handler = point;
    }
    h2 = point;
  }
  return {
    x: point.x,
    y: point.y,
    c1x: handler.x,
    c1y: handler.y,
    c2x: h2.x,
    c2y: h2.y,
  };
}

export function updateCurveTo(command, h1, h2) {
  return {
    command: 'curve-to',
    params: {
      x: command.params.x,
      y: command.params.y,
      c1x: h1.x,
      c1y: h1.y,
      c2x: h2.x,
      c2y: h2.y,
    },
  };
}

export function makeCurveTo(to, h1, h2) {
  return { command: 'curve-to', params: makeCurveParams(to, h1, h2) };
}

export function prefixToCoords(prefix) {
  switch (prefix) {
    case 'c1': return ['c1x', 'c1y'];
    case 'c2': return ['c2x', 'c2y'];
    default: return null;
  }
}

export function segmentToPoint(segment, coord) {
  if (!segment || !segment.params) return undefined;
  const p = segment.params;
  if (Object.keys(p).length === 0) return undefined;
  switch (coord) {
    case 'c1': return gpt.point(p.c1x, p.c1y);
    case 'c2': return gpt.point(p.c2x, p.c2y);
    default: return gpt.point(p.x, p.y);
  }
}

export function commandToLine(segment, prev) {
  if (prev === undefined) prev = segment.prev;
  return [prev, segmentToPoint(segment)];
}

export function commandToBezier(segment, prev) {
  if (prev === undefined) prev = segment.prev;
  return [
    prev,
    segmentToPoint(segment),
    gpt.point(segment.params.c1x, segment.params.c1y),
    gpt.point(segment.params.c2x, segment.params.c2y),
  ];
}

export function commandToSelrect(command, prevPoint) {
  if (prevPoint === undefined) prevPoint = command.prev;
  let points;
  switch (command.command) {
    case 'move-to':
      points = [segmentToPoint(command)];
      break;
    case 'line-to':
      points = [prevPoint, segmentToPoint(command)];
      break;
    case 'curve-to': {
      const curve = [prevPoint, segmentToPoint(command), segmentToPoint(command, 'c1'), segmentToPoint(command, 'c2')];
      points = [prevPoint, segmentToPoint(command), ...curveExtremities(curve).map(t => curveValues(curve, t))];
      break;
    }
    default:
      points = [];
  }
  return grc.pointsToRect(points);
}

export function lineValues([fromP, toP], t) {
  const moveV = gpt.scale(gpt.toVec(fromP, toP), t);
  return gpt.add(fromP, moveV);
}

export function lineWindup(l, t) {
  const [fromP, toP] = l;
  const p = lineValues(l, t);
  const cy = p.y;
  const ay = toP.y;
  const by = fromP.y;
  if (cy - ay > 0 && !sEq(cy, ay)) return 1;
  if (cy - ay < 0 && !sEq(cy, ay)) return -1;
  if (cy - by < 0) return 1;
  if (cy - by > 0) return -1;
  return 0;
}

export function curveValues(start, end, h1, h2, t) {
  if (Array.isArray(start)) {
    [start, end, h1, h2] = start;
    t = end;
  }
  const t2 = t * t;
  const t3 = t2 * t;
  const startV = (-t3) + (3 * t2) + (-3 * t) + 1;
  const h1V = (3 * t3) + (-6 * t2) + (3 * t);
  const h2V = (-3 * t3) + (3 * t2);
  const endV = t3;
  return gpt.point(
    start.x * startV + h1.x * h1V + h2.x * h2V + end.x * endV,
    start.y * startV + h1.y * h1V + h2.y * h2V + end.y * endV,
  );
}

function solveRootsStar(result, conj, a, b, c, d) {
  const sqrtB2_4ac = mth.sqrt(b * b - 4 * a * c);
  if (mth.almostZero(d) && mth.almostZero(a) && mth.almostZero(b)) {
    return result;
  }
  if (mth.almostZero(d) && mth.almostZero(a)) {
    return conj(result, (-c) / b);
  }
  if (mth.almostZero(d)) {
    result = conj(result, ((-b) + sqrtB2_4ac) / (2 * a));
    return conj(result, ((-b) - sqrtB2_4ac) / (2 * a));
  }
  a /= d; b /= d; c /= d;
  const p = (3 * b - a * a) / 3;
  const q = (2 * a * a * a - 9 * a * b + 27 * c) / 27;
  const p3 = p / 3;
  const q2 = q / 2;
  const discriminant = q2 * q2 + p3 * p3 * p3;
  if (discriminant < 0) {
    const mp3 = (-p) / 3;
    const mp33 = mp3 * mp3 * mp3;
    const r = mth.sqrt(mp33);
    let t = (-q) / (2 * r);
    let cosphi = t < -1 ? -1 : t > 1 ? 1 : t;
    const phi = mth.acos(cosphi);
    const crtr = mth.cubicroot(r);
    const t1 = 2 * crtr;
    const root1 = t1 * mth.cos(phi / 3) - a / 3;
    const root2 = t1 * mth.cos((phi + 2 * mth.PI) / 3) - a / 3;
    const root3 = t1 * mth.cos((phi + 4 * mth.PI) / 3) - a / 3;
    result = conj(result, root1);
    result = conj(result, root2);
    return conj(result, root3);
  }
  if (mth.almostZero(discriminant)) {
    const u1 = q2 < 0 ? mth.cubicroot(-q2) : -(mth.cubicroot(q2));
    const root1 = 2 * u1 - a / 3;
    const root2 = (-u1) - a / 3;
    result = conj(result, root1);
    return conj(result, root2);
  }
  const sd = mth.sqrt(discriminant);
  const u1 = mth.cubicroot(sd - q2);
  const v1 = mth.cubicroot(sd + q2);
  const root = u1 - v1 - a / 3;
  return conj(result, root);
}

function solveRoots(a, b, c, d) {
  if (d === undefined) { d = 0; }
  return solveRootsStar([], (r, v) => { r.push(v); return r; }, a, b, c, d);
}

export function curveExtremities(start, end, h1, h2) {
  if (Array.isArray(start)) {
    [start, end, h1, h2] = start;
  }
  const coords = [
    [start.x, h1.x, h2.x, end.x],
    [start.y, h1.y, h2.y, end.y],
  ];
  const result = [];
  for (const [c0, c1, c2, c3] of coords) {
    const a = (-3 * c0) + (9 * c1) + (-9 * c2) + (3 * c3);
    const b2 = (6 * c0) + (-12 * c1) + (6 * c2);
    const cVal = (3 * c1) + (-3 * c0);
    const roots = solveRoots(a, b2, cVal);
    for (const t of roots) {
      if (t > 0.01 && t < 0.99) result.push(t);
    }
  }
  return result;
}

export function calculateCurveExtremities(start, end, h1, h2) {
  const coords = [
    [start.x, h1.x, h2.x, end.x],
    [start.y, h1.y, h2.y, end.y],
  ];
  const result = [];
  const conjFn = (r, v) => { r.push(v); return r; };

  for (const [c0, c1, c2, c3] of coords) {
    const a = (-3 * c0) + (9 * c1) + (-9 * c2) + (3 * c3);
    const b2 = (6 * c0) + (-12 * c1) + (6 * c2);
    const cVal = (3 * c1) + (-3 * c0);

    const roots = solveRootsStar([], conjFn, a, b2, cVal, 0);
    for (const t of roots) {
      if (t > 0.01 && t < 0.99) {
        const t2 = t * t;
        const t3 = t2 * t;
        const startV = (-t3) + (3 * t2) + (-3 * t) + 1;
        const h1V = (3 * t3) + (-6 * t2) + (3 * t);
        const h2V = (-3 * t3) + (3 * t2);
        const endV = t3;
        result.push(gpt.point(
          start.x * startV + h1.x * h1V + h2.x * h2V + end.x * endV,
          start.y * startV + h1.y * h1V + h2.y * h2V + end.y * endV,
        ));
      }
    }
  }
  return result;
}

export function curveTangent(curve, t) {
  const [start, end, h1, h2] = curve;
  const coords = [
    [start.x, h1.x, h2.x, end.x],
    [start.y, h1.y, h2.y, end.y],
  ];
  const [x, y] = coords.map(([c0, c1, c2, c3]) => {
    const t2 = t * t;
    return c0 * ((-3 * t2) + 6 * t - 3) +
      c1 * ((9 * t2) - 12 * t + 3) +
      c2 * ((-9 * t2) + 6 * t) +
      c3 * (3 * t2);
  });
  const d = mth.hypot(x, y);
  if (mth.almostZero(d)) return gpt.point(0, 0);
  return gpt.point(x / d, y / d);
}

export function curveWindup(curve, t) {
  const tangent = curveTangent(curve, t);
  if (tangent.y > 0) return -1;
  if (tangent.y < 0) return 1;
  return 0;
}

export function curveToLines(start, end, h1, h2) {
  const offset = 1 / NUM_SEGMENTS;
  const tp = t => curveValues(start, end, h1, h2, t);
  const result = [];
  let from = 0.0;
  while (true) {
    const to = Math.min(1.0, from + offset);
    result.push([tp(from), tp(to)]);
    if (to >= 1.0) break;
    from = to;
  }
  return result;
}

export function curveSplit(start, end, h1, h2, t) {
  if (Array.isArray(start)) {
    t = end;
    [start, end, h1, h2] = start;
  }
  const p1 = gpt.lerp(start, h1, t);
  const p2 = gpt.lerp(h1, h2, t);
  const p3 = gpt.lerp(h2, end, t);
  const p4 = gpt.lerp(p1, p2, t);
  const p5 = gpt.lerp(p2, p3, t);
  const sp = gpt.lerp(p4, p5, t);
  return [[start, sp, p1, p4], [sp, end, p5, p3]];
}

export function splitLineTo(fromP, segment, tVal) {
  const toP = segmentToPoint(segment);
  const sp = gpt.lerp(fromP, toP, tVal);
  return [makeLineTo(sp), segment];
}

export function splitCurveTo(fromP, segment, tVal) {
  const params = segment.params;
  const end = gpt.point(params.x, params.y);
  const h1 = gpt.point(params.c1x, params.c1y);
  const h2 = gpt.point(params.c2x, params.c2y);
  const splits = curveSplit(fromP, end, h1, h2, tVal);
  return [makeCurveTo(splits[0][1], splits[0][2], splits[0][3]),
    makeCurveTo(splits[1][1], splits[1][2], splits[1][3])];
}

export function subcurveRange(start, end, h1, h2, t1, t2) {
  if (Array.isArray(start)) {
    if (Array.isArray(end)) {
      [start, end, h1, h2] = start;
      [t1, t2] = end;
    } else {
      t2 = h1;
      [start, end, h1, h2, t1] = start;
    }
  }
  if (t1 > t2) { [t1, t2] = [t2, t1]; }
  const t2p = (t2 - t1) / (1 - t1);
  const split = curveSplit(start, end, h1, h2, t1);
  return curveSplit(split[1][0], split[1][1], split[1][2], split[1][3], t2p)[0];
}

export function splitLineToRanges(fromP, segment, values) {
  values = values.filter(v => v > 0 && v < 1);
  if (values.length === 0) return [segment];
  const toP = segmentToPoint(segment);
  const valuesSet = [...new Set([...values, 1])].sort((a, b) => a - b);
  return valuesSet.map(val => makeLineTo(gpt.lerp(fromP, toP, val)));
}

export function splitCurveToRanges(fromP, segment, values) {
  values = values.filter(v => v > 0 && v < 1);
  if (values.length === 0) return [segment];
  const toP = segmentToPoint(segment);
  const params = segment.params;
  const h1 = gpt.point(params.c1x, params.c1y);
  const h2 = gpt.point(params.c2x, params.c2y);
  const valuesSet = [...new Set([...values, 0, 1])].sort((a, b) => a - b);
  const result = [];
  for (let i = 1; i < valuesSet.length; i++) {
    const t0 = valuesSet[i - 1];
    const t1 = valuesSet[i];
    const sc = subcurveRange(fromP, toP, h1, h2, t0, t1);
    result.push(makeCurveTo(sc[1], sc[2], sc[3]));
  }
  return result;
}

function getLineTval(line, point) {
  const [{ x: x1, y: y1 }, { x: x2, y: y2 }] = line;
  const { x, y } = point;
  if (sEq(x1, x2) && sEq(y1, y2)) return Infinity;
  if (sEq(x1, x2)) return (y - y1) / (y2 - y1);
  return (x - x1) / (x2 - x1);
}

function curveRangeToRect(curve, fromT, toT) {
  const c = subcurveRange(curve[0], curve[1], curve[2], curve[3], fromT, toT);
  const extremes = curveExtremities(c).map(t => curveValues(c, t));
  return grc.pointsToRect([c[0], c[1], ...extremes]);
}

export function lineHasPointQ(point, line) {
  const { x: x1, y: y1 } = line[0];
  const { x: x2, y: y2 } = line[1];
  const { x: px, y: py } = point;
  const m = sEq(x1, x2) ? null : (y2 - y1) / (x2 - x1);
  const vy = m !== null ? m * px + (-m) * x1 + y1 : null;
  return (sEq(x1, x2) && sEq(px, x1)) || (vy !== null && sEq(py, vy));
}

export function segmentHasPointQ(point, line) {
  if (!lineHasPointQ(point, line)) return false;
  const t = getLineTval(line, point);
  return (t > 0 || sEq(t, 0)) && (t < 1 || sEq(t, 1));
}

export function curveHasPointQ(point, curve) {
  function checkRange(fromT, toT) {
    const r = curveRangeToRect(curve, fromT, toT);
    if (!grc.containsPoint(r, point)) return false;
    if (sEq(fromT, toT)) return gpt.distance(curveValues(curve, fromT), point) < 0.1;
    const halfT = fromT + (toT - fromT) / 2.0;
    return checkRange(fromT, halfT) || checkRange(halfT, toT);
  }
  return checkRange(0, 1);
}

export function curveRoots(start, end, h1, h2, coord) {
  if (Array.isArray(start)) {
    coord = end;
    [start, end, h1, h2] = start;
  }
  const coords = [[start[coord], h1[coord], h2[coord], end[coord]]];
  const result = [];
  for (const [pa, pb, pc, pd] of coords) {
    const a = 3 * pa - 6 * pb + 3 * pc;
    const bVal = -3 * pa + 3 * pb;
    const cVal = pa;
    const dVal = -pa + 3 * pb - 3 * pc + pd;
    const roots = solveRoots(a, bVal, cVal, dVal);
    for (const t of roots) {
      if (t >= 0 && t <= 1) result.push(t);
    }
  }
  return result;
}

export function lineLineCrossing(l1, l2) {
  const { x: x1, y: y1 } = l1[0];
  const { x: x2, y: y2 } = l1[1];
  const { x: x3, y: y3 } = l2[0];
  const { x: x4, y: y4 } = l2[1];
  const nx = ((x3 - x4) * (x1 * y2 - y1 * x2)) - ((x1 - x2) * (x3 * y4 - y3 * x4));
  const ny = ((y3 - y4) * (x1 * y2 - y1 * x2)) - ((y1 - y2) * (x3 * y4 - y3 * x4));
  const d = ((x1 - x2) * (y3 - y4)) - ((y1 - y2) * (x3 - x4));
  if (!mth.almostZero(d)) {
    const crossP = gpt.point(nx / d, ny / d);
    const t1 = getLineTval(l1, crossP);
    const t2 = getLineTval(l2, crossP);
    return [t1, t2];
  }
  if (lineHasPointQ(l2[0], l1)) return [getLineTval(l1, l2[0]), 0];
  if (lineHasPointQ(l2[1], l1)) return [getLineTval(l1, l2[1]), 1];
  if (lineHasPointQ(l1[1], l2)) return [1, getLineTval(l2, l1[1])];
  if (lineHasPointQ(l1[0], l2)) return [0, getLineTval(l2, l1[0])];
  return null;
}

export function lineLineIntersect(l1, l2) {
  const crossing = lineLineCrossing(l1, l2);
  if (!crossing) return null;
  const [l1T, l2T] = crossing;
  if (l1T == null || l2T == null) return null;
  if ((l1T > 0 || sEq(l1T, 0)) && (l1T < 1 || sEq(l1T, 1)) &&
      (l2T > 0 || sEq(l2T, 0)) && (l2T < 1 || sEq(l2T, 1))) {
    return [[l1T], [l2T]];
  }
  return null;
}

export function lineCurveCrossing(line, curve) {
  const [fromP1, toP1] = line;
  const [fromP2, toP2, h1P2, h2P2] = curve;
  const theta = mth.degrees(mth.atan2(toP1.y - fromP1.y, toP1.x - fromP1.x));
  const transform = gmt.rotate(gmt.matrix(), -theta);
  const finalTransform = gmt.translate(transform, gpt.negate(fromP1));
  const c2p = [
    gpt.transform(fromP2, finalTransform),
    gpt.transform(toP2, finalTransform),
    gpt.transform(h1P2, finalTransform),
    gpt.transform(h2P2, finalTransform),
  ];
  return curveRoots(c2p, 'y');
}

export function lineCurveIntersect(l1, c2) {
  let curveTs = lineCurveCrossing(l1, c2).filter(curveT => {
    if (mth.almostZero(curveT)) curveT = 0;
    const curveV = curveValues(c2, curveT);
    const lineT = getLineTval(l1, curveV);
    return curveT >= 0 && curveT <= 1 && lineT >= 0 && lineT <= 1;
  });
  const intersectPs = curveTs.map(t => curveValues(c2, t));
  const lineTs = intersectPs.map(p => getLineTval(l1, p));
  return [lineTs, curveTs];
}

export function rayOverlapsQ(rayPoint, { selrect }) {
  return (rayPoint.y > selrect.y1 || mth.almostZero(rayPoint.y - selrect.y1)) &&
    (rayPoint.y < selrect.y2 || mth.almostZero(rayPoint.y - selrect.y2));
}

export function rayLineIntersect(point, line) {
  let [a, b] = line;
  const rayLine = [point, gpt.point(point.x + 1, point.y)];
  if (a && sEq(a.y, point.y)) a = { ...a, y: a.y + 10 };
  if (b && sEq(b.y, point.y)) b = { ...b, y: b.y + 10 };
  const crossing = lineLineCrossing(rayLine, [a, b]);
  if (!crossing) return null;
  const [rayT, lineT] = crossing;
  if (rayT != null && lineT != null && rayT > 0 &&
      (lineT > 0 || sEq(lineT, 0)) && (lineT < 1 || sEq(lineT, 1))) {
    return [[lineValues([a, b], lineT), lineWindup([a, b], lineT)]];
  }
  return null;
}

export function rayCurveIntersect(rayLine, curve) {
  const curveTs = lineCurveCrossing(rayLine, curve).filter(t => {
    const curveV = curveValues(curve, t);
    const curveTg = curveTangent(curve, t);
    const curveTgAngle = gpt.angle(curveTg);
    const rayT = getLineTval(rayLine, curveV);
    return rayT > 0 &&
      mth.abs(curveTgAngle - 180) > 0.01 &&
      mth.abs(curveTgAngle - 0) > 0.01;
  });
  return curveTs.map(t => [curveValues(curve, t), curveWindup(curve, t)]);
}

export function curveCurveIntersect(c1, c2) {
  function checkRange(c1From, c1To, c2From, c2To) {
    const r1 = curveRangeToRect(c1, c1From, c1To);
    const r2 = curveRangeToRect(c2, c2From, c2To);
    if (!grc.overlapsRects(r1, r2)) return null;
    const p1 = curveValues(c1, c1From);
    const p2 = curveValues(c2, c2From);
    if (gpt.distance(p1, p2) < CURVE_CURVE_PRECISION) {
      return [{ p1, p2, d: gpt.distance(p1, p2), t1: mth.precision(c1From, 4), t2: mth.precision(c2From, 4) }];
    }
    const c1Half = c1From + (c1To - c1From) / 2;
    const c2Half = c2From + (c2To - c2From) / 2;
    const ts1 = checkRange(c1From, c1Half, c2From, c2Half);
    const ts2 = checkRange(c1From, c1Half, c2Half, c2To);
    const ts3 = checkRange(c1Half, c1To, c2From, c2Half);
    const ts4 = checkRange(c1Half, c1To, c2Half, c2To);
    const result = [];
    for (const ts of [ts1, ts2, ts3, ts4]) {
      if (ts) result.push(...ts);
    }
    return result.length > 0 ? result : null;
  }

  function removeCloseTs(current) {
    return ({ p1, p2 }) =>
      gpt.distance(p1, current.p1) >= CURVE_RANGE_PRECISION &&
      gpt.distance(p2, current.p2) >= CURVE_RANGE_PRECISION;
  }

  function processTs(ts) {
    let c1Ts = [];
    let c2Ts = [];
    let current = ts[0];
    let pending = ts.slice(1);
    while (current) {
      pending = pending.filter(removeCloseTs(current));
      c1Ts.push(current.t1);
      c2Ts.push(current.t2);
      current = pending.shift();
    }
    return [c1Ts, c2Ts];
  }

  const allTs = checkRange(0, 1, 0, 1);
  if (!allTs || allTs.length === 0) return [[], []];
  allTs.sort((a, b) => a.d - b.d);
  return processTs(allTs);
}

export function isPointInGeomDataQ(point, contentGeom) {
  const rayLine = [point, gpt.point(point.x + 1, point.y)];
  return contentGeom
    .filter(d => rayOverlapsQ(point, d))
    .map(d => {
      switch (d.command) {
        case 'line-to': return rayLineIntersect(point, d.geom);
        case 'curve-to': return rayCurveIntersect(rayLine, d.geom);
        default: return [];
      }
    })
    .flat()
    .map(x => x[1])
    .reduce((a, b) => a + b, 0) !== 0;
}

export function isPointInBorderQ(point, content) {
  return content.some(segment => {
    switch (segment.command) {
      case 'line-to': return segmentHasPointQ(point, commandToLine(segment));
      case 'curve-to': return curveHasPointQ(point, commandToBezier(segment));
      default: return false;
    }
  });
}

function closestAngle(angle) {
  if (angle > 337.5 || angle <= 22.5) return 0;
  if (angle <= 67.5) return 45;
  if (angle <= 112.5) return 90;
  if (angle <= 157.5) return 135;
  if (angle <= 202.5) return 180;
  if (angle <= 247.5) return 225;
  if (angle <= 292.5) return 270;
  return 315;
}

export function positionFixedAngle(point, fromPoint) {
  if (fromPoint && point) {
    const angle = ((360 + (gpt.angle(point, fromPoint))) % 360);
    const toAngle = closestAngle(angle);
    const distance = gpt.distance(point, fromPoint);
    return gpt.angleToPoint(fromPoint, mth.radians(toAngle), distance);
  }
  return point;
}