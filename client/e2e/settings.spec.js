import { test, expect } from '@playwright/test';

test.describe('Settings Pages', () => {

  async function login(page) {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();
    await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  }

  async function navigateToSettings(page, section = 'profile') {
    await page.evaluate((sec) => {
      if (window.__penpot && window.__penpot.navigate) {
        window.__penpot.navigate('settings-' + sec);
      } else {
        window.location.hash = '#/settings/' + sec;
      }
    }, section);
    await page.waitForURL(/settings/, { timeout: 5000 }).catch(() => {});
    await expect(page.locator('penpot-settings')).toBeVisible({ timeout: 5000 });
  }

  test('settings button navigates to settings', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');
    const settingsBtns = dashboard.locator('#settings-btn');
    await expect(settingsBtns.first()).toBeVisible();
    await settingsBtns.first().click();
    await expect(page.locator('penpot-settings')).toBeVisible({ timeout: 5000 });
  });

  test('profile settings form renders', async ({ page }) => {
    await login(page);
    await navigateToSettings(page, 'profile');
    const settings = page.locator('penpot-settings');
    await expect(settings.locator('h2')).toHaveText('Profile Settings');
    await expect(settings.locator('#fullname')).toBeVisible();
    await expect(settings.locator('#email')).toBeVisible();
    await expect(settings.locator('#save-profile')).toBeVisible();
  });

  test('password settings form renders', async ({ page }) => {
    await login(page);
    await navigateToSettings(page, 'password');
    const settings = page.locator('penpot-settings');
    await expect(settings.locator('h2')).toHaveText('Change Password');
    await expect(settings.locator('#old-password')).toBeVisible();
    await expect(settings.locator('#new-password')).toBeVisible();
    await expect(settings.locator('#confirm-password')).toBeVisible();
    await expect(settings.locator('#change-password')).toBeVisible();
  });

  test('feedback form renders', async ({ page }) => {
    await login(page);
    await navigateToSettings(page, 'feedback');
    const settings = page.locator('penpot-settings');
    await expect(settings.locator('h2')).toHaveText('Send Feedback');
    await expect(settings.locator('#feedback-type')).toBeVisible();
    await expect(settings.locator('#feedback-content')).toBeVisible();
    await expect(settings.locator('#send-feedback')).toBeVisible();
  });

  test('password validation: mismatch shows error', async ({ page }) => {
    await login(page);
    await navigateToSettings(page, 'password');
    const settings = page.locator('penpot-settings');
    await settings.locator('#old-password').fill('oldpass');
    await settings.locator('#new-password').fill('newpass123');
    await settings.locator('#confirm-password').fill('different123');
    await settings.locator('#change-password').click();
    await expect(settings.locator('.penpot-settings__error')).toContainText('do not match');
  });

  test('password validation: too short shows error', async ({ page }) => {
    await login(page);
    await navigateToSettings(page, 'password');
    const settings = page.locator('penpot-settings');
    await settings.locator('#old-password').fill('oldpass');
    await settings.locator('#new-password').fill('short');
    await settings.locator('#confirm-password').fill('short');
    await settings.locator('#change-password').click();
    await expect(settings.locator('.penpot-settings__error')).toContainText('8 characters');
  });

  test('settings nav switches between sections', async ({ page }) => {
    await login(page);
    await navigateToSettings(page, 'profile');
    const settings = page.locator('penpot-settings');

    await settings.locator('.penpot-settings__nav-item[data-section="password"]').click();
    await expect(settings.locator('h2')).toHaveText('Change Password');

    await settings.locator('.penpot-settings__nav-item[data-section="profile"]').click();
    await expect(settings.locator('h2')).toHaveText('Profile Settings');

    await settings.locator('.penpot-settings__nav-item[data-section="feedback"]').click();
    await expect(settings.locator('h2')).toHaveText('Send Feedback');
  });

  test('back link navigates to dashboard', async ({ page }) => {
    await login(page);
    await navigateToSettings(page, 'profile');
    const settings = page.locator('penpot-settings');
    await settings.locator('.penpot-settings__back-link').click();
    await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 5000 });
  });

  test('audit log tab is visible and renders', async ({ page }) => {
    await login(page);
    await navigateToSettings(page, 'profile');
    const settings = page.locator('penpot-settings');
    // The audit tab should be in the nav
    await expect(settings.locator('[data-section="audit"]')).toBeVisible();
    await settings.locator('[data-section="audit"]').click();
    // h2 should read "Audit Log"
    await expect(settings.locator('h2')).toHaveText('Audit Log');
    // Filter inputs should be present
    await expect(settings.locator('#audit-filter-name')).toBeVisible();
    await expect(settings.locator('#audit-filter-type')).toBeVisible();
    await expect(settings.locator('#audit-filter-source')).toBeVisible();
    await expect(settings.locator('#audit-apply')).toBeVisible();
    await expect(settings.locator('#audit-clear')).toBeVisible();
  });

  test('audit log calls get-audit-events RPC on tab open and on apply', async ({ page }) => {
    await login(page);
    await navigateToSettings(page, 'profile');
    const settings = page.locator('penpot-settings');
    let calls = 0;
    // Track the RPC call count by intercepting fetch
    await page.evaluate(() => {
      window.__auditCallCount = 0;
      const origFetch = window.fetch;
      window.fetch = function(...args) {
        const url = String(args[0] || '');
        if (url.includes('get-audit-events')) window.__auditCallCount++;
        return origFetch.apply(this, args);
      };
    });
    await settings.locator('[data-section="audit"]').click();
    // Wait for the RPC to complete
    await page.waitForFunction(() => window.__auditCallCount > 0, { timeout: 5000 });
    const after1 = await page.evaluate(() => window.__auditCallCount);
    expect(after1).toBeGreaterThanOrEqual(1);

    // Fill a filter and apply
    await settings.locator('#audit-filter-name').fill('create-file');
    await settings.locator('#audit-apply').click();
    await page.waitForFunction((prev) => window.__auditCallCount > prev, after1, { timeout: 5000 });
    const after2 = await page.evaluate(() => window.__auditCallCount);
    expect(after2).toBeGreaterThan(after1);
  });

  test('audit log renders events returned from server', async ({ page }) => {
    await login(page);
    await navigateToSettings(page, 'profile');
    const settings = page.locator('penpot-settings');
    await settings.locator('[data-section="audit"]').click();
    // Wait for the list to either show events or the empty state
    await page.waitForFunction(() => {
      const list = document.querySelector('#audit-list');
      return list && (list.querySelector('.penpot-settings__audit-event') || list.querySelector('.penpot-settings__audit-empty'));
    }, { timeout: 5000 });
    const eventCount = await settings.locator('.penpot-settings__audit-event').count();
    const emptyVisible = await settings.locator('.penpot-settings__audit-empty').isVisible().catch(() => false);
    expect(eventCount + (emptyVisible ? 1 : 0)).toBeGreaterThan(0);
  });

  test('audit log pagination shows page info', async ({ page }) => {
    await login(page);
    await navigateToSettings(page, 'profile');
    const settings = page.locator('penpot-settings');
    await settings.locator('[data-section="audit"]').click();
    await page.waitForFunction(() => {
      const pag = document.querySelector('#audit-pagination');
      return pag && pag.textContent.length > 0;
    }, { timeout: 5000 });
    const text = await settings.locator('#audit-pagination').textContent();
    // Should show "Showing X–Y of Z" or "Page X of Y"
    expect(text).toMatch(/Showing|Page/);
  });
});