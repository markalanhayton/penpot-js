import * as d from '../../data.js';
import * as gpt from '../../geom/point.js';
import * as gmt from '../../geom/matrix.js';
import * as grc from '../../geom/rect.js';
import * as mth from '../../math.js';
import * as helpers from './helpers.js';
import * as impl from './impl.js';

function updateHandler(command, prefix, point) {
  const [cox, coy] = prefix === 'c1' ? ['c1x', 'c1y'] : ['c2x', 'c2y'];
  return {
    ...command,
    params: { ...command.params, [cox]: point.x, [coy]: point.y },
  };
}

export function getHandler(command, prefix) {
  if (!command || !command.params) return undefined;
  const cx = prefix + 'x';
  const cy = prefix + 'y';
  if (cx in command.params && cy in command.params) {
    return gpt.point(command.params[cx], command.params[cy]);
  }
  return undefined;
}

export function getHandlers(content) {
  let prevPoint = null;
  const result = {};
  for (let index = 0; index < content.length; index++) {
    const seg = content.get(index);
    if (!seg) continue;
    const currPoint = gpt.point(seg.params.x ?? 0, seg.params.y ?? 0);
    if (prevPoint && seg.command === 'curve-to') {
      const key1 = pointKey(prevPoint);
      const key2 = pointKey(currPoint);
      if (!result[key1]) result[key1] = [];
      if (!result[key2]) result[key2] = [];
      result[key1].push([index, 'c1']);
      result[key2].push([index, 'c2']);
    }
    prevPoint = currPoint;
  }
  return result;
}

function pointKey(p) {
  return `${p.x},${p.y}`;
}

export function pointIndices(content, point) {
  const result = [];
  for (const [index, segment] of d.enumerate(content)) {
    if (helpers.segmentToPoint(segment) && gpt.close(helpers.segmentToPoint(segment), point)) {
      result.push(index);
    }
  }
  return result;
}

export function handlerIndices(content, point) {
  const result = [];
  const withPrevContent = d.withPrev(Array.from(content));
  for (const [index, [curSegment, preSegment]] of d.enumerate(withPrevContent)) {
    if (preSegment && curSegment.command === 'curve-to') {
      const curPos = helpers.segmentToPoint(curSegment);
      const prePos = helpers.segmentToPoint(preSegment);
      if (gpt.close(prePos, point)) result.push([index, 'c1']);
      if (gpt.close(curPos, point)) result.push([index, 'c2']);
    }
  }
  return result;
}

export function oppositeIndex(content, index, prefix) {
  const point = prefix === 'c2'
    ? helpers.segmentToPoint(content.get(index))
    : helpers.segmentToPoint(content.get(index - 1));

  const pointToHandlers = getHandlers(content);
  const handlers = (pointToHandlers[pointKey(point)] || [])
    .filter(([ci, cp]) => ci !== index || cp !== prefix);

  if (handlers.length === 1) return handlers[0];
  if (prefix === 'c1' && content.length === index) return [index - 1, 'c2'];
  return null;
}

export function getHandlerPoint(content, index, prefix) {
  if (index == null || content == null) return undefined;
  return content.lookup(index, (command, c1x, c1y, c2x, c2y, x, y) => {
    if (command !== 'curve-to') prefix = null;
    switch (prefix) {
      case 'c1': return gpt.point(c1x, c1y);
      case 'c2': return gpt.point(c2x, c2y);
      default: return gpt.point(x, y);
    }
  });
}

export function handlerToNode(content, index, prefix) {
  if (prefix === 'c1') {
    return helpers.segmentToPoint(content.get(index - 1));
  }
  return helpers.segmentToPoint(content.get(index));
}

export function calculateOppositeHandler(point, handler) {
  const handlerVector = gpt.toVec(point, handler);
  return gpt.add(point, gpt.negate(handlerVector));
}

export function getPoints(content) {
  return content.walk((type, _c1x, _c1y, _c2x, _c2y, x, y) => {
    if (type !== 'close-path') return gpt.point(x, y);
  }, []);
}

