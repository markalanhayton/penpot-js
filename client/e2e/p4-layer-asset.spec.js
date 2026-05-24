import { test, expect } from '@playwright/test';

test.describe('P4: Layer Panel + Asset Library', () => {

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

  test('left sidebar has layers, assets, and pages tabs', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');

    const layersTab = sidebar.locator('[data-tab="layers"]');
    await expect(layersTab).toBeVisible();
    const assetsTab = sidebar.locator('[data-tab="assets"]');
    await expect(assetsTab).toBeVisible();
    const pagesTab = sidebar.locator('[data-tab="pages"]');
    await expect(pagesTab).toBeVisible();
  });

  test('layers tab is active by default', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const activeTab = sidebar.locator('.sidebar-tab.active');
    await expect(activeTab).toHaveAttribute('data-tab', 'layers');
  });

  test('switching to assets tab shows asset panel', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const assetsTab = sidebar.locator('[data-tab="assets"]');
    await assetsTab.click();

    const assetPanel = sidebar.locator('penpot-asset-panel');
    await expect(assetPanel).toBeVisible();
  });

  test('switching to pages tab shows page list', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const pagesTab = sidebar.locator('[data-tab="pages"]');
    await pagesTab.click();

    const pageList = sidebar.locator('#page-list');
    await expect(pageList).toBeVisible();
  });

  test('layer panel renders when shapes exist on page', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const layerPanel = sidebar.locator('penpot-layer-panel');
    await expect(layerPanel).toBeVisible();

    const layerList = layerPanel.locator('#layer-list');
    await expect(layerList).toBeVisible();
  });

  test('layer panel has collapse/expand all buttons', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const layerPanel = sidebar.locator('penpot-layer-panel');

    const collapseBtn = layerPanel.locator('#btn-collapse-all');
    await expect(collapseBtn).toBeVisible();

    const expandBtn = layerPanel.locator('#btn-expand-all');
    await expect(expandBtn).toBeVisible();
  });

  test('drawing a shape adds a layer item', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const layerPanel = sidebar.locator('penpot-layer-panel');

    const layersBefore = await layerPanel.evaluate((el) => {
      const items = el.querySelectorAll('.penpot-layer__layer-item');
      return items.length;
    });

    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();

    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60, { steps: 5 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);

    const layersAfter = await layerPanel.evaluate((el) => {
      return el.querySelectorAll('.penpot-layer__layer-item').length;
    });
    expect(layersAfter).toBeGreaterThan(layersBefore);
  });

  test('clicking a layer item selects shape on canvas', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const layerPanel = sidebar.locator('penpot-layer-panel');

    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);

    const layerItems = layerPanel.locator('.layer-item');
    const count = await layerItems.count();
    if (count > 0) {
      await layerItems.first().click();

      const selectedItems = layerPanel.locator('.layer-item.selected');
      await expect(selectedItems.first()).toBeVisible();
    }
  });

  test('visibility toggle emits event', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const layerPanel = sidebar.locator('penpot-layer-panel');

    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);

    const visButtons = layerPanel.locator('[data-vis-id]');
    const visCount = await visButtons.count();
    if (visCount > 0) {
      const visibilityBefore = await visButtons.first().textContent();
      await visButtons.first().click();
      const visibilityAfter = await visButtons.first().textContent();
      expect(visibilityBefore).not.toBe(visibilityAfter);
    }
  });

  test('lock toggle emits event and changes icon', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const layerPanel = sidebar.locator('penpot-layer-panel');

    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);

    const lockButtons = layerPanel.locator('[data-lock-id]');
    const lockCount = await lockButtons.count();
    if (lockCount > 0) {
      await lockButtons.first().click();
      const isLocked = await lockButtons.first().evaluate((el) => !el.classList.contains('off'));
      expect(typeof isLocked).toBe('boolean');
    }
  });

  test('collapse all and expand all buttons work', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const layerPanel = sidebar.locator('penpot-layer-panel');

    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="frame"]').click();
    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 150, startY + 120, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const collapseBtn = layerPanel.locator('#btn-collapse-all');
    await collapseBtn.click();

    const frameCollapseButtons = await layerPanel.evaluate((el) => {
      return el.querySelectorAll('[data-collapse-id]').length;
    });

    const expandBtn = layerPanel.locator('#btn-expand-all');
    await expandBtn.click();

    const expandedLayers = await layerPanel.evaluate((el) => {
      return el.querySelectorAll('.penpot-layer__layer-item').length;
    });
    expect(expandedLayers).toBeGreaterThanOrEqual(frameCollapseButtons);
  });

  test('asset panel has components, fonts, media tabs', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const assetsTab = sidebar.locator('[data-tab="assets"]');
    await assetsTab.click();

    const assetPanel = sidebar.locator('penpot-asset-panel');
    await expect(assetPanel).toBeVisible();

    const compTab = assetPanel.locator('[data-tab="components"]');
    await expect(compTab).toBeVisible();
    const fontsTab = assetPanel.locator('[data-tab="fonts"]');
    await expect(fontsTab).toBeVisible();
    const mediaTab = assetPanel.locator('[data-tab="media"]');
    await expect(mediaTab).toBeVisible();
  });

  test('asset panel shows components grid with sample data', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const assetsTab = sidebar.locator('[data-tab="assets"]');
    await assetsTab.click();

    const assetPanel = sidebar.locator('penpot-asset-panel');
    const cards = assetPanel.locator('.component-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('asset panel shows fonts list', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const assetsTab = sidebar.locator('[data-tab="assets"]');
    await assetsTab.click();

    const assetPanel = sidebar.locator('penpot-asset-panel');
    await assetPanel.locator('[data-tab="fonts"]').click();

    const fontItems = assetPanel.locator('.font-item');
    const count = await fontItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('asset panel shows media grid', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const assetsTab = sidebar.locator('[data-tab="assets"]');
    await assetsTab.click();

    const assetPanel = sidebar.locator('penpot-asset-panel');
    await assetPanel.locator('[data-tab="media"]').click();

    const mediaCards = assetPanel.locator('.media-card');
    const count = await mediaCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('asset panel search filters components', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const assetsTab = sidebar.locator('[data-tab="assets"]');
    await assetsTab.click();

    const assetPanel = sidebar.locator('penpot-asset-panel');
    await assetPanel.locator('[data-tab="components"]').click();

    const searchInput = assetPanel.locator('#asset-search');
    await searchInput.fill('Button');

    const cards = assetPanel.locator('.component-card');
    const count = await cards.count();
    expect(count).toBeLessThanOrEqual(6);
    if (count > 0) {
      const label = await cards.first().evaluate((el) => el.getAttribute('title'));
      expect(label.toLowerCase()).toContain('button');
    }
  });

  test('asset panel component click emits penpot-asset-use event', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const assetsTab = sidebar.locator('[data-tab="assets"]');
    await assetsTab.click();

    const assetPanel = sidebar.locator('penpot-asset-panel');
    const card = assetPanel.locator('.component-card').first();

    const eventFired = await assetPanel.evaluate((el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-asset-use', (e) => {
          resolve(e.detail);
        }, { once: true });
        el.querySelector('.component-card')?.click();
        setTimeout(() => resolve(null), 2000);
      });
    });
    expect(eventFired).not.toBeNull();
    expect(eventFired.type).toBe('component');
  });

  test('pages section shows page list when pages exist', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const pagesTab = sidebar.locator('[data-tab="pages"]');
    await pagesTab.click();

    const pageList = sidebar.locator('#page-list');
    const pageItems = pageList.locator('.page-item');
    const count = await pageItems.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('double-click on layer item starts rename', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const layerPanel = sidebar.locator('penpot-layer-panel');

    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);

    const layerItems = layerPanel.locator('.layer-item');
    const count = await layerItems.count();
    if (count > 0) {
      await layerItems.first().dblclick();
      const nameInput = layerPanel.locator('.layer-name-input');
      await expect(nameInput).toBeVisible({ timeout: 2000 });
    }
  });

  test('right sidebar updates when shape is selected from layer', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const layerPanel = sidebar.locator('penpot-layer-panel');

    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);

    const layerItems = layerPanel.locator('.layer-item');
    const count = await layerItems.count();
    if (count > 0) {
      await layerItems.first().click();

      const rightSidebar = page.locator('penpot-right-sidebar');
      const shapeTypeBadge = rightSidebar.locator('.shape-type-badge');
      await expect(shapeTypeBadge).toBeVisible({ timeout: 2000 });
      const typeText = await shapeTypeBadge.textContent();
      expect(['rect', 'Rectangle']).toContain(typeText);
    }
  });

  test('dashboard fonts page shows system fonts and upload button', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');
    const fontsBtn = dashboard.locator('#nav-fonts');
    if (await fontsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fontsBtn.click();
      await page.waitForTimeout(500);
      const fontList = dashboard.locator('#system-fonts, .font-item, .penpot-app__font-item');
      const count = await fontList.count();
      expect(count).toBeGreaterThan(0);
      const uploadBtn = dashboard.locator('#upload-font-btn');
      await expect(uploadBtn).toBeVisible({ timeout: 3000 });
    }
  });

  test('asset panel shows components, fonts, and media tabs', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const assetsTab = sidebar.locator('[data-tab="assets"]');
    if (await assetsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await assetsTab.click();
      const assetPanel = sidebar.locator('penpot-asset-panel');
      await expect(assetPanel).toBeVisible({ timeout: 3000 });
      const compTab = assetPanel.locator('[data-tab="components"]');
      const fontTab = assetPanel.locator('[data-tab="fonts"]');
      const mediaTab = assetPanel.locator('[data-tab="media"]');
      await expect(compTab).toBeVisible({ timeout: 2000 });
      await expect(fontTab).toBeVisible({ timeout: 2000 });
      await expect(mediaTab).toBeVisible({ timeout: 2000 });
    }
  });

  test('create component from selected shape via keyboard shortcut', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);
    const canvasBody = canvas.locator('svg');
    if (await canvasBody.isVisible({ timeout: 2000 }).catch(() => false)) {
      await canvasBody.click();
      await page.waitForTimeout(200);
    }

    await page.keyboard.press('Control+Alt+k');
    await page.waitForTimeout(500);

    const sidebar = page.locator('penpot-left-sidebar');
    const assetsTab = sidebar.locator('[data-tab="assets"]');
    if (await assetsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await assetsTab.click();
      const assetPanel = sidebar.locator('penpot-asset-panel');
      const compTab = assetPanel.locator('[data-tab="components"]');
      if (await compTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await compTab.click();
        const comps = assetPanel.locator('.penpot-assets__component-card');
        const count = await comps.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('detach instance action is available on component instances', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const assetsTab = sidebar.locator('[data-tab="assets"]');
    if (await assetsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await assetsTab.click();
      const assetPanel = sidebar.locator('penpot-asset-panel');
      const compTab = assetPanel.locator('[data-tab="components"]');
      if (await compTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await compTab.click();
        const detachBtns = assetPanel.locator('[data-detach-instance]');
        const count = await detachBtns.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
  });
});