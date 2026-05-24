import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sendEmail, sendPasswordRecovery, sendEmailVerification, sendTeamInvitation, sendFeedback } from '../src/email/index.js';

describe('sendEmail (SMTP disabled)', () => {
  it('returns false when SMTP is disabled (default)', async () => {
    const result = await sendEmail({ to: 'test@example.com', subject: 'Test', text: 'hello' });
    assert.equal(result, false);
  });

  it('returns false when no "to" address', async () => {
    const result = await sendEmail({ subject: 'Test', text: 'hello' });
    assert.equal(result, false);
  });
});

describe('sendPasswordRecovery (SMTP disabled)', () => {
  it('returns false when SMTP is disabled', async () => {
    const result = await sendPasswordRecovery({ to: 'test@example.com', token: 'abc', profileId: 'xyz' });
    assert.equal(result, false);
  });
});

describe('sendEmailVerification (SMTP disabled)', () => {
  it('returns false when SMTP is disabled', async () => {
    const result = await sendEmailVerification({ to: 'test@example.com', token: 'abc' });
    assert.equal(result, false);
  });
});

describe('sendTeamInvitation (SMTP disabled)', () => {
  it('returns false when SMTP is disabled', async () => {
    const result = await sendTeamInvitation({ to: 'test@example.com', teamName: 'Test', inviterName: 'Admin', inviteUrl: 'http://localhost' });
    assert.equal(result, false);
  });
});

describe('sendFeedback (SMTP disabled)', () => {
  it('returns false when SMTP is disabled', async () => {
    const result = await sendFeedback({ from: 'user@test.com', subject: 'idea', message: 'great product' });
    assert.equal(result, false);
  });
});