export function pathToLines(shape) {
  const result = [];
  let lastStart = null;
  let prevPoint = null;
  for (const command of shape.content) {
    const { command: cmd, params } = command;
    if (!cmd) {
      result.push([prevPoint, lastStart]);
      break;
    }
    const point = cmd === 'close-path' ? lastStart : gpt.point(params);
    if (cmd === 'line-to') {
      result.push([prevPoint, point]);
    } else if (cmd === 'curve-to') {
      const h1 = gpt.point(params.c1x, params.c1y);
      const h2 = gpt.point(params.c2x, params.c2y);
      result.push(...helpers.curveToLines(prevPoint, point, h1, h2));
    } else if (cmd === 'move-to' && lastStart) {
      result.push([prevPoint, lastStart]);
    }
    if (cmd === 'move-to') lastStart = point;
    prevPoint = point;
  }
  result.push([prevPoint, lastStart]);
  return result;
}

function curveClosestPoint(position, start, end, h1, h2, precision) {
  const dMemo = new Map();
  const dFn = (t) => {
    if (dMemo.has(t)) return dMemo.get(t);
    const val = gpt.distance(position, helpers.curveValues(start, end, h1, h2, t));
    dMemo.set(t, val);
    return val;
  };

  let t1 = 0.0, t2 = 1.0;
  while (Math.abs(t1 - t2) > precision) {
    const ht = t1 + (t2 - t1) / 2;
    const ht1 = t1 + (t2 - t1) / 4;
    const ht2 = t1 + 3 * (t2 - t1) / 4;

    if (dFn(ht1) < dFn(ht2)) { t2 = ht; }
    else if (dFn(ht2) < dFn(ht1)) { t1 = ht; }
    else if (dFn(ht) < dFn(t1) && dFn(ht) < dFn(t2)) { t1 = ht1; t2 = ht2; }
    else if (dFn(t1) < dFn(t2)) { t2 = ht; }
    else { t1 = ht; }
  }

  return helpers.curveValues(start, end, h1, h2, t1);
}

function lineClosestPoint(position, fromP, toP) {
  const e1 = gpt.toVec(fromP, toP);
  const e2 = gpt.toVec(fromP, position);
  const len2 = e1.x * e1.x + e1.y * e1.y;
  const t = gpt.dot(e1, e2) / len2;

  if (t >= 0 && t <= 1 && !mth.almostZero(len2)) {
    return gpt.add(fromP, gpt.scale(e1, t));
  }
  return gpt.distance(position, fromP) <= gpt.distance(position, toP) ? fromP : toP;
}

export function closestPoint(content, position, precision) {
  const withPrevContent = d.withPrev(Array.from(content));
  let minP = null, minDist = Infinity;

  for (const [curSegment, prevSegment] of withPrevContent) {
    if (!curSegment || curSegment.command === 'move-to') continue;
    const fromP = helpers.segmentToPoint(prevSegment);
    const toP = helpers.segmentToPoint(curSegment);
    let point;

    if (curSegment.command === 'line-to') {
      point = lineClosestPoint(position, fromP, toP);
    } else if (curSegment.command === 'curve-to') {
      const h1 = gpt.point(curSegment.params.c1x, curSegment.params.c1y);
      const h2 = gpt.point(curSegment.params.c2x, curSegment.params.c2y);
      point = curveClosestPoint(position, fromP, toP, h1, h2, precision);
    } else {
      continue;
    }

    const dist = gpt.distance(point, position);
    if (dist < minDist) {
      minDist = dist;
      minP = point;
    }
  }
  return minP;
}

