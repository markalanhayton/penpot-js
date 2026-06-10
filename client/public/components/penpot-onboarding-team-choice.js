'use strict';
/**
 * @module penpot-onboarding-team-choice
 * @description WU-T2: Team choice overlay shown after signup if user has no team.
 * Offers "Create Team" or "Join via invite link" options.
 *
 * Both options don't perform the actual server action (those flows already
 * exist on the dashboard). This component just offers a guided entry point
 * and emits events the workspace/dashboard react to.
 */

import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>
  penpot-onboarding-team-choice { display: block; }
  .team-choice-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: var(--penpot-z-overlay, 1000); display: flex; align-items: center; justify-content: center; }
  .team-choice-modal { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-xl, 24px); max-width: 540px; width: 90%; color: var(--penpot-text, #e6e6e6); }
  .team-choice-modal h2 { margin: 0 0 var(--penpot-spacing-s, 8px); font-size: var(--penpot-font-size-xl, 20px); color: var(--penpot-primary, #31efb8); }
  .team-choice-modal p.subtitle { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin: 0 0 var(--penpot-spacing-l, 16px); }
  .team-choice-options { display: grid; grid-template-columns: 1fr 1fr; gap: var(--penpot-spacing-m, 12px); }
  .team-choice-card { background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-l, 16px); cursor: pointer; text-align: left; font-family: inherit; color: var(--penpot-text, #e6e6e6); display: flex; flex-direction: column; gap: var(--penpot-spacing-s, 8px); }
  .team-choice-card:hover { border-color: var(--penpot-primary, #31efb8); }
  .team-choice-card-emoji { font-size: 28px; }
  .team-choice-card-title { font-size: var(--penpot-font-size-m, 13px); font-weight: 600; color: var(--penpot-text, #e6e6e6); }
  .team-choice-card-desc { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); }
  .team-choice-invite-form { margin-top: var(--penpot-spacing-l, 16px); }
  .team-choice-invite-form label { display: block; font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin-bottom: var(--penpot-spacing-s, 8px); }
  .team-choice-invite-form input { width: 100%; box-sizing: border-box; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: 8px 12px; font-size: var(--penpot-font-size-m, 13px); font-family: inherit; outline: none; margin-bottom: var(--penpot-spacing-s, 8px); }
  .team-choice-invite-form input:focus { border-color: var(--penpot-primary, #31efb8); }
  .team-choice-actions { display: flex; gap: var(--penpot-spacing-s, 8px); margin-top: var(--penpot-spacing-l, 16px); justify-content: flex-end; }
  .team-choice-btn { background: var(--penpot-primary, #31efb8); color: #000; border: none; padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-xl, 24px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-m, 13px); font-weight: 600; font-family: inherit; }
  .team-choice-btn:hover { background: var(--penpot-primary-hover, #28d4a3); }
  .team-choice-btn-ghost { background: transparent; color: var(--penpot-text-dim, #999); border: 1px solid var(--penpot-border, #444); padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-xl, 24px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-m, 13px); font-family: inherit; }
  .team-choice-btn-ghost:hover { background: var(--penpot-surface-high, #333); }
  .team-choice-back-btn { background: none; border: none; color: var(--penpot-text-dim, #999); font-size: var(--penpot-font-size-s, 11px); cursor: pointer; padding: 0; font-family: inherit; }
  .team-choice-back-btn:hover { color: var(--penpot-text, #e6e6e6); text-decoration: underline; }
</style>
<div id="overlay" class="team-choice-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="tc-title">
  <div class="team-choice-modal">
    <h2 id="tc-title">Create or join a team</h2>
    <p class="subtitle" id="tc-subtitle">Teams let you share files with collaborators. Pick an option below — you can change this later from the dashboard.</p>
    <div id="content"></div>
    <div class="team-choice-actions" id="actions"></div>
  </div>
</div>`;

export class PenpotOnboardingTeamChoice extends PenpotElement {
  _template = template;
  #view = 'options'; // 'options' | 'join-invite'

  connectedCallback() {
    super.connectedCallback();
    const overlay = this.querySelector('#overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    this.#render();
  }

  #render() {
    const content = this.querySelector('#content');
    const actions = this.querySelector('#actions');
    if (this.#view === 'options') {
      this.#renderOptions(content, actions);
    } else {
      this.#renderJoinForm(content, actions);
    }
  }

  #renderOptions(content, actions) {
    content.innerHTML = `<div class="team-choice-options">
      <button class="team-choice-card" data-action="create-team" type="button">
        <div class="team-choice-card-emoji">✨</div>
        <div class="team-choice-card-title">Create a new team</div>
        <div class="team-choice-card-desc">Start fresh. You can invite teammates and create projects right away.</div>
      </button>
      <button class="team-choice-card" data-action="join-invite" type="button">
        <div class="team-choice-card-emoji">📨</div>
        <div class="team-choice-card-title">Join via invite link</div>
        <div class="team-choice-card-desc">Paste an invite token to join a team that someone has invited you to.</div>
      </button>
    </div>`;
    actions.innerHTML = `<button class="team-choice-btn-ghost" data-action="skip">Skip for now</button>`;

    content.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => this.#onAction(btn.dataset.action));
    });
    actions.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => this.#onAction(btn.dataset.action));
    });
  }

  #renderJoinForm(content, actions) {
    const subtitle = this.querySelector('#tc-subtitle');
    if (subtitle) subtitle.textContent = 'Paste the invite token you received in your email.';
    content.innerHTML = `<div class="team-choice-invite-form">
      <label for="invite-token-input">Invite token</label>
      <input type="text" id="invite-token-input" placeholder="Paste invite token here">
    </div>`;
    actions.innerHTML = `<button class="team-choice-back-btn" data-action="back">← Back</button>
      <button class="team-choice-btn" data-action="join-submit">Join Team</button>`;

    actions.querySelector('[data-action="back"]').addEventListener('click', () => {
      const subtitle = this.querySelector('#tc-subtitle');
      if (subtitle) subtitle.textContent = 'Teams let you share files with collaborators. Pick an option below — you can change this later from the dashboard.';
      this.#view = 'options';
      this.#render();
    });
    actions.querySelector('[data-action="join-submit"]').addEventListener('click', () => {
      const token = this.querySelector('#invite-token-input')?.value?.trim();
      if (!token) return;
      this.#finish({ action: 'join-invite', token });
    });
  }

  #onAction(action) {
    if (action === 'create-team') {
      this.#finish({ action: 'create-team' });
    } else if (action === 'join-invite') {
      this.#view = 'join-invite';
      this.#render();
    } else if (action === 'skip') {
      this.#finish({ action: 'skip' });
    } else if (action === 'back') {
      this.#view = 'options';
      this.#render();
    } else if (action === 'join-submit') {
      const token = this.querySelector('#invite-token-input')?.value?.trim();
      if (!token) return;
      this.#finish({ action: 'join-invite', token });
    }
  }

  #finish(payload) {
    const overlay = this.querySelector('#overlay');
    if (overlay) overlay.style.display = 'none';
    localStorage.setItem('penpot-team-choice-done', '1');
    this.emit('team-choice-complete', payload);
  }

  show() {
    const overlay = this.querySelector('#overlay');
    if (overlay) overlay.style.display = 'flex';
    this.#render();
  }

  reset() {
    localStorage.removeItem('penpot-team-choice-done');
    this.#view = 'options';
    this.show();
  }

  render() {}
}

customElements.define('penpot-onboarding-team-choice', PenpotOnboardingTeamChoice);
