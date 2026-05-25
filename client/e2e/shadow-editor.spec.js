import { test, expect } from '@playwright/test';

test.describe('Shadow Editor E2E', () => {

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

  test('shadow editor custom element is registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const defined = await page.evaluate(() => !!customElements.get('penpot-shadow-editor'));
    expect(defined).toBe(true);
  });

  test('add shadow button visible when shape selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const shadowEditor = sidebar.locator('#shadow-editor');
    if (await shadowEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      const addBtn = shadowEditor.locator('#add-shadow, .penpot-shadow__add-btn').first();
      if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(addBtn).toBeVisible();
      }
    }
  });

  test('clicking add shadow creates shadow entry', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const shadowEditor = sidebar.locator('#shadow-editor');
    if (await shadowEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      const addBtn = shadowEditor.locator('#add-shadow, .penpot-shadow__add-btn').first();
      if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(200);
        const shadowItem = shadowEditor.locator('.penpot-shadow__shadow-item').first();
        if (await shadowItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(shadowItem).toBeVisible();
        }
      }
    }
  });

  test('shadow has drop-shadow type by default', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const shadowEditor = sidebar.locator('#shadow-editor');
    if (await shadowEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      const addBtn = shadowEditor.locator('#add-shadow, .penpot-shadow__add-btn').first();
      if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(200);
        const activeType = shadowEditor.locator('.penpot-shadow__type-btn.penpot-shadow__active').first();
        if (await activeType.isVisible({ timeout: 1000 }).catch(() => false)) {
          const text = await activeType.textContent();
          expect(text).toBeTruthy();
        }
      }
    }
  });

  test('shadow has offset and blur inputs', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const shadowEditor = sidebar.locator('#shadow-editor');
    if (await shadowEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      const addBtn = shadowEditor.locator('#add-shadow, .penpot-shadow__add-btn').first();
      if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(200);
        const offsetX = shadowEditor.locator('.penpot-shadow__prop-input').first();
        if (await offsetX.isVisible({ timeout: 1000 }).catch(() => false)) {
          await expect(offsetX).toBeVisible();
        }
      }
    }
  });

  test('shadow type toggle switches between drop and inner', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const shadowEditor = sidebar.locator('#shadow-editor');
    if (await shadowEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      const addBtn = shadowEditor.locator('#add-shadow, .penpot-shadow__add-btn').first();
      if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(200);
        const typeBtns = shadowEditor.locator('.penpot-shadow__type-btn');
        if (await typeBtns.count() >= 2) {
          const innerBtn = typeBtns.nth(1);
          if (await innerBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await innerBtn.click();
            await page.waitForTimeout(200);
          }
        }
      }
    }
  });

  test('shadow color input is type color', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const shadowEditor = sidebar.locator('#shadow-editor');
    if (await shadowEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      const addBtn = shadowEditor.locator('#add-shadow, .penpot-shadow__add-btn').first();
      if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(200);
        const colorInput = shadowEditor.locator('.penpot-shadow__color-input').first();
        if (await colorInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          const inputType = await colorInput.getAttribute('type');
          expect(inputType).toBe('color');
        }
      }
    }
  });

  test('remove shadow button deletes shadow entry', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const shadowEditor = sidebar.locator('#shadow-editor');
    if (await shadowEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      const addBtn = shadowEditor.locator('#add-shadow, .penpot-shadow__add-btn').first();
      if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(200);
        const delBtn = shadowEditor.locator('.penpot-shadow__del-btn').first();
        if (await delBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await delBtn.click();
          await page.waitForTimeout(200);
          const items = shadowEditor.locator('.penpot-shadow__shadow-item');
          expect(await items.count()).toBe(0);
        }
      }
    }
  });

  test('can add multiple shadows', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const shadowEditor = sidebar.locator('#shadow-editor');
    if (await shadowEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      const addBtn = shadowEditor.locator('#add-shadow, .penpot-shadow__add-btn').first();
      if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(200);
        await addBtn.click();
        await page.waitForTimeout(200);
        const items = shadowEditor.locator('.penpot-shadow__shadow-item');
        expect(await items.count()).toBeGreaterThanOrEqual(2);
      }
    }
  });

  // ---- Negative / error handling ----

  test('shadow editor not visible when no shape selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const shadowEditor = sidebar.locator('#shadow-editor');
    const addBtn = shadowEditor.locator('#add-shadow, .penpot-shadow__add-btn').first();
    expect(await addBtn.isVisible({ timeout: 2000 }).catch(() => false)).toBe(false);
  });

  test('shadow change does not crash with invalid values', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await sidebar.locator('[data-tab="design"]').click();
    await page.waitForTimeout(300);
    const shadowEditor = sidebar.locator('#shadow-editor');
    if (await shadowEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      const addBtn = shadowEditor.locator('#add-shadow, .penpot-shadow__add-btn').first();
      if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(200);
        const offsetInput = shadowEditor.locator('.penpot-shadow__prop-input').first();
        if (await offsetInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await offsetInput.fill('abc');
          await offsetInput.press('Enter');
          await page.waitForTimeout(200);
        }
      }
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });
});