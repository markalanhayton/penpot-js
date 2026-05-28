'use strict';
export class Canvas2DRenderer {
  #canvas = null;
  #ctx = null;
  #width = 0;
  #height = 0;
  #zoom = 1;
  #panX = 0;
  #panY = 0;
  #shapeCache = new Map();
  #dirtyShapes = new Set();
  #animationFrameId = null;
  #selectionIds = new Set();
  #gradientDefs = {};

  constructor(canvasElement) {
    this.#canvas = canvasElement;
    this.#ctx = canvasElement.getContext('2d');
    this.resize();
  }

  resize() {
    const parent = this.#canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    this.#width = parent.clientWidth;
    this.#height = parent.clientHeight;
    this.#canvas.width = this.#width * dpr;
    this.#canvas.height = this.#height * dpr;
    this.#canvas.style.width = `${this.#width}px`;
    this.#canvas.style.height = `${this.#height}px`;
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.requestRender();
  }

  setZoom(zoom) {
    this.#zoom = Math.max(0.05, Math.min(64, zoom));
    this.requestRender();
  }

  setPan(x, y) {
    this.#panX = x;
    this.#panY = y;
    this.requestRender();
  }

  panBy(dx, dy) {
    this.#panX += dx;
    this.#panY += dy;
    this.requestRender();
  }

