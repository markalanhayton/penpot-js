export function parseSVG(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid SVG: ' + parseError.textContent);
  }

  const svgEl = doc.documentElement;
  const shapes = [];
  const vb = svgEl.getAttribute('viewBox');
  let offsetX = 0;
  let offsetY = 0;

  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length >= 4) {
      offsetX = parts[0] || 0;
      offsetY = parts[1] || 0;
    }
  }

  function parseColor(val) {
    if (!val || val === 'none') return null;
    return val;
  }

  function processNode(node, parentX = 0, parentY = 0) {
    const tag = node.localName;
    if (!tag) return;

    const x = parseFloat(node.getAttribute('x') || '0') || 0;
    const y = parseFloat(node.getAttribute('y') || '0') || 0;
    const width = parseFloat(node.getAttribute('width') || '0') || 0;
    const height = parseFloat(node.getAttribute('height') || '0') || 0;
    const fill = parseColor(node.getAttribute('fill'));
    const stroke = parseColor(node.getAttribute('stroke'));
    const strokeWidth = parseFloat(node.getAttribute('stroke-width') || '1') || 1;
    const opacity = parseFloat(node.getAttribute('opacity') || '1');
    const transform = node.getAttribute('transform') || '';

    const fills = fill ? [{ fillType: 'solid', color: fill }] : [];
    const strokes = stroke ? [{ color: stroke, width: strokeWidth }] : [];

    switch (tag) {
      case 'rect': {
        const rx = parseFloat(node.getAttribute('rx') || '0') || 0;
        shapes.push({
          type: 'rect',
          x: parentX + x - offsetX,
          y: parentY + y - offsetY,
          width: Math.max(1, width),
          height: Math.max(1, height),
          fills,
          strokes,
          opacity,
          rx,
        });
        break;
      }
      case 'circle': {
        const cx = parseFloat(node.getAttribute('cx') || '0') || 0;
        const cy = parseFloat(node.getAttribute('cy') || '0') || 0;
        const r = parseFloat(node.getAttribute('r') || '0') || 0;
        shapes.push({
          type: 'circle',
          x: parentX + cx - r - offsetX,
          y: parentY + cy - r - offsetY,
          width: Math.max(1, r * 2),
          height: Math.max(1, r * 2),
          fills,
          strokes,
          opacity,
        });
        break;
      }
      case 'ellipse': {
        const cx = parseFloat(node.getAttribute('cx') || '0') || 0;
        const cy = parseFloat(node.getAttribute('cy') || '0') || 0;
        const rx = parseFloat(node.getAttribute('rx') || '0') || 0;
        const ry = parseFloat(node.getAttribute('ry') || '0') || 0;
        shapes.push({
          type: 'ellipse',
          x: parentX + cx - rx - offsetX,
          y: parentY + cy - ry - offsetY,
          width: Math.max(1, rx * 2),
          height: Math.max(1, ry * 2),
          fills,
          strokes,
          opacity,
        });
        break;
      }
      case 'line': {
        const x1 = parseFloat(node.getAttribute('x1') || '0') || 0;
        const y1 = parseFloat(node.getAttribute('y1') || '0') || 0;
        const x2 = parseFloat(node.getAttribute('x2') || '0') || 0;
        const y2 = parseFloat(node.getAttribute('y2') || '0') || 0;
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const maxX = Math.max(x1, x2);
        const maxY = Math.max(y1, y2);
        const d = `M ${x1 - minX} ${y1 - minY} L ${x2 - minX} ${y2 - minY}`;
        shapes.push({
          type: 'path',
          x: parentX + minX - offsetX,
          y: parentY + minY - offsetY,
          width: Math.max(1, maxX - minX),
          height: Math.max(1, maxY - minY),
          d,
          fills: [],
          strokes: stroke ? [{ color: stroke, width: strokeWidth }] : [{ color: '#000', width: 1 }],
          opacity,
        });
        break;
      }
      case 'path': {
        const d = node.getAttribute('d');
        if (d) {
          const pathBBox = estimatePathBBox(d);
          shapes.push({
            type: 'path',
            x: parentX + (pathBBox.x || 0) - offsetX,
            y: parentY + (pathBBox.y || 0) - offsetY,
            width: Math.max(1, pathBBox.width || 50),
            height: Math.max(1, pathBBox.height || 50),
            d,
            fills,
            strokes: strokes.length > 0 ? strokes : [{ color: '#000', width: 1 }],
            opacity,
          });
        }
        break;
      }
      case 'polygon':
      case 'polyline': {
        const points = node.getAttribute('points') || '';
        if (points.trim()) {
          const d = polygonToPath(points, tag === 'polygon');
          shapes.push({
            type: 'path',
            x: parentX - offsetX,
            y: parentY - offsetY,
            width: 100,
            height: 100,
            d,
            fills: tag === 'polygon' ? fills : [],
            strokes: strokes.length > 0 ? strokes : [{ color: '#000', width: 1 }],
            opacity,
          });
        }
        break;
      }
      case 'text': {
        const content = node.textContent || '';
        const fontSize = parseFloat(node.getAttribute('font-size') || '14') || 14;
        const fontFamily = node.getAttribute('font-family') || 'sans-serif';
        const fillColor = fill || node.getAttribute('color') || '#000';
        shapes.push({
          type: 'text',
          x: parentX + x - offsetX,
          y: parentY + y - offsetY,
          width: Math.max(20, content.length * fontSize * 0.6),
          height: fontSize * 1.4,
          content,
          fontSize,
          fontFamily,
          fills: [{ fillType: 'solid', color: fillColor }],
          strokes: [],
          opacity,
        });
        break;
      }
      case 'g': {
        const gx = x || 0;
        const gy = y || 0;
        for (const child of node.children) {
          processNode(child, parentX + gx, parentY + gy);
        }
        break;
      }
      default:
        for (const child of node.children) {
          processNode(child, parentX, parentY);
        }
    }
  }

  for (const child of svgEl.children) {
    processNode(child);
  }

  return shapes;
}

function estimatePathBBox(d) {
  const nums = d.match(/-?\d+\.?\d*/g);
  if (!nums || nums.length < 2) return { x: 0, y: 0, width: 50, height: 50 };
  const values = nums.map(Number);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < values.length - 1; i += 2) {
    const x = values[i];
    const y = values[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) minX = 0;
  if (!isFinite(minY)) minY = 0;
  if (!isFinite(maxX)) maxX = 50;
  if (!isFinite(maxY)) maxY = 50;
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function polygonToPath(pointsStr, closed) {
  const points = pointsStr.trim().split(/[\s,]+/).map(Number);
  if (points.length < 4) return 'M 0 0';
  let d = `M ${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length - 1; i += 2) {
    d += ` L ${points[i]} ${points[i + 1]}`;
  }
  if (closed) d += ' Z';
  return d;
}