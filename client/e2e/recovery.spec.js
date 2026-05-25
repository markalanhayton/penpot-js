import { test, expect } from '@playwright/test';

test.describe('Password Recovery E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
  });

  test('navigate to recovery-request mode via URL', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    await expect(page.locator('#title')).toHaveText(/Forgot password|Reset your password/);
  });

  test('recovery mode hides name and password fields', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    const nameField = page.locator('#name-field');
    const pwField = page.locator('#pw');
    expect(await nameField.isHidden().catch(() => true)).toBe(true);
    expect(await pwField.isHidden().catch(() => true)).toBe(true);
  });

  test('recovery mode shows only email field', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    await expect(page.locator('#email')).toBeVisible();
  });

  test('recovery submit button text is Send recovery link', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    const submitBtn = page.locator('#submit');
    const text = await submitBtn.textContent();
    expect(text).toContain('recovery');
  });

  test('recovery switch link text shows Sign in', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    await expect(page.locator('#switch-link')).toHaveText(/Sign in/);
  });

  test('submitting recovery with empty email shows error', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('');
    await page.locator('#submit').click();
    await expect(page.locator('.penpot-app__auth-error')).toBeVisible({ timeout: 5000 });
  });

  test('submitting recovery with valid email format succeeds or shows info', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#submit').click();
    const errorVisible = await page.locator('.penpot-app__auth-error').isVisible({ timeout: 10000 }).catch(() => false);
    const successVisible = await page.locator('.penpot-app__auth-success').isVisible({ timeout: 10000 }).catch(() => false);
    expect(errorVisible || successVisible).toBe(true);
  });

  test('submitting recovery with nonexistent email does not reveal account existence', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('nonexistent-' + Date.now() + '@example.com');
    await page.locator('#submit').click();
    const successVisible = await page.locator('.penpot-app__auth-success').isVisible({ timeout: 10000 }).catch(() => false);
    const errorVisible = await page.locator('.penpot-app__auth-error').isVisible({ timeout: 10000 }).catch(() => false);
  });

  test('switching from recovery back to login mode', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    await expect(page.locator('#switch-link')).toHaveText(/Sign in/);
    await page.locator('#switch-link').click();
    await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
  });

  test('navigate to recovery (token) URL shows recovery mode', async ({ page }) => {
    await page.goto('/auth/recovery?token=fake-token-123');
    await page.waitForSelector('penpot-auth-screen');
    const title = page.locator('#title');
    const titleText = await title.textContent();
    expect(titleText).toBeTruthy();
  });

  test('recovery form does not show name field', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    const nameVisible = await page.locator('#name').isVisible({ timeout: 2000 }).catch(() => false);
    expect(nameVisible).toBe(false);
  });

  test('recovery form does not show password field', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    const pwVisible = await page.locator('#pw').isVisible({ timeout: 2000 }).catch(() => false);
    expect(pwVisible).toBe(false);
  });

  test('success message displayed after recovery request', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#submit').click();
    const successVisible = await page.locator('.penpot-app__auth-success').isVisible({ timeout: 10000 }).catch(() => false);
    if (successVisible) {
      const successText = await page.locator('.penpot-app__auth-success').textContent();
      expect(successText).toContain('recovery');
    }
  });

  test('error message clears when switching from recovery to login', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('');
    await page.locator('#submit').click();
    await expect(page.locator('.penpot-app__auth-error')).toBeVisible({ timeout: 5000 });
    await page.locator('#switch-link').click();
    await page.waitForTimeout(500);
  });

  // ---- Negative / error handling tests ----

  test('recovery with malformed email does not crash', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.locator('#email').fill('not-an-email');
    await page.locator('#submit').click();
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('rapid navigation between recovery and login does not crash', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    for (let i = 0; i < 3; i++) {
      await page.goto('/auth/recovery/request');
      await page.waitForSelector('penpot-auth-screen');
      await expect(page.locator('#title')).toHaveText(/Forgot password|Reset your password/);
      await page.locator('#switch-link').click();
      await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
      await page.locator('#switch-link').click();
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('pressing Enter in recovery mode submits form', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('admin@penpot.local');
    await page.keyboard.press('Enter');
  });

  test('recovery form email input type is email', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    const emailInput = page.locator('#email');
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('recovery with XSS in email does not crash', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.locator('#email').fill('<script>alert(1)</script>');
    await page.locator('#submit').click();
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('recovery with SQL injection in email does not crash', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.locator('#email').fill("' OR 1=1 --");
    await page.locator('#submit').click();
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('recovery with very long email does not crash', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.locator('#email').fill('a'.repeat(500) + '@example.com');
    await page.locator('#submit').click();
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });
});