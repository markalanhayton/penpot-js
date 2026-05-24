import { PenpotElement } from './base.js';
import { cmd } from '../lib/rpc.js';
import { appStore } from '../lib/store.js';

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
    .penpot-comment__comment-delete { background: none; border: none; color: var(--cm-dim); cursor: pointer; font-size: 10px; padding: 0 4px; float: right; }
    .penpot-comment__comment-delete:hover { color: #f44; }
    .penpot-comment__comment-resolve { background: none; border: 1px solid var(--cm-border); border-radius: 3px; color: var(--cm-dim); cursor: pointer; font-size: 9px; padding: 1px 6px; margin-left: 4px; }
    .penpot-comment__comment-resolve:hover { border-color: var(--cm-primary); color: var(--cm-primary); }
    .penpot-comment__comment-resolved { background: rgba(49,239,184,0.1); border: 1px solid rgba(49,239,184,0.3); border-radius: 3px; color: var(--cm-primary); font-size: 9px; padding: 1px 6px; cursor: pointer; margin-left: 4px; }
    .penpot-comment__comment-resolved:hover { opacity: 0.8; }
    .penpot-comment__comment-thread-resolved { opacity: 0.6; }
    .penpot-comment__comment-reply-btn { background: none; border: 1px solid var(--cm-border); border-radius: 3px; color: var(--cm-dim); font-size: 10px; padding: 2px 6px; cursor: pointer; margin-top: 4px; }
    .penpot-comment__comment-reply-btn:hover { color: var(--cm-text); border-color: var(--cm-text); }
    .penpot-comment__reply-area { margin-top: 4px; display: flex; gap: 4px; }
    .penpot-comment__reply-input { flex: 1; background: #333; border: 1px solid #555; border-radius: 4px; color: var(--cm-text); padding: 4px 8px; font-size: 11px; outline: none; font-family: inherit; }
    .penpot-comment__reply-input:focus { border-color: var(--cm-primary); }
    .penpot-comment__reply-send { background: var(--cm-primary); color: #111; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer; font-weight: 600; }
    .penpot-comment__comment-filter-bar { display: flex; gap: 4px; padding: 4px 8px; border-bottom: 1px solid var(--cm-border); }
    .penpot-comment__comment-filter-btn { background: #333; border: 1px solid var(--cm-border); border-radius: 3px; color: var(--cm-dim); font-size: 10px; padding: 2px 8px; cursor: pointer; }
    .penpot-comment__comment-filter-btn:hover { color: var(--cm-text); }
    .penpot-comment__comment-filter-btn.active { background: rgba(49,239,184,0.15); color: var(--cm-primary); border-color: var(--cm-primary); }
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
    <div class="penpot-comment__comment-filter-bar">
      <button class="penpot-comment__comment-filter-btn active" data-filter="open">Open</button>
      <button class="penpot-comment__comment-filter-btn" data-filter="resolved">Resolved</button>
      <button class="penpot-comment__comment-filter-btn" data-filter="all">All</button>
    </div>
    <div class="penpot-comment__comment-list" id="comment-list">
      <div class="penpot-comment__empty-state">No comments yet. Click on the canvas to add one.</div>
    </div>
    <div class="penpot-comment__comment-input-area">
      <textarea class="penpot-comment__comment-input" id="comment-input" placeholder="Add a comment..." rows="1"></textarea>
      <button class="penpot-comment__comment-send" id="send-btn" disabled>Send</button>
    </div>
    <div id="comment-pin-indicator" style="padding:4px 12px;font-size:9px;color:#999;display:none;"></div>
  </div>`;

export class PenpotCommentPanel extends PenpotElement {
  _template = template;
  #comments = [];
  #fileId = null;
  #pageId = null;
  #filter = 'open';
  #pendingX = 0;
  #pendingY = 0;
  #replyingTo = null;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();

    this.querySelector('#close-btn').addEventListener('click', () => {
      this.emit('penpot-comment-close', {});
    });

    this.querySelectorAll('.penpot-comment__comment-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#filter = btn.dataset.filter;
        this.querySelectorAll('.penpot-comment__comment-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === this.#filter));
        this.#renderComments();
      });
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

  set pageId(id) {
    this.#pageId = id;
  }

  set pendingPosition({ x, y }) {
    this.#pendingX = x;
    this.#pendingY = y;
    const pin = this.querySelector('#comment-pin-indicator');
    if (pin) {
      pin.textContent = `Pin at (${Math.round(x)}, ${Math.round(y)})`;
      pin.style.display = 'block';
    }
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

  async #submitComment() {
    const input = this.querySelector('#comment-input');
    const text = input.value.trim();
    if (!text) return;

    const profile = appStore.get('profile') || {};
    const comment = {
      id: crypto.randomUUID(),
      author: profile.fullname || profile.email || 'You',
      text,
      timestamp: new Date().toISOString(),
      x: this.#pendingX,
      y: this.#pendingY,
      pageId: this.#pageId,
    };

    input.value = '';
    input.style.height = 'auto';
    this.querySelector('#send-btn').disabled = true;
    this.#pendingX = 0;
    this.#pendingY = 0;
    const pin = this.querySelector('#comment-pin-indicator');
    if (pin) pin.style.display = 'none';

    this.#comments = [...this.#comments, comment];
    this.#renderComments();
    this.emit('penpot-comment-create', { comment });

    try {
      await cmd('create-comment', {
        fileId: this.#fileId,
        pageId: this.#pageId,
        content: text,
      });
    } catch (err) {
      console.error('[comment-panel] failed to persist comment:', err);
    }
  }

  #renderComments() {
    const list = this.querySelector('#comment-list');
    if (!list) return;

    const threads = this.#groupIntoThreads();
    const filtered = this.#filter === 'all' ? threads
      : this.#filter === 'resolved' ? threads.filter(t => t.resolved)
      : threads.filter(t => !t.resolved);

    if (filtered.length === 0) {
      const msg = this.#filter === 'open' ? 'No open comments.' : this.#filter === 'resolved' ? 'No resolved comments.' : 'No comments yet. Click on the canvas to add one.';
      list.innerHTML = `<div class="penpot-comment__empty-state">${msg}</div>`;
      return;
    }

    let html = '';
    for (const thread of filtered) {
      const resolvedClass = thread.resolved ? ' penpot-comment__comment-thread-resolved' : '';
      html += `<div class="penpot-comment__comment-item${resolvedClass}" data-thread-id="${this.escAttr(thread.id)}">`;
      for (const c of thread.comments) {
        const time = c.timestamp || c.created_at ? new Date(c.timestamp || c.created_at).toLocaleString() : '';
        const resolveBtn = thread.resolved
          ? `<button class="penpot-comment__comment-resolved" data-reopen-thread="${this.escAttr(thread.id)}">Reopen</button>`
          : `<button class="penpot-comment__comment-resolve" data-resolve-thread="${this.escAttr(thread.id)}">Resolve</button>`;
        const isFirst = c.id === (thread.firstCommentId || thread.comments[0]?.id);
        html += `<div class="penpot-comment__comment-bubble">
          <div class="penpot-comment__comment-author">${this.escHtml(c.author || 'Anonymous')}${isFirst ? resolveBtn : ''}<button class="penpot-comment__comment-delete" data-comment-id="${this.escAttr(c.id)}" title="Delete">\u00D7</button></div>
          <div class="penpot-comment__comment-text">${this.escHtml(c.text || c.content || '')}</div>
          <div class="penpot-comment__comment-time">${this.escHtml(time)}</div>
        </div>`;
      }
      html += `<button class="penpot-comment__comment-reply-btn" data-reply-thread="${this.escAttr(thread.id)}">Reply</button>`;
      if (this.#replyingTo === thread.id) {
        html += `<div class="penpot-comment__reply-area"><input class="penpot-comment__reply-input" id="reply-input" placeholder="Reply..." rows="1"><button class="penpot-comment__reply-send" id="reply-send">Send</button></div>`;
      }
      html += `</div>`;
    }
    list.innerHTML = html;

    list.querySelectorAll('.penpot-comment__comment-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const commentId = btn.dataset.commentId;
        try {
          await cmd('delete-comment', { id: commentId });
          this.#comments = this.#comments.filter(c => c.id !== commentId);
          this.#renderComments();
        } catch (err) {
          console.error('[comment-panel] failed to delete comment:', err);
        }
      });
    });

    list.querySelectorAll('.penpot-comment__comment-resolve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const threadId = btn.dataset.resolveThread;
        try {
          await cmd('update-comment-thread', { id: threadId, isResolved: true });
          await this.#loadComments();
        } catch (err) {
          console.error('[comment-panel] failed to resolve thread:', err);
        }
      });
    });

    list.querySelectorAll('.penpot-comment__comment-resolved').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const threadId = btn.dataset.reopenThread;
        try {
          await cmd('update-comment-thread', { id: threadId, isResolved: false });
          await this.#loadComments();
        } catch (err) {
          console.error('[comment-panel] failed to reopen thread:', err);
        }
      });
    });

    list.querySelectorAll('.penpot-comment__comment-reply-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#replyingTo = btn.dataset.replyThread;
        this.#renderComments();
        const replyInput = this.querySelector('#reply-input');
        if (replyInput) replyInput.focus();
      });
    });

    const replySend = list.querySelector('#reply-send');
    if (replySend) {
      replySend.addEventListener('click', async () => {
        const replyInput = this.querySelector('#reply-input');
        const text = replyInput?.value.trim();
        if (!text || !this.#replyingTo) return;
        this.#replyingTo = null;
        try {
          await cmd('create-comment', {
            fileId: this.#fileId,
            threadId: this.#replyingTo,
            content: text,
          });
          await this.#loadComments();
        } catch (err) {
          console.error('[comment-panel] failed to post reply:', err);
        }
      });
    }

    const replyInput = list.querySelector('#reply-input');
    if (replyInput) {
      replyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          replySend?.click();
        }
        if (e.key === 'Escape') {
          this.#replyingTo = null;
          this.#renderComments();
        }
      });
    }
  }

  #groupIntoThreads() {
    const threadMap = new Map();
    const standalone = [];
    for (const c of this.#comments) {
      const threadId = c.threadId || c.thread_id || c.id;
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, { id: threadId, resolved: !!(c.isResolved || c.is_resolved), comments: [] });
      }
      threadMap.get(threadId).comments.push({ ...c, threadId });
    }
    return [...threadMap.values()];
  }

  render() {}
}

customElements.define('penpot-comment-panel', PenpotCommentPanel);