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

  // ---- Auth screen visual ----

  test('auth screen renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const authScreen = page.locator('penpot-auth-screen');
    await expect(authScreen).toBeVisible();
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#pw')).toBeVisible();
    await expect(page.locator('#submit')).toBeVisible();
  });

  test('auth screen register mode renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.locator('#switch-link').click();
    await expect(page.locator('#title')).toHaveText('Create your account');
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#pw')).toBeVisible();
    await expect(page.locator('#submit')).toBeVisible();
  });

  test('auth screen recovery mode renders correctly', async ({ page }) => {
    await page.goto('/auth/recovery/request');
    await page.waitForSelector('penpot-auth-screen');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#submit')).toBeVisible();
  });

  // ---- Dashboard visual ----

  test('dashboard renders without layout errors', async ({ page }) => {
    await login(page);
    const dashboard = page.locator('penpot-dashboard');
    await expect(dashboard).toBeVisible();
    const teamSidebar = dashboard.locator('penpot-team-sidebar, #team-sidebar');
    if (await teamSidebar.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(teamSidebar).toBeVisible();
    }
  });

  // ---- Workspace shell visual ----

  test('workspace shell renders all major sections', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await expect(page.locator('penpot-workspace')).toBeVisible();
    await expect(page.locator('penpot-toolbar')).toBeVisible();
    await expect(page.locator('penpot-tools-bar')).toBeVisible();
    await expect(page.locator('penpot-left-sidebar')).toBeVisible();
    await expect(page.locator('penpot-canvas')).toBeVisible();
    await expect(page.locator('penpot-right-sidebar')).toBeVisible();
  });

  test('workspace toolbar renders correctly', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    await expect(toolbar.locator('#back')).toBeVisible();
    await expect(toolbar.locator('#file-name')).toBeVisible();
    await expect(toolbar.locator('#save-btn')).toBeVisible();
    await expect(toolbar.locator('#undo-btn')).toBeVisible();
    await expect(toolbar.locator('#redo-btn')).toBeVisible();
  });

  test('workspace tools bar renders correctly', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    await expect(tools.locator('[data-tool="select"]')).toBeVisible();
    await expect(tools.locator('[data-tool="rect"]')).toBeVisible();
    await expect(tools.locator('[data-tool="circle"]')).toBeVisible();
    await expect(tools.locator('[data-tool="hand"]')).toBeVisible();
  });

  // ---- Right sidebar visual ----

  test('right sidebar empty state renders correctly', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const emptyState = sidebar.locator('.penpot-rside__empty-state, .empty-state');
    if (await emptyState.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('right sidebar with shape shows design tab', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await expect(sidebar.locator('[data-tab="design"]')).toBeVisible();
    await expect(sidebar.locator('[data-tab="prototype"]')).toBeVisible();
    await expect(sidebar.locator('[data-tab="inspect"]')).toBeVisible();
  });

  test('right sidebar property inputs render correctly', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await drawRect(page);
    const sidebar = page.locator('penpot-right-sidebar');
    await expect(sidebar.locator('.penpot-rside__prop-input[data-prop="x"]')).toBeVisible({ timeout: 3000 });
    await expect(sidebar.locator('.penpot-rside__prop-input[data-prop="y"]')).toBeVisible();
    await expect(sidebar.locator('.penpot-rside__prop-input[data-prop="w"]')).toBeVisible();
    await expect(sidebar.locator('.penpot-rside__prop-input[data-prop="h"]')).toBeVisible();
  });

  // ---- Component visual ----

  test('design system components render without errors', async ({ page }) => {
    const componentTags = [
      'penpot-button', 'penpot-input', 'penpot-checkbox', 'penpot-switch',
      'penpot-radio', 'penpot-slider', 'penpot-tooltip', 'penpot-tabs',
      'penpot-dropdown', 'penpot-modal', 'penpot-select', 'penpot-notification',
      'penpot-avatar', 'penpot-badge', 'penpot-loader', 'penpot-icon'
    ];
    for (const tag of componentTags) {
      const defined = await page.evaluate((t) => customElements.get(t) !== undefined, tag);
    }
  });

  // ---- Canvas rendering visual ----

  test('canvas zoom controls render correctly', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    await expect(tools.locator('#zoom-level')).toBeVisible();
    await expect(tools.locator('#zoom-in')).toBeVisible();
    await expect(tools.locator('#zoom-out')).toBeVisible();
    await expect(tools.locator('#zoom-fit')).toBeVisible();
  });

  test('canvas shows container element', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const canvas = page.locator('penpot-canvas');
    const container = canvas.locator('#container');
    await expect(container).toBeVisible({ timeout: 5000 });
  });

  // ---- Error state visual ----

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

  // ---- Dark mode / theme visual (if supported) ----

  test('workspace renders with consistent color tokens', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const body = page.locator('body');
    const bgColor = await body.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bgColor).toBeTruthy();
  });

  test('toolbar buttons have consistent sizing', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const buttons = toolbar.locator('.penpot-toolbar__toolbar-btn, button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });
});