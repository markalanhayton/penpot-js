import * as d from '../data.js';
import * as mth from '../math.js';
import * as gmt from '../geom/matrix.js';
import * as gpt from '../geom/point.js';
import * as grc from '../geom/rect.js';
import * as gsh from '../geom/shapes/shapes.js';
import * as gsc from '../geom/shapes/common.js';
import * as gst from '../geom/shapes/transforms.js';
import * as csvg from '../svg.js';
import * as cfh from './helpers.js';
import * as cts from '../types/shape_type.js';
import * as clr from '../types/color.js';
import * as path from '../types/path.js';
import * as segm from '../types/path/segment.js';
import * as uuid from '../uuid.js';

export const defaultRect = { x: 0, y: 0, width: 1, height: 1 };

const MAX_SAFE_INT = Number.MAX_SAFE_INTEGER;
const MIN_SAFE_INT = Number.MIN_SAFE_INTEGER;

function assertValidNum(attr, num) {
  if (typeof num !== 'number' || Number.isNaN(num) || num > MAX_SAFE_INT || num < MIN_SAFE_INT) {
    throw new Error(`invalid numeric value for "${attr}": ${num}`);
  }
  if (num > 0 && num < 1) return 1;
  if (num < 0 && num > -1) return -1;
  return num;
}

function assertValidPosNum(attr, num) {
  if (num <= 0) {
    throw new Error(`invalid numeric value for "${attr}": ${num} (should be positive)`);
  }
  return num;
}

function assertValidBlendMode(mode) {
  const value = typeof mode === 'string' ? mode.trim().toLowerCase() : mode;
  if (!cts.BLEND_MODES.has(value)) {
    throw new Error(`unexpected blend mode: ${value}`);
  }
  return value;
}

function svgDimensions(data) {
  const attrs = data.attrs || {};
  const width = attrs.width ?? 100;
  const height = attrs.height ?? 100;
  const viewbox = attrs.viewBox ?? attrs['view-box'] ?? `0 0 ${width} ${height}`;
  const [x, y, vbWidth, vbHeight] = csvg.parseNumbers(viewbox);
  return [
    assertValidNum('x', x ?? 0),
    assertValidNum('y', y ?? 0),
    assertValidPosNum('width', vbWidth === 0 ? 1 : vbWidth),
    assertValidPosNum('height', vbHeight === 0 ? 1 : vbHeight)
  ];
}

function strokeOnlySvgPathQ(attrs) {
  const attrFill = (attrs.fill ?? '').trim();
  const styleFill = (attrs.style?.fill ?? '').trim();
  const fill = attrFill || styleFill;
  return fill === 'none';
}

export function processGradientStops(stops) {
  return csvg.processGradientStops(stops);
}

export function resolveGradientHref(defs) {
  return csvg.resolveGradientHref(defs);
}

export function createSvgShapes(id, svgData, pos, objects, frameId, parentId, selected, centerQ) {
  const [vbX, vbY, vbWidth, vbHeight] = svgDimensions(svgData);

  let unames = cfh.getUsedNames(objects);
  const svgName = (svgData.name || '').replace('.svg', '');

  svgData = {
    ...svgData,
    x: mth.round(centerQ ? pos.x - vbX - vbWidth / 2 : pos.x),
    y: mth.round(centerQ ? pos.y - vbY - vbHeight / 2 : pos.y),
    'offset-x': vbX,
    'offset-y': vbY,
    width: vbWidth,
    height: vbHeight,
    name: svgName
  };

  let processed = { ...svgData };
  processed = csvg.fixDefaultValues(processed);
  processed = csvg.fixPercents(processed);
  const [defNodes, processedData] = csvg.extractDefs(processed);

  const resolvedDefs = csvg.resolveGradientHref(defNodes);

  const background = {
    tag: 'rect',
    attrs: {
      x: String(vbX),
      y: String(vbY),
      width: String(vbWidth),
      height: String(vbHeight),
      fill: 'none',
      id: 'base-background'
    },
    hidden: true,
    content: []
  };

  const svgDataWithDefs = {
    ...processedData,
    defs: resolvedDefs,
    content: [background, ...(processedData.content || [])]
  };

  const rootShape = createSvgRoot(id, frameId, parentId, svgDataWithDefs);
  const rootId = rootShape.id;

  const rootAttrs = csvg.formatStyles(svgDataWithDefs.attrs || {});

  const initialChildren = (svgDataWithDefs.content || []).map((child) =>
    csvg.inheritAttributes(rootAttrs, child)
  );

  const [, children] = createSvgChildren(objects, selected, frameId, rootId, svgDataWithDefs, [unames, []], initialChildren);

  let allDefsFromChildren = {};
  for (const child of children) {
    if (child.svgDefs) {
      allDefsFromChildren = { ...allDefsFromChildren, ...child.svgDefs };
    }
  }

  const rootShapeWithDefs = {
    ...rootShape,
    svgDefs: { ...resolvedDefs, ...allDefsFromChildren }
  };

  return [rootShapeWithDefs, children];
}

