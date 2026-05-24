import * as d from '../../data.js';
import * as grc from '../../geom/rect.js';
import * as mth from '../../math.js';
import * as pathMod from '../../types/path.js';

function pathShapeQ(shape) {
  return shape.type === 'path';
}

function svgRawShapeQ(shape) {
  return shape.type === 'svg-raw';
}

function boolShapeQ(shape) {
  return shape.type === 'bool';
}

function frameShapeQ(shape) {
  return shape.type === 'frame';
}

function maskShapeQ(shape) {
  return shape.maskedGroup || shape['masked-group'];
}

export function shapeStrokeMargin(shape, strokeWidth) {
  if (pathShapeQ(shape)) {
    return strokeWidth + mth.sqrt(2 * strokeWidth * strokeWidth);
  }
  return mth.sqrt(2 * strokeWidth * strokeWidth);
}

function applyFilters(attr, type, filters) {
  return filters
    .filter(f => !f.hidden)
    .filter(f => f[attr] === type)
    .map(item => ({ id: `filter_${item.id}`, type, params: item }));
}

export function shapeToFilters(shape) {
  const result = [{ id: 'BackgroundImageFix', type: 'image-fix' }];
  const shadows = shape.shadow || [];
  result.push(...applyFilters('style', 'drop-shadow', shadows));
  result.push({ id: 'shape', type: 'blend-filters' });
  result.push(...applyFilters('style', 'inner-shadow', shadows));
  result.push(...applyFilters('type', 'layer-blur', shape.blur ? [shape.blur] : []));
  return result;
}

function calculateFilterBounds(selrect, filterEntry) {
  const x = selrect.x;
  const y = selrect.y;
  const w = selrect.width;
  const h = selrect.height;

  const params = filterEntry.params || {};
  const offsetX = params.offsetX ?? params['offset-x'] ?? 0;
  const offsetY = params.offsetY ?? params['offset-y'] ?? 0;
  const blur = params.blur ?? 0;
  const spread = params.spread ?? 0;

  const filterX = Math.min(x, x + offsetX - spread - blur - 5);
  const filterY = Math.min(y, y + offsetY - spread - blur - 5);
  const filterW = w + Math.abs(offsetX) + spread * 2 + blur * 2 + 10;
  const filterH = h + Math.abs(offsetY) + spread * 2 + blur * 2 + 10;

  return grc.makeRect(filterX, filterY, filterW, filterH);
}

export function getRectFilterBounds(selrect, filters, blurValue, ignoreShadowMarginQ) {
  if (ignoreShadowMarginQ === undefined) ignoreShadowMarginQ = false;
  const boundsXf = filters
    .filter(f => !ignoreShadowMarginQ && f.type === 'drop-shadow')
    .map(f => calculateFilterBounds(selrect, f));

  const deltaBlur = blurValue * 2;
  const allRects = [selrect, ...boundsXf];
  let result = grc.joinRects(allRects);

  result = {
    ...result,
    x: result.x - deltaBlur,
    y: result.y - deltaBlur,
    x1: (result.x1 ?? result.x) - deltaBlur,
    y1: (result.y1 ?? result.y) - deltaBlur,
    x2: (result.x2 ?? result.x + result.width) + deltaBlur,
    y2: (result.y2 ?? result.y + result.height) + deltaBlur,
    width: result.width + deltaBlur * 2,
    height: result.height + deltaBlur * 2,
  };
  return result;
}

export function getShapeFilterBounds(shape, ignoreShadowMarginQ) {
  if (ignoreShadowMarginQ === undefined) ignoreShadowMarginQ = false;

  if (svgRawShapeQ(shape) && shape.content?.tag !== 'svg') {
    return shape.selrect;
  }

  const shadows = shape.shadow || [];
  const blur = shape.blur;
  if (shadows.length === 0 &&
    (!blur || blur.type !== 'layer-blur' || (blur.value ?? 0) === 0)) {
    return shape.selrect;
  }

  const filters = shapeToFilters(shape);
  let blurValue = 0;
  if (blur?.type === 'layer-blur') blurValue = blur.value ?? 0;

  const srect = grc.pointsToRect(shape.points);
  return getRectFilterBounds(srect, filters, blurValue, ignoreShadowMarginQ);
}

