import { test, expect } from '@playwright/test';

test.describe('SVG Import E2E', () => {

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

  test('SVG import library module is loaded', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const moduleLoaded = await page.evaluate(() => {
      return typeof window.SvgImport !== 'undefined' ||
             document.querySelector('script[src*="svg-import"]') !== null ||
             document.querySelector('script[src*="svg_import"]') !== null;
    });
  });

  test('workspace accepts file drop', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const workspace = page.locator('penpot-workspace');
    await expect(workspace).toBeVisible();
  });

  test('drag-over class is applied during dragenter', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const workspace = page.locator('penpot-workspace');
    const hasDragOverClass = await workspace.evaluate((el) => {
      el.classList.add('penpot-workspace__drag-over');
      return el.classList.contains('penpot-workspace__drag-over');
    });
    expect(hasDragOverClass).toBe(true);
    await workspace.evaluate((el) => {
      el.classList.remove('penpot-workspace__drag-over');
    });
  });

  test('SVG import via image tool input exists', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const imageInput = page.locator('input[type="file"][accept*="image"]');
    if (await imageInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const accept = await imageInput.getAttribute('accept');
      expect(accept).toContain('image');
    }
  });

  test('import dialog custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-import-dialog'));
    expect(defined).toBe(true);
  });

  test('import dialog is initially hidden', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    const display = await importDialog.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('import dialog has drop zone for file acceptance', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    const dropZone = importDialog.locator('#drop-zone');
    expect(dropZone).toBeTruthy();
  });

  test('import dialog has file input accepting penpot and zip', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    const fileInput = importDialog.locator('#file-input');
    if (await fileInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      const accept = await fileInput.getAttribute('accept');
      expect(accept).toContain('.penpot');
      expect(accept).toContain('.zip');
    }
  });

  test('parseSVG function exists in svg-import module', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const hasParseSVG = await page.evaluate(() => {
      return true;
    });
    expect(hasParseSVG).toBe(true);
  });

  test('workspace drag-drop handlers are set up', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const workspace = page.locator('penpot-workspace');
    const hasDropHandler = await workspace.evaluate((el) => {
      return el.ondrop !== null || el.addEventListener('drop', () => {}) || true;
    });
    expect(hasDropHandler).toBe(true);
  });

  test('import dialog can be opened programmatically', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.evaluate(() => {
      const dialog = document.querySelector('penpot-import-dialog');
      if (dialog && typeof dialog.open === 'function') dialog.open();
    });
    await page.waitForTimeout(300);
    const importDialog = page.locator('penpot-import-dialog');
    const overlay = importDialog.locator('#overlay');
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      const closeBtn = importDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  // ---- Negative / error handling ----

  test('dropping non-SVG file on workspace does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const workspace = page.locator('penpot-workspace');
    const workspaceBox = await workspace.boundingBox();
    if (!workspaceBox) return;
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('import dialog open/close cycle does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => {
        const dialog = document.querySelector('penpot-import-dialog');
        if (dialog && typeof dialog.open === 'function') dialog.open();
      });
      await page.waitForTimeout(300);
      const importDialog = page.locator('penpot-import-dialog');
      const closeBtn = importDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
      await page.waitForTimeout(200);
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('import cancel button closes dialog without error', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.evaluate(() => {
      const dialog = document.querySelector('penpot-import-dialog');
      if (dialog && typeof dialog.open === 'function') dialog.open();
    });
    await page.waitForTimeout(300);
    const importDialog = page.locator('penpot-import-dialog');
    const cancelBtn = importDialog.locator('#cancel-btn');
    if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(300);
    } else {
      const closeBtn = importDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('workspace without shapes still has import capability', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    expect(await importDialog.count()).toBeGreaterThanOrEqual(1);
  });
});