function createSvgChildren(objects, selected, frameId, parentId, svgData, acc, svgElements) {
  let [unames, children] = acc;

  for (const svgElement of svgElements) {
    const originalTag = svgElement.tag;
    const [shape, newChildren] = parseSvgElement(frameId, svgData, svgElement, unames);
    if (shape != null) {
      const shapeWithParents = {
        ...shape,
        'frame-id': frameId,
        'parent-id': parentId
      };
      const newUnames = [...unames, shape.name];
      const newChildrenList = [...children, shapeWithParents];

      if (newChildren && newChildren.length > 0 && csvg.parentTags.has(originalTag || '')) {
        const inheritedChildren = newChildren.map((child) =>
          csvg.inheritAttributes(shapeWithParents.svgAttrs || shapeWithParents.attrs || {}, child)
        );
        const [childUnames, allGrandchildren] = createSvgChildren(
          objects, selected, frameId, shape.id, svgData,
          [newUnames, newChildrenList],
          inheritedChildren
        );
        unames = childUnames;
        children = allGrandchildren;
      } else {
        unames = newUnames;
        children = newChildrenList;
      }
    }
  }

  return [unames, children];
}

export function createRawSvg(name, frameId, svgData, data) {
  const props = csvg.attrsToProps(data.attrs || {});
  const vbox = grc.makeRect(svgData['offset-x'], svgData['offset-y'], svgData.width, svgData.height);
  return cts.setupShape({
    type: 'svg-raw',
    name,
    'frame-id': frameId,
    width: svgData.width,
    height: svgData.height,
    x: svgData.x,
    y: svgData.y,
    content: data,
    svgAttrs: props,
    svgViewbox: vbox,
    svgDefs: svgData.defs
  });
}

export function createSvgRoot(id, frameId, parentId, svgData) {
  const attrs = svgData.attrs || {};
  const props = csvg.attrsToProps(
    d.withoutKeys(
      { ...attrs },
      new Set(['viewBox', 'view-box', 'xmlns', ...csvg.inheritableProps])
    )
  );

  return cts.setupShape({
    id,
    type: 'group',
    name: svgData.name,
    'frame-id': frameId,
    'parent-id': parentId,
    width: svgData.width,
    height: svgData.height,
    x: (svgData.x ?? 0) + (svgData['offset-x'] ?? svgData.offsetX ?? 0),
    y: (svgData.y ?? 0) + (svgData['offset-y'] ?? svgData.offsetY ?? 0),
    svgAttrs: props,
    svgDefs: svgData.defs
  });
}

