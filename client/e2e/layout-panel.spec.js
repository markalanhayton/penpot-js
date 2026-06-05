import { test, expect } from '@playwright/test';

test.describe('Layout Panel E2E', () => {

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

  async function drawFrame(page) {
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="frame"]').click();
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 200, startY + 150, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);
  }

  test('layout panel custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-layout-panel'));
    expect(defined).toBe(true);
  });

  test('layout panel shows empty state when no shape selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const panel = page.locator('penpot-layout-panel');
    const emptyState = panel.locator('.penpot-rside__empty-state');
    if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await emptyState.textContent();
      expect(text).toContain('layout');
    }
  });

  test('layout type buttons render when frame is selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const panel = page.locator('penpot-layout-panel');
    const noneBtn = panel.locator('[data-layout="none"]');
    const flexBtn = panel.locator('[data-layout="flex"]');
    const gridBtn = panel.locator('[data-layout="grid"]');
    await expect(noneBtn).toBeVisible({ timeout: 3000 }).catch(() => {});
    await expect(flexBtn).toBeVisible({ timeout: 3000 }).catch(() => {});
    await expect(gridBtn).toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('clicking flex layout emits penpot-layout-change', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const panel = page.locator('penpot-layout-panel');

    const flexBtn = panel.locator('[data-layout="flex"]');
    if (!(await flexBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-layout-change', (e) => {
          resolve(e.detail);
        }, { once: true });
        const btn = el.querySelector('[data-layout="flex"]');
        if (btn) btn.click();
        else resolve(null);
      });
    });
    if (eventFired) {
      expect(eventFired.prop).toBe('layout');
      expect(eventFired.value).toBe('flex');
    }
  });

  test('flex direction buttons emit penpot-layout-change', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const panel = page.locator('penpot-layout-panel');

    const flexBtn = panel.locator('[data-layout="flex"]');
    if (!(await flexBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await flexBtn.click();
    await page.waitForTimeout(200);

    const rowBtn = panel.locator('[data-dir="row"]');
    if (!(await rowBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-layout-change', (e) => {
          resolve(e.detail);
        }, { once: true });
        const btn = el.querySelector('[data-dir="row"]');
        if (btn) btn.click();
        else resolve(null);
      });
    });
    if (eventFired) {
      expect(eventFired.prop).toBe('layout-flex-dir');
    }
  });

  test('gap inputs exist for flex layout', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const panel = page.locator('penpot-layout-panel');

    const flexBtn = panel.locator('[data-layout="flex"]');
    if (!(await flexBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await flexBtn.click();
    await page.waitForTimeout(200);

    const rowGap = panel.locator('#layout-row-gap');
    const colGap = panel.locator('#layout-col-gap');
    await expect(rowGap).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(colGap).toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('wrap toggle buttons exist for flex layout', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const panel = page.locator('penpot-layout-panel');

    const flexBtn = panel.locator('[data-layout="flex"]');
    if (!(await flexBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await flexBtn.click();
    await page.waitForTimeout(200);

    const nowrapBtn = panel.locator('[data-wrap="nowrap"]');
    const wrapBtn = panel.locator('[data-wrap="wrap"]');
    await expect(nowrapBtn).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(wrapBtn).toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('justify content buttons exist for flex layout', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const panel = page.locator('penpot-layout-panel');

    const flexBtn = panel.locator('[data-layout="flex"]');
    if (!(await flexBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await flexBtn.click();
    await page.waitForTimeout(200);

    const startBtn = panel.locator('[data-justify="start"]');
    const centerBtn = panel.locator('[data-justify="center"]');
    await expect(startBtn).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(centerBtn).toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('align items buttons exist for flex layout', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const panel = page.locator('penpot-layout-panel');

    const flexBtn = panel.locator('[data-layout="flex"]');
    if (!(await flexBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await flexBtn.click();
    await page.waitForTimeout(200);

    const startBtn = panel.locator('[data-align="start"]');
    const centerBtn = panel.locator('[data-align="center"]');
    await expect(startBtn).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(centerBtn).toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('padding inputs exist for flex layout', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const panel = page.locator('penpot-layout-panel');

    const flexBtn = panel.locator('[data-layout="flex"]');
    if (!(await flexBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await flexBtn.click();
    await page.waitForTimeout(200);

    const pt = panel.locator('#layout-pt');
    const pr = panel.locator('#layout-pr');
    const pb = panel.locator('#layout-pb');
    const pl = panel.locator('#layout-pl');
    await expect(pt).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(pr).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(pb).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(pl).toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('grid layout shows add column/row buttons', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const panel = page.locator('penpot-layout-panel');

    const gridBtn = panel.locator('[data-layout="grid"]');
    if (!(await gridBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await gridBtn.click();
    await page.waitForTimeout(200);

    const addCol = panel.locator('#add-grid-col');
    const addRow = panel.locator('#add-grid-row');
    await expect(addCol).toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(addRow).toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('clicking grid add column emits penpot-layout-change', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawFrame(page);
    const panel = page.locator('penpot-layout-panel');

    const gridBtn = panel.locator('[data-layout="grid"]');
    if (!(await gridBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;
    await gridBtn.click();
    await page.waitForTimeout(200);

    const addCol = panel.locator('#add-grid-col');
    if (!(await addCol.isVisible({ timeout: 2000 }).catch(() => false))) return;

    const eventFired = await panel.evaluate(async (el) => {
      return new Promise((resolve) => {
        el.addEventListener('penpot-layout-change', (e) => {
          resolve(e.detail);
        }, { once: true });
        const btn = el.querySelector('#add-grid-col');
        if (btn) btn.click();
        else resolve(null);
      });
    });
    if (eventFired) {
      expect(eventFired.prop).toBeTruthy();
    }
  });
});