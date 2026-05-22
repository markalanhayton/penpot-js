import { PenpotElement } from './base.js';
import { cmd } from '../lib/rpc.js';

const template = document.createElement('template');
template.innerHTML = `<style>

    penpot-comment-panel { --cm-bg: #2a2a2a; --cm-border: #444; --cm-primary: #31efb8; --cm-text: #e6e6e6; --cm-dim: #999; }
    .penpot-comment__comment-panel { display: flex; flex-direction: column; height: 100%; background: var(--cm-bg); }
    .penpot-comment__comment-header { padding: 8px 12px; border-bottom: 1px solid var(--cm-border); display: flex; align-items: center; justify-content: space-between; }
    .penpot-comment__comment-title { font-size: 12px; font-weight: 600; color: var(--cm-text); }
    .penpot-comment__comment-close { background: none; border: none; color: var(--cm-dim); cursor: pointer; font-size: 16px; padding: 2px; }
    .penpot-comment__comment-close:hover { color: var(--cm-text); }
    .penpot-comment__comment-list { flex: 1; overflow-y: auto; padding: 8px; }
    .penpot-comment__comment-item { margin-bottom: 12px; }
    .penpot-comment__comment-bubble { background: #333; border-radius: 8px; padding: 8px 12px; }
    .penpot-comment__comment-author { font-size: 11px; font-weight: 600; color: var(--cm-primary); margin-bottom: 4px; }
    .penpot-comment__comment-text { font-size: 12px; color: var(--cm-text); line-height: 1.4; }
    .penpot-comment__comment-time { font-size: 9px; color: var(--cm-dim); margin-top: 4px; }
    .penpot-comment__comment-input-area { padding: 8px 12px; border-top: 1px solid var(--cm-border); display: flex; gap: 8px; }
    .penpot-comment__comment-input { flex: 1; background: #333; border: 1px solid #555; border-radius: 4px; color: var(--cm-text); padding: 6px 10px; font-size: 12px; outline: none; resize: none; min-height: 32px; font-family: inherit; }
    .penpot-comment__comment-input:focus { border-color: var(--cm-primary); }
    .penpot-comment__comment-send { background: var(--cm-primary); color: #111; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-weight: 600; }
    .penpot-comment__comment-send:hover { background: #28d4a3; }
    .penpot-comment__comment-send:disabled { opacity: 0.4; cursor: not-allowed; }
    .penpot-comment__empty-state { color: var(--cm-dim); text-align: center; padding: 24px 12px; font-size: 12px; }
  
  </style>
  <div class="penpot-comment__comment-panel">
    <div class="penpot-comment__comment-header">
      <span class="penpot-comment__comment-title">Comments</span>
      <button class="penpot-comment__comment-close" id="close-btn">&times;</button>
    </div>
    <div class="penpot-comment__comment-list" id="comment-list">
      <div class="penpot-comment__empty-state">No comments yet. Click on the canvas to add one.</div>
    </div>
    <div class="penpot-comment__comment-input-area">
      <textarea class="penpot-comment__comment-input" id="comment-input" placeholder="Add a comment..." rows="1"></textarea>
      <button class="penpot-comment__comment-send" id="send-btn" disabled>Send</button>
    </div>
  </div>`;

export class PenpotCommentPanel extends PenpotElement {
  #comments = [];
  #fileId = null;

  constructor() {
    super();
this.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    super.connectedCallback();

    this.querySelector('#close-btn').addEventListener('click', () => {
      this.emit('penpot-comment-close', {});
    });

    const input = this.querySelector('#comment-input');
    const sendBtn = this.querySelector('#send-btn');

    input.addEventListener('input', () => {
      sendBtn.disabled = !input.value.trim();
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.#submitComment();
      }
    });

    sendBtn.addEventListener('click', () => this.#submitComment());
  }

  set comments(val) {
    this.#comments = val || [];
    this.#renderComments();
  }

  get comments() { return this.#comments; }

  set fileId(id) {
    this.#fileId = id;
    this.#loadComments();
  }

  async #loadComments() {
    if (!this.#fileId) return;
    try {
      const result = await cmd('get-file-comments', { id: this.#fileId });
      this.#comments = Array.isArray(result) ? result : [];
      this.#renderComments();
    } catch {
      this.#comments = [];
      this.#renderComments();
    }
  }

  #submitComment() {
    const input = this.querySelector('#comment-input');
    const text = input.value.trim();
    if (!text) return;

    const comment = {
      id: crypto.randomUUID(),
      author: appStore.get('profile')?.name || 'You',
      text,
      timestamp: new Date().toISOString(),
      x: 0,
      y: 0,
      pageId: null,
    };

    this.#comments = [...this.#comments, comment];
    input.value = '';
    input.style.height = 'auto';
    this.querySelector('#send-btn').disabled = true;
    this.#renderComments();
    this.emit('penpot-comment-create', { comment });
  }

  #renderComments() {
    const list = this.querySelector('#comment-list');
    if (!list) return;

    if (this.#comments.length === 0) {
      list.innerHTML = '<div class="penpot-comment__empty-state">No comments yet. Click on the canvas to add one.</div>';
      return;
    }

    let html = '';
    for (const c of this.#comments) {
      const time = c.timestamp ? new Date(c.timestamp).toLocaleString() : '';
      html += `<div class="penpot-comment__comment-item">
        <div class="penpot-comment__comment-bubble">
          <div class="penpot-comment__comment-author">${this.escHtml(c.author || 'Anonymous')}</div>
          <div class="penpot-comment__comment-text">${this.escHtml(c.text || '')}</div>
          <div class="penpot-comment__comment-time">${this.escHtml(time)}</div>
        </div>
      </div>`;
    }
    list.innerHTML = html;
  }

  render() {}
}

customElements.define('penpot-comment-panel', PenpotCommentPanel);