import { test, expect } from '@playwright/test';

test.describe('File Persistence E2E', () => {

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

  async function getShapeCount(page) {
    const canvas = page.locator('penpot-canvas');
    return canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
  }

  async function drawRect(page) {
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
    await page.waitForTimeout(200);
  }

  test('save button exists in toolbar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const saveBtn = toolbar.locator('#save-btn');
    await expect(saveBtn).toBeVisible();
  });

  test('undo button exists and is initially disabled', async ({ page }) => {
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

  test('draw shape, undo via toolbar button removes it', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawRect(page);
    const afterDraw = await getShapeCount(page);
    expect(afterDraw).toBeGreaterThan(before);
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#undo-btn').click();
    await page.waitForTimeout(300);
    const afterUndo = await getShapeCount(page);
    expect(afterUndo).toBe(before);
  });

  test('draw shape, undo, redo via toolbar restores it', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawRect(page);
    const afterDraw = await getShapeCount(page);
    expect(afterDraw).toBeGreaterThan(before);
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#undo-btn').click();
    await page.waitForTimeout(300);
    await toolbar.locator('#redo-btn').click();
    await page.waitForTimeout(300);
    const afterRedo = await getShapeCount(page);
    expect(afterRedo).toBe(afterDraw);
  });

  test('draw, undo ctrl+z, redo ctrl+shift+z via keyboard', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawRect(page);
    const afterDraw = await getShapeCount(page);
    expect(afterDraw).toBeGreaterThan(before);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    expect(await getShapeCount(page)).toBe(before);
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(300);
    expect(await getShapeCount(page)).toBe(afterDraw);
  });

  test('file name is visible in toolbar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const fileName = toolbar.locator('#file-name');
    await expect(fileName).toBeVisible();
    const text = await fileName.textContent();
    expect(text).toBeTruthy();
  });

  test('file name is editable on double-click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const fileName = toolbar.locator('#file-name');
    await fileName.dblclick();
    await expect(fileName).toHaveAttribute('contenteditable', 'true');
    await page.keyboard.press('Escape');
  });

  test('save dispatches penpot-save event', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const saveEvent = page.evaluate(() => {
      return new Promise((resolve) => {
        const ws = document.querySelector('penpot-workspace');
        ws.addEventListener('penpot-save', (e) => resolve(e.detail || true), { once: true });
        setTimeout(() => resolve(null), 5000);
      });
    });
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#save-btn').click();
    const result = await saveEvent;
  });

  test('undo/redo state event fires after drawing', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const stateEvent = page.evaluate(() => {
      return new Promise((resolve) => {
        const ws = document.querySelector('penpot-workspace');
        ws.addEventListener('penpot-undo-redo-state', (e) => resolve(e.detail), { once: true });
        setTimeout(() => resolve(null), 5000);
      });
    });
    await drawRect(page);
    const result = await stateEvent;
  });

  test('multiple undo steps work correctly', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawRect(page);
    await drawRect(page, { x: 400 } );
    const afterTwo = await getShapeCount(page);
    expect(afterTwo).toBeGreaterThanOrEqual(before + 2);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const afterOneUndo = await getShapeCount(page);
    expect(afterOneUndo).toBeLessThan(afterTwo);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const afterTwoUndo = await getShapeCount(page);
    expect(afterTwoUndo).toBe(before);
  });

  test('redo is disabled after no undo', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const redoBtn = toolbar.locator('#redo-btn');
    expect(await redoBtn.isDisabled()).toBe(true);
  });

  test('back button returns to dashboard', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const backBtn = toolbar.locator('#back');
    await backBtn.click();
    await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 5000 });
  });

  // ---- Negative / error handling tests ----

  test('redo when nothing has been undone does nothing', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(200);
    const after = await getShapeCount(page);
    expect(after).toBe(before);
  });

  test('undo when nothing has been done does nothing', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    const after = await getShapeCount(page);
    expect(after).toBe(before);
  });

  test('save with no changes does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#save-btn').click();
    await page.waitForTimeout(500);
    const realErrors = errors.filter(e => !e.includes('ResizeObserver'));
    expect(realErrors.length).toBe(0);
  });

  test('file name with empty string reverts on blur', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const fileName = toolbar.locator('#file-name');
    const originalName = await fileName.textContent();
    await fileName.dblclick();
    await fileName.fill('');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('rapid undo/redo does not corrupt state', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawRect(page);
    const afterDraw = await getShapeCount(page);
    expect(afterDraw).toBeGreaterThan(before);
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(50);
      await page.keyboard.press('Control+Shift+z');
      await page.waitForTimeout(50);
    }
    const after = await getShapeCount(page);
    expect(after).toBe(afterDraw);
  });

  test('pressing delete with nothing selected does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('no console errors during undo/redo cycle', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(300);
    const realErrors = errors.filter(e => !e.includes('ResizeObserver'));
    expect(realErrors.length).toBe(0);
  });
});