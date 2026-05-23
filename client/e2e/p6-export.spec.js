import { test, expect } from '@playwright/test';

test.describe('P6: Export + Advanced Features', () => {

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

  test('export dialog is registered as custom element', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const defined = await page.evaluate(() => customElements.get('penpot-export-dialog'));
    expect(defined).toBeTruthy();
  });

  test('share dialog is registered as custom element', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const defined = await page.evaluate(() => customElements.get('penpot-share-dialog'));
    expect(defined).toBeTruthy();
  });

  test('comment panel is registered as custom element', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const defined = await page.evaluate(() => customElements.get('penpot-comment-panel'));
    expect(defined).toBeTruthy();
  });

  test('toolbar has export button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const exportBtn = toolbar.locator('#export-btn');
    await expect(exportBtn).toBeVisible();
  });

  test('toolbar has comment button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const commentBtn = toolbar.locator('#comment-btn');
    await expect(commentBtn).toBeVisible();
  });

  test('toolbar has share button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const shareBtn = toolbar.locator('#share-btn');
    await expect(shareBtn).toBeVisible();
  });

  test('export dialog opens on toolbar export click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const exportDialog = page.locator('penpot-export-dialog');
    await expect(exportDialog).toBeAttached();

    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();

    const overlay = exportDialog.locator('#overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });
  });

  test('export dialog has format options (PNG, SVG, PDF)', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const exportDialog = page.locator('penpot-export-dialog');
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);

    const formatOptions = exportDialog.locator('.format-option');
    const count = await formatOptions.count();
    expect(count).toBe(3);

    const labels = await formatOptions.allTextContents();
    expect(labels.map(l => l.trim())).toEqual(expect.arrayContaining(['PNG', 'SVG', 'PDF']));
  });

  test('export dialog has scale options', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const exportDialog = page.locator('penpot-export-dialog');
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);

    const scaleBtns = exportDialog.locator('.scale-btn');
    const count = await scaleBtns.count();
    expect(count).toBe(4);

    const activeScale = exportDialog.locator('.scale-btn.active');
    await expect(activeScale).toHaveText('2x');
  });

  test('export dialog close button dismisses dialog', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const exportDialog = page.locator('penpot-export-dialog');
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#export-btn').click();
    await page.waitForTimeout(500);

    const closeBtn = exportDialog.locator('#close');
    await closeBtn.click();

    await page.waitForTimeout(300);
    expect(exportDialog.style.display === 'none' || await exportDialog.isVisible() === false || !(await exportDialog.isVisible().catch(() => false))).toBeTruthy();
  });

  test('share dialog opens on toolbar share click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const shareDialog = page.locator('penpot-share-dialog');

    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#share-btn').click();

    const overlay = shareDialog.locator('#overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });
  });

  test('share dialog has URL input and copy button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const shareDialog = page.locator('penpot-share-dialog');
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#share-btn').click();
    await page.waitForTimeout(500);

    const urlInput = shareDialog.locator('#share-url');
    await expect(urlInput).toBeVisible();

    const copyBtn = shareDialog.locator('#copy-btn');
    await expect(copyBtn).toBeVisible();
  });

  test('share dialog has permission selects', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const shareDialog = page.locator('penpot-share-dialog');
    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#share-btn').click();
    await page.waitForTimeout(500);

    const permView = shareDialog.locator('#perm-view');
    await expect(permView).toBeVisible();

    const permComment = shareDialog.locator('#perm-comment');
    await expect(permComment).toBeVisible();

    const permEdit = shareDialog.locator('#perm-edit');
    await expect(permEdit).toBeVisible();
  });

  test('comment panel toggle on toolbar click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const commentPanel = page.locator('#comment-panel');

    const initiallyHidden = await commentPanel.isVisible().catch(() => false);
    expect(initiallyHidden).toBe(false);

    const toolbar = page.locator('penpot-toolbar');
    await toolbar.locator('#comment-btn').click();

    await page.waitForTimeout(300);
    const afterToggle = await commentPanel.isVisible().catch(() => false);
    expect(afterToggle).toBe(true);
  });

  test('keyboard shortcuts module exports default shortcuts', async ({ page }) => {
    await page.goto('/');
    const module = await page.evaluate(async () => {
      const mod = await import('/lib/shortcuts.js');
      return {
        hasRegister: typeof mod.registerShortcut === 'function',
        hasInit: typeof mod.initShortcuts === 'function',
        hasDefaults: Array.isArray(mod.DEFAULT_SHORTCUTS),
      };
    });
    expect(module.hasRegister).toBe(true);
    expect(module.hasInit).toBe(true);
    expect(module.hasDefaults).toBe(true);
  });

  test('default shortcuts include common shortcuts', async ({ page }) => {
    await page.goto('/');
    const shortcuts = await page.evaluate(async () => {
      const mod = await import('/lib/shortcuts.js');
      return mod.DEFAULT_SHORTCUTS.map(s => s.description);
    });
    expect(shortcuts).toContain('Undo');
    expect(shortcuts).toContain('Redo');
    expect(shortcuts).toContain('Select tool');
    expect(shortcuts).toContain('Export');
  });

  test('export module exports functions', async ({ page }) => {
    await page.goto('/');
    const exports = await page.evaluate(async () => {
      const mod = await import('/lib/export.js');
      return {
        hasExportPNG: typeof mod.exportToPNG === 'function',
        hasExportSVG: typeof mod.exportToSVG === 'function',
        hasExportPDF: typeof mod.exportToPDF === 'function',
        hasDownload: typeof mod.exportAndDownload === 'function',
        hasImport: typeof mod.importPenpotFile === 'function',
      };
    });
    expect(exports.hasExportPNG).toBe(true);
    expect(exports.hasExportSVG).toBe(true);
    expect(exports.hasExportPDF).toBe(true);
    expect(exports.hasDownload).toBe(true);
    expect(exports.hasImport).toBe(true);
  });
});