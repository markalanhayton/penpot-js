import * as d from '../../../data.js';
import * as mth from '../../../math.js';
import * as gpo from '../points.js';
import * as ctl from '../../../types/shape/layout.js';
import * as flp from './positions.js';

let childMinWidthFn = null;
let childMinHeightFn = null;

export function setChildMinWidthFn(fn) { childMinWidthFn = fn; }
export function setChildMinHeightFn(fn) { childMinHeightFn = fn; }

function childMinWidth(child, childBounds, bounds, objects) {
  return childMinWidthFn(child, childBounds, bounds, objects);
}

function childMinHeight(child, childBounds, bounds, objects) {
  return childMinHeightFn(child, childBounds, bounds, objects);
}

function conjv(arr, item) {
  return arr ? [...arr, item] : [item];
}

export function layoutBounds(parent, shapeBounds) {
  const [padTop, padRight, padBottom, padLeft] = ctl.paddings(parent);
  return gpo.padPoints(shapeBounds, -padTop, -padRight, -padBottom, -padLeft);
}

export function initLayoutLines(shape, children, layoutBounds, bounds, objects, autoQ) {
  const col = ctl.colQ(shape);
  const row = ctl.rowQ(shape);
  const spaceAround = ctl.spaceAroundQ(shape);
  const spaceEvenly = ctl.spaceEvenlyQ(shape);

  const autoWidth = ctl.autoWidthQ(shape) || autoQ;
  const autoHeight = ctl.autoHeightQ(shape) || autoQ;

  const wrap = ctl.wrapQ(shape) && (col || !autoWidth) && (row || !autoHeight);
  const [layoutGapRow, layoutGapCol] = ctl.gaps(shape);
  const layoutWidth = gpo.widthPoints(layoutBounds);
  const layoutHeight = gpo.heightPoints(layoutBounds);

  function loop(lineData, result, children) {
    if (!children || children.length === 0) {
      const finalResult = lineData ? [...result, lineData] : result;
      return finalResult;
    }

    const [childBounds, child] = children[0];
    const {
      lineMinWidth = 0, lineMinHeight = 0,
      lineMaxWidth = 0, lineMaxHeight = 0,
      numChildren = 0, childrenData = []
    } = lineData || {};

    const childWidth = gpo.widthPoints(childBounds);
    const childHeight = gpo.heightPoints(childBounds);
    const childMaxWidth = ctl.childMaxWidth(child);
    const childMaxHeight = ctl.childMaxHeight(child);
    const childMarginWidth = ctl.childWidthMargin(child);
    const childMarginHeight = ctl.childHeightMargin(child);

    const fillWidth = ctl.fillWidthQ(child);
    const fillHeight = ctl.fillHeightQ(child);

    const childData = {
      id: child.id,
      childMinWidth: childMinWidth(child, childBounds, bounds, objects),
      childMinHeight: childMinHeight(child, childBounds, bounds, objects),
      childMaxWidth: fillWidth ? childMaxWidth : childWidth,
      childMaxHeight: fillHeight ? childMaxHeight : childHeight,
    };

    const nextMinWidth = childMarginWidth + childData.childMinWidth;
    const nextMinHeight = childMarginHeight + childData.childMinHeight;
    const nextMaxWidth = childMarginWidth + childData.childMaxWidth;
    const nextMaxHeight = childMarginHeight + childData.childMaxHeight;

    const totalGapCol = spaceEvenly
      ? layoutGapCol * (numChildren + 2)
      : spaceAround
        ? layoutGapCol * (numChildren + 1)
        : layoutGapCol * numChildren;

    const totalGapRow = spaceEvenly
      ? layoutGapRow * (numChildren + 2)
      : spaceAround
        ? layoutGapRow * (numChildren + 1)
        : layoutGapRow * numChildren;

    const nextLineMinWidth = lineMinWidth + nextMinWidth + totalGapCol;
    const nextLineMinHeight = lineMinHeight + nextMinHeight + totalGapRow;

    if (lineData && (
      !wrap ||
      (row && (nextLineMinWidth < layoutWidth || mth.close(nextLineMinWidth, layoutWidth, 0.5))) ||
      (col && (nextLineMinHeight < layoutHeight || mth.close(nextLineMinHeight, layoutHeight, 0.5)))
    )) {
      const newLineData = {
        lineMinWidth: row ? lineMinWidth + nextMinWidth : Math.max(lineMinWidth, nextMinWidth),
        lineMaxWidth: row ? lineMaxWidth + nextMaxWidth : Math.max(lineMaxWidth, nextMaxWidth),
        lineMinHeight: col ? lineMinHeight + nextMinHeight : Math.max(lineMinHeight, nextMinHeight),
        lineMaxHeight: col ? lineMaxHeight + nextMaxHeight : Math.max(lineMaxHeight, nextMaxHeight),
        numChildren: numChildren + 1,
        childrenData: conjv(childrenData, childData),
      };
      return loop(newLineData, result, children.slice(1));
    } else {
      const newLineData = {
        lineMinWidth: nextMinWidth,
        lineMinHeight: nextMinHeight,
        lineMaxWidth: nextMaxWidth,
        lineMaxHeight: nextMaxHeight,
        numChildren: 1,
        childrenData: [childData],
      };
      const newResult = lineData ? [...result, lineData] : result;
      return loop(newLineData, newResult, children.slice(1));
    }
  }

  return loop(null, [], children);
}

