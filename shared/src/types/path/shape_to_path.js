import * as d from '../../data.js';
import * as gpt from '../../geom/point.js';
import * as gmt from '../../geom/matrix.js';
import * as gco from '../../geom/shapes/common.js';
import * as gso from '../../geom/shapes/corners.js';
import * as ctsr from '../shape/radius.js';
import * as bool from './bool.js';
import * as helpers from './helpers.js';
import * as pathImpl from './impl.js';
import * as segm from './segment.js';

const BEZIER_CIRCLE_C = 0.551915024494;
const DISOC_ATTRS = ['x', 'y', 'width', 'height', 'rx', 'ry', 'r1', 'r2', 'r3', 'r4', 'metadata'];

export function withoutPositionAttrs(shape) {
  return d.withoutKeys(shape, DISOC_ATTRS);
}

function makeCornerArc(from, to, corner, radius) {
  let x, y;
  switch (corner) {
    case 'top-left': x = from.x; y = from.y - radius; break;
    case 'top-right': x = from.x - radius; y = from.y; break;
    case 'bottom-right': x = from.x - radius; y = from.y - 2 * radius; break;
    case 'bottom-left': x = from.x; y = from.y - radius; break;
  }

  const width = radius * 2;
  const height = radius * 2;
  const c = BEZIER_CIRCLE_C;
  const c1x = x + (width / 2) * (1 - c);
  const c2x = x + (width / 2) * (1 + c);
  const c1y = y + (height / 2) * (1 - c);
  const c2y = y + (height / 2) * (1 + c);

  let h1, h2;
  switch (corner) {
    case 'top-left': h1 = { ...from, y: c1y }; h2 = { ...to, x: c1x }; break;
    case 'top-right': h1 = { ...from, x: c2x }; h2 = { ...to, y: c1y }; break;
    case 'bottom-right': h1 = { ...from, y: c2y }; h2 = { ...to, x: c2x }; break;
    case 'bottom-left': h1 = { ...from, x: c1x }; h2 = { ...to, y: c2y }; break;
  }

  return helpers.makeCurveTo(to, h1, h2);
}

export function circleToPath({ x, y, width, height }) {
  const mx = x + width / 2;
  const my = y + height / 2;
  const ex = x + width;
  const ey = y + height;
  const p1 = gpt.point(mx, y);
  const p2 = gpt.point(ex, my);
  const p3 = gpt.point(mx, ey);
  const p4 = gpt.point(x, my);
  const c = BEZIER_CIRCLE_C;
  const c1x = x + (width / 2) * (1 - c);
  const c2x = x + (width / 2) * (1 + c);
  const c1y = y + (height / 2) * (1 - c);
  const c2y = y + (height / 2) * (1 + c);
  return [
    helpers.makeMoveTo(p1),
    helpers.makeCurveTo(p2, { ...p1, x: c2x }, { ...p2, y: c1y }),
    helpers.makeCurveTo(p3, { ...p2, y: c2y }, { ...p3, x: c2x }),
    helpers.makeCurveTo(p4, { ...p3, x: c1x }, { ...p4, y: c2y }),
    helpers.makeCurveTo(p1, { ...p4, y: c1y }, { ...p1, x: c1x }),
  ];
}

export function drawRoundedRectPath(x, y, width, height, r1, r2, r3, r4) {
  if (r2 === undefined) { r2 = r1; r3 = r1; r4 = r1; }
  const p1 = gpt.point(x, y + r1);
  const p2 = gpt.point(x + r1, y);
  const p3 = gpt.point(x + width - r2, y);
  const p4 = gpt.point(x + width, y + r2);
  const p5 = gpt.point(x + width, y + height - r3);
  const p6 = gpt.point(x + width - r3, y + height);
  const p7 = gpt.point(x + r4, y + height);
  const p8 = gpt.point(x, y + height - r4);

  const result = [helpers.makeMoveTo(p1)];
  if (p1.x !== p2.x || p1.y !== p2.y) result.push(makeCornerArc(p1, p2, 'top-left', r1));
  result.push(helpers.makeLineTo(p3));
  if (p3.x !== p4.x || p3.y !== p4.y) result.push(makeCornerArc(p3, p4, 'top-right', r2));
  result.push(helpers.makeLineTo(p5));
  if (p5.x !== p6.x || p5.y !== p6.y) result.push(makeCornerArc(p5, p6, 'bottom-right', r3));
  result.push(helpers.makeLineTo(p7));
  if (p7.x !== p8.x || p7.y !== p8.y) result.push(makeCornerArc(p7, p8, 'bottom-left', r4));
  result.push(helpers.makeLineTo(p1));
  return result;
}

function rectToPath(shape) {
  const { x, y, width, height } = shape;
  switch (ctsr.radiusMode(shape)) {
    case 'radius-1': {
      const radius = gso.shapeCorners1(shape);
      return drawRoundedRectPath(x, y, width, height, radius);
    }
    case 'radius-4': {
      const [r1, r2, r3, r4] = gso.shapeCorners4(shape);
      return drawRoundedRectPath(x, y, width, height, r1, r2, r3, r4);
    }
    default: return [];
  }
}

function fixFirstRelative(content) {
  if (content.length > 0 && content[0].relative) {
    content[0] = { ...content[0], relative: false };
  }
  return content;
}

function groupToPath(group, objects) {
  const childAsPaths = (group.shapes || [])
    .map(id => objects[id])
    .filter(Boolean)
    .map(s => convertToPath(s, objects));

  const head = childAsPaths[childAsPaths.length - 1];
  const headData = head ? d.pick(head, [...bool.STYLE_PROPERTIES]) : {};

  const content = childAsPaths
    .filter(s => s.type === 'path')
    .flatMap(s => fixFirstRelative(Array.from(s.content)));

  return {
    ...d.withoutKeys({ ...group, type: 'path', content: pathImpl.fromPlain(content), ...headData }, DISOC_ATTRS),
  };
}

function boolToPath(shape, objects) {
  const children = (shape.shapes || [])
    .map(id => objects[id])
    .filter(Boolean)
    .map(s => convertToPath(s, objects));

  const content = pathImpl.fromPlain(
    bool.calculateContent(shape.boolType, children.map(c => Array.from(c.content)))
  );

  return d.withoutKeys({
    ...shape,
    type: 'path',
    content,
  }, [...DISOC_ATTRS, 'boolType']);
}

export function convertToPath(shape, objects) {
  if (!objects) objects = {};
  const type = shape.type;

  if (type === 'group' || type === 'frame') {
    return groupToPath(shape, objects);
  }

  if (type === 'bool') {
    return boolToPath(shape, objects);
  }

  if (type === 'rect' || type === 'circle' || type === 'image' || type === 'text') {
    let content = type === 'circle' ? circleToPath(shape) : rectToPath(shape);
    content = pathImpl.fromPlain(content);

    let transform = shape.transform || gmt.matrix();
    if (shape.flipX) transform = gmt.scale(transform, gpt.point(-1, 1));
    if (shape.flipY) transform = gmt.scale(transform, gpt.point(1, -1));

    if (transform) {
      content = segm.transformContent(content, gmt.transformIn(gco.shapeToCenter(shape), transform));
    }

    const result = {
      ...shape,
      type: 'path',
      content,
    };
    if (type === 'image') result.fillImage = shape.metadata;
    return d.withoutKeys(result, DISOC_ATTRS);
  }

  return shape;
}