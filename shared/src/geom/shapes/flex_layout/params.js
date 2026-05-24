import * as d from '../../../data.js';
import * as gpt from '../../point.js';
import * as gco from '../common.js';
import * as mth from '../../../math.js';
import * as ctt from '../../../types/shape_tree.js';

export function calculateParams(objects, shapes, parent) {
  if (!d.notEmpty(shapes)) return null;

  const visibleShapes = shapes.filter(s => !s.hidden);

  const points = ctt.sortZIndex(objects, visibleShapes.map(s => s.id))
    .map(id => gco.shapeToCenter(objects[id]));

  const start = points[0];
  if (!start) return null;

  const end = points.slice(1).reduce((acc, p) => gpt.add(acc, gpt.toVec(start, p)), start);

  let angle = gpt.signedAngleWithOther(gpt.toVec(start, end), gpt.point(1, 0));
  angle = ((angle % 360) + 360) % 360;

  const t1 = Math.min(Math.abs(angle - 0), Math.abs(angle - 360));
  const t2 = Math.abs(angle - 90);
  const t3 = Math.abs(angle - 180);
  const t4 = Math.abs(angle - 270);
  const tmin = Math.min(t1, t2, t3, t4);

  let direction;
  if (mth.close(tmin, t1)) direction = 'row';
  else if (mth.close(tmin, t2)) direction = 'column-reverse';
  else if (mth.close(tmin, t3)) direction = 'row-reverse';
  else direction = 'column';

  const selrects = visibleShapes.map(s => s.selrect);
  const minX = Math.min(...selrects.map(r => Math.min(r.x1, r.x2)));
  const maxX = Math.max(...selrects.map(r => Math.max(r.x1, r.x2)));
  const allWidth = selrects.reduce((acc, r) => acc + r.width, 0);

  const columnGap = (visibleShapes.length > 1 && (direction === 'row' || direction === 'row-reverse'))
    ? Math.max(0, (maxX - minX - allWidth) / (visibleShapes.length - 1))
    : 0;

  const minY = Math.min(...selrects.map(r => Math.min(r.y1, r.y2)));
  const maxY = Math.max(...selrects.map(r => Math.max(r.y1, r.y2)));
  const allHeight = selrects.reduce((acc, r) => acc + r.height, 0);

  const rowGap = (visibleShapes.length > 1 && (direction === 'column' || direction === 'column-reverse'))
    ? Math.max(0, (maxY - minY - allHeight) / (visibleShapes.length - 1))
    : 0;

  const layoutGap = { 'row-gap': Math.max(rowGap, 0), 'column-gap': Math.max(columnGap, 0) };
  const parentSelrect = parent?.selrect;

  const padding = (parent != null && visibleShapes.length > 0)
    ? { p1: minY - (parentSelrect?.y1 ?? 0), p2: minX - (parentSelrect?.x1 ?? 0) }
    : null;

  const result = { 'layout-flex-dir': direction, 'layout-gap': layoutGap };

  if (padding) {
    result['layout-padding'] = { p1: padding.p1, p2: padding.p2, p3: padding.p1, p4: padding.p2 };
  }

  return result;
}