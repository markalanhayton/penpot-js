import { PenpotTool, DrawingTool, SelectTool, HandTool, TextTool, PathTool, ImageTool } from '../components/tools/base.js';
import { EllipseTool } from '../components/tools/ellipse-tool.js';
import { History } from './history.js';
import { createBoolShape } from './types.js';

export class ToolManager {
  #tools = new Map();
  #activeTool = null;
  #activeToolName = null;
  #canvas = null;
  #workspace = null;
  #history = new History(100);
  #pages = [];
  #currentPageIndex = 0;
  #selectedIds = new Set();
  #clipboard = [];
  #canvasContainer = null;
  #boundPointerDown = null;
  #boundPointerMove = null;
  #boundPointerUp = null;
  #boundDblClick = null;
  #keydownHandler = null;
  #keyupHandler = null;

  constructor(canvas, workspace) {
    this.#canvas = canvas;
    this.#workspace = workspace;
    this.#registerBuiltinTools();
    this.#bindCanvasEvents();
    this.#bindKeyboard();
  }

  #registerBuiltinTools() {
    this.registerTool('select', new SelectTool());
    this.registerTool('hand', new HandTool());
    this.registerTool('frame', new DrawingTool('frame'));
    this.registerTool('rect', new DrawingTool('rect'));
    this.registerTool('circle', new EllipseTool());
    this.registerTool('ellipse', new EllipseTool());
    this.registerTool('text', new TextTool());
    this.registerTool('path', new PathTool());
    this.registerTool('image', new ImageTool());
  }

  registerTool(name, tool) {
    this.#tools.set(name, tool);
  }

  getTool(name) {
    return this.#tools.get(name);
  }

  switchTool(name) {
    if (this.#activeToolName === name) return;
    if (this.#activeTool) {
      this.#activeTool.deactivate(this.#canvas);
    }
    const tool = this.#tools.get(name);
    if (!tool) {
      console.warn(`[tool-manager] Unknown tool: ${name}`);
      return;
    }
    this.#activeTool = tool;
    this.#activeToolName = name;
    this.#activeTool.activate(this.#canvas, this.#workspace);
    this.#canvas.style.cursor = tool.getCursor();
  }

  get activeToolName() { return this.#activeToolName; }
  get activeTool() { return this.#activeTool; }
  get selectedIds() { return this.#selectedIds; }
  get history() { return this.#history; }

  setPages(pages) { this.#pages = pages; }
  setPageIndex(index) { this.#currentPageIndex = index; }

  getCurrentPage() {
    return this.#pages[this.#currentPageIndex] || null;
  }

  getCurrentShapes() {
    const page = this.getCurrentPage();
    if (!page) return [];
    const objects = page.objects || page.children || {};
    return Array.isArray(objects) ? objects : Object.values(objects);
  }

  addShape(shape) {
    const page = this.getCurrentPage();
    if (!page) return;
    const objects = page.objects || page.children || {};
    if (Array.isArray(page.objects || page.children)) {
      const list = page.objects || page.children;
      list.push(shape);
    } else {
      objects[shape.id] = shape;
      if (!page.objects) page.children = objects;
      else page.objects = objects;
    }
    this.#history.push({ type: 'create', shapeId: shape.id, shape, pageId: page.id });
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  removeShape(shapeId) {
    const page = this.getCurrentPage();
    if (!page) return;
    const objects = page.objects || page.children || {};
    if (Array.isArray(page.objects || page.children)) {
      const list = page.objects || page.children;
      const idx = list.findIndex(s => s.id === shapeId);
      if (idx >= 0) {
        const [removed] = list.splice(idx, 1);
        this.#history.push({ type: 'delete', shapeId, shape: removed, pageId: page.id, index: idx });
        this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
      }
    } else {
      const shape = objects[shapeId];
      if (shape) {
        delete objects[shapeId];
        this.#history.push({ type: 'delete', shapeId, shape, pageId: page.id });
        this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
      }
    }
    this.#selectedIds.delete(shapeId);
    this.#workspace.emit('penpot-shape-select', { shapeId: null, selectedIds: [...this.#selectedIds] });
  }

  deleteSelected() {
    for (const id of [...this.#selectedIds]) {
      this.removeShape(id);
    }
  }

  duplicateSelected() {
    const page = this.getCurrentPage();
    if (!page) return;
    const newIds = [];
    for (const id of this.#selectedIds) {
      const shape = this.#findShape(page, id);
      if (!shape) continue;
      const newShape = { ...shape, id: crypto.randomUUID(), x: shape.x + 10, y: shape.y + 10, name: (shape.name || 'Shape') + ' copy' };
      this.addShape(newShape);
      newIds.push(newShape.id);
    }
    this.#selectedIds.clear();
    for (const id of newIds) this.#selectedIds.add(id);
    this.#workspace.emit('penpot-shape-select', { shapeId: newIds.length === 1 ? newIds[0] : null, selectedIds: [...this.#selectedIds] });
  }

  groupSelected() {
    if (this.#selectedIds.size < 2) return;
    const page = this.getCurrentPage();
    if (!page) return;
    const groupId = crypto.randomUUID();
    const children = [];
    for (const id of this.#selectedIds) {
      const shape = this.#findShape(page, id);
      if (shape) children.push(shape);
    }
    if (children.length < 2) return;

    const bounds = children.reduce((acc, s) => ({
      minX: Math.min(acc.minX, s.x),
      minY: Math.min(acc.minY, s.y),
      maxX: Math.max(acc.maxX, s.x + s.width),
      maxY: Math.max(acc.maxY, s.y + s.height),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    const group = createShape('group', {
      id: groupId,
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
      children: children.map(c => c.id),
    });

    this.addShape(group);
    this.#selectedIds.clear();
    this.#selectedIds.add(groupId);
    this.#workspace.emit('penpot-shape-select', { shapeId: groupId, selectedIds: [groupId] });
  }

  ungroupSelected() {
    if (this.#selectedIds.size !== 1) return;
    const page = this.getCurrentPage();
    if (!page) return;
    const shapeId = [...this.#selectedIds][0];
    const shape = this.#findShape(page, shapeId);
    if (!shape || shape.type !== 'group') return;

    const childIds = shape.children || [];
    this.removeShape(shapeId);

    this.#selectedIds.clear();
    for (const cid of childIds) {
      this.#selectedIds.add(cid);
    }
    this.#workspace.emit('penpot-shape-select', { shapeId: null, selectedIds: [...this.#selectedIds] });
  }

  copySelected() {
    const page = this.getCurrentPage();
    if (!page) return;
    this.#clipboard = [];
    for (const id of this.#selectedIds) {
      const shape = this.#findShape(page, id);
      if (shape) this.#clipboard.push({ ...shape });
    }
  }

  pasteClipboard() {
    if (this.#clipboard.length === 0) return;
    const newIds = [];
    for (const shape of this.#clipboard) {
      const newShape = { ...shape, id: crypto.randomUUID(), x: shape.x + 20, y: shape.y + 20 };
      this.addShape(newShape);
      newIds.push(newShape.id);
    }
    this.#selectedIds.clear();
    for (const id of newIds) this.#selectedIds.add(id);
    this.#workspace.emit('penpot-shape-select', { shapeId: newIds.length === 1 ? newIds[0] : null, selectedIds: [...this.#selectedIds] });
  }

  moveShape(shapeId, dx, dy) {
    const page = this.getCurrentPage();
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;
    const oldX = shape.x;
    const oldY = shape.y;
    shape.x = oldX + dx;
    shape.y = oldY + dy;
    this.#history.push({ type: 'move', shapeId, oldX, oldY, newX: shape.x, newY: shape.y, pageId: page.id });
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  moveSelectedShapes(dx, dy) {
    for (const id of this.#selectedIds) {
      this.moveShape(id, dx, dy);
    }
  }

  resizeShape(shapeId, x, y, width, height) {
    const page = this.getCurrentPage();
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;
    const oldProps = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    shape.x = x;
    shape.y = y;
    shape.width = width;
    shape.height = height;
    this.#history.push({ type: 'resize', shapeId, oldProps, newProps: { x, y, width, height }, pageId: page.id });
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
    this.#workspace.emit('penpot-shape-select', { shapeId, selectedIds: [shapeId] });
  }

  rotateShape(shapeId, radians) {
    this.updateShapeProp(shapeId, 'rotation', radians * 180 / Math.PI);
  }

  updateShapeProp(shapeId, prop, value) {
    const page = this.getCurrentPage();
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;
    let numericValue = value;
    let shapeProp = prop;
    let changed = false;

    if (prop === 'w') {
      shapeProp = 'width';
      numericValue = Number(value);
      if (!isNaN(numericValue) && shape.width !== numericValue) {
        this.#history.push({ type: 'update', shapeId, prop: 'width', oldValue: shape.width, newValue: numericValue, pageId: page.id });
        shape.width = numericValue;
        changed = true;
      }
    } else if (prop === 'h') {
      shapeProp = 'height';
      numericValue = Number(value);
      if (!isNaN(numericValue) && shape.height !== numericValue) {
        this.#history.push({ type: 'update', shapeId, prop: 'height', oldValue: shape.height, newValue: numericValue, pageId: page.id });
        shape.height = numericValue;
        changed = true;
      }
    } else if (prop === 'x') {
      numericValue = Number(value);
      if (!isNaN(numericValue) && shape.x !== numericValue) {
        this.#history.push({ type: 'update', shapeId, prop: 'x', oldValue: shape.x, newValue: numericValue, pageId: page.id });
        shape.x = numericValue;
        changed = true;
      }
    } else if (prop === 'y') {
      numericValue = Number(value);
      if (!isNaN(numericValue) && shape.y !== numericValue) {
        this.#history.push({ type: 'update', shapeId, prop: 'y', oldValue: shape.y, newValue: numericValue, pageId: page.id });
        shape.y = numericValue;
        changed = true;
      }
    } else if (prop === 'rotation') {
      numericValue = Number(value) * Math.PI / 180;
      if (!isNaN(numericValue) && shape.rotation !== numericValue) {
        this.#history.push({ type: 'update', shapeId, prop: 'rotation', oldValue: shape.rotation, newValue: numericValue, pageId: page.id });
        shape.rotation = numericValue;
        changed = true;
      }
    } else if (prop === 'opacity') {
      numericValue = Number(value);
      if (!isNaN(numericValue) && shape.opacity !== numericValue) {
        this.#history.push({ type: 'update', shapeId, prop: 'opacity', oldValue: shape.opacity, newValue: numericValue, pageId: page.id });
        shape.opacity = numericValue;
        changed = true;
      }
    } else {
      shape[shapeProp] = value;
      changed = true;
    }

    if (changed) {
      this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
      this.#workspace.emit('penpot-shape-select', { shapeId, selectedIds: [...this.#selectedIds] });
    }
  }

  selectShape(shapeId) {
    this.#selectedIds.clear();
    if (shapeId) this.#selectedIds.add(shapeId);
    this.#workspace.emit('penpot-shape-select', { shapeId, selectedIds: [...this.#selectedIds] });
  }

  addToSelection(shapeId) {
    this.#selectedIds.add(shapeId);
    this.#workspace.emit('penpot-shape-select', { shapeId: [...this.#selectedIds][0], selectedIds: [...this.#selectedIds] });
  }

  removeFromSelection(shapeId) {
    this.#selectedIds.delete(shapeId);
    this.#workspace.emit('penpot-shape-select', { shapeId: [...this.#selectedIds][0] || null, selectedIds: [...this.#selectedIds] });
  }

  selectAll() {
    this.#selectedIds.clear();
    const shapes = this.getCurrentShapes();
    for (const s of shapes) {
      this.#selectedIds.add(s.id);
    }
    this.#workspace.emit('penpot-shape-select', { shapeId: null, selectedIds: [...this.#selectedIds] });
  }

  clearSelection() {
    this.#selectedIds.clear();
    this.#workspace.emit('penpot-shape-select', { shapeId: null, selectedIds: [] });
  }

  createBoolOp(boolType) {
    if (this.#selectedIds.size < 2) return;
    const page = this.getCurrentPage();
    if (!page) return;

    const shapes = [];
    for (const id of this.#selectedIds) {
      const shape = this.#findShape(page, id);
      if (shape) shapes.push(shape);
    }
    if (shapes.length < 2) return;

    const headIndex = boolType === 'difference' ? 0 : shapes.length - 1;
    const boolShape = createBoolShape(boolType, shapes, headIndex);

    for (const shape of shapes) {
      this.removeShape(shape.id);
    }
    this.addShape(boolShape);
    this.#selectedIds.clear();
    this.#selectedIds.add(boolShape.id);
    this.#workspace.emit('penpot-shape-select', { shapeId: boolShape.id, selectedIds: [boolShape.id] });
  }

  changeBoolType(shapeId, boolType) {
    const page = this.getCurrentPage();
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape || shape.type !== 'bool') return;
    const oldType = shape.boolType;
    shape.boolType = boolType;
    shape.name = `Boolean ${boolType}`;
    this.#history.push({
      type: 'update', shapeId, prop: 'boolType',
      oldValue: oldType, newValue: boolType, pageId: page.id,
    });
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  boolToGroup(shapeId) {
    const page = this.getCurrentPage();
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape || shape.type !== 'bool') return;
    shape.type = 'group';
    delete shape.boolType;
    shape.name = 'Group';
    this.#history.push({
      type: 'update', shapeId, prop: 'type',
      oldValue: 'bool', newValue: 'group', pageId: page.id,
    });
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  bringForward(shapeId) {
    const page = this.getCurrentPage();
    if (!page) return;
    const list = this.#getShapeList(page);
    if (!list) return;
    const idx = list.findIndex(s => s.id === shapeId);
    if (idx < 0 || idx >= list.length - 1) return;
    const [moved] = list.splice(idx, 1);
    list.splice(idx + 1, 0, moved);
    this.#history.push({ type: 'reorder', shapeId, fromIndex: idx, toIndex: idx + 1, pageId: page.id });
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  sendBackward(shapeId) {
    const page = this.getCurrentPage();
    if (!page) return;
    const list = this.#getShapeList(page);
    if (!list) return;
    const idx = list.findIndex(s => s.id === shapeId);
    if (idx <= 0) return;
    const [moved] = list.splice(idx, 1);
    list.splice(idx - 1, 0, moved);
    this.#history.push({ type: 'reorder', shapeId, fromIndex: idx, toIndex: idx - 1, pageId: page.id });
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  bringToFront(shapeId) {
    const page = this.getCurrentPage();
    if (!page) return;
    const list = this.#getShapeList(page);
    if (!list) return;
    const idx = list.findIndex(s => s.id === shapeId);
    if (idx < 0 || idx >= list.length - 1) return;
    const [moved] = list.splice(idx, 1);
    list.push(moved);
    this.#history.push({ type: 'reorder', shapeId, fromIndex: idx, toIndex: list.length - 1, pageId: page.id });
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  sendToBack(shapeId) {
    const page = this.getCurrentPage();
    if (!page) return;
    const list = this.#getShapeList(page);
    if (!list) return;
    const idx = list.findIndex(s => s.id === shapeId);
    if (idx <= 0) return;
    const [moved] = list.splice(idx, 1);
    list.unshift(moved);
    this.#history.push({ type: 'reorder', shapeId, fromIndex: idx, toIndex: 0, pageId: page.id });
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  #getShapeList(page) {
    const objects = page.objects || page.children;
    if (Array.isArray(objects)) return objects;
    return null;
  }

  #findShape(page, shapeId) {
    const objects = page.objects || page.children || {};
    if (Array.isArray(objects)) {
      return objects.find(s => s.id === shapeId);
    }
    return objects[shapeId];
  }

  #bindCanvasEvents() {
    this.#canvasContainer = this.#canvas.querySelector('.penpot-canvas__container') || this.#canvas;
    this.#boundPointerDown = (e) => this.#handlePointerDown(e);
    this.#boundPointerMove = (e) => this.#handlePointerMove(e);
    this.#boundPointerUp = (e) => this.#handlePointerUp(e);
    this.#boundDblClick = (e) => this.#handleDblClick(e);
    this.#canvasContainer.addEventListener('pointerdown', this.#boundPointerDown);
    this.#canvasContainer.addEventListener('pointermove', this.#boundPointerMove);
    this.#canvasContainer.addEventListener('pointerup', this.#boundPointerUp);
    this.#canvasContainer.addEventListener('dblclick', this.#boundDblClick);
  }

  #bindKeyboard() {
    this.#keydownHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;

      if (this.#activeTool) this.#activeTool.onKeyDown(e, this.#canvas);

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.#selectedIds.size > 0) {
          e.preventDefault();
          this.deleteSelected();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z') || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        this.redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        this.duplicateSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        this.copySelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        this.pasteClipboard();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        this.selectAll();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        this.groupSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && e.shiftKey) {
        e.preventDefault();
        this.ungroupSelected();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.#workspace.emit('penpot-save', {});
      }

      if (e.altKey && e.key === 'u') {
        e.preventDefault();
        this.createBoolOp('union');
      }
      if (e.altKey && e.key === 'd') {
        e.preventDefault();
        this.createBoolOp('difference');
      }
      if (e.altKey && e.key === 'i') {
        e.preventDefault();
        this.createBoolOp('intersection');
      }
      if (e.altKey && e.key === 'e') {
        e.preventDefault();
        this.createBoolOp('exclude');
      }

      if (e.key === ']' && !e.shiftKey && !e.ctrlKey && !e.metaKey && this.#selectedIds.size === 1) {
        this.bringForward([...this.#selectedIds][0]);
      }
      if (e.key === '[' && !e.shiftKey && !e.ctrlKey && !e.metaKey && this.#selectedIds.size === 1) {
        this.sendBackward([...this.#selectedIds][0]);
      }
      if (e.key === ']' && e.shiftKey && this.#selectedIds.size === 1) {
        this.bringToFront([...this.#selectedIds][0]);
      }
      if (e.key === '[' && e.shiftKey && this.#selectedIds.size === 1) {
        this.sendToBack([...this.#selectedIds][0]);
      }

      const nudge = e.shiftKey ? 10 : 1;
      const arrowKeys = { ArrowUp: [0, -nudge], ArrowDown: [0, nudge], ArrowLeft: [-nudge, 0], ArrowRight: [nudge, 0] };
      if (arrowKeys[e.key] && this.#selectedIds.size > 0) {
        e.preventDefault();
        const [dx, dy] = arrowKeys[e.key];
        this.moveSelectedShapes(dx, dy);
      }
    };

    this.#keyupHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      if (this.#activeTool) this.#activeTool.onKeyUp(e, this.#canvas);
    };

    document.addEventListener('keydown', this.#keydownHandler);
    document.addEventListener('keyup', this.#keyupHandler);
  }

  #handlePointerDown(e) {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) return;
    if (this.#activeTool) this.#activeTool.onMouseDown(e, this.#canvas);
  }

  #handlePointerMove(e) {
    if (this.#activeTool) this.#activeTool.onMouseMove(e, this.#canvas);
    this.#updateCursor();
  }

  #handlePointerUp(e) {
    if (this.#activeTool) this.#activeTool.onMouseUp(e, this.#canvas);
  }

  #handleDblClick(e) {
    if (this.#activeTool && typeof this.#activeTool.onDblClick === 'function') {
      this.#activeTool.onDblClick(e, this.#canvas);
    }
  }

  #updateCursor() {
    if (this.#activeTool && this.#canvas) {
      this.#canvas.style.cursor = this.#activeTool.getCursor();
    }
  }

  undo() {
    const entry = this.#history.undo();
    if (!entry) return;
    this.#applyUndo(entry);
    const page = this.getCurrentPage();
    if (page) this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  redo() {
    const entry = this.#history.redo();
    if (!entry) return;
    this.#applyRedo(entry);
    const page = this.getCurrentPage();
    if (page) this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  #applyUndo(entry) {
    const page = this.#pages.find(p => p.id === entry.pageId);
    if (!page) return;
    const objects = page.objects || page.children || {};
    if (entry.type === 'create') {
      if (Array.isArray(page.objects || page.children)) {
        const list = page.objects || page.children;
        const idx = list.findIndex(s => s.id === entry.shapeId);
        if (idx >= 0) list.splice(idx, 1);
      } else {
        delete objects[entry.shapeId];
      }
    } else if (entry.type === 'delete') {
      if (Array.isArray(page.objects || page.children)) {
        const list = page.objects || page.children;
        list.splice(entry.index ?? list.length, 0, entry.shape);
      } else {
        objects[entry.shapeId] = entry.shape;
      }
    } else if (entry.type === 'update') {
      const shape = this.#findShape(page, entry.shapeId);
      if (shape) shape[entry.prop] = entry.oldValue;
    } else if (entry.type === 'move') {
      const shape = this.#findShape(page, entry.shapeId);
      if (shape) {
        shape.x = entry.oldX;
        shape.y = entry.oldY;
      }
    } else if (entry.type === 'resize') {
      const shape = this.#findShape(page, entry.shapeId);
      if (shape) {
        shape.x = entry.oldProps.x;
        shape.y = entry.oldProps.y;
        shape.width = entry.oldProps.width;
        shape.height = entry.oldProps.height;
      }
    } else if (entry.type === 'reorder') {
      const list = page.objects || page.children;
      if (Array.isArray(list)) {
        const [moved] = list.splice(entry.toIndex, 1);
        list.splice(entry.fromIndex, 0, moved);
      }
    }
  }

  #applyRedo(entry) {
    const page = this.#pages.find(p => p.id === entry.pageId);
    if (!page) return;
    const objects = page.objects || page.children || {};
    if (entry.type === 'create') {
      if (Array.isArray(page.objects || page.children)) {
        const list = page.objects || page.children;
        list.push(entry.shape);
      } else {
        objects[entry.shapeId] = entry.shape;
      }
    } else if (entry.type === 'delete') {
      if (Array.isArray(page.objects || page.children)) {
        const list = page.objects || page.children;
        const idx = list.findIndex(s => s.id === entry.shapeId);
        if (idx >= 0) list.splice(idx, 1);
      } else {
        delete objects[entry.shapeId];
      }
    } else if (entry.type === 'update') {
      const shape = this.#findShape(page, entry.shapeId);
      if (shape) shape[entry.prop] = entry.newValue;
    } else if (entry.type === 'move') {
      const shape = this.#findShape(page, entry.shapeId);
      if (shape) {
        shape.x = entry.newX;
        shape.y = entry.newY;
      }
    } else if (entry.type === 'resize') {
      const shape = this.#findShape(page, entry.shapeId);
      if (shape) {
        shape.x = entry.newProps.x;
        shape.y = entry.newProps.y;
        shape.width = entry.newProps.width;
        shape.height = entry.newProps.height;
      }
    } else if (entry.type === 'reorder') {
      const list = page.objects || page.children;
      if (Array.isArray(list)) {
        const [moved] = list.splice(entry.fromIndex, 1);
        list.splice(entry.toIndex, 0, moved);
      }
    }
  }

  destroy() {
    if (this.#keydownHandler) document.removeEventListener('keydown', this.#keydownHandler);
    if (this.#keyupHandler) document.removeEventListener('keyup', this.#keyupHandler);
    if (this.#canvasContainer) {
      if (this.#boundPointerDown) this.#canvasContainer.removeEventListener('pointerdown', this.#boundPointerDown);
      if (this.#boundPointerMove) this.#canvasContainer.removeEventListener('pointermove', this.#boundPointerMove);
      if (this.#boundPointerUp) this.#canvasContainer.removeEventListener('pointerup', this.#boundPointerUp);
      if (this.#boundDblClick) this.#canvasContainer.removeEventListener('dblclick', this.#boundDblClick);
    }
    if (this.#activeTool) this.#activeTool.deactivate(this.#canvas);
  }
}