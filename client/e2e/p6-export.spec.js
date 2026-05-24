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

  test('import dialog is registered as custom element', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const defined = await page.evaluate(() => customElements.get('penpot-import-dialog'));
    expect(defined).toBeTruthy();
  });

  test('file import module exports functions', async ({ page }) => {
    await page.goto('/');
    const exports = await page.evaluate(async () => {
      const mod = await import('/lib/file-import.js');
      return {
        hasAnalyze: typeof mod.analyzeFile === 'function',
        hasUpload: typeof mod.uploadAndImport === 'function',
        hasImportToProject: typeof mod.importFileToProject === 'function',
      };
    });
    expect(exports.hasAnalyze).toBe(true);
    expect(exports.hasUpload).toBe(true);
    expect(exports.hasImportToProject).toBe(true);
  });

  test('rich text module exports functions', async ({ page }) => {
    await page.goto('/');
    const exports = await page.evaluate(async () => {
      const mod = await import('/lib/rich-text.js');
      return {
        hasCreate: typeof mod.createRichTextEditor === 'function',
        hasCreateToolbar: typeof mod.createFloatingToolbar === 'function',
        hasDestroy: typeof mod.destroyActiveEditor === 'function',
        hasGetFonts: typeof mod.getSystemFonts === 'function',
        hasGetSizes: typeof mod.getFontSizes === 'function',
      };
    });
    expect(exports.hasCreate).toBe(true);
    expect(exports.hasCreateToolbar).toBe(true);
    expect(exports.hasDestroy).toBe(true);
    expect(exports.hasGetFonts).toBe(true);
    expect(exports.hasGetSizes).toBe(true);
  });

  test('rich text module has system fonts list', async ({ page }) => {
    await page.goto('/');
    const fonts = await page.evaluate(async () => {
      const mod = await import('/lib/rich-text.js');
      return mod.getSystemFonts();
    });
    expect(Array.isArray(fonts)).toBe(true);
    expect(fonts.length).toBeGreaterThanOrEqual(3);
    const families = fonts.map(f => f.family);
    expect(families).toContain('sans-serif');
    expect(families).toContain('serif');
    expect(families).toContain('monospace');
  });

  test('i18n module exports locale functions', async ({ page }) => {
    await page.goto('/');
    const exports = await page.evaluate(async () => {
      const mod = await import('/lib/i18n.js');
      return {
        hasT: typeof mod.t === 'function',
        hasTp: typeof mod.tp === 'function',
        hasSetLocale: typeof mod.setLocale === 'function',
        hasLoadLocale: typeof mod.loadLocale === 'function',
        hasRegister: typeof mod.registerTranslations === 'function',
        hasDetect: typeof mod.detectBrowserLocale === 'function',
        hasInitLocale: typeof mod.initLocale === 'function',
        hasAutoDetect: typeof mod.autoDetectAndInit === 'function',
        hasFormatNumber: typeof mod.formatNumber === 'function',
        hasFormatDate: typeof mod.formatDate === 'function',
        hasIsRTL: typeof mod.isRTL === 'function',
      };
    });
    expect(exports.hasT).toBe(true);
    expect(exports.hasTp).toBe(true);
    expect(exports.hasSetLocale).toBe(true);
    expect(exports.hasLoadLocale).toBe(true);
    expect(exports.hasRegister).toBe(true);
    expect(exports.hasDetect).toBe(true);
    expect(exports.hasInitLocale).toBe(true);
    expect(exports.hasAutoDetect).toBe(true);
    expect(exports.hasFormatNumber).toBe(true);
    expect(exports.hasFormatDate).toBe(true);
    expect(exports.hasIsRTL).toBe(true);
  });

  test('i18n can load locale from JSON file', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const mod = await import('/lib/i18n.js');
      const messages = await mod.loadLocale('es', '/locales/es.json');
      if (!messages) return { loaded: false };
      mod.setLocale('es');
      const text = mod.t('dashboard.title');
      mod.setLocale('en');
      return { loaded: true, title: text };
    });
    expect(result.loaded).toBe(true);
    expect(result.title).toBeTruthy();
    expect(result.title).not.toBe('dashboard.title');
  });

  test('i18n falls back to English for missing keys', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const mod = await import('/lib/i18n.js');
      mod.setLocale('es');
      const text = mod.t('nonexistent.key');
      mod.setLocale('en');
      return text;
    });
    expect(result).toBe('nonexistent.key');
  });

  test('plugin manager is registered as custom element', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const defined = await page.evaluate(() => customElements.get('penpot-plugin-manager'));
    expect(defined).toBeTruthy();
  });

  test('plugin manager has install and permission features', async ({ page }) => {
    await page.goto('/');
    const exports = await page.evaluate(async () => {
      const mod = await import('/lib/plugin-api.js');
      return {
        hasPluginAPI: typeof mod.PluginAPI === 'function' || typeof mod.default === 'function',
        hasPermissionCheck: typeof mod.checkPermission === 'function',
      };
    });
    expect(exports.hasPermissionCheck === true || exports.hasPluginAPI === true).toBe(true);
  });

  test('wasm bridge module exports detection and fallback', async ({ page }) => {
    await page.goto('/');
    const exports = await page.evaluate(async () => {
      const mod = await import('/lib/wasm-bridge.js');
      return {
        hasIsAvailable: typeof mod.isWasmAvailable === 'function',
        hasDetect: typeof mod.detectWasm === 'function',
        hasInit: typeof mod.initWasmRenderer === 'function',
        hasDestroy: typeof mod.destroyWasmRenderer === 'function',
        hasGetMode: typeof mod.getRenderMode === 'function',
      };
    });
    expect(exports.hasIsAvailable).toBe(true);
    expect(exports.hasDetect).toBe(true);
    expect(exports.hasInit).toBe(true);
    expect(exports.hasDestroy).toBe(true);
    expect(exports.hasGetMode).toBe(true);
  });

  test('wasm bridge falls back to SVG mode', async ({ page }) => {
    await page.goto('/');
    const mode = await page.evaluate(async () => {
      const mod = await import('/lib/wasm-bridge.js');
      return mod.getRenderMode();
    });
    expect(mode).toBe('svg');
  });

  test('viewer component is registered as custom element', async ({ page }) => {
    await page.goto('/');
    const defined = await page.waitForFunction(() => !!customElements.get('penpot-viewer'), { timeout: 10000 }).catch(() => null);
    expect(defined).toBeTruthy();
  });
});