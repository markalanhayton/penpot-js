import './lib/tokens.js';
import './components/base.js';
import './components/penpot-icon.js';
import './components/penpot-loader.js';
import './components/penpot-badge.js';
import './components/penpot-button.js';
import './components/penpot-input.js';
import './components/penpot-checkbox.js';
import './components/penpot-switch.js';
import './components/penpot-radio.js';
import './components/penpot-slider.js';
import './components/penpot-tooltip.js';
import './components/penpot-tabs.js';
import './components/penpot-dropdown.js';
import './components/penpot-modal.js';
import './components/penpot-select.js';
import './components/penpot-notification.js';
import './components/penpot-avatar.js';
import './components/penpot-file-thumbnail.js';
import './components/penpot-form.js';
import './components/penpot-context-menu.js';
import './components/penpot-color-picker.js';
import './components/penpot-auth-screen.js';
import './components/penpot-team-sidebar.js';
import './components/penpot-file-grid.js';
import './components/penpot-project-card.js';
import './components/penpot-dashboard.js';
import './components/penpot-toolbar.js';
import './components/penpot-tools-bar.js';
import './components/penpot-canvas.js';
import './components/penpot-left-sidebar.js';
import './components/penpot-right-sidebar.js';
import './components/penpot-layer-panel.js';
import './components/penpot-asset-panel.js';
import './components/penpot-cursor-overlay.js';
import './components/penpot-presence-bar.js';
import './components/penpot-export-dialog.js';
import './components/penpot-share-dialog.js';
import './components/penpot-comment-panel.js';
import './components/penpot-settings.js';
import './components/penpot-text-toolbar.js';
import './components/penpot-gradient-editor.js';
import './components/penpot-shadow-editor.js';
import './components/penpot-version-panel.js';
import './components/penpot-shortcuts-reference.js';
import './components/penpot-workspace.js';
import './components/penpot-viewer.js';
import './components/penpot-import-dialog.js';
import './components/penpot-rulers.js';
import './components/penpot-guide-overlay.js';
import './components/penpot-mcp-panel.js';
import { init, subscribe, current, navigate } from './lib/router.js';
import { cmd, setAuthToken, clearAuthToken } from './lib/rpc.js';
import { appStore } from './lib/store.js';
import { connectWS, disconnectWS } from './lib/ws.js';

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function eraseCookie(name) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

window.__penpot = { cmd, setAuthToken, clearAuthToken, navigate, store: appStore };

const app = document.getElementById('app');
let currentEl = null;

function render(route) {
  if (currentEl) currentEl.remove();

  switch (route.name) {
    case 'login':
    case 'register':
    case 'recovery-request':
    case 'recovery':
      currentEl = document.createElement('penpot-auth-screen');
      currentEl.setAttribute('route', route.name);
      break;
    case 'workspace':
      currentEl = document.createElement('penpot-workspace');
      if (route.params.projectId) appStore.set('currentProjectId', route.params.projectId);
      if (route.params.fileId) appStore.set('currentFileId', route.params.fileId);
      break;
    case 'viewer':
      currentEl = document.createElement('penpot-viewer');
      break;
    case 'settings-profile':
    case 'settings-password':
    case 'settings-tokens':
    case 'settings-feedback':
    case 'settings-nudge':
    case 'settings-notifications':
      currentEl = document.createElement('penpot-settings');
      currentEl.setAttribute('section', route.name.replace('settings-', ''));
      break;
    case 'dashboard':
    case 'dashboard-search':
    case 'dashboard-fonts':
    case 'dashboard-libraries':
    default:
      currentEl = document.createElement('penpot-dashboard');
      currentEl.setAttribute('view', route.name.replace('dashboard-', '') || 'projects');
      break;
  }

  app.appendChild(currentEl);

  currentEl.addEventListener('navigate', (e) => {
    if (e.detail && e.detail.route) {
      navigate(e.detail.route);
    }
  });
}

async function bootstrap() {
  init();

  const token = getCookie('auth-token');
  if (token) {
    setAuthToken(token);
    try {
      const profile = await cmd('get-profile');
      appStore.set('profile', profile);
      connectWS(`${window.location.origin}/ws/notifications`, token);
      render(current());
      navigate('dashboard');
      return;
    } catch {
      clearAuthToken();
      eraseCookie('auth-token');
      disconnectWS();
    }
  }

  render(current());
  subscribe(render);
}

bootstrap();