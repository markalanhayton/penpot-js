// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

export function splitPath(pathStr, separator = "/") {
  return pathStr
    .split(separator)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function joinPath(path, separator = "/", withSpaces = true) {
  if (withSpaces) {
    return path.join(` ${separator} `);
  }
  return path.join(separator);
}

export function splitGroupName(
  pathStr,
  separator = "/",
  withSpaces = true
) {
  const path = splitPath(pathStr, separator);
  const groupStr = joinPath(path.slice(0, -1), separator, withSpaces);
  const name = path[path.length - 1] || "";
  return [groupStr, name];
}

export function joinPathWithDot(pathVec) {
  return pathVec.join("\u00A0\u2022\u00A0");
}

export function cleanPath(path) {
  return joinPath(splitPath(path));
}

export function mergePathItem(path, name) {
  if (path && path.length > 0) {
    if (name && name.length > 0) {
      return `${path} / ${name}`;
    }
    return path;
  }
  return name;
}

export function mergePathItemWithDot(path, name) {
  if (path && path.length > 0) {
    if (name && name.length > 0) {
      return `${path}\u00A0\u2022\u00A0${name}`;
    }
    return path;
  }
  return name;
}

export function compactPath(path, maxLength, dot = false) {
  const pathSplit = splitPath(path);
  const lastItem = pathSplit[pathSplit.length - 1];
  const mergeFn = dot ? mergePathItemWithDot : mergePathItem;

  let otherPath = "";
  const otherItems = pathSplit.slice(0, -1);

  for (let i = 0; i < otherItems.length; i++) {
    const item = otherItems[i];
    const fullPath = mergeFn(mergePathItem(otherPath, item), lastItem);
    if (fullPath.length > maxLength) {
      return [mergePathItem(otherPath, "..."), lastItem, true];
    }
    otherPath = mergePathItem(otherPath, item);
  }

  return [otherPath, lastItem, false];
}

export function butlastPath(path) {
  const split = splitPath(path);
  if (split.length === 1) {
    return "";
  }
  return joinPath(split.slice(0, -1));
}

export function butlastPathWithDots(path) {
  const split = splitPath(path);
  if (split.length === 1) {
    return "";
  }
  return joinPathWithDot(split.slice(0, -1));
}

export function lastPath(path) {
  const split = splitPath(path);
  return split[split.length - 1];
}

export function insidePath(child, parent) {
  const childPath = splitPath(child);
  const parentPath = splitPath(parent);
  return (
    parentPath.length <= childPath.length &&
    parentPath.every((segment, i) => segment === childPath[i])
  );
}

export function splitByLastPeriod(s) {
  const lastPeriod = s.lastIndexOf(".");
  if (lastPeriod >= 0) {
    return [s.slice(0, lastPeriod + 1), s.slice(lastPeriod + 1)];
  }
  return [s, ""];
}

function sortByChildren(segments, separator) {
  return [...segments].sort((a, b) => {
    const aLen = splitPath(a.name, separator).length;
    const bLen = splitPath(b.name, separator).length;
    if (aLen === 1) return 1;
    if (bLen === 1) return -1;
    return 0;
  });
}

function groupByFirstSegment(segments, separator) {
  const groups = new Map();
  for (const segment of segments) {
    const parts = splitPath(segment.name, separator);
    const first = parts[0];
    const rest = parts.slice(1);
    if (!groups.has(first)) {
      groups.set(first, []);
    }
    if (rest.length > 0) {
      groups.get(first).push({ ...segment, name: rest.join(separator) });
    } else {
      groups.get(first).push(segment);
    }
  }
  return groups;
}

function sortAndGroupSegments(segments, separator) {
  const sorted = sortByChildren(segments, separator);
  return groupByFirstSegment(sorted, separator);
}

function buildTreeNode(segmentName, remainingSegments, separator, parentPath, depth) {
  const currentPath = parentPath
    ? `${parentPath}.${segmentName}`
    : segmentName;

  const isLeaf =
    remainingSegments.length > 0 &&
    remainingSegments.every((segment) => {
      const remainingName = splitPath(segment.name, separator)[0];
      return remainingName === segmentName;
    });

  const leafSegment = isLeaf ? remainingSegments[0] : null;
  const children = isLeaf
    ? null
    : Array.from(
        sortAndGroupSegments(remainingSegments, separator).entries()
      ).map(([childName, childSegments]) =>
        buildTreeNode(
          childName,
          childSegments,
          separator,
          currentPath,
          depth + 1
        )
      );

  return {
    name: segmentName,
    path: currentPath,
    depth,
    leaf: leafSegment,
    children,
  };
}

export function buildTreeRoot(segments, separator) {
  const grouped = sortAndGroupSegments(segments, separator);
  return Array.from(grouped.entries()).map(([segmentName, remainingSegments]) =>
    buildTreeNode(segmentName, remainingSegments, separator, null, 0)
  );
}