# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings.spec.js >> Settings Pages >> password validation: mismatch shows error
- Location: e2e\settings.spec.js:66:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('penpot-settings')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('penpot-settings')
    14 × locator resolved to <penpot-settings section="password"></penpot-settings>
       - unexpected value "hidden"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Settings Pages', () => {
  4   | 
  5   |   async function login(page) {
  6   |     await page.goto('/');
  7   |     await page.waitForSelector('penpot-auth-screen');
  8   |     await page.locator('#email').fill('admin@penpot.local');
  9   |     await page.locator('#pw').fill('penpot123');
  10  |     await page.locator('#submit').click();
  11  |     await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  12  |   }
  13  | 
  14  |   async function navigateToSettings(page, section = 'profile') {
  15  |     await page.evaluate((sec) => {
  16  |       if (window.__penpot && window.__penpot.navigate) {
  17  |         window.__penpot.navigate('settings-' + sec);
  18  |       } else {
  19  |         window.location.hash = '#/settings/' + sec;
  20  |       }
  21  |     }, section);
  22  |     await page.waitForURL(/settings/, { timeout: 5000 }).catch(() => {});
> 23  |     await expect(page.locator('penpot-settings')).toBeVisible({ timeout: 5000 });
      |                                                   ^ Error: expect(locator).toBeVisible() failed
  24  |   }
  25  | 
  26  |   test('settings button navigates to settings', async ({ page }) => {
  27  |     await login(page);
  28  |     const dashboard = page.locator('penpot-dashboard');
  29  |     const settingsBtns = dashboard.locator('#settings-btn');
  30  |     await expect(settingsBtns.first()).toBeVisible();
  31  |     await settingsBtns.first().click();
  32  |     await expect(page.locator('penpot-settings')).toBeVisible({ timeout: 5000 });
  33  |   });
  34  | 
  35  |   test('profile settings form renders', async ({ page }) => {
  36  |     await login(page);
  37  |     await navigateToSettings(page, 'profile');
  38  |     const settings = page.locator('penpot-settings');
  39  |     await expect(settings.locator('h2')).toHaveText('Profile Settings');
  40  |     await expect(settings.locator('#fullname')).toBeVisible();
  41  |     await expect(settings.locator('#email')).toBeVisible();
  42  |     await expect(settings.locator('#save-profile')).toBeVisible();
  43  |   });
  44  | 
  45  |   test('password settings form renders', async ({ page }) => {
  46  |     await login(page);
  47  |     await navigateToSettings(page, 'password');
  48  |     const settings = page.locator('penpot-settings');
  49  |     await expect(settings.locator('h2')).toHaveText('Change Password');
  50  |     await expect(settings.locator('#old-password')).toBeVisible();
  51  |     await expect(settings.locator('#new-password')).toBeVisible();
  52  |     await expect(settings.locator('#confirm-password')).toBeVisible();
  53  |     await expect(settings.locator('#change-password')).toBeVisible();
  54  |   });
  55  | 
  56  |   test('feedback form renders', async ({ page }) => {
  57  |     await login(page);
  58  |     await navigateToSettings(page, 'feedback');
  59  |     const settings = page.locator('penpot-settings');
  60  |     await expect(settings.locator('h2')).toHaveText('Send Feedback');
  61  |     await expect(settings.locator('#feedback-type')).toBeVisible();
  62  |     await expect(settings.locator('#feedback-content')).toBeVisible();
  63  |     await expect(settings.locator('#send-feedback')).toBeVisible();
  64  |   });
  65  | 
  66  |   test('password validation: mismatch shows error', async ({ page }) => {
  67  |     await login(page);
  68  |     await navigateToSettings(page, 'password');
  69  |     const settings = page.locator('penpot-settings');
  70  |     await settings.locator('#old-password').fill('oldpass');
  71  |     await settings.locator('#new-password').fill('newpass123');
  72  |     await settings.locator('#confirm-password').fill('different123');
  73  |     await settings.locator('#change-password').click();
  74  |     await expect(settings.locator('.penpot-settings__error')).toContainText('do not match');
  75  |   });
  76  | 
  77  |   test('password validation: too short shows error', async ({ page }) => {
  78  |     await login(page);
  79  |     await navigateToSettings(page, 'password');
  80  |     const settings = page.locator('penpot-settings');
  81  |     await settings.locator('#old-password').fill('oldpass');
  82  |     await settings.locator('#new-password').fill('short');
  83  |     await settings.locator('#confirm-password').fill('short');
  84  |     await settings.locator('#change-password').click();
  85  |     await expect(settings.locator('.penpot-settings__error')).toContainText('8 characters');
  86  |   });
  87  | 
  88  |   test('settings nav switches between sections', async ({ page }) => {
  89  |     await login(page);
  90  |     await navigateToSettings(page, 'profile');
  91  |     const settings = page.locator('penpot-settings');
  92  | 
  93  |     await settings.locator('.penpot-settings__nav-item[data-section="password"]').click();
  94  |     await expect(settings.locator('h2')).toHaveText('Change Password');
  95  | 
  96  |     await settings.locator('.penpot-settings__nav-item[data-section="profile"]').click();
  97  |     await expect(settings.locator('h2')).toHaveText('Profile Settings');
  98  | 
  99  |     await settings.locator('.penpot-settings__nav-item[data-section="feedback"]').click();
  100 |     await expect(settings.locator('h2')).toHaveText('Send Feedback');
  101 |   });
  102 | 
  103 |   test('back link navigates to dashboard', async ({ page }) => {
  104 |     await login(page);
  105 |     await navigateToSettings(page, 'profile');
  106 |     const settings = page.locator('penpot-settings');
  107 |     await settings.locator('.penpot-settings__back-link').click();
  108 |     await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 5000 });
  109 |   });
  110 | });
```