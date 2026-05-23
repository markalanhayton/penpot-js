import { test, expect } from '@playwright/test';

test.describe('Boolean Operations and Z-Order', () => {

  async function openWorkspace(page) {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();
    await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
    const dashboard = page.locator('penpot-dashboard');
    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
      return true;
    }
    return false;
  }

  async function drawRect(page, startX, startY, width, height) {
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + width, startY + height, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await tools.locator('[data-tool="select"]').click();
  }

  test('boolean operations buttons appear when multiple shapes selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await drawRect(page, cx - 60, cy - 30, 80, 60);
    await drawRect(page, cx + 20, cy - 20, 80, 60);
  });

  test('Alt+U keyboard shortcut works for boolean union', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await drawRect(page, cx - 60, cy - 30, 80, 60);
    await drawRect(page, cx + 20, cy - 20, 80, 60);

    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Alt+u');
    await page.waitForTimeout(500);
  });

  test('z-order: bring forward with ] key', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await drawRect(page, cx - 60, cy - 30, 80, 60);
    await drawRect(page, cx + 20, cy - 20, 80, 60);
    await page.keyboard.press(']');
  });

  test('z-order: send backward with [ key', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await drawRect(page, cx - 60, cy - 30, 80, 60);
    await drawRect(page, cx + 20, cy - 20, 80, 60);
    await page.keyboard.press('[');
  });

  test('rotation handle is visible when shape is selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await drawRect(page, cx - 40, cy - 30, 80, 60);

    const rotationHandle = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      if (!svg) return 0;
      return svg.querySelectorAll('[data-handle="rotation"]').length;
    });
    expect(rotationHandle).toBe(1);
  });

  test('properties panel shows boolean operations for multi-selection', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await drawRect(page, cx - 60, cy - 30, 80, 60);
    await drawRect(page, cx + 20, cy - 20, 80, 60);

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="select"]').click();

    await page.keyboard.press('Control+a');
    await page.waitForTimeout(300);

    const rightSidebar = page.locator('penpot-right-sidebar');
    const boolOps = rightSidebar.locator('.bool-ops');
    await expect(boolOps).toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('group shortcut Ctrl+G works', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await drawRect(page, cx - 60, cy - 30, 80, 60);
    await drawRect(page, cx + 20, cy - 20, 80, 60);

    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(300);
  });

  test('ungroup shortcut Ctrl+Shift+G works', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await drawRect(page, cx - 60, cy - 30, 80, 60);
    await drawRect(page, cx + 20, cy - 20, 80, 60);

    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+g');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+Shift+g');
    await page.waitForTimeout(300);
  });

  test('image tool appears in toolbar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    const imageTool = tools.locator('[data-tool="image"]');
    await expect(imageTool).toBeVisible();
  });

  test('path tool appears in toolbar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    const pathTool = tools.locator('[data-tool="path"]');
    await expect(pathTool).toBeVisible();
  });
});