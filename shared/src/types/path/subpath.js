import * as gpt from '../../geom/point.js';
import * as helpers from './helpers.js';

export function ptEq(p1, p2) {
  return gpt.distance(p1, p2) < 0.1;
}

export function makeSubpath(commandOrFrom, to, data) {
  if (to === undefined) {
    const p = helpers.segmentToPoint(commandOrFrom);
    return { from: p, to: p, data: [commandOrFrom] };
  }
  return { from: commandOrFrom, to, data };
}

export function addSubpathCommand(subpath, command) {
  const cmd = command.command === 'close-path'
    ? helpers.makeLineTo(subpath.from)
    : command;
  const p = helpers.segmentToPoint(cmd);
  return { ...subpath, to: p, data: [...subpath.data, cmd] };
}

export function reverseCommand(command, prev) {
  const { x, y } = prev.params;
  const { c1x, c1y, c2x, c2y } = command.params;
  const newParams = { ...command.params, x, y };
  if (command.command === 'curve-to') {
    newParams.c1x = c2x;
    newParams.c1y = c2y;
    newParams.c2x = c1x;
    newParams.c2y = c1y;
  }
  return { ...command, params: newParams };
}

export function reverseSubpath(subpath) {
  function reverseCommands(result, [command, prev]) {
    if (prev) result.push(reverseCommand(command, prev));
    return result;
  }
  const withPrevData = withPrev([...subpath.data].reverse());
  const newCmds = withPrevData.reduce(reverseCommands, [helpers.makeMoveTo(subpath.to)]);
  return makeSubpath(subpath.to, subpath.from, newCmds);
}

export function getSubpaths(content) {
  return content.reduce((subpaths, current) => {
    const isMove = current.command === 'move-to';
    const lastIdx = subpaths.length - 1;
    if (isMove) {
      return [...subpaths, makeSubpath(current)];
    }
    if (lastIdx >= 0) {
      const updated = [...subpaths];
      updated[lastIdx] = addSubpathCommand(updated[lastIdx], current);
      return updated;
    }
    return subpaths;
  }, []);
}

export function subpathsJoin(subpath, other) {
  return {
    ...subpath,
    data: [...subpath.data, ...other.data.slice(1)],
    to: other.to,
  };
}

function mergePaths(candidate, subpaths) {
  let result = [];
  for (const current of subpaths) {
    if (ptEq(current.to, current.from)) {
      result.push(current);
      continue;
    }
    if (ptEq(candidate.to, current.from)) {
      candidate = subpathsJoin(candidate, current);
      continue;
    }
    if (ptEq(candidate.from, current.to)) {
      candidate = subpathsJoin(current, candidate);
      continue;
    }
    if (ptEq(candidate.to, current.to)) {
      candidate = subpathsJoin(candidate, reverseSubpath(current));
      continue;
    }
    if (ptEq(candidate.from, current.from)) {
      candidate = subpathsJoin(reverseSubpath(current), candidate);
      continue;
    }
    result.push(current);
  }
  return [candidate, result];
}

export function isClosedQ(subpath) {
  return ptEq(subpath.from, subpath.to);
}

function joinAdjacent(acc, subpath) {
  const prev = acc.length > 0 ? acc[acc.length - 1] : null;
  if (prev && !isClosedQ(prev) && !isClosedQ(subpath) && ptEq(prev.to, subpath.from)) {
    const joined = subpathsJoin(prev, subpath);
    return [...acc.slice(0, -1), joined];
  }
  return [...acc, subpath];
}

export function mergeTouchingSubpaths(content) {
  const subpaths = getSubpaths(content);
  const merged = subpaths.reduce(joinAdjacent, []);
  return merged.flatMap(s => s.data);
}

export function closeSubpaths(content) {
  const subpaths = getSubpaths(content);
  const closedSubpaths = [];
  let current = subpaths[0] || null;
  let remaining = subpaths.slice(1);

  while (current) {
    let [newCurrent, newSubpaths] = isClosedQ(current)
      ? [current, remaining]
      : mergePaths(current, remaining);

    if (current === newCurrent) {
      closedSubpaths.push(newCurrent);
      current = newSubpaths[0] || null;
      remaining = newSubpaths.slice(1);
    } else {
      current = newCurrent;
      remaining = newSubpaths;
    }
  }

  return closedSubpaths.flatMap(s => s.data);
}

export function reverseContent(content) {
  return getSubpaths(content)
    .map(reverseSubpath)
    .reverse()
    .flatMap(s => s.data);
}

export function clockwiseQ(content) {
  const subpath = getSubpaths(content)[0]?.data;
  if (!subpath) return false;
  let signedArea = 0;
  let firstPoint = null;
  for (let i = 0; i < subpath.length; i++) {
    const p = helpers.segmentToPoint(subpath[i]);
    if (!firstPoint) firstPoint = p;
    const nextP = i < subpath.length - 1
      ? helpers.segmentToPoint(subpath[i + 1])
      : firstPoint;
    signedArea += (p.x * nextP.y) - (nextP.x * p.y);
  }
  return signedArea > 0;
}

function withPrev(coll) {
  return coll.map((item, i) => [item, i > 0 ? coll[i - 1] : null]);
}