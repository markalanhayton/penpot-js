import * as d from '../../data.js';
import * as gpt from '../../geom/point.js';
import * as grc from '../../geom/rect.js';
import * as mth from '../../math.js';
import * as helpers from './helpers.js';
import * as segment from './segment.js';
import * as subpath from './subpath.js';

export const GROUP_STYLE_PROPERTIES = new Set(['shadow', 'blur']);
export const STYLE_PROPERTIES = new Set([...GROUP_STYLE_PROPERTIES, 'fills', 'strokes']);

export function getDefaultFills() {
  return [{ fillColor: '#000000' }];
}

export function addPrevious(content, first) {
  return d.withPrev(content).map(([cmd, prev]) => {
    if (!prev && first) return { ...cmd, prev: first };
    if (prev) return { ...cmd, prev: helpers.segmentToPoint(prev) };
    return cmd;
  });
}

export function closePaths(content) {
  const result = [];
  let lastMove = null;
  let lastPoint = null;
  for (const segment of content) {
    const point = helpers.segmentToPoint(segment);
    if (segment.command === 'close-path') {
      if (!lastPoint || gpt.distance(lastPoint, lastMove) < 0.01) {
        lastPoint = point;
        continue;
      }
      result.push(helpers.makeLineTo(lastMove));
      lastPoint = lastMove;
    } else {
      result.push(segment);
      if (segment.command === 'move-to') lastMove = point;
      lastPoint = point;
    }
  }
  return result;
}

function splitCommand(cmd, values) {
  switch (cmd.command) {
    case 'line-to': return helpers.splitLineToRanges(cmd.prev, cmd, values);
    case 'curve-to': return helpers.splitCurveToRanges(cmd.prev, cmd, values);
    default: return [cmd];
  }
}

function splitTs(seg1, seg2) {
  const cmd1 = seg1.command;
  const cmd2 = seg2.command;
  if (cmd1 === 'line-to' && cmd2 === 'line-to') {
    return helpers.lineLineIntersect(helpers.commandToLine(seg1), helpers.commandToLine(seg2));
  }
  if (cmd1 === 'line-to' && cmd2 === 'curve-to') {
    return helpers.lineCurveIntersect(helpers.commandToLine(seg1), helpers.commandToBezier(seg2));
  }
  if (cmd1 === 'curve-to' && cmd2 === 'line-to') {
    const [seg2p, seg1p] = helpers.lineCurveIntersect(helpers.commandToLine(seg2), helpers.commandToBezier(seg1));
    return [seg1p, seg2p];
  }
  if (cmd1 === 'curve-to' && cmd2 === 'curve-to') {
    return helpers.curveCurveIntersect(helpers.commandToBezier(seg1), helpers.commandToBezier(seg2));
  }
  return [[], []];
}

export function contentIntersectSplit(contentA, contentB, srA, srB) {
  const commandToSelrectMemo = (() => {
    const cache = new Map();
    return (seg) => {
      const key = JSON.stringify(seg);
      if (!cache.has(key)) cache.set(key, helpers.commandToSelrect(seg));
      return cache.get(key);
    };
  })();

  function overlapSegmentSelrectQ(seg, selrect) {
    if (seg.command === 'move-to') return false;
    return grc.overlapsRects(commandToSelrectMemo(seg), selrect);
  }

  function overlapSegmentsQ(seg1, seg2) {
    if (seg1.command === 'move-to' || seg2.command === 'move-to') return false;
    return grc.overlapsRects(commandToSelrectMemo(seg1), commandToSelrectMemo(seg2));
  }

  function split(seg1, seg2) {
    if (!overlapSegmentsQ(seg1, seg2)) return [seg1];
    const [tsSeg1] = splitTs(seg1, seg2);
    return splitCommand(seg1, tsSeg1).map(s => ({ ...s, prev: seg1.prev }));
  }

  function splitSegmentOnContent(seg, content, contentSr) {
    if (!overlapSegmentSelrectQ(seg, contentSr)) return [seg];
    return content
      .filter(s => overlapSegmentsQ(seg, s))
      .reduce((result, current) => result.flatMap(s => split(s, current)), [seg]);
  }

  function splitContent(contentA, contentB, srB) {
    return contentA.flatMap(s => splitSegmentOnContent(s, contentB, srB));
  }

  return [splitContent(contentA, contentB, srB), splitContent(contentB, contentA, srA)];
}

