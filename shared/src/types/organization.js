export const ORG_TO_TEAM_KEYS = ['id', 'name', 'custom-photo', 'slug', 'avatar-bg-url', 'owner-id', 'permissions'];

export function applyOrganization(team, organization) {
  const id = organization?.id;
  if (!id) {
    const { organization: _, ...rest } = team;
    return rest;
  }
  const existing = team.organization || {};
  const org = {};
  for (const k of ORG_TO_TEAM_KEYS) {
    const v = organization[k];
    if (v != null) {
      org[k] = v;
    } else {
      delete org[k];
    }
  }
  return { ...team, organization: { ...existing, ...org } };
}