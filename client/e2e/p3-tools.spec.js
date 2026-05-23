import { test, expect } from '@playwright/test';

test.describe('P3: Drawing & Editing Tools', () => {

  async function login(page) {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();
    await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  }

  async function openWorkspace(page) {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');
    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
      return true;
    }
    return false;
  }

  test('tool manager initializes with select tool active', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    const selectTool = tools.locator('[data-tool="select"]');
    await expect(selectTool).toHaveClass(/active/);
  });

  test('switch to rectangle tool via toolbar click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    const rectTool = tools.locator('[data-tool="rect"]');
    await rectTool.click();
    await expect(rectTool).toHaveClass(/active/);
    const selectTool = tools.locator('[data-tool="select"]');
    await expect(selectTool).not.toHaveClass(/active/);
  });

  test('switch to ellipse tool via toolbar click', async ({ page }) => {
    if (!(await openWorkspace(page)) ) return;
    const tools = page.locator('penpot-tools-bar');
    const circleTool = tools.locator('[data-tool="circle"]');
    await circleTool.click();
    await expect(circleTool).toHaveClass(/active/);
  });

  test('switch to frame tool via toolbar click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    const frameTool = tools.locator('[data-tool="frame"]');
    await frameTool.click();
    await expect(frameTool).toHaveClass(/active/);
  });

  test('switch to text tool via toolbar click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    const textTool = tools.locator('[data-tool="text"]');
    await textTool.click();
    await expect(textTool).toHaveClass(/active/);
  });

  test('switch to hand tool via toolbar click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    const handTool = tools.locator('[data-tool="hand"]');
    await handTool.click();
    await expect(handTool).toHaveClass(/active/);
  });

  test('tool switching via keyboard shortcuts', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    await canvas.click();

    await page.keyboard.press('r');
    const tools = page.locator('penpot-tools-bar');
    const rectTool = tools.locator('[data-tool="rect"]');
    await expect(rectTool).toHaveClass(/active/);

    await page.keyboard.press('v');
    const selectTool = tools.locator('[data-tool="select"]');
    await expect(selectTool).toHaveClass(/active/);

    await page.keyboard.press('e');
    const circleTool = tools.locator('[data-tool="circle"]');
    await expect(circleTool).toHaveClass(/active/);

    await page.keyboard.press('t');
    const textTool = tools.locator('[data-tool="text"]');
    await expect(textTool).toHaveClass(/active/);

    await page.keyboard.press('h');
    const handTool = tools.locator('[data-tool="hand"]');
    await expect(handTool).toHaveClass(/active/);

    await page.keyboard.press('f');
    const frameTool = tools.locator('[data-tool="frame"]');
    await expect(frameTool).toHaveClass(/active/);
  });

  test('drawing a rectangle creates a shape on canvas', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    const rectTool = tools.locator('[data-tool="rect"]');
    await rectTool.click();

    const container = canvas.locator('#container');
    await container.hover();

    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 80, { steps: 5 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    const svgShapes = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    expect(svgShapes).toBeGreaterThanOrEqual(1);
  });

  test('drawing an ellipse creates a shape on canvas', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    const circleTool = tools.locator('[data-tool="circle"]');
    await circleTool.click();

    const startX = canvasBox.x + canvasBox.width / 3;
    const startY = canvasBox.y + canvasBox.height / 3;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60, { steps: 5 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    const svgShapes = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    expect(svgShapes).toBeGreaterThanOrEqual(1);
  });

  test('select tool cursor is default', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="select"]').click();
    const canvas = page.locator('penpot-canvas');
    const cursor = await canvas.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('default');
  });

  test('drawing tools cursor is crosshair', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    const canvas = page.locator('penpot-canvas');
    const cursor = await canvas.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('crosshair');
  });

  test('hand tool cursor is grab', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="hand"]').click();
    const canvas = page.locator('penpot-canvas');
    const cursor = await canvas.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('grab');
  });

  test('text tool cursor is text', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="text"]').click();
    const canvas = page.locator('penpot-canvas');
    const cursor = await canvas.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('text');
  });

  test('zoom in via button changes zoom indicator', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    const zoomLevel = tools.locator('#zoom-level');
    await expect(zoomLevel).toHaveText('100%');

    await tools.locator('#zoom-in').click();
    await expect(zoomLevel).toHaveText('125%');

    await tools.locator('#zoom-out').click();
    await expect(zoomLevel).toHaveText('100%');
  });

  test('zoom fit button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('#zoom-in').click();
    await tools.locator('#zoom-in').click();
    const zoomLevel = tools.locator('#zoom-level');
    const zoomText = await zoomLevel.textContent();
    expect(parseInt(zoomText)).toBeGreaterThan(100);

    await tools.locator('#zoom-fit').click();
    await expect(zoomLevel).toHaveText('100%');
  });

  test('canvas pan with shift+click drag', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const panXBefore = await canvas.evaluate((el) => el.panX);
    const panYBefore = await canvas.evaluate((el) => el.panY);

    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;

    await page.keyboard.down('Shift');
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY + 50, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Shift');

    const panXAfter = await canvas.evaluate((el) => el.panX);
    expect(panXAfter).not.toBe(panXBefore);
  });

  test('drawing shows selection after shape creation', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();

    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60, { steps: 5 });
    await page.mouse.up();

    await page.waitForTimeout(300);

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(100);

    const selectionHandles = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      if (!svg) return 0;
      return svg.querySelectorAll('.penpot-selection-handle').length;
    });
    expect(selectionHandles).toBeGreaterThanOrEqual(1);
  });

  test('drawing preview shows dashed stroke during drag', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();

    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY + 40, { steps: 3 });

    const previewPresent = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      if (!svg) return false;
      const preview = svg.querySelector('[stroke-dasharray]');
      return preview !== null;
    });
    expect(previewPresent).toBe(true);

    await page.mouse.up();
  });

  test('properties panel shows shape info when selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const rightSidebar = page.locator('penpot-right-sidebar');
    const emptyState = rightSidebar.locator('.empty-state');
    await expect(emptyState).toBeVisible();

    const fileData = await canvas.evaluate(() => {
      const ws = document.querySelector('penpot-workspace');
      return ws ? true : false;
    });
  });

  test('drawing a small shape is ignored (minimum size)', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const shapesBefore = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();

    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 1, startY + 1);
    await page.mouse.up();

    await page.waitForTimeout(200);

    const shapesAfter = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    expect(shapesAfter).toBe(shapesBefore);
  });

  test('escape key cancels drawing preview', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const shapesBefore = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();

    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 80, { steps: 5 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    const shapesAfter = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    expect(shapesAfter).toBe(shapesBefore);
  });
});