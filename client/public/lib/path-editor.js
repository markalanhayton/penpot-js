'use strict';
import * as path from '../../shared/src/types/path.js';
import * as gpt from '../../shared/src/geom/point.js';
import * as grc from '../../shared/src/geom/rect.js';
import * as helpers from '../../shared/src/types/path/helpers.js';

const CLOSE_THRESHOLD = 5;

export class PathEditor {
  #shapeId = null;
  #editMode = 'move';
  #selectedPoints = new Set();
  #hoverPoint = null;
  #hoverHandler = null;
  #contentModifiers = {};
  #movingNodes = false;
  #movingHandler = null;
  #snapToggled = false;
  #oldContent = null;
  #undoStack = [];
  #redoStack = [];
  #canvas = null;
  #workspace = null;
  #overlayGroup = null;
  #pointEls = [];
  #handlerEls = [];
  #lineEls = [];
  #previewEl = null;
  #dragStart = null;
  #dragging = false;
  #dragType = null;
  #dragData = null;
  #marqueeEl = null;
  #marqueeStart = null;
  #currentShape = null;
  #getShapeFn = null;

  constructor(canvas, workspace) {
    this.#canvas = canvas;
    this.#workspace = workspace;
  }

  setGetShapeFn(fn) {
    this.#getShapeFn = fn;
  }

  get store() { return null; }

  startEdit(shapeId, shape) {
    this.#shapeId = shapeId;
    this.#editMode = 'move';
    this.#selectedPoints = new Set();
    this.#contentModifiers = {};
    this.#movingNodes = false;
    this.#movingHandler = null;
    this.#snapToggled = false;
    this.#undoStack = [];
    this.#redoStack = [];
    this.#dragging = false;
    this.#dragStart = null;
    this.#dragType = null;

    if (shape && shape.content) {
      this.#oldContent = shape.content;
    }

    this.#workspace.emit('penpot-path-edit-start', { shapeId, editMode: this.#editMode });
    this.render(shape);
  }

  stopEdit() {
    const shapeId = this.#shapeId;
    this.#removeOverlay();
    this.#shapeId = null;
    this.#selectedPoints = new Set();
    this.#contentModifiers = {};
    this.#oldContent = null;
    this.#undoStack = [];
    this.#redoStack = [];
    this.#workspace.emit('penpot-path-edit-stop', { shapeId });
  }

