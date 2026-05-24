export function areaToCellProps([column, row, columnSpan, rowSpan]) {
  return { row, column, rowSpan, columnSpan };
}

export function makeArea(column, row, columnSpan, rowSpan) {
  if (typeof column === 'object') {
    return [column.column, column.row, column.columnSpan, column.rowSpan];
  }
  return [column, row, columnSpan, rowSpan];
}

export function containsQ([aX, aY, aWidth, aHeight], [bX, bY, bWidth, bHeight]) {
  return bX >= aX &&
    bY >= aY &&
    (bX + bWidth) <= (aX + aWidth) &&
    (bY + bHeight) <= (aY + aHeight);
}

export function intersectsQ([aX, aY, aWidth, aHeight], [bX, bY, bWidth, bHeight]) {
  return !((bX + bWidth) <= aX ||
    (bY + bHeight) <= aY ||
    bX >= (aX + aWidth) ||
    bY >= (aY + aHeight));
}

export function topRect([aX, aY, aWidth], [_bX, bY]) {
  const height = bY - aY;
  if (height > 0) return makeArea(aX, aY, aWidth, height);
  return null;
}

export function bottomRect([aX, aY, aWidth, aHeight], [_bX, bY, _bWidth, bHeight]) {
  const y = bY + bHeight;
  const height = aHeight - (y - aY);
  if (height > 0 && y < (aY + aHeight)) return makeArea(aX, y, aWidth, height);
  return null;
}

export function leftRect([aX, aY, _aWidth, aHeight], [bX, bY, _bWidth, bHeight]) {
  const rbY = bY + bHeight;
  const raY = aY + aHeight;
  const y1 = Math.max(aY, bY);
  const y2 = Math.min(raY, rbY);
  const height = y2 - y1;
  const width = bX - aX;
  if (width > 0 && height > 0) return makeArea(aX, y1, width, height);
  return null;
}

export function rightRect([aX, aY, aWidth, aHeight], [bX, bY, bWidth, bHeight]) {
  const rbY = bY + bHeight;
  const raY = aY + aHeight;
  const y1 = Math.max(aY, bY);
  const y2 = Math.min(raY, rbY);
  const height = y2 - y1;
  const rbX = bX + bWidth;
  const width = aWidth - (rbX - aX);
  if (width > 0 && height > 0) return makeArea(rbX, y1, width, height);
  return null;
}

export function difference(areaA, areaB) {
  if (!areaB || !intersectsQ(areaA, areaB) || containsQ(areaB, areaA)) return [];
  const results = [];
  for (const fn of [topRect, leftRect, rightRect, bottomRect]) {
    const result = fn(areaA, areaB);
    if (result) results.push(result);
  }
  return results;
}