'use strict';
/**
 * @module penpot-team-form
 * @description WU-T3: Team form (Create or Edit) — captures name, description
 * (≤500 chars), color (3- or 6-digit hex), and optional team photo.
 *
 * Server side:
 *   - `create-team` and `update-team` RPCs accept a `features` object with
 *     `description` and `color` sub-keys.
 *   - The RPC validates and clamps the description to 500 chars, validates
 *     the color against `/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/`, and persists
 *     both into `team.features` (JSON column).
 *   - Logo upload uses the existing `update-team-photo` RPC (multipart).
 *
 * Modes:
 *   - `mode="create"`  — calls `create-team` with the entered fields
 *   - `mode="edit"`    — pre-fills fields from `team` prop; calls `update-team` and `update-team-photo`
 *
 * Emits `team-form-submit` (success) and `team-form-cancel` events.
 */

import { PenpotElement } from './base.js';
import { cmd } from '../lib/rpc.js';

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#6366f1', '#a855f7', '#ec4899', '#f59e0b',
];

const template = document.createElement('template');
template.innerHTML = `<style>
  penpot-team-form { display: block; }
  .penpot-tform-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: var(--penpot-z-overlay, 1000); display: flex; align-items: center; justify-content: center; }
  .penpot-tform-modal { background: var(--penpot-surface, #2a2a2a); border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-m, 8px); padding: var(--penpot-spacing-xl, 24px); max-width: 520px; width: 90%; color: var(--penpot-text, #e6e6e6); }
  .penpot-tform-modal h2 { margin: 0 0 var(--penpot-spacing-m, 12px); font-size: var(--penpot-font-size-xl, 20px); color: var(--penpot-primary, #31efb8); }
  .penpot-tform-field { margin-bottom: var(--penpot-spacing-m, 12px); }
  .penpot-tform-label { display: block; font-size: var(--penpot-font-size-s, 11px); color: var(--penpot-text-dim, #999); margin-bottom: var(--penpot-spacing-s, 8px); text-transform: uppercase; letter-spacing: 0.5px; }
  .penpot-tform-label-row { display: flex; justify-content: space-between; align-items: baseline; }
  .penpot-tform-label-counter { font-size: 10px; color: var(--penpot-text-dim, #999); text-transform: none; letter-spacing: 0; }
  .penpot-tform-input, .penpot-tform-textarea { width: 100%; box-sizing: border-box; background: var(--penpot-input-bg, #333); border: 1px solid var(--penpot-input-border, #555); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text, #e6e6e6); padding: 8px 12px; font-size: var(--penpot-font-size-m, 13px); font-family: inherit; outline: none; }
  .penpot-tform-input:focus, .penpot-tform-textarea:focus { border-color: var(--penpot-primary, #31efb8); }
  .penpot-tform-textarea { resize: vertical; min-height: 64px; max-height: 160px; font-family: inherit; }
  .penpot-tform-photo-row { display: flex; align-items: center; gap: var(--penpot-spacing-m, 12px); }
  .penpot-tform-photo-preview { width: 48px; height: 48px; border-radius: 50%; background: var(--penpot-surface-highest, #3c3c3c); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 600; color: var(--penpot-text-dim, #999); flex-shrink: 0; overflow: hidden; }
  .penpot-tform-photo-preview img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
  .penpot-tform-photo-btn { background: none; border: 1px solid var(--penpot-border, #444); border-radius: var(--penpot-radius-s, 4px); color: var(--penpot-text-dim, #999); font-size: 10px; cursor: pointer; padding: 4px 8px; font-family: inherit; }
  .penpot-tform-photo-btn:hover { border-color: var(--penpot-primary, #31efb8); color: var(--penpot-primary, #31efb8); }
  .penpot-tform-color-row { display: flex; gap: var(--penpot-spacing-s, 8px); flex-wrap: wrap; align-items: center; }
  .penpot-tform-color-swatch { width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; box-sizing: border-box; }
  .penpot-tform-color-swatch:hover { transform: scale(1.1); }
  .penpot-tform-color-swatch.penpot-tform-color-swatch--selected { border-color: var(--penpot-text, #e6e6e6); }
  .penpot-tform-color-input { width: 90px; font-family: 'SFMono-Regular', Consolas, monospace; }
  .penpot-tform-error { color: var(--penpot-danger, #f44); font-size: var(--penpot-font-size-s, 11px); margin-top: var(--penpot-spacing-s, 8px); }
  .penpot-tform-actions { display: flex; gap: var(--penpot-spacing-s, 8px); margin-top: var(--penpot-spacing-l, 16px); justify-content: flex-end; }
  .penpot-tform-btn-primary { background: var(--penpot-primary, #31efb8); color: #000; border: none; padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-xl, 24px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-m, 13px); font-weight: 600; font-family: inherit; }
  .penpot-tform-btn-primary:hover { background: var(--penpot-primary-hover, #28d4a3); }
  .penpot-tform-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .penpot-tform-btn-ghost { background: transparent; color: var(--penpot-text-dim, #999); border: 1px solid var(--penpot-border, #444); padding: var(--penpot-spacing-s, 8px) var(--penpot-spacing-xl, 24px); border-radius: var(--penpot-radius-s, 4px); cursor: pointer; font-size: var(--penpot-font-size-m, 13px); font-family: inherit; }
  .penpot-tform-btn-ghost:hover { background: var(--penpot-surface-high, #333); }
</style>
<div id="overlay" class="penpot-tform-overlay" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="tform-title">
  <div class="penpot-tform-modal">
    <h2 id="tform-title">Create team</h2>
    <form id="tform" autocomplete="off">
      <div class="penpot-tform-field">
        <label class="penpot-tform-label" for="tform-name">Team name</label>
        <input class="penpot-tform-input" id="tform-name" name="name" type="text" required placeholder="e.g. Design Team">
      </div>
      <div class="penpot-tform-field">
        <label class="penpot-tform-label" for="tform-photo">Team logo</label>
        <div class="penpot-tform-photo-row">
          <div class="penpot-tform-photo-preview" id="tform-photo-preview">T</div>
          <button type="button" class="penpot-tform-photo-btn" id="tform-photo-btn">Choose image…</button>
          <button type="button" class="penpot-tform-photo-btn" id="tform-photo-clear" style="display:none;">Remove</button>
        </div>
        <input type="file" id="tform-photo-input" accept="image/jpeg,image/png,image/webp" style="display:none;">
      </div>
      <div class="penpot-tform-field">
        <div class="penpot-tform-label-row">
          <label class="penpot-tform-label" for="tform-description">Description</label>
          <span class="penpot-tform-label-counter" id="tform-desc-counter">0 / 500</span>
        </div>
        <textarea class="penpot-tform-textarea" id="tform-description" name="description" rows="2" maxlength="500" placeholder="Optional. Tell people what this team is about."></textarea>
      </div>
      <div class="penpot-tform-field">
        <label class="penpot-tform-label">Team color</label>
        <div class="penpot-tform-color-row" id="tform-color-row"></div>
        <input class="penpot-tform-input penpot-tform-color-input" id="tform-color-input" name="color" type="text" maxlength="7" pattern="#[0-9a-fA-F]{3,6}" placeholder="#3b82f6">
      </div>
      <div class="penpot-tform-error" id="tform-error" style="display:none;"></div>
      <div class="penpot-tform-actions">
        <button type="button" class="penpot-tform-btn-ghost" id="tform-cancel">Cancel</button>
        <button type="submit" class="penpot-tform-btn-primary" id="tform-submit">Create</button>
      </div>
    </form>
  </div>
</div>`;

