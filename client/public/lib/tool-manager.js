'use strict';
import { PenpotTool, DrawingTool, SelectTool, HandTool, TextTool, PathTool, ImageTool } from '../components/tools/base.js';
import { PenBezierTool } from '../components/tools/pen-bezier.js';
import { EllipseTool } from '../components/tools/ellipse-tool.js';
import { History } from './history.js';
import { createShape, createBoolShape } from './types.js';
import { enqueueChange, makeCreateChange, makeModifyChange, makeDeleteChange, makeMoveChange } from './persistence.js';
import { copyShapesToClipboard, readShapesFromClipboard, readSystemClipboard, deepCloneShape, assignNewIds } from './clipboard.js';
import { PathEditor } from './path-editor.js';
import { degrees, radians } from '@penpot/shared/math.js';
import { transformPathD, getPathDBounds } from './path-d.js';

function getShapePathD(shape) {
  if (!shape) return null;
  return shape.d || shape.pathData || shape.content || null;
}

function setShapePathD(shape, d) {
  if (!shape) return;
  if (shape.d !== undefined) shape.d = d;
  else if (shape.pathData !== undefined) shape.pathData = d;
  else shape.d = d;
}

export class ToolManager {
  #tools = new Map();
  #activeTool = null;
  #activeToolName = null;
  #canvas = null;
  #workspace = null;
  #history = null;
  #pages = [];
  #currentPageIndex = 0;
  #selectedIds = new Set();
  #clipboard = [];
  #smallNudge = parseInt(localStorage.getItem('penpot-nudge-small'), 10) || 1;
  #bigNudge = parseInt(localStorage.getItem('penpot-nudge-big'), 10) || 10;
  #canvasContainer = null;
  #boundPointerDown = null;
  #boundPointerMove = null;
  #boundPointerUp = null;
  #boundDblClick = null;
  #boundContextMenu = null;
  #keydownHandler = null;
  #keyupHandler = null;
  #pathEditor = null;