function removeLineCurves(content) {
  const withPrevContent = d.enumerate(d.withPrev(content));
  return withPrevContent.reduce((result, [index, [segment, prev]]) => {
    const curPoint = helpers.segmentToPoint(segment);
    const prePoint = helpers.segmentToPoint(prev);
    const handlerC1 = getHandler(segment, 'c1');
    const handlerC2 = getHandler(segment, 'c2');
    if (segment.command === 'curve-to' &&
        gpt.close(curPoint, handlerC2) &&
        gpt.close(prePoint, handlerC1)) {
      result[index] = { command: 'line-to', params: { x: curPoint.x, y: curPoint.y } };
    }
    return result;
  }, [...content]);
}

export function makeCornerPoint(content, point) {
  const pointToHandlers = getHandlers(content);
  const handlerList = pointToHandlers[pointKey(point)] || [];

  let result = [...content];
  for (const [index, prefix] of handlerList) {
    const cx = prefix + 'x';
    const cy = prefix + 'y';
    result[index] = {
      ...result[index],
      params: { ...result[index].params, [cx]: point.x, [cy]: point.y },
    };
  }

  result = removeLineCurves(result);
  return impl.fromPlain(result);
}

function lineToCurve(fromP, segment) {
  const toP = helpers.segmentToPoint(segment);
  const v = gpt.toVec(fromP, toP);
  const dist = gpt.distance(fromP, toP);
  const dv1 = gpt.scale(gpt.normalLeft(v), dist / 3);
  const h1 = gpt.add(fromP, dv1);
  const dv2 = gpt.scale(gpt.unit(gpt.toVec(toP, h1)), dist / 3);
  const h2 = gpt.add(toP, dv2);
  return {
    command: 'curve-to',
    params: { ...segment.params, c1x: h1.x, c1y: h1.y, c2x: h2.x, c2y: h2.y },
  };
}

export function isCurveQ(content, point) {
  const pointToHandlers = getHandlers(content);
  const handlerList = pointToHandlers[pointKey(point)] || [];
  return handlerList.some(([index, prefix]) => {
    const hp = getHandlerPoint(content, index, prefix);
    return hp && !gpt.close(point, hp);
  });
}

export function makeCurvePoint(content, point) {
  const indices = pointIndices(content, point);
  let result = [...content];

  const vectors = indices.map(index => {
    const segment = result[index];
    const prev = index > 0 && segment.command !== 'move-to' ? result[index - 1] : null;
    const next = index < result.length - 1 ? result[index + 1] : null;
    const nextSegment = next && next.command !== 'move-to' ? next : null;
    return {
      index,
      prevI: prev ? index - 1 : null,
      prevC: prev,
      prevP: prev ? helpers.segmentToPoint(prev) : null,
      nextI: nextSegment ? index + 1 : null,
      nextC: nextSegment,
      nextP: nextSegment ? helpers.segmentToPoint(nextSegment) : null,
      segment,
    };
  });

  const points = new Set();
  for (const v of vectors) {
    if (v.prevP) points.add(pointKey(v.prevP));
    if (v.nextP) points.add(pointKey(v.nextP));
  }

  const pointArr = [...points].map(k => {
    const [x, y] = k.split(',').map(Number);
    return gpt.point(x, y);
  });

  if (pointArr.length === 2) {
    const [fpoint, spoint] = pointArr;
    const v1 = gpt.toVec(fpoint, point);
    const v2 = gpt.toVec(fpoint, spoint);
    const vp = gpt.project(v1, v2);
    const vh = gpt.subtract(v1, vp);

    for (const { index, prevP, nextP, nextI } of vectors) {
      const currSegment = result[index];
      const currCommand = currSegment.command;
      const nextSegment = nextI !== null ? result[nextI] : null;
      const nextCommand = nextSegment?.command;

      const prevH = prevP ? gpt.add(prevP, vh) : null;
      const nextH = nextP ? gpt.add(nextP, vh) : null;
      const prevCorrection = prevH ? gpt.scale(gpt.toVec(prevH, point), 1 / 3) : null;
      const nextCorrection = nextH ? gpt.scale(gpt.toVec(nextH, point), 1 / 3) : null;
      const correctedPrevH = prevH && prevCorrection ? gpt.add(prevH, prevCorrection) : prevH;
      const correctedNextH = nextH && nextCorrection ? gpt.add(nextH, nextCorrection) : nextH;

      if (currCommand === 'line-to' && prevP) {
        result[index] = helpers.updateCurveTo(currSegment, prevP, correctedPrevH);
      }
      if (nextCommand === 'line-to' && nextP) {
        result[nextI] = helpers.updateCurveTo(nextSegment, correctedNextH, nextP);
      }
      if (currCommand === 'curve-to' && prevP) {
        result[index] = updateHandler(currSegment, 'c2', correctedPrevH);
      }
      if (nextCommand === 'curve-to' && nextP) {
        result[nextI] = updateHandler(nextSegment, 'c1', correctedNextH);
      }
    }
  } else {
    for (const { index, segment, prevP, nextC, nextI } of vectors) {
      if (segment.command === 'line-to' && prevP) {
        result[index] = lineToCurve(prevP, segment);
      }
      if (segment.command === 'curve-to' && prevP) {
        result[index] = lineToCurve(prevP, segment);
      }
      if (nextC?.command === 'line-to') {
        result[nextI] = lineToCurve(point, nextC);
      }
      if (nextC?.command === 'curve-to') {
        result[nextI] = lineToCurve(point, nextC);
      }
    }
  }

  return impl.fromPlain(result);
}

