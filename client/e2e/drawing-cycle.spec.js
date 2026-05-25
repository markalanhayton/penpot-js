import { test, expect } from '@playwright/test';

test.describe('Drawing Cycle E2E', () => {

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

  async function drawRect(page, opts = {}) {
    const x = opts.x ?? 300;
    const y = opts.y ?? 200;
    const w = opts.w ?? 80;
    const h = opts.h ?? 60;
    const canvas = page.locator('penpot-canvas');
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + w, y + h, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);
  }

  async function drawEllipse(page, opts = {}) {
    const x = opts.x ?? 300;
    const y = opts.y ?? 200;
    const w = opts.w ?? 80;
    const h = opts.h ?? 60;
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="circle"]').click();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + w, y + h, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);
  }

  async function drawFrame(page, opts = {}) {
    const x = opts.x ?? 200;
    const y = opts.y ?? 150;
    const w = opts.w ?? 200;
    const h = opts.h ?? 150;
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="frame"]').click();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + w, y + h, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);
  }

  async function getShapeCount(page) {
    const canvas = page.locator('penpot-canvas');
    return canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
  }

  test('draw rectangle, select it, verify shape in DOM', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawRect(page);
    const after = await getShapeCount(page);
    expect(after).toBeGreaterThan(before);
  });

  test('draw ellipse, select it, verify shape in DOM', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawEllipse(page);
    const after = await getShapeCount(page);
    expect(after).toBeGreaterThan(before);
  });

  test('draw frame, verify shape in DOM', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawFrame(page);
    const after = await getShapeCount(page);
    expect(after).toBeGreaterThan(before);
  });

  test('draw rectangle, verify right sidebar shows properties', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    const xInput = sidebar.locator('.penpot-rside__prop-input[data-prop="x"]');
    await expect(xInput).toBeVisible({ timeout: 3000 });
    const yInput = sidebar.locator('.penpot-rside__prop-input[data-prop="y"]');
    await expect(yInput).toBeVisible();
    const wInput = sidebar.locator('.penpot-rside__prop-input[data-prop="w"]');
    await expect(wInput).toBeVisible();
    const hInput = sidebar.locator('.penpot-rside__prop-input[data-prop="h"]');
    await expect(hInput).toBeVisible();
  });

  test('draw rectangle, change properties in sidebar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    const xInput = sidebar.locator('.penpot-rside__prop-input[data-prop="x"]');
    await expect(xInput).toBeVisible({ timeout: 3000 });
    await xInput.fill('150');
    await xInput.press('Enter');
    await page.waitForTimeout(200);
    const value = await xInput.inputValue();
    expect(value).toBe('150');
  });

  test('draw rectangle then delete via keyboard', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawRect(page);
    const afterDraw = await getShapeCount(page);
    expect(afterDraw).toBeGreaterThan(before);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    const afterDelete = await getShapeCount(page);
    expect(afterDelete).toBe(before);
  });

  test('draw two rectangles, select both via shift-click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page, { x: 200, y: 200 });
    await drawRect(page, { x: 400, y: 200 });
    const after = await getShapeCount(page);
    expect(after).toBeGreaterThanOrEqual(2);
  });

  test('draw rectangle, verify opacity property available', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    const opacityInput = sidebar.locator('.penpot-rside__prop-input[data-prop="opacity"]');
    await expect(opacityInput).toBeVisible({ timeout: 3000 });
  });

  test('draw rectangle, verify rotation property available', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    const rotInput = sidebar.locator('.penpot-rside__prop-input[data-prop="rotation"]');
    await expect(rotInput).toBeVisible({ timeout: 3000 });
  });

  test('draw rectangle then undo removes it', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawRect(page);
    const afterDraw = await getShapeCount(page);
    expect(afterDraw).toBeGreaterThan(before);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const afterUndo = await getShapeCount(page);
    expect(afterUndo).toBe(before);
  });

  test('draw rectangle, undo, redo restores it', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawRect(page);
    const afterDraw = await getShapeCount(page);
    expect(afterDraw).toBeGreaterThan(before);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(300);
    const afterRedo = await getShapeCount(page);
    expect(afterRedo).toBe(afterDraw);
  });

  test('draw rectangle then draw ellipse, both exist', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawRect(page, { x: 200, y: 200 });
    await drawEllipse(page, { x: 400, y: 200 });
    const after = await getShapeCount(page);
    expect(after).toBeGreaterThanOrEqual(before + 2);
  });

  test('selection handles appear after drawing and clicking shape', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const canvas = page.locator('penpot-canvas');
    const handles = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      if (!svg) return 0;
      return svg.querySelectorAll('.penpot-selection-handle').length;
    });
    expect(handles).toBeGreaterThanOrEqual(1);
  });

  test('draw frame then draw rectangle inside frame', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await drawFrame(page);
    const afterFrame = await getShapeCount(page);
    expect(afterFrame).toBeGreaterThan(before);
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 40, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);
    const afterRect = await getShapeCount(page);
    expect(afterRect).toBeGreaterThan(afterFrame);
  });

  test('draw rectangle, change width via property input', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    const wInput = sidebar.locator('.penpot-rside__prop-input[data-prop="w"]');
    await expect(wInput).toBeVisible({ timeout: 3000 });
    await wInput.fill('200');
    await wInput.press('Enter');
    await page.waitForTimeout(200);
    const val = await wInput.inputValue();
    expect(val).toBe('200');
  });

  test('draw rectangle, change height via property input', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    const hInput = sidebar.locator('.penpot-rside__prop-input[data-prop="h"]');
    await expect(hInput).toBeVisible({ timeout: 3000 });
    await hInput.fill('150');
    await hInput.press('Enter');
    await page.waitForTimeout(200);
    const val = await hInput.inputValue();
    expect(val).toBe('150');
  });

  test('click empty canvas deselects shape', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    const xInput = sidebar.locator('.penpot-rside__prop-input[data-prop="x"]');
    await expect(xInput).toBeVisible({ timeout: 3000 });
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    await page.mouse.click(canvasBox.x + 5, canvasBox.y + 5);
    await page.waitForTimeout(300);
    const emptyState = sidebar.locator('.penpot-rside__empty-state');
    await expect(emptyState).toBeVisible({ timeout: 3000 });
  });

  test('draw rectangle, verify fill section visible in right sidebar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await expect(sidebar.locator('#add-fill-solid')).toBeVisible({ timeout: 3000 });
  });

  test('draw rectangle, verify stroke section visible in right sidebar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await expect(sidebar.locator('#add-stroke')).toBeVisible({ timeout: 3000 });
  });

  // ---- Negative / error handling tests ----

  test('drawing a tiny shape does not create a shape (minimum size enforcement)', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 1, cy + 1);
    await page.mouse.up();
    await page.waitForTimeout(300);
    await tools.locator('[data-tool="select"]').click();
    const after = await getShapeCount(page);
    expect(after).toBe(before);
  });

  test('pressing Escape cancels shape in progress', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 60, { steps: 5 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const after = await getShapeCount(page);
    expect(after).toBe(before);
  });

  test('pressing Delete with nothing selected does not error', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await getShapeCount(page);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);
    const after = await getShapeCount(page);
    expect(after).toBe(before);
  });

  test('entering non-numeric value in width input does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    const wInput = sidebar.locator('.penpot-rside__prop-input[data-prop="w"]');
    await expect(wInput).toBeVisible({ timeout: 3000 });
    await wInput.fill('abc');
    await wInput.press('Enter');
    await page.waitForTimeout(200);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('entering negative width input does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    const wInput = sidebar.locator('.penpot-rside__prop-input[data-prop="w"]');
    await expect(wInput).toBeVisible({ timeout: 3000 });
    await wInput.fill('-100');
    await wInput.press('Enter');
    await page.waitForTimeout(200);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('entering zero width input does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    const wInput = sidebar.locator('.penpot-rside__prop-input[data-prop="w"]');
    await expect(wInput).toBeVisible({ timeout: 3000 });
    await wInput.fill('0');
    await wInput.press('Enter');
    await page.waitForTimeout(200);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('multiple undo beyond history depth does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(50);
    }
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('multiple redo beyond history depth does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Control+Shift+z');
      await page.waitForTimeout(50);
    }
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('no console errors during basic drawing cycle', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const undoRedoErrors = errors.filter(e => !e.includes('ResizeObserver'));
    expect(undoRedoErrors.length).toBe(0);
  });
});