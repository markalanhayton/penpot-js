/**
 * @module shapes
 * @description SVG rendering functions for Penpot shapes.
 * Provides view-only rendering without WASM — draws shapes as SVG elements.
 */

import { isFrame, isGroup, isText, isImage, isRect, isCircle, isPath, isBool, hasChildren, getShapeIcon } from './types.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, children = []) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) {
      node.setAttribute(k, String(v));
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      node.appendChild(document.createTextNode(child));
    } else if (child) {
      node.appendChild(child);
    }
  }
  return node;
}

function shapeFills(shape) {
  if (!shape.fills || shape.fills.length === 0) return 'none';
  const fill = shape.fills[0];
  switch (fill.fillType || fill.type) {
    case 'solid':
      return fill.color || fill.fillColor || '#ccc';
    case 'linear-gradient': {
      const stops = fill.stops || [];
      const gradId = `grad-${shape.id}`;
      return `url(#${gradId})`;
    }
    default:
      return '#ccc';
  }
}

function shapeStrokes(shape) {
  if (!shape.strokes || shape.strokes.length === 0) return null;
  const stroke = shape.strokes[0];
  return {
    color: stroke.color || stroke.strokeColor || '#000',
    width: stroke.width || stroke.strokeWidth || 1,
    style: stroke.style || 'solid',
    cap: stroke.cap || 'round',
    join: stroke.join || 'round',
    alignment: stroke.alignment || 'center',
  };
}

function strokeDasharray(stroke) {
  if (!stroke) return undefined;
  if (stroke.style === 'dashed') {
    const w = stroke.width || 1;
    return `${w * 4} ${w * 2}`;
  }
  if (stroke.style === 'dotted') {
    const w = stroke.width || 1;
    return `${w} ${w}`;
  }
  return undefined;
}

function shapeOpacity(shape) {
  return shape.opacity !== undefined ? shape.opacity : 1;
}

function shapeRotation(shape) {
  if (!shape.rotation) return '';
  return `rotate(${shape.rotation} ${shape.x + (shape.width || 0) / 2} ${shape.y + (shape.height || 0) / 2})`;
}

function shapeTransform(shape) {
  const transforms = [];
  if (shape.rotation) {
    transforms.push(shapeRotation(shape));
  }
  if (shape.transform) {
    const t = shape.transform;
    if (t.scaleX && t.scaleX !== 1) {
      transforms.push(`scale(${t.scaleX}, 1)`);
    }
    if (t.scaleY && t.scaleY !== 1) {
      transforms.push(`scale(1, ${t.scaleY})`);
    }
  }
  return transforms.length ? transforms.join(' ') : undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveMediaSrc(src) {
  if (!src) return '';
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
    return src;
  }
  if (UUID_RE.test(src)) {
    return `/assets/by-file-media-id/${src}`;
  }
  return src;
}

export function renderShape(shape, depth = 0) {
  if (shape.visible === false) return null;

  switch (shape.type) {
    case 'frame':
      return renderFrame(shape, depth);
    case 'group':
      return renderGroup(shape, depth);
    case 'rect':
      return renderRect(shape);
    case 'circle':
    case 'ellipse':
      return renderEllipse(shape);
    case 'text':
      return renderText(shape);
    case 'path':
      return renderPath(shape);
    case 'image':
      return renderImage(shape);
    case 'svg-raw':
      return renderSvgRaw(shape);
    case 'bool':
      return renderBool(shape);
    default:
      return renderRect({ ...shape, type: 'rect', width: shape.width || 100, height: shape.height || 100 });
  }
}

function applyStrokeAttrs(attrs, shape) {
  const stroke = shapeStrokes(shape);
  if (stroke) {
    attrs.stroke = stroke.color;
    attrs['stroke-width'] = stroke.width;
    attrs['stroke-linecap'] = stroke.cap;
    attrs['stroke-linejoin'] = stroke.join;
    const dash = strokeDasharray(stroke);
    if (dash) attrs['stroke-dasharray'] = dash;
  }
  return attrs;
}

