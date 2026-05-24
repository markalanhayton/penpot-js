import { PenpotElement } from './base.js';
import { cmd } from '../lib/rpc.js';
import { appStore } from '../lib/store.js';
import { getAccessTokens, createAccessToken, deleteAccessToken, maskToken } from '../lib/access-tokens.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-settings { display: flex; min-height: 100vh; height: 100%; background: var(--penpot-bg, #1c1c1c); color: var(--penpot-text, #e6e6e6); font-family: var(--penpot-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif); }
    .penpot-settings__settings-layout { display: flex; width: 100%; height: 100%; }
    .penpot-settings__settings-nav { width: 200px; background: var(--penpot-surface, #2a2a2a); border-right: 1px solid var(--penpot-border, #444); padding: var(--penpot-spacing-l, 16px); flex-shrink: 0; }
    .penpot-settings__settings-nav h3 { margin: 0 0 var(--penpot-spacing-m, 12px) 0; font-size: var(--penpot-font-size-l, 16px); color: var(--penpot-primary, #31efb8); }
    .penpot-settings__nav-item { display: block; padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); color: var(--penpot-text-dim, #999); text-decoration: none; font-size: var(--penpot-font-size-m, 13px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: inherit; }
    .penpot-settings__nav-item:hover { background: var(--penpot-surface-high, #333); color: var(--penpot-text, #e6e6e6); }
    .penpot-settings__nav-item.penpot-settings__active { background: rgba(49,239,184,0.15); color: var(--penpot-primary, #31efb8); }
    .penpot-settings__settings-content { flex: 1; padding: var(--penpot-spacing-xl, 24px); overflow-y: auto; max-width: 600px; }
    .penpot-settings__settings-content h2 { margin: 0 0 var(--penpot-spacing-l, 16px) 0; font-size: var(--penpot-font-size-xl, 20px); }
    .penpot-settings__form-group { margin-bottom: var(--penpot-spacing-m, 12px); }
    .penpot-settings__form-group label { display: block; font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin-bottom: var(--penpot-spacing-xs, 4px); text-transform: uppercase; letter-spacing: 0.5px; }
    .penpot-settings__form-group input { width: 100%; box-sizing: border-box; padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); font-size: var(--penpot-font-size-m, 13px); font-family: inherit; outline: none; }
    .penpot-settings__form-group input:focus { border-color: var(--penpot-primary, #31efb8); }
    .penpot-settings__form-group input:disabled { opacity: 0.5; }
    .penpot-settings__save-btn { background: var(--penpot-primary, #31efb8); color: #000; border: none; padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-xl, 24px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-m, 13px); font-weight: 600; font-family: inherit; }
    .penpot-settings__save-btn:hover { background: var(--penpot-primary-hover, #28d4a3); }
    .penpot-settings__save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .penpot-settings__danger-btn { background: transparent; color: var(--penpot-danger, #f44); border: 1px solid var(--penpot-danger, #f44); padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-xl, 24px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-m, 13px); font-family: inherit; }
    .penpot-settings__danger-btn:hover { background: rgba(244,68,68,0.1); }
    .penpot-settings__message { padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-m, 12px); border-radius: var(--penpot-radius-s, 4px); font-size: var(--penpot-font-size-s, 11px); margin-bottom: var(--penpot-spacing-m, 12px); }
    .penpot-settings__message.penpot-settings__success { background: rgba(49,239,184,0.15); color: var(--penpot-primary, #31efb8); }
    .penpot-settings__message.penpot-settings__error { background: rgba(244,68,68,0.15); color: var(--penpot-danger, #f44); }
    .penpot-settings__back-link { display: inline-block; color: var(--penpot-text-dim, #999); text-decoration: none; font-size: var(--penpot-font-size-s, 11px); margin-bottom: var(--penpot-spacing-l, 16px); cursor: pointer; border: none; background: none; font-family: inherit; padding: 0; }
    .penpot-settings__back-link:hover { color: var(--penpot-text, #e6e6e6); }
    .penpot-settings__section-divider { border: none; border-top: 1px solid var(--penpot-border, #444); margin: var(--penpot-spacing-xl, 24px) 0; }
    .penpot-settings__token-list { margin-top: var(--penpot-spacing-m, 12px); }
    .penpot-settings__token-item { display: flex; align-items: center; gap: var(--penpot-spacing-m, 12px); padding: var(--penpot-spacing-s, 8px) 0; border-bottom: 1px solid var(--penpot-border, #444); }
    .penpot-settings__token-name { flex: 1; font-size: var(--penpot-font-size-m, 13px); }
    .penpot-settings__token-date { font-size: var(--penpot-font-size-xs, 10px); color: var(--penpot-text-dim, #999); }
    .penpot-settings__token-value { font-family: 'SFMono-Regular', Consolas, monospace; font-size: var(--penpot-font-size-xs, 10px); background: var(--penpot-bg, #1c1c1c); padding: 2px 6px; border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-primary, #31efb8); word-break: break-all; }
    .penpot-settings__token-reveal { background: none; border: 1px solid var(--penpot-border, #444); color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-xs, 10px); padding: 2px 8px; border-radius: var(--penpot-radius-s, 4px); cursor: pointer; }
    .penpot-settings__token-reveal:hover { color: var(--penpot-text, #e6e6e6); border-color: #666; }
    .penpot-settings__token-delete { background: none; border: 1px solid var(--penpot-danger, #f44); color: var(--penpot-danger, #f44); font-size: var(--penpot-font-size-xs, 10px); padding: 2px 8px; border-radius: var(--penpot-radius-s, 4px); cursor: pointer; }
    .penpot-settings__token-delete:hover { background: rgba(244,68,68,0.1); }
    .penpot-settings__create-row { display: flex; gap: var(--penpot-spacing-s, 8px); margin-top: var(--penpot-spacing-m, 12px); }
    .penpot-settings__create-row input { flex: 1; }
  
  </style>
  <div class="penpot-settings__settings-layout">
    <nav class="penpot-settings__settings-nav">
      <h3>Settings</h3>
      <button class="penpot-settings__nav-item penpot-settings__active" data-section="profile">Profile</button>
      <button class="penpot-settings__nav-item" data-section="password">Password</button>
      <button class="penpot-settings__nav-item" data-section="tokens">Access Tokens</button>
      <button class="penpot-settings__nav-item" data-section="feedback">Feedback</button>
      <button class="penpot-settings__nav-item" data-section="nudge">Nudge</button>
    </nav>
    <div class="penpot-settings__settings-content" id="content"></div>
  </div>`;

export class PenpotSettings extends PenpotElement {
  _template = template;
  #section = 'profile';
  #profile = null;
  #message = null;
  #messageType = 'success';

  static get observedAttributes() { return ['section']; }

  connectedCallback() {
    super.connectedCallback();
    const section = this.getAttribute('section');
    if (section) this.#section = section;
    this.querySelectorAll('.penpot-settings__nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#section = btn.dataset.section;
        this.querySelectorAll('.penpot-settings__nav-item').forEach(b => b.classList.toggle('penpot-settings__active', b.dataset.section === this.#section));
        this.#render();
      });
    });
    this.querySelector('.penpot-settings__back-link')?.addEventListener('click', () => {
      this.emit('navigate', { route: 'dashboard' });
    });
    this.#loadProfile();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'section' && newVal && newVal !== oldVal) {
      this.#section = newVal;
      this.querySelectorAll('.penpot-settings__nav-item').forEach(b => b.classList.toggle('penpot-settings__active', b.dataset.section === this.#section));
      this.#render();
    }
  }

  async #loadProfile() {
    try {
      this.#profile = await cmd('get-profile');
    } catch {
      this.#profile = appStore.get('profile') || {};
    }
    this.#render();
  }

  #render() {
    const content = this.querySelector('#content');
    if (!content) return;
    this.#message = null;

    switch (this.#section) {
      case 'profile': this.#renderProfile(content); break;
      case 'password': this.#renderPassword(content); break;
      case 'tokens': this.#renderTokens(content); break;
      case 'feedback': this.#renderFeedback(content); break;
      case 'nudge': this.#renderNudge(content); break;
    }
  }

  #renderProfile(content) {
    const p = this.#profile || {};
    content.innerHTML = `
      <button class="penpot-settings__back-link">&larr; Back to Dashboard</button>
      <h2>Profile Settings</h2>
      <div id="msg"></div>
      <div class="penpot-settings__form-group">
        <label for="fullname">Full Name</label>
        <input type="text" id="fullname" value="${this.escHtml(p.fullname || p.name || '')}">
      </div>
      <div class="penpot-settings__form-group">
        <label for="email">Email</label>
        <input type="email" id="email" value="${this.escHtml(p.email || '')}" disabled>
        <button class="penpot-settings__token-reveal" id="change-email-btn" style="margin-top:4px;">Change Email</button>
      </div>
      <div class="penpot-settings__form-group">
        <label for="lang">Language</label>
        <input type="text" id="lang" value="${this.escHtml(p.lang || 'en')}" placeholder="en">
      </div>
      <button class="penpot-settings__save-btn" id="save-profile">Save Changes</button>
      <hr class="penpot-settings__section-divider">
      <h3 style="color:var(--penpot-danger,#f44);font-size:var(--penpot-font-size-m,13px);">Danger Zone</h3>
      <p style="font-size:var(--penpot-font-size-s,11px);color:var(--penpot-text-dim,#999);margin-bottom:var(--penpot-spacing-m,12px);">Deleting your account is permanent and cannot be undone.</p>
      <button class="penpot-settings__danger-btn" id="delete-account-btn">Delete Account</button>
    `;

    content.querySelector('.penpot-settings__back-link').addEventListener('click', () => {
      this.emit('navigate', { route: 'dashboard' });
    });

    content.querySelector('#save-profile').addEventListener('click', async () => {
      const fullname = content.querySelector('#fullname').value.trim();
      const lang = content.querySelector('#lang').value.trim() || 'en';
      try {
        await cmd('update-profile', { id: this.#profile.id, fullname, lang });
        this.#message = 'Profile updated successfully.';
        this.#messageType = 'success';
        this.#profile = { ...this.#profile, fullname, lang };
        appStore.set('profile', this.#profile);
      } catch (err) {
        this.#message = err.hint || err.message || 'Failed to update profile.';
        this.#messageType = 'error';
      }
      this.#showMessage(content);
    });

    content.querySelector('#change-email-btn').addEventListener('click', async () => {
      const newEmail = prompt('Enter your new email address:');
      if (!newEmail || !newEmail.trim()) return;
      try {
        const result = await cmd('request-email-change', { email: newEmail.trim() });
        if (result.token) {
          this.#message = 'A verification link has been sent. Please check your email to confirm the change.';
        } else {
          this.#message = 'Email updated successfully.';
          this.#profile = { ...this.#profile, email: newEmail.trim() };
          appStore.set('profile', this.#profile);
        }
        this.#messageType = 'success';
      } catch (err) {
        this.#message = err.hint || err.message || 'Failed to change email.';
        this.#messageType = 'error';
      }
      this.#showMessage(content);
    });

    content.querySelector('#delete-account-btn').addEventListener('click', async () => {
      const confirmed = confirm('Are you sure you want to delete your account? This action is permanent and cannot be undone.');
      if (!confirmed) return;
      try {
        await cmd('delete-profile', {});
        appStore.set('profile', null);
        document.cookie = 'auth-token=; path=/; max-age=0';
        window.__penpot.navigate('login');
      } catch (err) {
        this.#message = err.hint || err.message || 'Failed to delete account.';
        this.#messageType = 'error';
        this.#showMessage(content);
      }
    });
  }

  #renderPassword(content) {
    content.innerHTML = `
      <button class="penpot-settings__back-link">&larr; Back to Dashboard</button>
      <h2>Change Password</h2>
      <div id="msg"></div>
      <div class="penpot-settings__form-group">
        <label for="old-password">Current Password</label>
        <input type="password" id="old-password" placeholder="Enter current password">
      </div>
      <div class="penpot-settings__form-group">
        <label for="new-password">New Password</label>
        <input type="password" id="new-password" placeholder="Enter new password">
      </div>
      <div class="penpot-settings__form-group">
        <label for="confirm-password">Confirm New Password</label>
        <input type="password" id="confirm-password" placeholder="Confirm new password">
      </div>
      <button class="penpot-settings__save-btn" id="change-password">Change Password</button>
    `;

    content.querySelector('.penpot-settings__back-link').addEventListener('click', () => {
      this.emit('navigate', { route: 'dashboard' });
    });

    content.querySelector('#change-password').addEventListener('click', async () => {
      const oldPassword = content.querySelector('#old-password').value;
      const newPassword = content.querySelector('#new-password').value;
      const confirmPassword = content.querySelector('#confirm-password').value;

      if (!oldPassword || !newPassword) {
        this.#message = 'Please fill in all fields.';
        this.#messageType = 'error';
        this.#showMessage(content);
        return;
      }
      if (newPassword !== confirmPassword) {
        this.#message = 'Passwords do not match.';
        this.#messageType = 'error';
        this.#showMessage(content);
        return;
      }
      if (newPassword.length < 8) {
        this.#message = 'Password must be at least 8 characters.';
        this.#messageType = 'error';
        this.#showMessage(content);
        return;
      }

      try {
        await cmd('update-profile-password', { id: this.#profile?.id, old_password: oldPassword, new_password: newPassword });
        this.#message = 'Password changed successfully.';
        this.#messageType = 'success';
        content.querySelector('#old-password').value = '';
        content.querySelector('#new-password').value = '';
        content.querySelector('#confirm-password').value = '';
      } catch (err) {
        this.#message = err.hint || err.message || 'Failed to change password.';
        this.#messageType = 'error';
      }
      this.#showMessage(content);
    });
  }

  #renderFeedback(content) {
    content.innerHTML = `
      <button class="penpot-settings__back-link">&larr; Back to Dashboard</button>
      <h2>Send Feedback</h2>
      <div id="msg"></div>
      <div class="penpot-settings__form-group">
        <label for="feedback-type">Type</label>
        <select id="feedback-type" style="width:100%;box-sizing:border-box;padding:8px;background:var(--penpot-input-bg,#333);border:1px solid var(--penpot-input-border,#555);border-radius:4px;color:var(--penpot-text,#e6e6e6);font-size:13px;">
          <option value="feedback">General Feedback</option>
          <option value="bug">Bug Report</option>
          <option value="feature">Feature Request</option>
        </select>
      </div>
      <div class="penpot-settings__form-group">
        <label for="feedback-content">Message</label>
        <textarea id="feedback-content" rows="6" style="width:100%;box-sizing:border-box;padding:8px;background:var(--penpot-input-bg,#333);border:1px solid var(--penpot-input-border,#555);border-radius:4px;color:var(--penpot-text,#e6e6e6);font-size:13px;font-family:inherit;resize:vertical;" placeholder="Tell us what you think..."></textarea>
      </div>
      <button class="penpot-settings__save-btn" id="send-feedback">Send Feedback</button>
    `;

    content.querySelector('.penpot-settings__back-link').addEventListener('click', () => {
      this.emit('navigate', { route: 'dashboard' });
    });

    content.querySelector('#send-feedback').addEventListener('click', async () => {
      const type = content.querySelector('#feedback-type').value;
      const content2 = content.querySelector('#feedback-content').value.trim();
      if (!content2) {
        this.#message = 'Please enter a message.';
        this.#messageType = 'error';
        this.#showMessage(content);
        return;
      }
      try {
        await cmd('push-audit-events', { events: [{ type, content: content2 }] });
        this.#message = 'Thank you for your feedback!';
        this.#messageType = 'success';
        content.querySelector('#feedback-content').value = '';
      } catch (err) {
        this.#message = err.hint || err.message || 'Failed to send feedback.';
        this.#messageType = 'error';
      }
      this.#showMessage(content);
    });
  }

  #renderNudge(content) {
    const toolManager = window.__penpot?.toolManager;
    const sn = toolManager ? toolManager.smallNudge : 1;
    const bn = toolManager ? toolManager.bigNudge : 10;

    content.innerHTML = `
      <button class="penpot-settings__back-link">&larr; Back to Dashboard</button>
      <h2>Nudge Settings</h2>
      <div id="msg"></div>
      <p style="font-size:var(--penpot-font-size-s,11px);color:var(--penpot-text-dim,#999);margin-bottom:12px;">Configure the distance shapes move when using arrow keys. Small nudge: arrow key. Big nudge: Shift + arrow key.</p>
      <div class="penpot-settings__form-group">
        <label for="nudge-small">Small Nudge (px)</label>
        <input type="number" id="nudge-small" min="1" max="100" value="${sn}">
      </div>
      <div class="penpot-settings__form-group">
        <label for="nudge-big">Big Nudge (px)</label>
        <input type="number" id="nudge-big" min="1" max="100" value="${bn}">
      </div>
      <button class="penpot-settings__save-btn" id="save-nudge">Save Nudge Settings</button>
    `;

    content.querySelector('.penpot-settings__back-link').addEventListener('click', () => {
      this.emit('navigate', { route: 'dashboard' });
    });

    content.querySelector('#save-nudge').addEventListener('click', () => {
      const small = parseInt(content.querySelector('#nudge-small').value, 10) || 1;
      const big = parseInt(content.querySelector('#nudge-big').value, 10) || 10;
      if (toolManager) {
        toolManager.smallNudge = small;
        toolManager.bigNudge = big;
      }
      localStorage.setItem('penpot-nudge-small', String(small));
      localStorage.setItem('penpot-nudge-big', String(big));
      this.#message = 'Nudge settings saved.';
      this.#messageType = 'success';
      this.#showMessage(content);
    });
  }

  async #renderTokens(content) {
    content.innerHTML = `
      <button class="penpot-settings__back-link">&larr; Back to Dashboard</button>
      <h2>Access Tokens</h2>
      <div id="msg"></div>
      <p style="font-size:var(--penpot-font-size-s,11px);color:var(--penpot-text-dim,#999);margin-bottom:12px;">Access tokens allow you to authenticate API requests without a session. Keep them secret.</p>
      <div class="penpot-settings__create-row">
        <input type="text" id="token-name" placeholder="Token name (e.g. CI Pipeline)" style="background:var(--penpot-input-bg,#333);border:1px solid var(--penpot-input-border,#555);border-radius:4px;color:var(--penpot-text,#e6e6e6);padding:8px 12px;font-size:13px;font-family:inherit;outline:none;">
        <button class="penpot-settings__save-btn" id="create-token">Create Token</button>
      </div>
      <div class="penpot-settings__token-list" id="token-list">
        <div style="color:var(--penpot-text-dim,#999);text-align:center;padding:12px;font-size:11px;">Loading tokens...</div>
      </div>
    `;

    content.querySelector('.penpot-settings__back-link').addEventListener('click', () => {
      this.emit('navigate', { route: 'dashboard' });
    });

    content.querySelector('#create-token').addEventListener('click', async () => {
      const name = content.querySelector('#token-name').value.trim();
      if (!name) {
        this.#message = 'Please enter a token name.';
        this.#messageType = 'error';
        this.#showMessage(content);
        return;
      }
      try {
        const token = await createAccessToken(name);
        content.querySelector('#token-name').value = '';
        this.#message = `Token created! Copy it now — it won't be shown again: ${token.token}`;
        this.#messageType = 'success';
        this.#showMessage(content);
        await this.#loadTokenList(content);
      } catch (err) {
        this.#message = err.hint || err.message || 'Failed to create token.';
        this.#messageType = 'error';
        this.#showMessage(content);
      }
    });

    await this.#loadTokenList(content);
  }

  async #loadTokenList(content) {
    const listEl = content.querySelector('#token-list');
    if (!listEl) return;
    try {
      const tokens = await getAccessTokens();
      if (!tokens || tokens.length === 0) {
        listEl.innerHTML = '<div style="color:var(--penpot-text-dim,#999);text-align:center;padding:12px;font-size:11px;">No access tokens yet.</div>';
        return;
      }
      let html = '';
      for (const t of tokens) {
        const created = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '';
        html += `<div class="penpot-settings__token-item">
          <div style="flex:1;">
            <div class="penpot-settings__token-name">${this.escHtml(t.name || 'Unnamed')}</div>
            ${created ? `<div class="penpot-settings__token-date">Created ${created}</div>` : ''}
            <div class="penpot-settings__token-value" id="token-val-${this.escAttr(t.id)}">${maskToken(t.token)}</div>
          </div>
          <button class="penpot-settings__token-reveal" data-token-id="${this.escAttr(t.id)}" title="Reveal token">Reveal</button>
          <button class="penpot-settings__token-delete" data-delete-id="${this.escAttr(t.id)}" title="Delete token">Delete</button>
        </div>`;
      }
      listEl.innerHTML = html;

      listEl.querySelectorAll('[data-token-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.tokenId;
          const token = tokens.find(t => t.id === id);
          if (token && token.token) {
            const valEl = listEl.querySelector(`#token-val-${id}`);
            if (valEl) {
              const isRevealed = valEl.textContent !== maskToken(token.token) && valEl.textContent === token.token;
              valEl.textContent = isRevealed ? maskToken(token.token) : token.token;
              btn.textContent = isRevealed ? 'Reveal' : 'Hide';
            }
          }
        });
      });

      listEl.querySelectorAll('[data-delete-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.deleteId;
          try {
            await deleteAccessToken(id);
            this.#message = 'Token deleted.';
            this.#messageType = 'success';
            this.#showMessage(content);
            await this.#loadTokenList(content);
          } catch (err) {
            this.#message = 'Failed to delete token.';
            this.#messageType = 'error';
            this.#showMessage(content);
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = '<div style="color:var(--penpot-danger,#f44);text-align:center;padding:12px;font-size:11px;">Failed to load tokens.</div>';
    }
  }

  #showMessage(content) {
    const msgEl = content.querySelector('#msg');
    if (!msgEl) return;
    msgEl.className = `penpot-settings__message penpot-settings__${this.#messageType}`;
    msgEl.textContent = this.#message || '';
    if (this.#message) {
      setTimeout(() => { msgEl.textContent = ''; msgEl.className = 'penpot-settings__message'; }, 5000);
    }
  }

  render() {}
}

customElements.define('penpot-settings', PenpotSettings);