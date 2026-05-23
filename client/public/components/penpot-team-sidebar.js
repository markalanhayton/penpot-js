import { cmd } from '../lib/rpc.js';
import { appStore } from '../lib/store.js';
import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-team-sidebar { display: flex; flex-direction: column; width: var(--penpot-sidebar-width, 260px); background: var(--penpot-surface, #2a2a2a); border-right: 1px solid var(--penpot-border, #444); flex-shrink: 0; overflow: hidden; }
    .penpot-team__sidebar-header { padding: var(--penpot-spacing-l, 16px); border-bottom: 1px solid var(--penpot-border, #444); display: flex; align-items: center; justify-content: space-between; }
    .penpot-team__sidebar-header h2 { font-size: 16px; color: var(--penpot-primary, #31efb8); margin: 0; font-weight: 600; }
    .penpot-team__sidebar-header button { background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 18px; line-height: 1; padding: 2px 4px; }
    .penpot-team__sidebar-header button:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-team__team-scroll { flex: 1; overflow-y: auto; }
    .penpot-team__team-section { padding: var(--penpot-spacing-s, 8px) 0; }
    .penpot-team__team-section-title { padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-m, 12px); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--penpot-text-disabled, #666); font-weight: 600; }
    .penpot-team__team-item { display: flex; align-items: center; gap: var(--penpot-spacing-s, 8px); padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); cursor: pointer; color: var(--penpot-text, #e6e6e6); font-size: 13px; border-radius: 0; transition: background var(--penpot-transition-fast, 0.1s ease); }
    .penpot-team__team-item:hover { background: var(--penpot-surface-high, #333); }
    .penpot-team__team-item.penpot-team__active { background: var(--penpot-primary-bg, rgba(49,239,184,0.08)); color: var(--penpot-primary, #31efb8); border-right: 2px solid var(--penpot-primary, #31efb8); }
    .penpot-team__team-avatar { width: 24px; height: 24px; border-radius: var(--penpot-radius-s, 4px); background: var(--penpot-surface-highest, #3c3c3c); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--penpot-text-dim, #999); flex-shrink: 0; }
    .penpot-team__team-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-team__team-badge { font-size: 10px; background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); color: var(--penpot-primary, #31efb8); padding: 1px 6px; border-radius: var(--penpot-radius-full, 9999px); }
    .penpot-team__sidebar-footer { border-top: 1px solid var(--penpot-border, #444); padding: var(--penpot-spacing-s, 8px); }
    .penpot-team__new-team-btn { width: 100%; padding: var(--penpot-spacing-s, 8px); background: none; border: 1px dashed var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text-dim, #999); font-size: 12px; cursor: pointer; }
    .penpot-team__new-team-btn:hover { border-color: var(--penpot-primary, #31efb8); color: var(--penpot-primary, #31efb8); }
    .penpot-team__empty-state { padding: var(--penpot-spacing-xl, 24px); text-align: center; color: var(--penpot-text-dim, #999); font-size: 13px; }
    .penpot-team__loading { padding: var(--penpot-spacing-l, 16px); text-align: center; color: var(--penpot-text-dim, #999); }
  
  </style>
  <div class="penpot-team__sidebar-header">
    <h2>Penpot</h2>
    <button id="settings-btn" title="Settings">⚙</button>
  </div>
  <div class="penpot-team__team-scroll" id="team-scroll">
    <div class="penpot-team__loading" id="team-loading">Loading teams...</div>
  </div>
  <div class="penpot-team__sidebar-footer">
    <button class="penpot-team__new-team-btn" id="new-team-btn">+ New team</button>
  </div>`;

export class PenpotTeamSidebar extends PenpotElement {
  #teams = [];
  #currentTeamId = null;
  #loading = true;

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#settings-btn').addEventListener('click', () => {
      this.emit('penpot-navigate', { route: 'settings-profile' });
    });
    this.querySelector('#new-team-btn').addEventListener('click', () => this.createTeam());
    this.loadTeams();
  }

  async loadTeams() {
    const scroll = this.querySelector('#team-scroll');
    try {
      this.#loading = true;
      const teams = await cmd('get-teams');
      this.#teams = Array.isArray(teams) ? teams : [];
      appStore.set('teams', this.#teams);

      if (this.#teams.length > 0 && !this.#currentTeamId) {
        this.#currentTeamId = this.#teams[0].id;
        appStore.set('currentTeamId', this.#currentTeamId);
      }

      this.renderTeams();
      this.emit('penpot-teams-loaded', { teams: this.#teams, currentTeamId: this.#currentTeamId });
    } catch (err) {
      scroll.innerHTML = `<div class="penpot-team__empty-state">Failed to load teams.</div>`;
      this.emit('penpot-error', { source: 'teams', error: err });
    } finally {
      this.#loading = false;
    }
  }

  renderTeams() {
    const scroll = this.querySelector('#team-scroll');
    let html = '<div class="penpot-team__team-section">';

    if (this.#teams.length === 0) {
      html += '<div class="penpot-team__empty-state">No teams yet.<br>Create a team to get started.</div>';
    } else {
      html += '<div class="penpot-team__team-section-title">Your teams</div>';
      for (const team of this.#teams) {
        const initials = (team.name || 'T').charAt(0).toUpperCase();
        const memberCount = team.memberCount != null ? team.memberCount : '';
        const isActive = team.id === this.#currentTeamId;
        html += `
          <div class="penpot-team__team-item ${isActive ? 'penpot-team__active' : ''}" data-team-id="${this.escAttr(team.id)}">
            <div class="penpot-team__team-avatar">${initials}</div>
            <span class="penpot-team__team-name">${this.escHtml(team.name || 'Team')}</span>
            ${memberCount !== '' ? `<span class="penpot-team__team-badge">${memberCount}</span>` : ''}
          </div>`;
      }
    }
    html += '</div>';
    scroll.innerHTML = html;

    scroll.querySelectorAll('.penpot-team__team-item').forEach(el => {
      el.addEventListener('click', () => {
        this.#currentTeamId = el.dataset.teamId;
        appStore.set('currentTeamId', this.#currentTeamId);
        this.renderTeams();
        this.emit('penpot-team-selected', { teamId: this.#currentTeamId });
      });
    });
  }

  async createTeam() {
    const name = prompt('Team name:');
    if (!name) return;
    try {
      const team = await cmd('create-team', { name });
      this.#teams.push(team);
      this.#currentTeamId = team.id;
      appStore.set('currentTeamId', team.id);
      appStore.set('teams', this.#teams);
      this.renderTeams();
      this.emit('penpot-team-selected', { teamId: team.id });
    } catch (err) {
      this.emit('penpot-error', { source: 'create-team', error: err });
    }
  }

  selectTeam(teamId) {
    this.#currentTeamId = teamId;
    appStore.set('currentTeamId', teamId);
    this.renderTeams();
  }

  escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  render() {}
}

customElements.define('penpot-team-sidebar', PenpotTeamSidebar);