function createGroup(name, frameId, svgData, data) {
  const attrs = data.attrs || {};
  const transform = csvg.parseTransform(attrs.transform);
  const cleanAttrs = { ...attrs };
  delete cleanAttrs.transform;
  const groupProps = csvg.attrsToProps(
    d.withoutKeys(cleanAttrs, csvg.inheritableProps)
  );
  const vbox = grc.makeRect(
    svgData['offset-x'] ?? svgData.offsetX ?? 0,
    svgData['offset-y'] ?? svgData.offsetY ?? 0,
    svgData.width,
    svgData.height
  );

  const x = (svgData.x ?? 0) + (svgData['offset-x'] ?? svgData.offsetX ?? 0);
  const y = (svgData.y ?? 0) + (svgData['offset-y'] ?? svgData.offsetY ?? 0);

  return cts.setupShape({
    type: 'group',
    name,
    'frame-id': frameId,
    x,
    y,
    width: svgData.width,
    height: svgData.height,
    svgTransform: transform,
    svgAttrs: groupProps,
    svgViewbox: vbox,
    svgDefs: svgData.defs
  });
}

function calculateRectMetadata(rect, transform) {
  const points = gsh.transformPoints(grc.rectToPoints(rect), transform);
  const center = gsc.pointsToCenter(points);
  const selrect = gst.calculateSelrect(points, center);
  const calculatedTransform = gst.calculateTransform(points, center, selrect);

  return {
    x: selrect.x,
    y: selrect.y,
    width: selrect.width,
    height: selrect.height,
    selrect,
    points,
    transform: calculatedTransform,
    'transform-inverse': calculatedTransform ? gmt.inverse(calculatedTransform) : undefined
  };
}

function parseRectAttrs(attrs) {
  return grc.makeRect(
    d.parseDouble(attrs.x ?? 0),
    d.parseDouble(attrs.y ?? 0),
    d.parseDouble(attrs.width ?? 1),
    d.parseDouble(attrs.height ?? 1)
  );
}

function parseRadiusAttrs(attrs) {
  if (attrs.rx != null || attrs.ry != null) {
    const rxVal = d.parseDouble(attrs.rx ?? 0);
    const ryVal = d.parseDouble(attrs.ry ?? 0);
    let radius;
    if (attrs.rx != null && attrs.ry != null) {
      radius = Math.min(rxVal, ryVal);
    } else if (attrs.rx != null) {
      radius = rxVal;
    } else {
      radius = ryVal;
    }
    return { r1: radius, r2: radius, r3: radius, r4: radius };
  }
  return {};
}

function createRectShape(name, frameId, svgData, data) {
  const attrs = data.attrs || {};
  const transform = gmt.transformIn(
    gpt.point(svgData.x ?? 0, svgData.y ?? 0),
    csvg.parseTransform(attrs.transform)
  );
  const origin = gpt.negate(gpt.point(svgData.x ?? 0, svgData.y ?? 0));
  const vbox = parseRectAttrs(attrs);
  const rect = {
    ...vbox,
    x: vbox.x - origin.x,
    y: vbox.y - origin.y
  };
  const props = csvg.attrsToProps(
    d.withoutKeys({ ...attrs }, new Set(['x', 'y', 'width', 'height', 'rx', 'ry', 'transform']))
  );
  const radiusAttrs = parseRadiusAttrs(attrs);

  return cts.setupShape({
    ...calculateRectMetadata(rect, transform),
    type: 'rect',
    name,
    'frame-id': frameId,
    svgViewbox: vbox,
    svgAttrs: props,
    fills: [],
    ...radiusAttrs
  });
}

function parseCircleAttrs(attrs) {
  return [
    d.parseDouble(attrs.cx),
    d.parseDouble(attrs.cy),
    d.parseDouble(attrs.r),
    d.parseDouble(attrs.rx),
    d.parseDouble(attrs.ry)
  ];
}

