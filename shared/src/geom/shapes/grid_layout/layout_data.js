import * as d from '../../../data.js';
import * as gpt from '../../point.js';
import * as gpo from '../points.js';
import * as mth from '../../../math.js';
import * as ctl from '../../../types/shape/layout.js';

let childMinWidthFn = null;
let childMinHeightFn = null;

export function setChildMinWidthFn(fn) { childMinWidthFn = fn; }
export function setChildMinHeightFn(fn) { childMinHeightFn = fn; }

function layoutChildMinWidth(child, childBounds, bounds, objects) {
  return ctl.childWidthMargin(child) + (childMinWidthFn ? childMinWidthFn(child, childBounds, bounds, objects, true) : gpo.widthPoints(childBounds));
}

function layoutChildMinHeight(child, childBounds, bounds, objects) {
  return ctl.childHeightMargin(child) + (childMinHeightFn ? childMinHeightFn(child, childBounds, bounds, objects, true) : gpo.heightPoints(childBounds));
}

export function layoutBounds(parent, shapeBounds) {
  const [padTop, padRight, padBottom, padLeft] = ctl.paddings(parent);
  return gpo.padPoints(shapeBounds, -padTop, -padRight, -padBottom, -padLeft);
}

function calculateInitialTrackSize(totalValue, track) {
  const { type, value } = track;
  let size, maxSize;

  if (type === 'percent') {
    const pxValue = (totalValue * value) / 100;
    size = pxValue;
    maxSize = pxValue;
  } else if (type === 'fixed') {
    size = value;
    maxSize = value;
  } else {
    size = 0.01;
    maxSize = Infinity;
  }

  return { ...track, size, maxSize };
}

function setAutoBaseSize(trackList, children, shapeCells, bounds, objects, type) {
  const prop = type === 'column' ? 'column' : 'row';
  const propSpan = type === 'column' ? 'column-span' : 'row-span';
  const sizeFn = type === 'column' ? layoutChildMinWidth : layoutChildMinHeight;

  for (const [childBounds, childShape] of children) {
    const cell = shapeCells[childShape.id];
    if (!cell) continue;
    const idx = cell[prop] - 1;
    if (idx < 0 || idx >= trackList.length) continue;
    const track = trackList[idx];

    if (cell[propSpan] === 1 && (track.type === 'flex' || track.type === 'auto')) {
      trackList[idx] = {
        ...trackList[idx],
        size: Math.max(trackList[idx].size, sizeFn(childShape, childBounds, bounds, objects)),
      };
    }
  }

  return trackList;
}

function tracksTotalSize(trackList) {
  return trackList.reduce((acc, track) => acc + track.size, 0);
}

function tracksTotalFrs(trackList) {
  return trackList.reduce((acc, track) => {
    const value = Math.max(track.value, 1);
    return track.type === 'flex' ? acc + value : acc;
  }, 0);
}

function tracksTotalAutos(trackList) {
  return trackList.reduce((acc, track) => track.type === 'auto' ? acc + 1 : acc, 0);
}

function setFrValue(trackList, frValue, autoQ) {
  const flexTracks = d.enumerate(trackList).filter(([_idx, track]) => track.type === 'flex');

  function assignFn([assignFr, pending, freeFrs], [trackIdx, t]) {
    const fr = t.value;
    const current = assignFr[trackIdx] ?? (frValue * fr);
    const full = current <= t.size;
    const curPending = full ? (t.size - current) : 0;
    return [
      { ...assignFr, [trackIdx]: full ? t.size : current },
      pending + curPending,
      full ? freeFrs : freeFrs + fr,
    ];
  }

  function changeFn(delta) {
    return (assignFr, [trackIdx, t]) => {
      const fr = t.value;
      const current = assignFr[trackIdx];
      const full = current <= t.size;
      if (!full) {
        return { ...assignFr, [trackIdx]: current - delta * fr };
      }
      return assignFr;
    };
  }

  let assignFr = {};
  let iterationLimit = 100;

  while (iterationLimit-- > 0) {
    const [newAssignFr, pending, freeFrs] = flexTracks.reduce(assignFn, [assignFr, 0, 0]);

    if (autoQ || freeFrs === 0 || mth.almostZero(pending)) {
      assignFr = newAssignFr;
      break;
    }

    const delta = pending / freeFrs;
    assignFr = flexTracks.reduce(changeFn(delta), newAssignFr);
  }

  for (const [idx, assignment] of Object.entries(assignFr)) {
    trackList[idx] = { ...trackList[idx], size: Math.max(trackList[idx].size, assignment) };
  }

  return trackList;
}

