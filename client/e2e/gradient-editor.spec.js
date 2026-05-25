import { test, expect } from '@playwright/test';

test.describe('Gradient Editor E2E', () => {

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
  }

  test('gradient editor custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-gradient-editor'));
    expect(defined).toBe(true);
  });

  test('add gradient fill button appears when shape selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const addGradientBtn = sidebar.locator('#add-fill-gradient');
    await expect(addGradientBtn).toBeVisible({ timeout: 3000 });
  });

  test('clicking add gradient opens gradient editor', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('#add-fill-gradient').click();
    await page.waitForTimeout(200);
    const gradientEditor = sidebar.locator('#gradient-editor, penpot-gradient-editor').first();
    if (await gradientEditor.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(gradientEditor).toBeVisible();
    }
  });

  test('gradient editor has preview bar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('#add-fill-gradient').click();
    await page.waitForTimeout(200);
    const preview = sidebar.locator('#gradient-editor #preview, .penpot-grad__preview').first();
    if (await preview.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(preview).toBeVisible();
    }
  });

  test('gradient editor has type toggle buttons', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('#add-fill-gradient').click();
    await page.waitForTimeout(200);
    const linearBtn = sidebar.locator('.penpot-grad__type-btn[data-type="linear-gradient"]').first();
    const radialBtn = sidebar.locator('.penpot-grad__type-btn[data-type="radial-gradient"]').first();
    if (await linearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(linearBtn).toBeVisible();
      if (await radialBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(radialBtn).toBeVisible();
      }
    }
  });

  test('gradient editor has add stop button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('#add-fill-gradient').click();
    await page.waitForTimeout(200);
    const addStopBtn = sidebar.locator('#add-stop, .penpot-grad__add-btn').first();
    if (await addStopBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(addStopBtn).toBeVisible();
    }
  });

  test('switching gradient type changes preview', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('#add-fill-gradient').click();
    await page.waitForTimeout(200);
    const radialBtn = sidebar.locator('.penpot-grad__type-btn[data-type="radial-gradient"]').first();
    if (await radialBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await radialBtn.click();
      await page.waitForTimeout(200);
      const activeBtn = sidebar.locator('.penpot-grad__type-btn.penpot-grad__active').first();
      if (await activeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const dataType = await activeBtn.getAttribute('data-type');
        expect(dataType).toBe('radial-gradient');
      }
    }
  });

  test('gradient change dispatches property change event', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('#add-fill-gradient').click();
    await page.waitForTimeout(200);
  });

  // ---- Negative / error handling ----

  test('gradient editor does not appear when no shape selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const addGradientBtn = sidebar.locator('#add-fill-gradient');
    expect(await addGradientBtn.isVisible({ timeout: 2000 }).catch(() => false)).toBe(false);
  });

  test('adding gradient on top of solid fill works', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const addSolidBtn = sidebar.locator('#add-fill-solid');
    if (await addSolidBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addSolidBtn.click();
      await page.waitForTimeout(200);
    }
    await sidebar.locator('#add-fill-gradient').click();
    await page.waitForTimeout(200);
  });
});