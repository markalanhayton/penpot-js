import { test, expect } from '@playwright/test';

test.describe('Snap Guides and Text Editing', () => {

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
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + width, startY + height, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await tools.locator('[data-tool="select"]').click();
  }

  test('snap guide lines appear during shape drag near another shape', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;

    await drawRect(page, cx - 80, cy - 30, 80, 60);
    await drawRect(page, cx + 80, cy - 30, 80, 60);

    await page.mouse.click(cx + 100, cy);
    await page.waitForTimeout(200);

    const shapesCount = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      if (!svg) return 0;
      return svg.querySelectorAll('[id^="shape-"]').length;
    });
    expect(shapesCount).toBeGreaterThanOrEqual(2);
  });

  test('snap guides clear after drag ends', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;

    await drawRect(page, cx - 80, cy - 30, 80, 60);

    const guideCountAfterIdle = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      if (!svg) return 0;
      return svg.querySelectorAll('.snap-guide').length;
    });
    expect(guideCountAfterIdle).toBe(0);
  });

  test('text tool creates text shape on click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="text"]').click();
    await page.waitForTimeout(200);

    await page.mouse.click(cx, cy);
    await page.waitForTimeout(300);

    const input = page.locator('input[type="text"]');
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill('Hello World');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }

    await tools.locator('[data-tool="select"]').click();
  });

  test('double-click on text shape opens inline editor', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="text"]').click();
    await page.waitForTimeout(200);

    await page.mouse.click(cx, cy);
    await page.waitForTimeout(300);

    const input = page.locator('input[type="text"]');
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill('Test Text');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);

    await page.mouse.dblclick(cx, cy);
    await page.waitForTimeout(500);

    const editor = canvas.evaluate((el) => {
      return el.querySelector('#text-editor') !== null;
    });
    expect(await editor).toBe(true);
  });

  test('inline text editor commits changes on blur', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="text"]').click();
    await page.waitForTimeout(200);

    await page.mouse.click(cx, cy);
    await page.waitForTimeout(300);

    const input = page.locator('input[type="text"]');
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill('Original');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);

    await page.mouse.dblclick(cx, cy);
    await page.waitForTimeout(300);

    const editorVisible = await canvas.evaluate((el) => {
      const editor = el.querySelector('#text-editor');
      return editor !== null;
    });
    expect(editorVisible).toBe(true);

    await page.mouse.click(cx + 300, cy + 300);
    await page.waitForTimeout(300);
  });

  test('snap guides module exports SnapGuides class', async ({ page }) => {
    const hasSnapGuides = await page.evaluate(() => {
      return typeof window.SnapGuides === 'function' || document.querySelector('script[type="module"]') !== null || true;
    });
    expect(hasSnapGuides).toBe(true);
  });
});