function addSpaceToItems(prop, propMin, propMax, toShare, items) {
  const numItems = items.filter(it => !mth.close(it[prop], it[propMax])).length;
  const perLineTarget = toShare / numItems;

  let remainder = toShare;
  const result = [];

  for (const current of items) {
    const curVal = current[prop] ?? current[propMin] ?? 0;
    const maxVal = current[propMax];
    const curInc = (curVal + perLineTarget > maxVal) ? (maxVal - curVal) : perLineTarget;
    result.push({ ...current, [prop]: curVal + curInc });
    remainder -= curInc;
  }

  return [result, remainder];
}

function distributeSpace(prop, propMin, propMax, minValue, boundValue, items) {
  let toShare = boundValue - minValue;
  let currentItems = items;

  while (toShare > 0) {
    const [newItems, remainder] = addSpaceToItems(prop, propMin, propMax, toShare, currentItems);
    if (remainder <= 0 || remainder >= toShare) {
      currentItems = newItems;
      break;
    }
    toShare = remainder;
    currentItems = newItems;
  }

  return currentItems;
}

export function addLinesPositions(parent, layoutBounds, autoQ, layoutLines) {
  const row = ctl.rowQ(parent);
  const col = ctl.colQ(parent);
  const autoWidth = ctl.autoWidthQ(parent) || autoQ;
  const autoHeight = ctl.autoHeightQ(parent) || autoQ;
  const spaceEvenly = ctl.spaceEvenlyQ(parent);
  const spaceAround = ctl.spaceAroundQ(parent);
  const [layoutGapRow, layoutGapCol] = ctl.gaps(parent);
  const layoutWidth = gpo.widthPoints(layoutBounds);
  const layoutHeight = gpo.heightPoints(layoutBounds);

  function addLines([totalWidth, totalHeight], line) {
    return [totalWidth + (line.lineWidth || 0), totalHeight + (line.lineHeight || 0)];
  }

  function addRanges([totalMinWidth, totalMinHeight, totalMaxWidth, totalMaxHeight], line) {
    return [
      totalMinWidth + line.lineMinWidth,
      totalMinHeight + line.lineMinHeight,
      totalMaxWidth + line.lineMaxWidth,
      totalMaxHeight + line.lineMaxHeight,
    ];
  }

  function addStarts(totalWidth, totalHeight, numLines, [result, baseP], layoutLine) {
    const startP = flp.getStartLine(parent, layoutBounds, layoutLine, baseP, totalWidth, totalHeight, numLines);
    const nextP = flp.getNextLine(parent, layoutBounds, layoutLine, baseP, totalWidth, totalHeight, numLines);
    return [[...result, { ...layoutLine, startP }], nextP];
  }

  function getLayoutWidth(line) {
    const numGap = spaceEvenly ? line.numChildren + 1 : spaceAround ? line.numChildren : line.numChildren - 1;
    return layoutWidth - layoutGapCol * numGap;
  }

  function getLayoutHeight(line) {
    const numGap = spaceEvenly ? line.numChildren + 1 : spaceAround ? line.numChildren : line.numChildren - 1;
    return layoutHeight - layoutGapRow * numGap;
  }

  const [totalMinWidth, totalMinHeight, totalMaxWidth, totalMaxHeight] =
    layoutLines.reduce(addRanges, [0, 0, 0, 0]);

  const numLines = layoutLines.length;

  const stretchWidthFix = (col && ctl.contentStretchQ(parent) && !autoWidth)
    ? (layoutWidth - layoutGapCol * (numLines - 1) - totalMaxWidth) / numLines
    : 0;

  const stretchHeightFix = (row && ctl.contentStretchQ(parent) && !autoHeight)
    ? (layoutHeight - layoutGapRow * (numLines - 1) - totalMaxHeight) / numLines
    : 0;

  const restLayoutHeight = layoutHeight - (numLines - 1) * layoutGapRow;
  const restLayoutWidth = layoutWidth - (numLines - 1) * layoutGapCol;

  let adjustedLines = [...layoutLines];

  if (row) {
    adjustedLines = adjustedLines.map(line => ({
      ...line,
      lineWidth: autoWidth ? line.lineMinWidth : Math.max(line.lineMinWidth, Math.min(getLayoutWidth(line), line.lineMaxWidth)),
    }));
  }

  if (col) {
    adjustedLines = adjustedLines.map(line => ({
      ...line,
      lineHeight: autoHeight ? line.lineMinHeight : Math.max(line.lineMinHeight, Math.min(getLayoutHeight(line), line.lineMaxHeight)),
    }));
  }

  if (row && (totalMinHeight >= restLayoutHeight || autoHeight)) {
    adjustedLines = adjustedLines.map(line => ({ ...line, lineHeight: line.lineMinHeight }));
  }

  if (row && totalMaxHeight <= restLayoutHeight && !autoHeight) {
    adjustedLines = adjustedLines.map(line => ({ ...line, lineHeight: line.lineMaxHeight + stretchHeightFix }));
  }

  if (col && (totalMinWidth >= restLayoutWidth || autoWidth)) {
    adjustedLines = adjustedLines.map(line => ({ ...line, lineWidth: line.lineMinWidth }));
  }

  if (col && totalMaxWidth <= restLayoutWidth && !autoWidth) {
    adjustedLines = adjustedLines.map(line => ({ ...line, lineWidth: line.lineMaxWidth + stretchWidthFix }));
  }

  if (row && totalMinHeight < restLayoutHeight && restLayoutHeight < totalMaxHeight && !autoHeight) {
    adjustedLines = distributeSpace('lineHeight', 'lineMinHeight', 'lineMaxHeight', totalMinHeight, restLayoutHeight, adjustedLines);
  }

  if (col && totalMinWidth < restLayoutWidth && restLayoutWidth < totalMaxWidth && !autoWidth) {
    adjustedLines = distributeSpace('lineWidth', 'lineMinWidth', 'lineMaxWidth', totalMinWidth, restLayoutWidth, adjustedLines);
  }

  // Add to-bound-width/height information
  if (row) {
    let restHeight = layoutHeight;
    const newLines = [];
    for (const line of adjustedLines) {
      newLines.push({ ...line, toBoundHeight: restHeight });
      restHeight -= line.lineHeight + layoutGapRow;
    }
    adjustedLines = newLines;
  } else if (col) {
    let restWidth = layoutWidth;
    const newLines = [];
    for (const line of adjustedLines) {
      newLines.push({ ...line, toBoundWidth: restWidth });
      restWidth -= line.lineWidth + layoutGapCol;
    }
    adjustedLines = newLines;
  }

  const [totalWidth, totalHeight] = adjustedLines.reduce(addLines, [0, 0]);
  const baseP = flp.getBaseLine(parent, layoutBounds, totalWidth, totalHeight, numLines);

  const [finalResult] = adjustedLines.reduce(
    (acc, layoutLine) => addStarts(totalWidth, totalHeight, numLines, acc, layoutLine),
    [[], baseP]
  );

  return finalResult;
}

