/**
 * @module snap
 * @description Snap/alignment guides that show when shapes align with each other
 * or with the canvas edges. Renders guide lines on the canvas SVG overlay.
 */

const SNAP_THRESHOLD = 5;

export class SnapGuides {
  #canvas = null;
  #guideEls = [];

  constructor(canvas) {
    this.#canvas = canvas;
  }

  snap(shape, allShapes, viewport, rulerGuides) {
    const guides = [];
    let bestDx = null;
    let bestDy = null;

    const edges = getEdges(shape);

    for (const other of allShapes) {
      if (other.id === shape.id) continue;
      const otherEdges = getEdges(other);

      for (const [edgeName, edgeVal] of Object.entries(edges)) {
        for (const [otherEdgeName, otherEdgeVal] of Object.entries(otherEdges)) {
          if (Math.abs(edgeVal - otherEdgeVal) < SNAP_THRESHOLD) {
            const delta = otherEdgeVal - edgeVal;
            const isVertical = edgeName === 'left' || edgeName === 'right' || edgeName === 'centerX';
            if (isVertical) {
              if (bestDx === null || Math.abs(delta) < Math.abs(bestDx)) bestDx = delta;
            } else {
              if (bestDy === null || Math.abs(delta) < Math.abs(bestDy)) bestDy = delta;
            }
            guides.push({ type: isVertical ? 'vertical' : 'horizontal', pos: otherEdgeVal });
          }
        }
      }
    }

    const canvasEdges = {
      left: viewport ? viewport.x : 0,
      top: viewport ? viewport.y : 0,
      right: viewport ? viewport.x + viewport.width : 1200,
      bottom: viewport ? viewport.y + viewport.height : 800,
      centerX: viewport ? viewport.x + viewport.width / 2 : 600,
      centerY: viewport ? viewport.y + viewport.height / 2 : 400,
    };

    for (const [edgeName, edgeVal] of Object.entries(edges)) {
      for (const [canvasEdgeName, canvasEdgeVal] of Object.entries(canvasEdges)) {
        if (Math.abs(edgeVal - canvasEdgeVal) < SNAP_THRESHOLD) {
          const delta = canvasEdgeVal - edgeVal;
          const isVertical = edgeName === 'left' || edgeName === 'right' || edgeName === 'centerX';
          if (isVertical) {
            if (bestDx === null || Math.abs(delta) < Math.abs(bestDx)) bestDx = delta;
          } else {
            if (bestDy === null || Math.abs(delta) < Math.abs(bestDy)) bestDy = delta;
          }
          guides.push({ type: isVertical ? 'vertical' : 'horizontal', pos: canvasEdgeVal });
        }
      }
    }

    if (rulerGuides && rulerGuides.length > 0) {
      for (const guide of rulerGuides) {
        const guidePos = guide.position;
        const isXAxis = guide.axis === 'x';
        for (const [edgeName, edgeVal] of Object.entries(edges)) {
          const isVerticalEdge = edgeName === 'left' || edgeName === 'right' || edgeName === 'centerX';
          if (isXAxis && isVerticalEdge) {
            if (Math.abs(edgeVal - guidePos) < SNAP_THRESHOLD) {
              const delta = guidePos - edgeVal;
              if (bestDx === null || Math.abs(delta) < Math.abs(bestDx)) bestDx = delta;
              guides.push({ type: 'vertical', pos: guidePos });
            }
          } else if (!isXAxis && !isVerticalEdge) {
            if (Math.abs(edgeVal - guidePos) < SNAP_THRESHOLD) {
              const delta = guidePos - edgeVal;
              if (bestDy === null || Math.abs(delta) < Math.abs(bestDy)) bestDy = delta;
              guides.push({ type: 'horizontal', pos: guidePos });
            }
          }
        }
      }
    }

    return { guides: deduplicateGuides(guides), adjustments: { x: bestDx || 0, y: bestDy || 0 } };
  }

  render(guides) {
    this.clear();
    const svg = this.#canvas?.querySelector('svg') || this.#canvas?.querySelector('#container svg');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';

    for (const guide of guides) {
      const el = document.createElementNS(NS, guide.type === 'vertical' ? 'line' : 'line');
      if (guide.type === 'vertical') {
        el.setAttribute('x1', String(guide.pos));
        el.setAttribute('y1', '-10000');
        el.setAttribute('x2', String(guide.pos));
        el.setAttribute('y2', '10000');
      } else {
        el.setAttribute('x1', '-10000');
        el.setAttribute('y1', String(guide.pos));
        el.setAttribute('x2', '10000');
        el.setAttribute('y2', String(guide.pos));
      }
      el.setAttribute('stroke', '#31efb8');
      el.setAttribute('stroke-width', '0.5');
      el.setAttribute('stroke-dasharray', '4 2');
      el.setAttribute('pointer-events', 'none');
      el.classList.add('snap-guide');
      svg.appendChild(el);
      this.#guideEls.push(el);
    }
  }

  clear() {
    for (const el of this.#guideEls) {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    this.#guideEls = [];
  }

  destroy() {
    this.clear();
  }
}

function getEdges(shape) {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  return {
    left: shape.x,
    right: shape.x + shape.width,
    top: shape.y,
    bottom: shape.y + shape.height,
    centerX: cx,
    centerY: cy,
  };
}

function deduplicateGuides(guides) {
  const seen = new Set();
  return guides.filter(g => {
    const key = `${g.type}:${g.pos.toFixed(1)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}