  get zoom() { return this.#zoom; }
  get panX() { return this.#panX; }
  get panY() { return this.#panY; }

  requestRender() {
    if (this.#animationFrameId) return;
    this.#animationFrameId = requestAnimationFrame(() => {
      this.#animationFrameId = null;
      this.render();
    });
  }

  renderPage(page, selectedIds = new Set()) {
    if (!page) return;
    this.#selectionIds = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
    const objects = page.objects || page.children || {};
    const shapes = Array.isArray(objects) ? objects : Object.values(objects);
    this.#shapeCache.clear();
    for (const shape of shapes) {
      if (shape.visible === false) continue;
      this.#shapeCache.set(shape.id, shape);
    }
    this.requestRender();
  }

  render() {
    const ctx = this.#ctx;
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, this.#width, this.#height);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.#width, this.#height);

    ctx.save();
    ctx.translate(this.#panX * this.#zoom + this.#width / 2, this.#panY * this.#zoom + this.#height / 2);
    ctx.scale(this.#zoom, this.#zoom);
    ctx.translate(-this.#width / 2 / this.#zoom, -this.#height / 2 / this.#zoom);

    this.#drawGrid(ctx);

    const sortedShapes = this.#getSortedShapes();
    for (const shape of sortedShapes) {
      if (shape.visible === false) continue;
      this.#drawShape(ctx, shape);
    }

    for (const id of this.#selectionIds) {
      const shape = this.#shapeCache.get(id);
      if (shape) {
        this.#drawSelectionOutline(ctx, shape);
      }
    }

    if (this.#selectionIds.size > 1) {
      const selectedShapes = [];
      for (const id of this.#selectionIds) {
        const shape = this.#shapeCache.get(id);
        if (shape) selectedShapes.push(shape);
      }
      if (selectedShapes.length > 0) {
        const composite = this.#computeBounds(selectedShapes);
        this.#drawSelectionHandles(ctx, composite, true);
      }
    } else if (this.#selectionIds.size === 1) {
      const shape = this.#shapeCache.get([...this.#selectionIds][0]);
      if (shape) {
        this.#drawSelectionHandles(ctx, shape, false);
      }
    }

    ctx.restore();
    ctx.restore();
  }

  #drawGrid(ctx) {
    const gridSize = 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;

    const startX = -Math.ceil(this.#width / this.#zoom / 2 + this.#panX) - gridSize;
    const endX = Math.ceil(this.#width / this.#zoom / 2 - this.#panX) + gridSize;
    const startY = -Math.ceil(this.#height / this.#zoom / 2 + this.#panY) - gridSize;
    const endY = Math.ceil(this.#height / this.#zoom / 2 - this.#panY) + gridSize;

    ctx.beginPath();
    for (let x = Math.floor(startX / gridSize) * gridSize; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = Math.floor(startY / gridSize) * gridSize; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
  }

  #getSortedShapes() {
    return [...this.#shapeCache.values()].sort((a, b) => {
      const az = a['layout-item-z-index'] || 0;
      const bz = b['layout-item-z-index'] || 0;
      return az - bz;
    });
  }

  #drawShape(ctx, shape) {
    ctx.save();

    if (shape.opacity !== undefined && shape.opacity < 1) {
      ctx.globalAlpha = shape.opacity;
    }

    if (shape.rotation) {
      const cx = shape.x + (shape.width || 0) / 2;
      const cy = shape.y + (shape.height || 0) / 2;
      ctx.translate(cx, cy);
      ctx.rotate(shape.rotation);
      ctx.translate(-cx, -cy);
    }

    const hasClip = shape.maskedGroup;
    if (hasClip) {
      ctx.clip();
    }

    switch (shape.type) {
      case 'frame': this.#drawFrame(ctx, shape); break;
      case 'rect': this.#drawRect(ctx, shape); break;
      case 'circle':
      case 'ellipse': this.#drawEllipse(ctx, shape); break;
      case 'text': this.#drawText(ctx, shape); break;
      case 'path': this.#drawPath(ctx, shape); break;
      case 'image': this.#drawImage(ctx, shape); break;
      case 'group': this.#drawGroup(ctx, shape); break;
      case 'bool': this.#drawBool(ctx, shape); break;
      case 'svg-raw': break;
      default: this.#drawRect(ctx, shape); break;
    }

    ctx.restore();
  }

  #applyFills(ctx, shape) {
    if (!shape.fills || shape.fills.length === 0) {
      return false;
    }
    for (const fill of shape.fills) {
      if (fill.visible === false) continue;
      ctx.save();
      if (fill.opacity !== undefined && fill.opacity < 1) {
        ctx.globalAlpha = fill.opacity;
      }
      switch (fill.type || 'solid') {
        case 'solid':
          ctx.fillStyle = fill.color || '#000000';
          ctx.fill();
          break;
        case 'linear-gradient': {
          const x = shape.x || 0, y = shape.y || 0, w = shape.width || 0, h = shape.height || 0;
          const x1 = fill.x1 !== undefined ? fill.x1 : 0;
          const y1 = fill.y1 !== undefined ? fill.y1 : 0;
          const x2 = fill.x2 !== undefined ? fill.x2 : 1;
          const y2 = fill.y2 !== undefined ? fill.y2 : 0;
          const grad = ctx.createLinearGradient(x + x1 * w, y + y1 * h, x + x2 * w, y + y2 * h);
          const stops = fill.stops || [{ offset: 0, color: fill.color || '#000000' }, { offset: 1, color: fill.color2 || '#ffffff' }];
          for (const stop of stops) {
            grad.addColorStop(stop.offset, stop.color || '#000000');
          }
          ctx.fillStyle = grad;
          ctx.fill();
          break;
        }
        case 'radial-gradient': {
          const x = shape.x || 0, y = shape.y || 0, w = shape.width || 0, h = shape.height || 0;
          const cx = fill.cx !== undefined ? fill.cx : 0.5;
          const cy = fill.cy !== undefined ? fill.cy : 0.5;
          const r = fill.r !== undefined ? fill.r : 0.5;
          const grad = ctx.createRadialGradient(x + cx * w, y + cy * h, 0, x + cx * w, y + cy * h, r * Math.max(w, h));
          const stops = fill.stops || [{ offset: 0, color: fill.color || '#000000' }, { offset: 1, color: fill.color2 || '#ffffff' }];
          for (const stop of stops) {
            grad.addColorStop(stop.offset, stop.color || '#000000');
          }
          ctx.fillStyle = grad;
          ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
    return true;
  }

  #applyStrokes(ctx, shape) {
    if (!shape.strokes || shape.strokes.length === 0) return;
    for (const stroke of shape.strokes) {
      if (stroke.visible === false) continue;
      ctx.save();
      ctx.strokeStyle = stroke.color || '#333333';
      ctx.lineWidth = stroke.width || 1;
      ctx.lineCap = stroke.cap || 'butt';
      ctx.lineJoin = stroke.join || 'miter';
      if (stroke.style === 'dashed') {
        ctx.setLineDash([6, 3]);
      } else if (stroke.style === 'dotted') {
        ctx.setLineDash([2, 2]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  #drawFrame(ctx, shape) {
    const x = shape.x || 0, y = shape.y || 0, w = shape.width || 0, h = shape.height || 0;
    const pad = shape.layoutPadding || { p1: 0, p2: 0, p3: 0, p4: 0 };
    const layout = shape.layout;

    ctx.beginPath();
    const r1 = shape.r1 || 0, r2 = shape.r2 || 0, r3 = shape.r3 || 0, r4 = shape.r4 || 0;
    if (r1 === r2 && r2 === r3 && r3 === r4 && r1 > 0) {
      ctx.roundRect(x, y, w, h, r1);
    } else if (r1 || r2 || r3 || r4) {
      this.#roundRectPath(ctx, x, y, w, h, r1 || 0, r2 || 0, r3 || 0, r4 || 0);
    } else {
      ctx.rect(x, y, w, h);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fill();

    this.#applyFills(ctx, shape);
    this.#applyStrokes(ctx, shape);

    const children = shape.shapes || shape.children || [];
    if (Array.isArray(children)) {
      for (const childId of children) {
        const child = this.#shapeCache.get(childId);
        if (child) this.#drawShape(ctx, child);
      }
    }
  }

  #drawRect(ctx, shape) {
    const x = shape.x || 0, y = shape.y || 0, w = shape.width || 0, h = shape.height || 0;
    const r1 = shape.r1 || 0, r2 = shape.r2 || 0, r3 = shape.r3 || 0, r4 = shape.r4 || 0;

    ctx.beginPath();
    if (r1 === r2 && r2 === r3 && r3 === r4 && r1 > 0) {
      ctx.roundRect(x, y, w, h, r1);
    } else if (r1 || r2 || r3 || r4) {
      this.#roundRectPath(ctx, x, y, w, h, r1 || 0, r2 || 0, r3 || 0, r4 || 0);
    } else {
      ctx.rect(x, y, w, h);
    }

    if (!shape.fills || shape.fills.length === 0) {
      ctx.fillStyle = '#4a90d9';
      ctx.fill();
    } else {
      this.#applyFills(ctx, shape);
    }
    this.#applyStrokes(ctx, shape);
  }

  #drawEllipse(ctx, shape) {
    const cx = (shape.x || 0) + (shape.width || 0) / 2;
    const cy = (shape.y || 0) + (shape.height || 0) / 2;
    const rx = Math.max(0.5, (shape.width || 0) / 2);
    const ry = Math.max(0.5, (shape.height || 0) / 2);

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);

    if (!shape.fills || shape.fills.length === 0) {
      ctx.fillStyle = '#4a90d9';
      ctx.fill();
    } else {
      this.#applyFills(ctx, shape);
    }
    this.#applyStrokes(ctx, shape);
  }

  #resolveFillColor(fill) {
    if (!fill) return '#000000';
    if (typeof fill === 'string') return fill;
    if (fill.color) {
      if (typeof fill.color === 'string') return fill.color;
      const r = Math.round((fill.color.r ?? 0) * 255);
      const g = Math.round((fill.color.g ?? 0) * 255);
      const b = Math.round((fill.color.b ?? 0) * 255);
      return `rgb(${r},${g},${b})`;
    }
    if (fill['fill-color']) {
      if (fill['fill-opacity'] !== undefined && fill['fill-opacity'] < 1) {
        const hex = fill['fill-color'];
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${fill['fill-opacity']})`;
      }
      return fill['fill-color'];
    }
    return '#000000';
  }

  #drawText(ctx, shape) {
    const x = shape.x || 0, y = shape.y || 0;
    const content = shape.content;
    if (!content) return;

    const defaultFontSize = shape.fontSize || 14;
    const defaultFontFamily = shape.fontFamily || 'sans-serif';
    const defaultFontWeight = String(shape.fontWeight || 'normal');
    const defaultFontStyle = shape.fontStyle || 'normal';
    const defaultLineHeight = shape.lineHeight || 1.2;
    const defaultTextAlign = shape.textAlign || 'left';

    if (content && typeof content === 'object' && content.type === 'root') {
      this.#drawContentTree(ctx, shape, content, x, y, defaultFontSize, defaultFontFamily, defaultFontWeight, defaultFontStyle, defaultLineHeight, defaultTextAlign);
      return;
    }

    const textStr = typeof content === 'string' ? content : '';
    if (!textStr) return;

    ctx.font = `${defaultFontStyle} ${defaultFontWeight} ${defaultFontSize}px ${defaultFontFamily}`;
    ctx.textAlign = defaultTextAlign;
    ctx.textBaseline = 'top';

    const lines = textStr.split('\n');
    const lineHeight = defaultFontSize * defaultLineHeight;

    for (let i = 0; i < lines.length; i++) {
      const textY = y + i * lineHeight;
      if (shape.fills && shape.fills.length > 0) {
        ctx.fillStyle = this.#resolveFillColor(shape.fills[0]);
      } else {
        ctx.fillStyle = '#333333';
      }
      ctx.fillText(lines[i], x + 2, textY);
    }
  }

  #drawContentTree(ctx, shape, content, x, y, defaultFontSize, defaultFontFamily, defaultFontWeight, defaultFontStyle, defaultLineHeight, defaultTextAlign) {
    const paragraphSets = content.children || [];
    let lineIndex = 0;

    for (const pset of paragraphSets) {
      const paragraphs = pset.children || [];
      for (const para of paragraphs) {
        const paraAlign = para['text-align'] || defaultTextAlign;
        const paraDir = para['text-direction'] || 'ltr';
        const children = para.children || [];

        const paraY = y + lineIndex * (defaultFontSize * defaultLineHeight);

        for (const textNode of children) {
          if (textNode.type !== undefined) continue;
          const nodeFontSize = parseFloat(textNode['font-size'] || defaultFontSize);
          const nodeFontFamily = textNode['font-family'] || defaultFontFamily;
          const nodeFontWeight = String(textNode['font-weight'] || defaultFontWeight);
          const nodeFontStyle = textNode['font-style'] || defaultFontStyle;
          const textTransform = textNode['text-transform'];

          ctx.font = `${nodeFontStyle} ${nodeFontWeight} ${nodeFontSize}px ${nodeFontFamily}`;
          ctx.textAlign = paraAlign;
          ctx.textBaseline = 'top';
          ctx.direction = paraDir;

          if (textNode.fills && textNode.fills.length > 0) {
            ctx.fillStyle = this.#textNodeFillColor(textNode.fills[0]);
          } else if (shape.fills && shape.fills.length > 0) {
            ctx.fillStyle = this.#resolveFillColor(shape.fills[0]);
          } else {
            ctx.fillStyle = '#333333';
          }

          let text = textNode.text || '';
          if (textTransform === 'uppercase') text = text.toUpperCase();
          else if (textTransform === 'lowercase') text = text.toLowerCase();
          else if (textTransform === 'capitalize') text = text.replace(/\b\w/g, c => c.toUpperCase());

          const textDecoration = textNode['text-decoration'];
          ctx.fillText(text, x + 2, paraY);

          if (textDecoration && textDecoration !== 'none') {
            const metrics = ctx.measureText(text);
            const ty = paraY + nodeFontSize;
            if (textDecoration.includes('underline')) {
              ctx.beginPath();
              ctx.moveTo(x + 2, ty);
              ctx.lineTo(x + 2 + metrics.width, ty);
              ctx.stroke();
            }
            if (textDecoration.includes('line-through')) {
              ctx.beginPath();
              ctx.moveTo(x + 2, ty - nodeFontSize * 0.3);
              ctx.lineTo(x + 2 + metrics.width, ty - nodeFontSize * 0.3);
              ctx.stroke();
            }
          }
        }

        lineIndex++;
      }
    }
  }

  #textNodeFillColor(fill) {
    if (fill['fill-color']) return fill['fill-color'];
    if (fill.color) return this.#resolveFillColor(fill);
    return '#000000';
  }

  #drawPath(ctx, shape) {
    const d = shape.d;
    if (!d) return;

    ctx.beginPath();
    this.#tracePath(ctx, d);

    this.#applyFills(ctx, shape);
    if (!shape.strokes || shape.strokes.length === 0) {
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      this.#applyStrokes(ctx, shape);
    }
  }

  #drawImage(ctx, shape) {
    const x = shape.x || 0, y = shape.y || 0, w = shape.width || 0, h = shape.height || 0;
    if (shape.href || shape.url || shape.src) {
      const img = this.#getCachedImage(shape.href || shape.url || shape.src);
      if (img) {
        ctx.drawImage(img, x, y, w, h);
      } else {
        ctx.fillStyle = '#ccc';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Image', x + w / 2, y + h / 2);
      }
    } else {
      ctx.fillStyle = '#ccc';
      ctx.fillRect(x, y, w, h);
    }
  }

  #drawGroup(ctx, shape) {
    const children = shape.shapes || shape.children || [];
    if (Array.isArray(children)) {
      for (const childId of children) {
        const child = this.#shapeCache.get(childId);
        if (child) this.#drawShape(ctx, child);
      }
    }
  }

  #drawBool(ctx, shape) {
    if (shape.d) {
      ctx.beginPath();
      this.#tracePath(ctx, shape.d);
      this.#applyFills(ctx, shape);
      this.#applyStrokes(ctx, shape);
      return;
    }

    const children = shape.shapes || shape.children || [];
    if (Array.isArray(children) && children.length > 0) {
      for (const childId of children) {
        const child = this.#shapeCache.get(childId);
        if (child) this.#drawShape(ctx, child);
      }
    } else {
      ctx.setLineDash([6, 3]);
      ctx.strokeStyle = '#31efb8';
      ctx.lineWidth = 1;
      ctx.strokeRect(shape.x || 0, shape.y || 0, shape.width || 0, shape.height || 0);
      ctx.setLineDash([]);
      ctx.fillStyle = '#999';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shape.boolType || 'bool', (shape.x || 0) + (shape.width || 0) / 2, (shape.y || 0) + (shape.height || 0) / 2);
    }
  }

  #drawSelectionOutline(ctx, shape) {
    const x = shape.x || 0, y = shape.y || 0, w = shape.width || 0, h = shape.height || 0;
    const pad = 2 / this.#zoom;

    ctx.save();
    ctx.strokeStyle = '#7b61ff';
    ctx.lineWidth = 1.5 / this.#zoom;
    ctx.setLineDash([]);
    ctx.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
    ctx.restore();
  }

  #drawSelectionHandles(ctx, shape, isMulti) {
    const x = shape.x || 0, y = shape.y || 0, w = shape.width || 0, h = shape.height || 0;
    const pad = 2 / this.#zoom;

    ctx.save();
    if (isMulti) {
      ctx.strokeStyle = '#31efb8';
      ctx.lineWidth = 1.5 / this.#zoom;
      ctx.setLineDash([4 / this.#zoom, 4 / this.#zoom]);
      ctx.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
      ctx.setLineDash([]);
    }

    const handleSize = 8 / this.#zoom;
    const handles = [
      [x - pad, y - pad],
      [x + w / 2, y - pad],
      [x + w + pad, y - pad],
      [x + w + pad, y + h / 2],
      [x + w + pad, y + h + pad],
      [x + w / 2, y + h + pad],
      [x - pad, y + h + pad],
      [x - pad, y + h / 2],
    ];

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#31efb8';
    ctx.lineWidth = 1.5 / this.#zoom;
    for (const [hx, hy] of handles) {
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    }

    const rotHandleY = y - 20 / this.#zoom;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - pad);
    ctx.lineTo(x + w / 2, rotHandleY);
    ctx.strokeStyle = '#31efb8';
    ctx.lineWidth = 1 / this.#zoom;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + w / 2, rotHandleY, 4 / this.#zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#31efb8';
    ctx.lineWidth = 1.5 / this.#zoom;
    ctx.stroke();

    ctx.restore();
  }

  #computeBounds(shapes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of shapes) {
      const sx = s.x || 0, sy = s.y || 0, sw = s.width || 0, sh = s.height || 0;
      if (sw > 0 && sh > 0) {
        minX = Math.min(minX, sx);
        minY = Math.min(minY, sy);
        maxX = Math.max(maxX, sx + sw);
        maxY = Math.max(maxY, sy + sh);
      }
    }
    if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  #roundRectPath(ctx, x, y, w, h, tl, tr, br, bl) {
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    if (tr > 0) ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    if (br > 0) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    if (bl > 0) ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    if (tl > 0) ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }

  #tracePath(ctx, d) {
    if (!d) return;
    const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/gi);
    if (!commands) return;

    for (const cmd of commands) {
      const type = cmd[0];
      const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      switch (type) {
        case 'M': ctx.moveTo(nums[0], nums[1]); break;
        case 'm': ctx.moveTo(ctx._x + nums[0], ctx._y + nums[1]); break;
        case 'L': ctx.lineTo(nums[0], nums[1]); break;
        case 'l': ctx.lineTo(ctx._x + nums[0], ctx._y + nums[1]); break;
        case 'H': ctx.lineTo(nums[0], ctx._y); break;
        case 'h': ctx.lineTo(ctx._x + nums[0], ctx._y); break;
        case 'V': ctx.lineTo(ctx._x, nums[0]); break;
        case 'v': ctx.lineTo(ctx._x, ctx._y + nums[0]); break;
        case 'C': ctx.bezierCurveTo(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]); break;
        case 'c': ctx.bezierCurveTo(ctx._x + nums[0], ctx._y + nums[1], ctx._x + nums[2], ctx._y + nums[3], ctx._x + nums[4], ctx._y + nums[5]); break;
        case 'Q': ctx.quadraticCurveTo(nums[0], nums[1], nums[2], nums[3]); break;
        case 'q': ctx.quadraticCurveTo(ctx._x + nums[0], ctx._y + nums[1], ctx._x + nums[2], ctx._y + nums[3]); break;
        case 'Z': case 'z': ctx.closePath(); break;
      }
      if (nums.length >= 2) {
        ctx._x = nums[nums.length - 2];
        ctx._y = nums[nums.length - 1];
      }
    }
  }

  #imageCache = new Map();

  #getCachedImage(url) {
    if (this.#imageCache.has(url)) {
      return this.#imageCache.get(url);
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.#imageCache.set(url, img);
      this.requestRender();
    };
    img.onerror = () => {
      this.#imageCache.set(url, null);
    };
    img.src = url;
    return null;
  }

  screenToCanvas(clientX, clientY) {
    const rect = this.#canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / this.#zoom - this.#panX;
    const y = (clientY - rect.top) / this.#zoom - this.#panY;
    return { x, y };
  }

  destroy() {
    if (this.#animationFrameId) {
      cancelAnimationFrame(this.#animationFrameId);
    }
    this.#shapeCache.clear();
    this.#imageCache.clear();
  }
}