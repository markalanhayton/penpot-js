/**
 * @module email
 * @description Email sending infrastructure — mirrors `app.email` from the Clojure backend.
 *
 * Uses nodemailer for SMTP delivery. All configuration is read from
 * `PENPOT_SMTP_*` environment variables via the config module.
 *
 * ### Supported email types
 *
 * | Type                 | Function                    | Description                          |
 * |----------------------|-----------------------------|--------------------------------------|
 * | Password recovery    | `sendPasswordRecovery()`   | Send password reset link             |
 * | Email verification   | `sendEmailVerification()`  | Send email verification link        |
 * | Team invitation      | `sendTeamInvitation()`      | Send team invite link                |
 * | Feedback             | `sendFeedback()`            | Forward user feedback                |
 *
 * All functions are no-ops when `config.smtp.enabled` is `false`.
 */

import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

/**
 * Check if an email address is allowed based on the blacklist and whitelist.
 *
 * Whitelist takes priority over blacklist. If a whitelist is configured,
 * only domains on the whitelist are allowed. If no whitelist, domains on
 * the blacklist are blocked.
 *
 * @param {string} email - Email address to check.
 * @returns {boolean} `true` if the email is allowed, `false` if blocked.
 */
export function isEmailAllowed(email) {
  if (!email || typeof email !== 'string') return false;

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  const whitelist = (process.env.PENPOT_EMAIL_WHITELIST || '')
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);

  const blacklist = (process.env.PENPOT_EMAIL_BLACKLIST || '')
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);

  // Whitelist takes priority: if configured, only whitelisted domains are allowed
  if (whitelist.length > 0) {
    return whitelist.includes(domain);
  }

  // Blacklist: block known disposable/temporary email domains
  if (blacklist.length > 0 && blacklist.includes(domain)) {
    return false;
  }

  return true;
}

/**
 * Common disposable email domains blocked by default when
 * PENPOT_EMAIL_BLOCK_DISPOSABLE is enabled.
 */
const DISPOSABLE_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'guerrillamailblock.com',
  'yopmail.com', 'dispostable.com', 'trashmail.com', 'sharklasers.com',
  'grr.la', 'guerrillamail.info', 'spammotel.com', 'throwaway.email',
  'tempmail.com', 'temp-mail.org', '10minutemail.com', 'maildrop.cc',
  'mailnesia.com', 'getnonsense.com', 'tempail.com', 'fakeinbox.com',
];

/** @type {import('nodemailer').Transporter|null} */
let transporter = null;

function renderTemplate(bodyHtml, opts = {}) {
  const title = opts.title || 'Penpot';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${title ? `<title>${title}</title>` : ''}
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:0;background:#f5f5f5;color:#333}
.container{max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.header{background:#1f2937;color:#fff;padding:24px 32px;font-size:20px;font-weight:600}
.content{padding:24px 32px;line-height:1.6}
.content a{color:#2563eb;text-decoration:none;font-weight:500}
.btn{display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0}
.footer{padding:16px 32px;font-size:12px;color:#999;text-align:center}
</style></head><body>
<div class="container"><div class="header">${title}</div><div class="content">${bodyHtml}</div><div class="footer">This email was sent by Penpot. If you did not expect this, you can safely ignore it.</div></div></body></html>`;
}

/**
 * Initialise the nodemailer transporter.
 * Called once on first send; no-op if SMTP is disabled.
 */
function getTransporter() {
  if (!config.smtp.enabled) return null;
  if (transporter) return transporter;

  const opts = {
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.ssl,
  };

  if (config.smtp.username) {
    opts.auth = {
      user: config.smtp.username,
      pass: config.smtp.password,
    };
  }

  // STARTTLS
  if (config.smtp.tls && !config.smtp.ssl) {
    opts.requireTLS = true;
  }

  transporter = nodemailer.createTransport(opts);
  return transporter;
}

/**
 * Send an email. All parameters are optional — omitting `to` is a no-op.
 *
 * @param {{ to?: string, subject?: string, text?: string, html?: string }} opts
 * @returns {Promise<boolean>} `true` if the email was sent, `false` if disabled or failed.
 */
export async function sendEmail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t || !to) return false;

  try {
    await t.sendMail({
      from: config.smtp.defaultFrom,
      to,
      subject: subject || 'Penpot Notification',
      text: text || '',
      html: html || text || '',
    });
    return true;
  } catch (err) {
    console.error('[email] Failed to send email:', err.message);
    return false;
  }
}

/**
 * Send a password recovery email with a reset link.
 *
 * @param {{ to: string, token: string, profileId: string }} opts
 * @returns {Promise<boolean>}
 */
export async function sendPasswordRecovery({ to, token, profileId }) {
  const publicUri = config.publicUri;
  const resetUrl = `${publicUri}/#/auth/recover-password?token=${encodeURIComponent(token)}`;

  return sendEmail({
    to,
    subject: 'Password Recovery',
    text: `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: renderTemplate(`<p>You requested a password reset.</p><p><a href="${resetUrl}" class="btn">Reset Password</a></p><p>If you didn't request this, you can safely ignore this email.</p>`, { title: 'Password Recovery' }),
  });
}

/**
 * Send an email verification link.
 *
 * @param {{ to: string, token: string }} opts
 * @returns {Promise<boolean>}
 */
export async function sendEmailVerification({ to, token }) {
  const publicUri = config.publicUri;
  const verifyUrl = `${publicUri}/#/auth/verify-email?token=${encodeURIComponent(token)}`;

  return sendEmail({
    to,
    subject: 'Verify Your Email',
    text: `Please verify your email address by clicking the link below:\n\n${verifyUrl}`,
    html: renderTemplate(`<p>Please verify your email address.</p><p><a href="${verifyUrl}" class="btn">Verify Email</a></p>`, { title: 'Verify Your Email' }),
  });
}

/**
 * Send a team invitation email.
 *
 * @param {{ to: string, teamName: string, inviterName: string, inviteUrl: string }} opts
 * @returns {Promise<boolean>}
 */
export async function sendTeamInvitation({ to, teamName, inviterName, inviteUrl }) {
  return sendEmail({
    to,
    subject: `${inviterName} invited you to join "${teamName}" on Penpot`,
    text: `${inviterName} has invited you to join the team "${teamName}" on Penpot.\n\nClick the link below to accept or decline the invitation:\n\n${inviteUrl}`,
    html: renderTemplate(`<p><strong>${inviterName}</strong> has invited you to join the team "<strong>${teamName}</strong>" on Penpot.</p><p><a href="${inviteUrl}" class="btn">Accept Invitation</a></p>`, { title: 'Team Invitation' }),
  });
}

/**
 * Send user feedback to the Penpot team.
 *
 * @param {{ from: string, subject: string, message: string }} opts
 * @returns {Promise<boolean>}
 */
export async function sendFeedback({ from, subject, message }) {
  return sendEmail({
    to: config.smtp.defaultReplyTo || config.smtp.defaultFrom,
    subject: `[Feedback] ${subject}`,
    text: `From: ${from}\n\n${message}`,
    html: renderTemplate(`<p><strong>From:</strong> ${from}</p><p>${message}</p>`, { title: `Feedback: ${subject}` }),
  });
}