export function isSegmentQ(cmd) {
  return cmd.prev && (cmd.command === 'line-to' || cmd.command === 'curve-to');
}

export function containsSegmentQ(seg, content, contentSr, contentGeom) {
  let point;
  if (seg.command === 'line-to') {
    point = helpers.lineValues(helpers.commandToLine(seg), 0.5);
  } else if (seg.command === 'curve-to') {
    point = helpers.curveValues(helpers.commandToBezier(seg), 0.5);
  } else {
    return false;
  }
  return grc.containsPoint(contentSr, point) &&
    (helpers.isPointInGeomDataQ(point, contentGeom) || helpers.isPointInBorderQ(point, content));
}

export function insideSegmentQ(seg, contentSr, contentGeom) {
  let point;
  if (seg.command === 'line-to') {
    point = helpers.lineValues(helpers.commandToLine(seg), 0.5);
  } else if (seg.command === 'curve-to') {
    point = helpers.curveValues(helpers.commandToBezier(seg), 0.5);
  } else {
    return false;
  }
  return grc.containsPoint(contentSr, point) && helpers.isPointInGeomDataQ(point, contentGeom);
}

export function overlapSegmentQ(seg, content) {
  function overlapSingle(other) {
    if (seg.command !== other.command || (seg.command !== 'line-to' && seg.command !== 'curve-to')) return null;
    if (seg.command === 'line-to') {
      const [p1, q1] = helpers.commandToLine(seg);
      const [p2, q2] = helpers.commandToLine(other);
      if ((gpt.distance(p1, p2) < 0.1 && gpt.distance(q1, q2) < 0.1) ||
          (gpt.distance(p1, q2) < 0.1 && gpt.distance(q1, p2) < 0.1)) {
        return [seg, other];
      }
    } else if (seg.command === 'curve-to') {
      const [p1, q1, h11, h21] = helpers.commandToBezier(seg);
      const [p2, q2, h12, h22] = helpers.commandToBezier(other);
      if ((gpt.distance(p1, p2) < 0.1 && gpt.distance(q1, q2) < 0.1 && gpt.distance(h11, h12) < 0.1 && gpt.distance(h21, h22) < 0.1) ||
          (gpt.distance(p1, q2) < 0.1 && gpt.distance(q1, p2) < 0.1 && gpt.distance(h11, h22) < 0.1 && gpt.distance(h21, h12) < 0.1)) {
        return [seg, other];
      }
    }
    return null;
  }
  return d.seek(overlapSingle, content) != null;
}

export function fixMoveTo(content) {
  const result = [];
  let prev = null;
  for (const current of content) {
    if (current.prev !== prev && current.prev) {
      result.push(helpers.makeMoveTo(current.prev));
    }
    const { prev: _p, ...rest } = current;
    result.push(rest);
    prev = helpers.segmentToPoint(current);
  }
  return result;
}

export function removeDuplicatedSegments(content) {
  const segments = new Set();
  const result = [];
  for (const current of content) {
    const fx = current.prev?.x;
    const fy = current.prev?.y;
    const tx = current.params?.x;
    const ty = current.params?.y;
    const key1 = `${fx},${fy},${tx},${ty}`;
    const key2 = `${tx},${ty},${fx},${fy}`;
    if (!segments.has(key1) && !segments.has(key2)) {
      result.push(current);
    }
    segments.add(key1);
  }
  return result;
}

