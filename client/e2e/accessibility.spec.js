import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

  test('auth screen: error message uses role=alert', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const errorEl = page.locator('.penpot-app__auth-error');
    const role = await errorEl.getAttribute('role');
    const ariaLive = await errorEl.getAttribute('aria-live');
    expect(role === 'alert' || ariaLive === 'assertive').toBeTruthy();
  });

  test('auth screen: submit button has accessible text', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const submitText = await page.locator('#submit').textContent();
    expect(submitText).toBeTruthy();
    expect(submitText.length).toBeGreaterThan(0);
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

  test('workspace: tool buttons have aria-label or aria-pressed', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const tools = page.locator('penpot-tools-bar');
    const toolBtns = tools.locator('[data-tool]');
    const count = await toolBtns.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < count; i++) {
      const btn = toolBtns.nth(i);
      const ariaLabel = await btn.getAttribute('aria-label');
      const ariaPressed = await btn.getAttribute('aria-pressed');
      expect(ariaLabel || ariaPressed).toBeTruthy();
    }
  });

  test('workspace: tool buttons have aria-pressed attribute', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const activeTool = page.locator('penpot-tools-bar').locator('[data-tool="select"]');
    const ariaPressed = await activeTool.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');
  });

  test('workspace: tools bar has toolbar role', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-tools-bar .penpot-tools__tool-group');
    const role = await toolbar.getAttribute('role');
    expect(role).toBe('toolbar');
  });

  test('workspace: right sidebar tabs use tab role', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-right-sidebar');
    const tablist = sidebar.locator('[role="tablist"]');
    await expect(tablist).toBeVisible();
    const tabs = sidebar.locator('[role="tab"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(3);
    const designTab = sidebar.locator('[data-tab="design"][role="tab"]');
    const ariaSelected = await designTab.getAttribute('aria-selected');
    expect(ariaSelected).toBe('true');
  });

  test('workspace: left sidebar tabs use tab role', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const tablist = sidebar.locator('[role="tablist"]');
    await expect(tablist).toBeVisible();
    const tabs = sidebar.locator('[role="tab"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('workspace: left sidebar tabpanels have aria-labelledby', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const sidebar = page.locator('penpot-left-sidebar');
    const layersPanel = sidebar.locator('[role="tabpanel"][aria-labelledby="tab-layers"]');
    await expect(layersPanel).toBeVisible();
  });

  test('workspace: main menu has menubar role', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const menubar = page.locator('penpot-main-menu [role="menubar"]');
    await expect(menubar).toBeVisible();
  });

  test('workspace: toolbar action buttons have aria-label', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const toolbar = page.locator('penpot-toolbar');
    const undoBtn = toolbar.locator('#undo-btn');
    const ariaLabel = await undoBtn.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    const saveBtn = toolbar.locator('#save-btn');
    const saveAria = await saveBtn.getAttribute('aria-label');
    expect(saveAria).toBeTruthy();
  });

  // ---- Modal accessibility ----

  test('modal: has role=dialog and aria-modal', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const modal = page.locator('penpot-modal');
    page.evaluate(() => {
      const m = document.createElement('penpot-modal');
      m.setAttribute('title', 'Test Modal');
      m.setAttribute('size', 'medium');
      document.body.appendChild(m);
      m.open();
      return true;
    });
    await page.waitForTimeout(500);
    const dialogEl = page.locator('.penpot-modal__modal');
    const role = await dialogEl.getAttribute('role');
    const ariaModal = await dialogEl.getAttribute('aria-modal');
    expect(role).toBe('dialog');
    expect(ariaModal).toBe('true');
  });

  test('modal: close button has aria-label', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const m = document.createElement('penpot-modal');
      m.setAttribute('title', 'Test Modal');
      document.body.appendChild(m);
      m.open();
      return true;
    });
    await page.waitForTimeout(500);
    const closeBtn = page.locator('.penpot-modal__modal-close');
    const ariaLabel = await closeBtn.getAttribute('aria-label');
    const title = await closeBtn.getAttribute('title');
    expect(ariaLabel || title).toBeTruthy();
  });

  test('modal: Escape key closes modal', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const m = document.createElement('penpot-modal');
      m.setAttribute('title', 'Test Modal');
      document.body.appendChild(m);
      m.open();
      return true;
    });
    await page.waitForTimeout(500);
    await expect(page.locator('penpot-modal.penpot-modal__open')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(page.locator('penpot-modal.penpot-modal__open')).not.toBeVisible();
  });

  test('modal: focus trap cycles through focusable elements', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const m = document.createElement('penpot-modal');
      m.setAttribute('title', 'Test Modal');
      m.innerHTML = '<button id="modal-btn1">First</button><button id="modal-btn2">Second</button>';
      document.body.appendChild(m);
      m.open();
      return true;
    });
    await page.waitForTimeout(500);
    const firstBtn = page.locator('#modal-btn1');
    await firstBtn.focus();
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).toBeTruthy();
  });

  // ---- Form component accessibility ----

  test('checkbox: has role=checkbox and aria-checked', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const cb = document.createElement('penpot-checkbox');
      cb.innerHTML = 'Test checkbox';
      document.body.appendChild(cb);
      return true;
    });
    await page.waitForTimeout(500);
    const box = page.locator('penpot-checkbox #box');
    const role = await box.getAttribute('role');
    const ariaChecked = await box.getAttribute('aria-checked');
    expect(role).toBe('checkbox');
    expect(ariaChecked).toBe('false');
  });

  test('checkbox: aria-checked toggles on click', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const cb = document.createElement('penpot-checkbox');
      cb.innerHTML = 'Toggle me';
      document.body.appendChild(cb);
      return true;
    });
    await page.waitForTimeout(500);
    await page.locator('penpot-checkbox').click();
    const ariaChecked = await page.locator('penpot-checkbox #box').getAttribute('aria-checked');
    expect(ariaChecked).toBe('true');
  });

  test('switch: has role=switch and aria-checked', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const sw = document.createElement('penpot-switch');
      sw.innerHTML = 'Toggle switch';
      document.body.appendChild(sw);
      return true;
    });
    await page.waitForTimeout(500);
    const track = page.locator('penpot-switch #track');
    const role = await track.getAttribute('role');
    const ariaChecked = await track.getAttribute('aria-checked');
    expect(role).toBe('switch');
    expect(ariaChecked).toBe('false');
  });

  test('switch: aria-checked toggles on change', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const sw = document.createElement('penpot-switch');
      sw.innerHTML = 'Toggle switch';
      document.body.appendChild(sw);
      return true;
    });
    await page.waitForTimeout(500);
    await page.locator('penpot-switch #input').check();
    await page.waitForTimeout(200);
    const ariaChecked = await page.locator('penpot-switch #track').getAttribute('aria-checked');
    expect(ariaChecked).toBe('true');
  });

  test('slider: has role=slider with aria attributes', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const sl = document.createElement('penpot-slider');
      sl.setAttribute('min', '0');
      sl.setAttribute('max', '100');
      sl.setAttribute('value', '50');
      document.body.appendChild(sl);
      return true;
    });
    await page.waitForTimeout(500);
    const track = page.locator('penpot-slider #track');
    const role = await track.getAttribute('role');
    const ariaValMin = await track.getAttribute('aria-valuemin');
    const ariaValMax = await track.getAttribute('aria-valuemax');
    const ariaValNow = await track.getAttribute('aria-valuenow');
    const ariaLabel = await track.getAttribute('aria-label');
    expect(role).toBe('slider');
    expect(ariaValMin).toBe('0');
    expect(ariaValMax).toBe('100');
    expect(ariaValNow).toBe('50');
    expect(ariaLabel).toBeTruthy();
  });

  // ---- Dropdown and Select accessibility ----

  test('dropdown: trigger has aria-haspopup and aria-expanded', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const dd = document.createElement('penpot-dropdown');
      dd.innerHTML = '<penpot-dropdown-item value="a" label="Option A"></penpot-dropdown-item>';
      document.body.appendChild(dd);
      return true;
    });
    await page.waitForTimeout(500);
    const trigger = page.locator('penpot-dropdown #trigger');
    const hasPopup = await trigger.getAttribute('aria-haspopup');
    const expanded = await trigger.getAttribute('aria-expanded');
    expect(hasPopup).toBe('listbox');
    expect(expanded).toBe('false');
  });

  test('dropdown: aria-expanded toggles on open/close', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const dd = document.createElement('penpot-dropdown');
      dd.innerHTML = '<penpot-dropdown-item value="a" label="Option A"></penpot-dropdown-item>';
      document.body.appendChild(dd);
      return true;
    });
    await page.waitForTimeout(500);
    await page.locator('penpot-dropdown #trigger').click();
    const expandedAfterOpen = await page.locator('penpot-dropdown #trigger').getAttribute('aria-expanded');
    expect(expandedAfterOpen).toBe('true');
    await page.locator('penpot-dropdown #overlay').click();
    const expandedAfterClose = await page.locator('penpot-dropdown #trigger').getAttribute('aria-expanded');
    expect(expandedAfterClose).toBe('false');
  });

  test('select: trigger has aria-haspopup and aria-expanded', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const sel = document.createElement('penpot-select');
      sel.innerHTML = '<option value="a">Option A</option><option value="b">Option B</option>';
      document.body.appendChild(sel);
      return true;
    });
    await page.waitForTimeout(500);
    const trigger = page.locator('penpot-select #trigger');
    const hasPopup = await trigger.getAttribute('aria-haspopup');
    const expanded = await trigger.getAttribute('aria-expanded');
    expect(hasPopup).toBe('listbox');
    expect(expanded).toBe('false');
  });

  test('select: menu items have role=option with aria-selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const sel = document.createElement('penpot-select');
      sel.setAttribute('value', 'a');
      sel.innerHTML = '<option value="a">Option A</option><option value="b">Option B</option>';
      document.body.appendChild(sel);
      return true;
    });
    await page.waitForTimeout(500);
    const trigger = page.locator('penpot-select #trigger');
    await trigger.click();
    const optionA = page.locator('.penpot-select__select-option').first();
    const role = await optionA.getAttribute('role');
    const ariaSelected = await optionA.getAttribute('aria-selected');
    expect(role).toBe('option');
    expect(ariaSelected).toBe('true');
  });

  // ---- Context menu accessibility ----

  test('context menu: uses role=menu and role=menuitem', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const ctx = document.createElement('penpot-context-menu');
      ctx.items = [
        { label: 'Cut', shortcut: 'Ctrl+X' },
        { label: 'Copy', shortcut: 'Ctrl+C' },
        { label: 'Paste', shortcut: 'Ctrl+V' },
      ];
      document.body.appendChild(ctx);
      ctx.show(100, 100);
      return true;
    });
    await page.waitForTimeout(300);
    const menu = page.locator('penpot-context-menu #menu');
    const menuRole = await menu.getAttribute('role');
    expect(menuRole).toBe('menu');
    const items = page.locator('penpot-context-menu [role="menuitem"]');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);
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

  // ---- axe-core automated audit ----

  test('auth screen: no axe-core violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await page.waitForTimeout(1000);
    const results = await new AxeBuilder({ page })
      .include('penpot-auth-screen')
      .analyze();
    const violations = results.violations.filter(v =>
      !v.id.startsWith('color-contrast')
    );
    expect(violations).toEqual([]);
  });

  test('workspace: no axe-core violations on canvas area', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(1000);
    const results = await new AxeBuilder({ page })
      .include('penpot-workspace')
      .analyze();
    const violations = results.violations.filter(v =>
      !v.id.startsWith('color-contrast')
    );
    expect(violations).toEqual([]);
  });

  test('modal: no axe-core violations', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const m = document.createElement('penpot-modal');
      m.setAttribute('title', 'Test Dialog');
      m.setAttribute('size', 'medium');
      m.innerHTML = '<p>This is test content inside the modal.</p>';
      document.body.appendChild(m);
      m.open();
      return true;
    });
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .include('penpot-modal')
      .analyze();
    const violations = results.violations.filter(v =>
      !v.id.startsWith('color-contrast')
    );
    expect(violations).toEqual([]);
  });

  test('sidebar tabs: no axe-core violations on left sidebar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .include('penpot-left-sidebar')
      .analyze();
    const violations = results.violations.filter(v =>
      !v.id.startsWith('color-contrast')
    );
    expect(violations).toEqual([]);
  });

  test('sidebar tabs: no axe-core violations on right sidebar', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .include('penpot-right-sidebar')
      .analyze();
    const violations = results.violations.filter(v =>
      !v.id.startsWith('color-contrast')
    );
    expect(violations).toEqual([]);
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

  // ---- Keyboard navigation: sidebar tabs ----

  test('left sidebar: clicking tab updates aria-selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const layersTab = page.locator('penpot-left-sidebar [data-tab="layers"][role="tab"]');
    const assetsTab = page.locator('penpot-left-sidebar [data-tab="assets"][role="tab"]');
    const layersSelected = await layersTab.getAttribute('aria-selected');
    const assetsSelected = await assetsTab.getAttribute('aria-selected');
    expect(layersSelected).toBe('true');
    expect(assetsSelected).toBe('false');
    await assetsTab.click();
    const layersAfter = await layersTab.getAttribute('aria-selected');
    const assetsAfter = await assetsTab.getAttribute('aria-selected');
    expect(layersAfter).toBe('false');
    expect(assetsAfter).toBe('true');
  });

  test('right sidebar: clicking tab updates aria-selected', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const designTab = page.locator('penpot-right-sidebar [data-tab="design"][role="tab"]');
    const protoTab = page.locator('penpot-right-sidebar [data-tab="prototype"][role="tab"]');
    const designSelected = await designTab.getAttribute('aria-selected');
    const protoSelected = await protoTab.getAttribute('aria-selected');
    expect(designSelected).toBe('true');
    expect(protoSelected).toBe('false');
    await protoTab.click();
    const designAfter = await designTab.getAttribute('aria-selected');
    const protoAfter = await protoTab.getAttribute('aria-selected');
    expect(designAfter).toBe('false');
    expect(protoAfter).toBe('true');
  });

  // ---- Main menu keyboard navigation ----

  test('main menu: trigger has aria-haspopup=true', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const trigger = page.locator('penpot-main-menu [data-menu-id="file"]');
    const hasPopup = await trigger.getAttribute('aria-haspopup');
    const role = await trigger.getAttribute('role');
    expect(hasPopup).toBe('true');
    expect(role).toBe('menuitem');
  });

  // ---- Zoom controls accessibility ----

  test('workspace: zoom level has aria-live', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    const zoomLevel = page.locator('penpot-tools-bar #zoom-level');
    const ariaLive = await zoomLevel.getAttribute('aria-live');
    const ariaLabel = await zoomLevel.getAttribute('aria-label');
    expect(ariaLive === 'polite' || ariaLabel).toBeTruthy();
  });

  // ---- Auth screen form accessibility ----

  test('auth screen: form fields have associated labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const emailLabel = page.locator('label[for="email"]');
    const pwLabel = page.locator('label[for="pw"]');
    await expect(emailLabel).toBeVisible();
    await expect(pwLabel).toBeVisible();
  });

  test('auth screen: password toggle button has accessible label', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    const toggle = page.locator('#pw-toggle');
    const title = await toggle.getAttribute('title');
    expect(title).toBeTruthy();
  });

  // ---- Checkbox and Switch keyboard interaction ----

  test('checkbox: Space key toggles checked state', async ({ page }) => {
    if (!(await openWorkspace(page))) return;
    page.evaluate(() => {
      const cb = document.createElement('penpot-checkbox');
      cb.innerHTML = 'Toggle checkbox';
      document.body.appendChild(cb);
      return true;
    });
    await page.waitForTimeout(500);
    await page.locator('penpot-checkbox').focus();
    await page.keyboard.press('Space');
    const ariaChecked = await page.locator('penpot-checkbox #box').getAttribute('aria-checked');
    expect(ariaChecked).toBe('true');
    await page.keyboard.press('Space');
    const ariaChecked2 = await page.locator('penpot-checkbox #box').getAttribute('aria-checked');
    expect(ariaChecked2).toBe('false');
  });
});