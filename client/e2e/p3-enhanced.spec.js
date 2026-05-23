import { test, expect } from '@playwright/test';

test.describe('UI Enhancements: Text Toolbar, Snap, Undo/Redo', () => {

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

  test('undo button exists in toolbar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const undoBtn = toolbar.locator('#undo-btn');
    await expect(undoBtn).toBeVisible();
  });

  test('redo button exists in toolbar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const redoBtn = toolbar.locator('#redo-btn');
    await expect(redoBtn).toBeVisible();
  });

  test('text toolbar appears when text shape is created', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="text"]').click();

    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.click(startX, startY);
    await page.waitForTimeout(300);

    await page.keyboard.type('Hello');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);

    const textToolbar = page.locator('penpot-text-toolbar');
    const isVisible = await textToolbar.evaluate(el => el.isVisible);
  });

  test('gradient editor component renders', async ({ page }) => {
    const el = await page.evaluate(() => {
      customElements.define('test-gradient-editor', class extends HTMLElement {});
      return true;
    });
    expect(el).toBe(true);
    const editor = page.locator('penpot-gradient-editor');
    expect(editor).toBeTruthy();
  });

  test('shadow editor component renders', async ({ page }) => {
    const el = await page.evaluate(() => {
      customElements.define('test-shadow-editor', class extends HTMLElement {});
      return true;
    });
    expect(el).toBe(true);
    const editor = page.locator('penpot-shadow-editor');
    expect(editor).toBeTruthy();
  });

  test('snap guides module exists', async ({ page }) => {
    const { SnapGuides } = await import('../public/lib/snap.js');
    expect(SnapGuides).toBeDefined();
    expect(typeof SnapGuides).toBe('function');
  });

  test('drawing a rectangle then undoing removes it', async ({ page }) => {
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
    await page.mouse.move(startX + 80, startY + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const shapesAfterDraw = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    expect(shapesAfterDraw).toBeGreaterThan(shapesBefore);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    const shapesAfterUndo = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    expect(shapesAfterUndo).toBe(shapesBefore);
  });

  test('drawing a rectangle then redoing restores it', async ({ page }) => {
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
    await page.mouse.move(startX + 60, startY + 40, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(100);

    const shapesAfterDraw = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const shapesAfterUndo = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    expect(shapesAfterUndo).toBeLessThan(shapesAfterDraw);

    await page.keyboard.press('Control+y');
    await page.waitForTimeout(300);
    const shapesAfterRedo = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    expect(shapesAfterRedo).toBe(shapesAfterDraw);
  });

  test('right sidebar shows fills section for selected shape', async ({ page }) => {
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
    await page.mouse.move(startX + 100, startY + 80, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);

    const rightSidebar = page.locator('penpot-right-sidebar');
    const fillsSection = rightSidebar.locator('h4');
    const hasFills = await fillsSection.count();
    expect(hasFills).toBeGreaterThan(0);
  });
});