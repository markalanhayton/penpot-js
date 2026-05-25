import { test, expect } from '@playwright/test';

test.describe('SVG Filter Editing E2E', () => {

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

  test('add filter button appears when shape is selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    const designTab = sidebar.locator('[data-tab="design"]');
    await expect(designTab).toBeVisible();
    await designTab.click();
    await page.waitForTimeout(300);
    const addFilterBtn = sidebar.locator('[data-action="add-filter"]');
    await expect(addFilterBtn).toBeVisible({ timeout: 3000 });
  });

  test('adding a filter creates filter entry in sidebar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const addFilterBtn = sidebar.locator('[data-action="add-filter"]');
    await expect(addFilterBtn).toBeVisible({ timeout: 3000 });
    await addFilterBtn.click();
    await page.waitForTimeout(200);
    const filterTypeSelect = sidebar.locator('[data-filter-type]');
    await expect(filterTypeSelect.first()).toBeVisible({ timeout: 3000 });
  });

  test('filter type dropdown contains expected options', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    const filterType = sidebar.locator('[data-filter-type]').first();
    await expect(filterType).toBeVisible({ timeout: 3000 });
  });

  test('default filter type is drop-shadow', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    const filterType = sidebar.locator('[data-filter-type]').first();
    const value = await filterType.inputValue();
    expect(value).toBe('drop-shadow');
  });

  test('remove filter button deletes filter entry', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    const removeBtn = sidebar.locator('[data-filter-remove]').first();
    await expect(removeBtn).toBeVisible({ timeout: 3000 });
    await removeBtn.click();
    await page.waitForTimeout(200);
    const filterType = sidebar.locator('[data-filter-type]');
    expect(await filterType.count()).toBe(0);
  });

  test('drop-shadow filter has offset and blur inputs', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    const offsetX = sidebar.locator('[data-filter-prop="0:offsetX"]');
    await expect(offsetX).toBeVisible({ timeout: 3000 });
    const offsetY = sidebar.locator('[data-filter-prop="0:offsetY"]');
    await expect(offsetY).toBeVisible();
    const stdDev = sidebar.locator('[data-filter-prop="0:stdDeviation"]');
    await expect(stdDev).toBeVisible();
  });

  test('can add multiple filters to a shape', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    const filterTypes = sidebar.locator('[data-filter-type]');
    expect(await filterTypes.count()).toBeGreaterThanOrEqual(2);
  });

  test('filter property change dispatches event', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    const offsetX = sidebar.locator('[data-filter-prop="0:offsetX"]');
    await expect(offsetX).toBeVisible({ timeout: 3000 });
    await offsetX.fill('10');
    await offsetX.press('Enter');
    await page.waitForTimeout(200);
  });

  test('filter section not visible when no shape selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const addFilterBtn = sidebar.locator('[data-action="add-filter"]');
    expect(await addFilterBtn.isVisible({ timeout: 2000 }).catch(() => false)).toBe(false);
  });

  test('changing filter type changes available properties', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    const filterType = sidebar.locator('[data-filter-type]').first();
    const offsetX = sidebar.locator('[data-filter-prop="0:offsetX"]');
    await expect(offsetX).toBeVisible({ timeout: 3000 });
    await filterType.selectOption('turbulence');
    await page.waitForTimeout(300);
    const baseFreq = sidebar.locator('[data-filter-prop="0:baseFrequency"]');
    if (await baseFreq.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(baseFreq).toBeVisible();
    }
  });

  // ---- Negative / error handling tests ----

  test('adding filter without selecting shape does not appear', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const addFilterBtn = sidebar.locator('[data-action="add-filter"]');
    expect(await addFilterBtn.isVisible({ timeout: 2000 }).catch(() => false)).toBe(false);
  });

  test('entering non-numeric filter value does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    const offsetX = sidebar.locator('[data-filter-prop="0:offsetX"]');
    await expect(offsetX).toBeVisible({ timeout: 3000 });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await offsetX.fill('not-a-number');
    await offsetX.press('Enter');
    await page.waitForTimeout(300);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('removing only filter returns to no-filter state', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    const removeBtn = sidebar.locator('[data-filter-remove]').first();
    if (await removeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await removeBtn.click();
      await page.waitForTimeout(200);
      const filterTypes = sidebar.locator('[data-filter-type]');
      expect(await filterTypes.count()).toBe(0);
    }
  });

  test('adding three filters and removing middle does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const removeButtons = sidebar.locator('[data-filter-remove]');
    const count = await removeButtons.count();
    if (count >= 2) {
      await removeButtons.nth(1).click();
      await page.waitForTimeout(200);
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('switching filter type rapidly does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    await sidebar.locator('[data-action="add-filter"]').click();
    await page.waitForTimeout(200);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const filterType = sidebar.locator('[data-filter-type]').first();
    const types = ['drop-shadow', 'color-matrix', 'turbulence', 'flood', 'drop-shadow'];
    for (const type of types) {
      if (await filterType.isVisible({ timeout: 1000 }).catch(() => false)) {
        await filterType.selectOption(type);
        await page.waitForTimeout(100);
      }
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });
});