export function calculatePadding(shape, ignoreMarginQ, ignoreShadowMarginQ) {
  if (ignoreMarginQ === undefined) ignoreMarginQ = false;
  if (ignoreShadowMarginQ === undefined) ignoreShadowMarginQ = false;

  const strokes = shape.strokes || [];
  const openPathQ = pathShapeQ(shape) && pathMod.shapeWithOpenPathQ(shape);

  const strokeWidth = strokes.reduce((max, s) => {
    const alignment = s.strokeAlignment ?? s['stroke-alignment'] ?? 'center';
    const sw = s.strokeWidth ?? s['stroke-width'] ?? 0;
    switch (alignment) {
      case 'center': return Math.max(max, sw / 2);
      case 'outer': return Math.max(max, sw);
      default: return Math.max(max, openPathQ ? sw : 0);
    }
  }, 0);

  const strokeMargin = ignoreMarginQ ? 0 : shapeStrokeMargin(shape, strokeWidth);

  const shadows = (shape.shadow || []).filter(s => !s.hidden);
  const shadowWidth = shadows.reduce((max, s) => {
    const style = s.style ?? 'drop-shadow';
    if (style === 'drop-shadow') {
      return Math.max(max, Math.abs(s.offsetX ?? s['offset-x'] ?? 0) + (s.spread ?? 0) * 2 + (s.blur ?? 0) * 2 + 10);
    }
    return max;
  }, 0);

  const shadowHeight = shadows.reduce((max, s) => {
    const style = s.style ?? 'drop-shadow';
    if (style === 'drop-shadow') {
      return Math.max(max, Math.abs(s.offsetY ?? s['offset-y'] ?? 0) + (s.spread ?? 0) * 2 + (s.blur ?? 0) * 2 + 10);
    }
    return max;
  }, 0);

  const finalShadowWidth = ignoreShadowMarginQ ? 0 : shadowWidth;
  const finalShadowHeight = ignoreShadowMarginQ ? 0 : shadowHeight;

  return {
    horizontal: mth.ceil(strokeMargin + finalShadowWidth),
    vertical: mth.ceil(strokeMargin + finalShadowHeight),
  };
}

function addPadding(bounds, padding) {
  const h = padding.horizontal;
  const v = padding.vertical;
  return {
    ...bounds,
    x: bounds.x - h,
    x1: (bounds.x1 ?? bounds.x) - h,
    x2: (bounds.x2 ?? bounds.x + bounds.width) + h,
    y: bounds.y - v,
    y1: (bounds.y1 ?? bounds.y) - v,
    y2: (bounds.y2 ?? bounds.y + bounds.height) + v,
    width: bounds.width + 2 * h,
    height: bounds.height + 2 * v,
  };
}

export function calculateBaseBounds(shape, ignoreMarginQ, ignoreShadowMarginQ) {
  if (ignoreMarginQ === undefined) ignoreMarginQ = true;
  if (ignoreShadowMarginQ === undefined) ignoreShadowMarginQ = false;
  return addPadding(
    getShapeFilterBounds(shape, ignoreShadowMarginQ),
    calculatePadding(shape, ignoreMarginQ, ignoreShadowMarginQ)
  );
}

export function getObjectBounds(objects, shape, opts) {
  const { ignoreMarginQ = true, ignoreShadowMarginQ = false } = opts || {};
  const baseBounds = calculateBaseBounds(shape, ignoreMarginQ, ignoreShadowMarginQ);
  let bounds;

  if (!shape.shapes || shape.shapes.length === 0 || maskShapeQ(shape) || boolShapeQ(shape) ||
    (frameShapeQ(shape) && !shape.showContent)) {
    bounds = [baseBounds];
  } else {
    bounds = [baseBounds];
    for (const childId of shape.shapes) {
      const child = objects[childId];
      if (child && !child.hidden) {
        bounds.push(calculateBaseBounds(child, ignoreMarginQ, ignoreShadowMarginQ));
      }
    }
  }

  let childrenBounds = grc.joinRects(bounds);
  if (!frameShapeQ(shape) && shape.childrenBounds) {
    childrenBounds = shape.childrenBounds;
  }

  const filters = shapeToFilters(shape);
  let blurValue = 0;
  if (shape.blur?.type === 'layer-blur') blurValue = shape.blur.value ?? 0;

  return getRectFilterBounds(childrenBounds, filters, blurValue, ignoreShadowMarginQ);
}

export function getFrameBounds(shape, opts) {
  return getObjectBounds({}, shape, opts);
}