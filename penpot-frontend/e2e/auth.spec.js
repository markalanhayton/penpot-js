import { test, expect } from '@playwright/test';

test.describe('Auth Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.waitForSelector('#title');
  });

  test('shows login form by default', async ({ page }) => {
    await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
    await expect(page.locator('#submit')).toHaveText('Sign in');
  });

  test('switches to register and back without crash', async ({ page }) => {
    await page.locator('#switch-link').click();
    await expect(page.locator('#title')).toHaveText('Create your account');
    await expect(page.locator('#name-field')).toBeVisible();

    await page.locator('#switch-link').click();
    await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
  });

  test('switches multiple times without crash (regression test for innerHTML bug)', async ({ page }) => {
    const link = page.locator('#switch-link');

    await link.click();
    await expect(page.locator('#title')).toHaveText('Create your account');

    await link.click();
    await expect(page.locator('#title')).toHaveText('Sign in to Penpot');

    await link.click();
    await expect(page.locator('#title')).toHaveText('Create your account');

    await link.click();
    await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
  });

  test('switchLink text updates correctly after mode changes', async ({ page }) => {
    const link = page.locator('#switch-link');
    await expect(link).toHaveText('Create one');

    await link.click();
    await expect(link).toHaveText('Sign in');

    await link.click();
    await expect(link).toHaveText('Create one');
  });

  test('shows error on invalid login', async ({ page }) => {
    await page.locator('#email').fill('nonexistent@example.com');
    await page.locator('#pw').fill('wrongpassword');
    await page.locator('#submit').click();

    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 10000 });
  });

  test('can login with valid credentials', async ({ page }) => {
    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();

    await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 10000 });
  });
});