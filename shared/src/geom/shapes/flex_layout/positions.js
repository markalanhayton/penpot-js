import * as gpt from '../../point.js';
import * as gpo from '../points.js';
import * as ctl from '../../../types/shape/layout.js';

export function getBaseLine(parent, layoutBounds, totalWidth, totalHeight, numLines) {
  const layoutWidth = gpo.widthPoints(layoutBounds);
  const layoutHeight = gpo.heightPoints(layoutBounds);
  const row = ctl.rowQ(parent);
  const col = ctl.colQ(parent);

  const wrap = ctl.wrapQ(parent);
  const end = (wrap && ctl.contentEndQ(parent)) || (!wrap && ctl.alignItemsEndQ(parent));
  const center = (wrap && ctl.contentCenterQ(parent)) || (!wrap && ctl.alignItemsCenterQ(parent));
  const around = wrap && ctl.contentAroundQ(parent);
  const evenly = wrap && ctl.contentEvenlyQ(parent);

  const [layoutGapRow, layoutGapCol] = ctl.gaps(parent);
  const linesGapRow = (numLines - 1) * layoutGapRow;
  const linesGapCol = (numLines - 1) * layoutGapCol;

  const freeWidthGap = layoutWidth - totalWidth - linesGapCol;
  const freeHeightGap = layoutHeight - totalHeight - linesGapRow;
  const freeWidth = layoutWidth - totalWidth;
  const freeHeight = layoutHeight - totalHeight;

  let result = gpo.origin(layoutBounds);

  if (row) {
    if (center) result = gpt.add(result, gpo.startVv(layoutBounds, freeHeightGap / 2));
    if (end) result = gpt.add(result, gpo.startVv(layoutBounds, freeHeightGap));
    if (around) result = gpt.add(result, gpo.startVv(layoutBounds, Math.max(linesGapRow, freeHeight / numLines / 2)));
    if (evenly) result = gpt.add(result, gpo.startVv(layoutBounds, Math.max(linesGapRow, freeHeight / (numLines + 1))));
  }

  if (col) {
    if (center) result = gpt.add(result, gpo.startHv(layoutBounds, freeWidthGap / 2));
    if (end) result = gpt.add(result, gpo.startHv(layoutBounds, freeWidthGap));
    if (around) result = gpt.add(result, gpo.startHv(layoutBounds, Math.max(linesGapCol, freeWidth / numLines / 2)));
    if (evenly) result = gpt.add(result, gpo.startHv(layoutBounds, Math.max(linesGapCol, freeWidth / (numLines + 1))));
  }

  return result;
}

export function getNextLine(parent, layoutBounds, line, baseP, totalWidth, totalHeight, numLines) {
  const { lineWidth, lineHeight } = line;
  const layoutWidth = gpo.widthPoints(layoutBounds);
  const layoutHeight = gpo.heightPoints(layoutBounds);
  const row = ctl.rowQ(parent);
  const col = ctl.colQ(parent);

  const autoWidth = ctl.autoWidthQ(parent);
  const autoHeight = ctl.autoHeightQ(parent);

  const [layoutGapRow, layoutGapCol] = ctl.gaps(parent);

  const stretch = ctl.contentStretchQ(parent);
  const between = ctl.contentBetweenQ(parent);
  const around = ctl.contentAroundQ(parent);
  const evenly = ctl.contentEvenlyQ(parent);

  const freeWidth = layoutWidth - totalWidth;
  const freeHeight = layoutHeight - totalHeight;

  const lineGapCol = (() => {
    if (autoWidth) return layoutGapCol;
    if (stretch) return freeWidth / numLines;
    if (between) return freeWidth / (numLines - 1);
    if (around) return freeWidth / numLines;
    if (evenly) return freeWidth / (numLines + 1);
    return layoutGapCol;
  })();

  const lineGapRow = (() => {
    if (autoHeight) return layoutGapRow;
    if (stretch) return freeHeight / numLines;
    if (between) return freeHeight / (numLines - 1);
    if (around) return freeHeight / numLines;
    if (evenly) return freeHeight / (numLines + 1);
    return layoutGapRow;
  })();

  let result = baseP;

  if (row) result = gpt.add(result, gpo.startVv(layoutBounds, lineHeight + Math.max(layoutGapRow, lineGapRow)));
  if (col) result = gpt.add(result, gpo.startHv(layoutBounds, lineWidth + Math.max(layoutGapCol, lineGapCol)));

  return result;
}

