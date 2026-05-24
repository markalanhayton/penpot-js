import * as d from '../data.js';
import * as dt from '../time.js';

export function typographiesSeq(fileData) {
  return Object.values(fileData.typographies ?? {});
}

function touch(typography) {
  return { ...typography, modifiedAt: dt.now() };
}

export function addTypography(fileData, typography) {
  return {
    ...fileData,
    typographies: { ...(fileData.typographies ?? {}), [typography.id]: touch(typography) },
  };
}

export function getTypography(fileData, typographyId) {
  return fileData.typographies?.[typographyId];
}

export function getRefTypography(libraryData, typography) {
  if (typography['typography-ref-file'] === libraryData.id) {
    return getTypography(libraryData, typography['typography-ref-id']);
  }
  return undefined;
}

export function setTypography(fileData, typography) {
  const current = fileData.typographies?.[typography.id];
  if (current === undefined) return fileData;
  return {
    ...fileData,
    typographies: { ...(fileData.typographies ?? {}), [typography.id]: touch(typography) },
  };
}

export function updateTypography(fileData, typographyId, f, ...args) {
  return d.updateInWhen(fileData, ['typographies', typographyId], (t) => touch(f(t, ...args)));
}

export function deleteTypography(fileData, typographyId) {
  const { [typographyId]: _, ...rest } = fileData.typographies ?? {};
  return { ...fileData, typographies: rest };
}

export function usedTypographiesChangedSince(shape, library, sinceDate) {
  const results = [];
  const content = shape.content;
  if (!content) return results;

  const nodes = nodeSeq(content);
  for (const node of nodes) {
    const refTypo = getRefTypography(library.data, node);
    if (refTypo && refTypo.modifiedAt && refTypo.modifiedAt >= sinceDate) {
      results.push({ shapeId: shape.id, assetId: refTypo.id, assetType: 'typography' });
    }
  }
  return results;
}

function nodeSeq(root) {
  const result = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node && typeof node === 'object') {
      result.push(node);
      if (Array.isArray(node.children)) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }
  }
  return result;
}