function closeContent(content) {
  return subpath.getSubpaths(subpath.closeSubpaths(content)).flatMap(s => s.data);
}

function contentToGeomData(content) {
  return closeContent(content)
    .filter(seg => seg.command === 'line-to' || seg.command === 'curve-to')
    .map(seg => ({
      command: seg.command,
      segment: seg,
      geom: seg.command === 'line-to' ? helpers.commandToLine(seg) : helpers.commandToBezier(seg),
      selrect: helpers.commandToSelrect(seg),
    }));
}

function createUnion(contentA, contentASplit, contentB, contentBSplit, srA, srB) {
  const contentAGeom = contentToGeomData(contentA);
  const contentBGeom = contentToGeomData(contentB);
  const content = [
    ...contentASplit.filter(s => !containsSegmentQ(s, contentB, srB, contentBGeom)),
    ...contentBSplit.filter(s => !containsSegmentQ(s, contentA, srA, contentAGeom)),
  ];
  const contentGeom = contentToGeomData(content);
  const contentSr = segment.contentToSelrect(fixMoveTo(content));
  const borderContent = contentBSplit.filter(s =>
    containsSegmentQ(s, contentA, srA, contentAGeom) &&
    overlapSegmentQ(s, contentASplit) &&
    !insideSegmentQ(s, contentSr, contentGeom));
  return [...content, ...borderContent];
}

function createDifference(contentA, contentASplit, contentB, contentBSplit, srA, srB) {
  const contentAGeom = contentToGeomData(contentA);
  const contentBGeom = contentToGeomData(contentB);
  return [
    ...contentASplit.filter(s => !containsSegmentQ(s, contentB, srB, contentBGeom)),
    ...contentBSplit.filter(s => containsSegmentQ(s, contentA, srA, contentAGeom) && !overlapSegmentQ(s, contentASplit)),
  ];
}

function createIntersection(contentA, contentASplit, contentB, contentBSplit, srA, srB) {
  const contentAGeom = contentToGeomData(contentA);
  const contentBGeom = contentToGeomData(contentB);
  return [
    ...contentASplit.filter(s => containsSegmentQ(s, contentB, srB, contentBGeom)),
    ...contentBSplit.filter(s => containsSegmentQ(s, contentA, srA, contentAGeom)),
  ];
}

function createExclusion(contentA, contentB) {
  return [...contentA, ...contentB];
}

export function contentBoolPair(boolType, contentA, contentB) {
  const shouldReverse = boolType !== 'union' && subpath.clockwiseQ(contentB) === subpath.clockwiseQ(contentA);

  const cA = addPrevious(closePaths(contentA));
  let cB = closePaths(contentB);
  if (shouldReverse) cB = subpath.reverseContent(cB);
  cB = addPrevious(cB);

  const srA = segment.contentToSelrect(cA);
  const srB = segment.contentToSelrect(cB);

  const [contentASplit, contentBSplit] = contentIntersectSplit(cA, cB, srA, srB);
  const aSplit = addPrevious(contentASplit).filter(isSegmentQ);
  const bSplit = addPrevious(contentBSplit).filter(isSegmentQ);

  let content;
  switch (boolType) {
    case 'union': content = createUnion(cA, aSplit, cB, bSplit, srA, srB); break;
    case 'difference': content = createDifference(cA, aSplit, cB, bSplit, srA, srB); break;
    case 'intersection': content = createIntersection(cA, aSplit, cB, bSplit, srA, srB); break;
    case 'exclude': content = createExclusion(aSplit, bSplit); break;
    default: content = aSplit;
  }

  return subpath.closeSubpaths(removeDuplicatedSegments(fixMoveTo(content)));
}

export function calculateContent(boolType, contents) {
  if (!contents || contents.length === 0) return [];
  return contents.reduce((a, b) => contentBoolPair(boolType, a, b));
}