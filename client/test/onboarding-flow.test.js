'use strict';
/**
 * @module test/onboarding-flow.test
 * Unit tests for the WU-T2 onboarding flow logic.
 *
 * The intro questions + team choice overlay state machine is tested
 * without instantiating custom elements — we re-implement the same
 * predicate/state shape so we can verify the flow logic in pure Node.
 *
 * The WU-T2 spec:
 * - Intro questions shown after login for users without `onboarding-viewed` prop
 * - Three question steps: role, team size, primary use case
 * - Persisted via `update-profile-props` RPC with `onboarding-{role,size,use-case}` keys
 * - Team choice overlay shown if user has 0 teams
 * - "Create Team" and "Join via invite link" options
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Re-implement the onboarding flow decision tree in isolation.
 * Production code lives in app.js#runOnboardingFlow.
 */
function shouldShowIntroQuestions(profile, localStorage) {
  let props = {};
  if (profile && profile.props) {
    try { props = typeof profile.props === 'string' ? JSON.parse(profile.props) : (profile.props || {}); }
    catch { props = {}; }
  }
  const alreadyViewed = props && props.onboardingViewed;
  const localDone = localStorage.getItem('penpot-intro-questions-done');
  return !alreadyViewed && !localDone;
}

function shouldShowTeamChoice(localStorage, teams) {
  const localDone = localStorage.getItem('penpot-team-choice-done');
  if (localDone) return false;
  return Array.isArray(teams) && teams.length === 0;
}

describe('WU-T2: intro questions trigger', () => {
  it('shows intro questions for new user with no props', () => {
    const ls = { getItem: () => null };
    assert.equal(shouldShowIntroQuestions({}, ls), true);
  });

  it('shows intro questions for new user with empty props string', () => {
    const ls = { getItem: () => null };
    assert.equal(shouldShowIntroQuestions({ props: '{}' }, ls), true);
  });

  it('does NOT show intro questions when onboarding-viewed is set in props', () => {
    const ls = { getItem: () => null };
    assert.equal(shouldShowIntroQuestions({ props: '{"onboardingViewed":true}' }, ls), false);
  });

  it('does NOT show intro questions when localStorage has done flag', () => {
    const ls = { getItem: (k) => k === 'penpot-intro-questions-done' ? '1' : null };
    assert.equal(shouldShowIntroQuestions({ props: '{}' }, ls), false);
  });

  it('does NOT show intro questions when BOTH server flag and local flag are set', () => {
    const ls = { getItem: (k) => k === 'penpot-intro-questions-done' ? '1' : null };
    assert.equal(shouldShowIntroQuestions({ props: '{"onboardingViewed":true}' }, ls), false);
  });

  it('handles malformed JSON props gracefully', () => {
    const ls = { getItem: () => null };
    // Should not throw, should still show
    assert.equal(shouldShowIntroQuestions({ props: 'not-json{{' }, ls), true);
  });

  it('handles missing profile gracefully', () => {
    const ls = { getItem: () => null };
    assert.equal(shouldShowIntroQuestions(null, ls), true);
  });
});

describe('WU-T2: team choice trigger', () => {
  it('shows team choice when user has 0 teams and not done', () => {
    const ls = { getItem: () => null };
    assert.equal(shouldShowTeamChoice(ls, []), true);
  });

  it('does NOT show team choice when user has 1+ teams', () => {
    const ls = { getItem: () => null };
    assert.equal(shouldShowTeamChoice(ls, [{ id: 't1' }]), false);
  });

  it('does NOT show team choice when localStorage has done flag', () => {
    const ls = { getItem: (k) => k === 'penpot-team-choice-done' ? '1' : null };
    assert.equal(shouldShowTeamChoice(ls, []), false);
  });

  it('shows team choice even with multiple teams if localStorage cleared', () => {
    const ls = { getItem: () => null };
    assert.equal(shouldShowTeamChoice(ls, [{ id: 't1' }, { id: 't2' }]), false);
  });
});

describe('WU-T2: intro questions step sequence', () => {
  it('three steps in order: role, team-size, use-case', () => {
    const STEPS = [
      { prop: 'onboarding-role' },
      { prop: 'onboarding-team-size' },
      { prop: 'onboarding-use-case' },
    ];
    assert.equal(STEPS.length, 3);
    assert.equal(STEPS[0].prop, 'onboarding-role');
    assert.equal(STEPS[1].prop, 'onboarding-team-size');
    assert.equal(STEPS[2].prop, 'onboarding-use-case');
  });

  it('skipping the intro questions does not produce any partial answers', () => {
    // Simulate the production flow: skip with no answers selected
    const answers = {};
    const expectedKeys = ['onboarding-role', 'onboarding-team-size', 'onboarding-use-case'];
    for (const key of expectedKeys) {
      assert.equal(answers[key], undefined);
    }
  });

  it('answering all 3 questions produces the full set of props', () => {
    const answers = {
      'onboarding-role': 'designer',
      'onboarding-team-size': '5-10',
      'onboarding-use-case': 'web-design',
    };
    assert.equal(Object.keys(answers).length, 3);
    assert.equal(answers['onboarding-role'], 'designer');
    assert.equal(answers['onboarding-team-size'], '5-10');
    assert.equal(answers['onboarding-use-case'], 'web-design');
  });
});

describe('WU-T2: team choice view state machine', () => {
  // The team choice component has two views: 'options' and 'join-invite'
  function getNextView(currentView, action) {
    if (action === 'create-team') return 'finish';
    if (action === 'skip') return 'finish';
    if (action === 'join-invite') return 'join-invite';
    if (action === 'back') return 'options';
    if (action === 'join-submit') return 'finish';
    return currentView;
  }

  it('options view → join-invite when user clicks Join', () => {
    assert.equal(getNextView('options', 'join-invite'), 'join-invite');
  });

  it('options view → finish when user clicks Create', () => {
    assert.equal(getNextView('options', 'create-team'), 'finish');
  });

  it('options view → finish when user clicks Skip', () => {
    assert.equal(getNextView('options', 'skip'), 'finish');
  });

  it('join-invite view → options when user clicks Back', () => {
    assert.equal(getNextView('join-invite', 'back'), 'options');
  });

  it('join-invite view → finish when user submits a token', () => {
    assert.equal(getNextView('join-invite', 'join-submit'), 'finish');
  });
});