function renderFrame(shape, depth) {
  const hasBlur = shape.blur && shape.blur > 0;
  const attrs = {
    id: `shape-${shape.id}`,
    x: shape.x,
    y: shape.y,
    width: shape.width || 1,
    height: shape.height || 1,
    fill: shapeFills(shape) || '#ffffff',
    opacity: shapeOpacity(shape),
  };
  applyStrokeAttrs(attrs, shape);
  if (!attrs.stroke) {
    attrs.stroke = '#e0e0e0';
    attrs['stroke-width'] = 1;
  }
  const rx = shape.rx ?? shape.borderRadius;
  const r1 = shape.r1 ?? rx ?? 0;
  const r2 = shape.r2 ?? rx ?? 0;
  const r3 = shape.r3 ?? rx ?? 0;
  const r4 = shape.r4 ?? rx ?? 0;
  const hasIndividualCorners = r1 !== r2 || r2 !== r3 || r3 !== r4;
  if (!hasIndividualCorners && r1 > 0) attrs.rx = r1;
  const transform = shapeTransform(shape);
  if (transform) attrs.transform = transform;
  if (hasBlur) attrs.filter = `url(#blur-${shape.id})`;

  const objects = shape.objects || shape.children || [];
  const childShapes = Array.isArray(objects) ? objects : Object.values(objects || {});
  const children = [];
  for (const child of childShapes) {
    const childEl = renderShape(child, depth + 1);
    if (childEl) children.push(childEl);
  }

  if (hasIndividualCorners) {
    const w = shape.width || 1;
    const h = shape.height || 1;
    const path = `M ${r1},0 L ${w - r2},0 Q ${w},0 ${w},${r2} L ${w},${h - r3} Q ${w},${h} ${w - r3},${h} L ${r4},${h} Q 0,${h} 0,${h - r4} L 0,${r1} Q 0,0 ${r1},0 Z`;
    const pathAttrs = {
      id: `shape-${shape.id}`,
      d: path,
      fill: shapeFills(shape) || '#ffffff',
      opacity: shapeOpacity(shape),
    };
    applyStrokeAttrs(pathAttrs, shape);
    if (!pathAttrs.stroke) {
      pathAttrs.stroke = '#e0e0e0';
      pathAttrs['stroke-width'] = 1;
    }
    if (transform) pathAttrs.transform = transform;
    if (hasBlur) pathAttrs.filter = `url(#blur-${shape.id})`;

    if (hasBlur) {
      return el('g', {}, [
        el('defs', {}, [el('filter', { id: `blur-${shape.id}` }, [el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: String(shape.blur) })])]),
        el('path', pathAttrs, children),
      ]);
    }
    return el('path', pathAttrs, children);
  }

  if (hasBlur) {
    return el('g', {}, [
      el('defs', {}, [el('filter', { id: `blur-${shape.id}` }, [el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: String(shape.blur) })])]),
      el('rect', attrs, children),
    ]);
  }
  return el('rect', attrs, children);
}

function renderGroup(shape, depth) {
  const objects = shape.objects || shape.children || shape.shapes || [];
  const list = Array.isArray(objects) ? objects : Object.values(objects);
  const isMasked = !!(shape['masked-group'] || shape.maskedGroup);

  if (isMasked && list.length >= 2) {
    const maskShape = list[0];
    const maskId = `mask-${shape.id}`;
    const clipId = `clip-${shape.id}`;

    const defs = [];

    const maskEl = el('mask', { id: maskId }, [
      el('rect', {
        x: shape.x || 0,
        y: shape.y || 0,
        width: shape.width || 1,
        height: shape.height || 1,
        fill: 'white',
      }),
      el('g', { opacity: '1' }, [renderShape(maskShape, depth + 1)].filter(Boolean).map(s => {
        const clone = s.cloneNode(true);
        clone.setAttribute('fill', 'white');
        clone.setAttribute('stroke', 'white');
        return clone;
      })),
    ]);
    defs.push(maskEl);

    const maskRect = el('rect', {
      x: maskShape.x || 0,
      y: maskShape.y || 0,
      width: maskShape.width || 1,
      height: maskShape.height || 1,
    });
    const clipEl = el('clipPath', { id: clipId }, [maskRect]);
    defs.push(clipEl);

    const clippedChildren = [];
    for (let i = 1; i < list.length; i++) {
      const childEl = renderShape(list[i], depth + 1);
      if (childEl) clippedChildren.push(childEl);
    }

    return el('g', {
      id: `shape-${shape.id}`,
      opacity: shapeOpacity(shape),
      transform: shapeTransform(shape),
    }, [
      el('defs', {}, defs),
      el('g', { 'clip-path': `url(#${clipId})` }, [
        el('g', { mask: `url(#${maskId})` }, clippedChildren),
      ]),
    ]);
  }

  const children = [];
  for (const child of list) {
    const childEl = renderShape(child, depth + 1);
    if (childEl) children.push(childEl);
  }

  return el('g', {
    id: `shape-${shape.id}`,
    opacity: shapeOpacity(shape),
    transform: shapeTransform(shape),
  }, children);
}

