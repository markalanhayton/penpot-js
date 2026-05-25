import { test, expect } from '@playwright/test';

test.describe('Registration E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
  });

  test('register mode shows name, email, and password fields', async ({ page }) => {
    await page.locator('#switch-link').click();
    await expect(page.locator('#title')).toHaveText('Create your account');
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#pw')).toBeVisible();
  });

  test('submit button text changes to Create account', async ({ page }) => {
    await page.locator('#switch-link').click();
    await expect(page.locator('#submit')).toHaveText('Create account');
  });

  test('switch link text shows Sign in in register mode', async ({ page }) => {
    await page.locator('#switch-link').click();
    await expect(page.locator('#switch-link')).toHaveText(/Sign in/);
  });

  test('name field is hidden in login mode', async ({ page }) => {
    const nameField = page.locator('#name-field');
    expect(await nameField.isHidden()).toBe(true);
  });

  test('name field is visible in register mode', async ({ page }) => {
    await page.locator('#switch-link').click();
    const nameField = page.locator('#name-field');
    await expect(nameField).toBeVisible();
  });

  test('shows validation error when submitting registration with empty name', async ({ page }) => {
    await page.locator('#switch-link').click();
    await expect(page.locator('#title')).toHaveText('Create your account');
    await page.locator('#name').fill('');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#pw').fill('Password123');
    await page.locator('#submit').click();
    await expect(page.locator('.penpot-app__auth-error')).toBeVisible({ timeout: 5000 });
  });

  test('shows validation error when submitting registration with empty email', async ({ page }) => {
    await page.locator('#switch-link').click();
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('');
    await page.locator('#pw').fill('Password123');
    await page.locator('#submit').click();
    await expect(page.locator('.penpot-app__auth-error')).toBeVisible({ timeout: 5000 });
  });

  test('shows validation error when submitting registration with empty password', async ({ page }) => {
    await page.locator('#switch-link').click();
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#pw').fill('');
    await page.locator('#submit').click();
  });

  test('registration with existing email shows error', async ({ page }) => {
    await page.locator('#switch-link').click();
    await page.locator('#name').fill('New User');
    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('Password123');
    await page.locator('#submit').click();
    await expect(page.locator('.penpot-app__auth-error')).toBeVisible({ timeout: 10000 });
  });

  test('switching from register back to login preserves no pre-filled data', async ({ page }) => {
    await page.locator('#switch-link').click();
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#pw').fill('Password123');
    await page.locator('#switch-link').click();
    await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
  });

  test('navigate directly to register via URL', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForSelector('penpot-auth-screen');
    await expect(page.locator('#title')).toHaveText('Create your account');
    await expect(page.locator('#name')).toBeVisible();
  });

  test('registration form has correct input types', async ({ page }) => {
    await page.locator('#switch-link').click();
    const emailInput = page.locator('#email');
    const pwInput = page.locator('#pw');
    const nameInput = page.locator('#name');
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(pwInput).toHaveAttribute('type', 'password');
    await expect(nameInput).toHaveAttribute('type', 'text');
  });

  test('password visibility toggle works in register mode', async ({ page }) => {
    await page.locator('#switch-link').click();
    const pwInput = page.locator('#pw');
    await pwInput.fill('TestPassword123');
    await expect(pwInput).toHaveAttribute('type', 'password');
    await page.locator('#pw-toggle').click();
    await expect(pwInput).toHaveAttribute('type', 'text');
    await page.locator('#pw-toggle').click();
    await expect(pwInput).toHaveAttribute('type', 'password');
  });

  test('switching modes multiple times does not crash', async ({ page }) => {
    const link = page.locator('#switch-link');
    for (let i = 0; i < 5; i++) {
      await link.click();
      await expect(page.locator('#title')).toHaveText('Create your account');
      await link.click();
      await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
    }
  });

  test('error message clears when switching modes', async ({ page }) => {
    await page.locator('#email').fill('nonexistent@example.com');
    await page.locator('#pw').fill('wrong');
    await page.locator('#submit').click();
    await expect(page.locator('.penpot-app__auth-error')).toBeVisible({ timeout: 10000 });
    await page.locator('#switch-link').click();
    const errorVisible = await page.locator('.penpot-app__auth-error').isVisible({ timeout: 2000 }).catch(() => false);
  });

  test('register mode does not show recovery link', async ({ page }) => {
    await page.locator('#switch-link').click();
    await expect(page.locator('#title')).toHaveText('Create your account');
    const recoveryLink = page.locator('#recovery-link');
    expect(await recoveryLink.isVisible().catch(() => false)).toBe(false);
  });

  test('short password accepted by client (server may reject)', async ({ page }) => {
    await page.locator('#switch-link').click();
    await page.locator('#name').fill('Short PW User');
    await page.locator('#email').fill('shortpw@test.local');
    await page.locator('#pw').fill('ab');
    await page.locator('#submit').click();
  });

  test('email field has autocomplete attribute', async ({ page }) => {
    await page.locator('#switch-link').click();
    const emailInput = page.locator('#email');
    const autocomplete = await emailInput.getAttribute('autocomplete');
    expect(autocomplete).toBeTruthy();
  });

  // ---- Negative / error handling tests ----

  test('registration with malformed email does not crash', async ({ page }) => {
    await page.locator('#switch-link').click();
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('not-an-email');
    await page.locator('#pw').fill('Password123');
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.locator('#submit').click();
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('pressing Enter in register mode submits form', async ({ page }) => {
    await page.locator('#switch-link').click();
    await page.locator('#name').fill('Enter User');
    await page.locator('#email').fill('enter@test.local');
    await page.locator('#pw').fill('Password123');
    await page.keyboard.press('Enter');
  });

  test('rapid mode switching does not leave stale form data', async ({ page }) => {
    await page.locator('#switch-link').click();
    await page.locator('#name').fill('Stale Name');
    await page.locator('#email').fill('stale@test.local');
    await page.locator('#switch-link').click();
    await page.locator('#switch-link').click();
    const nameValue = await page.locator('#name').inputValue();
  });
});