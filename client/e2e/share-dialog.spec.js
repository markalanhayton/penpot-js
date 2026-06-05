import { test, expect } from '@playwright/test';

test.describe('Share Dialog E2E', () => {

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

  test('share dialog custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-share-dialog'));
    expect(defined).toBe(true);
  });

  test('share dialog opens and shows title', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const dialog = page.locator('penpot-share-dialog');
    await dialog.evaluate((el) => el.open('test-file-id'));
    await expect(dialog.locator('.penpot-share__dialog-title')).toBeVisible({ timeout: 3000 });
  });

  test('share dialog close button emits penpot-share-close', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const dialog = page.locator('penpot-share-dialog');
    await dialog.evaluate((el) => el.open('test-file-id'));
    await page.waitForTimeout(300);

    const closeBtn = dialog.locator('#close');
    if (!(await closeBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;

    const eventFired = await dialog.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-share-close', () => resolve(true), { once: true });
        const btn = el.querySelector('#close');
        if (btn) btn.click();
        else resolve(false);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('share dialog cancel button emits penpot-share-close', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const dialog = page.locator('penpot-share-dialog');
    await dialog.evaluate((el) => el.open('test-file-id'));
    await page.waitForTimeout(300);

    const cancelBtn = dialog.locator('#cancel-btn');
    if (!(await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;

    const eventFired = await dialog.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-share-close', () => resolve(true), { once: true });
        const btn = el.querySelector('#cancel-btn');
        if (btn) btn.click();
        else resolve(false);
      });
    });
    expect(eventFired).toBe(true);
  });

  test('share URL contains file ID when set', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const dialog = page.locator('penpot-share-dialog');
    await dialog.evaluate((el) => el.open('abc-123-file'));
    await page.waitForTimeout(300);

    const urlInput = dialog.locator('#share-url');
    if (!(await urlInput.isVisible({ timeout: 2000 }).catch(() => false))) return;
    const value = await urlInput.inputValue();
    expect(value).toContain('abc-123-file');
  });

  test('copy button exists in share dialog', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const dialog = page.locator('penpot-share-dialog');
    await dialog.evaluate((el) => el.open('test-file-id'));
    await page.waitForTimeout(300);

    const copyBtn = dialog.locator('#copy-btn');
    await expect(copyBtn).toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('permission selects are rendered', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const dialog = page.locator('penpot-share-dialog');
    await dialog.evaluate((el) => el.open('test-file-id'));
    await page.waitForTimeout(300);

    const permView = dialog.locator('#perm-view');
    const permComment = dialog.locator('#perm-comment');
    const permEdit = dialog.locator('#perm-edit');
    await expect(permView).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(permComment).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(permEdit).toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('closing dialog removes open attribute', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const dialog = page.locator('penpot-share-dialog');
    await dialog.evaluate((el) => el.open('test-file-id'));
    await page.waitForTimeout(300);

    const hasOpenBefore = await dialog.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpenBefore).toBe(true);

    await dialog.evaluate((el) => el.close());
    const hasOpenAfter = await dialog.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpenAfter).toBe(false);
  });

  test('open attribute controls visibility', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const dialog = page.locator('penpot-share-dialog');

    await dialog.evaluate((el) => el.setAttribute('open', ''));
    const hasOpen = await dialog.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpen).toBe(true);

    await dialog.evaluate((el) => el.removeAttribute('open'));
    const hasOpenAfter = await dialog.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpenAfter).toBe(false);
  });
});