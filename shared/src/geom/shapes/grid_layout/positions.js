import * as d from '../../../data.js';
import * as gl from '../../line.js';
import * as gpt from '../../point.js';
import * as gco from '../common.js';
import * as ld from './layout_data.js';
import * as gpo from '../points.js';
import * as gtr from '../transforms.js';
import * as mth from '../../../math.js';
import * as ctm from '../../../modifiers.js';
import * as ctl from '../../../types/shape/layout.js';
import * as cfh from '../../../files/helpers.js';

function cellBoundsFn(layoutData, cell) {
  const { origin, columnTracks, rowTracks, layoutBounds } = layoutData;
  const columnGap = layoutData.columnGap ?? layoutData['column-gap'] ?? 0;
  const rowGap = layoutData.rowGap ?? layoutData['row-gap'] ?? 0;

  const hvFn = (val) => gpo.startHv(layoutBounds, val);
  const vvFn = (val) => gpo.startVv(layoutBounds, val);

  const { row, column, 'row-span': rowSpan = 1, 'column-span': columnSpan = 1 } = cell;

  const spanColumnTracks = columnTracks.slice(column - 1, column - 1 + columnSpan);
  const spanRowTracks = rowTracks.slice(row - 1, row - 1 + rowSpan);

  if (!spanColumnTracks.length || !spanRowTracks.length) return null;

  const p1 = gpt.add(
    origin,
    gpt.add(
      gpt.toVec(origin, spanColumnTracks[0].startP),
      gpt.toVec(origin, spanRowTracks[0].startP)
    )
  );

  let p2 = p1;
  for (const track of spanColumnTracks) {
    p2 = gpt.add(p2, hvFn(track.size));
  }
  p2 = gpt.add(p2, hvFn(columnGap * (spanColumnTracks.length - 1)));

  let p3 = p2;
  for (const track of spanRowTracks) {
    p3 = gpt.add(p3, vvFn(track.size));
  }
  p3 = gpt.add(p3, vvFn(rowGap * (spanRowTracks.length - 1)));

  let p4 = p1;
  for (const track of spanRowTracks) {
    p4 = gpt.add(p4, vvFn(track.size));
  }
  p4 = gpt.add(p4, vvFn(rowGap * (spanRowTracks.length - 1)));

  return [p1, p2, p3, p4];
}

function calcFillWidthData(parent, transform, transformInverse, child, childOrigin, childWidth, cellBounds) {
  const targetWidth = Math.max(gpo.widthPoints(cellBounds) - ctl.childWidthMargin(child), 0.01);
  const maxWidth = Math.max(ctl.childMaxWidth(child), 0.01);
  const clampedWidth = mth.clamp(targetWidth, ctl.childMinWidth(child), maxWidth);
  const fillScale = clampedWidth / childWidth;
  return {
    width: clampedWidth,
    modifiers: ctm.resizeModifiers(gpt.point(fillScale, 1), childOrigin, transform, transformInverse),
  };
}

function calcFillHeightData(parent, transform, transformInverse, child, childOrigin, childHeight, cellBounds) {
  const targetHeight = Math.max(gpo.heightPoints(cellBounds) - ctl.childHeightMargin(child), 0.01);
  const maxHeight = Math.max(ctl.childMaxHeight(child), 0.01);
  const clampedHeight = mth.clamp(targetHeight, ctl.childMinHeight(child), maxHeight);
  const fillScale = clampedHeight / childHeight;
  return {
    height: clampedHeight,
    modifiers: ctm.resizeModifiers(gpt.point(1, fillScale), childOrigin, transform, transformInverse),
  };
}

function fillModifiersGrid(parent, parentBounds, child, childBounds, layoutData, cellData) {
  const childOrigin = gpo.origin(childBounds);
  const childWidth = gpo.widthPoints(childBounds);
  const childHeight = gpo.heightPoints(childBounds);

  const shouldFill = ctl.fillWidthQ(child) || ctl.fillHeightQ(child);
  const [, transform, transformInverse] = shouldFill ? gtr.calculateGeometry(parentBounds) : [null, null, null];

  const cbFn = cellBoundsFn(layoutData, cellData);

  const fillWidth = ctl.fillWidthQ(child)
    ? calcFillWidthData(parent, transform, transformInverse, child, childOrigin, childWidth, cbFn)
    : null;

  const fillHeight = ctl.fillHeightQ(child)
    ? calcFillHeightData(parent, transform, transformInverse, child, childOrigin, childHeight, cbFn)
    : null;

  const finalWidth = fillWidth?.width ?? childWidth;
  const finalHeight = fillHeight?.height ?? childHeight;

  let mods = ctm.empty();
  if (fillWidth) mods = ctm.addModifiers(mods, fillWidth.modifiers);
  if (fillHeight) mods = ctm.addModifiers(mods, fillHeight.modifiers);

  return [finalWidth, finalHeight, mods];
}

