export const VALID_ROLES = new Set(['owner', 'admin', 'editor', 'viewer']);

export const permissionsForRole = {
  viewer:  { 'can-edit': false, 'is-admin': false, 'is-owner': false },
  editor:  { 'can-edit': true,  'is-admin': false, 'is-owner': false },
  admin:   { 'can-edit': true,  'is-admin': true,  'is-owner': false },
  owner:   { 'can-edit': true,  'is-admin': true,  'is-owner': true }
};

const TEAM_NAME_INVALID_CHARS = /[.:/]/;

export function validTeamName(name) {
  if (typeof name !== 'string' || name.length > 250) return false;
  return !TEAM_NAME_INVALID_CHARS.test(name);
}