export class PenpotTeamForm extends PenpotElement {
  _template = template;
  #mode = 'create';
  #team = null;
  #photoFile = null;
  #photoUrl = null;

  static get observedAttributes() {
    return ['mode', 'team-id', 'team-name', 'team-photo-id', 'team-description', 'team-color'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'mode') this.#mode = newValue === 'edit' ? 'edit' : 'create';
    if (this.isConnected) this.#applyAttributes();
  }

  connectedCallback() {
    super.connectedCallback();
    this.#applyAttributes();
    this.#renderColorPalette();
    this.#wireEvents();
  }

  set team(value) {
    this.#team = value;
    if (this.isConnected) this.#applyAttributes();
  }

  get team() {
    return this.#team;
  }

  set mode(value) {
    this.#mode = value === 'edit' ? 'edit' : 'create';
    if (this.isConnected) this.#applyAttributes();
  }

  #applyAttributes() {
    const team = this.#team || {};
    const features = this.#parseFeatures(team.features);
    const title = this.querySelector('#tform-title');
    const submit = this.querySelector('#tform-submit');
    const nameInput = this.querySelector('#tform-name');
    const descInput = this.querySelector('#tform-description');
    const colorInput = this.querySelector('#tform-color-input');
    const photoPreview = this.querySelector('#tform-photo-preview');
    const clearBtn = this.querySelector('#tform-photo-clear');

