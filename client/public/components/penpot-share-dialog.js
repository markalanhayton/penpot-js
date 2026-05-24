import { PenpotElement } from './base.js';
import { cmd, setAuthToken } from '../lib/rpc.js';
import { appStore } from '../lib/store.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-share-dialog { --share-bg: #2a2a2a; --share-border: #444; --share-primary: #31efb8; }
    .penpot-share__overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .penpot-share__dialog { background: var(--share-bg); border: 1px solid var(--share-border); border-radius: 8px; min-width: 440px; max-width: 500px; color: #e6e6e6; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
    .penpot-share__dialog-header { padding: 16px 20px; border-bottom: 1px solid var(--share-border); display: flex; align-items: center; justify-content: space-between; }
    .penpot-share__dialog-title { font-size: 15px; font-weight: 600; }
    .penpot-share__dialog-close { background: none; border: none; color: #999; font-size: 20px; cursor: pointer; padding: 4px; line-height: 1; }
    .penpot-share__dialog-close:hover { color: #e6e6e6; }
    .penpot-share__dialog-body { padding: 20px; }
    .penpot-share__share-input-group { margin-bottom: 16px; }
    .penpot-share__share-label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .penpot-share__share-link-row { display: flex; gap: 8px; }
    .penpot-share__share-link-input { flex: 1; background: #333; border: 1px solid #555; border-radius: 4px; color: #e6e6e6; padding: 8px 12px; font-size: 12px; outline: none; font-family: monospace; }
    .penpot-share__share-link-input:focus { border-color: var(--share-primary); }
    .penpot-share__share-copy-btn { background: none; border: 1px solid var(--share-border); border-radius: 4px; color: #e6e6e6; padding: 8px 12px; font-size: 11px; cursor: pointer; white-space: nowrap; }
    .penpot-share__share-copy-btn:hover { background: #333; }
    .penpot-share__share-copy-btn.penpot-share__copied { background: var(--share-primary); color: #111; border-color: var(--share-primary); }
    .penpot-share__permission-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--share-border); }
    .penpot-share__permission-row:last-child { border-bottom: none; }
    .penpot-share__perm-label { font-size: 12px; }
    .penpot-share__perm-select { background: #333; border: 1px solid #555; border-radius: 4px; color: #e6e6e6; padding: 4px 8px; font-size: 11px; outline: none; }
    .penpot-share__dialog-footer { padding: 12px 20px; border-top: 1px solid var(--share-border); display: flex; gap: 8px; justify-content: flex-end; }
    .penpot-share__btn { padding: 8px 16px; border-radius: 4px; font-size: 12px; cursor: pointer; border: 1px solid var(--share-border); background: none; color: #e6e6e6; }
    .penpot-share__btn:hover { background: #333; }
  
  </style>
  <div class="penpot-share__overlay" id="overlay">
    <div class="penpot-share__dialog">
      <div class="penpot-share__dialog-header">
        <span class="penpot-share__dialog-title">Share</span>
        <button class="penpot-share__dialog-close" id="close">&times;</button>
      </div>
      <div class="penpot-share__dialog-body">
        <div class="penpot-share__share-input-group">
          <div class="penpot-share__share-label">Share link</div>
          <div class="penpot-share__share-link-row">
            <input class="penpot-share__share-link-input" id="share-url" readonly>
            <button class="penpot-share__share-copy-btn" id="copy-btn">Copy</button>
          </div>
        </div>
        <div class="penpot-share__share-input-group">
          <div class="penpot-share__share-label">Permissions</div>
          <div class="penpot-share__permission-row">
            <span class="penpot-share__perm-label">Can view</span>
            <select class="penpot-share__perm-select" id="perm-view">
              <option value="none">No access</option>
              <option value="view" selected>View only</option>
            </select>
          </div>
          <div class="penpot-share__permission-row">
            <span class="penpot-share__perm-label">Can comment</span>
            <select class="penpot-share__perm-select" id="perm-comment">
              <option value="none" selected>None</option>
              <option value="comment">Can comment</option>
            </select>
          </div>
          <div class="penpot-share__permission-row">
            <span class="penpot-share__perm-label">Can edit</span>
            <select class="penpot-share__perm-select" id="perm-edit">
              <option value="none" selected>No</option>
              <option value="edit">Can edit</option>
            </select>
          </div>
        </div>
      </div>
      <div class="penpot-share__dialog-footer">
        <button class="penpot-share__btn" id="cancel-btn">Close</button>
      </div>
    </div>
  </div>`;

export class PenpotShareDialog extends PenpotElement {
  _template = template;
  #fileId = null;
  #shareUrl = '';

  static get observedAttributes() { return ['open']; }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'none';
    this.querySelector('#close').addEventListener('click', () => this.close());
    this.querySelector('#cancel-btn').addEventListener('click', () => this.close());
    this.querySelector('#overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close();
    });
    this.querySelector('#copy-btn').addEventListener('click', () => this.#copyLink());

    const permSelects = ['perm-view', 'perm-comment', 'perm-edit'];
    permSelects.forEach(id => {
      this.querySelector(`#${id}`).addEventListener('change', () => this.#updateShareLink());
    });
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'open') {
      this.style.display = newVal !== null ? '' : 'none';
    }
  }

  set fileId(id) {
    this.#fileId = id;
    this.#updateShareLink();
  }

  open(fileId) {
    if (fileId) this.#fileId = fileId;
    this.#updateShareLink();
    this.style.display = '';
    this.setAttribute('open', '');
  }

  close() {
    this.style.display = 'none';
    this.removeAttribute('open');
    this.emit('penpot-share-close', {});
  }

  #updateShareLink() {
    if (!this.#fileId) {
      this.querySelector('#share-url').value = '';
      return;
    }
    const viewPerm = this.querySelector('#perm-view').value;
    const commentPerm = this.querySelector('#perm-comment').value;
    const editPerm = this.querySelector('#perm-edit').value;
    const base = window.location.origin;
    const sharePath = `/share/${this.#fileId}`;
    const params = new URLSearchParams();
    if (viewPerm !== 'none') params.set('view', viewPerm);
    if (commentPerm !== 'none') params.set('comment', commentPerm);
    if (editPerm !== 'none') params.set('edit', editPerm);
    this.#shareUrl = `${base}${sharePath}${params.toString() ? '?' + params.toString() : ''}`;
    this.querySelector('#share-url').value = this.#shareUrl;

    cmd('update-file-share', {
      id: this.#fileId,
      permissions: {
        view: viewPerm !== 'none' ? viewPerm : null,
        comment: commentPerm !== 'none' ? commentPerm : null,
        edit: editPerm !== 'none' ? editPerm : null,
      },
    }).catch(() => {});
  }

  #copyLink() {
    const input = this.querySelector('#share-url');
    const btn = this.querySelector('#copy-btn');
    input.select();
    navigator.clipboard.writeText(this.#shareUrl).then(() => {
      btn.textContent = 'Copied!';
      btn.classList.add('penpot-share__copied');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('penpot-share__copied');
      }, 2000);
    }).catch(() => {
      document.execCommand('copy');
    });
  }

  render() {}
}

customElements.define('penpot-share-dialog', PenpotShareDialog);