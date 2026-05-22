import { cmd, setAuthToken, clearAuthToken } from '../lib/rpc.js';
import { appStore, dispatch } from '../lib/store.js';
import { t } from '../lib/i18n.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    penpot-dashboard { display: flex; width: 100%; height: 100%; }
    .dashboard { display: flex; width: 100%; height: 100%; }
    .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .toolbar { display: flex; align-items: center; height: var(--penpot-topbar-height, 44px); padding: 0 var(--penpot-spacing-l, 16px); background: var(--penpot-surface, #2a2a2a); border-bottom: 1px solid var(--penpot-border, #444); gap: var(--penpot-spacing-s, 8px); flex-shrink: 0; }
    .toolbar-title { font-size: var(--penpot-font-size-l, 16px); font-weight: 600; color: var(--penpot-text, #e6e6e6); }
    .toolbar .spacer { flex: 1; }
    .toolbar .user-info { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin-right: var(--penpot-spacing-s, 8px); display: flex; align-items: center; gap: var(--penpot-spacing-xs, 4px); }
    .toolbar .user-avatar { width: 24px; height: 24px; border-radius: var(--penpot-radius-full, 9999px); background: var(--penpot-primary-bg, rgba(49,239,184,0.15)); color: var(--penpot-primary, #31efb8); display: flex; align-items: center; justify-content: center; font-size: var(--penpot-font-size-xs, 10px); font-weight: 600; }
    .toolbar .btn { background: none; border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); cursor: pointer; font-size: var(--penpot-font-size-s, 11px); }
    .toolbar .btn:hover { background: var(--penpot-surface-high, #333); border-color: var(--penpot-border-hover, #666); }
    .toolbar .btn.danger { color: var(--penpot-danger, #f44); border-color: var(--penpot-danger, #f44); }
    .toolbar .btn.danger:hover { background: var(--penpot-danger-bg, rgba(244,67,54,0.08)); }
    .content { flex: 1; overflow-y: auto; padding: var(--penpot-spacing-xl, 24px); }
    .content-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--penpot-spacing-l, 16px); }
    .content-header h2 { font-size: var(--penpot-font-size-xl, 20px); font-weight: 600; color: var(--penpot-text, #e6e6e6); }
    .content-header .breadcrumb { display: flex; align-items: center; gap: var(--penpot-spacing-xs, 4px); font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); }
    .content-header .breadcrumb a { color: var(--penpot-primary, #31efb8); cursor: pointer; text-decoration: none; }
    .content-header .breadcrumb a:hover { text-decoration: underline; }
    .content-header .breadcrumb .sep { color: var(--penpot-text-disabled, #666); }
    .project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--penpot-spacing-m, 12px); }
    .project-card { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-l, 16px); cursor: pointer; transition: border-color 0.15s ease; }
    .project-card:hover { border-color: var(--penpot-primary, #31efb8); }
    .project-card h3 { font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); margin: 0 0 var(--penpot-spacing-xs, 4px); }
    .project-card p { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); margin: 0; }
    .new-file-card { border-style: dashed; text-align: center; }
    .new-file-card:hover { background: var(--penpot-primary-bg, rgba(49,239,184,0.05)); }
    .new-file-card .icon { font-size: 28px; color: var(--penpot-primary, #31efb8); }
    .new-file-card h3 { color: var(--penpot-primary, #31efb8); }
    .file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--penpot-spacing-m, 12px); }
    .file-card { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-m, 12px); cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease; display: flex; flex-direction: column; gap: var(--penpot-spacing-xs, 4px); }
    .file-card:hover { border-color: var(--penpot-primary, #31efb8); background: var(--penpot-primary-bg-hover, rgba(49,239,184,0.05)); }
    .file-card .file-icon { font-size: 28px; text-align: center; color: var(--penpot-primary, #31efb8); }
    .file-card .file-name { font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-card .file-meta { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); text-align: center; }
    .search-input { background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: var(--penpot-spacing-xs, 4px) var(--penpot-spacing-s, 8px); font-size: var(--penpot-font-size-s, 11px); outline: none; width: 200px; }
    .search-input:focus { border-color: var(--penpot-primary, #31efb8); }
    .font-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--penpot-spacing-m, 12px); }
    .font-item { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-m, 12px); display: flex; align-items: center; gap: var(--penpot-spacing-s, 8px); }
    .font-item .font-preview { font-size: var(--penpot-font-size-l, 16px); color: var(--penpot-text, #e6e6e6); }
    .font-item .font-name { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); }
    .library-card { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-l, 16px); }
    .library-card h3 { font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); margin: 0 0 var(--penpot-spacing-xs, 4px); }
    .library-card p { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); margin: 0; }
    .empty-state { color: var(--penpot-text-dim, #999); text-align: center; padding: var(--penpot-spacing-xxl, 32px); font-size: var(--penpot-font-size-m, 13px); }
    .error-msg { color: var(--penpot-danger, #f44); font-size: var(--penpot-font-size-s, 11px); padding: var(--penpot-spacing-s, 8px); }
    .loading { color: var(--penpot-text-dim, #999); text-align: center; padding: var(--penpot-spacing-xl, 24px); }
  </style>
  <div class="penpot-app__dashboard">
    <penpot-team-sidebar id="team-sidebar"></penpot-team-sidebar>
    <div class="penpot-app__main">
      <div class="penpot-app__toolbar">
        <span class="penpot-app__toolbar-title" id="title">Dashboard</span>
        <span class="penpot-app__spacer"></span>
        <button class="penpot-app__btn" id="nav-search">Search</button>
        <button class="penpot-app__btn" id="nav-fonts">Fonts</button>
        <button class="penpot-app__btn" id="nav-libraries">Libraries</button>
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

export class PenpotDashboard extends HTMLElement {
  #rendered = false;
  #teams = [];
  #projects = [];
  #currentTeamId = null;
  #currentProjectId = null;
  #view = 'projects';

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.#rendered) return;
    this.#rendered = true;
    this.appendChild(template.content.cloneNode(true));

    this.querySelector('#logout-btn').addEventListener('click', () => this.logout());
    this.querySelector('#settings-btn').addEventListener('click', () => window.__penpot.navigate('settings-profile'));
    this.querySelector('#nav-search').addEventListener('click', () => { this.#view = 'search'; this.renderCurrentView(); });
    this.querySelector('#nav-fonts').addEventListener('click', () => { this.#view = 'fonts'; this.renderCurrentView(); });
    this.querySelector('#nav-libraries').addEventListener('click', () => { this.#view = 'libraries'; this.renderCurrentView(); });

    const sidebar = this.querySelector('#team-sidebar');
    sidebar.addEventListener('penpot-team-selected', (e) => {
      this.#currentTeamId = e.detail.teamId;
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
      this.renderCurrentView();
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
      default: this.renderProjects(); break;
    }
  }

  renderSearch() {
    const content = this.querySelector('#content');
    const titleEl = this.querySelector('#title');
    titleEl.textContent = 'Search';

    let html = `<div class="penpot-app__content-header"><h2>Search Files</h2></div>`;
    html += `<div style="margin-bottom:var(--penpot-spacing-l,16px)"><input class="penpot-app__search-input" id="search-input" placeholder="Search by file name..." autocomplete="off"></div>`;
    html += `<div id="search-results" class="penpot-app__file-grid"><div class="penpot-app__empty-state">Type to search files across all projects.</div></div>`;
    content.innerHTML = html;

    const searchInput = content.querySelector('#search-input');
    searchInput.focus();
    searchInput.addEventListener('input', async () => {
      const query = searchInput.value.trim().toLowerCase();
      if (!query) {
        content.querySelector('#search-results').innerHTML = '<div class="penpot-app__empty-state">Type to search files across all projects.</div>';
        return;
      }
      try {
        const results = await cmd('search-files', { query, teamId: this.#currentTeamId });
        const files = Array.isArray(results) ? results : [];
        const resultsEl = content.querySelector('#search-results');
        if (files.length === 0) {
          resultsEl.innerHTML = '<div class="penpot-app__empty-state">No files found.</div>';
          return;
        }
        resultsEl.innerHTML = files.map(f => `<div class="penpot-app__file-card" data-file-id="${this.escAttr(f.id)}">
          <div class="penpot-app__file-icon">\u270E</div>
          <div class="penpot-app__file-name">${this.escHtml(f.name || 'Untitled')}</div>
          <div class="penpot-app__file-meta">${f.modifiedAt ? new Date(f.modifiedAt).toLocaleDateString() : ''}</div>
        </div>`).join('');
        resultsEl.querySelectorAll('.file-card[data-file-id]').forEach(el => {
          el.addEventListener('click', () => {
            appStore.set('currentFileId', el.dataset.fileId);
            window.__penpot.navigate('workspace');
          });
        });
      } catch {
        content.querySelector('#search-results').innerHTML = '<div class="penpot-app__empty-state">Search unavailable.</div>';
      }
    });
  }

  renderFonts() {
    const content = this.querySelector('#content');
    const titleEl = this.querySelector('#title');
    titleEl.textContent = 'Fonts';

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

    content.innerHTML = html;

    content.querySelector('#upload-font-btn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.ttf,.otf,.woff,.woff2';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const formData = new FormData();
          formData.append('font', file);
          await cmd('create-font-variant', { name: file.name, family: file.name.replace(/\.[^.]+$/, '') });
          this.renderFonts();
        } catch (err) {
          console.error('[dashboard] font upload error:', err);
        }
      });
      input.click();
    });
  }

  renderLibraries() {
    const content = this.querySelector('#content');
    const titleEl = this.querySelector('#title');
    titleEl.textContent = 'Libraries';

    let html = `<div class="penpot-app__content-header"><h2>Libraries</h2></div>`;
    html += '<div class="penpot-app__empty-state">Shared libraries allow you to reuse components and styles across files. Connect a library to a file from the workspace.</div>';

    content.innerHTML = html;
  }

  renderProjects() {
    const content = this.querySelector('#content');
    let html = `<div class="penpot-app__content-header"><h2>${this.escHtml(this.querySelector('#title').textContent)}</h2></div>`;
    html += '<div class="penpot-app__project-grid">';

    for (const project of this.#projects) {
      const fileCount = project.fileCount || 0;
      html += `<div class="penpot-app__project-card" data-project-id="${this.escAttr(project.id)}">
        <h3>${this.escHtml(project.name)}</h3>
        <p>${fileCount} file${fileCount !== 1 ? 's' : ''}</p>
      </div>`;
    }

    html += '</div>';
    content.innerHTML = html;

    content.querySelectorAll('.project-card[data-project-id]').forEach(el => {
      el.addEventListener('click', () => {
        this.#currentProjectId = el.dataset.projectId;
        this.loadProjectFiles(el.dataset.projectId);
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
      this.renderFiles(fileList, project, teamName);
    } catch (err) {
      console.error('[dashboard] load files error:', err);
      content.innerHTML = '<div class="penpot-app__empty-state">Error loading files.</div>';
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

    for (const file of files) {
      const modified = file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString() : '';
      html += `<div class="penpot-app__file-card" data-file-id="${this.escAttr(file.id)}">
        <div class="penpot-app__file-icon">\u270E</div>
        <div class="penpot-app__file-name">${this.escHtml(file.name || 'Untitled')}</div>
        <div class="penpot-app__file-meta">${modified}</div>
      </div>`;
    }

    html += '</div>';
    content.innerHTML = html;

    this.querySelector('#back-link').addEventListener('click', () => this.loadTeamProjects());
    this.querySelector('#new-file-btn').addEventListener('click', () => this.createFile());
    content.querySelectorAll('.file-card[data-file-id]').forEach(el => {
      el.addEventListener('click', () => {
        appStore.set('currentFileId', el.dataset.fileId);
        appStore.set('currentProjectId', this.#currentProjectId);
        appStore.set('currentTeamId', this.#currentTeamId);
        window.__penpot.navigate('workspace');
      });
    });
  }

  async createFile() {
    const content = this.querySelector('#content');
    try {
      let projectId = this.#currentProjectId;
      if (!projectId && this.#projects.length > 0) {
        projectId = this.#projects[0].id;
      } else if (!projectId) {
        const project = await cmd('create-project', { teamId: this.#currentTeamId, name: 'My Project' });
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

  logout() {
    try { cmd('logout'); } catch {}
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