export function getStartLine(parent, layoutBounds, line, baseP, totalWidth, totalHeight, numLines) {
  const { lineWidth, lineHeight, numChildren } = line;
  const layoutWidth = gpo.widthPoints(layoutBounds);
  const layoutHeight = gpo.heightPoints(layoutBounds);
  const [layoutGapRow, layoutGapCol] = ctl.gaps(parent);
  const row = ctl.rowQ(parent);
  const col = ctl.colQ(parent);
  const spaceBetween = ctl.spaceBetweenQ(parent);
  const spaceAround = ctl.spaceAroundQ(parent);
  const spaceEvenly = ctl.spaceEvenlyQ(parent);
  const hCenter = ctl.hCenterQ(parent);
  const hEnd = ctl.hEndQ(parent);
  const vCenter = ctl.vCenterQ(parent);
  const vEnd = ctl.vEndQ(parent);
  const contentStretch = ctl.contentStretchQ(parent);
  const autoWidth = ctl.autoWidthQ(parent);
  const autoHeight = ctl.autoHeightQ(parent);

  const childrenGapWidth = layoutGapCol * (numChildren - 1);
  const childrenGapHeight = layoutGapRow * (numChildren - 1);

  let adjustedLineHeight = lineHeight;
  let adjustedLineWidth = lineWidth;

  if (row && contentStretch && !autoHeight) {
    adjustedLineHeight = lineHeight + (layoutHeight - totalHeight) / numLines;
  }
  if (col && contentStretch && !autoWidth) {
    adjustedLineWidth = lineWidth + (layoutWidth - totalWidth) / numLines;
  }

  let startP = baseP;

  if (row && hCenter && !spaceAround && !spaceEvenly && !spaceBetween) {
    startP = gpt.add(startP, gpo.startHv(layoutBounds, layoutWidth / 2));
    startP = gpt.subtract(startP, gpo.startHv(layoutBounds, (adjustedLineWidth + childrenGapWidth) / 2));
  }
  if (row && hEnd && !spaceAround && !spaceEvenly && !spaceBetween) {
    startP = gpt.add(startP, gpo.startHv(layoutBounds, layoutWidth));
    startP = gpt.subtract(startP, gpo.startHv(layoutBounds, adjustedLineWidth + childrenGapWidth));
  }

  if (col && vCenter && !spaceAround && !spaceEvenly && !spaceBetween) {
    startP = gpt.add(startP, gpo.startVv(layoutBounds, layoutHeight / 2));
    startP = gpt.subtract(startP, gpo.startVv(layoutBounds, (adjustedLineHeight + childrenGapHeight) / 2));
  }
  if (col && vEnd && !spaceAround && !spaceEvenly && !spaceBetween) {
    startP = gpt.add(startP, gpo.startVv(layoutBounds, layoutHeight));
    startP = gpt.subtract(startP, gpo.startVv(layoutBounds, adjustedLineHeight + childrenGapHeight));
  }

  return startP;
}