function renderRect(shape) {
  const rx = shape.rx ?? shape.borderRadius;
  const r1 = shape.r1 ?? rx ?? 0;
  const r2 = shape.r2 ?? rx ?? 0;
  const r3 = shape.r3 ?? rx ?? 0;
  const r4 = shape.r4 ?? rx ?? 0;
  const hasIndividualCorners = r1 !== r2 || r2 !== r3 || r3 !== r4;
  const hasBlur = shape.blur && shape.blur > 0;

  const transform = shapeTransform(shape);

  if (hasIndividualCorners) {
    const w = shape.width || 1;
    const h = shape.height || 1;
    const path = `M ${r1},0 L ${w - r2},0 Q ${w},0 ${w},${r2} L ${w},${h - r3} Q ${w},${h} ${w - r3},${h} L ${r4},${h} Q 0,${h} 0,${h - r4} L 0,${r1} Q 0,0 ${r1},0 Z`;
    const pathAttrs = {
      id: `shape-${shape.id}`,
      d: path,
      fill: shapeFills(shape) || '#4a90d9',
      opacity: shapeOpacity(shape),
    };
    applyStrokeAttrs(pathAttrs, shape);
    if (!pathAttrs.stroke) {
      pathAttrs.stroke = 'transparent';
      pathAttrs['stroke-width'] = 0;
    }
    if (transform) pathAttrs.transform = transform;
    if (hasBlur) pathAttrs.filter = `url(#blur-${shape.id})`;

    const children = [];
    if (hasBlur) children.push(el('defs', {}, [el('filter', { id: `blur-${shape.id}` }, [el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: String(shape.blur) })])]));
    return el('g', {}, [el('path', pathAttrs), ...children]);
  }

  const attrs = {
    id: `shape-${shape.id}`,
    x: shape.x || 0,
    y: shape.y || 0,
    width: shape.width || 1,
    height: shape.height || 1,
    fill: shapeFills(shape) || '#4a90d9',
    rx: r1 > 0 ? r1 : 0,
    opacity: shapeOpacity(shape),
  };
  applyStrokeAttrs(attrs, shape);
  if (!attrs.stroke) {
    attrs.stroke = 'transparent';
    attrs['stroke-width'] = 0;
  };
  if (transform) attrs.transform = transform;
  if (hasBlur) attrs.filter = `url(#blur-${shape.id})`;

  if (hasBlur) {
    const children = [
      el('defs', {}, [el('filter', { id: `blur-${shape.id}` }, [el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: String(shape.blur) })])]),
    ];
    return el('g', {}, [el('rect', attrs), ...children]);
  }
  return el('rect', attrs);
}

function renderEllipse(shape) {
  const cx = (shape.x || 0) + (shape.width || 0) / 2;
  const cy = (shape.y || 0) + (shape.height || 0) / 2;
  const rx = (shape.width || 0) / 2;
  const ry = (shape.height || 0) / 2;
  const attrs = {
    id: `shape-${shape.id}`,
    cx, cy, rx: Math.max(0.5, rx), ry: Math.max(0.5, ry),
    fill: shapeFills(shape) || '#4a90d9',
    opacity: shapeOpacity(shape),
  };
  applyStrokeAttrs(attrs, shape);
  if (!attrs.stroke) {
    attrs.stroke = 'transparent';
    attrs['stroke-width'] = 0;
  }
  const transform = shapeTransform(shape);
  if (transform) attrs.transform = transform;
  return el('ellipse', attrs);
}

function renderText(shape) {
  const content = shape.content || shape.textContent || shape.name || '';
  const fontSize = shape.fontSize || 14;
  const fontFamily = shape.fontFamily || shape.fontFamily || 'sans-serif';
  const fontWeight = shape.fontWeight || 'normal';
  const fontStyle = shape.fontStyle || 'normal';
  const textAlign = shape.textAlign || 'left';
  const lineHeight = shape.lineHeight || 1.4;

  if (shape.pathRef) {
    const pathId = `textpath-${shape.id}`;
    const defs = el('defs', {}, [
      el('path', { id: pathId, d: shape.pathData || shape.pathRef })
    ]);
    const textAttrs = {
      id: `shape-${shape.id}`,
      fill: shapeFills(shape) || '#333',
      'font-size': fontSize,
      'font-family': fontFamily,
      'font-weight': fontWeight,
      'font-style': fontStyle,
      opacity: shapeOpacity(shape),
    };
    const transform = shapeTransform(shape);
    if (transform) textAttrs.transform = transform;
    const textPathEl = el('textPath', { href: `#${pathId}`, startOffset: shape.pathOffset || '0%' }, typeof content === 'string' ? content : 'Text');
    const textEl = el('text', textAttrs, [textPathEl]);
    return el('g', {}, [defs, textEl]);
  }

  const growType = shape.growType || shape['grow-type'] || 'fixed';
  const svgWidth = (growType === 'auto-width' || growType === 'auto-height') ? undefined : (shape.width || 100);

  const attrs = {
    id: `shape-${shape.id}`,
    x: shape.x || 0,
    y: (shape.y || 0) + fontSize * 0.8,
    fill: shapeFills(shape) || '#333',
    'font-size': fontSize,
    'font-family': fontFamily,
    'font-weight': fontWeight,
    'font-style': fontStyle,
    'text-anchor': textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start',
    opacity: shapeOpacity(shape),
  };
  const transform = shapeTransform(shape);
  if (transform) attrs.transform = transform;

  const text = typeof content === 'string' ? content : shape.name || 'Text';
  return el('text', attrs, text);
}

