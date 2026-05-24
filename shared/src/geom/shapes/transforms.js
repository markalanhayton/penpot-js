import * as d from '../../data.js';
import * as gmt from '../matrix.js';
import * as gpt from '../point.js';
import * as grc from '../rect.js';
import * as gco from './common.js';
import * as mth from '../../math.js';
import * as ctm from '../../modifiers.js';

function validPointQ(o) {
  return gpt.isPoint(o) &&
         typeof o.x === 'number' && typeof o.y === 'number';
}

function moveSelrect(selrect, pt) {
  if (selrect == null || !validPointQ(pt)) return selrect;
  const x = selrect.x;
  const y = selrect.y;
  const w = selrect.width;
  const h = selrect.height;
  const dx = pt.x;
  const dy = pt.y;

  return grc.makeRect(
    typeof x === 'number' ? dx + x : x,
    typeof y === 'number' ? dy + y : y,
    w,
    h
  );
}

function movePoints(points, moveVec) {
  if (!validPointQ(moveVec)) return points;
  return points.map((p) => gpt.add(p, moveVec));
}

export function movePositionData(positionData, delta) {
  if (positionData == null) return positionData;
  const dx = delta.x;
  const dy = delta.y;
  if (typeof dx !== 'number' || typeof dy !== 'number') return positionData;
  return positionData.map((pd) => ({
    ...pd,
    x: pd.x + dx,
    y: pd.y + dy,
  }));
}

export function transformPositionData(positionData, transform) {
  if (positionData == null) return positionData;
  const dx = transform?.e;
  const dy = transform?.f;
  if (typeof dx !== 'number' || typeof dy !== 'number') return positionData;
  return positionData.map((pd) => ({
    ...pd,
    x: pd.x + dx,
    y: pd.y + dy,
  }));
}

export function move(shape, point) {
  const type = shape.type;
  const dx = point.x ?? 0;
  const dy = point.y ?? 0;
  const mvec = gpt.point(dx, dy);

  let result = { ...shape };

  if (result.selrect != null) {
    result.selrect = moveSelrect(result.selrect, mvec);
  }
  if (result.points != null) {
    result.points = movePoints(result.points, mvec);
  }
  if (result.x !== undefined && typeof result.x === 'number') {
    result.x = result.x + dx;
  }
  if (result.y !== undefined && typeof result.y === 'number') {
    result.y = result.y + dy;
  }
  if (result['position-data'] != null) {
    result['position-data'] = movePositionData(result['position-data'], mvec);
  }

  return result;
}

export function absoluteMove(shape, pos) {
  if (!shape) return shape;
  const x = pos.x;
  const y = pos.y;
  const sr = shape.selrect;
  const px = sr?.x ?? 0;
  const py = sr?.y ?? 0;
  const dx = (x ?? 0) - px;
  const dy = (y ?? 0) - py;
  return move(shape, gpt.point(dx, dy));
}

export function transformMatrix(shape, params, shapeCenter) {
  if (shapeCenter === undefined) {
    shapeCenter = gco.shapeToCenter(shape) ?? gpt.point(0, 0);
  }

  const { flipX, flipY, transform } = shape;
  const noFlip = params?.noFlip;

  let m = gmt.matrix();
  m = gmt.translate(m, shapeCenter);

  if (transform != null) {
    m = gmt.multiply(m, transform);
  }

  if (flipX && noFlip) {
    m = gmt.scale(m, gpt.point(-1, 1));
  }

  if (flipY && noFlip) {
    m = gmt.scale(m, gpt.point(1, -1));
  }

  m = gmt.translate(m, gpt.negate(shapeCenter));
  return m;
}

export function inverseTransformMatrix(shape, params, shapeCenter) {
  if (shapeCenter === undefined) {
    shapeCenter = gco.shapeToCenter(shape) ?? gpt.point(0, 0);
  }

  const { flipX, flipY, 'transform-inverse': transformInverse } = shape;
  const noFlip = params?.noFlip;

  let m = gmt.matrix();
  m = gmt.translate(m, shapeCenter);

  if (flipX && noFlip) {
    m = gmt.scale(m, gpt.point(-1, 1));
  }

  if (flipY && noFlip) {
    m = gmt.scale(m, gpt.point(1, -1));
  }

  if (transformInverse != null) {
    m = gmt.multiply(m, transformInverse);
  }

  m = gmt.translate(m, gpt.negate(shapeCenter));
  return m;
}