  get shapeId() { return this.#shapeId; }
  get editMode() { return this.#editMode; }
  get selectedPoints() { return this.#selectedPoints; }
  get snapToggled() { return this.#snapToggled; }
  get isActive() { return this.#shapeId !== null; }

  setEditMode(mode) {
    if (mode === this.#editMode) return;
    this.#editMode = mode;
    this.#workspace.emit('penpot-path-edit-mode', { shapeId: this.#shapeId, editMode: mode });
    const shape = this.#getShape();
    if (shape) this.render(shape);
  }

  toggleSnap() {
    this.#snapToggled = !this.#snapToggled;
  }

  selectNode(position, shift) {
    if (shift) {
      if (this.#selectedPoints.has(position)) {
        this.#selectedPoints.delete(position);
      } else {
        this.#selectedPoints.add(position);
      }
    } else {
      this.#selectedPoints = new Set([position]);
    }
    const shape = this.#getShape();
    if (shape) this.render(shape);
  }

  deselectAll() {
    this.#selectedPoints = new Set();
    const shape = this.#getShape();
    if (shape) this.render(shape);
  }

  handleMouseDown(event, screenToCanvas) {
    if (!this.#shapeId) return false;

    const pos = screenToCanvas(event.clientX, event.clientY);
    const shape = this.#getShape();
    if (!shape || !shape.content) return false;

    const content = path.content(shape.content);
    const hitResult = this.#hitTest(content, pos);
    this.#dragStart = gpt.point(pos.x, pos.y);
    this.#dragging = false;

    if (hitResult) {
      if (hitResult.type === 'handler') {
        this.#dragType = 'handler';
        this.#dragData = { index: hitResult.index, prefix: hitResult.prefix };
        this.#movingHandler = hitResult;
        return true;
      }

      if (hitResult.type === 'point') {
        this.#dragType = 'point';
        this.#dragData = { position: hitResult.position };
        if (!this.#selectedPoints.has(hitResult.position)) {
          if (!event.shiftKey) {
            this.#selectedPoints = new Set([hitResult.position]);
          } else {
            this.#selectedPoints.add(hitResult.position);
          }
        }
        this.render(shape);
        return true;
      }
    }

    if (this.#editMode === 'draw') {
      this.#drawAddPoint(content, pos, shape);
      return true;
    }

    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
      this.deselectAll();
    }

    this.#dragType = 'marquee';
    this.#dragData = { append: event.shiftKey || event.ctrlKey || event.metaKey };
    this.#marqueeStart = gpt.point(pos.x, pos.y);
    return true;
  }

  handleMouseMove(event, screenToCanvas) {
    if (!this.#shapeId || !this.#dragStart) return false;
    const pos = screenToCanvas(event.clientX, event.clientY);
    const dist = gpt.distance(this.#dragStart, pos);

    if (dist < 2 && !this.#dragging) return true;

    this.#dragging = true;
    const shape = this.#getShape();
    if (!shape || !shape.content) return false;
    const content = path.content(shape.content);

    if (this.#dragType === 'handler') {
      this.#moveHandler(content, pos, shape, event.altKey, event.shiftKey);
      return true;
    }

    if (this.#dragType === 'point') {
      this.#movePoints(content, pos, shape, event.shiftKey);
      return true;
    }

    if (this.#dragType === 'marquee') {
      this.#updateMarquee(pos, shape, this.#dragData.append);
      return true;
    }

    return true;
  }

  handleMouseUp(event, screenToCanvas) {
    if (!this.#shapeId) return false;
    const result = this.#dragging;
    const shape = this.#getShape();

    if (this.#dragging && this.#contentModifiers && Object.keys(this.#contentModifiers).length > 0) {
      if (shape) {
        this.#applyContentModifiers(shape);
      }
    }

    if (this.#dragType === 'marquee') {
      this.#removeMarquee();
    }

    this.#dragStart = null;
    this.#dragging = false;
    this.#dragType = null;
    this.#dragData = null;
    this.#movingHandler = null;
    this.#contentModifiers = {};

    return result;
  }

  handleKeyDown(event) {
    if (!this.#shapeId) return false;
    const shape = this.#getShape();
    if (!shape) return false;

    if (event.key === 'Escape') {
      this.stopEdit();
      return true;
    }
    if (event.key === 'Enter' || event.key === 'v' && !event.ctrlKey && !event.metaKey) {
      this.stopEdit();
      return true;
    }
    if (event.key === 'm' && !event.ctrlKey && !event.metaKey) {
      this.setEditMode('move');
      return true;
    }
    if (event.key === 'p' && !event.ctrlKey && !event.metaKey) {
      this.setEditMode('draw');
      return true;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.removeNodes();
      return true;
    }
    if (event.key === 'x' && !event.ctrlKey && !event.metaKey) {
      this.makeCorner();
      return true;
    }
    if (event.key === 'c' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      this.makeCurve();
      return true;
    }
    if ((event.key === '+' || event.key === '=') && event.shiftKey) {
      this.addNode();
      return true;
    }
    if (event.key === 'j' && !event.ctrlKey && !event.metaKey) {
      if (event.shiftKey) {
        this.mergeNodes();
      } else {
        this.joinNodes();
      }
      return true;
    }
    if (event.key === 'k' && !event.ctrlKey && !event.metaKey) {
      this.separateNodes();
      return true;
    }
    if (event.key === 's' && !event.ctrlKey && !event.metaKey) {
      this.toggleSnap();
      return true;
    }
    if (event.key === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
      this.undoEditor();
      return true;
    }
    if ((event.key === 'z' && (event.ctrlKey || event.metaKey) && event.shiftKey) ||
        (event.key === 'y' && (event.ctrlKey || event.metaKey))) {
      this.redoEditor();
      return true;
    }

    const nudge = event.shiftKey ? 10 : 1;
    const arrowKeys = {
      ArrowUp: { dx: 0, dy: -nudge },
      ArrowDown: { dx: 0, dy: nudge },
      ArrowLeft: { dx: -nudge, dy: 0 },
      ArrowRight: { dx: nudge, dy: 0 }
    };
    if (arrowKeys[event.key] && this.#selectedPoints.size > 0) {
      event.preventDefault();
      const { dx, dy } = arrowKeys[event.key];
      this.#nudgePoints(dx, dy, shape);
      return true;
    }

    return false;
  }

  makeCorner() {
    const shape = this.#getShape();
    if (!shape || this.#selectedPoints.size === 0) return;
    let content = path.content(shape.content);
    for (const pt of this.#selectedPoints) {
      content = path.makeCornerPoint(content, pt);
    }
    content = path.closeSubpaths(content);
    this.#commitContent(shape, content);
  }

  makeCurve() {
    const shape = this.#getShape();
    if (!shape || this.#selectedPoints.size === 0) return;
    let content = path.content(shape.content);
    for (const pt of this.#selectedPoints) {
      content = path.makeCurvePoint(content, pt);
    }
    content = path.closeSubpaths(content);
    this.#commitContent(shape, content);
  }

  addNode() {
    const shape = this.#getShape();
    if (!shape) return;
    let content = path.content(shape.content);
    content = path.splitSegments(content, this.#selectedPoints, 0.5);
    content = path.closeSubpaths(content);
    this.#commitContent(shape, content);
  }

  removeNodes() {
    const shape = this.#getShape();
    if (!shape || this.#selectedPoints.size === 0) return;
    let content = path.content(shape.content);
    content = path.removeNodes(content, this.#selectedPoints);
    content = path.closeSubpaths(content);
    if (content.length === 0) {
      this.stopEdit();
      this.#workspace.emit('penpot-shape-delete', { shapeId: this.#shapeId });
      return;
    }
    this.#selectedPoints = new Set();
    this.#commitContent(shape, content);
  }

  mergeNodes() {
    const shape = this.#getShape();
    if (!shape) return;
    let content = path.content(shape.content);
    content = path.mergeNodes(content, this.#selectedPoints);
    content = path.closeSubpaths(content);
    this.#selectedPoints = new Set();
    this.#commitContent(shape, content);
  }

  joinNodes() {
    const shape = this.#getShape();
    if (!shape) return;
    let content = path.content(shape.content);
    content = path.joinNodes(content, this.#selectedPoints);
    content = path.closeSubpaths(content);
    this.#selectedPoints = new Set();
    this.#commitContent(shape, content);
  }

  separateNodes() {
    const shape = this.#getShape();
    if (!shape) return;
    let content = path.content(shape.content);
    content = path.separateNodes(content, this.#selectedPoints);
    content = path.closeSubpaths(content);
    this.#commitContent(shape, content);
  }

  undoEditor() {
    if (this.#undoStack.length === 0) return;
    const entry = this.#undoStack.pop();
    this.#redoStack.push(entry);
    this.#workspace.emit('penpot-path-content-change', {
      shapeId: this.#shapeId,
      content: entry.oldContent,
    });
  }

  redoEditor() {
    if (this.#redoStack.length === 0) return;
    const entry = this.#redoStack.pop();
    this.#undoStack.push(entry);
    this.#workspace.emit('penpot-path-content-change', {
      shapeId: this.#shapeId,
      content: entry.newContent,
    });
  }

  render(shape) {
    this.#removeOverlay();
    if (!shape || !shape.content) return;

    const svg = this.#canvas.querySelector('svg') || this.#canvas.querySelector('#container svg');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';

    this.#overlayGroup = document.createElementNS(NS, 'g');
    this.#overlayGroup.setAttribute('class', 'penpot-path-editor-overlay');
    this.#overlayGroup.setAttribute('pointer-events', 'none');

    const content = path.content(shape.content);
    const allPoints = path.getPoints(content);
    const allHandlers = path.getHandlers(content);

    for (let i = 0; i < content.length; i++) {
      const seg = content.get(i);
      if (!seg || seg.command === 'close-path') continue;
      const pt = helpers.segmentToPoint(seg);
      if (!pt) continue;

      const isSelected = this.#selectedPoints.has(pt);
      const isHovered = this.#hoverPoint && gpt.close(pt, this.#hoverPoint);

      if (seg.command === 'curve-to') {
        const prevPt = i > 0 ? helpers.segmentToPoint(content.get(i - 1)) : null;
        if (prevPt) {
          const c1 = gpt.point(seg.params.c1x, seg.params.c1y);
          this.#addHandleLine(prevPt, c1, svg, NS);
          this.#addHandleCircle(c1, i, 'c1', svg, NS);
        }
        const c2 = gpt.point(seg.params.c2x, seg.params.c2y);
        this.#addHandleLine(pt, c2, svg, NS);
        this.#addHandleCircle(c2, i, 'c2', svg, NS);
      }

      this.#addAnchorPoint(pt, isSelected, isHovered, svg, NS);
    }

    svg.appendChild(this.#overlayGroup);
  }

  #addAnchorPoint(pt, isSelected, isHovered, svg, NS) {
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', String(pt.x));
    circle.setAttribute('cy', String(pt.y));
    circle.setAttribute('r', String(isSelected ? 5 : isHovered ? 4.5 : 4));
    circle.setAttribute('fill', isSelected ? '#31efb8' : '#fff');
    circle.setAttribute('stroke', isSelected ? '#31efb8' : isHovered ? '#31efb8' : '#888');
    circle.setAttribute('stroke-width', '2');
    this.#overlayGroup.appendChild(circle);
    this.#pointEls.push(circle);
  }

  #addHandleLine(anchor, handle, svg, NS) {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(anchor.x));
    line.setAttribute('y1', String(anchor.y));
    line.setAttribute('x2', String(handle.x));
    line.setAttribute('y2', String(handle.y));
    line.setAttribute('stroke', 'rgba(49,239,184,0.5)');
    line.setAttribute('stroke-width', '1');
    this.#overlayGroup.appendChild(line);
    this.#lineEls.push(line);
  }

  #addHandleCircle(handle, index, prefix, svg, NS) {
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', String(handle.x));
    circle.setAttribute('cy', String(handle.y));
    circle.setAttribute('r', '3');
    const isHovered = this.#hoverHandler &&
      this.#hoverHandler.index === index &&
      this.#hoverHandler.prefix === prefix;
    circle.setAttribute('fill', isHovered ? '#31efb8' : 'rgba(49,239,184,0.7)');
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '1');
    this.#overlayGroup.appendChild(circle);
    this.#handlerEls.push(circle);
  }

  #removeOverlay() {
    if (this.#overlayGroup?.parentNode) {
      this.#overlayGroup.parentNode.removeChild(this.#overlayGroup);
    }
    this.#overlayGroup = null;
    this.#pointEls = [];
    this.#handlerEls = [];
    this.#lineEls = [];
  }

  #removeMarquee() {
    if (this.#marqueeEl?.parentNode) {
      this.#marqueeEl.parentNode.removeChild(this.#marqueeEl);
    }
    this.#marqueeEl = null;
    this.#marqueeStart = null;
  }

  #hitTest(content, pos) {
    const allPoints = path.getPoints(content);

    for (let i = 0; i < content.length; i++) {
      const seg = content.get(i);
      if (!seg || seg.command === 'close-path') continue;
      const pt = helpers.segmentToPoint(seg);
      if (!pt) continue;

      if (seg.command === 'curve-to') {
        const c1 = gpt.point(seg.params.c1x, seg.params.c1y);
        if (gpt.distance(pos, c1) < CLOSE_THRESHOLD) {
          return { type: 'handler', index: i, prefix: 'c1' };
        }
        const c2 = gpt.point(seg.params.c2x, seg.params.c2y);
        if (gpt.distance(pos, c2) < CLOSE_THRESHOLD) {
          return { type: 'handler', index: i, prefix: 'c2' };
        }
      }

      if (gpt.distance(pos, pt) < CLOSE_THRESHOLD) {
        return { type: 'point', position: pt };
      }
    }

    const closest = path.closestPoint(content, pos, 10);
    if (closest) {
      return { type: 'point', position: closest };
    }

    return null;
  }

  #moveHandler(content, pos, shape, altKey, shiftKey) {
    const { index, prefix } = this.#dragData;
    const seg = content.get(index);
    if (!seg || seg.command !== 'curve-to') return;

    const cx = prefix + 'x';
    const cy = prefix + 'y';
    let newHandlePos = gpt.point(pos.x, pos.y);

    if (shiftKey) {
      const anchor = prefix === 'c1'
        ? helpers.segmentToPoint(content.get(index - 1))
        : helpers.segmentToPoint(seg);
      if (anchor) {
        newHandlePos = fixedAngle(anchor, newHandlePos);
      }
    }

    const oldVal = { x: seg.params[cx] || 0, y: seg.params[cy] || 0 };
    const dx = newHandlePos.x - oldVal.x;
    const dy = newHandlePos.y - oldVal.y;

    this.#contentModifiers[index] = {
      ...(this.#contentModifiers[index] || {}),
      [cx]: (this.#contentModifiers[index]?.[cx] || 0) + dx,
      [cy]: (this.#contentModifiers[index]?.[cy] || 0) + dy,
    };

    if (!altKey) {
      const opposite = path.oppositeIndex(content, index, prefix);
      if (opposite) {
        const [opIdx, opPrefix] = opposite;
        const opCx = opPrefix + 'x';
        const opCy = opPrefix + 'y';
        const opSeg = content.get(opIdx);
        if (opSeg && opSeg.command === 'curve-to') {
          const opAnchor = opPrefix === 'c1'
            ? helpers.segmentToPoint(content.get(opIdx - 1))
            : helpers.segmentToPoint(opSeg);
          const mainAnchor = prefix === 'c1'
            ? helpers.segmentToPoint(content.get(index - 1))
            : helpers.segmentToPoint(seg);
          if (opAnchor && mainAnchor && gpt.close(opAnchor, mainAnchor)) {
            const opOld = { x: opSeg.params[opCx] || 0, y: opSeg.params[opCy] || 0 };
            const mirrorDx = -(newHandlePos.x - mainAnchor.x) - (opOld.x - mainAnchor.x);
            const mirrorDy = -(newHandlePos.y - mainAnchor.y) - (opOld.y - mainAnchor.y);
            this.#contentModifiers[opIdx] = {
              ...(this.#contentModifiers[opIdx] || {}),
              [opCx]: mirrorDx,
              [opCy]: mirrorDy,
            };
          }
        }
      }
    }

    const newContent = path.applyContentModifiers(content, this.#contentModifiers);
    const newShape = path.updateGeometry(shape, newContent);
    this.#workspace.emit('penpot-path-preview', { shapeId: this.#shapeId, shape: newShape });
    this.render(newShape);
  }

  #movePoints(content, pos, shape, shiftKey) {
    if (this.#selectedPoints.size === 0) return;
    let targetPos = gpt.point(pos.x, pos.y);
    if (shiftKey && this.#dragStart) {
      targetPos = fixedAngle(this.#dragStart, targetPos);
    }
    const delta = gpt.subtract(targetPos, this.#dragStart);

    for (const pt of this.#selectedPoints) {
      const pointIndices = path.pointIndices(content, pt);
      const handlerIndices = path.handlerIndices(content, pt);

      for (const idx of pointIndices) {
        this.#contentModifiers[idx] = {
          ...(this.#contentModifiers[idx] || {}),
          x: (this.#contentModifiers[idx]?.x || 0) + delta.x,
          y: (this.#contentModifiers[idx]?.y || 0) + delta.y,
        };
      }
      for (const [idx, pfx] of handlerIndices) {
        const cx = pfx + 'x';
        const cy = pfx + 'y';
        this.#contentModifiers[idx] = {
          ...(this.#contentModifiers[idx] || {}),
          [cx]: (this.#contentModifiers[idx]?.[cx] || 0) + delta.x,
          [cy]: (this.#contentModifiers[idx]?.[cy] || 0) + delta.y,
        };
      }
    }

    this.#dragStart = targetPos;

    const newContent = path.applyContentModifiers(content, this.#contentModifiers);
    const newShape = path.updateGeometry(shape, newContent);
    this.#workspace.emit('penpot-path-preview', { shapeId: this.#shapeId, shape: newShape });
    this.render(newShape);
  }

  #nudgePoints(dx, dy, shape) {
    const content = path.content(shape.content);
    const modifiers = {};

    for (const pt of this.#selectedPoints) {
      const pointIdxs = path.pointIndices(content, pt);
      const handlerIdxs = path.handlerIndices(content, pt);
      for (const idx of pointIdxs) {
        modifiers[idx] = { ...(modifiers[idx] || {}), x: dx, y: dy };
      }
      for (const [idx, pfx] of handlerIdxs) {
        modifiers[idx] = { ...(modifiers[idx] || {}), [pfx + 'x']: dx, [pfx + 'y']: dy };
      }
    }

    const newContent = path.applyContentModifiers(content, modifiers);
    this.#commitContent(shape, newContent);
  }

  #updateMarquee(pos, shape, append) {
    if (!this.#marqueeStart) return;
    const rect = grc.pointsToRect([this.#marqueeStart, pos]);
    this.#drawMarquee(rect);

    const content = path.content(shape.content);
    const initialSet = append ? new Set(this.#selectedPoints) : new Set();

    const newSelected = new Set(initialSet);
    for (let i = 0; i < content.length; i++) {
      const seg = content.get(i);
      if (!seg || seg.command === 'close-path') continue;
      const pt = helpers.segmentToPoint(seg);
      if (!pt) continue;
      if (grc.hasPointQ(rect, pt)) {
        if (append) {
          newSelected.add(pt);
        } else {
          newSelected.add(pt);
        }
      }
    }

    if (!append) {
      const toRemove = [];
      for (const pt of this.#selectedPoints) {
        if (!newSelected.has(pt)) toRemove.push(pt);
      }
      for (const pt of toRemove) newSelected.delete(pt);
    }

    this.#selectedPoints = newSelected;
    this.render(shape);
  }

  #drawMarquee(rect) {
    this.#removeMarquee();
    const svg = this.#canvas.querySelector('svg') || this.#canvas.querySelector('#container svg');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';

    this.#marqueeEl = document.createElementNS(NS, 'rect');
    this.#marqueeEl.setAttribute('x', String(rect.x));
    this.#marqueeEl.setAttribute('y', String(rect.y));
    this.#marqueeEl.setAttribute('width', String(rect.width));
    this.#marqueeEl.setAttribute('height', String(rect.height));
    this.#marqueeEl.setAttribute('fill', 'rgba(49,239,184,0.08)');
    this.#marqueeEl.setAttribute('stroke', '#31efb8');
    this.#marqueeEl.setAttribute('stroke-width', '1');
    this.#marqueeEl.setAttribute('stroke-dasharray', '4 2');
    this.#marqueeEl.setAttribute('pointer-events', 'none');
    svg.appendChild(this.#marqueeEl);
  }

  #drawAddPoint(content, pos, shape) {
    const closest = path.closestPoint(content, pos, 20);
    if (closest) {
      let newContent = path.splitSegments(content, this.#selectedPoints, 0.5);
      newContent = path.closeSubpaths(newContent);
      this.#commitContent(shape, newContent);
    }
  }

  #applyContentModifiers(shape) {
    const content = path.content(shape.content);
    const newContent = path.applyContentModifiers(content, this.#contentModifiers);
    if (newContent.length > 0) {
      this.#pushUndo(shape.content, newContent);
      this.#workspace.emit('penpot-path-content-change', {
        shapeId: this.#shapeId,
        content: newContent,
        shape: path.updateGeometry(shape, newContent),
      });
    }
    this.#contentModifiers = {};
  }

  #commitContent(shape, newContent) {
    if (newContent.length === 0) {
      this.stopEdit();
      this.#workspace.emit('penpot-shape-delete', { shapeId: this.#shapeId });
      return;
    }
    const newShape = path.updateGeometry(shape, newContent);
    this.#pushUndo(shape.content, newContent);
    this.#workspace.emit('penpot-path-content-change', {
      shapeId: this.#shapeId,
      content: newContent,
      shape: newShape,
    });
  }

  #pushUndo(oldContent, newContent) {
    this.#undoStack.push({ oldContent, newContent });
    this.#redoStack = [];
    if (this.#undoStack.length > 50) {
      this.#undoStack.shift();
    }
  }

  #getShape() {
    if (!this.#shapeId) return null;
    if (this.#getShapeFn) {
      return this.#getShapeFn(this.#shapeId);
    }
    return this.#currentShape || null;
  }

  setCurrentShape(shape) {
    this.#currentShape = shape;
  }

  destroy() {
    this.stopEdit();
  }
}

function fixedAngle(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const dist = Math.sqrt(dx * dx + dy * dy);
  return gpt.point(
    from.x + dist * Math.cos(snapped),
    from.y + dist * Math.sin(snapped)
  );
}