'use strict';

const CLIPBOARD_MIME_TYPE = 'application/json+penpot';

export function copyShapesToClipboard(shapes) {
  const data = JSON.stringify({ type: 'penpot-shapes', shapes });
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(data).catch(() => {
      fallbackCopyToClipboard(data);
    });
  }
  return fallbackCopyToClipboard(data);
}

export function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => {
      fallbackCopyToClipboard(text);
    });
  }
  return fallbackCopyToClipboard(text);
}

function fallbackCopyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } catch {
    console.warn('[clipboard] Fallback copy failed');
  }
  document.body.removeChild(textarea);
  return Promise.resolve();
}

export async function readShapesFromClipboard() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      if (text) {
        const parsed = tryParsePenpotData(text);
        if (parsed) return parsed;
      }
    }
  } catch {
    console.warn('[clipboard] readText failed, clipboard may be empty or restricted');
  }
  return null;
}

export async function readSystemClipboard() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText();
    }
  } catch {
    console.warn('[clipboard] System clipboard read failed');
  }
  return null;
}

function tryParsePenpotData(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed.type === 'penpot-shapes' && Array.isArray(parsed.shapes)) {
      return { source: 'penpot', shapes: parsed.shapes };
    }
  } catch {}
  if (text.trim().startsWith('<svg') || text.trim().startsWith('<?xml')) {
    return { source: 'svg', text };
  }
  return null;
}

export function deepCloneShape(shape) {
  if (!shape) return null;
  const clone = { ...shape };
  if (Array.isArray(clone.fills)) clone.fills = clone.fills.map(f => ({ ...f }));
  if (Array.isArray(clone.strokes)) clone.strokes = clone.strokes.map(s => ({ ...s }));
  if (Array.isArray(clone.shadows)) clone.shadows = clone.shadows.map(s => ({ ...s }));
  if (Array.isArray(clone.children)) clone.children = clone.children.map(c => deepCloneShape(c));
  if (clone.points && Array.isArray(clone.points)) clone.points = clone.points.map(p => ({ ...p }));
  return clone;
}

export function assignNewIds(shapes) {
  const idMap = new Map();
  const result = [];
  for (const shape of shapes) {
    const newId = crypto.randomUUID();
    idMap.set(shape.id, newId);
  }
  for (const shape of shapes) {
    const newShape = { ...shape, id: idMap.get(shape.id) };
    if (newShape.parentId && idMap.has(newShape.parentId)) {
      newShape.parentId = idMap.get(newShape.parentId);
    }
    if (Array.isArray(newShape.fills)) newShape.fills = newShape.fills.map(f => ({ ...f }));
    if (Array.isArray(newShape.strokes)) newShape.strokes = newShape.strokes.map(s => ({ ...s }));
    if (Array.isArray(newShape.shadows)) newShape.shadows = newShape.shadows.map(s => ({ ...s }));
    if (Array.isArray(newShape.points)) newShape.points = newShape.points.map(p => ({ ...p }));
    result.push(newShape);
  }
  return result;
}