function createCircleShape(name, frameId, svgData, data) {
  const attrs = data.attrs || {};
  let [cx, cy, r, rx, ry] = parseCircleAttrs(attrs);

  const transform = gmt.transformIn(
    gpt.point(svgData.x ?? 0, svgData.y ?? 0),
    csvg.parseTransform(attrs.transform)
  );

  rx = d.nilv(r, rx);
  ry = d.nilv(r, ry);
  rx = d.nilv(rx, 0);
  ry = d.nilv(ry, 0);

  cx = d.nilv(cx, 0);
  cy = d.nilv(cy, 0);
  const origin = gpt.negate(gpt.point(svgData.x ?? 0, svgData.y ?? 0));

  const rect = grc.makeRect(
    cx - rx - origin.x,
    cy - ry - origin.y,
    2 * rx || 0.01,
    2 * ry || 0.01
  );
  const props = csvg.attrsToProps(
    d.withoutKeys({ ...attrs }, new Set(['cx', 'cy', 'r', 'rx', 'ry', 'transform']))
  );

  return cts.setupShape({
    ...calculateRectMetadata(rect, transform),
    type: 'circle',
    name,
    'frame-id': frameId,
    svgViewbox: rect,
    svgAttrs: props,
    fills: []
  });
}

function createPathShape(name, frameId, svgData, data) {
  const attrs = data.attrs || {};
  if (!attrs.d || attrs.d.length === 0) return null;

  const transform = csvg.parseTransform(attrs.transform);
  const strokeOnly = strokeOnlySvgPathQ(attrs);

  let content = path.fromString(attrs.d);
  if (strokeOnly) {
    content = path.mergeTouchingSubpaths(content);
  }
  if (transform) {
    content = path.transformContent(content, transform);
  }

  const selrect = segm.contentToSelrect(content);
  const points = grc.rectToPoints(selrect);
  const origin = gpt.negate(gpt.point(svgData.x ?? 0, svgData.y ?? 0));
  const cleanAttrs = { ...attrs };
  delete cleanAttrs.d;
  delete cleanAttrs.transform;
  const props = csvg.attrsToProps(cleanAttrs);

  const shape = cts.setupShape({
    type: 'path',
    name,
    'frame-id': frameId,
    content,
    selrect,
    points,
    svgViewbox: selrect,
    svgAttrs: props,
    svgTransform: transform,
    strokes: [],
    fills: []
  });

  return gsh.translateToFrame(shape, origin);
}

function createImageShape(name, frameId, svgData, data) {
  const attrs = data.attrs || {};
  const transform = gmt.transformIn(
    gpt.point(svgData.x ?? 0, svgData.y ?? 0),
    csvg.parseTransform(attrs.transform)
  );

  const imageUrl = attrs.href ?? attrs['xlink:href'];
  const imageData = svgData['image-data']?.[imageUrl];

  if (imageData == null) return null;

  const metadata = {
    name,
    width: imageData.width,
    height: imageData.height,
    mtype: imageData.mtype,
    id: imageData.id
  };

  const origin = gpt.negate(gpt.point(svgData.x ?? 0, svgData.y ?? 0));
  const parsedRect = parseRectAttrs(attrs);
  const rect = {
    ...parsedRect,
    x: parsedRect.x - origin.x,
    y: parsedRect.y - origin.y
  };
  const props = csvg.attrsToProps(
    d.withoutKeys({ ...attrs }, new Set(['x', 'y', 'width', 'height', 'href', 'xlink:href']))
  );

  return cts.setupShape({
    ...calculateRectMetadata(rect, transform),
    type: 'rect',
    name,
    'frame-id': frameId,
    fills: [{ 'fill-opacity': 1, 'fill-image': metadata }],
    metadata,
    svgViewbox: rect,
    svgAttrs: props
  });
}

