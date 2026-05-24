# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p3-extended.spec.js >> Boolean Operations and Z-Order >> properties panel shows boolean operations for multi-selection
- Location: e2e\p3-extended.spec.js:104:3

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
  3   | test.describe('Boolean Operations and Z-Order', () => {
  4   | 
  5   |   async function openWorkspace(page) {
  6   |     await page.goto('/');
> 7   |     await page.waitForSelector('penpot-auth-screen');
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  8   |     await page.locator('#email').fill('admin@penpot.local');
  9   |     await page.locator('#pw').fill('penpot123');
  10  |     await page.locator('#submit').click();
  11  |     await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  12  |     const dashboard = page.locator('penpot-dashboard');
  13  |     const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
  14  |     if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
  15  |       await fileCard.click();
  16  |       await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
  17  |       return true;
  18  |     }
  19  |     return false;
  20  |   }
  21  | 
  22  |   async function drawRect(page, startX, startY, width, height) {
  23  |     const canvas = page.locator('penpot-canvas');
  24  |     const canvasBox = await canvas.boundingBox();
  25  |     if (!canvasBox) return;
  26  |     const tools = page.locator('penpot-tools-bar');
  27  |     await tools.locator('[data-tool="rect"]').click();
  28  |     await page.mouse.move(startX, startY);
  29  |     await page.mouse.down();
  30  |     await page.mouse.move(startX + width, startY + height, { steps: 5 });
  31  |     await page.mouse.up();
  32  |     await page.waitForTimeout(300);
  33  |     await tools.locator('[data-tool="select"]').click();
  34  |   }
  35  | 
  36  |   test('boolean operations buttons appear when multiple shapes selected', async ({ page }) => {
  37  |     if (!(await openWorkspace(page))) return;
  38  |     const canvas = page.locator('penpot-canvas');
  39  |     const canvasBox = await canvas.boundingBox();
  40  |     if (!canvasBox) return;
  41  |     const cx = canvasBox.x + canvasBox.width / 2;
  42  |     const cy = canvasBox.y + canvasBox.height / 2;
  43  |     await drawRect(page, cx - 60, cy - 30, 80, 60);
  44  |     await drawRect(page, cx + 20, cy - 20, 80, 60);
  45  |   });
  46  | 
  47  |   test('Alt+U keyboard shortcut works for boolean union', async ({ page }) => {
  48  |     if (!(await openWorkspace(page))) return;
  49  |     const canvas = page.locator('penpot-canvas');
  50  |     const canvasBox = await canvas.boundingBox();
  51  |     if (!canvasBox) return;
  52  |     const cx = canvasBox.x + canvasBox.width / 2;
  53  |     const cy = canvasBox.y + canvasBox.height / 2;
  54  |     await drawRect(page, cx - 60, cy - 30, 80, 60);
  55  |     await drawRect(page, cx + 20, cy - 20, 80, 60);
  56  | 
  57  |     await page.keyboard.press('Control+a');
  58  |     await page.waitForTimeout(200);
  59  |     await page.keyboard.press('Alt+u');
  60  |     await page.waitForTimeout(500);
  61  |   });
  62  | 
  63  |   test('z-order: bring forward with ] key', async ({ page }) => {
  64  |     if (!(await openWorkspace(page))) return;
  65  |     const canvas = page.locator('penpot-canvas');
  66  |     const canvasBox = await canvas.boundingBox();
  67  |     if (!canvasBox) return;
  68  |     const cx = canvasBox.x + canvasBox.width / 2;
  69  |     const cy = canvasBox.y + canvasBox.height / 2;
  70  |     await drawRect(page, cx - 60, cy - 30, 80, 60);
  71  |     await drawRect(page, cx + 20, cy - 20, 80, 60);
  72  |     await page.keyboard.press(']');
  73  |   });
  74  | 
  75  |   test('z-order: send backward with [ key', async ({ page }) => {
  76  |     if (!(await openWorkspace(page))) return;
  77  |     const canvas = page.locator('penpot-canvas');
  78  |     const canvasBox = await canvas.boundingBox();
  79  |     if (!canvasBox) return;
  80  |     const cx = canvasBox.x + canvasBox.width / 2;
  81  |     const cy = canvasBox.y + canvasBox.height / 2;
  82  |     await drawRect(page, cx - 60, cy - 30, 80, 60);
  83  |     await drawRect(page, cx + 20, cy - 20, 80, 60);
  84  |     await page.keyboard.press('[');
  85  |   });
  86  | 
  87  |   test('rotation handle is visible when shape is selected', async ({ page }) => {
  88  |     if (!(await openWorkspace(page))) return;
  89  |     const canvas = page.locator('penpot-canvas');
  90  |     const canvasBox = await canvas.boundingBox();
  91  |     if (!canvasBox) return;
  92  |     const cx = canvasBox.x + canvasBox.width / 2;
  93  |     const cy = canvasBox.y + canvasBox.height / 2;
  94  |     await drawRect(page, cx - 40, cy - 30, 80, 60);
  95  | 
  96  |     const rotationHandle = await canvas.evaluate((el) => {
  97  |       const svg = el.querySelector('#container svg');
  98  |       if (!svg) return 0;
  99  |       return svg.querySelectorAll('[data-handle="rotation"]').length;
  100 |     });
  101 |     expect(rotationHandle).toBe(1);
  102 |   });
  103 | 
  104 |   test('properties panel shows boolean operations for multi-selection', async ({ page }) => {
  105 |     if (!(await openWorkspace(page))) return;
  106 |     const canvas = page.locator('penpot-canvas');
  107 |     const canvasBox = await canvas.boundingBox();
```