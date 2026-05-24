# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p1-workspace.spec.js >> P1: Workspace Shell + View-Only >> right sidebar shows "Select a shape" when nothing is selected
- Location: e2e\p1-workspace.spec.js:229:3

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
  3   | test.describe('P1: Workspace Shell + View-Only', () => {
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
  14  |   test('workspace renders with toolbar, tools, left sidebar, canvas, and right sidebar', async ({ page }) => {
  15  |     await login(page);
  16  |     const dashboard = page.locator('penpot-dashboard');
  17  | 
  18  |     const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
  19  |     if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
  20  |       await fileCard.click();
  21  |       await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
  22  |       await expect(page.locator('penpot-toolbar')).toBeVisible();
  23  |       await expect(page.locator('penpot-tools-bar')).toBeVisible();
  24  |       await expect(page.locator('penpot-left-sidebar')).toBeVisible();
  25  |       await expect(page.locator('penpot-canvas')).toBeVisible();
  26  |       await expect(page.locator('penpot-right-sidebar')).toBeVisible();
  27  |     }
  28  |   });
  29  | 
  30  |   test('toolbar shows file name and back button', async ({ page }) => {
  31  |     await login(page);
  32  |     const dashboard = page.locator('penpot-dashboard');
  33  | 
  34  |     const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
  35  |     if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
  36  |       await fileCard.click();
  37  |       const workspace = page.locator('penpot-workspace');
  38  |       await expect(workspace).toBeVisible({ timeout: 10000 });
  39  | 
  40  |       const toolbar = page.locator('penpot-toolbar');
  41  |       await expect(toolbar).toBeVisible();
  42  |       const backBtn = toolbar.locator('#back');
  43  |       await expect(backBtn).toBeVisible();
  44  |       const fileName = toolbar.locator('#file-name');
  45  |       await expect(fileName).toBeVisible();
  46  |     }
  47  |   });
  48  | 
  49  |   test('toolbar back button returns to dashboard', async ({ page }) => {
  50  |     await login(page);
  51  |     const dashboard = page.locator('penpot-dashboard');
  52  | 
  53  |     const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
  54  |     if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
  55  |       await fileCard.click();
  56  |       await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
  57  | 
  58  |       const backBtn = page.locator('penpot-toolbar').locator('#back');
  59  |       await backBtn.click();
  60  |       await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 5000 });
  61  |     }
  62  |   });
  63  | 
  64  |   test('tools bar has all drawing tools', async ({ page }) => {
  65  |     await login(page);
  66  |     const dashboard = page.locator('penpot-dashboard');
  67  | 
  68  |     const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
  69  |     if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
  70  |       await fileCard.click();
  71  |       await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
  72  | 
  73  |       const tools = page.locator('penpot-tools-bar');
  74  |       await expect(tools).toBeVisible();
  75  | 
  76  |       const selectTool = tools.locator('[data-tool="select"]');
  77  |       await expect(selectTool).toBeVisible();
  78  |       const handTool = tools.locator('[data-tool="hand"]');
  79  |       await expect(handTool).toBeVisible();
  80  |       const frameTool = tools.locator('[data-tool="frame"]');
  81  |       await expect(frameTool).toBeVisible();
  82  |       const rectTool = tools.locator('[data-tool="rect"]');
  83  |       await expect(rectTool).toBeVisible();
  84  |       const circleTool = tools.locator('[data-tool="circle"]');
  85  |       await expect(circleTool).toBeVisible();
  86  |       const textTool = tools.locator('[data-tool="text"]');
  87  |       await expect(textTool).toBeVisible();
  88  |       const pathTool = tools.locator('[data-tool="path"]');
  89  |       await expect(pathTool).toBeVisible();
  90  |     }
  91  |   });
  92  | 
  93  |   test('tools bar defaults to select tool and can switch', async ({ page }) => {
  94  |     await login(page);
  95  |     const dashboard = page.locator('penpot-dashboard');
  96  | 
  97  |     const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
  98  |     if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
  99  |       await fileCard.click();
  100 |       await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
  101 | 
  102 |       const tools = page.locator('penpot-tools-bar');
  103 |       const selectTool = tools.locator('[data-tool="select"]');
  104 |       await expect(selectTool).toHaveClass(/active/);
  105 | 
  106 |       const rectTool = tools.locator('[data-tool="rect"]');
  107 |       await rectTool.click();
```