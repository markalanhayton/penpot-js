'use strict';
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
import './components/penpot-main-menu.js';
import './components/penpot-toolbar.js';
import './components/penpot-tools-bar.js';
import './components/penpot-canvas.js';
import './components/penpot-scrollbars.js';
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
import './components/penpot-onboarding-questions.js';
import './components/penpot-onboarding-team-choice.js';
import './components/penpot-team-form.js';
import './components/penpot-uploads-dashboard.js';
import { init, subscribe, current, navigate } from './lib/router.js';
import { cmd, setAuthToken, clearAuthToken } from './lib/rpc.js';
import { appStore } from './lib/store.js';
import { connectWS, disconnectWS } from './lib/ws.js';
import { initResponsiveLayout } from './lib/responsive.js';
import { DEFAULT_FLAGS } from './lib/flags.js';

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
  initResponsiveLayout();

  try {
    const serverFlags = await cmd('get-enabled-flags');
    if (serverFlags && typeof serverFlags === 'object') {
      const flags = { ...DEFAULT_FLAGS, ...serverFlags };
      appStore.set('flags', flags);
    } else {
      appStore.set('flags', { ...DEFAULT_FLAGS });
    }
  } catch (err) {
    console.warn('[app] get-enabled-flags failed, using defaults:', err.message);
    appStore.set('flags', { ...DEFAULT_FLAGS });
  }

  const token = getCookie('auth-token');
  if (token) {
    setAuthToken(token);
    try {
      const profile = await cmd('get-profile');
      appStore.set('profile', profile);
      connectWS(`${window.location.origin}/ws/notifications`, token);
      render(current());
      navigate('dashboard');
      runOnboardingFlow(profile);
      return;
    } catch (err) {
      console.error('[app] Auth profile fetch failed, redirecting to login:', err?.message || err);
      clearAuthToken();
      eraseCookie('auth-token');
      disconnectWS();
    }
  }

  render(current());
  subscribe(render);
}

/**
 * WU-T2: Multi-step onboarding flow.
 *
 * Two optional overlays shown after first login:
 *  1. Intro questions (role / team size / use case) — for users with no
 *     `onboarding-viewed` flag in profile.props.
 *  2. Team choice (create / join) — for users with 0 teams.
 *
 * Each overlay is dismissable via Skip; localStorage prevents it from
 * re-appearing in the same browser. RPC results are best-effort.
 */
function runOnboardingFlow(profile) {
  // Parse the props JSON string returned by the server
  let props = {};
  if (profile && profile.props) {
    try { props = typeof profile.props === 'string' ? JSON.parse(profile.props) : (profile.props || {}); }
    catch { props = {}; }
  }

  // 1. Intro questions overlay (only for users who haven't completed it)
  const alreadyViewed = props && props.onboardingViewed;
  const localDone = localStorage.getItem('penpot-intro-questions-done');

  if (!alreadyViewed && !localDone) {
    // Defer to next tick so the dashboard has time to mount
    setTimeout(() => {
      const el = document.createElement('penpot-onboarding-questions');
      document.body.appendChild(el);
      el.addEventListener('intro-questions-complete', () => {
        // Continue to team choice after a short delay
        setTimeout(() => maybeShowTeamChoice(), 300);
      });
    }, 800);
  } else {
    // Already viewed, but still check team choice
    maybeShowTeamChoice();
  }
}

async function maybeShowTeamChoice() {
  const localDone = localStorage.getItem('penpot-team-choice-done');
  if (localDone) return;

  try {
    const teams = await cmd('get-teams', {});
    if (Array.isArray(teams) && teams.length > 0) {
      // User has at least one team — no team choice needed
      return;
    }
    // No team — show the overlay
    setTimeout(() => {
      const el = document.createElement('penpot-onboarding-team-choice');
      document.body.appendChild(el);
      el.addEventListener('team-choice-complete', (e) => {
        const action = e?.detail?.action;
        if (action === 'create-team') {
          // Navigate to dashboard which has the create-team dialog flow
          if (window.__penpot?.navigate) window.__penpot.navigate('dashboard');
        }
        if (action === 'join-invite') {
          // Store the token for the dashboard to consume
          sessionStorage.setItem('penpot-pending-invite-token', e.detail.token);
          if (window.__penpot?.navigate) window.__penpot.navigate('dashboard');
        }
      });
    }, 300);
  } catch (err) {
    console.warn('[app] team choice check failed:', err.message);
  }
}

bootstrap();