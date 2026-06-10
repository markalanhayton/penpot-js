'use strict';
import { cmd } from '../lib/rpc.js';
import { appStore } from '../lib/store.js';
import { PenpotElement } from './base.js';
import './penpot-team-form.js';

const html = String.raw;

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-team-management { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--penpot-surface, #2a2a2a); }
    .penpot-tm__header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-tm__back-btn { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 16px; padding: 4px 8px; border-radius: var(--penpot-radius-s, 4px); }
    .penpot-tm__back-btn:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
    .penpot-tm__title { font-size: 14px; font-weight: 600; color: var(--penpot-text, #e6e6e6); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-tm__tabs { display: flex; border-bottom: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
    .penpot-tm__tab { flex: 1; padding: 8px 12px; font-size: 11px; text-align: center; cursor: pointer; color: var(--penpot-text-dim, #999); background: none; border: none; border-bottom: 2px solid transparent; font-family: inherit; }
    .penpot-tm__tab:hover { color: var(--penpot-text, #e6e6e6); background: var(--penpot-surface-high, #333); }
    .penpot-tm__tab.penpot-tm__active { color: var(--penpot-primary, #31efb8); border-bottom-color: var(--penpot-primary, #31efb8); }
    .penpot-tm__content { flex: 1; overflow-y: auto; }
    .penpot-tm__section { padding: 8px 16px; }
    .penpot-tm__section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--penpot-text-dim, #999); margin-bottom: 8px; }
    .penpot-tm__member-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--penpot-border, #444); }
    .penpot-tm__member-row:last-child { border-bottom: none; }
    .penpot-tm__member-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--penpot-surface-high, #3c3c3c); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--penpot-text-dim, #999); flex-shrink: 0; }
    .penpot-tm__member-info { flex: 1; min-width: 0; }
    .penpot-tm__member-name { font-size: 12px; color: var(--penpot-text, #e6e6e6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-tm__member-email { font-size: 10px; color: var(--penpot-text-dim, #999); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-tm__member-you { font-size: 9px; color: var(--penpot-primary, #31efb8); margin-left: 4px; }
    .penpot-tm__role-badge { font-size: 9px; padding: 2px 6px; border-radius: 8px; background: var(--penpot-surface-high, #333); color: var(--penpot-text-dim, #999); text-transform: capitalize; flex-shrink: 0; }
    .penpot-tm__role-badge.penpot-tm__role-owner { background: rgba(49,239,184,0.15); color: var(--penpot-primary, #31efb8); }
    .penpot-tm__role-badge.penpot-tm__role-admin { background: rgba(99,179,237,0.15); color: #63b3ed; }
    .penpot-tm__member-actions { position: relative; }
    .penpot-tm__member-menu-btn { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 14px; padding: 2px 6px; border-radius: var(--penpot-radius-s, 4px); }
    .penpot-tm__member-menu-btn:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
    .penpot-tm__dropdown { position: absolute; right: 0; top: 100%; background: var(--penpot-surface-high, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); box-shadow: 0 4px 12px rgba(0,0,0,0.4); z-index: var(--penpot-z-dropdown, 400); min-width: 140px; padding: 4px 0; }
    .penpot-tm__dropdown-item { display: block; width: 100%; padding: 6px 12px; font-size: 11px; color: var(--penpot-text, #e6e6e6); background: none; border: none; cursor: pointer; text-align: left; font-family: inherit; }
    .penpot-tm__dropdown-item:hover { background: var(--penpot-primary-bg, rgba(49,239,184,0.08)); }
    .penpot-tm__dropdown-item.penpot-tm__danger { color: var(--penpot-danger, #f44); }
    .penpot-tm__dropdown-item.penpot-tm__danger:hover { background: rgba(244,67,54,0.08); }
    .penpot-tm__invite-section { padding: 12px 16px; }
    .penpot-tm__invite-form { display: flex; flex-direction: column; gap: 8px; }
    .penpot-tm__invite-row { display: flex; gap: 8px; align-items: center; }
    .penpot-tm__invite-input { flex: 1; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: 6px 10px; font-size: 12px; outline: none; }
    .penpot-tm__invite-input:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-tm__invite-input::placeholder { color: var(--penpot-text-disabled, #666); }
    .penpot-tm__btn { padding: 6px 12px; font-size: 11px; border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-family: inherit; }
    .penpot-tm__btn-primary { background: var(--penpot-primary, #31efb8); color: var(--penpot-text-inverse, #111); border-color: var(--penpot-primary, #31efb8); font-weight: 600; }
    .penpot-tm__btn-primary:hover { opacity: 0.9; }
    .penpot-tm__btn-secondary { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
    .penpot-tm__btn-secondary:hover { background: var(--penpot-surface-high, #444); }
    .penpot-tm__btn-danger { background: none; color: var(--penpot-danger, #f44); border-color: var(--penpot-danger, #f44); }
    .penpot-tm__btn-danger:hover { background: rgba(244,67,54,0.08); }
    .penpot-tm__select { background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: 4px 8px; font-size: 11px; outline: none; }
    .penpot-tm__invite-row-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
    .penpot-tm__invite-email { flex: 1; font-size: 11px; color: var(--penpot-text, #e6e6e6); }
    .penpot-tm__invite-actions { display: flex; gap: 4px; }
    .penpot-tm__empty-state { color: var(--penpot-text-dim, #999); text-align: center; padding: 24px 12px; font-size: 11px; }
    .penpot-tm__settings-field { margin-bottom: 12px; }
    .penpot-tm__settings-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--penpot-text-dim, #999); margin-bottom: 4px; }
    .penpot-tm__settings-input { width: 100%; box-sizing: border-box; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: 8px 12px; font-size: 13px; outline: none; }
    .penpot-tm__settings-input:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-tm__danger-zone { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--penpot-border, #444); }
    .penpot-tm__danger-zone h4 { color: var(--penpot-danger, #f44); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px; }
    .penpot-tm__team-photo-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .penpot-tm__team-photo { width: 48px; height: 48px; border-radius: 50%; background: var(--penpot-surface-highest, #3c3c3c); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 600; color: var(--penpot-text-dim, #999); flex-shrink: 0; overflow: hidden; }
    .penpot-tm__modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: var(--penpot-z-modal, 600); display: flex; align-items: center; justify-content: center; }
    .penpot-tm__modal { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); box-shadow: 0 8px 32px rgba(0,0,0,0.5); padding: 24px; min-width: 360px; max-width: 480px; }
    .penpot-tm__modal h3 { margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--penpot-text, #e6e6e6); }
    .penpot-tm__modal p { font-size: 11px; color: var(--penpot-text-dim, #999); margin: 0 0 12px; line-height: 1.4; }
    .penpot-tm__modal-field { margin-bottom: 12px; }
    .penpot-tm__modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
    .penpot-tm__team-photo img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .penpot-tm__team-photo-upload { position: relative; }
    .penpot-tm__team-photo-btn { background: none; border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text-dim, #999); font-size: 10px; cursor: pointer; padding: 4px 8px; }
    .penpot-tm__team-photo-btn:hover { border-color: var(--penpot-primary, #31efb8); color: var(--penpot-primary, #31efb8); }
    .penpot-tm__stats-row { display: flex; gap: 16px; margin-bottom: 12px; }
    .penpot-tm__stat { text-align: center; }
    .penpot-tm__stat-value { font-size: 18px; font-weight: 600; color: var(--penpot-text, #e6e6e6); }
    .penpot-tm__stat-label { font-size: 10px; color: var(--penpot-text-dim, #999); text-transform: uppercase; }
  
</style>
<div class="penpot-tm__header">
  <button class="penpot-tm__back-btn" id="back-btn" title="Back">←</button>
  <span class="penpot-tm__title" id="team-title">Team</span>
</div>
<div class="penpot-tm__tabs" id="tabs">
  <button class="penpot-tm__tab penpot-tm__active" data-tab="members">Members</button>
  <button class="penpot-tm__tab" data-tab="invitations">Invitations</button>
  <button class="penpot-tm__tab" data-tab="access">Access Requests</button>
  <button class="penpot-tm__tab" data-tab="webhooks">Webhooks</button>
  <button class="penpot-tm__tab" data-tab="settings">Settings</button>
</div>
<div class="penpot-tm__content" id="content"></div>`;

const ROLES = ['owner', 'admin', 'editor', 'viewer'];

export class PenpotTeamManagement extends PenpotElement {
  _template = template;
  #teamId = null;
  #team = null;
  #profileId = null;
  #activeTab = 'members';
  #members = [];
  #invitations = [];
  #accessRequests = [];
  #webhooks = [];
  #openMenuId = null;

  constructor() {
    super();
  }

  set teamId(id) {
    this.#teamId = id;
    this.loadTeam();
  }

  set profileId(id) {
    this.#profileId = id;
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#back-btn').addEventListener('click', () => {
      this.emit('penpot-team-management-close');
    });
    this.querySelectorAll('.penpot-tm__tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.#activeTab = tab.dataset.tab;
        this.querySelectorAll('.penpot-tm__tab').forEach(t => t.classList.toggle('penpot-tm__active', t.dataset.tab === this.#activeTab));
        this.render();
      });
    });
  }

  async loadTeam() {
    if (!this.#teamId) return;
    try {
      const team = await cmd('get-team', { teamId: this.#teamId });
      this.#team = team;
      this.querySelector('#team-title').textContent = this.escHtml(team?.name || 'Team');
      await this.loadMembers();
      await this.loadInvitations();
      await this.loadAccessRequests();
      await this.loadWebhooks();
      this.render();
    } catch (err) {
      console.warn('[team-management] loadTeam error:', err.message);
      const content = this.querySelector('#content');
      if (content) content.innerHTML = '<div class="penpot-tm__empty-state">Failed to load team data.</div>';
    }
  }

  async loadMembers() {
    try {
      const members = await cmd('get-team-members', { teamId: this.#teamId });
      this.#members = Array.isArray(members) ? members : [];
    } catch (err) {
      console.warn('[team-management] loadMembers error:', err.message);
      this.#members = [];
    }
  }

  async loadInvitations() {
    try {
      const invitations = await cmd('get-team-invitations', { teamId: this.#teamId });
      this.#invitations = Array.isArray(invitations) ? invitations : [];
    } catch (err) {
      console.warn('[team-management] loadInvitations error:', err.message);
      this.#invitations = [];
    }
  }

  async loadAccessRequests() {
    try {
      const requests = await cmd('get-team-access-requests', { teamId: this.#teamId });
      this.#accessRequests = Array.isArray(requests) ? requests : [];
    } catch (err) {
      this.#accessRequests = [];
    }
  }

  async loadWebhooks() {
    try {
      const webhooks = await cmd('get-webhooks', { teamId: this.#teamId });
      this.#webhooks = Array.isArray(webhooks) ? webhooks : [];
    } catch (err) {
      this.#webhooks = [];
    }
  }

  render() {
    const content = this.querySelector('#content');
    if (!content) return;

    if (this.#activeTab === 'members') {
      content.innerHTML = this.#renderMembers();
    } else if (this.#activeTab === 'invitations') {
      content.innerHTML = this.#renderInvitations();
    } else if (this.#activeTab === 'access') {
      content.innerHTML = this.#renderAccess();
    } else if (this.#activeTab === 'webhooks') {
      content.innerHTML = this.#renderWebhooks();
    } else if (this.#activeTab === 'settings') {
      content.innerHTML = this.#renderSettings();
    }

    this.#bindEvents(content);
  }

  #renderMembers() {
    if (this.#members.length === 0) {
      return '<div class="penpot-tm__empty-state">No members found.</div>';
    }

    const profileId = this.#profileId;
    const currentMember = this.#members.find(m => m.profileId === profileId || m.memberId === profileId);
    const isOwner = currentMember?.role === 'owner';
    const isAdmin = isOwner || currentMember?.role === 'admin';

    let html = '<div class="penpot-tm__section"><div class="penpot-tm__section-title">Members (' + this.#members.length + ')</div>';

    for (const member of this.#members) {
      const name = member.name || member.fullname || member.email || 'Unknown';
      const email = member.email || '';
      const initials = name.charAt(0).toUpperCase();
      const role = member.role || 'editor';
      const isYou = member.profileId === profileId || member.memberId === profileId;
      const isSelf = isYou;
      const roleClass = role === 'owner' ? 'penpot-tm__role-owner' : (role === 'admin' ? 'penpot-tm__role-admin' : '');

      html += `<div class="penpot-tm__member-row" data-member-id="${this.escAttr(member.id || member.memberId || '')}">
        <div class="penpot-tm__member-avatar">${initials}</div>
        <div class="penpot-tm__member-info">
          <div class="penpot-tm__member-name">${this.escHtml(name)}${isYou ? '<span class="penpot-tm__member-you">(you)</span>' : ''}</div>
          ${email ? `<div class="penpot-tm__member-email">${this.escHtml(email)}</div>` : ''}
        </div>
        <span class="penpot-tm__role-badge ${roleClass}">${this.escHtml(role)}</span>
        <div class="penpot-tm__member-actions" data-member-actions="${this.escAttr(member.id || member.memberId || '')}">
          ${isAdmin && !isSelf ? '<button class="penpot-tm__member-menu-btn" data-menu-toggle="' + this.escAttr(member.id || member.memberId || '') + '">⋯</button>' : ''}
        </div>
      </div>`;
    }

    html += '</div>';

    if (isOwner) {
      html += `<div class="penpot-tm__invite-section">
        <button class="penpot-tm__btn penpot-tm__btn-primary" id="invite-members-btn">+ Invite Members</button>
      </div>`;
    }

    return html;
  }

  #renderInvitations() {
    let html = '<div class="penpot-tm__invite-section">';
    html += '<button class="penpot-tm__btn penpot-tm__btn-primary" id="new-invite-btn">+ New Invitation</button>';
    html += '</div>';

    if (this.#invitations.length === 0) {
      html += '<div class="penpot-tm__empty-state">No pending invitations.</div>';
      return html;
    }

    html += '<div class="penpot-tm__section"><div class="penpot-tm__section-title">Pending Invitations (' + this.#invitations.length + ')</div>';

    for (const inv of this.#invitations) {
      const email = inv.email || 'Unknown';
      const role = inv.role || 'editor';
      const date = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '';

      html += `<div class="penpot-tm__invite-row-item">
        <span class="penpot-tm__invite-email">${this.escHtml(email)}</span>
        <span class="penpot-tm__role-badge">${this.escHtml(role)}</span>
        <span style="font-size:9px;color:var(--penpot-text-dim,#999)">${date}</span>
        <div class="penpot-tm__invite-actions">
          <button class="penpot-tm__btn penpot-tm__btn-danger" data-delete-invitation="${this.escAttr(inv.id || '')}" style="font-size:10px;padding:2px 6px;">Revoke</button>
        </div>
      </div>`;
    }

    html += '</div>';
    return html;
  }

  #renderAccess() {
    const member = this.#members.find(m => m.profileId === this.#profileId || m.memberId === this.#profileId);
    if (!member) {
      return '<div class="penpot-tm__empty-state">You are not a member of this team.</div>';
    }
    const isAdminOrOwner = member.role === 'owner' || member.role === 'admin';

    if (!isAdminOrOwner) {
      return '<div class="penpot-tm__empty-state">Only team owners and admins can view access requests.</div>';
    }

    if (this.#accessRequests.length === 0) {
      return '<div class="penpot-tm__empty-state">No pending access requests.</div>';
    }

    let html = '<div class="penpot-tm__section">';
    html += '<div class="penpot-tm__section-title">Pending Access Requests (' + this.#accessRequests.length + ')</div>';

    for (const req of this.#accessRequests) {
      const name = req.requesterFullname || req.requesterEmail || 'Unknown';
      const email = req.requesterEmail || '';
      const created = req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '';
      const valid = req.validUntil ? new Date(req.validUntil).toLocaleDateString() : '';

      html += `<div class="penpot-tm__member-row" data-access-req-id="${this.escAttr(req.id || '')}">
        <div class="penpot-tm__member-avatar">${this.escHtml(name.charAt(0).toUpperCase())}</div>
        <div class="penpot-tm__member-info">
          <div class="penpot-tm__member-name">${this.escHtml(name)}</div>
          ${email ? `<div class="penpot-tm__member-email">${this.escHtml(email)}</div>` : ''}
        </div>
        <div style="font-size:9px;color:var(--penpot-text-dim,#999);text-align:right;flex-shrink:0;">
          ${created ? `Sent ${created}` : ''}
          ${valid ? `<br>Valid until ${valid}` : ''}
        </div>
        <div class="penpot-tm__invite-actions">
          <select class="penpot-tm__select" data-accept-role="${this.escAttr(req.id || '')}" style="font-size:10px;padding:2px 4px;" title="Role to assign">
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
            <option value="owner">Owner</option>
          </select>
          <button class="penpot-tm__btn penpot-tm__btn-primary" data-accept-req="${this.escAttr(req.id || '')}" style="font-size:10px;padding:3px 8px;">Accept</button>
          <button class="penpot-tm__btn penpot-tm__btn-danger" data-decline-req="${this.escAttr(req.id || '')}" style="font-size:10px;padding:3px 8px;">Decline</button>
        </div>
      </div>`;
    }

    html += '</div>';
    return html;
  }

  #renderWebhooks() {
    const member = this.#members.find(m => m.profileId === this.#profileId || m.memberId === this.#profileId);
    const isAdminOrOwner = member?.role === 'owner' || member?.role === 'admin';

    let html = '<div class="penpot-tm__section">';
    html += '<div class="penpot-tm__section-title">Team Webhooks</div>';
    html += '<p style="font-size:10px;color:var(--penpot-text-dim,#999);margin:0 0 12px;">Receive HTTP notifications when events happen in this team.</p>';

    if (isAdminOrOwner) {
      html += `<div class="penpot-tm__invite-form" style="margin-bottom:12px;">
        <input class="penpot-tm__invite-input" id="webhook-uri-input" type="url" placeholder="https://example.com/webhook">
        <div style="display:flex;gap:8px;align-items:center;">
          <select class="penpot-tm__select" id="webhook-mtype-input">
            <option value="application/json">JSON</option>
            <option value="application/transit+json">Transit+JSON</option>
          </select>
          <button class="penpot-tm__btn penpot-tm__btn-primary" id="add-webhook-btn">Add Webhook</button>
        </div>
      </div>`;
    }

    if (this.#webhooks.length === 0) {
      html += '<div class="penpot-tm__empty-state">No webhooks configured.</div>';
    } else {
      html += '<div class="penpot-tm__section">';
      for (const wh of this.#webhooks) {
        const status = wh.errorCode ? 'Error' : (wh.isActive ? 'Active' : 'Paused');
        const statusColor = wh.errorCode ? 'var(--penpot-danger,#f44)' : (wh.isActive ? 'var(--penpot-primary,#31efb8)' : 'var(--penpot-text-dim,#999)');
        html += `<div class="penpot-tm__member-row" data-webhook-id="${this.escAttr(wh.id || '')}">
          <div class="penpot-tm__member-info">
            <div class="penpot-tm__member-name" style="font-size:11px;word-break:break-all;">${this.escHtml(wh.uri)}</div>
            <div class="penpot-tm__member-email">${this.escHtml(wh.mtype || 'application/json')}</div>
          </div>
          <span style="font-size:9px;color:${statusColor};flex-shrink:0;">${status}${wh.errorCount ? ` (${wh.errorCount})` : ''}</span>
          <div class="penpot-tm__invite-actions">
            ${isAdminOrOwner ? `<button class="penpot-tm__btn penpot-tm__btn-secondary" data-toggle-webhook="${this.escAttr(wh.id || '')}" style="font-size:10px;padding:2px 6px;">${wh.isActive ? 'Pause' : 'Enable'}</button>` : ''}
            ${isAdminOrOwner ? `<button class="penpot-tm__btn penpot-tm__btn-danger" data-delete-webhook="${this.escAttr(wh.id || '')}" style="font-size:10px;padding:2px 6px;">Delete</button>` : ''}
          </div>
        </div>`;
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  #renderSettings() {
    const name = this.#team?.name || '';
    const photoId = this.#team?.photoId || this.#team?.photo_id || null;
    const member = this.#members.find(m => (m.profileId === this.#profileId || m.memberId === this.#profileId));
    const isOwner = member?.role === 'owner';
    const isAdmin = isOwner || member?.role === 'admin';

    let html = '<div class="penpot-tm__section">';

    html += '<div class="penpot-tm__team-photo-row">';
    if (photoId) {
      html += `<div class="penpot-tm__team-photo"><img src="/assets/by-id/${this.escAttr(photoId)}" alt="Team photo"></div>`;
    } else {
      const initials = name.charAt(0).toUpperCase() || 'T';
      html += `<div class="penpot-tm__team-photo">${initials}</div>`;
    }
    html += '<div class="penpot-tm__team-photo-upload">';
    if (isAdmin) {
      html += '<button class="penpot-tm__team-photo-btn" id="upload-photo-btn">Change photo</button>';
    }
    html += '</div></div>';

    if (this.#team) {
      const projects = this.#team.projectCount ?? this.#team.projects ?? 0;
      const members = this.#team.memberCount ?? this.#members.length ?? 0;
      html += `<div class="penpot-tm__stats-row">
        <div class="penpot-tm__stat"><div class="penpot-tm__stat-value">${members}</div><div class="penpot-tm__stat-label">Members</div></div>
        <div class="penpot-tm__stat"><div class="penpot-tm__stat-value">${projects}</div><div class="penpot-tm__stat-label">Projects</div></div>
      </div>`;
    }

    html += '<div class="penpot-tm__section-title">Team Name</div>';
    html += `<div class="penpot-tm__settings-field">
      <input class="penpot-tm__settings-input" id="team-name-input" value="${this.escAttr(name)}" ${isAdmin ? '' : 'disabled'}>
      ${isAdmin ? '<button class="penpot-tm__btn penpot-tm__btn-primary" id="save-team-name" style="margin-top:8px;">Save</button>' : ''}
    </div>`;
    html += '</div>';

    if (isAdmin) {
      // WU-T3: rich Edit Team form (description, color, logo)
      html += '<div class="penpot-tm__section">';
      html += '<div class="penpot-tm__section-title">Edit Team</div>';
      html += '<p style="font-size:10px;color:var(--penpot-text-dim,#999);margin:0 0 8px;">Update the team description, color, or logo.</p>';
      html += '<button class="penpot-tm__btn penpot-tm__btn-secondary" id="edit-team-btn">Open Edit Form</button>';
      html += '</div>';
    }

    if (isOwner) {
      const otherMembers = this.#members.filter(m => m.id !== this.#profileId);
      if (otherMembers.length > 0) {
        html += '<div class="penpot-tm__section">';
        html += '<div class="penpot-tm__section-title">Ownership</div>';
        html += '<p style="font-size:10px;color:var(--penpot-text-dim,#999);margin:0 0 8px;">Transfer ownership to another team member. You will become an Admin after the transfer.</p>';
        html += '<button class="penpot-tm__btn penpot-tm__btn-secondary" id="transfer-ownership-btn">Transfer Ownership…</button>';
        html += '</div>';
      }
    }

    if (isOwner) {
      html += '<div class="penpot-tm__danger-zone">';
      html += '<h4>Danger Zone</h4>';
      html += '<button class="penpot-tm__btn penpot-tm__btn-danger" id="delete-team-btn">Delete Team</button>';
      html += '</div>';
    }

    html += '<div style="margin-top:16px">';
    html += '<button class="penpot-tm__btn penpot-tm__btn-secondary" id="leave-team-btn">Leave Team</button>';
    html += '</div>';

    return html;
  }

  #bindEvents(content) {
    content.querySelectorAll('[data-menu-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const memberId = btn.dataset.menuToggle;
        this.#toggleMemberMenu(btn, memberId);
      });
    });

    const inviteBtn = content.querySelector('#invite-members-btn');
    if (inviteBtn) {
      inviteBtn.addEventListener('click', () => this.#showInviteDialog(content));
    }

    const newInviteBtn = content.querySelector('#new-invite-btn');
    if (newInviteBtn) {
      newInviteBtn.addEventListener('click', () => this.#showInviteDialog(content));
    }

    content.querySelectorAll('[data-delete-invitation]').forEach(btn => {
      btn.addEventListener('click', () => {
        const invId = btn.dataset.deleteInvitation;
        this.#deleteInvitation(invId);
      });
    });

    const saveNameBtn = content.querySelector('#save-team-name');
    if (saveNameBtn) {
      saveNameBtn.addEventListener('click', () => {
        const input = content.querySelector('#team-name-input');
        if (input && input.value.trim()) {
          this.#saveTeamName(input.value.trim());
        }
      });
    }

    const uploadPhotoBtn = content.querySelector('#upload-photo-btn');
    if (uploadPhotoBtn) {
      uploadPhotoBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp';
        input.addEventListener('change', async () => {
          const file = input.files?.[0];
          if (!file) return;
          try {
            uploadPhotoBtn.textContent = 'Uploading...';
            uploadPhotoBtn.disabled = true;
            await cmd('update-team-photo', { teamId: this.#teamId }, { file });
            await this.loadTeam();
          } catch (err) {
            console.warn('[team-management] photo upload error:', err.message);
          } finally {
            uploadPhotoBtn.textContent = 'Change photo';
            uploadPhotoBtn.disabled = false;
          }
        });
        input.click();
      });
    }

    const leaveBtn = content.querySelector('#leave-team-btn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => this.#leaveTeam());
    }

    const deleteBtn = content.querySelector('#delete-team-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.#deleteTeam());
    }

    content.querySelectorAll('[data-accept-req]').forEach(btn => {
      btn.addEventListener('click', () => this.#resolveAccessRequest(btn.dataset.acceptReq, true));
    });
    content.querySelectorAll('[data-decline-req]').forEach(btn => {
      btn.addEventListener('click', () => this.#resolveAccessRequest(btn.dataset.declineReq, false));
    });

    const addWebhookBtn = content.querySelector('#add-webhook-btn');
    if (addWebhookBtn) {
      addWebhookBtn.addEventListener('click', () => this.#addWebhook(content));
    }
    content.querySelectorAll('[data-toggle-webhook]').forEach(btn => {
      btn.addEventListener('click', () => this.#toggleWebhook(btn.dataset.toggleWebhook));
    });
    content.querySelectorAll('[data-delete-webhook]').forEach(btn => {
      btn.addEventListener('click', () => this.#deleteWebhook(btn.dataset.deleteWebhook));
    });

    const transferBtn = content.querySelector('#transfer-ownership-btn');
    if (transferBtn) {
      transferBtn.addEventListener('click', () => this.#showTransferOwnershipDialog());
    }

    const editTeamBtn = content.querySelector('#edit-team-btn');
    if (editTeamBtn) {
      editTeamBtn.addEventListener('click', () => this.#openEditTeamForm());
    }

    document.addEventListener('click', () => this.#closeAllMenus(), { once: false });
  }

  #toggleMemberMenu(btn, memberId) {
    this.#closeAllMenus();
    const member = this.#members.find(m => (m.id || m.memberId) === memberId);
    if (!member) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'penpot-tm__dropdown';
    dropdown.id = 'member-menu';

    for (const role of ROLES) {
      if (role === member.role) continue;
      const item = document.createElement('button');
      item.className = 'penpot-tm__dropdown-item';
      item.textContent = `Change to ${role}`;
      item.addEventListener('click', () => {
        this.#changeRole(memberId, role);
        dropdown.remove();
      });
      dropdown.appendChild(item);
    }

    const removeItem = document.createElement('button');
    removeItem.className = 'penpot-tm__dropdown-item penpot-tm__danger';
    removeItem.textContent = 'Remove from team';
    removeItem.addEventListener('click', () => {
      this.#removeMember(memberId);
      dropdown.remove();
    });
    dropdown.appendChild(removeItem);

    btn.parentElement.appendChild(dropdown);
  }

  #closeAllMenus() {
    const existing = this.querySelector('#member-menu');
    if (existing) existing.remove();
  }

  async #changeRole(memberId, newRole) {
    try {
      await cmd('update-team-member-role', { teamId: this.#teamId, memberId, role: newRole });
      await this.loadMembers();
      this.render();
    } catch (err) {
      console.warn('[team-management] changeRole error:', err.message);
    }
  }

  async #removeMember(memberId) {
    try {
      await cmd('delete-team-member', { teamId: this.#teamId, memberId });
      await this.loadMembers();
      this.render();
    } catch (err) {
      console.warn('[team-management] removeMember error:', err.message);
    }
  }

  #showInviteDialog(content) {
    const section = content.querySelector('.penpot-tm__invite-section') || content.querySelector('.penpot-tm__section');
    if (!section) return;

    const existing = content.querySelector('#invite-dialog');
    if (existing) { existing.remove(); return; }

    const dialog = document.createElement('div');
    dialog.id = 'invite-dialog';
    dialog.innerHTML = html`
      <div class="penpot-tm__invite-form" style="margin-top:12px;">
        <input class="penpot-tm__invite-input" id="invite-email-input" type="email" placeholder="Email address">
        <div style="display:flex;gap:8px;align-items:center;">
          <select class="penpot-tm__select" id="invite-role-select">
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
          <button class="penpot-tm__btn penpot-tm__btn-primary" id="send-invite-btn">Invite</button>
          <button class="penpot-tm__btn penpot-tm__btn-secondary" id="cancel-invite-btn">Cancel</button>
        </div>
      </div>`;

    section.appendChild(dialog);

    const emailInput = dialog.querySelector('#invite-email-input');
    const roleSelect = dialog.querySelector('#invite-role-select');
    const sendBtn = dialog.querySelector('#send-invite-btn');
    const cancelBtn = dialog.querySelector('#cancel-invite-btn');

    emailInput?.focus();
    emailInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendBtn?.click(); });

    sendBtn?.addEventListener('click', async () => {
      const email = emailInput?.value.trim();
      const role = roleSelect?.value || 'editor';
      if (!email) return;
      try {
        await cmd('create-team-invitations', { teamId: this.#teamId, invitations: [{ email, role }] });
        dialog.remove();
        await this.loadInvitations();
        this.render();
      } catch (err) {
        console.warn('[team-management] invite error:', err.message);
      }
    });

    cancelBtn?.addEventListener('click', () => dialog.remove());
  }

  async #deleteInvitation(invId) {
    if (!invId) return;
    try {
      await cmd('delete-team-invitation', { teamId: this.#teamId, invitationId: invId });
      await this.loadInvitations();
      this.render();
    } catch (err) {
      console.warn('[team-management] deleteInvitation error:', err.message);
    }
  }

  async #saveTeamName(name) {
    try {
      await cmd('update-team', { teamId: this.#teamId, name });
      this.#team = { ...this.#team, name };
      this.querySelector('#team-title').textContent = this.escHtml(name);
      this.emit('penpot-team-updated', { teamId: this.#teamId, name });
    } catch (err) {
      console.warn('[team-management] saveTeamName error:', err.message);
    }
  }

  async #leaveTeam() {
    const currentMember = this.#members.find(m => m.profileId === this.#profileId || m.memberId === this.#profileId);
    const isOwner = currentMember?.role === 'owner';
    const otherMembers = this.#members.filter(m => m.profileId !== this.#profileId && m.memberId !== this.#profileId);
    const otherOwners = otherMembers.filter(m => m.role === 'owner');

    if (isOwner && otherMembers.length > 0 && otherOwners.length === 0) {
      if (!confirm('You are the only owner. Please transfer ownership to another member before leaving.')) return;
      return;
    }

    let reassignTo = null;
    if (isOwner && otherOwners.length > 0) {
      reassignTo = otherOwners[0].memberId || otherOwners[0].profileId;
    }

    const msg = isOwner ? 'Are you sure you want to leave this team? Ownership will be reassigned.' : 'Are you sure you want to leave this team?';
    if (!confirm(msg)) return;

    try {
      await cmd('leave-team', { teamId: this.#teamId, reassignTo });
      this.emit('penpot-team-left', { teamId: this.#teamId });
    } catch (err) {
      console.warn('[team-management] leaveTeam error:', err.message);
    }
  }

  async #deleteTeam() {
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) return;
    if (!confirm('This will permanently delete the team and all its data. Continue?')) return;

    try {
      await cmd('delete-team', { teamId: this.#teamId });
      this.emit('penpot-team-deleted', { teamId: this.#teamId });
    } catch (err) {
      console.warn('[team-management] deleteTeam error:', err.message);
    }
  }

  async #resolveAccessRequest(requestId, accept) {
    if (!requestId) return;
    let role = 'editor';
    if (accept) {
      const select = this.querySelector(`[data-accept-role="${requestId}"]`);
      role = select?.value || 'editor';
    }
    try {
      await cmd('resolve-team-access-request', { id: requestId, accept, role });
      await this.loadAccessRequests();
      if (accept) await this.loadMembers();
      this.render();
    } catch (err) {
      console.warn('[team-management] resolveAccessRequest error:', err.message);
    }
  }

  async #addWebhook(content) {
    const uriInput = content.querySelector('#webhook-uri-input');
    const mtypeSelect = content.querySelector('#webhook-mtype-input');
    const uri = uriInput?.value.trim();
    if (!uri) return;
    try {
      await cmd('create-webhook', { teamId: this.#teamId, uri, mtype: mtypeSelect?.value || 'application/json' });
      if (uriInput) uriInput.value = '';
      await this.loadWebhooks();
      this.render();
    } catch (err) {
      console.warn('[team-management] addWebhook error:', err.message);
    }
  }

  async #toggleWebhook(webhookId) {
    if (!webhookId) return;
    const wh = this.#webhooks.find(w => w.id === webhookId);
    if (!wh) return;
    try {
      await cmd('update-webhook', { id: webhookId, isActive: !wh.isActive });
      await this.loadWebhooks();
      this.render();
    } catch (err) {
      console.warn('[team-management] toggleWebhook error:', err.message);
    }
  }

  async #deleteWebhook(webhookId) {
    if (!webhookId) return;
    if (!confirm('Delete this webhook?')) return;
    try {
      await cmd('delete-webhook', { id: webhookId });
      await this.loadWebhooks();
      this.render();
    } catch (err) {
      console.warn('[team-management] deleteWebhook error:', err.message);
    }
  }

  /**
   * Open a modal dialog that lets the current owner transfer ownership
   * to another team member. The previous owner is automatically demoted
   * to admin. The change is confirmed with the user before persisting,
   * and an audit event is pushed for traceability.
   */
  #showTransferOwnershipDialog() {
    const otherMembers = (this.#members || []).filter(m => m.id !== this.#profileId);
    if (otherMembers.length === 0) {
      console.warn('[team-management] cannot transfer ownership: no other members');
      return;
    }

    const existing = this.querySelector('#transfer-ownership-modal');
    if (existing) { existing.remove(); return; }

    const currentMember = this.#members.find(m => m.id === this.#profileId);
    const currentName = currentMember?.fullname || currentMember?.email || 'You';

    const options = otherMembers.map(m => {
      const label = m.fullname || m.email || m.id;
      return `<option value="${this.escAttr(m.id)}">${this.escHtml(label)} (${this.escHtml(m.role || 'editor')})</option>`;
    }).join('');

    const backdrop = document.createElement('div');
    backdrop.id = 'transfer-ownership-modal';
    backdrop.className = 'penpot-tm__modal-backdrop';
    backdrop.innerHTML = `
      <div class="penpot-tm__modal" role="dialog" aria-modal="true" aria-labelledby="transfer-title" tabindex="-1">
        <h3 id="transfer-title">Transfer Ownership</h3>
        <p>Choose a new owner for this team. <strong>${this.escHtml(currentName)}</strong> will become an Admin after the transfer.</p>
        <div class="penpot-tm__modal-field">
          <select class="penpot-tm__select" id="transfer-owner-select" style="width:100%;">
            ${options}
          </select>
        </div>
        <p style="font-size:10px;color:var(--penpot-text-dim,#999);">This action cannot be undone by the new owner without your cooperation.</p>
        <div class="penpot-tm__modal-actions">
          <button class="penpot-tm__btn penpot-tm__btn-secondary" id="transfer-cancel-btn">Cancel</button>
          <button class="penpot-tm__btn penpot-tm__btn-primary" id="transfer-confirm-btn">Transfer Ownership</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const select = backdrop.querySelector('#transfer-owner-select');
    const cancelBtn = backdrop.querySelector('#transfer-cancel-btn');
    const confirmBtn = backdrop.querySelector('#transfer-confirm-btn');
    const close = () => backdrop.remove();

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escHandler);
        close();
      }
    });

    cancelBtn.addEventListener('click', close);
    confirmBtn.addEventListener('click', () => this.#confirmTransferOwnership(select.value, close));
  }

  /**
   * Open the rich team form (penpot-team-form) in edit mode, pre-filled
   * with the current team's data. Reuses the form for both create and
   * edit, so it's a single, well-tested component.
   */
  #openEditTeamForm() {
    let form = document.body.querySelector('penpot-team-form');
    if (!form) {
      form = document.createElement('penpot-team-form');
      document.body.appendChild(form);
    }
    form.mode = 'edit';
    form.team = {
      ...this.#team,
      // Spread the parsed features so the form pre-fills description/color
      features: (() => {
        let f = {};
        if (this.#team?.features) {
          if (typeof this.#team.features === 'string') {
            try { f = JSON.parse(this.#team.features); } catch { f = {}; }
          } else {
            f = this.#team.features;
          }
        }
        return f;
      })(),
    };

    // One-time listener cleanup: remove any previous submit/cancel handlers
    // before adding new ones.
    if (this._editFormHandler) {
      form.removeEventListener('team-form-submit', this._editFormHandler);
      form.removeEventListener('team-form-cancel', this._editFormCancelHandler);
    }
    this._editFormHandler = async () => {
      await this.loadTeam();
      this.emit('penpot-team-updated', { teamId: this.#teamId });
    };
    this._editFormCancelHandler = () => { /* no-op */ };
    form.addEventListener('team-form-submit', this._editFormHandler, { once: true });
    form.addEventListener('team-form-cancel', this._editFormCancelHandler);
    form.show();
  }

  async #confirmTransferOwnership(newOwnerId, closeDialog) {
    if (!newOwnerId) return;
    if (!confirm('Are you sure you want to transfer ownership? You will be demoted to Admin.')) return;

    const currentMember = this.#members.find(m => m.id === this.#profileId);
    const newOwner = this.#members.find(m => m.id === newOwnerId);
    if (!currentMember || !newOwner) {
      console.warn('[team-management] transferOwnership: missing member data');
      return;
    }

    try {
      await cmd('update-team-member-role', {
        teamId: this.#teamId,
        memberId: newOwnerId,
        role: 'owner',
      });
      await cmd('update-team-member-role', {
        teamId: this.#teamId,
        memberId: this.#profileId,
        role: 'admin',
      });

      // Audit event for traceability
      try {
        await cmd('push-audit-events', {
          events: [{
            type: 'team',
            name: 'transfer-ownership',
            source: 'frontend',
            props: {
              teamId: this.#teamId,
              previousOwnerId: this.#profileId,
              newOwnerId,
              previousOwnerEmail: currentMember.email,
              newOwnerEmail: newOwner.email,
            },
          }],
        });
      } catch (auditErr) {
        console.warn('[team-management] audit push error (non-fatal):', auditErr.message);
      }

      if (typeof closeDialog === 'function') closeDialog();
      await this.loadMembers();
      this.render();
      this.emit('penpot-team-ownership-transferred', {
        teamId: this.#teamId,
        newOwnerId,
        previousOwnerId: this.#profileId,
      });
    } catch (err) {
      console.warn('[team-management] transferOwnership error:', err.message);
      if (typeof closeDialog === 'function') closeDialog();
    }
  }
}

customElements.define('penpot-team-management', PenpotTeamManagement);