export function addLineSpacing(shape, layoutBounds, autoQ, lineData) {
  const { numChildren, lineWidth, lineHeight } = lineData;
  const width = gpo.widthPoints(layoutBounds);
  const height = gpo.heightPoints(layoutBounds);

  const row = ctl.rowQ(shape);
  const col = ctl.colQ(shape);
  const autoHeight = ctl.autoHeightQ(shape) || autoQ;
  const autoWidth = ctl.autoWidthQ(shape) || autoWidth;
  const spaceBetween = ctl.spaceBetweenQ(shape);
  const spaceEvenly = ctl.spaceEvenlyQ(shape);
  const spaceAround = ctl.spaceAroundQ(shape);
  const [layoutGapRow, layoutGapCol] = ctl.gaps(shape);

  let marginX = 0;
  if (row && spaceEvenly && !autoWidth) marginX = Math.max(layoutGapCol, (width - lineWidth) / (numChildren + 1));
  else if (row && spaceAround && !autoWidth) marginX = Math.max(layoutGapCol, (width - lineWidth) / numChildren) / 2;
  else if (row && (spaceEvenly || spaceAround) && autoWidth) marginX = layoutGapCol;

  let marginY = 0;
  if (col && spaceEvenly && !autoHeight) marginY = Math.max(layoutGapRow, (height - lineHeight) / (numChildren + 1));
  else if (col && spaceAround && !autoHeight) marginY = Math.max(layoutGapRow, (height - lineHeight) / numChildren) / 2;
  else if (col && (spaceEvenly || spaceAround) && autoHeight) marginY = layoutGapRow;

  let adjustedGapCol = layoutGapCol;
  if (row && spaceEvenly) adjustedGapCol = 0;
  else if (row && spaceAround && autoWidth) adjustedGapCol = 0;
  else if (row && spaceAround) adjustedGapCol = Math.max(layoutGapCol, (width - lineWidth) / numChildren) / 2;
  else if (row && spaceBetween && !autoWidth) adjustedGapCol = Math.max(layoutGapCol, (width - lineWidth) / (numChildren - 1));

  let adjustedGapRow = layoutGapRow;
  if (col && spaceEvenly) adjustedGapRow = 0;
  else if (col && spaceAround) adjustedGapRow = Math.max(layoutGapRow, (height - lineHeight) / numChildren) / 2;
  else if (col && spaceBetween && !autoHeight) adjustedGapRow = Math.max(layoutGapRow, (height - lineHeight) / (numChildren - 1));

  return {
    ...lineData,
    layoutBounds,
    layoutGapRow: adjustedGapRow,
    layoutGapCol: adjustedGapCol,
    marginX,
    marginY,
  };
}

