import * as gmt from '../../geom/matrix.js';
import * as gpt from '../../geom/point.js';
import * as grc from '../../geom/rect.js';
import * as gco from './common.js';
import * as gpo from './points.js';
import * as gtr from './transforms.js';
import * as mth from '../../math.js';
import * as ctm from '../../modifiers.js';

function pathShapeQ(shape) {
  return shape?.type === 'path';
}

export function sizePixelPrecision(modifiers, shape, points, precision) {
  const origin = gpo.origin(points);
  const currWidth = gpo.widthPoints(points);
  const currHeight = gpo.heightPoints(points);

  const center = gco.pointsToCenter(points);
  const selrect = gtr.calculateSelrect(points, center);

  const transform = gtr.calculateTransform(points, center, selrect);
  const transformInverse = transform ? gmt.inverse(transform) : null;

  const pathQ = pathShapeQ(shape);
  const verticalLineQ = pathQ && currWidth <= 0.01;
  const horizontalLineQ = pathQ && currHeight <= 0.01;

  const targetWidth = verticalLineQ ? currWidth : mth.max(1, mth.round(currWidth, precision));
  const targetHeight = horizontalLineQ ? currHeight : mth.max(1, mth.round(currHeight, precision));

  const ratioWidth = targetWidth / currWidth;
  const ratioHeight = targetHeight / currHeight;
  const scalev = gpt.point(ratioWidth, ratioHeight);

  return ctm.resize(modifiers, scalev, origin, transform, transformInverse, { precise: true });
}

export function positionPixelPrecision(modifiers, _shape, points, precision, ignoreAxis) {
  const bounds = grc.boundsToRect(points);
  const corner = gpt.point(bounds);
  let targetCorner;
  if (ignoreAxis === 'x') {
    targetCorner = { ...corner, y: mth.round(corner.y, precision) };
  } else if (ignoreAxis === 'y') {
    targetCorner = { ...corner, x: mth.round(corner.x, precision) };
  } else {
    targetCorner = gpt.roundStep(corner, precision);
  }
  const deltav = gpt.toVec(corner, targetCorner);
  return ctm.move(modifiers, deltav);
}

export function setPixelPrecision(modifiers, shape, precision, ignoreAxis) {
  let points = gco.transformPoints(gco.shapeToPoints(shape), ctm.modifiersToTransform(modifiers));
  const hasResizeQ = !ctm.onlyMove(modifiers);

  if (hasResizeQ) {
    modifiers = sizePixelPrecision(modifiers, shape, points, precision);
    points = gco.transformPoints(shape.points, ctm.modifiersToTransform(modifiers));
  }

  return positionPixelPrecision(modifiers, shape, points, precision, ignoreAxis);
}

export function adjustPixelPrecision(modifTree, objects, precision, ignoreAxis) {
  function updateModifiers(tree, shape) {
    const entry = tree[shape?.id];
    const mods = entry?.modifiers;
    if (mods && ctm.hasGeometry(mods)) {
      return {
        ...tree,
        [shape.id]: {
          ...entry,
          modifiers: setPixelPrecision(mods, shape, precision, ignoreAxis),
        },
      };
    }
    return tree;
  }

  return Object.keys(modifTree)
    .map(id => objects[id])
    .filter(Boolean)
    .reduce(updateModifiers, modifTree);
}