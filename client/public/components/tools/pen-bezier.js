'use strict';
import { PenpotTool } from './base.js';
import { createShape } from '../../lib/types.js';

export class PenBezierTool extends PenpotTool {
  #points = [];
  #controlPoints = [];
  #isDrawing = false;
  #pathEl = null;
  #pointMarkers = [];
  #controlLineEls = [];
  #mode = 'pen';
  #hoverX = 0;
  #hoverY = 0;
  #draggingPoint = null;
  #draggingHandle = null;

  constructor() {
    super();
  }

  onActivate(canvas) {
    this.#points = [];
    this.#controlPoints = [];
    this.#isDrawing = false;
    this.#mode = 'pen';
    this.#removeVisuals(canvas);
  }

  onDeactivate(canvas) {
    this.#finishPath(canvas);
    this.#removeVisuals(canvas);
  }

  onMouseDown(event, canvas) {
    if (event.button !== 0) return;
    const pos = this.screenToCanvas(event.clientX, event.clientY);

    if (this.#mode === 'freehand') {
      if (!this.#isDrawing) {
        this.#isDrawing = true;
        this.#points = [{ x: pos.x, y: pos.y }];
      }
      return;
    }

    if (event.altKey && this.#points.length > 0) {
      const lastPt = this.#points[this.#points.length - 1];
      this.#controlPoints[this.#controlPoints.length - 1] = { 
        cp1: null,
        cp2: { x: pos.x, y: pos.y },
        symmetric: false 
      };
      this.#updatePath(canvas);
      return;
    }

    if (this.#points.length > 0) {
      const lastPt = this.#points[this.#points.length - 1];
      if (Math.abs(pos.x - lastPt.x) < 5 && Math.abs(pos.y - lastPt.y) < 5) {
        this.#finishPath(canvas);
        return;
      }
    }

