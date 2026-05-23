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
});