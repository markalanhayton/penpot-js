import * as gmt from '../matrix.js';
import * as gpt from '../point.js';
import * as gco from './common.js';
import * as gsi from './intersect.js';
import * as gpo from './points.js';
import * as gtr from './transforms.js';
import * as mth from '../../math.js';
import * as ctm from '../../modifiers.js';
import { zero as uuidZero } from '../../uuid.js';

export function otherAxis(axis) {
  return axis === 'x' ? 'y' : 'x';
}

export function getDeltaStart(axis, rect, trRect) {
  return axis === 'x'
    ? trRect.x1 - rect.x1
    : trRect.y1 - rect.y1;
}

export function getDeltaEnd(axis, rect, trRect) {
  return axis === 'x'
    ? trRect.x2 - rect.x2
    : trRect.y2 - rect.y2;
}

export function getDeltaSize(axis, rect, trRect) {
  return axis === 'x'
    ? trRect.width - rect.width
    : trRect.height - rect.height;
}

export function getDeltaScale(axis, rect, trRect) {
  return axis === 'x'
    ? trRect.width / rect.width
    : trRect.height / rect.height;
}

export function getDeltaCenter(axis, center, trCenter) {
  return axis === 'x'
    ? trCenter.x - center.x
    : trCenter.y - center.y;
}

export function getDisplacement(axis, delta, initX = 0, initY = 0) {
  return axis === 'x'
    ? gpt.point(initX + delta, initY)
    : gpt.point(initX, initY + delta);
}

export function getScale(axis, scale) {
  return axis === 'x'
    ? gpt.point(scale, 1)
    : gpt.point(1, scale);
}

export function getSize(axis, rect) {
  return axis === 'x' ? rect.width : rect.height;
}

export function rightVector(childPoints, parentPoints) {
  const [, p1, p2] = parentPoints;
  const [, c1] = childPoints;
  const dirV = gpt.toVec(parentPoints[0], p1);
  const cp = gsi.lineLineIntersect(c1, gpt.add(c1, dirV), p1, p2);
  return gpt.toVec(c1, cp);
}

export function leftVector(childPoints, parentPoints) {
  const [p0, , , p3] = parentPoints;
  const [, , , c3] = childPoints;
  const dirV = gpt.toVec(p0, parentPoints[1]);
  const cp = gsi.lineLineIntersect(c3, gpt.add(c3, dirV), p0, p3);
  return gpt.toVec(c3, cp);
}

export function topVector(childPoints, parentPoints) {
  const [p0, p1, , p3] = parentPoints;
  const [c0] = childPoints;
  const dirV = gpt.toVec(p0, p3);
  const cp = gsi.lineLineIntersect(c0, gpt.add(c0, dirV), p0, p1);
  return gpt.toVec(c0, cp);
}

export function bottomVector(childPoints, parentPoints) {
  const [p0, , p2, p3] = parentPoints;
  const [, , c2] = childPoints;
  const dirV = gpt.toVec(p0, p3);
  const cp = gsi.lineLineIntersect(c2, gpt.add(c2, dirV), p2, p3);
  return gpt.toVec(c2, cp);
}

export function centerHorizontalVector(childPoints, parentPoints) {
  const [p0, p1, , p3] = parentPoints;
  const [, c1] = childPoints;
  const dirV = gpt.toVec(p0, p1);

  const p1c = gpt.add(p0, gpt.scale(dirV, 0.5));
  const p2c = gpt.add(p3, gpt.scale(dirV, 0.5));
  const cp = gsi.lineLineIntersect(c1, gpt.add(c1, dirV), p1c, p2c);

  return gpt.toVec(c1, cp);
}

export function centerVerticalVector(childPoints, parentPoints) {
  const [p0, p1, p2] = parentPoints;
  const [, c1] = childPoints;
  const dirV = gpt.toVec(p1, p2);

  const p3c = gpt.add(p0, gpt.scale(dirV, 0.5));
  const p2c = gpt.add(p1, gpt.scale(dirV, 0.5));
  const cp = gsi.lineLineIntersect(c1, gpt.add(c1, dirV), p3c, p2c);

  return gpt.toVec(c1, cp);
}

export function startVector(axis, childPoints, parentPoints) {
  return axis === 'x'
    ? leftVector(childPoints, parentPoints)
    : topVector(childPoints, parentPoints);
}

export function endVector(axis, childPoints, parentPoints) {
  return axis === 'x'
    ? rightVector(childPoints, parentPoints)
    : bottomVector(childPoints, parentPoints);
}

export function centerVector(axis, childPoints, parentPoints) {
  return axis === 'x'
    ? centerHorizontalVector(childPoints, parentPoints)
    : centerVerticalVector(childPoints, parentPoints);
}