  constructor(canvas, workspace) {
    this.#canvas = canvas;
    this.#workspace = workspace;
    this.#history = new History(100, () => {
      this.#workspace.emit('penpot-undo-redo-state', { canUndo: this.#history.canUndo, canRedo: this.#history.canRedo });
    });
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
    this.registerTool('pen', new PenBezierTool());
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
  setSelectedIds(ids) {
    this.#selectedIds.clear();
    for (const id of ids) this.#selectedIds.add(id);
    if (this.#activeTool && typeof this.#activeTool.setSelectedIds === 'function') {
      this.#activeTool.setSelectedIds(new Set(this.#selectedIds));
    }
  }
  get history() { return this.#history; }
  get smallNudge() { return this.#smallNudge; }
  set smallNudge(v) { this.#smallNudge = v; }
  get bigNudge() { return this.#bigNudge; }
  set bigNudge(v) { this.#bigNudge = v; }

  get pathEditor() { return this.#pathEditor; }
  set pathEditor(editor) { this.#pathEditor = editor; }

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

  getCurrentPageShapes() {
    const page = this.getCurrentPage();
    if (!page) return {};
    const objects = page.objects || page.children || {};
    return Array.isArray(objects) ? Object.fromEntries(objects.map(s => [s.id, s])) : objects;
  }

  updatePageObjects(objects) {
    const page = this.getCurrentPage();
    if (!page) return;
    if (!page.objects) page.children = objects;
    else page.objects = objects;
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
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
      if (shape) this.#clipboard.push(deepCloneShape(shape));
    }
    copyShapesToClipboard(this.#clipboard).catch((err) => { console.warn('[tool-manager] clipboard copy failed:', err.message); });
  }

  cutSelected() {
    const page = this.getCurrentPage();
    if (!page) return;
    this.#clipboard = [];
    for (const id of this.#selectedIds) {
      const shape = this.#findShape(page, id);
      if (shape) this.#clipboard.push(deepCloneShape(shape));
    }
    copyShapesToClipboard(this.#clipboard).catch((err) => { console.warn('[tool-manager] clipboard copy failed:', err.message); });
    this.deleteSelected();
  }

  async pasteFromSystemClipboard(x, y) {
    const clipData = await readShapesFromClipboard();
    if (clipData && clipData.source === 'penpot' && Array.isArray(clipData.shapes)) {
      const shapes = assignNewIds(clipData.shapes);
      const offset = (x !== undefined && y !== undefined) ? { dx: x, dy: y } : { dx: 0, dy: 0 };
      if (offset.dx === 0 && offset.dy === 0) {
        offset.dx = 20;
        offset.dy = 20;
      } else {
        const minX = Math.min(...shapes.map(s => s.x ?? 0));
        const minY = Math.min(...shapes.map(s => s.y ?? 0));
        for (const s of shapes) {
          s.x = (s.x ?? 0) - minX + offset.dx;
          s.y = (s.y ?? 0) - minY + offset.dy;
        }
      }
      const newIds = [];
      for (const shape of shapes) {
        const newShape = { ...shape };
        if (offset.dx !== 0 || offset.dy !== 0) {
          if (offset.dx !== 20 && offset.dy !== 20) {
          } else {
            newShape.x = (newShape.x ?? 0) + offset.dx;
            newShape.y = (newShape.y ?? 0) + offset.dy;
          }
        }
        this.addShape(newShape);
        newIds.push(newShape.id);
      }
      this.#selectedIds.clear();
      for (const id of newIds) this.#selectedIds.add(id);
      this.#workspace.emit('penpot-shape-select', { shapeId: newIds.length === 1 ? newIds[0] : null, selectedIds: [...this.#selectedIds] });
      return true;
    }
    if (clipData && clipData.source === 'svg') {
      return false;
    }
    return false;
  }

  pasteClipboard() {
    if (this.#clipboard.length > 0) {
      const newIds = [];
      for (const shape of this.#clipboard) {
        const newShape = { ...deepCloneShape(shape), id: crypto.randomUUID(), x: (shape.x || 0) + 20, y: (shape.y || 0) + 20 };
        this.addShape(newShape);
        newIds.push(newShape.id);
      }
      this.#selectedIds.clear();
      for (const id of newIds) this.#selectedIds.add(id);
      this.#workspace.emit('penpot-shape-select', { shapeId: newIds.length === 1 ? newIds[0] : null, selectedIds: [...this.#selectedIds] });
      return;
    }
    this.pasteFromSystemClipboard();
  }

  pasteAt(x, y) {
    if (this.#clipboard.length === 0) return;
    const minX = Math.min(...this.#clipboard.map(s => s.x || 0));
    const minY = Math.min(...this.#clipboard.map(s => s.y || 0));
    const newIds = [];
    for (const shape of this.#clipboard) {
      const offsetX = (shape.x || 0) - minX;
      const offsetY = (shape.y || 0) - minY;
      const newShape = { ...deepCloneShape(shape), id: crypto.randomUUID(), x: x + offsetX, y: y + offsetY };
      this.addShape(newShape);
      newIds.push(newShape.id);
    }
    this.#selectedIds.clear();
    for (const id of newIds) this.#selectedIds.add(id);
    this.#workspace.emit('penpot-shape-select', { shapeId: newIds.length === 1 ? newIds[0] : null, selectedIds: [...this.#selectedIds] });
  }

  /**
   * Move a shape to an absolute (x, y) position. If the shape is a
   * container, also move all descendants by the same delta so the
   * visual relationship is preserved. Recursion: re-finds children
   * after the parent's move (their parentId chain stays the same, but
   * the data has been mutated).
   */
  moveShapeTo(shapeId, x, y) {
    const page = this.getCurrentPage();
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;
    const oldX = shape.x;
    const oldY = shape.y;
    shape.x = x;
    shape.y = y;
    const dx = x - oldX;
    const dy = y - oldY;
    if (this.#isContainer(shape)) {
      for (const child of this.#findChildren(page, shape.id)) {
        this.moveShape(child.id, dx, dy);
      }
    }
    this.#history.push({ type: 'move', shapeId, oldX, oldY, newX: shape.x, newY: shape.y, pageId: page.id });
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  /**
   * Find all child shapes whose `parentId` matches the given parent id,
   * within the page's full object tree. Returns an array of shape objects
   * (excluding the parent itself).
   */
  #findChildren(page, parentId) {
    if (!page) return [];
    const objects = page.objects || page.children || {};
    const items = Array.isArray(objects) ? objects : Object.values(objects);
    const matches = [];
    const walk = (list) => {
      for (const s of list) {
        if (s.parentId === parentId) matches.push(s);
        if (s.objects || s.children) {
          const kids = Array.isArray(s.objects || s.children)
            ? (s.objects || s.children)
            : Object.values(s.objects || s.children || {});
          walk(kids);
        }
      }
    };
    walk(items);
    return matches;
  }

  /**
   * Returns true if the shape is a container that can have children
   * (frame, group, or bool).
   */
  #isContainer(shape) {
    return shape && (shape.type === 'frame' || shape.type === 'group' || shape.type === 'bool');
  }

  /**
   * Move a shape by (dx, dy). If the shape is a container, also move all
   * descendants by the same delta so the visual relationship is preserved.
   * Recursion: re-finds children after the parent's move (their parentId
   * chain stays the same, but the data has been mutated).
   */
  moveShape(shapeId, dx, dy) {
    const page = this.getCurrentPage();
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;
    const oldX = shape.x;
    const oldY = shape.y;
    shape.x = oldX + dx;
    shape.y = oldY + dy;

    if (this.#isContainer(shape)) {
      for (const child of this.#findChildren(page, shape.id)) {
        this.moveShape(child.id, dx, dy);
      }
    }

    this.#history.push({ type: 'move', shapeId, oldX, oldY, newX: shape.x, newY: shape.y, pageId: page.id });
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  moveSelectedShapes(dx, dy) {
    const page = this.getCurrentPage();
    if (!page) return;
    for (const id of this.#selectedIds) {
      this.moveShape(id, dx, dy);
    }
    if (this.#selectedIds.size > 0) {
      const changedIds = new Set();
      // Walk the page's full tree to find every shape that was moved
      // (the selected one + all of its descendants) and enqueue a
      // modify change for each.
      const collectMoved = (list) => {
        for (const s of list) {
          if (this.#selectedIds.has(s.id) || changedIds.has(s.parentId)) {
            changedIds.add(s.id);
            if (this.#findSelectedParent(page, s.id) || this.#selectedIds.has(s.id)) {
              changes.push(makeModifyChange(page.id, s.id, { x: s.x, y: s.y }));
            }
          }
          if (s.objects || s.children) {
            const kids = Array.isArray(s.objects || s.children)
              ? (s.objects || s.children)
              : Object.values(s.objects || s.children || {});
            collectMoved(kids);
          }
        }
      };
      const objects = page.objects || page.children || {};
      const items = Array.isArray(objects) ? objects : Object.values(objects);
      const changes = [];
      collectMoved(items);
      for (const change of changes) enqueueChange(change);
    }
  }

  /** Walk up the parentId chain to see if any ancestor is in #selectedIds. */
  #findSelectedParent(page, shapeId) {
    const objects = page?.objects || page?.children || {};
    const items = Array.isArray(objects) ? objects : Object.values(objects);
    const map = new Map();
    for (const s of items) map.set(s.id, s);
    let cur = map.get(shapeId);
    while (cur) {
      if (this.#selectedIds.has(cur.id)) return cur;
      cur = cur.parentId ? map.get(cur.parentId) : null;
    }
    return null;
  }

  resizeShape(shapeId, x, y, width, height) {
    const page = this.getCurrentPage();
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;
    const oldProps = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    const oldW = oldProps.width || 0;
    const oldH = oldProps.height || 0;
    const newW = width || 0;
    const newH = height || 0;

    const isPathLike = shape.type === 'path' || shape.type === 'curve'
      || shape.type === 'polyline' || shape.type === 'polygon' || shape.type === 'bool';
    const d = getShapePathD(shape);
    if (isPathLike && d && oldW > 0 && oldH > 0 && newW > 0 && newH > 0) {
      const dBounds = getPathDBounds(d);
      const scaleX = newW / oldW;
      const scaleY = newH / oldH;
      setShapePathD(shape, transformPathD(d, {
        dx: -dBounds.x,
        dy: -dBounds.y,
        scaleX,
        scaleY,
        scaleOriginX: 0,
        scaleOriginY: 0,
      }));
    }

    shape.x = x;
    shape.y = y;
    shape.width = width;
    shape.height = height;

    // If the shape is a container, also resize all descendants relative to
    // the old→new bounds so they stay inside the new frame.
    if (this.#isContainer(shape) && oldW > 0 && oldH > 0 && newW > 0 && newH > 0) {
      const scaleX = newW / oldW;
      const scaleY = newH / oldH;
      const oldOX = oldProps.x || 0;
      const oldOY = oldProps.y || 0;
      for (const child of this.#findChildren(page, shape.id)) {
        if (child.x != null) {
          child.x = (child.x - oldOX) * scaleX + x;
        }
        if (child.y != null) {
          child.y = (child.y - oldOY) * scaleY + y;
        }
        if (child.width != null && oldW > 0) child.width = child.width * scaleX;
        if (child.height != null && oldH > 0) child.height = child.height * scaleY;
        // Recurse for nested containers.
        if (this.#isContainer(child) && (child.objects || child.children)) {
          // Recurse into nested container by calling resizeShape on each
          // direct child with the same old→new ratio. This is approximate
          // (uses the outer shape's old props as the reference) but works
          // for the common single-level case.
        }
        // If child has path d, rescale it like we do for the parent.
        const childD = getShapePathD(child);
        if (childD) {
          const childOldW = (child.width || 0);
          const childOldH = (child.height || 0);
          if (childOldW > 0 && childOldH > 0) {
            const childBounds = getPathDBounds(childD);
            setShapePathD(child, transformPathD(childD, {
              dx: -childBounds.x,
              dy: -childBounds.y,
              scaleX,
              scaleY,
              scaleOriginX: 0,
              scaleOriginY: 0,
            }));
          }
        }
      }
    }

    this.#history.push({ type: 'resize', shapeId, oldProps, newProps: { x, y, width, height }, pageId: page.id });
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
    this.#workspace.emit('penpot-shape-select', { shapeId, selectedIds: [shapeId] });
  }

  rotateShape(shapeId, rad) {
    this.updateShapeProp(shapeId, 'rotation', degrees(rad));
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
      if (isNaN(numericValue) || numericValue < 0) numericValue = 0;
      if (shape.width !== numericValue) {
        this.#history.push({ type: 'update', shapeId, prop: 'width', oldValue: shape.width, newValue: numericValue, pageId: page.id });
        shape.width = numericValue;
        changed = true;
      }
    } else if (prop === 'h') {
      shapeProp = 'height';
      numericValue = Number(value);
      if (isNaN(numericValue) || numericValue < 0) numericValue = 0;
      if (shape.height !== numericValue) {
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
      numericValue = Number(value);
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
      const oldValue = shape[shapeProp];
      if (oldValue === value) return;
      shape[shapeProp] = value;
      this.#history.push({ type: 'update', shapeId, prop: shapeProp, oldValue, newValue: value, pageId: page.id });
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

  flattenPath(shapeId) {
    const page = this.getCurrentPage();
    if (!page) return;
    const shape = this.#findShape(page, shapeId);
    if (!shape) return;
    const oldType = shape.type;
    if (shape.type === 'path' || shape.type === 'bool') {
      const strokes = shape.strokes || [];
      if (strokes.length === 0) return;
      const stroke = strokes[0];
      const strokeColor = stroke.color || stroke.strokeColor || '#000000';
      const strokeOpacity = stroke.opacity !== undefined ? stroke.opacity : 1;
      const existingFills = shape.fills || [];
      shape.fills = [...existingFills, { fillType: 'solid', color: strokeColor, opacity: strokeOpacity }];
      shape.strokes = [];
      this.#history.push({
        type: 'update', shapeId, prop: 'flatten',
        oldValue: { type: oldType, fills: existingFills, strokes },
        newValue: { fills: shape.fills, strokes: [] },
        pageId: page.id,
      });
      this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
    }
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
    this.#canvasContainer = this.#canvas.querySelector('.penpot-canvas__canvas-container') || this.#canvas.querySelector('#container') || this.#canvas;
    this.#boundPointerDown = (e) => this.#handlePointerDown(e);
    this.#boundPointerMove = (e) => this.#handlePointerMove(e);
    this.#boundPointerUp = (e) => this.#handlePointerUp(e);
    this.#boundDblClick = (e) => this.#handleDblClick(e);
    this.#canvasContainer.addEventListener('pointerdown', this.#boundPointerDown);
    this.#canvasContainer.addEventListener('pointermove', this.#boundPointerMove);
    this.#canvasContainer.addEventListener('pointerup', this.#boundPointerUp);
    this.#canvasContainer.addEventListener('dblclick', this.#boundDblClick);
    this.#boundContextMenu = (e) => this.#handleContextMenu(e);
    this.#canvasContainer.addEventListener('contextmenu', this.#boundContextMenu);
  }

  #bindKeyboard() {
    this.#keydownHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;

      if (this.#pathEditor && this.#pathEditor.isActive) {
        const handled = this.#pathEditor.handleKeyDown(e);
        if (handled) return;
      }

      if (this.#activeTool) this.#activeTool.onKeyDown(e, this.#canvas);

      const nudge = e.shiftKey ? this.#bigNudge : this.#smallNudge;
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
    if (this.#pathEditor && this.#pathEditor.isActive) {
      const handled = this.#pathEditor.handleMouseDown(e, this.#screenToCanvas.bind(this));
      if (handled) return;
    }
    if (this.#activeTool) this.#activeTool.onMouseDown(e, this.#canvas);
  }

  #handlePointerMove(e) {
    if (this.#pathEditor && this.#pathEditor.isActive) {
      const handled = this.#pathEditor.handleMouseMove(e, this.#screenToCanvas.bind(this));
      if (handled) return;
    }
    if (this.#activeTool) this.#activeTool.onMouseMove(e, this.#canvas);
    this.#updateCursor();
  }

  #handlePointerUp(e) {
    if (this.#pathEditor && this.#pathEditor.isActive) {
      const handled = this.#pathEditor.handleMouseUp(e, this.#screenToCanvas.bind(this));
      if (handled) return;
    }
    if (this.#activeTool) this.#activeTool.onMouseUp(e, this.#canvas);
  }

  #handleDblClick(e) {
    if (this.#activeTool && typeof this.#activeTool.onDblClick === 'function') {
      this.#activeTool.onDblClick(e, this.#canvas);
    }
  }

  #screenToCanvas(clientX, clientY) {
    const canvasEl = this.#canvas;
    if (canvasEl && typeof canvasEl.screenToCanvas === 'function') {
      return canvasEl.screenToCanvas(clientX, clientY);
    }
    const rect = canvasEl.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  #handleContextMenu(e) {
    e.preventDefault();
    if (this.#selectedIds.size === 0) return;
    this.#workspace.emit('penpot-shape-context-menu', {
      x: e.clientX,
      y: e.clientY,
      selectedIds: [...this.#selectedIds],
    });
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
    this.#persistUndo(entry);
    const page = this.getCurrentPage();
    if (page) this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
  }

  redo() {
    const entry = this.#history.redo();
    if (!entry) return;
    this.#applyRedo(entry);
    this.#persistRedo(entry);
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

  #persistUndo(entry) {
    const pageId = entry.pageId;
    switch (entry.type) {
      case 'create':
        enqueueChange(makeDeleteChange(pageId, entry.shapeId));
        break;
      case 'delete':
        enqueueChange(makeCreateChange(pageId, entry.shape, entry.shape.parentId));
        break;
      case 'update':
        enqueueChange(makeModifyChange(pageId, entry.shapeId, { [entry.prop]: entry.oldValue }));
        break;
      case 'move':
        enqueueChange(makeModifyChange(pageId, entry.shapeId, { x: entry.oldX, y: entry.oldY }));
        break;
      case 'resize':
        enqueueChange(makeModifyChange(pageId, entry.shapeId, { x: entry.oldProps.x, y: entry.oldProps.y, width: entry.oldProps.width, height: entry.oldProps.height }));
        break;
      case 'reorder':
        enqueueChange(makeMoveChange(pageId, entry.shapeId, entry.toIndex, entry.fromIndex));
        break;
    }
  }

  #persistRedo(entry) {
    const pageId = entry.pageId;
    switch (entry.type) {
      case 'create':
        enqueueChange(makeCreateChange(pageId, entry.shape, entry.shape.parentId));
        break;
      case 'delete':
        enqueueChange(makeDeleteChange(pageId, entry.shapeId));
        break;
      case 'update':
        enqueueChange(makeModifyChange(pageId, entry.shapeId, { [entry.prop]: entry.newValue }));
        break;
      case 'move':
        enqueueChange(makeModifyChange(pageId, entry.shapeId, { x: entry.newX, y: entry.newY }));
        break;
      case 'resize':
        enqueueChange(makeModifyChange(pageId, entry.shapeId, { x: entry.newProps.x, y: entry.newProps.y, width: entry.newProps.width, height: entry.newProps.height }));
        break;
      case 'reorder':
        enqueueChange(makeMoveChange(pageId, entry.shapeId, entry.fromIndex, entry.toIndex));
        break;
    }
  }

  alignSelectedShapes(alignment) {
    if (this.#selectedIds.size < 2) return;
    const page = this.getCurrentPage();
    if (!page) return;
    const shapes = [];
    for (const id of this.#selectedIds) {
      const shape = this.#findShape(page, id);
      if (shape) shapes.push(shape);
    }
    if (shapes.length < 2) return;

    const minX = Math.min(...shapes.map(s => s.x));
    const maxX = Math.max(...shapes.map(s => s.x + s.width));
    const minY = Math.min(...shapes.map(s => s.y));
    const maxY = Math.max(...shapes.map(s => s.y + s.height));
    const centerH = (minX + maxX) / 2;
    const centerV = (minY + maxY) / 2;

    for (const shape of shapes) {
      const oldX = shape.x;
      const oldY = shape.y;
      switch (alignment) {
        case 'left': shape.x = minX; break;
        case 'center-h': shape.x = centerH - shape.width / 2; break;
        case 'right': shape.x = maxX - shape.width; break;
        case 'top': shape.y = minY; break;
        case 'center-v': shape.y = centerV - shape.height / 2; break;
        case 'bottom': shape.y = maxY - shape.height; break;
      }
      if (shape.x !== oldX || shape.y !== oldY) {
        this.#history.push({ type: 'move', shapeId: shape.id, oldX, oldY, newX: shape.x, newY: shape.y, pageId: page.id });
        enqueueChange(makeModifyChange(page.id, shape.id, { x: shape.x, y: shape.y }));
      }
    }
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
    this.#workspace.emit('penpot-shape-select', { shapeId: null, selectedIds: [...this.#selectedIds] });
  }

  distributeSelectedShapes(direction) {
    if (this.#selectedIds.size < 3) return;
    const page = this.getCurrentPage();
    if (!page) return;
    const shapes = [];
    for (const id of this.#selectedIds) {
      const shape = this.#findShape(page, id);
      if (shape) shapes.push(shape);
    }
    if (shapes.length < 3) return;

    if (direction === 'horizontal') {
      shapes.sort((a, b) => a.x - b.x);
      const first = shapes[0];
      const last = shapes[shapes.length - 1];
      const totalSpan = (last.x + last.width) - first.x;
      const totalShapeWidth = shapes.reduce((sum, s) => sum + s.width, 0);
      const gap = (totalSpan - totalShapeWidth) / (shapes.length - 1);
      let currentX = first.x;
      for (const shape of shapes) {
        const oldX = shape.x;
        shape.x = currentX;
        if (shape.x !== oldX) {
          this.#history.push({ type: 'move', shapeId: shape.id, oldX, oldY: shape.y, newX: shape.x, newY: shape.y, pageId: page.id });
          enqueueChange(makeModifyChange(page.id, shape.id, { x: shape.x }));
        }
        currentX += shape.width + gap;
      }
    } else {
      shapes.sort((a, b) => a.y - b.y);
      const first = shapes[0];
      const last = shapes[shapes.length - 1];
      const totalSpan = (last.y + last.height) - first.y;
      const totalShapeHeight = shapes.reduce((sum, s) => sum + s.height, 0);
      const gap = (totalSpan - totalShapeHeight) / (shapes.length - 1);
      let currentY = first.y;
      for (const shape of shapes) {
        const oldY = shape.y;
        shape.y = currentY;
        if (shape.y !== oldY) {
          this.#history.push({ type: 'move', shapeId: shape.id, oldX: shape.x, oldY, newX: shape.x, newY: shape.y, pageId: page.id });
          enqueueChange(makeModifyChange(page.id, shape.id, { y: shape.y }));
        }
        currentY += shape.height + gap;
      }
    }
    this.#workspace.emit('penpot-page-change', { page, pageIndex: this.#currentPageIndex });
    this.#workspace.emit('penpot-shape-select', { shapeId: null, selectedIds: [...this.#selectedIds] });
  }

  destroy() {
    if (this.#keydownHandler) document.removeEventListener('keydown', this.#keydownHandler);
    if (this.#keyupHandler) document.removeEventListener('keyup', this.#keyupHandler);
    if (this.#canvasContainer) {
      if (this.#boundPointerDown) this.#canvasContainer.removeEventListener('pointerdown', this.#boundPointerDown);
      if (this.#boundPointerMove) this.#canvasContainer.removeEventListener('pointermove', this.#boundPointerMove);
      if (this.#boundPointerUp) this.#canvasContainer.removeEventListener('pointerup', this.#boundPointerUp);
      if (this.#boundDblClick) this.#canvasContainer.removeEventListener('dblclick', this.#boundDblClick);
      if (this.#boundContextMenu) this.#canvasContainer.removeEventListener('contextmenu', this.#boundContextMenu);
    }
    if (this.#activeTool) this.#activeTool.deactivate(this.#canvas);
  }
}