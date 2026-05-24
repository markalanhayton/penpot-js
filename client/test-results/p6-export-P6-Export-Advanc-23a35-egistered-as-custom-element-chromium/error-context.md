# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p6-export.spec.js >> P6: Export + Advanced Features >> share dialog is registered as custom element
- Location: e2e\p6-export.spec.js:32:3

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
  3   | test.describe('P6: Export + Advanced Features', () => {
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
  26  |   test('export dialog is registered as custom element', async ({ page }) => {
  27  |     if (!(await openWorkspace(page))) return;
  28  |     const defined = await page.evaluate(() => customElements.get('penpot-export-dialog'));
  29  |     expect(defined).toBeTruthy();
  30  |   });
  31  | 
  32  |   test('share dialog is registered as custom element', async ({ page }) => {
  33  |     if (!(await openWorkspace(page))) return;
  34  |     const defined = await page.evaluate(() => customElements.get('penpot-share-dialog'));
  35  |     expect(defined).toBeTruthy();
  36  |   });
  37  | 
  38  |   test('comment panel is registered as custom element', async ({ page }) => {
  39  |     if (!(await openWorkspace(page))) return;
  40  |     const defined = await page.evaluate(() => customElements.get('penpot-comment-panel'));
  41  |     expect(defined).toBeTruthy();
  42  |   });
  43  | 
  44  |   test('toolbar has export button', async ({ page }) => {
  45  |     if (!(await openWorkspace(page))) return;
  46  |     const toolbar = page.locator('penpot-toolbar');
  47  |     const exportBtn = toolbar.locator('#export-btn');
  48  |     await expect(exportBtn).toBeVisible();
  49  |   });
  50  | 
  51  |   test('toolbar has comment button', async ({ page }) => {
  52  |     if (!(await openWorkspace(page))) return;
  53  |     const toolbar = page.locator('penpot-toolbar');
  54  |     const commentBtn = toolbar.locator('#comment-btn');
  55  |     await expect(commentBtn).toBeVisible();
  56  |   });
  57  | 
  58  |   test('toolbar has share button', async ({ page }) => {
  59  |     if (!(await openWorkspace(page))) return;
  60  |     const toolbar = page.locator('penpot-toolbar');
  61  |     const shareBtn = toolbar.locator('#share-btn');
  62  |     await expect(shareBtn).toBeVisible();
  63  |   });
  64  | 
  65  |   test('export dialog opens on toolbar export click', async ({ page }) => {
  66  |     if (!(await openWorkspace(page))) return;
  67  |     const exportDialog = page.locator('penpot-export-dialog');
  68  |     await expect(exportDialog).toBeAttached();
  69  | 
  70  |     const toolbar = page.locator('penpot-toolbar');
  71  |     await toolbar.locator('#export-btn').click();
  72  | 
  73  |     const overlay = exportDialog.locator('#overlay');
  74  |     await expect(overlay).toBeVisible({ timeout: 3000 });
  75  |   });
  76  | 
  77  |   test('export dialog has format options (PNG, SVG, PDF)', async ({ page }) => {
  78  |     if (!(await openWorkspace(page))) return;
  79  |     const exportDialog = page.locator('penpot-export-dialog');
  80  |     const toolbar = page.locator('penpot-toolbar');
  81  |     await toolbar.locator('#export-btn').click();
  82  |     await page.waitForTimeout(500);
  83  | 
  84  |     const formatOptions = exportDialog.locator('.format-option');
  85  |     const count = await formatOptions.count();
  86  |     expect(count).toBe(3);
  87  | 
  88  |     const labels = await formatOptions.allTextContents();
  89  |     expect(labels.map(l => l.trim())).toEqual(expect.arrayContaining(['PNG', 'SVG', 'PDF']));
  90  |   });
  91  | 
  92  |   test('export dialog has scale options', async ({ page }) => {
  93  |     if (!(await openWorkspace(page))) return;
  94  |     const exportDialog = page.locator('penpot-export-dialog');
  95  |     const toolbar = page.locator('penpot-toolbar');
  96  |     await toolbar.locator('#export-btn').click();
  97  |     await page.waitForTimeout(500);
  98  | 
  99  |     const scaleBtns = exportDialog.locator('.scale-btn');
  100 |     const count = await scaleBtns.count();
  101 |     expect(count).toBe(4);
  102 | 
  103 |     const activeScale = exportDialog.locator('.scale-btn.active');
  104 |     await expect(activeScale).toHaveText('2x');
  105 |   });
  106 | 
  107 |   test('export dialog close button dismisses dialog', async ({ page }) => {
```