export function getSegmentsWithPoints(content, points) {
  const pointSet = new Set(points.map(p => pointKey(p)));
  const result = [];
  let prevPoint = null;
  let startPoint = null;
  let index = 0;

  for (const segment of content) {
    const closePathQ = segment.command === 'close-path';
    const moveToQ = segment.command === 'move-to';
    const curPoint = closePathQ ? startPoint : helpers.segmentToPoint(segment);
    if (moveToQ) prevPoint = null;
    if (moveToQ) startPoint = curPoint;

    if (prevPoint && pointSet.has(pointKey(prevPoint)) && pointSet.has(pointKey(curPoint))) {
      result.push({ ...segment, start: prevPoint, end: curPoint, index });
    }

    prevPoint = curPoint;
    index++;
  }
  return result;
}

export function splitSegments(content, points, value) {
  function splitCommand(segment) {
    switch (segment.command) {
      case 'line-to': return [segment.index, helpers.splitLineTo(segment.start, segment, value)];
      case 'curve-to': return [segment.index, helpers.splitCurveTo(segment.start, segment, value)];
      case 'close-path': return [segment.index, [helpers.makeLineTo(gpt.lerp(segment.start, segment.end, value)), segment]];
      default: return null;
    }
  }

  const segmentChanges = new Map();
  for (const seg of getSegmentsWithPoints(content, points)) {
    const result = splitCommand(seg);
    if (result) segmentChanges.set(result[0], result[1]);
  }

  const en = d.enumerate(Array.from(content));
  return en.flatMap(([index, command]) =>
    segmentChanges.has(index) ? segmentChanges.get(index) : [command]
  );
}

export function nextNode(content, position, prevPoint, prevHandler) {
  const pos = { x: position.x, y: position.y };
  const lastCommand = content.length > 0 ? content.get(content.length - 1)?.command : null;
  const addLineQ = prevPoint && !prevHandler && lastCommand !== 'close-path';
  const addCurveQ = prevPoint && prevHandler && lastCommand !== 'close-path';

  if (addLineQ) return { command: 'line-to', params: pos };
  if (addCurveQ) return { command: 'curve-to', params: helpers.makeCurveParams(pos, prevHandler) };
  return { command: 'move-to', params: pos };
}