function stretchTracks(trackList, addSize) {
  return trackList.map(track => {
    if (track.type === 'auto') {
      return { ...track, size: Math.min(track.size + addSize, track.maxSize) };
    }
    return track;
  });
}

function hasFlexTrack(type, trackList, cell) {
  const [prop, propSpan] = type === 'column' ? ['column', 'column-span'] : ['row', 'row-span'];
  const fromIdx = Math.max(0, Math.min(cell[prop] - 1, trackList.length - 1));
  const toIdx = Math.max(0, Math.min(cell[prop] - 1 + cell[propSpan], trackList.length));
  const tracks = trackList.slice(fromIdx, toIdx);
  return tracks.some(t => t.type === 'flex');
}

function sizeToAllocate(type, parent, childBounds, cell, bounds, objects) {
  const [rowGap, columnGap] = ctl.gaps(parent);
  const [sfn, gap, propSpan] = type === 'column'
    ? [layoutChildMinWidth, columnGap, 'column-span']
    : [layoutChildMinHeight, rowGap, 'row-span'];
  const span = cell[propSpan];
  return sfn(childBounds[1], childBounds[0], bounds, objects) - gap * (span - 1);
}

function allocateAutoTracks(allocations, indexedTracks, toAllocate) {
  if (indexedTracks.length === 0) return [allocations, toAllocate];

  const [idx, track] = indexedTracks[0];
  const oldAllocated = allocations[idx] ?? 0.01;
  const autoTrack = track.type === 'auto';

  const allocated = autoTrack
    ? Math.max(oldAllocated, toAllocate / indexedTracks.length, track.size)
    : track.size;

  const newAllocations = autoTrack ? { ...allocations, [idx]: allocated } : allocations;
  return allocateAutoTracks(newAllocations, indexedTracks.slice(1), toAllocate - allocated);
}

function allocateFlexTracks(allocations, indexedTracks, toAllocate, frValue) {
  if (indexedTracks.length === 0) return allocations;

  const [idx, track] = indexedTracks[0];
  const oldAllocated = allocations[idx] ?? 0.01;
  const autoTrack = track.type === 'auto';
  const flexTrack = track.type === 'flex';
  const fr = flexTrack ? track.value : 0;
  const targetAllocation = frValue * fr;

  const allocated = (autoTrack || flexTrack)
    ? Math.max(targetAllocation, oldAllocated, track.size)
    : track.size;

  const newAllocations = (flexTrack || autoTrack) ? { ...allocations, [idx]: allocated } : allocations;
  return allocateFlexTracks(newAllocations, indexedTracks.slice(1), toAllocate - allocated, frValue);
}

