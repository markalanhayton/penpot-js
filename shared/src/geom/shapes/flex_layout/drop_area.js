import * as d from '../../../data.js';
import * as gmt from '../../matrix.js';
import * as gpt from '../../point.js';
import * as grc from '../../rect.js';
import * as gco from '../common.js';
import * as fld from './layout_data.js';
import * as gpo from '../points.js';
import * as gtr from '../transforms.js';
import * as ctm from '../../../modifiers.js';
import * as ctl from '../../../types/shape/layout.js';
import * as cfh from '../../../files/helpers.js';

function dropChildAreas(frame, parentRect, childBounds, index, reverse, prevX, prevY, last) {
  const col = ctl.colQ(frame);
  const row = ctl.rowQ(frame);
  const [layoutGapRow, layoutGapCol] = ctl.gaps(frame);

  const startP = gpo.origin(childBounds);
  const boxX = startP.x;
  const boxY = startP.y;
  const boxWidth = gpo.widthPoints(childBounds);
  const boxHeight = gpo.heightPoints(childBounds);

  const x = col ? parentRect.x : prevX;
  const y = row ? parentRect.y : prevY;

  let width, height;

  if (row && last) {
    width = (parentRect.x + parentRect.width) - x;
  } else if (col) {
    width = parentRect.width;
  } else {
    width = boxWidth + (boxX - prevX) + layoutGapCol / 2;
  }

  if (col && last) {
    height = (parentRect.y + parentRect.height) - y;
  } else if (row) {
    height = parentRect.height;
  } else {
    height = boxHeight + (boxY - prevY) + layoutGapRow / 2;
  }

  if (row) {
    const halfPointWidth = (boxX - x) + boxWidth / 2;
    return [
      grc.makeRect(x, y, width, height),
      { ...grc.makeRect(x, y, halfPointWidth, height), index: reverse ? index + 1 : index },
      { ...grc.makeRect(x + halfPointWidth, y, width - halfPointWidth, height), index: reverse ? index : index + 1 },
    ];
  } else {
    const halfPointHeight = (boxY - y) + boxHeight / 2;
    return [
      grc.makeRect(x, y, width, height),
      { ...grc.makeRect(x, y, width, halfPointHeight), index: reverse ? index + 1 : index },
      { ...grc.makeRect(x, y + halfPointHeight, width, height - halfPointHeight), index: reverse ? index : index + 1 },
    ];
  }
}

function dropLineArea(frame, lineData, prevX, prevY, last) {
  const col = ctl.colQ(frame);
  const row = ctl.rowQ(frame);
  const hCenter = row && ctl.hCenterQ(frame);
  const hEnd = row && ctl.hEndQ(frame);
  const vCenter = col && ctl.vCenterQ(frame);
  const vEnd = col && ctl.vEndQ(frame);

  const { startP, layoutGapRow, layoutGapCol, numChildren, lineWidth, lineHeight, marginX, marginY } = lineData;
  const { transformInverse } = frame;

  const center = gco.shapeToCenter(frame);
  const transformedStartP = gmt.transformPointCenter(startP, center, transformInverse);

  const effectiveLineWidth = row
    ? frame.width
    : lineWidth + marginX + (row ? layoutGapCol * (numChildren - 1) : 0);

  const effectiveLineHeight = col
    ? frame.height
    : lineHeight + marginY + (col ? layoutGapRow * (numChildren - 1) : 0);

  const boxX = transformedStartP.x - (hCenter ? effectiveLineWidth / 2 : hEnd ? effectiveLineWidth : 0);
  const boxY = transformedStartP.y - (vCenter ? effectiveLineHeight / 2 : vEnd ? effectiveLineHeight : 0);

  const x = row ? frame.x : prevX;
  const y = col ? frame.y : prevY;

  let width, height;

  if (col && last) width = (frame.x + frame.width) - x;
  else if (row) width = frame.width;
  else width = effectiveLineWidth + (boxX - prevX) + layoutGapCol / 2;

  if (row && last) height = (frame.y + frame.height) - y;
  else if (col) height = frame.height;
  else height = effectiveLineHeight + (boxY - prevY) + layoutGapRow / 2;

  return grc.makeRect(x, y, width, height);
}

function getFlipModifiers(shape) {
  const { flipX, flipY, transform, transformInverse } = shape;
  if (flipX || flipY) {
    const modifiers = ctm.resize(
      ctm.empty(),
      gpt.point(flipX ? -1.0 : 1.0, flipY ? -1.0 : 1.0),
      gco.shapeToCenter(shape),
      transform,
      transformInverse
    );
    return [gtr.transformShape(shape, modifiers), modifiers];
  }
  return [shape, null];
}

function layoutDropAreas(frame, layoutData, children) {
  const reverse = layoutData.reverse;
  const enumeratedChildren = d.enumerate(children);
  const sortedChildren = reverse ? enumeratedChildren : [...enumeratedChildren].reverse();
  const lines = layoutData.layoutLines;

  const areas = [];
  let fromIdx = 0;
  let prevLineX = frame.x;
  let prevLineY = frame.y;

  for (const currentLine of lines) {
    const lineArea = dropLineArea(frame, currentLine, prevLineX, prevLineY, false);
    const lineChildren = sortedChildren.slice(fromIdx, fromIdx + currentLine.numChildren);

    let prevChildX = lineArea.x;
    let prevChildY = lineArea.y;

    for (const [index, [childBounds]] of lineChildren) {
      const [childArea, ,] = dropChildAreas(frame, lineArea, childBounds, index, !reverse, prevChildX, prevChildY, false);
      // The drop areas calculation would go here, but for now we skip full area generation
      // as it depends on more detailed per-child area logic
      prevChildX = childArea.x + childArea.width;
      prevChildY = childArea.y + childArea.height;
    }

    fromIdx += currentLine.numChildren;
    prevLineX = lineArea.x + lineArea.width;
    prevLineY = lineArea.y + lineArea.height;
  }

  return areas;
}

export function getDropAreas(frame, objects, bounds) {
  const [flippedFrame, modifiers] = getFlipModifiers(frame);

  const children = cfh.getImmediateChildren(objects, flippedFrame.id)
    .filter(child => !child.hidden)
    .map(child => {
      const transformedChild = modifiers ? gtr.transformShape(child, modifiers) : child;
      return [gpo.parentCoordsBounds(transformedChild.points, flippedFrame.points), transformedChild];
    });

  const layoutData = fld.calcLayoutData(flippedFrame, flippedFrame.points, children, bounds, objects);
  return layoutDropAreas(flippedFrame, layoutData, children);
}

export function getDropIndex(frameId, objects, position) {
  const frame = objects[frameId];
  const bounds = new Map(Object.keys(objects).map(id => [id, gco.shapeToPoints(objects[id])]));
  const dropAreas = getDropAreas(frame, objects, bounds);
  const transformedPosition = gmt.transformPointCenter(position, gco.shapeToCenter(frame), frame.transformInverse);
  const area = d.seek(area => grc.containsPoint(area, transformedPosition), dropAreas);
  return area?.index;
}