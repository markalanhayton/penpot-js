import * as d from '../../../data.js';
import * as gpt from '../../point.js';
import * as gpo from '../points.js';

export function layoutContentPoints(bounds, parent, layoutData) {
  const parentId = parent.id;
  const parentBounds = bounds.get(parentId);

  const { rowTracks, columnTracks } = layoutData;

  const hvFn = (val) => gpo.startHv(parentBounds, val);
  const vvFn = (val) => gpo.startVv(parentBounds, val);

  const rowPoints = rowTracks.flatMap(track => [
    track.startP,
    gpt.add(track.startP, vvFn(track.size)),
  ]);

  const colPoints = columnTracks.flatMap(track => [
    track.startP,
    gpt.add(track.startP, hvFn(track.size)),
  ]);

  return [...rowPoints, ...colPoints];
}

export function layoutContentBounds(bounds, parent, layoutData) {
  if (!layoutData) return bounds.get(parent.id);

  const parentId = parent.id;
  const parentBounds = bounds.get(parentId);

  const layoutPoints = layoutContentPoints(bounds, parent, layoutData);

  if (d.notEmpty(layoutPoints)) {
    return gpo.padPoints(
      gpo.mergeParentCoordsBounds(layoutPoints, parentBounds),
      -(parent['layout-padding']?.p1 ?? 0),
      -(parent['layout-padding']?.p2 ?? 0),
      -(parent['layout-padding']?.p3 ?? 0),
      -(parent['layout-padding']?.p4 ?? 0)
    );
  }

  return parentBounds;
}

export function calculateGridLayoutBounds(bounds, shape, layoutData) {
  return layoutContentBounds(bounds, shape, layoutData);
}