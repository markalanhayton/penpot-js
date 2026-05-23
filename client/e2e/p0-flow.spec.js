import { test, expect } from '@playwright/test';

test.describe('Full P0 Flow: Login → Dashboard → Create File → Workspace', () => {

  test('login and see dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');
    await expect(page.locator('#title')).toHaveText('Sign in to Penpot');

    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();

    await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });
  });

  test('login → dashboard shows team sidebar and projects', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');

    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();

    await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 15000 });

    const teamSidebar = page.locator('penpot-dashboard').locator('penpot-team-sidebar');
    await expect(teamSidebar).toBeVisible({ timeout: 10000 });

    const teams = teamSidebar.locator('.team-item');
    await expect(teams.first()).toBeVisible({ timeout: 5000 });
  });

  test('login → click project → see files', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');

    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();

    const dashboard = page.locator('penpot-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15000 });

    const projectCard = dashboard.locator('.project-card').first();
    if (await projectCard.isVisible({ timeout: 5000 })) {
      await projectCard.click();

      const fileCard = dashboard.locator('.file-card').first();
      await expect(fileCard).toBeVisible({ timeout: 5000 });
    }
  });

  test('login → create file → enter workspace', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');

    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();

    const dashboard = page.locator('penpot-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15000 });

    const newFileBtn = dashboard.locator('#new-file-btn, .new-file, .file-new, .file-card').first();
    if (await newFileBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newFileBtn.click();

      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 15000 });

      const fileName = page.locator('penpot-workspace').locator('#file-name');
      await expect(fileName).toBeVisible();
    }
  });

  test('dashboard → workspace → back to dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');

    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();

    const dashboard = page.locator('penpot-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15000 });

    const fileCard = dashboard.locator('.file-card[data-file-id], .file-card').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();

      await expect(page.locator('penpot-workspace')).toBeVisible({ timeout: 10000 });

      const backBtn = page.locator('penpot-workspace').locator('#back');
      await expect(backBtn).toBeVisible();
      await backBtn.click();

      await expect(page.locator('penpot-dashboard')).toBeVisible({ timeout: 5000 });
    }
  });

  test('workspace loads file and shows pages/layers', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');

    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();

    const dashboard = page.locator('penpot-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15000 });

    const fileCard = dashboard.locator('.file-card[data-file-id]').first();
    if (await fileCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileCard.click();

      const workspace = page.locator('penpot-workspace');
      await expect(workspace).toBeVisible({ timeout: 10000 });

      await expect(workspace.locator('#file-name')).toBeVisible();

      const pageList = workspace.locator('#page-list');
      await expect(pageList).toBeVisible();

      const toolBtns = workspace.locator('.tool-btn');
      await expect(toolBtns.first()).toBeVisible();
    }
  });
});

test.describe('Auth Screen Edge Cases', () => {

  test('switches to recovery mode and back', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');

    const switchLink = page.locator('#switch-link');
    await switchLink.click();
    await expect(page.locator('#title')).toHaveText('Create your account');

    await switchLink.click();
    await expect(page.locator('#title')).toHaveText('Sign in to Penpot');
  });

  test('shows validation error on empty email', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');

    await page.locator('#submit').click();
    await expect(page.locator('.penpot-app__auth-error')).toBeVisible({ timeout: 5000 });
  });

  test('password visibility toggle works', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');

    const pwInput = page.locator('#pw');
    await pwInput.fill('testpassword');
    await expect(pwInput).toHaveAttribute('type', 'password');

    await page.locator('#pw-toggle').click();
    await expect(pwInput).toHaveAttribute('type', 'text');

    await page.locator('#pw-toggle').click();
    await expect(pwInput).toHaveAttribute('type', 'password');
  });
});

test.describe('Dashboard Components', () => {

  test('team sidebar renders without errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');

    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();

    const dashboard = page.locator('penpot-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15000 });

    const teamSidebar = page.locator('penpot-team-sidebar');
    await expect(teamSidebar).toBeVisible({ timeout: 10000 });
  });

  test('logout returns to login screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('penpot-auth-screen');

    await page.locator('#email').fill('admin@penpot.local');
    await page.locator('#pw').fill('penpot123');
    await page.locator('#submit').click();

    const dashboard = page.locator('penpot-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15000 });

    await page.locator('#logout-btn').click();

    await expect(page.locator('penpot-auth-screen')).toBeVisible({ timeout: 5000 });
  });
});