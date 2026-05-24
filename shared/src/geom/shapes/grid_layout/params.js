import * as gpt from '../../point.js';
import * as grc from '../../rect.js';
import * as gco from '../common.js';
import * as gpo from '../points.js';
import * as mth from '../../../math.js';

const defaultTrackValue = { type: 'flex', value: 1 };
const gridCellDefaults = { 'row-span': 1, 'column-span': 1, position: 'auto', 'align-self': 'auto', 'justify-self': 'auto', shapes: [] };

function rectToRange(axis, rect) {
  const start = axis === 'x' ? rect.x : rect.y;
  const end = start + (axis === 'x' ? rect.width : rect.height);
  return [start, end];
}

function overlapsRangeQ(axis, range, rect) {
  const [startB, endB] = rectToRange(axis, rect);
  const [startA, endA] = range;
  return (startA < startB && endA > startB) ||
         (startB < startA && endB > startA) ||
         mth.close(startA, startB) ||
         mth.close(endA, endB);
}

function joinRange(axis, range, rect) {
  if (!range) return rectToRange(axis, rect);
  const [startA, endA] = range;
  const [startB, endB] = rectToRange(axis, rect);
  return [Math.min(startA, startB), Math.max(endA, endB)];
}

function sizeRange(range) {
  return range[1] - range[0];
}

function calculateTracks(axis, shapesByAxis) {
  const result = [];
  let index = 1;
  let currentTrack = new Set();
  let currentRange = null;

  for (const [nextShape, rect] of shapesByAxis) {
    if (!currentRange || overlapsRangeQ(axis, currentRange, rect)) {
      currentTrack.add(nextShape.id);
      currentRange = joinRange(axis, currentRange, rect);
    } else {
      result.push({ index, shapes: currentTrack, size: sizeRange(currentRange) });
      index++;
      currentTrack = new Set([nextShape.id]);
      currentRange = rectToRange(axis, rect);
    }
  }

  if (currentTrack.size > 0) {
    result.push({ index, shapes: currentTrack, size: sizeRange(currentRange) });
  }

  return result;
}

function createCells(parent, [column, row, columnSpan, rowSpan]) {
  let result = { ...parent };

  for (let r = row; r < row + rowSpan; r++) {
    for (let c = column; c < column + columnSpan; c++) {
      const cellId = `cell-${r}-${c}`;
      result = {
        ...result,
        'layout-grid-cells': {
          ...result['layout-grid-cells'],
          [cellId]: {
            ...gridCellDefaults,
            id: cellId,
            row: r,
            column: c,
            'row-span': 1,
            'column-span': 1,
          },
        },
      };
    }
  }

  return result;
}

export function calculateGridParams(objects, shapes, parent) {
  if (!shapes || shapes.length === 0) {
    return createCells(
      { 'layout-grid-columns': [defaultTrackValue, defaultTrackValue], 'layout-grid-rows': [defaultTrackValue, defaultTrackValue] },
      [1, 1, 2, 2]
    );
  }

  const visibleShapes = shapes.filter(s => !s.hidden);
  const allShapesRect = gco.shapesToRect(visibleShapes);
  const shapesWithBounds = visibleShapes.map(s => [s, grc.pointsToRect(s.points)]);

  const shapesByX = [...shapesWithBounds].sort((a, b) => a[1].x - b[1].x);
  const shapesByY = [...shapesWithBounds].sort((a, b) => a[1].y - b[1].y);

  const cols = calculateTracks('x', shapesByX);
  const rows = calculateTracks('y', shapesByY);

  const numCols = cols.length;
  const numRows = rows.length;

  const totalColsWidth = cols.reduce((acc, col) => acc + col.size, 0);
  const totalRowsHeight = rows.reduce((acc, row) => acc + row.size, 0);

  const columnGap = numCols === 1 ? 0 : (allShapesRect.width - totalColsWidth) / (numCols - 1);
  const rowGap = numRows === 1 ? 0 : (allShapesRect.height - totalRowsHeight) / (numRows - 1);

  const layoutGridRows = rows.map(() => ({ ...defaultTrackValue }));
  const layoutGridColumns = cols.map(() => ({ ...defaultTrackValue }));

  const parentChildsVector = gpt.toVec(gpo.origin(parent.points), gpt.point(allShapesRect.x, allShapesRect.y));
  const pLeft = parentChildsVector.x;
  const pTop = parentChildsVector.y;

  const params = {
    'layout-grid-columns': layoutGridColumns,
    'layout-grid-rows': layoutGridRows,
    'layout-gap': { 'row-gap': Math.max(rowGap, 0), 'column-gap': Math.max(columnGap, 0) },
    'layout-padding': { p1: pTop, p2: pLeft, p3: pTop, p4: pLeft },
    'layout-grid-dir': numCols > numRows ? 'row' : 'column',
  };

  // Assign shapes to cells
  for (const row of rows) {
    for (const col of cols) {
      const intersection = [...row.shapes].filter(id => col.shapes.has(id));
      if (intersection.length > 0) {
        const cellId = `cell-${row.index}-${col.index}`;
        params['layout-grid-cells'] = params['layout-grid-cells'] || {};
        if (params['layout-grid-cells'][cellId]) {
          params['layout-grid-cells'][cellId] = {
            ...params['layout-grid-cells'][cellId],
            shapes: intersection,
          };
        }
      }
    }
  }

  return params;
}