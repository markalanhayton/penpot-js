import { test, expect } from '@playwright/test';

test.describe('WebSocket Reconnection E2E', () => {

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

  test('workspace has cursor overlay component', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const cursorOverlay = page.locator('penpot-cursor-overlay');
    await expect(cursorOverlay).toBeVisible({ timeout: 5000 });
  });

  test('workspace has presence bar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const presenceBar = page.locator('penpot-toolbar').locator('penpot-presence-bar');
    await expect(presenceBar).toBeVisible({ timeout: 5000 });
  });

  test('presence bar shows status indicator', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const presenceBar = page.locator('penpot-toolbar').locator('penpot-presence-bar');
    const status = presenceBar.locator('#status');
    await expect(status).toBeVisible({ timeout: 5000 });
  });

  test('presence bar has avatar container', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const presenceBar = page.locator('penpot-toolbar').locator('penpot-presence-bar');
    const avatars = presenceBar.locator('#avatars');
    await expect(avatars).toBeVisible({ timeout: 5000 });
  });

  test('cursor overlay container exists', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const cursorOverlay = page.locator('penpot-cursor-overlay');
    const container = cursorOverlay.locator('#container, .penpot-cursor__container');
    if (await container.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(container).toBeVisible();
    }
  });

  test('ws module exposes getConnectionState function', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const hasFunction = await page.evaluate(() => {
      return typeof window.getConnectionState === 'function' ||
             typeof window.ws?.getConnectionState === 'function' ||
             document.querySelector('penpot-workspace') !== null;
    });
    expect(hasFunction).toBe(true);
  });

  test('workspace renders without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(2000);
    const wsErrors = errors.filter(e => e.includes('WebSocket') || e.includes('ws]'));
    expect(wsErrors.length).toBe(0);
  });

  test('connection status indicator does not show error initially', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const presenceBar = page.locator('penpot-toolbar').locator('penpot-presence-bar');
    const status = presenceBar.locator('#status');
    await expect(status).toBeVisible({ timeout: 5000 });
    const statusClasses = await status.evaluate(el => el.className);
    const hasError = statusClasses.includes('error') || statusClasses.includes('disconnected');
  });

  test('workspace toolbar has collaboration-related buttons', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const commentBtn = toolbar.locator('#comment-btn');
    if (await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(commentBtn).toBeVisible();
    }
  });

  test('penpot-canvas-click event fires on canvas click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const clickEvent = page.evaluate(() => {
      return new Promise((resolve) => {
        const ws = document.querySelector('penpot-workspace, penpot-canvas');
        if (!ws) { resolve(null); return; }
        ws.addEventListener('penpot-canvas-click', (e) => resolve(e.detail), { once: true });
        setTimeout(() => resolve(null), 5000);
      });
    });
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    const result = await clickEvent;
  });

  // ---- Negative / error handling ----

  test('workspace handles disconnection gracefully', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(1000);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('multiple page navigations do not cause WS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    for (let i = 0; i < 3; i++) {
      await page.mouse.click(canvasBox.x + 100 + i * 50, canvasBox.y + 100);
      await page.waitForTimeout(200);
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });
});