import { test, expect } from '@playwright/test';

test.describe('Team Management E2E', () => {

  test('penpot-team-management custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-team-management'));
    expect(defined).toBe(true);
  });

  test('team management renders header with back button and title', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasHeader = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      return {
        backBtn: !!tm.querySelector('#back-btn'),
        title: !!tm.querySelector('#team-title'),
      };
    });
    expect(hasHeader.backBtn).toBe(true);
    expect(hasHeader.title).toBe(true);
  });

  test('team management renders Members, Invitations, and Settings tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const tabs = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const tabEls = tm.querySelectorAll('.penpot-tm__tab');
      return Array.from(tabEls).map((t) => t.dataset.tab);
    });
    expect(tabs).toContain('members');
    expect(tabs).toContain('invitations');
    expect(tabs).toContain('settings');
  });

  test('Members tab is active by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const activeTab = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const activeTabEl = tm.querySelector('.penpot-tm__tab.penpot-tm__active');
      return activeTabEl?.dataset.tab || '';
    });
    expect(activeTab).toBe('members');
  });

  test('clicking Invitations tab activates it', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const activeTab = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const invTab = tm.querySelector('[data-tab="invitations"]');
      invTab?.click();
      const activeTabEl = tm.querySelector('.penpot-tm__tab.penpot-tm__active');
      return activeTabEl?.dataset.tab || '';
    });
    expect(activeTab).toBe('invitations');
  });

  test('clicking Settings tab activates it', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const activeTab = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const settingsTab = tm.querySelector('[data-tab="settings"]');
      settingsTab?.click();
      const activeTabEl = tm.querySelector('.penpot-tm__tab.penpot-tm__active');
      return activeTabEl?.dataset.tab || '';
    });
    expect(activeTab).toBe('settings');
  });

  test('back button emits penpot-team-management-close event', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const eventFired = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      return new Promise((resolve) => {
        tm.addEventListener('penpot-team-management-close', () => resolve(true), { once: true });
        tm.querySelector('#back-btn')?.click();
        setTimeout(() => resolve(false), 2000);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('members tab shows empty state when no members loaded', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasEmpty = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const content = tm.querySelector('#content');
      return content?.querySelector('.penpot-tm__empty-state') !== null;
    });
    expect(hasEmpty).toBe(true);
  });

  test('invitations tab shows empty state when no invitations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasEmpty = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const invTab = tm.querySelector('[data-tab="invitations"]');
      invTab?.click();
      const content = tm.querySelector('#content');
      return content?.innerHTML?.includes('No pending') || false;
    });
    expect(hasEmpty).toBe(true);
  });

  test('invitations tab shows New Invitation button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasBtn = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const invTab = tm.querySelector('[data-tab="invitations"]');
      invTab?.click();
      return !!tm.querySelector('#new-invite-btn');
    });
    expect(hasBtn).toBe(true);
  });

  test('settings tab renders team name input', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasInput = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const settingsTab = tm.querySelector('[data-tab="settings"]');
      settingsTab?.click();
      return !!tm.querySelector('#team-name-input');
    });
    expect(hasInput).toBe(true);
  });

  test('settings tab shows Leave Team button', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasBtn = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const settingsTab = tm.querySelector('[data-tab="settings"]');
      settingsTab?.click();
      return !!tm.querySelector('#leave-team-btn');
    });
    expect(hasBtn).toBe(true);
  });

  test('settings tab shows danger zone with Delete Team for owners', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const hasDangerZone = await page.evaluate(() => {
      const tm = document.createElement('penpot-team-management');
      document.body.appendChild(tm);
      const settingsTab = tm.querySelector('[data-tab="settings"]');
      settingsTab?.click();
      const content = tm.querySelector('#content');
      return content?.innerHTML?.includes('Danger Zone') || false;
    });
    expect(hasDangerZone).toBe(true);
  });
});