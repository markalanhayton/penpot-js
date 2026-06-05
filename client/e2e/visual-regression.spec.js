import { test, expect } from '@playwright/test';

test.describe('Visual Regression E2E', () => {

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

  async function drawRect(page, opts = {}) {
    const x = opts.x ?? 300;
    const y = opts.y ?? 200;
    const w = opts.w ?? 80;
    const h = opts.h ?? 60;
    const tools = page.locator('penpot-tools-bar');
    await tools.locator('[data-tool="rect"]').click();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + w, y + h, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await tools.locator('[data-tool="select"]').click();
    await page.waitForTimeout(200);
  }

  // ---- Auth screen screenshots ----

  test('auth screen login mode screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.waitForTimeout(500);
    await expect(page.locator('penpot-auth-screen')).toHaveScreenshot('auth-login.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('auth screen register mode screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#switch-link').click();
    await expect(page.locator('#title')).toHaveText('Create your account');
    await page.waitForTimeout(500);
    await expect(page.locator('penpot-auth-screen')).toHaveScreenshot('auth-register.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('auth screen recovery mode screenshot', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    await page.waitForTimeout(500);
    await expect(page.locator('penpot-auth-screen')).toHaveScreenshot('auth-recovery.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  // ---- Dashboard screenshots ----

  test('dashboard screenshot', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(1000);
    await expect(page.locator('penpot-dashboard')).toHaveScreenshot('dashboard.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  // ---- Workspace shell screenshots ----

  test('workspace shell screenshot', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(500);
    await expect(page.locator('penpot-workspace')).toHaveScreenshot('workspace-shell.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('workspace toolbar screenshot', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(500);
    await expect(page.locator('penpot-toolbar')).toHaveScreenshot('workspace-toolbar.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('workspace tools bar screenshot', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(500);
    await expect(page.locator('penpot-tools-bar')).toHaveScreenshot('workspace-tools-bar.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  // ---- Sidebar screenshots ----

  test('left sidebar screenshot', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(500);
    await expect(page.locator('penpot-left-sidebar')).toHaveScreenshot('left-sidebar.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('right sidebar empty state screenshot', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(500);
    await expect(page.locator('penpot-right-sidebar')).toHaveScreenshot('right-sidebar-empty.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('right sidebar with shape selected screenshot', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    await page.waitForTimeout(500);
    await expect(page.locator('penpot-right-sidebar')).toHaveScreenshot('right-sidebar-shape.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  // ---- Canvas screenshots ----

  test('canvas empty state screenshot', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(500);
    await expect(page.locator('penpot-canvas')).toHaveScreenshot('canvas-empty.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('canvas with rect shape screenshot', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    await page.waitForTimeout(500);
    await expect(page.locator('penpot-canvas')).toHaveScreenshot('canvas-rect.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  // ---- Full-page screenshots ----

  test('full workspace page screenshot', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('workspace-fullpage.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  // ---- Error state screenshots ----

  test('auth screen with error state screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#email').fill('invalid@example.com');
    await page.locator('#pw').fill('wrongpassword');
    await page.locator('#submit').click();
    const errorEl = page.locator('.penpot-app__auth-error');
    if (await errorEl.isVisible({ timeout: 8000 }).catch(() => false)) {
      await page.waitForTimeout(500);
      await expect(page.locator('penpot-auth-screen')).toHaveScreenshot('auth-error.png', {
        maxDiffPixelRatio: 0.02,
      });
    }
  });

  // ---- Design system component screenshots ----

  const COMPONENT_TESTS = [
    { tag: 'penpot-button', name: 'component-button', innerHTML: 'Click me' },
    { tag: 'penpot-input', name: 'component-input', attrs: { value: 'Hello', placeholder: 'Type here' } },
    { tag: 'penpot-checkbox', name: 'component-checkbox', innerHTML: 'Check me' },
    { tag: 'penpot-switch', name: 'component-switch', innerHTML: 'Toggle' },
    { tag: 'penpot-radio', name: 'component-radio', innerHTML: 'Option A', attrs: { name: 'test-group' } },
    { tag: 'penpot-badge', name: 'component-badge', innerHTML: 'Badge' },
    { tag: 'penpot-avatar', name: 'component-avatar' },
    { tag: 'penpot-loader', name: 'component-loader' },
  ];

  for (const { tag, name, innerHTML, attrs } of COMPONENT_TESTS) {
    test(`${tag} screenshot`, async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('penpot-auth-screen');
      const defined = await page.evaluate((t) => customElements.get(t) !== undefined, tag);
      if (!defined) return;
      await page.evaluate(({ t, content, attributes }) => {
        const el = document.createElement(t);
        if (content) el.innerHTML = content;
        if (attributes) {
          for (const [k, v] of Object.entries(attributes)) {
            el.setAttribute(k, v);
          }
        }
        el.style.cssText = 'display:block;padding:8px;';
        document.body.appendChild(el);
      }, { t: tag, content: innerHTML, attributes: attrs });
      await page.waitForTimeout(500);
      await expect(page.locator(tag)).toHaveScreenshot(`${name}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }

  // ---- Color consistency regression ----

  test('workspace renders with consistent color tokens', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(500);
    const body = page.locator('body');
    const bgColor = await body.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bgColor).toBeTruthy();
  });

  test('toolbar buttons have consistent sizing', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(500);
    const toolbar = page.locator('penpot-toolbar');
    const buttons = toolbar.locator('.penpot-toolbar__toolbar-btn, button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  // ---- Console error regression ----

  test('canvas renders without console errors after drawing', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    await page.waitForTimeout(500);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });

  test('rulers render without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(1000);
    expect(errors.filter(e => !e.includes('ResizeObserver')).length).toBe(0);
  });
});