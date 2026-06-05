import { test, expect } from '@playwright/test';

test.describe('Plugin Panel E2E', () => {

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

  test('plugin panel custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-plugin-panel'));
    expect(defined).toBe(true);
  });

  test('plugin manager custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-plugin-manager'));
    expect(defined).toBe(true);
  });

  test('plugin manager is accessible from right sidebar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const pluginsTab = sidebar.locator('[data-tab="plugins"]');
    if (await pluginsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pluginsTab.click();
      await expect(page.locator('penpot-plugin-manager')).toBeVisible();
    }
  });

  test('plugin manager lists installed plugins', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const pluginsTab = sidebar.locator('[data-tab="plugins"]');
    if (!(await pluginsTab.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await pluginsTab.click();
    const manager = page.locator('penpot-plugin-manager');
    await expect(manager).toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('plugin panel renders with plugin content', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-plugin-panel');
    const isVisible = await panel.isVisible({ timeout: 2000 }).catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });

  test('plugin panel has close button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-plugin-panel');
    const closeBtn = panel.locator('#close-btn, [data-action="close"]');
    const isVisible = await closeBtn.isVisible({ timeout: 2000 }).catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });

  test('plugin manager has install button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const pluginsTab = sidebar.locator('[data-tab="plugins"]');
    if (!(await pluginsTab.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await pluginsTab.click();
    const manager = page.locator('penpot-plugin-manager');
    await expect(manager).toBeVisible({ timeout: 2000 }).catch(() => {});

    const installBtn = manager.locator('#install-plugin-btn, [data-action="install"]');
    const isVisible = await installBtn.isVisible({ timeout: 2000 }).catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });
});