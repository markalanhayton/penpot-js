const defaults = {
  'create-teams': 'any',
  'delete-teams': 'onlyOwners'
};

function canCreateTeam({ isOrgOwner, permissionValue }) {
  return isOrgOwner || permissionValue === 'any';
}

function canDeleteTeam({ isOrgOwner, permissionValue, teamPerms, allowOrgOwnerDelete }) {
  if (permissionValue === 'onlyMe') {
    return allowOrgOwnerDelete && isOrgOwner;
  }
  if (permissionValue === 'onlyOwners') {
    return !!(teamPerms?.['is-owner']);
  }
  return false;
}

const actionRules = {
  'create-team': { permissionKey: 'create-teams', checkFn: canCreateTeam },
  'delete-team': { permissionKey: 'delete-teams', checkFn: canDeleteTeam }
};

function normalizeOrgPermissions(orgPerms) {
  return { ...defaults, ...(orgPerms?.permissions || {}) };
}

function isOwner(orgPerms, profileId) {
  return profileId === orgPerms?.['owner-id'];
}

export function allowed(action, { orgPerms, profileId, teamPerms, allowOrgOwnerDelete }) {
  const rule = actionRules[action];
  if (!rule) return false;
  const permissions = normalizeOrgPermissions(orgPerms);
  const isOrgOwner = isOwner(orgPerms, profileId);
  const permissionValue = permissions[rule.permissionKey];
  return !!rule.checkFn({
    isOrgOwner,
    permissionValue,
    teamPerms,
    allowOrgOwnerDelete
  });
}