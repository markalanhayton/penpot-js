import * as d from '../data.js';
import * as gmt from '../geom/matrix.js';
import * as gpt from '../geom/point.js';
import * as grc from '../geom/rect.js';
import * as gco from '../geom/shapes/common.js';
import * as bool from './path/bool.js';
import * as helpers from './path/helpers.js';
import * as impl from './path/impl.js';
import * as segm from './path/segment.js';
import * as stp from './path/shape_to_path.js';
import * as subpath from './path/subpath.js';

export const BOOL_GROUP_STYLE_PROPERTIES = bool.GROUP_STYLE_PROPERTIES;
export const BOOL_STYLE_PROPERTIES = bool.STYLE_PROPERTIES;

export function getDefaultBoolFills() {
  return bool.getDefaultFills();
}

export function contentQ(o) {
  return impl.pathDataQ(o);
}

export function content(data) {
  return impl.pathData(data);
}

export function fromBytes(data) {
  return impl.fromBytes(data);
}

export function fromString(data) {
  return impl.fromString(data);
}

export function fromPlain(data) {
  return impl.fromPlain(data);
}

export function checkContent(contentVal) {
  return impl.pathDataQ(contentVal);
}

export function getByteSize(contentVal) {
  return contentVal.getByteSize();
}

export function writeTo(contentVal, buffer, offset) {
  contentVal.writeTo(buffer, offset);
}

export function closeSubpaths(contentVal) {
  return impl.fromPlain(subpath.closeSubpaths(contentVal));
}

export function mergeTouchingSubpaths(contentVal) {
  return impl.fromPlain(subpath.mergeTouchingSubpaths(contentVal));
}

export function applyContentModifiers(contentVal, modifiers) {
  function applyToIndex(contentArr, [index, params]) {
    if (index >= contentArr.length) return contentArr;
    const seg = { ...contentArr[index], params: { ...contentArr[index].params } };
    if ((params.c1x || params.c1y || params.c2x || params.c2y) && seg.command === 'line-to') {
      seg.command = 'curve-to';
      seg.params = helpers.makeCurveParams(seg.params, contentArr[index - 1]?.params);
    }
    if (params.x) seg.params.x += params.x;
    if (params.y) seg.params.y += params.y;
    if (params.c1x) seg.params.c1x += params.c1x;
    if (params.c1y) seg.params.c1y += params.c1y;
    if (params.c2x) seg.params.c2x += params.c2x;
    if (params.c2y) seg.params.c2y += params.c2y;
    contentArr[index] = seg;
    return contentArr;
  }

  if (modifiers) {
    const arr = Array.from(contentVal).map(s => ({ ...s, params: { ...s.params } }));
    return impl.pathData(Object.entries(modifiers).reduce(applyToIndex, arr));
  }
  return contentVal;
}

export function transformContent(contentVal, transform) {
  return segm.transformContent(contentVal, transform);
}

export function moveContent(contentVal, moveVec) {
  if (gpt.isZero(moveVec)) return contentVal;
  return segm.moveContent(contentVal, moveVec);
}

export function updateGeometry(shape, contentVal) {
  if (contentVal !== undefined) shape = { ...shape, content: contentVal };
  const flipX = shape.flipX;
  const flipY = shape.flipY;
  const contentData = impl.pathData(shape.content);
  let transform = shape.transform || gmt.matrix();
  if (flipX) transform = gmt.scale(transform, gpt.point(-1, 1));
  if (flipY) transform = gmt.scale(transform, gpt.point(1, -1));

  let transformInverse = gmt.matrix();
  if (flipX) transformInverse = gmt.scale(transformInverse, gpt.point(-1, 1));
  if (flipY) transformInverse = gmt.scale(transformInverse, gpt.point(1, -1));
  transformInverse = gmt.multiply(transformInverse, shape.transformInverse || gmt.matrix());

  const center = (shape.selrect ? grc.rectToCenter(shape.selrect) : null) || segm.contentCenter(contentData);
  const baseContent = segm.transformContent(contentData, gmt.transformIn(center, transformInverse));
  const points = grc.rectToPoints(segm.contentToSelrect(baseContent));
  const transformedPoints = gco.transformPoints(points, center, transform);
  const pointsCenter = gco.pointsToCenter(transformedPoints);
  const selrect = grc.pointsToRect(gco.transformPoints(transformedPoints, pointsCenter, transformInverse));

  return { ...shape, content: contentData, points: transformedPoints, selrect };
}

