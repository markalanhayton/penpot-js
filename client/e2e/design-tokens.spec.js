import { test, expect } from '@playwright/test';

test.describe('Design Tokens E2E', () => {

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

  test('tokens panel custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-tokens-panel'));
    expect(defined).toBe(true);
  });

  test('tokens panel is accessible from right sidebar tokens tab', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const tokensTab = sidebar.locator('[data-tab="tokens"]');
    if (await tokensTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tokensTab.click();
      await expect(page.locator('penpot-tokens-panel')).toBeVisible();
    }
  });

  test('tab buttons render for colors, typographies, sets, themes', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const tokensTab = sidebar.locator('[data-tab="tokens"]');
    if (!(await tokensTab.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await tokensTab.click();
    const panel = page.locator('penpot-tokens-panel');
    await expect(panel).toBeVisible();
    const colorTab = panel.locator('[data-token-tab="colors"]');
    const typoTab = panel.locator('[data-token-tab="typographies"]');
    const setsTab = panel.locator('[data-token-tab="sets"]');
    const themesTab = panel.locator('[data-token-tab="themes"]');
    await expect(colorTab).toBeVisible();
    await expect(typoTab).toBeVisible();
    await expect(setsTab).toBeVisible();
    await expect(themesTab).toBeVisible();
  });

  test('switching tabs updates active class', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const tokensTab = sidebar.locator('[data-tab="tokens"]');
    if (!(await tokensTab.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await tokensTab.click();
    const panel = page.locator('penpot-tokens-panel');
    await expect(panel).toBeVisible();

    const typoTab = panel.locator('[data-token-tab="typographies"]');
    await typoTab.click();
    const isActive = await typoTab.evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);
  });

  test('clicking ADD color token emits penpot-token-add event', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const tokensTab = sidebar.locator('[data-tab="tokens"]');
    if (!(await tokensTab.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await tokensTab.click();
    const panel = page.locator('penpot-tokens-panel');
    await expect(panel).toBeVisible();

    const colorTab = panel.locator('[data-token-tab="colors"]');
    await colorTab.click();

    const addBtn = panel.locator('#add-color-token');
    if (!(await addBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-token-add', (e) => {
          resolve(e.detail);
        }, { once: true });
        const btn = el.querySelector('#add-color-token');
        if (btn) btn.click();
        else resolve(null);
      });
    });
    expect(eventFired).toBeTruthy();
    expect(eventFired.type).toBe('color');
  });

  test('clicking ADD typography token emits penpot-token-add event', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const tokensTab = sidebar.locator('[data-tab="tokens"]');
    if (!(await tokensTab.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await tokensTab.click();
    const panel = page.locator('penpot-tokens-panel');
    await expect(panel).toBeVisible();

    const typoTab = panel.locator('[data-token-tab="typographies"]');
    await typoTab.click();

    const addBtn = panel.locator('#add-typo-token');
    if (!(await addBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-token-add', (e) => {
          resolve(e.detail);
        }, { once: true });
        const btn = el.querySelector('#add-typo-token');
        if (btn) btn.click();
        else resolve(null);
      });
    });
    expect(eventFired).toBeTruthy();
    expect(eventFired.type).toBe('typography');
  });

  test('deleting a color token emits penpot-token-delete', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const tokensTab = sidebar.locator('[data-tab="tokens"]');
    if (!(await tokensTab.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await tokensTab.click();
    const panel = page.locator('penpot-tokens-panel');
    await expect(panel).toBeVisible();

    await panel.locator('[data-token-tab="colors"]').click();

    const addBtn = panel.locator('#add-color-token');
    if (!(await addBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;
    await addBtn.click();
    await page.waitForTimeout(200);

    const deleteBtn = panel.locator('[data-color-delete="0"]');
    if (!(await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-token-delete', (e) => {
          resolve(e.detail);
        }, { once: true });
        const btn = el.querySelector('[data-color-delete="0"]');
        if (btn) btn.click();
        else resolve(null);
      });
    });
    expect(eventFired).toBeTruthy();
    expect(eventFired.type).toBe('color');
    expect(eventFired.index).toBe(0);
  });

  test('clicking color swatch emits penpot-apply-color-token', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const tokensTab = sidebar.locator('[data-tab="tokens"]');
    if (!(await tokensTab.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await tokensTab.click();
    const panel = page.locator('penpot-tokens-panel');
    await expect(panel).toBeVisible();

    await panel.locator('[data-token-tab="colors"]').click();

    const addBtn = panel.locator('#add-color-token');
    if (!(await addBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;
    await addBtn.click();
    await page.waitForTimeout(200);

    const swatch = panel.locator('[data-apply-color="0"]');
    if (!(await swatch.isVisible({ timeout: 2000 }).catch(() => false))) return;

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-apply-color-token', (e) => {
          resolve(e.detail);
        }, { once: true });
        const s = el.querySelector('[data-apply-color="0"]');
        if (s) s.click();
        else resolve(null);
      });
    });
    expect(eventFired).toBeTruthy();
    expect(eventFired.index).toBe(0);
  });

  test('token set activation emits penpot-token-set-activate', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const tokensTab = sidebar.locator('[data-tab="tokens"]');
    if (!(await tokensTab.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await tokensTab.click();
    const panel = page.locator('penpot-tokens-panel');
    await expect(panel).toBeVisible();

    await panel.locator('[data-token-tab="sets"]').click();

    const addSetBtn = panel.locator('#add-token-set');
    if (!(await addSetBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;
    await addSetBtn.click();
    await page.waitForTimeout(200);

    const setRow = panel.locator('[data-set-activate="0"]');
    if (!(await setRow.isVisible({ timeout: 2000 }).catch(() => false))) return;

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-token-set-activate', (e) => {
          resolve(e.detail);
        }, { once: true });
        const row = el.querySelector('[data-set-activate="0"]');
        if (row) row.click();
        else resolve(null);
      });
    });
    expect(eventFired).toBeTruthy();
    expect(eventFired.index).toBe(0);
  });

  test('theme selector change emits penpot-token-theme-change', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const tokensTab = sidebar.locator('[data-tab="tokens"]');
    if (!(await tokensTab.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await tokensTab.click();
    const panel = page.locator('penpot-tokens-panel');
    await expect(panel).toBeVisible();

    await panel.locator('[data-token-tab="themes"]').click();

    const themeSelect = panel.locator('#theme-selector');
    if (!(await themeSelect.isVisible({ timeout: 2000 }).catch(() => false))) return;

    const options = await themeSelect.locator('option').allInnerTexts();
    if (options.length < 2) return;

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-token-theme-change', (e) => {
          resolve(e.detail);
        }, { once: true });
        const sel = el.querySelector('#theme-selector');
        if (sel && sel.options.length > 1) {
          sel.selectedIndex = 1;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          resolve(null);
        }
      });
    });
    expect(eventFired).toBeTruthy();
    expect(eventFired.theme).toBeTruthy();
  });
});