import * as gpt from '../../point.js';
import * as gpo from '../points.js';
import * as mth from '../../../math.js';
import * as ctm from '../../../modifiers.js';
import * as ctl from '../../../types/shape/layout.js';
import * as flp from './positions.js';
import * as gtr from '../transforms.js';

function calcFillWidthData(parent, transform, transformInverse, child, childOrigin, childWidth, layoutData) {
  const { childrenData, lineWidth, toBoundWidth } = layoutData;

  if (ctl.rowQ(parent)) {
    const targetWidth = Math.max((childrenData[child.id]?.childWidth) ?? 0.01, 0.01);
    const fillScale = targetWidth / childWidth;
    return {
      width: targetWidth,
      modifiers: ctm.resizeModifiers(gpt.point(fillScale, 1), childOrigin, transform, transformInverse),
    };
  }

  if (ctl.colQ(parent)) {
    const effectiveLineWidth = Math.min(lineWidth, toBoundWidth ?? lineWidth);
    const targetWidth = Math.max(effectiveLineWidth - ctl.childWidthMargin(child), 0.01);
    const maxWidth = Math.max(ctl.childMaxWidth(child), 0.01);
    const childMinW = childrenData[child.id]?.childMinWidth ?? 0.01;
    const clampedWidth = mth.clamp(targetWidth, childMinW, maxWidth);
    const fillScale = clampedWidth / childWidth;
    return {
      width: clampedWidth,
      modifiers: ctm.resizeModifiers(gpt.point(fillScale, 1), childOrigin, transform, transformInverse),
    };
  }

  return null;
}

function calcFillHeightData(parent, transform, transformInverse, child, childOrigin, childHeight, layoutData) {
  const { childrenData, lineHeight, toBoundHeight } = layoutData;

  if (ctl.colQ(parent)) {
    const targetHeight = Math.max((childrenData[child.id]?.childHeight) ?? 0.01, 0.01);
    const fillScale = targetHeight / childHeight;
    return {
      height: targetHeight,
      modifiers: ctm.resizeModifiers(gpt.point(1, fillScale), childOrigin, transform, transformInverse),
    };
  }

  if (ctl.rowQ(parent)) {
    const effectiveLineHeight = Math.min(lineHeight, toBoundHeight ?? lineHeight);
    const targetHeight = Math.max(effectiveLineHeight - ctl.childHeightMargin(child), 0.01);
    const maxHeight = Math.max(ctl.childMaxHeight(child), 0.01);
    const childMinH = childrenData[child.id]?.childMinHeight ?? 0.01;
    const clampedHeight = mth.clamp(targetHeight, childMinH, maxHeight);
    const fillScale = clampedHeight / childHeight;
    return {
      height: clampedHeight,
      modifiers: ctm.resizeModifiers(gpt.point(1, fillScale), childOrigin, transform, transformInverse),
    };
  }

  return null;
}

function fillModifiers(parent, parentBounds, child, childBounds, layoutLine) {
  const childOrigin = gpo.origin(childBounds);
  const childWidth = gpo.widthPoints(childBounds);
  const childHeight = gpo.heightPoints(childBounds);

  const shouldFill = ctl.fillWidthQ(child) || ctl.fillHeightQ(child);
  const [, transform, transformInverse] = shouldFill ? gtr.calculateGeometry(parentBounds) : [null, null, null];

  const fillWidth = ctl.fillWidthQ(child)
    ? calcFillWidthData(parent, transform, transformInverse, child, childOrigin, childWidth, layoutLine)
    : null;

  const fillHeight = ctl.fillHeightQ(child)
    ? calcFillHeightData(parent, transform, transformInverse, child, childOrigin, childHeight, layoutLine)
    : null;

  const finalWidth = fillWidth?.width ?? childWidth;
  const finalHeight = fillHeight?.height ?? childHeight;

  let mods = ctm.empty();
  if (fillWidth) mods = ctm.addModifiers(mods, fillWidth.modifiers);
  if (fillHeight) mods = ctm.addModifiers(mods, fillHeight.modifiers);

  return [finalWidth, finalHeight, mods];
}

export function layoutChildModifiers(parent, parentBounds, child, childBounds, layoutLine) {
  const childOrigin = gpo.origin(childBounds);

  const [childWidth, childHeight, fillMods] = fillModifiers(parent, parentBounds, child, childBounds, layoutLine);

  const [cornerP, newLayoutLine] = flp.getChildPosition(parent, child, childWidth, childHeight, layoutLine);
  const moveVec = gpt.toVec(childOrigin, cornerP);

  const modifiers = ctm.addModifiers(ctm.empty(), fillMods);
  const finalModifiers = ctm.move(modifiers, moveVec);

  return [finalModifiers, newLayoutLine];
}