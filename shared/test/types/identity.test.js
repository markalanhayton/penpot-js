import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allowed } from '@penpot/shared/types/nitrate-permissions';
import { VALID_ROLES, permissionsForRole, validTeamName } from '@penpot/shared/types/team';
import { validProfile } from '@penpot/shared/types/profile';
import { validProject } from '@penpot/shared/types/project';
import { ORG_TO_TEAM_KEYS, applyOrganization } from '@penpot/shared/types/organization';
import { validFontFamily } from '@penpot/shared/types/font';
import { validPluginData, validRegistryEntry } from '@penpot/shared/types/plugins';
import { COLUMN_TYPES, GRID_TYPES, defaultGridParams } from '@penpot/shared/types/grid';
import { makeTypography } from '@penpot/shared/types/typography';
import { ROOT_ID, makeEmptyPage, getFrameFlow, isPageEmpty } from '@penpot/shared/types/page';

describe('types identity modules', () => {
  it('allowed - create team any', () => {
    assert.ok(allowed('create-team', {
      orgPerms: { permissions: { 'create-teams': 'any' } },
      profileId: 'user1'
    }));
  });

  it('allowed - create team only owner', () => {
    assert.ok(!allowed('create-team', {
      orgPerms: { permissions: { 'create-teams': 'onlyMe' }, 'owner-id': 'owner1' },
      profileId: 'user1'
    }));
  });

  it('allowed - delete team onlyOwners', () => {
    assert.ok(allowed('delete-team', {
      orgPerms: { permissions: { 'delete-teams': 'onlyOwners' } },
      profileId: 'user1',
      teamPerms: { 'is-owner': true }
    }));
  });

  it('allowed - unknown action', () => {
    assert.ok(!allowed('unknown', { orgPerms: {}, profileId: 'x' }));
  });

  it('VALID_ROLES', () => {
    assert.ok(VALID_ROLES.has('owner'));
    assert.ok(VALID_ROLES.has('viewer'));
    assert.equal(VALID_ROLES.size, 4);
  });

  it('permissionsForRole', () => {
    assert.ok(permissionsForRole.owner['can-edit']);
    assert.ok(permissionsForRole.owner['is-owner']);
    assert.ok(!permissionsForRole.viewer['can-edit']);
  });

  it('validTeamName', () => {
    assert.ok(validTeamName('My Team'));
    assert.ok(!validTeamName('Bad.Name'));
    assert.ok(!validTeamName('Bad:Name'));
    assert.ok(!validTeamName('Bad/Name'));
    assert.ok(!validTeamName('A'.repeat(251)));
  });

  it('validProfile', () => {
    assert.ok(validProfile({ id: 'abc' }));
    assert.ok(!validProfile(null));
  });

  it('validProject', () => {
    assert.ok(validProject({ id: 'abc', name: 'Test' }));
    assert.ok(!validProject({ id: 'abc' }));
  });

  it('ORG_TO_TEAM_KEYS', () => {
    assert.ok(ORG_TO_TEAM_KEYS.includes('id'));
    assert.ok(ORG_TO_TEAM_KEYS.includes('slug'));
  });

  it('applyOrganization with org', () => {
    const team = { id: 't1' };
    const result = applyOrganization(team, { id: 'o1', name: 'Org', slug: 'org' });
    assert.ok(result.organization);
    assert.equal(result.organization.id, 'o1');
  });

  it('applyOrganization without org', () => {
    const team = { id: 't1', organization: { id: 'o1' } };
    const result = applyOrganization(team, null);
    assert.ok(!result.organization);
  });

  it('validFontFamily', () => {
    assert.ok(validFontFamily('Source Sans Pro'));
    assert.ok(validFontFamily('Roboto'));
    assert.ok(!validFontFamily(''));
    assert.ok(!validFontFamily('A'.repeat(251)));
  });

  it('validPluginData', () => {
    assert.ok(validPluginData(null));
    assert.ok(validPluginData({ myplugin: { key: 'val' } }));
    assert.ok(!validPluginData('invalid'));
  });

  it('validRegistryEntry', () => {
    assert.ok(validRegistryEntry({ 'plugin-id': 'p1', name: 'P', host: 'h', code: 'c' }));
    assert.ok(!validRegistryEntry({ name: 'P' }));
  });

  it('COLUMN_TYPES', () => {
    assert.ok(COLUMN_TYPES.has('stretch'));
    assert.ok(COLUMN_TYPES.has('left'));
    assert.equal(COLUMN_TYPES.size, 4);
  });

  it('GRID_TYPES', () => {
    assert.ok(GRID_TYPES.has('column'));
    assert.ok(GRID_TYPES.has('square'));
  });

  it('defaultGridParams', () => {
    assert.equal(defaultGridParams.square.size, 16);
    assert.equal(defaultGridParams.column.gutter, 8);
  });

  it('makeTypography with defaults', () => {
    const t = makeTypography();
    assert.equal(t.name, 'Typography 1');
    assert.equal(t['font-size'], '14');
    assert.ok(t.id);
  });

  it('makeTypography with overrides', () => {
    const t = makeTypography({ name: 'Heading', 'font-size': '24' });
    assert.equal(t.name, 'Heading');
    assert.equal(t['font-size'], '24');
  });

  it('ROOT_ID is uuid zero', () => {
    assert.equal(ROOT_ID, '00000000-0000-0000-0000-000000000000');
  });

  it('makeEmptyPage', () => {
    const p = makeEmptyPage({ name: 'Test' });
    assert.equal(p.name, 'Test');
    assert.ok(p.objects);
    assert.ok(p.objects[ROOT_ID]);
  });

  it('isPageEmpty', () => {
    assert.ok(isPageEmpty({ objects: { [ROOT_ID]: {} } }));
    assert.ok(!isPageEmpty({ objects: { [ROOT_ID]: {}, other: {} } }));
  });

  it('getFrameFlow', () => {
    const flows = { f1: { id: 'f1', 'starting-frame': 'frame1', name: 'Flow' } };
    assert.ok(getFrameFlow(flows, 'frame1'));
    assert.equal(getFrameFlow(flows, 'frame2'), undefined);
  });
});