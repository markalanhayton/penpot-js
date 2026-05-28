'use strict';
import { PenpotElement } from './base.js';

const template = document.createElement('template');
template.innerHTML = `<style>
  :host { display: block; }
  .onboarding-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center; }
  .onboarding-modal { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-xl, 24px); max-width: 520px; width: 90%; color: var(--penpot-text, #e6e6e6); }
  .onboarding-modal h2 { margin: 0 0 var(--penpot-spacing-m, 12px); font-size: var(--penpot-font-size-xl, 20px); color: var(--penpot-primary, #31efb8); }
  .onboarding-modal p { font-size: var(--penpot-font-size-m, 13px); line-height: 1.5; color: var(--penpot-text-dim, #999); margin: 0 0 var(--penpot-spacing-m, 12px); }
  .onboarding-step { display: flex; align-items: flex-start; gap: var(--penpot-spacing-m, 12px); padding: var(--penpot-spacing-s, 8px) 0; border-bottom: 1px solid var(--penpot-border, #444); }
  .onboarding-step:last-child { border-bottom: none; }
  .onboarding-step-icon { font-size: 20px; flex-shrink: 0; width: 28px; text-align: center; }
  .onboarding-step-text { flex: 1; }
  .onboarding-step-text strong { color: var(--penpot-text, #e6e6e6); font-size: var(--penpot-font-size-m, 13px); }
  .onboarding-step-text span { display: block; font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin-top: 2px; }
  .onboarding-actions { display: flex; gap: var(--penpot-spacing-s, 8px); margin-top: var(--penpot-spacing-l, 16px); justify-content: flex-end; }
  .onboarding-btn { background: var(--penpot-primary, #31efb8); color: #000; border: none; padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-xl, 24px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-m, 13px); font-weight: 600; font-family: inherit; }
  .onboarding-btn:hover { background: var(--penpot-primary-hover, #28d4a3); }
  .onboarding-btn-ghost { background: transparent; color: var(--penpot-text-dim, #999); border: 1px solid var(--penpot-border, #444); padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-xl, 24px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-m, 13px); font-family: inherit; }
  .onboarding-btn-ghost:hover { background: var(--penpot-surface-high, #333); }
</style>
<div id="overlay" class="onboarding-overlay" style="display:none;">
  <div class="onboarding-modal">
    <h2 id="title">Welcome to Penpot</h2>
    <p id="subtitle">Here are some tips to get started with the design editor.</p>
    <div id="steps"></div>
    <div class="onboarding-actions">
      <button class="onboarding-btn-ghost" id="skip-btn">Skip</button>
      <button class="onboarding-btn" id="next-btn">Next</button>
    </div>
  </div>
</div>`;

const ONBOARDING_STEPS = [
  { icon: '🖱️', title: 'Select & Move', desc: 'Click shapes to select them. Drag to move. Use arrow keys for precise nudging.' },
  { icon: '✏️', title: 'Drawing Tools', desc: 'Use the toolbar on the left to draw rectangles, ellipses, frames, text, and paths.' },
  { icon: '⌨️', title: 'Keyboard Shortcuts', desc: 'Press Ctrl+/ to see all keyboard shortcuts. Ctrl+Z/Y for undo/redo, Ctrl+D to duplicate.' },
  { icon: '🎨', title: 'Properties Panel', desc: 'Select a shape and edit its fill, stroke, opacity, and more in the right sidebar.' },
  { icon: '📄', title: 'Pages & Layers', desc: 'Manage pages in the left sidebar. Expand the layers panel to organize your shapes.' },
  { icon: '💾', title: 'Auto-save', desc: 'Your work is saved automatically. Share files with your team using the Share button.' },
];

export class PenpotOnboarding extends PenpotElement {
  _template = template;
  #step = 0;

  connectedCallback() {
    super.connectedCallback();
    const overlay = this.querySelector('#overlay');
    if (!overlay) return;

    if (localStorage.getItem('penpot-onboarding-done')) {
      overlay.style.display = 'none';
      return;
    }

    overlay.style.display = 'flex';
    this.#renderStep();

    this.querySelector('#next-btn').addEventListener('click', () => {
      this.#step++;
      if (this.#step >= ONBOARDING_STEPS.length) {
        this.#finish();
      } else {
        this.#renderStep();
      }
    });

    this.querySelector('#skip-btn').addEventListener('click', () => {
      this.#finish();
    });
  }

  #renderStep() {
    const title = this.querySelector('#title');
    const subtitle = this.querySelector('#subtitle');
    const stepsEl = this.querySelector('#steps');
    const nextBtn = this.querySelector('#next-btn');

    title.textContent = this.#step === 0 ? 'Welcome to Penpot' : ONBOARDING_STEPS[this.#step].title;
    subtitle.textContent = this.#step === 0 ? 'Here are some tips to get started with the design editor.' : '';
    nextBtn.textContent = this.#step >= ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Next';

    let html = '';
    for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
      const step = ONBOARDING_STEPS[i];
      const isActive = i === this.#step;
      const opacity = isActive ? '1' : '0.5';
      html += `<div class="onboarding-step" style="opacity:${opacity}">
        <div class="onboarding-step-icon">${step.icon}</div>
        <div class="onboarding-step-text"><strong>${step.title}</strong><span>${step.desc}</span></div>
      </div>`;
    }
    stepsEl.innerHTML = html;
  }

  #finish() {
    const overlay = this.querySelector('#overlay');
    if (overlay) overlay.style.display = 'none';
    localStorage.setItem('penpot-onboarding-done', '1');
    this.emit('onboarding-complete');
  }

  show() {
    const overlay = this.querySelector('#overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  reset() {
    localStorage.removeItem('penpot-onboarding-done');
    this.#step = 0;
    this.#renderStep();
    this.show();
  }

  render() {}
}

customElements.define('penpot-onboarding', PenpotOnboarding);