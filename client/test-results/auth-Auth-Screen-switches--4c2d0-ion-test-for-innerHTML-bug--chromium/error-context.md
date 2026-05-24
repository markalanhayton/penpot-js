# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.js >> Auth Screen >> switches multiple times without crash (regression test for innerHTML bug)
- Location: e2e\auth.spec.js:24:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('penpot-auth-screen') to be visible

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Auth Screen', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/');
> 6  |     await page.waitForSelector('penpot-auth-screen');
     |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  7  |     await page.waitForSelector('#title');
  8  |   });
  9  | 
  10 |   test('shows login form by default', async ({ page }) => {
  11 |     await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
  12 |     await expect(page.locator('#submit')).toHaveText('Sign in');
  13 |   });
  14 | 
  15 |   test('switches to register and back without crash', async ({ page }) => {
  16 |     await page.locator('#switch-link').click();
  17 |     await expect(page.locator('#title')).toHaveText('Create your account');
  18 |     await expect(page.locator('#name-field')).toBeVisible();
  19 | 
  20 |     await page.locator('#switch-link').click();
  21 |     await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
  22 |   });
  23 | 
  24 |   test('switches multiple times without crash (regression test for innerHTML bug)', async ({ page }) => {
  25 |     const link = page.locator('#switch-link');
  26 | 
  27 |     await link.click();
  28 |     await expect(page.locator('#title')).toHaveText('Create your account');
  29 | 
  30 |     await link.click();
  31 |     await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
  32 | 
  33 |     await link.click();
  34 |     await expect(page.locator('#title')).toHaveText('Create your account');
  35 | 
  36 |     await link.click();
  37 |     await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
  38 |   });
  39 | 
  40 |   test('switchLink text updates correctly after mode changes', async ({ page }) => {
  41 |     const link = page.locator('#switch-link');
  42 |     await expect(link).toHaveText('Create one');
  43 | 
  44 |     await link.click();
  45 |     await expect(link).toHaveText('Sign in');
  46 | 
  47 |     await link.click();
  48 |     await expect(link).toHaveText('Create one');
  49 |   });
  50 | 
  51 |   test('shows error on invalid login', async ({ page }) => {
  52 |     await page.locator('#email').fill('nonexistent@example.com');
  53 |     await page.locator('#pw').fill('wrongpassword');
  54 |     await page.locator('#submit').click();
  55 | 
  56 |     await expect(page.locator('.penpot-app__auth-error')).toBeVisible({ timeout: 10000 });
  57 |   });
  58 | 
  59 |   test('can login with valid credentials', async ({ page }) => {
  60 |     await page.locator('#email').fill('admin@penpot.local');
  61 |     await page.locator('#pw').fill('penpot123');
  62 |     await page.locator('#submit').click();
  63 | 
  64 |     await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 10000 });
  65 |   });
  66 | });
```