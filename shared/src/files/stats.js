import * as uuid from '../uuid.js';

export const emptyShapeCounts = { total: 0, byType: {} };

function incType(byType, shapeType) {
  if (shapeType == null) return byType;
  return { ...byType, [shapeType]: (byType[shapeType] ?? 0) + 1 };
}

export function countShapesByType(objects) {
  if (!objects || Object.keys(objects).length === 0) return emptyShapeCounts;
  let total = 0;
  let byType = {};
  for (const [id, shape] of Object.entries(objects)) {
    if (id === uuid.zero) continue;
    total++;
    byType = incType(byType, shape.type);
  }
  return { total, byType };
}

function mergeShapeCounts(a, b) {
  return {
    total: a.total + b.total,
    byType: { ...a.byType, ...Object.fromEntries(Object.entries(b.byType).map(([k, v]) => [k, (a.byType[k] ?? 0) + v])) },
  };
}

function aggregateShapeCounts(pagesIndex) {
  let result = { ...emptyShapeCounts };
  for (const page of Object.values(pagesIndex)) {
    result = mergeShapeCounts(result, countShapesByType(page.objects));
  }
  return result;
}

export function calcFileStats(fdata) {
  const pagesIndex = fdata.pagesIndex ?? fdata['pages-index'] ?? {};
  const components = fdata.components ?? {};
  const deletedComponents = fdata.deletedComponents ?? fdata['deleted-components'] ?? {};
  const colors = fdata.colors ?? {};
  const typographies = fdata.typographies ?? {};
  return {
    pageCount: Object.keys(pagesIndex).length,
    shapeCounts: aggregateShapeCounts(pagesIndex),
    componentCount: Object.keys(components).length,
    deletedComponentCount: Object.keys(deletedComponents).length,
    colorCount: Object.keys(colors).length,
    typographyCount: Object.keys(typographies).length,
  };
}