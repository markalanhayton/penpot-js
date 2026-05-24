/**
 * @module rpc/comments
 * @description Comment thread and comment RPC commands — mirrors
 * `app.rpc.commands.comments` from the Clojure backend.
 *
 * ### Method summary
 *
 * | Method                           | Auth required | Since |
 * |----------------------------------|:-------------:|-------|
 * | `get-comment-threads`           | Yes           | v1.15 |
 * | `get-unread-comment-threads`   | Yes           | v1.15 |
 * | `get-comment-thread`            | Yes           | v1.15 |
 * | `create-comment-thread`         | Yes           | v1.15 |
 * | `update-comment-thread-status`  | Yes           | v1.15 |
 * | `update-comment-thread`         | Yes           | v1.15 |
 * | `update-comment-thread-position`| Yes           | v1.15 |
 * | `update-comment-thread-frame`   | Yes           | v1.15 |
 * | `create-comment`                | Yes           | v1.15 |
 * | `get-comments`                  | Yes           | v1.15 |
 * | `update-comment`               | Yes           | v1.15 |
 * | `delete-comment`                | Yes           | v1.15 |
 * | `delete-comment-thread`         | Yes           | v1.15 |
 * | `get-profiles-for-file-comments`| Yes           | v1.15 |
 * | `mark-all-threads-as-read`      | Yes           | v1.15 |
 */

import { v4 as uuidv4 } from 'uuid';
import { rowToCamel, rowsToCamel } from '../db/sqlite.js';
import { RpcError } from '../rpc/dispatcher.js';

