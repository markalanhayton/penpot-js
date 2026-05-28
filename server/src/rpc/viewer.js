'use strict';
/**
 * @module rpc/viewer
 * @description View-only bundle RPC command — mirrors `app.rpc.commands.viewer` from the Clojure backend.
 *
 * | Method                 | Auth  | Since |
 * |------------------------|:-----:|-------|
 * | `get-view-only-bundle` | No    | 1.17  |
 */

import { RpcError } from './dispatcher.js';
import { decode } from '../files/blob.js';

function checkFilePermissions(pool, profileId, fileId, shareId) {
  if (shareId) {
    const shareLink = pool.get('SELECT * FROM share_link WHERE id = ?', { id: shareId });
    if (!shareLink) {
      throw new RpcError('not-found', 'object-not-found', 'Share link not found');
    }
    return { type: 'share', shareLink };
  }

  if (profileId) {
    const file = pool.get(
      `SELECT f.id FROM file f
       JOIN project p ON p.id = f.project_id
       JOIN team_profile_rel tpr ON tpr.team_id = p.team_id
       WHERE f.id = ? AND f.deleted_at IS NULL AND tpr.profile_id = ?`,
      [fileId, profileId]
    );
    if (!file) {
      throw new RpcError('authorization', 'access-denied', 'No access to this file');
    }
    return { type: 'member' };
  }

  throw new RpcError('authentication', 'authentication-required', 'Authentication or share link required');
}

function obfuscateEmail(email) {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  const [domainName, ...domainParts] = domain.split('.');
  const domainSuffix = domainParts.join('.');
  const maskedLocal = local.length > 3 ? local[0] + '*'.repeat(local.length - 1) : '*'.repeat(local.length);
  const maskedDomain = domainName.length > 3 ? domainName[0] + '*'.repeat(domainName.length - 1) + '.' + domainSuffix : domain;
  return `${maskedLocal}@${domainName.length > 3 ? domainName[0] + '*'.repeat(domainName.length - 1) + '.' + domainSuffix : maskedDomain}`;
}

export default function registerViewerCommands(register, pool) {
  register('get-view-only-bundle', {
    auth: false,
    added: '1.17',
    handler: async (params, ctx) => {
      const { fileId, shareId, features } = params;

      const perms = checkFilePermissions(pool, ctx.profileId, fileId, shareId);

      const file = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', { id: fileId });
      if (!file) {
        throw new RpcError('not-found', 'object-not-found', 'File not found');
      }

      const project = pool.get('SELECT * FROM project WHERE id = ?', { id: file.project_id });
      const team = pool.get('SELECT * FROM team WHERE id = ? AND deleted_at IS NULL', { id: project.team_id });

      let data = null;
      const fileData = pool.get('SELECT * FROM file_data WHERE file_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1', [fileId, 'main']);
      if (fileData && fileData.data) {
        try {
          data = await decode(fileData.data);
        } catch {
          try { data = JSON.parse(typeof fileData.data === 'string' ? fileData.data : fileData.data.toString()); } catch { data = null; }
        }
      } else if (file.data) {
        try {
          data = typeof file.data === 'string' ? JSON.parse(file.data) : file.data;
        } catch { data = null; }
      }

      if (!data) {
        data = { pages: [], pagesIndex: {}, components: {}, media: {}, colors: [], typographies: {} };
      }

      const teamMembers = pool.query(
        `SELECT tpr.profile_id, tpr.is_owner, tpr.is_admin, tpr.can_edit, p.id as profile_id, p.fullname, p.email, p.photo_id
         FROM team_profile_rel tpr
         JOIN profile p ON p.id = tpr.profile_id
         WHERE tpr.team_id = ? AND p.deleted_at IS NULL`,
        [team.id]
      );

      const isShare = perms.type === 'share';
      const users = teamMembers.map(m => ({
        id: m.profile_id,
        fullname: m.fullname,
        email: isShare ? obfuscateEmail(m.email) : m.email,
        photoId: m.photo_id,
        isOwner: m.is_owner === '1',
        isAdmin: m.is_admin === '1',
        canEdit: m.can_edit === '1',
      }));

      const profiles = {};
      for (const u of users) profiles[u.id] = { id: u.id, fullname: u.fullname, email: u.email, photoId: u.photoId };

      const shareLinks = [];
      if (isShare && perms.shareLink) {
        shareLinks.push({
          id: perms.shareLink.id,
          fileId,
          permissions: perms.shareLink.permissions || 'view',
        });
      } else {
        const links = pool.query('SELECT * FROM share_link WHERE file_id = ?', [fileId]);
        for (const sl of links) {
          shareLinks.push({ id: sl.id, fileId, permissions: sl.permissions || 'view' });
        }
      }

      let fonts = [];
      try {
        const fontRows = pool.query('SELECT * FROM team_font_variant WHERE team_id = ? AND deleted_at IS NULL', [team.id]);
        fonts = fontRows.map(f => ({
          id: f.id,
          fontFamily: f.font_family,
          fontVariantId: f.font_variant_id,
          name: f.name,
          weight: f.weight,
          style: f.style,
        }));
      } catch (err) {
        console.warn(`[viewer] Could not load fonts for team ${team.id}: ${err.message}`);
      }

      const libraries = [];
      try {
        const libRels = pool.query('SELECT * FROM file_library_rel WHERE file_id = ?', [fileId]);
        for (const rel of libRels) {
          const libFile = pool.get('SELECT * FROM file WHERE id = ? AND deleted_at IS NULL', { id: rel.library_file_id });
          if (libFile) {
            let libData = null;
            const libFileData = pool.get('SELECT * FROM file_data WHERE file_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1', [libFile.id, 'main']);
            if (libFileData && libFileData.data) {
              try { libData = await decode(libFileData.data); } catch { try { libData = JSON.parse(typeof libFileData.data === 'string' ? libFileData.data : libFileData.data.toString()); } catch { libData = null; } }
            }
            libraries.push({
              id: libFile.id,
              name: libFile.name,
              revn: libFile.revn || 0,
              data: libData,
            });
          }
        }
      } catch (err) {
        console.warn(`[viewer] Could not load library relationships for file ${fileId}: ${err.message}`);
      }

      const fileResult = {
        id: file.id,
        name: file.name,
        revn: file.revn || 0,
        created_at: file.created_at,
        modified_at: file.modified_at,
        isShared: file.is_shared === '1',
        data,
      };

      return {
        users,
        profiles,
        fonts,
        project: { id: project.id, name: project.name, teamId: project.team_id },
        shareLinks,
        libraries,
        file: fileResult,
        team: { id: team.id, name: team.name, permissions: perms },
        permissions: perms,
      };
    },
  });
}