function setAutoMultiSpan(parent, trackList, childrenMap, shapeCells, bounds, objects, type) {
  const [prop, propSpan] = type === 'column' ? ['column', 'column-span'] : ['row', 'row-span'];

  const cells = Object.values(shapeCells).filter(cell => cell[propSpan] > 1 && !hasFlexTrack(type, trackList, cell));
  const sortedCells = [...cells].sort((a, b) => b[propSpan] - a[propSpan]);

  let allocated = {};

  for (const cell of sortedCells) {
    const shapeId = cell.shapes?.[0];
    const childEntry = childrenMap[shapeId];
    if (!childEntry) continue;

    const fromIdx = Math.max(0, Math.min(cell[prop] - 1, trackList.length - 1));
    const toIdx = Math.max(0, Math.min(cell[prop] - 1 + cell[propSpan], trackList.length));
    const indexedTracks = d.enumerate(trackList).slice(fromIdx, toIdx);
    const toAllocate = sizeToAllocate(type, parent, childEntry, cell, bounds, objects);

    const reduceResult = indexedTracks.reduce(([remaining, result], [trackIdx, track]) => {
      if (track.type === 'auto') {
        return [remaining, [...result, [trackIdx, track]]];
      }
      return [remaining - track.size, result];
    }, [Math.max(toAllocate, 0), []]);

    let toAllocateRemainder = reduceResult[0];
    const filteredTracks = reduceResult[1];

    const nonAssignedTracks = filteredTracks.filter(([trackIdx]) => !(trackIdx in allocated));

    const allocResult1 = allocateAutoTracks(allocated, nonAssignedTracks, toAllocateRemainder);
    allocated = allocResult1[0];
    toAllocateRemainder = allocResult1[1];

    const allocResult2 = allocateAutoTracks(allocated, indexedTracks, Math.max(toAllocateRemainder, 0));
    allocated = allocResult2[0];
  }

  for (let i = 0; i < trackList.length; i++) {
    trackList[i] = { ...trackList[i], size: Math.max(trackList[i].size, allocated[i] ?? 0) };
  }

  return trackList;
}

function setFlexMultiSpan(parent, trackList, childrenMap, shapeCells, bounds, objects, type) {
  const [prop, propSpan] = type === 'column' ? ['column', 'column-span'] : ['row', 'row-span'];

  const cells = Object.values(shapeCells)
    .filter(cell => cell[propSpan] > 1 && hasFlexTrack(type, trackList, cell));
  const sortedCells = [...cells].sort((a, b) => b[propSpan] - a[propSpan]);

  let allocateFrTracks = {};

  for (const cell of sortedCells) {
    const shapeId = cell.shapes?.[0];
    const childEntry = childrenMap[shapeId];
    if (!childEntry) continue;

    const fromIdx = cell[prop] - 1;
    const toIdx = cell[prop] - 1 + cell[propSpan];
    const indexedTracks = d.enumerate(trackList).slice(fromIdx, toIdx);

    const toAllocate = sizeToAllocate(type, parent, childEntry, cell, bounds, objects);

    const [toAllocateRem, totalFrs, flexIndexedTracks] = indexedTracks.reduce(([remaining, totalFr, result], [trackIdx, track]) => {
      if (track.type === 'flex') {
        return [remaining, totalFr + track.value, [...result, [trackIdx, track]]];
      }
      return [remaining - track.size, totalFr, result];
    }, [toAllocate, 0, []]);

    const flexToAllocate = Math.max(toAllocateRem, 0);
    const frValue = totalFrs > 0 ? flexToAllocate / totalFrs : 0;

    allocateFrTracks = allocateFlexTracks(allocateFrTracks, indexedTracks, flexToAllocate, frValue);
  }

  for (let i = 0; i < trackList.length; i++) {
    trackList[i] = { ...trackList[i], size: Math.max(trackList[i].size, allocateFrTracks[i] ?? 0) };
  }

  return trackList;
}

function minFrValue(tracks) {
  let minFr = 0.01;
  for (const track of tracks) {
    if (track.type === 'flex') {
      minFr = Math.max(minFr, track.size / track.value);
    }
  }
  return minFr;
}

