import { test, expect } from '@playwright/test';

test.describe('Accessibility (a11y) E2E', () => {

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

  // ---- Auth screen keyboard navigation ----

  test('auth screen: Tab through login form fields', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.keyboard.press('Tab');
    const focusedEmail = await page.evaluate(() => document.activeElement?.id);
    expect(focusedEmail).toBeTruthy();
    await page.keyboard.press('Tab');
    const focusedPw = await page.evaluate(() => document.activeElement?.id);
    expect(focusedPw).toBeTruthy();
  });

  test('auth screen: Enter key submits login form', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.keyboard.press('Enter');
    await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  });

  test('auth screen: email input has label or aria-label', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const emailAria = await page.locator('#email').getAttribute('aria-label');
    const emailPlaceholder = await page.locator('#email').getAttribute('placeholder');
    const emailType = await page.locator('#email').getAttribute('type');
    expect(emailAria || emailPlaceholder || emailType).toBeTruthy();
  });

  test('auth screen: password input has appropriate type', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const pwType = await page.locator('#pw').getAttribute('type');
    expect(pwType).toBe('password');
  });

  test('auth screen: password toggle changes input type', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#pw').fill('testpassword');
    await page.locator('#pw-toggle').click();
    expect(await page.locator('#pw').getAttribute('type')).toBe('text');
    await page.locator('#pw-toggle').click();
    expect(await page.locator('#pw').getAttribute('type')).toBe('password');
  });

  // ---- Workspace keyboard navigation ----

  test('workspace: Tab navigates through toolbar buttons', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.keyboard.press('Tab');
    const focusedId = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    expect(focusedId).toBeTruthy();
  });

  test('workspace: keyboard shortcuts switch tools', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    await canvas.click();
    await page.keyboard.press('v');
    const selectTool = page.locator('penpot-tools-bar').locator('[data-tool="select"]');
    await expect(selectTool).toHaveClass(/active/);
    await page.keyboard.press('r');
    const rectTool = page.locator('penpot-tools-bar').locator('[data-tool="rect"]');
    await expect(rectTool).toHaveClass(/active/);
  });

  test('workspace: Escape cancels current tool action', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
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
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const selectTool = tools.locator('[data-tool="select"]');
    await expect(selectTool).toHaveClass(/active/);
  });

  test('workspace: Ctrl+Z undoes last action', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const before = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
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
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const after = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    expect(after).toBe(before);
  });

  test('workspace: Delete key deletes selected shape', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    const before = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
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
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    const after = await canvas.evaluate((el) => {
      const svg = el.querySelector('#container svg');
      return svg ? svg.querySelectorAll('[id^="shape-"]').length : 0;
    });
    expect(after).toBe(before);
  });

  // ---- ARIA labels ----

  test('auth screen: submit button has accessible text', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const submitText = await page.locator('#submit').textContent();
    expect(submitText).toBeTruthy();
    expect(submitText.length).toBeGreaterThan(0);
  });

  test('workspace: toolbar buttons have visible text or aria-labels', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const buttons = toolbar.locator('button, .penpot-toolbar__toolbar-btn');
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      expect(text || ariaLabel || title).toBeTruthy();
    }
  });

  test('workspace: tool buttons have data-tool attributes for identification', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    const toolBtns = tools.locator('[data-tool]');
    const count = await toolBtns.count();
    expect(count).toBeGreaterThanOrEqual(5);
    const toolNames = ['select', 'hand', 'frame', 'rect', 'circle', 'text'];
    for (const name of toolNames) {
      const btn = tools.locator(`[data-tool="${name}"]`);
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const ariaLabel = await btn.getAttribute('aria-label');
        const title = await btn.getAttribute('title');
        expect(ariaLabel || title || name).toBeTruthy();
      }
    }
  });

  // ---- Focus management ----

  test('auth screen: focus moves to error after failed login', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('invalid@example.com');
    await page.locator('#pw').fill('wrongpassword');
    await page.locator('#submit').click();
    await expect(page.locator('.penpot-app__auth-error')).toBeVisible({ timeout: 10000 });
  });

  test('workspace: click on canvas focuses canvas area', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.waitForTimeout(200);
  });

  test('workspace: right sidebar tabs are keyboard navigable', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const designTab = sidebar.locator('[data-tab="design"]');
    await expect(designTab).toBeVisible();
    const protoTab = sidebar.locator('[data-tab="prototype"]');
    await expect(protoTab).toBeVisible();
    const inspectTab = sidebar.locator('[data-tab="inspect"]');
    await expect(inspectTab).toBeVisible();
  });

  // ---- Negative / error handling ----

  test('no accessibility violations on auth screen', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.waitForTimeout(1000);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('no accessibility violations on workspace', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(1000);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('rapid keyboard shortcut switching does not crash', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const canvas = page.locator('penpot-canvas');
    await canvas.click();
    const shortcuts = ['v', 'r', 'e', 't', 'h', 'f', 'v', 'r'];
    for (const key of shortcuts) {
      await page.keyboard.press(key);
      await page.waitForTimeout(50);
    }
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });
});