export function setupFill(shape) {
  let colorAttr = (shape.svgAttrs?.fill ?? '').trim();
  if (colorAttr === 'currentColor') colorAttr = clr.black;
  let colorStyle = (shape.svgAttrs?.style?.fill ?? '').trim();
  if (colorStyle === 'currentColor') colorStyle = clr.black;

  let result = { ...shape };

  if (clr.colorString(colorAttr)) {
    const { fill: _f, ...cleanAttrs } = result.svgAttrs || {};
    let cleanStyle = result.svgAttrs?.style;
    if (cleanStyle) {
      const { fill: _sf, ...rest } = cleanStyle;
      cleanStyle = Object.keys(rest).length > 0 ? rest : undefined;
    }
    result = {
      ...result,
      svgAttrs: { ...cleanAttrs, style: cleanStyle },
      fills: [{ ...result.fills?.[0], 'fill-color': clr.parse(colorAttr) }]
    };
  } else if (clr.colorString(colorStyle)) {
    let cleanStyle = result.svgAttrs?.style;
    if (cleanStyle) {
      const { fill: _sf, ...rest } = cleanStyle;
      cleanStyle = Object.keys(rest).length > 0 ? rest : undefined;
    }
    result = {
      ...result,
      svgAttrs: { ...result.svgAttrs, style: cleanStyle },
      fills: [{ ...result.fills?.[0], 'fill-color': clr.parse(colorStyle) }]
    };
  }

  const hasFillColor = clr.colorString(colorAttr) || clr.colorString(colorStyle);

  const fillOpacityFromAttr = result.svgAttrs?.fillOpacity ?? result.svgAttrs?.['fill-opacity'];
  if (hasFillColor && fillOpacityFromAttr != null) {
    const { fillOpacity: _fo, 'fill-opacity': _fo2, ...cleanAttrs } = result.svgAttrs || {};
    let cleanStyle = cleanAttrs.style;
    if (cleanStyle) {
      const { fillOpacity: _sfo, 'fill-opacity': _sfo2, ...rest } = cleanStyle;
      cleanStyle = Object.keys(rest).length > 0 ? rest : undefined;
    }
    result = {
      ...result,
      svgAttrs: { ...cleanAttrs, style: cleanStyle },
      fills: [{ ...result.fills?.[0], 'fill-opacity': d.parseDouble(fillOpacityFromAttr, 1) }]
    };
  } else if (hasFillColor && (result.svgAttrs?.style?.fillOpacity ?? result.svgAttrs?.style?.['fill-opacity']) != null) {
    const styleFillOpacity = result.svgAttrs.style.fillOpacity ?? result.svgAttrs.style['fill-opacity'];
    let cleanStyle = result.svgAttrs.style;
    const { fillOpacity: _sfo, 'fill-opacity': _sfo2, ...rest } = cleanStyle;
    cleanStyle = Object.keys(rest).length > 0 ? rest : undefined;
    result = {
      ...result,
      svgAttrs: { ...result.svgAttrs, style: cleanStyle },
      fills: [{ ...result.fills?.[0], 'fill-opacity': d.parseDouble(styleFillOpacity, 1) }]
    };
  }

  if (result.svgAttrs?.style && Object.keys(result.svgAttrs.style).length === 0) {
    result = { ...result, svgAttrs: { ...result.svgAttrs, style: undefined } };
  }

  return result;
}

export function setupStroke(shape) {
  let attrs = { ...(shape.svgAttrs || {}) };
  const style = attrs.style;
  const stroke = (attrs.stroke ?? '').trim() || (style?.stroke ?? '').trim();
  let color;
  if (stroke === 'currentColor') {
    color = clr.black;
  } else if (stroke === 'none') {
    color = null;
  } else if (clr.colorString(stroke)) {
    color = clr.parse(stroke);
  }

  const opacity = color != null
    ? d.parseDouble(attrs.strokeOpacity ?? attrs['stroke-opacity'] ?? style?.strokeOpacity ?? style?.['stroke-opacity'], 1)
    : null;
  const width = color != null
    ? d.parseDouble(attrs.strokeWidth ?? attrs['stroke-width'] ?? style?.strokeWidth ?? style?.['stroke-width'], 1)
    : null;
  let linecap = attrs.strokeLinecap ?? attrs['stroke-linecap'] ?? style?.strokeLinecap ?? style?.['stroke-linecap'];
  if (linecap) linecap = linecap.trim().toLowerCase();

  if (color != null) {
    const { stroke: _s, strokeWidth: _sw, strokeOpacity: _so, 'stroke-width': _sw2, 'stroke-opacity': _so2, ...cleanAttrs } = attrs;
    attrs = cleanAttrs;
    if (attrs.style) {
      const { stroke: _ss, strokeWidth: _ssw, strokeOpacity: _sso, 'stroke-width': _ssw2, 'stroke-opacity': _sso2, ...cleanStyle } = attrs.style;
      attrs = { ...attrs, style: Object.keys(cleanStyle).length > 0 ? cleanStyle : undefined };
    }
  }

  attrs = d.withoutNils(attrs);
  let result = { ...shape, svgAttrs: attrs };
  const strokes = [];

  if (color != null) {
    const strokeObj = { 'stroke-color': color };
    if (opacity != null) strokeObj['stroke-opacity'] = opacity;
    if (width != null) strokeObj['stroke-width'] = width;

    if (linecap && cfh.pathShapeQ(shape) && (linecap === 'round' || linecap === 'square')) {
      strokeObj['stroke-cap-start'] = linecap;
      strokeObj['stroke-cap-end'] = linecap;
      strokeObj['stroke-linecap'] = linecap;
    }

    if (strokeObj['stroke-color'] || strokeObj['stroke-opacity'] || strokeObj['stroke-width']
      || strokeObj['stroke-linecap'] || strokeObj['stroke-cap-start'] || strokeObj['stroke-cap-end']) {
      strokeObj['stroke-style'] = 'svg';
    }

    strokes.push(strokeObj);
  }

  result = { ...result, strokes };
  return result;
}

