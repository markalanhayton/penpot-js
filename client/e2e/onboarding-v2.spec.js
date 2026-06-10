import { test, expect } from '@playwright/test';

test.describe('Onboarding V2 (WU-T2) E2E', () => {

  test('penpot-onboarding-questions custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-onboarding-questions'));
    expect(defined).toBe(true);
  });

  test('penpot-onboarding-team-choice custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-onboarding-team-choice'));
    expect(defined).toBe(true);
  });

  test('intro questions shows three step indicators and disabled Next button initially', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    // Mount the component and check the default state
    const state = await page.evaluate(() => {
      const el = document.createElement('penpot-onboarding-questions');
      document.body.appendChild(el);
      const nextBtn = el.querySelector('#next-btn');
      const skipBtn = el.querySelector('#skip-btn');
      const options = el.querySelectorAll('.intro-option');
      return {
        nextDisabled: nextBtn?.disabled,
        skipExists: !!skipBtn,
        optionCount: options.length,
        firstStepLabelText: el.querySelector('.intro-step-label')?.textContent?.trim() || '',
      };
    });
    expect(state.skipExists).toBe(true);
    expect(state.nextDisabled).toBe(true); // disabled until first answer
    expect(state.optionCount).toBeGreaterThanOrEqual(3);
    expect(state.firstStepLabelText.length).toBeGreaterThan(0);
  });

  test('selecting an answer enables the Next button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const enabled = await page.evaluate(() => {
      const el = document.createElement('penpot-onboarding-questions');
      document.body.appendChild(el);
      const firstOption = el.querySelector('.intro-option');
      firstOption?.click();
      const nextBtn = el.querySelector('#next-btn');
      return nextBtn?.disabled;
    });
    expect(enabled).toBe(false);
  });

  test('three question steps are rendered in order (role, team-size, use-case)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const stepLabels = await page.evaluate(() => {
      const el = document.createElement('penpot-onboarding-questions');
      document.body.appendChild(el);
      const labels = ['Role question', 'Team size question', 'Use case question'];
      const results = [];
      // Simulate clicking the first option, then Next, capture label, repeat
      const captureLabel = () => el.querySelector('.intro-step-label')?.textContent?.trim() || '';
      results.push(captureLabel());
      for (let i = 0; i < 2; i++) {
        const opt = el.querySelector('.intro-option');
        opt?.click();
        el.querySelector('#next-btn')?.click();
        results.push(captureLabel());
      }
      return results;
    });
    expect(stepLabels).toHaveLength(3);
    // Each step should have a unique question label
    const unique = new Set(stepLabels);
    expect(unique.size).toBe(3);
  });

  test('intro questions calls update-profile-props on completion', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const calls = await page.evaluate(() => {
      const el = document.createElement('penpot-onboarding-questions');
      document.body.appendChild(el);
      const calls = [];
      const origFetch = window.fetch;
      window.fetch = (url, opts) => {
        const body = opts?.body ? JSON.parse(opts.body) : null;
        calls.push({ url: String(url), body });
        return origFetch(url, opts);
      };
      // Select 1 option and click Next three times to finish
      for (let i = 0; i < 3; i++) {
        el.querySelector('.intro-option')?.click();
        el.querySelector('#next-btn')?.click();
      }
      window.fetch = origFetch;
      return calls;
    });
    const updateProfilePropsCalls = calls.filter(c => c.url.includes('update-profile-props'));
    // 1 for answers + 1 for onboarding-viewed = at least 2
    expect(updateProfilePropsCalls.length).toBeGreaterThanOrEqual(2);
  });

  test('team choice shows create + join options + skip', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const state = await page.evaluate(() => {
      const el = document.createElement('penpot-onboarding-team-choice');
      document.body.appendChild(el);
      return {
        hasCreate: !!el.querySelector('[data-action="create-team"]'),
        hasJoin: !!el.querySelector('[data-action="join-invite"]'),
        hasSkip: !!el.querySelector('[data-action="skip"]'),
        hasTitle: !!el.querySelector('#tc-title'),
      };
    });
    expect(state.hasCreate).toBe(true);
    expect(state.hasJoin).toBe(true);
    expect(state.hasSkip).toBe(true);
    expect(state.hasTitle).toBe(true);
  });

  test('team choice back button returns to options from join-invite view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const backPresent = await page.evaluate(() => {
      const el = document.createElement('penpot-onboarding-team-choice');
      document.body.appendChild(el);
      el.querySelector('[data-action="join-invite"]')?.click();
      const hasBack = !!el.querySelector('[data-action="back"]');
      const hasInput = !!el.querySelector('#invite-token-input');
      el.querySelector('[data-action="back"]')?.click();
      const hasCreateAgain = !!el.querySelector('[data-action="create-team"]');
      return { hasBack, hasInput, hasCreateAgain };
    });
    expect(backPresent.hasBack).toBe(true);
    expect(backPresent.hasInput).toBe(true);
    expect(backPresent.hasCreateAgain).toBe(true, 'should be back at options view');
  });

  test('team choice dismisses overlay when complete', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hidden = await page.evaluate(() => {
      const el = document.createElement('penpot-onboarding-team-choice');
      document.body.appendChild(el);
      el.querySelector('[data-action="skip"]')?.click();
      return el.querySelector('#overlay')?.style.display === 'none';
    });
    expect(hidden).toBe(true);
  });
});
