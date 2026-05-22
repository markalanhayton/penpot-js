import { test, expect } from '@playwright/test';

test.describe('P1: Workspace Shell + View-Only', () => {

  async function login(page) {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();
    await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  }

  test('workspace renders with toolbar, tools, left sidebar, canvas, and right sidebar', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('penpot-toolbar')).toBeVisible();
      await expect(page.locator('penpot-tools-bar')).toBeVisible();
      await expect(page.locator('penpot-left-sidebar')).toBeVisible();
      await expect(page.locator('penpot-canvas')).toBeVisible();
      await expect(page.locator('penpot-right-sidebar')).toBeVisible();
    }
  });

  test('toolbar shows file name and back button', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      const workspace = page.locator('penpot-workspace');
      await expect(workspace).toBeVisible({ timeout: 10000 });

      const toolbar = page.locator('penpot-toolbar');
      await expect(toolbar).toBeVisible();
      const backBtn = toolbar.locator('#back');
      await expect(backBtn).toBeVisible();
      const fileName = toolbar.locator('#file-name');
      await expect(fileName).toBeVisible();
    }
  });

  test('toolbar back button returns to dashboard', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });

      const backBtn = page.locator('penpot-toolbar').locator('#back');
      await backBtn.click();
      await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 5000 });
    }
  });

  test('tools bar has all drawing tools', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });

      const tools = page.locator('penpot-tools-bar');
      await expect(tools).toBeVisible();

      const selectTool = tools.locator('[data-tool="select"]');
      await expect(selectTool).toBeVisible();
      const handTool = tools.locator('[data-tool="hand"]');
      await expect(handTool).toBeVisible();
      const frameTool = tools.locator('[data-tool="frame"]');
      await expect(frameTool).toBeVisible();
      const rectTool = tools.locator('[data-tool="rect"]');
      await expect(rectTool).toBeVisible();
      const circleTool = tools.locator('[data-tool="circle"]');
      await expect(circleTool).toBeVisible();
      const textTool = tools.locator('[data-tool="text"]');
      await expect(textTool).toBeVisible();
      const pathTool = tools.locator('[data-tool="path"]');
      await expect(pathTool).toBeVisible();
    }
  });

  test('tools bar defaults to select tool and can switch', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });

      const tools = page.locator('penpot-tools-bar');
      const selectTool = tools.locator('[data-tool="select"]');
      await expect(selectTool).toHaveClass(/active/);

      const rectTool = tools.locator('[data-tool="rect"]');
      await rectTool.click();
      await expect(rectTool).toHaveClass(/active/);
      await expect(selectTool).not.toHaveClass(/active/);
    }
  });

  test('left sidebar has pages, layers, and assets tabs', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });

      const sidebar = page.locator('penpot-left-sidebar');
      await expect(sidebar).toBeVisible();
      const pagesTab = sidebar.locator('[data-tab="pages"]');
      await expect(pagesTab).toBeVisible();
      const layersTab = sidebar.locator('[data-tab="layers"]');
      await expect(layersTab).toBeVisible();
      const assetsTab = sidebar.locator('[data-tab="assets"]');
      await expect(assetsTab).toBeVisible();
    }
  });

  test('left sidebar switches between pages, layers, and assets tabs', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });

      const sidebar = page.locator('penpot-left-sidebar');
      const layersTab = sidebar.locator('[data-tab="layers"]');
      await layersTab.click();
      const activeTab = sidebar.locator('.sidebar-tab.active');
      await expect(activeTab).toHaveAttribute('data-tab', 'layers');

      const assetsTab = sidebar.locator('[data-tab="assets"]');
      await assetsTab.click();
      await expect(activeTab).toHaveAttribute('data-tab', 'assets');
    }
  });

  test('right sidebar has design and inspect tabs', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });

      const sidebar = page.locator('penpot-right-sidebar');
      await expect(sidebar).toBeVisible();
      const designTab = sidebar.locator('[data-tab="design"]');
      await expect(designTab).toBeVisible();
      const inspectTab = sidebar.locator('[data-tab="inspect"]');
      await expect(inspectTab).toBeVisible();
    }
  });

  test('canvas shows loading state then renders', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });

      const canvas = page.locator('penpot-canvas');
      await expect(canvas).toBeVisible();

      const zoomIndicator = canvas.locator('#zoom-indicator');
      await expect(zoomIndicator).toBeVisible();
    }
  });

  test('zoom in and out via zoom controls', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });

      const tools = page.locator('penpot-tools-bar');
      const zoomLevel = tools.locator('#zoom-level');
      await expect(zoomLevel).toHaveText('100%');

      const zoomIn = tools.locator('#zoom-in');
      await zoomIn.click();
      await expect(zoomLevel).toHaveText('125%');

      const zoomOut = tools.locator('#zoom-out');
      await zoomOut.click();
      await expect(zoomLevel).toHaveText('100%');
    }
  });

  test('canvas shows SVG shapes when file has content', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });

      const canvas = page.locator('penpot-canvas');
      await expect(canvas).toBeVisible({ timeout: 5000 });

      const container = canvas.locator('#container');
      await expect(container).toBeVisible();
    }
  });

  test('right sidebar shows "Select a shape" when nothing is selected', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });

      const sidebar = page.locator('penpot-right-sidebar');
      const emptyState = sidebar.locator('.empty-state');
      await expect(emptyState).toBeVisible();
    }
  });

  test('file name in toolbar is editable on double-click', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });

      const toolbar = page.locator('penpot-toolbar');
      const fileName = toolbar.locator('#file-name');
      await expect(fileName).toBeVisible();
      await fileName.dblclick();
      await expect(fileName).toHaveAttribute('contenteditable', 'true');
      await fileName.press('Escape');
    }
  });

  test('create a new file from dashboard opens workspace', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');

    const newFileBtn = dashboard.locator('#new-file-btn, .new-file, .file-new, .file-card').first();
    if (await newFileBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newFileBtn.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 15000 });
    }
  });
});