    this.#points.push({ x: pos.x, y: pos.y });
    this.#controlPoints.push({ cp1: null, cp2: null, symmetric: true });
    this.#isDrawing = true;
    this.#updatePath(canvas);
  }

  onMouseMove(event, canvas) {
    const pos = this.screenToCanvas(event.clientX, event.clientY);
    this.#hoverX = pos.x;
    this.#hoverY = pos.y;

    if (this.#mode === 'freehand' && this.#isDrawing) {
      this.#points.push({ x: pos.x, y: pos.y });
      this.#updatePath(canvas);
      return;
    }

    if (this.#isDrawing) {
      this.#updatePath(canvas);
    }

    if (this.#draggingHandle !== null && this.#draggingPoint !== null) {
      const ptIdx = this.#draggingPoint;
      const handleIdx = this.#draggingHandle;
      if (this.#controlPoints[ptIdx]) {
        if (handleIdx === 1) {
          this.#controlPoints[ptIdx].cp1 = { x: pos.x, y: pos.y };
          if (this.#controlPoints[ptIdx].symmetric) {
            const anchor = this.#points[ptIdx];
            this.#controlPoints[ptIdx].cp2 = {
              x: 2 * anchor.x - pos.x,
              y: 2 * anchor.y - pos.y
            };
          }
        } else {
          this.#controlPoints[ptIdx].cp2 = { x: pos.x, y: pos.y };
          if (this.#controlPoints[ptIdx].symmetric) {
            const anchor = this.#points[ptIdx];
            this.#controlPoints[ptIdx].cp1 = {
              x: 2 * anchor.x - pos.x,
              y: 2 * anchor.y - pos.y
            };
          }
        }
        this.#updatePath(canvas);
      }
    }
  }

  onMouseUp(event, canvas) {
    if (this.#mode === 'freehand' && this.#isDrawing) {
      if (this.#points.length >= 2) {
        this.#finishPath(canvas);
      } else {
        this.#isDrawing = false;
      }
      return;
    }
    this.#draggingHandle = null;
    this.#draggingPoint = null;
  }

  onKeyDown(event, canvas) {
    if (event.key === 'Escape') {
      this.#finishPath(canvas);
    }
    if (event.key === 'Enter' && this.#points.length >= 2) {
      this.#finishPath(canvas);
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.#points.length > 0) {
        this.#points.pop();
        this.#controlPoints.pop();
        this.#updatePath(canvas);
      }
    }
  }

  onDblClick(event, canvas) {
    if (this.#points.length >= 2) {
      this.#finishPath(canvas);
    }
  }

  getCursor() { return this.#mode === 'freehand' ? 'crosshair' : 'crosshair'; }

  setMode(mode) {
    this.#mode = mode;
  }

  #updatePath(canvas) {
    this.#removeVisuals(canvas);
    if (this.#points.length < 1) return;

    const svg = canvas.querySelector('svg') || canvas.querySelector('#container svg');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';

    const d = this.#buildPathData();
    this.#pathEl = document.createElementNS(NS, 'path');
    this.#pathEl.setAttribute('d', d);
    this.#pathEl.setAttribute('fill', this.#mode === 'freehand' ? 'none' : 'none');
    this.#pathEl.setAttribute('stroke', 'var(--penpot-primary, #31efb8)');
    this.#pathEl.setAttribute('stroke-width', '2');
    this.#pathEl.setAttribute('pointer-events', 'none');
    svg.appendChild(this.#pathEl);

    for (let i = 0; i < this.#points.length; i++) {
      const pt = this.#points[i];
      const cp = this.#controlPoints[i];

      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', String(pt.x));
      circle.setAttribute('cy', String(pt.y));
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', i === 0 ? '#31efb8' : '#fff');
      circle.setAttribute('stroke', '#31efb8');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('pointer-events', 'none');
      svg.appendChild(circle);
      this.#pointMarkers.push(circle);

      if (cp) {
        if (cp.cp1) {
          const line = document.createElementNS(NS, 'line');
          line.setAttribute('x1', String(pt.x));
          line.setAttribute('y1', String(pt.y));
          line.setAttribute('x2', String(cp.cp1.x));
          line.setAttribute('y2', String(cp.cp1.y));
          line.setAttribute('stroke', 'rgba(49,239,184,0.5)');
          line.setAttribute('stroke-width', '1');
          line.setAttribute('pointer-events', 'none');
          svg.appendChild(line);
          this.#controlLineEls.push(line);

          const hc = document.createElementNS(NS, 'circle');
          hc.setAttribute('cx', String(cp.cp1.x));
          hc.setAttribute('cy', String(cp.cp1.y));
          hc.setAttribute('r', '3');
          hc.setAttribute('fill', '#31efb8');
          hc.setAttribute('stroke', '#fff');
          hc.setAttribute('stroke-width', '1');
          hc.setAttribute('pointer-events', 'none');
          svg.appendChild(hc);
          this.#pointMarkers.push(hc);
        }
        if (cp.cp2) {
          const line = document.createElementNS(NS, 'line');
          line.setAttribute('x1', String(pt.x));
          line.setAttribute('y1', String(pt.y));
          line.setAttribute('x2', String(cp.cp2.x));
          line.setAttribute('y2', String(cp.cp2.y));
          line.setAttribute('stroke', 'rgba(49,239,184,0.5)');
          line.setAttribute('stroke-width', '1');
          line.setAttribute('pointer-events', 'none');
          svg.appendChild(line);
          this.#controlLineEls.push(line);

          const hc = document.createElementNS(NS, 'circle');
          hc.setAttribute('cx', String(cp.cp2.x));
          hc.setAttribute('cy', String(cp.cp2.y));
          hc.setAttribute('r', '3');
          hc.setAttribute('fill', '#31efb8');
          hc.setAttribute('stroke', '#fff');
          hc.setAttribute('stroke-width', '1');
          hc.setAttribute('pointer-events', 'none');
          svg.appendChild(hc);
          this.#pointMarkers.push(hc);
        }
      }
    }

    if (this.#isDrawing && this.#points.length > 0 && this.#mode === 'pen') {
      const lastPt = this.#points[this.#points.length - 1];
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(lastPt.x));
      line.setAttribute('y1', String(lastPt.y));
      line.setAttribute('x2', String(this.#hoverX));
      line.setAttribute('y2', String(this.#hoverY));
      line.setAttribute('stroke', 'rgba(49,239,184,0.3)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4 2');
      line.setAttribute('pointer-events', 'none');
      svg.appendChild(line);
      this.#controlLineEls.push(line);
    }
  }

  #buildPathData() {
    if (this.#points.length === 0) return '';
    if (this.#points.length === 1) {
      return `M ${this.#points[0].x} ${this.#points[0].y}`;
    }

    let d = `M ${this.#points[0].x} ${this.#points[0].y}`;

    for (let i = 1; i < this.#points.length; i++) {
      const prevCp = this.#controlPoints[i - 1];
      const currCp = this.#controlPoints[i];
      const pt = this.#points[i];

      if (prevCp?.cp2) {
        const cp2 = prevCp.cp2;
        const cp1 = currCp?.cp1;
        if (cp1) {
          d += ` C ${cp2.x} ${cp2.y} ${cp1.x} ${cp1.y} ${pt.x} ${pt.y}`;
        } else {
          d += ` C ${cp2.x} ${cp2.y} ${pt.x} ${pt.y} ${pt.x} ${pt.y}`;
        }
      } else if (currCp?.cp1) {
        const cp1 = currCp.cp1;
        d += ` C ${this.#points[i-1].x} ${this.#points[i-1].y} ${cp1.x} ${cp1.y} ${pt.x} ${pt.y}`;
      } else {
        d += ` L ${pt.x} ${pt.y}`;
      }
    }

    if (this.#mode === 'pen' && this.#isDrawing) {
      d += ` L ${this.#hoverX} ${this.#hoverY}`;
    }

    return d;
  }

  #finishPath(canvas) {
    this.#removeVisuals(canvas);
    if (this.#points.length < 2) {
      this.#points = [];
      this.#controlPoints = [];
      this.#isDrawing = false;
      return;
    }

    const pathData = this.#buildPathData();
    const bounds = this.#getBounds();

    const shape = createShape('path', {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      d: pathData,
      fills: this.#mode === 'freehand' ? [] : [],
      strokes: [{ style: 'solid', color: '#333333', width: 2, cap: 'round', join: 'round', alignment: 'center' }],
    });

    this.workspace.emit('penpot-shape-create', { shape });
    this.#points = [];
    this.#controlPoints = [];
    this.#isDrawing = false;
  }

  #getBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of this.#points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    for (const cp of this.#controlPoints) {
      if (cp?.cp1) {
        if (cp.cp1.x < minX) minX = cp.cp1.x;
        if (cp.cp1.y < minY) minY = cp.cp1.y;
        if (cp.cp1.x > maxX) maxX = cp.cp1.x;
        if (cp.cp1.y > maxY) maxY = cp.cp1.y;
      }
      if (cp?.cp2) {
        if (cp.cp2.x < minX) minX = cp.cp2.x;
        if (cp.cp2.y < minY) minY = cp.cp2.y;
        if (cp.cp2.x > maxX) maxX = cp.cp2.x;
        if (cp.cp2.y > maxY) maxY = cp.cp2.y;
      }
    }
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }

  #removeVisuals(canvas) {
    if (this.#pathEl?.parentNode) {
      this.#pathEl.parentNode.removeChild(this.#pathEl);
    }
    this.#pathEl = null;
    for (const m of this.#pointMarkers) {
      if (m.parentNode) m.parentNode.removeChild(m);
    }
    this.#pointMarkers = [];
    for (const l of this.#controlLineEls) {
      if (l.parentNode) l.parentNode.removeChild(l);
    }
    this.#controlLineEls = [];
  }
}