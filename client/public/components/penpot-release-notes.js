'use strict';
import { PenpotElement } from './base.js';

const CURRENT_VERSION = '2.17.0';
const STORAGE_KEY = 'penpot-release-notes-viewed';

const template = document.createElement('template');
template.innerHTML = `<style>
  penpot-release-notes { display: block; }
  .rn-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: var(--penpot-z-overlay, 1000); display: flex; align-items: center; justify-content: center; }
  .rn-modal { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-l, 12px); max-width: 560px; width: 90%; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; color: var(--penpot-text, #e6e6e6); box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
  .rn-header { padding: var(--penpot-spacing-xl, 24px) var(--penpot-spacing-xl, 24px) var(--penpot-spacing-m, 12px); flex-shrink: 0; }
  .rn-header h2 { margin: 0; font-size: var(--penpot-font-size-xl, 20px); color: var(--penpot-primary, #31efb8); display: flex; align-items: center; gap: var(--penpot-spacing-s, 8px); }
  .rn-version-badge { display: inline-block; font-size: var(--penpot-font-size-xs, 10px); background: var(--penpot-primary, #31efb8); color: #111; padding: 2px 8px; border-radius: var(--penpot-radius-s, 4px); font-weight: 600; vertical-align: middle; }
  .rn-body { flex: 1; overflow-y: auto; padding: 0 var(--penpot-spacing-xl, 24px); }
  .rn-highlights { display: flex; flex-direction: column; gap: var(--penpot-spacing-m, 12px); margin-bottom: var(--penpot-spacing-l, 16px); }
  .rn-highlight { display: flex; align-items: flex-start; gap: var(--penpot-spacing-m, 12px); padding: var(--penpot-spacing-s, 8px); border-radius: var(--penpot-radius-s, 4px); background: var(--penpot-surface-high, #333); }
  .rn-highlight-icon { font-size: 20px; flex-shrink: 0; width: 28px; text-align: center; line-height: 28px; }
  .rn-highlight-text { flex: 1; }
  .rn-highlight-title { font-weight: 600; font-size: var(--penpot-font-size-m, 13px); color: var(--penpot-text, #e6e6e6); margin: 0 0 2px; }
  .rn-highlight-desc { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin: 0; line-height: 1.4; }
  .rn-section-label { font-size: var(--penpot-font-size-xs, 10px); text-transform: uppercase; letter-spacing: 0.5px; color: var(--penpot-text-dim, #999); margin: var(--penpot-spacing-l, 16px) 0 var(--penpot-spacing-xs, 4px); }
  .rn-list { margin: 0 0 var(--penpot-spacing-m, 12px); padding-left: var(--penpot-spacing-l, 16px); }
  .rn-list li { font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); line-height: 1.5; margin-bottom: var(--penpot-spacing-xs, 4px); }
  .rn-nav { display: flex; align-items: center; justify-content: center; gap: var(--penpot-spacing-s, 8px); padding: var(--penpot-spacing-m, 12px) 0; flex-shrink: 0; }
  .rn-bullet { width: 8px; height: 8px; border-radius: 50%; background: var(--penpot-border, #444); cursor: pointer; border: none; padding: 0; }
  .rn-bullet:hover { background: var(--penpot-text-dim, #999); }
  .rn-bullet.rn-bullet-active { background: var(--penpot-primary, #31efb8); }
  .rn-footer { display: flex; gap: var(--penpot-spacing-s, 8px); padding: var(--penpot-spacing-m, 12px) var(--penpot-spacing-xl, 24px); justify-content: flex-end; border-top: 1px solid var(--penpot-border, #444); flex-shrink: 0; }
  .rn-btn { background: var(--penpot-primary, #31efb8); color: #000; border: none; padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-xl, 24px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-m, 13px); font-weight: 600; font-family: inherit; }
  .rn-btn:hover { background: var(--penpot-primary-hover, #28d4a3); }
  .rn-btn-ghost { background: transparent; color: var(--penpot-text-dim, #999); border: 1px solid var(--penpot-border, #444); padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-xl, 24px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-m, 13px); font-family: inherit; }
  .rn-btn-ghost:hover { background: var(--penpot-surface-high, #333); }
  .rn-slide { display: none; }
  .rn-slide.rn-slide-active { display: block; }
</style>
<div id="overlay" class="rn-overlay" style="display:none;">
  <div class="rn-modal" role="dialog" aria-modal="true" aria-labelledby="rn-title">
    <div class="rn-header">
      <h2 id="rn-title"></h2>
    </div>
    <div class="rn-body" id="slides-container"></div>
    <div class="rn-nav" id="bullets"></div>
    <div class="rn-footer">
      <button class="rn-btn-ghost" id="skip-btn">Skip</button>
      <button class="rn-btn" id="next-btn">Next</button>
    </div>
  </div>
</div>`;

export class PenpotReleaseNotes extends PenpotElement {
  _template = template;
  #slide = 0;
  #totalSlides = 0;
  #releaseData = null;
  #focusBeforeOpen = null;
  #wasShown = false;

  connectedCallback() {
    super.connectedCallback();
    this.#loadReleaseNotes();
  }

