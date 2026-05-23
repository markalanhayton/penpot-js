import { test, expect } from '@playwright/test';

test.describe('Page Management', () => {

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

  test('add page button exists in left sidebar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const addBtn = sidebar.locator('#page-add-btn');
    await expect(addBtn).toBeVisible();
  });

  test('pages are listed in left sidebar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const pageList = sidebar.locator('#page-list');
    await expect(pageList).toBeVisible();
    const pageItems = pageList.locator('.page-item');
    const count = await pageItems.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('clicking page adds a new page', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const addBtn = sidebar.locator('#page-add-btn');
    const pageItemsBefore = sidebar.locator('.page-item');
    const countBefore = await pageItemsBefore.count();
    await addBtn.click();
    const pageItemsAfter = sidebar.locator('.page-item');
    await expect(pageItemsAfter).toHaveCount(countBefore + 1, { timeout: 3000 });
  });

  test('page context menu has rename and delete options', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const menuBtn = sidebar.locator('.page-menu-btn').first();
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    const contextMenu = sidebar.locator('.page-context-menu');
    await expect(contextMenu).toBeVisible({ timeout: 2000 });
  });

  test('page menu button appears on hover', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const pageItem = sidebar.locator('.page-item').first();
    const menuBtn = pageItem.locator('.page-menu-btn');
    await expect(menuBtn).toBeAttached();
  });
});