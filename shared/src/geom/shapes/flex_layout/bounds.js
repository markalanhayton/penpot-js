import * as d from '../../../data.js';
import * as gpt from '../../point.js';
import * as gpo from '../points.js';
import * as ctl from '../../../types/shape/layout.js';

let childMinWidthFn = null;
let childMinHeightFn = null;

export function setChildMinWidthFn(fn) { childMinWidthFn = fn; }
export function setChildMinHeightFn(fn) { childMinHeightFn = fn; }

function callChildMinWidth(child, childBounds, bounds, objects) {
  return childMinWidthFn ? childMinWidthFn(child, childBounds, bounds, objects) : 0.01;
}

function callChildMinHeight(child, childBounds, bounds, objects) {
  return childMinHeightFn ? childMinHeightFn(child, childBounds, bounds, objects) : 0.01;
}

export function childLayoutBoundPoints(parent, child, parentBounds, childBounds, correctV, bounds, objects) {
  if (correctV === undefined) correctV = gpt.point(0, 0);

  const row = ctl.rowQ(parent);
  const col = ctl.colQ(parent);

  const vStart = ctl.vStartQ(parent);
  const vCenter = ctl.vCenterQ(parent);
  const vEnd = ctl.vEndQ(parent);
  const hStart = ctl.hStartQ(parent);
  const hCenter = ctl.hCenterQ(parent);
  const hEnd = ctl.hEndQ(parent);

  let baseP = gpo.origin(childBounds);
  const width = gpo.widthPoints(childBounds);
  const height = gpo.heightPoints(childBounds);

  const minW = Math.max(callChildMinWidth(child, childBounds, bounds, objects), 0.01);
  const minH = Math.max(callChildMinHeight(child, childBounds, bounds, objects), 0.01);

  if (row && vCenter) baseP = gpt.add(baseP, gpo.startVv(parentBounds, height / 2));
  if (row && vEnd) baseP = gpt.add(baseP, gpo.startVv(parentBounds, height));
  if (col && hCenter) baseP = gpt.add(baseP, gpo.startHv(parentBounds, width / 2));
  if (col && hEnd) baseP = gpt.add(baseP, gpo.startHv(parentBounds, width));

  baseP = gpt.add(baseP, correctV);

  const result = [baseP, gpt.add(baseP, gpo.startHv(parentBounds, 0.01)), gpt.add(baseP, gpo.startVv(parentBounds, 0.01))];

  if (col) result.push(gpt.add(baseP, gpo.startVv(parentBounds, minH)));
  if (row) result.push(gpt.add(baseP, gpo.startHv(parentBounds, minW)));

  if (col && hStart) result.push(gpt.add(baseP, gpo.startHv(parentBounds, minW)));
  if (col && hCenter) {
    result.push(gpt.add(baseP, gpo.startHv(parentBounds, minW / 2)));
    result.push(gpt.subtract(baseP, gpo.startHv(parentBounds, minW / 2)));
  }
  if (col && hEnd) result.push(gpt.subtract(baseP, gpo.startHv(parentBounds, minW)));

  if (row && vStart) result.push(gpt.add(baseP, gpo.startVv(parentBounds, minH)));
  if (row && vCenter) {
    result.push(gpt.add(baseP, gpo.startVv(parentBounds, minH / 2)));
    result.push(gpt.subtract(baseP, gpo.startVv(parentBounds, minH / 2)));
  }
  if (row && vEnd) result.push(gpt.subtract(baseP, gpo.startVv(parentBounds, minH)));

  let newCorrectV = correctV;
  if (row && ctl.fillWidthQ(child)) {
    newCorrectV = gpt.subtract(newCorrectV, gpo.startHv(parentBounds, width + minW));
  }
  if (col && ctl.fillHeightQ(child)) {
    newCorrectV = gpt.subtract(newCorrectV, gpo.startVv(parentBounds, height + minH));
  }

  return [result, newCorrectV];
}

export function layoutContentPoints(bounds, parent, children, objects) {
  const parentId = parent.id;
  const parentBounds = bounds.get(parentId);
  const reverse = ctl.reverseQ(parent);
  const sortedChildren = reverse ? [...children].reverse() : children;

  let correctV = gpt.point(0, 0);
  const allPoints = [];

  for (const child of sortedChildren) {
    const childId = child.id;
    const childBounds = bounds.get(childId);
    if (!childBounds) continue;

    const [marginTop, marginRight, marginBottom, marginLeft] = ctl.childMargins(child);
    let childPoints;

    if (ctl.fillWidthQ(child) || ctl.fillHeightQ(child)) {
      const [pts, newCorrectV] = childLayoutBoundPoints(parent, child, parentBounds, childBounds, correctV, bounds, objects);
      childPoints = pts;
      correctV = newCorrectV;
    } else {
      childPoints = childBounds.map(p => gpt.add(p, correctV));
    }

    if (childPoints && childPoints.length > 0) {
      const boundsResult = gpo.parentCoordsBounds(childPoints, parentBounds);
      const paddedBounds = gpo.padPoints(boundsResult, -marginTop, -marginRight, -marginBottom, -marginLeft);
      allPoints.push(paddedBounds);
    }
  }

  return allPoints;
}

export function layoutContentBounds(bounds, parent, children, objects) {
  const parentId = parent.id;
  const parentBounds = bounds.get(parentId);

  const row = ctl.rowQ(parent);
  const col = ctl.colQ(parent);
  const spaceAround = ctl.spaceAroundQ(parent);
  const spaceEvenly = ctl.spaceEvenlyQ(parent);
  const contentEvenly = ctl.contentEvenlyQ(parent);
  const contentStretch = ctl.contentStretchQ(parent);

  const allPoints = layoutContentPoints(bounds, parent, children, objects);

  if (!d.notEmpty(allPoints)) return parentBounds;

  let result = allPoints[0];
  for (let i = 1; i < allPoints.length; i++) {
    result = gpo.parentCoordsBounds([...result, ...allPoints[i]], parentBounds);
  }

  return result;
}

export function calculateFlexLayout(bounds, shape, children, objects, boundsMap, _modifTree) {
  return layoutContentBounds(boundsMap ?? bounds, shape, children, objects);
}