export function getChildPosition(parent, child, childWidth, childHeight, layoutData) {
  const { startP, layoutGapRow, layoutGapCol, marginX, marginY, lineHeight, lineWidth, layoutBounds } = layoutData;

  const row = ctl.rowQ(parent);
  const col = ctl.colQ(parent);

  let hStart = ctl.hStartQ(parent);
  let hCenter = ctl.hCenterQ(parent);
  let hEnd = ctl.hEndQ(parent);
  let vStart = ctl.vStartQ(parent);
  let vCenter = ctl.vCenterQ(parent);
  let vEnd = ctl.vEndQ(parent);

  const alignSelfStart = ctl.alignSelfStartQ(child);
  const alignSelfEnd = ctl.alignSelfEndQ(child);
  const alignSelfCenter = ctl.alignSelfCenterQ(child);
  const alignSelf = alignSelfStart || alignSelfEnd || alignSelfCenter;

  if (col || !alignSelf) {
    // keep vStart/vCenter/vEnd as-is
  } else {
    if (alignSelfStart) { vStart = true; vCenter = false; vEnd = false; }
    else if (alignSelfCenter) { vStart = false; vCenter = true; vEnd = false; }
    else if (alignSelfEnd) { vStart = false; vCenter = false; vEnd = true; }
  }

  if (row || !alignSelf) {
    // keep hStart/hCenter/hEnd as-is
  } else {
    if (alignSelfStart) { hStart = true; hCenter = false; hEnd = false; }
    else if (alignSelfCenter) { hStart = false; hCenter = true; hEnd = false; }
    else if (alignSelfEnd) { hStart = false; hCenter = false; hEnd = true; }
  }

  const [marginTop, marginRight, marginBottom, marginLeft] = ctl.childMargins(child);

  let cornerP = startP;

  if (col) {
    if (marginTop != null) cornerP = gpt.add(cornerP, gpo.startVv(layoutBounds, marginTop));
    if (hCenter) cornerP = gpt.add(cornerP, gpo.startHv(layoutBounds, -(childWidth / 2)));
    if (hEnd) cornerP = gpt.add(cornerP, gpo.startHv(layoutBounds, -childWidth));
    if (hStart) cornerP = gpt.add(cornerP, gpo.startHv(layoutBounds, marginLeft));
    if (hCenter) cornerP = gpt.add(cornerP, gpo.startHv(layoutBounds, lineWidth / 2 + (marginLeft - marginRight) / 2));
    if (hEnd) cornerP = gpt.add(cornerP, gpo.startHv(layoutBounds, lineWidth - marginRight));
  }

  if (row) {
    if (vCenter) cornerP = gpt.add(cornerP, gpo.startVv(layoutBounds, -(childHeight / 2)));
    if (vEnd) cornerP = gpt.add(cornerP, gpo.startVv(layoutBounds, -childHeight));
    if (marginLeft != null) cornerP = gpt.add(cornerP, gpo.startHv(layoutBounds, marginLeft));
    if (vStart) cornerP = gpt.add(cornerP, gpo.startVv(layoutBounds, marginTop));
    if (vCenter) cornerP = gpt.add(cornerP, gpo.startVv(layoutBounds, lineHeight / 2 + (marginTop - marginBottom) / 2));
    if (vEnd) cornerP = gpt.add(cornerP, gpo.startVv(layoutBounds, lineHeight - marginBottom));
  }

  if (marginX != null) cornerP = gpt.add(cornerP, gpo.startHv(layoutBounds, marginX));
  if (marginY != null) cornerP = gpt.add(cornerP, gpo.startVv(layoutBounds, marginY));

  let nextP = startP;

  if (row) {
    nextP = gpt.add(nextP, gpo.startHv(layoutBounds, childWidth + layoutGapCol));
    nextP = gpt.add(nextP, gpo.startHv(layoutBounds, marginLeft + marginRight));
  }

  if (col) {
    nextP = gpt.add(nextP, gpo.startVv(layoutBounds, marginTop + marginBottom));
    nextP = gpt.add(nextP, gpo.startVv(layoutBounds, childHeight + layoutGapRow));
  }

  if (marginX != null) nextP = gpt.add(nextP, gpo.startHv(layoutBounds, marginX));
  if (marginY != null) nextP = gpt.add(nextP, gpo.startVv(layoutBounds, marginY));

  const newLayoutData = { ...layoutData, startP: nextP };

  return [cornerP, newLayoutData];
}