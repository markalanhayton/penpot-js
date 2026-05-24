import * as ctm from '../modifiers.js';

export function addModifiersToTree(modifTree, id, modifiers) {
  if (ctm.isEmpty(modifiers)) return modifTree;
  const oldModifiers = modifTree?.[id]?.modifiers;
  const newModifiers = ctm.addModifiers(oldModifiers ?? ctm.empty(), modifiers);
  if (ctm.isEmpty(newModifiers)) {
    const { [id]: _, ...rest } = modifTree;
    return rest;
  }
  return { ...modifTree, [id]: { modifiers: newModifiers } };
}

export function mergeModifTree(modifTree, otherTree) {
  let result = modifTree ?? {};
  for (const [id, { modifiers }] of Object.entries(otherTree ?? {})) {
    result = addModifiersToTree(result, id, modifiers);
  }
  return result;
}

export function applyStructureModifiersToObjects(objects, modifTree) {
  let result = { ...objects };
  for (const [id, { modifiers }] of Object.entries(modifTree)) {
    if (ctm.hasStructure(modifiers)) {
      if (result[id]) {
        result[id] = ctm.applyStructureModifiers(result[id], modifiers);
      }
      if (ctm.hasStructureChild(modifiers)) {
        const childModifiers = ctm.selectChildStructureModifiers(modifiers);
        const childIds = result[id]?.shapes ?? [];
        for (const childId of childIds) {
          if (result[childId]) {
            result[childId] = ctm.applyStructureModifiers(result[childId], childModifiers);
          }
        }
      }
    }
  }
  return result;
}