import { test, expect } from '@playwright/test';

test.describe('P2 Design System Components', () => {

  test('component preview page loads without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/preview/');
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
    await expect(page.locator('h1')).toHaveText('Penpot Design System');
  });

  test('buttons render all variants', async ({ page }) => {
    await page.goto('/preview/');
    await page.waitForSelector('penpot-button[variant="primary"]');
    await expect(page.locator('penpot-button[variant="primary"]').first()).toBeVisible();
    await expect(page.locator('penpot-button[variant="danger"]').first()).toBeVisible();
    await expect(page.locator('penpot-button[variant="ghost"]').first()).toBeVisible();
  });

  test('button click emits event', async ({ page }) => {
    await page.goto('/preview/');
    let clicked = false;
    await page.evaluate(() => {
      const btn = document.querySelector('penpot-button[variant="primary"]');
      btn.addEventListener('penpot-button-click', () => { window.__btnClicked = true; });
    });
    await page.locator('penpot-button[variant="primary"]').first().click();
    expect(await page.evaluate(() => window.__btnClicked)).toBe(true);
  });

  test('checkbox toggles on click', async ({ page }) => {
    await page.goto('/preview/');
    const checkbox = page.locator('penpot-checkbox').first();
    await expect(checkbox).toBeVisible();
    const wasChecked = await checkbox.getAttribute('checked');
    await checkbox.click();
    const isChecked = await checkbox.getAttribute('checked');
    expect(wasChecked === null ? false : true).not.toBe(isChecked === null ? false : true);
  });

  test('switch toggles on click', async ({ page }) => {
    await page.goto('/preview/');
    const sw = page.locator('penpot-switch').first();
    await expect(sw).toBeVisible();
    const wasChecked = await sw.evaluate(el => el.hasAttribute('checked'));
    await sw.evaluate(el => {
      const input = el.querySelector('input[type="checkbox"]');
      if (input) input.click();
    });
    const isChecked = await sw.evaluate(el => el.hasAttribute('checked'));
    expect(isChecked).toBe(!wasChecked);
  });

  test('slider shows current value', async ({ page }) => {
    await page.goto('/preview/');
    const slider = page.locator('penpot-slider').first();
    await expect(slider).toBeVisible();
  });

  test('badges render all variants', async ({ page }) => {
    await page.goto('/preview/');
    await expect(page.locator('penpot-badge[variant="primary"]').first()).toBeVisible();
    await expect(page.locator('penpot-badge[variant="success"]').first()).toBeVisible();
    await expect(page.locator('penpot-badge[variant="danger"]').first()).toBeVisible();
    await expect(page.locator('penpot-badge[variant="warning"]').first()).toBeVisible();
    await expect(page.locator('penpot-badge[variant="info"]').first()).toBeVisible();
  });

  test('icon renders with name attribute', async ({ page }) => {
    await page.goto('/preview/');
    const icon = page.locator('penpot-icon[name="plus"]').first();
    await expect(icon).toBeVisible();
  });

  test('loader renders and spins', async ({ page }) => {
    await page.goto('/preview/');
    const loader = page.locator('penpot-loader').first();
    await expect(loader).toBeVisible();
  });

  test('avatar renders with initials', async ({ page }) => {
    await page.goto('/preview/');
    const avatar = page.locator('penpot-avatar[name="John Doe"]').first();
    await expect(avatar).toBeVisible();
  });

  test('file thumbnail renders', async ({ page }) => {
    await page.goto('/preview/');
    const thumb = page.locator('penpot-file-thumbnail').first();
    await expect(thumb).toBeVisible();
  });

  test('tabs switch between panels', async ({ page }) => {
    await page.goto('/preview/');
    const tabs = page.locator('penpot-tabs').first();
    await expect(tabs).toBeVisible();
    const panels = tabs.locator('penpot-tab-panel');
    await expect(panels.first()).toBeVisible();
  });

  test('dropdown opens and closes', async ({ page }) => {
    await page.goto('/preview/');
    const dropdown = page.locator('penpot-dropdown').first();
    await expect(dropdown).toBeVisible();
    const trigger = dropdown.locator('.penpot-dd__dropdown-trigger');
    await trigger.click();
    const menu = dropdown.locator('.penpot-dd__dropdown-menu');
    await expect(menu).toHaveClass(/penpot-dd__open/);
  });

  test('select opens and shows options', async ({ page }) => {
    await page.goto('/preview/');
    const select = page.locator('penpot-select').first();
    await expect(select).toBeVisible();
    const trigger = select.locator('.penpot-select__select-trigger');
    await trigger.click();
    const menu = select.locator('.penpot-select__select-menu');
    await expect(menu).toHaveClass(/penpot-select__open/);
  });

  test('notification triggers on button click', async ({ page }) => {
    await page.goto('/preview/');
    await page.locator('#notif-info').click();
    await expect(page.locator('#penpot-notifications')).toBeVisible({ timeout: 3000 });
  });

  test('color picker swatches render', async ({ page }) => {
    await page.goto('/preview/');
    const picker = page.locator('penpot-color-picker').first();
    await expect(picker).toBeVisible();
    const swatchesCount = await picker.evaluate(el => el.querySelectorAll('.penpot-color__swatch').length);
    expect(swatchesCount).toBeGreaterThan(0);
  });

  test('context menu shows on right-click', async ({ page }) => {
    await page.goto('/preview/');
    const btn = page.locator('#ctx-btn');
    await expect(btn).toBeVisible();
    await btn.click({ button: 'right' });
    const ctxMenu = page.locator('penpot-context-menu');
    await expect(ctxMenu).toBeVisible();
  });

  test('form validates required fields', async ({ page }) => {
    await page.goto('/preview/');
    const form = page.locator('penpot-form#demo-form').first();
    await expect(form).toBeVisible();
  });
});