export function getPoints(contentVal) {
  return segm.getPoints(impl.pathData(contentVal));
}

export function calcSelrect(contentVal) {
  return segm.contentToSelrect(impl.pathData(contentVal));
}

export function getHandlers(contentVal) {
  return segm.getHandlers(impl.pathData(contentVal));
}

export function getHandlerPoint(contentVal, index, prefix) {
  return segm.getHandlerPoint(impl.pathData(contentVal), index, prefix);
}

export function getHandler(command, prefix) {
  return segm.getHandler(command, prefix);
}

export function handlerToNode(contentVal, index, prefix) {
  return segm.handlerToNode(impl.pathData(contentVal), index, prefix);
}

export function oppositeIndex(contentVal, index, prefix) {
  return segm.oppositeIndex(impl.pathData(contentVal), index, prefix);
}

export function pointIndices(contentVal, point) {
  return segm.pointIndices(impl.pathData(contentVal), point);
}

export function handlerIndices(contentVal, point) {
  return segm.handlerIndices(impl.pathData(contentVal), point);
}

export function nextNode(contentVal, position, prevPoint, prevHandler) {
  return segm.nextNode(impl.pathData(contentVal), position, prevPoint, prevHandler);
}

export function appendSegment(contentVal, segment) {
  return segm.appendSegment(impl.pathData(contentVal), segment);
}

export function pointsToContent(points, opts) {
  return segm.pointsToContent(points, opts);
}

export function closestPoint(contentVal, position, precision) {
  if (contentVal.length === 0) return undefined;
  return segm.closestPoint(impl.pathData(contentVal), position, precision);
}

export function makeCornerPoint(contentVal, point) {
  return segm.makeCornerPoint(impl.pathData(contentVal), point);
}

export function makeCurvePoint(contentVal, point) {
  return segm.makeCurvePoint(impl.pathData(contentVal), point);
}

export function splitSegments(contentVal, points, value) {
  return segm.splitSegments(impl.pathData(contentVal), points, value);
}

export function removeNodes(contentVal, points) {
  return segm.removeNodes(impl.pathData(contentVal), points);
}

export function mergeNodes(contentVal, points) {
  return segm.mergeNodes(impl.pathData(contentVal), points);
}

export function joinNodes(contentVal, points) {
  return segm.joinNodes(impl.pathData(contentVal), points);
}

export function separateNodes(contentVal, points) {
  return segm.separateNodes(impl.pathData(contentVal), points);
}

export function calcBoolContent(shape, objects) {
  const extractContent = (shape.shapes || [])
    .map(id => objects[id])
    .filter(Boolean)
    .filter(s => !s.hidden)
    .map(s => stp.convertToPath(s, objects))
    .map(s => s.content);

  try {
    return impl.pathData(bool.calculateContent(shape.boolType, extractContent));
  } catch {
    throw new Error(`unable to calculate bool content for shape ${shape.id}`);
  }
}

export function updateBoolShape(shape, objects) {
  const contentVal = calcBoolContent(shape, objects);
  return updateGeometry({ ...shape, content: contentVal });
}

export function shapeWithOpenPathQ(shape) {
  if (shape.type !== 'path') return false;
  const svgQ = 'svgAttrs' in shape;
  const maybeClose = svgQ ? (c) => c : subpath.closeSubpaths;
  return !subpath.getSubpaths(maybeClose(shape.content)).every(subpath.isClosedQ);
}

export function convertToPath(shape, objects) {
  if (!objects) objects = {};
  const result = stp.convertToPath(shape, objects);
  return { ...result, content: impl.pathData(result.content) };
}

export { decodeSegments } from './path/impl.js';
export { contentToSelrect, contentCenter } from './path/segment.js';