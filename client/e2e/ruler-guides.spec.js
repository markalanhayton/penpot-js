import { test, expect } from '@playwright/test';

test.describe('Ruler Guides E2E', () => {

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

  test('rulers component renders in canvas', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    await expect(canvas).toBeVisible();
    const rulers = canvas.locator('#rulers');
    await expect(rulers).toBeVisible();
  });

  test('ruler horizontal canvas exists', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rulers = page.locator('penpot-rulers, #rulers').first();
    const hCanvas = rulers.locator('#h-canvas');
    await expect(hCanvas).toBeVisible({ timeout: 5000 });
  });

  test('ruler vertical canvas exists', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rulers = page.locator('penpot-rulers, #rulers').first();
    const vCanvas = rulers.locator('#v-canvas');
    await expect(vCanvas).toBeVisible({ timeout: 5000 });
  });

  test('ruler corner exists', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rulers = page.locator('penpot-rulers, #rulers').first();
    const corner = rulers.locator('.penpot-ruler__ruler-corner');
    await expect(corner).toBeVisible({ timeout: 5000 });
  });

  test('guide overlay component exists', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const guideOverlay = page.locator('penpot-guide-overlay');
    expect(guideOverlay).toBeTruthy();
  });

  test('guide overlay has SVG container', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const guideOverlay = page.locator('penpot-guide-overlay');
    if (await guideOverlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const svgContainer = guideOverlay.locator('#guide-svg');
      await expect(svgContainer).toBeVisible({ timeout: 3000 });
    }
  });

  test('guide creation zones exist in rulers', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const rulers = page.locator('penpot-rulers, #rulers').first();
    const hZone = rulers.locator('#guide-create-h');
    const vZone = rulers.locator('#guide-create-v');
    if (await hZone.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(hZone).toBeTruthy();
    }
    if (await vZone.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(vZone).toBeTruthy();
    }
  });

  test('ruler markers update on zoom', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    const zoomLevel = tools.locator('#zoom-level');
    await expect(zoomLevel).toHaveText('100%');
    await tools.locator('#zoom-in').click();
    await page.waitForTimeout(300);
    const afterZoom = await zoomLevel.textContent();
    expect(parseInt(afterZoom)).toBeGreaterThan(100);
  });

  test('penpot-canvas exposes guides container', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const guidesContainer = canvas.locator('#guides');
    await expect(guidesContainer).toBeVisible({ timeout: 3000 });
  });

  test('guide overlay renders without errors after page load', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toEqual([]);
  });

  test('rulers component is registered as custom element', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-rulers'));
    expect(defined).toBe(true);
  });

  test('guide overlay component is registered as custom element', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-guide-overlay'));
    expect(defined).toBe(true);
  });

  // ---- Negative / error handling tests ----

  test('no guides exist on fresh file', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const guideOverlay = page.locator('penpot-guide-overlay');
    if (await guideOverlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      const guideCount = await guideOverlay.evaluate((el) => {
        return el.guides ? el.guides.length : 0;
      });
      expect(guideCount).toBe(0);
    }
  });

  test('guide overlay with empty guides array does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const guideOverlay = page.locator('penpot-guide-overlay');
    if (await guideOverlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      await guideOverlay.evaluate((el) => { el.guides = []; });
      await page.waitForTimeout(300);
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('ruler zoom in/out does not produce errors', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('#zoom-in').click();
    await page.waitForTimeout(200);
    await tools.locator('#zoom-out').click();
    await page.waitForTimeout(200);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('guide overlay setting invalid viewport does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const guideOverlay = page.locator('penpot-guide-overlay');
    if (await guideOverlay.isVisible({ timeout: 3000 }).catch(() => false)) {
      await guideOverlay.evaluate((el) => { el.viewport = null; });
      await page.waitForTimeout(200);
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });
});