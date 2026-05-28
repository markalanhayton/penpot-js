import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, destroyTestPool, seedFullHierarchy } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';
import { flagEnabled } from '../src/config/index.js';
import registerFeedbackCommands from '../src/rpc/feedback.js';

function createDispatcher() {
  const methods = new Map();
  function register(name, def) { methods.set(name, def); }
  return { methods, register };
}

describe('Feedback RPC — send-user-feedback', () => {
  let pool;
  let dispatcher;
  let ids;

  beforeEach(() => {
    process.env.PENPOT_USER_FEEDBACK_DESTINATION = 'feedback@example.com';
    pool = createTestPool();
    ids = seedFullHierarchy(pool);
    dispatcher = createDispatcher();
    registerFeedbackCommands(dispatcher.register, pool);
  });

  afterEach(() => {
    destroyTestPool(pool);
    delete process.env.PENPOT_USER_FEEDBACK_DESTINATION;
    delete process.env.PENPOT_FEEDBACK_DESTINATION;
  });

  it('throws feedback-disabled when user-feedback flag is not enabled', async () => {
    if (flagEnabled('user-feedback')) return;

    const handler = dispatcher.methods.get('send-user-feedback').handler;
    await assert.rejects(
      () => handler({ subject: 's', content: 'c' }, { profileId: ids.profileId }),
      { code: 'feedback-disabled' }
    );
  });

  it('feedback-disabled takes precedence over missing subject/content', async () => {
    if (flagEnabled('user-feedback')) return;

    const handler = dispatcher.methods.get('send-user-feedback').handler;
    await assert.rejects(
      () => handler({}, { profileId: ids.profileId }),
      { code: 'feedback-disabled' }
    );
  });

  it('throws validation error when subject is missing (flag enabled)', async () => {
    if (!flagEnabled('user-feedback')) return;

    const handler = dispatcher.methods.get('send-user-feedback').handler;
    await assert.rejects(
      () => handler({ content: 'some content' }, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });

  it('throws validation error when content is missing (flag enabled)', async () => {
    if (!flagEnabled('user-feedback')) return;

    const handler = dispatcher.methods.get('send-user-feedback').handler;
    await assert.rejects(
      () => handler({ subject: 'test subject' }, { profileId: ids.profileId }),
      { code: 'validation-error' }
    );
  });

  it('throws not-found for non-existent profile (flag enabled)', async () => {
    if (!flagEnabled('user-feedback')) return;

    const handler = dispatcher.methods.get('send-user-feedback').handler;
    await assert.rejects(
      () => handler({ subject: 's', content: 'c' }, { profileId: uuidv4() }),
      { code: 'object-not-found' }
    );
  });

  it('throws internal error when feedback destination is not configured (flag enabled)', async () => {
    if (!flagEnabled('user-feedback')) return;

    delete process.env.PENPOT_USER_FEEDBACK_DESTINATION;
    delete process.env.PENPOT_FEEDBACK_DESTINATION;

    const handler = dispatcher.methods.get('send-user-feedback').handler;
    await assert.rejects(
      () => handler({ subject: 's', content: 'c' }, { profileId: ids.profileId }),
      { code: 'internal-error' }
    );
  });
});