export function removeNodes(content, points) {
  if (points.length === 0) return content;

  const pointSet = new Set(points.map(p => pointKey(p)));
  const withPrevContent = d.withPrev(Array.from(content));
  const result = [[]];
  let lastHandler = null;

  for (const [curSegment, prevSegment] of withPrevContent) {
    if (!curSegment) continue;
    const moveQ = curSegment.command === 'move-to';
    const curveQ = curSegment.command === 'curve-to';

    if (moveQ) result.push([]);

    const subpath = result[result.length - 1];
    const point = helpers.segmentToPoint(curSegment);
    const removeQ = pointSet.has(pointKey(point));

    let newSegment = { ...curSegment, params: { ...curSegment.params } };

    if (!moveQ && subpath.length === 0) {
      newSegment.command = 'move-to';
      newSegment.params = { x: newSegment.params.x ?? 0, y: newSegment.params.y ?? 0 };
    }

    if (curveQ && subpath.length > 0 && lastHandler) {
      newSegment.params = { ...newSegment.params, ...lastHandler };
    }

    let curHandler = null;
    if (!lastHandler && removeQ && curveQ) {
      const { c1x, c1y } = curSegment.params;
      if (c1x !== undefined) curHandler = { c1x, c1y };
    }

    if (!removeQ) {
      subpath.push(newSegment);
    } else {
      lastHandler = curHandler;
    }
  }

  return result
    .filter(sp => sp.length > 1)
    .flat();
}

export function joinNodes(content, points) {
  const arr = Array.from(content);
  const segmentsWithPoints = getSegmentsWithPoints(content, points);
  const segmentsSet = new Set(segmentsWithPoints.map(s => pointKey(s.start) + '|' + pointKey(s.end)));

  function notSegmentQ(point, other) {
    const key1 = pointKey(point) + '|' + pointKey(other);
    const key2 = pointKey(other) + '|' + pointKey(point);
    return !segmentsSet.has(key1) && !segmentsSet.has(key2);
  }

  const newContent = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (notSegmentQ(points[i], points[j])) {
        newContent.push(helpers.makeMoveTo(points[i]));
        newContent.push(helpers.makeLineTo(points[j]));
      }
    }
  }

  return [...arr, ...newContent];
}

export function separateNodes(content, points) {
  const pointSet = new Set(points.map(p => pointKey(p)));
  const withPrevContent = d.withPrev(Array.from(content));
  const result = [[]];

  for (const [curSegment, prevSegment] of withPrevContent) {
    if (!curSegment) continue;
    const prevPoint = helpers.segmentToPoint(prevSegment);
    const curPoint = helpers.segmentToPoint(curSegment);

    if (prevPoint && curPoint && pointSet.has(pointKey(prevPoint)) && pointSet.has(pointKey(curPoint))) {
      const newSeg = { ...curSegment, command: 'move-to', params: { x: curSegment.params.x, y: curSegment.params.y } };
      Object.keys(newSeg.params).forEach(k => {
        if (!['x', 'y'].includes(k)) delete newSeg.params[k];
      });
      result.push([newSeg]);
    } else {
      result[result.length - 1].push(curSegment);
    }
  }

  return result.filter(sp => sp.length > 1).flat();
}

function addToSet(setList, target, value) {
  return setList.map(it => it === target ? new Set([...it, value]) : it);
}

function joinSets(setList, target, other) {
  return [
    ...setList.filter(it => it !== target && it !== other),
    new Set([...target, ...other]),
  ];
}

function groupSegments(segments) {
  let result = [];
  for (const { start, end } of segments) {
    const setA = result.find(s => s.has(pointKey(start)));
    const setB = result.find(s => s.has(pointKey(end)));

    if (!setA && !setB) {
      result.push(new Set([pointKey(start), pointKey(end)]));
    } else if (setA && !setB) {
      result = addToSet(result, setA, pointKey(end));
    } else if (!setA && setB) {
      result = addToSet(result, setB, pointKey(start));
    } else if (setA !== setB) {
      result = joinSets(result, setA, setB);
    }
  }
  return result;
}

