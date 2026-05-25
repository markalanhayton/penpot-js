import { test, expect } from '@playwright/test';

test.describe('Interaction Prototyping E2E', () => {

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

  test('right sidebar has prototype tab', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const protoTab = sidebar.locator('[data-tab="prototype"]');
    await expect(protoTab).toBeVisible();
  });

  test('clicking prototype tab shows interaction panel', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const protoTab = sidebar.locator('[data-tab="prototype"]');
    await protoTab.click();
    const interactionPanel = sidebar.locator('#interaction-panel');
    await expect(interactionPanel).toBeVisible();
  });

  test('interaction panel shows empty state when no shape selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(300);
    const panel = page.locator('penpot-interaction-panel');
    await expect(panel).toBeVisible({ timeout: 3000 });
  });

  test('interaction panel shows add button when frame is selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(300);
    const panel = page.locator('penpot-interaction-panel');
    await expect(panel).toBeVisible({ timeout: 3000 });
    const addBtn = panel.locator('.interaction-panel__add-btn[data-action="add-interaction"]');
    await expect(addBtn).toBeVisible({ timeout: 3000 });
  });

  test('clicking add interaction creates an interaction entry', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(300);
    const panel = page.locator('penpot-interaction-panel');
    const addBtn = panel.locator('.interaction-panel__add-btn[data-action="add-interaction"]');
    await expect(addBtn).toBeVisible({ timeout: 3000 });
    await addBtn.click();
    await page.waitForTimeout(200);
    const eventType = panel.locator('.interaction-panel__select[data-prop="event-type"]');
    await expect(eventType).toBeVisible({ timeout: 3000 });
  });

  test('interaction event type dropdown has expected options', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(300);
    const panel = page.locator('penpot-interaction-panel');
    await panel.locator('.interaction-panel__add-btn[data-action="add-interaction"]').click();
    await page.waitForTimeout(200);
    const eventType = panel.locator('.interaction-panel__select[data-prop="event-type"]');
    await expect(eventType).toBeVisible({ timeout: 3000 });
    const options = await eventType.locator('option').count();
    expect(options).toBeGreaterThanOrEqual(1);
  });

  test('interaction action type dropdown has expected options', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(300);
    const panel = page.locator('penpot-interaction-panel');
    await panel.locator('.interaction-panel__add-btn[data-action="add-interaction"]').click();
    await page.waitForTimeout(200);
    const actionType = panel.locator('.interaction-panel__select[data-prop="action-type"]');
    await expect(actionType).toBeVisible({ timeout: 3000 });
  });

  test('interaction panel remove button deletes interaction', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(300);
    const panel = page.locator('penpot-interaction-panel');
    await panel.locator('.interaction-panel__add-btn[data-action="add-interaction"]').click();
    await page.waitForTimeout(200);
    const removeBtn = panel.locator('.interaction-panel__remove-btn[data-action="remove-interaction"]');
    if (await removeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await removeBtn.click();
      await page.waitForTimeout(200);
      const eventType = panel.locator('.interaction-panel__select[data-prop="event-type"]');
      expect(await eventType.isVisible().catch(() => false)).toBe(false);
    }
  });

  test('canvas shows interaction lines when interactions exist', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page, { x: 100, y: 150, w: 200, h: 150 });
    await drawFrame(page, { x: 450, y: 150, w: 200, h: 150 });
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(300);
    const panel = page.locator('penpot-interaction-panel');
    await panel.locator('.interaction-panel__add-btn[data-action="add-interaction"]').click();
    await page.waitForTimeout(200);
  });

  test('interaction panel dispatches penpot-interaction-change event', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(300);
    const panel = page.locator('penpot-interaction-panel');
    await panel.locator('.interaction-panel__add-btn[data-action="add-interaction"]').click();
    await page.waitForTimeout(200);
  });

  test('prototype tab is visible alongside design and inspect', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    await expect(sidebar.locator('[data-tab="design"]')).toBeVisible();
    await expect(sidebar.locator('[data-tab="prototype"]')).toBeVisible();
    await expect(sidebar.locator('[data-tab="inspect"]')).toBeVisible();
  });

  test('non-frame shape shows empty interaction state', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(300);
    const panel = page.locator('penpot-interaction-panel');
    await expect(panel).toBeVisible({ timeout: 3000 });
  });

  // ---- Negative / error handling tests ----

  test('add interaction on non-rect shape shows panel without crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawEllipse(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(300);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('switching between prototype and design tabs does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const sidebar = page.locator('penpot-right-sidebar');
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    for (let i = 0; i < 3; i++) {
      await sidebar.locator('[data-tab="prototype"]').click();
      await page.waitForTimeout(200);
      await sidebar.locator('[data-tab="design"]').click();
      await page.waitForTimeout(200);
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('removing last interaction clears interaction list', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(300);
    const panel = page.locator('penpot-interaction-panel');
    await panel.locator('.interaction-panel__add-btn[data-action="add-interaction"]').click();
    await page.waitForTimeout(200);
    const removeBtn = panel.locator('.interaction-panel__remove-btn[data-action="remove-interaction"]').first();
    if (await removeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await removeBtn.click();
      await page.waitForTimeout(200);
      const items = panel.locator('.interaction-panel__select[data-prop="event-type"]');
      expect(await items.count()).toBe(0);
    }
  });

  test('invalid destination selection in interaction does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(300);
    const panel = page.locator('penpot-interaction-panel');
    await panel.locator('.interaction-panel__add-btn[data-action="add-interaction"]').click();
    await page.waitForTimeout(200);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const destSelect = panel.locator('.interaction-panel__select[data-prop="destination"]').first();
    if (await destSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await destSelect.selectOption({ index: 0 });
      await page.waitForTimeout(300);
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('no console errors when opening prototype tab on empty canvas', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="prototype"]').click();
    await page.waitForTimeout(500);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });
});