function renderPath(shape) {
  const d = shape.d || shape.pathData || shape.content || '';
  if (!d) return null;
  const attrs = {
    id: `shape-${shape.id}`,
    d,
    fill: shapeFills(shape) || 'transparent',
    opacity: shapeOpacity(shape),
  };
  applyStrokeAttrs(attrs, shape);
  if (!attrs.stroke) {
    attrs.stroke = '#333';
    attrs['stroke-width'] = 1;
  };
  const transform = shapeTransform(shape);
  if (transform) attrs.transform = transform;
  return el('path', attrs);
}

function renderImage(shape) {
  const rawSrc = shape.href || shape.src || shape.url || '';
  const src = resolveMediaSrc(rawSrc);
  const attrs = {
    id: `shape-${shape.id}`,
    x: shape.x || 0,
    y: shape.y || 0,
    width: shape.width || 100,
    height: shape.height || 100,
    opacity: shapeOpacity(shape),
    preserveAspectRatio: 'xMidYMid slice',
  };
  if (src) {
    attrs.href = src;
  }
  const transform = shapeTransform(shape);
  if (transform) attrs.transform = transform;

  if (src) {
    return el('image', attrs);
  }
  attrs.fill = '#ccc';
  return el('rect', attrs);
}

function renderSvgRaw(shape) {
  if (shape.svgContent) {
    const gAttrs = {
      id: `shape-${shape.id}`,
      opacity: shapeOpacity(shape),
    };
    const transform = shapeTransform(shape);
    if (transform) gAttrs.transform = transform;
    return `${el('g', gAttrs)}${shape.svgContent}</g>`;
  }
  const attrs = {
    id: `shape-${shape.id}`,
    x: shape.x || 0,
    y: shape.y || 0,
    width: shape.width || 100,
    height: shape.height || 100,
    opacity: shapeOpacity(shape),
  };
  const transform = shapeTransform(shape);
  if (transform) attrs.transform = transform;
  return el('rect', { ...attrs, fill: '#eee', stroke: '#bbb', 'stroke-width': 1, 'stroke-dasharray': '4 2' });
}

function renderBool(shape, depth) {
  const children = [];
  const objects = shape.objects || shape.children || [];
  const list = Array.isArray(objects) ? objects : Object.values(objects || {});
  for (const child of list) {
    const childEl = renderShape(child, depth + 1);
    if (childEl) children.push(childEl);
  }

  const boolLabel = shape.boolType || 'union';
  const labelColors = {
    union: '#31efb8',
    difference: '#ff6b6b',
    intersection: '#4a90d9',
    exclude: '#f5a623',
  };
  const labelColor = labelColors[boolLabel] || '#ccc';

  const attrs = {
    id: `shape-${shape.id}`,
    x: shape.x || 0,
    y: shape.y || 0,
    width: shape.width || 1,
    height: shape.height || 1,
    fill: shapeFills(shape) || 'none',
    stroke: shapeStrokes(shape)?.color || '#ccc',
    'stroke-width': shapeStrokes(shape)?.width || 1,
    'stroke-dasharray': '4 2',
    opacity: shapeOpacity(shape),
  };
  const transform = shapeTransform(shape);
  if (transform) attrs.transform = transform;

  const g = el('g', attrs, children.length > 0 ? children : [
    el('rect', {
      x: shape.x || 0, y: shape.y || 0,
      width: shape.width || 1, height: shape.height || 1,
      fill: 'none', stroke: labelColor, 'stroke-width': 1,
      'stroke-dasharray': '4 2',
    }),
    el('text', {
      x: (shape.x || 0) + 4,
      y: (shape.y || 0) + 14,
      fill: labelColor,
      'font-size': '10',
      'font-family': 'sans-serif',
    }, `\u2295 ${boolLabel}`),
  ]);
  return g;
}