export function setupOpacity(shape) {
  let result = { ...shape };

  const opacityFromAttr = result.svgAttrs?.opacity ?? result.svgAttrs?.['opacity'];
  if (opacityFromAttr != null) {
    const { opacity: _o, 'opacity': _o2, ...cleanAttrs } = result.svgAttrs;
    result = { ...result, svgAttrs: cleanAttrs, opacity: d.parseDouble(opacityFromAttr, 1) };
  }

  const opacityFromStyle = result.svgAttrs?.style?.opacity ?? result.svgAttrs?.style?.['opacity'];
  if (opacityFromStyle != null) {
    const { opacity: _o, 'opacity': _o2, ...cleanStyle } = result.svgAttrs.style || {};
    result = {
      ...result,
      svgAttrs: {
        ...result.svgAttrs,
        style: Object.keys(cleanStyle).length > 0 ? cleanStyle : undefined
      },
      opacity: d.parseDouble(opacityFromStyle, 1)
    };
  }

  const blendFromAttr = result.svgAttrs?.mixBlendMode ?? result.svgAttrs?.['mix-blend-mode'];
  if (blendFromAttr != null) {
    const { mixBlendMode: _m, 'mix-blend-mode': _m2, ...cleanAttrs } = result.svgAttrs;
    result = { ...result, svgAttrs: cleanAttrs, 'blend-mode': assertValidBlendMode(blendFromAttr) };
  }

  const blendFromStyle = result.svgAttrs?.style?.mixBlendMode ?? result.svgAttrs?.style?.['mix-blend-mode'];
  if (blendFromStyle != null) {
    const { mixBlendMode: _m, 'mix-blend-mode': _m2, ...cleanStyle } = result.svgAttrs.style || {};
    result = {
      ...result,
      svgAttrs: {
        ...result.svgAttrs,
        style: Object.keys(cleanStyle).length > 0 ? cleanStyle : undefined
      },
      'blend-mode': assertValidBlendMode(blendFromStyle)
    };
  }

  return result;
}

export function setupOther(shape) {
  let result = { ...shape };

  if (result.svgAttrs?.display === 'none') {
    const { display: _d, ...cleanAttrs } = result.svgAttrs;
    const cleanStyle = cleanAttrs.style && Object.keys(cleanAttrs.style).length > 0 ? cleanAttrs.style : undefined;
    result = {
      ...result,
      svgAttrs: { ...cleanAttrs, style: cleanStyle },
      hidden: true
    };
  }

  if (result.svgAttrs?.style?.display === 'none') {
    const { display: _d, ...cleanStyle } = result.svgAttrs.style;
    const styleResult = Object.keys(cleanStyle).length > 0 ? cleanStyle : undefined;
    result = {
      ...result,
      svgAttrs: { ...result.svgAttrs, style: styleResult },
      hidden: true
    };
  }

  return result;
}

