export function fontWeightApplied(shape) {
  const at = shape['applied-tokens'];
  if (!at) return false;
  return !!(at['font-weight'] || at.typography?.['font-weight']);
}