export function transformStr(shape, params) {
  if (shape == null) return '';
  const { transform, flipX, flipY } = shape;
  const noFlip = params?.noFlip;
  if (transform == null && !(noFlip && flipX) && !(noFlip && flipY)) {
    return '';
  }
  return String(transformMatrix(shape, params));
}

export function transformRect(rect, matrix) {
  const points = gco.transformPoints(grc.rectToPoints(rect), matrix);
  return grc.pointsToRect(points);
}

function transformPointsMatrix(selrect, [d1, d2, , d4]) {
  const x1 = mth.roundToZero(selrect.x1);
  const y1 = mth.roundToZero(selrect.y1);
  const x2 = mth.roundToZero(selrect.x2);
  const y2 = mth.roundToZero(selrect.y2);

  const det = (y1 - y2) * x1 + (y1 - y2) * (-x2) + (y1 - y1) * x1;
  // Simplified from original: the cross terms with y1-y1 always zero

  if (det === 0) return undefined;

  const ma0 = mth.roundToZero(d1.x);
  const ma1 = mth.roundToZero(d2.x);
  const ma2 = mth.roundToZero(d4.x);
  const ma3 = mth.roundToZero(d1.y);
  const ma4 = mth.roundToZero(d2.y);
  const ma5 = mth.roundToZero(d4.y);

  const mb0 = (y1 - y2) / det;
  const mb1 = (x1 - x2) / det;
  const mb2 = (x2 * y2 - x1 * y1) / det;
  const mb3 = (y2 - y1) / det;
  const mb4 = (x1 - x1) / det;
  const mb5 = (x1 * y1 - x1 * y2) / det;
  const mb6 = (y1 - y1) / det;
  const mb7 = (x2 - x1) / det;
  const mb8 = (x1 * y1 - x2 * y1) / det;

  return gmt.matrix(
    ma0 * mb0 + ma1 * mb3 + ma2 * mb6,
    ma3 * mb0 + ma4 * mb3 + ma5 * mb6,
    ma0 * mb1 + ma1 * mb4 + ma2 * mb7,
    ma3 * mb1 + ma4 * mb4 + ma5 * mb7,
    ma0 * mb2 + ma1 * mb5 + ma2 * mb8,
    ma3 * mb2 + ma4 * mb5 + ma5 * mb8
  );
}

export function calculateSelrect(points, center) {
  const p1 = points[0];
  const p2 = points[1];
  const p4 = points[3];

  const width = mth.hypot(p2.x - p1.x, p2.y - p1.y);
  const height = mth.hypot(p1.x - p4.x, p1.y - p4.y);

  return grc.centerToRect(center, width, height);
}

export function calculateTransform(points, center, selrect) {
  let transform = transformPointsMatrix(selrect, points);

  if (transform != null) {
    transform = gmt.multiply(
      gmt.translateMatrixNeg(center),
      transform
    );
    transform = gmt.multiply(
      transform,
      gmt.translateMatrix(center)
    );
  }

  if (gmt.isMatrix(transform)) {
    if (gmt.isUnit(transform)) return gmt.base;
    return transform;
  }
  return undefined;
}

export function calculateGeometry(points) {
  const center = gco.pointsToCenter(points);
  const selrect = calculateSelrect(points, center);
  const transform = calculateTransform(points, center, selrect);
  return [selrect, transform, transform != null ? gmt.inverse(transform) : undefined];
}

function adjustShapeFlips(shape, points) {
  const oldPoints = shape.points;
  const p0Old = oldPoints[0];
  const p0New = points[0];

  const xv1 = gpt.toVec(p0Old, oldPoints[1]);
  const xv2 = gpt.toVec(p0New, points[1]);
  const dotX = gpt.dot(xv1, xv2);

  const yv1 = gpt.toVec(p0Old, oldPoints[3]);
  const yv2 = gpt.toVec(p0New, points[3]);
  const dotY = gpt.dot(yv1, yv2);

  let result = { ...shape };
  if (dotX < 0) result.flipX = !result.flipX;
  if (dotY < 0) result.flipY = !result.flipY;
  if ((dotX < 0) !== (dotY < 0)) {
    result.rotation = -(result.rotation ?? 0);
  }
  return result;
}