function calculateMergePoints(groupedSegments, points) {
  const groupToMergePoint = new Map();
  for (const group of groupedSegments) {
    const pts = [...group].map(k => {
      const [x, y] = k.split(',').map(Number);
      return gpt.point(x, y);
    });
    groupToMergePoint.set(group, gpt.centerPoints(pts));
  }

  const pointToGroup = new Map();
  for (const p of points) {
    const group = groupedSegments.find(s => s.has(pointKey(p)));
    if (group) pointToGroup.set(pointKey(p), group);
  }

  const result = new Map();
  for (const [pk, group] of pointToGroup) {
    if (groupToMergePoint.has(group)) {
      result.set(pk, groupToMergePoint.get(group));
    }
  }
  return result;
}

function replacePoints(content, pointToMergePoint) {
  return content.map(segment => {
    const point = helpers.segmentToPoint(segment);
    if (point && pointToMergePoint.has(pointKey(point))) {
      const mergePoint = pointToMergePoint.get(pointKey(point));
      return { ...segment, params: { ...segment.params, x: mergePoint.x, y: mergePoint.y } };
    }
    return segment;
  });
}

export function mergeNodes(content, points) {
  const segments = getSegmentsWithPoints(content, points);
  if (segments.length === 0) return content;

  const grouped = groupSegments(segments);
  const pointToMergePoint = calculateMergePoints(grouped, points);
  const separated = separateNodes(content, points);
  return replacePoints(separated, pointToMergePoint);
}

export function transformContent(content, transform) {
  if (transform == null) return content;
  return impl.pathData(content).transform(transform);
}

export function moveContent(content, moveVec) {
  if (gpt.isZero(moveVec)) return content;
  const transform = gmt.translateMatrix(moveVec);
  return transformContent(content, transform);
}

function calculateExtremities(content) {
  const arr = Array.from(content);
  let points = new Set();
  let fromP = null;
  let moveP = null;
  let i = 0;

  while (i < arr.length) {
    const segment = arr[i];
    const toP = helpers.segmentToPoint(segment);

    switch (segment.command) {
      case 'move-to':
        points.add(pointKey(toP));
        fromP = toP;
        moveP = toP;
        break;
      case 'close-path':
        if (moveP) points.add(pointKey(moveP));
        fromP = moveP;
        break;
      case 'line-to':
        if (fromP) { points.add(pointKey(fromP)); points.add(pointKey(toP)); }
        fromP = toP;
        break;
      case 'curve-to': {
        if (fromP) {
          points.add(pointKey(fromP));
          points.add(pointKey(toP));
          const c1 = helpers.segmentToPoint(segment, 'c1');
          const c2 = helpers.segmentToPoint(segment, 'c2');
          if (c1 && c2) {
            for (const ep of helpers.calculateCurveExtremities(fromP, toP, c1, c2)) {
              points.add(pointKey(ep));
            }
          }
        }
        fromP = toP;
        break;
      }
    }
    i++;
  }

  return [...points].map(k => {
    const [x, y] = k.split(',').map(Number);
    return gpt.point(x, y);
  });
}

export function contentToSelrect(content) {
  let extremities = calculateExtremities(content);
  if (extremities.length === 0) {
    extremities = Array.from(content)
      .map(seg => helpers.segmentToPoint(seg))
      .filter(Boolean);
  }
  if (extremities.length === 0) return grc.makeRect();
  return grc.pointsToRect(extremities);
}

export function contentCenter(content) {
  return grc.rectToCenter(contentToSelrect(content));
}

export function appendSegment(content, segment) {
  const arr = impl.pathDataQ(content) ? Array.from(content) : content || [];
  return [...arr, impl.checkSegment(segment)];
}

export function pointsToContent(points, { close = false } = {}) {
  const initial = points[0];
  if (!initial) return impl.fromPlain([]);
  const result = [{ command: 'move-to', params: { x: initial.x, y: initial.y } }];
  for (let i = 1; i < points.length; i++) {
    result.push({ command: 'line-to', params: { x: points[i].x, y: points[i].y } });
  }
  if (close) result.push({ command: 'close-path', params: {} });
  return impl.fromPlain(result);
}