export function calcLayoutData(parent, transformedParentBounds, children, bounds, objects, autoQ) {
  if (autoQ === undefined) autoQ = false;

  const layoutBoundsResult = layoutBounds(parent, transformedParentBounds);
  const hvFn = (val) => gpo.startHv(layoutBoundsResult, val);
  const vvFn = (val) => gpo.startVv(layoutBoundsResult, val);

  const boundHeight = gpo.heightPoints(layoutBoundsResult);
  const boundWidth = gpo.widthPoints(layoutBoundsResult);
  const boundCorner = gpo.origin(layoutBoundsResult);

  const [rowGap, columnGap] = ctl.gaps(parent);
  const autoHeight = ctl.autoHeightQ(parent) || autoQ;
  const autoWidth = ctl.autoWidthQ(parent) || autoQ;

  const layoutGridColumns = parent['layout-grid-columns'] || [];
  const layoutGridRows = parent['layout-grid-rows'] || [];
  const layoutGridCells = parent['layout-grid-cells'] || {};

  const numColumns = layoutGridColumns.length;
  const numRows = layoutGridRows.length;

  const columnTotalGap = columnGap * Math.max(0, numColumns - 1);
  const rowTotalGap = rowGap * Math.max(0, numRows - 1);

  const shapeCells = {};
  for (const [_cellId, cell] of Object.entries(layoutGridCells)) {
    for (const shapeId of cell.shapes || []) {
      shapeCells[shapeId] = cell;
    }
  }

  const filteredChildren = children.filter(([, child]) => !ctl.positionAbsoluteQ(child));
  const childrenMap = {};
  for (const [childBounds, child] of filteredChildren) {
    childrenMap[child.id] = [childBounds, child];
  }

  let columnTracks = layoutGridColumns.map(track => calculateInitialTrackSize(boundWidth, track));
  let rowTracks = layoutGridRows.map(track => calculateInitialTrackSize(boundHeight, track));

  columnTracks = setAutoBaseSize(columnTracks, filteredChildren, shapeCells, bounds, objects, 'column');
  rowTracks = setAutoBaseSize(rowTracks, filteredChildren, shapeCells, bounds, objects, 'row');

  columnTracks = setAutoMultiSpan(parent, columnTracks, childrenMap, shapeCells, bounds, objects, 'column');
  rowTracks = setAutoMultiSpan(parent, rowTracks, childrenMap, shapeCells, bounds, objects, 'row');

  const columnTotalSizeNoFr = tracksTotalSize(columnTracks.filter(t => t.type !== 'flex'));
  const rowTotalSizeNoFr = tracksTotalSize(rowTracks.filter(t => t.type !== 'flex'));

  const columnFrs = tracksTotalFrs(columnTracks);
  const rowFrs = tracksTotalFrs(rowTracks);

  columnTracks = setFlexMultiSpan(parent, columnTracks, childrenMap, shapeCells, bounds, objects, 'column');
  rowTracks = setFlexMultiSpan(parent, rowTracks, childrenMap, shapeCells, bounds, objects, 'row');

  const frColumnSpace = Math.max(0, boundWidth - (columnTotalSizeNoFr + columnTotalGap));
  const frRowSpace = Math.max(0, boundHeight - (rowTotalSizeNoFr + rowTotalGap));

  const minColumnFr = minFrValue(columnTracks);
  const minRowFr = minFrValue(rowTracks);

  const columnFr = autoWidth ? minColumnFr : (columnFrs === 0 ? 0 : mth.finite(frColumnSpace / columnFrs, 0));
  const rowFr = autoHeight ? minRowFr : (rowFrs === 0 ? 0 : mth.finite(frRowSpace / rowFrs, 0));

  columnTracks = setFrValue(columnTracks, columnFr, autoWidth);
  rowTracks = setFrValue(rowTracks, rowFr, autoHeight);

  let columnTotalSize = tracksTotalSize(columnTracks);
  let rowTotalSize = tracksTotalSize(rowTracks);

  const autoColumnSpace = Math.max(0, autoWidth ? 0 : boundWidth - (columnTotalSize + columnTotalGap));
  const autoRowSpace = Math.max(0, autoHeight ? 0 : boundHeight - (rowTotalSize + rowTotalGap));
  const columnAutos = tracksTotalAutos(columnTracks);
  const rowAutos = tracksTotalAutos(rowTracks);

  const columnAddAuto = columnAutos === 0 ? 0 : autoColumnSpace / columnAutos;
  const rowAddAuto = rowAutos === 0 ? 0 : autoRowSpace / rowAutos;

  if (parent['layout-justify-content'] === 'stretch') {
    columnTracks = stretchTracks(columnTracks, columnAddAuto);
  }
  if (parent['layout-align-content'] === 'stretch') {
    rowTracks = stretchTracks(rowTracks, rowAddAuto);
  }

  columnTotalSize = tracksTotalSize(columnTracks);
  rowTotalSize = tracksTotalSize(rowTracks);

  const numCols = columnTracks.length;
  const adjustedColumnGap = (() => {
    if (autoWidth) return columnGap;
    if (parent['layout-justify-content'] === 'space-evenly') return Math.max(columnGap, (boundWidth - columnTotalSize) / (numCols + 1));
    if (parent['layout-justify-content'] === 'space-around') return Math.max(columnGap, (boundWidth - columnTotalSize) / numCols);
    if (parent['layout-justify-content'] === 'space-between') return Math.max(columnGap, numCols === 1 ? columnGap : (boundWidth - columnTotalSize) / (numCols - 1));
    return columnGap;
  })();

  const numRows2 = rowTracks.length;
  const adjustedRowGap = (() => {
    if (autoHeight) return rowGap;
    if (parent['layout-align-content'] === 'space-evenly') return Math.max(rowGap, (boundHeight - rowTotalSize) / (numRows2 + 1));
    if (parent['layout-align-content'] === 'space-around') return Math.max(rowGap, (boundHeight - rowTotalSize) / numRows2);
    if (parent['layout-align-content'] === 'space-between') return Math.max(rowGap, numRows2 === 1 ? rowGap : (boundHeight - rowTotalSize) / (numRows2 - 1));
    return rowGap;
  })();

  let startP = boundCorner;

  if (!autoWidth && parent['layout-justify-content'] === 'end') {
    startP = gpt.add(startP, hvFn(boundWidth - (columnTotalSize + columnTotalGap)));
  }
  if (!autoWidth && parent['layout-justify-content'] === 'center') {
    startP = gpt.add(startP, hvFn((boundWidth - (columnTotalSize + columnTotalGap)) / 2));
  }
  if (!autoHeight && parent['layout-align-content'] === 'end') {
    startP = gpt.add(startP, vvFn(boundHeight - (rowTotalSize + rowTotalGap)));
  }
  if (!autoHeight && parent['layout-align-content'] === 'center') {
    startP = gpt.add(startP, vvFn((boundHeight - (rowTotalSize + rowTotalGap)) / 2));
  }
  if (!autoWidth && parent['layout-justify-content'] === 'space-around') {
    startP = gpt.add(startP, hvFn(adjustedColumnGap / 2));
  }
  if (!autoWidth && parent['layout-justify-content'] === 'space-evenly') {
    startP = gpt.add(startP, hvFn(adjustedColumnGap));
  }
  if (!autoHeight && parent['layout-align-content'] === 'space-around') {
    startP = gpt.add(startP, vvFn(adjustedRowGap / 2));
  }
  if (!autoHeight && parent['layout-align-content'] === 'space-evenly') {
    startP = gpt.add(startP, vvFn(adjustedRowGap));
  }

  const columnTracksWithPositions = [];
  let colStartP = startP;
  for (const track of columnTracks) {
    columnTracksWithPositions.push({ ...track, startP: colStartP });
    colStartP = gpt.add(colStartP, hvFn(track.size + adjustedColumnGap));
  }

  const rowTracksWithPositions = [];
  let rowStartP = startP;
  for (const track of rowTracks) {
    rowTracksWithPositions.push({ ...track, startP: rowStartP });
    rowStartP = gpt.add(rowStartP, vvFn(track.size + adjustedRowGap));
  }

  return {
    origin: startP,
    layoutBounds: layoutBoundsResult,
    rowTracks: rowTracksWithPositions,
    columnTracks: columnTracksWithPositions,
    shapeCells,
    columnGap: adjustedColumnGap,
    rowGap: adjustedRowGap,
    columnTotalSize,
    columnTotalGap,
    rowTotalSize,
    rowTotalGap,
  };
}

export function getCellData(layoutData, _transformedParentBounds, childBoundsAndShape) {
  const [_childBounds, child] = childBoundsAndShape;
  const { origin, rowTracks, columnTracks, shapeCells } = layoutData;

  const gridCell = shapeCells[child.id];
  if (!gridCell || !d.notEmpty(gridCell)) return null;

  const column = columnTracks[gridCell.column - 1];
  const row = rowTracks[gridCell.row - 1];

  if (!column?.startP || !row?.startP) return null;

  const startP = gpt.add(origin, gpt.add(gpt.toVec(origin, column.startP), gpt.toVec(origin, row.startP)));
  return { ...gridCell, startP };
}