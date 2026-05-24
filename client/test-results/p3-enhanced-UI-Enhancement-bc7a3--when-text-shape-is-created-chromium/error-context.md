# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p3-enhanced.spec.js >> UI Enhancements: Text Toolbar, Snap, Undo/Redo >> text toolbar appears when text shape is created
- Location: e2e\p3-enhanced.spec.js:40:3

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
  3   | test.describe('UI Enhancements: Text Toolbar, Snap, Undo/Redo', () => {
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
  26  |   test('undo button exists in toolbar', async ({ page }) => {
  27  |     if (!(await openWorkspace(page))) return;
  28  |     const toolbar = page.locator('penpot-toolbar');
  29  |     const undoBtn = toolbar.locator('#undo-btn');
  30  |     await expect(undoBtn).toBeVisible();
  31  |   });
  32  | 
  33  |   test('redo button exists in toolbar', async ({ page }) => {
  34  |     if (!(await openWorkspace(page))) return;
  35  |     const toolbar = page.locator('penpot-toolbar');
  36  |     const redoBtn = toolbar.locator('#redo-btn');
  37  |     await expect(redoBtn).toBeVisible();
  38  |   });
  39  | 
  40  |   test('text toolbar appears when text shape is created', async ({ page }) => {
  41  |     if (!(await openWorkspace(page))) return;
  42  |     const canvas = page.locator('penpot-canvas');
  43  |     const canvasBox = await canvas.boundingBox();
  44  |     if (!canvasBox) return;
  45  | 
  46  |     const tools = page.locator('penpot-tools-bar');
  47  |     await tools.locator('[data-tool="text"]').click();
  48  | 
  49  |     const startX = canvasBox.x + canvasBox.width / 2;
  50  |     const startY = canvasBox.y + canvasBox.height / 2;
  51  |     await page.mouse.move(startX, startY);
  52  |     await page.mouse.click(startX, startY);
  53  |     await page.waitForTimeout(300);
  54  | 
  55  |     await page.keyboard.type('Hello');
  56  |     await page.waitForTimeout(200);
  57  |     await page.keyboard.press('Enter');
  58  |     await page.waitForTimeout(300);
  59  | 
  60  |     await tools.locator('[data-tool="select"]').click();
  61  |     await page.waitForTimeout(200);
  62  | 
  63  |     const textToolbar = page.locator('penpot-text-toolbar');
  64  |     const isVisible = await textToolbar.evaluate(el => el.isVisible);
  65  |   });
  66  | 
  67  |   test('gradient editor component renders', async ({ page }) => {
  68  |     const el = await page.evaluate(() => {
  69  |       customElements.define('test-gradient-editor', class extends HTMLElement {});
  70  |       return true;
  71  |     });
  72  |     expect(el).toBe(true);
  73  |     const editor = page.locator('penpot-gradient-editor');
  74  |     expect(editor).toBeTruthy();
  75  |   });
  76  | 
  77  |   test('shadow editor component renders', async ({ page }) => {
  78  |     const el = await page.evaluate(() => {
  79  |       customElements.define('test-shadow-editor', class extends HTMLElement {});
  80  |       return true;
  81  |     });
  82  |     expect(el).toBe(true);
  83  |     const editor = page.locator('penpot-shadow-editor');
  84  |     expect(editor).toBeTruthy();
  85  |   });
  86  | 
  87  |   test('snap guides module exists', async ({ page }) => {
  88  |     const { SnapGuides } = await import('../public/lib/snap.js');
  89  |     expect(SnapGuides).toBeDefined();
  90  |     expect(typeof SnapGuides).toBe('function');
  91  |   });
  92  | 
  93  |   test('drawing a rectangle then undoing removes it', async ({ page }) => {
  94  |     if (!(await openWorkspace(page))) return;
  95  |     const canvas = page.locator('penpot-canvas');
  96  |     const canvasBox = await canvas.boundingBox();
  97  |     if (!canvasBox) return;
  98  | 
  99  |     const shapesBefore = await canvas.evaluate((el) => {
  100 |       const svg = el.querySelector('#container svg');
  101 |       return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
  102 |     });
  103 | 
  104 |     const tools = page.locator('penpot-tools-bar');
  105 |     await tools.locator('[data-tool="rect"]').click();
  106 | 
  107 |     const startX = canvasBox.x + canvasBox.width / 2;
```