export function displacement(beforeV, afterV, beforeParentSideV, afterParentSideV) {
  const beforeAngl = gpt.angleWithOther(beforeV, beforeParentSideV);
  const afterAngl = gpt.angleWithOther(afterV, afterParentSideV);
  const sign = mth.close(beforeAngl, afterAngl) ? 1 : -1;
  const len = sign * gpt.length(beforeV);

  if (mth.almostZero(len)) return afterV;
  return gpt.subtract(afterV, gpt.scale(gpt.unit(afterV), len));
}

export function sideVector(axis, [c0, c1, , c3]) {
  return axis === 'x'
    ? gpt.toVec(c0, c1)
    : gpt.toVec(c0, c3);
}

export function sideVectorResize(axis, [c0, c1, , c3], startVec, endVec) {
  return axis === 'x'
    ? gpt.toVec(gpt.add(c0, startVec), gpt.add(c1, endVec))
    : gpt.toVec(gpt.add(c0, startVec), gpt.add(c3, endVec));
}

export const CONST_TO_TYPE_AXIS = new Map([
  ['left', 'start'],
  ['top', 'start'],
  ['right', 'end'],
  ['bottom', 'end'],
  ['leftright', 'fixed'],
  ['topbottom', 'fixed'],
  ['center', 'center'],
  ['scale', 'scale'],
]);

export function defaultConstraintsH(shape) {
  if (shape.parentId === uuidZero) return undefined;
  return shape.parentId === shape.frameId ? 'left' : 'scale';
}

export function defaultConstraintsV(shape) {
  if (shape.parentId === uuidZero) return undefined;
  return shape.parentId === shape.frameId ? 'top' : 'scale';
}

export function normalizeModifiers(constraintsH, constraintsV, modifiers, childBounds, transformedChildBounds, parentBounds, transformedParentBounds) {
  const childBBBefore = gpo.parentCoordsBounds(childBounds, parentBounds);
  const childBBAfter = gpo.parentCoordsBounds(transformedChildBounds, transformedParentBounds);

  const scaleX = constraintsH === 'scale'
    ? 1
    : gpo.widthPoints(childBBBefore) / Math.max(0.01, gpo.widthPoints(childBBAfter));

  const scaleY = constraintsV === 'scale'
    ? 1
    : gpo.heightPoints(childBBBefore) / Math.max(0.01, gpo.heightPoints(childBBAfter));

  const resizeVector = gpt.point(scaleX, scaleY);
  const resizeOrigin = gpo.origin(childBBAfter);

  const center = gco.pointsToCenter(childBBAfter);
  const selrect = gtr.calculateSelrect(childBBAfter, center);
  const transform = gtr.calculateTransform(childBBAfter, center, selrect);
  const transformInverse = transform != null ? gmt.inverse(transform) : undefined;

  return ctm.resize(modifiers, resizeVector, resizeOrigin, transform, transformInverse);
}

export function calcChildModifiers(parent, child, modifiers, ignoreConstraints, childBounds, parentBounds, transformedParentBounds) {
  modifiers = ctm.selectChild(modifiers);

  const constraintsH = ignoreConstraints
    ? 'scale'
    : (child.constraintsH ?? defaultConstraintsH(child));

  const constraintsV = ignoreConstraints
    ? 'scale'
    : (child.constraintsV ?? defaultConstraintsV(child));

  if (constraintsH === 'scale' && constraintsV === 'scale') return modifiers;

  modifiers = ctm.selectChild(modifiers);

  const resetModifiersQ =
    gpo.axisAlignedQ(parentBounds) &&
    gpo.axisAlignedQ(childBounds) &&
    gpo.axisAlignedQ(transformedParentBounds) &&
    constraintsH !== 'scale' &&
    constraintsV !== 'scale';

  const effectiveModifiers = resetModifiersQ
    ? ctm.empty()
    : normalizeModifiers(
        constraintsH, constraintsV, modifiers,
        childBounds, gtr.transformBounds(childBounds, modifiers),
        parentBounds, transformedParentBounds
      );

  const transformedChildBounds = resetModifiersQ
    ? childBounds
    : gtr.transformBounds(childBounds, effectiveModifiers);

  const childPointsBefore = gpo.parentCoordsBounds(childBounds, parentBounds);
  const childPointsAfter = gpo.parentCoordsBounds(transformedChildBounds, transformedParentBounds);

  const modifiersH = constraintModifier(CONST_TO_TYPE_AXIS.get(constraintsH), 'x',
    childPointsBefore, parentBounds, childPointsAfter, transformedParentBounds);
  const modifiersV = constraintModifier(CONST_TO_TYPE_AXIS.get(constraintsV), 'y',
    childPointsBefore, parentBounds, childPointsAfter, transformedParentBounds);

  return ctm.addModifiers(ctm.addModifiers(effectiveModifiers, modifiersH), modifiersV);
}