/**
 * @module thumbnail
 * @description Client-side thumbnail generation for Penpot pages.
 * Renders page shapes to a canvas at thumbnail dimensions and uploads
 * via the `create-file-object-thumbnail` RPC command.
 */

import { cmd } from './rpc.js';

const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 250;

export async function generatePageThumbnail(page, options = {}) {
  const width = options.width || THUMBNAIL_WIDTH;
  const height = options.height || THUMBNAIL_HEIGHT;
  const pageW = page.width || 1200;
  const pageH = page.height || 800;
  const scale = Math.min(width / pageW, height / pageH);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = options.background || '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const objects = page.objects || {};
  const topIds = page.shapes || Object.keys(objects);
  const topShapes = topIds.map(id => objects[id]).filter(Boolean);

  const offsetX = (width - pageW * scale) / 2;
  const offsetY = (height - pageH * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  for (const shape of topShapes) {
    if (shape.visible !== false) {
      drawShapeToCanvas(ctx, shape, objects);
    }
  }

  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}

export async function generateAndUploadThumbnail(fileId, pageId, page, options = {}) {
  const blob = await generatePageThumbnail(page, options);
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);

  try {
    await cmd('create-file-object-thumbnail', {
      'file-id': fileId,
      'page-id': pageId,
      'object-id': '',
      media: {
        content: base64,
        'content-type': 'image/png',
        width: options.width || THUMBNAIL_WIDTH,
        height: options.height || THUMBNAIL_HEIGHT,
      },
    });
    return true;
  } catch (err) {
    console.error('[thumbnail] Upload failed:', err);
    return false;
  }
}

export async function generateAllPageThumbnails(fileId, pages, objectsMap, options = {}) {
  const results = [];
  for (const page of pages) {
    const pageObjects = objectsMap?.[page.id] || page.objects || {};
    const topIds = page.shapes || Object.keys(pageObjects);
    const topShapes = topIds.map(id => pageObjects[id]).filter(Boolean);
    const pageData = {
      ...page,
      objects: topShapes,
      width: options.width || page.width || 1200,
      height: options.height || page.height || 800,
    };
    const success = await generateAndUploadThumbnail(fileId, page.id, pageData, options);
    results.push({ pageId: page.id, pageName: page.name, success });
  }
  return results;
}

function drawShapeToCanvas(ctx, shape, objectsMap) {
  ctx.save();
  ctx.globalAlpha = shape.opacity ?? 1;

  if (shape.rotation) {
    const cx = (shape.x || 0) + (shape.width || 0) / 2;
    const cy = (shape.y || 0) + (shape.height || 0) / 2;
    ctx.translate(cx, cy);
    ctx.rotate((shape.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  const x = shape.x || 0;
  const y = shape.y || 0;
  const w = shape.width || 1;
  const h = shape.height || 1;

  const fill = shape.fills?.[0]?.color || shape.fillStyle;
  const stroke = shape.strokes?.[0]?.color || shape.strokeStyle;

  ctx.fillStyle = fill || '#4a90d9';
  ctx.strokeStyle = stroke || 'transparent';
  ctx.lineWidth = shape.strokes?.[0]?.width || 0;

  switch (shape.type) {
    case 'rect':
    case 'frame':
      if (shape.rx || shape.r1 || shape.borderRadius) {
        roundRect(ctx, x, y, w, h, shape.rx || shape.r1 || shape.borderRadius || 0);
      } else {
        ctx.fillRect(x, y, w, h);
      }
      if (stroke !== 'transparent' && ctx.lineWidth > 0) ctx.strokeRect(x, y, w, h);
      if ((shape.type === 'frame' || shape.type === 'group' || shape.type === 'bool') && (shape.shapes || shape.objects || shape.children)) {
        const children = shape.shapes
          ? (objectsMap ? shape.shapes.map(id => objectsMap[id]).filter(Boolean) : shape.shapes)
          : (Array.isArray(shape.objects || shape.children) ? (shape.objects || shape.children) : Object.values(shape.objects || shape.children || {}));
        for (const child of children) {
          if (child && child.visible !== false) drawShapeToCanvas(ctx, child, objectsMap);
        }
      }
      break;

    case 'circle':
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2);
      ctx.fill();
      if (stroke !== 'transparent' && ctx.lineWidth > 0) ctx.stroke();
      break;

    case 'text':
      ctx.font = `${shape.fontWeight || 'normal'} ${shape.fontSize || 14}px ${shape.fontFamily || 'sans-serif'}`;
      ctx.textBaseline = 'top';
      ctx.fillText(shape.content || shape.name || 'Text', x, y);
      break;

    case 'path':
      if (shape.d || shape.pathData) {
        ctx.beginPath();
        drawPath(ctx, shape.d || shape.pathData, x, y);
        ctx.fill();
        if (stroke !== 'transparent' && ctx.lineWidth > 0) ctx.stroke();
      }
      break;

    case 'group':
    case 'bool':
      if (shape.shapes || shape.objects || shape.children) {
        const children = shape.shapes
          ? (objectsMap ? shape.shapes.map(id => objectsMap[id]).filter(Boolean) : shape.shapes)
          : (Array.isArray(shape.objects || shape.children) ? (shape.objects || shape.children) : Object.values(shape.objects || shape.children || {}));
        for (const child of children) {
          if (child && child.visible !== false) drawShapeToCanvas(ctx, child, objectsMap);
        }
      }
      break;

    case 'image':
      break;

    default:
      ctx.fillRect(x, y, w, h);
  }

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function drawPath(ctx, d, ox, oy) {
  const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
  for (const cmd of commands) {
    const type = cmd[0];
    const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number);

    switch (type) {
      case 'M': ctx.moveTo(nums[0] + ox, nums[1] + oy); break;
      case 'm': ctx.moveTo(nums[0] + ox + (ctx.lineWidth ? 0 : ox), nums[1] + oy); break;
      case 'L': ctx.lineTo(nums[0] + ox, nums[1] + oy); break;
      case 'l': ctx.lineTo(nums[0], nums[1]); break;
      case 'H': ctx.lineTo(nums[0], ctx.getCurrentPoint?.()?.y || 0); break;
      case 'h': ctx.lineTo(nums[0], 0); break;
      case 'V': ctx.lineTo(0, nums[0]); break;
      case 'v': ctx.lineTo(0, nums[0]); break;
      case 'C': ctx.bezierCurveTo(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]); break;
      case 'c': ctx.bezierCurveTo(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]); break;
      case 'Q': ctx.quadraticCurveTo(nums[0], nums[1], nums[2], nums[3]); break;
      case 'Z': case 'z': ctx.closePath(); break;
    }
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}