function applyTransformMove(shape, transformMtx) {
  const type = shape.type;
  const points = gco.transformPoints(shape.points, transformMtx);
  const selrect = gco.transformSelrect(shape.selrect, transformMtx);

  let result = { ...shape };
  if (type === 'text') {
    result['position-data'] = transformPositionData(result['position-data'], transformMtx);
  }
  if (type !== 'path' && type !== 'bool') {
    result.x = selrect.x;
    result.y = selrect.y;
    result.width = selrect.width;
    result.height = selrect.height;
  }

  result.selrect = selrect;
  result.points = points;
  return result;
}

function applyTransformGeneric(shape, transformMtx) {
  const points = gco.transformPoints(shape.points, transformMtx);

  let result = adjustShapeFlips(shape, points);

  const center = gco.pointsToCenter(points);
  const selrect = calculateSelrect(points, center);

  const calcTransform = calculateTransform(points, center, selrect);
  const calcInverse = calcTransform != null ? gmt.inverse(calcTransform) : undefined;

  const finalTransform = (calcTransform != null && calcInverse != null)
    ? calcTransform
    : (result.transform ?? gmt.matrix());
  const finalInverse = (calcTransform != null && calcInverse != null)
    ? calcInverse
    : (result['transform-inverse'] ?? gmt.matrix());

  const type = result.type;
  const rotation = ((d.nilv(result.rotation, 0) + d.nilv(result.modifiers?.rotation, 0)) % 360 + 360) % 360;

  if (type !== 'path' && type !== 'bool') {
    result.x = selrect.x;
    result.y = selrect.y;
    result.width = selrect.width;
    result.height = selrect.height;
  }

  result.transform = finalTransform;
  result['transform-inverse'] = finalInverse;
  result.selrect = selrect;
  result.points = points;
  result.rotation = rotation;
  return result;
}

export function applyTransform(shape, transformMtx) {
  if (transformMtx == null) return shape;
  if (gmt.isMove(transformMtx)) return applyTransformMove(shape, transformMtx);
  return applyTransformGeneric(shape, transformMtx);
}

function updateGroupViewbox(group, newSelrect) {
  const { selrect, 'svg-viewbox': svgViewbox } = group;
  let result = { ...group };
  if (svgViewbox != null && selrect != null && newSelrect != null) {
    const deltas = {
      x: (newSelrect.x ?? 0) - (selrect.x ?? 0),
      y: (newSelrect.y ?? 0) - (selrect.y ?? 0),
      width: (newSelrect.width ?? 1) - (selrect.width ?? 1),
      height: (newSelrect.height ?? 1) - (selrect.height ?? 1),
    };
    result['svg-viewbox'] = {
      x: svgViewbox.x + deltas.x,
      y: svgViewbox.y + deltas.y,
      width: svgViewbox.width + deltas.width,
      height: svgViewbox.height + deltas.height,
    };
  }
  return result;
}

export function updateGroupSelrect(group, children) {
  let points = children.flatMap((c) => c.points ?? []);
  const shapeCenter = gco.pointsToCenter(points);

  if (points.length === 0) points = group.points ?? [];

  const transformInverse = group['transform-inverse'] ?? gmt.matrix();
  const transform = group.transform ?? gmt.matrix();

  const basePoints = gco.transformPoints(points, shapeCenter, transformInverse);
  const newPoints = gco.transformPoints(
    grc.rectToPoints(grc.pointsToRect(basePoints)),
    shapeCenter,
    transform
  );

  const srTransform = gmt.transformIn(gco.pointsToCenter(newPoints), transformInverse);
  const newSelrect = grc.pointsToRect(gco.transformPoints(newPoints, srTransform));

  let result = updateGroupViewbox(group, newSelrect);
  result.selrect = newSelrect;
  result.points = newPoints;
  result.flipX = false;
  result.flipY = false;
  return applyTransform(result, gmt.matrix());
}

export function updateMaskSelrect(maskedGroup, children) {
  const mask = children[0];
  if (!mask) return maskedGroup;
  return {
    ...maskedGroup,
    selrect: mask.selrect,
    points: mask.points,
    x: mask.selrect?.x,
    y: mask.selrect?.y,
    width: mask.selrect?.width,
    height: mask.selrect?.height,
    flipX: mask.flipX,
    flipY: mask.flipY,
  };
}