    if (this.#mode === 'edit') {
      if (title) title.textContent = 'Edit team';
      if (submit) submit.textContent = 'Save';
    } else {
      if (title) title.textContent = 'Create team';
      if (submit) submit.textContent = 'Create';
    }

    if (nameInput) nameInput.value = team.name || '';
    if (descInput) {
      descInput.value = features.description || '';
      this.#updateDescCounter();
    }
    if (colorInput) colorInput.value = features.color || '#3b82f6';
    if (photoPreview) {
      const photoId = team.photoId || team.photo_id;
      if (photoId) {
        photoPreview.innerHTML = `<img src="/assets/by-id/${this.escAttr(photoId)}" alt="Team photo">`;
        if (clearBtn) clearBtn.style.display = 'inline-block';
      } else {
        photoPreview.textContent = (team.name || 'T').charAt(0).toUpperCase();
        if (clearBtn) clearBtn.style.display = 'none';
      }
    }
  }

  #parseFeatures(features) {
    if (!features) return {};
    if (typeof features === 'string') {
      try { return JSON.parse(features); } catch { return {}; }
    }
    return features;
  }

  #renderColorPalette() {
    const row = this.querySelector('#tform-color-row');
    if (!row) return;
    let html = '';
    for (const c of PALETTE) {
      html += `<button type="button" class="penpot-tform-color-swatch" data-color="${c}" style="background:${c}" title="${c}"></button>`;
    }
    row.innerHTML = html;
  }

  #wireEvents() {
    this.querySelector('#tform-cancel')?.addEventListener('click', () => {
      this.#close(false);
    });

    this.querySelector('#tform-photo-btn')?.addEventListener('click', () => {
      this.querySelector('#tform-photo-input')?.click();
    });

    this.querySelector('#tform-photo-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.#setPhotoFile(file);
    });

    this.querySelector('#tform-photo-clear')?.addEventListener('click', () => {
      this.#photoFile = null;
      this.#photoUrl = null;
      const team = this.#team || {};
      const preview = this.querySelector('#tform-photo-preview');
      const clearBtn = this.querySelector('#tform-photo-clear');
      const photoId = team.photoId || team.photo_id;
      if (photoId) {
        if (preview) preview.innerHTML = `<img src="/assets/by-id/${this.escAttr(photoId)}" alt="">`;
        if (clearBtn) clearBtn.style.display = 'inline-block';
      } else {
        const name = this.querySelector('#tform-name')?.value || 'T';
        if (preview) preview.textContent = name.charAt(0).toUpperCase();
        if (clearBtn) clearBtn.style.display = 'none';
      }
    });

    this.querySelector('#tform-color-row')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-color]');
      if (!btn) return;
      const color = btn.dataset.color;
      const input = this.querySelector('#tform-color-input');
      if (input) {
        input.value = color;
        this.#renderColorPalette();
        this.#updateColorSelection();
      }
    });

    this.querySelector('#tform-color-input')?.addEventListener('input', () => {
      this.#updateColorSelection();
    });

    this.querySelector('#tform-name')?.addEventListener('input', () => {
      const preview = this.querySelector('#tform-photo-preview');
      const photoId = this.#team?.photoId || this.#team?.photo_id;
      if (preview && !photoId && !this.#photoFile && !preview.querySelector('img')) {
        const name = this.querySelector('#tform-name')?.value || 'T';
        preview.textContent = name.charAt(0).toUpperCase();
      }
    });

    this.querySelector('#tform-description')?.addEventListener('input', () => {
      this.#updateDescCounter();
    });

    this.querySelector('#tform')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.#submit();
    });

    this.querySelector('#overlay')?.addEventListener('click', (e) => {
      if (e.target === this.querySelector('#overlay')) this.#close(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.querySelector('#overlay')?.style.display === 'flex') {
        this.#close(false);
      }
    });

    this.#updateColorSelection();
  }

  #updateDescCounter() {
    const input = this.querySelector('#tform-description');
    const counter = this.querySelector('#tform-desc-counter');
    if (!input || !counter) return;
    const len = input.value.length;
    counter.textContent = `${len} / 500`;
    counter.style.color = len > 500 ? 'var(--penpot-danger, #f44)' : '';
  }

  #updateColorSelection() {
    const input = this.querySelector('#tform-color-input');
    if (!input) return;
    const current = (input.value || '').trim().toLowerCase();
    this.querySelectorAll('.penpot-tform-color-swatch').forEach(sw => {
      const c = sw.dataset.color?.toLowerCase();
      sw.classList.toggle('penpot-tform-color-swatch--selected', c === current);
    });
  }

  #setPhotoFile(file) {
    this.#photoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.#photoUrl = e.target.result;
      const preview = this.querySelector('#tform-photo-preview');
      const clearBtn = this.querySelector('#tform-photo-clear');
      if (preview) preview.innerHTML = `<img src="${e.target.result}" alt="Team photo preview">`;
      if (clearBtn) clearBtn.style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
  }

  #setError(msg) {
    const err = this.querySelector('#tform-error');
    if (!err) return;
    if (msg) { err.textContent = msg; err.style.display = 'block'; }
    else { err.textContent = ''; err.style.display = 'none'; }
  }

  async #submit() {
    const submit = this.querySelector('#tform-submit');
    if (submit) { submit.disabled = true; submit.textContent = 'Saving...'; }
    this.#setError('');

    const name = this.querySelector('#tform-name')?.value.trim() || '';
    const description = (this.querySelector('#tform-description')?.value || '').trim();
    const color = (this.querySelector('#tform-color-input')?.value || '').trim();

    if (!name) {
      this.#setError('Team name is required');
      if (submit) { submit.disabled = false; submit.textContent = this.#mode === 'edit' ? 'Save' : 'Create'; }
      return;
    }

    // Validate color format
    if (color && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
      this.#setError('Color must be a valid hex color (e.g. #3b82f6)');
      if (submit) { submit.disabled = false; submit.textContent = this.#mode === 'edit' ? 'Save' : 'Create'; }
      return;
    }

    const features = {};
    if (description) features.description = description.slice(0, 500);
    if (color) features.color = color;

    try {
      let result;
      if (this.#mode === 'edit' && this.#team && this.#team.id) {
        result = await cmd('update-team', {
          id: this.#team.id,
          name,
          features,
        });
        if (this.#photoFile) {
          try {
            await cmd('update-team-photo', { teamId: this.#team.id }, { file: this.#photoFile });
          } catch (photoErr) {
            console.warn('[team-form] photo upload failed:', photoErr.message);
          }
        }
      } else {
        result = await cmd('create-team', { name, features });
        if (this.#photoFile && result && result.id) {
          try {
            await cmd('update-team-photo', { teamId: result.id }, { file: this.#photoFile });
          } catch (photoErr) {
            console.warn('[team-form] photo upload failed:', photoErr.message);
          }
        }
      }
      this.#close(true, result);
    } catch (err) {
      this.#setError(err.hint || err.message || 'Failed to save team');
      if (submit) { submit.disabled = false; submit.textContent = this.#mode === 'edit' ? 'Save' : 'Create'; }
    }
  }

  #close(success, team) {
    const overlay = this.querySelector('#overlay');
    if (overlay) overlay.style.display = 'none';
    this.#setError('');
    this.#photoFile = null;
    this.#photoUrl = null;
    this.emit(success ? 'team-form-submit' : 'team-form-cancel', { team });
  }

  show() {
    const overlay = this.querySelector('#overlay');
    if (overlay) overlay.style.display = 'flex';
    this.#applyAttributes();
    this.#updateDescCounter();
    this.#updateColorSelection();
  }

  hide() {
    const overlay = this.querySelector('#overlay');
    if (overlay) overlay.style.display = 'none';
  }

  render() {}
}

customElements.define('penpot-team-form', PenpotTeamForm);
