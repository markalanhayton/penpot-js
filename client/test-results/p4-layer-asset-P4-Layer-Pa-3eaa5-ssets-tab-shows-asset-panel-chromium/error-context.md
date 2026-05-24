# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: p4-layer-asset.spec.js >> P4: Layer Panel + Asset Library >> switching to assets tab shows asset panel
- Location: e2e\p4-layer-asset.spec.js:45:3

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
  3   | test.describe('P4: Layer Panel + Asset Library', () => {
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
  26  |   test('left sidebar has layers, assets, and pages tabs', async ({ page }) => {
  27  |     if (!(await openWorkspace(page))) return;
  28  |     const sidebar = page.locator('penpot-left-sidebar');
  29  | 
  30  |     const layersTab = sidebar.locator('[data-tab="layers"]');
  31  |     await expect(layersTab).toBeVisible();
  32  |     const assetsTab = sidebar.locator('[data-tab="assets"]');
  33  |     await expect(assetsTab).toBeVisible();
  34  |     const pagesTab = sidebar.locator('[data-tab="pages"]');
  35  |     await expect(pagesTab).toBeVisible();
  36  |   });
  37  | 
  38  |   test('layers tab is active by default', async ({ page }) => {
  39  |     if (!(await openWorkspace(page))) return;
  40  |     const sidebar = page.locator('penpot-left-sidebar');
  41  |     const activeTab = sidebar.locator('.sidebar-tab.active');
  42  |     await expect(activeTab).toHaveAttribute('data-tab', 'layers');
  43  |   });
  44  | 
  45  |   test('switching to assets tab shows asset panel', async ({ page }) => {
  46  |     if (!(await openWorkspace(page))) return;
  47  |     const sidebar = page.locator('penpot-left-sidebar');
  48  |     const assetsTab = sidebar.locator('[data-tab="assets"]');
  49  |     await assetsTab.click();
  50  | 
  51  |     const assetPanel = sidebar.locator('penpot-asset-panel');
  52  |     await expect(assetPanel).toBeVisible();
  53  |   });
  54  | 
  55  |   test('switching to pages tab shows page list', async ({ page }) => {
  56  |     if (!(await openWorkspace(page))) return;
  57  |     const sidebar = page.locator('penpot-left-sidebar');
  58  |     const pagesTab = sidebar.locator('[data-tab="pages"]');
  59  |     await pagesTab.click();
  60  | 
  61  |     const pageList = sidebar.locator('#page-list');
  62  |     await expect(pageList).toBeVisible();
  63  |   });
  64  | 
  65  |   test('layer panel renders when shapes exist on page', async ({ page }) => {
  66  |     if (!(await openWorkspace(page))) return;
  67  |     const sidebar = page.locator('penpot-left-sidebar');
  68  |     const layerPanel = sidebar.locator('penpot-layer-panel');
  69  |     await expect(layerPanel).toBeVisible();
  70  | 
  71  |     const layerList = layerPanel.locator('#layer-list');
  72  |     await expect(layerList).toBeVisible();
  73  |   });
  74  | 
  75  |   test('layer panel has collapse/expand all buttons', async ({ page }) => {
  76  |     if (!(await openWorkspace(page))) return;
  77  |     const sidebar = page.locator('penpot-left-sidebar');
  78  |     const layerPanel = sidebar.locator('penpot-layer-panel');
  79  | 
  80  |     const collapseBtn = layerPanel.locator('#btn-collapse-all');
  81  |     await expect(collapseBtn).toBeVisible();
  82  | 
  83  |     const expandBtn = layerPanel.locator('#btn-expand-all');
  84  |     await expect(expandBtn).toBeVisible();
  85  |   });
  86  | 
  87  |   test('drawing a shape adds a layer item', async ({ page }) => {
  88  |     if (!(await openWorkspace(page))) return;
  89  |     const sidebar = page.locator('penpot-left-sidebar');
  90  |     const layerPanel = sidebar.locator('penpot-layer-panel');
  91  | 
  92  |     const layersBefore = await layerPanel.evaluate((el) => {
  93  |       const items = el.querySelectorAll('.penpot-layer__layer-item');
  94  |       return items.length;
  95  |     });
  96  | 
  97  |     const canvas = page.locator('penpot-canvas');
  98  |     const canvasBox = await canvas.boundingBox();
  99  |     if (!canvasBox) return;
  100 | 
  101 |     const tools = page.locator('penpot-tools-bar');
  102 |     await tools.locator('[data-tool="rect"]').click();
  103 | 
  104 |     const startX = canvasBox.x + canvasBox.width / 2;
  105 |     const startY = canvasBox.y + canvasBox.height / 2;
  106 |     await page.mouse.move(startX, startY);
  107 |     await page.mouse.down();
```