export function updateShapesGeometry(objects, ids) {
  let result = { ...objects };
  for (const id of ids) {
    const shape = result[id];
    if (!shape) continue;

    const children = getImmediateChildren(result, id);
    let updated;
    if (maskShapeQ(shape)) {
      updated = updateMaskSelrect(shape, children);
    } else if (boolShapeQ(shape)) {
      updated = shape;
    } else if (groupShapeQ(shape)) {
      updated = updateGroupSelrect(shape, children);
    } else {
      updated = shape;
    }
    result = { ...result, [id]: updated };
  }
  return result;
}

function getImmediateChildren(objects, parentId) {
  const parent = objects[parentId];
  if (!parent || !parent.shapes) return [];
  return parent.shapes.map((id) => objects[id]).filter(Boolean);
}

function maskShapeQ(shape) {
  return shape.type === 'mask';
}

function boolShapeQ(shape) {
  return shape.type === 'bool';
}

function groupShapeQ(shape) {
  return shape.type === 'group' || shape.type === 'mask' || shape.type === 'bool';
}

function rootQ(shape) {
  return shape.parentId == null || shape.parentId === '00000000-0000-0000-0000-000000000000';
}

function groupLikeShapeQ(shape) {
  return shape.type === 'group' || shape.type === 'mask' || shape.type === 'bool' || shape.type === 'frame';
}

export function transformShape(shape, modifiers) {
  if (arguments.length === 1) {
    modifiers = shape.modifiers;
    shape = { ...shape };
    delete shape.modifiers;
    return transformShape(shape, modifiers);
  }

  if (shape == null || modifiers == null || ctm.isEmpty(modifiers)) return shape;

  const transform = ctm.modifiersToTransform(modifiers);
  let result = shape;

  if (transform != null && !rootQ(shape)) {
    result = applyTransform(result, transform);
  }

  if (ctm.hasStructure(modifiers)) {
    result = ctm.applyStructureModifiers(result, modifiers);
  }

  return result;
}

export function applyObjectsModifiers(objects, modifiers, ids) {
  if (ids === undefined) ids = Object.keys(modifiers);
  let result = { ...objects };
  for (const id of ids) {
    const modifier = modifiers[id]?.modifiers;
    result = { ...result, [id]: transformShape(result[id], modifier) };
  }
  return result;
}

export function transformBounds(points, center, modifiers) {
  if (center === undefined && modifiers == null) return points;
  const transform = ctm.modifiersToTransform(modifiers);
  if (transform == null) return points;
  return gco.transformPoints(points, center, transform);
}

export function transformSelrect(selrect, modifiers) {
  return grc.pointsToRect(
    transformBounds(grc.rectToPoints(selrect), modifiers)
  );
}

export function transformSelrectMatrix(selrect, mtx) {
  return grc.pointsToRect(
    gco.transformPoints(grc.rectToPoints(selrect), mtx)
  );
}

export function applyChildrenModifiers(objects, modifTree, parentModifiers, children, propagateQ) {
  return children.map((child) => {
    let modifiers = modifTree?.[child.id]?.modifiers;
    if (propagateQ) modifiers = ctm.addModifiers(modifiers, parentModifiers);
    let result = transformShape(child, modifiers);
    const parentQ = groupLikeShapeQ(result);

    if (parentQ) {
      result = applyGroupModifiers(objects, modifTree, propagateQ, result);
    }
    return result;
  });
}

export function applyGroupModifiers(group, objects, modifTree, propagateQ) {
  if (propagateQ === undefined) propagateQ = true;
  if (!group || !group.shapes) return group;

  const modifiers = modifTree?.[group.id]?.modifiers;
  const children = group.shapes
    .map((id) => objects[id])
    .filter(Boolean);
  const updatedChildren = applyChildrenModifiers(objects, modifTree, modifiers, children, propagateQ);

  if (maskShapeQ(group)) return updateMaskSelrect(group, updatedChildren);
  if (boolShapeQ(group)) return transformShape(group, modifiers);
  if (groupShapeQ(group)) return updateGroupSelrect(group, updatedChildren);
  return group;
}