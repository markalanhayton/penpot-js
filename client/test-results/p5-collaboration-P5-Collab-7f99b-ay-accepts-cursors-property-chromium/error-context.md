# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p5-collaboration.spec.js >> P5: Collaboration (WebSocket) >> cursor overlay accepts cursors property
- Location: e2e\p5-collaboration.spec.js:67:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('penpot-auth-screen') to be visible

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('P5: Collaboration (WebSocket)', () => {
  4   | 
  5   |   async function login(page) {
  6   |     await page.goto('/');
> 7   |     await page.waitForSelector('penpot-auth-screen');
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  8   |     await page.locator('#email').fill('admin@penpot.local');
  9   |     await page.locator('#pw').fill('penpot123');
  10  |     await page.locator('#submit').click();
  11  |     await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  12  |   }
  13  | 
  14  |   async function openWorkspace(page) {
  15  |     await login(page);
  16  |     const dashboard = page.locator('penpot-dashboard');
  17  |     const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
  18  |     if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
  19  |       await fileCard.click();
  20  |       await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
  21  |       return true;
  22  |     }
  23  |     return false;
  24  |   }
  25  | 
  26  |   test('workspace renders with cursor overlay component', async ({ page }) => {
  27  |     if (!(await openWorkspace(page))) return;
  28  |     const cursorOverlay = page.locator('penpot-cursor-overlay');
  29  |     await expect(cursorOverlay).toBeVisible();
  30  |   });
  31  | 
  32  |   test('workspace renders with presence bar in toolbar', async ({ page }) => {
  33  |     if (!(await openWorkspace(page))) return;
  34  |     const presenceBar = page.locator('penpot-toolbar').locator('penpot-presence-bar');
  35  |     await expect(presenceBar).toBeVisible();
  36  |   });
  37  | 
  38  |   test('presence bar shows disconnected status when no WS', async ({ page }) => {
  39  |     if (!(await openWorkspace(page))) return;
  40  |     const toolbar = page.locator('penpot-toolbar');
  41  |     const presenceBar = toolbar.locator('penpot-presence-bar');
  42  |     await expect(presenceBar).toBeVisible();
  43  | 
  44  |     const statusDot = presenceBar.locator('#status');
  45  |     await expect(statusDot).toBeVisible();
  46  |   });
  47  | 
  48  |   test('presence bar has avatar container', async ({ page }) => {
  49  |     if (!(await openWorkspace(page))) return;
  50  |     const toolbar = page.locator('penpot-toolbar');
  51  |     const presenceBar = toolbar.locator('penpot-presence-bar');
  52  |     await expect(presenceBar).toBeVisible();
  53  | 
  54  |     const avatars = presenceBar.locator('#avatars');
  55  |     await expect(avatars).toBeVisible();
  56  |   });
  57  | 
  58  |   test('cursor overlay has container element', async ({ page }) => {
  59  |     if (!(await openWorkspace(page))) return;
  60  |     const cursorOverlay = page.locator('penpot-cursor-overlay');
  61  |     await expect(cursorOverlay).toBeVisible();
  62  | 
  63  |     const container = cursorOverlay.locator('#cursors');
  64  |     await expect(container).toBeVisible();
  65  |   });
  66  | 
  67  |   test('cursor overlay accepts cursors property', async ({ page }) => {
  68  |     if (!(await openWorkspace(page))) return;
  69  |     const cursorOverlay = page.locator('penpot-cursor-overlay');
  70  | 
  71  |     await cursorOverlay.evaluate((el) => {
  72  |       el.cursors = [
  73  |         { id: 'user-1', name: 'Alice', x: 100, y: 200, color: '#31efb8', page: 'page-1' },
  74  |       ];
  75  |     });
  76  | 
  77  |     const cursors = cursorOverlay.locator('.cursor-container > div');
  78  |     const count = await cursors.count();
  79  |     expect(count).toBeGreaterThanOrEqual(0);
  80  |   });
  81  | 
  82  |   test('ws module exports are available', async ({ page }) => {
  83  |     await page.goto('/');
  84  |     const wsAvailable = await page.evaluate(() => {
  85  |       return typeof window.__penpot !== 'undefined';
  86  |     });
  87  |     expect(wsAvailable).toBe(true);
  88  |   });
  89  | 
  90  |   test('toolbar has presence bar element before share button', async ({ page }) => {
  91  |     if (!(await openWorkspace(page))) return;
  92  |     const toolbar = page.locator('penpot-toolbar');
  93  |     const shareBtn = toolbar.locator('#share-btn');
  94  |     await expect(shareBtn).toBeVisible();
  95  |     const presenceBar = toolbar.locator('penpot-presence-bar');
  96  |     await expect(presenceBar).toBeVisible();
  97  |   });
  98  | 
  99  |   test('app store has collaboration state keys', async ({ page }) => {
  100 |     await page.goto('/');
  101 |     const hasKeys = await page.evaluate(() => {
  102 |       const store = window.__penpot?.store;
  103 |       if (!store) return false;
  104 |       return store.get('wsConnected') !== undefined;
  105 |     });
  106 |     expect(hasKeys).toBe(true);
  107 |   });
```