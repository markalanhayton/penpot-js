export function validProfile(p) {
  return p != null && typeof p.id === 'string';
}

export function validBasicProfile(p) {
  return p != null && typeof p.id === 'string';
}