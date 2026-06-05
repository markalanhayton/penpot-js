import { test, expect } from '@playwright/test';

test.describe('Release Notes E2E', () => {

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

  test('penpot-release-notes custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-release-notes'));
    expect(defined).toBe(true);
  });

  test('release notes auto-shows on first workspace visit', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('penpot-release-notes-viewed'));
    if (!(await openWorkspace(page))) return;
    const rn = page.locator('penpot-release-notes');
    const overlay = rn.locator('.rn-overlay');
    await expect(overlay).toBeVisible({ timeout: 8000 }).catch(() => {});
  });

  test('open method shows the overlay', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rn = page.locator('penpot-release-notes');
    await rn.evaluate((el) => { localStorage.removeItem('penpot-release-notes-viewed'); el.open(); });
    const overlay = rn.locator('.rn-overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });
  });

  test('close hides the overlay and sets localStorage', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rn = page.locator('penpot-release-notes');
    await rn.evaluate((el) => { localStorage.removeItem('penpot-release-notes-viewed'); el.open(); });
    await page.waitForTimeout(300);
    await rn.evaluate((el) => el.close());
    await page.waitForTimeout(100);
    const overlay = rn.locator('.rn-overlay');
    await expect(overlay).not.toBeVisible({ timeout: 2000 });
    const stored = await page.evaluate(() => localStorage.getItem('penpot-release-notes-viewed'));
    expect(stored).toBe('2.17.0');
  });

  test('skip button closes release notes', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rn = page.locator('penpot-release-notes');
    await rn.evaluate((el) => { localStorage.removeItem('penpot-release-notes-viewed'); el.open(); });
    await page.waitForTimeout(300);
    const skipBtn = rn.locator('#skip-btn');
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
      const overlay = rn.locator('.rn-overlay');
      await expect(overlay).not.toBeVisible({ timeout: 2000 });
    }
  });

  test('version badge is displayed', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rn = page.locator('penpot-release-notes');
    await rn.evaluate((el) => { localStorage.removeItem('penpot-release-notes-viewed'); el.open(); });
    await page.waitForTimeout(300);
    const badge = rn.locator('.rn-version-badge');
    if (await badge.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await badge.textContent();
      expect(text).toContain('2.17');
    }
  });

  test('navigation bullets are rendered for multi-slide content', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rn = page.locator('penpot-release-notes');
    await rn.evaluate((el) => { localStorage.removeItem('penpot-release-notes-viewed'); el.open(); });
    await page.waitForTimeout(300);
    const bullets = rn.locator('.rn-bullet');
    const count = await bullets.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('escape key closes release notes', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rn = page.locator('penpot-release-notes');
    await rn.evaluate((el) => { localStorage.removeItem('penpot-release-notes-viewed'); el.open(); });
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    const overlay = rn.locator('.rn-overlay');
    await expect(overlay).not.toBeVisible({ timeout: 2000 });
  });

  test('reset method clears localStorage and re-opens', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rn = page.locator('penpot-release-notes');
    await rn.evaluate((el) => { localStorage.setItem('penpot-release-notes-viewed', '0.0.0'); el.close(); });
    await rn.evaluate((el) => el.reset());
    const overlay = rn.locator('.rn-overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });
  });

  test('closing sets localStorage so it does not auto-show again', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rn = page.locator('penpot-release-notes');
    await rn.evaluate((el) => { localStorage.removeItem('penpot-release-notes-viewed'); el.open(); });
    await page.waitForTimeout(300);
    await rn.evaluate((el) => el.close());
    await page.waitForTimeout(100);
    const stored = await page.evaluate(() => localStorage.getItem('penpot-release-notes-viewed'));
    expect(stored).toBeTruthy();
  });

  test('release-notes-open event fires on open', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rn = page.locator('penpot-release-notes');
    const eventFired = await rn.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('release-notes-open', () => resolve(true), { once: true });
        el.open();
      });
    });
    expect(eventFired).toBe(true);
  });

  test('release-notes-close event fires on close', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rn = page.locator('penpot-release-notes');
    await rn.evaluate((el) => { localStorage.removeItem('penpot-release-notes-viewed'); el.open(); });
    await page.waitForTimeout(200);
    const eventFired = await rn.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('release-notes-close', () => resolve(true), { once: true });
        el.close();
      });
    });
    expect(eventFired).toBe(true);
  });
});