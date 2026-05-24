import * as d from '../../data.js';
import * as gmt from '../matrix.js';
import * as gpt from '../point.js';
import * as grc from '../rect.js';
import * as gco from './common.js';
import * as gtr from './transforms.js';
import * as ctm from '../../modifiers.js';

function getImmediateChildren(objects, parentId) {
  const parent = objects[parentId];
  if (!parent || !parent.shapes) return [];
  return parent.shapes.map((id) => objects[id]).filter(Boolean);
}

function getChildrenIds(objects, parentId) {
  const ids = [];
  const stack = [parentId];
  while (stack.length > 0) {
    const currentId = stack.pop();
    ids.push(currentId);
    const shape = objects[currentId];
    if (shape && shape.shapes) {
      for (const childId of shape.shapes) {
        stack.push(childId);
      }
    }
  }
  return ids;
}

function getShapeBounds(objects, shape) {
  return shape.selrect;
}

export function fitFrameModifiers(objects, frame) {
  const { id, transform, 'transform-inverse': transformInverse, selrect, points, 'show-content': showContent } = frame;
  const children = getImmediateChildren(objects, id);
  if (!d.notEmpty(children)) return undefined;

  const ids = getChildrenIds(objects, id);
  const center = gco.shapeToCenter(frame);

  const effectiveTransformInverse = transformInverse != null ? gmt.transformIn(center, transformInverse) : undefined;
  const effectiveTransform = transform != null ? gmt.transformIn(center, transform) : undefined;

  let trObjects = { ...objects };
  if (effectiveTransformInverse != null) {
    for (const oid of ids) {
      if (trObjects[oid]) {
        trObjects = { ...trObjects, [oid]: gtr.applyTransform(trObjects[oid], effectiveTransformInverse) };
      }
    }
  }

  const bounds = grc.joinRects(
    children.map((c) => {
      const updated = trObjects[c.id ?? c];
      return updated ? getShapeBounds(objects, updated) : undefined;
    }).filter(Boolean)
  );

  if (!bounds) return undefined;

  const newOrigin = gpt.transform(gpt.point(bounds), effectiveTransform ?? gmt.matrix());
  const origin = points[0];
  const resizeV = gpt.point(
    bounds.width / selrect.width,
    bounds.height / selrect.height
  );

  return ctm.move(
    ctm.resizeParent(ctm.empty(), resizeV, origin, effectiveTransform, effectiveTransformInverse),
    gpt.toVec(origin, newOrigin)
  );
}