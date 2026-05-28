'use strict';
import { createShape } from '../../lib/types.js';
import { SnapGuides } from '../../lib/snap.js';
import { parseSVG } from '../../lib/svg-import.js';
import { computeShapesBounds } from '../../lib/shapes.js';

function imageToDataURL(img, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export class PenpotTool {
  #active = false;
  #canvas = null;
  #workspace = null;

  activate(canvas, workspace) {
    this.#active = true;
    this.#canvas = canvas;
    this.#workspace = workspace;
    this.onActivate(canvas);
  }

  deactivate(canvas) {
    this.onDeactivate(this.#canvas);
    this.#active = false;
    this.#canvas = null;
    this.#workspace = null;
  }

  isActive() { return this.#active; }
  get canvas() { return this.#canvas; }
  get workspace() { return this.#workspace; }

  screenToCanvas(clientX, clientY) {
    if (this.#canvas && typeof this.#canvas.screenToCanvas === 'function') {
      return this.#canvas.screenToCanvas(clientX, clientY);
    }
    const rect = this.#canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  onActivate(canvas) {}
  onDeactivate(canvas) {}
  onMouseDown(event, canvas) {}
  onMouseMove(event, canvas) {}
  onMouseUp(event, canvas) {}
  onKeyDown(event, canvas) {}
  onKeyUp(event, canvas) {}
  onDblClick(event, canvas) {}

  getCursor() { return 'default'; }
}

export class DrawingTool extends PenpotTool {
  #isDrawing = false;
  #startX = 0;
  #startY = 0;
  #currentX = 0;
  #currentY = 0;
  #previewEl = null;
  #shapeType = 'rect';

  constructor(shapeType) {
    super();
    this.#shapeType = shapeType;
  }

  get shapeType() { return this.#shapeType; }

  onMouseDown(event, canvas) {
    if (event.button !== 0) return;
    const pos = this.screenToCanvas(event.clientX, event.clientY);
    this.#startX = pos.x;
    this.#startY = pos.y;
    this.#currentX = pos.x;
    this.#currentY = pos.y;
    this.#isDrawing = true;
    this.#createPreview(canvas);
  }

  onMouseMove(event, canvas) {
    if (!this.#isDrawing) return;
    const pos = this.screenToCanvas(event.clientX, event.clientY);
    this.#currentX = pos.x;
    this.#currentY = pos.y;
    this.#updatePreview();
  }

  onMouseUp(event, canvas) {
    if (!this.#isDrawing) return;
    this.#isDrawing = false;

    const x = Math.min(this.#startX, this.#currentX);
    const y = Math.min(this.#startY, this.#currentY);
    const width = Math.abs(this.#currentX - this.#startX);
    const height = Math.abs(this.#currentY - this.#startY);

    this.#removePreview();

    if (width < 2 && height < 2) return;

    const shape = createShape(this.#shapeType, {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    });

    this.workspace.emit('penpot-shape-create', { shape });
  }

  onKeyDown(event, canvas) {
    if (event.key === 'Escape' && this.#isDrawing) {
      this.#isDrawing = false;
      this.#removePreview();
    }
  }

  getCursor() { return 'crosshair'; }

  #createPreview(canvas) {
    this.#removePreview();
    const svg = canvas.querySelector('svg') || canvas.querySelector('#container svg');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    this.#previewEl = document.createElementNS(NS, this.#shapeType === 'circle' || this.#shapeType === 'ellipse' ? 'ellipse' : 'rect');
    this.#previewEl.setAttribute('fill', 'none');
    this.#previewEl.setAttribute('stroke', 'var(--penpot-primary, #31efb8)');
    this.#previewEl.setAttribute('stroke-width', '1');
    this.#previewEl.setAttribute('stroke-dasharray', '4 2');
    this.#previewEl.setAttribute('pointer-events', 'none');
    svg.appendChild(this.#previewEl);
    this.#updatePreview();
  }

  #updatePreview() {
    if (!this.#previewEl) return;
    const x = Math.min(this.#startX, this.#currentX);
    const y = Math.min(this.#startY, this.#currentY);
    const w = Math.abs(this.#currentX - this.#startX);
    const h = Math.abs(this.#currentY - this.#startY);

    if (this.#shapeType === 'circle' || this.#shapeType === 'ellipse') {
      this.#previewEl.setAttribute('cx', String(x + w / 2));
      this.#previewEl.setAttribute('cy', String(y + h / 2));
      this.#previewEl.setAttribute('rx', String(Math.max(0.5, w / 2)));
      this.#previewEl.setAttribute('ry', String(Math.max(0.5, h / 2)));
    } else {
      this.#previewEl.setAttribute('x', String(x));
      this.#previewEl.setAttribute('y', String(y));
      this.#previewEl.setAttribute('width', String(w));
      this.#previewEl.setAttribute('height', String(h));
      if (this.#shapeType === 'frame') {
        this.#previewEl.setAttribute('stroke-dasharray', '8 4');
        this.#previewEl.setAttribute('fill', 'rgba(49, 239, 184, 0.05)');
      }
    }
  }

  #removePreview() {
    if (this.#previewEl?.parentNode) {
      this.#previewEl.parentNode.removeChild(this.#previewEl);
    }
    this.#previewEl = null;
  }
}

const HANDLE_SIZE = 8;
const MIN_SHAPE_SIZE = 2;

export class SelectTool extends PenpotTool {
  #selectedIds = new Set();
  #isDragging = false;
  #isResizing = false;
  #isRotating = false;
  #resizeHandle = null;
  #dragStartX = 0;
  #dragStartY = 0;
  #resizeStart = null;
  #rotationStart = null;
  #marqueeStart = null;
  #isMarquee = false;
  #marqueeEl = null;
  #snapGuides = null;
  #dragStartPositions = null;

  constructor() {
    super();
    this.#snapGuides = new SnapGuides(null);
  }

  get selectedIds() { return this.#selectedIds; }
  get isResizing() { return this.#isResizing; }
  get isDragging() { return this.#isDragging; }

  onActivate(canvas) {
    this.#snapGuides = new SnapGuides(canvas);
  }

  onDeactivate(canvas) {
    this.#snapGuides?.clear();
  }

  onMouseDown(event, canvas) {
    if (event.button !== 0) return;
    const pos = this.screenToCanvas(event.clientX, event.clientY);

    // Check for rotation handle first
    if (this.#selectedIds.size >= 1) {
      const isRotation = this.#hitTestRotationHandle(pos.x, pos.y, canvas);
      if (isRotation) {
        this.#isRotating = true;
        const shapes = this._getShapes(canvas);
        if (this.#selectedIds.size === 1) {
          const shapeId = [...this.#selectedIds][0];
          const shape = shapes.find(s => s.id === shapeId);
          if (shape) {
            const centerX = shape.x + shape.width / 2;
            const centerY = shape.y + shape.height / 2;
            this.#rotationStart = { centerX, centerY, startAngle: Math.atan2(pos.y - centerY, pos.x - centerX), originalRotation: shape.rotation || 0, multi: false };
          }
        } else {
          const selectedShapes = shapes.filter(s => this.#selectedIds.has(s.id));
          const bounds = computeShapesBounds(selectedShapes);
          const centerX = bounds.x + bounds.width / 2;
          const centerY = bounds.y + bounds.height / 2;
          this.#rotationStart = { centerX, centerY, startAngle: Math.atan2(pos.y - centerY, pos.x - centerX), originalRotation: 0, multi: true, shapes: selectedShapes.map(s => ({ id: s.id, x: s.x, y: s.y, rotation: s.rotation || 0, centerX: s.x + (s.width || 0) / 2, centerY: s.y + (s.height || 0) / 2 })) };
        }
        return;
      }
    }

    // Check for resize handle
    if (this.#selectedIds.size >= 1) {
      const handle = this.#hitTestHandles(pos.x, pos.y, canvas);
      if (handle) {
        this.#isResizing = true;
        this.#resizeHandle = handle;
        const shapes = this._getShapes(canvas);
        if (this.#selectedIds.size === 1) {
          const shapeId = [...this.#selectedIds][0];
          const shape = shapes.find(s => s.id === shapeId);
          if (shape) {
            this.#resizeStart = { x: shape.x, y: shape.y, w: shape.width, h: shape.height, mx: pos.x, my: pos.y, multi: false };
          }
        } else {
          const selectedShapes = shapes.filter(s => this.#selectedIds.has(s.id));
          const bounds = computeShapesBounds(selectedShapes);
          this.#resizeStart = { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height, mx: pos.x, my: pos.y, multi: true, shapes: selectedShapes.map(s => ({ id: s.id, x: s.x, y: s.y, width: s.width, height: s.height })) };
        }
        return;
      }
    }

    // Check for shape hit
    const shapeId = this.#hitTest(pos.x, pos.y, canvas);

    if (event.shiftKey && shapeId) {
      // Shift+click: toggle selection
      if (this.#selectedIds.has(shapeId)) {
        this.#selectedIds.delete(shapeId);
      } else {
        this.#selectedIds.add(shapeId);
      }
      this.#updateSelection(canvas);
      return;
    }

    if (shapeId) {
      // Click on shape: select it
      if (!this.#selectedIds.has(shapeId)) {
        this.#selectedIds.clear();
        this.#selectedIds.add(shapeId);
      }
      this.#isDragging = true;
      this.#dragStartX = pos.x;
      this.#dragStartY = pos.y;
      this.#storeDragStartPositions(canvas);
      this.#updateSelection(canvas);
      return;
    }

    // Click on empty area: start marquee selection or deselect
    if (this.#selectedIds.size > 0) {
      this.#selectedIds.clear();
      this.#updateSelection(canvas);
    }
    this.#isMarquee = true;
    this.#marqueeStart = { x: pos.x, y: pos.y };
  }

  onMouseMove(event, canvas) {
    const pos = this.screenToCanvas(event.clientX, event.clientY);

    if (this.#isRotating && this.#rotationStart) {
      this.#handleRotation(pos.x, pos.y);
      return;
    }

    if (this.#isResizing && this.#resizeStart) {
      this.#handleResize(pos.x, pos.y, canvas);
      return;
    }

    if (this.#isDragging && this.#selectedIds.size > 0) {
      const dx = pos.x - this.#dragStartX;
      const dy = pos.y - this.#dragStartY;
      this.#dragStartX = pos.x;
      this.#dragStartY = pos.y;

      let adjustedDx = dx;
      let adjustedDy = dy;
      const snapResult = this.#computeSnap(canvas);
      if (snapResult) {
        adjustedDx += snapResult.adjustments.x;
        adjustedDy += snapResult.adjustments.y;
        const dragShapes = this._getShapes(canvas);
        const moveShape = this.#selectedIds.size === 1 ? dragShapes.find(s => s.id === [...this.#selectedIds][0]) : null;
        this.#snapGuides.render(snapResult.guides, moveShape);
      } else {
        this.#snapGuides.clear();
      }

      for (const shapeId of this.#selectedIds) {
        this.workspace.emit('penpot-shape-move', { shapeId, dx: adjustedDx, dy: adjustedDy });
      }
      return;
    }

    if (this.#isMarquee && this.#marqueeStart) {
      this.#updateMarquee(pos, canvas);
      return;
    }

    // Update cursor based on handle hover
    if (this.#selectedIds.size >= 1) {
      const rotHandle = this.#hitTestRotationHandle(pos.x, pos.y, canvas);
      if (rotHandle) {
        this._cursorOverride = 'grab';
        canvas.style.cursor = 'grab';
        return;
      }
      const handle = this.#hitTestHandles(pos.x, pos.y, canvas);
      if (handle) {
        this._cursorOverride = this.#handleCursor(handle);
        canvas.style.cursor = this._cursorOverride;
        return;
      }
    }
    this._cursorOverride = null;
    canvas.style.cursor = 'default';
  }

  onMouseUp(event, canvas) {
    if (this.#isRotating) {
      this.#isRotating = false;
      this.#rotationStart = null;
      return;
    }

    if (this.#isResizing) {
      this.#isResizing = false;
      this.#resizeHandle = null;
      this.#resizeStart = null;
      this.#snapGuides?.clear();
      return;
    }

    if (this.#isDragging) {
      this.#isDragging = false;
      this.#snapGuides?.clear();
      return;
    }

    if (this.#isMarquee) {
      this.#finishMarquee(canvas);
      this.#isMarquee = false;
      this.#marqueeStart = null;
      return;
    }
  }

  onKeyDown(event, canvas) {
    // No key handling needed in select tool during mouse ops
  }

  onDblClick(event, canvas) {
    const pos = this.screenToCanvas(event.clientX, event.clientY);
    const shapeId = this.#hitTest(pos.x, pos.y, canvas);
    if (!shapeId) return;
    const shapes = this._getShapes(canvas);
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) return;
    if (shape.type === 'text') {
      this.workspace.emit('penpot-edit-text', { shapeId, shape });
    }
    if (shape.type === 'path' && shape.content) {
      this.workspace.emit('penpot-edit-path', { shapeId, shape });
    }
  }

  getCursor() {
    return this._cursorOverride || 'default';
  }

  #hitTest(x, y, canvas) {
    const svg = canvas.querySelector('svg') || canvas.querySelector('#container svg');
    if (!svg) return null;
    const shapes = svg.querySelectorAll('[id^="shape-"]');
    for (let i = shapes.length - 1; i >= 0; i--) {
      const el = shapes[i];
      const bbox = el.getBBox();
      if (x >= bbox.x - 2 && x <= bbox.x + bbox.width + 2 && y >= bbox.y - 2 && y <= bbox.y + bbox.height + 2) {
        return el.id.replace('shape-', '');
      }
    }
    return null;
  }

  #hitTestRotationHandle(x, y, canvas) {
    if (this.#selectedIds.size === 0) return false;
    let shape;
    if (this.#selectedIds.size === 1) {
      const shapes = this._getShapes(canvas);
      shape = shapes.find(s => s.id === [...this.#selectedIds][0]);
    } else {
      const shapes = this._getShapes(canvas);
      const selectedShapes = shapes.filter(s => this.#selectedIds.has(s.id));
      shape = computeShapesBounds(selectedShapes);
    }
    if (!shape) return false;
    const rotationHandleOffset = 20;
    const rhx = (shape.x || 0) + (shape.width || 0) / 2;
    const rhy = (shape.y || 0) - rotationHandleOffset;
    return Math.abs(x - rhx) <= 7 && Math.abs(y - rhy) <= 7;
  }

  #hitTestHandles(x, y, canvas) {
    if (this.#selectedIds.size === 0) return null;
    let shape;
    if (this.#selectedIds.size === 1) {
      const shapes = this._getShapes(canvas);
      shape = shapes.find(s => s.id === [...this.#selectedIds][0]);
    } else {
      const shapes = this._getShapes(canvas);
      const selectedShapes = shapes.filter(s => this.#selectedIds.has(s.id));
      shape = computeShapesBounds(selectedShapes);
    }
    if (!shape) return null;

    const handles = this.#getHandles(shape);
    for (const [name, hx, hy] of handles) {
      if (Math.abs(x - hx) <= HANDLE_SIZE / 2 + 2 && Math.abs(y - hy) <= HANDLE_SIZE / 2 + 2) {
        return name;
      }
    }
    return null;
  }

  #getHandles(shape) {
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

  #handleCursor(handle) {
    const cursors = { nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize', se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize' };
    return cursors[handle] || 'default';
  }

  #handleRotation(mx, my) {
    if (!this.#rotationStart) return;
    const { centerX, centerY, startAngle, originalRotation, multi, shapes } = this.#rotationStart;
    const currentAngle = Math.atan2(my - centerY, mx - centerX);
    const deltaAngle = currentAngle - startAngle;

    if (multi && shapes) {
      const cos = Math.cos(deltaAngle);
      const sin = Math.sin(deltaAngle);
      for (const orig of shapes) {
        const dx = orig.centerX - centerX;
        const dy = orig.centerY - centerY;
        const newCenterX = centerX + dx * cos - dy * sin;
        const newCenterY = centerY + dx * sin + dy * cos;
        const posX = newCenterX - (orig.width || 0) / 2;
        const posY = newCenterY - (orig.height || 0) / 2;
        this.workspace.emit('penpot-shape-move', { shapeId: orig.id, dx: posX - orig.x, dy: posY - orig.y });
        this.workspace.emit('penpot-shape-rotate', { shapeId: orig.id, rotation: (orig.rotation || 0) + deltaAngle });
      }
      return;
    }

    if (this.#selectedIds.size !== 1) return;
    const shapeId = [...this.#selectedIds][0];
    const newRotation = originalRotation + deltaAngle;
    this.workspace.emit('penpot-shape-rotate', { shapeId, rotation: newRotation });
  }

  #handleResize(mx, my, canvas) {
    const s = this.#resizeStart;
    if (!s) return;
    const dx = mx - s.mx;
    const dy = my - s.my;
    const handle = this.#resizeHandle;

    let newX = s.x, newY = s.y, newW = s.w, newH = s.h;

    switch (handle) {
      case 'nw': newX = s.x + dx; newY = s.y + dy; newW = s.w - dx; newH = s.h - dy; break;
      case 'n':  newY = s.y + dy; newH = s.h - dy; break;
      case 'ne': newY = s.y + dy; newW = s.w + dx; newH = s.h - dy; break;
      case 'e':  newW = s.w + dx; break;
      case 'se': newW = s.w + dx; newH = s.h + dy; break;
      case 's':  newH = s.h + dy; break;
      case 'sw': newX = s.x + dx; newW = s.w - dx; newH = s.h + dy; break;
      case 'w':  newX = s.x + dx; newW = s.w - dx; break;
    }

    if (newW < MIN_SHAPE_SIZE) { newW = MIN_SHAPE_SIZE; if (handle.includes('w') || handle === 'nw' || handle === 'sw') newX = s.x + s.w - MIN_SHAPE_SIZE; }
    if (newH < MIN_SHAPE_SIZE) { newH = MIN_SHAPE_SIZE; if (handle.includes('n') || handle === 'nw' || handle === 'ne') newY = s.y + s.h - MIN_SHAPE_SIZE; }

    if (s.multi && s.shapes) {
      const scaleX = s.w > 0 ? newW / s.w : 1;
      const scaleY = s.h > 0 ? newH / s.h : 1;
      for (const orig of s.shapes) {
        const resizedX = newX + (orig.x - s.x) * scaleX;
        const resizedY = newY + (orig.y - s.y) * scaleY;
        const resizedW = (orig.width || 0) * scaleX;
        const resizedH = (orig.height || 0) * scaleY;
        this.workspace.emit('penpot-shape-resize', {
          shapeId: orig.id,
          x: Math.round(resizedX),
          y: Math.round(resizedY),
          width: Math.round(resizedW),
          height: Math.round(resizedH),
        });
      }
      return;
    }

    const shapeId = [...this.#selectedIds][0];
    const shapes = this._getShapes(canvas);
    const shape = shapes?.find(s => s.id === shapeId);
    if (!shape) return;

    const resizedShape = { ...shape, x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) };
    const snapResult = this.#computeSnapForShape(resizedShape, canvas);
    if (snapResult) {
      if (snapResult.adjustments.x !== 0) {
        if (handle.includes('w') || handle === 'nw' || handle === 'sw') {
          newX += snapResult.adjustments.x;
          newW -= snapResult.adjustments.x;
        } else {
          newW += snapResult.adjustments.x;
        }
      }
      if (snapResult.adjustments.y !== 0) {
        if (handle.includes('n') || handle === 'nw' || handle === 'ne') {
          newY += snapResult.adjustments.y;
          newH -= snapResult.adjustments.y;
        } else {
          newH += snapResult.adjustments.y;
        }
      }
      this.#snapGuides.render(snapResult.guides, shapes.find(s => s.id === shapeId));
    } else {
      this.#snapGuides.clear();
    }

    this.workspace.emit('penpot-shape-resize', {
      shapeId,
      x: Math.round(newX),
      y: Math.round(newY),
      width: Math.round(newW),
      height: Math.round(newH),
    });
  }

  #updateMarquee(pos, canvas) {
    if (!this.#marqueeStart) return;
    this.#removeMarqueeEl(canvas);

    const sx = Math.min(this.#marqueeStart.x, pos.x);
    const sy = Math.min(this.#marqueeStart.y, pos.y);
    const sw = Math.abs(pos.x - this.#marqueeStart.x);
    const sh = Math.abs(pos.y - this.#marqueeStart.y);

    const svg = canvas.querySelector('svg') || canvas.querySelector('#container svg');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';

    this.#marqueeEl = document.createElementNS(NS, 'rect');
    this.#marqueeEl.setAttribute('x', String(sx));
    this.#marqueeEl.setAttribute('y', String(sy));
    this.#marqueeEl.setAttribute('width', String(sw));
    this.#marqueeEl.setAttribute('height', String(sh));
    this.#marqueeEl.setAttribute('fill', 'rgba(49, 239, 184, 0.1)');
    this.#marqueeEl.setAttribute('stroke', 'var(--penpot-primary, #31efb8)');
    this.#marqueeEl.setAttribute('stroke-width', '1');
    this.#marqueeEl.setAttribute('stroke-dasharray', '4 2');
    this.#marqueeEl.setAttribute('pointer-events', 'none');
    svg.appendChild(this.#marqueeEl);
  }

  #finishMarquee(canvas) {
    this.#removeMarqueeEl(canvas);

    if (!this.#marqueeStart) return;

    // Use last pointer position from the marquee element if available
    const svg = canvas.querySelector('svg') || canvas.querySelector('#container svg');
    if (!svg) return;

    const rect = this.#marqueeEl
      ? { x: parseFloat(this.#marqueeEl.getAttribute('x') || '0'),
          y: parseFloat(this.#marqueeEl.getAttribute('y') || '0'),
          width: parseFloat(this.#marqueeEl.getAttribute('width') || '0'),
          height: parseFloat(this.#marqueeEl.getAttribute('height') || '0') }
      : null;

    if (!rect || rect.width < 2 && rect.height < 2) return;

    const shapes = svg.querySelectorAll('[id^="shape-"]');
    this.#selectedIds.clear();

    for (const el of shapes) {
      const bbox = el.getBBox();
      // Check if shape bbox intersects with marquee rect
      if (bbox.x >= rect.x && bbox.y >= rect.y &&
          bbox.x + bbox.width <= rect.x + rect.width &&
          bbox.y + bbox.height <= rect.y + rect.height) {
        this.#selectedIds.add(el.id.replace('shape-', ''));
      }
    }

    this.#updateSelection(canvas);
  }

  #removeMarqueeEl(canvas) {
    if (this.#marqueeEl?.parentNode) {
      this.#marqueeEl.parentNode.removeChild(this.#marqueeEl);
    }
    this.#marqueeEl = null;
  }

  #updateSelection(canvas) {
    const ids = [...this.#selectedIds];
    const shapeId = ids.length === 1 ? ids[0] : null;
    this.workspace.emit('penpot-shape-select', { shapeId, selectedIds: ids });
  }

  #storeDragStartPositions(canvas) {
    this.#dragStartPositions = new Map();
    const shapes = this._getShapes(canvas);
    for (const id of this.#selectedIds) {
      const s = shapes.find(sh => sh.id === id);
      if (s) this.#dragStartPositions.set(id, { x: s.x, y: s.y, width: s.width, height: s.height });
    }
  }

  #computeSnap(canvas) {
    if (this.#selectedIds.size !== 1) return null;
    const shapeId = [...this.#selectedIds][0];
    const shapes = this._getShapes(canvas);
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) return null;
    return this.#computeSnapForShape(shape, canvas);
  }

  #computeSnapForShape(shape, canvas) {
    const shapes = this._getShapes(canvas);
    const canvasEl = canvas.querySelector('#container') || canvas;
    const viewport = canvasEl ? { x: 0, y: 0, width: canvasEl.clientWidth / (canvas.zoom || 1), height: canvasEl.clientHeight / (canvas.zoom || 1) } : null;
    return this.#snapGuides.snap(shape, shapes, viewport);
  }

  _getShapes(canvas) {
    const page = this.workspace?.currentPage;
    if (!page) return [];
    const objects = page.objects || page.children || {};
    return Array.isArray(objects) ? objects : Object.values(objects);
  }
}

export class HandTool extends PenpotTool {
  #isPanning = false;
  #lastX = 0;
  #lastY = 0;

  onActivate() {
    this.#isPanning = false;
  }

  onDeactivate() {
    this.#isPanning = false;
  }

  onMouseDown(event) {
    if (event.button !== 0) return;
    this.#isPanning = true;
    this.#lastX = event.clientX;
    this.#lastY = event.clientY;
  }

  onMouseMove(event) {
    if (!this.#isPanning) return;
    const dx = event.clientX - this.#lastX;
    const dy = event.clientY - this.#lastY;
    this.#lastX = event.clientX;
    this.#lastY = event.clientY;
    if (this.canvas && typeof this.canvas.panBy === 'function') {
      this.canvas.panBy(dx / this.canvas.zoom, dy / this.canvas.zoom);
    }
  }

  onMouseUp() {
    this.#isPanning = false;
  }

  getCursor() { return this.#isPanning ? 'grabbing' : 'grab'; }
}

export class TextTool extends PenpotTool {
  #input = null;

  onActivate(canvas) {
    this.#removeInput();
  }

  onDeactivate(canvas) {
    this.#removeInput();
  }

  onMouseDown(event, canvas) {
    this.#removeInput();
    const pos = this.screenToCanvas(event.clientX, event.clientY);
    this.#createInput(pos.x, pos.y, canvas);
  }

  onKeyDown(event, canvas) {
    if (event.key === 'Escape') this.#removeInput();
  }

  getCursor() { return 'text'; }

  #createInput(x, y, canvas) {
    const container = canvas.querySelector('#container');
    if (!container) return;

    const canvasRect = canvas.getBoundingClientRect();
    const screenX = (x + (canvas.panX || 0)) * canvas.zoom + canvasRect.left;
    const screenY = (y + (canvas.panY || 0)) * canvas.zoom + canvasRect.top;

    this.#input = document.createElement('input');
    this.#input.type = 'text';
    this.#input.style.cssText = `position:absolute;left:${screenX}px;top:${screenY - 8}px;background:var(--penpot-input-bg,#333);border:1px solid var(--penpot-primary,#31efb8);color:var(--penpot-text,#e6e6e6);font-size:14px;font-family:var(--penpot-font-family,sans-serif);padding:2px 4px;outline:none;z-index:10;min-width:60px;`;
    this.#input.placeholder = 'Type text...';

    this.#input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.#commitText(x, y);
      }
      if (e.key === 'Escape') {
        this.#removeInput();
      }
    });

    this.#input.addEventListener('blur', () => {
      this.#commitText(x, y);
    });

    document.body.appendChild(this.#input);
    this.#input.focus();
  }

  #commitText(x, y) {
    const text = this.#input?.value?.trim();
    this.#removeInput();
    if (!text) return;

    const shape = createShape('text', {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.max(20, text.length * 8),
      height: 20,
      content: text,
      fontSize: 14,
    });

    this.workspace.emit('penpot-shape-create', { shape });
  }

  #removeInput() {
    if (this.#input?.parentNode) {
      this.#input.parentNode.removeChild(this.#input);
    }
    this.#input = null;
  }
}

export class PathTool extends PenpotTool {
  #points = [];
  #pathEl = null;
  #isDrawing = false;
  #hoverX = 0;
  #hoverY = 0;

  constructor() {
    super();
  }

  onActivate(canvas) {
    this.#points = [];
    this.#isDrawing = false;
    this.#removePath(canvas);
  }

  onDeactivate(canvas) {
    this.#finishPath(canvas);
    this.#removePath(canvas);
  }

  onMouseDown(event, canvas) {
    if (event.button !== 0) return;
    const pos = this.screenToCanvas(event.clientX, event.clientY);

    if (this.#isDrawing && this.#points.length > 0) {
      const lastPt = this.#points[this.#points.length - 1];
      if (Math.abs(pos.x - lastPt.x) < 3 && Math.abs(pos.y - lastPt.y) < 3) {
        this.#finishPath(canvas);
        return;
      }
    }

    this.#points.push({ x: pos.x, y: pos.y });
    this.#isDrawing = true;
    this.#updatePath(canvas);
  }

  onMouseMove(event, canvas) {
    if (!this.#isDrawing) return;
    const pos = this.screenToCanvas(event.clientX, event.clientY);
    this.#hoverX = pos.x;
    this.#hoverY = pos.y;
    this.#updatePath(canvas);
  }

  onMouseUp(event, canvas) {
    // Path tool uses click-to-add, not drag
  }

  onKeyDown(event, canvas) {
    if (event.key === 'Escape') {
      this.#finishPath(canvas);
    }
    if (event.key === 'Enter' && this.#points.length >= 2) {
      this.#finishPath(canvas);
    }
  }

  getCursor() { return 'crosshair'; }

  #updatePath(canvas) {
    this.#removePathEl(canvas);
    if (this.#points.length < 1) return;

    const svg = canvas.querySelector('svg') || canvas.querySelector('#container svg');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';

    this.#pathEl = document.createElementNS(NS, 'path');
    const pts = [...this.#points, { x: this.#hoverX, y: this.#hoverY }];

    if (pts.length === 1) {
      this.#pathEl.setAttribute('d', `M ${pts[0].x} ${pts[0].y} L ${this.#hoverX} ${this.#hoverY}`);
    } else {
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i].x} ${pts[i].y}`;
      }
      this.#pathEl.setAttribute('d', d);
    }

    this.#pathEl.setAttribute('fill', 'none');
    this.#pathEl.setAttribute('stroke', 'var(--penpot-primary, #31efb8)');
    this.#pathEl.setAttribute('stroke-width', '2');
    this.#pathEl.setAttribute('pointer-events', 'none');

    svg.appendChild(this.#pathEl);

    // Draw point markers
    for (const pt of this.#points) {
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', String(pt.x));
      circle.setAttribute('cy', String(pt.y));
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', 'var(--penpot-primary, #31efb8)');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '1');
      circle.setAttribute('pointer-events', 'none');
      svg.appendChild(circle);
    }
  }

  #finishPath(canvas) {
    this.#removePathEl(canvas);
    if (this.#points.length < 2) {
      this.#points = [];
      this.#isDrawing = false;
      return;
    }

    const pathData = this.#points.map((pt, i) =>
      `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`
    ).join(' ');

    const bounds = this.#getBounds(this.#points);
    const shape = createShape('path', {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      d: pathData,
    });

    this.workspace.emit('penpot-shape-create', { shape });
    this.#points = [];
    this.#isDrawing = false;
  }

  #getBounds(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }

  #removePathEl(canvas) {
    if (this.#pathEl?.parentNode) {
      this.#pathEl.parentNode.removeChild(this.#pathEl);
    }
    this.#pathEl = null;

    // Remove point markers
    const svg = canvas.querySelector('svg') || canvas.querySelector('#container svg');
    if (!svg) return;
    const markers = svg.querySelectorAll('circle[pointer-events="none"]');
    for (const m of markers) {
      if (m.getAttribute('fill') === 'var(--penpot-primary, #31efb8)') {
        m.parentNode.removeChild(m);
      }
    }
  }

  #removePath(canvas) {
    this.#points = [];
    this.#isDrawing = false;
    this.#removePathEl(canvas);
  }
}

export class ImageTool extends PenpotTool {
  #input = null;

  onActivate() {}
  onDeactivate() { this.#cleanup(); }

  onMouseDown(event, canvas) {
    this.#openFileDialog(canvas);
  }

  getCursor() { return 'crosshair'; }

  #openFileDialog(canvas) {
    this.#cleanup();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.svg';
    input.style.display = 'none';

    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const pos = this.screenToCanvas(
        canvas.getBoundingClientRect().left + canvas.clientWidth / 2,
        canvas.getBoundingClientRect().top + canvas.clientHeight / 2
      );

      if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        const text = await file.text();
        try {
          const svgShapes = parseSVG(text);
          if (svgShapes.length === 0) return;
          const minX = Math.min(...svgShapes.map(s => s.x));
          const minY = Math.min(...svgShapes.map(s => s.y));
          for (const rawShape of svgShapes) {
            const shape = createShape(rawShape.type, {
              ...rawShape,
              x: Math.round(rawShape.x - minX + pos.x),
              y: Math.round(rawShape.y - minY + pos.y),
            });
            if (shape.width > 0 && shape.height > 0) {
              this.workspace.emit('penpot-shape-create', { shape });
            }
          }
        } catch (err) {
          console.error('[ImageTool] SVG parse error:', err);
        }
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const maxDim = 300;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          const scale = Math.min(maxDim / w, maxDim / h);
          w *= scale;
          h *= scale;
        }
        const dataUrl = imageToDataURL(img, w, h);
        const shape = createShape('image', { x: Math.round(pos.x - w / 2), y: Math.round(pos.y - h / 2), width: Math.round(w), height: Math.round(h), href: dataUrl });
        this.workspace.emit('penpot-shape-create', { shape });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => { URL.revokeObjectURL(url); };
      img.src = url;
      document.body.removeChild(input);
    });

    input.addEventListener('cancel', () => { document.body.removeChild(input); });
    document.body.appendChild(input);
    input.click();
  }

  #cleanup() {
    // No-op, file input is removed after use
  }
}