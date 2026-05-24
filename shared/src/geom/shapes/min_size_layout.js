import * as gpo from '../points.js';
import * as ctl from '../../types/shape/layout.js';

export function childMinWidth(child, childBounds, bounds, objects, strictQ) {
  if (strictQ === undefined) strictQ = false;

  if (!strictQ && ctl.fillWidthQ(child) && ctl.flexLayoutQ(child)) {
    return ctl.childMinWidth(child);
  }

  if (strictQ && ctl.fillWidthQ(child) && ctl.flexLayoutQ(child)) {
    return Math.max(ctl.childMinWidth(child), 0.01);
  }

  if (ctl.fillWidthQ(child) && ctl.gridLayoutQ(child)) {
    return Math.max(ctl.childMinWidth(child), 0.01);
  }

  if (ctl.fillWidthQ(child)) {
    return ctl.childMinWidth(child);
  }

  return gpo.widthPoints(childBounds);
}

export function childMaxWidth(child, _childBounds, _bounds, _objects, _strictQ) {
  if (ctl.fillWidthQ(child) && child?.['layout-item-max-w'] != null && child?.['layout-item-h-sizing'] === 'fill') {
    return Math.max(0.01, child['layout-item-max-w']);
  }
  return Infinity;
}

export function childMinHeight(child, childBounds, bounds, objects, strictQ) {
  if (strictQ === undefined) strictQ = false;

  if (!strictQ && ctl.fillHeightQ(child) && ctl.flexLayoutQ(child)) {
    return ctl.childMinHeight(child);
  }

  if (strictQ && ctl.fillHeightQ(child) && ctl.flexLayoutQ(child)) {
    return Math.max(ctl.childMinHeight(child), 0.01);
  }

  if (ctl.fillHeightQ(child) && ctl.gridLayoutQ(child)) {
    return Math.max(ctl.childMinHeight(child), 0.01);
  }

  if (ctl.fillHeightQ(child)) {
    return ctl.childMinHeight(child);
  }

  return gpo.heightPoints(childBounds);
}

export function childMaxHeight(child, _childBounds, _bounds, _objects, _strictQ) {
  if (ctl.fillHeightQ(child) && child?.['layout-item-max-h'] != null && child?.['layout-item-v-sizing'] === 'fill') {
    return Math.max(0.01, child['layout-item-max-h']);
  }
  return Infinity;
}