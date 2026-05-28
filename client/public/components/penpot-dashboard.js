'use strict';
import { cmd, setAuthToken, clearAuthToken } from '../lib/rpc.js';
import { appStore, dispatch } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { PenpotElement } from './base.js';
import { generateAndUploadThumbnail } from '../lib/thumbnail.js';
import { processFontBlobs, uploadFontVariant, groupFontsByFamily, fetchTeamFonts, deleteFontFamily, deleteFontVariant, variantDisplayName } from '../lib/fonts.js';
import './penpot-context-menu.js';
import './penpot-share-dialog.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    penpot-dashboard { display: flex; width: 100%; height: 100%; }
    .penpot-app__dashboard { display: flex; width: 100%; height: 100%; }
    .penpot-app__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .penpot-app__toolbar { display: flex; align-items: center; height: var(--penpot-topbar-height, 44px); padding: 0 var(--penpot-spacing-l, 16px); background: var(--penpot-surface, #2a2a2a); border-bottom: 1px solid var(--penpot-border, #444); gap: var(--penpot-spacing-s, 8px); flex-shrink: 0; }
    .penpot-app__toolbar-title { font-size: var(--penpot-font-size-l, 16px); font-weight: 600; color: var(--penpot-text, #e6e6e6); }
    .penpot-app__spacer { flex: 1; }
    .penpot-app__user-info { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin-right: var(--penpot-spacing-s, 8px); display: flex; align-items: center; gap: var(--penpot-spacing-xs, 4px); }
    .penpot-app__user-avatar { width: 24px; height: 24px; border-radius: var(--penpot-radius-full, 9999px); background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); color: var(--penpot-primary, #31efb8); display: flex; align-items: center; justify-content: center; font-size: var(--penpot-font-size-xs, 10px); font-weight: 600; }
    .penpot-app__btn { background: none; border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); cursor: pointer; font-size: var(--penpot-font-size-s, 11px); }
    .penpot-app__btn:hover { background: var(--penpot-surface-high, #333); border-color: var(--penpot-border-hover, #666); }
    .penpot-app__danger { color: var(--penpot-danger, #f44); border-color: var(--penpot-danger, #f44); }
    .penpot-app__btn.penpot-app__danger:hover { background: var(--penpot-danger-bg, rgba(244,67,54,0.08)); }
    .penpot-app__content { flex: 1; overflow-y: auto; padding: var(--penpot-spacing-xl, 24px); }
    .penpot-app__content-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--penpot-spacing-l, 16px); }
    .penpot-app__content-header h2 { font-size: var(--penpot-font-size-xl, 20px); font-weight: 600; color: var(--penpot-text, #e6e6e6); }
    .penpot-app__breadcrumb { display: flex; align-items: center; gap: var(--penpot-spacing-xs, 4px); font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); }
    .penpot-app__breadcrumb a { color: var(--penpot-primary, #31efb8); cursor: pointer; text-decoration: none; }
    .penpot-app__breadcrumb a:hover { text-decoration: underline; }
    .penpot-app__sep { color: var(--penpot-text-disabled, #666); }
    .penpot-app__project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--penpot-spacing-m, 12px); }
    .penpot-app__project-card { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-l, 16px); cursor: pointer; transition: border-color 0.15s ease; }
    .penpot-app__project-card:hover { border-color: var(--penpot-primary, #31efb8); }
    .penpot-app__project-card h3 { font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); margin: 0 0 var(--penpot-spacing-xs, 4px); }
    .penpot-app__project-card p { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); margin: 0; }
    .penpot-app__file-card { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-m, 12px); cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease; display: flex; flex-direction: column; gap: var(--penpot-spacing-xs, 4px); }
    .penpot-app__file-card:hover { border-color: var(--penpot-primary, #31efb8); background: var(--penpot-primary-bg-hover, rgba(49,239,184,0.05)); }
    .penpot-app__file-icon { font-size: 28px; text-align: center; color: var(--penpot-primary, #31efb8); }
    .penpot-app__file-name { font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .penpot-app__file-meta { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); text-align: center; }
    .penpot-app__file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--penpot-spacing-m, 12px); }
    .penpot-app__search-input { background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); font-size: var(--penpot-font-size-s, 11px); outline: none; width: 200px; }
    .penpot-app__search-input:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-app__font-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--penpot-spacing-m, 12px); }
    .penpot-app__font-item { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-m, 12px); display: flex; align-items: center; gap: var(--penpot-spacing-s, 8px); }
    .penpot-app__font-preview { font-size: var(--penpot-font-size-l, 16px); color: var(--penpot-text, #e6e6e6); }
    .penpot-app__font-name { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); }
    .penpot-app__library-card { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-l, 16px); }
    .penpot-app__library-card h3 { font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); margin: 0 0 var(--penpot-spacing-xs, 4px); }
    .penpot-app__library-card p { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); margin: 0; }
    .penpot-app__empty-state { color: var(--penpot-text-dim, #999); text-align: center; padding: var(--penpot-spacing-xxl, 32px); font-size: var(--penpot-font-size-m, 13px); }
    .penpot-app__error-msg { color: var(--penpot-danger, #f44); font-size: var(--penpot-font-size-s, 11px); padding: var(--penpot-spacing-s, 8px); }
    .penpot-app__loading { color: var(--penpot-text-dim, #999); text-align: center; padding: var(--penpot-spacing-xl, 24px); }
  </style>
    <div class="penpot-app__dashboard">
    <penpot-team-sidebar id="team-sidebar"></penpot-team-sidebar>
    <penpot-context-menu id="ctx-menu"></penpot-context-menu>
    <penpot-share-dialog id="share-dialog"></penpot-share-dialog>
    <div class="penpot-app__main">
      <div class="penpot-app__toolbar">
        <span class="penpot-app__toolbar-title" id="title">Dashboard</span>
        <span class="penpot-app__spacer"></span>
        <button class="penpot-app__btn" id="nav-search">Search</button>
        <button class="penpot-app__btn" id="nav-fonts">Fonts</button>
        <button class="penpot-app__btn" id="nav-libraries">Libraries</button>
        <button class="penpot-app__btn" id="nav-templates">Templates</button>
        <button class="penpot-app__btn" id="nav-deleted">Deleted</button>
        <span class="penpot-app__spacer"></span>
        <span class="penpot-app__user-info" id="user-info">
          <span class="penpot-app__user-avatar" id="user-avatar"></span>
          <span id="user-name"></span>
        </span>
        <button class="penpot-app__btn" id="settings-btn">Settings</button>
        <button class="penpot-app__btn penpot-app__danger" id="logout-btn">Sign out</button>
      </div>
      <div class="penpot-app__content" id="content">
        <div class="penpot-app__loading">Loading...</div>
      </div>
    </div>
  </div>
`;

export class PenpotDashboard extends PenpotElement {
  _template = template;
  #teams = [];
  #projects = [];
  #pinnedFileIds = new Set();
  #currentTeamId = null;
  #currentProjectId = null;
  #view = 'projects';

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();

    this.querySelector('#logout-btn').addEventListener('click', () => this.logout());
    this.querySelector('#settings-btn').addEventListener('click', () => {
      console.log('[dashboard] Settings button clicked, navigating to settings');
      try {
        window.__penpot.navigate('settings-profile');
      } catch (e) {
        console.error('[dashboard] Settings navigation error:', e);
      }
    });
    this.querySelector('#nav-search').addEventListener('click', () => { this.#view = 'search'; this.renderCurrentView(); });
    this.querySelector('#nav-fonts').addEventListener('click', () => { this.#view = 'fonts'; this.renderCurrentView(); });
    this.querySelector('#nav-libraries').addEventListener('click', () => { this.#view = 'libraries'; this.renderCurrentView(); });
    this.querySelector('#nav-templates').addEventListener('click', () => { this.#view = 'templates'; this.renderCurrentView(); });
    this.querySelector('#nav-deleted').addEventListener('click', () => { this.#view = 'deleted'; this.renderCurrentView(); });

    const sidebar = this.querySelector('#team-sidebar');
    sidebar.addEventListener('penpot-team-selected', (e) => {
      this.#currentTeamId = e.detail.teamId;
      this.#teams = appStore.get('teams') || this.#teams;
      this.loadTeamProjects();
    });
    sidebar.addEventListener('penpot-error', (e) => {
      console.error('[dashboard] sidebar error:', e.detail);
    });

    this.loadDashboard();
  }

  static get observedAttributes() { return ['view']; }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'view' && newVal) {
      this.#view = newVal;
      if (this.isConnected) this.renderCurrentView();
    }
  }

  async loadDashboard() {
    const content = this.querySelector('#content');
    try {
      const profile = await cmd('get-profile');
      this.querySelector('#user-name').textContent = profile.fullname || profile.email || 'User';
      this.querySelector('#user-avatar').textContent = (profile.fullname || profile.email || 'U').charAt(0).toUpperCase();
      appStore.set('profile', profile);

      const teams = await cmd('get-teams');
      this.#teams = Array.isArray(teams) ? teams : [];
      if (this.#teams.length > 0) {
        this.#currentTeamId = this.#teams[0].id;
        const sidebar = this.querySelector('#team-sidebar');
        if (sidebar && typeof sidebar.selectTeam === 'function') {
          sidebar.selectTeam(this.#currentTeamId);
        }
        await this.loadTeamProjects();
      } else {
        content.innerHTML = '<div class="penpot-app__empty-state">No teams found. Create a team to get started.</div>';
      }
    } catch (err) {
      console.error('[dashboard] load error:', err);
      content.innerHTML = `<div class="penpot-app__error-msg">Failed to load dashboard: ${this.escHtml(err.hint || err.message || err)}</div>`;
    }
  }

  async loadTeamProjects() {
    const content = this.querySelector('#content');
    const titleEl = this.querySelector('#title');
    const team = this.#teams.find(t => t.id === this.#currentTeamId);
    titleEl.textContent = team ? team.name : 'Dashboard';
    this.#view = 'projects';
    this.#currentProjectId = null;

    try {
      const projects = await cmd('get-projects', { teamId: this.#currentTeamId });
      this.#projects = Array.isArray(projects) ? projects : [];
      this.renderProjects();
    } catch (err) {
      console.error('[dashboard] load projects error:', err);
      content.innerHTML = '<div class="penpot-app__empty-state">No projects yet.</div>';
    }
  }

  renderCurrentView() {
    switch (this.#view) {
      case 'search': this.renderSearch(); break;
      case 'fonts': this.renderFonts(); break;
      case 'libraries': this.renderLibraries(); break;
      case 'templates': this.renderTemplates(); break;
      case 'deleted': this.renderDeleted(); break;
      default: this.renderProjects(); break;
    }
  }

  renderSearch() {
    const content = this.querySelector('#content');
    const titleEl = this.querySelector('#title');
    if (!content || !titleEl) return;
    titleEl.textContent = 'Search';

    const recent = JSON.parse(localStorage.getItem('penpot-recent-searches') || '[]');

    let html = `<div class="penpot-app__content-header"><h2>Search Files</h2></div>`;
    html += `<div style="margin-bottom:var(--penpot-spacing-l,16px);display:flex;gap:8px;align-items:center;flex-wrap:wrap;">`;
    html += `<input class="penpot-app__search-input" id="search-input" placeholder="Search by file name..." autocomplete="off" style="flex:1;min-width:200px;">`;
    html += `<select id="search-type" style="background:var(--penpot-input-bg,#333);border:1px solid var(--penpot-border,#444);border-radius:var(--penpot-radius-s,4px);color:var(--penpot-text,#e6e6e6);padding:var(--penpot-spacing-xs,4px) var(--penpot-spacing-s,8px);font-size:var(--penpot-font-size-s,11px);font-family:inherit;">`;
    html += `<option value="all">All files</option>`;
    html += `<option value="shared">Libraries only</option>`;
    html += `<option value="regular">Regular files</option>`;
    html += `</select>`;
    html += `</div>`;
    if (recent.length > 0) {
      html += `<div style="margin-bottom:var(--penpot-spacing-m,12px);"><span style="font-size:var(--penpot-font-size-xs,10px);color:var(--penpot-text-dim,#999);">Recent:</span> `;
      for (const r of recent.slice(0, 5)) {
        html += `<button class="penpot-app__btn" style="font-size:10px;padding:2px 6px;margin:2px;" data-recent-search="${this.escAttr(r)}">${this.escHtml(r)}</button>`;
      }
      html += `</div>`;
    }
    html += `<div id="search-results" class="penpot-app__file-grid"><div class="penpot-app__empty-state">Type to search files across all projects.</div></div>`;
    content.innerHTML = html;

    const searchInput = content.querySelector('#search-input');
    const searchType = content.querySelector('#search-type');
    searchInput.focus();

    const doSearch = async () => {
      const query = searchInput.value.trim();
      const typeFilter = searchType.value;
      if (!query) {
        content.querySelector('#search-results').innerHTML = '<div class="penpot-app__empty-state">Type to search files across all projects.</div>';
        return;
      }
      try {
        const results = await cmd('search-files', { searchTerm: query, teamId: this.#currentTeamId });
        let files = Array.isArray(results) ? results : [];
        if (typeFilter === 'shared') files = files.filter(f => f.isShared);
        else if (typeFilter === 'regular') files = files.filter(f => !f.isShared);
        const resultsEl = content.querySelector('#search-results');
        if (files.length === 0) {
          resultsEl.innerHTML = '<div class="penpot-app__empty-state">No files found.</div>';
          return;
        }
        resultsEl.innerHTML = files.map(f => `<div class="penpot-app__file-card" data-file-id="${this.escAttr(f.id)}">
          <div class="penpot-app__file-icon">\u270E</div>
          <div class="penpot-app__file-name">${this.escHtml(f.name || 'Untitled')}${f.isShared ? ' <span style="background:var(--penpot-primary,#31efb8);color:#000;font-size:9px;padding:1px 4px;border-radius:3px;">Library</span>' : ''}</div>
          <div class="penpot-app__file-meta">${f.modifiedAt ? new Date(f.modifiedAt).toLocaleDateString() : ''}</div>
        </div>`).join('');
        resultsEl.querySelectorAll('.penpot-app__file-card[data-file-id]').forEach(el => {
          el.addEventListener('click', () => {
            appStore.set('currentFileId', el.dataset.fileId);
            window.__penpot.navigate('workspace');
          });
        });
        const recentSearches = JSON.parse(localStorage.getItem('penpot-recent-searches') || '[]');
        if (!recentSearches.includes(query)) {
          recentSearches.unshift(query);
          localStorage.setItem('penpot-recent-searches', JSON.stringify(recentSearches.slice(0, 10)));
        }
      } catch (err) {
        console.warn('[dashboard] Search failed:', err?.message || err);
        content.querySelector('#search-results').innerHTML = '<div class="penpot-app__empty-state">Search unavailable.</div>';
      }
    };

    searchInput.addEventListener('input', doSearch);
    searchType.addEventListener('change', doSearch);
    content.querySelectorAll('[data-recent-search]').forEach(btn => {
      btn.addEventListener('click', () => {
        searchInput.value = btn.dataset.recentSearch;
        doSearch();
      });
    });
  }

  async renderFonts() {
    const content = this.querySelector('#content');
    const titleEl = this.querySelector('#title');
    if (!content || !titleEl) return;
    titleEl.textContent = 'Fonts';

    const teamId = this.#currentTeamId;

    let html = `<div class="penpot-app__content-header"><h2>Fonts</h2><button class="penpot-app__btn" id="upload-font-btn">Upload Font</button></div>`;

    const systemFonts = [
      { name: 'Arial', family: 'Arial, sans-serif' },
      { name: 'Helvetica', family: 'Helvetica, Arial, sans-serif' },
      { name: 'Times New Roman', family: "'Times New Roman', serif" },
      { name: 'Courier New', family: "'Courier New', monospace" },
      { name: 'Georgia', family: 'Georgia, serif' },
      { name: 'Verdana', family: 'Verdana, sans-serif' },
      { name: 'Trebuchet MS', family: "'Trebuchet MS', sans-serif" },
      { name: 'Impact', family: 'Impact, sans-serif' },
    ];

    html += `<h3 style="font-size:var(--penpot-font-size-s,11px);color:var(--penpot-text-dim,#999);text-transform:uppercase;margin-bottom:var(--penpot-spacing-s,8px)">System Fonts</h3>`;
    html += '<div class="penpot-app__font-list">';
    for (const font of systemFonts) {
      html += `<div class="penpot-app__font-item">
        <div class="penpot-app__font-preview" style="font-family:${font.family}">Aa Bb Cc</div>
        <div><div style="color:var(--penpot-text,#e6e6e6);font-size:var(--penpot-font-size-m,13px)">${this.escHtml(font.name)}</div>
        <div class="penpot-app__font-name">System font</div></div>
      </div>`;
    }
    html += '</div>';

    if (teamId) {
      html += `<h3 style="font-size:var(--penpot-font-size-s,11px);color:var(--penpot-text-dim,#999);text-transform:uppercase;margin-top:var(--penpot-spacing-l,16px);margin-bottom:var(--penpot-spacing-s,8px)">Team Fonts</h3>`;
      html += '<div id="team-fonts-list" class="penpot-app__font-list"><div class="penpot-app__loading">Loading fonts...</div></div>';
    }

    content.innerHTML = html;

    content.querySelector('#upload-font-btn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.ttf,.otf,.woff,.woff2';
      input.multiple = true;
      input.addEventListener('change', async () => {
        const files = input.files;
        if (!files || files.length === 0) return;
        try {
          const processed = await processFontBlobs(Array.from(files));
          const groups = groupFontsByFamily(processed);
          const uploadBtn = content.querySelector('#upload-font-btn');
          if (uploadBtn) uploadBtn.textContent = 'Uploading...';
          if (uploadBtn) uploadBtn.disabled = true;
          for (const group of groups) {
            await uploadFontVariant(teamId, group);
          }
          this.renderFonts();
        } catch (err) {
          console.error('[dashboard] font upload error:', err);
          alert('Font upload failed: ' + (err.hint || err.message || err));
          const uploadBtn2 = content.querySelector('#upload-font-btn');
          if (uploadBtn2) { uploadBtn2.textContent = 'Upload Font'; uploadBtn2.disabled = false; }
        }
      });
      input.click();
    });

    if (teamId) {
      try {
        const families = await fetchTeamFonts(teamId);
        const listEl = content.querySelector('#team-fonts-list');
        if (!listEl) return;
        if (families.length === 0) {
          listEl.innerHTML = '<div class="penpot-app__empty-state">No custom fonts uploaded yet.</div>';
        } else {
          listEl.innerHTML = families.map(f => {
            const variants = (f.variants || []).map(v => {
              const displayName = v.variantName || v.variant_name || variantDisplayName(v);
              return `<span style="font-size:10px;color:var(--penpot-text-dim,#999);margin-right:4px;">${this.escHtml(displayName)}</span>`;
            }).join('');
            return `<div class="penpot-app__font-item" data-font-id="${this.escAttr(f.fontId)}">
              <div style="flex:1">
                <div style="color:var(--penpot-text,#e6e6e6);font-size:var(--penpot-font-size-m,13px)">${this.escHtml(f.fontFamily)}</div>
                <div>${variants}</div>
              </div>
              <button class="penpot-app__btn penpot-app__danger delete-font-btn" data-font-id="${this.escAttr(f.fontId)}" style="font-size:10px;padding:2px 6px;">Delete</button>
            </div>`;
          }).join('');
          listEl.querySelectorAll('.delete-font-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              if (!confirm('Delete this font family?')) return;
              try {
                await deleteFontFamily(teamId, btn.dataset.fontId);
                this.renderFonts();
              } catch (err) {
                console.error('[dashboard] font delete error:', err);
                alert('Failed to delete font: ' + (err.hint || err.message || err));
              }
            });
          });
        }
      } catch (err) {
        const listEl = content.querySelector('#team-fonts-list');
        if (listEl) listEl.innerHTML = '<div class="penpot-app__empty-state">Could not load team fonts.</div>';
      }
    }
  }

  async renderLibraries() {
    const content = this.querySelector('#content');
    const titleEl = this.querySelector('#title');
    if (!content || !titleEl) return;
    titleEl.textContent = 'Libraries';

    let html = `<div class="penpot-app__content-header"><h2>Libraries</h2><button class="penpot-app__btn" id="connect-lib-btn">Connect Library</button></div>`;

    let libraries = [];
    try {
      const result = await cmd('get-team-libraries', { teamId: this.#currentTeamId });
      libraries = Array.isArray(result) ? result : [];
    } catch (err) {
      console.warn('[dashboard] get-team-libraries failed:', err?.message || err);
      import('../components/penpot-notification.js').then(({ warning }) => {
        warning('Could not load libraries. The feature may not be available on this server.');
      });
    }

    if (libraries.length === 0) {
      html += '<div class="penpot-app__empty-state">No shared libraries yet. Connect a library to reuse components and styles across files.</div>';
    } else {
      html += '<div class="penpot-app__project-grid">';
      for (const lib of libraries) {
        html += `<div class="penpot-app__library-card" data-lib-id="${this.escAttr(lib.id)}">
          <h3>${this.escHtml(lib.name || 'Untitled Library')}</h3>
          <p>${(lib.fileCount || 0)} components</p>
          <div style="display:flex;gap:4px;margin-top:8px;">
            <button class="penpot-app__btn browse-lib-btn" data-lib-id="${this.escAttr(lib.id)}">Browse</button>
            <button class="penpot-app__btn disconnect-lib-btn" data-lib-id="${this.escAttr(lib.id)}">Disconnect</button>
          </div>
          <div class="penpot-app__lib-content" data-lib-content="${this.escAttr(lib.id)}" style="display:none;margin-top:8px;"></div>
        </div>`;
      }
      html += '</div>';
    }

    content.innerHTML = html;

    const connectBtn = content.querySelector('#connect-lib-btn');
    if (connectBtn) {
      connectBtn.addEventListener('click', async () => {
        const input = prompt('Enter the file ID of the library to connect:');
        if (!input) return;
        try {
          const currentFileId = appStore.get('currentFileId');
          await cmd('connect-library', { fileId: currentFileId, libraryId: input.trim() });
          this.renderLibraries();
        } catch (err) {
          console.error('[dashboard] connect library error:', err);
          alert('Failed to connect library: ' + (err.hint || err.message || err));
        }
      });
    }

    content.querySelectorAll('.disconnect-lib-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const libId = btn.dataset.libId;
        try {
          const currentFileId = appStore.get('currentFileId');
          await cmd('disconnect-library', { fileId: currentFileId, libraryId: libId });
          this.renderLibraries();
        } catch (err) {
          console.error('[dashboard] disconnect library error:', err);
        }
      });
    });

    content.querySelectorAll('.browse-lib-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const libId = btn.dataset.libId;
        const contentEl = content.querySelector(`[data-lib-content="${libId}"]`);
        if (!contentEl) return;
        if (contentEl.style.display !== 'none') {
          contentEl.style.display = 'none';
          btn.textContent = 'Browse';
          return;
        }
        try {
          const fileData = await cmd('get-file', { id: libId });
          const data = fileData?.data || fileData;
          const components = data?.components ? (Array.isArray(data.components) ? data.components : Object.values(data.components)) : [];
          const colors = data?.colors ? (Array.isArray(data.colors) ? data.colors : Object.values(data.colors)) : [];
          const typographies = data?.typographies ? (Array.isArray(data.typographies) ? data.typographies : Object.values(data.typographies)) : [];
          let libHtml = '';
          if (components.length > 0) {
            libHtml += `<div style="margin-bottom:8px;"><strong style="color:var(--penpot-primary,#31efb8);font-size:11px;">Components (${components.length})</strong><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">`;
            for (const comp of components) {
              libHtml += `<span style="background:var(--penpot-surface-high,#333);padding:2px 6px;border-radius:3px;font-size:11px;">${this.escHtml(comp.name || 'Unnamed')}</span>`;
            }
            libHtml += '</div></div>';
          }
          if (colors.length > 0) {
            libHtml += `<div style="margin-bottom:8px;"><strong style="color:var(--penpot-primary,#31efb8);font-size:11px;">Colors (${colors.length})</strong><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">`;
            for (const c of colors) {
              const color = c.color || '#ccc';
              libHtml += `<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;"><span style="width:12px;height:12px;border-radius:2px;background:${this.escAttr(color)};display:inline-block;border:1px solid #555;"></span>${this.escHtml(c.name || '')}</span>`;
            }
            libHtml += '</div></div>';
          }
          if (typographies.length > 0) {
            libHtml += `<div style="margin-bottom:8px;"><strong style="color:var(--penpot-primary,#31efb8);font-size:11px;">Typographies (${typographies.length})</strong><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">`;
            for (const t of typographies) {
              libHtml += `<span style="background:var(--penpot-surface-high,#333);padding:2px 6px;border-radius:3px;font-size:11px;">${this.escHtml(t.name || 'Unnamed')}</span>`;
            }
            libHtml += '</div></div>';
          }
          if (!libHtml) libHtml = '<div style="color:var(--penpot-text-dim,#999);font-size:11px;">This library has no content yet.</div>';
          contentEl.innerHTML = libHtml;
          contentEl.style.display = 'block';
          btn.textContent = 'Hide';
        } catch (err) {
          contentEl.innerHTML = '<div style="color:var(--penpot-danger,#f44);font-size:11px;">Failed to load library content.</div>';
          contentEl.style.display = 'block';
        }
      });
    });
  }

  async renderTemplates() {
    const content = this.querySelector('#content');
    const titleEl = this.querySelector('#title');
    if (!content || !titleEl) return;
    titleEl.textContent = 'Templates';

    content.innerHTML = '<div class="penpot-app__loading">Loading templates...</div>';

    let templates = [];
    try {
      const result = await cmd('get-builtin-templates');
      templates = Array.isArray(result) ? result : [];
      templates = templates.filter(t => t.id !== 'welcome' && t.id !== 'tutorial-for-beginners');
    } catch (err) {
      console.warn('[dashboard] get-builtin-templates failed:', err?.message || err);
      import('../components/penpot-notification.js').then(({ warning }) => {
        warning('Templates are not available on this server.');
      });
      templates = [];
    }

    let html = '<div class="penpot-app__content-header"><h2>Templates</h2><p style="font-size:var(--penpot-font-size-s,11px);color:var(--penpot-text-dim,#999);">Start from a pre-built template. Choose a template to create a new file in the current project.</p></div>';
    if (templates.length === 0) {
      html += '<div class="penpot-app__empty-state">No templates available.</div>';
    } else {
    html += '<div class="penpot-app__project-grid">';
    for (const t of templates) {
      const bgColor = t.color || 'var(--penpot-surface-high,#333)';
      const iconHtml = t.icon ? `<span style="font-size:36px;line-height:1;">${t.icon}</span>` : `<span style="font-size:36px;line-height:1;color:var(--penpot-text-dim,#999);">${this.escHtml(t.name.charAt(0).toUpperCase())}</span>`;
      html += `<div class="penpot-app__project-card" data-template-id="${this.escAttr(t.id)}" style="cursor:pointer;">
        <div style="height:80px;display:flex;align-items:center;justify-content:center;background:${bgColor};border-radius:var(--penpot-radius-s,4px) var(--penpot-radius-s,4px) 0 0;">${iconHtml}</div>
        <div class="penpot-app__project-name">${this.escHtml(t.name)}</div>
        <div class="penpot-app__project-meta">Template</div>
      </div>`;
    }
    html += '</div>';
    }
    content.innerHTML = html;

    content.querySelectorAll('.penpot-app__project-card[data-template-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const templateId = el.dataset.templateId;
        const projectId = this.#currentProjectId;
        if (!projectId) { alert('Select a project first.'); return; }
        try {
          const result = await cmd('clone-template', { projectId, templateId });
          const newFileId = Array.isArray(result) ? result[0] : (result.id || result);
          this.loadProjectFiles(projectId);
        } catch (err) {
          console.error('[dashboard] clone template error:', err);
          alert('Failed to create file from template: ' + (err.hint || err.message || err));
        }
      });
    });
  }

  async renderDeleted() {
    const content = this.querySelector('#content');
    const titleEl = this.querySelector('#title');
    if (!content || !titleEl) return;
    titleEl.textContent = 'Deleted Files';

    content.innerHTML = '<div class="penpot-app__loading">Loading deleted files...</div>';

    try {
      let deletedFiles = [];
      try {
        deletedFiles = await cmd('get-deleted-files', { teamId: this.#currentTeamId });
        deletedFiles = Array.isArray(deletedFiles) ? deletedFiles : [];
      } catch (err) {
        console.warn('[dashboard] get-deleted-files failed:', err?.message || err);
        import('../components/penpot-notification.js').then(({ warning }) => {
          warning('Could not load deleted files.');
        });
        deletedFiles = [];
      }

      if (deletedFiles.length === 0) {
        content.innerHTML = '<div class="penpot-app__empty-state">No deleted files.</div>';
        return;
      }

      let html = `<div class="penpot-app__content-header"><h2>Deleted Files</h2><p style="font-size:var(--penpot-font-size-xs,10px);color:var(--penpot-text-dim,#999)">Deleted files are permanently removed after 30 days.</p></div>`;
      html += '<div class="penpot-app__file-grid">';
      for (const file of deletedFiles) {
        const modified = file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : '';
        html += `<div class="penpot-app__file-card" data-deleted-id="${this.escAttr(file.id)}">
          <div class="penpot-app__file-icon">\u270E</div>
          <div class="penpot-app__file-name">${this.escHtml(file.name || 'Untitled')}</div>
          <div class="penpot-app__file-meta">${modified}</div>
          <div style="display:flex;gap:4px;margin-top:4px;">
            <button class="penpot-app__btn restore-btn" data-deleted-id="${this.escAttr(file.id)}" style="flex:1;font-size:10px;">Restore</button>
            <button class="penpot-app__btn penpot-app__danger perm-delete-btn" data-deleted-id="${this.escAttr(file.id)}" style="flex:1;font-size:10px;">Delete Forever</button>
          </div>
        </div>`;
      }
      html += '</div>';
      content.innerHTML = html;

      content.querySelectorAll('.restore-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const fileId = btn.dataset.deletedId;
          try {
            await cmd('restore-file', { id: fileId });
            this.renderDeleted();
          } catch (err) {
            console.error('[dashboard] restore error:', err);
          }
        });
      });

      content.querySelectorAll('.perm-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const fileId = btn.dataset.deletedId;
          if (!confirm('Permanently delete this file? This cannot be undone.')) return;
          try {
            await cmd('delete-file-permanent', { id: fileId });
            this.renderDeleted();
          } catch (err) {
            console.error('[dashboard] permanent delete error:', err);
          }
        });
      });
    } catch (err) {
      console.error('[dashboard] deleted files error:', err);
      content.innerHTML = '<div class="penpot-app__empty-state">Failed to load deleted files.</div>';
    }
  }

  renderProjects() {
    const content = this.querySelector('#content');
    const titleEl = this.querySelector('#title');
    if (!content || !titleEl) return;
    let html = `<div class="penpot-app__content-header"><h2>${this.escHtml(titleEl.textContent)}</h2></div>`;
    html += '<div class="penpot-app__project-grid">';

    html += `<div class="penpot-app__project-card" id="new-project-btn" style="border-style:dashed;text-align:center;">
      <div style="font-size:28px;color:var(--penpot-primary,#31efb8)">+</div>
      <h3>New Project</h3>
      <p>Create new</p>
    </div>`;

    for (const project of this.#projects) {
      const fileCount = project.fileCount || 0;
      html += `<div class="penpot-app__project-card" data-project-id="${this.escAttr(project.id)}">
        <h3>${this.escHtml(project.name)}</h3>
        <p>${fileCount} file${fileCount !== 1 ? 's' : ''}</p>
      </div>`;
    }

    html += '</div>';
    content.innerHTML = html;

    const newProjectBtn = content.querySelector('#new-project-btn');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => this.createProject());
    }

    content.querySelectorAll('.penpot-app__project-card[data-project-id]').forEach(el => {
      el.addEventListener('click', () => {
        if (!el.id || el.id !== 'new-project-btn') {
          this.#currentProjectId = el.dataset.projectId;
          this.loadProjectFiles(el.dataset.projectId);
        }
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const projectId = el.dataset.projectId;
        const projectName = el.querySelector('h3')?.textContent || 'New Project';
        const ctxMenu = this.querySelector('#ctx-menu');
        if (!ctxMenu) return;
        ctxMenu.items = [
          { label: 'Open', action: () => { this.#currentProjectId = projectId; this.loadProjectFiles(projectId); } },
          { type: 'separator' },
          { label: 'Rename', action: () => { this.#inlineRenameProject(projectId, projectName); } },
          { label: 'Delete project', danger: true, action: () => { this.#deleteProject(projectId); } },
        ];
        ctxMenu.show(e.clientX, e.clientY);
      });
    });
  }

  async loadProjectFiles(projectId) {
    const content = this.querySelector('#content');
    this.#currentProjectId = projectId;
    const project = this.#projects.find(p => p.id === projectId);
    const teamName = this.querySelector('#title').textContent;

    try {
      const files = await cmd('get-project-files', { projectId });
      const fileList = Array.isArray(files) ? files : [];
      for (const f of fileList) {
        if (f.isPinned || f.is_pinned) this.#pinnedFileIds.add(f.id);
        else this.#pinnedFileIds.delete(f.id);
      }
      await this.#fetchThumbnails(fileList);
      this.renderFiles(fileList, project, teamName);
      this.#generateMissingThumbnails(fileList);
    } catch (err) {
      console.error('[dashboard] load files error:', err);
      content.innerHTML = '<div class="penpot-app__empty-state">Error loading files.</div>';
    }
  }

  async #fetchThumbnails(files) {
    if (!files || files.length === 0) return;
    try {
      const fileId = files[0].id;
      const thumbnailMap = await cmd('get-file-object-thumbnails', { fileId });
      if (!thumbnailMap || typeof thumbnailMap !== 'object') return;
      for (const file of files) {
        const objId = thumbnailMap[''] || thumbnailMap[file.id];
        if (objId) {
          const mediaId = typeof objId === 'string' ? objId : objId.mediaId || objId.media_id || objId;
          if (mediaId) {
            file.thumbnailUrl = `/api/rpc/command/get-file-media-object?file-id=${encodeURIComponent(file.id)}&media-id=${encodeURIComponent(mediaId)}`;
          }
        }
      }
    } catch (err) {
      console.warn('[dashboard] thumbnail fetch failed, using client-side generation:', err.hint || err.message);
    }
  }

  async #generateMissingThumbnails(files) {
    if (!files || files.length === 0) return;
    const filesWithoutThumbs = files.filter(f => !f.thumbnailUrl && !f.thumbnail);
    if (filesWithoutThumbs.length === 0) return;

    for (const file of filesWithoutThumbs.slice(0, 3)) {
      try {
        const fileData = await cmd('get-file', { id: file.id });
        if (!fileData || !fileData.data) continue;
        const pages = fileData.data.pagesIndex
          ? Object.values(fileData.data.pagesIndex)
          : fileData.data.pages || [];
        if (pages.length === 0) continue;

        const firstPage = pages[0];
        const pageData = firstPage || pages[0];
        if (!pageData) continue;

        const objects = pageData.objects || pageData.children || {};
        const topIds = pageData.shapes || Object.keys(objects);
        const topShapes = topIds.map(id => objects[id]).filter(Boolean);

        const thumbnailData = {
          ...pageData,
          objects: topShapes,
          width: pageData.width || 1200,
          height: pageData.height || 800,
        };

        const success = await generateAndUploadThumbnail(file.id, pageData.id || firstPage.id, thumbnailData, {
          width: 400,
          height: 250,
        });

        if (success) {
          file.thumbnailUrl = `/api/rpc/command/get-file-media-object?file-id=${encodeURIComponent(file.id)}&media-id=_thumb_${pageData.id || firstPage.id}`;
          const fileCards = this.querySelectorAll(`.penpot-app__file-card[data-file-id="${file.id}"]`);
          fileCards.forEach(card => {
            const thumbContainer = card.querySelector('.penpot-app__file-thumb') || card.querySelector('.penpot-app__file-icon')?.parentElement;
            if (thumbContainer) {
              thumbContainer.innerHTML = `<img src="${this.escAttr(file.thumbnailUrl)}" style="width:100%;height:100%;object-fit:cover;" alt="" loading="lazy">`;
            }
          });
        }
      } catch (err) {
        console.warn('[dashboard] thumbnail generation failed for', file.name, err);
      }
    }
  }

  renderFiles(files, project, teamName) {
    const content = this.querySelector('#content');
    const titleEl = this.querySelector('#title');
    titleEl.textContent = project ? project.name : 'Files';

    let html = `<div class="penpot-app__content-header">
      <div class="penpot-app__breadcrumb">
        <a id="back-link">${this.escHtml(teamName)}</a>
        <span class="penpot-app__sep">/</span>
        <span>${this.escHtml(project ? project.name : 'Files')}</span>
      </div>
    </div>`;

    html += '<div class="penpot-app__file-grid">';
    html += `<div class="penpot-app__file-card" id="new-file-btn" style="border-style:dashed;text-align:center;">
      <div class="penpot-app__file-icon">+</div>
      <div class="penpot-app__file-name">New file</div>
      <div class="penpot-app__file-meta">Create new</div>
    </div>`;

    const sortedFiles = [...files].sort((a, b) => {
      const aPin = this.#pinnedFileIds.has(a.id) ? 0 : 1;
      const bPin = this.#pinnedFileIds.has(b.id) ? 0 : 1;
      return aPin - bPin;
    });

    for (const file of sortedFiles) {
      const modified = file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : '';
      const thumbUrl = file.thumbnailUrl || file.thumbnail || '';
      const isShared = file.isShared || file.is_shared || false;
      const isPinned = this.#pinnedFileIds.has(file.id);
      const pinIcon = isPinned ? ' <span style="color:var(--penpot-primary,#31efb8);font-size:10px;" title="Pinned">\uD83D\uDCCC</span>' : '';
      const libBadge = isShared ? ' <span style="background:var(--penpot-primary,#31efb8);color:#000;font-size:9px;padding:1px 4px;border-radius:3px;margin-left:4px;">Library</span>' : '';
      const thumbHtml = thumbUrl
        ? `<img src="${thumbUrl}" style="width:100%;height:80px;object-fit:cover;border-radius:var(--penpot-radius-s,4px) var(--penpot-radius-s,4px) 0 0;" alt="" loading="lazy">`
        : `<div class="penpot-app__file-icon" style="height:80px;display:flex;align-items:center;justify-content:center;background:var(--penpot-surface-high,#333);border-radius:var(--penpot-radius-s,4px) var(--penpot-radius-s,4px) 0 0;">\u270E</div>`;
      html += `<div class="penpot-app__file-card" data-file-id="${this.escAttr(file.id)}" data-is-shared="${isShared ? '1' : '0'}" data-is-pinned="${isPinned ? '1' : '0'}">
        ${thumbHtml}
        <div class="penpot-app__file-name">${pinIcon}${this.escHtml(file.name || 'Untitled')}${libBadge}</div>
        <div class="penpot-app__file-meta">${modified}</div>
      </div>`;
    }

    html += '</div>';
    content.innerHTML = html;

    this.querySelector('#back-link').addEventListener('click', () => this.loadTeamProjects());
    this.querySelector('#new-file-btn').addEventListener('click', () => this.createFile());
      content.querySelectorAll('.penpot-app__file-card[data-file-id]').forEach(el => {
        el.addEventListener('click', () => {
          if (!el.dataset.deletedId) {
            appStore.set('currentFileId', el.dataset.fileId);
            appStore.set('currentProjectId', this.#currentProjectId);
            appStore.set('currentTeamId', this.#currentTeamId);
            window.__penpot.navigate('workspace');
          }
        });
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const fileId = el.dataset.fileId;
          const fileName = el.querySelector('.penpot-app__file-name')?.textContent || 'Untitled';
          const ctxMenu = this.querySelector('#ctx-menu');
          if (!ctxMenu) return;
          ctxMenu.items = [
            { label: 'Open in workspace', action: () => { appStore.set('currentFileId', fileId); appStore.set('currentProjectId', this.#currentProjectId); appStore.set('currentTeamId', this.#currentTeamId); window.__penpot.navigate('workspace'); } },
            { type: 'separator' },
            { label: 'Rename', action: () => { this.#inlineRenameFile(fileId, fileName); } },
            { label: 'Duplicate', action: () => { this.#duplicateFile(fileId); } },
            { label: 'Move to project', action: () => { this.#moveToProject(fileId); } },
            { type: 'separator' },
            { label: 'Share', action: () => { const d = this.querySelector('#share-dialog'); if (d) d.open(fileId); } },
            { label: el.dataset.isPinned === '1' ? 'Unpin' : 'Pin', action: () => { this.#togglePin(fileId, el.dataset.isPinned !== '1'); } },
            { label: el.dataset.isShared === '1' ? 'Unpublish Library' : 'Publish as Library', action: () => { this.#toggleLibrary(fileId, el.dataset.isShared !== '1'); } },
            { label: 'Delete', danger: true, action: () => { this.#deleteFile(fileId); } },
          ];
          ctxMenu.show(e.clientX, e.clientY);
        });
      });
  }

  async createFile() {
    const content = this.querySelector('#content');
    try {
      let projectId = this.#currentProjectId;
      let teamId = this.#currentTeamId;
      if (!teamId && this.#teams.length > 0) {
        teamId = this.#teams[0].id;
        this.#currentTeamId = teamId;
      }
      if (!teamId) {
        content.innerHTML = `<div class="penpot-app__error-msg">No team available. Please create a team first.</div><div style="margin-top:var(--penpot-spacing-m,12px)"><button class="penpot-app__btn penpot-app__danger" id="retry-create-file" style="padding:var(--penpot-spacing-s,8px) var(--penpot-spacing-m,12px)">Retry</button></div>`;
        content.querySelector('#retry-create-file')?.addEventListener('click', () => this.loadTeamProjects());
        return;
      }
      if (!projectId && this.#projects.length > 0) {
        projectId = this.#projects[0].id;
      } else if (!projectId) {
        const project = await cmd('create-project', { teamId, name: 'My Project' });
        projectId = project.id;
        this.#projects.push(project);
      }
      const file = await cmd('create-file', { projectId, name: 'Untitled file' });
      appStore.set('currentFileId', file.id);
      appStore.set('currentProjectId', projectId);
      window.__penpot.navigate('workspace');
    } catch (err) {
      console.error('[dashboard] create file error:', err);
      content.insertAdjacentHTML('beforeend', `<div class="penpot-app__error-msg">Failed to create file: ${this.escHtml(err.hint || err.message || err)}</div>`);
    }
  }

  async createProject() {
    const teamId = this.#currentTeamId;
    if (!teamId) return;
    try {
      const project = await cmd('create-project', { teamId, name: 'New Project' });
      this.#projects.push(project);
      this.loadTeamProjects();
    } catch (err) {
      console.error('[dashboard] create project error:', err);
    }
  }

  #inlineRenameFile(fileId, currentName) {
    const content = this.querySelector('#content');
    const fileCard = content.querySelector(`.penpot-app__file-card[data-file-id="${fileId}"]`);
    if (!fileCard) return;
    const nameEl = fileCard.querySelector('.penpot-app__file-name');
    if (!nameEl) return;
    const input = document.createElement('input');
    input.className = 'penpot-app__search-input';
    input.value = currentName;
    input.style.cssText = 'width:calc(100% - 16px);margin:0 8px;font-size:var(--penpot-font-size-m,13px);';
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const commit = async () => {
      const newName = input.value.trim() || currentName;
      try {
        await cmd('rename-file', { id: fileId, name: newName });
        this.loadProjectFiles(this.#currentProjectId);
      } catch (err) {
        console.error('[dashboard] rename error:', err);
      }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { this.loadProjectFiles(this.#currentProjectId); }
    });
    input.addEventListener('blur', commit);
  }

  async #duplicateFile(fileId) {
    try {
      const file = await cmd('get-file', { id: fileId });
      const projectId = this.#currentProjectId || appStore.get('currentProjectId');
      const newFile = await cmd('create-file', { projectId, name: `${file.name || 'Untitled'} copy` });
      appStore.set('currentFileId', newFile.id);
      appStore.set('currentProjectId', projectId);
      window.__penpot.navigate('workspace');
    } catch (err) {
      console.error('[dashboard] duplicate error:', err);
    }
  }

  async #deleteFile(fileId) {
    if (!confirm('Delete this file? This moves it to trash.')) return;
    try {
      await cmd('delete-file', { id: fileId });
      this.loadProjectFiles(this.#currentProjectId);
    } catch (err) {
      console.error('[dashboard] delete error:', err);
    }
  }

  #inlineRenameProject(projectId, currentName) {
    const content = this.querySelector('#content');
    const projectCard = content.querySelector(`.penpot-app__project-card[data-project-id="${projectId}"]`);
    if (!projectCard) return;
    const nameEl = projectCard.querySelector('h3');
    if (!nameEl) return;
    const input = document.createElement('input');
    input.className = 'penpot-app__search-input';
    input.value = currentName;
    input.style.cssText = 'font-size:var(--penpot-font-size-m,13px);';
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const commit = async () => {
      const newName = input.value.trim() || currentName;
      try {
        await cmd('rename-project', { id: projectId, name: newName });
        this.loadTeamProjects();
      } catch (err) {
        console.error('[dashboard] rename project error:', err);
      }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { this.loadTeamProjects(); }
    });
    input.addEventListener('blur', commit);
  }

  async #deleteProject(projectId) {
    if (!confirm('Delete this project and all its files? This cannot be undone.')) return;
    try {
      await cmd('delete-project', { id: projectId });
      this.#projects = this.#projects.filter(p => p.id !== projectId);
      if (this.#currentProjectId === projectId) this.#currentProjectId = null;
      this.loadTeamProjects();
    } catch (err) {
      console.error('[dashboard] delete project error:', err);
    }
  }

  async #moveToProject(fileId) {
    const teamId = this.#currentTeamId;
    if (!teamId) return;
    try {
      const projects = await cmd('get-team-projects', { teamId });
      const projectList = Array.isArray(projects) ? projects : [];
      if (projectList.length === 0) { alert('No projects available.'); return; }
      const options = projectList.map(p => `${p.id}::${p.name}`).join('\n');
      const choice = prompt(`Move file to project (enter project number):\n\n${projectList.map((p, i) => `${i + 1}. ${p.name}`).join('\n')}`);
      if (!choice) return;
      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= projectList.length) return;
      const targetProjectId = projectList[idx].id;
      await cmd('move-files', { ids: [fileId], projectId: targetProjectId });
      this.loadProjectFiles(this.#currentProjectId);
    } catch (err) {
      console.error('[dashboard] move to project error:', err);
      alert('Failed to move file: ' + (err.hint || err.message || err));
    }
  }

  async #toggleLibrary(fileId, publish) {
    try {
      await cmd('set-file-shared', { id: fileId, isShared: publish });
      this.loadProjectFiles(this.#currentProjectId);
    } catch (err) {
      console.error('[dashboard] toggle library error:', err);
      alert('Failed to ' + (publish ? 'publish' : 'unpublish') + ' library: ' + (err.hint || err.message || err));
    }
  }

  async #togglePin(fileId, pin) {
    try {
      await cmd('update-file-pin', { fileId, projectId: this.#currentProjectId, isPinned: pin });
      if (pin) this.#pinnedFileIds.add(fileId);
      else this.#pinnedFileIds.delete(fileId);
      this.loadProjectFiles(this.#currentProjectId);
    } catch (err) {
      console.error('[dashboard] toggle pin error:', err);
      alert('Failed to ' + (pin ? 'pin' : 'unpin') + ' file: ' + (err.hint || err.message || err));
    }
  }

  async logout() {
    try { await cmd('logout'); } catch (err) { console.warn('[dashboard] Logout RPC failed (continuing locally):', err?.message || err); }
    clearAuthToken();
    document.cookie = 'auth-token=; path=/; max-age=0';
    appStore.reset({ profile: null, teams: [], currentTeamId: null, currentProjectId: null, currentFileId: null });
    window.__penpot.navigate('login');
  }

  escHtml(str) {
    const el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
  }

  escAttr(s) { return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
}

customElements.define('penpot-dashboard', PenpotDashboard);