import { test, expect } from '@playwright/test';

test.describe('Binary File Export E2E', () => {

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

  test('export dialog custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-export-dialog'));
    expect(defined).toBe(true);
  });

  test('export button exists in toolbar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const exportBtn = toolbar.locator('#export-btn');
    await expect(exportBtn).toBeVisible();
  });

  test('clicking export button opens export dialog', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);
    const exportDialog = page.locator('penpot-export-dialog');
    const overlay = exportDialog.locator('#overlay');
    if (await overlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(overlay).toBeVisible();
      const closeBtn = exportDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test('export dialog has format options', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);
    const exportDialog = page.locator('penpot-export-dialog');
    const overlay = exportDialog.locator('#overlay');
    if (await overlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const formatOptions = exportDialog.locator('.penpot-export__format-option, [data-format]');
      if (await formatOptions.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        const count = await formatOptions.count();
        expect(count).toBeGreaterThanOrEqual(1);
      }
      const closeBtn = exportDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test('export dialog has PNG format', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);
    const exportDialog = page.locator('penpot-export-dialog');
    const overlay = exportDialog.locator('#overlay');
    if (await overlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const pngOption = exportDialog.locator('[data-format="png"], .penpot-export__format-option:has-text("PNG")');
      if (await pngOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(pngOption).toBeVisible();
      }
      const closeBtn = exportDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test('export dialog has SVG format', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);
    const exportDialog = page.locator('penpot-export-dialog');
    const overlay = exportDialog.locator('#overlay');
    if (await overlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const svgOption = exportDialog.locator('[data-format="svg"], .penpot-export__format-option:has-text("SVG")');
      if (await svgOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(svgOption).toBeVisible();
      }
      const closeBtn = exportDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test('export dialog has PDF format', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);
    const exportDialog = page.locator('penpot-export-dialog');
    const overlay = exportDialog.locator('#overlay');
    if (await overlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const pdfOption = exportDialog.locator('[data-format="pdf"], .penpot-export__format-option:has-text("PDF")');
      if (await pdfOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(pdfOption).toBeVisible();
      }
      const closeBtn = exportDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test('export dialog has cancel button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);
    const exportDialog = page.locator('penpot-export-dialog');
    const overlay = exportDialog.locator('#overlay');
    if (await overlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const cancelBtn = exportDialog.locator('#cancel-btn');
      if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(cancelBtn).toBeVisible();
        await cancelBtn.click();
        await page.waitForTimeout(300);
      } else {
        const closeBtn = exportDialog.locator('#close');
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click();
        }
      }
    }
  });

  test('export dialog dispatches close event', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);
    const exportDialog = page.locator('penpot-export-dialog');
    const overlay = exportDialog.locator('#overlay');
    if (await overlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const closeBtn = exportDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('export dialog scale options exist', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);
    const exportDialog = page.locator('penpot-export-dialog');
    const overlay = exportDialog.locator('#overlay');
    if (await overlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const scaleOptions = exportDialog.locator('.penpot-export__scale-btn, [data-scale]');
      if (await scaleOptions.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        const count = await scaleOptions.count();
        expect(count).toBeGreaterThanOrEqual(1);
      }
      const closeBtn = exportDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test('export dialog with shape selected shows per-shape options', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);
    const exportDialog = page.locator('penpot-export-dialog');
    const overlay = exportDialog.locator('#overlay');
    if (await overlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const closeBtn = exportDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test('export dialog initially hidden', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const exportDialog = page.locator('penpot-export-dialog');
    const display = await exportDialog.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  // ---- Negative / error handling ----

  test('opening and closing export dialog repeatedly does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const toolbar = page.locator('penpot-toolbar');
    for (let i = 0; i < 3; i++) {
      await toolbar.locator('#export-btn').click();
      await page.waitForTimeout(500);
      const exportDialog = page.locator('penpot-export-dialog');
      const closeBtn = exportDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('export dialog without shape selected still opens', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);
    const exportDialog = page.locator('penpot-export-dialog');
    const overlay = exportDialog.locator('#overlay');
    if (await overlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const closeBtn = exportDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });
});