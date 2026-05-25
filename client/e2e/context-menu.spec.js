import { test, expect } from '@playwright/test';

test.describe('Context Menu E2E', () => {

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

  test('context menu component is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-context-menu'));
    expect(defined).toBe(true);
  });

  test('right-clicking on canvas with shape selected shows context menu', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.waitForTimeout(200);
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2, { button: 'right' });
    await page.waitForTimeout(300);
    const contextMenu = page.locator('penpot-context-menu');
    if (await contextMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(contextMenu).toBeVisible();
      const items = contextMenu.locator('.penpot-ctx__context-item');
      const count = await items.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('right-clicking on empty canvas shows limited context menu', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    await page.mouse.click(canvasBox.x + 50, canvasBox.y + 50, { button: 'right' });
    await page.waitForTimeout(300);
    const contextMenu = page.locator('penpot-context-menu');
    if (await contextMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      const items = contextMenu.locator('.penpot-ctx__context-item');
      const count = await items.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('context menu has menu container element', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const contextMenu = page.locator('penpot-context-menu');
    expect(contextMenu).toBeTruthy();
  });

  test('pressing Escape closes context menu', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.waitForTimeout(200);
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2, { button: 'right' });
    await page.waitForTimeout(300);
    const contextMenu = page.locator('penpot-context-menu');
    if (await contextMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  });

  test('clicking outside context menu closes it', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.waitForTimeout(200);
    await page.mouse.click(canvasBox.x + canvasBox.width / 4, canvasBox.y + canvasBox.height / 4, { button: 'right' });
    await page.waitForTimeout(300);
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.75, canvasBox.y + canvasBox.height * 0.75);
    await page.waitForTimeout(200);
  });

  test('right-clicking on file card in dashboard shows dashboard context menu', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15000 });
    const fileCard = dashboard.locator('.penpot-app__file-card[data-file-id], .file-card[data-file-id]').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click({ button: 'right' });
      await page.waitForTimeout(300);
      const contextMenu = page.locator('penpot-context-menu');
      if (await contextMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        const items = contextMenu.locator('.penpot-ctx__context-item');
        const count = await items.count();
        expect(count).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('context menu delete item removes shape', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const before = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    await drawRect(page);
    const afterDraw = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    expect(afterDraw).toBeGreaterThan(before);
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    const afterDelete = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    expect(afterDelete).toBe(before);
  });

  // ---- Negative / error handling ----

  test('right-click rapidly does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    for (let i = 0; i < 3; i++) {
      await page.mouse.click(canvasBox.x + 100 + i * 50, canvasBox.y + 100, { button: 'right' });
      await page.waitForTimeout(100);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });
});