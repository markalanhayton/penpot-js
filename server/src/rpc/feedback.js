/**
 * @module rpc/feedback
 * @description User feedback RPC command — mirrors `app.rpc.commands.feedback` from the Clojure backend.
 *
 * | Method              | Auth | Since |
 * |---------------------|:----:|-------|
 * | `send-user-feedback`| Yes  | 1.18  |
 */

import { flagEnabled } from '../config/index.js';
import { RpcError } from './dispatcher.js';
import { sendEmail } from '../email/index.js';

export default function registerFeedbackCommands(register, pool) {
  register('send-user-feedback', {
    auth: true,
    added: '1.18',
    handler: async (params, ctx) => {
      if (!flagEnabled('user-feedback')) {
        throw new RpcError('restriction', 'feedback-disabled', 'Feedback is not enabled');
      }

      const { subject, content, type, errorHref, errorReport } = params;
      if (!subject || !content) {
        throw new RpcError('validation', 'validation-error', 'Subject and content are required');
      }

      const profile = pool.get('SELECT email, fullname FROM profile WHERE id = ?', { id: ctx.profileId });
      if (!profile) {
        throw new RpcError('not-found', 'object-not-found', 'Profile not found');
      }

      const destination = process.env.PENPOT_USER_FEEDBACK_DESTINATION || process.env.PENPOT_FEEDBACK_DESTINATION;
      if (!destination) {
        throw new RpcError('internal', 'internal-error', 'Feedback destination not configured');
      }

      const htmlParts = [
        `<p><strong>Type:</strong> ${type || 'general'}</p>`,
        `<p><strong>From:</strong> ${profile.fullname || 'Unknown'} &lt;${profile.email}&gt;</p>`,
        `<p><strong>Subject:</strong> ${subject}</p>`,
      ];
      if (errorHref) {
        htmlParts.push(`<p><strong>Error URL:</strong> ${errorHref}</p>`);
      }
      htmlParts.push(`<hr><p>${content.replace(/\n/g, '<br>')}</p>`);

      await sendEmail({
        to: destination,
        subject: `[Penpot Feedback] ${subject}`,
        text: `From: ${profile.fullname} <${profile.email}>\nType: ${type || 'general'}\n${errorHref ? `URL: ${errorHref}\n` : ''}\n${content}`,
        html: htmlParts.join('\n'),
        replyTo: profile.email,
      });

      return null;
    },
  });
}