export function addChildrenResizes(shape, lineData) {
  const { lineMinWidth, lineWidth, lineMinHeight, lineHeight } = lineData;
  const row = ctl.rowQ(shape);
  const col = ctl.colQ(shape);

  let childrenData = lineData.childrenData;

  if (row) {
    childrenData = childrenData.map(cd => ({ ...cd, childWidth: cd.childMinWidth }));
  }
  if (col) {
    childrenData = childrenData.map(cd => ({ ...cd, childHeight: cd.childMinHeight }));
  }

  if (row) {
    childrenData = distributeSpace('childWidth', 'childMinWidth', 'childMaxWidth', lineMinWidth, lineWidth, childrenData);
  }
  if (col) {
    childrenData = distributeSpace('childHeight', 'childMinHeight', 'childMaxHeight', lineMinHeight, lineHeight, childrenData);
  }

  childrenData = d.indexBy(childrenData, cd => cd.id);

  return { ...lineData, childrenData };
}

export function calcLayoutData(shape, shapeBounds, children, bounds, objects, autoQ) {
  const lb = layoutBounds(shape, shapeBounds);
  const reverse = ctl.reverseQ(shape);
  let sortedChildren = reverse ? [...children].reverse() : children;

  const ignoreChild = ([, child]) => ctl.positionAbsoluteQ(child);
  sortedChildren = sortedChildren.filter(c => !ignoreChild(c));

  const layoutLinesRaw = initLayoutLines(shape, sortedChildren, lb, bounds, objects, autoQ || false);
  const layoutLinesWithPositions = addLinesPositions(shape, lb, autoQ || false, layoutLinesRaw);
  const layoutLines = layoutLinesWithPositions.map(line =>
    addChildrenResizes(shape, addLineSpacing(shape, lb, autoQ || false, line))
  );

  return {
    layoutLines,
    layoutBounds: lb,
    reverse,
  };
}