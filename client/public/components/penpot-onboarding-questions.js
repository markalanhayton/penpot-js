'use strict';
/**
 * @module penpot-onboarding-questions
 * @description WU-T2: Intro questions overlay shown on first login.
 * Three question steps: role, team size, primary use case.
 * Persists answers to `profile.props.onboarding-*` via `update-profile-props` RPC.
 * Emits `intro-questions-complete` event with the answers when finished.
 */

import { PenpotElement } from './base.js';
import { cmd } from '../lib/rpc.js';

const template = document.createElement('template');
template.innerHTML = `<style>
  penpot-onboarding-questions { display: block; }
  .intro-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: var(--penpot-z-overlay, 1000); display: flex; align-items: center; justify-content: center; }
  .intro-modal { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-xl, 24px); max-width: 520px; width: 90%; color: var(--penpot-text, #e6e6e6); }
  .intro-modal h2 { margin: 0 0 var(--penpot-spacing-s, 8px); font-size: var(--penpot-font-size-xl, 20px); color: var(--penpot-primary, #31efb8); }
  .intro-modal p.subtitle { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin: 0 0 var(--penpot-spacing-l, 16px); }
  .intro-step { margin-bottom: var(--penpot-spacing-l, 16px); }
  .intro-step-label { display: block; font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin-bottom: var(--penpot-spacing-s, 8px); text-transform: uppercase; letter-spacing: 0.5px; }
  .intro-step-options { display: flex; flex-direction: column; gap: var(--penpot-spacing-s, 8px); }
  .intro-option { background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); padding: 10px 14px; cursor: pointer; color: var(--penpot-text, #e6e6e6); font-size: var(--penpot-font-size-m, 13px); font-family: inherit; text-align: left; }
  .intro-option:hover { border-color: var(--penpot-primary, #31efb8); color: var(--penpot-primary, #31efb8); }
  .intro-option.intro-option--selected { background: rgba(49,239,184,0.15); border-color: var(--penpot-primary, #31efb8); color: var(--penpot-primary, #31efb8); }
  .intro-step-emoji { font-size: 18px; margin-right: 8px; }
  .intro-step-desc { display: block; font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin-top: 2px; }
  .intro-actions { display: flex; gap: var(--penpot-spacing-s, 8px); margin-top: var(--penpot-spacing-l, 16px); justify-content: flex-end; }
  .intro-btn-primary { background: var(--penpot-primary, #31efb8); color: #000; border: none; padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-xl, 24px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-m, 13px); font-weight: 600; font-family: inherit; }
  .intro-btn-primary:hover { background: var(--penpot-primary-hover, #28d4a3); }
  .intro-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .intro-btn-ghost { background: transparent; color: var(--penpot-text-dim, #999); border: 1px solid var(--penpot-border, #444); padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-xl, 24px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-m, 13px); font-family: inherit; }
  .intro-btn-ghost:hover { background: var(--penpot-surface-high, #333); }
</style>
<div id="overlay" class="intro-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="intro-title">
  <div class="intro-modal">
    <h2 id="intro-title">Quick questions</h2>
    <p class="subtitle">Help us personalize your experience. Your answers are private and only used to improve the product.</p>
    <div id="content"></div>
    <div class="intro-actions">
      <button class="intro-btn-ghost" id="skip-btn">Skip</button>
      <button class="intro-btn-primary" id="next-btn" disabled>Next</button>
    </div>
  </div>
</div>`;

const ROLES = [
  { value: 'designer', emoji: '🎨', label: 'Designer', desc: 'I design interfaces, web pages, or visual assets.' },
  { value: 'developer', emoji: '💻', label: 'Developer', desc: 'I build software, web apps, or APIs.' },
  { value: 'pm', emoji: '📊', label: 'Product Manager', desc: 'I manage products, projects, or teams.' },
  { value: 'other', emoji: '👋', label: 'Other', desc: 'None of the above — I wear multiple hats.' },
];

const TEAM_SIZES = [
  { value: '1', emoji: '🧍', label: 'Just me', desc: 'Solo designer or developer.' },
  { value: '2-5', emoji: '👥', label: '2 – 5 people', desc: 'Small team.' },
  { value: '6-20', emoji: '👨\u200d👩\u200d👧\u200d👦', label: '6 – 20 people', desc: 'Growing team.' },
  { value: '20+', emoji: '🏢', label: '20+ people', desc: 'Larger organization.' },
];