export function tagToName(tag) {
  if (typeof tag === 'string') return `svg-${tag}`;
  if (tag == null) return 'svg-node';
  return `svg-${tag}`;
}

export function resolveElementName(tag, attrs) {
  return attrs?.['inkscape:label'] || attrs?.['sodipodi:label'] || attrs?.id || tagToName(tag);
}

export function parseSvgElement(frameId, svgData, element, unames) {
  const { tag, attrs, hidden } = element;
  const name = resolveElementName(tag, attrs);

  const attRefs = csvg.findAttrReferences(attrs || {});
  const defs = svgData.defs || {};
  const validRefs = csvg.filterValidDefReferences(attRefs, defs);
  const allRefs = csvg.findDefReferences(defs, validRefs);
  const references = csvg.filterValidDefReferences(allRefs, defs);

  let hrefId = attrs?.href ?? attrs?.['xlink:href'] ?? ' ';
  if (typeof hrefId === 'string' && hrefId.length > 0 && hrefId.startsWith('#')) {
    hrefId = hrefId.slice(1);
  }

  const useTagQ = tag === 'use' && hrefId != null && hrefId !== ' ' && hrefId in defs;

  if (useTagQ) {
    let useData = { ...defs[hrefId] };
    useData = {
      ...useData,
      attrs: d.deepMerge(useData.attrs || {}, d.withoutKeys(attrs || {}, new Set(['xlink:href', 'href'])))
    };
    const displacement = gpt.point(d.parseDouble(attrs?.x ?? '0'), d.parseDouble(attrs?.y ?? '0'));
    const dispMatrix = gmt.translateMatrix(displacement).toString();
    const newElement = {
      ...element,
      tag: 'g',
      attrs: {
        ...(attrs || {}),
        transform: csvg.addTransform(attrs || {}, dispMatrix).transform,
        x: undefined,
        y: undefined,
        width: undefined,
        height: undefined,
        href: undefined,
        'xlink:href': undefined
      },
      content: [useData]
    };
    return parseSvgElement(frameId, svgData, newElement, unames);
  }

  let shape = null;
  const tagStr = typeof tag === 'string' ? tag : String(tag);

  switch (tagStr) {
    case 'g':
    case 'a':
    case 'svg':
      shape = createGroup(name, frameId, svgData, element);
      break;
    case 'rect':
      shape = createRectShape(name, frameId, svgData, element);
      break;
    case 'circle':
    case 'ellipse':
      shape = createCircleShape(name, frameId, svgData, element);
      break;
    case 'path':
      shape = createPathShape(name, frameId, svgData, element);
      break;
    case 'polyline':
      shape = createPathShape(name, frameId, svgData, csvg.polylineToPath(element));
      break;
    case 'polygon':
      shape = createPathShape(name, frameId, svgData, csvg.polygonToPath(element));
      break;
    case 'line':
      shape = createPathShape(name, frameId, svgData, csvg.lineToPath(element));
      break;
    case 'image':
      shape = createImageShape(name, frameId, svgData, element);
      break;
    default:
      shape = null;
  }

  if (shape == null) return [null, []];

  shape = {
    ...shape,
    svgDefs: references.reduce((acc, ref) => {
      if (defs[ref]) acc[ref] = defs[ref];
      return acc;
    }, {})
  };

  shape = setupFill(shape);
  shape = setupStroke(shape);
  shape = setupOpacity(shape);
  shape = setupOther(shape);

  if (shape.svgAttrs?.style && Object.keys(shape.svgAttrs.style).length === 0) {
    shape = { ...shape, svgAttrs: { ...shape.svgAttrs, style: undefined } };
  }

  if (hidden) {
    shape = { ...shape, hidden: true };
  }

  const children = (csvg.parentTags.has(tagStr) && element.content)
    ? element.content.map((child) => csvg.inheritAttributes(attrs || {}, child))
    : [];

  return [shape, children];
}