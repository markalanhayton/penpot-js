# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: page-management.spec.js >> Page Management >> add page button exists in left sidebar
- Location: e2e\page-management.spec.js:22:3

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
  3  | test.describe('Page Management', () => {
  4  | 
  5  |   async function openWorkspace(page) {
  6  |     await page.goto('/');
> 7  |     await page.waitForSelector('penpot-auth-screen');
     |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  8  |     await page.locator('#email').fill('admin@penpot.local');
  9  |     await page.locator('#pw').fill('penpot123');
  10 |     await page.locator('#submit').click();
  11 |     await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  12 |     const dashboard = page.locator('penpot-dashboard');
  13 |     const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
  14 |     if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
  15 |       await fileCard.click();
  16 |       await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
  17 |       return true;
  18 |     }
  19 |     return false;
  20 |   }
  21 | 
  22 |   test('add page button exists in left sidebar', async ({ page }) => {
  23 |     if (!(await openWorkspace(page))) return;
  24 |     const sidebar = page.locator('penpot-left-sidebar');
  25 |     const addBtn = sidebar.locator('#page-add-btn');
  26 |     await expect(addBtn).toBeVisible();
  27 |   });
  28 | 
  29 |   test('pages are listed in left sidebar', async ({ page }) => {
  30 |     if (!(await openWorkspace(page))) return;
  31 |     const sidebar = page.locator('penpot-left-sidebar');
  32 |     const pageList = sidebar.locator('#page-list');
  33 |     await expect(pageList).toBeVisible();
  34 |     const pageItems = pageList.locator('.page-item');
  35 |     const count = await pageItems.count();
  36 |     expect(count).toBeGreaterThanOrEqual(1);
  37 |   });
  38 | 
  39 |   test('clicking page adds a new page', async ({ page }) => {
  40 |     if (!(await openWorkspace(page))) return;
  41 |     const sidebar = page.locator('penpot-left-sidebar');
  42 |     const addBtn = sidebar.locator('#page-add-btn');
  43 |     const pageItemsBefore = sidebar.locator('.page-item');
  44 |     const countBefore = await pageItemsBefore.count();
  45 |     await addBtn.click();
  46 |     const pageItemsAfter = sidebar.locator('.page-item');
  47 |     await expect(pageItemsAfter).toHaveCount(countBefore + 1, { timeout: 3000 });
  48 |   });
  49 | 
  50 |   test('page context menu has rename and delete options', async ({ page }) => {
  51 |     if (!(await openWorkspace(page))) return;
  52 |     const sidebar = page.locator('penpot-left-sidebar');
  53 |     const menuBtn = sidebar.locator('.page-menu-btn').first();
  54 |     await expect(menuBtn).toBeVisible();
  55 |     await menuBtn.click();
  56 |     const contextMenu = sidebar.locator('.page-context-menu');
  57 |     await expect(contextMenu).toBeVisible({ timeout: 2000 });
  58 |   });
  59 | 
  60 |   test('page menu button appears on hover', async ({ page }) => {
  61 |     if (!(await openWorkspace(page))) return;
  62 |     const sidebar = page.locator('penpot-left-sidebar');
  63 |     const pageItem = sidebar.locator('.page-item').first();
  64 |     const menuBtn = pageItem.locator('.page-menu-btn');
  65 |     await expect(menuBtn).toBeAttached();
  66 |   });
  67 | });
```