const USE_CASES = [
  { value: 'web-design', emoji: '🌐', label: 'Web design', desc: 'Marketing sites, landing pages, web apps.' },
  { value: 'product-design', emoji: '📱', label: 'Product design', desc: 'Mobile apps, SaaS products, design systems.' },
  { value: 'prototyping', emoji: '✏️', label: 'Prototyping', desc: 'Wireframes, mockups, user flows.' },
  { value: 'handoff', emoji: '🤝', label: 'Designer-to-dev handoff', desc: 'Hand-off specs, dev-friendly exports.' },
  { value: 'other', emoji: '🌟', label: 'Something else', desc: 'I use it for a different purpose.' },
];

const STEPS = [
  { prop: 'onboarding-role', question: 'What best describes your role?', options: ROLES },
  { prop: 'onboarding-team-size', question: 'How many people are on your team?', options: TEAM_SIZES },
  { prop: 'onboarding-use-case', question: 'What will you use Penpot for?', options: USE_CASES },
];

export class PenpotOnboardingQuestions extends PenpotElement {
  _template = template;
  #step = 0;
  #answers = {};

  connectedCallback() {
    super.connectedCallback();
    const overlay = this.querySelector('#overlay');
    if (!overlay) return;

    if (localStorage.getItem('penpot-intro-questions-done')) {
      overlay.style.display = 'none';
      return;
    }

    overlay.style.display = 'flex';
    this.#renderStep();

    this.querySelector('#skip-btn').addEventListener('click', () => this.#finish({}));
    this.querySelector('#next-btn').addEventListener('click', () => this.#advance());
  }

  #renderStep() {
    const content = this.querySelector('#content');
    const nextBtn = this.querySelector('#next-btn');
    if (!content) return;

    const step = STEPS[this.#step];
    if (!step) return;

    let html = `<div class="intro-step" data-step-prop="${step.prop}">
      <span class="intro-step-label">${this.escHtml(step.question)}</span>
      <div class="intro-step-options">`;

    for (const opt of step.options) {
      const isSelected = this.#answers[step.prop] === opt.value;
      html += `<button class="intro-option ${isSelected ? 'intro-option--selected' : ''}" data-value="${this.escAttr(opt.value)}" type="button">
        <span class="intro-step-emoji">${opt.emoji}</span>
        <strong>${this.escHtml(opt.label)}</strong>
        <span class="intro-step-desc">${this.escHtml(opt.desc)}</span>
      </button>`;
    }
    html += '</div></div>';

    content.innerHTML = html;
    nextBtn.textContent = this.#step >= STEPS.length - 1 ? 'Finish' : 'Next';
    nextBtn.disabled = !this.#answers[step.prop];

    content.querySelectorAll('.intro-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#answers[step.prop] = btn.dataset.value;
        this.#renderStep();
      });
    });
  }

  #advance() {
    const step = STEPS[this.#step];
    if (!this.#answers[step.prop]) return;
    if (this.#step >= STEPS.length - 1) {
      this.#finish(this.#answers);
    } else {
      this.#step++;
      this.#renderStep();
    }
  }

  async #finish(answers) {
    const overlay = this.querySelector('#overlay');
    if (overlay) overlay.style.display = 'none';
    localStorage.setItem('penpot-intro-questions-done', '1');

    // Persist answers to profile.props (best-effort)
    if (answers && Object.keys(answers).length > 0) {
      try {
        await cmd('update-profile-props', { props: answers });
      } catch (err) {
        console.warn('[onboarding-questions] persist failed:', err.message);
      }
    }

    // Mark as viewed in props (so the flow doesn't repeat)
    try {
      await cmd('update-profile-props', { props: { 'onboarding-viewed': true } });
    } catch (err) {
      console.warn('[onboarding-questions] mark viewed failed:', err.message);
    }

    this.emit('intro-questions-complete', { answers });
  }

  show() {
    const overlay = this.querySelector('#overlay');
    if (overlay) overlay.style.display = 'flex';
    this.#renderStep();
  }

  reset() {
    localStorage.removeItem('penpot-intro-questions-done');
    this.#step = 0;
    this.#answers = {};
    this.show();
  }

  render() {}
}

customElements.define('penpot-onboarding-questions', PenpotOnboardingQuestions);