export function renderPage(page, viewport = { x: 0, y: 0, width: 1200, height: 800 }, selectedIds = [], resizeHandle = null) {
  const svg = el('svg', {
    viewBox: `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`,
    width: '100%',
    height: '100%',
    style: 'background: #f5f5f5;',
  });

  const objects = page.objects || page.children || {};
  const shapeList = Array.isArray(objects) ? objects : Object.values(objects);

  for (const shape of shapeList) {
    const shapeEl = renderShape(shape, 0);
    if (shapeEl) {
      if (selectedIds.includes(shape.id)) {
        if (!shapeEl.hasAttribute('data-selected')) {
          shapeEl.setAttribute('data-selected', 'true');
          const origStroke = shapeEl.getAttribute('stroke') || '';
          const origStrokeWidth = parseFloat(shapeEl.getAttribute('stroke-width') || '0');
          shapeEl.setAttribute('stroke', 'var(--penpot-selection, #7b61ff)');
          shapeEl.setAttribute('stroke-width', String(Math.max(origStrokeWidth, 1.5)));
          if (shape.type === 'text') {
            shapeEl.style.outline = '2px solid var(--penpot-selection, #7b61ff)';
            shapeEl.style.outlineOffset = '2px';
          }
        }
      }
      svg.appendChild(shapeEl);
    }
  }

  // Render selection handles for single selected shape
  if (selectedIds.length === 1) {
    const selectedShape = shapeList.find(s => s.id === selectedIds[0]);
    if (selectedShape) {
      const handles = getResizeHandles(selectedShape);
      for (const [name, hx, hy] of handles) {
        const rect = el('rect', {
          x: String(hx - 4),
          y: String(hy - 4),
          width: '8',
          height: '8',
          fill: '#ffffff',
          stroke: 'var(--penpot-primary, #31efb8)',
          'stroke-width': '1.5',
          'data-handle': name,
          style: 'cursor: pointer;',
        });
        svg.appendChild(rect);
      }

      // Rotation handle
      const rotHandle = getRotationHandle(selectedShape);
      const rotLine = el('line', {
        x1: String(selectedShape.x + (selectedShape.width || 0) / 2),
        y1: String(selectedShape.y),
        x2: String(rotHandle.x),
        y2: String(rotHandle.y),
        stroke: 'var(--penpot-primary, #31efb8)',
        'stroke-width': '1',
      });
      svg.appendChild(rotLine);
      const rotCircle = el('circle', {
        cx: String(rotHandle.x),
        cy: String(rotHandle.y),
        r: '5',
        fill: '#ffffff',
        stroke: 'var(--penpot-primary, #31efb8)',
        'stroke-width': '1.5',
        'data-handle': 'rotation',
        style: 'cursor: grab;',
      });
      svg.appendChild(rotCircle);
    }
  }

  return svg;
}

const HANDLE_NAMES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function getResizeHandles(shape) {
  const { x, y, width: w, height: h } = shape;
  return [
    ['nw', x, y],
    ['n', x + w / 2, y],
    ['ne', x + w, y],
    ['e', x + w, y + h / 2],
    ['se', x + w, y + h],
    ['s', x + w / 2, y + h],
    ['sw', x, y + h],
    ['w', x, y + h / 2],
  ];
}

export function getRotationHandle(shape) {
  const { x, y, width: w, height: h } = shape;
  const rotationHandleOffset = 20;
  return { x: x + w / 2, y: y - rotationHandleOffset };
}

export function renderEmptyCanvas(message = 'No shapes on this page') {
  const svg = el('svg', {
    viewBox: '0 0 1200 800',
    width: '100%',
    height: '100%',
    style: 'background: #f5f5f5;',
  });

  const rect = el('rect', {
    x: 100, y: 80, width: 1000, height: 640, rx: 4,
    fill: '#ffffff', stroke: '#e0e0e0', 'stroke-width': 1,
  });

  const text = el('text', {
    x: 600, y: 400,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    'font-size': 16,
    'font-family': '-apple-system, sans-serif',
    fill: '#999',
  }, message);

  svg.appendChild(rect);
  svg.appendChild(text);
  return svg;
}

export function renderShapeToSVGString(shape) {
  const el = renderShape(shape);
  if (!el) return '';
  const tmp = document.createElement('div');
  tmp.appendChild(el.cloneNode(true));
  return tmp.innerHTML;
}