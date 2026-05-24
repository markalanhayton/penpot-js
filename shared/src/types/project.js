export function validProject(p) {
  return p != null && typeof p.id === 'string' && typeof p.name === 'string';
}