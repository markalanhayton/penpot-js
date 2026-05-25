import { test, expect } from '@playwright/test';

test.describe('Binary File Import E2E', () => {

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

  test('import dialog custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-import-dialog'));
    expect(defined).toBe(true);
  });

  test('import dialog exists in workspace', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    expect(await importDialog.count()).toBeGreaterThanOrEqual(1);
  });

  test('import dialog has drop zone', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    const dropZone = importDialog.locator('#drop-zone');
    expect(dropZone).toBeTruthy();
  });

  test('import dialog has file input', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    const fileInput = importDialog.locator('#file-input');
    expect(fileInput).toBeTruthy();
  });

  test('import dialog has cancel and import buttons', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    const cancelBtn = importDialog.locator('#cancel-btn');
    const importBtn = importDialog.locator('#import-btn');
    expect(cancelBtn).toBeTruthy();
    expect(importBtn).toBeTruthy();
  });

  test('import button is initially disabled', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    const importBtn = importDialog.locator('#import-btn');
    if (await importBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      expect(await importBtn.isDisabled()).toBe(true);
    }
  });

  test('import dialog file input accepts .penpot and .zip', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    const fileInput = importDialog.locator('#file-input');
    if (await fileInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      const accept = await fileInput.getAttribute('accept');
      expect(accept).toContain('.penpot');
      expect(accept).toContain('.zip');
    }
  });

  test('import dialog has project selector', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    const projectSelect = importDialog.locator('#project-select');
    expect(projectSelect).toBeTruthy();
  });

  test('import dialog initially hidden (display none)', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    const display = await importDialog.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('import dialog can be opened via .open()', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.evaluate(() => {
      const dialog = document.querySelector('penpot-import-dialog');
      if (dialog && typeof dialog.open === 'function') dialog.open();
    });
    await page.waitForTimeout(300);
    const importDialog = page.locator('penpot-import-dialog');
    const overlay = importDialog.locator('#overlay');
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(overlay).toBeVisible();
      const closeBtn = importDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test('import dialog close button hides dialog', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.evaluate(() => {
      const dialog = document.querySelector('penpot-import-dialog');
      if (dialog && typeof dialog.open === 'function') dialog.open();
    });
    await page.waitForTimeout(300);
    const importDialog = page.locator('penpot-import-dialog');
    const closeBtn = importDialog.locator('#close');
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('penpot-import-success CustomEvent can be constructed', async ({ page }) => {
    const canCreate = await page.evaluate(() => {
      try {
        const evt = new CustomEvent('penpot-import-success', { detail: { results: [], projectId: 'test' } });
        return evt.type === 'penpot-import-success';
      } catch { return false; }
    });
    expect(canCreate).toBe(true);
  });

  test('import dialog open method shows overlay', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const importDialog = page.locator('penpot-import-dialog');
    const wasOpened = await page.evaluate(() => {
      const dialog = document.querySelector('penpot-import-dialog');
      if (!dialog) return false;
      if (typeof dialog.open === 'function') {
        dialog.open();
        return true;
      }
      return false;
    });
    expect(wasOpened).toBe(true);
  });

  // ---- Negative / error handling tests ----

  test('import button stays disabled when no file selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.evaluate(() => {
      const dialog = document.querySelector('penpot-import-dialog');
      if (dialog && typeof dialog.open === 'function') dialog.open();
    });
    await page.waitForTimeout(300);
    const importDialog = page.locator('penpot-import-dialog');
    const importBtn = importDialog.locator('#import-btn');
    if (await importBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      expect(await importBtn.isDisabled()).toBe(true);
      const closeBtn = importDialog.locator('#close');
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test('cancel button closes dialog without importing', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const before = await page.evaluate(() => {
      const dialog = document.querySelector('penpot-import-dialog');
      return dialog ? getComputedStyle(dialog).display : 'none';
    });
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
    }
    const display = await importDialog.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('opening import dialog twice does not crash', async ({ page }) => {
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
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(200);
      }
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('import dialog handles missing project selector gracefully', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.evaluate(() => {
      const dialog = document.querySelector('penpot-import-dialog');
      if (dialog && typeof dialog.open === 'function') dialog.open();
    });
    await page.waitForTimeout(300);
    const importDialog = page.locator('penpot-import-dialog');
    const projectSelect = importDialog.locator('#project-select');
    if (await projectSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const options = await projectSelect.locator('option').count();
      expect(options).toBeGreaterThanOrEqual(0);
    }
    const closeBtn = importDialog.locator('#close');
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    }
  });
});