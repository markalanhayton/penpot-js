const DEFAULT_ITEMS = 12;

export function calculateDefaultItemLength(frameLength, margin, gutter) {
  return (frameLength - margin + (margin - gutter) - gutter * DEFAULT_ITEMS) / DEFAULT_ITEMS;
}

export function calculateSize(frameLength, itemLength, margin, gutter) {
  const il = itemLength ?? calculateDefaultItemLength(frameLength, margin, gutter);
  const flNoMargins = frameLength - (margin + (margin - gutter));
  return Math.floor(flNoMargins / (il + gutter));
}

function calculateGenericGrid(v, totalLength, params) {
  const { size: rawSize, gutter, margin, 'item-length': itemLength, type } = params;
  const size = typeof rawSize === 'number' ? rawSize : calculateSize(totalLength, itemLength, margin, gutter);
  const parts = totalLength / size;

  const il = typeof itemLength === 'number'
    ? itemLength
    : parts - gutter + gutter / size - (margin * 2) / size;

  let offset = margin;
  if (type === 'right') offset = totalLength - il * size - gutter * (size - 1) - margin;
  else if (type === 'center') offset = (totalLength - il * size - gutter * (size - 1)) / 2;

  let g = gutter;
  if (type === 'stretch') {
    g = Math.max(0, gutter, (totalLength - il * size - margin * 2) / (size - 1));
    if (typeof g !== 'number' || !isFinite(g)) g = 0;
  }

  const nextV = (curVal) => offset + v + (il + g) * curVal;

  return [size, il, nextV, g];
}

function calculateColumnGrid(frame, params) {
  const [size, w, nextX, gutter] = calculateGenericGrid(frame.x, frame.width, params);
  return [size, w, frame.height, nextX, () => frame.y];
}

function calculateRowGrid(frame, params) {
  const [size, h, nextY, gutter] = calculateGenericGrid(frame.y, frame.height, params);
  return [size, frame.width, h, () => frame.x, nextY];
}

function calculateSquareGrid(frame, params) {
  const { size } = params;
  const colSize = Math.floor(frame.width / size);
  const rowSize = Math.floor(frame.height / size);
  const asRowCol = (value) => [Math.floor(value / colSize), value % colSize];
  const nextX = (curVal) => {
    const [, col] = asRowCol(curVal);
    return frame.x + col * size;
  };
  const nextY = (curVal) => {
    const [row] = asRowCol(curVal);
    return frame.y + row * size;
  };
  return [colSize * rowSize, size, size, nextX, nextY];
}

export function gridGutter(frame, grid) {
  switch (grid.type) {
    case 'column': return calculateGenericGrid(frame.x, frame.width, grid.params)[3];
    case 'row': return calculateGenericGrid(frame.y, frame.height, grid.params)[3];
    default: return null;
  }
}

export function gridAreas(frame, grid) {
  let gridFn;
  switch (grid.type) {
    case 'column': gridFn = calculateColumnGrid; break;
    case 'row': gridFn = calculateRowGrid; break;
    case 'square': gridFn = calculateSquareGrid; break;
    default: return [];
  }
  const [numItems, itemWidth, itemHeight, nextX, nextY] = gridFn(frame, grid.params);
  const result = [];
  for (let i = 0; i < numItems; i++) {
    result.push({
      x: typeof nextX === 'function' ? nextX(i) : nextX,
      y: typeof nextY === 'function' ? nextY(i) : nextY,
      width: itemWidth,
      height: itemHeight,
    });
  }
  return result;
}

export function gridAreaPoints(area) {
  const { x, y, width, height } = area;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

export function gridSnapPoints(shape, grid, coord) {
  if (!grid.display) return [];
  switch (grid.type) {
    case 'square': {
      const { size } = grid.params;
      if (size <= 0) return [];
      const { x, y, width, height } = shape;
      if (coord === 'x') {
        const points = [];
        for (let px = size; px < width; px += size) {
          points.push({ x: x + px, y });
          points.push({ x: x + px, y: y + height });
        }
        return points;
      } else {
        const points = [];
        for (let py = size; py < height; py += size) {
          points.push({ x, y: y + py });
          points.push({ x: x + width, y: y + py });
        }
        return points;
      }
    }
    case 'column':
      if (coord === 'x') return gridAreas(shape, grid).flatMap(gridAreaPoints);
      return [];
    case 'row':
      if (coord === 'y') return gridAreas(shape, grid).flatMap(gridAreaPoints);
      return [];
    default:
      return [];
  }
}