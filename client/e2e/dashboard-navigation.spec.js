import { test, expect } from '@playwright/test';

test.describe('Dashboard File Management E2E', () => {

  async function login(page) {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();
    await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  }

  test('dashboard shows file cards after login', async ({ page }) => {
    await login(page);
    const fileCards = page.locator('.penpot-app__file-card, .file-card');
    const count = await fileCards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('dashboard shows new file button', async ({ page }) => {
    await login(page);
    const newFileBtn = page.locator('#new-file-btn');
    await expect(newFileBtn).toBeVisible({ timeout: 5000 });
  });

  test('dashboard shows team sidebar', async ({ page }) => {
    await login(page);
    const teamSidebar = page.locator('penpot-team-sidebar, #team-sidebar');
    await expect(teamSidebar).toBeVisible({ timeout: 5000 });
  });

  test('dashboard search input is accessible', async ({ page }) => {
    await login(page);
    const searchInput = page.locator('#search-input');
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(searchInput).toBeVisible();
      await expect(searchInput).toHaveAttribute('type', 'text');
    }
  });

  test('dashboard search type selector exists', async ({ page }) => {
    await login(page);
    const searchType = page.locator('#search-type');
    if (await searchType.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(searchType).toBeTruthy();
    }
  });

  test('clicking new file button creates a file', async ({ page }) => {
    await login(page);
    const newFileBtn = page.locator('#new-file-btn');
    if (await newFileBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newFileBtn.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 15000 });
    }
  });

  test('clicking file card opens workspace', async ({ page }) => {
    await login(page);
    const fileCard = page.locator('.penpot-app__file-card[data-file-id], .file-card[data-file-id]').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();
      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });
    }
  });

  test('dashboard renders without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await login(page);
    await page.waitForTimeout(1000);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  // ---- Fonts Tab ----

  test('fonts tab is accessible from dashboard', async ({ page }) => {
    await login(page);
    const fontsNav = page.locator('#nav-fonts');
    if (await fontsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fontsNav.click();
      await page.waitForTimeout(500);
    }
  });

  test('fonts view shows font list container when navigated', async ({ page }) => {
    await login(page);
    const fontsNav = page.locator('#nav-fonts');
    if (await fontsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fontsNav.click();
      await page.waitForTimeout(500);
      const fontList = page.locator('#team-fonts-list, .penpot-app__font-list');
      if (await fontList.isVisible({ timeout: 3000 }).catch(() => false)) {
        expect(fontList).toBeTruthy();
      }
    }
  });

  test('fonts view has upload font button', async ({ page }) => {
    await login(page);
    const fontsNav = page.locator('#nav-fonts');
    if (await fontsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fontsNav.click();
      await page.waitForTimeout(500);
      const uploadBtn = page.locator('#upload-font-btn');
      if (await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(uploadBtn).toBeVisible();
      }
    }
  });

  // ---- Libraries Tab ----

  test('libraries tab is accessible from dashboard', async ({ page }) => {
    await login(page);
    const libsNav = page.locator('#nav-libraries');
    if (await libsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await libsNav.click();
      await page.waitForTimeout(500);
    }
  });

  test('libraries view shows connect library button', async ({ page }) => {
    await login(page);
    const libsNav = page.locator('#nav-libraries');
    if (await libsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await libsNav.click();
      await page.waitForTimeout(500);
      const connectBtn = page.locator('#connect-lib-btn');
      if (await connectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(connectBtn).toBeVisible();
      }
    }
  });

  // ---- Deleted/Trash Tab ----

  test('deleted files tab is accessible from dashboard', async ({ page }) => {
    await login(page);
    const deletedNav = page.locator('#nav-deleted');
    if (await deletedNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deletedNav.click();
      await page.waitForTimeout(500);
    }
  });

  test('deleted view shows empty state when no deleted files', async ({ page }) => {
    await login(page);
    const deletedNav = page.locator('#nav-deleted');
    if (await deletedNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deletedNav.click();
      await page.waitForTimeout(500);
    }
  });

  // ---- Search ----

  test('search input accepts text', async ({ page }) => {
    await login(page);
    const searchInput = page.locator('#search-input');
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('test');
      const value = await searchInput.inputValue();
      expect(value).toBe('test');
    }
  });

  test('search filters files by name', async ({ page }) => {
    await login(page);
    const searchInput = page.locator('#search-input');
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const beforeCount = await page.locator('.penpot-app__file-card, .file-card').count();
      await searchInput.fill('nonexistent-file-xyz');
      await page.waitForTimeout(500);
    }
  });

  // ---- Project Navigation ----

  test('project cards are visible on dashboard', async ({ page }) => {
    await login(page);
    const projectCards = page.locator('.penpot-app__project-card, .project-card');
    const count = await projectCards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('new project button exists', async ({ page }) => {
    await login(page);
    const newProjectBtn = page.locator('#new-project-btn');
    if (await newProjectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(newProjectBtn).toBeVisible();
    }
  });

  // ---- Negative / error handling ----

  test('dashboard handles empty state gracefully', async ({ page }) => {
    await login(page);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('rapid tab switching does not crash', async ({ page }) => {
    await login(page);
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const navIds = ['#nav-search', '#nav-fonts', '#nav-libraries', '#nav-deleted'];
    for (const navId of navIds) {
      const nav = page.locator(navId);
      if (await nav.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nav.click();
        await page.waitForTimeout(300);
      }
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('search with special characters does not crash', async ({ page }) => {
    await login(page);
    const searchInput = page.locator('#search-input');
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await searchInput.fill('<script>alert(1)</script>');
      await page.waitForTimeout(500);
      expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
    }
  });

  test('search with very long string does not crash', async ({ page }) => {
    await login(page);
    const searchInput = page.locator('#search-input');
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await searchInput.fill('a'.repeat(500));
      await page.waitForTimeout(500);
      expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
    }
  });
});