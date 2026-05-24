# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p3-tools.spec.js >> P3: Drawing & Editing Tools >> select tool cursor is default
- Location: e2e\p3-tools.spec.js:163:3

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
  3   | test.describe('P3: Drawing & Editing Tools', () => {
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
  26  |   test('tool manager initializes with select tool active', async ({ page }) => {
  27  |     if (!(await openWorkspace(page))) return;
  28  |     const tools = page.locator('penpot-tools-bar');
  29  |     const selectTool = tools.locator('[data-tool="select"]');
  30  |     await expect(selectTool).toHaveClass(/active/);
  31  |   });
  32  | 
  33  |   test('switch to rectangle tool via toolbar click', async ({ page }) => {
  34  |     if (!(await openWorkspace(page))) return;
  35  |     const tools = page.locator('penpot-tools-bar');
  36  |     const rectTool = tools.locator('[data-tool="rect"]');
  37  |     await rectTool.click();
  38  |     await expect(rectTool).toHaveClass(/active/);
  39  |     const selectTool = tools.locator('[data-tool="select"]');
  40  |     await expect(selectTool).not.toHaveClass(/active/);
  41  |   });
  42  | 
  43  |   test('switch to ellipse tool via toolbar click', async ({ page }) => {
  44  |     if (!(await openWorkspace(page)) ) return;
  45  |     const tools = page.locator('penpot-tools-bar');
  46  |     const circleTool = tools.locator('[data-tool="circle"]');
  47  |     await circleTool.click();
  48  |     await expect(circleTool).toHaveClass(/active/);
  49  |   });
  50  | 
  51  |   test('switch to frame tool via toolbar click', async ({ page }) => {
  52  |     if (!(await openWorkspace(page))) return;
  53  |     const tools = page.locator('penpot-tools-bar');
  54  |     const frameTool = tools.locator('[data-tool="frame"]');
  55  |     await frameTool.click();
  56  |     await expect(frameTool).toHaveClass(/active/);
  57  |   });
  58  | 
  59  |   test('switch to text tool via toolbar click', async ({ page }) => {
  60  |     if (!(await openWorkspace(page))) return;
  61  |     const tools = page.locator('penpot-tools-bar');
  62  |     const textTool = tools.locator('[data-tool="text"]');
  63  |     await textTool.click();
  64  |     await expect(textTool).toHaveClass(/active/);
  65  |   });
  66  | 
  67  |   test('switch to hand tool via toolbar click', async ({ page }) => {
  68  |     if (!(await openWorkspace(page))) return;
  69  |     const tools = page.locator('penpot-tools-bar');
  70  |     const handTool = tools.locator('[data-tool="hand"]');
  71  |     await handTool.click();
  72  |     await expect(handTool).toHaveClass(/active/);
  73  |   });
  74  | 
  75  |   test('tool switching via keyboard shortcuts', async ({ page }) => {
  76  |     if (!(await openWorkspace(page))) return;
  77  |     const canvas = page.locator('penpot-canvas');
  78  |     await canvas.click();
  79  | 
  80  |     await page.keyboard.press('r');
  81  |     const tools = page.locator('penpot-tools-bar');
  82  |     const rectTool = tools.locator('[data-tool="rect"]');
  83  |     await expect(rectTool).toHaveClass(/active/);
  84  | 
  85  |     await page.keyboard.press('v');
  86  |     const selectTool = tools.locator('[data-tool="select"]');
  87  |     await expect(selectTool).toHaveClass(/active/);
  88  | 
  89  |     await page.keyboard.press('e');
  90  |     const circleTool = tools.locator('[data-tool="circle"]');
  91  |     await expect(circleTool).toHaveClass(/active/);
  92  | 
  93  |     await page.keyboard.press('t');
  94  |     const textTool = tools.locator('[data-tool="text"]');
  95  |     await expect(textTool).toHaveClass(/active/);
  96  | 
  97  |     await page.keyboard.press('h');
  98  |     const handTool = tools.locator('[data-tool="hand"]');
  99  |     await expect(handTool).toHaveClass(/active/);
  100 | 
  101 |     await page.keyboard.press('f');
  102 |     const frameTool = tools.locator('[data-tool="frame"]');
  103 |     await expect(frameTool).toHaveClass(/active/);
  104 |   });
  105 | 
  106 |   test('drawing a rectangle creates a shape on canvas', async ({ page }) => {
  107 |     if (!(await openWorkspace(page))) return;
```