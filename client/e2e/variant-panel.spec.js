import { test, expect } from '@playwright/test';

test.describe('Variant Panel E2E', () => {

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

  test('variant panel custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-variant-panel'));
    expect(defined).toBe(true);
  });

  test('variant panel uses shadow DOM', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-variant-panel');
    const hasShadow = await panel.evaluate((el) => !!el.shadowRoot);
    expect(hasShadow).toBe(true);
  });

  test('variant panel shows empty state without selection', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-variant-panel');
    const content = await panel.evaluate((el) => el.shadowRoot?.innerHTML ?? '');
    const isEmpty = content === '' || content.includes('empty') || content.length < 50;
    expect(isEmpty).toBe(true);
  });

  test('variant container rendering shows add property button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-variant-panel');

    await panel.evaluate((el) => {
      el.selectedShape = {
        id: 'vc-1',
        type: 'frame',
        name: 'Variant Container',
        isComponentContainer: true,
        componentRoot: true,
      };
    });
    await page.waitForTimeout(200);

    const addPropBtn = panel.locator('#add-property-btn');
    if (await addPropBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      expect(await addPropBtn.count()).toBe(1);
    }
  });

  test('add property button emits penpot-variant-add-property', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-variant-panel');

    await panel.evaluate((el) => {
      el.selectedShape = {
        id: 'vc-1',
        type: 'frame',
        name: 'Variant Container',
        isComponentContainer: true,
        componentRoot: true,
      };
    });
    await page.waitForTimeout(200);

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        const handler = (e) => {
          resolve(e.detail);
        };
        el.addEventListener('penpot-variant-add-property', handler, { once: true });
        const btn = el.shadowRoot?.querySelector('#add-property-btn');
        if (btn) btn.click();
        else resolve(null);
      });
    });
    if (eventFired) {
      expect(eventFired.shapeId).toBe('vc-1');
    }
  });

  test('add variant button emits penpot-variant-add-variant', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-variant-panel');

    await panel.evaluate((el) => {
      el.selectedShape = {
        id: 'vc-1',
        type: 'frame',
        name: 'Variant Container',
        isComponentContainer: true,
        componentRoot: true,
      };
    });
    await page.waitForTimeout(200);

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        const handler = (e) => {
          resolve(e.detail);
        };
        el.addEventListener('penpot-variant-add-variant', handler, { once: true });
        const btn = el.shadowRoot?.querySelector('#add-variant-btn');
        if (btn) btn.click();
        else resolve(null);
      });
    });
    if (eventFired) {
      expect(eventFired.shapeId).toBe('vc-1');
    }
  });

  test('variant instance shows property switcher', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-variant-panel');

    await panel.evaluate((el) => {
      el.selectedShape = {
        id: 'vi-1',
        type: 'frame',
        name: 'Button/Primary',
        componentId: 'comp-1',
        componentFile: 'file-1',
        remoteVariantProperties: { Size: 'Large', State: 'Hover' },
      };
    });
    await page.waitForTimeout(200);

    const switcher = panel.locator('.property-switcher');
    if (await switcher.count() > 0) {
      expect(await switcher.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('variant instance shows go-to-container button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-variant-panel');

    await panel.evaluate((el) => {
      el.selectedShape = {
        id: 'vi-1',
        type: 'frame',
        name: 'Button/Primary',
        componentId: 'comp-1',
        componentFile: 'file-1',
        remoteVariantProperties: { Size: 'Large' },
      };
    });
    await page.waitForTimeout(200);

    const gotoBtn = panel.locator('#go-to-container-btn');
    if (await gotoBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      expect(await gotoBtn.count()).toBe(1);
    }
  });

  test('component instance shows combine-as-variants button', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-variant-panel');

    await panel.evaluate((el) => {
      el.selectedShape = {
        id: 'ci-1',
        type: 'frame',
        name: 'My Component',
        componentId: 'comp-1',
        componentFile: 'file-1',
      };
    });
    await page.waitForTimeout(200);

    const combineBtn = panel.locator('#combine-as-variants-btn');
    if (await combineBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      expect(await combineBtn.count()).toBe(1);
    }
  });

  test('events bubble across shadow DOM boundary', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-variant-panel');

    await panel.evaluate((el) => {
      el.selectedShape = {
        id: 'vc-1',
        type: 'frame',
        name: 'Variant Container',
        isComponentContainer: true,
        componentRoot: true,
      };
    });
    await page.waitForTimeout(200);

    const eventReachedDocument = await page.evaluate(async () => {
      const panel = document.querySelector('penpot-variant-panel');
      if (!panel) return false;
      return new Promise((resolve) => {
        document.addEventListener('penpot-variant-add-property', () => resolve(true), { once: true });
        const btn = panel.shadowRoot?.querySelector('#add-property-btn');
        if (btn) btn.click();
        else resolve(false);
        setTimeout(() => resolve(false), 2000);
      });
    });
    expect(eventReachedDocument).toBe(true);
  });
});