  async #loadReleaseNotes() {
    try {
      const resp = await fetch('/data/release-notes.json');
      if (!resp.ok) throw new Error(`[release-notes] fetch failed: ${resp.status}`);
      this.#releaseData = await resp.json();
    } catch (err) {
      console.warn('[release-notes]', err.message);
      this.#releaseData = { currentVersion: CURRENT_VERSION, releases: [] };
    }
    this.#checkAutoShow();
    this.#bindEvents();
  }

  #checkAutoShow() {
    const viewed = localStorage.getItem(STORAGE_KEY);
    if (viewed !== this.#releaseData.currentVersion) {
      this.open();
    }
  }

  #bindEvents() {
    const nextBtn = this.querySelector('#next-btn');
    const skipBtn = this.querySelector('#skip-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => this.#handleNext());
    if (skipBtn) skipBtn.addEventListener('click', () => this.close());

    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      if (e.key === 'Tab') this.#trapFocus(e);
    });

    const overlay = this.querySelector('#overlay');
    if (overlay) overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
  }

  #trapFocus(e) {
    const modal = this.querySelector('.rn-modal');
    if (!modal) return;
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  open() {
    const overlay = this.querySelector('#overlay');
    if (!overlay) return;
    this.#focusBeforeOpen = document.activeElement;
    this.#slide = 0;
    if (!this.#renderSlides()) return;
    this.#wasShown = true;
    overlay.style.display = 'flex';
    this.emit('release-notes-open');
    requestAnimationFrame(() => {
      const firstBtn = this.querySelector('#next-btn');
      if (firstBtn) firstBtn.focus();
    });
  }

  close() {
    const overlay = this.querySelector('#overlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    if (this.#wasShown) {
      localStorage.setItem(STORAGE_KEY, this.#releaseData?.currentVersion || CURRENT_VERSION);
      this.#wasShown = false;
    }
    this.emit('release-notes-close');
    if (this.#focusBeforeOpen) {
      this.#focusBeforeOpen.focus();
      this.#focusBeforeOpen = null;
    }
  }

  #handleNext() {
    this.#slide++;
    if (this.#slide >= this.#totalSlides) {
      this.close();
    } else {
      this.#renderCurrentSlide();
      this.#renderBullets();
    }
  }

  #renderSlides() {
    const release = this.#releaseData?.releases?.[0];
    if (!release) return false;

    const container = this.querySelector('#slides-container');
    const title = this.querySelector('#rn-title');
    const nextBtn = this.querySelector('#next-btn');
    if (!container || !title) return false;

    title.innerHTML = `${this.escHtml(release.title)} <span class="rn-version-badge">${this.escHtml(release.version)}</span>`;

    const slides = [];
    if (release.highlights?.length) {
      const highlightsHtml = release.highlights.map((h) =>
        `<div class="rn-highlight">
          <div class="rn-highlight-icon">${this.escHtml(h.icon)}</div>
          <div class="rn-highlight-text">
            <p class="rn-highlight-title">${this.escHtml(h.title)}</p>
            <p class="rn-highlight-desc">${this.escHtml(h.description)}</p>
          </div>
        </div>`
      ).join('');
      slides.push(`<div class="rn-slide" data-slide="0"><div class="rn-highlights">${highlightsHtml}</div></div>`);
    }

    if (release.features?.length) {
      const itemsHtml = release.features.map((f) => `<li>${this.escHtml(f)}</li>`).join('');
      slides.push(`<div class="rn-slide" data-slide="${slides.length}"><div class="rn-section-label">New Features & Enhancements</div><ul class="rn-list">${itemsHtml}</ul></div>`);
    }

    if (release.fixes?.length) {
      const itemsHtml = release.fixes.map((f) => `<li>${this.escHtml(f)}</li>`).join('');
      slides.push(`<div class="rn-slide" data-slide="${slides.length}"><div class="rn-section-label">Bugs Fixed</div><ul class="rn-list">${itemsHtml}</ul></div>`);
    }

    if (slides.length === 0) return false;

    this.#totalSlides = slides.length;
    container.innerHTML = slides.join('');
    this.#renderCurrentSlide();
    this.#renderBullets();

    if (nextBtn) {
      nextBtn.textContent = this.#totalSlides <= 1 ? "Let's Go" : 'Next';
    }
    return true;
  }

  #renderCurrentSlide() {
    const slides = this.querySelectorAll('.rn-slide');
    slides.forEach((s, i) => {
      s.classList.toggle('rn-slide-active', i === this.#slide);
    });

    const nextBtn = this.querySelector('#next-btn');
    if (nextBtn) {
      nextBtn.textContent = this.#slide >= this.#totalSlides - 1 ? "Let's Go" : 'Next';
    }
  }

  #renderBullets() {
    const container = this.querySelector('#bullets');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < this.#totalSlides; i++) {
      const bullet = document.createElement('button');
      bullet.className = 'rn-bullet' + (i === this.#slide ? ' rn-bullet-active' : '');
      bullet.setAttribute('aria-label', `Go to slide ${i + 1}`);
      bullet.addEventListener('click', () => {
        this.#slide = i;
        this.#renderCurrentSlide();
        this.#renderBullets();
      });
      container.appendChild(bullet);
    }
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.open();
  }

  render() {}
}

customElements.define('penpot-release-notes', PenpotReleaseNotes);