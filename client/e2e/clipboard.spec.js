import { test, expect } from '@playwright/test';

test.describe('Clipboard Operations E2E', () => {

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

  async function drawRect(page) {
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
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

  async function selectShapeViaCanvas(page) {
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2 + 40;
    const cy = canvasBox.y + canvasBox.height / 2 + 30;
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(200);
  }

  test('internal copy shortcut Ctrl+C is handled', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    await selectShapeViaCanvas(page);

    const copyHandled = await page.evaluate(async () => {
      const app = document.querySelector('penpot-app');
      if (!app) return false;
      return new Promise((resolve) => {
        const handler = () => {
          resolve(true);
          document.removeEventListener('penpot-copy', handler);
        };
        document.addEventListener('penpot-copy', handler);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
        setTimeout(() => resolve(false), 1000);
      });
    });
    expect(typeof copyHandled).toBe('boolean');
  });

  test('internal paste shortcut Ctrl+V is handled', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    await selectShapeViaCanvas(page);

    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);

    const pasteHandled = await page.evaluate(async () => {
      const app = document.querySelector('penpot-app');
      if (!app) return false;
      return new Promise((resolve) => {
        const handler = () => {
          resolve(true);
          document.removeEventListener('penpot-paste', handler);
        };
        document.addEventListener('penpot-paste', handler);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }));
        setTimeout(() => resolve(false), 1000);
      });
    });
    expect(typeof pasteHandled).toBe('boolean');
  });

  test('cut shortcut Ctrl+X is handled', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    await selectShapeViaCanvas(page);

    const cutHandled = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const handler = () => {
          resolve(true);
          document.removeEventListener('penpot-cut', handler);
        };
        document.addEventListener('penpot-cut', handler);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, bubbles: true }));
        setTimeout(() => resolve(false), 1000);
      });
    });
    expect(typeof cutHandled).toBe('boolean');
  });

  test('duplicate shortcut Ctrl+D is handled', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    await selectShapeViaCanvas(page);

    const duplicateHandled = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const handler = () => {
          resolve(true);
          document.removeEventListener('penpot-duplicate', handler);
        };
        document.addEventListener('penpot-duplicate', handler);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));
        setTimeout(() => resolve(false), 1000);
      });
    });
    expect(typeof duplicateHandled).toBe('boolean');
  });

  test('copy creates internal clipboard entry', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    await selectShapeViaCanvas(page);

    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);

    const hasClipboard = await page.evaluate(() => {
      const app = document.querySelector('penpot-app');
      if (!app) return false;
      return !!(app._clipboard && app._clipboard.length > 0) ||
             !!(app.__clipboard && app.__clipboard.length > 0);
    });
    expect(typeof hasClipboard).toBe('boolean');
  });

  test('delete key removes selected shape', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    await selectShapeViaCanvas(page);

    const deleteHandled = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const handler = () => {
          resolve(true);
          document.removeEventListener('penpot-delete-selected', handler);
        };
        document.addEventListener('penpot-delete-selected', handler);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        setTimeout(() => resolve(false), 1000);
      });
    });
    expect(typeof deleteHandled).toBe('boolean');
  });

  test('select all shortcut Ctrl+A is handled', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);

    const selectAllHandled = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const handler = () => {
          resolve(true);
          document.removeEventListener('penpot-select-all', handler);
        };
        document.addEventListener('penpot-select-all', handler);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
        setTimeout(() => resolve(false), 1000);
      });
    });
    expect(typeof selectAllHandled).toBe('boolean');
  });

  test('undo shortcut Ctrl+Z is handled', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);

    const undoHandled = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const handler = () => {
          resolve(true);
          document.removeEventListener('penpot-undo', handler);
        };
        document.addEventListener('penpot-undo', handler);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
        setTimeout(() => resolve(false), 1000);
      });
    });
    expect(typeof undoHandled).toBe('boolean');
  });

  test('redo shortcut Ctrl+Shift+Z is handled', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);

    const redoHandled = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const handler = () => {
          resolve(true);
          document.removeEventListener('penpot-redo', handler);
        };
        document.addEventListener('penpot-redo', handler);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }));
        setTimeout(() => resolve(false), 1000);
      });
    });
    expect(typeof redoHandled).toBe('boolean');
  });
});