function childPositionDelta(parent, child, childBounds, childWidth, childHeight, layoutData, cellData) {
  const cb = cellBoundsFn(layoutData, cellData);
  if (!cb) return gpt.point(0, 0);

  const childOrigin = gpo.origin(childBounds);
  const align = parent['layout-align-items'];
  const justify = parent['layout-justify-items'];
  let alignSelf = cellData?.['align-self'];
  let justifySelf = cellData?.['justify-self'];

  if (alignSelf === 'auto') alignSelf = null;
  if (justifySelf === 'auto') justifySelf = null;

  const effectiveAlign = alignSelf || align;
  const effectiveJustify = justifySelf || justify;

  const originH = gpo.projectPoint(cb, 'h', childOrigin);
  const originV = gpo.projectPoint(cb, 'v', childOrigin);

  const hvFn = (val) => gpo.startHv(cb, val);
  const vvFn = (val) => gpo.startVv(cb, val);

  const [marginTop, marginRight, marginBottom, marginLeft] = ctl.childMargins(child);

  let fromH, toH;
  switch (effectiveJustify) {
    case 'end':
      fromH = gpt.add(originH, hvFn(childWidth));
      toH = gpt.subtract(cb[1], hvFn(marginRight));
      break;
    case 'center':
      fromH = gpt.add(originH, hvFn(childWidth / 2));
      toH = gpt.add(gpo.projectPoint(cb, 'h', gpo.centerBounds(cb)), hvFn(marginLeft / 2));
      toH = gpt.subtract(toH, hvFn(marginRight / 2));
      break;
    default:
      fromH = originH;
      toH = gpt.add(cb[0], hvFn(marginLeft));
      break;
  }

  let fromV, toV;
  switch (effectiveAlign) {
    case 'end':
      fromV = gpt.add(originV, vvFn(childHeight));
      toV = gpt.subtract(cb[3], vvFn(marginBottom));
      break;
    case 'center':
      fromV = gpt.add(originV, vvFn(childHeight / 2));
      toV = gpt.add(gpo.projectPoint(cb, 'v', gpo.centerBounds(cb)), vvFn(marginTop));
      toV = gpt.subtract(toV, vvFn(marginBottom));
      break;
    default:
      fromV = originV;
      toV = gpt.add(cb[0], vvFn(marginTop));
      break;
  }

  return gpt.add(gpt.toVec(fromH, toH), gpt.toVec(fromV, toV));
}

export function childModifiers(parent, parentBounds, child, childBounds, layoutData, cellData) {
  const [childWidth, childHeight, fillMods] = fillModifiersGrid(parent, parentBounds, child, childBounds, layoutData, cellData);
  const positionDelta = childPositionDelta(parent, child, childBounds, childWidth, childHeight, layoutData, cellData);

  let mods = ctm.empty();
  if (!ctl.positionAbsoluteQ(child)) {
    mods = ctm.addModifiers(mods, fillMods);
    mods = ctm.move(mods, positionDelta);
  }

  return mods;
}

function getPositionGridCoord(layoutData, position) {
  const { layoutBounds, columnTracks, rowTracks } = layoutData;

  const hvFn = (val) => gpo.startHv(layoutBounds, val);
  const vvFn = (val) => gpo.startVv(layoutBounds, val);

  function makeIsInsideTrack(type) {
    const [vfn, ofn] = type === 'column' ? [vvFn, hvFn] : [hvFn, vvFn];
    return (track) => {
      const unitV = vfn(1);
      const endP = gpt.add(track.startP, ofn(track.size));
      return gl.isInsideLinesQ([track.startP, unitV], [endP, unitV], position);
    };
  }

  function makeMinDistanceTrack(type) {
    const [vfn, ofn] = type === 'column' ? [vvFn, hvFn] : [hvFn, vvFn];
    return ([selected, selectedDist], [curIdx, track]) => {
      const unitV = vfn(1);
      const endP = gpt.add(track.startP, ofn(track.size));
      const dist1 = mth.abs(gl.lineValue([track.startP, unitV], position));
      const dist2 = mth.abs(gl.lineValue([endP, unitV], position));
      if (dist1 < selectedDist || dist2 < selectedDist) {
        return [[curIdx, track], Math.min(dist1, dist2)];
      }
      return [selected, selectedDist];
    };
  }

  const colResult = d.seek(([idx, track]) => makeIsInsideTrack('column')(track), d.enumerate(columnTracks));
  const rowResult = d.seek(([idx, track]) => makeIsInsideTrack('row')(track), d.enumerate(rowTracks));

  let colIdx = colResult ? colResult[0] : null;
  let column = colResult ? colResult[1] : null;

  if (!column) {
    const [selected] = d.enumerate(columnTracks).reduce(makeMinDistanceTrack('column'), [[null, null], Infinity]);
    colIdx = selected[0];
    column = selected[1];
  }

  let rowIdx = rowResult ? rowResult[0] : null;
  let row = rowResult ? rowResult[1] : null;

  if (!row) {
    const [selected] = d.enumerate(rowTracks).reduce(makeMinDistanceTrack('row'), [[null, null], Infinity]);
    rowIdx = selected[0];
    row = selected[1];
  }

  if (column && row) {
    return [rowIdx + 1, colIdx + 1];
  }

  return null;
}

export function getDropCell(frameId, objects, position) {
  const frame = objects[frameId];
  const children = cfh.getImmediateChildren(objects, frame.id)
    .filter(child => !child.hidden)
    .map(child => [gpo.parentCoordsBounds(child.points, frame.points), child]);

  const bounds = new Map(Object.keys(objects).map(id => [id, gco.shapeToPoints(objects[id])]));
  const layoutData = ld.calcLayoutData(frame, frame.points, children, bounds, objects);

  return getPositionGridCoord(layoutData, position);
}