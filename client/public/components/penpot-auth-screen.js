'use strict';
import { cmd, setAuthToken, clearAuthToken } from '../lib/rpc.js';
import { appStore } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { flagEnabled } from '../lib/flags.js';
import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    penpot-auth-screen { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: var(--penpot-bg, #1c1c1c); }
    .penpot-app__auth-card { width: 400px; padding: var(--penpot-spacing-xxl, 32px); background: var(--penpot-surface, #2a2a2a); border-radius: var(--penpot-radius-l, 12px); border: 1px solid var(--penpot-border, #444); box-shadow: var(--penpot-shadow-l, 0 8px 24px rgba(0,0,0,0.5)); }
    .penpot-app__auth-title { font-size: 24px; font-weight: 600; margin-bottom: var(--penpot-spacing-l, 16px); color: var(--penpot-primary, #31efb8); }
    .penpot-app__auth-subtitle { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin-bottom: var(--penpot-spacing-l, 16px); }
    .penpot-app__auth-error { background: var(--penpot-danger-bg, rgba(244,67,54,0.08)); border: 1px solid var(--penpot-danger, #f44); border-radius: var(--penpot-radius-s, 4px); padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); margin-bottom: var(--penpot-spacing-m, 12px); color: var(--penpot-danger, #f44); font-size: var(--penpot-font-size-s, 11px); display: none; }
    .penpot-app__auth-error.penpot-app__visible { display: block; }
    .penpot-app__auth-success { background: var(--penpot-success-bg, rgba(76,175,80,0.08)); border: 1px solid var(--penpot-success, #4caf50); border-radius: var(--penpot-radius-s, 4px); padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); margin-bottom: var(--penpot-spacing-m, 12px); color: var(--penpot-success, #4caf50); font-size: var(--penpot-font-size-s, 11px); display: none; }
    .penpot-app__auth-success.penpot-app__visible { display: block; }
    .penpot-app__field { margin-bottom: var(--penpot-spacing-m, 12px); position: relative; }
    .penpot-app__field label { display: block; font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin-bottom: var(--penpot-spacing-xs, 4px); }
    .penpot-app__field input { width: 100%; padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); font-size: 14px; outline: none; transition: border-color var(--penpot-transition-fast, 0.1s ease); }
    .penpot-app__field input:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-app__field input:disabled { opacity: 0.5; cursor: not-allowed; }
    .penpot-app__pw-toggle { position: absolute; right: 8px; top: 28px; background: none; border: none; color: var(--penpot-text-dim, #999); cursor: pointer; font-size: 16px; padding: 4px; line-height: 1; }
    .penpot-app__pw-toggle:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-app__submit-btn { width: 100%; padding: var(--penpot-spacing-s, 8px); background: var(--penpot-primary, #31efb8); color: var(--penpot-text-inverse, #111); border: none; border-radius: var(--penpot-radius-s, 4px); font-size: 14px; font-weight: 600; cursor: pointer; margin-top: var(--penpot-spacing-s, 8px); transition: background var(--penpot-transition-fast, 0.1s ease); }
    .penpot-app__submit-btn:hover { background: var(--penpot-primary-hover, #28d4a3); }
    .penpot-app__submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .penpot-app__submit-btn.penpot-app__loading { position: relative; color: transparent; }
    .penpot-app__spinner { width: 18px; height: 18px; border: 2px solid var(--penpot-text-inverse, #111); border-top-color: transparent; border-radius: 50%; animation: auth-spin 0.6s linear infinite; display: none; position: absolute; top: 50%; left: 50%; margin: -9px 0 0 -9px; }
    .penpot-app__submit-btn.penpot-app__loading .penpot-app__spinner { display: block; }
    @keyframes auth-spin { to { transform: rotate(360deg); } }
    .penpot-app__switch-text { text-align: center; margin-top: var(--penpot-spacing-m, 12px); font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); }
    .penpot-app__switch-text a { color: var(--penpot-primary, #31efb8); cursor: pointer; text-decoration: none; }
    .penpot-app__switch-text a:hover { text-decoration: underline; }
    .penpot-app__oauth-divider { display: flex; align-items: center; margin: var(--penpot-spacing-m, 12px) 0; color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-s, 11px); }
    .penpot-app__oauth-divider::before, .penpot-app__oauth-divider::after { content: ''; flex: 1; border-bottom: 1px solid var(--penpot-border, #444); }
    .penpot-app__oauth-divider span { padding: 0 var(--penpot-spacing-s, 8px); }
    .penpot-app__oauth-btns { display: flex; flex-direction: column; gap: var(--penpot-spacing-xs, 4px); margin-bottom: var(--penpot-spacing-m, 12px); }
    .penpot-app__oauth-btn { display: flex; align-items: center; justify-content: center; gap: var(--penpot-spacing-s, 8px); width: 100%; padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); font-size: 14px; cursor: pointer; transition: background var(--penpot-transition-fast, 0.1s ease), border-color var(--penpot-transition-fast, 0.1s ease); }
    .penpot-app__oauth-btn:hover { background: var(--penpot-input-bg, #333); border-color: var(--penpot-primary, #31efb8); }
    .penpot-app__oauth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .penpot-app__oauth-icon { font-size: 18px; }
  </style>
  <div class="penpot-app__auth-card">
    <h1 class="penpot-app__auth-title" id="title">Sign in to Penpot</h1>
    <div class="penpot-app__auth-error" id="error"></div>
    <div class="penpot-app__auth-success" id="success"></div>
    <div class="penpot-app__oauth-btns" id="oauth-btns"></div>
    <div class="penpot-app__oauth-divider" id="oauth-divider" hidden><span>or</span></div>
    <div class="penpot-app__field" id="name-field" hidden>
      <label for="name">Full name</label>
      <input id="name" type="text" autocomplete="name" placeholder="Your full name">
    </div>
    <div class="penpot-app__field">
      <label for="email">Email</label>
      <input id="email" type="email" autocomplete="email" placeholder="you@example.com">
    </div>
    <div class="penpot-app__field" id="pw-field">
      <label for="pw">Password</label>
      <input id="pw" type="password" autocomplete="current-password" placeholder="Enter your password">
      <button class="penpot-app__pw-toggle" id="pw-toggle" type="button" title="Toggle password visibility">&#128065;</button>
    </div>
    <button class="penpot-app__submit-btn" id="submit">Sign in<span class="penpot-app__spinner"></span></button>
    <div class="penpot-app__switch-text" id="switch-text">
      <span id="switch-prefix">Don't have an account? </span><a id="switch-link">Create one</a>
    </div>
  </div>
`;

const OAUTH_PROVIDERS = [
  { flag: 'login_with_oidc', id: 'oidc', label: 'Sign in with SSO', icon: '\u{1F511}' },
  { flag: 'login_with_google', id: 'google', label: 'Sign in with Google', icon: 'G' },
  { flag: 'login_with_github', id: 'github', label: 'Sign in with GitHub', icon: '\u{1F4BB}' },
  { flag: 'login_with_gitlab', id: 'gitlab', label: 'Sign in with GitLab', icon: '\u{1F98A}' },
];

export class PenpotAuthScreen extends PenpotElement {
  _template = template;
  #route = 'login';
  #loading = false;
  #error = '';
  #success = '';

  static get observedAttributes() { return ['route']; }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.querySelector('#submit').addEventListener('click', () => this.handleSubmit());
    this.querySelector('#switch-link').addEventListener('click', () => this.switchMode());
    this.querySelector('#pw-toggle').addEventListener('click', () => this.togglePasswordVisibility());
    this.querySelector('#pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleSubmit(); });
    this.querySelector('#email').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleSubmit(); });
    this.querySelector('#name').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleSubmit(); });
    this.renderOAuthButtons();
    this.render();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'route') {
      this.#route = newVal;
      this.#error = '';
      this.#success = '';
      if (this.isConnected) this.render();
    }
  }

  render() {
    if (!this.isConnected) return;
    const $ = (sel) => this.querySelector(sel);
    const nameField = $('#name-field');
    const title = $('#title');
    const submitBtn = $('#submit');
    const switchPrefix = $('#switch-prefix');
    const switchLink = $('#switch-link');
    const pwField = $('#pw-field');
    const errorEl = $('#error');
    const successEl = $('#success');

    if (!title) return;

    nameField.hidden = this.#route !== 'register';
    pwField.hidden = false;

    if (this.#route === 'register') {
      title.textContent = 'Create your account';
      submitBtn.textContent = this.#loading ? 'Creating...' : 'Create account';
      switchPrefix.textContent = 'Already have an account? ';
      switchLink.textContent = 'Sign in';
    } else if (this.#route === 'recovery') {
      title.textContent = 'Reset your password';
      submitBtn.textContent = this.#loading ? 'Sending...' : 'Send recovery link';
      pwField.hidden = true;
      switchPrefix.textContent = '';
      switchLink.textContent = 'Back to sign in';
    } else if (this.#route === 'recovery-request') {
      title.textContent = 'Forgot password?';
      submitBtn.textContent = this.#loading ? 'Sending...' : 'Send recovery link';
      pwField.hidden = true;
      switchPrefix.textContent = 'Remember your password? ';
      switchLink.textContent = 'Sign in';
    } else {
      title.textContent = 'Sign in to Penpot';
      submitBtn.textContent = this.#loading ? 'Signing in...' : 'Sign in';
      switchPrefix.textContent = "Don't have an account? ";
      switchLink.textContent = 'Create one';
    }

    errorEl.className = 'penpot-app__auth-error' + (this.#error ? ' penpot-app__visible' : '');
    if (this.#error) errorEl.textContent = this.#error;
    successEl.className = 'penpot-app__auth-success' + (this.#success ? ' penpot-app__visible' : '');
    if (this.#success) successEl.textContent = this.#success;

    submitBtn.disabled = this.#loading;
    submitBtn.classList.toggle('penpot-app__loading', this.#loading);

    this.querySelector('#email').disabled = this.#loading;
    this.querySelector('#pw').disabled = this.#loading;
    this.querySelector('#name').disabled = this.#loading;
  }

  togglePasswordVisibility() {
    const pw = this.querySelector('#pw');
    const btn = this.querySelector('#pw-toggle');
    if (pw.type === 'password') {
      pw.type = 'text';
      btn.textContent = '\u{1F441}';
      btn.title = 'Hide password';
    } else {
      pw.type = 'password';
      btn.textContent = '\u{1F441}';
      btn.title = 'Show password';
    }
  }

  switchMode() {
    const { navigate } = window.__penpot;
    if (this.#route === 'login') navigate('register');
    else if (this.#route === 'register') navigate('login');
    else if (this.#route === 'recovery-request') navigate('login');
    else navigate('login');
  }

  renderOAuthButtons() {
    if (!this.isConnected) return;
    const container = this.querySelector('#oauth-btns');
    const divider = this.querySelector('#oauth-divider');
    if (!container) return;

    const flags = appStore.get('flags') || {};
    container.innerHTML = '';

    let hasOAuth = false;
    for (const provider of OAUTH_PROVIDERS) {
      if (flagEnabled(flags, provider.flag)) {
        hasOAuth = true;
        const btn = document.createElement('button');
        btn.className = 'penpot-app__oauth-btn';
        btn.setAttribute('data-provider', provider.id);
        btn.innerHTML = `<span class="penpot-app__oauth-icon">${provider.icon}</span> ${provider.label}`;
        btn.addEventListener('click', () => this.handleOAuthLogin(provider.id));
        container.appendChild(btn);
      }
    }

    if (divider) divider.hidden = !hasOAuth;
  }

  async handleOAuthLogin(providerId) {
    if (this.#loading) return;
    this.#loading = true;
    this.#error = '';
    if (this.isConnected) this.render();

    try {
      const result = await cmd('get-oidc-auth-uri', { providerId });
      if (result?.uri) {
        window.location.href = result.uri;
        return;
      }
      this.#error = 'SSO login is not available. Please contact your administrator.';
    } catch (err) {
      this.#error = err.hint || err.message || 'SSO login failed. Please try again.';
    } finally {
      this.#loading = false;
      if (this.isConnected) this.render();
    }
  }

  async handleSubmit() {
    if (this.#loading) return;
    this.#loading = true;
    this.#error = '';
    this.#success = '';
    if (this.isConnected) this.render();

    const emailEl = this.querySelector('#email');
    const pwEl = this.querySelector('#pw');
    const nameEl = this.querySelector('#name');
    const email = emailEl ? emailEl.value.trim() : '';
    const password = pwEl ? pwEl.value : '';
    const fullname = nameEl ? nameEl.value.trim() : '';

    if (!email) {
      this.#error = 'Email is required.';
      this.#loading = false;
      if (this.isConnected) this.render();
      return;
    }

    try {
      if (this.#route === 'login') {
        const result = await cmd('login-with-password', { email, password });
        if (result?.token) {
          setAuthToken(result.token);
          document.cookie = `auth-token=${result.token}; path=/; max-age=604800; SameSite=Lax`;
        }
        const profile = await cmd('get-profile');
        appStore.set('profile', profile);
        window.__penpot.navigate('dashboard');
        return;
      } else if (this.#route === 'register') {
        if (!fullname) { this.#error = 'Name is required.'; this.#loading = false; if (this.isConnected) this.render(); return; }
        const prep = await cmd('prepare-register-profile', { fullname, email, password });
        if (prep?.token) {
          await cmd('register-profile', { token: prep.token });
          this.#success = 'Account created! Please sign in.';
          this.#route = 'login';
          if (this.isConnected) this.render();
        }
      } else if (this.#route === 'recovery' || this.#route === 'recovery-request') {
        await cmd('request-profile-recovery', { email });
        this.#success = 'If that email exists, a recovery link has been sent.';
        if (this.isConnected) this.render();
      }
    } catch (err) {
      console.error('[auth] submit error:', err);
      this.#error = err.hint || err.message || 'An error occurred. Please try again.';
      if (this.isConnected) this.render();
    } finally {
      this.#loading = false;
    }
  }
}

customElements.define('penpot-auth-screen', PenpotAuthScreen);