/**
 * Register all comment-related RPC commands.
 *
 * @param {function(string, import('./dispatcher.js').RpcMethodDefinition): void} register - Method registration callback.
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 */
export default function registerCommentCommands(register, pool) {

  register('get-comment-threads', {
    auth: true,
    added: '1.15',
    async handler(params) {
      const { fileId, teamId } = params;
      if (fileId) {
        const rows = pool.query('SELECT * FROM comment_thread WHERE file_id = @fileId', { fileId });
        return rowsToCamel(rows);
      }
      if (teamId) {
        const rows = pool.query(
          `SELECT ct.* FROM comment_thread ct
           JOIN file f ON f.id = ct.file_id
           JOIN project p ON p.id = f.project_id
           WHERE p.team_id = @teamId`,
          { teamId }
        );
        return rowsToCamel(rows);
      }
      return [];
    }
  });

  register('create-comment-thread', {
    auth: true,
    added: '1.15',
    async handler(params, ctx) {
      const id = uuidv4();
      const now = new Date().toISOString();

      const result = pool.insertReturning('comment_thread', {
        id,
        file_id: params.fileId,
        owner_id: ctx.profileId,
        page_id: params.pageId,
        participants: JSON.stringify([ctx.profileId]),
        seqn: 0,
        is_resolved: '0',
        position: params.position ? JSON.stringify(params.position) : '{}',
        created_at: now,
        modified_at: now,
      });

      // Create initial comment
      if (params.content) {
        pool.insertReturning('comment', {
          id: uuidv4(),
          thread_id: id,
          owner_id: ctx.profileId,
          content: params.content,
          created_at: now,
          modified_at: now,
        });
      }

      return rowToCamel(result);
    }
  });

  register('create-comment', {
    auth: true,
    added: '1.15',
    async handler(params, ctx) {
      const id = uuidv4();
      const now = new Date().toISOString();

      const result = pool.insertReturning('comment', {
        id,
        thread_id: params.threadId,
        owner_id: ctx.profileId,
        content: params.content,
        created_at: now,
        modified_at: now,
      });

      // Update thread modified_at and increment seqn
      pool.run('UPDATE comment_thread SET modified_at = ?, seqn = seqn + 1 WHERE id = ?', [now, params.threadId]);

      return rowToCamel(result);
    }
  });

  register('get-comments', {
    auth: true,
    added: '1.15',
    async handler(params) {
      const rows = pool.query('SELECT * FROM comment WHERE thread_id = @threadId ORDER BY created_at', { threadId: params.threadId });
      return rowsToCamel(rows);
    }
  });

  register('delete-comment', {
    auth: true,
    added: '1.15',
    async handler(params) {
      pool.run('DELETE FROM comment WHERE id = ?', [params.id]);
      return { id: params.id };
    }
  });

  register('delete-comment-thread', {
    auth: true,
    added: '1.15',
    async handler(params) {
      pool.run('DELETE FROM comment WHERE thread_id = ?', [params.id]);
      pool.run('DELETE FROM comment_thread WHERE id = ?', [params.id]);
      return { id: params.id };
    }
  });

  // --- Additional comment methods ---

  register('get-unread-comment-threads', {
    auth: true,
    added: '1.15',
    async handler(params, ctx) {
      const { fileId } = params;
      const rows = pool.query(
        `SELECT * FROM comment_thread WHERE file_id = ? AND is_resolved = '0'`,
        [fileId]
      );
      return rowsToCamel(rows);
    }
  });

  register('get-comment-thread', {
    auth: true,
    added: '1.15',
    async handler(params) {
      const thread = pool.get('SELECT * FROM comment_thread WHERE id = ?', { id: params.id });
      if (!thread) throw new RpcError('not-found', 'object-not-found', 'Comment thread not found');
      return rowToCamel(thread);
    }
  });

  register('update-comment-thread-status', {
    auth: true,
    added: '1.15',
    async handler(params, ctx) {
      const { id, isResolved } = params;
      pool.run('UPDATE comment_thread SET is_resolved = ?, modified_at = ? WHERE id = ?',
        [isResolved ? '1' : '0', new Date().toISOString(), id]);
      return rowToCamel(pool.get('SELECT * FROM comment_thread WHERE id = ?', { id }));
    }
  });

  register('update-comment-thread', {
    auth: true,
    added: '1.15',
    async handler(params, ctx) {
      const { id, isResolved } = params;
      const updates = { modified_at: new Date().toISOString() };
      if (isResolved !== undefined) updates.is_resolved = isResolved ? '1' : '0';
      pool.update('comment_thread', updates, { id });
      return rowToCamel(pool.get('SELECT * FROM comment_thread WHERE id = ?', { id }));
    }
  });

  register('update-comment-thread-position', {
    auth: true,
    added: '1.15',
    async handler(params, ctx) {
      const { id, position } = params;
      pool.run('UPDATE comment_thread SET position = ?, modified_at = ? WHERE id = ?',
        [JSON.stringify(position), new Date().toISOString(), id]);
      return rowToCamel(pool.get('SELECT * FROM comment_thread WHERE id = ?', { id }));
    }
  });

  register('update-comment-thread-frame', {
    auth: true,
    added: '1.15',
    async handler(params, ctx) {
      // Frame ID is stored in the position JSON; this is a convenience update
      const { id, frameId } = params;
      const thread = pool.get('SELECT * FROM comment_thread WHERE id = ?', { id });
      if (!thread) throw new RpcError('not-found', 'object-not-found', 'Comment thread not found');
      const position = typeof thread.position === 'string' ? JSON.parse(thread.position || '{}') : (thread.position || {});
      position.frameId = frameId;
      pool.run('UPDATE comment_thread SET position = ?, modified_at = ? WHERE id = ?',
        [JSON.stringify(position), new Date().toISOString(), id]);
      return rowToCamel(pool.get('SELECT * FROM comment_thread WHERE id = ?', { id }));
    }
  });

  register('update-comment', {
    auth: true,
    added: '1.15',
    async handler(params, ctx) {
      const { id, content } = params;
      pool.run('UPDATE comment SET content = ?, modified_at = ? WHERE id = ?',
        [content, new Date().toISOString(), id]);
      return rowToCamel(pool.get('SELECT * FROM comment WHERE id = ?', { id }));
    }
  });

  register('get-profiles-for-file-comments', {
    auth: true,
    added: '1.15',
    async handler(params, ctx) {
      const { fileId } = params;
      const rows = pool.query(
        `SELECT DISTINCT p.id, p.fullname, p.email, p.photo_id FROM profile p
         JOIN comment c ON c.owner_id = p.id
         JOIN comment_thread ct ON ct.id = c.thread_id
         WHERE ct.file_id = ? AND p.deleted_at IS NULL`,
        [fileId]
      );
      return rowsToCamel(rows);
    }
  });

  register('mark-all-threads-as-read', {
    auth: true,
    added: '1.15',
    async handler(params, ctx) {
      const { threads } = params;
      if (!Array.isArray(threads) || threads.length === 0) {
        return { status: 'ok' };
      }

      const now = new Date().toISOString();
      const profileId = ctx.profileId;

      for (const threadId of threads) {
        pool.run(
          `INSERT INTO comment_thread_status (thread_id, profile_id, modified_at)
           VALUES (?, ?, ?)
           ON CONFLICT(thread_id, profile_id) DO UPDATE SET modified_at = ?`,
          [threadId, profileId, now, now]
        );
      }

      return { status: 'ok' };
    }
  });
}