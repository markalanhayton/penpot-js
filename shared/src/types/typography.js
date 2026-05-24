import * as d from '../data.js';
import { next as uuidNext } from '../uuid.js';

export function makeTypography(opts = {}) {
  const result = {
    id: opts.id || uuidNext(),
    name: opts.name || 'Typography 1',
    path: opts.path,
    'font-id': opts['font-id'] || 'sourcesanspro',
    'font-family': opts['font-family'] || 'sourcesanspro',
    'font-variant-id': opts['font-variant-id'] || 'regular',
    'font-size': opts['font-size'] || '14',
    'font-weight': opts['font-weight'] || '480',
    'font-style': opts['font-style'] || 'normal',
    'line-height': opts['line-height'] || '1.2',
    'letter-spacing': opts['letter-spacing'] || '0',
    'text-transform': opts['text-transform'] || 'none'
  };
  return d.withoutNils(result);
}

export function usesLibraryTypographies(shape, libraryId) {
  if (shape.type !== 'text') return false;
  const content = shape.content;
  if (!content) return false;
  return nodeSeq(content, n =>
    n['typography-ref-id'] != null && n['typography-ref-file'] === libraryId
  ).length > 0;
}

export function usesLibraryTypography(shape, libraryId, typographyId) {
  if (shape.type !== 'text') return false;
  const content = shape.content;
  if (!content) return false;
  return nodeSeq(content, n =>
    n['typography-ref-id'] === typographyId && n['typography-ref-file'] === libraryId
  ).length > 0;
}

export function remapTypographies(shape, libraryId, typography) {
  return {
    ...shape,
    content: transformNodes(
      shape.content,
      n => n['typography-ref-id'] === typography.id,
      n => ({ ...n, 'typography-ref-file': libraryId })
    )
  };
}

export function removeTypographyFromNode(node) {
  const { 'typography-ref-file': _, 'typography-ref-id': __, ...rest } = node;
  return rest;
}

export function removeExternalTypographies(shape, fileId) {
  return {
    ...shape,
    content: transformNodes(
      shape.content,
      n => n['typography-ref-file'] !== fileId,
      removeTypographyFromNode
    )
  };
}

function nodeSeq(content, pred) {
  const results = [];
  if (!content) return results;
  if (pred(content)) results.push(content);
  if (content.children) {
    for (const child of content.children) {
      results.push(...nodeSeq(child, pred));
    }
  }
  return results;
}

function transformNodes(content, pred, fn) {
  if (!content) return content;
  let result = pred(content) ? fn(content) : content;
  if (result.children) {
    result = {
      ...result,
      children: result.children.map(child => transformNodes(child, pred, fn))
    };
  }
  return result;
}