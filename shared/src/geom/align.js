import { point } from './point.js';
import { pointsToRect } from './rect.js';
import { shapeToCenter, shapesToRect } from './shapes/shapes.js';

export const VALID_ALIGN_AXIS = new Set(['hleft', 'hcenter', 'hright', 'vtop', 'vcenter', 'vbottom']);

export function alignToRect(shape, rect, axis) {
  const wrapperRect = shapesToRect([shape]);
  const alignPos = calcAlignPos(wrapperRect, rect, axis);
  const dx = alignPos.x - wrapperRect.x;
  const dy = alignPos.y - wrapperRect.y;
  return moveShape(shape, { x: dx, y: dy });
}

export function alignToParent(shape, parent, axis) {
  const wrapperRect = pointsToRect(shape.points ?? []);
  const parentRect = parent.selrect ?? parent;
  const alignPos = calcAlignPos(wrapperRect, parentRect, axis);
  const dx = alignPos.x - wrapperRect.x;
  const dy = alignPos.y - wrapperRect.y;
  return moveShape(shape, { x: dx, y: dy });
}

export function calcAlignPos(wrapperRect, rect, axis) {
  switch (axis) {
    case 'hleft':
      return { x: rect.x, y: wrapperRect.y };
    case 'hcenter':
      return { x: rect.x + rect.width / 2 - wrapperRect.width / 2, y: wrapperRect.y };
    case 'hright':
      return { x: rect.x + rect.width - wrapperRect.width, y: wrapperRect.y };
    case 'vtop':
      return { x: wrapperRect.x, y: rect.y };
    case 'vcenter':
      return { x: wrapperRect.x, y: rect.y + rect.height / 2 - wrapperRect.height / 2 };
    case 'vbottom':
      return { x: wrapperRect.x, y: rect.y + rect.height - wrapperRect.height };
    default:
      return { x: wrapperRect.x, y: wrapperRect.y };
  }
}

export const VALID_DIST_AXIS = new Set(['horizontal', 'vertical']);

export function distributeSpace(shapes, axis) {
  const coord = axis === 'horizontal' ? 'x' : 'y';
  const size = axis === 'horizontal' ? 'width' : 'height';
  const wrapperRect = shapesToRect(shapes);
  const sortedShapes = [...shapes].sort((a, b) => shapeToCenter(a)[coord] - shapeToCenter(b)[coord]);
  const wrappedShapes = sortedShapes.map((s) => shapesToRect([s]));
  const totalSpace = wrappedShapes.reduce((acc, s) => acc - s[size], wrapperRect[size]);
  const unitSpace = totalSpace / (wrappedShapes.length - 1);

  const deltas = [];
  let startPos = wrapperRect[coord];
  for (const ws of wrappedShapes) {
    deltas.push(startPos - ws[coord]);
    startPos += ws[size] + unitSpace;
  }

  return sortedShapes.map((s, i) => {
    const delta = { x: 0, y: 0 };
    delta[coord] = deltas[i];
    return moveShape(s, delta);
  });
}

export function adjustToViewport(viewport, srect, options = {}) {
  const { padding = 0, minZoom = null } = options;
  const srectPadded = {
    x: srect.x - padding,
    y: srect.y - padding,
    width: srect.width + padding * 2,
    height: srect.height + padding * 2,
  };

  const gprop = viewport.width / viewport.height;
  const { width, height } = srectPadded;
  const lprop = width / height;

  let adjustedRect;
  if (gprop > lprop) {
    const widthP = (width / lprop) * gprop;
    const p = (widthP - width) / 2;
    adjustedRect = {
      ...srectPadded,
      x: srectPadded.x - p,
      width: widthP,
    };
  } else if (gprop < lprop) {
    const heightP = (height * lprop) / gprop;
    const p = (heightP - height) / 2;
    adjustedRect = {
      ...srectPadded,
      y: srectPadded.y - p,
      height: heightP,
    };
  } else {
    adjustedRect = { ...srectPadded };
  }

  if (minZoom != null && viewport.width / adjustedRect.width < minZoom) {
    const anchorX = srect.x;
    const anchorY = srect.y;
    const vboxWidth = viewport.width / minZoom;
    const vboxHeight = viewport.height / minZoom;
    return {
      ...adjustedRect,
      x: anchorX - vboxWidth / 2,
      y: anchorY - vboxHeight / 2,
      width: vboxWidth,
      height: vboxHeight,
    };
  }

  return adjustedRect;
}

function moveShape(shape, delta) {
  return {
    ...shape,
    x: (shape.x ?? 0) + delta.x,
    y: (shape.y ?? 0) + delta.y,
  };
}